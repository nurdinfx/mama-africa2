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
  } catch { }
}

loadConfig().finally(() => {
  renderApp()
  if ('serviceWorker' in navigator) {
    // Use Vite PWA virtual register for better update lifecycle handling
    try {
      // Lazy import for SSR safety - use promise-based import to avoid top-level await in build
      import('virtual:pwa-register')
        .then(({ registerSW }) => {
          const updateSW = registerSW({
            onNeedRefresh() {
              console.log('A new version is available. Call updateSW(true) to apply.');
              window.__PWA_UPDATE_AVAILABLE__ = true;
            },
            onOfflineReady() {
              console.log('App is ready to work offline.');
              window.__PWA_OFFLINE_READY__ = true;
            }
          });
          window.__UPDATE_SW__ = updateSW;
        })
        .catch((e) => {
          console.warn('Vite PWA register not available, falling back to manual registration', e);
          window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
              .then(registration => console.log('SW registered: ', registration))
              .catch(registrationError => console.log('SW registration failed: ', registrationError));
          });
        });
    } catch (e) {
      console.warn('Vite PWA register import error', e);
    }

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('New service worker activated, reloading the page...');
      window.location.reload();
    });

    // Listen for messages from the Service Worker (e.g., to trigger outbox flush)
    navigator.serviceWorker.addEventListener('message', (event) => {
      try {
        const data = event.data || {};
        if (data.type === 'RETRY_OUTBOX' || data.type === 'OUTBOX_ENQUEUED') {
          console.log('Service Worker requested outbox flush');
          outboxService.flushOutbox();
        }
      } catch (e) {
        console.warn('Failed to handle SW message', e);
      }
    });
  }
})

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
