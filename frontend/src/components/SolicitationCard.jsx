import React, { useState } from 'react';

function getCategoryBadgeClass(category) {
  if (category === 'A') return 'badge-award';
  if (category === 'D' || category === 'R') return 'badge-solicitation';
  if (category === 'J') return 'badge-ja';
  return 'badge-naics';
}

function getCategoryLabel(category) {
  const labels = {
    'A': 'Award',
    'D': 'Combined Synopsis',
    'J': 'J&A',
    'R': 'Solicitation'
  };
  return labels[category] || `NAICS ${category}`;
}

function getDaysUntilDeadline(deadline) {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline);
  const diffTime = deadlineDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export default function SolicitationCard({ solicitation, onUpdate, expanded, onToggleExpand }) {
  const [notes, setNotes] = useState(solicitation.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const daysUntil = getDaysUntilDeadline(solicitation.responseDeadline);
  const isUrgent = daysUntil !== null && daysUntil <= 7 && daysUntil >= 0;
  const isPast = daysUntil !== null && daysUntil < 0;

  const handleRelevanceChange = async (value) => {
    setIsSaving(true);
    await onUpdate(solicitation.id, { isRelevant: value });
    setIsSaving(false);
  };

  const handleNotesBlur = async () => {
    if (notes !== solicitation.notes) {
      setIsSaving(true);
      await onUpdate(solicitation.id, { notes });
      setIsSaving(false);
    }
  };

  return (
    <div className={`card ${isUrgent ? 'ring-2 ring-red-400' : ''} ${isPast ? 'opacity-60' : ''}`}>
      <div
        className="p-4 cursor-pointer"
        onClick={() => onToggleExpand(solicitation.id)}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <span className={`badge ${getCategoryBadgeClass(solicitation.category)}`}>
            {getCategoryLabel(solicitation.category)}
          </span>
          {solicitation.isRelevant === true && (
            <span className="text-green-600 text-sm font-medium">Relevant</span>
          )}
          {solicitation.isRelevant === false && (
            <span className="text-gray-400 text-sm">Not Relevant</span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
          {solicitation.title}
        </h3>

        {/* Description */}
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
          {solicitation.description || 'No description available'}
        </p>

        {/* Metadata */}
        <div className="flex flex-wrap gap-3 text-sm text-gray-500">
          {solicitation.agency && (
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              {solicitation.agency}
            </span>
          )}
          {solicitation.postedDate && (
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Posted: {solicitation.postedDate}
            </span>
          )}
        </div>

        {/* Deadline */}
        {solicitation.responseDeadline && (
          <div className={`mt-2 text-sm font-medium ${isUrgent ? 'text-red-600' : isPast ? 'text-gray-400' : 'text-gray-600'}`}>
            {isPast ? (
              <span>Deadline passed: {solicitation.responseDeadline}</span>
            ) : (
              <span>
                Deadline: {solicitation.responseDeadline}
                {daysUntil !== null && (
                  <span className="ml-2">
                    ({daysUntil === 0 ? 'Today!' : `${daysUntil} day${daysUntil === 1 ? '' : 's'} left`})
                  </span>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50" onClick={(e) => e.stopPropagation()}>
          {/* Full Description */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-1">Full Description</h4>
            <p className="text-gray-600 text-sm whitespace-pre-wrap">
              {solicitation.description || 'No description available'}
            </p>
          </div>

          {/* Related Links */}
          {solicitation.relatedLinks && solicitation.relatedLinks.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-1">Related Links</h4>
              <ul className="space-y-1">
                {solicitation.relatedLinks.map((link, index) => (
                  <li key={index}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      {link.title || link.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Source URL */}
          <div className="mb-4">
            <a
              href={solicitation.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary text-sm inline-flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Original
            </a>
          </div>

          {/* Relevance Toggle */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Mark Relevance</h4>
            <div className="flex gap-2">
              <button
                className={`btn text-sm ${solicitation.isRelevant === true ? 'btn-success' : 'btn-secondary'}`}
                onClick={() => handleRelevanceChange(true)}
                disabled={isSaving}
              >
                Relevant
              </button>
              <button
                className={`btn text-sm ${solicitation.isRelevant === false ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => handleRelevanceChange(false)}
                disabled={isSaving}
              >
                Not Relevant
              </button>
              <button
                className={`btn text-sm ${solicitation.isRelevant === null ? 'bg-gray-400 text-white' : 'btn-secondary'}`}
                onClick={() => handleRelevanceChange(null)}
                disabled={isSaving}
              >
                Unset
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-1">Notes</h4>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add notes about this solicitation..."
              className="input text-sm resize-none"
              rows={3}
            />
          </div>

          {/* Scraped info */}
          <div className="mt-3 text-xs text-gray-400">
            Scraped: {new Date(solicitation.scrapedAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
