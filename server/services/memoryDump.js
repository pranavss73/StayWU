const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class MemoryDumpService {
  constructor(baseDir) {
    this.baseDir = baseDir || path.join(__dirname, '..', 'memory_data');
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  safeText(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  wrapText(text, maxChars = 28) {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines.slice(0, 3);
  }

  async downloadTelegramPhoto(bot, fileId, destination) {
    const url = await bot.getFileLink(fileId);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Telegram photo download failed: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(destination, buffer);
    return destination;
  }

  imageDataUri(filePath) {
    const buffer = fs.readFileSync(filePath);
    let mime = 'image/jpeg';
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      mime = 'image/png';
    } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      mime = 'image/webp';
    }
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }

  imageElement(photo, slot, id) {
    const uri = this.imageDataUri(photo.filePath);
    return `
      <clipPath id="clip${id}"><rect x="${slot.x}" y="${slot.y}" width="${slot.w}" height="${slot.h}" rx="4"/></clipPath>
      <image href="${uri}" x="${slot.x}" y="${slot.y}" width="${slot.w}" height="${slot.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip${id})"/>
      <rect x="${slot.x}" y="${slot.y}" width="${slot.w}" height="${slot.h}" fill="none" stroke="#fffdf6" stroke-width="18"/>
    `;
  }

  label(photo, x, y, width) {
    const placeLines = this.wrapText(photo.place, 22);
    const date = this.safeText(photo.dateLabel);
    let out = `<text x="${x}" y="${y}" font-family="cursive" font-size="30" fill="#4f3828">`;
    placeLines.forEach((line, i) => {
      out += `<tspan x="${x}" dy="${i === 0 ? 0 : 34}">${this.safeText(line)}</tspan>`;
    });
    out += `<tspan x="${x}" dy="34" font-family="Georgia, serif" font-size="20" letter-spacing="1.2">${date}</tspan>`;
    out += `</text>`;
    return out;
  }

  async createMemoryDump({ chatId, booking, photos, caption }) {
    if (!photos || photos.length !== 5) {
      throw new Error('A Memory Dump requires exactly 5 photos.');
    }

    const tripDir = path.join(this.baseDir, String(chatId));
    fs.mkdirSync(tripDir, { recursive: true });

    const prepared = [];
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const ext = '.jpg';
      const filePath = path.join(tripDir, `photo_${i + 1}${ext}`);
      if (!photo.filePath) {
        await this.downloadTelegramPhoto(photo.bot, photo.fileId, filePath);
      } else if (photo.filePath !== filePath) {
        fs.copyFileSync(photo.filePath, filePath);
      }
      prepared.push({ ...photo, filePath });
    }

    const destination = this.safeText(booking?.location || 'Goa');
    const checkIn = this.safeText(booking?.checkIn || 'Trip');
    const checkOut = this.safeText(booking?.checkOut || '');
    const guestName = this.safeText(booking?.guestName || 'Traveler');
    const tripCaption = this.safeText(caption || 'Collecting moments, not things.');

    // Fixed 9:16 WhatsApp Status / Instagram Story layout: 1080 x 1920.
    // The composition deliberately keeps the same scrapbook structure for every user.
    const slots = [
      { x: 75, y: 330, w: 420, h: 520 },
      { x: 65, y: 900, w: 430, h: 430 },
      { x: 70, y: 1375, w: 430, h: 370 },
      { x: 555, y: 505, w: 445, h: 640 },
      { x: 555, y: 1205, w: 445, h: 500 },
    ];

    const photoMarkup = prepared.map((p, i) => this.imageElement(p, slots[i], i)).join('\n');
    const labels = [
      this.label(prepared[0], 85, 885, 390),
      this.label(prepared[1], 75, 1360, 400),
      this.label(prepared[2], 80, 1790, 390),
      this.label(prepared[3], 565, 1180, 420),
      this.label(prepared[4], 565, 1745, 420),
    ].join('\n');

    const stars = [
      '<path d="M85 180 l8 22 23 1 -18 14 6 23 -19 -13 -20 13 7 -23 -19 -14 23 -1z" fill="#c88a39"/>',
      '<path d="M970 110 l6 17 18 1 -14 11 5 18 -15 -10 -15 10 5 -18 -14 -11 18 -1z" fill="#8b6445"/>',
      '<path d="M1000 350 q35 -45 55 0 q-20 -10 -55 0" fill="none" stroke="#8b6445" stroke-width="4"/>',
      '<circle cx="515" cy="1480" r="9" fill="#c88a39"/>',
      '<circle cx="530" cy="1500" r="5" fill="#8b6445"/>',
    ].join('');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1920" viewBox="0 0 1080 1920">
  <rect width="1080" height="1920" fill="#f5ead4"/>
  <path d="M0 0H1080V185C850 145 660 230 430 180C245 140 120 190 0 155Z" fill="#efe0c2" opacity="0.72"/>
  <path d="M0 1790 Q250 1735 510 1805 T1080 1770 V1920 H0Z" fill="#d8b27a" opacity="0.55"/>
  <path d="M35 310 Q180 270 320 305" fill="none" stroke="#cfae7b" stroke-width="3"/>
  <path d="M720 188 Q835 230 1005 195" fill="none" stroke="#cfae7b" stroke-width="3"/>
  ${stars}

  <text x="70" y="92" font-family="Georgia, serif" font-size="54" font-weight="700" fill="#4f3828">StayWU</text>
  <text x="72" y="126" font-family="Georgia, serif" font-size="16" letter-spacing="4" fill="#8b6445">TRAVEL • EXPLORE • REMEMBER</text>
  <text x="745" y="92" font-family="cursive" font-size="45" fill="#4f3828">${destination}</text>
  <text x="748" y="126" font-family="Georgia, serif" font-size="18" letter-spacing="2" fill="#6e4f38">${checkIn} — ${checkOut}</text>

  <path d="M535 205 l25 22 l-25 22 l-25 -22z" fill="#c88a39" opacity="0.9"/>
  <text x="555" y="300" font-family="cursive" font-size="58" fill="#4f3828">Trip Memory Dump</text>
  <text x="558" y="348" font-family="Georgia, serif" font-size="17" letter-spacing="3" fill="#8b6445">FIVE MOMENTS • ONE JOURNEY</text>
  <path d="M560 380 C650 345 760 395 865 365" fill="none" stroke="#8b6445" stroke-width="3"/>

  ${photoMarkup}
  ${labels}

  <rect x="545" y="75" width="2" height="95" fill="#cfae7b"/>
  <text x="565" y="1870" font-family="Georgia, serif" font-size="18" letter-spacing="3" fill="#6e4f38">${guestName.toUpperCase()}</text>
  <text x="565" y="1905" font-family="cursive" font-size="31" fill="#4f3828">${tripCaption}</text>

  <g transform="translate(850 1795) rotate(-5)">
    <circle cx="0" cy="0" r="72" fill="none" stroke="#8b6445" stroke-width="4"/>
    <circle cx="0" cy="0" r="57" fill="none" stroke="#8b6445" stroke-width="2"/>
    <path d="M-20 22 Q0 -10 20 22" fill="none" stroke="#8b6445" stroke-width="4"/>
    <path d="M0 -35 L0 22 M-18 22 L18 22" stroke="#8b6445" stroke-width="4"/>
    <text x="0" y="-45" text-anchor="middle" font-family="Georgia, serif" font-size="12" letter-spacing="2" fill="#8b6445">STAYWU</text>
    <text x="0" y="48" text-anchor="middle" font-family="Georgia, serif" font-size="11" letter-spacing="2" fill="#8b6445">MEMORIES</text>
  </g>

  <text x="75" y="1870" font-family="cursive" font-size="31" fill="#6e4f38">collecting moments</text>
  <text x="75" y="1908" font-family="Georgia, serif" font-size="16" letter-spacing="2" fill="#8b6445">A TRIP BY STAYWU</text>
</svg>`;

    const fileId = crypto.randomUUID();
    const svgPath = path.join(tripDir, `StayWU_Memory_Dump_${fileId}.svg`);
    const pngPath = path.join(tripDir, `StayWU_Memory_Dump_${fileId}.png`);
    fs.writeFileSync(svgPath, svg, 'utf8');

    // Prefer Sharp for a real PNG suitable for Instagram/WhatsApp. If Sharp is
    // unavailable, try ImageMagick; the SVG is always retained as a fallback.
    let renderedPng = null;
    try {
      const sharp = require('sharp');
      await sharp(Buffer.from(svg)).png({ quality: 95 }).toFile(pngPath);
      renderedPng = pngPath;
    } catch (sharpError) {
      try {
        const { execFile } = require('child_process');
        await new Promise((resolve, reject) => {
          execFile('magick', [svgPath, '-background', 'none', pngPath], (error) => error ? reject(error) : resolve());
        });
        renderedPng = pngPath;
      } catch (imageMagickError) {
        console.warn('PNG rendering unavailable; keeping SVG fallback:', imageMagickError.message);
      }
    }

    return { svgPath, pngPath: renderedPng, fileId, photos: prepared };
  }
}

module.exports = MemoryDumpService;
