/** Enregistre le service worker (en production uniquement : en dev, Vite gère le rechargement). */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Service worker :', err));
  });
}
