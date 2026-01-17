import { useState, useEffect, useCallback, useRef } from 'react';

export interface MeSHSuggestion {
  ui: string;
  name: string;
}

// NLM MeSH Browser API
const MESH_API = 'https://id.nlm.nih.gov/mesh/lookup/term';

export function useMeSHAutocomplete(debounceMs = 300) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MeSHSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(async (term: string) => {
    if (!term || term.length < 2) {
      setSuggestions([]);
      return;
    }

    // Cancel previous
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsLoading(true);

    try {
      const url = `${MESH_API}?label=${encodeURIComponent(term)}&match=contains&limit=12`;
      const res = await fetch(url, { 
        signal: abortRef.current.signal,
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) throw new Error('API error');

      const data = await res.json();
      
      // NLM returns array of objects with resource and label
      const results: MeSHSuggestion[] = (data || []).map((item: any) => ({
        ui: item.resource?.split('/').pop() || '',
        name: item.label || '',
      })).filter((item: MeSHSuggestion) => item.name);

      setSuggestions(results);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setSuggestions([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounce
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs, search]);

  // Cleanup
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    setSuggestions([]);
  }, []);

  return { query, setQuery, suggestions, isLoading, clear };
}

// Common MeSH terms for quick selection
export const COMMON_MESH = [
  'Diabetes Mellitus',
  'Hypertension',
  'Heart Failure',
  'Neoplasms',
  'Obesity',
  'Asthma',
  'Stroke',
  'Depressive Disorder',
  'Alzheimer Disease',
  'Breast Neoplasms',
  'Coronary Artery Disease',
  'Chronic Kidney Disease',
];

export default useMeSHAutocomplete;

