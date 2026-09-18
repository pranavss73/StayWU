# 🚀 StayWU Production Deployment Guide

This guide walks you through deploying **StayWU** for your hackathon/project presentation using the **best 100% free cloud services**.

---

## 🏗️ Deployment Architecture

| Component | Recommended Platform | Why | Free Tier Specs |
| :--- | :--- | :--- | :--- |
| **Frontend** | **Vercel** | Edge network, automatic Next.js optimization, instant SSL | 100% Free forever |
| **Backend & Telegram Bot** | **Render** or **Railway** | Continuous long-running Node.js process keeps `@StayWU_bot` polling 24/7 | Free Web Service |
| **AI Quota Protection** | **Dual Gemini Keys + Cache** | Built-in auto-failover to backup Plus key on quota exhaustion + 1hr response cache | 0 extra cost |

---

## ⚡ Step 1: Deploy the Backend (Render)

Render runs your Express server and keeps the **Telegram Bot daemon** active 24/7.

1. Push your repository to **GitHub**.
2. Go to [render.com](https://render.com) and create a free account.
3. Click **New +** $\rightarrow$ **Web Service**.
4. Connect your GitHub repository.
5. Configure the service:
   - **Name:** `staywu-backend`
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** `Free`
6. Under **Environment Variables**, add:
   ```env
   PORT=3001
   GEMINI_API_KEY=your_primary_gemini_api_key
   GEMINI_API_KEY_BACKUP=your_backup_gemini_api_key
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_BOT_USERNAME=StayWU_bot
   FRONTEND_URL=https://staywu.vercel.app
   CORS_ORIGIN=*
   ```
7. Click **Deploy Web Service**.
8. Once deployed, copy your backend URL (e.g., `https://staywu-backend.onrender.com`).

> [!TIP]
> Test that your deployed backend is running by opening:
> `https://staywu-backend.onrender.com/api/health`
> It will return: `{"status":"ok","hotels":2403,"places":43,"bot":true}`

---

## ⚡ Step 2: Deploy the Frontend (Vercel)

Vercel provides edge-accelerated Next.js hosting with instant SSL.

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New...** $\rightarrow$ **Project**.
3. Select your StayWU repository.
4. In the configuration screen:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** Click **Edit** and choose `client`.
5. Under **Environment Variables**, add:
   - **Key:** `NEXT_PUBLIC_API_URL`
   - **Value:** `https://staywu-backend.onrender.com` *(your Render backend URL from Step 1)*
6. Click **Deploy**.
7. In ~60 seconds, your site will be live at `https://staywu.vercel.app` (or custom name).

---

## ⚡ Step 3: Connect Firebase for Production

To allow Google Sign-In on your production domain:
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your project (`geek2code-ee7ae`).
3. Go to **Authentication** $\rightarrow$ **Settings** $\rightarrow$ **Authorized domains**.
4. Click **Add domain** and enter your Vercel URL (e.g. `staywu.vercel.app`).

---

## 🛡️ Step 4: Update Backend with Final Vercel URL

Once Vercel gives you your final URL (e.g., `https://staywu-abc.vercel.app`):
1. In your **Render** dashboard for `staywu-backend`, update:
   - `FRONTEND_URL=https://staywu-abc.vercel.app`
2. Save changes (Render will automatically re-deploy in 15 seconds).
3. Now all Telegram bot launch links and Document Vault QR access URLs will automatically point to your live Vercel domain!

---

## 🏆 Alternative: The 10-Second Cloudflare Tunnel (Zero-Risk Hackathon Demo)

If you are presenting today and prefer running directly from your laptop with zero cold-starts or deployment risk:

1. In your terminal, start the app locally:
   ```bash
   npm run dev
   ```
2. In a second terminal window, run:
   ```bash
   npx cloudflared tunnel --url http://localhost:3000
   ```
3. Cloudflare will generate a public HTTPS URL (e.g., `https://brave-traveler-demo.trycloudflare.com`).
4. You can immediately share that link or QR code with the judges. It routes directly to your laptop with zero latency and full access to your local files and Telegram bot!

---

## 🧠 How Gemini Rate Limits Are Protected

1. **Dual-Key Failover:** The backend watches for `429 Too Many Requests` or quota exhaustion. If `GEMINI_API_KEY` hits a limit, it instantly switches to `GEMINI_API_KEY_BACKUP` without failing the user request.
2. **In-Memory Cache:** All generated itineraries and chatbot answers are hashed and cached with a 1-hour TTL. Repeated queries during judge demos return in **<10ms** with **0 API quota consumption**.
3. **Emergency Fallback:** If both Google keys ever encounter a Google-side network outage, a structured 7-day weather-integrated emergency itinerary is returned so your demo never crashes.
