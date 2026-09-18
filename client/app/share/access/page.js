'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  Eye,
  Download,
  Building2,
  FileText,
  Image as ImageIcon,
  Loader2,
  X,
  ArrowLeft,
  Lock
} from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

function ShareAccessContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [shareData, setShareData] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null); // 'REVOKED' | 'EXPIRED' | 'INVALID'
  const [errorMessage, setErrorMessage] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // In-browser viewer
  const [viewingDoc, setViewingDoc] = useState(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setErrorStatus('INVALID');
      setErrorMessage('No share token was provided.');
      return;
    }

    const fetchShare = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/vault/share/${encodeURIComponent(token)}`);
        const data = await res.json();

        if (res.ok && data.status === 'ACTIVE') {
          setShareData(data);
          setRemainingSeconds(data.remainingSeconds || 0);
        } else {
          setErrorStatus(data.status || 'INVALID');
          setErrorMessage(data.message || 'Unable to access shared documents.');
        }
      } catch (err) {
        setErrorStatus('INVALID');
        setErrorMessage('Unable to connect to StayWU security servers.');
      } finally {
        setLoading(false);
      }
    };

    fetchShare();
  }, [token]);

  // Live visual countdown
  useEffect(() => {
    if (!remainingSeconds || remainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setErrorStatus('EXPIRED');
          setErrorMessage('This document share has expired.');
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingSeconds]);

  const formatCountdown = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading) {
    return (
      <div className="vault-access-container center">
        <Loader2 size={36} className="spin" color="var(--accent-gold)" />
        <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Verifying secure share credentials...</p>
      </div>
    );
  }

  // Error States
  if (errorStatus) {
    return (
      <div className="vault-access-container center">
        <div className="vault-access-card error-card">
          {errorStatus === 'REVOKED' ? (
            <>
              <ShieldAlert size={52} color="var(--trust-rose)" />
              <h2 style={{ marginTop: 16, color: 'var(--trust-rose)' }}>Access Revoked</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                This document-sharing session has been revoked by the owner. No documents are accessible.
              </p>
            </>
          ) : errorStatus === 'EXPIRED' ? (
            <>
              <Clock size={52} color="var(--trust-amber)" />
              <h2 style={{ marginTop: 16, color: 'var(--trust-amber)' }}>Share Expired</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                This temporary document share has reached its expiration time.
              </p>
            </>
          ) : (
            <>
              <Lock size={52} color="var(--text-muted)" />
              <h2 style={{ marginTop: 16 }}>Invalid Share QR</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                {errorMessage || 'This QR code is invalid or has expired.'}
              </p>
            </>
          )}

          <div style={{ marginTop: 24 }}>
            <Link href="/" className="vault-btn-primary">
              <ArrowLeft size={16} />
              <span>Visit StayWU</span>
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
              <span className="navbar-subtitle">Secure Document Share</span>
            </div>
          </Link>

          <div className="vault-session-chip">
            <Clock size={13} color="var(--trust-amber)" />
            <span>Expires in: {formatCountdown(remainingSeconds)}</span>
          </div>
        </div>
      </nav>

      <main className="container vault-access-main">
        <div className="share-recipient-banner">
          <div className="share-banner-top">
            <div className="share-banner-title-group">
              <ShieldCheck size={24} color="var(--trust-emerald)" />
              <div>
                <h2>Verified Travel Documents</h2>
                <p>A traveler has securely shared the following documents with you for verification.</p>
              </div>
            </div>

            <div className="share-countdown-pill">
              <Clock size={14} />
              <span>{formatCountdown(remainingSeconds)} Remaining</span>
            </div>
          </div>
        </div>

        <div className="vault-docs-grid" style={{ marginTop: 24 }}>
          {shareData?.documents?.map((doc) => (
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
                  <span>Verified Identity Document</span>
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
                  href={`${API_BASE}/vault/documents/${doc.id}/download?shareToken=${token}`}
                  className="vault-card-action-btn"
                >
                  <Download size={14} />
                  <span>Download</span>
                </a>
              </div>
            </div>
          ))}
        </div>
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
                  href={`${API_BASE}/vault/documents/${viewingDoc.id}/download?shareToken=${token}`}
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
                  src={`${API_BASE}/vault/documents/${viewingDoc.id}/view?shareToken=${token}#toolbar=0`}
                  className="vault-pdf-frame"
                  title={viewingDoc.displayName}
                />
              ) : (
                <div className="vault-image-container">
                  <img
                    src={`${API_BASE}/vault/documents/${viewingDoc.id}/view?shareToken=${token}`}
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

export default function ShareAccessPage() {
  return (
    <Suspense fallback={<div className="vault-access-container center"><Loader2 size={36} className="spin" /></div>}>
      <ShareAccessContent />
    </Suspense>
  );
}
