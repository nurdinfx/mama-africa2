// components/Settings/SystemSettings.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { settingsAPI } from '../../api/settings';

const SystemSettings = () => {
  const { branch } = useAuth();
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    loadSettings();
  }, [branch]);

  const loadSettings = async () => {
    try {
      const branchSettings = await settingsAPI.getBranchSettings(branch._id);
      setSettings(branchSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const updateSettings = async (updatedSettings) => {
    try {
      const result = await settingsAPI.updateBranchSettings(branch._id, updatedSettings);
      setSettings(result);
      // Show success message
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  if (!settings) return <div>Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">System Settings</h1>
      
      <div className="bg-white rounded-lg shadow">
        {/* Tab Navigation */}
        <div className="border-b">
          <nav className="flex -mb-px">
            {['general', 'receipt', 'pos', 'modules'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-6 font-medium capitalize ${
                  activeTab === tab
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'general' && (
            <GeneralSettings 
              settings={settings} 
              onUpdate={updateSettings} 
            />
          )}
          
          {activeTab === 'receipt' && (
            <ReceiptSettings 
              settings={settings.receiptSettings} 
              onUpdate={(receiptSettings) => 
                updateSettings({ ...settings, receiptSettings })
              } 
            />
          )}
          
          {activeTab === 'pos' && (
            <POSSettings 
              settings={settings.posSettings} 
              onUpdate={(posSettings) => 
                updateSettings({ ...settings, posSettings })
              } 
            />
          )}
          
          {activeTab === 'modules' && (
            <ModuleSettings 
              settings={settings.systemConfig} 
              onUpdate={(systemConfig) => 
                updateSettings({ ...settings, systemConfig })
              } 
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Sub-components for each settings section
const GeneralSettings = ({ settings, onUpdate }) => (
  <div className="space-y-6">
    <h2 className="text-xl font-semibold">Restaurant Information</h2>
    
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium mb-2">Business Name</label>
        <input
          type="text"
          value={settings.name}
          onChange={(e) => onUpdate({ ...settings, name: e.target.value })}
          className="w-full p-2 border rounded"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">Branch Code</label>
        <input
          type="text"
          value={settings.branchCode}
          onChange={(e) => onUpdate({ ...settings, branchCode: e.target.value })}
          className="w-full p-2 border rounded"
        />
      </div>
    </div>
    
    {/* Add more general settings fields */}
  </div>
);

const ReceiptSettings = ({ settings, onUpdate }) => (
  <div className="space-y-6">
    <h2 className="text-xl font-semibold">Receipt Settings</h2>
    
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Header Text</label>
        <textarea
          value={settings.headerText}
          onChange={(e) => onUpdate({ ...settings, headerText: e.target.value })}
          className="w-full p-2 border rounded"
          rows="3"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.showTax}
              onChange={(e) => onUpdate({ ...settings, showTax: e.target.checked })}
              className="mr-2"
            />
            Show Tax on Receipt
          </label>
        </div>
        
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.showWaiter}
              onChange={(e) => onUpdate({ ...settings, showWaiter: e.target.checked })}
              className="mr-2"
            />
            Show Waiter Name
          </label>
        </div>
      </div>
    </div>
  </div>
);

export default SystemSettings;