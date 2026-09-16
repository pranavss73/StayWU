import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// StayWU Firebase configuration provided by user
const firebaseConfig = {
  apiKey: "AIzaSyC2xbhtYf3v77QU00o3Ikn7RZvEhPm_rPs",
  authDomain: "geek2code-ee7ae.firebaseapp.com",
  projectId: "geek2code-ee7ae",
  storageBucket: "geek2code-ee7ae.firebasestorage.app",
  messagingSenderId: "429179982633",
  appId: "1:429179982633:web:f9821a31b27b13ef5f5d38"
};

// Initialize Firebase (guard against Next.js Hot Reload duplicate app initialization)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, googleProvider };
