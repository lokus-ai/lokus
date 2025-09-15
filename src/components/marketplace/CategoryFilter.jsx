import { 
  Package, 
  Zap, 
  Heart, 
  TrendingUp, 
  Globe, 
  Wrench,
  Palette,
  Code,
  FileText,
  Database,
  Camera,
  Music,
  Shield,
  Puzzle
} from "lucide-react";

const CATEGORIES = [
  { 
    id: "all", 
    name: "All Categories", 
    icon: Package, 
    description: "Browse all available plugins",
    count: null 
  },
  { 
    id: "editor", 
    name: "Editor Extensions", 
    icon: Zap, 
    description: "Enhance your editing experience",
    count: null 
  },
  { 
    id: "themes", 
    name: "Themes", 
    icon: Palette, 
    description: "Customize the look and feel",
    count: null 
  },
  { 
    id: "productivity", 
    name: "Productivity", 
    icon: TrendingUp, 
    description: "Boost your productivity",
    count: null 
  },
  { 
    id: "integrations", 
    name: "Integrations", 
    icon: Globe, 
    description: "Connect with external services",
    count: null 
  },
  { 
    id: "utilities", 
    name: "Utilities", 
    icon: Wrench, 
    description: "Helpful tools and utilities",
    count: null 
  },
  { 
    id: "development", 
    name: "Development", 
    icon: Code, 
    description: "Tools for developers",
    count: null 
  },
  { 
    id: "writing", 
    name: "Writing", 
    icon: FileText, 
    description: "Writing assistance and tools",
    count: null 
  },
  { 
    id: "data", 
    name: "Data & Analytics", 
    icon: Database, 
    description: "Data visualization and analysis",
    count: null 
  },
  { 
    id: "media", 
    name: "Media", 
    icon: Camera, 
    description: "Image, video, and audio tools",
    count: null 
  },
  { 
    id: "entertainment", 
    name: "Entertainment", 
    icon: Music, 
    description: "Games and entertainment",
    count: null 
  },
  { 
    id: "security", 
    name: "Security", 
    icon: Shield, 
    description: "Security and privacy tools",
    count: null 
  }
];

export default function CategoryFilter({ 
  selected, 
  onChange, 
  pluginCounts = {},
  showCounts = true,
  compact = false 
}) {
  // Update categories with counts
  const categoriesWithCounts = CATEGORIES.map(category => ({
    ...category,
    count: showCounts ? (pluginCounts[category.id] || 0) : null
  }));

  if (compact) {
    return (
      <div className="space-y-1">
        <h3 className="text-xs font-medium text-app-muted mb-2">Categories</h3>
        <select
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1.5 text-sm bg-app-bg border border-app-border rounded-md outline-none focus:ring-2 focus:ring-app-accent/40"
        >
          {categoriesWithCounts.map(category => (
            <option key={category.id} value={category.id}>
              {category.name} {category.count !== null ? `(${category.count})` : ''}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-app-text">Categories</h3>
      <div className="space-y-1">
        {categoriesWithCounts.map(category => {
          const Icon = category.icon;
          const isSelected = selected === category.id;
          
          return (
            <button
              key={category.id}
              onClick={() => onChange(category.id)}
              className={`w-full text-left group transition-colors rounded-lg ${
                isSelected
                  ? 'bg-app-accent text-app-accent-fg'
                  : 'text-app-muted hover:text-app-text hover:bg-app-bg'
              }`}
              title={category.description}
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Icon className={`w-4 h-4 flex-shrink-0 ${
                  isSelected ? 'text-app-accent-fg' : 'text-app-muted group-hover:text-app-text'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">
                      {category.name}
                    </span>
                    {category.count !== null && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        isSelected 
                          ? 'bg-app-accent-fg/20 text-app-accent-fg' 
                          : 'bg-app-bg text-app-muted'
                      }`}>
                        {category.count}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs truncate mt-0.5 ${
                    isSelected 
                      ? 'text-app-accent-fg/70' 
                      : 'text-app-muted/70'
                  }`}>
                    {category.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { CATEGORIES };