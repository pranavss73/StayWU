const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * High-quality, executive PDF generator for StayWU Trip Itineraries.
 * Formats raw AI markdown into a luxury-styled travel document with:
 * - Proper WinAnsi character encoding (no broken emojis or rupee signs)
 * - Branded hero header with hotel metadata card
 * - Structured daily schedule cards with time pills & dining badges
 * - Theme/focus banners per day
 * - Estimated day cost badges
 * - Amber travel tip callout boxes
 * - Styled budget breakdown table with alternating rows & bold total
 * - Multi-page numbering and emergency contacts footer
 */
class PDFItineraryGenerator {
  /**
   * Sanitizes text to remove characters unsupported by PDFKit's Helvetica font.
   * Converts emojis, smart quotes, and Rupee symbols to clean, professional ASCII.
   */
  static cleanText(str) {
    if (!str) return '';
    return str
      // Convert Rupee sign to Rs.
      .replace(/₹/g, 'Rs. ')
      // Clean dataset IDs like (ID 42) or (ID 4)
      .replace(/\(ID\s*\d+\)/gi, '')
      // Convert dashes and quotes
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      // Remove all emojis and non-standard symbols that cause mojibake
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
      // Remove markdown bold/italic asterisks
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      // Remove stray double hyphens
      .replace(/^--+$/, '')
      .trim();
  }

  /**
   * Parse the itinerary text into structured sections.
   */
  static parseItinerary(rawText, booking) {
    const lines = rawText.split('\n');
    const result = {
      welcomeMessage: '',
      overview: {
        hotel: booking?.hotelName || 'Goa Hotel',
        location: booking?.location || 'Goa',
        dates: booking?.checkIn && booking?.checkOut ? `${booking.checkIn} to ${booking.checkOut}` : 'Upcoming Trip',
        transport: 'Scooter / Rental Bike (Rs. 400-500/day)',
      },
      days: [],
      budgetTable: [],
      budgetTotal: null,
      closingTip: '',
    };

    let currentDay = null;
    let currentPeriod = null;
    let inBudgetTable = false;
    let collectingWelcome = true;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].trim();
      if (!rawLine) continue;

      // Ignore markdown horizontal dividers
      if (/^[-*_]{3,}$/.test(rawLine)) continue;

      // Detect Trip Overview transport or dates if in text
      if (rawLine.toLowerCase().includes('primary transport recommendation:') || rawLine.toLowerCase().includes('primary transport:')) {
        result.overview.transport = this.cleanText(rawLine.replace(/.*primary transport(?:\s*recommendation)?:\s*/i, ''));
        collectingWelcome = false;
        continue;
      }
      if (rawLine.toLowerCase().includes('base:') && !currentDay) {
        result.overview.hotel = this.cleanText(rawLine.replace(/.*base:\s*/i, ''));
        collectingWelcome = false;
        continue;
      }
      if (rawLine.toLowerCase().includes('dates:') && !currentDay) {
        result.overview.dates = this.cleanText(rawLine.replace(/.*dates:\s*/i, ''));
        collectingWelcome = false;
        continue;
      }

      // Check for Day Header (e.g. "### Day 1: ...", "## Day 1: ...", "Day 1: ...", "📅 Day 1: ...")
      const dayMatch = rawLine.match(/(?:^|[#*\s])(Day\s*\d+[^#\n*]*)/i);
      if (dayMatch && !rawLine.toLowerCase().includes('day-by-day') && !rawLine.toLowerCase().includes('days:')) {
        collectingWelcome = false;
        inBudgetTable = false;
        currentDay = {
          title: this.cleanText(dayMatch[1]),
          focus: '',
          periods: [],
          tip: '',
          cost: '',
        };
        result.days.push(currentDay);
        currentPeriod = null;
        continue;
      }

      // If we are inside a Day
      if (currentDay && !inBudgetTable) {
        // 1. Theme / Focus
        if (/^(?:\*{0,2})(?:focus|theme):/i.test(rawLine)) {
          currentDay.focus = this.cleanText(rawLine.replace(/^(?:\*{0,2})(?:focus|theme):\*?\*?\s*/i, ''));
          continue;
        }

        // 2. Travel Tip
        if (/travel\s*tip:/i.test(rawLine) || /pro-tip:/i.test(rawLine) || /local\s*tip:/i.test(rawLine)) {
          currentDay.tip = this.cleanText(rawLine.replace(/.*(?:travel\s*tip|pro-tip|local\s*tip):\*?\*?\s*/i, ''));
          continue;
        }

        // 3. Day Estimated Cost / Budget
        if (/est\.?\s*cost:/i.test(rawLine) || /estimated\s*cost:/i.test(rawLine) || /day\s*budget:/i.test(rawLine)) {
          currentDay.cost = this.cleanText(rawLine.replace(/.*(?:est\.?\s*cost|estimated\s*cost|day\s*budget):\*?\*?\s*/i, ''));
          continue;
        }

        // 4. Period Header (Morning, Afternoon, Evening & Night, Food & Dining)
        const periodMatch = rawLine.match(/^(?:[#*•-]+\s*)*(Morning(?:\s*Schedule)?|Afternoon(?:\s*Schedule)?|Evening(?:\s*(?:&|and)\s*Night(?:\s*Schedule)?)?|Evening(?:\s*Schedule)?|Night(?:\s*Schedule)?|Food\s*&\s*Dining(?:\s*Recommendations)?|Dining(?:\s*Highlights)?)/i);
        if (periodMatch && (rawLine.includes(':') || rawLine.startsWith('#') || rawLine.startsWith('*'))) {
          currentPeriod = {
            title: this.cleanText(periodMatch[1]).replace(/Schedule$/i, '').trim(),
            items: [],
          };
          currentDay.periods.push(currentPeriod);
          continue;
        }

        // 5. Activity or Schedule Item under current day
        if (rawLine.match(/^[-*•]\s+/) || rawLine.match(/^\d{1,2}:\d{2}\s*(?:AM|PM)/i) || rawLine.match(/^(?:Activity|Lunch|Dinner|Breakfast):/i)) {
          if (!currentPeriod) {
            currentPeriod = { title: 'Highlights', items: [] };
            currentDay.periods.push(currentPeriod);
          }

          const timeMatch = rawLine.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
          const isDining = /(?:lunch|dinner|breakfast)\s*(?:at|:|\()/i.test(rawLine);
          const diningMatch = rawLine.match(/(lunch|dinner|breakfast)/i);

          let clean = this.cleanText(rawLine.replace(/^[-*•\s]+/, '').replace(/^activity:\s*/i, ''));
          if (timeMatch) {
            clean = clean.replace(new RegExp('^' + timeMatch[1] + '\\s*[-:–—]\\s*', 'i'), '');
          }

          if (clean) {
            currentPeriod.items.push({
              time: timeMatch ? timeMatch[1].trim() : (isDining && diningMatch ? diningMatch[1].toUpperCase() : '•'),
              text: clean,
              isDining: !!isDining,
            });
          }
          continue;
        }
      }

      // Check for Budget Table section start
      if (rawLine.toLowerCase().includes('budget breakdown') || rawLine.toLowerCase().includes('total estimated trip budget') || rawLine.toLowerCase().includes('total estimated budget')) {
        inBudgetTable = true;
        collectingWelcome = false;
        continue;
      }

      // Parse Budget Table
      if (inBudgetTable) {
        // Table row format: | Category | Description | Approx Cost |
        if (rawLine.startsWith('|') && rawLine.endsWith('|')) {
          const cells = rawLine.split('|').map(c => this.cleanText(c.trim())).filter(c => c.length > 0);
          if (cells.length >= 2 && !cells[0].includes('---')) {
            if (cells[0].toLowerCase() === 'category') continue;
            if (cells[0].toLowerCase().includes('total')) {
              result.budgetTotal = {
                category: cells[0],
                description: cells.length > 2 ? cells[1] : 'Total trip cost (excl. accommodation)',
                cost: cells[cells.length - 1],
              };
            } else {
              result.budgetTable.push({
                category: cells[0],
                description: cells.length > 2 ? cells[1] : '',
                cost: cells[cells.length - 1],
              });
            }
          }
          continue;
        }

        // Bulleted budget row format: - Transport: ... or - Total Estimate: ...
        const bulletMatch = rawLine.match(/^[-*•]\s*(.*?):\s*(.*)/);
        if (bulletMatch) {
          const category = this.cleanText(bulletMatch[1]);
          const details = this.cleanText(bulletMatch[2]);
          if (category.toLowerCase().includes('total')) {
            result.budgetTotal = {
              category: 'TOTAL ESTIMATE',
              description: 'Comprehensive trip cost (excl. accommodation)',
              cost: details,
            };
          } else {
            result.budgetTable.push({
              category,
              description: '',
              cost: details,
            });
          }
          continue;
        }
      }

      // Collect initial welcome intro text (skip bullet lines or headers)
      if (collectingWelcome && !rawLine.startsWith('#') && !rawLine.startsWith('-') && !rawLine.startsWith('*') && !rawLine.startsWith('|')) {
        const text = this.cleanText(rawLine);
        if (text && !text.toLowerCase().includes('trip overview') && !text.toLowerCase().includes('day-by-day')) {
          if (result.welcomeMessage) result.welcomeMessage += '\n\n';
          result.welcomeMessage += text;
        }
      }
    }

    return result;
  }

  /**
   * Main method to generate and save the PDF itinerary.
   */
  static async generate(rawItineraryText, booking, outputPath, weather = null) {
    const data = this.parseItinerary(rawItineraryText, booking);

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 50, left: 40, right: 40 },
      bufferPages: true,
      autoFirstPage: true,
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentWidth = pageWidth - 80;

    // Helper: Ensure room on page or add new page
    const ensureSpace = (neededHeight) => {
      if (doc.y + neededHeight > pageHeight - 60) {
        doc.addPage();
        drawPageHeaderSmall();
      }
    };

    // Helper: Small header on subsequent pages
    const drawPageHeaderSmall = () => {
      doc.save();
      doc.rect(40, 20, contentWidth, 2).fill('#0284C7');
      doc.fontSize(8).fillColor('#64748B').text('STAYWU TRIP CONCIERGE  |  GOA TRAVEL ITINERARY', 40, 26, {
        width: contentWidth,
        align: 'left',
        lineBreak: false,
      });
      doc.restore();
      doc.y = 45;
    };

    // ==========================================
    // 1. First Page Hero Header
    // ==========================================
    doc.save();
    doc.roundedRect(40, 40, contentWidth, 75, 8).fill('#0F172A');
    
    // Top brand tag
    doc.fillColor('#38BDF8').fontSize(9).font('Helvetica-Bold')
      .text('STAYWU CONCIERGE  •  VERIFIED GOA TRAVEL', 56, 50, { lineBreak: false });

    // Main title
    doc.fillColor('#FFFFFF').fontSize(17).font('Helvetica-Bold')
      .text('PERSONALIZED GOA TRIP ITINERARY', 56, 64, { lineBreak: false });

    // Subtitle
    doc.fillColor('#94A3B8').fontSize(8.5).font('Helvetica')
      .text('AI-Crafted Daily Schedule, Dining Recommendations & Budget Planner', 56, 85, { lineBreak: false });
    doc.restore();

    doc.y = 125;

    // ==========================================
    // 2. Metadata Cards (Hotel, Location, Dates, Transport)
    // ==========================================
    const cardY = doc.y;
    const cardWidth = (contentWidth - 15) / 2;
    const cardHeight = 42;

    const drawMetaCard = (x, y, label, val) => {
      doc.save();
      doc.roundedRect(x, y, cardWidth, cardHeight, 6).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.fillColor('#64748B').fontSize(7.5).font('Helvetica-Bold')
        .text(label.toUpperCase(), x + 10, y + 7, { width: cardWidth - 20, lineBreak: false });
      doc.fillColor('#0F172A').fontSize(9.5).font('Helvetica-Bold')
        .text(val, x + 10, y + 20, { width: cardWidth - 20, lineBreak: false, ellipsis: true });
      doc.restore();
    };

    drawMetaCard(40, cardY, 'Hotel / Base Stay', data.overview.hotel);
    drawMetaCard(40 + cardWidth + 15, cardY, 'Location & Area', data.overview.location);
    drawMetaCard(40, cardY + cardHeight + 8, 'Travel Dates', data.overview.dates);
    drawMetaCard(40 + cardWidth + 15, cardY + cardHeight + 8, 'Primary Transport', data.overview.transport);

    doc.y = cardY + (cardHeight * 2) + 14;

    // ==========================================
    // 2.5 Live Weather & Seasonal Advisory Box
    // ==========================================
    if (weather && weather.current) {
      const weatherBoxY = doc.y;
      const wHeight = 48;
      doc.save();
      doc.roundedRect(40, weatherBoxY, contentWidth, wHeight, 6).fillAndStroke('#F0F9FF', '#BAE6FD');
      
      // Weather Title / Region badge
      doc.fillColor('#0284C7').fontSize(7.5).font('Helvetica-Bold')
        .text(`LIVE WEATHER & TRIP FORECAST  •  ${(weather.region || 'GOA').toUpperCase()}`, 52, weatherBoxY + 7, { lineBreak: false });

      // Current Conditions line
      const currText = `Current: ${weather.current.temp} C (Feels like ${weather.current.feelsLike} C)  |  ${weather.current.ascii}  |  Humidity: ${weather.current.humidity}%  |  Wind: ${weather.current.windSpeed} km/h`;
      doc.fillColor('#0F172A').fontSize(8.5).font('Helvetica-Bold')
        .text(currText, 52, weatherBoxY + 19, { width: contentWidth - 24, lineBreak: false });

      // Advisory line
      const advText = `Travel Advisory: ${PDFItineraryGenerator.cleanText(weather.advisory)}`;
      doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Oblique')
        .text(advText, 52, weatherBoxY + 32, { width: contentWidth - 24, lineBreak: false, ellipsis: true });
      doc.restore();

      doc.y = weatherBoxY + wHeight + 10;
    }

    // Welcome paragraph if available
    if (data.welcomeMessage) {
      doc.save();
      doc.fillColor('#334155').fontSize(9).font('Helvetica-Oblique')
        .text(data.welcomeMessage, 42, doc.y, { width: contentWidth - 4, lineGap: 3 });
      doc.restore();
      doc.moveDown(0.6);
    }

    // Divider line
    doc.save();
    doc.moveTo(40, doc.y).lineTo(40 + contentWidth, doc.y).strokeColor('#E2E8F0').lineWidth(1).stroke();
    doc.restore();
    doc.moveDown(0.6);

    // ==========================================
    // 3. Day by Day Schedule
    // ==========================================
    for (let d = 0; d < data.days.length; d++) {
      const day = data.days[d];

      // Ensure space for Day Banner + Theme + at least 1 period
      ensureSpace(85);

      // --- Day Banner ---
      const dayHeaderY = doc.y;
      doc.save();
      doc.roundedRect(40, dayHeaderY, contentWidth, 24, 4).fill('#0284C7');
      doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
        .text(day.title.toUpperCase(), 52, dayHeaderY + 6, { width: contentWidth - 170, lineBreak: false });

      // If we have daily weather forecast for this day, render a weather pill on the right side of the banner
      if (weather && weather.daily && weather.daily[d]) {
        const dWeather = weather.daily[d];
        const wPillText = `${dWeather.maxTemp} C / ${dWeather.minTemp} C  •  ${dWeather.ascii}`;
        doc.fillColor('#E0F2FE').fontSize(8).font('Helvetica-Bold')
          .text(wPillText, 40, dayHeaderY + 7, { width: contentWidth - 14, align: 'right', lineBreak: false });
      }
      doc.restore();
      doc.y = dayHeaderY + 30;

      // --- Day Theme / Focus ---
      if (day.focus) {
        doc.save();
        doc.fillColor('#0284C7').fontSize(8).font('Helvetica-Bold').text('THEME: ', 44, doc.y, { continued: true });
        doc.fillColor('#475569').font('Helvetica-Oblique').text(day.focus, { width: contentWidth - 24, lineGap: 2 });
        doc.restore();
        doc.moveDown(0.4);
      }

      // --- Periods (Morning, Afternoon, Evening & Night, Dining) ---
      for (const period of day.periods) {
        if (!period.items || period.items.length === 0) continue;

        ensureSpace(45);

        // Period Badge
        const pTitleLower = period.title.toLowerCase();
        const isEvening = pTitleLower.includes('evening') || pTitleLower.includes('night');
        const isDining = pTitleLower.includes('dining') || pTitleLower.includes('food');
        const badgeBg = isDining ? '#FEF3C7' : isEvening ? '#EDE9FE' : '#E0F2FE';
        const badgeColor = isDining ? '#B45309' : isEvening ? '#5B21B6' : '#0369A1';

        const periodY = doc.y;
        doc.save();
        doc.roundedRect(40, periodY, contentWidth, 18, 3).fill(badgeBg);
        doc.fillColor(badgeColor).fontSize(8.5).font('Helvetica-Bold')
          .text(period.title.toUpperCase(), 48, periodY + 4, { width: contentWidth - 16, lineBreak: false });
        doc.restore();
        doc.y = periodY + 23;

        // Items in this period
        for (const item of period.items) {
          ensureSpace(28);

          const itemY = doc.y;

          if (item.time && item.time !== '•') {
            const isMeal = ['LUNCH', 'DINNER', 'BREAKFAST'].includes(item.time.toUpperCase());
            const pillBg = isMeal ? '#FEF3C7' : '#F1F5F9';
            const pillColor = isMeal ? '#D97706' : '#0284C7';
            const pillWidth = isMeal ? 58 : 52;

            // Clock / Meal Pill
            doc.save();
            doc.roundedRect(44, itemY, pillWidth, 14, 3).fill(pillBg);
            doc.fillColor(pillColor).fontSize(7.5).font('Helvetica-Bold')
              .text(item.time, 44, itemY + 3, { width: pillWidth, align: 'center', lineBreak: false });
            doc.restore();

            // Text description
            doc.save();
            doc.fillColor('#1E293B').fontSize(8.5).font('Helvetica')
              .text(item.text, 44 + pillWidth + 8, itemY + 1, { width: contentWidth - pillWidth - 16, lineGap: 2 });
            doc.restore();
          } else {
            // Bullet item
            doc.save();
            doc.fillColor('#0284C7').fontSize(9).font('Helvetica-Bold').text('•', 48, itemY, { lineBreak: false });
            doc.fillColor('#1E293B').fontSize(8.5).font('Helvetica')
              .text(item.text, 60, itemY, { width: contentWidth - 24, lineGap: 2 });
            doc.restore();
          }

          doc.moveDown(0.35);
        }

        doc.moveDown(0.2);
      }

      // --- Estimated Day Cost Bar ---
      if (day.cost) {
        ensureSpace(28);
        const costY = doc.y;
        doc.save();
        doc.roundedRect(40, costY, contentWidth, 20, 3).fillAndStroke('#F0FDF4', '#BBF7D0');
        doc.fillColor('#16A34A').fontSize(7.5).font('Helvetica-Bold')
          .text('ESTIMATED DAY COST: ', 50, costY + 5, { continued: true });
        doc.fillColor('#15803D').font('Helvetica')
          .text(day.cost, { width: contentWidth - 24, lineBreak: false });
        doc.restore();
        doc.y = costY + 26;
      }

      // --- Travel Tip Box ---
      if (day.tip) {
        ensureSpace(36);
        const tipY = doc.y;
        
        doc.fontSize(8.5).font('Helvetica');
        const tipTextHeight = doc.heightOfString(`TRAVEL TIP: ${day.tip}`, { width: contentWidth - 28 });
        const tipBoxHeight = Math.max(24, tipTextHeight + 12);

        doc.save();
        doc.roundedRect(40, tipY, contentWidth, tipBoxHeight, 4).fillAndStroke('#FFFBEB', '#FDE68A');
        doc.rect(40, tipY, 4, tipBoxHeight).fill('#F59E0B');

        doc.fillColor('#92400E').fontSize(8).font('Helvetica-Bold').text('TRAVEL TIP: ', 52, tipY + 6, { continued: true });
        doc.font('Helvetica').text(day.tip, { width: contentWidth - 28, lineGap: 2 });
        doc.restore();

        doc.y = tipY + tipBoxHeight + 8;
      }

      doc.moveDown(0.4);
    }

    // ==========================================
    // 4. Budget Breakdown Table
    // ==========================================
    if (data.budgetTable.length > 0) {
      const totalBudgetTableHeight = 45 + (data.budgetTable.length * 20) + 30 + 55;
      if (doc.y + totalBudgetTableHeight > pageHeight - 50) {
        doc.addPage();
        drawPageHeaderSmall();
      }

      // Section title
      doc.save();
      doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold')
        .text('ESTIMATED TRIP BUDGET BREAKDOWN', 40, doc.y, { lineBreak: false });
      doc.fillColor('#64748B').fontSize(8).font('Helvetica')
        .text('Approximate cost per person excluding accommodation', 40, doc.y + 15, { lineBreak: false });
      doc.restore();

      doc.y += 28;

      // Table layout
      const col1Width = 115; // Category
      const col3Width = 135; // Cost
      const col2Width = contentWidth - col1Width - col3Width; // Description

      const tableX = 40;
      let tableY = doc.y;

      // Table Header Row
      doc.save();
      doc.rect(tableX, tableY, contentWidth, 20).fill('#0F172A');
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
      doc.text('CATEGORY', tableX + 8, tableY + 5, { width: col1Width - 12, lineBreak: false });
      doc.text('DESCRIPTION', tableX + col1Width + 6, tableY + 5, { width: col2Width - 12, lineBreak: false });
      doc.text('APPROX COST', tableX + col1Width + col2Width, tableY + 5, { width: col3Width - 8, align: 'right', lineBreak: false });
      doc.restore();

      tableY += 20;

      // Data Rows
      for (let r = 0; r < data.budgetTable.length; r++) {
        const row = data.budgetTable[r];
        const rowBg = r % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        const rowH = 20;

        tableY = doc.y;

        doc.save();
        doc.rect(tableX, tableY, contentWidth, rowH).fillAndStroke(rowBg, '#E2E8F0');
        doc.fillColor('#1E293B').fontSize(8.5).font('Helvetica-Bold')
          .text(row.category, tableX + 8, tableY + 5, { width: col1Width - 12, lineBreak: false });
        doc.fillColor('#475569').fontSize(7.5).font('Helvetica')
          .text(row.description, tableX + col1Width + 6, tableY + 5, { width: col2Width - 12, lineBreak: false, ellipsis: true });
        doc.fillColor('#0284C7').fontSize(8.5).font('Helvetica-Bold')
          .text(row.cost, tableX + col1Width + col2Width, tableY + 5, { width: col3Width - 8, align: 'right', lineBreak: false });
        doc.restore();

        doc.y = tableY + rowH;
      }

      // Total Row
      if (data.budgetTotal) {
        tableY = doc.y;

        doc.save();
        doc.rect(tableX, tableY, contentWidth, 22).fillAndStroke('#E0F2FE', '#0284C7');
        doc.fillColor('#0369A1').fontSize(8.5).font('Helvetica-Bold')
          .text('TOTAL ESTIMATE', tableX + 8, tableY + 6, { width: col1Width - 12, lineBreak: false });
        doc.fillColor('#0369A1').fontSize(7.5).font('Helvetica')
          .text('(Excluding accommodation)', tableX + col1Width + 6, tableY + 6, { width: col2Width - 12, lineBreak: false });
        doc.fillColor('#0369A1').fontSize(9).font('Helvetica-Bold')
          .text(data.budgetTotal.cost, tableX + col1Width + col2Width, tableY + 6, { width: col3Width - 8, align: 'right', lineBreak: false });
        doc.restore();

        doc.y = tableY + 28;
      }
    }

    // ==========================================
    // 5. Emergency Contacts & Footer Box
    // ==========================================
    ensureSpace(48);
    const boxY = doc.y;
    doc.save();
    doc.roundedRect(40, boxY, contentWidth, 34, 4).fillAndStroke('#F1F5F9', '#CBD5E1');
    doc.fillColor('#0F172A').fontSize(7.5).font('Helvetica-Bold')
      .text('GOA EMERGENCY & ESSENTIAL HELPLINES', 52, boxY + 6, { lineBreak: false });
    doc.fillColor('#475569').fontSize(7).font('Helvetica')
      .text('Police: 100  |  Ambulance: 108  |  Goa Tourist Helpline: 1800-22-7838  |  Women Helpline: 1091', 52, boxY + 18, { lineBreak: false });
    doc.restore();

    // ==========================================
    // 6. Multi-Page Footer with Page Numbers
    // ==========================================
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0; // Prevent PDFKit auto-page-overflow

      doc.save();
      // Thin line above footer
      doc.moveTo(40, pageHeight - 28).lineTo(pageWidth - 40, pageHeight - 28).strokeColor('#E2E8F0').lineWidth(0.75).stroke();

      // Left branding
      doc.fillColor('#94A3B8').fontSize(7.5).font('Helvetica')
        .text('StayWU AI Trip Concierge  •  For live updates, message @StayWU_bot on Telegram', 40, pageHeight - 20, {
          width: contentWidth - 90,
          align: 'left',
          lineBreak: false,
        });

      // Right page number
      doc.fillColor('#64748B').fontSize(7.5).font('Helvetica-Bold')
        .text(`Page ${i + 1} of ${totalPages}`, pageWidth - 120, pageHeight - 20, {
          width: 80,
          align: 'right',
          lineBreak: false,
        });
      doc.restore();
    }

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    });
  }
}

module.exports = PDFItineraryGenerator;
