import { v4 as uuidv4 } from 'uuid';
import { insertSolicitation, insertScrapeLog, updateScrapeLog } from '../models/database.js';

const BASE_URL = 'https://samdaily.us';
const TARGET_CATEGORIES = ['A', 'D', 'J', 'R', '10', '16', '19', '25', '58', '59', '60', '61'];

// Rate limiting delay between requests (ms)
const REQUEST_DELAY = 1000;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Try to import playwright, but handle gracefully if not available
let chromium = null;
try {
  const playwright = await import('playwright');
  chromium = playwright.chromium;
} catch (e) {
  console.log('[Scraper] Playwright not available, will use fetch-based scraping');
}

export async function scrapeSamDaily(onProgress = null) {
  let scrapeLogId = null;
  const errors = [];
  let totalItems = 0;
  const categoriesScraped = [];

  const logProgress = (message) => {
    console.log(`[Scraper] ${message}`);
    if (onProgress) onProgress(message);
  };

  try {
    const startedAt = new Date().toISOString();
    const logResult = insertScrapeLog.run(startedAt, 'in_progress', '', 0, '');
    scrapeLogId = logResult.lastInsertRowid;

    // Try Playwright first, fall back to fetch
    if (chromium) {
      try {
        const result = await scrapeWithPlaywright(logProgress, errors);
        totalItems = result.totalItems;
        categoriesScraped.push(...result.categoriesScraped);
      } catch (playwrightError) {
        logProgress(`Playwright scraping failed: ${playwrightError.message}`);
        logProgress('Falling back to fetch-based scraping...');
        const result = await scrapeWithFetch(logProgress, errors);
        totalItems = result.totalItems;
        categoriesScraped.push(...result.categoriesScraped);
      }
    } else {
      const result = await scrapeWithFetch(logProgress, errors);
      totalItems = result.totalItems;
      categoriesScraped.push(...result.categoriesScraped);
    }

    // Update scrape log with success
    updateScrapeLog.run(
      new Date().toISOString(),
      errors.length > 0 ? 'completed_with_errors' : 'completed',
      totalItems,
      errors.length > 0 ? JSON.stringify(errors) : null,
      scrapeLogId
    );

    logProgress(`Scraping complete. Found ${totalItems} items across ${categoriesScraped.length} categories.`);

    return {
      success: true,
      itemsFound: totalItems,
      categoriesScraped,
      errors
    };

  } catch (error) {
    console.error('[Scraper] Fatal error:', error);

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

async function scrapeWithFetch(logProgress, errors) {
  let totalItems = 0;
  const categoriesScraped = [];
  const scrapedAt = new Date().toISOString();

  logProgress('Using fetch-based scraping...');

  try {
    // Fetch the main SAM Daily page
    logProgress('Fetching SAM Daily homepage...');
    const homeResponse = await fetch(BASE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!homeResponse.ok) {
      throw new Error(`Failed to fetch homepage: ${homeResponse.status}`);
    }

    const homeHtml = await homeResponse.text();
    logProgress('Homepage fetched successfully');

    // Find Today's SAM link
    const todayMatch = homeHtml.match(/href=["']([^"']*today[^"']*)["']/i) ||
                       homeHtml.match(/href=["']([^"']*\/\d{4}\/\d{2}\/\d{2}[^"']*)["']/i);

    if (!todayMatch) {
      // Try to find date-based links
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      logProgress(`Looking for date-based link: ${dateStr}`);
    }

    let todaysUrl = todayMatch ? new URL(todayMatch[1], BASE_URL).href : `${BASE_URL}/today`;
    logProgress(`Fetching Today's SAM page: ${todaysUrl}`);

    await delay(REQUEST_DELAY);
    const todayResponse = await fetch(todaysUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!todayResponse.ok) {
      logProgress(`Today's page returned ${todayResponse.status}, trying alternative URLs...`);
      // Try alternate patterns
      const altUrls = [
        `${BASE_URL}/daily`,
        `${BASE_URL}/notices`,
        `${BASE_URL}/sam`
      ];
      for (const url of altUrls) {
        try {
          const altResp = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          if (altResp.ok) {
            todaysUrl = url;
            break;
          }
        } catch (e) {
          // Try next
        }
      }
    }

    const todayHtml = await (await fetch(todaysUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })).text();

    logProgress(`Today's page fetched, looking for category links...`);

    // For each category, find and fetch the link
    for (const category of TARGET_CATEGORIES) {
      try {
        logProgress(`Processing category: ${category}`);

        // Find link for this category
        const categoryPattern = new RegExp(`href=["']([^"']*[/=]${category}(?:[/?"']|$)[^"']*)["']`, 'i');
        const categoryMatch = todayHtml.match(categoryPattern);

        if (!categoryMatch) {
          errors.push(`Category ${category} link not found`);
          logProgress(`Category ${category} link not found, skipping...`);
          continue;
        }

        const categoryUrl = new URL(categoryMatch[1], BASE_URL).href;
        logProgress(`Fetching category ${category}: ${categoryUrl}`);

        await delay(REQUEST_DELAY);
        const categoryResponse = await fetch(categoryUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });

        if (!categoryResponse.ok) {
          errors.push(`Failed to fetch category ${category}: ${categoryResponse.status}`);
          continue;
        }

        const categoryHtml = await categoryResponse.text();
        const items = extractItemsFromHtml(categoryHtml, category, categoryUrl, scrapedAt);

        for (const item of items) {
          try {
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
          } catch (dbError) {
            errors.push(`DB error for ${item.title}: ${dbError.message}`);
          }
        }

        categoriesScraped.push(category);
        logProgress(`Found ${items.length} items in category ${category}`);

      } catch (categoryError) {
        errors.push(`Error scraping category ${category}: ${categoryError.message}`);
        logProgress(`Error scraping category ${category}: ${categoryError.message}`);
      }
    }

  } catch (fetchError) {
    errors.push(`Fetch error: ${fetchError.message}`);
    logProgress(`Fetch error: ${fetchError.message}`);
  }

  return { totalItems, categoriesScraped };
}

function extractItemsFromHtml(html, category, sourceUrl, scrapedAt) {
  const items = [];

  // Remove scripts and styles
  const cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Extract text content
  const textContent = cleanHtml.replace(/<[^>]+>/g, '\n')
                              .replace(/&nbsp;/g, ' ')
                              .replace(/&amp;/g, '&')
                              .replace(/&lt;/g, '<')
                              .replace(/&gt;/g, '>')
                              .replace(/\n\s*\n/g, '\n');

  // Extract all links
  const linkMatches = [...html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi)];
  const links = linkMatches.map(m => ({ url: m[1], title: m[2].trim() })).filter(l => l.title);

  // Parse lines for solicitations
  const lines = textContent.split('\n').map(l => l.trim()).filter(l => l.length > 10);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for lines that appear to be solicitation titles
    // Typically they contain identifiers, agency names, or keywords
    if (
      line.length > 30 &&
      (
        /^[A-Z0-9\-]{5,}/.test(line) || // Starts with ID-like pattern
        line.includes('Solicitation') ||
        line.includes('Award') ||
        line.includes('Notice') ||
        line.includes('Contract') ||
        line.includes('RFP') ||
        line.includes('RFQ') ||
        line.includes('Synopsis') ||
        /Army|Navy|Air Force|Marines|DoD|DARPA|NASA|DLA/i.test(line)
      )
    ) {
      const contextLines = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 5)).join(' ');

      const item = {
        id: uuidv4(),
        category: category,
        title: line.substring(0, 500),
        description: lines.slice(i + 1, i + 4).join(' ').substring(0, 1000) || null,
        agency: extractAgency(contextLines),
        postedDate: extractDate(contextLines),
        responseDeadline: extractDeadline(contextLines),
        sourceUrl: sourceUrl,
        relatedLinks: links.slice(0, 5),
        scrapedAt: scrapedAt
      };

      items.push(item);
    }
  }

  // If no structured items found, try table-based extraction
  if (items.length === 0) {
    const tableRows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const row of tableRows) {
      const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
      if (cells.length >= 2) {
        const cellText = cells.map(c => c[1].replace(/<[^>]+>/g, '').trim()).filter(t => t);
        if (cellText.length >= 2 && cellText[0].length > 10) {
          const item = {
            id: uuidv4(),
            category: category,
            title: cellText[0].substring(0, 500),
            description: cellText.slice(1).join(' ').substring(0, 1000),
            agency: extractAgency(cellText.join(' ')),
            postedDate: extractDate(cellText.join(' ')),
            responseDeadline: extractDeadline(cellText.join(' ')),
            sourceUrl: sourceUrl,
            relatedLinks: [],
            scrapedAt: scrapedAt
          };
          items.push(item);
        }
      }
    }
  }

  return items;
}

async function scrapeWithPlaywright(logProgress, errors) {
  let browser = null;
  let totalItems = 0;
  const categoriesScraped = [];

  try {
    logProgress('Launching browser...');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // Navigate to SAM Daily homepage
    logProgress('Navigating to SAM Daily...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await delay(REQUEST_DELAY);

    // Find and click "Today's SAM" link
    logProgress('Looking for Today\'s SAM link...');
    const todaysSamLink = await page.$('a:has-text("Today\'s SAM"), a:has-text("Todays SAM"), a[href*="today"]');

    if (!todaysSamLink) {
      const allLinks = await page.$$eval('a', links =>
        links.map(l => ({ href: l.href, text: l.textContent?.trim() }))
      );
      logProgress(`Available links on page: ${JSON.stringify(allLinks.slice(0, 10))}`);
      throw new Error('Could not find "Today\'s SAM" link on homepage');
    }

    await todaysSamLink.click();
    await page.waitForLoadState('networkidle');
    await delay(REQUEST_DELAY);

    const todaysPageUrl = page.url();
    logProgress(`On Today's SAM page: ${todaysPageUrl}`);

    const scrapedAt = new Date().toISOString();

    for (const category of TARGET_CATEGORIES) {
      try {
        logProgress(`Scraping category: ${category}`);

        if (page.url() !== todaysPageUrl) {
          await page.goto(todaysPageUrl, { waitUntil: 'networkidle', timeout: 30000 });
          await delay(REQUEST_DELAY);
        }

        let categoryLink = await page.$(`a:has-text("${category}")`) ||
                          await page.$(`a[href*="/${category}"]`) ||
                          await page.$(`a[href*="=${category}"]`);

        if (!categoryLink) {
          const links = await page.$$('a');
          for (const link of links) {
            const text = await link.textContent();
            if (text?.trim() === category) {
              categoryLink = link;
              break;
            }
          }
        }

        if (!categoryLink) {
          errors.push(`Category ${category} link not found`);
          logProgress(`Category ${category} link not found, skipping...`);
          continue;
        }

        await categoryLink.click();
        await page.waitForLoadState('networkidle');
        await delay(REQUEST_DELAY);

        const items = await extractSolicitationsFromPage(page, category, scrapedAt);

        for (const item of items) {
          try {
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
          } catch (dbError) {
            errors.push(`DB error for ${item.title}: ${dbError.message}`);
          }
        }

        categoriesScraped.push(category);
        logProgress(`Found ${items.length} items in category ${category}`);

      } catch (categoryError) {
        errors.push(`Error scraping category ${category}: ${categoryError.message}`);
        logProgress(`Error scraping category ${category}: ${categoryError.message}`);
      }
    }

  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return { totalItems, categoriesScraped };
}

async function extractSolicitationsFromPage(page, category, scrapedAt) {
  const items = [];

  try {
    await page.waitForSelector('body', { timeout: 10000 });

    let entries = await page.$$('table tr, .solicitation, .notice, .listing, article');

    if (entries.length === 0) {
      entries = await page.$$('a[href*="sam.gov"], a[href*="notice"], a[href*="solicitation"]');
    }

    if (entries.length === 0) {
      const textContent = await page.evaluate(() => document.body.innerText);
      const lines = textContent.split('\n').filter(l => l.trim());

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.length > 20 && (
          line.includes('Solicitation') ||
          line.includes('Award') ||
          line.includes('Notice') ||
          line.includes('Contract') ||
          line.includes('RFP') ||
          line.includes('RFQ') ||
          /^[A-Z][A-Z0-9\-]+/.test(line)
        )) {
          const item = {
            id: uuidv4(),
            category: category,
            title: line.substring(0, 500),
            description: lines[i + 1]?.trim()?.substring(0, 1000) || null,
            agency: extractAgency(lines.slice(Math.max(0, i - 2), i + 5).join(' ')),
            postedDate: extractDate(lines.slice(Math.max(0, i - 2), i + 5).join(' ')),
            responseDeadline: extractDeadline(lines.slice(Math.max(0, i - 2), i + 5).join(' ')),
            sourceUrl: page.url(),
            relatedLinks: [],
            scrapedAt: scrapedAt
          };

          items.push(item);
        }
      }
    } else {
      for (const entry of entries) {
        try {
          const entryText = await entry.textContent();

          const links = await entry.$$eval('a', anchors =>
            anchors.map(a => ({ title: a.textContent?.trim(), url: a.href }))
              .filter(l => l.title && l.url)
          );

          const mainLink = await entry.$('a');
          let title = '';
          let sourceUrl = page.url();

          if (mainLink) {
            title = await mainLink.textContent() || '';
            sourceUrl = await mainLink.getAttribute('href') || sourceUrl;
            if (sourceUrl && !sourceUrl.startsWith('http')) {
              sourceUrl = new URL(sourceUrl, BASE_URL).href;
            }
          } else {
            title = entryText?.trim()?.split('\n')[0] || 'Untitled';
          }

          if (title.length < 5) continue;

          const item = {
            id: uuidv4(),
            category: category,
            title: title.substring(0, 500),
            description: entryText?.substring(0, 1000)?.trim() || null,
            agency: extractAgency(entryText || ''),
            postedDate: extractDate(entryText || ''),
            responseDeadline: extractDeadline(entryText || ''),
            sourceUrl: sourceUrl,
            relatedLinks: links.slice(0, 10),
            scrapedAt: scrapedAt
          };

          items.push(item);
        } catch (entryError) {
          // Continue with next entry
        }
      }
    }

  } catch (error) {
    // Return empty items on error
  }

  return items;
}

function extractAgency(text) {
  const agencyPatterns = [
    /(?:Dept\.?|Department) of [\w\s]+/gi,
    /(?:US|U\.S\.) (?:Army|Navy|Air Force|Marine Corps|Coast Guard|Space Force)/gi,
    /(?:NASA|DARPA|DLA|GSA|DOD|DoD|DISA|DCMA)/gi,
    /[\w\s]+ Command/gi,
    /[\w\s]+ Agency/gi,
  ];

  for (const pattern of agencyPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  return null;
}

function extractDate(text) {
  const datePatterns = [
    /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
    /(\w+ \d{1,2},? \d{4})/,
    /(\d{4}-\d{2}-\d{2})/
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const date = new Date(match[1]);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } catch (e) {
        // Invalid date
      }
    }
  }

  return new Date().toISOString().split('T')[0];
}

function extractDeadline(text) {
  const deadlinePatterns = [
    /(?:deadline|due|response|close[sd]?|submit)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
    /(?:deadline|due|response|close[sd]?|submit)[:\s]*(\w+ \d{1,2},? \d{4})/i,
    /(?:deadline|due|response|close[sd]?|submit)[:\s]*(\d{4}-\d{2}-\d{2})/i
  ];

  for (const pattern of deadlinePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const date = new Date(match[1]);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } catch (e) {
        // Invalid date
      }
    }
  }

  return null;
}

export default { scrapeSamDaily };
