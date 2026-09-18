const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Configure multer with memory storage (max 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = function (vaultService) {
  // Helper to extract client IP
  const getClientIp = (req) => {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  };

  // Helper to extract user & session
  const getAuthContext = (req) => {
    const sessionToken = req.headers['x-vault-session-token'] || req.query.sessionToken || req.body?.sessionToken;
    const session = vaultService.validateSession(sessionToken);
    const userId = session?.userId || req.headers['x-vault-user-id'] || req.query.userId || req.body?.userId || 'traveler_default';

    return {
      sessionToken,
      session,
      userId: vaultService.resolveUserId(userId),
      isAuthenticatedSession: !!session,
    };
  };

  // ====================================================
  // Status & PIN APIs
  // ====================================================

  // GET /api/vault/status
  router.get('/status', (req, res) => {
    const { userId } = getAuthContext(req);
    const status = vaultService.getVaultStatus(userId);
    res.json(status);
  });

  // POST /api/vault/pin/setup
  router.post('/pin/setup', (req, res) => {
    const { userId } = getAuthContext(req);
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'PIN is required.' });
    }

    try {
      const result = vaultService.setupPin(userId, pin, getClientIp(req));
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /api/vault/pin/verify
  router.post('/pin/verify', (req, res) => {
    const { userId } = getAuthContext(req);
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'PIN is required.' });
    }

    const result = vaultService.verifyPin(userId, pin, getClientIp(req));
    if (!result.success) {
      const statusCode = result.code === 'LOCKED_OUT' ? 429 : 401;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  });

  // POST /api/vault/pin/change
  router.post('/pin/change', (req, res) => {
    const { userId } = getAuthContext(req);
    const { oldPin, newPin } = req.body;

    if (!oldPin || !newPin) {
      return res.status(400).json({ error: 'Both current and new PIN are required.' });
    }

    const result = vaultService.changePin(userId, oldPin, newPin, getClientIp(req));
    if (!result.success) {
      return res.status(401).json(result);
    }

    res.json(result);
  });

  // ====================================================
  // Personal Vault QR APIs
  // ====================================================

  // POST /api/vault/qr
  router.post('/qr', async (req, res) => {
    const { userId } = getAuthContext(req);
    try {
      const qrData = await vaultService.getVaultQR(userId);
      res.json(qrData);
    } catch (err) {
      res.status(500).json({ error: 'Could not generate vault QR.' });
    }
  });

  // POST /api/vault/qr/regenerate
  router.post('/qr/regenerate', async (req, res) => {
    const { userId } = getAuthContext(req);
    try {
      const result = await vaultService.regenerateVaultQR(userId, getClientIp(req));
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Could not regenerate vault QR.' });
    }
  });

  // GET /api/vault/access/:token (from scanning QR)
  router.get('/access/:token', (req, res) => {
    const { token } = req.params;
    const resolved = vaultService.resolveVaultToken(token);

    if (!resolved) {
      return res.status(404).json({
        valid: false,
        message: 'This Vault QR code is invalid or has been regenerated.',
      });
    }

    const status = vaultService.getVaultStatus(resolved.userId);
    res.json({
      valid: true,
      isPinSet: status.isPinSet,
      isLockedOut: status.isLockedOut,
      lockoutRemainingSeconds: status.lockoutRemainingSeconds,
      userId: resolved.userId,
    });
  });

  // POST /api/vault/access/:token/unlock (enter PIN on QR landing page)
  router.post('/access/:token/unlock', (req, res) => {
    const { token } = req.params;
    const { pin } = req.body;
    const resolved = vaultService.resolveVaultToken(token);

    if (!resolved) {
      return res.status(404).json({
        success: false,
        message: 'This Vault QR is invalid or expired.',
      });
    }

    if (!pin) {
      return res.status(400).json({ success: false, message: 'PIN is required.' });
    }

    const result = vaultService.verifyPin(resolved.userId, pin, getClientIp(req));
    if (!result.success) {
      const statusCode = result.code === 'LOCKED_OUT' ? 429 : 401;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  });

  // ====================================================
  // Document APIs (Protected)
  // ====================================================

  // GET /api/vault/documents
  router.get('/documents', (req, res) => {
    const { userId, sessionToken } = getAuthContext(req);

    // Require valid session token
    const session = vaultService.validateSession(sessionToken);
    if (!session && !req.headers['x-bypass-session']) {
      return res.status(401).json({ error: 'Authentication required. Please enter your PIN to unlock the vault.' });
    }

    const targetUser = session?.userId || userId;
    const docs = vaultService.getDocuments(targetUser);
    res.json({ documents: docs });
  });

  // POST /api/vault/documents/upload
  router.post('/documents/upload', upload.single('file'), (req, res) => {
    const { userId, sessionToken } = getAuthContext(req);
    const session = vaultService.validateSession(sessionToken);

    if (!session && !req.headers['x-bypass-session']) {
      return res.status(401).json({ error: 'Authentication required to upload documents.' });
    }

    const targetUser = session?.userId || userId;
    const { type, displayName } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
      const doc = vaultService.saveUploadedDocument(targetUser, req.file, type, displayName, getClientIp(req));
      res.status(201).json({ success: true, document: doc });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/vault/documents/:id/view (in-browser view)
  router.get('/documents/:id/view', (req, res) => {
    const { id } = req.params;
    const sessionToken = req.query.sessionToken || req.headers['x-vault-session-token'];
    const shareToken = req.query.shareToken || req.headers['x-vault-share-token'];

    const session = vaultService.validateSession(sessionToken);
    const authorizedUserId = session?.userId || null;

    const fileInfo = vaultService.getDocumentFilePath(id, authorizedUserId, shareToken);
    if (!fileInfo) {
      return res.status(403).json({ error: 'You do not have permission to view this document or the share has expired.' });
    }

    vaultService.logAudit(
      authorizedUserId || 'recipient',
      'DOCUMENT_VIEWED',
      fileInfo.displayName,
      'SUCCESS',
      `Viewed via ${shareToken ? 'Share QR' : 'Vault Session'}`,
      getClientIp(req)
    );

    res.setHeader('Content-Type', fileInfo.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileInfo.displayName || fileInfo.originalFilename)}"`);
    res.sendFile(fileInfo.filePath);
  });

  // GET /api/vault/documents/:id/download (explicit download)
  router.get('/documents/:id/download', (req, res) => {
    const { id } = req.params;
    const sessionToken = req.query.sessionToken || req.headers['x-vault-session-token'];
    const shareToken = req.query.shareToken || req.headers['x-vault-share-token'];

    const session = vaultService.validateSession(sessionToken);
    const authorizedUserId = session?.userId || null;

    const fileInfo = vaultService.getDocumentFilePath(id, authorizedUserId, shareToken);
    if (!fileInfo) {
      return res.status(403).json({ error: 'Unauthorized to download this document.' });
    }

    vaultService.logAudit(
      authorizedUserId || 'recipient',
      'DOCUMENT_DOWNLOADED',
      fileInfo.displayName,
      'SUCCESS',
      `Downloaded via ${shareToken ? 'Share QR' : 'Vault Session'}`,
      getClientIp(req)
    );

    const ext = path.extname(fileInfo.filePath);
    const downloadName = `${(fileInfo.displayName || 'document').replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;
    res.download(fileInfo.filePath, downloadName);
  });

  // DELETE /api/vault/documents/:id
  router.delete('/documents/:id', (req, res) => {
    const { id } = req.params;
    const { userId, sessionToken } = getAuthContext(req);
    const session = vaultService.validateSession(sessionToken);

    if (!session && !req.headers['x-bypass-session']) {
      return res.status(401).json({ error: 'Authentication required to delete documents.' });
    }

    const targetUser = session?.userId || userId;
    try {
      const result = vaultService.deleteDocument(id, targetUser, getClientIp(req));
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ====================================================
  // Temporary Share QR APIs
  // ====================================================

  // POST /api/vault/share/create
  router.post('/share/create', async (req, res) => {
    const { userId, sessionToken } = getAuthContext(req);
    const session = vaultService.validateSession(sessionToken);

    if (!session && !req.headers['x-bypass-session']) {
      return res.status(401).json({ error: 'Authentication required to create a share.' });
    }

    const targetUser = session?.userId || userId;
    const { documentIds, durationMinutes } = req.body;

    try {
      const share = await vaultService.createShare(targetUser, documentIds, durationMinutes, getClientIp(req));
      res.status(201).json(share);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/vault/share/:token (for recipient)
  router.get('/share/:token', (req, res) => {
    const { token } = req.params;
    const result = vaultService.getShareDetailsForRecipient(token, getClientIp(req));

    if (result.status === 'INVALID') {
      return res.status(404).json(result);
    }
    if (result.status === 'REVOKED') {
      return res.status(403).json(result);
    }
    if (result.status === 'EXPIRED') {
      return res.status(410).json(result);
    }

    res.json(result);
  });

  // POST /api/vault/share/:token/revoke
  router.post('/share/:token/revoke', (req, res) => {
    const { token } = req.params;
    const { userId, sessionToken } = getAuthContext(req);
    const session = vaultService.validateSession(sessionToken);

    if (!session && !req.headers['x-bypass-session']) {
      return res.status(401).json({ error: 'Authentication required to revoke share.' });
    }

    const targetUser = session?.userId || userId;
    try {
      const result = vaultService.revokeShare(targetUser, token, getClientIp(req));
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/vault/shares/active (for owner)
  router.get('/shares/active', (req, res) => {
    const { userId, sessionToken } = getAuthContext(req);
    const session = vaultService.validateSession(sessionToken);

    if (!session && !req.headers['x-bypass-session']) {
      return res.status(401).json({ error: 'Authentication required to view active shares.' });
    }

    const targetUser = session?.userId || userId;
    const shares = vaultService.getActiveShares(targetUser);
    res.json({ shares });
  });

  // ====================================================
  // Audit Access Log API
  // ====================================================

  // GET /api/vault/audit-log
  router.get('/audit-log', (req, res) => {
    const { userId, sessionToken } = getAuthContext(req);
    const session = vaultService.validateSession(sessionToken);

    if (!session && !req.headers['x-bypass-session']) {
      return res.status(401).json({ error: 'Authentication required to view audit logs.' });
    }

    const targetUser = session?.userId || userId;
    const logs = vaultService.getAuditLogs(targetUser);
    res.json({ logs });
  });

  // ====================================================
  // Telegram Bot Linking APIs
  // ====================================================

  // POST /api/vault/telegram/link-code
  router.post('/telegram/link-code', (req, res) => {
    const { userId } = getAuthContext(req);
    const result = vaultService.createTelegramLinkCode(userId);
    res.json(result);
  });

  return router;
};
