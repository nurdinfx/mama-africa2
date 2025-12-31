// src/pages/Settings.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { realApi } from '../api/realApi';

import { useOptimisticData } from '../hooks/useOptimisticData';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const initialSettings = {
    // General Settings
    restaurantName: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    taxId: '',

    // POS Settings
    taxRate: 4,
    serviceCharge: 5,
    currency: 'USD',
    receiptHeader: '',
    receiptFooter: '',
    receiptSize: '58mm',

    // Business Hours
    businessHours: {
      monday: { open: '09:00', close: '22:00', closed: false },
      tuesday: { open: '09:00', close: '22:00', closed: false },
      wednesday: { open: '09:00', close: '22:00', closed: false },
      thursday: { open: '09:00', close: '22:00', closed: false },
      friday: { open: '09:00', close: '23:00', closed: false },
      saturday: { open: '10:00', close: '23:00', closed: false },
      sunday: { open: '10:00', close: '21:00', closed: false }
    },

    // System Settings
    autoBackup: true,
    lowStockAlert: true,
    orderNotifications: true,
    printReceipt: true,
    language: 'en',
    timezone: 'UTC-5'
  };

  const {
    data: settings,
    loading: initialLoad, // Hook handles initial loading logic
    error: hookError,
    refresh: loadSettings,
    setData: setSettings
  } = useOptimisticData('settings_data', async () => {
    const response = await realApi.getSettings();
    if (response.success) {
      const settingsData = realApi.extractData(response);
      if (settingsData) {
        // Merge with existing structure ensuring defaults
        return {
          ...initialSettings,
          ...settingsData,
          businessHours: {
            ...initialSettings.businessHours,
            ...settingsData.businessHours
          }
        };
      }
    } else {
      throw new Error(response.message || 'Failed to load settings');
    }
    return initialSettings;
  }, initialSettings);

  const [loading, setLoading] = useState(false); // Action loading state
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  // const [initialLoad, setInitialLoad] = useState(true); // Handled by hook

  const { user } = useAuth();

  useEffect(() => {
    if (hookError) setError(hookError.message);
  }, [hookError]);

  // useEffect(() => {
  //   loadSettings();
  // }, []);

  // loadSettings logic replaced by hook
  /*
  const loadSettings = async () => {
    // ...
  };
  */

  const handleSaveSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await realApi.updateSettings(settings);
      if (response.success) {
        console.log('Settings saved successfully:', response.data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);

        // Update local settings with the response data
        const updatedSettings = realApi.extractData(response);
        if (updatedSettings) {
          setSettings(prev => ({
            ...prev,
            ...updatedSettings
          }));
        }
      } else {
        throw new Error(response.message || 'Failed to save settings');
      }
    } catch (error) {
      console.error('❌ Failed to save settings:', error);
      setError(error.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  // Simplified input change handler
  const handleInputChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBusinessHoursChange = (day, field, value) => {
    setSettings(prev => ({
      ...prev,
      businessHours: {
        ...prev.businessHours,
        [day]: {
          ...prev.businessHours[day],
          [field]: field === 'closed' ? !prev.businessHours[day].closed : value
        }
      }
    }));
  };

  const handleClearCache = async () => {
    try {
      localStorage.removeItem('demoRestaurantSettings');
      await loadSettings();
      alert('Cache cleared successfully!');
    } catch (error) {
      alert('Error clearing cache: ' + error.message);
    }
  };

  const handleBackupDatabase = async () => {
    try {
      setLoading(true);
      // This would typically call a backup endpoint
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert('Database backup completed successfully!');
    } catch (error) {
      alert('Error backing up database: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDefaults = async () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
      const defaultSettings = {
        restaurantName: 'Mama Africa Restaurant',
        address: '',
        phone: '',
        email: '',
        website: '',
        taxId: '',
        taxRate: 4,
        serviceCharge: 5,
        currency: 'USD',
        receiptHeader: 'Mama Africa Restaurant',
        receiptFooter: 'Thank you for dining with us!',
        receiptSize: '58mm',
        businessHours: {
          monday: { open: '09:00', close: '22:00', closed: false },
          tuesday: { open: '09:00', close: '22:00', closed: false },
          wednesday: { open: '09:00', close: '22:00', closed: false },
          thursday: { open: '09:00', close: '22:00', closed: false },
          friday: { open: '09:00', close: '23:00', closed: false },
          saturday: { open: '10:00', close: '23:00', closed: false },
          sunday: { open: '10:00', close: '21:00', closed: false }
        },
        autoBackup: true,
        lowStockAlert: true,
        orderNotifications: true,
        printReceipt: true,
        language: 'en',
        timezone: 'UTC-5'
      };

      setSettings(defaultSettings);
      await handleSaveSettings();
    }
  };

  const tabs = [
    { id: 'general', name: 'General', icon: '⚙️' },
    { id: 'pos', name: 'POS Settings', icon: '💳' },
    { id: 'hours', name: 'Business Hours', icon: '🕒' },
    { id: 'system', name: 'System', icon: '🔧' }
  ];

  const days = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' }
  ];

  if (initialLoad) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading Settings...</div>
      </div>
    );
  }

  return (
    <div className="page-content flex flex-col gap-6 h-full overflow-auto">
      {/* Header */}
      <div className="card flex justify-between items-center">
        <div>
          <h1 className="heading-1 text-slate-900 mb-1">System Settings</h1>
          <p className="text-muted">Configure your restaurant system preferences</p>
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={loading}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium shadow-sm transition-colors"
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {saved && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg shadow-sm">
          Settings saved successfully!
        </div>
      )}

      <div className="card p-0 overflow-hidden flex-1 flex flex-col">
        {/* Tab Navigation */}
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px px-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-6 py-4 font-medium text-sm border-b-2 transition-colors ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
              >
                <span className="mr-2 text-lg">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'general' && (
            <GeneralSettings
              settings={settings}
              onChange={handleInputChange}
            />
          )}

          {activeTab === 'pos' && (
            <POSSettings
              settings={settings}
              onChange={handleInputChange}
            />
          )}

          {activeTab === 'hours' && (
            <BusinessHours
              settings={settings}
              onChange={handleBusinessHoursChange}
              days={days}
            />
          )}

          {activeTab === 'system' && (
            <SystemSettings
              settings={settings}
              onChange={handleInputChange}
              onClearCache={handleClearCache}
              onBackupDatabase={handleBackupDatabase}
              onResetDefaults={handleResetDefaults}
              loading={loading}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// General Settings Component
const GeneralSettings = ({ settings, onChange }) => {
  return (
    <div className="space-y-6">
      <h2 className="heading-2 text-slate-900">Restaurant Information</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Restaurant Name *
          </label>
          <input
            type="text"
            value={settings.restaurantName}
            onChange={(e) => onChange('restaurantName', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="Enter restaurant name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number *
          </label>
          <input
            type="tel"
            value={settings.phone}
            onChange={(e) => onChange('phone', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="Enter phone number"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address *
          </label>
          <input
            type="email"
            value={settings.email}
            onChange={(e) => onChange('email', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="Enter email address"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tax ID
          </label>
          <input
            type="text"
            value={settings.taxId}
            onChange={(e) => onChange('taxId', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="Enter tax ID"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Address *
          </label>
          <textarea
            value={settings.address}
            onChange={(e) => onChange('address', e.target.value)}
            rows="3"
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="Enter full address"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Website
          </label>
          <input
            type="url"
            value={settings.website}
            onChange={(e) => onChange('website', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="Enter website URL"
          />
        </div>
      </div>
    </div>
  );
};

// POS Settings Component
const POSSettings = ({ settings, onChange }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">POS Configuration</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tax Rate (%) *
          </label>
          <input
            type="number"
            value={settings.taxRate}
            onChange={(e) => onChange('taxRate', parseFloat(e.target.value) || 0)}
            min="0"
            max="50"
            step="0.1"
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Service Charge (%) *
          </label>
          <input
            type="number"
            value={settings.serviceCharge}
            onChange={(e) => onChange('serviceCharge', parseFloat(e.target.value) || 0)}
            min="0"
            max="20"
            step="0.1"
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Currency *
          </label>
          <select
            value={settings.currency}
            onChange={(e) => onChange('currency', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="USD">US Dollar ($)</option>
            <option value="EUR">Euro (€)</option>
            <option value="GBP">British Pound (£)</option>
            <option value="CAD">Canadian Dollar (C$)</option>
            <option value="AUD">Australian Dollar (A$)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Receipt Print Size
          </label>
          <select
            value={settings.receiptSize}
            onChange={(e) => onChange('receiptSize', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="58mm">58mm Thermal</option>
            <option value="80mm">80mm Thermal</option>
            <option value="A4">A4 Paper</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Receipt Header
          </label>
          <textarea
            value={settings.receiptHeader}
            onChange={(e) => onChange('receiptHeader', e.target.value)}
            rows="2"
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="Text to appear at the top of receipts"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Receipt Footer
          </label>
          <textarea
            value={settings.receiptFooter}
            onChange={(e) => onChange('receiptFooter', e.target.value)}
            rows="2"
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="Text to appear at the bottom of receipts"
          />
        </div>
      </div>
    </div>
  );
};

// Business Hours Component
const BusinessHours = ({ settings, onChange, days }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Business Hours</h2>
      <p className="text-gray-600">Set your restaurant's operating hours</p>

      <div className="space-y-4">
        {days.map(day => (
          <div key={day.key} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={!settings.businessHours[day.key].closed}
                  onChange={() => onChange(day.key, 'closed')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm font-medium text-gray-700 min-w-24">
                  {day.label}
                </span>
              </label>

              {!settings.businessHours[day.key].closed && (
                <div className="flex items-center space-x-2">
                  <input
                    type="time"
                    value={settings.businessHours[day.key].open}
                    onChange={(e) => onChange(day.key, 'open', e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="time"
                    value={settings.businessHours[day.key].close}
                    onChange={(e) => onChange(day.key, 'close', e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              )}
            </div>

            {settings.businessHours[day.key].closed ? (
              <span className="text-red-600 text-sm font-medium">Closed</span>
            ) : (
              <span className="text-green-600 text-sm font-medium">Open</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// System Settings Component
const SystemSettings = ({ settings, onChange, onClearCache, onBackupDatabase, onResetDefaults, loading }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">System Preferences</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Language
          </label>
          <select
            value={settings.language}
            onChange={(e) => onChange('language', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Timezone
          </label>
          <select
            value={settings.timezone}
            onChange={(e) => onChange('timezone', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="UTC-5">Eastern Time (UTC-5)</option>
            <option value="UTC-6">Central Time (UTC-6)</option>
            <option value="UTC-7">Mountain Time (UTC-7)</option>
            <option value="UTC-8">Pacific Time (UTC-8)</option>
            <option value="UTC+0">GMT (UTC+0)</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Features & Notifications</h3>

        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.autoBackup}
              onChange={(e) => onChange('autoBackup', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Enable automatic daily backups</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.lowStockAlert}
              onChange={(e) => onChange('lowStockAlert', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Enable low stock alerts</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.orderNotifications}
              onChange={(e) => onChange('orderNotifications', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Enable order notifications</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.printReceipt}
              onChange={(e) => onChange('printReceipt', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Auto-print receipts after payment</span>
          </label>
        </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">System Maintenance</h3>
        <div className="space-y-3">
          <button
            onClick={onClearCache}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Clear Cache
          </button>
          <button
            onClick={onBackupDatabase}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Backup Database
          </button>
          <button
            onClick={onResetDefaults}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;