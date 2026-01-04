import { v4 as uuidv4 } from 'uuid';
import { insertSolicitation, insertScrapeLog, updateScrapeLog, getSettings } from '../models/database.js';

const SAM_API_BASE = 'https://api.sam.gov/opportunities/v2/search';

// Format date as MM/dd/yyyy for SAM.gov API
function formatDateForSamGov(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

// Calculate smart date range based on day of week
// Monday (day 1): fetch Saturday through Monday (to catch weekend postings)
// Other days: fetch just current day
function getSmartDateRange() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

  let fromDate = new Date(today);

  if (dayOfWeek === 1) {
    // Monday - go back to Saturday (2 days before)
    fromDate.setDate(today.getDate() - 2);
  }
  // Otherwise fromDate stays as today (current day only)

  return {
    from: fromDate,
    to: today,
    description: dayOfWeek === 1
      ? 'Saturday through Monday (weekend catch-up)'
      : 'today only'
  };
}

// Default NAICS codes relevant to RF/EW and defense (used if settings not available)
const DEFAULT_NAICS = [
  '334220', // Radio and Television Broadcasting and Wireless Communications Equipment Manufacturing
  '334511', // Search, Detection, Navigation, Guidance, Aeronautical Systems
  '334290', // Other Communications Equipment Manufacturing
  '541330', // Engineering Services
  '541512', // Computer Systems Design Services
  '541715', // R&D in Physical, Engineering, and Life Sciences
  '336411', // Aircraft Manufacturing
  '336414', // Guided Missile and Space Vehicle Manufacturing
  '336419', // Other Guided Missile and Space Vehicle Parts
  '334419', // Other Electronic Component Manufacturing
  '334418', // Printed Circuit Assembly Manufacturing
  '561210', // Facilities Support Services
];

// Default notice types to fetch (used if settings not available)
// Valid SAM.gov ptype values: p, k, r, g, s, f, i, u, a
const DEFAULT_NOTICE_TYPES = [
  { code: 'p', name: 'Presolicitation', enabled: true },
  { code: 'k', name: 'Combined Synopsis/Solicitation', enabled: true },
  { code: 'r', name: 'Sources Sought', enabled: true },
  { code: 'a', name: 'Award Notice', enabled: true },
  { code: 's', name: 'Special Notice', enabled: true },
  { code: 'u', name: 'Justification & Approval (J&A)', enabled: true },
  { code: 'f', name: 'Fair Opportunity / Limited Sources', enabled: false },
  { code: 'i', name: 'Intent to Bundle', enabled: false },
  { code: 'g', name: 'Sale of Surplus Property', enabled: false },
];

// Default keywords for defense-related searches
const DEFAULT_KEYWORDS = [
  'electronic warfare', 'RF system', 'radio frequency', 'radar system',
  'signal processing', 'EW system', 'jamming', 'SIGINT', 'spectrum',
  'antenna', 'microwave'
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchFromSamGov(onProgress = null) {
  const apiKey = process.env.SAM_API_KEY;

  if (!apiKey) {
    throw new Error('SAM_API_KEY environment variable is required. Get one at https://sam.gov');
  }

  // Load settings from database
  const settings = getSettings();
  const naicsCodes = settings.naicsCodes || DEFAULT_NAICS;
  const noticeTypes = settings.noticeTypes || DEFAULT_NOTICE_TYPES;

  // Get enabled notice type codes
  const enabledNoticeTypes = noticeTypes
    .filter(nt => nt.enabled)
    .map(nt => nt.code);

  let scrapeLogId = null;
  const errors = [];
  let totalItems = 0;
  const categoriesScraped = [];

  const logProgress = (message) => {
    console.log(`[SAM.gov API] ${message}`);
    if (onProgress) onProgress(message);
  };

  try {
    const startedAt = new Date().toISOString();
    const logResult = insertScrapeLog.run(startedAt, 'in_progress', '', 0, '');
    scrapeLogId = logResult.lastInsertRowid;

    // Use smart date range: current day only, unless Monday (then Sat-Mon)
    const dateRange = getSmartDateRange();
    const postedFromStr = formatDateForSamGov(dateRange.from);
    const postedToStr = formatDateForSamGov(dateRange.to);

    logProgress(`Fetching opportunities from SAM.gov API (${naicsCodes.length} NAICS codes, ${enabledNoticeTypes.length} notice types, ${dateRange.description})...`);

    // Build NAICS filter string (OR condition with ~)
    const naicsFilter = naicsCodes.join('~');

    // Build notice type filter string (comma-separated for ptype)
    const noticeTypeFilter = enabledNoticeTypes.join(',');

    let offset = 0;
    const limit = 100;
    let hasMore = true;
    const seenIds = new Set();
    let rateLimitRetries = 0;
    const MAX_RATE_LIMIT_RETRIES = 3;

    while (hasMore) {
      const params = new URLSearchParams({
        postedFrom: postedFromStr,
        postedTo: postedToStr,
        limit: limit.toString(),
        offset: offset.toString(),
        // Filter by NAICS codes from settings
        ncode: naicsFilter,
      });

      // Add notice type filter if any are enabled
      if (noticeTypeFilter) {
        params.set('ptype', noticeTypeFilter);
      }

      const url = `${SAM_API_BASE}?${params.toString()}`;
      logProgress(`Fetching page ${Math.floor(offset / limit) + 1}...`);

      const response = await fetch(url, {
        headers: {
          'X-Api-Key': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429) {
          rateLimitRetries++;
          if (rateLimitRetries >= MAX_RATE_LIMIT_RETRIES) {
            logProgress(`Rate limited ${MAX_RATE_LIMIT_RETRIES} times, stopping to avoid API abuse. Try again later.`);
            errors.push('Rate limited by SAM.gov API - try again in a few minutes');
            hasMore = false;
            break;
          }
          logProgress(`Rate limited, waiting 60 seconds (attempt ${rateLimitRetries}/${MAX_RATE_LIMIT_RETRIES})...`);
          await delay(60000);
          continue;
        }
        throw new Error(`SAM.gov API error ${response.status}: ${errorText}`);
      }

      // Reset retry counter on successful request
      rateLimitRetries = 0;

      const data = await response.json();
      const opportunities = data.opportunitiesData || [];

      logProgress(`Received ${opportunities.length} opportunities`);

      if (opportunities.length === 0) {
        hasMore = false;
        break;
      }

      for (const opp of opportunities) {
        // Skip duplicates
        if (seenIds.has(opp.noticeId)) continue;
        seenIds.add(opp.noticeId);

        try {
          const item = mapOpportunityToSolicitation(opp);

          insertSolicitation.run(
            item.id,
            item.category,
            item.title,
            item.description,
            item.agency,
            item.postedDate,
            item.responseDeadline,
            item.sourceUrl,
            JSON.stringify(item.relatedLinks),
            item.scrapedAt,
            null, // is_relevant
            null  // notes
          );
          totalItems++;

          // Track category
          if (!categoriesScraped.includes(item.category)) {
            categoriesScraped.push(item.category);
          }
        } catch (dbError) {
          errors.push(`DB error for ${opp.title}: ${dbError.message}`);
        }
      }

      // Check if there are more results
      if (opportunities.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
        // Rate limiting - be respectful with 2 second delay
        await delay(2000);
      }

      // Safety limit to avoid infinite loops
      if (offset > 5000) {
        logProgress('Reached maximum offset limit (5000)');
        hasMore = false;
      }
    }

    // Update scrape log with success
    updateScrapeLog.run(
      new Date().toISOString(),
      errors.length > 0 ? 'completed_with_errors' : 'completed',
      totalItems,
      errors.length > 0 ? JSON.stringify(errors) : null,
      scrapeLogId
    );

    logProgress(`Fetch complete. Found ${totalItems} opportunities across ${categoriesScraped.length} categories.`);

    return {
      success: true,
      itemsFound: totalItems,
      categoriesScraped,
      errors
    };

  } catch (error) {
    console.error('[SAM.gov API] Fatal error:', error);

    if (scrapeLogId) {
      updateScrapeLog.run(
        new Date().toISOString(),
        'failed',
        totalItems,
        JSON.stringify([...errors, error.message]),
        scrapeLogId
      );
    }

    return {
      success: false,
      itemsFound: totalItems,
      categoriesScraped,
      errors: [...errors, error.message]
    };
  }
}

function mapOpportunityToSolicitation(opp) {
  // Map SAM.gov notice types to our categories
  const typeMap = {
    'Presolicitation': 'R',
    'Solicitation': 'R',
    'Combined Synopsis/Solicitation': 'D',
    'Sources Sought': 'R',
    'Award Notice': 'A',
    'Special Notice': 'J',
    'Intent to Bundle': 'J',
    'Justification': 'J',
    'Sale of Surplus Property': 'J',
  };

  const category = typeMap[opp.type] || typeMap[opp.baseType] || opp.naicsCode?.substring(0, 2) || 'R';

  // Build description from available fields
  const descriptionParts = [];
  if (opp.description) descriptionParts.push(opp.description);
  if (opp.organizationType) descriptionParts.push(`Organization: ${opp.organizationType}`);
  if (opp.naicsCode) descriptionParts.push(`NAICS: ${opp.naicsCode}`);
  if (opp.classificationCode) descriptionParts.push(`Classification: ${opp.classificationCode}`);
  if (opp.setAsideCode) descriptionParts.push(`Set-Aside: ${opp.setAsideCode}`);

  // Build agency name
  const agency = [opp.department, opp.subTier, opp.office]
    .filter(Boolean)
    .join(' - ') || null;

  // Build source URL
  const sourceUrl = opp.uiLink || `https://sam.gov/opp/${opp.noticeId}/view`;

  // Extract related links
  const relatedLinks = [];
  if (opp.links) {
    for (const link of opp.links) {
      relatedLinks.push({
        title: link.rel || 'Related Link',
        url: link.href
      });
    }
  }
  if (opp.resourceLinks) {
    for (const link of opp.resourceLinks) {
      relatedLinks.push({
        title: link.name || 'Resource',
        url: link.url
      });
    }
  }

  return {
    id: opp.noticeId || uuidv4(),
    category: category,
    title: opp.title || 'Untitled Opportunity',
    description: descriptionParts.join('\n\n').substring(0, 2000) || null,
    agency: agency,
    postedDate: opp.postedDate || new Date().toISOString().split('T')[0],
    responseDeadline: opp.responseDeadLine || opp.archiveDate || null,
    sourceUrl: sourceUrl,
    relatedLinks: relatedLinks.slice(0, 10),
    scrapedAt: new Date().toISOString(),
  };
}

// Also fetch by keyword search for defense-related terms
export async function fetchDefenseOpportunities(onProgress = null) {
  const apiKey = process.env.SAM_API_KEY;

  if (!apiKey) {
    throw new Error('SAM_API_KEY environment variable is required');
  }

  // Load settings from database
  const settings = getSettings();
  const keywords = settings.keywords || DEFAULT_KEYWORDS;

  // Use smart date range: current day only, unless Monday (then Sat-Mon)
  const dateRange = getSmartDateRange();

  const logProgress = (message) => {
    console.log(`[SAM.gov API] ${message}`);
    if (onProgress) onProgress(message);
  };

  logProgress(`Searching for ${keywords.length} keywords (${dateRange.description})...`);

  let totalItems = 0;
  const errors = [];
  const seenIds = new Set();
  let rateLimitHits = 0;
  const MAX_RATE_LIMIT_HITS = 2;

  for (const keyword of keywords) {
    // If we've been rate limited too much, stop
    if (rateLimitHits >= MAX_RATE_LIMIT_HITS) {
      logProgress('Stopping keyword search due to rate limiting');
      break;
    }

    try {
      logProgress(`Searching for: ${keyword}`);

      const params = new URLSearchParams({
        q: keyword,
        limit: '50', // Reduced limit to be gentler on API
        postedFrom: formatDateForSamGov(dateRange.from),
        postedTo: formatDateForSamGov(dateRange.to),
      });

      const response = await fetch(`${SAM_API_BASE}?${params.toString()}`, {
        headers: {
          'X-Api-Key': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          rateLimitHits++;
          logProgress(`Rate limited (${rateLimitHits}/${MAX_RATE_LIMIT_HITS}), skipping remaining keywords...`);
          continue;
        }
        continue;
      }

      const data = await response.json();
      const opportunities = data.opportunitiesData || [];

      for (const opp of opportunities) {
        if (seenIds.has(opp.noticeId)) continue;
        seenIds.add(opp.noticeId);

        try {
          const item = mapOpportunityToSolicitation(opp);
          insertSolicitation.run(
            item.id,
            item.category,
            item.title,
            item.description,
            item.agency,
            item.postedDate,
            item.responseDeadline,
            item.sourceUrl,
            JSON.stringify(item.relatedLinks),
            item.scrapedAt,
            null,
            null
          );
          totalItems++;
        } catch (e) {
          // Likely duplicate, skip
        }
      }

      // Rate limiting - be more respectful with 2 second delay
      await delay(2000);

    } catch (error) {
      errors.push(`Error searching "${keyword}": ${error.message}`);
    }
  }

  return { totalItems, errors };
}

function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDateForSamGov(date);
}

function getTodayDate() {
  return formatDateForSamGov(new Date());
}

export default { fetchFromSamGov, fetchDefenseOpportunities };
