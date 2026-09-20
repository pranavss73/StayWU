const fs = require('fs');
const path = require('path');

class DataService {
  constructor() {
    const dataDir = path.join(__dirname, '..', '..', 'data');
    
    this.hotels = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'hotels.json'), 'utf-8')
    );
    
    this.places = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'places.json'), 'utf-8')
    );
    
    this.hotelsSummary = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'hotels-summary.json'), 'utf-8')
    );
    
    // In-memory & file-backed bookings store
    this.bookingsFilePath = path.join(__dirname, '..', 'data', 'bookings.json');
    this.bookings = new Map();
    this.loadBookings();
    
    console.log(`DataService loaded: ${this.hotels.length} hotels, ${this.places.length} places, ${this.bookings.size} bookings`);
  }

  loadBookings() {
    try {
      if (fs.existsSync(this.bookingsFilePath)) {
        const raw = fs.readFileSync(this.bookingsFilePath, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach(b => this.bookings.set(b.id, b));
        }
      }
    } catch (err) {
      console.warn('Failed to load bookings from disk:', err.message);
    }

    // If empty, seed realistic default bookings for hackathon demo
    if (this.bookings.size === 0) {
      this.seedInitialBookings();
    }
  }

  saveBookings() {
    try {
      const dataDir = path.dirname(this.bookingsFilePath);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const list = Array.from(this.bookings.values());
      fs.writeFileSync(this.bookingsFilePath, JSON.stringify(list, null, 2));
    } catch (err) {
      console.warn('Failed to save bookings to disk:', err.message);
    }
  }

  seedInitialBookings() {
    const hotel1 = this.hotels.find(h => h.name?.toLowerCase().includes('taj') || h.trust_score >= 95) || this.hotels[0];
    const hotel2 = this.hotels.find(h => h.name?.toLowerCase().includes('w goa') || h.trust_score >= 90) || this.hotels[1];

    if (hotel1) {
      const b1 = {
        id: 'BK-GOA-' + Math.floor(1000 + Math.random() * 9000),
        userId: 'traveler_default',
        hotelId: hotel1.id,
        hotelName: hotel1.name,
        location: hotel1.location,
        area: hotel1.area || 'North Goa',
        price: hotel1.price || 8500,
        price_display: hotel1.price_display || '₹8,500',
        trust_score: hotel1.trust_score || 96,
        trust_badge: hotel1.trust_badge || 'trusted',
        guestName: 'Pranav',
        guestEmail: 'pranav@staywu.com',
        phoneNumber: '+91 98765 43210',
        checkIn: '2026-09-22',
        checkOut: '2026-09-26',
        createdAt: '2026-09-20T10:30:00.000Z',
        status: 'confirmed',
        itinerary: 'North Goa Sunset & Heritage Tour',
        preferences: { interests: ['Beaches', 'Nightlife', 'Seafood'], pace: 'balanced' },
      };
      this.bookings.set(b1.id, b1);
    }

    if (hotel2) {
      const b2 = {
        id: 'BK-GOA-' + Math.floor(1000 + Math.random() * 9000),
        userId: 'traveler_default',
        hotelId: hotel2.id,
        hotelName: hotel2.name,
        location: hotel2.location,
        area: hotel2.area || 'Vagator',
        price: hotel2.price || 14000,
        price_display: hotel2.price_display || '₹14,000',
        trust_score: hotel2.trust_score || 94,
        trust_badge: hotel2.trust_badge || 'verified',
        guestName: 'Pranav',
        guestEmail: 'pranav@staywu.com',
        phoneNumber: '+91 98765 43210',
        checkIn: '2026-08-14',
        checkOut: '2026-08-18',
        createdAt: '2026-08-10T14:15:00.000Z',
        status: 'completed',
        itinerary: 'Monsoon Coastline & Shack Crawl',
        preferences: { interests: ['Water Sports', 'Sunset Points'], pace: 'relaxed' },
      };
      this.bookings.set(b2.id, b2);
    }

    this.saveBookings();
  }

  // Search hotels with filters
  searchHotels({ query, location, minPrice, maxPrice, minRating, trustBadge, sortBy, page = 1, limit = 12 }) {
    let results = [...this.hotels];

    // Text search
    if (query) {
      const q = query.toLowerCase();
      results = results.filter(h =>
        h.name.toLowerCase().includes(q) ||
        h.location.toLowerCase().includes(q) ||
        h.area.toLowerCase().includes(q) ||
        (h.landmark && h.landmark.toLowerCase().includes(q)) ||
        h.amenities.some(a => a.toLowerCase().includes(q)) ||
        h.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    // Location filter
    if (location) {
      const loc = location.toLowerCase();
      results = results.filter(h =>
        h.location.toLowerCase().includes(loc) ||
        h.area.toLowerCase().includes(loc)
      );
    }

    // Price filters
    if (minPrice) results = results.filter(h => h.price >= minPrice);
    if (maxPrice) results = results.filter(h => h.price <= maxPrice);

    // Rating filter
    if (minRating) results = results.filter(h => h.rating >= minRating);

    // Trust badge filter
    if (trustBadge) results = results.filter(h => h.trust_badge === trustBadge);

    // Sort
    switch (sortBy) {
      case 'price_low':
        results.sort((a, b) => (a.price || 99999) - (b.price || 99999));
        break;
      case 'price_high':
        results.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'rating':
        results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'trust':
        results.sort((a, b) => b.trust_score - a.trust_score);
        break;
      default:
        // Default: sort by trust score then rating
        results.sort((a, b) => {
          if (b.trust_score !== a.trust_score) return b.trust_score - a.trust_score;
          return (b.rating || 0) - (a.rating || 0);
        });
    }

    const total = results.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginatedResults = results.slice(start, start + limit);

    return {
      hotels: paginatedResults,
      pagination: { page, limit, total, totalPages }
    };
  }

  // Get single hotel by ID
  getHotel(id) {
    return this.hotels.find(h => h.id === parseInt(id));
  }

  // Get hotels for LLM context (relevant to a query)
  getHotelsForContext(query, limit = 15) {
    if (!query) return this.hotelsSummary.slice(0, limit);
    
    const q = query.toLowerCase();
    const relevant = this.hotels
      .filter(h =>
        h.name.toLowerCase().includes(q) ||
        h.location.toLowerCase().includes(q) ||
        h.area.toLowerCase().includes(q) ||
        (h.landmark && h.landmark.toLowerCase().includes(q)) ||
        h.amenities.some(a => a.toLowerCase().includes(q))
      )
      .slice(0, limit)
      .map(h => ({
        id: h.id,
        name: h.name,
        location: h.location,
        rating: h.rating,
        price: h.price,
        price_display: h.price_display,
        trust_score: h.trust_score,
        trust_badge: h.trust_badge,
        amenities: h.amenities.join(', '),
        tags: h.tags.join(', '),
        vibe: h.neighborhood_vibe,
        landmark: h.landmark,
        scam_flags: h.scam_flags,
      }));

    if (relevant.length < 5) {
      // Pad with top-rated hotels
      const topRated = this.hotels
        .filter(h => !relevant.find(r => r.id === h.id))
        .sort((a, b) => b.trust_score - a.trust_score)
        .slice(0, limit - relevant.length)
        .map(h => ({
          id: h.id, name: h.name, location: h.location,
          rating: h.rating, price: h.price, price_display: h.price_display,
          trust_score: h.trust_score, trust_badge: h.trust_badge,
          amenities: h.amenities.join(', '), tags: h.tags.join(', '),
          vibe: h.neighborhood_vibe, landmark: h.landmark, scam_flags: h.scam_flags,
        }));
      return [...relevant, ...topRated];
    }
    
    return relevant;
  }

  // Get all places
  getPlaces() {
    return this.places;
  }

  // Get locations list (unique)
  getLocations() {
    const locs = new Map();
    for (const h of this.hotels) {
      const key = h.location;
      if (!locs.has(key)) {
        locs.set(key, { name: key, area: h.area, count: 0 });
      }
      locs.get(key).count++;
    }
    return Array.from(locs.values()).sort((a, b) => b.count - a.count);
  }

  // Create a booking
  createBooking(hotelId, guestName, guestEmail, checkIn, checkOut, phoneNumber, userId = null) {
    const hotel = this.getHotel(hotelId);
    if (!hotel) return null;

    const bookingId = 'BK' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
    
    const booking = {
      id: bookingId,
      userId: userId || null,
      hotelId: hotel.id,
      hotelName: hotel.name,
      location: hotel.location,
      area: hotel.area,
      price: hotel.price,
      guestName,
      guestEmail,
      phoneNumber,
      checkIn,
      checkOut,
      createdAt: new Date().toISOString(),
      status: 'confirmed',
      itinerary: null,
      preferences: null,
    };

    this.bookings.set(bookingId, booking);
    this.saveBookings();
    return booking;
  }

  // Get booking
  getBooking(bookingId) {
    return this.bookings.get(bookingId);
  }

  // Get user bookings
  getUserBookings(userId = null, email = null) {
    const all = Array.from(this.bookings.values());
    if (!userId && !email) {
      return all.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    const filtered = all.filter(b => {
      if (userId && b.userId === userId) return true;
      if (email && b.guestEmail && b.guestEmail.toLowerCase() === email.toLowerCase()) return true;
      if ((!userId || userId === 'traveler_default') && (!b.userId || b.userId === 'traveler_default')) return true;
      return false;
    });

    if (filtered.length === 0) {
      // Return sample demo bookings so UI displays rich data for presentation
      return all.slice(0, 3);
    }

    return filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  // Update booking with preferences/itinerary
  updateBooking(bookingId, updates) {
    const booking = this.bookings.get(bookingId);
    if (!booking) return null;
    Object.assign(booking, updates);
    this.bookings.set(bookingId, booking);
    this.saveBookings();
    return booking;
  }
}

module.exports = DataService;
