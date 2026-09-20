const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

module.exports = function (tripBot, llmService) {
  // Statically serve memory output images from server/memory_data
  const memoryDataDir = path.join(__dirname, '..', 'memory_data');
  fs.mkdirSync(memoryDataDir, { recursive: true });
  router.use('/media', express.static(memoryDataDir));

  // GET /api/memories/latest - get the latest generated memory dump
  router.get('/latest', (req, res) => {
    try {
      const chatId = req.query.chatId || 'demo_user';
      const userDir = path.join(memoryDataDir, String(chatId));
      if (!fs.existsSync(userDir)) {
        return res.json({ available: false });
      }

      const files = fs.readdirSync(userDir);
      const pngFiles = files.filter(f => f.endsWith('.png')).sort().reverse();
      const svgFiles = files.filter(f => f.endsWith('.svg')).sort().reverse();

      if (pngFiles.length === 0 && svgFiles.length === 0) {
        return res.json({ available: false });
      }

      const latestPng = pngFiles[0] ? `/api/memories/media/${chatId}/${pngFiles[0]}` : null;
      const latestSvg = svgFiles[0] ? `/api/memories/media/${chatId}/${svgFiles[0]}` : null;

      res.json({
        available: true,
        chatId,
        pngUrl: latestPng,
        svgUrl: latestSvg,
        filename: pngFiles[0] || svgFiles[0],
      });
    } catch (err) {
      console.error('Failed to get latest memory dump:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/memories/demo - 1-tap demo mode using local demo_images
  router.post('/demo', async (req, res) => {
    try {
      const rootDir = path.join(__dirname, '..', '..');
      let demoDir = path.join(rootDir, 'demo_images');
      if (!fs.existsSync(demoDir)) {
        demoDir = path.join(__dirname, '..', 'demo_images');
      }

      if (!fs.existsSync(demoDir)) {
        return res.status(404).json({ error: 'demo_images folder not found.' });
      }

      const rawFiles = fs.readdirSync(demoDir).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
      if (rawFiles.length < 5) {
        return res.status(400).json({ error: `demo_images has ${rawFiles.length} photos; requires at least 5.` });
      }

      const captions = [
        { place: 'Chapora Fort', dateLabel: '20 Sep 2026' },
        { place: 'Anjuna Flea Market', dateLabel: '21 Sep 2026' },
        { place: 'Curlies Beach Shack', dateLabel: '22 Sep 2026' },
        { place: 'Fontainhas Latin Quarter', dateLabel: '23 Sep 2026' },
        { place: 'Vagator Sunset Point', dateLabel: '24 Sep 2026' },
      ];

      const photos = rawFiles.slice(0, 5).map((f, i) => ({
        filePath: path.join(demoDir, f),
        place: captions[i].place,
        dateLabel: captions[i].dateLabel,
      }));

      const booking = {
        location: 'North Goa',
        checkIn: '20 Sep 2026',
        checkOut: '25 Sep 2026',
        guestName: req.body?.guestName || 'Pranav',
      };

      // Generate AI caption
      let caption = 'Chasing sunsets and salty breezes.';
      try {
        if (llmService) {
          caption = await llmService.generateMemoryCaption(booking, photos);
        }
      } catch (captionErr) {
        console.warn('Demo caption fallback:', captionErr.message);
      }

      const memoryService = tripBot?.memoryDumpService || new (require('../services/memoryDump'))();
      const chatId = 'demo_user';
      const result = await memoryService.createMemoryDump({
        chatId,
        booking,
        photos,
        caption,
      });

      const pngFilename = result.pngPath ? path.basename(result.pngPath) : null;
      const svgFilename = result.svgPath ? path.basename(result.svgPath) : null;

      res.json({
        success: true,
        fileId: result.fileId,
        pngUrl: pngFilename ? `/api/memories/media/${chatId}/${pngFilename}` : null,
        svgUrl: svgFilename ? `/api/memories/media/${chatId}/${svgFilename}` : null,
        caption,
        photos: captions,
        booking,
      });
    } catch (err) {
      console.error('Error generating demo memory dump:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
