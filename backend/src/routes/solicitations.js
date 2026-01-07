import express from 'express';
import {
  getSolicitations,
  getSolicitationById,
  updateSolicitation,
  getDistinctAgencies,
  getDistinctCategories,
  getRecentScrapeLogs,
  archiveOldSolicitations,
  getSettings,
  updateSettings
} from '../models/database.js';
import { fetchFromSamGov } from '../services/samgov-api.js';
import { scrapeSamDaily } from '../services/scraper.js';

const router = express.Router();

// Track scraping status
let scrapeStatus = {
  isRunning: false,
  lastRun: null,
  progress: [],
  result: null
};

// GET /api/solicitations - Get all solicitations with optional filters
router.get('/', (req, res) => {
  try {
    const {
      category,
      agency,
      search,
      startDate,
      endDate,
      isRelevant,
      myInterests
    } = req.query;

    // Get settings if myInterests filter is enabled
    const settings = myInterests === 'true' ? getSettings() : null;

    const solicitations = getSolicitations({
      category,
      agency,
      search,
      startDate,
      endDate,
      isRelevant,
      myInterests
    }, settings);

    // Parse related_links JSON for each item
    const formatted = solicitations.map(s => ({
      ...s,
      relatedLinks: s.related_links ? JSON.parse(s.related_links) : [],
      isRelevant: s.is_relevant === 1 ? true : s.is_relevant === 0 ? false : null,
      postedDate: s.posted_date,
      responseDeadline: s.response_deadline,
      sourceUrl: s.source_url,
      scrapedAt: s.scraped_at,
      createdAt: s.created_at,
      updatedAt: s.updated_at
    }));

    res.json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (error) {
    console.error('Error getting solicitations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/solicitations/filters - Get available filter options
router.get('/filters', (req, res) => {
  try {
    const agencies = getDistinctAgencies().map(a => a.agency);
    const categories = getDistinctCategories().map(c => c.category);

    res.json({
      success: true,
      data: {
        agencies,
        categories
      }
    });
  } catch (error) {
    console.error('Error getting filters:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/solicitations/settings - Get current filter settings
router.get('/settings', (req, res) => {
  try {
    const settings = getSettings();
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/solicitations/settings - Update filter settings
router.put('/settings', (req, res) => {
  try {
    const settings = req.body;

    // Validate required fields
    if (!settings.naicsCodes || !Array.isArray(settings.naicsCodes)) {
      return res.status(400).json({
        success: false,
        error: 'naicsCodes must be an array'
      });
    }
    if (!settings.noticeTypes || !Array.isArray(settings.noticeTypes)) {
      return res.status(400).json({
        success: false,
        error: 'noticeTypes must be an array'
      });
    }
    if (!settings.keywords || !Array.isArray(settings.keywords)) {
      return res.status(400).json({
        success: false,
        error: 'keywords must be an array'
      });
    }

    const updated = updateSettings(settings);
    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/solicitations/:id - Get a single solicitation
router.get('/:id', (req, res) => {
  try {
    const solicitation = getSolicitationById.get(req.params.id);

    if (!solicitation) {
      return res.status(404).json({
        success: false,
        error: 'Solicitation not found'
      });
    }

    const formatted = {
      ...solicitation,
      relatedLinks: solicitation.related_links ? JSON.parse(solicitation.related_links) : [],
      isRelevant: solicitation.is_relevant === 1 ? true : solicitation.is_relevant === 0 ? false : null,
      postedDate: solicitation.posted_date,
      responseDeadline: solicitation.response_deadline,
      sourceUrl: solicitation.source_url,
      scrapedAt: solicitation.scraped_at
    };

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('Error getting solicitation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PATCH /api/solicitations/:id - Update relevance and notes
router.patch('/:id', (req, res) => {
  try {
    const { isRelevant, notes } = req.body;
    const { id } = req.params;

    // Check if solicitation exists
    const existing = getSolicitationById.get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Solicitation not found'
      });
    }

    // Convert boolean to integer for SQLite
    const relevantValue = isRelevant === true ? 1 : isRelevant === false ? 0 : null;

    updateSolicitation.run(relevantValue, notes || null, id);

    const updated = getSolicitationById.get(id);
    res.json({
      success: true,
      data: {
        ...updated,
        relatedLinks: updated.related_links ? JSON.parse(updated.related_links) : [],
        isRelevant: updated.is_relevant === 1 ? true : updated.is_relevant === 0 ? false : null
      }
    });
  } catch (error) {
    console.error('Error updating solicitation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/scrape - Trigger a new fetch from SAM.gov API
// Query param: ?source=samdaily to use legacy scraper
router.post('/scrape', async (req, res) => {
  if (scrapeStatus.isRunning) {
    return res.status(409).json({
      success: false,
      error: 'A fetch is already in progress',
      status: scrapeStatus
    });
  }

  const source = req.query.source || 'samgov';

  try {
    scrapeStatus = {
      isRunning: true,
      lastRun: new Date().toISOString(),
      progress: [],
      result: null,
      source: source
    };

    // Return immediately and run fetch in background
    res.json({
      success: true,
      message: source === 'samgov' ? 'Fetching from SAM.gov API...' : 'Scraping SAM Daily...',
      status: scrapeStatus
    });

    const progressCallback = (message) => {
      scrapeStatus.progress.push({
        time: new Date().toISOString(),
        message
      });
    };

    let result;

    if (source === 'samgov') {
      // Use official SAM.gov API - fetches all opportunities, filters locally
      result = await fetchFromSamGov(progressCallback);
    } else {
      // Legacy SAM Daily scraper (fallback)
      result = await scrapeSamDaily(progressCallback);
    }

    scrapeStatus.isRunning = false;
    scrapeStatus.result = result;

  } catch (error) {
    console.error('Fetch error:', error);
    scrapeStatus.isRunning = false;
    scrapeStatus.result = {
      success: false,
      error: error.message
    };
  }
});

// GET /api/scrape/status - Get current scrape status
router.get('/scrape/status', (req, res) => {
  res.json({
    success: true,
    status: scrapeStatus
  });
});

// GET /api/scrape/logs - Get recent scrape logs
router.get('/scrape/logs', (req, res) => {
  try {
    const logs = getRecentScrapeLogs.all();
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Error getting scrape logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/archive - Archive old solicitations
router.post('/archive', (req, res) => {
  try {
    const result = archiveOldSolicitations();
    res.json({
      success: true,
      message: `Archived ${result.changes} old solicitations`
    });
  } catch (error) {
    console.error('Error archiving:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/export - Export data as JSON
router.get('/export', (req, res) => {
  try {
    const format = req.query.format || 'json';
    const solicitations = getSolicitations(req.query);

    const formatted = solicitations.map(s => ({
      id: s.id,
      category: s.category,
      title: s.title,
      description: s.description,
      agency: s.agency,
      postedDate: s.posted_date,
      responseDeadline: s.response_deadline,
      sourceUrl: s.source_url,
      relatedLinks: s.related_links ? JSON.parse(s.related_links) : [],
      scrapedAt: s.scraped_at,
      isRelevant: s.is_relevant === 1 ? true : s.is_relevant === 0 ? false : null,
      notes: s.notes
    }));

    if (format === 'csv') {
      const headers = ['id', 'category', 'title', 'description', 'agency', 'postedDate', 'responseDeadline', 'sourceUrl', 'isRelevant', 'notes'];
      const csv = [
        headers.join(','),
        ...formatted.map(row =>
          headers.map(h => {
            let val = row[h] ?? '';
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
              val = '"' + val.replace(/"/g, '""') + '"';
            }
            return val;
          }).join(',')
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=solicitations.csv');
      return res.send(csv);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=solicitations.json');
    res.json(formatted);
  } catch (error) {
    console.error('Error exporting:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
