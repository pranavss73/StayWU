/**
 * Centralized API Base Configuration for StayWU
 * Dynamically resolves backend endpoint for local dev and production deployments (Vercel / Render / Railway).
 */
export const BACKEND_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? '' // In case frontend & backend are proxied on same origin
    : 'http://localhost:3001')
).replace(/\/$/, '');

export const API_BASE = `${BACKEND_URL}/api`;

export default API_BASE;
