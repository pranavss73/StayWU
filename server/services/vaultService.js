const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');

class VaultService {
  constructor(frontendBaseUrl = 'http://127.0.0.1:3000') {
    this.frontendBaseUrl = frontendBaseUrl.replace(/\/$/, '').replace('//localhost', '//127.0.0.1');
    this.storageDir = path.join(__dirname, '..', 'storage', 'vault_docs');
    this.dbFile = path.join(__dirname, '..', 'data', 'vault_db.json');

    // Ensure storage directory exists
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    // In-memory runtime collections
    this.sessions = new Map(); // token -> { userId, createdAt, expiresAt }
    this.telegramLinkCodes = new Map(); // code -> { userId, createdAt, expiresAt }

    // Load or initialize persistent DB
    this.loadDatabase();

    console.log(`🛡️ VaultService initialized. Storage: ${this.storageDir}`);
  }

  // ======================================================
  // Database Persistence
  // ======================================================
  loadDatabase() {
    try {
      if (fs.existsSync(this.dbFile)) {
        const raw = fs.readFileSync(this.dbFile, 'utf-8');
        this.db = JSON.parse(raw);
      } else {
        this.initEmptyDatabase();
      }
    } catch (err) {
      console.warn('⚠️ Could not load vault_db.json, initializing fresh database:', err.message);
      this.initEmptyDatabase();
    }

    // Ensure all collections exist
    this.db.vaults = this.db.vaults || {}; // userId -> { pinHash, pinSalt, failedAttempts, lockoutUntil, createdAt, updatedAt }
    this.db.documents = this.db.documents || []; // [ { id, userId, type, displayName, storedFilename, originalFilename, mimeType, size, createdAt } ]
    this.db.vaultQRs = this.db.vaultQRs || {}; // userId -> { token, createdAt, updatedAt }
    this.db.shares = this.db.shares || []; // [ { id, userId, token, documentIds, createdAt, expiresAt, revokedAt, status } ]
    this.db.auditLogs = this.db.auditLogs || []; // [ { id, timestamp, userId, action, documentName, status, details } ]
    this.db.telegramLinks = this.db.telegramLinks || {}; // chatId -> userId & userId -> chatId

    // Purge any legacy sample documents & demo audit logs across all users
    let modified = false;
    const initialDocCount = this.db.documents.length;
    this.db.documents = this.db.documents.filter(d => 
      !(
        (d.displayName === 'Official Travel Passport' && (d.originalFilename === 'Passport_Gov_India.pdf' || d.size === 317)) ||
        (d.displayName === 'National Driving License' && (d.originalFilename === 'Driving_License_Card.png' || d.size === 67))
      )
    );
    if (this.db.documents.length !== initialDocCount) modified = true;

    const initialLogCount = this.db.auditLogs.length;
    this.db.auditLogs = this.db.auditLogs.filter(l =>
      l.details !== 'Sample demo document created' &&
      !['Official Travel Passport', 'National Driving License'].includes(l.documentName)
    );
    if (this.db.auditLogs.length !== initialLogCount) modified = true;

    if (modified) {
      this.saveDatabase();
      console.log('🧹 Purged legacy sample documents and demo audit logs from database.');
    }
  }

  initEmptyDatabase() {
    this.db = {
      vaults: {},
      documents: [],
      vaultQRs: {},
      shares: [],
      auditLogs: [],
      telegramLinks: {},
    };
    this.saveDatabase();
  }

  saveDatabase() {
    try {
      const dir = path.dirname(this.dbFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.dbFile, JSON.stringify(this.db, null, 2), 'utf-8');
    } catch (err) {
      console.error('❌ Failed to save vault_db.json:', err.message);
    }
  }

  // ======================================================
  // User Resolution Helper
  // ======================================================
  resolveUserId(userParam) {
    if (!userParam || userParam === 'undefined' || userParam === 'null') {
      return 'traveler_default';
    }
    return String(userParam).trim();
  }

  // ======================================================
  // PIN & Security Management
  // ======================================================
  hashPin(pin, salt) {
    return crypto.scryptSync(pin, salt, 64).toString('hex');
  }

  getVaultStatus(userId) {
    const uid = this.resolveUserId(userId);
    const vault = this.db.vaults[uid];
    const userDocs = this.db.documents.filter(d => d.userId === uid);
    const activeShares = this.db.shares.filter(
      s => s.userId === uid && s.status === 'ACTIVE' && new Date(s.expiresAt) > new Date()
    );

    return {
      userId: uid,
      isPinSet: !!(vault && vault.pinHash),
      isLockedOut: this.isUserLockedOut(uid),
      lockoutRemainingSeconds: this.getLockoutRemainingSeconds(uid),
      totalDocuments: userDocs.length,
      activeSharesCount: activeShares.length,
      telegramLinked: !!(this.db.telegramLinks[uid] || Object.values(this.db.telegramLinks).includes(uid)),
    };
  }

  isUserLockedOut(userId) {
    const vault = this.db.vaults[userId];
    if (!vault || !vault.lockoutUntil) return false;
    return new Date(vault.lockoutUntil) > new Date();
  }

  getLockoutRemainingSeconds(userId) {
    const vault = this.db.vaults[userId];
    if (!vault || !vault.lockoutUntil) return 0;
    const diff = new Date(vault.lockoutUntil) - new Date();
    return diff > 0 ? Math.ceil(diff / 1000) : 0;
  }

  setupPin(userId, pin, ip = '') {
    const uid = this.resolveUserId(userId);

    // Validate PIN (6 digits required, allow 4 digits if explicitly 4-6 numeric digits)
    if (!pin || !/^\d{4,6}$/.test(String(pin))) {
      throw new Error('PIN must be 4 to 6 numeric digits (6 digits recommended).');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = this.hashPin(String(pin), salt);

    this.db.vaults[uid] = {
      pinHash: hash,
      pinSalt: salt,
      failedAttempts: 0,
      lockoutUntil: null,
      createdAt: this.db.vaults[uid]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Auto-generate personal Vault QR if not already present
    if (!this.db.vaultQRs[uid]) {
      this.generateVaultQR(uid);
    }

    this.saveDatabase();
    this.logAudit(uid, 'PIN_SET', null, 'SUCCESS', 'Security PIN configured', ip);

    return { success: true, message: 'Security PIN configured successfully.' };
  }

  verifyPin(userId, pin, ip = '') {
    const uid = this.resolveUserId(userId);
    const vault = this.db.vaults[uid];

    if (!vault || !vault.pinHash) {
      return { success: false, code: 'PIN_NOT_SET', message: 'Vault Security PIN is not yet configured.' };
    }

    // Check lockout
    if (this.isUserLockedOut(uid)) {
      const remainingSecs = this.getLockoutRemainingSeconds(uid);
      const remainingMins = Math.ceil(remainingSecs / 60);
      this.logAudit(uid, 'PIN_FAILED', null, 'LOCKED_OUT', `Attempt while locked out (${remainingSecs}s remaining)`, ip);
      return {
        success: false,
        code: 'LOCKED_OUT',
        message: `Too many failed attempts. Vault temporarily locked. Try again in ${remainingMins} minute(s).`,
        lockoutRemainingSeconds: remainingSecs,
      };
    }

    // Verify hash
    const inputHash = this.hashPin(String(pin), vault.pinSalt);
    const isValid = crypto.timingSafeEqual(
      Buffer.from(inputHash, 'hex'),
      Buffer.from(vault.pinHash, 'hex')
    );

    if (!isValid) {
      vault.failedAttempts = (vault.failedAttempts || 0) + 1;

      if (vault.failedAttempts >= 5) {
        // 5-minute lockout
        vault.lockoutUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        this.saveDatabase();
        this.logAudit(uid, 'LOCKOUT_TRIGGERED', null, 'LOCKED', '5 failed attempts, locked for 5 minutes', ip);
        return {
          success: false,
          code: 'LOCKED_OUT',
          message: 'Too many failed attempts. Vault locked for 5 minutes.',
          lockoutRemainingSeconds: 300,
        };
      }

      this.saveDatabase();
      const remainingAttempts = 5 - vault.failedAttempts;
      this.logAudit(uid, 'PIN_FAILED', null, 'FAILED', `Incorrect PIN attempt (${vault.failedAttempts}/5)`, ip);
      return {
        success: false,
        code: 'INCORRECT_PIN',
        message: 'Incorrect PIN. Please try again.',
        remainingAttempts,
      };
    }

    // Success: reset failed attempts
    vault.failedAttempts = 0;
    vault.lockoutUntil = null;
    this.saveDatabase();

    // Generate short-lived authenticated session (15 minutes)
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    this.sessions.set(sessionToken, {
      userId: uid,
      createdAt: new Date().toISOString(),
      expiresAt,
    });

    this.logAudit(uid, 'VAULT_UNLOCKED', null, 'SUCCESS', 'Vault unlocked via PIN', ip);

    return {
      success: true,
      sessionToken,
      expiresAt,
      message: 'Vault unlocked successfully.',
    };
  }

  changePin(userId, oldPin, newPin, ip = '') {
    const uid = this.resolveUserId(userId);
    const verifyRes = this.verifyPin(uid, oldPin, ip);
    if (!verifyRes.success) {
      return verifyRes;
    }

    this.setupPin(uid, newPin, ip);
    this.logAudit(uid, 'PIN_CHANGED', null, 'SUCCESS', 'Security PIN updated', ip);
    return { success: true, message: 'Security PIN changed successfully.' };
  }

  validateSession(sessionToken) {
    if (!sessionToken) return null;
    const session = this.sessions.get(sessionToken);
    if (!session) return null;

    if (new Date() > new Date(session.expiresAt)) {
      this.sessions.delete(sessionToken);
      return null;
    }

    return session;
  }

  // ======================================================
  // Personal Vault QR
  // ======================================================
  async getVaultQR(userId) {
    const uid = this.resolveUserId(userId);
    let record = this.db.vaultQRs[uid];

    if (!record || !record.token) {
      record = await this.generateVaultQR(uid);
    } else if (!record.qrDataUrl) {
      // Regenerate QR image data if missing
      const accessUrl = `${this.frontendBaseUrl}/vault/access?token=${record.token}`;
      record.qrDataUrl = await QRCode.toDataURL(accessUrl, {
        width: 320,
        margin: 2,
        color: { dark: '#090b10', light: '#ffffff' },
      });
      record.accessUrl = accessUrl;
    }

    return {
      token: record.token,
      accessUrl: record.accessUrl || `${this.frontendBaseUrl}/vault/access?token=${record.token}`,
      qrDataUrl: record.qrDataUrl,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async generateVaultQR(userId) {
    const uid = this.resolveUserId(userId);
    // Cryptographically random 256-bit opaque token
    const token = crypto.randomBytes(32).toString('hex');
    const accessUrl = `${this.frontendBaseUrl}/vault/access?token=${token}`;

    const qrDataUrl = await QRCode.toDataURL(accessUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#090b10', light: '#ffffff' },
    });

    const record = {
      token,
      accessUrl,
      qrDataUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.db.vaultQRs[uid] = record;
    this.saveDatabase();
    this.logAudit(uid, 'VAULT_QR_GENERATED', null, 'SUCCESS', 'Personal Vault QR generated');

    return record;
  }

  async regenerateVaultQR(userId, ip = '') {
    const uid = this.resolveUserId(userId);
    const oldToken = this.db.vaultQRs[uid]?.token;

    const newRecord = await this.generateVaultQR(uid);
    this.logAudit(uid, 'VAULT_QR_REGENERATED', null, 'SUCCESS', 'Vault QR regenerated, previous QR invalidated', ip);

    return {
      success: true,
      message: 'New Vault QR generated. Previous QR has been invalidated.',
      qr: newRecord,
    };
  }

  resolveVaultToken(token) {
    if (!token) return null;
    for (const [userId, record] of Object.entries(this.db.vaultQRs)) {
      if (record && record.token === token) {
        return { userId, ...record };
      }
    }
    return null;
  }

  // ======================================================
  // Document Management
  // ======================================================
  getDocuments(userId) {
    const uid = this.resolveUserId(userId);
    return this.db.documents
      .filter(d => d.userId === uid)
      .map(d => ({
        id: d.id,
        userId: d.userId,
        type: d.type,
        displayName: d.displayName,
        originalFilename: d.originalFilename,
        mimeType: d.mimeType,
        size: d.size,
        sizeFormatted: this.formatFileSize(d.size),
        createdAt: d.createdAt,
        isProtected: true,
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getDocumentById(docId, userId = null) {
    const doc = this.db.documents.find(d => d.id === docId);
    if (!doc) return null;
    if (userId && doc.userId !== this.resolveUserId(userId)) {
      return null; // IDOR protection
    }
    return doc;
  }

  saveUploadedDocument(userId, file, type = 'Other', displayName = null, ip = '') {
    const uid = this.resolveUserId(userId);

    if (!file) {
      throw new Error('No file provided for upload.');
    }

    // Validate size (10MB max)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error('File exceeds maximum allowed size of 10MB.');
    }

    // Validate extension
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];
    if (!allowedExts.includes(ext)) {
      throw new Error(`File extension ${ext} is not allowed. Supported: PDF, JPG, JPEG, PNG.`);
    }

    // Validate MIME type
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimes.includes(file.mimetype.toLowerCase())) {
      throw new Error(`Invalid MIME type ${file.mimetype}.`);
    }

    // Validate magic bytes
    this.validateMagicBytes(file.buffer || fs.readFileSync(file.path), ext);

    // Generate random server-side filename (never use original filename)
    const storedFilename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    const targetPath = path.join(this.storageDir, storedFilename);

    // Save buffer or move file
    if (file.buffer) {
      fs.writeFileSync(targetPath, file.buffer);
    } else if (file.path) {
      fs.copyFileSync(file.path, targetPath);
      try { fs.unlinkSync(file.path); } catch { }
    }

    const docId = `doc_${crypto.randomBytes(8).toString('hex')}`;
    const cleanDisplayName = (displayName && displayName.trim()) ||
      file.originalname.replace(ext, '').replace(/[^a-zA-Z0-9 _-]/g, '').trim() ||
      `${type} Document`;

    const docRecord = {
      id: docId,
      userId: uid,
      type: type || 'Other',
      displayName: cleanDisplayName,
      originalFilename: file.originalname,
      storedFilename,
      mimeType: file.mimetype,
      size: file.size,
      createdAt: new Date().toISOString(),
    };

    this.db.documents.push(docRecord);
    this.saveDatabase();
    this.logAudit(uid, 'DOCUMENT_UPLOADED', cleanDisplayName, 'SUCCESS', `Uploaded ${type} (${this.formatFileSize(file.size)})`, ip);

    return {
      id: docRecord.id,
      type: docRecord.type,
      displayName: docRecord.displayName,
      mimeType: docRecord.mimeType,
      size: docRecord.size,
      sizeFormatted: this.formatFileSize(docRecord.size),
      createdAt: docRecord.createdAt,
    };
  }

  deleteDocument(docId, userId, ip = '') {
    const uid = this.resolveUserId(userId);
    const idx = this.db.documents.findIndex(d => d.id === docId && d.userId === uid);

    if (idx === -1) {
      throw new Error('Document not found or unauthorized.');
    }

    const doc = this.db.documents[idx];

    // Remove physical file from private storage
    const filePath = path.join(this.storageDir, doc.storedFilename);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.warn('Could not delete physical file:', err.message);
    }

    // Remove from active shares as well
    for (const share of this.db.shares) {
      if (share.documentIds && share.documentIds.includes(docId)) {
        share.documentIds = share.documentIds.filter(id => id !== docId);
      }
    }

    this.db.documents.splice(idx, 1);
    this.saveDatabase();
    this.logAudit(uid, 'DOCUMENT_DELETED', doc.displayName, 'SUCCESS', `Deleted ${doc.type}`, ip);

    return { success: true, message: 'Document deleted successfully.' };
  }

  getDocumentFilePath(docId, authorizedUserId = null, shareToken = null) {
    const doc = this.db.documents.find(d => d.id === docId);
    if (!doc) return null;

    // Authorization check
    let authorized = false;

    // Direct user owner check
    if (authorizedUserId && doc.userId === this.resolveUserId(authorizedUserId)) {
      authorized = true;
    }

    // Share token check
    if (!authorized && shareToken) {
      const share = this.getShareByToken(shareToken);
      if (share && share.status === 'ACTIVE' && share.documentIds.includes(docId)) {
        authorized = true;
      }
    }

    if (!authorized) {
      return null;
    }

    const filePath = path.join(this.storageDir, doc.storedFilename);
    if (!fs.existsSync(filePath)) return null;

    return {
      filePath,
      mimeType: doc.mimeType,
      displayName: doc.displayName,
      originalFilename: doc.originalFilename,
    };
  }

  validateMagicBytes(buffer, ext) {
    if (!buffer || buffer.length < 4) {
      throw new Error('Invalid or corrupted file content.');
    }

    if (ext === '.pdf') {
      const header = buffer.slice(0, 4).toString('ascii');
      if (header !== '%PDF') {
        throw new Error('File signature verification failed. The file is not a valid PDF.');
      }
    } else if (ext === '.png') {
      const pngSig = [0x89, 0x50, 0x4e, 0x47];
      for (let i = 0; i < 4; i++) {
        if (buffer[i] !== pngSig[i]) {
          throw new Error('File signature verification failed. The file is not a valid PNG.');
        }
      }
    } else if (ext === '.jpg' || ext === '.jpeg') {
      if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
        throw new Error('File signature verification failed. The file is not a valid JPEG.');
      }
    }
  }

  // ======================================================
  // Temporary Share QR & Sessions
  // ======================================================
  async createShare(userId, documentIds, durationMinutes = 15, ip = '') {
    const uid = this.resolveUserId(userId);

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      throw new Error('At least one document must be selected to share.');
    }

    // Verify all document IDs belong to this user
    const userDocIds = new Set(this.db.documents.filter(d => d.userId === uid).map(d => d.id));
    const validIds = documentIds.filter(id => userDocIds.has(id));

    if (validIds.length === 0) {
      throw new Error('Selected documents were not found in your vault.');
    }

    // Allowed durations: 5 min, 15 min, 60 min
    const validDurations = [5, 15, 60];
    const duration = validDurations.includes(Number(durationMinutes)) ? Number(durationMinutes) : 15;

    const shareId = `share_${crypto.randomBytes(8).toString('hex')}`;
    const token = crypto.randomBytes(32).toString('hex');
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + duration * 60 * 1000).toISOString();

    const accessUrl = `${this.frontendBaseUrl}/share/access?token=${token}`;
    const qrDataUrl = await QRCode.toDataURL(accessUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#090b10', light: '#ffffff' },
    });

    const shareRecord = {
      id: shareId,
      userId: uid,
      token,
      documentIds: validIds,
      durationMinutes: duration,
      createdAt,
      expiresAt,
      revokedAt: null,
      status: 'ACTIVE',
      qrDataUrl,
      accessUrl,
    };

    this.db.shares.push(shareRecord);
    this.saveDatabase();

    const docNames = this.db.documents
      .filter(d => validIds.includes(d.id))
      .map(d => d.displayName)
      .join(', ');

    this.logAudit(uid, 'SHARE_CREATED', docNames, 'SUCCESS', `Created ${duration}m share QR for ${validIds.length} doc(s)`, ip);

    return {
      shareId,
      token,
      accessUrl,
      qrDataUrl,
      durationMinutes: duration,
      createdAt,
      expiresAt,
      sharedDocumentsCount: validIds.length,
    };
  }

  getShareByToken(token) {
    if (!token) return null;
    const share = this.db.shares.find(s => s.token === token);
    if (!share) return null;

    // Check expiration
    if (share.status === 'ACTIVE' && new Date() > new Date(share.expiresAt)) {
      share.status = 'EXPIRED';
      this.saveDatabase();
    }

    return share;
  }

  getShareDetailsForRecipient(token, ip = '') {
    const share = this.getShareByToken(token);

    if (!share) {
      return { status: 'INVALID', message: 'This QR code is invalid.' };
    }

    if (share.status === 'REVOKED') {
      this.logAudit(share.userId, 'SHARE_VIEW_ATTEMPT', null, 'REVOKED', 'Attempted to access revoked share QR', ip);
      return {
        status: 'REVOKED',
        revokedAt: share.revokedAt,
        message: 'This document-sharing session has been revoked by the owner.',
      };
    }

    if (share.status === 'EXPIRED' || new Date() > new Date(share.expiresAt)) {
      share.status = 'EXPIRED';
      this.saveDatabase();
      this.logAudit(share.userId, 'SHARE_VIEW_ATTEMPT', null, 'EXPIRED', 'Attempted to access expired share QR', ip);
      return {
        status: 'EXPIRED',
        expiresAt: share.expiresAt,
        message: 'This document share has expired.',
      };
    }

    // Active share: Return ONLY the shared documents
    const sharedDocs = this.db.documents
      .filter(d => share.documentIds.includes(d.id))
      .map(d => ({
        id: d.id,
        type: d.type,
        displayName: d.displayName,
        mimeType: d.mimeType,
        size: d.size,
        sizeFormatted: this.formatFileSize(d.size),
        createdAt: d.createdAt,
      }));

    const remainingSeconds = Math.max(0, Math.ceil((new Date(share.expiresAt) - new Date()) / 1000));

    this.logAudit(share.userId, 'SHARE_VIEWED', `${sharedDocs.length} documents`, 'SUCCESS', 'Recipient viewed shared documents', ip);

    return {
      status: 'ACTIVE',
      shareId: share.id,
      expiresAt: share.expiresAt,
      remainingSeconds,
      documents: sharedDocs,
    };
  }

  revokeShare(userId, tokenOrId, ip = '') {
    const uid = this.resolveUserId(userId);
    const share = this.db.shares.find(
      s => (s.token === tokenOrId || s.id === tokenOrId) && s.userId === uid
    );

    if (!share) {
      throw new Error('Share session not found or unauthorized.');
    }

    share.status = 'REVOKED';
    share.revokedAt = new Date().toISOString();
    this.saveDatabase();

    this.logAudit(uid, 'SHARE_REVOKED', null, 'SUCCESS', `Revoked share session ${share.id}`, ip);

    return { success: true, message: 'Share access has been revoked successfully.' };
  }

  getActiveShares(userId) {
    const uid = this.resolveUserId(userId);
    const now = new Date();

    return this.db.shares
      .filter(s => s.userId === uid)
      .map(s => {
        const isExpired = s.status === 'ACTIVE' && now > new Date(s.expiresAt);
        const status = isExpired ? 'EXPIRED' : s.status;
        const remainingSeconds = status === 'ACTIVE' ? Math.max(0, Math.ceil((new Date(s.expiresAt) - now) / 1000)) : 0;

        const docNames = this.db.documents
          .filter(d => s.documentIds.includes(d.id))
          .map(d => d.displayName);

        return {
          id: s.id,
          token: s.token,
          status,
          documentNames,
          documentCount: s.documentIds.length,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          revokedAt: s.revokedAt,
          remainingSeconds,
          qrDataUrl: s.qrDataUrl,
          accessUrl: s.accessUrl,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // ======================================================
  // Audit Access Logging
  // ======================================================
  logAudit(userId, action, documentName = null, status = 'SUCCESS', details = '', ip = '') {
    const entry = {
      id: `log_${crypto.randomBytes(6).toString('hex')}`,
      timestamp: new Date().toISOString(),
      userId: this.resolveUserId(userId),
      action,
      documentName: documentName || '—',
      status,
      details,
      ip: ip ? ip.replace(/^.*:/, '') : 'local',
    };

    this.db.auditLogs.unshift(entry);
    // Keep max 200 audit logs
    if (this.db.auditLogs.length > 200) {
      this.db.auditLogs = this.db.auditLogs.slice(0, 200);
    }
    this.saveDatabase();
  }

  getAuditLogs(userId) {
    const uid = this.resolveUserId(userId);
    return this.db.auditLogs
      .filter(l => l.userId === uid)
      .slice(0, 50)
      .map(l => ({
        id: l.id,
        timestamp: l.timestamp,
        dateFormatted: this.formatDate(l.timestamp),
        action: l.action,
        actionFormatted: this.formatActionName(l.action),
        documentName: l.documentName,
        status: l.status,
        details: l.details,
      }));
  }

  // ======================================================
  // Telegram Bot Integration & Linking
  // ======================================================
  createTelegramLinkCode(userId) {
    const uid = this.resolveUserId(userId);
    // 6-character clean alphanumeric code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins
    this.telegramLinkCodes.set(code, { userId: uid, expiresAt });

    return {
      code,
      expiresAt,
      botUsername: process.env.TELEGRAM_BOT_USERNAME || 'StayWU_bot',
      botLink: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME || 'StayWU_bot'}?start=link_${code}`,
    };
  }

  linkTelegramChat(chatId, code) {
    const cleanCode = String(code).trim().toUpperCase();
    const entry = this.telegramLinkCodes.get(cleanCode);

    if (!entry) {
      return { success: false, message: 'Invalid or expired linking code. Please generate a new code on the StayWU website.' };
    }

    if (new Date() > new Date(entry.expiresAt)) {
      this.telegramLinkCodes.delete(cleanCode);
      return { success: false, message: 'Linking code has expired. Please generate a new code on the website.' };
    }

    const userId = entry.userId;
    this.db.telegramLinks[chatId] = userId;
    this.db.telegramLinks[userId] = chatId;
    this.telegramLinkCodes.delete(cleanCode);
    this.saveDatabase();

    this.logAudit(userId, 'TELEGRAM_LINKED', null, 'SUCCESS', `Linked Telegram Chat ID ${chatId}`);

    return {
      success: true,
      userId,
      message: '🎉 Your Telegram account is now securely linked to your StayWU Document Vault!',
    };
  }

  getUserIdForTelegramChat(chatId) {
    return this.db.telegramLinks[chatId] || null;
  }

  // Generate secure launchpad link for Telegram bot
  async generateTelegramVaultLink(chatId) {
    let userId = this.getUserIdForTelegramChat(chatId);
    if (!userId) {
      userId = 'traveler_default'; // default demo persona if unlinked
    }

    // Generate a temporary one-time web access token
    const token = crypto.randomBytes(32).toString('hex');
    // Map to user QR or create temporary session token
    this.db.vaultQRs[userId] = this.db.vaultQRs[userId] || {
      token,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const targetUrl = `${this.frontendBaseUrl}/vault/access?token=${this.db.vaultQRs[userId].token}`;
    return {
      targetUrl,
      userId,
    };
  }

  // ======================================================
  // Utility & Demo Seed Helpers
  // ======================================================
  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatDate(isoStr) {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  }

  formatActionName(action) {
    const map = {
      VAULT_UNLOCKED: 'Vault Unlocked',
      DOCUMENT_VIEWED: 'Document Viewed',
      DOCUMENT_DOWNLOADED: 'Document Downloaded',
      DOCUMENT_UPLOADED: 'Document Uploaded',
      DOCUMENT_DELETED: 'Document Deleted',
      SHARE_CREATED: 'Share QR Created',
      SHARE_VIEWED: 'Share Accessed',
      SHARE_REVOKED: 'Share Revoked',
      PIN_SET: 'Security PIN Configured',
      PIN_CHANGED: 'Security PIN Changed',
      PIN_FAILED: 'Incorrect PIN Attempt',
      LOCKOUT_TRIGGERED: 'Security Lockout',
      VAULT_QR_GENERATED: 'Vault QR Created',
      VAULT_QR_REGENERATED: 'Vault QR Regenerated',
      TELEGRAM_LINKED: 'Telegram Connected',
    };
    return map[action] || action;
  }

  seedSampleDocumentsIfEmpty(userId) {
    // No-op: new user vaults start clean with 0 documents
  }
}

module.exports = VaultService;
