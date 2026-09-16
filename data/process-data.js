const fs = require('fs');
const path = require('path');

// Simple CSV parser that handles quoted fields
function parseCSV(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === '\n' && !inQuotes) {
      if (current.trim()) lines.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current.trim());
  
  if (lines.length === 0) return [];
  
  // Parse header
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx] || '';
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// Parse price string like "₹6,192 per night" or "?6,192 per night"
function parsePrice(priceStr) {
  if (!priceStr || priceStr === 'null') return null;
  // Remove currency symbols, "per night", commas
  const cleaned = priceStr.replace(/[₹?,\s]/g, '').replace(/pernight/gi, '').trim();
  const num = parseInt(cleaned);
  return isNaN(num) ? null : num;
}

// Parse amenities from string like "['Gym', 'Swimming Pool']"
function parseAmenities(infoStr) {
  if (!infoStr || infoStr === 'null') return [];
  try {
    // Replace single quotes with double quotes for JSON parsing
    const jsonStr = infoStr.replace(/'/g, '"');
    return JSON.parse(jsonStr);
  } catch {
    // Fallback: extract words between quotes
    const matches = infoStr.match(/['"]([^'"]+)['"]/g);
    return matches ? matches.map(m => m.replace(/['"]/g, '')) : [];
  }
}

// Parse tags - they come concatenated like "CoupleFriendlyFreeCancellationBreakfastIncluded"
function parseTags(tagStr) {
  if (!tagStr || tagStr === 'null') return [];
  // Split camelCase-like concatenated tags
  const tags = [];
  const knownTags = [
    'Couple Friendly', 'Free Cancellation', 'Breakfast Included',
    'Breakfast available at extra charges', 'Pet Friendly',
    'Local ID accepted', 'Unmarried couples allowed'
  ];
  
  let remaining = tagStr;
  for (const tag of knownTags) {
    const compressed = tag.replace(/\s+/g, '');
    if (remaining.includes(compressed)) {
      tags.push(tag);
      remaining = remaining.replace(compressed, '');
    }
  }
  
  // If nothing matched, just return the raw string cleaned up
  if (tags.length === 0 && tagStr !== 'null') {
    // Try splitting by capital letters
    const split = tagStr.replace(/([A-Z])/g, ' $1').trim().split(/\s+/);
    if (split.length > 1) {
      // Group into meaningful phrases
      tags.push(split.join(' '));
    }
  }
  
  return tags;
}

// Generate a trust score based on available data
function generateTrustScore(hotel) {
  let score = 50; // Base score
  
  // Rating contribution (0-30 points)
  if (hotel.rating) {
    score += Math.min(30, (hotel.rating / 5) * 30);
  }
  
  // Has landmark info (more transparent = +5)
  if (hotel.landmark && hotel.landmark !== 'null') {
    score += 5;
  }
  
  // Has description (+5)
  if (hotel.description && hotel.description !== 'null') {
    score += 5;
  }
  
  // Has amenities listed (+5)
  if (hotel.amenities && hotel.amenities.length > 0) {
    score += 5;
  }
  
  // Price reasonableness (not suspiciously low)
  if (hotel.price) {
    if (hotel.price < 300) score -= 15; // Suspiciously cheap
    else if (hotel.price >= 500 && hotel.price <= 25000) score += 5; // Reasonable range
  }
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

// Determine trust badge
function getTrustBadge(score) {
  if (score >= 80) return 'trusted';
  if (score >= 60) return 'verified';
  if (score >= 40) return 'caution';
  return 'risky';
}

// Location to area mapping for neighborhoods
const areaMapping = {
  'Candolim': { area: 'North Goa', vibe: 'Lively beach area, popular with tourists, great nightlife nearby' },
  'Calangute': { area: 'North Goa', vibe: 'Bustling tourist hub, busy beaches, plenty of shacks and shops' },
  'Baga': { area: 'North Goa', vibe: 'Party central, vibrant nightlife, famous for Tito\'s Lane' },
  'Anjuna': { area: 'North Goa', vibe: 'Bohemian vibes, famous flea market, trance music scene' },
  'Vagator': { area: 'North Goa', vibe: 'Scenic cliffs, Chapora Fort views, chill sunset spots' },
  'Panjim': { area: 'Central Goa', vibe: 'Capital city, colonial Portuguese architecture, cultural hub' },
  'Panaji': { area: 'Central Goa', vibe: 'Capital city, Fontainhas Latin Quarter, riverfront charm' },
  'Margao': { area: 'South Goa', vibe: 'Commercial hub, authentic Goan markets, gateway to south beaches' },
  'Benaulim': { area: 'South Goa', vibe: 'Quiet, family-friendly beach, serene and less crowded' },
  'Colva': { area: 'South Goa', vibe: 'Long white sand beach, peaceful, popular with families' },
  'Palolem': { area: 'South Goa', vibe: 'Crescent-shaped paradise, kayaking, dolphin spotting' },
  'Arpora': { area: 'North Goa', vibe: 'Saturday Night Market, close to Baga and Calangute action' },
  'Mapusa': { area: 'North Goa', vibe: 'Authentic Friday market, local Goan life, transport hub' },
  'Vasco': { area: 'Central Goa', vibe: 'Port city, near Bogmalo Beach, Mormugao Fort nearby' },
  'Tiswadi': { area: 'Central Goa', vibe: 'Old Goa churches, Mandovi River, historical heritage' },
  'South Goa': { area: 'South Goa', vibe: 'Tranquil beaches, luxury resorts, lush greenery' },
  'North Goa': { area: 'North Goa', vibe: 'Vibrant beaches, nightlife, water sports, tourist hotspot' },
  'Morjim': { area: 'North Goa', vibe: 'Turtle nesting beach, Russian influence, peaceful vibes' },
  'Ashwem': { area: 'North Goa', vibe: 'Upscale beach, boutique stays, quiet luxury' },
  'Arambol': { area: 'North Goa', vibe: 'Hippie paradise, drum circles, Sweet Water Lake' },
  'Sinquerim': { area: 'North Goa', vibe: 'Fort Aguada views, luxury resorts, calm waters' },
  'Dona Paula': { area: 'Central Goa', vibe: 'Jetty viewpoint, NIO nearby, scenic drives' },
  'Cavelossim': { area: 'South Goa', vibe: 'Pristine beach, luxury properties, Sal River backwaters' },
  'Agonda': { area: 'South Goa', vibe: 'Secluded paradise, yoga retreats, stargazing' },
};

function getAreaInfo(location) {
  if (!location || location === 'null') return { area: 'Goa', vibe: 'Beautiful coastal destination' };
  
  for (const [key, value] of Object.entries(areaMapping)) {
    if (location.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  return { area: 'Goa', vibe: 'Scenic Goan locale, worth exploring' };
}

// ============================================
// PROCESS HOTELS
// ============================================
console.log('Processing hotels dataset...');
const hotelsCSV = fs.readFileSync(path.join(__dirname, 'GoaHotels_Info.csv'), 'utf-8');
const hotelsRaw = parseCSV(hotelsCSV);

console.log(`Parsed ${hotelsRaw.length} raw hotel rows`);

const hotels = hotelsRaw.map((row, index) => {
  const price = parsePrice(row.price);
  const rating = parseFloat(row.ratings) || null;
  const amenities = parseAmenities(row.info);
  const tags = parseTags(row.tag);
  const areaInfo = getAreaInfo(row.location);
  const landmark = row.landmark && row.landmark !== 'null' ? row.landmark.replace(/^\|\s*/, '') : null;
  
  const hotel = {
    id: index + 1,
    name: row.hotel_name || 'Unknown Hotel',
    location: row.location && row.location !== 'null' ? row.location : 'Goa',
    area: areaInfo.area,
    neighborhood_vibe: areaInfo.vibe,
    landmark: landmark,
    rating: rating,
    price: price,
    price_display: price ? `₹${price.toLocaleString('en-IN')}` : 'Price on request',
    amenities: amenities,
    tags: tags,
    description: row.description && row.description !== 'null' ? row.description : null,
    accessibility: row.accessibility && row.accessibility !== 'null' ? row.accessibility : null,
    occupancy_details: row.occupancy_details && row.occupancy_details !== 'null' ? row.occupancy_details : null,
  };
  
  // Compute trust score
  hotel.trust_score = generateTrustScore(hotel);
  hotel.trust_badge = getTrustBadge(hotel.trust_score);
  
  // Generate scam flags
  hotel.scam_flags = [];
  if (price && price < 300) hotel.scam_flags.push('Suspiciously low price');
  if (!landmark) hotel.scam_flags.push('No landmark reference');
  if (!hotel.description) hotel.scam_flags.push('No detailed description');
  if (rating && rating > 4.8 && (!amenities || amenities.length === 0)) {
    hotel.scam_flags.push('High rating but no amenity details');
  }
  
  return hotel;
}).filter(h => h.name && h.name !== 'Unknown Hotel' && h.price);

console.log(`Processed ${hotels.length} valid hotels`);

// ============================================
// PROCESS TOURISM PLACES
// ============================================
console.log('Processing tourism dataset...');
const placesCSV = fs.readFileSync(path.join(__dirname, 'recommender_data.csv'), 'utf-8');
const placesRaw = parseCSV(placesCSV);

console.log(`Parsed ${placesRaw.length} raw place rows`);

const places = placesRaw.map((row, index) => {
  const title = row.title || '';
  if (!title) return null;
  
  return {
    id: index + 1,
    name: title.trim(),
    visited_from: row['Visited From:'] || null,
    distance_from_bus_terminus: row['Distance (From Kadamba Bus Terminus):'] || null,
    trip_duration: row['Trip Duration (Including Travel):'] || null,
    location: row['Place Location:'] || null,
    transport_options: row['Transportation Options:'] || null,
    travel_tips: row['Travel Tips:'] || null,
  };
}).filter(Boolean);

console.log(`Processed ${places.length} valid places`);

// ============================================
// WRITE OUTPUTS
// ============================================
fs.writeFileSync(
  path.join(__dirname, 'hotels.json'),
  JSON.stringify(hotels, null, 2),
  'utf-8'
);
console.log(`Wrote hotels.json (${hotels.length} hotels)`);

fs.writeFileSync(
  path.join(__dirname, 'places.json'),
  JSON.stringify(places, null, 2),
  'utf-8'
);
console.log(`Wrote places.json (${places.length} places)`);

// Also create a compact summary for LLM context
const hotelSummary = hotels.slice(0, 100).map(h => ({
  id: h.id,
  name: h.name,
  location: h.location,
  rating: h.rating,
  price: h.price,
  trust_score: h.trust_score,
  trust_badge: h.trust_badge,
  amenities: h.amenities.join(', '),
  tags: h.tags.join(', '),
  vibe: h.neighborhood_vibe,
}));

fs.writeFileSync(
  path.join(__dirname, 'hotels-summary.json'),
  JSON.stringify(hotelSummary, null, 2),
  'utf-8'
);
console.log(`Wrote hotels-summary.json (top 100 for LLM context)`);

console.log('Done!');
