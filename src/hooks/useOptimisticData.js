import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for optimistic data fetching with localStorage caching.
 * 
 * @param {string} key - Unique key for localStorage (e.g., 'users_list')
 * @param {Function} fetcher - Async function to fetch fresh data
 * @param {any} initialValue - Initial value if nothing in cache
 * @param {number} [staleTime=0] - Time in ms to consider cache fresh (optional, currently unused but good for future)
 * @returns {Object} { data, loading, error, refresh, isStale }
 */
export const useOptimisticData = (key, fetcher, initialValue = [], dependencies = []) => {
    // Try to initialize from localStorage
    const initializeFromCache = () => {
        try {
            const cached = localStorage.getItem(key);
            if (cached) {
                const parsed = JSON.parse(cached);
                // Simple validation: check if it has timestamp and data
                if (parsed && parsed.timestamp && parsed.data !== undefined) {
                    return parsed.data;
                }
                // Fallback for raw data if stored previously without wrapper
                return parsed;
            }
        } catch (e) {
            console.warn(`Error parsing cache for ${key}:`, e);
        }
        return initialValue;
    };

    const [data, setData] = useState(initializeFromCache);
    const [loading, setLoading] = useState(!localStorage.getItem(key)); // Only load if no cache
    const [error, setError] = useState(null);
    const [isStale, setIsStale] = useState(true); // Always assume stale on mount to trigger refetch

    const refresh = useCallback(async (silent = true) => {
        if (!silent) setLoading(true);
        setError(null);

        try {
            console.log(`🔄 Fetching fresh data for ${key}...`);
            const freshData = await fetcher();

            // Update state
            setData(freshData);

            // Update cache
            try {
                localStorage.setItem(key, JSON.stringify({
                    timestamp: Date.now(),
                    data: freshData
                }));
            } catch (e) {
                console.warn('Quota exceeded or storage error:', e);
            }

            setIsStale(false);
        } catch (err) {
            console.error(`❌ Error fetching ${key}:`, err);
            setError(err);
            // We keep the old data if fetch fails!
        } finally {
            setLoading(false);
        }
    }, [key, fetcher]);

    // Initial fetch
    useEffect(() => {
        refresh(!!localStorage.getItem(key)); // Silent if we have cache
    }, [refresh, ...dependencies]);

    return {
        data,
        loading: loading && !data, // Only show "loading" if we have absolutely NO data
        isRefetching: loading && !!data, // Show a small indicator if refreshing background?
        error,
        refresh,
        setData // Expose updater to optimistic UI updates
    };
};
