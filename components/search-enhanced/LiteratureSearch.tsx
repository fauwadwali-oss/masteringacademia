import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search, Filter, Calendar, FileText, ChevronDown, ChevronUp,
  X, Plus, Loader2, RefreshCw, BookOpen, Tag
} from 'lucide-react';

// ============ TYPES ============
export interface SearchFilters {
  dateFrom: string;
  dateTo: string;
  studyTypes: string[];
  meshTerms: string[];
  mustInclude: string[];
  mustExclude: string[];
  humansOnly: boolean;
  freeFullText: boolean;
}

interface Database {
  id: string;
  name: string;
  count: string;
  enabled: boolean;
}

interface Props {
  onSearch: (query: string, filters: SearchFilters, databases: string[], maxResults: number) => void;
  isSearching?: boolean;
}

// ============ CONSTANTS ============
const DATABASES: Database[] = [
  { id: 'pubmed', name: 'PubMed', count: '35M', enabled: true },
  { id: 'openalex', name: 'OpenAlex', count: '250M', enabled: true },
  { id: 'semantic_scholar', name: 'Semantic Scholar', count: '200M', enabled: false },
  { id: 'europe_pmc', name: 'Europe PMC', count: '40M', enabled: false },
  { id: 'medrxiv', name: 'medRxiv', count: '50K+', enabled: true },
  { id: 'biorxiv', name: 'bioRxiv', count: '200K+', enabled: false },
];

const STUDY_TYPES = [
  'Randomized Controlled Trial',
  'Meta-Analysis',
  'Systematic Review',
  'Clinical Trial',
  'Cohort Study',
  'Case-Control Study',
  'Observational Study',
  'Review',
  'Practice Guideline',
];

const COMMON_MESH = [
  'Diabetes Mellitus',
  'Hypertension',
  'Heart Failure',
  'Neoplasms',
  'Obesity',
  'Asthma',
  'Stroke',
  'Depressive Disorder',
];

const EMPTY_FILTERS: SearchFilters = {
  dateFrom: '',
  dateTo: '',
  studyTypes: [],
  meshTerms: [],
  mustInclude: [],
  mustExclude: [],
  humansOnly: false,
  freeFullText: false,
};

// ============ MESH AUTOCOMPLETE HOOK ============
interface MeSHSuggestion {
  ui: string;
  name: string;
}

function useMeSHAutocomplete(debounceMs = 300) {
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

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsLoading(true);

    try {
      const url = `https://id.nlm.nih.gov/mesh/lookup/term?label=${encodeURIComponent(term)}&match=contains&limit=10`;
      const res = await fetch(url, {
        signal: abortRef.current.signal,
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();

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

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs, search]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    setSuggestions([]);
  }, []);

  return { query, setQuery, suggestions, isLoading, clear };
}

// ============ MESH INPUT COMPONENT ============
interface MeSHInputProps {
  selected: string[];
  onAdd: (term: string) => void;
  onRemove: (index: number) => void;
}

const MeSHInput: React.FC<MeSHInputProps> = ({ selected, onAdd, onRemove }) => {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { query, setQuery, suggestions, isLoading, clear } = useMeSHAutocomplete(250);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleSelect = (term: string) => {
    if (!selected.includes(term)) {
      onAdd(term);
    }
    clear();
    setOpen(false);
  };

  const showResults = query.length >= 2 && suggestions.length > 0;
  const showCommon = query.length < 2 && open;

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex items-center gap-2 px-3 py-2 bg-gray-900/50 border rounded-lg transition-colors ${
        open ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-gray-600'
      }`}>
        <Tag className="w-4 h-4 text-teal-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && suggestions.length > 0) {
              e.preventDefault();
              handleSelect(suggestions[0].name);
            }
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="Search MeSH terms..."
          className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none min-w-0"
        />
        {isLoading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
        {query && !isLoading && (
          <button onClick={() => clear()} className="p-0.5 hover:bg-gray-700 rounded">
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (showResults || showCommon) && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-60 overflow-auto">
          {showResults && (
            <>
              <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-700 sticky top-0 bg-gray-800">
                MeSH Results
              </div>
              {suggestions.map((s) => (
                <button
                  key={s.ui}
                  onClick={() => handleSelect(s.name)}
                  disabled={selected.includes(s.name)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700/50 flex items-center gap-2 ${
                    selected.includes(s.name) ? 'opacity-50' : ''
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-gray-200">{s.name}</span>
                  {selected.includes(s.name) && (
                    <span className="ml-auto text-xs text-gray-500">Added</span>
                  )}
                </button>
              ))}
            </>
          )}

          {showCommon && (
            <>
              <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-700 sticky top-0 bg-gray-800">
                Common Terms
              </div>
              {COMMON_MESH.filter(t => !selected.includes(t)).map((term) => (
                <button
                  key={term}
                  onClick={() => handleSelect(term)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700/50 flex items-center gap-2"
                >
                  <Tag className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-300">{term}</span>
                </button>
              ))}
            </>
          )}

          {query.length >= 2 && suggestions.length === 0 && !isLoading && (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              No terms found
            </div>
          )}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((term, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-1 bg-teal-600/20 text-teal-300 rounded text-sm border border-teal-500/30"
            >
              {term}
              <button onClick={() => onRemove(i)} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ============ MAIN COMPONENT ============
export const LiteratureSearch: React.FC<Props> = ({ onSearch, isSearching = false }) => {
  const [query, setQuery] = useState('');
  const [databases, setDatabases] = useState<Database[]>(DATABASES);
  const [maxResults, setMaxResults] = useState(100);
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [includeTerm, setIncludeTerm] = useState('');
  const [excludeTerm, setExcludeTerm] = useState('');

  const toggleDb = (id: string) => {
    setDatabases(dbs => dbs.map(db => db.id === id ? { ...db, enabled: !db.enabled } : db));
  };

  const updateFilter = <K extends keyof SearchFilters>(key: K, val: SearchFilters[K]) => {
    setFilters(f => ({ ...f, [key]: val }));
  };

  const toggleStudyType = (type: string) => {
    updateFilter('studyTypes',
      filters.studyTypes.includes(type)
        ? filters.studyTypes.filter(t => t !== type)
        : [...filters.studyTypes, type]
    );
  };

  const addTerm = (key: 'mustInclude' | 'mustExclude', term: string) => {
    if (term.trim() && !filters[key].includes(term.trim())) {
      updateFilter(key, [...filters[key], term.trim()]);
    }
  };

  const removeTerm = (key: 'mustInclude' | 'mustExclude' | 'meshTerms', i: number) => {
    updateFilter(key, filters[key].filter((_, idx) => idx !== i));
  };

  const setYearPreset = (years: number) => {
    if (years === 0) {
      updateFilter('dateFrom', '');
      updateFilter('dateTo', '');
    } else {
      const d = new Date();
      d.setFullYear(d.getFullYear() - years);
      updateFilter('dateFrom', d.toISOString().split('T')[0]);
      updateFilter('dateTo', '');
    }
  };

  const handleSearch = () => {
    const enabledDbs = databases.filter(db => db.enabled).map(db => db.id);
    onSearch(query, filters, enabledDbs, maxResults);
  };

  const activeCount = [
    filters.dateFrom || filters.dateTo,
    filters.studyTypes.length > 0,
    filters.meshTerms.length > 0,
    filters.mustInclude.length > 0,
    filters.mustExclude.length > 0,
    filters.humansOnly,
    filters.freeFullText,
  ].filter(Boolean).length;

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Literature Search</h2>

        {/* Search Input */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Search Query</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && query.trim() && handleSearch()}
              placeholder='e.g., "diabetes AND metformin" or "COVID-19 vaccine efficacy"'
              className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              Search
            </button>
          </div>
        </div>

        {/* Databases */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Databases to Search</label>
          <div className="flex flex-wrap gap-2">
            {databases.map(db => (
              <button
                key={db.id}
                onClick={() => toggleDb(db.id)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  db.enabled
                    ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                    : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
                }`}
              >
                {db.name} <span className="text-xs opacity-70">({db.count})</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Tip: PubMed + OpenAlex + medRxiv covers most biomedical research including preprints
          </p>
        </div>

        {/* Max Results */}
        <div className="flex items-center gap-2 mb-4">
          <label className="text-sm text-gray-400">Max results per database:</label>
          <select
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {[50, 100, 250, 500].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* ADVANCED FILTERS BUTTON */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          type="button"
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-purple-600 text-white hover:bg-purple-700 rounded-lg transition-colors"
        >
          <Filter className="w-5 h-5" />
          <span className="font-medium">Advanced Filters</span>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 bg-white text-purple-600 rounded-full text-xs font-bold">
              {activeCount}
            </span>
          )}
          {showAdvanced ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Advanced Panel */}
      {showAdvanced && (
        <div className="border-t border-gray-700 p-6 bg-gray-800/30">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">

            {/* Date Range */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                <Calendar className="w-4 h-4 text-blue-400" />
                Publication Date
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  { label: 'Last year', y: 1 },
                  { label: 'Last 5 years', y: 5 },
                  { label: 'Last 10 years', y: 10 },
                  { label: 'All time', y: 0 },
                ].map(p => (
                  <button
                    key={p.y}
                    onClick={() => setYearPreset(p.y)}
                    type="button"
                    className="px-2.5 py-1 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded text-xs transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => updateFilter('dateFrom', e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-gray-500 text-sm">to</span>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => updateFilter('dateTo', e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Study Types */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                <FileText className="w-4 h-4 text-purple-400" />
                Study Type
              </label>
              <div className="max-h-48 overflow-y-auto space-y-1 p-2 bg-gray-900/30 border border-gray-600 rounded-lg">
                {STUDY_TYPES.map(type => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700/50 px-2 py-1.5 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={filters.studyTypes.includes(type)}
                      onChange={() => toggleStudyType(type)}
                      className="rounded border-gray-500 bg-gray-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-gray-300">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* MeSH Terms */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                <BookOpen className="w-4 h-4 text-teal-400" />
                MeSH Terms
                <span className="text-xs text-gray-500 font-normal">(PubMed)</span>
              </label>
              <MeSHInput
                selected={filters.meshTerms}
                onAdd={(term) => updateFilter('meshTerms', [...filters.meshTerms, term])}
                onRemove={(i) => removeTerm('meshTerms', i)}
              />
            </div>

            {/* Must Include */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                <Plus className="w-4 h-4 text-green-400" />
                Must Include (AND)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={includeTerm}
                  onChange={(e) => setIncludeTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && includeTerm.trim()) {
                      addTerm('mustInclude', includeTerm);
                      setIncludeTerm('');
                    }
                  }}
                  placeholder="Required term..."
                  className="flex-1 px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={() => { if (includeTerm.trim()) { addTerm('mustInclude', includeTerm); setIncludeTerm(''); }}}
                  type="button"
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                {filters.mustInclude.map((term, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-green-600/20 text-green-300 rounded text-sm border border-green-500/30">
                    +{term}
                    <button onClick={() => removeTerm('mustInclude', i)} className="hover:text-white"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </div>

            {/* Must Exclude */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                <X className="w-4 h-4 text-red-400" />
                Exclude (NOT)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={excludeTerm}
                  onChange={(e) => setExcludeTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && excludeTerm.trim()) {
                      addTerm('mustExclude', excludeTerm);
                      setExcludeTerm('');
                    }
                  }}
                  placeholder="Excluded term..."
                  className="flex-1 px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={() => { if (excludeTerm.trim()) { addTerm('mustExclude', excludeTerm); setExcludeTerm(''); }}}
                  type="button"
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                {filters.mustExclude.map((term, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-red-600/20 text-red-300 rounded text-sm border border-red-500/30">
                    -{term}
                    <button onClick={() => removeTerm('mustExclude', i)} className="hover:text-white"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </div>

            {/* Additional Filters */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                <Filter className="w-4 h-4 text-yellow-400" />
                Additional Filters
              </label>
              <div className="space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.humansOnly}
                    onChange={(e) => updateFilter('humansOnly', e.target.checked)}
                    className="rounded border-gray-500 bg-gray-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Human studies only</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.freeFullText}
                    onChange={(e) => updateFilter('freeFullText', e.target.checked)}
                    className="rounded border-gray-500 bg-gray-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Free full text available</span>
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-700 flex items-center justify-between">
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              type="button"
              className="text-sm text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reset all filters
            </button>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowAdvanced(false)} 
                type="button"
                className="px-4 py-2 text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleSearch}
                disabled={isSearching || !query.trim()}
                type="button"
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                <Search className="w-4 h-4" />
                Apply & Search
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!showAdvanced && (
        <div className="px-6 pb-8">
          <div className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-700/50 flex items-center justify-center">
              <Search className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Search Multiple Databases</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Enter your search query above to search PubMed, OpenAlex, and medRxiv simultaneously.
              Results are automatically deduplicated and tracked for PRISMA compliance.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiteratureSearch;
