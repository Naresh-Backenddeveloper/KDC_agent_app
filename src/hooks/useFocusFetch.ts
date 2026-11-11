import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { Envelope } from '../domain/types';

/**
 * Screens fetch their own data every time they come into focus (spec 2.3: no
 * caching), with pull-to-refresh and a retryable error state.
 */
export function useFocusFetch<T>(fetcher: () => Promise<Envelope<T>>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const loaded = useRef(false);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'silent') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    const res = await fetchRef.current();
    if (res.code === 0) {
      setData((res.data ?? null) as T | null);
      setError(null);
      loaded.current = true;
    } else if (!loaded.current || mode !== 'silent') {
      setError(res.message || 'Couldn’t load. Please try again.');
    }
    setLoading(false);
    setRefreshing(false);
    return res;
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(loaded.current ? 'silent' : 'initial');
    }, [load]),
  );

  return { data, setData, loading, refreshing, error, reload: load, refresh: () => load('refresh') };
}
