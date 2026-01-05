import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', '..', 'data', 'solicitations.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS solicitations (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    agency TEXT,
    posted_date TEXT,
    response_deadline TEXT,
    source_url TEXT,
    related_links TEXT,
    scraped_at TEXT NOT NULL,
    is_relevant INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS scrape_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL,
    categories_scraped TEXT,
    items_found INTEGER DEFAULT 0,
    errors TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_solicitations_category ON solicitations(category);
  CREATE INDEX IF NOT EXISTS idx_solicitations_posted_date ON solicitations(posted_date);
  CREATE INDEX IF NOT EXISTS idx_solicitations_agency ON solicitations(agency);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Default filter settings
const DEFAULT_SETTINGS = {
  naicsCodes: [
    '334220', '334511', '334290', '541330', '541512', '541715',
    '336411', '336414', '336419', '334419', '334418', '561210'
  ],
  noticeTypes: [
    { code: 'p', name: 'Presolicitation', enabled: true },
    { code: 'k', name: 'Combined Synopsis/Solicitation', enabled: true },
    { code: 'r', name: 'Sources Sought', enabled: true },
    { code: 'a', name: 'Award Notice', enabled: true },
    { code: 's', name: 'Special Notice', enabled: true },
    { code: 'u', name: 'Justification & Approval (J&A)', enabled: true },
    { code: 'f', name: 'Fair Opportunity / Limited Sources', enabled: false },
    { code: 'i', name: 'Intent to Bundle', enabled: false },
    { code: 'g', name: 'Sale of Surplus Property', enabled: false }
  ],
  keywords: [
    'electronic warfare', 'RF system', 'radio frequency', 'radar system',
    'signal processing', 'EW system', 'jamming', 'SIGINT', 'spectrum',
    'antenna', 'microwave'
  ]
  // Date range is calculated automatically:
  // - Monday: Saturday through Monday (catch weekend postings)
  // - Other days: current day only
};

// Initialize default settings if not present
const initSettings = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
initSettings.run('filterSettings', JSON.stringify(DEFAULT_SETTINGS));

// Migration: Fix invalid notice types (remove 'o', add 'u' and 'f' if missing)
const migrateSettings = () => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('filterSettings');
  if (row) {
    const settings = JSON.parse(row.value);
    if (settings.noticeTypes) {
      // Remove invalid 'o' type
      const hasInvalidO = settings.noticeTypes.some(nt => nt.code === 'o');
      const missingU = !settings.noticeTypes.some(nt => nt.code === 'u');
      const missingF = !settings.noticeTypes.some(nt => nt.code === 'f');

      if (hasInvalidO || missingU || missingF) {
        // Filter out invalid 'o' type
        settings.noticeTypes = settings.noticeTypes.filter(nt => nt.code !== 'o');

        // Add missing valid types
        if (missingU) {
          settings.noticeTypes.push({ code: 'u', name: 'Justification & Approval (J&A)', enabled: true });
        }
        if (missingF) {
          settings.noticeTypes.push({ code: 'f', name: 'Fair Opportunity / Limited Sources', enabled: false });
        }

        // Save migrated settings
        db.prepare('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
          .run(JSON.stringify(settings), 'filterSettings');
        console.log('[Database] Migrated settings: fixed invalid notice types');
      }
    }
  }
};
migrateSettings();

export const getSettings = () => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('filterSettings');
  if (row) {
    return JSON.parse(row.value);
  }
  return DEFAULT_SETTINGS;
};

export const updateSettings = (settings) => {
  db.prepare('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
    .run(JSON.stringify(settings), 'filterSettings');
  return getSettings();
};

// Prepared statements for common operations
export const insertSolicitation = db.prepare(`
  INSERT OR REPLACE INTO solicitations
  (id, category, title, description, agency, posted_date, response_deadline, source_url, related_links, scraped_at, is_relevant, notes, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
`);

export const getSolicitations = (filters = {}) => {
  let query = 'SELECT * FROM solicitations WHERE 1=1';
  const params = [];

  if (filters.category) {
    query += ' AND category = ?';
    params.push(filters.category);
  }

  if (filters.agency) {
    query += ' AND agency LIKE ?';
    params.push(`%${filters.agency}%`);
  }

  if (filters.search) {
    query += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  // Filter by NAICS code (stored in description as "NAICS: XXXXXX")
  if (filters.naics) {
    query += ' AND description LIKE ?';
    params.push(`%NAICS: ${filters.naics}%`);
  }

  // Filter by keyword (search in title and description)
  if (filters.keyword) {
    query += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${filters.keyword}%`, `%${filters.keyword}%`);
  }

  if (filters.startDate) {
    query += ' AND posted_date >= ?';
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    query += ' AND posted_date <= ?';
    params.push(filters.endDate);
  }

  if (filters.isRelevant !== undefined && filters.isRelevant !== '') {
    if (filters.isRelevant === 'true' || filters.isRelevant === true) {
      query += ' AND is_relevant = 1';
    } else if (filters.isRelevant === 'false' || filters.isRelevant === false) {
      query += ' AND is_relevant = 0';
    } else if (filters.isRelevant === 'null') {
      query += ' AND is_relevant IS NULL';
    }
  }

  query += ' ORDER BY posted_date DESC, scraped_at DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params);
};

export const getSolicitationById = db.prepare('SELECT * FROM solicitations WHERE id = ?');

export const updateSolicitation = db.prepare(`
  UPDATE solicitations SET is_relevant = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
`);

export const getDistinctAgencies = () => {
  return db.prepare('SELECT DISTINCT agency FROM solicitations WHERE agency IS NOT NULL ORDER BY agency').all();
};

export const getDistinctCategories = () => {
  return db.prepare('SELECT DISTINCT category FROM solicitations ORDER BY category').all();
};

export const insertScrapeLog = db.prepare(`
  INSERT INTO scrape_logs (started_at, status, categories_scraped, items_found, errors)
  VALUES (?, ?, ?, ?, ?)
`);

export const updateScrapeLog = db.prepare(`
  UPDATE scrape_logs SET completed_at = ?, status = ?, items_found = ?, errors = ? WHERE id = ?
`);

export const getRecentScrapeLogs = db.prepare(`
  SELECT * FROM scrape_logs ORDER BY started_at DESC LIMIT 10
`);

export const archiveOldSolicitations = () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

  return db.prepare(`
    DELETE FROM solicitations
    WHERE response_deadline IS NOT NULL
    AND response_deadline < ?
  `).run(dateStr);
};

export default db;
