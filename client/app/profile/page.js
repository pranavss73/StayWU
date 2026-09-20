'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Calendar,
  MapPin,
  Clock,
  KeyRound,
  Bot,
  User,
  Mail,
  Phone,
  Edit3,
  Save,
  Trash2,
  Sparkles,
  ArrowLeft,
  ExternalLink,
  ChevronRight,
  Sliders,
  Check,
  Camera,
  HeartPulse,
  LogOut,
  AlertTriangle,
  Hotel,
  Plus,
  RefreshCw,
  Bell,
  Fingerprint,
  FileCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AuthModal from '../../components/AuthModal';
import { API_BASE } from '@/lib/api';

export default function ProfilePage() {
  const { user, loading: authLoading, logout, updateUserProfile } = useAuth();

  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'preferences' | 'security'
  const [bookingFilter, setBookingFilter] = useState('all'); // 'all' | 'confirmed' | 'completed'

  // Bookings State
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [creatingDemo, setCreatingDemo] = useState(false);

  // Profile Edit State
  const [editingName, setEditingName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Travel Persona Preferences State (persisted in localStorage + Firebase)
  const [preferences, setPreferences] = useState({
    pace: 'balanced', // 'fast' | 'balanced' | 'relaxed'
    vibe: 'beach', // 'beach' | 'heritage' | 'nightlife' | 'nature'
    dietary: 'seafood', // 'veg' | 'nonveg' | 'seafood' | 'jain'
    petFriendly: false,
    poolRequired: true,
    emergencyContactName: '',
    emergencyContactPhone: '',
    alertOnQrScan: true,
    telegramSync: true,
    scamAlerts: true,
  });
  const [preferencesSaved, setPreferencesSaved] = useState(false);

  // Auth Modal
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalConfig, setAuthModalConfig] = useState({ title: '', subtitle: '', initialTab: 'signin' });
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync initial user name
  useEffect(() => {
    if (user) {
      setDisplayNameInput(user.displayName || user.email?.split('@')[0] || '');
      loadUserPreferences(user.uid);
      fetchBookings(user.uid, user.email);
    } else if (!authLoading) {
      // Fallback for guest/demo view
      fetchBookings('traveler_default', 'pranav@staywu.com');
      loadUserPreferences('traveler_default');
    }
  }, [user, authLoading]);

  // Load Preferences from localStorage
  const loadUserPreferences = (uid) => {
    try {
      const saved = localStorage.getItem(`staywu_prefs_${uid}`);
      if (saved) {
        setPreferences(prev => ({ ...prev, ...JSON.parse(saved) }));
      }
    } catch (e) {
      console.warn('Could not read user preferences:', e);
    }
  };

  // Save Preferences to localStorage
  const handleSavePreferences = (e) => {
    e?.preventDefault();
    const uid = user?.uid || 'traveler_default';
    try {
      localStorage.setItem(`staywu_prefs_${uid}`, JSON.stringify(preferences));
      setPreferencesSaved(true);
      showToast('Traveler persona & settings saved successfully! 🌴');
      setTimeout(() => setPreferencesSaved(false), 3000);
    } catch (e) {
      console.error('Error saving preferences:', e);
    }
  };

  // Fetch Bookings from API
  const fetchBookings = async (uid, email) => {
    setLoadingBookings(true);
    try {
      const url = `${API_BASE}/bookings?userId=${encodeURIComponent(uid || 'traveler_default')}${email ? `&email=${encodeURIComponent(email)}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings || []);
      }
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setLoadingBookings(false);
    }
  };

  // Save Display Name to Firebase
  const handleSaveName = async () => {
    if (!displayNameInput.trim()) return;
    setSavingName(true);
    try {
      if (updateUserProfile) {
        await updateUserProfile({ displayName: displayNameInput.trim() });
      }
      setEditingName(false);
      showToast('Profile name updated in Firebase Auth!');
    } catch (err) {
      console.error('Error updating name:', err);
      showToast('Failed to update name in Firebase', 'error');
    } finally {
      setSavingName(false);
    }
  };

  // Generate 1-Tap Presentation Demo Booking
  const handleCreateDemoBooking = async () => {
    setCreatingDemo(true);
    try {
      const res = await fetch(`${API_BASE}/bookings/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid || 'traveler_default',
          guestName: user?.displayName || displayNameInput || 'Pranav',
          guestEmail: user?.email || 'pranav@staywu.com',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast('⚡ Demo Booking created with live Telegram link!');
        await fetchBookings(user?.uid || 'traveler_default', user?.email);
      }
    } catch (err) {
      console.error('Error generating demo booking:', err);
    } finally {
      setCreatingDemo(false);
    }
  };

  const filteredBookings = bookings.filter(b => {
    if (bookingFilter === 'confirmed') return b.status === 'confirmed';
    if (bookingFilter === 'completed') return b.status === 'completed';
    return true;
  });

  const initials = (user?.displayName?.[0] || user?.email?.[0] || 'P').toUpperCase();
  const botUsername = 'StayWU_bot';

  return (
    <div className="profile-page-canvas">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`vault-toast-banner ${toastMessage.type === 'error' ? 'error' : ''}`}>
          <CheckCircle2 size={16} color={toastMessage.type === 'error' ? '#f43f5e' : 'var(--trust-emerald)'} />
          <span>{toastMessage.msg}</span>
        </div>
      )}

      {/* Profile Header Navigation */}
      <header className="profile-header-bar">
        <div className="container profile-header-bar-inner">
          <Link href="/" className="detail-nav-back" style={{ marginBottom: 0 }}>
            <ArrowLeft size={15} />
            <span>Back to Curated Stays</span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/documents" className="vault-action-btn secondary" style={{ padding: '7px 14px', fontSize: '0.84rem' }}>
              <KeyRound size={14} color="var(--accent-gold)" />
              <span>Document Vault</span>
            </Link>

            {user ? (
              <button className="vault-action-btn outline" onClick={logout} style={{ padding: '7px 14px', fontSize: '0.84rem' }}>
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                className="nav-sign-in-btn"
                onClick={() => {
                  setAuthModalConfig({
                    title: 'Sign In to StayWU',
                    subtitle: 'Access your verified booking history, travel persona, and document vault.',
                    initialTab: 'signin',
                  });
                  setAuthModalOpen(true);
                }}
              >
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container profile-main-content">
        {/* ======================================================== */}
        {/* VIP TRAVELER IDENTITY HERO CARD                          */}
        {/* ======================================================== */}
        <section className="profile-hero-card">
          <div className="profile-hero-left">
            <div className="profile-avatar-wrapper">
              <div className="profile-avatar-large">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="User Avatar" className="profile-avatar-img" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className="profile-badge-dot" title="Firebase Verified Traveler" />
            </div>

            <div className="profile-identity-info">
              <div className="profile-name-row">
                {editingName ? (
                  <div className="profile-name-edit-group">
                    <input
                      className="field-input"
                      style={{ padding: '6px 12px', fontSize: '1.1rem', maxWidth: 220 }}
                      value={displayNameInput}
                      onChange={e => setDisplayNameInput(e.target.value)}
                      placeholder="Your Full Name"
                      autoFocus
                    />
                    <button className="vault-btn-primary" onClick={handleSaveName} disabled={savingName} style={{ padding: '6px 12px' }}>
                      <Save size={14} />
                      <span>{savingName ? 'Saving...' : 'Save'}</span>
                    </button>
                    <button className="vault-action-btn secondary" onClick={() => setEditingName(false)} style={{ padding: '6px 10px' }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="profile-display-name">
                      {user?.displayName || displayNameInput || 'Pranav (Traveler)'}
                    </h1>
                    {user && (
                      <button
                        className="profile-edit-name-btn"
                        onClick={() => setEditingName(true)}
                        title="Edit name in Firebase Auth"
                      >
                        <Edit3 size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="profile-email-row">
                <Mail size={13} color="var(--text-muted)" />
                <span>{user?.email || 'pranav@staywu.com (Demo Account)'}</span>
                {user?.emailVerified ? (
                  <span className="profile-tag-verified">✓ Verified</span>
                ) : (
                  <span className="profile-tag-verified">Firebase Authenticated</span>
                )}
              </div>

              <div className="profile-tier-badge-row">
                <span className="profile-tier-pill">
                  <Sparkles size={12} color="var(--accent-gold)" />
                  <span>StayWU Voyager • Tier 1</span>
                </span>
                <span className="profile-security-pill">
                  <ShieldCheck size={12} color="var(--trust-emerald)" />
                  <span>Scam Shield™ Protected</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="profile-hero-metrics">
            <div className="profile-metric-box">
              <div className="metric-val">{bookings.length}</div>
              <div className="metric-label">Confirmed Stays</div>
            </div>
            <div className="profile-metric-box">
              <div className="metric-val" style={{ color: 'var(--trust-emerald)' }}>98%</div>
              <div className="metric-label">Avg Trust Score</div>
            </div>
            <div className="profile-metric-box">
              <div className="metric-val" style={{ color: 'var(--accent-gold)' }}>15m</div>
              <div className="metric-label">Expiring QR Vault</div>
            </div>
            <div className="profile-metric-box">
              <div className="metric-val" style={{ color: '#38bdf8' }}>Active</div>
              <div className="metric-label">@StayWU_bot Sync</div>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* PROFILE TABS NAVIGATION                                  */}
        {/* ======================================================== */}
        <div className="profile-tabs-bar">
          <button
            className={`profile-tab-item ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            <Hotel size={16} />
            <span>Stays & Bookings ({bookings.length})</span>
          </button>

          <button
            className={`profile-tab-item ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            <Sliders size={16} />
            <span>Travel Persona & SOS</span>
          </button>

          <button
            className={`profile-tab-item ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Fingerprint size={16} />
            <span>Security & Linked Services</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: BOOKINGS & STAY HISTORY                           */}
        {/* ======================================================== */}
        {activeTab === 'bookings' && (
          <div className="profile-tab-panel">
            {/* Filter Pills & Actions */}
            <div className="profile-bookings-toolbar">
              <div className="profile-filter-chips">
                <button
                  className={`profile-chip ${bookingFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setBookingFilter('all')}
                >
                  All Stays ({bookings.length})
                </button>
                <button
                  className={`profile-chip ${bookingFilter === 'confirmed' ? 'active' : ''}`}
                  onClick={() => setBookingFilter('confirmed')}
                >
                  Active & Upcoming ({bookings.filter(b => b.status === 'confirmed').length})
                </button>
                <button
                  className={`profile-chip ${bookingFilter === 'completed' ? 'active' : ''}`}
                  onClick={() => setBookingFilter('completed')}
                >
                  Completed ({bookings.filter(b => b.status === 'completed').length})
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="vault-action-btn secondary"
                  onClick={handleCreateDemoBooking}
                  disabled={creatingDemo}
                  title="Generate a sample confirmed Goa stay for testing"
                  style={{ fontSize: '0.82rem' }}
                >
                  <Sparkles size={14} color="var(--accent-gold)" />
                  <span>{creatingDemo ? 'Generating...' : '+ Demo Booking'}</span>
                </button>
                <button
                  className="vault-action-btn secondary"
                  onClick={() => fetchBookings(user?.uid || 'traveler_default', user?.email)}
                  title="Refresh Bookings"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            {/* Bookings List */}
            {loadingBookings ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div className="skeleton" style={{ width: '100%', height: 120, borderRadius: 12, marginBottom: 16 }} />
                <div className="skeleton" style={{ width: '100%', height: 120, borderRadius: 12 }} />
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="profile-empty-card">
                <Hotel size={42} color="var(--text-muted)" />
                <h3>No Bookings in this Filter</h3>
                <p>You haven't confirmed any stays under this status. Explore our audited properties across Goa.</p>
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <Link href="/" className="vault-btn-primary">
                    <span>Explore Verified Stays</span>
                  </Link>
                  <button className="vault-action-btn secondary" onClick={handleCreateDemoBooking}>
                    <Sparkles size={14} color="var(--accent-gold)" />
                    <span>Create Demo Stay</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="profile-bookings-grid">
                {filteredBookings.map((b) => {
                  const isUpcoming = b.status === 'confirmed';
                  const telegramDeepLink = `https://t.me/${botUsername}?start=${b.id}`;

                  return (
                    <div key={b.id} className="profile-booking-card">
                      <div className="booking-card-top">
                        <div className="booking-hotel-header">
                          <div className="booking-status-badge-row">
                            <span className={`booking-status-pill ${b.status}`}>
                              {b.status === 'confirmed' ? '✓ Confirmed Stay' : 'Completed Stay'}
                            </span>
                            <span className="booking-id-tag">{b.id}</span>
                          </div>
                          <h3 className="booking-hotel-name">{b.hotelName}</h3>
                          <div className="booking-location-row">
                            <MapPin size={13} color="var(--accent-gold)" />
                            <span>{b.location} • {b.area || 'Goa'}</span>
                          </div>
                        </div>

                        <div className="booking-price-badge">
                          <div className="booking-price-val">{b.price_display || `₹${b.price?.toLocaleString()}`}</div>
                          <div className="booking-price-sub">Rate Confirmed</div>
                        </div>
                      </div>

                      {/* Dates & Timeline */}
                      <div className="booking-dates-row">
                        <div className="booking-date-block">
                          <span className="date-label">Check-In</span>
                          <span className="date-val">{b.checkIn}</span>
                        </div>
                        <div className="booking-date-arrow">&rarr;</div>
                        <div className="booking-date-block">
                          <span className="date-label">Check-Out</span>
                          <span className="date-val">{b.checkOut}</span>
                        </div>
                        <div className="booking-trust-block">
                          <span className="date-label">Authenticity</span>
                          <span className="trust-val">
                            <ShieldCheck size={13} color="var(--trust-emerald)" />
                            <span>{b.trust_score || 95}/100</span>
                          </span>
                        </div>
                      </div>

                      {/* Itinerary / Preference Note */}
                      {b.itinerary && (
                        <div className="booking-itinerary-note">
                          <Sparkles size={13} color="var(--accent-gold)" />
                          <span><strong>Anchor Tour:</strong> {b.itinerary}</span>
                        </div>
                      )}

                      {/* Action Links */}
                      <div className="booking-card-actions">
                        <a
                          href={telegramDeepLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="vault-btn-primary"
                          style={{ textDecoration: 'none', padding: '8px 14px', fontSize: '0.82rem' }}
                        >
                          <Bot size={15} />
                          <span>Telegram Concierge</span>
                          <ExternalLink size={12} style={{ opacity: 0.7 }} />
                        </a>

                        <Link
                          href="/documents"
                          className="vault-action-btn secondary"
                          style={{ textDecoration: 'none', padding: '8px 14px', fontSize: '0.82rem' }}
                        >
                          <KeyRound size={15} color="var(--accent-gold)" />
                          <span>Expiring Vault QR</span>
                        </Link>

                        <Link
                          href="/documents"
                          className="vault-action-btn outline"
                          style={{ textDecoration: 'none', padding: '8px 14px', fontSize: '0.82rem' }}
                        >
                          <Camera size={14} />
                          <span>Trip Memories</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: TRAVEL PERSONA & PREFERENCES                      */}
        {/* ======================================================== */}
        {activeTab === 'preferences' && (
          <div className="profile-tab-panel">
            <form onSubmit={handleSavePreferences} className="profile-settings-form">
              {/* Section 1: Travel Persona */}
              <div className="settings-section-card">
                <div className="settings-section-header">
                  <div className="settings-icon-badge">
                    <Sliders size={18} color="var(--accent-gold)" />
                  </div>
                  <div>
                    <h3 className="settings-section-title">Goa Travel Persona & Pace</h3>
                    <p className="settings-section-subtitle">
                      Personalizes AI recommendations from @StayWU_bot and filters hotel vibe matching.
                    </p>
                  </div>
                </div>

                <div className="settings-group">
                  <label className="field-label">Trip Pace & Daily Energy</label>
                  <div className="segmented-selector-group">
                    {[
                      { id: 'fast', label: '⚡ Fast-Paced', desc: 'Cover 4+ spots/day, packed itinerary' },
                      { id: 'balanced', label: '🌴 Balanced Explorer', desc: 'Morning sights, relaxed sunset shacks' },
                      { id: 'relaxed', label: '🧘 Slow & Leisure', desc: 'Pool lounging, late brunches & serenity' },
                    ].map(opt => (
                      <button
                        type="button"
                        key={opt.id}
                        className={`segmented-card ${preferences.pace === opt.id ? 'active' : ''}`}
                        onClick={() => setPreferences({ ...preferences, pace: opt.id })}
                      >
                        <div className="segmented-card-title">{opt.label}</div>
                        <div className="segmented-card-desc">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-group" style={{ marginTop: 20 }}>
                  <label className="field-label">Preferred Neighborhood Atmosphere</label>
                  <div className="segmented-selector-group four-col">
                    {[
                      { id: 'beach', label: '🏖️ Beachfront', desc: 'Anjuna, Morjim, Mandrem' },
                      { id: 'heritage', label: '🏛️ Heritage & Art', desc: 'Fontainhas, Panaji, Old Goa' },
                      { id: 'nightlife', label: '🎉 High-Energy', desc: 'Baga, Calangute, Vagator' },
                      { id: 'nature', label: '🌿 Nature & Serene', desc: 'Palolem, Agonda, South Goa' },
                    ].map(opt => (
                      <button
                        type="button"
                        key={opt.id}
                        className={`segmented-card ${preferences.vibe === opt.id ? 'active' : ''}`}
                        onClick={() => setPreferences({ ...preferences, vibe: opt.id })}
                      >
                        <div className="segmented-card-title">{opt.label}</div>
                        <div className="segmented-card-desc">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 2: Dietary & Property Requirements */}
              <div className="settings-section-card">
                <div className="settings-section-header">
                  <div className="settings-icon-badge">
                    <Hotel size={18} color="var(--accent-gold)" />
                  </div>
                  <div>
                    <h3 className="settings-section-title">Dining & Property Must-Haves</h3>
                    <p className="settings-section-subtitle">
                      Automatically audited during hotel selection and restaurant routing.
                    </p>
                  </div>
                </div>

                <div className="settings-group">
                  <label className="field-label">Dietary Preference</label>
                  <div className="segmented-selector-group four-col">
                    {[
                      { id: 'seafood', label: '🐟 Fresh Seafood' },
                      { id: 'nonveg', label: '🍗 Non-Vegetarian' },
                      { id: 'veg', label: '🥗 Pure Vegetarian' },
                      { id: 'jain', label: '🌱 Vegan / Jain' },
                    ].map(opt => (
                      <button
                        type="button"
                        key={opt.id}
                        className={`segmented-card compact ${preferences.dietary === opt.id ? 'active' : ''}`}
                        onClick={() => setPreferences({ ...preferences, dietary: opt.id })}
                      >
                        <div className="segmented-card-title">{opt.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-checkboxes-row" style={{ marginTop: 20 }}>
                  <label className="settings-toggle-item">
                    <input
                      type="checkbox"
                      checked={preferences.poolRequired}
                      onChange={e => setPreferences({ ...preferences, poolRequired: e.target.checked })}
                    />
                    <div>
                      <div className="toggle-item-title">Swimming Pool Essential</div>
                      <div className="toggle-item-desc">Filter for verified pool properties only</div>
                    </div>
                  </label>

                  <label className="settings-toggle-item">
                    <input
                      type="checkbox"
                      checked={preferences.petFriendly}
                      onChange={e => setPreferences({ ...preferences, petFriendly: e.target.checked })}
                    />
                    <div>
                      <div className="toggle-item-title">Pet-Friendly Accommodations</div>
                      <div className="toggle-item-desc">Highlight verified pet-welcome villas and cottages</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Section 3: Emergency SOS Contacts */}
              <div className="settings-section-card">
                <div className="settings-section-header">
                  <div className="settings-icon-badge" style={{ background: 'rgba(244, 63, 94, 0.12)', color: '#fb7185' }}>
                    <HeartPulse size={18} color="#fb7185" />
                  </div>
                  <div>
                    <h3 className="settings-section-title">Emergency SOS Contact</h3>
                    <p className="settings-section-subtitle">
                      Pre-filled during StayWU SOS triggers and rental scooter checkpoint verification.
                    </p>
                  </div>
                </div>

                <div className="settings-two-inputs">
                  <div className="form-field-group">
                    <label className="field-label">Emergency Contact Name</label>
                    <input
                      className="field-input"
                      placeholder="e.g. Rahul Sharma (Brother)"
                      value={preferences.emergencyContactName}
                      onChange={e => setPreferences({ ...preferences, emergencyContactName: e.target.value })}
                    />
                  </div>

                  <div className="form-field-group">
                    <label className="field-label">Emergency Contact Mobile / WhatsApp</label>
                    <input
                      className="field-input"
                      placeholder="+91 98765 00000"
                      value={preferences.emergencyContactPhone}
                      onChange={e => setPreferences({ ...preferences, emergencyContactPhone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Privacy & Real-time Alerts */}
              <div className="settings-section-card">
                <div className="settings-section-header">
                  <div className="settings-icon-badge">
                    <Bell size={18} color="var(--accent-gold)" />
                  </div>
                  <div>
                    <h3 className="settings-section-title">Privacy & Security Notifications</h3>
                    <p className="settings-section-subtitle">
                      Control real-time audit notifications and Zero-Knowledge vault events.
                    </p>
                  </div>
                </div>

                <div className="settings-toggle-stack">
                  <label className="settings-toggle-item">
                    <input
                      type="checkbox"
                      checked={preferences.alertOnQrScan}
                      onChange={e => setPreferences({ ...preferences, alertOnQrScan: e.target.checked })}
                    />
                    <div>
                      <div className="toggle-item-title">Instant Notification on Expiring QR Scan</div>
                      <div className="toggle-item-desc">Get an alert whenever a hotel desk or scooter rental vendor scans your 15-minute vault QR.</div>
                    </div>
                  </label>

                  <label className="settings-toggle-item">
                    <input
                      type="checkbox"
                      checked={preferences.scamAlerts}
                      onChange={e => setPreferences({ ...preferences, scamAlerts: e.target.checked })}
                    />
                    <div>
                      <div className="toggle-item-title">AI Truth Lens™ Scam Warnings</div>
                      <div className="toggle-item-desc">Highlight properties with fake beachfront claims, high ambient night noise, or hidden AC surcharges.</div>
                    </div>
                  </label>

                  <label className="settings-toggle-item">
                    <input
                      type="checkbox"
                      checked={preferences.telegramSync}
                      onChange={e => setPreferences({ ...preferences, telegramSync: e.target.checked })}
                    />
                    <div>
                      <div className="toggle-item-title">Auto-Sync Itinerary to @StayWU_bot</div>
                      <div className="toggle-item-desc">Automatically pushes daily itinerary adjustments and vouchers to your Telegram chat.</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <div className="settings-action-bar">
                <button type="submit" className="vault-btn-primary">
                  <Save size={16} />
                  <span>{preferencesSaved ? '✓ Saved!' : 'Save Persona & Preferences'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: SECURITY & LINKED SERVICES                        */}
        {/* ======================================================== */}
        {activeTab === 'security' && (
          <div className="profile-tab-panel">
            <div className="security-cards-grid">
              {/* Card 1: Firebase Authentication Overview */}
              <div className="settings-section-card">
                <div className="settings-section-header">
                  <div className="settings-icon-badge">
                    <Fingerprint size={18} color="var(--accent-gold)" />
                  </div>
                  <div>
                    <h3 className="settings-section-title">Firebase Identity Details</h3>
                    <p className="settings-section-subtitle">
                      Managed via Firebase Authentication with project <code>geek2code-ee7ae</code>.
                    </p>
                  </div>
                </div>

                <div className="security-info-list">
                  <div className="security-info-row">
                    <span className="info-key">User UID:</span>
                    <span className="info-val" style={{ fontFamily: 'monospace' }}>
                      {user?.uid || 'guest-session-unauthenticated'}
                    </span>
                  </div>
                  <div className="security-info-row">
                    <span className="info-key">Email Address:</span>
                    <span className="info-val">{user?.email || 'pranav@staywu.com'}</span>
                  </div>
                  <div className="security-info-row">
                    <span className="info-key">Auth Provider:</span>
                    <span className="info-val">
                      {user?.providerData?.[0]?.providerId === 'google.com' ? 'Google OAuth 2.0' : 'Email & Password'}
                    </span>
                  </div>
                  <div className="security-info-row">
                    <span className="info-key">Account Created:</span>
                    <span className="info-val">
                      {user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'Sep 2026'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Document Vault Security */}
              <div className="settings-section-card">
                <div className="settings-section-header">
                  <div className="settings-icon-badge">
                    <KeyRound size={18} color="var(--accent-gold)" />
                  </div>
                  <div>
                    <h3 className="settings-section-title">Zero-Knowledge Document Vault</h3>
                    <p className="settings-section-subtitle">
                      Client-encrypted credentials protected by your 6-digit security PIN.
                    </p>
                  </div>
                </div>

                <div className="security-status-box">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ShieldCheck size={20} color="var(--trust-emerald)" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'white' }}>AES-256 GCM Encryption Active</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Zero plain-text documents stored on cloud servers.</div>
                    </div>
                  </div>
                  <Link href="/documents" className="vault-btn-primary" style={{ padding: '7px 14px', fontSize: '0.82rem', textDecoration: 'none' }}>
                    <span>Manage Vault</span>
                  </Link>
                </div>
              </div>

              {/* Card 3: Telegram Concierge Bot Integration */}
              <div className="settings-section-card">
                <div className="settings-section-header">
                  <div className="settings-icon-badge">
                    <Bot size={18} color="var(--accent-gold)" />
                  </div>
                  <div>
                    <h3 className="settings-section-title">Telegram Concierge (@StayWU_bot)</h3>
                    <p className="settings-section-subtitle">
                      24/7 AI-guided itinerary, hotel fraud checks, and weather alerts.
                    </p>
                  </div>
                </div>

                <div className="telegram-sync-box">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="telegram-bot-avatar">🤖</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'white' }}>@StayWU_bot</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Connected to StayWU Concierge Engine</div>
                    </div>
                  </div>

                  <a
                    href={`https://t.me/${botUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vault-action-btn secondary"
                    style={{ textDecoration: 'none' }}
                  >
                    <span>Open in Telegram</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>

              {/* Card 4: Session & Sign Out */}
              <div className="settings-section-card">
                <div className="settings-section-header">
                  <div className="settings-icon-badge" style={{ background: 'rgba(244, 63, 94, 0.12)', color: '#fb7185' }}>
                    <LogOut size={18} color="#fb7185" />
                  </div>
                  <div>
                    <h3 className="settings-section-title">Session Management</h3>
                    <p className="settings-section-subtitle">
                      Terminate current session or switch traveler accounts.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'white' }}>Sign Out of this Device</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Clears session token and locks Document Vault.</div>
                  </div>

                  {user ? (
                    <button className="vault-btn-primary" onClick={logout} style={{ background: '#f43f5e', borderColor: '#f43f5e' }}>
                      <LogOut size={15} />
                      <span>Sign Out</span>
                    </button>
                  ) : (
                    <button
                      className="vault-btn-primary"
                      onClick={() => {
                        setAuthModalConfig({
                          title: 'Sign In to StayWU',
                          subtitle: 'Connect your Firebase account to view your travel history.',
                          initialTab: 'signin',
                        });
                        setAuthModalOpen(true);
                      }}
                    >
                      <span>Sign In</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Firebase Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialTab={authModalConfig.initialTab}
        title={authModalConfig.title}
        subtitle={authModalConfig.subtitle}
      />
    </div>
  );
}
