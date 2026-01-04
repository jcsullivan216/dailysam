import React, { useState, useEffect } from 'react';
import * as api from '../services/api';

// NAICS code descriptions for reference
const NAICS_DESCRIPTIONS = {
  '334220': 'Radio/TV Broadcasting Equipment',
  '334511': 'Search, Detection, Navigation Systems',
  '334290': 'Communications Equipment',
  '541330': 'Engineering Services',
  '541512': 'Computer Systems Design',
  '541715': 'R&D in Physical/Engineering Sciences',
  '336411': 'Aircraft Manufacturing',
  '336414': 'Guided Missile/Space Vehicle Mfg',
  '336419': 'Guided Missile/Space Vehicle Parts',
  '334419': 'Other Electronic Components',
  '334418': 'Printed Circuit Assembly',
  '561210': 'Facilities Support Services',
};

// All available notice types
const ALL_NOTICE_TYPES = [
  { code: 'p', name: 'Presolicitation' },
  { code: 'o', name: 'Solicitation' },
  { code: 'k', name: 'Combined Synopsis/Solicitation' },
  { code: 'r', name: 'Sources Sought' },
  { code: 'a', name: 'Award Notice' },
  { code: 's', name: 'Special Notice' },
  { code: 'i', name: 'Intent to Bundle' },
  { code: 'g', name: 'Sale of Surplus Property' },
];

export default function SettingsModal({ isOpen, onClose, onSave }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [newNaicsCode, setNewNaicsCode] = useState('');
  const [newKeyword, setNewKeyword] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getSettings();
      setSettings(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await api.updateSettings(settings);
      if (onSave) onSave(result.data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleNoticeType = (code) => {
    setSettings(prev => ({
      ...prev,
      noticeTypes: prev.noticeTypes.map(nt =>
        nt.code === code ? { ...nt, enabled: !nt.enabled } : nt
      )
    }));
  };

  const addNaicsCode = () => {
    const code = newNaicsCode.trim();
    if (code && /^\d{6}$/.test(code) && !settings.naicsCodes.includes(code)) {
      setSettings(prev => ({
        ...prev,
        naicsCodes: [...prev.naicsCodes, code]
      }));
      setNewNaicsCode('');
    }
  };

  const removeNaicsCode = (code) => {
    setSettings(prev => ({
      ...prev,
      naicsCodes: prev.naicsCodes.filter(c => c !== code)
    }));
  };

  const addKeyword = () => {
    const keyword = newKeyword.trim().toLowerCase();
    if (keyword && !settings.keywords.includes(keyword)) {
      setSettings(prev => ({
        ...prev,
        keywords: [...prev.keywords, keyword]
      }));
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword) => {
    setSettings(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== keyword)
    }));
  };

  const updateDaysToFetch = (days) => {
    const value = Math.max(1, Math.min(90, parseInt(days) || 30));
    setSettings(prev => ({
      ...prev,
      daysToFetch: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">API Fetch Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : error && !settings ? (
            <div className="text-red-600 text-center py-8">{error}</div>
          ) : settings && (
            <>
              {/* Days to Fetch */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Days to Fetch
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={settings.daysToFetch}
                    onChange={(e) => updateDaysToFetch(e.target.value)}
                    min="1"
                    max="90"
                    className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-sm text-gray-500">days (1-90)</span>
                </div>
              </div>

              {/* Notice Types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notice Types
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {settings.noticeTypes.map(nt => (
                    <label
                      key={nt.code}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                        nt.enabled
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={nt.enabled}
                        onChange={() => toggleNoticeType(nt.code)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="ml-3">
                        <span className={`inline-block w-6 h-6 text-center rounded text-xs font-bold leading-6 mr-2 ${
                          nt.code === 'a' ? 'bg-green-100 text-green-800' :
                          nt.code === 'j' ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {nt.code.toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-700">{nt.name}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* NAICS Codes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  NAICS Codes
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newNaicsCode}
                    onChange={(e) => setNewNaicsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit NAICS code"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && addNaicsCode()}
                  />
                  <button
                    onClick={addNaicsCode}
                    disabled={!newNaicsCode || newNaicsCode.length !== 6}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {settings.naicsCodes.map(code => (
                    <span
                      key={code}
                      className="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-sm"
                    >
                      <span className="font-mono">{code}</span>
                      {NAICS_DESCRIPTIONS[code] && (
                        <span className="ml-1 text-purple-600 text-xs">
                          ({NAICS_DESCRIPTIONS[code]})
                        </span>
                      )}
                      <button
                        onClick={() => removeNaicsCode(code)}
                        className="ml-2 text-purple-600 hover:text-purple-800"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Find NAICS codes at{' '}
                  <a href="https://www.naics.com/search/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    naics.com
                  </a>
                </p>
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Keywords
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="Enter keyword or phrase"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                  />
                  <button
                    onClick={addKeyword}
                    disabled={!newKeyword.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {settings.keywords.map(keyword => (
                    <span
                      key={keyword}
                      className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm"
                    >
                      {keyword}
                      <button
                        onClick={() => removeKeyword(keyword)}
                        className="ml-2 text-gray-600 hover:text-gray-800"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Keywords are used for additional searches beyond NAICS filtering
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || saving || !settings}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
