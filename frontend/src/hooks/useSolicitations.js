import { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';

export function useSolicitations() {
  const [solicitations, setSolicitations] = useState([]);
  const [filters, setFilters] = useState({});
  const [availableFilters, setAvailableFilters] = useState({ agencies: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scrapeStatus, setScrapeStatus] = useState(null);

  const fetchSolicitations = useCallback(async (currentFilters = filters) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getSolicitations(currentFilters);
      setSolicitations(result.data || []);
    } catch (err) {
      setError(err.message);
      setSolicitations([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchFilters = useCallback(async () => {
    try {
      const result = await api.getFilters();
      setAvailableFilters(result.data || { agencies: [], categories: [] });
    } catch (err) {
      console.error('Failed to fetch filters:', err);
    }
  }, []);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => {
      const updated = { ...prev, ...newFilters };
      fetchSolicitations(updated);
      return updated;
    });
  }, [fetchSolicitations]);

  const clearFilters = useCallback(() => {
    setFilters({});
    fetchSolicitations({});
  }, [fetchSolicitations]);

  const updateSolicitation = useCallback(async (id, data) => {
    try {
      await api.updateSolicitation(id, data);
      setSolicitations(prev =>
        prev.map(s => s.id === id ? { ...s, ...data } : s)
      );
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, []);

  const triggerScrape = useCallback(async () => {
    try {
      const result = await api.triggerScrape();
      setScrapeStatus(result.status);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const checkScrapeStatus = useCallback(async () => {
    try {
      const result = await api.getScrapeStatus();
      setScrapeStatus(result.status);
      return result.status;
    } catch (err) {
      console.error('Failed to check scrape status:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchSolicitations();
    fetchFilters();
  }, []);

  // Poll for scrape status when scraping
  useEffect(() => {
    if (scrapeStatus?.isRunning) {
      const interval = setInterval(async () => {
        const status = await checkScrapeStatus();
        if (!status?.isRunning) {
          clearInterval(interval);
          fetchSolicitations();
          fetchFilters();
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [scrapeStatus?.isRunning, checkScrapeStatus, fetchSolicitations, fetchFilters]);

  return {
    solicitations,
    filters,
    availableFilters,
    loading,
    error,
    scrapeStatus,
    updateFilters,
    clearFilters,
    updateSolicitation,
    triggerScrape,
    checkScrapeStatus,
    refresh: () => {
      fetchSolicitations();
      fetchFilters();
    }
  };
}
