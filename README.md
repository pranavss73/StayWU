# 🌴 StayWU — Goa Hotel Trust & Discovery + AI Trip Concierge

> **Book with Confidence, Travel with an AI Guide.**  
> StayWU combines curated hotel discovery, AI-driven trust scoring, real-time weather analytics, and an intelligent Telegram travel concierge for visitors exploring Goa.

---

## 🌟 Key Features

### 🏨 Web Platform (Next.js)
- **Hotel Discovery & Recommender**: Browse curated hotels across North & South Goa with filters for price, location, amenities, and user ratings.
- **Trust & Sentiment Analytics**: In-depth review breakdown with sentiment analysis, trust score meters, and verified highlights to avoid deceptive listings.
- **Side-by-Side Comparison**: Compare multiple accommodations by value, location advantage, amenities, and trust metrics.
- **In-Browser AI Chat Concierge**: Instant travel recommendations and local insider tips powered by Google Gemini.
- **Seamless Booking Flow**: Seamless simulated booking process with instant confirmation and simulated vouchers.

### 🤖 Telegram AI Trip Concierge & Weather Guide
- **Telegram Bot (`@StayWU_bot`)**: Real-time travel assistant on Telegram powered by Google Gemini AI.
- **Real-Time Weather Integration**: Live weather conditions and 7-day forecasts across North and South Goa powered by the Open-Meteo API.
- **Dynamic PDF Itineraries**: Generates comprehensive, beautifully formatted PDF itineraries tailored to your dates and destination, delivered directly in your Telegram chat.
- **Interactive Commands**:
  - `/start` — Welcome guide and quick-action menu
  - `/weather [location]` — Current weather & 7-day forecast for Goa
  - `/hotels [location]` — Top recommended stays with trust scores
  - `/itinerary [days]` — Generate and download a personalized PDF travel plan
  - `/help` — List of concierge commands

---

## 🏗️ Architecture & Tech Stack

- **Frontend**: Next.js (App Router), React, Lucide Icons, Modern Vanilla CSS Design System
- **Backend**: Node.js, Express.js, CORS
- **AI / LLM**: Google Gemini (`@google/genai` / `@google/generative-ai`)
- **Weather API**: Open-Meteo (real-time meteorological data, UV index, forecasts)
- **Bot Engine**: `node-telegram-bot-api`
- **PDF Generation**: `pdfkit`
- **Data Layer**: JSON & CSV datasets for Goa hotels, locations, and tourist attractions

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Git](https://git-scm.com/)

### 1. Clone the Repository
```bash
git clone https://github.com/pranavss73/StayWU.git
cd StayWU
```

### 2. Install Dependencies
Install all root, server, and client dependencies:
```bash
npm run install:all
npm install
```

### 3. Configure Environment Variables
Copy the example environment file in `server/`:
```bash
cp server/.env.example server/.env
```
Edit `server/.env` and provide your credentials:
```env
# Google Gemini API Key (Get at https://aistudio.google.com/)
GEMINI_API_KEY=your_gemini_api_key_here

# Telegram Bot Token (Get from @BotFather on Telegram)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_BOT_USERNAME=StayWU_bot

# Backend Port
PORT=3001
```

### 4. Run the Application
Run both backend server and frontend client concurrently:
```bash
npm run dev
```
*Or on Windows, double-click `start.bat`.*

- **Web Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:3001](http://localhost:3001)
- **API Health Check**: [http://localhost:3001/api/health](http://localhost:3001/api/health)

---

## 📁 Project Structure

```
StayWU/
├── client/                 # Next.js frontend application
│   ├── app/                # App router pages & layouts
│   ├── components/         # Reusable UI components
│   ├── context/            # State management contexts
│   └── public/             # Static assets
├── server/                 # Express backend server
│   ├── bot/                # Telegram bot handlers & flows
│   ├── routes/             # Express API routes (/hotels, /chat, /bookings)
│   ├── services/           # Services (LLM, Data, Weather, PDF generation)
│   └── temp/               # Ephemeral storage for generated PDF files
├── data/                   # Goa hotel datasets & tourist places JSON
├── start.bat               # Windows one-click start script
├── package.json            # Root workspace scripts & concurrency runner
└── README.md
```

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
