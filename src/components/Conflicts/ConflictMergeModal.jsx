import React, { useMemo, useState } from 'react';
import { dbService } from '../../services/db';

const stringify = (v) => {
  try { return typeof v === 'string' ? v : JSON.stringify(v, null, 2); } catch (e) { return String(v); }
};

const parseMaybeJSON = (s) => {
  try { return JSON.parse(s); } catch (e) { return s; }
};

const ConflictMergeModal = ({ item, onClose, onMerged }) => {
  const local = item.local || {};
  const server = item.server || {};

  const fields = useMemo(() => {
    const keys = new Set([...Object.keys(local), ...Object.keys(server)]);
    return Array.from(keys);
  }, [local, server]);

  const initial = fields.reduce((acc, k) => {
    acc[k] = {
      choice: local[k] !== undefined ? 'local' : (server[k] !== undefined ? 'server' : 'custom'),
      value: stringify(local[k] !== undefined ? local[k] : server[k])
    };
    return acc;
  }, {});

  const [state, setState] = useState(initial);
  const [saving, setSaving] = useState(false);

  const handleChoice = (key, choice) => {
    setState(prev => ({ ...prev, [key]: { ...prev[key], choice } }));
  };

  const handleValueChange = (key, value) => {
    setState(prev => ({ ...prev, [key]: { ...prev[key], value } }));
  };

  const buildMerged = () => {
    const merged = {};
    for (const k of fields) {
      const cfg = state[k];
      if (!cfg) continue;
      if (cfg.choice === 'server') {
        merged[k] = server[k];
      } else if (cfg.choice === 'local') {
        merged[k] = local[k];
      } else {
        merged[k] = parseMaybeJSON(cfg.value);
      }
    }
    return merged;
  };

  const handleApplyMerge = async () => {
    setSaving(true);
    try {
      const merged = buildMerged();
      // Send merged object to server
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json', 'X-Conflict-Resolution': 'merge' };
      if (token) headers['Authorization'] = token.startsWith('demo-') ? token : `Bearer ${token}`;

      const res = await fetch(item.url, { method: item.method || 'POST', headers, body: JSON.stringify(merged) });
      if (res && res.ok) {
        // Update local DB with merged
        const resource = item.resource || item.url.replace(/^\/api\/v1\//, '').split('/')[0];
        if (resource) {
          try { await dbService.put(resource, merged); } catch (e) { /* ignore */ }
        }
        // Remove conflict record
        await dbService.delete('conflicts', item.id);
        try { const { syncService } = await import('../../services/SyncService'); syncService.syncDataDown(); } catch (e) {}
        onMerged && onMerged();
        onClose && onClose();
        return;
      }

      const text = res ? await res.text() : 'no response';
      alert('Server rejected merged version: ' + text);
    } catch (e) {
      alert('Failed to apply merge: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-[90%] md:w-3/4 max-h-[90%] overflow-auto p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Resolve Conflict</h3>
          <div className="text-xs text-slate-500">{item.resource} · {new Date(item.timestamp).toLocaleString()}</div>
        </div>

        <div className="grid gap-3">
          {fields.map((k) => (
            <div key={k} className="border rounded p-3 bg-slate-50">
              <div className="flex items-start justify-between">
                <div className="font-medium">{k}</div>
                <div className="flex gap-2">
                  <label className="text-xs"><input type="radio" checked={state[k].choice === 'server'} onChange={() => handleChoice(k, 'server')} /> <span className="ml-1">Server</span></label>
                  <label className="text-xs"><input type="radio" checked={state[k].choice === 'local'} onChange={() => handleChoice(k, 'local')} /> <span className="ml-1">Local</span></label>
                  <label className="text-xs"><input type="radio" checked={state[k].choice === 'custom'} onChange={() => handleChoice(k, 'custom')} /> <span className="ml-1">Custom</span></label>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-medium">Server</div>
                  <pre className="text-xs max-h-28 overflow-auto bg-white p-2 border">{stringify(server[k])}</pre>
                </div>
                <div>
                  <div className="font-medium">Local</div>
                  <pre className="text-xs max-h-28 overflow-auto bg-white p-2 border">{stringify(local[k])}</pre>
                </div>
              </div>

              {state[k].choice === 'custom' && (
                <div className="mt-2">
                  <textarea className="w-full border p-2 text-xs" rows={4} value={state[k].value} onChange={(e) => handleValueChange(k, e.target.value)} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
          <button onClick={handleApplyMerge} disabled={saving} className="px-3 py-1 bg-indigo-600 text-white rounded">{saving ? 'Applying…' : 'Apply Merge'}</button>
        </div>
      </div>
    </div>
  );
};

export default ConflictMergeModal;
