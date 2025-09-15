import { useState } from "react";
import { Star, TrendingUp, ChevronLeft, ChevronRight, Download, User } from "lucide-react";
import InstallButton from "./installation/InstallButton.jsx";

export default function FeaturedSection({ 
  plugins = [], 
  onPluginSelect,
  maxVisible = 3 
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!plugins || plugins.length === 0) {
    return null;
  }

  const canScrollLeft = currentIndex > 0;
  const canScrollRight = currentIndex < plugins.length - maxVisible;

  const scrollLeft = () => {
    if (canScrollLeft) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const scrollRight = () => {
    if (canScrollRight) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const visiblePlugins = plugins.slice(currentIndex, currentIndex + maxVisible);

  const formatDownloads = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toLocaleString();
  };

  return (
    <div className="p-6 bg-gradient-to-r from-app-panel/80 to-app-panel/40">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-app-text mb-1">Featured Plugins</h2>
          <p className="text-sm text-app-muted">Editor's picks and trending plugins this week</p>
        </div>
        
        {plugins.length > maxVisible && (
          <div className="flex items-center gap-2">
            <button
              onClick={scrollLeft}
              disabled={!canScrollLeft}
              className={`p-2 rounded-lg border transition-colors ${
                canScrollLeft 
                  ? 'border-app-border bg-app-bg text-app-text hover:bg-app-panel' 
                  : 'border-app-border/50 bg-app-bg/50 text-app-muted cursor-not-allowed'
              }`}
              title="Previous plugins"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={scrollRight}
              disabled={!canScrollRight}
              className={`p-2 rounded-lg border transition-colors ${
                canScrollRight 
                  ? 'border-app-border bg-app-bg text-app-text hover:bg-app-panel' 
                  : 'border-app-border/50 bg-app-bg/50 text-app-muted cursor-not-allowed'
              }`}
              title="Next plugins"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visiblePlugins.map((plugin, index) => (
          <FeaturedPluginCard
            key={plugin.id}
            plugin={plugin}
            onSelect={() => onPluginSelect?.(plugin)}
            priority={index === 0 ? "hero" : "featured"}
          />
        ))}
      </div>

      {plugins.length > maxVisible && (
        <div className="flex justify-center mt-6">
          <div className="flex items-center gap-2">
            {Array.from({ length: Math.ceil(plugins.length / maxVisible) }, (_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i * maxVisible)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  Math.floor(currentIndex / maxVisible) === i
                    ? 'bg-app-accent'
                    : 'bg-app-border hover:bg-app-muted'
                }`}
                title={`Go to page ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FeaturedPluginCard({ plugin, onSelect, priority = "featured" }) {
  const isHero = priority === "hero";
  
  return (
    <div 
      className={`relative overflow-hidden border border-app-border rounded-xl bg-app-bg cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-app-accent/50 group ${
        isHero ? 'lg:col-span-2 lg:row-span-2' : ''
      }`}
      onClick={onSelect}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-app-accent/5 via-transparent to-app-accent/10" />
      
      {/* Content */}
      <div className={`relative p-6 ${isHero ? 'lg:p-8' : ''}`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg bg-gradient-to-br from-app-accent/20 to-app-accent/10 border border-app-accent/20 flex items-center justify-center ${
              isHero ? 'w-12 h-12' : 'w-10 h-10'
            }`}>
              <Star className={`text-app-accent ${isHero ? 'w-6 h-6' : 'w-5 h-5'}`} />
            </div>
            <div>
              <h3 className={`font-bold text-app-text group-hover:text-app-accent transition-colors ${
                isHero ? 'text-xl' : 'text-lg'
              }`}>
                {plugin.name}
              </h3>
              <p className="text-sm text-app-muted">by {plugin.author}</p>
            </div>
          </div>
          
          {/* Badges */}
          <div className="flex flex-col gap-1 items-end">
            <div className="inline-flex items-center gap-1 px-2 py-1 bg-app-accent/20 text-app-accent text-xs rounded-md">
              <Star className="w-3 h-3 fill-current" />
              Featured
            </div>
            {plugin.trending && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-600 text-xs rounded-md">
                <TrendingUp className="w-3 h-3" />
                Trending
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <p className={`text-app-muted mb-4 ${
          isHero ? 'text-base line-clamp-3' : 'text-sm line-clamp-2'
        }`}>
          {plugin.longDescription || plugin.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {plugin.tags?.slice(0, isHero ? 4 : 3).map(tag => (
            <span 
              key={tag} 
              className="px-2 py-1 bg-app-panel text-xs text-app-muted rounded border border-app-border"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-app-muted mb-6">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500" />
            <span className="font-medium">{plugin.rating}</span>
          </div>
          <div className="flex items-center gap-1">
            <Download className="w-4 h-4" />
            <span>{formatDownloads(plugin.downloads)} downloads</span>
          </div>
          <div className="flex items-center gap-1">
            <User className="w-4 h-4" />
            <span>{plugin.author}</span>
          </div>
        </div>

        {/* Action */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-app-muted">
            Version {plugin.version}
          </div>
          <InstallButton
            plugin={plugin}
            size={isHero ? "normal" : "small"}
          />
        </div>

        {/* Hover effect overlay */}
        <div className="absolute inset-0 bg-app-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>
    </div>
  );
}

function formatDownloads(count) {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toLocaleString();
}