import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { processQueue } from './services/offlineQueue'
import { realApi } from './api/realApi'
import { outboxService } from './services/outbox'


const renderApp = () => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

const loadConfig = async () => {
  try {
    const res = await fetch('/config.json')
    if (res.ok) {
      const cfg = await res.json()
      if (typeof window !== 'undefined') {
        window.__APP_CONFIG__ = cfg
      }
    }
  } catch (e) {
    console.error('Failed to load config.json', e)
  }
}

// Load config first, then render the app
loadConfig().finally(async () => {
  renderApp()

  // Ensure DB seeded after first render
  try {
    const { ensureSeeded } = await import('./services/offlineInit');
    ensureSeeded().then((r) => console.log('Offline seed status:', r));
  } catch (e) {
    console.warn('Failed to ensure DB seeded', e);
  }

  // Service worker registration is handled below
})

// Process offline queue when back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processQueue({
      'order.update': async ({ id, updateData }) => {
        if (typeof realApi.updateOrder === 'function') {
          await realApi.updateOrder(id, updateData)
        }
      }
    })
  })
}

// Register a service worker to enable full offline PWA behavior and handle updates
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // Register after load to avoid blocking initial render
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('✅ Service Worker registered:', reg);

      // If there's an already waiting SW, notify clients about update
      if (reg.waiting) {
        try { reg.waiting.postMessage({ type: 'NEW_VERSION_AVAILABLE' }); } catch (e) {}
      }

      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New update available
              try { reg.waiting.postMessage({ type: 'NEW_VERSION_AVAILABLE' }); } catch (e) {}
            } else {
              console.log('✅ Content is cached for offline use.');
            }
          }
        });
      });
    }).catch((err) => console.warn('Service Worker registration failed:', err));

    // Listen for incoming SW messages (e.g., updates)
    navigator.serviceWorker.addEventListener('message', (e) => {
      const data = e.data || {};
      if (data && data.type === 'NEW_VERSION_AVAILABLE') {
        console.log('🔔 New app version available. You may refresh to update.');
        // Optionally, trigger a UI notification to let user refresh gracefully
      }
    });
  });
}
