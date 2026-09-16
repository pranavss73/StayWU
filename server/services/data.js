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
    
    // In-memory bookings store
    this.bookings = new Map();
    
    console.log(`DataService loaded: ${this.hotels.length} hotels, ${this.places.length} places`);
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
    return booking;
  }

  // Get booking
  getBooking(bookingId) {
    return this.bookings.get(bookingId);
  }

  // Update booking with preferences/itinerary
  updateBooking(bookingId, updates) {
    const booking = this.bookings.get(bookingId);
    if (!booking) return null;
    Object.assign(booking, updates);
    this.bookings.set(bookingId, booking);
    return booking;
  }
}

module.exports = DataService;
