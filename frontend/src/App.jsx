import React, { useState } from 'react';
import { useSolicitations } from './hooks/useSolicitations';
import SolicitationCard from './components/SolicitationCard';
import FilterBar from './components/FilterBar';
import SettingsModal from './components/SettingsModal';

function App() {
  const {
    solicitations,
    filters,
    availableFilters,
    loading,
    error,
    scrapeStatus,
    updateFilters,
    clearFilters,
    updateSolicitation,
    triggerScrape,
  } = useSolicitations();

  const [expandedId, setExpandedId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleToggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                SAM Daily Tracker
              </h1>
              <p className="text-sm text-gray-500">
                Federal Solicitations for RF/EW & Defense
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="API Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline">Settings</span>
              </button>
              <div className="text-right text-sm text-gray-500">
                <div>Track DoD Procurement Opportunities</div>
                <div className="text-xs">
                  Data from <a href="https://sam.gov" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">SAM.gov API</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          availableFilters={availableFilters}
          onUpdateFilters={updateFilters}
          onClearFilters={clearFilters}
          onTriggerScrape={triggerScrape}
          scrapeStatus={scrapeStatus}
          totalCount={solicitations.length}
        />

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="ml-3 text-gray-600">Loading solicitations...</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && solicitations.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No solicitations found</h3>
            <p className="text-gray-500 mb-4">
              {Object.keys(filters).some(k => filters[k])
                ? 'Try adjusting your filters or search terms.'
                : 'Click "Refresh Data" to scrape the latest solicitations from SAM Daily.'}
            </p>
            {!Object.keys(filters).some(k => filters[k]) && (
              <button
                onClick={triggerScrape}
                disabled={scrapeStatus?.isRunning}
                className="btn btn-primary"
              >
                Scrape SAM Daily Now
              </button>
            )}
          </div>
        )}

        {/* Solicitations Grid */}
        {!loading && solicitations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {solicitations.map(solicitation => (
              <SolicitationCard
                key={solicitation.id}
                solicitation={solicitation}
                onUpdate={updateSolicitation}
                expanded={expandedId === solicitation.id}
                onToggleExpand={handleToggleExpand}
              />
            ))}
          </div>
        )}

        {/* Legend */}
        {!loading && solicitations.length > 0 && (
          <div className="mt-8 p-4 bg-white rounded-lg shadow-sm">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Category Legend</h4>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center">
                <span className="badge badge-award mr-2">A</span>
                <span className="text-gray-600">Awards</span>
              </div>
              <div className="flex items-center">
                <span className="badge badge-solicitation mr-2">D</span>
                <span className="text-gray-600">Combined Synopsis/Solicitations</span>
              </div>
              <div className="flex items-center">
                <span className="badge badge-ja mr-2">J</span>
                <span className="text-gray-600">Justifications & Approvals</span>
              </div>
              <div className="flex items-center">
                <span className="badge badge-solicitation mr-2">R</span>
                <span className="text-gray-600">Solicitations</span>
              </div>
              <div className="flex items-center">
                <span className="badge badge-naics mr-2">##</span>
                <span className="text-gray-600">NAICS Code Categories</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap justify-between items-center text-sm text-gray-500">
            <div>
              SAM Daily Tracker - Federal Procurement Opportunities
            </div>
            <div>
              Data sourced from <a href="https://sam.gov" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">SAM.gov API</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={() => {
          // Settings saved, can trigger refresh if needed
        }}
      />
    </div>
  );
}

export default App;
