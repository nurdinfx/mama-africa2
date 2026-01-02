import React, { useEffect, useState } from 'react';

const UpdatePrompt = () => {
  const [visible, setVisible] = useState(false);
  const [waitingSW, setWaitingSW] = useState(null);

  useEffect(() => {
    // Listen to service worker messages
    const handler = (e) => {
      if (!e?.data) return;
      if (e.data.type === 'NEW_VERSION_AVAILABLE') {
        // Try to get waiting service worker reference
        navigator.serviceWorker.getRegistration().then((reg) => {
          setWaitingSW(reg && reg.waiting ? reg.waiting : null);
          setVisible(true);
        }).catch(() => setVisible(true));
      }
      if (e.data.type === 'OUTBOX_ENQUEUED') {
        // Optional: show a small toast or indicator — handled elsewhere
      }
    };

    navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', handler);

    // Also listen to a custom DOM event (fallback)
    const domHandler = (ev) => {
      if (ev?.detail?.type === 'NEW_VERSION_AVAILABLE') {
        setVisible(true);
      }
    };
    window.addEventListener('new-version-available', domHandler);

    return () => {
      navigator.serviceWorker && navigator.serviceWorker.removeEventListener('message', handler);
      window.removeEventListener('new-version-available', domHandler);
    };
  }, []);

  const refresh = () => {
    try {
      if (waitingSW) {
        waitingSW.postMessage({ type: 'SKIP_WAITING' });
      } else if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
        return;
      }

      // Listen for controller change and reload when new SW takes control
      const onControllerChange = () => {
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

      // Safety: hide the prompt after asking to refresh
      setVisible(false);
    } catch (e) {
      // fallback
      window.location.reload();
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-white/90 text-black rounded-lg shadow-lg border px-4 py-3 flex items-center space-x-4">
        <div className="flex-1">
          <div className="font-bold">New version available</div>
          <div className="text-sm text-gray-600">Install the update to get the latest features and fixes.</div>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => setVisible(false)} className="px-3 py-1 text-sm rounded bg-gray-200">Dismiss</button>
          <button onClick={refresh} className="px-3 py-1 text-sm rounded bg-blue-500 text-white">Refresh</button>
        </div>
      </div>
    </div>
  );
};

export default UpdatePrompt;
