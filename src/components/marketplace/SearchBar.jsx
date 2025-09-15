import { useState, useRef, useEffect } from "react";
import { Search, X, Clock, TrendingUp } from "lucide-react";

export default function SearchBar({ 
  value, 
  onChange, 
  placeholder = "Search plugins...",
  suggestions = [],
  recentSearches = [],
  onSuggestionClick
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFocus = () => {
    setIsFocused(true);
    setShowSuggestions(true);
  };

  const handleClear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (suggestion) => {
    onChange(suggestion);
    setShowSuggestions(false);
    onSuggestionClick?.(suggestion);
  };

  const filteredSuggestions = suggestions.filter(s => 
    s.toLowerCase().includes(value.toLowerCase()) && s !== value
  );

  const showRecentSearches = !value && recentSearches.length > 0;
  const showFilteredSuggestions = value && filteredSuggestions.length > 0;
  const shouldShowDropdown = showSuggestions && (showRecentSearches || showFilteredSuggestions);

  return (
    <div ref={containerRef} className="relative">
      <div className={`relative transition-colors ${
        isFocused ? 'ring-2 ring-app-accent/40' : ''
      }`}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-app-muted" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 h-10 rounded-lg bg-app-bg border border-app-border outline-none transition-colors text-sm placeholder:text-app-muted"
        />
        {value && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-app-muted hover:text-app-text transition-colors"
            title="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Search Suggestions Dropdown */}
      {shouldShowDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-app-panel border border-app-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {showRecentSearches && (
            <div className="p-2">
              <div className="flex items-center gap-2 px-2 py-1 text-xs text-app-muted font-medium">
                <Clock className="w-3 h-3" />
                Recent searches
              </div>
              {recentSearches.slice(0, 5).map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(search)}
                  className="w-full text-left px-3 py-2 text-sm text-app-text hover:bg-app-bg rounded-md transition-colors"
                >
                  {search}
                </button>
              ))}
            </div>
          )}

          {showFilteredSuggestions && (
            <div className="p-2">
              {showRecentSearches && <div className="border-t border-app-border my-2" />}
              <div className="flex items-center gap-2 px-2 py-1 text-xs text-app-muted font-medium">
                <TrendingUp className="w-3 h-3" />
                Suggestions
              </div>
              {filteredSuggestions.slice(0, 8).map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-3 py-2 text-sm text-app-text hover:bg-app-bg rounded-md transition-colors"
                >
                  <span className="font-medium">{suggestion.slice(0, value.length)}</span>
                  <span>{suggestion.slice(value.length)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}