const { GoogleGenerativeAI } = require('@google/generative-ai');

class LLMService {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  }

  // Web chatbot — pre-booking trust advisor
  async chatPreBooking(userMessage, hotelContext, conversationHistory = []) {
    const systemPrompt = `You are StayWU's Trust Advisor — an AI assistant helping travelers find safe, trustworthy, and verified hotels in Goa, India.

Your role:
- Help users find the best hotels based on their needs (budget, location, amenities, vibe)
- Explain trust scores, verification status, and scam risks
- Highlight neighborhood vibes and practical local insights
- Be engaging, knowledgeable, and concise

Formatting Guidelines:
When recommending hotels, format each one clearly like this:

### 🏨 [Hotel Name]
- 📍 **Location:** [Area, Landmark]
- 🛡️ **Trust Score:** [Score]/100 ([Trusted / Verified / Caution / Risky])
- 💰 **Price:** ₹[Price]/night
- 🌴 **Vibe:** [1-sentence neighborhood atmosphere]
- ✨ **Key Amenities:** [Top 3-4 amenities]

Use bullet points for easy scanning. Include a 💡 **Local Tip** where helpful.
If users ask about booking, remind them they can click "View Details & Book" on the card to book directly and unlock their personalized Telegram Trip Concierge (@StayWU_bot).

Available hotel data (top matches):
${JSON.stringify(hotelContext, null, 2)}`;

    const contents = [];
    
    // Add conversation history
    for (const msg of conversationHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }
    
    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    try {
      const result = await this.model.generateContent({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      });

      return result.response.text();
    } catch (error) {
      console.error('LLM error (pre-booking):', error.message);
      throw error;
    }
  }

  // Telegram bot — trip planner
  async generateItinerary(bookingDetails, userPreferences, placesData, weatherData = null) {
    // Calculate exact number of days from check-in and check-out
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

    const weatherSection = weatherData?.promptSummary ? `
**Live Weather & Upcoming Forecast for ${weatherData.region || 'Goa'}:**
${weatherData.promptSummary}

**WEATHER-AWARE PLANNING RULES:**
- Adapt each day's plan according to the forecasted weather conditions.
- On days with high rain probability (>=50%), suggest morning sightseeing or beach visits when rain chances are lower, and schedule indoor/covered cultural attractions (e.g. churches, forts with covered pavilions, spice plantations with thatched dining, indoor cafes, Latin Quarter walks) during peak rain hours.
- On clear or moderate days, optimize for beach relaxation, scenic viewpoints, open-air shacks, and water sports.
- In each day's **Travel Tip**, explicitly include a brief, helpful weather note (e.g., packing an umbrella/rain jacket, best sun/swim hours, or road caution for scooter driving during wet spells).
` : '';

    const prompt = `You are StayWU's Executive AI Trip Concierge — a master travel planner for Goa, India.

Create a premier, comprehensive day-by-day travel itinerary for a guest staying in Goa.

**Booking Profile:**
- Guest: ${bookingDetails.guestName || 'Traveler'}
- Hotel / Base: ${bookingDetails.hotelName} (${bookingDetails.location}${bookingDetails.area ? ', ' + bookingDetails.area : ''})
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

**STRICT GENERATION RULES:**
1. You MUST generate ALL ${numDays} DAYS (Day 1 through Day ${numDays}) completely. DO NOT skip or truncate any day.
2. Cluster destinations logically by geography (South Goa vs Central/Panjim vs North Goa) so the traveler does not waste hours crisscrossing Goa.
3. For every single day, provide specific time slots, authentic real Goan restaurants/shacks with signature dishes, actionable travel advice (scooter vs cab rates), and estimated costs.
4. Follow this exact markdown structure for EVERY day:

### Day X: [Date] — [Catchy Title]
**Focus:** [1-sentence theme or focus of the day]

**Morning:**
- 09:00 AM: [Activity / Sightseeing with spot details]
- 11:30 AM: [Activity / Sightseeing with spot details]

**Afternoon:**
- 01:00 PM: Lunch at [Restaurant Name] ([Area]) — [Signature dishes & ambiance]
- 02:30 PM: [Afternoon sightseeing, culture, or beach relaxation]

**Evening:**
- 05:30 PM: [Sunset spot or scenic activity]
- 08:00 PM: Dinner at [Restaurant Name] ([Area]) — [Cuisine specialty & vibe]
- 09:30 PM: [Nightlife, live music, or night market/stroll (if applicable)]

**Travel Tip:** [Specific road, scooter (approx ₹400-500/day) vs taxi advice, travel time, and weather note]
**Estimated Cost:** Entry: [cost] | Transport: [cost] | Meals & Drinks: [cost] per person

---

5. After Day ${numDays}, provide:
### Total Estimated Trip Budget Breakdown
| Category | Description | Approx Cost (Per Person) |
| Transport | Scooter rental, fuel, and occasional private taxis | ₹[amount] |
| Dining & Drinks | Goan thalis, fresh seafood, cafes, and beach shacks | ₹[amount] |
| Sightseeing & Entries | Forts, churches, spice plantation tour, and river cruise | ₹[amount] |
| Activities & Nightlife | Club cover charges, water sports, and beach shacks | ₹[amount] |
| Total Estimate | Comprehensive trip cost excluding accommodation | ₹[amount] |

Begin with an engaging 2-paragraph executive welcome personalizing their stay at ${bookingDetails.hotelName} and mentioning the current season and weather vibe.`;

    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 16384,
        }
      });

      return result.response.text();
    } catch (error) {
      console.error('LLM error (itinerary):', error.message);
      throw error;
    }
  }

  // Telegram bot — conversational Q&A
  async chatTripAssistant(userMessage, tripContext, placesData, conversationHistory = [], weatherData = null) {
    const weatherInfo = weatherData?.current ? `
**Live Goa Weather:**
- Temperature: ${weatherData.current.temp}°C (Feels like ${weatherData.current.feelsLike}°C)
- Condition: ${weatherData.current.condition}
- Humidity: ${weatherData.current.humidity}% | Wind: ${weatherData.current.windSpeed} km/h
- Advisory: ${weatherData.advisory || 'Great coastal weather'}
` : '';

    const systemPrompt = `You are StayWU's Trip Concierge — a personal AI travel assistant for a guest staying in Goa, India.

**Trip Context:**
- Hotel: ${tripContext.hotelName}
- Location: ${tripContext.location}
- Dates: ${tripContext.checkIn} to ${tripContext.checkOut}
${weatherInfo}
**Available Places & Activities:**
${JSON.stringify(placesData.slice(0, 20), null, 2)}

Your role:
- Answer questions about local restaurants, activities, beaches, nightlife
- Give practical travel advice (transport, costs, timing)
- Suggest alternatives based on weather or preferences
- If asked about the current weather or whether to visit a beach/attraction today, answer using the live weather data above!
- Be friendly, concise, and helpful like a local friend
- Use emoji for visual appeal
- If asked about emergencies, provide: Police: 100, Ambulance: 108, Tourist Helpline: 1800-22-7838

Keep responses short and actionable — this is a chat interface.`;

    const contents = [];
    for (const msg of conversationHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }
    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    try {
      const result = await this.model.generateContent({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      });

      return result.response.text();
    } catch (error) {
      console.error('LLM error (trip assistant):', error.message);
      throw error;
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
      const result = await this.model.generateContent(prompt);
      return result.response.text().trim().replace(/"/g, '');
    } catch (error) {
      return `${location}, Goa — scenic coastal destination`;
    }
  }
}

module.exports = LLMService;
