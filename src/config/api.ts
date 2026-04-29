// src/config/api.ts
// Si hay variable de entorno VITE_API_URL la usa, sino detecta automáticamente
const detectBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  // En producción usa el host actual con puerto 3001
  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost') {
    return `http://${window.location.hostname}:3001`;
  }
  return "http://195.35.40.161:3001";
};

export const BASE_URL = detectBaseUrl();
export const API_URL = `${BASE_URL}/api`;