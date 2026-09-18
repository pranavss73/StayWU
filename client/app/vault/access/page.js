'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  Unlock,
  Eye,
  Download,
  AlertTriangle,
  Clock,
  Building2,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Loader2,
  X,
  ArrowLeft
} from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

function VaultAccessContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [vaultInfo, setVaultInfo] = useState(null);

  // PIN Unlock State
  const [pin, setPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Documents
  const [documents, setDocuments] = useState([]);
  const [viewingDoc, setViewingDoc] = useState(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setErrorMessage('No Vault QR token provided in the URL.');
      return;
    }

    const validateToken = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/vault/access/${encodeURIComponent(token)}`);
        const data = await res.json();

        if (res.ok && data.valid) {
          setTokenValid(true);
          setVaultInfo(data);
        } else {
          setTokenValid(false);
          setErrorMessage(data.message || 'This Vault QR code is invalid or has been regenerated.');
        }
      } catch (err) {
        setTokenValid(false);
        setErrorMessage('Unable to connect to StayWU security servers.');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  // Session countdown
  useEffect(() => {
    if (!sessionExpiresAt) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.ceil((new Date(sessionExpiresAt) - new Date()) / 1000));
      setRemainingSeconds(diff);
      if (diff <= 0) {
        setUnlocked(false);
        setSessionToken(null);
        setSessionExpiresAt(null);
        setPin('');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionExpiresAt]);

  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    setPinError('');
    setPinLoading(true);

    try {
      const res = await fetch(`${API_BASE}/vault/access/${encodeURIComponent(token)}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setUnlocked(true);
        setSessionToken(data.sessionToken);
        setSessionExpiresAt(data.expiresAt);

        // Fetch documents
        const docsRes = await fetch(`${API_BASE}/vault/documents?userId=${encodeURIComponent(vaultInfo.userId)}`, {
          headers: { 'x-vault-session-token': data.sessionToken },
        });
        if (docsRes.ok) {
          const docsData = await docsRes.json();
          setDocuments(docsData.documents || []);
        }
      } else {
        setPinError(data.message || 'Incorrect PIN.');
      }
    } catch (err) {
      setPinError('Connection error validating PIN.');
    } finally {
      setPinLoading(false);
    }
  };

  const formatCountdown = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading) {
    return (
      <div className="vault-access-container center">
        <Loader2 size={36} className="spin" color="var(--accent-gold)" />
        <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Validating secure QR credentials...</p>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="vault-access-container center">
        <div className="vault-access-card error-card">
          <ShieldAlert size={48} color="var(--trust-rose)" />
          <h2 style={{ marginTop: 16 }}>Invalid Vault QR</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>{errorMessage}</p>
          <div style={{ marginTop: 24 }}>
            <Link href="/" className="vault-btn-primary">
              <ArrowLeft size={16} />
              <span>Back to StayWU</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vault-access-container">
      {/* Top Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <Link href="/" className="navbar-brand-group">
            <div className="navbar-logo-badge">
              <Building2 size={18} />
            </div>
            <div className="navbar-brand-text">
              <span className="navbar-title">STAYWU</span>
              <span className="navbar-subtitle">Secure Vault Access</span>
            </div>
          </Link>
          {unlocked && (
            <div className="vault-session-chip">
              <span className="vault-session-dot" />
              <span>Session: {formatCountdown(remainingSeconds)}</span>
            </div>
          )}
        </div>
      </nav>

      <main className="container vault-access-main">
        {!unlocked ? (
          <div className="vault-access-card pin-card">
            <div className="access-header-icon">
              <Lock size={32} color="var(--accent-gold)" />
            </div>

            <h2>StayWU Secure Vault</h2>
            <p className="access-subtitle">
              Your private document vault is protected. Enter your Security PIN to unlock access.
            </p>

            <form onSubmit={handleUnlockSubmit} className="access-pin-form">
              <div className="vault-input-group">
                <label>Security PIN (6 Digits)</label>
                <input
                  type="password"
                  maxLength={6}
                  className="vault-text-input pin-entry"
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                />
              </div>

              {pinError && (
                <div className="vault-form-error-banner">
                  <AlertTriangle size={14} />
                  <span>{pinError}</span>
                </div>
              )}

              <button
                type="submit"
                className="vault-btn-primary full-width"
                disabled={pinLoading || pin.length < 4}
              >
                {pinLoading ? <Loader2 size={16} className="spin" /> : <Unlock size={16} />}
                <span>Unlock Vault</span>
              </button>
            </form>

            <div className="access-security-footer">
              <ShieldCheck size={14} color="var(--trust-emerald)" />
              <span>Protected by StayWU Zero-Knowledge Architecture</span>
            </div>
          </div>
        ) : (
          <div className="vault-unlocked-container">
            <div className="unlocked-banner">
              <div className="unlocked-badge">
                <CheckCircle2 size={18} color="var(--trust-emerald)" />
                <span>Vault Unlocked Successfully</span>
              </div>
              <p>Session active for {formatCountdown(remainingSeconds)}. Documents are visible below.</p>
            </div>

            <div className="vault-docs-grid" style={{ marginTop: 24 }}>
              {documents.map((doc) => (
                <div key={doc.id} className="vault-doc-card">
                  <div className="vault-doc-header">
                    <div className="vault-doc-type-icon">
                      {doc.mimeType === 'application/pdf' ? (
                        <FileText size={22} color="var(--accent-gold)" />
                      ) : (
                        <ImageIcon size={22} color="#38bdf8" />
                      )}
                    </div>
                    <span className="vault-doc-type-tag">{doc.type}</span>
                  </div>

                  <div className="vault-doc-info">
                    <h4 className="vault-doc-title">{doc.displayName}</h4>
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
                    >
                      <Eye size={14} />
                      <span>View</span>
                    </button>
                    <a
                      href={`${API_BASE}/vault/documents/${doc.id}/download?sessionToken=${sessionToken}`}
                      className="vault-card-action-btn"
                    >
                      <Download size={14} />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* In-Browser Document Viewer */}
      {viewingDoc && (
        <div className="vault-modal-overlay viewer-overlay">
          <div className="vault-viewer-card">
            <div className="vault-viewer-header">
              <div className="viewer-title-group">
                <ShieldCheck size={18} color="var(--trust-emerald)" />
                <span className="viewer-title">{viewingDoc.displayName}</span>
              </div>
              <div className="viewer-actions-group">
                <a
                  href={`${API_BASE}/vault/documents/${viewingDoc.id}/download?sessionToken=${sessionToken}`}
                  className="vault-viewer-btn"
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
                  src={`${API_BASE}/vault/documents/${viewingDoc.id}/view?sessionToken=${sessionToken}#toolbar=0`}
                  className="vault-pdf-frame"
                  title={viewingDoc.displayName}
                />
              ) : (
                <div className="vault-image-container">
                  <img
                    src={`${API_BASE}/vault/documents/${viewingDoc.id}/view?sessionToken=${sessionToken}`}
                    alt={viewingDoc.displayName}
                    className="vault-rendered-image"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VaultAccessPage() {
  return (
    <Suspense fallback={<div className="vault-access-container center"><Loader2 size={36} className="spin" /></div>}>
      <VaultAccessContent />
    </Suspense>
  );
}
