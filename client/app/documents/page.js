'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Shield,
  Lock,
  Unlock,
  KeyRound,
  QrCode,
  Share2,
  Eye,
  Download,
  Trash2,
  Plus,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  ArrowLeft,
  ExternalLink,
  Send,
  Bot,
  Copy,
  Check,
  X,
  ChevronRight,
  Info,
  Building2,
  Sparkles,
  Loader2,
  FileCheck,
  UserCheck,
  ShieldAlert,
  Camera,
  PhoneCall,
  HeartPulse,
  LifeBuoy
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AuthModal from '../../components/AuthModal';
import { API_BASE, BACKEND_URL } from '@/lib/api';

const DOCUMENT_CATEGORIES = [
  { id: 'All', label: 'All Documents' },
  { id: 'Passport', label: 'Passport' },
  { id: 'Government ID', label: 'Government ID' },
  { id: 'Driving License', label: 'Driving License' },
  { id: 'Visa', label: 'Visa' },
  { id: 'Travel Insurance', label: 'Travel Insurance' },
  { id: 'Flight Ticket', label: 'Flight Ticket' },
  { id: 'Hotel Booking', label: 'Hotel Booking' },
  { id: 'Other', label: 'Other' },
];

export default function DocumentVaultPage() {
  const { user } = useAuth();
  const userId = user?.uid || 'traveler_default';

  // Vault State
  const [vaultStatus, setVaultStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null);
  const [sessionCountdown, setSessionCountdown] = useState(0);

  // Documents & Lists
  const [documents, setDocuments] = useState([]);
  const [activeShares, setActiveShares] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [memoriesData, setMemoriesData] = useState(null);
  const [generatingDemoMemory, setGeneratingDemoMemory] = useState(false);
  const [activeTab, setActiveTab] = useState('documents'); // 'documents' | 'shares' | 'logs' | 'memories' | 'sos'
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Modals & Panels
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinMode, setPinMode] = useState('unlock'); // 'setup' | 'unlock' | 'change'
  const [pinInput, setPinInput] = useState('');
  const [oldPinInput, setOldPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Upload Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadType, setUploadType] = useState('Passport');
  const [uploadDisplayName, setUploadDisplayName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);

  // Vault QR Modal
  const [showVaultQRModal, setShowVaultQRModal] = useState(false);
  const [vaultQR, setVaultQR] = useState(null);
  const [regeneratingQR, setRegeneratingQR] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Share Modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedShareDocs, setSelectedShareDocs] = useState([]);
  const [shareDuration, setShareDuration] = useState(15); // minutes
  const [createdShare, setCreatedShare] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState('');

  // Document Viewer Modal
  const [viewingDoc, setViewingDoc] = useState(null);

  // Telegram Linking Modal
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramCode, setTelegramCode] = useState(null);
  const [copiedTelegramCode, setCopiedTelegramCode] = useState(false);

  // Generic Toast / Alert
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ========================================================
  // Initial Status Fetch
  // ========================================================
  const fetchStatus = async (overrideToken = null) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/vault/status?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        setVaultStatus(data);
        const hasToken = overrideToken !== null ? overrideToken : !!sessionToken;
        if (!data.isPinSet) {
          setPinMode('setup');
          setShowPinModal(true);
        } else if (!hasToken) {
          setPinMode('unlock');
          setShowPinModal(true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch vault status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Whenever userId changes (e.g. login/logout/switch accounts), completely reset state
    setSessionToken(null);
    setSessionExpiresAt(null);
    setSessionCountdown(0);
    setDocuments([]);
    setActiveShares([]);
    setAuditLogs([]);
    setPinInput('');
    setOldPinInput('');
    setConfirmPinInput('');
    setPinError('');
    fetchStatus(false);
  }, [userId]);

  // Session timer countdown
  useEffect(() => {
    if (!sessionExpiresAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((new Date(sessionExpiresAt) - new Date()) / 1000));
      setSessionCountdown(remaining);
      if (remaining <= 0) {
        setSessionToken(null);
        setSessionExpiresAt(null);
        setDocuments([]);
        setShowPinModal(true);
        setPinMode('unlock');
        showToast('Your secure vault session has expired. Please unlock again.', 'warning');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionExpiresAt]);

  // ========================================================
  // Fetch Protected Data
  // ========================================================
  const fetchDocuments = async () => {
    if (!sessionToken) return;
    try {
      const res = await fetch(`${API_BASE}/vault/documents?userId=${encodeURIComponent(userId)}`, {
        headers: { 'x-vault-session-token': sessionToken },
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      } else if (res.status === 401) {
        setSessionToken(null);
        setShowPinModal(true);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  const fetchActiveShares = async () => {
    if (!sessionToken) return;
    try {
      const res = await fetch(`${API_BASE}/vault/shares/active?userId=${encodeURIComponent(userId)}`, {
        headers: { 'x-vault-session-token': sessionToken },
      });
      if (res.ok) {
        const data = await res.json();
        setActiveShares(data.shares || []);
      }
    } catch (err) {
      console.error('Error fetching active shares:', err);
    }
  };

  const fetchAuditLogs = async () => {
    if (!sessionToken) return;
    try {
      const res = await fetch(`${API_BASE}/vault/audit-log?userId=${encodeURIComponent(userId)}`, {
        headers: { 'x-vault-session-token': sessionToken },
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    }
  };

  const fetchMemories = async () => {
    try {
      const res = await fetch(`${API_BASE.replace(/\/api$/, '')}/api/memories/latest?chatId=demo_user`);
      if (res.ok) {
        const data = await res.json();
        if (data.available) {
          setMemoriesData(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch memories:', err);
    }
  };

  const handleGenerateDemoMemory = async () => {
    setGeneratingDemoMemory(true);
    try {
      const res = await fetch(`${API_BASE.replace(/\/api$/, '')}/api/memories/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName: user?.displayName || 'Pranav & Friends' }),
      });
      if (res.ok) {
        const data = await res.json();
        setMemoriesData({
          available: true,
          pngUrl: data.pngUrl,
          svgUrl: data.svgUrl,
          caption: data.caption,
          photos: data.photos,
          booking: data.booking,
        });
        showToast('✨ 1-Tap Presentation Demo Story generated!');
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to generate demo story.', 'error');
      }
    } catch (err) {
      showToast('Connection error generating memory dump.', 'error');
    } finally {
      setGeneratingDemoMemory(false);
    }
  };

  useEffect(() => {
    if (sessionToken) {
      fetchDocuments();
      fetchActiveShares();
      fetchAuditLogs();
    }
  }, [sessionToken]);

  // ========================================================
  // PIN Verification & Setup
  // ========================================================
  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setPinError('');
    setPinLoading(true);

    try {
      if (pinMode === 'setup') {
        if (pinInput.length < 4 || pinInput.length > 6) {
          setPinError('PIN must be 4 to 6 digits (6 recommended).');
          setPinLoading(false);
          return;
        }
        if (pinInput !== confirmPinInput) {
          setPinError('PINs do not match. Please re-enter.');
          setPinLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE}/vault/pin/setup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, pin: pinInput }),
        });
        const data = await res.json();

        if (res.ok) {
          showToast('Security PIN created successfully!');
          // Immediately verify to create session
          const verifyRes = await fetch(`${API_BASE}/vault/pin/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, pin: pinInput }),
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok) {
            setSessionToken(verifyData.sessionToken);
            setSessionExpiresAt(verifyData.expiresAt);
            setShowPinModal(false);
            setPinInput('');
            setConfirmPinInput('');
            fetchStatus();
          }
        } else {
          setPinError(data.error || 'Failed to setup PIN.');
        }
      } else if (pinMode === 'unlock') {
        const res = await fetch(`${API_BASE}/vault/pin/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, pin: pinInput }),
        });
        const data = await res.json();

        if (res.ok) {
          setSessionToken(data.sessionToken);
          setSessionExpiresAt(data.expiresAt);
          setShowPinModal(false);
          setPinInput('');
          showToast('Vault unlocked successfully!');
          fetchStatus();
        } else {
          setPinError(data.message || 'Incorrect PIN. Please try again.');
        }
      } else if (pinMode === 'change') {
        const res = await fetch(`${API_BASE}/vault/pin/change`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, oldPin: oldPinInput, newPin: pinInput }),
        });
        const data = await res.json();

        if (res.ok) {
          showToast('Security PIN changed successfully!');
          setShowPinModal(false);
          setPinInput('');
          setOldPinInput('');
          setConfirmPinInput('');
        } else {
          setPinError(data.message || data.error || 'Failed to change PIN.');
        }
      }
    } catch (err) {
      setPinError('Connection error. Please try again.');
    } finally {
      setPinLoading(false);
    }
  };

  const handleLockVault = () => {
    setSessionToken(null);
    setSessionExpiresAt(null);
    setDocuments([]);
    setActiveShares([]);
    setAuditLogs([]);
    setPinMode('unlock');
    setPinInput('');
    setShowPinModal(true);
    showToast('Vault has been securely locked.', 'info');
  };

  // ========================================================
  // Upload Handler
  // ========================================================
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please choose a document to upload.');
      return;
    }
    setUploadError('');
    setUploadLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('type', uploadType);
      formData.append('displayName', uploadDisplayName || uploadFile.name);
      formData.append('userId', userId);

      const res = await fetch(`${API_BASE}/vault/documents/upload`, {
        method: 'POST',
        headers: {
          'x-vault-session-token': sessionToken || '',
        },
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`✓ ${data.document.displayName} uploaded securely!`);
        setShowUploadModal(false);
        setUploadFile(null);
        setUploadDisplayName('');
        fetchDocuments();
        fetchAuditLogs();
        fetchStatus();
      } else {
        setUploadError(data.error || 'Upload failed.');
      }
    } catch (err) {
      setUploadError('Network error uploading document.');
    } finally {
      setUploadLoading(false);
    }
  };

  // ========================================================
  // Document Delete Handler
  // ========================================================
  const handleDeleteDocument = async (docId, docName) => {
    if (!confirm(`Are you sure you want to delete "${docName}" from your secure vault?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/vault/documents/${docId}?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { 'x-vault-session-token': sessionToken || '' },
      });
      if (res.ok) {
        showToast('Document deleted permanently.');
        fetchDocuments();
        fetchAuditLogs();
        fetchStatus();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete document.', 'error');
      }
    } catch (err) {
      showToast('Error deleting document.', 'error');
    }
  };

  // ========================================================
  // Personal Vault QR
  // ========================================================
  const handleShowVaultQR = async () => {
    try {
      const res = await fetch(`${API_BASE}/vault/qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        setVaultQR(data);
        setShowVaultQRModal(true);
      }
    } catch (err) {
      showToast('Error generating Vault QR.', 'error');
    }
  };

  const handleRegenerateVaultQR = async () => {
    if (!confirm('Generate a new Vault QR? Your previous Vault QR will stop working immediately.')) {
      return;
    }
    setRegeneratingQR(true);
    try {
      const res = await fetch(`${API_BASE}/vault/qr/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        setVaultQR(data.qr);
        showToast('New Vault QR created! Previous QR invalidated.');
        fetchAuditLogs();
      }
    } catch (err) {
      showToast('Failed to regenerate QR.', 'error');
    } finally {
      setRegeneratingQR(false);
    }
  };

  // ========================================================
  // Create Share Handler
  // ========================================================
  const handleOpenShareModal = (initialDocId = null) => {
    if (initialDocId) {
      setSelectedShareDocs([initialDocId]);
    } else {
      setSelectedShareDocs([]);
    }
    setCreatedShare(null);
    setShareError('');
    setShowShareModal(true);
  };

  const handleCreateShareSubmit = async (e) => {
    e.preventDefault();
    if (selectedShareDocs.length === 0) {
      setShareError('Please select at least one document to share.');
      return;
    }
    setShareLoading(true);
    setShareError('');

    try {
      const res = await fetch(`${API_BASE}/vault/share/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vault-session-token': sessionToken || '',
        },
        body: JSON.stringify({
          userId,
          documentIds: selectedShareDocs,
          durationMinutes: shareDuration,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setCreatedShare(data);
        showToast(`Secure Share QR generated (${shareDuration}m)!`);
        fetchActiveShares();
        fetchAuditLogs();
        fetchStatus();
      } else {
        setShareError(data.error || 'Failed to create share.');
      }
    } catch (err) {
      setShareError('Network error creating share QR.');
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevokeShare = async (token) => {
    if (!confirm('Revoke this share access immediately? Recipient will no longer be able to view shared documents.')) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/vault/share/${token}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vault-session-token': sessionToken || '',
        },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        showToast('Share access revoked immediately.');
        fetchActiveShares();
        fetchAuditLogs();
        fetchStatus();
        if (createdShare?.token === token) {
          setCreatedShare(null);
          setShowShareModal(false);
        }
      } else {
        const data = await res.json();
        showToast(data.error || 'Could not revoke share.', 'error');
      }
    } catch (err) {
      showToast('Error revoking share.', 'error');
    }
  };

  // ========================================================
  // Telegram Link Code
  // ========================================================
  const handleOpenTelegramLink = async () => {
    try {
      const res = await fetch(`${API_BASE}/vault/telegram/link-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        setTelegramCode(data);
        setShowTelegramModal(true);
      }
    } catch (err) {
      showToast('Could not generate Telegram link code.', 'error');
    }
  };

  // Filtered documents
  const filteredDocs = documents.filter((doc) => {
    if (selectedCategory === 'All') return true;
    return doc.type === selectedCategory;
  });

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="vault-page-wrapper">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`vault-toast vault-toast-${toastMessage.type}`}>
          {toastMessage.type === 'success' && <CheckCircle2 size={16} />}
          {toastMessage.type === 'warning' && <AlertTriangle size={16} />}
          {toastMessage.type === 'info' && <Info size={16} />}
          <span>{toastMessage.msg}</span>
        </div>
      )}

      {/* Top Bar Ticker */}
      <div className="top-ticker-bar">
        <div className="container top-ticker-inner">
          <div className="ticker-item">
            <span className="ticker-pulse-dot" />
            <span className="ticker-tag">Zero-Knowledge Vault</span>
            <span className="ticker-divider">•</span>
            <span>Cryptographic PIN Protection & Ephemeral QR Sharing Active</span>
          </div>
          <div className="ticker-item">
            <span className="ticker-divider">•</span>
            <span>Telegram Concierge @StayWU_bot Ready</span>
          </div>
        </div>
      </div>

      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <Link href="/" className="navbar-brand-group">
            <div className="navbar-logo-badge">
              <Building2 size={18} />
            </div>
            <div className="navbar-brand-text">
              <span className="navbar-title">STAYWU</span>
              <span className="navbar-subtitle">Goa Trust Atlas</span>
            </div>
          </Link>

          <div className="vault-nav-actions">
            <Link href="/" className="vault-back-link">
              <ArrowLeft size={14} />
              <span>Back to Hotels</span>
            </Link>

            {sessionToken ? (
              <div className="vault-session-chip">
                <span className="vault-session-dot" />
                <span className="vault-session-time">Unlocked ({formatCountdown(sessionCountdown)})</span>
                <button className="vault-lock-btn" onClick={handleLockVault} title="Lock Vault Now">
                  <Lock size={13} />
                  <span>Lock</span>
                </button>
              </div>
            ) : (
              <button className="vault-unlock-btn" onClick={() => { setPinMode('unlock'); setShowPinModal(true); }}>
                <KeyRound size={14} />
                <span>Unlock Vault</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Vault Hero Section */}
      <header className="vault-hero-section">
        <div className="container vault-hero-container">
          <div className="vault-hero-badge">
            <ShieldCheck size={14} color="var(--accent-gold)" />
            <span>StayWU Secure Document Vault</span>
          </div>

          <h1 className="vault-hero-title">
            Travel Light. Your Documents <span className="gold-shimmer-text">Stay With You.</span>
          </h1>

          <p className="vault-hero-subtitle">
            Securely keep essential travel documents in your private StayWU vault and access them whenever you need them — at airport security, hotel check-ins, or rental desks.
          </p>

          <div className="vault-hero-cta-group">
            <button
              className="vault-btn-primary"
              onClick={() => {
                if (!sessionToken) {
                  setShowPinModal(true);
                } else {
                  setShowUploadModal(true);
                }
              }}
            >
              <Plus size={16} />
              <span>Upload Document</span>
            </button>

            <button className="vault-btn-secondary" onClick={handleShowVaultQR}>
              <QrCode size={16} />
              <span>View My Vault QR</span>
            </button>

            <button
              className="vault-btn-secondary"
              onClick={() => handleOpenShareModal()}
              disabled={documents.length === 0}
            >
              <Share2 size={16} />
              <span>Create Secure Share</span>
            </button>

            <button className="vault-btn-secondary" onClick={handleOpenTelegramLink}>
              <Bot size={16} />
              <span>Connect Telegram</span>
            </button>
          </div>
        </div>
      </header>

      {/* Security Principles Panel */}
      <section className="container vault-security-strip-container">
        <div className="vault-security-strip">
          <div className="vault-sec-pillar">
            <div className="vault-sec-icon-box">
              <Shield size={18} color="var(--trust-emerald)" />
            </div>
            <div>
              <div className="vault-sec-pillar-title">Private Storage</div>
              <div className="vault-sec-pillar-desc">Stored outside public web roots with randomized UUID filenames.</div>
            </div>
          </div>

          <div className="vault-sec-pillar">
            <div className="vault-sec-icon-box">
              <KeyRound size={18} color="var(--accent-gold)" />
            </div>
            <div>
              <div className="vault-sec-pillar-title">Salted PIN Security</div>
              <div className="vault-sec-pillar-desc">Encrypted with scrypt KDF. Rate-limited with 5-minute lockout.</div>
            </div>
          </div>

          <div className="vault-sec-pillar">
            <div className="vault-sec-icon-box">
              <QrCode size={18} color="#38bdf8" />
            </div>
            <div>
              <div className="vault-sec-pillar-title">Opaque QR Tokens</div>
              <div className="vault-sec-pillar-desc">No personal data or URLs embedded in QR codes. Opaque 256-bit keys.</div>
            </div>
          </div>

          <div className="vault-sec-pillar">
            <div className="vault-sec-icon-box">
              <Clock size={18} color="var(--trust-amber)" />
            </div>
            <div>
              <div className="vault-sec-pillar-title">Temporary & Revocable</div>
              <div className="vault-sec-pillar-desc">Share select docs with 5m, 15m, or 1h expiry. Instant one-click revoke.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Vault Workspace */}
      <main className="container vault-workspace-container">
        {/* Navigation Tabs */}
        <div className="vault-tabs-bar">
          <div className="vault-tab-buttons">
            <button
              className={`vault-tab-btn ${activeTab === 'documents' ? 'active' : ''}`}
              onClick={() => setActiveTab('documents')}
            >
              <FileText size={15} />
              <span>My Documents ({documents.length})</span>
            </button>

            <button
              className={`vault-tab-btn ${activeTab === 'shares' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('shares');
                fetchActiveShares();
              }}
            >
              <Share2 size={15} />
              <span>Active Shares ({activeShares.filter(s => s.status === 'ACTIVE').length})</span>
            </button>

            <button
              className={`vault-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('logs');
                fetchAuditLogs();
              }}
            >
              <Clock size={15} />
              <span>Access History ({auditLogs.length})</span>
            </button>

            <button
              className={`vault-tab-btn ${activeTab === 'memories' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('memories');
                fetchMemories();
              }}
            >
              <Camera size={15} color="var(--accent-gold)" />
              <span>Trip Memories (Story)</span>
            </button>

            <button
              className={`vault-tab-btn ${activeTab === 'sos' ? 'active' : ''}`}
              onClick={() => setActiveTab('sos')}
            >
              <HeartPulse size={15} color="#fb7185" />
              <span style={{ color: '#fb7185' }}>Goa SOS & Emergency</span>
            </button>
          </div>

          <div className="vault-quick-meta">
            {vaultStatus?.isPinSet ? (
              <span className="vault-badge-pill verified">
                <CheckCircle2 size={12} />
                <span>PIN Protected</span>
              </span>
            ) : (
              <span className="vault-badge-pill caution">
                <AlertTriangle size={12} />
                <span>PIN Setup Needed</span>
              </span>
            )}
            <button
              className="vault-link-text-btn"
              onClick={() => { setPinMode('change'); setShowPinModal(true); }}
            >
              Change PIN
            </button>
          </div>
        </div>

        {/* Tab 1: Documents */}
        {activeTab === 'documents' && (
          <div className="vault-tab-content">
            {/* Category Filter Pills */}
            <div className="vault-category-filter">
              {DOCUMENT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  className={`vault-cat-pill ${selectedCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {!sessionToken ? (
              <div className="vault-locked-notice-card">
                <div className="vault-locked-icon">
                  <Lock size={36} color="var(--accent-gold)" />
                </div>
                <h3>Your Vault is Locked</h3>
                <p>Enter your 6-digit Security PIN to access your private travel documents.</p>
                <button
                  className="vault-btn-primary"
                  onClick={() => { setPinMode('unlock'); setShowPinModal(true); }}
                >
                  <KeyRound size={16} />
                  <span>Enter Security PIN</span>
                </button>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="vault-empty-state">
                <FileText size={44} color="var(--text-muted)" />
                <h3>No Documents in this Category</h3>
                <p>Upload your passport, IDs, tickets, or travel insurance to keep them handy.</p>
                <button className="vault-btn-primary" onClick={() => setShowUploadModal(true)}>
                  <Plus size={16} />
                  <span>Upload Document Now</span>
                </button>
              </div>
            ) : (
              <div className="vault-docs-grid">
                {filteredDocs.map((doc) => (
                  <div key={doc.id} className="vault-doc-card">
                    <div className="vault-doc-header">
                      <div className="vault-doc-type-icon">
                        {doc.mimeType === 'application/pdf' ? (
                          <FileText size={22} color="var(--accent-gold)" />
                        ) : (
                          <ImageIcon size={22} color="#38bdf8" />
                        )}
                      </div>
                      <div className="vault-doc-badges">
                        <span className="vault-doc-type-tag">{doc.type}</span>
                        <span className="vault-doc-secured-pill">
                          <ShieldCheck size={11} />
                          <span>Encrypted</span>
                        </span>
                      </div>
                    </div>

                    <div className="vault-doc-info">
                      <h4 className="vault-doc-title" title={doc.displayName}>
                        {doc.displayName}
                      </h4>
                      <div className="vault-doc-meta-row">
                        <span>{doc.sizeFormatted}</span>
                        <span>•</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>

                    <div className="vault-doc-actions">
                      <button
                        className="vault-card-action-btn primary"
                        onClick={() => setViewingDoc(doc)}
                        title="View in secure browser viewer"
                      >
                        <Eye size={14} />
                        <span>View</span>
                      </button>

                      <button
                        className="vault-card-action-btn"
                        onClick={() => handleOpenShareModal(doc.id)}
                        title="Create temporary share QR"
                      >
                        <Share2 size={14} />
                        <span>Share</span>
                      </button>

                      <button
                        className="vault-card-action-btn danger"
                        onClick={() => handleDeleteDocument(doc.id, doc.displayName)}
                        title="Delete from vault"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Active Shares */}
        {activeTab === 'shares' && (
          <div className="vault-tab-content">
            {!sessionToken ? (
              <div className="vault-locked-notice-card">
                <Lock size={36} color="var(--accent-gold)" />
                <h3>Unlock to Manage Active Shares</h3>
                <button className="vault-btn-primary" onClick={() => { setPinMode('unlock'); setShowPinModal(true); }}>
                  <span>Enter Security PIN</span>
                </button>
              </div>
            ) : activeShares.length === 0 ? (
              <div className="vault-empty-state">
                <Share2 size={44} color="var(--text-muted)" />
                <h3>No Active Shares</h3>
                <p>When you generate temporary share QR codes for hotel desks or rentals, they appear here.</p>
                <button
                  className="vault-btn-primary"
                  onClick={() => handleOpenShareModal()}
                  disabled={documents.length === 0}
                >
                  <Plus size={16} />
                  <span>Create New Share</span>
                </button>
              </div>
            ) : (
              <div className="vault-shares-list">
                {activeShares.map((share) => {
                  const isExpired = share.status === 'EXPIRED';
                  const isRevoked = share.status === 'REVOKED';
                  const isActive = share.status === 'ACTIVE';

                  return (
                    <div key={share.id} className={`vault-share-card status-${share.status.toLowerCase()}`}>
                      <div className="vault-share-meta-left">
                        <div className="vault-share-status-pill">
                          {isActive && <span className="pulse-green-dot" />}
                          <span className={`share-status-tag ${share.status.toLowerCase()}`}>
                            {share.status}
                          </span>
                        </div>

                        <div>
                          <h4 className="vault-share-docs-heading">
                            {share.documentNames.join(', ')}
                          </h4>
                          <div className="vault-share-meta-details">
                            <span>Created: {new Date(share.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>•</span>
                            <span>
                              {isActive ? `Expires in: ${formatCountdown(share.remainingSeconds)}` : `Expired / Revoked`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="vault-share-actions">
                        {isActive && (
                          <>
                            <button
                              className="vault-card-action-btn"
                              onClick={() => {
                                setCreatedShare(share);
                                setShowShareModal(true);
                              }}
                            >
                              <QrCode size={14} />
                              <span>View QR</span>
                            </button>

                            <button
                              className="vault-card-action-btn danger"
                              onClick={() => handleRevokeShare(share.token)}
                            >
                              <X size={14} />
                              <span>Revoke</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Access History / Audit Logs */}
        {activeTab === 'logs' && (
          <div className="vault-tab-content">
            {!sessionToken ? (
              <div className="vault-locked-notice-card">
                <Lock size={36} color="var(--accent-gold)" />
                <h3>Unlock to View Audit History</h3>
                <button className="vault-btn-primary" onClick={() => { setPinMode('unlock'); setShowPinModal(true); }}>
                  <span>Enter Security PIN</span>
                </button>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="vault-empty-state">
                <Clock size={44} color="var(--text-muted)" />
                <h3>No Access Logs Recorded Yet</h3>
                <p>All unlocking, document views, uploads, and share events are securely logged here.</p>
              </div>
            ) : (
              <div className="vault-audit-table-wrapper">
                <table className="vault-audit-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Activity</th>
                      <th>Document</th>
                      <th>Status</th>
                      <th>Security Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="log-time-cell">{log.dateFormatted}</td>
                        <td className="log-action-cell">
                          <span className="log-action-badge">{log.actionFormatted}</span>
                        </td>
                        <td className="log-doc-cell">{log.documentName}</td>
                        <td className="log-status-cell">
                          <span className={`log-status-pill ${log.status.toLowerCase()}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="log-details-cell">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Trip Memories & 1-Tap Demo Mode */}
        {activeTab === 'memories' && (
          <div className="vault-tab-content memories-tab-panel">
            <div className="memories-hero-banner">
              <div className="memories-hero-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-gold)', marginBottom: 4 }}>
                  <Sparkles size={16} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>StayWU Story Engine</span>
                </div>
                <h3>AI Trip Memory Dump & Scrapbook</h3>
                <p>
                  Collect 5 moments during your trip on Telegram. StayWU automatically arranges them into a social-ready 9:16 vertical scrapbook with AI captions.
                </p>
              </div>

              <button
                className="btn-demo-trigger"
                onClick={handleGenerateDemoMemory}
                disabled={generatingDemoMemory}
              >
                {generatingDemoMemory ? (
                  <>
                    <Loader2 size={16} className="spin-icon" />
                    <span>Rendering 1080×1920 Story...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span> 1-Tap Presentation Demo</span>
                  </>
                )}
              </button>
            </div>

            {memoriesData?.available ? (
              <div className="memories-showcase-layout">
                <div className="memory-story-frame">
                  <img
                    src={memoriesData.pngUrl ? `${BACKEND_URL}${memoriesData.pngUrl}` : `${BACKEND_URL}${memoriesData.svgUrl}`}
                    alt="StayWU Trip Memory Dump"
                    className="memory-story-img"
                  />
                </div>

                <div className="memory-details-card">
                  <div className="memory-details-header">
                    <div className="memory-details-title">Generated Story Details</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      1080 × 1920 px • Formatted for WhatsApp Status & Instagram Stories
                    </div>
                    {memoriesData.caption && (
                      <div className="memory-caption-quote">
                        "{memoriesData.caption}"
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Places & Moments Captured:
                    </div>
                    <div className="memory-places-list">
                      {(memoriesData.photos || [
                        { place: 'Chapora Fort', dateLabel: '12 Sep 2026' },
                        { place: 'Anjuna Flea Market', dateLabel: '13 Sep 2026' },
                        { place: 'Curlies Beach Shack', dateLabel: '14 Sep 2026' },
                        { place: 'Fontainhas Latin Quarter', dateLabel: '15 Sep 2026' },
                        { place: 'Vagator Sunset Point', dateLabel: '16 Sep 2026' },
                      ]).map((item, idx) => (
                        <div key={idx} className="memory-place-item">
                          <span className="memory-place-name">
                            <span style={{ color: 'var(--accent-gold)' }}>📍</span>
                            <span>{item.place}</span>
                          </span>
                          <span className="memory-place-date">{item.dateLabel}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="memory-actions-row">
                    {memoriesData.pngUrl && (
                      <a
                        href={`${BACKEND_URL}${memoriesData.pngUrl}`}
                        download="StayWU_Trip_Story.png"
                        target="_blank"
                        rel="noreferrer"
                        className="btn-memory-download"
                      >
                        <Download size={14} />
                        <span>Download Story PNG</span>
                      </a>
                    )}
                    {memoriesData.svgUrl && (
                      <a
                        href={`${BACKEND_URL}${memoriesData.svgUrl}`}
                        download="StayWU_Trip_Story.svg"
                        target="_blank"
                        rel="noreferrer"
                        className="btn-memory-download"
                      >
                        <ExternalLink size={14} />
                        <span>Open Vector SVG</span>
                      </a>
                    )}
                    <button
                      className="btn-memory-download"
                      onClick={handleGenerateDemoMemory}
                      disabled={generatingDemoMemory}
                    >
                      <RefreshCw size={14} />
                      <span>Regenerate Demo</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="vault-empty-state">
                <Camera size={44} color="var(--text-muted)" />
                <h3>No Memory Dump Generated Yet</h3>
                <p>
                  Send 5 photos to <strong>@StayWU_bot</strong> on Telegram, or click <strong>⚡ 1-Tap Presentation Demo</strong> above to generate a live showcase instantly using your demo photos!
                </p>
                <div style={{ marginTop: 14 }}>
                  <button
                    className="btn-demo-trigger"
                    onClick={handleGenerateDemoMemory}
                    disabled={generatingDemoMemory}
                  >
                    <Sparkles size={15} />
                    <span> Generate 1-Tap Demo Memory Dump Now</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Goa Traveler SOS & Emergency Dashboard */}
        {activeTab === 'sos' && (
          <div className="vault-tab-content sos-tab-panel">
            <div className="sos-alert-banner">
              <div>
                <div className="sos-alert-title">
                  <ShieldAlert size={22} />
                  <span>StayWU 24/7 Traveler Emergency Shield (Goa)</span>
                </div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  Official verified police, hospital, and tourist protection hotlines with zero cell data requirement.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <a href="tel:112" className="vault-btn-primary" style={{ background: '#f43f5e', borderColor: '#f43f5e', textDecoration: 'none' }}>
                  <PhoneCall size={15} />
                  <span>Call 112 (Police)</span>
                </a>
              </div>
            </div>

            {/* Helplines Grid */}
            <div className="sos-helplines-grid">
              <a href="tel:+918322428473" className="sos-phone-card">
                <div className="sos-phone-info">
                  <h4>Goa Tourist Police</h4>
                  <p>Harassment, scams & visitor security</p>
                  <div style={{ fontSize: '0.82rem', color: 'var(--accent-gold)', marginTop: 4, fontWeight: 700 }}>+91 832 242 8473</div>
                </div>
                <div className="sos-phone-dial">
                  <PhoneCall size={16} />
                </div>
              </a>

              <a href="tel:108" className="sos-phone-card">
                <div className="sos-phone-info">
                  <h4>Medical Ambulance (108)</h4>
                  <p>24/7 Free emergency medical response</p>
                  <div style={{ fontSize: '0.82rem', color: '#34d399', marginTop: 4, fontWeight: 700 }}>Dial 108</div>
                </div>
                <div className="sos-phone-dial" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                  <PhoneCall size={16} />
                </div>
              </a>

              <a href="tel:1091" className="sos-phone-card">
                <div className="sos-phone-info">
                  <h4>Women Safety Helpline (1091)</h4>
                  <p>Dedicated Goa Police women protection cell</p>
                  <div style={{ fontSize: '0.82rem', color: '#fb7185', marginTop: 4, fontWeight: 700 }}>Dial 1091</div>
                </div>
                <div className="sos-phone-dial">
                  <PhoneCall size={16} />
                </div>
              </a>

              <a href="tel:1093" className="sos-phone-card">
                <div className="sos-phone-info">
                  <h4>Coastal Marine Police (1093)</h4>
                  <p>Beach safety, sea rescue & drowning alerts</p>
                  <div style={{ fontSize: '0.82rem', color: '#38bdf8', marginTop: 4, fontWeight: 700 }}>Dial 1093</div>
                </div>
                <div className="sos-phone-dial" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                  <PhoneCall size={16} />
                </div>
              </a>

              <a href="tel:101" className="sos-phone-card">
                <div className="sos-phone-info">
                  <h4>Fire & Disaster Response</h4>
                  <p>Emergency rescue & fire services</p>
                  <div style={{ fontSize: '0.82rem', color: '#f59e0b', marginTop: 4, fontWeight: 700 }}>Dial 101</div>
                </div>
                <div className="sos-phone-dial" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                  <PhoneCall size={16} />
                </div>
              </a>

              <div className="sos-phone-card" style={{ cursor: 'default' }}>
                <div className="sos-phone-info">
                  <h4>StayWU Telegram SOS</h4>
                  <p>Type /sos anytime on @StayWU_bot</p>
                  <div style={{ fontSize: '0.82rem', color: 'var(--accent-gold)', marginTop: 4, fontWeight: 700 }}>/sos Command Active</div>
                </div>
                <div className="sos-phone-dial" style={{ background: 'rgba(226, 183, 116, 0.15)', color: 'var(--accent-gold)' }}>
                  <Bot size={16} />
                </div>
              </div>
            </div>

            {/* Hospitals by Region */}
            <div className="sos-hospitals-section">
              <div className="sos-hospital-card">
                <div className="sos-hospital-header">
                  <Building2 size={16} />
                  <span>North Goa 24/7 Trauma Hospitals</span>
                </div>
                <div className="sos-hospital-item">
                  <div className="sos-hospital-name">Goa Medical College & Hospital (GMC)</div>
                  <div className="sos-hospital-type">Bambolim • Premier Tertiary Care, Multi-Specialty Trauma & ICU</div>
                </div>
                <div className="sos-hospital-item">
                  <div className="sos-hospital-name">North Goa District Hospital</div>
                  <div className="sos-hospital-type">Mapusa • 24/7 Casualty, Emergency & Pharmacy</div>
                </div>
                <div className="sos-hospital-item">
                  <div className="sos-hospital-name">Manipal Hospital</div>
                  <div className="sos-hospital-type">Dona Paula, Panaji • Private Comprehensive Emergency</div>
                </div>
              </div>

              <div className="sos-hospital-card">
                <div className="sos-hospital-header">
                  <Building2 size={16} />
                  <span>South Goa 24/7 Trauma Hospitals</span>
                </div>
                <div className="sos-hospital-item">
                  <div className="sos-hospital-name">South Goa District Hospital</div>
                  <div className="sos-hospital-type">Margao • 24/7 Emergency Wing, Blood Bank & Trauma</div>
                </div>
                <div className="sos-hospital-item">
                  <div className="sos-hospital-name">Apollo Victor Hospital</div>
                  <div className="sos-hospital-type">Malbhat, Margao • Multi-Specialty Critical Care ICU</div>
                </div>
                <div className="sos-hospital-item">
                  <div className="sos-hospital-name">Sub-District Hospital Ponda</div>
                  <div className="sos-hospital-type">Ponda • Emergency Care & Triage</div>
                </div>
              </div>
            </div>

            {/* Scooter Checkpoint & ID Scam Protocol */}
            <div className="scooter-rights-box">
              <ShieldCheck size={28} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-heading)', marginBottom: 4 }}>
                  Goa Scooter Rental & Police Checkpoint Protocol
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  1. <strong>Zero-Trust Identity:</strong> Never surrender physical passport or Aadhaar card to private scooter rental vendors. Use your <strong>StayWU 15-Minute Expiring Share QR</strong>.
                  <br />
                  2. <strong>Legal Checkpoint Powers:</strong> Traffic police can only ask to inspect: Driving License, Registration (RC), Insurance, and PUC. Both rider and pillion must wear helmets.
                  <br />
                  3. <strong>E-Challan Requirement:</strong> Cash demands without an official SMS receipt from Goa Police are unauthorized. Always ask for an e-challan.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODAL 1: PIN Setup / Unlock / Change */}
      {/* ======================================================== */}
      {showPinModal && (
        <div className="vault-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowPinModal(false); }}>
          <div className="vault-modal-card">
            <div className="vault-modal-header">
              <div className="vault-modal-title-group">
                <div className="vault-modal-icon-badge">
                  <KeyRound size={20} color="var(--accent-gold)" />
                </div>
                <div>
                  <h3 className="vault-modal-title">
                    {pinMode === 'setup' && 'Create Vault Security PIN'}
                    {pinMode === 'unlock' && 'Enter Security PIN'}
                    {pinMode === 'change' && 'Change Security PIN'}
                  </h3>
                  <p className="vault-modal-subtitle">
                    {pinMode === 'setup' && 'Choose a 6-digit PIN to encrypt and protect your travel documents.'}
                    {pinMode === 'unlock' && 'Enter your 6-digit PIN to access your encrypted document vault.'}
                    {pinMode === 'change' && 'Verify your existing PIN and choose a new 6-digit PIN.'}
                  </p>
                </div>
              </div>
              <button className="vault-modal-close-btn" onClick={() => setShowPinModal(false)} title="Close (Enter PIN later)">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePinSubmit} className="vault-pin-form">
              {pinMode === 'change' && (
                <div className="vault-input-group">
                  <label>Current PIN</label>
                  <input
                    type="password"
                    maxLength={6}
                    className="vault-text-input pin-entry"
                    placeholder="••••••"
                    value={oldPinInput}
                    onChange={(e) => setOldPinInput(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                  />
                </div>
              )}

              <div className="vault-input-group">
                <label>{pinMode === 'change' ? 'New 6-Digit PIN' : 'Security PIN (6 Digits)'}</label>
                <input
                  type="password"
                  maxLength={6}
                  className="vault-text-input pin-entry"
                  placeholder="••••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus={pinMode !== 'change'}
                />
              </div>

              {pinMode === 'setup' && (
                <div className="vault-input-group">
                  <label>Confirm Security PIN</label>
                  <input
                    type="password"
                    maxLength={6}
                    className="vault-text-input pin-entry"
                    placeholder="••••••"
                    value={confirmPinInput}
                    onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
              )}

              {pinError && (
                <div className="vault-form-error-banner">
                  <AlertTriangle size={14} />
                  <span>{pinError}</span>
                </div>
              )}

              <div className="vault-pin-tips">
                <ShieldCheck size={13} color="var(--trust-emerald)" />
                <span>Protected against brute-force. 5 incorrect attempts triggers a 5-minute lockout.</span>
              </div>

              <div className="vault-modal-footer">
                <button
                  type="submit"
                  className="vault-btn-primary full-width"
                  disabled={pinLoading || pinInput.length < 4}
                >
                  {pinLoading ? <Loader2 size={16} className="spin" /> : <Lock size={16} />}
                  <span>
                    {pinMode === 'setup' && 'Activate Vault'}
                    {pinMode === 'unlock' && 'Unlock Vault'}
                    {pinMode === 'change' && 'Update PIN'}
                  </span>
                </button>
              </div>

              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setActiveTab('memories');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-gold)',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: '4px 8px',
                  }}
                >
                  Skip PIN & Explore Trip Memories / SOS Helplines &rarr;
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: Upload Document */}
      {/* ======================================================== */}
      {showUploadModal && (
        <div className="vault-modal-overlay">
          <div className="vault-modal-card">
            <div className="vault-modal-header">
              <div className="vault-modal-title-group">
                <div className="vault-modal-icon-badge">
                  <Plus size={20} color="var(--accent-gold)" />
                </div>
                <div>
                  <h3 className="vault-modal-title">Upload Travel Document</h3>
                  <p className="vault-modal-subtitle">Private storage outside public web roots with randomized UUID naming.</p>
                </div>
              </div>
              <button className="vault-modal-close-btn" onClick={() => setShowUploadModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="vault-upload-form">
              <div className="vault-input-group">
                <label>Document Category</label>
                <select
                  className="vault-select-input"
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                >
                  {DOCUMENT_CATEGORIES.filter(c => c.id !== 'All').map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="vault-input-group">
                <label>Friendly Display Name (Optional)</label>
                <input
                  type="text"
                  className="vault-text-input"
                  placeholder="e.g. Goa Trip Indian Passport"
                  value={uploadDisplayName}
                  onChange={(e) => setUploadDisplayName(e.target.value)}
                />
              </div>

              <div className="vault-input-group">
                <label>Choose File (PDF, JPG, JPEG, PNG — Max 10MB)</label>
                <div className="vault-file-dropzone">
                  <input
                    type="file"
                    id="vault-file-upload"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/png,image/jpeg"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setUploadFile(f);
                        if (!uploadDisplayName) {
                          setUploadDisplayName(f.name.replace(/\.[^/.]+$/, ''));
                        }
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="vault-file-upload" className="vault-dropzone-label">
                    {uploadFile ? (
                      <div className="dropzone-file-selected">
                        <FileCheck size={28} color="var(--trust-emerald)" />
                        <span className="file-name">{uploadFile.name}</span>
                        <span className="file-size">({(uploadFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                    ) : (
                      <div className="dropzone-placeholder">
                        <FileText size={28} color="var(--accent-gold)" />
                        <span>Click to select or drop document here</span>
                        <span className="dropzone-hint">Validated via MIME type & magic bytes signature</span>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {uploadError && (
                <div className="vault-form-error-banner">
                  <AlertTriangle size={14} />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="vault-modal-footer">
                <button
                  type="submit"
                  className="vault-btn-primary full-width"
                  disabled={uploadLoading || !uploadFile}
                >
                  {uploadLoading ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}
                  <span>Save to Secure Vault</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: My Vault QR */}
      {/* ======================================================== */}
      {showVaultQRModal && vaultQR && (
        <div className="vault-modal-overlay">
          <div className="vault-modal-card qr-modal-card">
            <div className="vault-modal-header">
              <div className="vault-modal-title-group">
                <div className="vault-modal-icon-badge">
                  <QrCode size={20} color="var(--accent-gold)" />
                </div>
                <div>
                  <h3 className="vault-modal-title">Access My Vault</h3>
                  <p className="vault-modal-subtitle">Scan from another device to open the secure PIN barrier.</p>
                </div>
              </div>
              <button className="vault-modal-close-btn" onClick={() => setShowVaultQRModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="vault-qr-display-body">
              <div className="vault-qr-frame">
                <img src={vaultQR.qrDataUrl} alt="Personal Vault QR Code" className="vault-qr-image" />
              </div>

              <div className="vault-qr-security-note">
                <ShieldCheck size={15} color="var(--trust-emerald)" />
                <span>
                  <strong>Zero Personal Data in QR:</strong> Contains only a random 256-bit token. The recipient device must still enter your Security PIN to unlock.
                </span>
              </div>

              <div className="vault-qr-link-copy-box">
                <input type="text" readOnly value={vaultQR.accessUrl} className="vault-qr-link-input" />
                <button
                  className="vault-copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(vaultQR.accessUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                >
                  {copiedLink ? <Check size={14} color="var(--trust-emerald)" /> : <Copy size={14} />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="vault-qr-regen-box">
                <button
                  className="vault-btn-danger-outline"
                  onClick={handleRegenerateVaultQR}
                  disabled={regeneratingQR}
                >
                  {regeneratingQR ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                  <span>Regenerate QR (Invalidates Previous)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: Create Secure Share QR */}
      {/* ======================================================== */}
      {showShareModal && (
        <div className="vault-modal-overlay">
          <div className="vault-modal-card share-modal-card">
            <div className="vault-modal-header">
              <div className="vault-modal-title-group">
                <div className="vault-modal-icon-badge">
                  <Share2 size={20} color="var(--accent-gold)" />
                </div>
                <div>
                  <h3 className="vault-modal-title">Create Secure Document Share</h3>
                  <p className="vault-modal-subtitle">Share only selected documents for check-in. Automatically expires.</p>
                </div>
              </div>
              <button className="vault-modal-close-btn" onClick={() => setShowShareModal(false)}>
                <X size={18} />
              </button>
            </div>

            {!createdShare ? (
              <form onSubmit={handleCreateShareSubmit} className="vault-share-form">
                <div className="vault-input-group">
                  <label>Select Document(s) to Share</label>
                  <div className="vault-doc-checklist">
                    {documents.map((doc) => (
                      <label key={doc.id} className="vault-doc-check-item">
                        <input
                          type="checkbox"
                          checked={selectedShareDocs.includes(doc.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedShareDocs([...selectedShareDocs, doc.id]);
                            } else {
                              setSelectedShareDocs(selectedShareDocs.filter(id => id !== doc.id));
                            }
                          }}
                        />
                        <span className="check-doc-name">{doc.displayName}</span>
                        <span className="check-doc-type">({doc.type})</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="vault-input-group">
                  <label>Access Duration (Auto-Expires)</label>
                  <div className="vault-duration-pills">
                    {[5, 15, 60].map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        className={`vault-dur-pill ${shareDuration === dur ? 'active' : ''}`}
                        onClick={() => setShareDuration(dur)}
                      >
                        {dur === 60 ? '1 Hour' : `${dur} Minutes`}
                      </button>
                    ))}
                  </div>
                </div>

                {shareError && (
                  <div className="vault-form-error-banner">
                    <AlertTriangle size={14} />
                    <span>{shareError}</span>
                  </div>
                )}

                <div className="vault-share-warning">
                  <Info size={14} />
                  <span>The recipient will ONLY see the checked documents. The rest of your vault remains completely hidden.</span>
                </div>

                <div className="vault-modal-footer">
                  <button
                    type="submit"
                    className="vault-btn-primary full-width"
                    disabled={shareLoading || selectedShareDocs.length === 0}
                  >
                    {shareLoading ? <Loader2 size={16} className="spin" /> : <QrCode size={16} />}
                    <span>Generate Secure Share QR</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="vault-created-share-body">
                <div className="vault-qr-frame">
                  <img src={createdShare.qrDataUrl} alt="Temporary Share QR" className="vault-qr-image" />
                </div>

                <div className="vault-share-active-badge">
                  <span className="pulse-green-dot" />
                  <span>Active • {createdShare.durationMinutes} Minutes Access</span>
                </div>

                <div className="vault-qr-link-copy-box">
                  <input type="text" readOnly value={createdShare.accessUrl} className="vault-qr-link-input" />
                  <button
                    className="vault-copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(createdShare.accessUrl);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                  >
                    {copiedLink ? <Check size={14} color="var(--trust-emerald)" /> : <Copy size={14} />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="vault-modal-footer dual">
                  <button
                    className="vault-btn-danger full-width"
                    onClick={() => handleRevokeShare(createdShare.token)}
                  >
                    <X size={16} />
                    <span>Revoke Access Immediately</span>
                  </button>
                  <button
                    className="vault-btn-secondary full-width"
                    onClick={() => { setCreatedShare(null); setShowShareModal(false); }}
                  >
                    <span>Done</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: Secure In-Browser Document Viewer */}
      {/* ======================================================== */}
      {viewingDoc && (
        <div className="vault-modal-overlay viewer-overlay">
          <div className="vault-viewer-card">
            <div className="vault-viewer-header">
              <div className="viewer-title-group">
                <ShieldCheck size={18} color="var(--trust-emerald)" />
                <span className="viewer-title">{viewingDoc.displayName}</span>
                <span className="viewer-type-pill">{viewingDoc.type}</span>
              </div>
              <div className="viewer-actions-group">
                <a
                  href={`${API_BASE}/vault/documents/${viewingDoc.id}/download?sessionToken=${sessionToken || ''}`}
                  className="vault-viewer-btn"
                  title="Download explicit copy"
                >
                  <Download size={15} />
                  <span>Download</span>
                </a>
                <button className="vault-modal-close-btn" onClick={() => setViewingDoc(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="vault-viewer-body">
              {viewingDoc.mimeType === 'application/pdf' ? (
                <iframe
                  src={`${API_BASE}/vault/documents/${viewingDoc.id}/view?sessionToken=${sessionToken || ''}#toolbar=0`}
                  className="vault-pdf-frame"
                  title={viewingDoc.displayName}
                />
              ) : (
                <div className="vault-image-container">
                  <img
                    src={`${API_BASE}/vault/documents/${viewingDoc.id}/view?sessionToken=${sessionToken || ''}`}
                    alt={viewingDoc.displayName}
                    className="vault-rendered-image"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: Connect Telegram Bot */}
      {/* ======================================================== */}
      {showTelegramModal && telegramCode && (
        <div className="vault-modal-overlay">
          <div className="vault-modal-card telegram-modal-card">
            <div className="vault-modal-header">
              <div className="vault-modal-title-group">
                <div className="vault-modal-icon-badge">
                  <Bot size={20} color="var(--accent-gold)" />
                </div>
                <div>
                  <h3 className="vault-modal-title">Connect Telegram Concierge</h3>
                  <p className="vault-modal-subtitle">Securely link @{telegramCode.botUsername} to your document vault.</p>
                </div>
              </div>
              <button className="vault-modal-close-btn" onClick={() => setShowTelegramModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="vault-telegram-body">
              <div className="telegram-instructions-list">
                <div className="instruction-step">
                  <div className="step-num">1</div>
                  <div>
                    Open <strong>@{telegramCode.botUsername}</strong> in Telegram.
                  </div>
                </div>

                <div className="instruction-step">
                  <div className="step-num">2</div>
                  <div>
                    Send this linking command to the bot:
                    <div className="telegram-code-box">
                      <code>/link {telegramCode.code}</code>
                      <button
                        className="vault-copy-btn small"
                        onClick={() => {
                          navigator.clipboard.writeText(`/link ${telegramCode.code}`);
                          setCopiedTelegramCode(true);
                          setTimeout(() => setCopiedTelegramCode(false), 2000);
                        }}
                      >
                        {copiedTelegramCode ? <Check size={12} color="var(--trust-emerald)" /> : <Copy size={12} />}
                        <span>{copiedTelegramCode ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="instruction-step">
                  <div className="step-num">3</div>
                  <div>
                    Or click the direct launch link:
                    <div style={{ marginTop: 6 }}>
                      <a
                        href={telegramCode.botLink}
                        target="_blank"
                        rel="noreferrer"
                        className="vault-btn-primary small"
                      >
                        <ExternalLink size={14} />
                        <span>Open Bot with Linking Code</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="vault-telegram-security-callout">
                <ShieldCheck size={15} color="var(--trust-emerald)" />
                <span>
                  <strong>Strict Zero-Leak Guarantee:</strong> Your PIN will <em>never</em> be entered in Telegram chat. When you type <code>/document</code>, the bot sends you a secure StayWU website link where your PIN is validated.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
