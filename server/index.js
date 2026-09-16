const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');

const DataService = require('./services/data');
const LLMService = require('./services/llm');
const TripBot = require('./bot/telegram');

const hotelsRoutes = require('./routes/hotels');
const chatRoutes = require('./routes/chat');
const bookingsRoutes = require('./routes/bookings');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const dataService = new DataService();
const llmService = new LLMService(process.env.GEMINI_API_KEY);

// Initialize Telegram bot
const tripBot = new TripBot(
  process.env.TELEGRAM_BOT_TOKEN,
  dataService,
  llmService
);

// Routes
app.use('/api/hotels', hotelsRoutes(dataService));
app.use('/api/chat', chatRoutes(dataService, llmService));
app.use('/api/bookings', bookingsRoutes(dataService));

// Places endpoint
app.get('/api/places', (req, res) => {
  res.json(dataService.getPlaces());
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hotels: dataService.hotels.length,
    places: dataService.places.length,
    bot: !!tripBot.bot,
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 StayWU Server running at http://localhost:${PORT}`);
  console.log(`📊 ${dataService.hotels.length} hotels | ${dataService.places.length} places loaded`);
  console.log(`🤖 Telegram Bot: ${tripBot.bot ? 'Active' : 'Not configured (add TELEGRAM_BOT_TOKEN to .env)'}`);
  console.log(`🧠 Gemini AI: ${process.env.GEMINI_API_KEY ? 'Configured' : 'Not configured'}\n`);
});

process.on('unhandledRejection', (reason) => {
  console.warn('Unhandled Rejection:', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});
