const API_BASE = '/api';

async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || 'Request failed');
  }
  return response.json();
}

export async function getSolicitations(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  });

  const queryString = params.toString();
  const url = `${API_BASE}/solicitations${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url);
  return handleResponse(response);
}

export async function getSolicitation(id) {
  const response = await fetch(`${API_BASE}/solicitations/${id}`);
  return handleResponse(response);
}

export async function updateSolicitation(id, data) {
  const response = await fetch(`${API_BASE}/solicitations/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function getFilters() {
  const response = await fetch(`${API_BASE}/solicitations/filters`);
  return handleResponse(response);
}

export async function triggerScrape() {
  const response = await fetch(`${API_BASE}/scrape`, {
    method: 'POST',
  });
  return handleResponse(response);
}

export async function getScrapeStatus() {
  const response = await fetch(`${API_BASE}/scrape/status`);
  return handleResponse(response);
}

export async function getScrapeLogs() {
  const response = await fetch(`${API_BASE}/scrape/logs`);
  return handleResponse(response);
}

export async function archiveOld() {
  const response = await fetch(`${API_BASE}/archive`, {
    method: 'POST',
  });
  return handleResponse(response);
}

export function getExportUrl(format = 'json', filters = {}) {
  const params = new URLSearchParams({ format });

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  });

  return `${API_BASE}/export?${params.toString()}`;
}

export async function getSettings() {
  const response = await fetch(`${API_BASE}/settings`);
  return handleResponse(response);
}

export async function updateSettings(settings) {
  const response = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(settings),
  });
  return handleResponse(response);
}
