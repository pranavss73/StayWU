const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');

class LLMService {
  constructor(apiKey, backupApiKey = null) {
    // Array of available keys for automatic failover
    this.apiKeys = [apiKey, backupApiKey].filter(k => k && k.trim().length > 0 && !k.startsWith('your_'));
    this.currentKeyIndex = 0;

    // Prioritized model cascade: fast modern flash models
    this.models = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];

    // In-memory query cache: hash -> { text, timestamp } (1 hour TTL)
    this.cache = new Map();
    this.maxCacheSize = 200;
    this.cacheTTL = 60 * 60 * 1000; // 1 hour in ms

    console.log(`🧠 LLMService initialized with ${this.apiKeys.length} API key(s). Models: ${this.models.join(', ')}`);
  }

  // Generate deterministic cache key from input
  getCacheKey(prefix, data) {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);
    const hash = crypto.createHash('sha256').update(serialized).digest('hex').substring(0, 16);
    return `${prefix}:${hash}`;
  }

  // Get from cache if valid
  getFromCache(key) {
    if (!this.cache.has(key)) return null;
    const entry = this.cache.get(key);
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.text;
  }

  // Save to cache with LRU eviction
  saveToCache(key, text) {
    if (!text || text.trim().length === 0) return;
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest key
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { text, timestamp: Date.now() });
  }

  // Get active GoogleGenerativeAI client
  getClient(keyIndex) {
    const key = this.apiKeys[keyIndex % this.apiKeys.length];
    return new GoogleGenerativeAI(key);
  }

  // Resilient multi-key, multi-model execution with automatic failover & caching
  async generateWithFallback(requestOptions, cacheKey = null, maxRetries = 1) {
    // 1. Check in-memory cache first
    if (cacheKey) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log(`⚡ [LLMService] Cache hit for ${cacheKey.split(':')[0]}`);
        return cached;
      }
    }

    let lastError = null;
    const numKeys = Math.max(1, this.apiKeys.length);

    // Try keys sequentially, starting with current active key
    for (let keyOffset = 0; keyOffset < numKeys; keyOffset++) {
      const keyIdx = (this.currentKeyIndex + keyOffset) % numKeys;
      const genAI = this.getClient(keyIdx);
      const isBackupKey = keyIdx > 0;

      for (const modelName of this.models) {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(requestOptions);
            const text = result?.response?.text();

            if (text && text.trim().length > 0) {
              // Update current key index to the working key
              this.currentKeyIndex = keyIdx;
              if (cacheKey) {
                this.saveToCache(cacheKey, text);
              }
              return text;
            }
          } catch (err) {
            lastError = err;
            const errMsg = err.message || '';
            const isQuotaError = errMsg.includes('429') || errMsg.includes('QuotaExceeded') || errMsg.includes('ResourceExhausted');

            console.warn(
              `[LLMService] Key ${keyIdx + 1}/${numKeys} (${modelName}, attempt ${attempt + 1}) warning: ${errMsg.split('\n')[0]}`
            );

            // If quota error and we have another key, immediately switch keys without retrying this key
            if (isQuotaError && numKeys > 1 && keyOffset < numKeys - 1) {
              console.warn(`🔄 [LLMService] Quota hit on Key ${keyIdx + 1}. Auto-failing over to Alternate Key...`);
              break; // Break model loop to advance to next key
            }

            // Brief backoff before retry
            await new Promise(r => setTimeout(r, 250));
          }
        }
      }
    }

    throw lastError || new Error('All generative AI models and API keys failed');
  }

  // Web chatbot — pre-booking trust advisor
  async chatPreBooking(userMessage, hotelContext = [], conversationHistory = []) {
    const cacheKey = this.getCacheKey('prebooking', { userMessage: userMessage.toLowerCase().trim(), hotelCount: hotelContext.length });

    const systemPrompt = `You are StayWU's Trust Advisor — an authoritative AI hotel verification specialist helping travelers find safe, verified, and trustworthy accommodations across Goa, India.

YOUR CORE SPECIALIZATION:
You specialize in HOTELS, ACCOMMODATIONS, STAY SAFETY, TRUST SCORES, AND SCAM PREVENTION in Goa. Always keep your advice focused on stays and lodging.

STAYWU VERIFICATION & TRUST ARCHITECTURE:
1. Host Identity & Legal Audit:
   - StayWU verifies every host with government-issued IDs (Aadhaar / Passport) and municipal hospitality trade licenses / property deeds before listing.
   - Ghost listings, unverified sublets, and fake beachfront villa profiles are immediately blocked and purged.
2. Price & Rate Anomaly Auditing:
   - Proprietary algorithms cross-examine nightly rates against historical seasonal market averages across 43 Goa micro-locations to detect bait-and-switch pricing.
3. Review Authenticity & Scam Signal NLP:
   - Natural Language Processing scans review patterns for bot spam, duplicated photos, and sudden management changes. Properties with zero reviews or suspicious activity receive cautionary risk flags.
4. Trust Index (0-100 Scoring):
   - 85-100 (TRUSTED): Government verified, zero price tampering, 4.0+ rating, transparent amenities.
   - 70-84 (VERIFIED): Verified host, authentic reviews, good standing.
   - 50-69 (CAUTION): Newer listing or mixed reviews requiring extra attention.
   - <50 (RISKY): High scam indicators, unverified host.

HOW TO RESPOND:
- When asked how StayWU verifies local host IDs or properties: Provide a clear, confident explanation of our 4-pillar verification architecture above.
- When asked for hotel recommendations, locations, or amenities: Recommend 2-3 top matching hotels from the verified dataset below using the structured card format.
- When asked about areas (Candolim vs Baga vs Palolem): Explain the accommodation style, safety, and price baseline of stays in that area.
- When greeted with 'hi' or 'hello': Give a warm, brief 2-sentence greeting focused on helping them discover or verify their Goa stay.
- If asked how to book: Remind them to click "View Details & Book" on any hotel card to reserve with verified protection and unlock their personal Telegram Trip Concierge (@StayWU_bot).
- Always maintain focus on accommodations, hotels, and safe stays in Goa. Do not drift into unrelated topics.

Formatting Guidelines for Hotel Recommendations:
### 🏨 [Hotel Name]
- 📍 **Location:** [Area, Landmark]
- 🛡️ **Trust Score:** [Score]/100 ([Trusted / Verified / Caution / Risky])
- 💰 **Price:** ₹[Price]/night
- 🌴 **Vibe:** [1-sentence neighborhood atmosphere]
- ✨ **Key Amenities:** [Top 3-4 amenities]

Available Verified Goa Hotel Data (from StayWU catalog):
${JSON.stringify(hotelContext.slice(0, 12), null, 2)}`;

    const contents = [];
    for (const msg of conversationHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }
    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    try {
      return await this.generateWithFallback({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 1200,
        }
      }, conversationHistory.length === 0 ? cacheKey : null);
    } catch (error) {
      console.error('LLM error (pre-booking):', error.message);
      // Fallback assistance
      return `Welcome to StayWU! 🌴 I am your verified stay advisor for Goa. Every hotel on our platform undergoes government host audits and pricing anomaly checks. Click "View Details & Book" on any hotel card to explore verified stays and unlock your personal Telegram Trip Concierge (@StayWU_bot)!`;
    }
  }

  // Telegram bot — trip planner
  async generateItinerary(bookingDetails, userPreferences, placesData, weatherData = null) {
    let numDays = 3;
    try {
      if (bookingDetails.checkIn && bookingDetails.checkOut) {
        const d1 = new Date(bookingDetails.checkIn);
        const d2 = new Date(bookingDetails.checkOut);
        const diffTime = Math.abs(d2 - d1);
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        numDays = Math.min(14, Math.max(1, diffDays + 1));
      }
    } catch {
      numDays = 3;
    }

    const hotelDetails = bookingDetails.hotelDetails || {};
    const hotelName = bookingDetails.hotelName || 'Your Hotel';
    const hotelLocation = bookingDetails.location || 'Goa';
    const hotelArea = bookingDetails.area || '';
    const hotelAmenities = hotelDetails.amenities?.join(', ') || 'Standard amenities';
    const hotelVibe = hotelDetails.neighborhood_vibe || 'Scenic coastal atmosphere';
    const hotelLandmark = hotelDetails.landmark || 'Central location';

    const cacheKey = this.getCacheKey('itinerary', {
      hotelName,
      hotelLocation,
      numDays,
      interests: userPreferences.interests || [],
      pace: userPreferences.pace || 'moderate'
    });

    const weatherSection = weatherData?.promptSummary ? `
**Live Weather & Upcoming Forecast for ${weatherData.region || 'Goa'}:**
${weatherData.promptSummary}

**WEATHER-AWARE PLANNING RULES:**
- Adapt each day's plan according to forecasted weather conditions.
- On rainy windows, prioritize covered cultural spots, heritage churches, indoor cafes, and Latin Quarter walks.
- On clear/moderate days, optimize for beach relaxation, scenic viewpoints, open-air shacks, and water sports.
- In each day's **Travel Tip**, include a brief weather note (packing rain gear, best sun hours, wet road driving caution).
` : '';

    const prompt = `You are StayWU's Executive AI Trip Concierge — a master travel planner for Goa, India.

Create a premier, comprehensive day-by-day travel itinerary for a guest staying at a verified hotel in Goa.

**Guest Stay Profile:**
- Guest: ${bookingDetails.guestName || 'Traveler'}
- Confirmed Hotel Base: ${hotelName} (${hotelLocation}${hotelArea ? ', ' + hotelArea : ''})
- Hotel Vibe: ${hotelVibe}
- Hotel Landmark & Proximity: ${hotelLandmark}
- Hotel Amenities: ${hotelAmenities}
- Check-in: ${bookingDetails.checkIn}
- Check-out: ${bookingDetails.checkOut}
- Trip Length: Exactly ${numDays} Days (Day 1: ${bookingDetails.checkIn} to Day ${numDays}: ${bookingDetails.checkOut})
${weatherSection}
**Guest Preferences:**
- Interests: ${userPreferences.interests?.join(', ') || 'General sightseeing, beaches, culture'}
- Pace: ${userPreferences.pace || 'moderate'}
- Daily Budget Level: ${userPreferences.budget || 'moderate'}
- Special Requests: ${userPreferences.specialRequests || 'None'}

**Verified Goa Places & Attractions (from dataset):**
${JSON.stringify(placesData.slice(0, 35), null, 2)}

**STRICT HOTEL-CENTRIC PLANNING RULES:**
1. ANCHOR THE ENTIRE ITINERARY TO THEIR HOTEL (${hotelName}):
   - Day 1 begins with check-in and settling into ${hotelName}, enjoying hotel amenities (${hotelAmenities}), and local orientation around ${hotelLocation}.
   - Each morning departs directly from ${hotelName} with practical travel time and transport tips (scooter vs cab).
   - Afternoons include optional downtime to refresh or swim at ${hotelName}.
   - Evenings wrap up with return transit to ${hotelName}.
2. You MUST generate ALL ${numDays} DAYS (Day 1 through Day ${numDays}) completely. DO NOT skip or truncate any day.
3. Cluster destinations logically by geography (North Goa vs South Goa vs Central/Panjim) so travel time is minimized.
4. For every single day, provide specific time slots, authentic real Goan restaurants/shacks with signature dishes, and estimated costs.
5. Follow this exact markdown structure for EVERY day:

### Day X: [Date] — [Catchy Title]
**Focus:** [1-sentence theme or focus of the day]

**Morning:**
- 09:00 AM: [Depart ${hotelName} — Activity / Sightseeing with spot details]
- 11:30 AM: [Activity / Sightseeing with spot details]

**Afternoon:**
- 01:00 PM: Lunch at [Restaurant Name] ([Area]) — [Signature dishes & ambiance]
- 02:30 PM: [Afternoon sightseeing, culture, or beach relaxation]

**Evening:**
- 05:30 PM: [Sunset spot or scenic activity]
- 08:00 PM: Dinner at [Restaurant Name] ([Area]) — [Cuisine specialty & vibe]
- 09:30 PM: [Nightlife, live music, or night stroll back toward ${hotelName}]

**Travel Tip:** [Specific road, scooter (approx ₹400-500/day) vs taxi advice from ${hotelName}, travel time, and weather note]
**Estimated Cost:** Entry: [cost] | Transport: [cost] | Meals & Drinks: [cost] per person

---

6. After Day ${numDays}, provide:
### Total Estimated Trip Budget Breakdown
| Category | Description | Approx Cost (Per Person) |
| Transport | Scooter rental, fuel, and occasional private taxis | ₹[amount] |
| Dining & Drinks | Goan thalis, fresh seafood, cafes, and beach shacks | ₹[amount] |
| Sightseeing & Entries | Forts, churches, spice plantation tour, and river cruise | ₹[amount] |
| Activities & Nightlife | Club cover charges, water sports, and beach shacks | ₹[amount] |
| Total Estimate | Comprehensive trip cost excluding accommodation | ₹[amount] |

Begin with an engaging 2-paragraph executive welcome personalizing their stay at ${hotelName} in ${hotelLocation}, highlighting the verified stay comforts and current season weather vibe.`;

    try {
      return await this.generateWithFallback({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 16384,
        }
      }, cacheKey);
    } catch (error) {
      console.error('LLM error (itinerary):', error.message);
      // Emergency graceful itinerary fallback for zero demo interruption
      return this.generateEmergencyItinerary(bookingDetails, userPreferences, numDays, weatherData);
    }
  }

  // Emergency fallback itinerary if both Google API keys are offline
  generateEmergencyItinerary(bookingDetails, userPreferences, numDays, weatherData) {
    const hotel = bookingDetails.hotelName || 'Your Verified Stay';
    const loc = bookingDetails.location || 'Goa';
    const weatherSummary = weatherData?.current ? `Current conditions: ${weatherData.current.temp}°C, ${weatherData.current.condition}.` : 'Pleasant coastal weather.';

    return `Welcome to Goa! 🌴✨ As your StayWU AI Trip Concierge, here is your customized ${numDays}-day itinerary for your stay at **${hotel}** in ${loc}.

${weatherSummary} We've designed a balanced pace combining relaxing beachside afternoons, heritage architecture, and authentic Goan cuisine.

---

### Day 1: Arrival & Unwinding at ${hotel}
**Focus:** Check-in, settling in, and sunset beach stroll.

**Morning & Afternoon:**
- Arrive and check into **${hotel}**. Settle in and enjoy verified property amenities.
- Light afternoon walk along neighboring coastline and scenic orientation.

**Evening:**
- Sunset views at a nearby beach shack with chilled Goan beverages.
- Dinner: Authentic Goan fish curry thali with kokum sol kadhi.

**Travel Tip:** Rent a scooter (approx ₹400/day) directly near your stay for easy neighborhood exploration.

---

### Day 2: Cultural Heritage & Coastal Vistas
**Focus:** Portuguese Latin Quarter & coastal sunset.

**Morning:**
- 09:30 AM: Depart ${hotel} for historic Fontainhas Latin Quarter in Panjim.
- 11:00 AM: Visit Church of Our Lady of the Immaculate Conception.

**Afternoon:**
- 01:00 PM: Lunch at Viva Panjim or Joseph Bar (authentic Goan delicacies).
- 03:00 PM: Scenic drive along Mandovi River waterfront.

**Evening:**
- 05:30 PM: Sunset at Fort Aguada with panoramic Arabian Sea views.
- 08:30 PM: Candlelit dinner by the shore.

**Travel Tip:** Carry comfortable walking shoes for heritage cobblestone streets.

---

### Total Estimated Trip Budget Breakdown
| Category | Description | Approx Cost (Per Person) |
| Transport | Scooter rental, fuel, and local taxis | ₹1,500 |
| Dining & Drinks | Beach shacks, Goan thalis, and cafes | ₹3,200 |
| Sightseeing & Entries | Fort entries and monument preservation fees | ₹600 |
| Activities | Beach lounger rentals and evening music | ₹1,200 |
| **Total Estimate** | **Comprehensive trip budget** | **₹6,500** |`;
  }

  // Telegram bot — conversational Q&A
  async chatTripAssistant(userMessage, tripContext, placesData, conversationHistory = [], weatherData = null, relevantHotels = []) {
    const cacheKey = this.getCacheKey('chat', {
      msg: userMessage.toLowerCase().trim(),
      hotel: tripContext.hotelName || '',
      loc: tripContext.location || ''
    });

    const weatherInfo = weatherData?.current ? `
**Live Goa Weather:**
- Temperature: ${weatherData.current.temp}°C (Feels like ${weatherData.current.feelsLike}°C)
- Condition: ${weatherData.current.condition}
- Humidity: ${weatherData.current.humidity}% | Wind: ${weatherData.current.windSpeed} km/h
- Advisory: ${weatherData.advisory || 'Great coastal weather'}
` : '';

    const hotel = tripContext.hotelDetails;
    const hotelSection = hotel ? `
**Guest's Booked Stay (StayWU Verified):**
- Property Name: ${hotel.name}
- Location: ${hotel.location}${hotel.area ? ' (' + hotel.area + ')' : ''}
- Landmark / Proximity: ${hotel.landmark || 'Central location'}
- Trust Score: ${hotel.trust_score}/100 (${hotel.trust_badge || 'VERIFIED'})
- Verification Status: Government ID verified host, zero price tampering, audited listing
- Nightly Rate: ₹${hotel.price}
- Verified Amenities: ${hotel.amenities?.join(', ') || 'Standard amenities'}
- Neighborhood Vibe: ${hotel.neighborhood_vibe || 'Scenic Goan coastal ambiance'}
- Dates of Stay: ${tripContext.checkIn || 'Current trip'} to ${tripContext.checkOut || 'Checkout'}
` : `
**Guest Trip Context:**
- Base: ${tripContext.hotelName || 'Goa traveler'} (${tripContext.location || 'Goa'})
`;

    const systemPrompt = `You are StayWU's Executive Hotel & Trip Concierge — a premier AI assistant for accommodations, stay verification, and personalized travel in Goa, India.

YOUR PRIMARY MISSION:
Provide hotel-grounded, stay-focused, and practical travel concierge support. Everything revolves around ensuring the guest has a safe, comfortable, and verified stay experience.

${hotelSection}
${weatherInfo}
**StayWU Verified Hotels Catalog (for comparisons, recommendations, or upgrades):**
${JSON.stringify((relevantHotels || []).slice(0, 6), null, 2)}

**Top Verified Goa Sights & Spots:**
${JSON.stringify((placesData || []).slice(0, 15), null, 2)}

YOUR GUIDELINES:
1. Hotel & Accommodation Inquiries:
   - If the guest asks about their hotel (amenities, pool, WiFi, check-in, location, safety, trust score): Answer authoritatively using the Guest's Booked Stay details above.
   - If the guest asks for hotel recommendations, alternatives, budget stays, or luxury villas: Recommend 2-3 verified properties from the StayWU catalog above with prices, locations, and trust scores.
2. Stay-Centric Activity & Dining Recommendations:
   - When answering questions about beaches, dining, or nightlife, ALWAYS anchor suggestions to their hotel location (e.g., "From your stay at ${hotel ? hotel.name : 'your hotel'}, it is only a 5-10 minute scooter ride to...").
   - Offer practical transport tips starting from their hotel.
3. Stay Verification & Safety:
   - If asked about stay safety, host verification, or avoiding scams in Goa, explain StayWU's government ID host audits, pricing anomaly detection, and zero-fake-listing policy.
4. Weather & Real-Time Intelligence:
   - If asked about current weather or whether to visit an outdoor attraction today, answer using the live weather data above.
5. Tone & Formatting:
   - Friendly, professional, concise concierge tone.
   - Use clean bullet points and emojis. Keep answers easily readable on mobile.
   - Emergency contacts if needed: Police: 100, Ambulance: 108, Tourist Helpline: 1800-22-7838.`;

    const contents = [];
    for (const msg of conversationHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }
    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    try {
      return await this.generateWithFallback({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 1200,
        }
      }, conversationHistory.length === 0 ? cacheKey : null);
    } catch (error) {
      console.error('LLM error (trip assistant):', error.message);
      return `🌴 I am here to assist you with your stay in Goa! Whether you need local restaurant recommendations, transport guidance from ${hotel?.name || 'your stay'}, or details about verified hotel amenities, feel free to ask!`;
    }
  }

  // Generate neighborhood vibe summary
  async generateVibeSummary(hotelName, location, landmark, amenities) {
    const prompt = `Generate a one-line neighborhood vibe summary (max 15 words) for a hotel:
Hotel: ${hotelName}
Location: ${location}, Goa
Landmark: ${landmark || 'N/A'}
Amenities: ${amenities?.join(', ') || 'N/A'}

Example outputs:
- "Quiet, 5 min walk to Baga beach, mostly families, great sunset views"
- "Party hub, steps from Tito's Lane, buzzing nightlife, beach shacks nearby"
- "Serene South Goa retreat, luxury vibes, pristine Palolem beach access"

Just output the vibe summary, nothing else.`;

    try {
      const text = await this.generateWithFallback({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 100,
        }
      });
      return text.trim().replace(/"/g, '');
    } catch (error) {
      return `${location}, Goa — scenic coastal destination`;
    }
  }
}

module.exports = LLMService;
