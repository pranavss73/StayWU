const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const PDFItineraryGenerator = require('../services/pdfGenerator');
const WeatherService = require('../services/weather');

class TripBot {
  constructor(token, dataService, llmService) {
    if (!token) {
      console.log('⚠️  No Telegram bot token provided. Bot will not start.');
      this.bot = null;
      return;
    }

    this.bot = new TelegramBot(token, { polling: true });
    this.dataService = dataService;
    this.llmService = llmService;
    
    // User session storage: chatId -> { state, booking, preferences, history, itinerary }
    this.sessions = new Map();

    this.setupHandlers();
    console.log('🤖 Telegram Bot started!');
  }

  setupHandlers() {
    if (!this.bot) return;

    // /start command — entry point from booking
    this.bot.onText(/\/start\s*(.*)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const bookingId = match[1]?.trim();

      if (bookingId) {
        const booking = this.dataService.getBooking(bookingId);
        if (booking) {
          this.sessions.set(chatId, {
            state: 'onboarding_interests',
            booking,
            preferences: {},
            history: [],
            itinerary: null,
          });

          await this.bot.sendMessage(chatId,
            `🌴 *Welcome to StayWU Trip Concierge!*\n\n` +
            `I'm your personal AI travel guide for your Goa trip!\n\n` +
            `📍 *Hotel:* ${booking.hotelName}\n` +
            `📅 *Check-in:* ${booking.checkIn}\n` +
            `📅 *Check-out:* ${booking.checkOut}\n` +
            `📌 *Area:* ${booking.location}\n\n` +
            `Let me plan an amazing trip for you! First, tell me what you're interested in:`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '🏖️ Beaches', callback_data: 'interest_beaches' },
                    { text: '🎉 Nightlife', callback_data: 'interest_nightlife' },
                  ],
                  [
                    { text: '🏛️ Culture & History', callback_data: 'interest_culture' },
                    { text: '🍽️ Food & Cuisine', callback_data: 'interest_food' },
                  ],
                  [
                    { text: '🌊 Water Sports', callback_data: 'interest_watersports' },
                    { text: '🧘 Wellness & Yoga', callback_data: 'interest_wellness' },
                  ],
                  [
                    { text: '🛍️ Shopping', callback_data: 'interest_shopping' },
                    { text: '🌿 Nature & Wildlife', callback_data: 'interest_nature' },
                  ],
                  [
                    { text: '✅ Done selecting', callback_data: 'interests_done' },
                  ],
                ],
              },
            }
          );
          return;
        }
      }

      // No booking ID — general welcome
      this.sessions.set(chatId, {
        state: 'free_chat',
        booking: null,
        preferences: {},
        history: [],
        itinerary: null,
      });

      await this.bot.sendMessage(chatId,
        `🌴 *Welcome to StayWU Trip Concierge!*\n\n` +
        `I'm your AI travel guide for Goa! 🇮🇳\n\n` +
        `You can:\n` +
        `• Ask me anything about Goa\n` +
        `• Get restaurant recommendations\n` +
        `• Find the best beaches and activities\n\n` +
        `💡 *Tip:* Book a hotel on our website to get a personalized trip itinerary!\n\n` +
        `What would you like to know?`,
        { parse_mode: 'Markdown' }
      );
    });

    // Polling and general error handling
    this.bot.on('polling_error', (err) => {
      console.warn('Telegram polling warning:', err.message);
    });
    this.bot.on('error', (err) => {
      console.warn('Telegram bot error:', err.message);
    });

    // Callback queries (inline keyboard buttons)
    this.bot.on('callback_query', async (query) => {
      try {
        const chatId = query.message.chat.id;
        const data = query.data;
        const session = this.sessions.get(chatId);

        if (!session) {
          await this.bot.answerCallbackQuery(query.id, { text: 'Please start with /start' }).catch(() => {});
          return;
        }

        await this.bot.answerCallbackQuery(query.id).catch(() => {});

        // Interest selection
        if (data.startsWith('interest_')) {
          const interest = data.replace('interest_', '');
          if (!session.preferences.interests) session.preferences.interests = [];
          
          if (session.preferences.interests.includes(interest)) {
            session.preferences.interests = session.preferences.interests.filter(i => i !== interest);
            await this.bot.sendMessage(chatId, `Removed: ${this.interestEmoji(interest)} ${interest}`);
          } else {
            session.preferences.interests.push(interest);
            await this.bot.sendMessage(chatId, `Added: ${this.interestEmoji(interest)} ${interest} ✓`);
          }
          return;
        }

      // Done selecting interests
      if (data === 'interests_done') {
        session.state = 'onboarding_pace';
        await this.bot.sendMessage(chatId,
          `Great choices! 🎯\n\nSelected: ${(session.preferences.interests || ['general']).map(i => this.interestEmoji(i) + ' ' + i).join(', ')}\n\nNow, what's your preferred travel pace?`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🐢 Relaxed — Take it slow', callback_data: 'pace_relaxed' },
                ],
                [
                  { text: '⚖️ Moderate — Balanced mix', callback_data: 'pace_moderate' },
                ],
                [
                  { text: '🚀 Packed — See everything!', callback_data: 'pace_packed' },
                ],
              ],
            },
          }
        );
        return;
      }

      // Pace selection
      if (data.startsWith('pace_')) {
        session.preferences.pace = data.replace('pace_', '');
        session.state = 'onboarding_budget';
        await this.bot.sendMessage(chatId,
          `Got it — ${session.preferences.pace} pace! 👍\n\nWhat's your daily budget (excluding accommodation)?`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '💰 Budget (₹500-1500/day)', callback_data: 'budget_budget' },
                ],
                [
                  { text: '💵 Moderate (₹1500-4000/day)', callback_data: 'budget_moderate' },
                ],
                [
                  { text: '💎 Luxury (₹4000+/day)', callback_data: 'budget_luxury' },
                ],
              ],
            },
          }
        );
        return;
      }

      // Budget selection
      if (data.startsWith('budget_')) {
        session.preferences.budget = data.replace('budget_', '');
        session.state = 'onboarding_special';
        await this.bot.sendMessage(chatId,
          `Perfect! 💰\n\nAny special requests or preferences? (e.g., "vegetarian food only", "avoid crowded places", "looking for romantic spots")\n\nType your request or send /skip to continue.`,
        );
        return;
      }

      // Generate itinerary button
      if (data === 'generate_itinerary') {
        await this.generateAndSendItinerary(chatId);
        return;
      }

      // Download PDF
      if (data === 'download_pdf') {
        await this.generateAndSendPDF(chatId);
        return;
      }

      // Continue chatting
      if (data === 'continue_chat') {
        session.state = 'free_chat';
        await this.bot.sendMessage(chatId,
          `Sure! Ask me anything about Goa — restaurants, activities, transport, tips! 🌴`,
        );
        return;
      }
      } catch (err) {
        console.warn('Telegram callback_query error:', err.message);
      }
    });

    // Regular text messages
    this.bot.on('message', async (msg) => {
      try {
        if (msg.text?.startsWith('/')) {
          // Handle /skip command
          if (msg.text === '/skip') {
            const session = this.sessions.get(msg.chat.id);
            if (session && session.state === 'onboarding_special') {
              session.preferences.specialRequests = 'None';
              await this.confirmAndGenerate(msg.chat.id);
            }
            return;
          }
          // Handle /pdf command
          if (msg.text === '/pdf') {
            await this.generateAndSendPDF(msg.chat.id);
            return;
          }
          // Handle /plan command
          if (msg.text === '/plan') {
            await this.generateAndSendItinerary(msg.chat.id);
            return;
          }
          // Handle /help command
          if (msg.text === '/help') {
            await this.bot.sendMessage(msg.chat.id,
              `📋 *StayWU Trip Concierge Commands:*\n\n` +
              `/plan — Generate a new itinerary\n` +
              `/pdf — Download your itinerary as PDF\n` +
              `/help — Show this help message\n\n` +
              `Or just type any question about Goa! 🌴`,
              { parse_mode: 'Markdown' }
            );
            return;
          }
          return; // Ignore other commands (including /start handled above)
        }

        const chatId = msg.chat.id;
        const session = this.sessions.get(chatId);

        if (!session) {
          await this.bot.sendMessage(chatId, 'Please start with /start to begin! 🌴');
          return;
        }

        // Handle special requests input
        if (session.state === 'onboarding_special') {
          session.preferences.specialRequests = msg.text;
          await this.confirmAndGenerate(chatId);
          return;
        }

        // Free chat mode — conversational Q&A
        if (session.state === 'free_chat' || session.state === 'itinerary_done') {
          await this.handleFreeChat(chatId, msg.text);
          return;
        }
      } catch (err) {
        console.warn('Telegram message error:', err.message);
      }
    });
  }

  async confirmAndGenerate(chatId) {
    const session = this.sessions.get(chatId);
    if (!session) return;

    const prefs = session.preferences;
    session.state = 'generating';

    await this.bot.sendMessage(chatId,
      `✨ *Your Trip Profile:*\n\n` +
      `🎯 Interests: ${(prefs.interests || ['general']).join(', ')}\n` +
      `⏱️ Pace: ${prefs.pace || 'moderate'}\n` +
      `💰 Budget: ${prefs.budget || 'moderate'}\n` +
      `📝 Special: ${prefs.specialRequests || 'None'}\n\n` +
      `Ready to generate your personalized Goa itinerary?`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🗺️ Generate My Itinerary!', callback_data: 'generate_itinerary' }],
          ],
        },
      }
    );
  }

  async generateAndSendItinerary(chatId) {
    const session = this.sessions.get(chatId);
    if (!session) return;

    await this.bot.sendMessage(chatId, '🔄 Generating your personalized itinerary... This may take a moment! ✨');

    try {
      const bookingDetails = session.booking || {
        hotelName: 'Your Hotel in Goa',
        location: 'Goa',
        checkIn: 'Tomorrow',
        checkOut: 'In 3 days',
      };

      const places = this.dataService.getPlaces();
      
      // Fetch live weather & forecast for this hotel's location
      let weather = null;
      try {
        weather = await WeatherService.getWeather(
          bookingDetails.location || bookingDetails.area || 'Goa',
          bookingDetails.checkIn,
          bookingDetails.checkOut
        );
        session.weather = weather;
      } catch (e) {
        console.warn('Weather fetch error:', e.message);
      }

      const itinerary = await this.llmService.generateItinerary(
        bookingDetails,
        session.preferences,
        places,
        weather
      );

      session.itinerary = itinerary;
      session.state = 'itinerary_done';

      // Format into premium, highly readable Telegram card messages
      const cards = this.formatItineraryForTelegram(itinerary, bookingDetails, session.preferences, weather);
      
      for (let i = 0; i < cards.length; i++) {
        await this.sendSafeMessage(chatId, cards[i]);
        if (i < cards.length - 1) {
          await new Promise(r => setTimeout(r, 400));
        }
      }

      // Action buttons after itinerary
      await this.bot.sendMessage(chatId,
        `🎉 *Your Goa Itinerary is ready!*\n\n` +
        `📥 Download your executive multi-page PDF guide below with full daily timelines, dining picks, maps & emergency contacts:`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📄 Download Luxury PDF Guide', callback_data: 'download_pdf' }],
              [{ text: '🔄 Regenerate Itinerary', callback_data: 'generate_itinerary' }],
              [{ text: '💬 Ask Concierge a Question', callback_data: 'continue_chat' }],
            ],
          },
        }
      );
    } catch (error) {
      console.error('Itinerary generation error:', error);
      await this.bot.sendMessage(chatId,
        '❌ Sorry, I had trouble generating your itinerary. Please try again with /plan'
      );
    }
  }

  async generateAndSendPDF(chatId) {
    const session = this.sessions.get(chatId);
    if (!session || !session.itinerary) {
      await this.bot.sendMessage(chatId, '📄 No itinerary found. Generate one first with /plan!');
      return;
    }

    await this.bot.sendMessage(chatId, '📄 *Crafting your executive PDF itinerary dossier...* ✨', { parse_mode: 'Markdown' });

    try {
      const tempDir = path.join(__dirname, '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const pdfPath = path.join(tempDir, `StayWU_Itinerary_${chatId}.pdf`);

      // Ensure weather is available for PDF
      if (!session.weather) {
        try {
          const loc = session.booking?.location || session.booking?.area || 'Goa';
          session.weather = await WeatherService.getWeather(loc);
        } catch {}
      }

      await PDFItineraryGenerator.generate(session.itinerary, session.booking, pdfPath, session.weather);

      const hotelName = session.booking?.hotelName || 'Goa Stay';
      await this.bot.sendDocument(chatId, pdfPath, {
        caption: `📄 *Your StayWU Executive Goa Travel Dossier (PDF)*\n\n✨ Personalized travel guide for your stay at *${hotelName}*.\n\nIncludes detailed daily schedules, curated dining picks, local transport tips, itemized day costs, and full budget breakdown.`,
        parse_mode: 'Markdown',
      });

      // Clean up after 15 seconds
      setTimeout(() => {
        try { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); } catch {}
      }, 15000);
    } catch (error) {
      console.error('PDF generation error:', error);
      await this.bot.sendMessage(chatId, '❌ Sorry, PDF generation encountered an issue. Please try again with /pdf.');
    }
  }

  // Helper to send Markdown safely without breaking Telegram parser
  async sendSafeMessage(chatId, text, options = {}) {
    try {
      return await this.bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...options });
    } catch (err) {
      try {
        // Retry with unclosed markdown symbols cleaned
        const sanitized = text.replace(/#/g, '').replace(/---/g, '');
        return await this.bot.sendMessage(chatId, sanitized, { parse_mode: 'Markdown', ...options });
      } catch {
        // Fallback without parse_mode
        return await this.bot.sendMessage(chatId, text, options);
      }
    }
  }

  // Format raw AI output into clean, executive Telegram cards
  formatItineraryForTelegram(rawText, booking, preferences, weather = null) {
    const dayRegex = /(?=###?\s*Day\s*\d+)/gi;
    const sections = rawText.split(dayRegex);
    const intro = sections[0].trim();
    const daysAndBudget = sections.slice(1);

    const messages = [];

    // 1. Intro Overview Card
    const hotelName = booking?.hotelName || 'Your Hotel in Goa';
    const location = booking?.location || 'Goa';
    const dates = booking?.checkIn && booking?.checkOut ? `${booking.checkIn} to ${booking.checkOut}` : 'Upcoming Trip';
    const guestName = booking?.guestName || 'Traveler';

    // Clean intro narrative text
    const cleanIntroNarrative = intro
      .replace(/^#+.*$/gm, '')
      .replace(/^[-*_]{3,}$/gm, '')
      .trim();

    const introCard = `🌴 *Welcome to Goa, ${guestName}!* ✨\n\n` +
      `As your personal *StayWU AI Trip Concierge*, I’m thrilled to present your custom-crafted travel itinerary for your stay at *${hotelName}*.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 *TRIP OVERVIEW*\n` +
      `• *Base Hotel:* ${hotelName} (${location})\n` +
      `• *Dates:* ${dates}\n` +
      `• *Pace:* ${preferences?.pace || 'Moderate'} | *Budget:* ${preferences?.budget || 'Moderate'}\n` +
      `• *Primary Transport:* Scooter / Rental Bike (₹400–₹500/day)\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${cleanIntroNarrative.substring(0, 450)}...\n\n` +
      `👇 *Your curated day-by-day itinerary follows below:*`;
    messages.push(introCard);

    // 1.5 Live Weather & Trip Forecast Card
    if (weather && weather.current) {
      const w = weather.current;
      let forecastLines = '';
      if (weather.daily && weather.daily.length > 0) {
        forecastLines = weather.daily.slice(0, 5).map((d, i) => 
          `• *Day ${i + 1} (${d.dayName}):* ${d.icon} ${d.maxTemp}°C / ${d.minTemp}°C • ${d.condition}${d.rainProb >= 40 ? ` (${d.rainProb}% rain)` : ''}`
        ).join('\n');
      }

      const weatherCard = `🌤️ *LIVE GOA WEATHER & TRIP FORECAST*\n` +
        `📍 *Location:* ${weather.region} (${hotelName})\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `• *Current Conditions:* ${w.icon} *${w.temp}°C* (Feels like ${w.feelsLike}°C)\n` +
        `• *Atmosphere:* ${w.condition}\n` +
        `• *Humidity:* ${w.humidity}% | *Wind:* ${w.windSpeed} km/h\n` +
        (w.precipitation > 0 ? `• *Precipitation:* ${w.precipitation} mm\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📅 *Upcoming Forecast on Trip Days:*\n` +
        `${forecastLines}\n\n` +
        `💡 *Concierge Advisory:*\n${weather.advisory}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━`;

      messages.push(weatherCard);
    }

    // 2. Format Individual Day Cards
    let budgetText = '';
    const budgetIdx = rawText.search(/###?\s*Total\s*Estimated/i);
    if (budgetIdx !== -1) {
      budgetText = rawText.substring(budgetIdx);
    }

    for (const block of daysAndBudget) {
      // If block contains budget table, strip it out for separate card
      let dayContent = block;
      if (dayContent.toLowerCase().includes('total estimated trip budget') || dayContent.toLowerCase().includes('total estimated budget')) {
        const bParts = dayContent.split(/(?=###?\s*Total\s*Estimated)/i);
        dayContent = bParts[0];
      }

      const dayCard = this.buildDayCard(dayContent);
      if (dayCard) {
        messages.push(dayCard);
      }
    }

    // 3. Format Budget Breakdown Card
    if (budgetText) {
      let bCard = `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 *TOTAL ESTIMATED TRIP BUDGET*\n` +
        `*(Per person, excluding accommodation)*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      const rows = budgetText.split('\n').filter(l => l.trim().startsWith('|') && l.trim().endsWith('|'));
      let hasRows = false;

      for (const r of rows) {
        const cells = r.split('|').map(c => c.trim().replace(/\*\*/g, '')).filter(c => c.length > 0);
        if (cells.length >= 2 && !cells[0].includes('---') && cells[0].toLowerCase() !== 'category') {
          hasRows = true;
          const cat = cells[0];
          const desc = cells.length > 2 ? cells[1] : '';
          const cost = cells[cells.length - 1];
          if (cat.toLowerCase().includes('total')) {
            bCard += `\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `💎 *${cat.toUpperCase()}:* *${cost}*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━\n`;
          } else {
            const catEmoji = cat.toLowerCase().includes('transport') ? '🛵' :
              cat.toLowerCase().includes('dining') || cat.toLowerCase().includes('food') ? '🍽️' :
              cat.toLowerCase().includes('sight') || cat.toLowerCase().includes('entry') ? '🏛️' : '🎉';
            bCard += `${catEmoji} *${cat}:* ${cost}` + (desc ? `\n   └ _${desc.substring(0, 80)}_` : '') + `\n\n`;
          }
        }
      }

      if (hasRows) {
        messages.push(bCard.trim());
      }
    }

    return messages;
  }

  // Format a single Day's content into an aesthetic card
  buildDayCard(block) {
    const lines = block.trim().split('\n');
    let title = '';
    let focus = '';
    let tip = '';
    let cost = '';
    const periods = [];
    let curPeriod = null;

    for (let l of lines) {
      l = l.trim();
      if (!l || /^[-*_]{3,}$/.test(l)) continue;

      const dMatch = l.match(/^###?\s*(Day\s*\d+:[^\n]+)/i);
      if (dMatch) {
        title = dMatch[1].replace(/\*\*/g, '').trim();
        continue;
      }

      if (/^(?:\*{0,2})(?:focus|theme):/i.test(l)) {
        focus = l.replace(/^(?:\*{0,2})(?:focus|theme):\*?\*?\s*/i, '').replace(/\*\*/g, '').trim();
        continue;
      }

      if (/travel\s*tip:/i.test(l) || /pro-tip:/i.test(l) || /local\s*tip:/i.test(l)) {
        tip = l.replace(/.*(?:travel\s*tip|pro-tip|local\s*tip):\*?\*?\s*/i, '').replace(/\*\*/g, '').trim();
        continue;
      }

      if (/est\.?\s*cost:/i.test(l) || /estimated\s*cost:/i.test(l) || /day\s*budget:/i.test(l)) {
        cost = l.replace(/.*(?:est\.?\s*cost|estimated\s*cost|day\s*budget):\*?\*?\s*/i, '').replace(/\*\*/g, '').trim();
        continue;
      }

      const pMatch = l.match(/^(?:[#*•-]+\s*)*(Morning(?:\s*Schedule)?|Afternoon(?:\s*Schedule)?|Evening(?:\s*(?:&|and)\s*Night(?:\s*Schedule)?)?|Evening(?:\s*Schedule)?|Night(?:\s*Schedule)?|Food\s*&\s*Dining)/i);
      if (pMatch && (l.includes(':') || l.startsWith('#') || l.startsWith('*'))) {
        curPeriod = { title: pMatch[1].replace(/Schedule$/i, '').trim(), items: [] };
        periods.push(curPeriod);
        continue;
      }

      if (l.match(/^[-*•]\s+/) || l.match(/^\d{1,2}:\d{2}/i) || l.match(/^(?:Activity|Lunch|Dinner|Breakfast):/i)) {
        if (!curPeriod) {
          curPeriod = { title: 'Highlights', items: [] };
          periods.push(curPeriod);
        }

        const timeMatch = l.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
        const isDining = /(?:lunch|dinner|breakfast)\s*(?:at|:|\()/i.test(l);
        const diningMatch = l.match(/(lunch|dinner|breakfast)/i);

        let cleanText = l.replace(/^[-*•\s]+/, '').replace(/^activity:\s*/i, '').replace(/\(ID\s*\d+\)/gi, '').trim();
        if (timeMatch) {
          cleanText = cleanText.replace(new RegExp('^' + timeMatch[1] + '\\s*[-:–—]\\s*', 'i'), '');
        }

        let formattedItem = '';
        if (timeMatch) {
          formattedItem = `• *${timeMatch[1]}* — ${cleanText}`;
        } else if (isDining && diningMatch) {
          formattedItem = `• *${diningMatch[1].toUpperCase()}* — ${cleanText}`;
        } else {
          formattedItem = `• ${cleanText}`;
        }

        curPeriod.items.push(formattedItem);
      }
    }

    if (!title) return null;

    let card = `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📅 *${title.toUpperCase()}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (focus) {
      card += `🎯 *Focus:* _${focus}_\n\n`;
    }

    for (const p of periods) {
      if (p.items.length === 0) continue;
      const pLower = p.title.toLowerCase();
      const emoji = pLower.includes('morning') ? '🌅' :
        pLower.includes('afternoon') ? '☀️' :
        pLower.includes('evening') || pLower.includes('night') ? '🌇' : '🍽️';
      card += `${emoji} *${p.title.toUpperCase()}*\n`;
      for (const item of p.items) {
        card += `${item}\n`;
      }
      card += `\n`;
    }

    if (tip) {
      card += `💡 *Travel Tip:* ${tip}\n\n`;
    }
    if (cost) {
      card += `💰 *Est. Cost:* ${cost}\n`;
    }
    card += `━━━━━━━━━━━━━━━━━━━━━━━`;

    return card;
  }

  // Split itinerary by Day or section for clean mobile reading
  splitItinerary(text) {
    const dayRegex = /(?=###?\s*(?:[^\w\s]*\s*)?(?:Day\s*\d+|Total\s*Estimated\s*Budget))/gi;
    const parts = text.split(dayRegex).map(p => p.trim()).filter(p => p.length > 0);

    if (parts.length > 1) {
      const finalChunks = [];
      for (const part of parts) {
        if (part.length <= 3800) {
          finalChunks.push(part);
        } else {
          finalChunks.push(...this.splitMessage(part, 3600));
        }
      }
      return finalChunks;
    }
    return this.splitMessage(text, 3600);
  }

  async handleFreeChat(chatId, userMessage) {
    const session = this.sessions.get(chatId);
    
    // Show typing indicator
    await this.bot.sendChatAction(chatId, 'typing');

    try {
      const tripContext = session.booking || {
        hotelName: 'General inquiry',
        location: 'Goa',
        checkIn: 'N/A',
        checkOut: 'N/A',
      };

      const places = this.dataService.getPlaces();
      
      // Ensure we have weather for live Q&A
      if (!session.weather) {
        try {
          session.weather = await WeatherService.getWeather(tripContext.location);
        } catch {}
      }

      const reply = await this.llmService.chatTripAssistant(
        userMessage,
        tripContext,
        places,
        session.history.slice(-10), // Last 10 messages for context
        session.weather
      );

      // Update history
      session.history.push({ role: 'user', content: userMessage });
      session.history.push({ role: 'assistant', content: reply });

      // Split and send
      const chunks = this.splitMessage(reply, 4000);
      for (const chunk of chunks) {
        await this.bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' }).catch(() => {
          this.bot.sendMessage(chatId, chunk);
        });
      }
    } catch (error) {
      console.error('Free chat error:', error);
      await this.bot.sendMessage(chatId,
        '❌ Sorry, I had trouble processing that. Please try again!'
      );
    }
  }

  // Utility: split long messages for Telegram
  splitMessage(text, maxLength) {
    if (text.length <= maxLength) return [text];
    
    const chunks = [];
    let remaining = text;
    
    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }
      
      // Find a good split point
      let splitIndex = remaining.lastIndexOf('\n\n', maxLength);
      if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
        splitIndex = remaining.lastIndexOf('\n', maxLength);
      }
      if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
        splitIndex = maxLength;
      }
      
      chunks.push(remaining.substring(0, splitIndex));
      remaining = remaining.substring(splitIndex).trim();
    }
    
    return chunks;
  }

  // Utility: emoji for interests
  interestEmoji(interest) {
    const map = {
      beaches: '🏖️', nightlife: '🎉', culture: '🏛️', food: '🍽️',
      watersports: '🌊', wellness: '🧘', shopping: '🛍️', nature: '🌿',
    };
    return map[interest] || '✨';
  }
}

module.exports = TripBot;
