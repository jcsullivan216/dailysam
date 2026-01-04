# SAM.gov Solicitations Tracker

## Project Overview

A web application that fetches and tracks federal government solicitations from the official **SAM.gov API** relevant to RF/EW (Radio Frequency/Electronic Warfare) and defense industry work.

**Data Source**: Official SAM.gov Opportunities API (https://api.sam.gov)

## Business Context

This tool is for tracking DoD procurement opportunities across military branches. The focus is on identifying new solicitations and contract announcements in:
- Radio Frequency (RF) systems
- Electronic Warfare (EW)
- Autonomy
- Defense/military technology
- Related DoD programs/soliciations

## Data Fetching

### SAM.gov API Integration

The application uses the official SAM.gov Opportunities API to fetch federal procurement data:

**API Endpoint**: `https://api.sam.gov/opportunities/v2/search`

### What Gets Fetched

1. **By NAICS Codes** (defense/RF/EW relevant):
   - 334220 - Radio/TV Broadcasting Equipment
   - 334511 - Search, Detection, Navigation Systems
   - 334290 - Communications Equipment
   - 541330 - Engineering Services
   - 541512 - Computer Systems Design
   - 541715 - R&D in Physical/Engineering Sciences
   - 336411 - Aircraft Manufacturing
   - 336414 - Guided Missile/Space Vehicle Manufacturing

2. **By Keywords**:
   - Electronic warfare, RF system, radio frequency
   - Radar system, signal processing, EW system
   - Jamming, SIGINT, spectrum, antenna, microwave

### Notice Types

- **A** - Award Notices
- **D** - Combined Synopsis/Solicitation
- **R** - Solicitations, Presolicitations, Sources Sought
- **J** - Special Notices, Justifications

## Data Structure

```json
{
  "id": "unique_identifier",
  "category": "A, D, J, R, or NAICS code",
  "title": "Full solicitation title",
  "description": "Brief summary (2-3 sentences)",
  "agency": "Issuing agency name",
  "postedDate": "YYYY-MM-DD",
  "responseDeadline": "YYYY-MM-DD or null",
  "sourceUrl": "Direct link to posting",
  "relatedLinks": [
    {
      "title": "Link title",
      "url": "https://..."
    }
  ],
  "scrapedAt": "ISO timestamp",
  "isRelevant": null // for user tagging
}
```

## Web Application Requirements

### Frontend Features

1. **Dashboard View**
   - Grid/card layout showing all solicitations as tiles
   - Each tile displays:
     - Category badge (A, D, J, R, or NAICS number)
     - Title (clickable to source)
     - Brief description
     - Agency name
     - Posted date
     - Days until deadline (if applicable)
     - Relevance flag toggle

2. **Filtering & Search**
   - Filter by category (A, D, J, R, NAICS codes)
   - Search by title/description keywords
   - Filter by agency
   - Filter by date range
   - Filter by relevance flag

3. **Tile Interaction**
   - Click tile to expand and show full details
   - Expanded view shows:
     - Complete description
     - All related links (clickable)
     - Button to open source URL in new tab
     - Toggle to mark as "relevant" or "not relevant"
     - Notes field (free text)

4. **Data Management**
   - Manual refresh button to re-scrape
   - Auto-refresh option (daily)
   - Export to CSV/JSON
   - Archive old solicitations (>30 days past deadline)

### Backend Requirements

1. **Scraper Module**
   - Headless browser (Playwright or Puppeteer) to handle JavaScript
   - Error handling for missing pages/links
   - Rate limiting to be respectful to SAM Daily
   - Logging of scrape operations

2. **Data Storage**
   - Local JSON file or SQLite database
   - Store historical data (don't delete on re-scrape)
   - Track which items are new vs. updated

3. **Server**
   - Simple backend (Node.js/Express or Python/Flask)
   - API endpoints:
     - GET /solicitations (with query params for filtering)
     - POST /scrape (trigger new scrape)
     - PATCH /solicitations/:id (update relevance/notes)
     - GET /export (download data)

## Technical Stack Recommendations

- **Scraping**: Playwright (handles JS-heavy sites well)
- **Backend**: Node.js with Express OR Python with Flask
- **Frontend**: React or Vue.js with Tailwind CSS
- **Data Storage**: SQLite (easy, local, no setup) OR JSON files
- **Scheduling**: node-cron or Python schedule for auto-refresh

## UI/UX Guidelines

- Clean, professional interface suitable for business use
- Quick loading and responsive design
- Color coding for categories:
  - Awards (A) - Green
  - Solicitations (D, R) - Blue
  - J&A (J) - Orange
  - NAICS codes - Purple/Gray
- Highlight items within 7 days of deadline
- Mobile-friendly responsive layout

## Error Handling

- Handle missing "Today's SAM" link gracefully
- Log when specific category links (A, D, J, etc.) are not found
- Continue scraping other categories if one fails
- Display user-friendly error messages in UI
- Store error logs for debugging

## Deployment

- Should run locally (localhost)
- Single command to start (npm start or python app.py)
- Include setup instructions in README
- Environment variables for any configuration

## Success Criteria

1. Successfully scrapes all specified categories from SAM Daily
2. Extracts accurate titles, descriptions, and metadata
3. Displays data in clean, filterable web interface
4. Allows marking items as relevant and adding notes
5. Can re-scrape to get latest data
6. Exports data for further analysis

## Additional Notes

- NAICS codes and keywords can be customized in `backend/src/services/samgov-api.js`
- API rate limit: 1,000 requests/day (sufficient for daily fetching)
- Data is fetched from the last 30 days of postings
- Future enhancement: AI-powered relevance scoring based on business focus

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm 9+ installed
- SAM.gov API key (free)

### Quick Start (First Time Setup)

```bash
# 1. Clone the repository
git clone https://github.com/jcsullivan216/dailysam.git
cd dailysam

# 2. Install root dependencies first
npm install

# 3. Install all dependencies and build frontend
npm run setup

# 4. Configure environment
cp backend/.env.example backend/.env

# 5. Start the application
npm start

# 6. Open your browser to http://localhost:3001
```

On first launch:
1. The SQLite database will be automatically created in `backend/data/`
2. Click **"Refresh Data"** to fetch opportunities from SAM.gov
3. Wait for the fetch to complete (progress shown in UI)
4. Browse and filter the imported solicitations

### Running the Application

**Development Mode (with hot reload):**
```bash
npm run dev
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

**Production Mode:**
```bash
npm start
```
- Full application: http://localhost:3001

### Environment Variables

The `backend/.env.example` file contains:

| Variable | Value | Description |
|----------|-------|-------------|
| `SAM_API_KEY` | `SAM-0be519ef-1856-4798-999a-3021fd2476f4` | SAM.gov API key |
| `PORT` | `3001` | Backend server port |
| `ENABLE_AUTO_SCRAPE` | `false` | Enable daily auto-fetch at 6 AM |

### Project Structure

```
dailysam/
├── backend/
│   ├── src/
│   │   ├── index.js          # Express server entry
│   │   ├── models/
│   │   │   └── database.js   # SQLite database setup
│   │   ├── routes/
│   │   │   └── solicitations.js  # API routes
│   │   └── services/
│   │       ├── samgov-api.js # SAM.gov API client (primary)
│   │       └── scraper.js    # SAM Daily scraper (fallback)
│   ├── .env                  # Environment variables (create from .env.example)
│   └── data/                 # SQLite database (auto-created)
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main React app
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom React hooks
│   │   └── services/         # API client
│   └── dist/                 # Production build (auto-generated)
└── package.json              # Root package with scripts
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/solicitations` | List solicitations (with filters) |
| GET | `/api/solicitations/:id` | Get single solicitation |
| PATCH | `/api/solicitations/:id` | Update relevance/notes |
| GET | `/api/solicitations/filters` | Get available filter options |
| POST | `/api/scrape` | Trigger new scrape |
| GET | `/api/scrape/status` | Get current scrape status |
| GET | `/api/export` | Export data (JSON/CSV) |
| POST | `/api/archive` | Archive old solicitations |

### Usage

1. Start the application
2. Click **"Refresh Data"** to fetch from SAM.gov API
3. Browse and filter solicitations
4. Click cards to expand details
5. Mark items as relevant/not relevant
6. Add notes for future reference
7. Export data as needed

### Troubleshooting

| Issue | Solution |
|-------|----------|
| `SAM_API_KEY required` error | Add your API key to `backend/.env` |
| `npm run setup` fails | Ensure Node.js 18+ is installed: `node --version` |
| API rate limit (429) | Wait 1 minute; limit is 1,000 requests/day |
| Port 3001 in use | Set custom port in `backend/.env`: `PORT=3002` |
| No results found | Check NAICS codes in `samgov-api.js` match your needs |
| Database errors | Delete `backend/data/` folder and restart |

### Enabling Auto-Fetch

To enable automatic daily fetching at 6 AM, edit `backend/.env` and set:

```env
ENABLE_AUTO_SCRAPE=true
```

### Using Legacy SAM Daily Scraper

If you need to use the legacy SAM Daily scraper instead of the API:

```bash
# Via API call
curl -X POST "http://localhost:3001/api/scrape?source=samdaily"
```

---

**Data Source**: Official SAM.gov Opportunities API - reliable, structured JSON data with no scraping issues.
