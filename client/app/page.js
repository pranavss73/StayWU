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
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';

const API_BASE = 'http://localhost:3001/api';

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
    return <div className="skeleton" style={{ width: 84, height: 32, borderRadius: 20 }} />;
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
// Trust Score Ring Component
// ============================================
function TrustScoreRing({ score, size = 48 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  
  const getColor = (s) => {
    if (s >= 80) return '#22c55e';
    if (s >= 60) return '#eab308';
    if (s >= 40) return '#f97316';
    return '#ef4444';
  };

  return (
    <div className="trust-score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={getColor(score)} strokeWidth="4"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.33, 1, 0.68, 1)' }} />
      </svg>
      <span className="score-text" style={{ color: getColor(score) }}>{score}</span>
    </div>
  );
}

// ============================================
// Trust Badge Component
// ============================================
function TrustBadge({ badge, score }) {
  const badgeConfig = {
    trusted: { label: 'Trusted', icon: <CheckCircle2 size={13} /> },
    verified: { label: 'Verified', icon: <ShieldCheck size={13} /> },
    caution: { label: 'Caution', icon: <AlertTriangle size={13} /> },
    risky: { label: 'Risky', icon: <AlertOctagon size={13} /> }
  };
  const config = badgeConfig[badge] || badgeConfig.verified;
  return (
    <div className="trust-badge-wrapper" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <TrustScoreRing score={score} size={42} />
      <span className={`trust-badge ${badge}`}>
        {config.icon}
        {config.label}
      </span>
    </div>
  );
}

// ============================================
// Hotel Card Component
// ============================================
function HotelCard({ hotel, onClick }) {
  return (
    <div className="hotel-card" onClick={() => onClick(hotel)} id={`hotel-card-${hotel.id}`}>
      <div className="hotel-card-image">
        <Hotel size={44} strokeWidth={1.5} color="var(--text-muted)" style={{ opacity: 0.4 }} />
        <div className="hotel-card-badges">
          {hotel.amenities?.length > 0 && (
            <span className="badge badge-verified">
              <Waves size={12} /> {hotel.amenities[0]}
            </span>
          )}
        </div>
        <div className="hotel-card-trust-badge">
          <TrustScoreRing score={hotel.trust_score} />
        </div>
      </div>
      <div className="hotel-card-body">
        <h3 className="hotel-card-name">{hotel.name}</h3>
        <div className="hotel-card-location">
          <MapPin size={13} color="var(--accent-primary)" />
          <span>{hotel.location} • {hotel.area}</span>
        </div>
        {hotel.landmark && (
          <div className="hotel-card-landmark" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Footprints size={12} color="var(--text-muted)" />
            <span>{hotel.landmark}</span>
          </div>
        )}
        <div className="hotel-card-vibe">"{hotel.neighborhood_vibe}"</div>
        <div className="hotel-card-tags">
          {hotel.tags?.slice(0, 3).map((tag, i) => (
            <span key={i} className="hotel-card-tag">{tag}</span>
          ))}
        </div>
        {hotel.scam_flags?.length > 0 && (
          <div className="scam-flags">
            {hotel.scam_flags.map((flag, i) => (
              <span key={i} className="scam-flag">
                <AlertTriangle size={12} /> {flag}
              </span>
            ))}
          </div>
        )}
        <div className="hotel-card-footer">
          <div>
            <span className="hotel-card-price">{hotel.price_display}</span>
            <span className="hotel-card-price-label"> / night</span>
          </div>
          {hotel.rating && (
            <div className="hotel-card-rating">
              <Star size={12} fill="#eab308" color="#eab308" />
              <span>{hotel.rating}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Hotel Detail View
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
    <div className="hotel-detail container">
      <button className="back-btn" onClick={onBack}>
        <ArrowLeft size={16} />
        <span>Back to listings</span>
      </button>
      
      <div className="hotel-detail-header">
        <div>
          <div className="hotel-detail-image">
            <Hotel size={64} strokeWidth={1.5} color="var(--text-muted)" style={{ opacity: 0.35 }} />
          </div>
          
          <div className="hotel-detail-vibe" style={{ marginTop: 20 }}>
            <div className="hotel-detail-vibe-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Sparkles size={16} color="var(--accent-primary)" />
              <span>Neighborhood Vibe</span>
            </div>
            <div className="hotel-detail-vibe-text">"{hotel.neighborhood_vibe}"</div>
          </div>
          
          {hotel.amenities?.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>Amenities</h3>
              <div className="hotel-detail-amenities">
                {hotel.amenities.map((a, i) => (
                  <span key={i} className="amenity-chip">
                    <Sparkles size={11} color="var(--accent-primary)" />
                    <span>{a}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {hotel.tags?.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: 12, marginTop: 16 }}>Features</h3>
              <div className="hotel-detail-amenities">
                {hotel.tags.map((t, i) => (
                  <span key={i} className="amenity-chip">{t}</span>
                ))}
              </div>
            </div>
          )}

          {hotel.scam_flags?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 8, color: '#f97316', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} />
                <span>Risk Signals</span>
              </h3>
              <div className="scam-flags">
                {hotel.scam_flags.map((flag, i) => (
                  <span key={i} className="scam-flag">
                    <AlertTriangle size={12} />
                    <span>{flag}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="hotel-detail-info">
          <h1 className="hotel-detail-name">{hotel.name}</h1>
          <div className="hotel-detail-location" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={15} color="var(--accent-primary)" />
            <span>{hotel.location} • {hotel.area}</span>
          </div>
          {hotel.landmark && (
            <div className="hotel-detail-landmark" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Footprints size={14} color="var(--text-muted)" />
              <span>{hotel.landmark}</span>
            </div>
          )}
          
          <div className="hotel-detail-trust-card">
            <div className="hotel-detail-trust-header">
              <span className="hotel-detail-trust-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <ShieldCheck size={18} color="var(--accent-primary)" />
                <span>Trust Analysis</span>
              </span>
              <TrustBadge badge={hotel.trust_badge} score={hotel.trust_score} />
            </div>
            <div className="hotel-detail-trust-bars">
              <div className="trust-bar">
                <span className="trust-bar-label">Overall Trust</span>
                <div className="trust-bar-track">
                  <div className="trust-bar-fill" style={{ 
                    width: `${hotel.trust_score}%`,
                    background: hotel.trust_score >= 80 ? '#22c55e' : hotel.trust_score >= 60 ? '#eab308' : '#ef4444'
                  }} />
                </div>
              </div>
              <div className="trust-bar">
                <span className="trust-bar-label">Rating Score</span>
                <div className="trust-bar-track">
                  <div className="trust-bar-fill" style={{ 
                    width: `${(hotel.rating || 0) * 20}%`, background: '#06b6d4'
                  }} />
                </div>
              </div>
              <div className="trust-bar">
                <span className="trust-bar-label">Scam Risk</span>
                <div className="trust-bar-track">
                  <div className="trust-bar-fill" style={{ 
                    width: `${Math.max(0, 100 - hotel.trust_score)}%`, background: '#ef4444'
                  }} />
                </div>
              </div>
            </div>
          </div>

          <div className="hotel-detail-price-box">
            <div className="hotel-detail-price">{hotel.price_display}</div>
            <div className="hotel-detail-price-label">per night</div>
          </div>

          {!user ? (
            <div className="booking-auth-prompt">
              <Lock size={16} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div className="booking-auth-prompt-content">
                <div className="booking-auth-prompt-title">Sign in required to book</div>
                <div>Please sign in with Google or Email to confirm this reservation and unlock your personalized AI Trip Concierge on Telegram.</div>
              </div>
            </div>
          ) : (
            <div className="booking-auth-badge">
              <CheckCircle2 size={13} color="var(--trust-green)" />
              <span>Verified Guest: {user.email}</span>
            </div>
          )}

          <form className="booking-form" onSubmit={handleBook}>
            <div className="form-group">
              <label className="form-label">Your Name *</label>
              <input className="form-input" required value={formData.guestName}
                onChange={e => setFormData({...formData, guestName: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" required value={formData.guestEmail}
                onChange={e => setFormData({...formData, guestEmail: e.target.value})} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Check-in *</label>
                <input className="form-input" type="date" required value={formData.checkIn}
                  onChange={e => setFormData({...formData, checkIn: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Check-out *</label>
                <input className="form-input" type="date" required value={formData.checkOut}
                  onChange={e => setFormData({...formData, checkOut: e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number (for Trip Concierge)</label>
              <input className="form-input" type="tel" placeholder="+91 98765 43210" value={formData.phoneNumber}
                onChange={e => setFormData({...formData, phoneNumber: e.target.value})} />
            </div>
            <button type="submit" className="btn-primary" disabled={booking}>
              {booking ? (
                <>
                  <Loader2 size={16} className="spin-icon" />
                  <span>Confirming Reservation...</span>
                </>
              ) : !user ? (
                <>
                  <Lock size={15} />
                  <span>Sign In to Book — Get AI Trip Concierge</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>Confirm Booking — Get AI Trip Concierge</span>
                </>
              )}
            </button>
          </form>
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
          <ul key={`ul-${elements.length}`} className="chat-ul">
            {currentList.map((item, idx) => (
              <li key={idx} className="chat-li">
                <Sparkles size={11} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: 4 }} />
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
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      flushList();
      continue;
    }

    // Heading: ### or ## or #
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

    // Callout / Tip box (starts with 💡 or > or "Tip:")
    if (line.startsWith('💡') || line.startsWith('>') || /^tip:/i.test(line)) {
      flushList();
      const text = line.replace(/^[>💡]\s*/, '').replace(/^tip:\s*/i, '');
      elements.push(
        <div key={`tip-${i}`} className="chat-tip-card">
          <Lightbulb size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
          <div className="chat-tip-text">
            <strong>Local Tip:</strong> {formatInline(text)}
          </div>
        </div>
      );
      continue;
    }

    // Unordered bullet item: - or * or •
    if (/^[-*•]\s+(.*)/.test(line)) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      currentList.push(line.replace(/^[-*•]\s+/, ''));
      continue;
    }

    // Ordered list item: 1. or 2.
    if (/^\d+\.\s+(.*)/.test(line)) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      currentList.push(line.replace(/^\d+\.\s+/, ''));
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${i}`} className="chat-p">
        {formatInline(line)}
      </p>
    );
  }

  flushList();

  return <div className="chat-formatted-body">{elements}</div>;
}

// Inline parser for bold, badges, prices, ratings
function formatInline(text) {
  if (!text) return null;

  // Split by bold (**bold**)
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2);
      
      // Check if it's a price
      if (/₹[\d,]+/.test(inner)) {
        return <span key={index} className="chat-badge-price">{inner}</span>;
      }
      // Check if it's a trust badge
      if (/(trusted|verified|caution|risky)/i.test(inner)) {
        const isCaution = /caution/i.test(inner);
        const isRisky = /risky/i.test(inner);
        const badgeClass = isRisky ? 'chat-badge-risky' : isCaution ? 'chat-badge-caution' : 'chat-badge-trust';
        return <span key={index} className={`chat-badge ${badgeClass}`}>{inner}</span>;
      }

      return <strong key={index} className="chat-bold">{inner}</strong>;
    }

    // Check for standalone price tags outside of bold tags
    const priceParts = part.split(/(₹[\d,]+(?:\/(?:night|day))?)/g);
    if (priceParts.length > 1) {
      return (
        <span key={index}>
          {priceParts.map((subPart, subIdx) => {
            if (/^₹[\d,]+/.test(subPart)) {
              return <span key={subIdx} className="chat-badge-price">{subPart}</span>;
            }
            return subPart;
          })}
        </span>
      );
    }

    return part;
  });
}

// ============================================
// Chatbot Widget
// ============================================
const QUICK_PROMPTS = [
  { text: 'Best hotels near Baga Beach under ₹4,000', icon: <Waves size={13} color="var(--accent-primary)" /> },
  { text: 'Highest Trust Score hotels in North Goa', icon: <ShieldCheck size={13} color="var(--trust-green)" /> },
  { text: 'Best hotels near nightlife & beach shacks', icon: <PartyPopper size={13} color="var(--accent-secondary)" /> },
  { text: 'Quiet beachfront resorts in South Goa', icon: <Palmtree size={13} color="var(--accent-primary)" /> },
];

const INITIAL_GREETING = {
  role: 'bot',
  content: "Welcome to StayWU Trust Advisor. Ask me anything about hotels in Goa — I'll help you find verified, safe stays with transparent trust ratings and neighborhood vibes."
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
      <button className={`chatbot-toggle ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(!isOpen)}
        id="chatbot-toggle" aria-label="Toggle chatbot">
        {isOpen ? <X size={22} /> : <MessageSquare size={22} />}
      </button>

      {isOpen && (
        <div className="chatbot-window" id="chatbot-window">
          <div className="chatbot-header">
            <div className="chatbot-header-avatar">
              <Bot size={18} color="white" />
            </div>
            <div className="chatbot-header-info">
              <h3>StayWU Trust Advisor</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span className="chat-online-badge">
                  <span className="pulse-dot"></span> Online
                </span>
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>• Verified AI</span>
              </div>
            </div>
            <button className="chat-clear-btn" onClick={resetChat} title="Reset Conversation">
              <RotateCcw size={14} />
            </button>
          </div>
          
          <div className="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chatbot-message ${msg.role === 'bot' ? 'bot' : 'user'}`}>
                {msg.role === 'bot' ? (
                  <FormattedMessage content={msg.content} />
                ) : (
                  msg.content
                )}
              </div>
            ))}

            {/* Show quick suggestion chips when only greeting is visible */}
            {messages.length === 1 && !loading && (
              <div className="chat-quick-prompts">
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', width: '100%', marginBottom: 2 }}>
                  Suggested questions:
                </div>
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button 
                    key={idx} 
                    className="chat-chip"
                    onClick={() => sendWithText(prompt.text)}
                  >
                    {prompt.icon}
                    <span>{prompt.text}</span>
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="chatbot-message bot typing">
                <div className="dot" /><div className="dot" /><div className="dot" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot-input-area">
            <input className="chatbot-input" placeholder="Ask about Goa hotels, trust, areas..."
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()} id="chatbot-input" />
            <button className="chatbot-send" onClick={handleSend} aria-label="Send">
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================
// Booking Success Modal
// ============================================
function BookingModal({ bookingData, onClose }) {
  if (!bookingData) return null;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <CheckCircle2 size={48} className="modal-icon-svg" />
        <h2 className="modal-title">Booking Confirmed!</h2>
        <p className="modal-text">
          Your stay at <strong>{bookingData.booking.hotelName}</strong> is booked!
        </p>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 12, margin: '12px 0', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '4px 0' }}>
            <Receipt size={14} color="var(--accent-primary)" />
            <span>Booking ID: <strong>{bookingData.booking.id}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '4px 0' }}>
            <Calendar size={14} color="var(--accent-primary)" />
            <span>{bookingData.booking.checkIn} → {bookingData.booking.checkOut}</span>
          </div>
        </div>
        <p className="modal-text" style={{ fontSize: '0.88rem', color: '#cbd5e1' }}>
          <Bot size={15} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 5, color: 'var(--accent-primary)' }} />
          Open your <strong>AI Trip Concierge</strong> on Telegram to get a personalized
          day-by-day itinerary for your Goa trip!
        </p>
        <a href={bookingData.telegramLink} target="_blank" rel="noopener noreferrer" className="modal-telegram-link">
          <Send size={15} />
          <span>Open Trip Concierge on Telegram</span>
        </a>
        <br />
        <button className="modal-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ============================================
// Main App
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

  // Fetch locations on mount
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
  };

  if (selectedHotel) {
    return (
      <>
        <nav className="navbar">
          <div className="navbar-inner">
            <div className="navbar-logo" onClick={() => setSelectedHotel(null)} style={{ cursor: 'pointer' }}>
              <div className="navbar-logo-icon">
                <Building2 size={18} color="white" />
              </div>
              StayWU
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
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-logo">
            <div className="navbar-logo-icon">
              <Building2 size={18} color="white" />
            </div>
            StayWU
          </div>
          <ul className="navbar-nav">
            <li><a href="#hotels">Hotels</a></li>
            <li><a href="#trust">Trust Scores</a></li>
            <li><a href="#about">About</a></li>
          </ul>
          <div className="nav-auth-group">
            <NavbarUser onOpenAuth={openAuth} />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero container">
        <div className="hero-badge">
          <ShieldCheck size={14} color="var(--accent-primary)" />
          <span>AI-Powered Trust Verification</span>
        </div>
        <h1 className="hero-title">
          Book with <span className="hero-title-gradient">Confidence</span>,<br />
          Travel with an <span className="hero-title-gradient">AI Guide</span>
        </h1>
        <p className="hero-subtitle">
          Verified hotels, scam detection, and a personal AI trip concierge —
          everything you need for a perfect Goa getaway.
        </p>

        <div className="hero-stats">
          <div className="hero-stat">
            <div className="hero-stat-value">2,400+</div>
            <div className="hero-stat-label">Verified Hotels</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-value">43</div>
            <div className="hero-stat-label">Tourism Places</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-value">AI</div>
            <div className="hero-stat-label">Trip Concierge</div>
          </div>
        </div>
      </section>

      {/* Search */}
      <section className="search-section container" id="hotels">
        <form className="search-bar" onSubmit={handleSearch}>
          <input className="search-input" placeholder="Search hotels, locations, amenities..."
            value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            id="search-input" />
          <div className="search-filters">
            <select className="search-select" value={locationFilter}
              onChange={e => { setLocationFilter(e.target.value); setPage(1); }} id="location-filter">
              <option value="">All Locations</option>
              {locations.slice(0, 20).map(loc => (
                <option key={loc.name} value={loc.name}>{loc.name} ({loc.count})</option>
              ))}
            </select>
            <select className="search-select" value={sortBy}
              onChange={e => { setSortBy(e.target.value); setPage(1); }} id="sort-filter">
              <option value="">Sort By</option>
              <option value="trust">Trust Score</option>
              <option value="rating">Rating</option>
              <option value="price_low">Price: Low → High</option>
              <option value="price_high">Price: High → Low</option>
            </select>
            <button type="submit" className="search-btn">
              <Search size={15} />
              <span>Search</span>
            </button>
          </div>
        </form>

        <div className="filter-pills">
          {[
            { id: 'trusted', label: 'Trusted', icon: <CheckCircle2 size={13} /> },
            { id: 'verified', label: 'Verified', icon: <ShieldCheck size={13} /> },
            { id: 'caution', label: 'Caution', icon: <AlertTriangle size={13} /> },
            { id: 'risky', label: 'Risky', icon: <AlertOctagon size={13} /> }
          ].map(badge => (
            <button key={badge.id} className={`filter-pill ${trustFilter === badge.id ? 'active' : ''}`}
              onClick={() => { setTrustFilter(trustFilter === badge.id ? '' : badge.id); setPage(1); }}>
              {badge.icon}
              <span>{badge.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Hotel Grid */}
      <section className="container">
        <div className="section-header">
          <div>
            <h2 className="section-title" id="trust">Goa Hotels</h2>
            <p className="section-subtitle">
              {pagination ? `${pagination.total} properties found` : 'Loading...'}
              {trustFilter && ` • Filtered: ${trustFilter}`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="loading-grid">
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
                <button className="pagination-btn" disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>
                {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                  const pageNum = Math.max(1, page - 2) + i;
                  if (pageNum > pagination.totalPages) return null;
                  return (
                    <button key={pageNum} className={`pagination-btn ${page === pageNum ? 'active' : ''}`}
                      onClick={() => setPage(pageNum)}>{pageNum}</button>
                  );
                })}
                <button className="pagination-btn" disabled={page >= pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}>
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Footer */}
      <footer className="footer" id="about">
        <div className="container">
          <div className="footer-brand">StayWU</div>
          <p>AI-powered trust verification & trip concierge for Goa</p>
          <p style={{ marginTop: 8 }}>Book with confidence. Travel with an AI guide.</p>
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

      {/* Chatbot */}
      <ChatBot />
    </>
  );
}
