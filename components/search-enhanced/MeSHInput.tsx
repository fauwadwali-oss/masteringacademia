import React, { useState, useRef, useEffect } from 'react';
import { Tag, Loader2, X, ChevronDown } from 'lucide-react';
import { useMeSHAutocomplete, COMMON_MESH } from './useMeSHAutocomplete';

interface MeSHInputProps {
  selected: string[];
  onAdd: (term: string) => void;
  onRemove: (index: number) => void;
}

export const MeSHInput: React.FC<MeSHInputProps> = ({ selected, onAdd, onRemove }) => {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { query, setQuery, suggestions, isLoading, clear } = useMeSHAutocomplete(250);

  // Close on outside click
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
      {/* Input */}
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

      {/* Dropdown */}
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
              {COMMON_MESH.filter(t => !selected.includes(t)).slice(0, 8).map((term) => (
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

      {/* Selected Tags */}
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

export default MeSHInput;

