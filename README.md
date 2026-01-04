# SAM Daily Solicitations Tracker

## Project Overview

Build a web application that automatically scrapes and tracks federal government solicitations and announcements from SAM Daily (https://samdaily.us/) relevant to RF/EW (Radio Frequency/Electronic Warfare) and defense industry work.

## Business Context

This tool is for tracking DoD procurement opportunities across military branches. The focus is on identifying new solicitations and contract announcements in:
- Radio Frequency (RF) systems
- Electronic Warfare (EW)
- Autonomy
- Defense/military technology
- Related DoD programs/soliciations

## Scraping Workflow

### Step 1: Navigate to SAM Daily
- Start at: https://samdaily.us/
- Find and click the "Today's SAM" link

### Step 2: Extract Specific Category Links
From the "Today's SAM" page, locate and scrape content from links with these exact labels:
- **A** (typically Awards)
- **D** (typically Combined Synopsis/Solicitations)
- **J** (typically Justifications & Approvals)
- **R** (typically Solicitations)
- **10** (NAICS code category)
- **16** (NAICS code category)
- **19** (NAICS code category)
- **25** (NAICS code category)
- **58** (NAICS code category)
- **59** (NAICS code category)
- **60** (NAICS code category)
- **61** (NAICS code category)

### Step 3: Extract Data from Each Link
For each link above, collect:
- **Solicitation/Notice Title**
- **Brief description** (summary text from the page)
- **Agency/Organization**
- **Posted date**
- **Response deadline** (if applicable)
- **Any embedded links** within the page (extract titles and URLs)
- **Full URL** to the original posting

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

- SAM Daily structure may change; build with flexibility for minor HTML changes
- Focus on RF/EW, defense contracting, DoD procurement keywords for relevance detection
- Consider adding keyword highlighting in descriptions
- Future enhancement: AI-powered relevance scoring based on business focus

## Getting Started for Developer

1. Clone/create project directory
2. Install dependencies
3. Run initial scrape to test
4. Start development server
5. Access at localhost:3000 (or specified port)

---

**Priority**: This is a business-critical tool for tracking federal procurement opportunities. Reliability and accuracy are more important than fancy features.
