import { NextResponse } from 'next/server';
import { dataService } from '@/lib/dataService';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { message, history = [] } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const hotelContext = dataService.getHotelsForContext(message, 15);
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
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
        for (const msg of history) {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          });
        }
        contents.push({
          role: 'user',
          parts: [{ text: message }]
        });

        // Use Google Gemini API
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024,
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            return NextResponse.json({ reply });
          }
        }
      } catch (err) {
        console.warn('Gemini API fetch error, falling back to local advisor:', err.message);
      }
    }

    // Fallback recommendation engine when no API key or on transient network issue
    const topHotels = hotelContext.slice(0, 3);
    const recommendations = topHotels.map(h => 
      `### 🏨 ${h.name}\n` +
      `- 📍 **Location:** ${h.location} (${h.vibe || 'Prime coastal area'})\n` +
      `- 🛡️ **Trust Score:** ${h.trust_score}/100 (${h.trust_badge.toUpperCase()})\n` +
      `- 💰 **Price:** ₹${h.price}/night\n` +
      `- ✨ **Amenities:** ${h.amenities || 'WiFi, Pool, AC'}\n` +
      `- 💡 **Local Tip:** ${h.landmark ? `Walking distance to ${h.landmark}.` : 'Great central spot for beach access and local food.'}`
    ).join('\n\n');

    const reply = `Here are verified recommendations based on your request:\n\n${recommendations}\n\n💡 *Tip: Click on any hotel card to view full sentiment analytics and reserve with instant Telegram Trip Concierge sync!*`;

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({
      reply: "I'm having trouble connecting right now. Please try again in a moment! 🙏"
    });
  }
}
