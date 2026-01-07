import React, { useState } from 'react';
import { getExportUrl } from '../services/api';

// Calculate what date range will be used when fetching
function getSmartDateRangeLabel() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday

  const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (dayOfWeek === 1) {
    // Monday - Saturday through Monday
    const saturday = new Date(today);
    saturday.setDate(today.getDate() - 2);
    return `${formatDate(saturday)} - ${formatDate(today)} (Sat-Mon)`;
  }
  return `${formatDate(today)} (today only)`;
}

export default function FilterBar({
  filters,
  availableFilters,
  settings,
  onUpdateFilters,
  onClearFilters,
  onTriggerScrape,
  scrapeStatus,
  totalCount
}) {
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const [showMyInterests, setShowMyInterests] = useState(false);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onUpdateFilters({ search: searchValue });
  };

  const handleSearchClear = () => {
    setSearchValue('');
    onUpdateFilters({ search: '' });
  };

  const handleExport = (format) => {
    const url = getExportUrl(format, filters);
    window.open(url, '_blank');
  };

  const handleMyInterestsToggle = () => {
    const newValue = !showMyInterests;
    setShowMyInterests(newValue);

    if (newValue) {
      // Apply settings-based filter
      onUpdateFilters({ myInterests: true });
    } else {
      // Remove the filter
      onUpdateFilters({ myInterests: false });
    }
  };

  const handleClearAll = () => {
    setShowMyInterests(false);
    setSearchValue('');
    onClearFilters();
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 mb-6">
      {/* Top Row: Search and Actions */}
      <div className="flex flex-wrap gap-4 mb-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px]">
          <div className="relative">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search titles and descriptions..."
              className="input pr-20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              {searchValue && (
                <button
                  type="button"
                  onClick={handleSearchClear}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <button
                type="submit"
                className="p-1 text-blue-600 hover:text-blue-800"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>
        </form>

        {/* My Interests Toggle */}
        <div className="flex items-center">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showMyInterests}
              onChange={handleMyInterestsToggle}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm font-medium text-gray-700">My Interests Only</span>
          </label>
          <span className="ml-2 text-xs text-gray-500" title="Filter by your configured NAICS codes and keywords">
            (RF/EW/Defense)
          </span>
        </div>

        {/* Refresh/Scrape Button */}
        <div className="flex flex-col items-start">
          <button
            onClick={onTriggerScrape}
            disabled={scrapeStatus?.isRunning}
            className={`btn ${scrapeStatus?.isRunning ? 'bg-yellow-500 text-white' : 'btn-primary'} flex items-center`}
          >
            {scrapeStatus?.isRunning ? (
              <>
                <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Fetching...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Data
              </>
            )}
          </button>
          <span className="text-xs text-gray-500 mt-1">
            Fetches: {getSmartDateRangeLabel()}
          </span>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('json')}
            className="btn btn-secondary text-sm"
          >
            Export JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="btn btn-secondary text-sm"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-4 items-end">
        {/* Category Filter */}
        <div className="min-w-[180px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={filters.category || ''}
            onChange={(e) => onUpdateFilters({ category: e.target.value })}
            className="select text-sm"
          >
            <option value="">All Categories</option>
            {availableFilters.categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'A' ? 'A - Awards' :
                 cat === 'D' ? 'D - Combined Synopsis' :
                 cat === 'J' ? 'J - J&A' :
                 cat === 'R' ? 'R - Solicitations' :
                 cat.length === 2 ? `NAICS ${cat}` : cat}
              </option>
            ))}
          </select>
        </div>

        {/* Agency Filter */}
        <div className="min-w-[250px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Agency</label>
          <select
            value={filters.agency || ''}
            onChange={(e) => onUpdateFilters({ agency: e.target.value })}
            className="select text-sm"
          >
            <option value="">All Agencies</option>
            {availableFilters.agencies.map(agency => (
              <option key={agency} value={agency}>{agency}</option>
            ))}
          </select>
        </div>

        {/* Relevance Filter */}
        <div className="min-w-[140px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Relevance</label>
          <select
            value={filters.isRelevant ?? ''}
            onChange={(e) => onUpdateFilters({ isRelevant: e.target.value })}
            className="select text-sm"
          >
            <option value="">All</option>
            <option value="true">Relevant</option>
            <option value="false">Not Relevant</option>
            <option value="null">Not Tagged</option>
          </select>
        </div>

        {/* Clear Filters */}
        <button
          onClick={handleClearAll}
          className="btn btn-secondary text-sm"
        >
          Clear Filters
        </button>

        {/* Count */}
        <div className="ml-auto text-sm text-gray-500">
          Showing <span className="font-semibold">{totalCount}</span> solicitations
        </div>
      </div>

      {/* Active Filters Summary */}
      {showMyInterests && (
        <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-xs text-blue-800">
            <span className="font-medium">Filtering by your interests:</span>{' '}
            {settings?.naicsCodes?.length > 0 && (
              <span>NAICS: {settings.naicsCodes.slice(0, 5).join(', ')}{settings.naicsCodes.length > 5 ? '...' : ''}</span>
            )}
            {settings?.keywords?.length > 0 && (
              <span className="ml-2">Keywords: {settings.keywords.slice(0, 5).join(', ')}{settings.keywords.length > 5 ? '...' : ''}</span>
            )}
          </div>
        </div>
      )}

      {/* Scrape Progress */}
      {scrapeStatus?.isRunning && scrapeStatus.progress?.length > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="text-sm text-yellow-800 font-medium mb-1">Scrape Progress</div>
          <div className="text-xs text-yellow-700 max-h-24 overflow-y-auto">
            {scrapeStatus.progress.slice(-5).map((p, i) => (
              <div key={i}>{p.message}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
