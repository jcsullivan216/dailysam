import { v4 as uuidv4 } from 'uuid';
import { insertSolicitation, insertScrapeLog, updateScrapeLog } from '../models/database.js';

const SAM_API_BASE = 'https://api.sam.gov/opportunities/v2/search';

// Format date as MM/dd/yyyy for SAM.gov API
function formatDateForSamGov(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

// NAICS codes relevant to RF/EW and defense
const TARGET_NAICS = [
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

// Notice types to fetch
const NOTICE_TYPES = [
  'p', // Presolicitation
  'o', // Solicitation
  'k', // Combined Synopsis/Solicitation
  'r', // Sources Sought
  'a', // Award Notice
  's', // Special Notice
  'i', // Intent to Bundle
  'g', // Sale of Surplus Property
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchFromSamGov(onProgress = null) {
  const apiKey = process.env.SAM_API_KEY;

  if (!apiKey) {
    throw new Error('SAM_API_KEY environment variable is required. Get one at https://sam.gov');
  }

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

    logProgress('Fetching opportunities from SAM.gov API...');

    // Fetch recent opportunities (last 30 days)
    // SAM.gov API requires MM/dd/yyyy format
    const postedFrom = new Date();
    postedFrom.setDate(postedFrom.getDate() - 30);
    const postedFromStr = formatDateForSamGov(postedFrom);

    const postedTo = new Date();
    const postedToStr = formatDateForSamGov(postedTo);

    // Build NAICS filter string (OR condition with ~)
    const naicsFilter = TARGET_NAICS.join('~');

    let offset = 0;
    const limit = 100;
    let hasMore = true;
    const seenIds = new Set();

    while (hasMore) {
      const params = new URLSearchParams({
        postedFrom: postedFromStr,
        postedTo: postedToStr,
        limit: limit.toString(),
        offset: offset.toString(),
        // Filter by NAICS codes relevant to defense/RF/EW
        ncode: naicsFilter,
      });

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
          logProgress('Rate limited, waiting 60 seconds...');
          await delay(60000);
          continue;
        }
        throw new Error(`SAM.gov API error ${response.status}: ${errorText}`);
      }

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
        // Rate limiting - be respectful
        await delay(500);
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

  const logProgress = (message) => {
    console.log(`[SAM.gov API] ${message}`);
    if (onProgress) onProgress(message);
  };

  // Defense-related keywords
  const keywords = [
    'electronic warfare',
    'RF system',
    'radio frequency',
    'radar system',
    'signal processing',
    'EW system',
    'jamming',
    'SIGINT',
    'spectrum',
    'antenna',
    'microwave',
  ];

  let totalItems = 0;
  const errors = [];
  const seenIds = new Set();

  for (const keyword of keywords) {
    try {
      logProgress(`Searching for: ${keyword}`);

      const params = new URLSearchParams({
        q: keyword,
        limit: '100',
        postedFrom: getDateDaysAgo(30),
        postedTo: getTodayDate(),
      });

      const response = await fetch(`${SAM_API_BASE}?${params.toString()}`, {
        headers: {
          'X-Api-Key': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          logProgress('Rate limited, waiting...');
          await delay(60000);
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

      // Rate limiting
      await delay(500);

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
