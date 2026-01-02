import React, { useEffect, useState } from 'react';
import { dbService } from '../../services/db';

const ConflictItem = ({ item, onResolve }) => {
  const resource = item.resource || 'unknown';

  const handleUseServer = async () => {
    try {
      if (item.server && resource) {
        await dbService.put(resource, item.server);
      }
      await dbService.delete('conflicts', item.id);
      onResolve();
    } catch (e) {
      alert('Failed to apply server version: ' + (e.message || e));
    }
  };

  const handleUseLocal = async () => {
    try {
      // Try to push local up to the server; server may accept with a special header
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = token.startsWith('demo-') ? token : `Bearer ${token}`;
      headers['X-Conflict-Resolution'] = 'local';

      const res = await fetch(item.url, {
        method: item.method || 'POST',
        headers,
        body: item.local ? JSON.stringify(item.local) : undefined
      });

      if (res && res.ok) {
        // On success, remove conflict and sync down
        await dbService.delete('conflicts', item.id);
        try { const { syncService } = await import('../../services/SyncService'); syncService.syncDataDown(); } catch (e) {}
        onResolve();
        return;
      }

      const text = res ? await res.text() : 'no response';
      alert('Server rejected local version: ' + text);
    } catch (e) {
      alert('Failed to send local version: ' + (e.message || e));
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this conflict record?')) return;
    await dbService.delete('conflicts', item.id);
    onResolve();
  };

  return (
    <div className="p-3 border rounded mb-3 bg-white">
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm text-slate-600">{resource} · {item.method} · {new Date(item.timestamp).toLocaleString()}</div>
        <div className="text-xs text-slate-500">Status: {item.status}</div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="font-medium">Local</div>
          <pre className="text-xs max-h-44 overflow-auto bg-slate-50 p-2">{JSON.stringify(item.local, null, 2)}</pre>
        </div>
        <div>
          <div className="font-medium">Server</div>
          <pre className="text-xs max-h-44 overflow-auto bg-slate-50 p-2">{JSON.stringify(item.server, null, 2)}</pre>
        </div>
      </div>

      <div className="flex gap-3 mt-3">
        <button onClick={handleUseServer} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">Use Server</button>
        <button onClick={handleUseLocal} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">Use Local</button>
        <button onClick={() => onResolve({ action: 'merge', item })} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm">Merge</button>
        <button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">Delete</button>
      </div>
    </div>
  );
};

const ConflictManager = () => {
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const items = await dbService.getAll('conflicts');
      setConflicts(items || []);
    } catch (e) {
      console.error('Failed to load conflicts', e);
      setConflicts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onMsg = (e) => {
      if (!e.data) return;
      if (e.data.type === 'CONFLICT_DETECTED') load();
    };
    try { navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', onMsg); } catch (e) {}
    return () => { try { navigator.serviceWorker && navigator.serviceWorker.removeEventListener('message', onMsg); } catch (e) {} };
  }, []);

  if (loading) return <div>Loading conflicts...</div>;

  if (!conflicts || conflicts.length === 0) return <div className="p-4 bg-slate-50 border rounded">No conflicts detected.</div>;

  return (
    <div className="p-4 bg-slate-50 border rounded">
      <h3 className="font-medium mb-3">Conflicts ({conflicts.length})</h3>
      {conflicts.map(c => (
        <ConflictItem key={c.id} item={c} onResolve={async (arg) => {
          if (arg && arg.action === 'merge') {
            // Lazy load the merge modal component to keep bundles small
            const mod = await import('./ConflictMergeModal.jsx');
            const MergeModal = mod && mod.default ? mod.default : null;
            if (MergeModal) {
              // Render modal via portal-like mount: we use a small approach—append to body
              const holder = document.createElement('div');
              document.body.appendChild(holder);

              const onClose = async () => {
                try { const ReactDOM = await import('react-dom'); ReactDOM.unmountComponentAtNode(holder); } catch (e) {}
                try { document.body.removeChild(holder); } catch (e) {}
                load();
              };

              const onMerged = () => { load(); };

              // Render react component imperatively
              try {
                const ReactDOM = await import('react-dom');
                ReactDOM.render(<MergeModal item={arg.item} onClose={onClose} onMerged={onMerged} />, holder);
              } catch (e) {
                console.error('Failed to render MergeModal', e);
                try { document.body.removeChild(holder); } catch (er) {}
              }

            } else {
              alert('Merge UI not available');
            }
            return;
          }
          // default resolution (refresh list)
          await load();
        }} />
      ))}
    </div>
  );
};

export default ConflictManager;
