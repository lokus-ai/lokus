import { ChevronDown, TrendingUp, Star, Download, Clock, ArrowUpAZ, Calendar } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const SORT_OPTIONS = {
  discover: [
    { value: "featured", label: "Featured", icon: Star, description: "Editor's picks and trending plugins" },
    { value: "trending", label: "Trending", icon: TrendingUp, description: "Most popular this week" },
    { value: "popular", label: "Most Popular", icon: Download, description: "Highest download count" },
    { value: "rating", label: "Highest Rated", icon: Star, description: "Best user ratings" },
    { value: "newest", label: "Newest", icon: Clock, description: "Recently published" },
    { value: "updated", label: "Recently Updated", icon: Calendar, description: "Latest updates" },
    { value: "name", label: "Name A-Z", icon: ArrowUpAZ, description: "Alphabetical order" }
  ],
  installed: [
    { value: "name", label: "Name A-Z", icon: ArrowUpAZ, description: "Alphabetical order" },
    { value: "status", label: "Status", icon: TrendingUp, description: "Enabled plugins first" },
    { value: "updated", label: "Recently Updated", icon: Calendar, description: "Latest updates" },
    { value: "installed", label: "Install Date", icon: Clock, description: "Recently installed" }
  ],
  updates: [
    { value: "priority", label: "Priority", icon: TrendingUp, description: "Critical updates first" },
    { value: "name", label: "Name A-Z", icon: ArrowUpAZ, description: "Alphabetical order" },
    { value: "version", label: "Version", icon: Calendar, description: "Version differences" }
  ]
};

export default function SortControls({ 
  value, 
  onChange, 
  view = "discover",
  compact = false 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  const options = SORT_OPTIONS[view] || SORT_OPTIONS.discover;
  const selectedOption = options.find(option => option.value === value) || options[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  if (compact) {
    return (
      <div className="space-y-1">
        <h3 className="text-xs font-medium text-app-muted mb-2">Sort By</h3>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1.5 text-sm bg-app-bg border border-app-border rounded-md outline-none focus:ring-2 focus:ring-app-accent/40"
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-app-text">Sort By</h3>
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-app-bg border border-app-border rounded-lg text-sm hover:bg-app-panel/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <selectedOption.icon className="w-4 h-4 text-app-muted" />
            <span className="text-app-text">{selectedOption.label}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-app-muted transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-app-panel border border-app-border rounded-lg shadow-lg z-50 py-1">
            {options.map(option => {
              const Icon = option.icon;
              const isSelected = option.value === value;
              
              return (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-app-bg transition-colors ${
                    isSelected ? 'bg-app-bg' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${
                      isSelected ? 'text-app-accent' : 'text-app-muted'
                    }`} />
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${
                        isSelected ? 'text-app-accent' : 'text-app-text'
                      }`}>
                        {option.label}
                      </div>
                      <div className="text-xs text-app-muted mt-0.5">
                        {option.description}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}