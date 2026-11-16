import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

// ============================================================================
// TIPOS
// ============================================================================

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

// ============================================================================
// COMPONENTE
// ============================================================================

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Buscar por número RDO, disciplina...',
  debounceMs = 300,
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce da busca
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
      setIsSearching(false);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, value, onChange, debounceMs]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    setIsSearching(true);
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
    setIsSearching(false);
  };

  return (
    <div className="relative">
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
        <Search className="w-5 h-5" />
      </div>

      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="
          w-full pl-12 pr-12 py-3 rounded-lg border border-gray-300
          focus:border-blue-500 focus:ring-2 focus:ring-blue-200
          transition-colors duration-200 text-sm
          placeholder-gray-500
        "
      />

      {/* Clear Button */}
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
          aria-label="Limpar busca"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Searching Indicator */}
      {isSearching && (
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
