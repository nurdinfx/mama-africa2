import React, { useEffect, useState } from 'react';

const InstallPrompt = () => {
  const [promptEvent, setPromptEvent] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setPromptEvent(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const install = async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice && choice.outcome === 'accepted') {
      setVisible(false);
      setPromptEvent(null);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-white/90 text-black px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3">
      <div className="flex-1 text-sm">Install Mama Africa app for quick access and offline use.</div>
      <button onClick={install} className="bg-blue-600 text-white px-3 py-1 rounded">Install</button>
      <button onClick={() => setVisible(false)} className="text-sm px-2">Dismiss</button>
    </div>
  );
};

export default InstallPrompt;