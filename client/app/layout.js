import "./globals.css";
import { AuthProvider } from "../context/AuthContext";

export const metadata = {
  title: "StayWU — Book with Confidence, Travel with an AI Guide",
  description: "AI-powered hotel trust verification and trip concierge for Goa. Verified hotels, scam detection, neighborhood vibes, and a personal Telegram trip planner.",
  keywords: "Goa hotels, trust verification, AI trip planner, scam detection, travel concierge",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
