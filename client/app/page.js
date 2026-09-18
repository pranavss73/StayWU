'use client';
import { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  MapPin,
  Footprints,
  Sparkles,
  Star,
  Hotel,
  Building2,
  ArrowLeft,
  Calendar,
  Lock,
  Loader2,
  Receipt,
  Send,
  Bot,
  MessageSquare,
  X,
  RotateCcw,
  Search,
  ChevronLeft,
  ChevronRight,
  Palmtree,
  Waves,
  PartyPopper,
  Lightbulb,
  LogIn,
  LogOut,
  ChevronDown,
  ArrowRight,
  SlidersHorizontal,
  CloudSun,
  Compass,
  FileCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

// ============================================
// Top Live Weather & Radar Ticker Strip
// ============================================
function TopTicker() {
  return (
    <div className="top-ticker-bar">
      <div className="container top-ticker-inner">
        <div className="ticker-item">
          <span className="ticker-pulse-dot" />
          <span className="ticker-tag">Live Goa Atlas</span>
          <span className="ticker-divider">•</span>
          <span>Panaji 25°C • Tropical Breeze & Passing Showers</span>
        </div>
        <div className="ticker-item" style={{ display: 'none', md: 'inline-flex' }}>
          <span className="ticker-divider">•</span>
          <span>2,403 Local Properties Audited</span>
          <span className="ticker-divider">•</span>
          <span>Telegram Concierge @StayWU_bot Active</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Navbar User & Auth Controls
// ============================================
function NavbarUser({ onOpenAuth }) {
  const { user, loading, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return <div className="skeleton" style={{ width: 84, height: 32, borderRadius: 6 }} />;
  }

  if (!user) {
    return (
      <button className="nav-sign-in-btn" onClick={() => onOpenAuth('signin')}>
        <LogIn size={14} />
        <span>Sign In</span>
      </button>
    );
  }

  const initial = (user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase();
  const displayName = user.displayName || user.email?.split('@')[0];

  return (
    <div className="nav-user-chip-container" ref={dropdownRef} style={{ position: 'relative' }}>
      <button className="nav-user-chip" onClick={() => setDropdownOpen(!dropdownOpen)} aria-label="User account">
        <div className="nav-avatar">{initial}</div>
        <span className="nav-user-name">{displayName}</span>
        <ChevronDown size={13} color="var(--text-muted)" />
      </button>

      {dropdownOpen && (
        <div className="nav-user-dropdown">
          <div className="nav-user-dropdown-header">
            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'white' }}>{displayName}</div>
            <div className="nav-user-email">{user.email}</div>
          </div>
          <button
            className="nav-dropdown-item"
            onClick={() => {
              logout();
              setDropdownOpen(false);
            }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// Segmented Trust Gauge / Badge
// ============================================
function TrustGauge({ score, badge }) {
  const badgeConfig = {
    trusted: { label: 'Trusted', class: 'trusted', icon: <CheckCircle2 size={12} /> },
    verified: { label: 'Verified', class: 'verified', icon: <ShieldCheck size={12} /> },
    caution: { label: 'Caution', class: 'caution', icon: <AlertTriangle size={12} /> },
    risky: { label: 'Risky', class: 'risky', icon: <AlertOctagon size={12} /> }
  };
  const config = badgeConfig[badge] || badgeConfig.verified;

  return (
    <div className="trust-gauge-box">
      <span className="trust-gauge-score">{score}</span>
      <span className={`trust-gauge-label ${config.class}`}>
        {config.label}
      </span>
    </div>
  );
}

// ============================================
// Bespoke Hotel Card Component
// ============================================
function HotelCard({ hotel, onClick }) {
  return (
    <div className="hotel-card" onClick={() => onClick(hotel)} id={`hotel-card-${hotel.id}`}>
      {/* Atmosphere Header */}
      <div className="hotel-card-atmosphere">
        <div className="hotel-card-badges-top">
          <span className="location-eyebrow">
            <MapPin size={11} color="var(--accent-gold)" />
            <span>{hotel.location} • {hotel.area || 'Goa'}</span>
          </span>
          <span className="verified-host-pill">
            <ShieldCheck size={11} />
            <span>Verified Host</span>
          </span>
        </div>

        <div className="hotel-card-middle-gauge">
          <TrustGauge score={hotel.trust_score} badge={hotel.trust_badge} />
          {hotel.rating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: 4, fontSize: '0.74rem', color: '#f8fafc', fontWeight: 600 }}>
              <Star size={12} fill="#f59e0b" color="#f59e0b" />
              <span>{hotel.rating}</span>
            </div>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="hotel-card-body">
        <h3 className="hotel-card-name">{hotel.name}</h3>

        {hotel.landmark && (
          <div className="hotel-card-landmark">
            <Footprints size={12} />
            <span>{hotel.landmark}</span>
          </div>
        )}

        {/* Editorial Neighborhood Vibe Quote */}
        <div className="hotel-card-vibe">
          "{hotel.neighborhood_vibe}"
        </div>

        {/* Micro Amenities */}
        {hotel.amenities?.length > 0 && (
          <div className="hotel-card-amenities">
            {hotel.amenities.slice(0, 3).map((a, i) => (
              <span key={i} className="amenity-micro-chip">
                {a}
              </span>
            ))}
          </div>
        )}

        {/* Scam flags warning if detected */}
        {hotel.scam_flags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
            {hotel.scam_flags.map((flag, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(244,63,94,0.12)', color: '#fb7185', fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                <AlertTriangle size={11} /> {flag}
              </span>
            ))}
          </div>
        )}

        {/* Card Footer */}
        <div className="hotel-card-footer">
          <div className="card-price-block">
            <span className="card-price-val">{hotel.price_display}</span>
            <span className="card-price-sub">per night • taxes included</span>
          </div>

          <button className="card-cta-btn">
            <span>Audit & Book</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Hotel Detail View (Magazine Spread)
// ============================================
function HotelDetail({ hotel, onBack, onBook, onRequireAuth }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    guestName: user?.displayName || user?.email?.split('@')[0] || '',
    guestEmail: user?.email || '',
    checkIn: '',
    checkOut: '',
    phoneNumber: ''
  });
  const [booking, setBooking] = useState(false);

  // Automatically sync guest info when user signs in
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        guestName: prev.guestName || user.displayName || user.email?.split('@')[0] || '',
        guestEmail: prev.guestEmail || user.email || '',
      }));
    }
  }, [user]);

  // Calculate nights
  let nightsCount = 1;
  if (formData.checkIn && formData.checkOut) {
    const d1 = new Date(formData.checkIn);
    const d2 = new Date(formData.checkOut);
    const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    if (diff > 0) nightsCount = diff;
  }

  const handleBook = async (e) => {
    e.preventDefault();

    if (!user) {
      onRequireAuth({
        title: 'Sign In to Book',
        subtitle: `Sign in to finalize your reservation at ${hotel.name} and activate your Telegram Trip Concierge.`,
      });
      return;
    }

    setBooking(true);
    try {
      const res = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelId: hotel.id,
          userId: user.uid,
          ...formData
        }),
      });
      const data = await res.json();
      onBook(data);
    } catch (err) {
      alert('Booking failed. Please try again.');
    }
    setBooking(false);
  };

  return (
    <div className="hotel-detail-container container">
      <button className="detail-nav-back" onClick={onBack}>
        <ArrowLeft size={15} />
        <span>Back to Curated Stays</span>
      </button>

      <div className="detail-layout-grid">
        {/* Left Column (65%): Deep Dive Showcase */}
        <div className="detail-main-column">
          {/* Showcase Hero */}
          <div className="detail-showcase-card">
            <div className="detail-atmosphere-hero">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="location-eyebrow">
                  <MapPin size={12} color="var(--accent-gold)" />
                  <span>{hotel.location} • {hotel.area || 'Goa'}</span>
                </span>
                <span className="verified-host-pill">
                  <ShieldCheck size={12} />
                  <span>Verified Host ID: #WU-{hotel.id.toString().padStart(4, '0')}</span>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <TrustGauge score={hotel.trust_score} badge={hotel.trust_badge} />
              </div>
            </div>

            <div className="detail-title-block">
              <h1 className="detail-hotel-name">{hotel.name}</h1>
              <div className="detail-location-row">
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={14} color="var(--accent-gold)" />
                  <span>{hotel.location}, Goa</span>
                </span>
                {hotel.landmark && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                    <Footprints size={14} />
                    <span>{hotel.landmark}</span>
                  </span>
                )}
                {hotel.rating && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#f59e0b', fontWeight: 600 }}>
                    <Star size={14} fill="#f59e0b" />
                    <span>{hotel.rating} / 5.0 Rating</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Trust Deep Dive Audit Card */}
          <div className="detail-trust-audit-card">
            <div className="audit-header">
              <div className="audit-header-title">
                <ShieldCheck size={18} color="var(--accent-gold)" />
                <span>StayWU Trust & Legitimacy Audit</span>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                Automated Verification
              </span>
            </div>

            <div className="audit-metric-bars">
              <div className="audit-metric-row">
                <div className="audit-metric-labels">
                  <span className="audit-metric-name">Overall Trust Rating</span>
                  <span className="audit-metric-val">{hotel.trust_score} / 100</span>
                </div>
                <div className="audit-track">
                  <div className="audit-fill" style={{ 
                    width: `${hotel.trust_score}%`,
                    background: hotel.trust_score >= 80 ? 'var(--trust-emerald)' : hotel.trust_score >= 60 ? 'var(--trust-amber)' : 'var(--trust-rose)'
                  }} />
                </div>
              </div>

              <div className="audit-metric-row">
                <div className="audit-metric-labels">
                  <span className="audit-metric-name">Guest Satisfaction Score</span>
                  <span className="audit-metric-val">{((hotel.rating || 3.5) * 20).toFixed(0)}%</span>
                </div>
                <div className="audit-track">
                  <div className="audit-fill" style={{ width: `${(hotel.rating || 3.5) * 20}%`, background: 'var(--accent-gold)' }} />
                </div>
              </div>

              <div className="audit-metric-row">
                <div className="audit-metric-labels">
                  <span className="audit-metric-name">Scam & Listing Authenticity Index</span>
                  <span className="audit-metric-val">{Math.max(20, hotel.trust_score)}%</span>
                </div>
                <div className="audit-track">
                  <div className="audit-fill" style={{ width: `${Math.max(20, hotel.trust_score)}%`, background: '#38bdf8' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Scam Risk Signals Banner */}
          {hotel.scam_flags?.length > 0 ? (
            <div className="scam-audit-banner warning">
              <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div className="scam-audit-title">Risk Signals Detected</div>
                <div className="scam-audit-desc">
                  Our automated fraud engine flagged the following signals: {hotel.scam_flags.join(', ')}. Proceed with review.
                </div>
              </div>
            </div>
          ) : (
            <div className="scam-audit-banner clean">
              <CheckCircle2 size={20} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div className="scam-audit-title">Zero Risk Signals Detected</div>
                <div className="scam-audit-desc">
                  Pricing, host legitimacy, and review consistency passed all StayWU fraud prevention filters.
                </div>
              </div>
            </div>
          )}

          {/* Neighborhood Vibe Card */}
          <div className="detail-vibe-card">
            <div className="detail-vibe-header">
              <Sparkles size={16} color="var(--accent-gold)" />
              <span>Neighborhood Vibe & Environment</span>
            </div>
            <div className="detail-vibe-quote">
              "{hotel.neighborhood_vibe}"
            </div>
          </div>

          {/* Amenities & Features */}
          {hotel.amenities?.length > 0 && (
            <div className="detail-vibe-card">
              <div className="detail-vibe-header">
                <Hotel size={16} color="var(--accent-gold)" />
                <span>Amenities & Property Features</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {hotel.amenities.map((a, i) => (
                  <span key={i} className="amenity-micro-chip" style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (35%): Sticky Reservation Console */}
        <div className="reservation-terminal">
          <div className="terminal-header">
            <div>
              <span className="terminal-price-big">{hotel.price_display}</span>
              <span className="terminal-price-unit"> / night</span>
            </div>
            <span className="terminal-verified-stamp">
              <ShieldCheck size={14} />
              <span>Direct Booking</span>
            </span>
          </div>

          {!user ? (
            <div className="booking-auth-prompt">
              <Lock size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div className="booking-auth-prompt-content">
                <div className="booking-auth-prompt-title">Sign in required to confirm</div>
                <div>Please sign in with Google or Email to unlock this reservation and sync your trip with @StayWU_bot on Telegram.</div>
              </div>
            </div>
          ) : (
            <div className="booking-auth-badge">
              <CheckCircle2 size={13} />
              <span>Verified Guest: {user.email}</span>
            </div>
          )}

          <form className="booking-form-compact" onSubmit={handleBook}>
            <div className="form-field-group">
              <label className="field-label">Full Name *</label>
              <input
                className="field-input"
                required
                placeholder="e.g. Alex Johnson"
                value={formData.guestName}
                onChange={e => setFormData({ ...formData, guestName: e.target.value })}
              />
            </div>

            <div className="form-field-group">
              <label className="field-label">Email Address *</label>
              <input
                className="field-input"
                type="email"
                required
                placeholder="alex@example.com"
                value={formData.guestEmail}
                onChange={e => setFormData({ ...formData, guestEmail: e.target.value })}
              />
            </div>

            <div className="dates-two-col">
              <div className="form-field-group">
                <label className="field-label">Check-in *</label>
                <input
                  className="field-input"
                  type="date"
                  required
                  value={formData.checkIn}
                  onChange={e => setFormData({ ...formData, checkIn: e.target.value })}
                />
              </div>

              <div className="form-field-group">
                <label className="field-label">Check-out *</label>
                <input
                  className="field-input"
                  type="date"
                  required
                  value={formData.checkOut}
                  onChange={e => setFormData({ ...formData, checkOut: e.target.value })}
                />
              </div>
            </div>

            <div className="form-field-group">
              <label className="field-label">WhatsApp / Phone (for AI Concierge)</label>
              <input
                className="field-input"
                type="tel"
                placeholder="+91 98765 43210"
                value={formData.phoneNumber}
                onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
            </div>

            <button type="submit" className="btn-book-submit" disabled={booking}>
              {booking ? (
                <>
                  <Loader2 size={16} className="spin-icon" />
                  <span>Confirming Reservation...</span>
                </>
              ) : !user ? (
                <>
                  <Lock size={15} />
                  <span>Sign In to Book — Get AI Concierge</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>Confirm Reservation ({nightsCount} Night{nightsCount > 1 ? 's' : ''})</span>
                </>
              )}
            </button>
          </form>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 14 }}>
            Includes free synchronization with StayWU Telegram Concierge. Zero booking fees.
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Formatted Chatbot Message Component
// ============================================
function FormattedMessage({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let currentList = [];
  let listType = null;

  const flushList = () => {
    if (currentList.length > 0) {
      if (listType === 'ol') {
        elements.push(
          <ol key={`ol-${elements.length}`} className="chat-ol">
            {currentList.map((item, idx) => (
              <li key={idx} className="chat-li">
                <span className="chat-bullet">{idx + 1}.</span>
                <div className="chat-li-content">{formatInline(item)}</div>
              </li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} className="chat-ol" style={{ listStyleType: 'disc' }}>
            {currentList.map((item, idx) => (
              <li key={idx} className="chat-li">
                <span className="chat-bullet">•</span>
                <div className="chat-li-content">{formatInline(item)}</div>
              </li>
            ))}
          </ul>
        );
      }
      currentList = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      flushList();
      continue;
    }

    // Heading
    if (/^#{1,3}\s+(.*)/.test(line)) {
      flushList();
      const text = line.replace(/^#{1,3}\s+/, '');
      elements.push(
        <div key={`h-${i}`} className="chat-card-title">
          {formatInline(text)}
        </div>
      );
      continue;
    }

    // Callout / Tip box
    if (line.startsWith('💡') || line.startsWith('>') || /^tip:/i.test(line)) {
      flushList();
      const text = line.replace(/^[>💡]\s*/, '').replace(/^tip:\s*/i, '');
      elements.push(
        <div key={`tip-${i}`} className="chat-tip-card">
          <Lightbulb size={15} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
          <div className="chat-tip-text">
            <strong>Local Tip:</strong> {formatInline(text)}
          </div>
        </div>
      );
      continue;
    }

    // Bullets
    if (/^[-*•]\s+(.*)/.test(line)) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      currentList.push(line.replace(/^[-*•]\s+/, ''));
      continue;
    }

    // Numbered
    if (/^\d+\.\s+(.*)/.test(line)) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      currentList.push(line.replace(/^\d+\.\s+/, ''));
      continue;
    }

    flushList();
    elements.push(
      <p key={`p-${i}`} style={{ marginBottom: 8, fontSize: '0.84rem' }}>
        {formatInline(line)}
      </p>
    );
  }

  flushList();
  return <div>{elements}</div>;
}

function formatInline(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2);
      if (/₹[\d,]+/.test(inner)) {
        return <span key={index} className="chat-badge-price">{inner}</span>;
      }
      if (/(trusted|verified|caution|risky)/i.test(inner)) {
        const isCaution = /caution/i.test(inner);
        const isRisky = /risky/i.test(inner);
        const badgeClass = isRisky ? 'chat-badge-risky' : isCaution ? 'chat-badge-caution' : 'chat-badge-trust';
        return <span key={index} className={`chat-badge ${badgeClass}`}>{inner}</span>;
      }
      return <strong key={index} style={{ color: 'var(--text-heading)', fontWeight: 700 }}>{inner}</strong>;
    }
    return part;
  });
}

// ============================================
// StayWU Concierge Desk (Redesigned Chatbot)
// ============================================
const QUICK_PROMPTS = [
  { text: 'Top trusted beachside hotels near Baga', icon: <Waves size={13} color="var(--accent-gold)" /> },
  { text: 'Highest Trust Score properties in North Goa', icon: <ShieldCheck size={13} color="var(--trust-emerald)" /> },
  { text: 'Peaceful beachfront stays in South Goa', icon: <Palmtree size={13} color="var(--accent-gold)" /> },
  { text: 'How does StayWU verify local host IDs?', icon: <FileCheck size={13} color="#38bdf8" /> },
];

const INITIAL_GREETING = {
  role: 'bot',
  content: "Welcome to StayWU Concierge Desk. I'm your verified Goa trip advisor — ask me anything about hotel safety, neighborhood vibes, beach proximity, or local itinerary recommendations."
};

function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([INITIAL_GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendWithText = async (textToSend) => {
    if (!textToSend.trim() || loading) return;

    const userMsg = textToSend.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const history = messages
        .filter(m => m.role !== 'bot' || messages.indexOf(m) > 0)
        .map(m => ({
          role: m.role === 'bot' ? 'assistant' : 'user',
          content: m.content
        }));

      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', content: data.reply }]);
    } catch {
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: "Sorry, I'm having trouble connecting to the trust advisor server. Please try again." 
      }]);
    }
    setLoading(false);
  };

  const handleSend = () => sendWithText(input);

  const resetChat = () => {
    setMessages([INITIAL_GREETING]);
  };

  return (
    <>
      <button
        className={`concierge-dock-btn ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open Concierge Desk"
      >
        <span className="concierge-dock-pulse" />
        <Bot size={16} />
        <span className="concierge-dock-label">{isOpen ? 'Close Desk' : 'StayWU Concierge Desk'}</span>
      </button>

      {isOpen && (
        <div className="concierge-terminal">
          <div className="concierge-terminal-header">
            <div className="concierge-terminal-title">
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--accent-gold-bg)', border: '1px solid var(--accent-gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-gold)' }}>
                <Bot size={16} />
              </div>
              <div>
                <div className="concierge-terminal-name">StayWU Concierge Desk</div>
                <div className="concierge-terminal-status">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--trust-emerald)' }} />
                  <span>Online • AI Travel Advisor</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={resetChat}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                title="Reset conversation"
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                title="Close desk"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="concierge-terminal-body">
            {messages.map((msg, i) => (
              <div key={i} className={`concierge-chat-bubble ${msg.role === 'bot' ? 'bot' : 'user'}`}>
                {msg.role === 'bot' ? (
                  <FormattedMessage content={msg.content} />
                ) : (
                  msg.content
                )}
              </div>
            ))}

            {messages.length === 1 && !loading && (
              <div className="concierge-quick-chips">
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                  Curated questions:
                </div>
                {QUICK_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    className="concierge-quick-chip"
                    onClick={() => sendWithText(p.text)}
                  >
                    {p.icon}
                    <span>{p.text}</span>
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="concierge-chat-bubble bot" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Loader2 size={14} className="spin-icon" color="var(--accent-gold)" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Analyzing rental atlas...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="concierge-input-bar">
            <input
              className="concierge-input"
              placeholder="Ask about Goa areas, trust scores, beach proximity..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            <button className="concierge-send-btn" onClick={handleSend} aria-label="Send query">
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================
// Booking Confirmation Modal
// ============================================
function BookingModal({ bookingData, onClose }) {
  if (!bookingData) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="booking-modal-card" onClick={e => e.stopPropagation()}>
        <div className="booking-modal-success-icon">
          <CheckCircle2 size={30} />
        </div>
        <h2 className="booking-modal-title">Reservation Confirmed</h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Your stay at <strong style={{ color: 'var(--text-heading)' }}>{bookingData.booking.hotelName}</strong> has been secured.
        </p>

        <div className="booking-modal-details-card">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Booking Reference:</span>
            <strong style={{ color: 'var(--accent-gold)' }}>{bookingData.booking.id}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Dates:</span>
            <span>{bookingData.booking.checkIn} → {bookingData.booking.checkOut}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Guest:</span>
            <span>{bookingData.booking.guestName}</span>
          </div>
        </div>

        <div className="telegram-connect-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, color: '#38bdf8', fontSize: '0.9rem' }}>
            <Bot size={16} />
            <span>AI Trip Concierge Activated</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 6 }}>
            Tap below to open <strong>@StayWU_bot</strong> on Telegram. Your custom weather-aware daily itinerary and executive PDF dossier are waiting for you!
          </p>
          <a
            href={bookingData.telegramLink}
            target="_blank"
            rel="noopener noreferrer"
            className="telegram-btn"
          >
            <Send size={15} />
            <span>Open @StayWU_bot on Telegram</span>
          </a>
        </div>

        <button
          onClick={onClose}
          style={{ width: '100%', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: 'var(--text-muted)', fontSize: '0.84rem', cursor: 'pointer' }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ============================================
// Main Application
// ============================================
export default function Home() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [trustFilter, setTrustFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [bookingResult, setBookingResult] = useState(null);
  const [authModal, setAuthModal] = useState({
    isOpen: false,
    mode: 'signin',
    title: null,
    subtitle: null,
    onSuccess: null,
  });

  const openAuth = (options = {}) => {
    if (typeof options === 'string') {
      setAuthModal({ isOpen: true, mode: options, title: null, subtitle: null, onSuccess: null });
    } else {
      setAuthModal({
        isOpen: true,
        mode: options.mode || 'signin',
        title: options.title || null,
        subtitle: options.subtitle || null,
        onSuccess: options.onSuccess || null,
      });
    }
  };

  // Fetch locations
  useEffect(() => {
    fetch(`${API_BASE}/hotels/locations`)
      .then(r => r.json())
      .then(setLocations)
      .catch(() => {});
  }, []);

  // Fetch hotels
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (locationFilter) params.set('location', locationFilter);
    if (sortBy) params.set('sort', sortBy);
    if (trustFilter) params.set('trust', trustFilter);
    params.set('page', page);
    params.set('limit', 12);

    fetch(`${API_BASE}/hotels?${params}`)
      .then(r => r.json())
      .then(data => {
        setHotels(data.hotels);
        setPagination(data.pagination);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [searchQuery, locationFilter, sortBy, trustFilter, page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    const element = document.getElementById('hotels');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Detail View Selected
  if (selectedHotel) {
    return (
      <>
        <TopTicker />
        <nav className="navbar">
          <div className="navbar-inner">
            <div className="navbar-brand-group" onClick={() => setSelectedHotel(null)}>
              <div className="navbar-logo-badge">
                <Building2 size={18} />
              </div>
              <div className="navbar-brand-text">
                <span className="navbar-title">STAYWU</span>
                <span className="navbar-subtitle">Goa Trust Atlas</span>
              </div>
            </div>

            <div className="nav-auth-group">
              <NavbarUser onOpenAuth={openAuth} />
            </div>
          </div>
        </nav>

        <HotelDetail
          hotel={selectedHotel}
          onBack={() => setSelectedHotel(null)}
          onBook={setBookingResult}
          onRequireAuth={openAuth}
        />

        <BookingModal bookingData={bookingResult} onClose={() => setBookingResult(null)} />
        <AuthModal
          isOpen={authModal.isOpen}
          onClose={() => setAuthModal(prev => ({ ...prev, isOpen: false }))}
          initialMode={authModal.mode}
          title={authModal.title}
          subtitle={authModal.subtitle}
          onSuccess={authModal.onSuccess}
        />
        <ChatBot />
      </>
    );
  }

  return (
    <>
      <TopTicker />

      {/* Editorial Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-brand-group">
            <div className="navbar-logo-badge">
              <Building2 size={18} />
            </div>
            <div className="navbar-brand-text">
              <span className="navbar-title">STAYWU</span>
              <span className="navbar-subtitle">Goa Trust Atlas</span>
            </div>
          </div>

          <ul className="navbar-nav">
            <li><a href="#hotels">Curated Stays</a></li>
            <li><a href="#trust-matrix">Trust Architecture</a></li>
            <li><a href="#about">About</a></li>
          </ul>

          <div className="nav-auth-group">
            <NavbarUser onOpenAuth={openAuth} />
          </div>
        </div>
      </nav>

      {/* Asymmetric Split Editorial Hero */}
      <section className="editorial-hero">
        <div className="container hero-grid">
          {/* Left Column: Narrative & Mission */}
          <div>
            <div className="hero-eyebrow">
              <ShieldCheck size={13} />
              <span>Verified Rental Atlas</span>
            </div>

            <h1 className="hero-title-main">
              Stay Fearless in <span className="gold-highlight">Goa</span>.
            </h1>

            <p className="hero-narrative">
              We audit 2,400+ local rentals against price fraud, phantom hosts, and neighborhood noise friction — connecting you directly with authentic, verified Goan villas and beachside stays.
            </p>

            <div className="hero-trust-badges-row">
              <div className="hero-badge-item">
                <ShieldCheck size={16} color="var(--trust-emerald)" />
                <span>Host ID Verification</span>
              </div>
              <div className="hero-badge-item">
                <AlertTriangle size={16} color="var(--accent-gold)" />
                <span>Scam Anomaly Engine</span>
              </div>
              <div className="hero-badge-item">
                <Sparkles size={16} color="var(--accent-gold)" />
                <span>Neighborhood Vibe NLP</span>
              </div>
              <div className="hero-badge-item">
                <Bot size={16} color="#38bdf8" />
                <span>Telegram Concierge</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Trip Discovery Console */}
          <div className="discovery-console">
            <div className="console-header">
              <span className="console-header-title">
                <SlidersHorizontal size={14} color="var(--accent-gold)" />
                <span>Search & Discovery Radar</span>
              </span>
              <span className="console-header-count">
                {pagination ? `${pagination.total} Audited` : '2,403 Stays'}
              </span>
            </div>

            <form className="console-form" onSubmit={handleSearch}>
              <div className="console-search-wrapper">
                <Search size={15} className="console-search-icon" />
                <input
                  className="console-input"
                  placeholder="Search by hotel, beach, or neighborhood..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                  id="search-input"
                />
              </div>

              <div className="console-filters-row">
                <select
                  className="console-select"
                  value={locationFilter}
                  onChange={e => { setLocationFilter(e.target.value); setPage(1); }}
                  id="location-filter"
                >
                  <option value="">All Goa Locations</option>
                  {locations.slice(0, 25).map(loc => (
                    <option key={loc.name} value={loc.name}>
                      {loc.name} ({loc.count})
                    </option>
                  ))}
                </select>

                <select
                  className="console-select"
                  value={sortBy}
                  onChange={e => { setSortBy(e.target.value); setPage(1); }}
                  id="sort-filter"
                >
                  <option value="">Sort Criteria</option>
                  <option value="trust">Highest Trust Score</option>
                  <option value="rating">Top Guest Rating</option>
                  <option value="price_low">Price: Low → High</option>
                  <option value="price_high">Price: High → Low</option>
                </select>
              </div>

              <div>
                <div className="console-trust-pills-label">Trust Index Filter:</div>
                <div className="console-trust-pills">
                  {[
                    { id: '', label: 'All', icon: <Compass size={12} /> },
                    { id: 'trusted', label: 'Trusted', icon: <CheckCircle2 size={12} color="var(--trust-emerald)" /> },
                    { id: 'verified', label: 'Verified', icon: <ShieldCheck size={12} color="#38bdf8" /> },
                    { id: 'caution', label: 'Caution', icon: <AlertTriangle size={12} color="var(--trust-amber)" /> },
                  ].map(badge => (
                    <button
                      key={badge.id}
                      type="button"
                      className={`console-trust-pill ${trustFilter === badge.id ? 'active' : ''}`}
                      onClick={() => { setTrustFilter(badge.id); setPage(1); }}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" className="console-submit-btn">
                <Search size={15} />
                <span>Search Verified Rentals</span>
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Trust Verification Matrix Section */}
      <section className="trust-matrix-section" id="trust-matrix">
        <div className="container">
          <div className="trust-matrix-header">
            <div className="trust-matrix-tag">Trust & Integrity Architecture</div>
            <h2 className="trust-matrix-title">How StayWU Eliminates Rental Friction</h2>
          </div>

          <div className="trust-matrix-grid">
            <div className="trust-pillar-card">
              <div className="pillar-icon-box">
                <FileCheck size={20} />
              </div>
              <h3 className="pillar-title">Host Identity Audit</h3>
              <p className="pillar-desc">
                Automated document heuristics and host identity cross-checks ensure every property has an authenticated manager behind it.
              </p>
            </div>

            <div className="trust-pillar-card">
              <div className="pillar-icon-box">
                <AlertTriangle size={20} />
              </div>
              <h3 className="pillar-title">Scam Anomaly Engine</h3>
              <p className="pillar-desc">
                Pattern classifiers evaluate historical price volatility, duplicate text, and suspicious review rhythms to flag deceptive listings.
              </p>
            </div>

            <div className="trust-pillar-card">
              <div className="pillar-icon-box">
                <Sparkles size={20} />
              </div>
              <h3 className="pillar-title">Neighborhood Vibe NLP</h3>
              <p className="pillar-desc">
                Synthesizes thousands of guest reviews into concise atmospheric snapshots: noise levels, nightlife density, and beach proximity.
              </p>
            </div>

            <div className="trust-pillar-card">
              <div className="pillar-icon-box">
                <Bot size={20} />
              </div>
              <h3 className="pillar-title">Telegram Concierge Sync</h3>
              <p className="pillar-desc">
                Confirmed reservations instantly sync with @StayWU_bot, generating a weather-adapted day-by-day itinerary and luxury PDF dossier.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Hotel Listings Explorer */}
      <section className="hotels-section" id="hotels">
        <div className="container">
          <div className="hotels-section-header">
            <div>
              <h2 className="hotels-section-title">Curated Goa Properties</h2>
              <div className="hotels-section-count">
                {pagination ? `${pagination.total} rentals available` : 'Loading verified directory...'}
                {trustFilter && ` • Filtered by ${trustFilter.toUpperCase()}`}
                {locationFilter && ` • ${locationFilter}`}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="hotel-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton skeleton-card" />
              ))}
            </div>
          ) : (
            <>
              <div className="hotel-grid">
                {hotels.map(hotel => (
                  <HotelCard key={hotel.id} hotel={hotel} onClick={setSelectedHotel} />
                ))}
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    disabled={page <= 1}
                    onClick={() => {
                      setPage(p => p - 1);
                      document.getElementById('hotels')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <ChevronLeft size={14} />
                    <span>Prev</span>
                  </button>

                  {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                    const pageNum = Math.max(1, page - 2) + i;
                    if (pageNum > pagination.totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        className={`pagination-btn ${page === pageNum ? 'active' : ''}`}
                        onClick={() => {
                          setPage(pageNum);
                          document.getElementById('hotels')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    className="pagination-btn"
                    disabled={page >= pagination.totalPages}
                    onClick={() => {
                      setPage(p => p + 1);
                      document.getElementById('hotels')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <span>Next</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Editorial Footer */}
      <footer className="editorial-footer" id="about">
        <div className="container footer-inner">
          <div>
            <div className="footer-brand-tag">STAYWU • GOA TRUST ATLAS</div>
            <div style={{ marginTop: 4 }}>
              The Trust & Discovery Layer for Local Accommodations in Goa, India.
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.78rem' }}>
            <div>Emergency Helpline: 100 • Tourist Police: 1800-22-7838</div>
            <div style={{ marginTop: 2, color: 'var(--text-muted)' }}>
              Built with AI Trust Verification & Telegram Concierge Integration
            </div>
          </div>
        </div>
      </footer>

      {/* Booking Modal */}
      <BookingModal bookingData={bookingResult} onClose={() => setBookingResult(null)} />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModal.isOpen}
        onClose={() => setAuthModal(prev => ({ ...prev, isOpen: false }))}
        initialMode={authModal.mode}
        title={authModal.title}
        subtitle={authModal.subtitle}
        onSuccess={authModal.onSuccess}
      />

      {/* StayWU Concierge Desk */}
      <ChatBot />
    </>
  );
}
