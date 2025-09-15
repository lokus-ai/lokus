import { useState } from "react";
import { 
  Star, 
  Download, 
  User, 
  Clock, 
  ExternalLink, 
  Shield, 
  CheckCircle, 
  TrendingUp,
  Package,
  AlertTriangle,
  Calendar,
  Globe,
  Heart,
  Eye,
  MessageSquare,
  ThumbsUp,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon
} from "lucide-react";
import InstallButton from "./installation/InstallButton.jsx";
import ProgressTracker from "./installation/ProgressTracker.jsx";
import { PluginPermissions } from "../PluginManager.jsx";

const TABS = [
  { id: "overview", label: "Overview", icon: Package },
  { id: "permissions", label: "Permissions", icon: Shield },
  { id: "reviews", label: "Reviews", icon: MessageSquare },
  { id: "changelog", label: "Changelog", icon: Calendar }
];

export default function PluginDetails({
  plugin,
  isInstalled = false,
  isInstalling = false,
  installationProgress = null,
  onInstall,
  onUninstall,
  onConfigure
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [currentScreenshot, setCurrentScreenshot] = useState(0);

  if (!plugin) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-app-muted/50" />
          <h3 className="text-lg font-medium mb-2">No Plugin Selected</h3>
          <p className="text-app-muted">Select a plugin to view details</p>
        </div>
      </div>
    );
  }

  const formatDownloads = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toLocaleString();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const nextScreenshot = () => {
    if (plugin.screenshots && currentScreenshot < plugin.screenshots.length - 1) {
      setCurrentScreenshot(prev => prev + 1);
    }
  };

  const prevScreenshot = () => {
    if (currentScreenshot > 0) {
      setCurrentScreenshot(prev => prev - 1);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab plugin={plugin} />;
      case "permissions":
        return <PermissionsTab plugin={plugin} />;
      case "reviews":
        return <ReviewsTab plugin={plugin} />;
      case "changelog":
        return <ChangelogTab plugin={plugin} />;
      default:
        return <OverviewTab plugin={plugin} />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="space-y-4 pb-6 border-b border-app-border">
        {/* Plugin Icon and Basic Info */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-app-accent/20 to-app-accent/10 border border-app-accent/20 flex items-center justify-center flex-shrink-0">
            <Package className="w-8 h-8 text-app-accent" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-app-text">{plugin.name}</h1>
              {plugin.verified && (
                <Shield className="w-5 h-5 text-blue-500" title="Verified publisher" />
              )}
            </div>
            
            <div className="flex items-center gap-4 text-sm text-app-muted mb-2">
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {plugin.author}
              </span>
              <span>Version {plugin.version}</span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Updated {formatDate(plugin.lastUpdated)}
              </span>
            </div>
            
            <p className="text-app-muted leading-relaxed">{plugin.description}</p>
          </div>
        </div>

        {/* Badges and Stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {plugin.featured && (
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-app-accent/20 text-app-accent text-sm rounded-lg">
                <Star className="w-4 h-4 fill-current" />
                Featured
              </div>
            )}
            {plugin.trending && (
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-600 text-sm rounded-lg">
                <TrendingUp className="w-4 h-4" />
                Trending
              </div>
            )}
            {plugin.price === "free" && (
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-600 text-sm rounded-lg">
                <Heart className="w-4 h-4" />
                Free
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-1 text-app-muted">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="font-medium">{plugin.rating}</span>
              <span>rating</span>
            </div>
            <div className="flex items-center gap-1 text-app-muted">
              <Download className="w-4 h-4" />
              <span className="font-medium">{formatDownloads(plugin.downloads)}</span>
              <span>downloads</span>
            </div>
            <div className="flex items-center gap-1 text-app-muted">
              <Eye className="w-4 h-4" />
              <span className="font-medium">{Math.floor(plugin.downloads * 0.3)}</span>
              <span>views</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {installationProgress ? (
            <ProgressTracker 
              pluginId={plugin.id}
              progress={installationProgress}
            />
          ) : isInstalled ? (
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 text-green-600 rounded-lg">
                <CheckCircle className="w-4 h-4" />
                Installed
              </div>
              <button
                onClick={() => onConfigure?.(plugin)}
                className="px-4 py-2 text-sm border border-app-border rounded-lg hover:bg-app-bg transition-colors"
              >
                Configure
              </button>
              <button
                onClick={() => onUninstall?.(plugin.id)}
                className="px-4 py-2 text-sm text-red-600 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                Uninstall
              </button>
            </div>
          ) : (
            <InstallButton
              plugin={plugin}
              isInstalling={isInstalling}
              onInstall={() => onInstall?.(plugin)}
            />
          )}
          
          {plugin.homepage && (
            <button
              onClick={() => window.open(plugin.homepage, '_blank')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-app-border rounded-lg hover:bg-app-bg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Homepage
            </button>
          )}
        </div>

        {/* Security Warning */}
        {plugin.permissions?.some(p => p.includes('shell') || p.includes('network')) && !isInstalled && (
          <div className="flex items-center gap-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-orange-600">Security Notice</p>
              <p className="text-xs text-orange-600/80">This plugin requires elevated permissions and can access system resources.</p>
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 py-4 border-b border-app-border">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                isActive
                  ? 'bg-app-accent text-app-accent-fg'
                  : 'text-app-muted hover:text-app-text hover:bg-app-bg'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 py-6 overflow-y-auto">
        {renderTabContent()}
      </div>
    </div>
  );
}

function OverviewTab({ plugin }) {
  const [currentScreenshot, setCurrentScreenshot] = useState(0);

  return (
    <div className="space-y-6">
      {/* Screenshots */}
      {plugin.screenshots && plugin.screenshots.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Screenshots</h3>
          <div className="relative">
            <div className="aspect-video bg-app-panel rounded-lg border border-app-border overflow-hidden">
              <img
                src={plugin.screenshots[currentScreenshot]}
                alt={`${plugin.name} screenshot ${currentScreenshot + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="hidden w-full h-full items-center justify-center bg-app-panel">
                <div className="text-center">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 text-app-muted" />
                  <p className="text-app-muted">Screenshot not available</p>
                </div>
              </div>
            </div>
            
            {plugin.screenshots.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentScreenshot(prev => prev > 0 ? prev - 1 : plugin.screenshots.length - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentScreenshot(prev => prev < plugin.screenshots.length - 1 ? prev + 1 : 0)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {plugin.screenshots.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentScreenshot(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === currentScreenshot ? 'bg-white' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Long Description */}
      <div>
        <h3 className="text-lg font-semibold mb-3">About</h3>
        <p className="text-app-muted leading-relaxed whitespace-pre-line">
          {plugin.longDescription || plugin.description}
        </p>
      </div>

      {/* Tags */}
      {plugin.tags && plugin.tags.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {plugin.tags.map(tag => (
              <span 
                key={tag} 
                className="px-3 py-1.5 bg-app-bg text-sm text-app-muted rounded-lg border border-app-border hover:border-app-border-hover transition-colors cursor-pointer"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dependencies */}
      {plugin.dependencies && plugin.dependencies.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Dependencies</h3>
          <div className="space-y-2">
            {plugin.dependencies.map(dep => (
              <div key={dep} className="flex items-center gap-3 p-3 bg-app-bg rounded-lg border border-app-border">
                <Package className="w-4 h-4 text-app-muted" />
                <span className="text-sm text-app-text">{dep}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PermissionsTab({ plugin }) {
  return (
    <div className="space-y-4">
      <p className="text-app-muted">
        This plugin requires the following permissions to function properly:
      </p>
      
      {plugin.permissions && plugin.permissions.length > 0 ? (
        <PluginPermissions permissions={plugin.permissions} />
      ) : (
        <div className="text-center py-8">
          <Shield className="w-12 h-12 mx-auto mb-4 text-green-500" />
          <h3 className="text-lg font-medium mb-2">No Special Permissions</h3>
          <p className="text-app-muted">This plugin doesn't require any special permissions.</p>
        </div>
      )}
    </div>
  );
}

function ReviewsTab({ plugin }) {
  // Mock reviews data
  const mockReviews = [
    {
      id: 1,
      author: "Sarah Chen",
      rating: 5,
      date: "2024-01-20",
      comment: "Absolutely fantastic! This plugin has completely transformed my workflow. The features are intuitive and well-designed."
    },
    {
      id: 2,
      author: "Michael Rodriguez", 
      rating: 4,
      date: "2024-01-18",
      comment: "Great plugin overall. Works as advertised and the support is responsive. Would recommend!"
    },
    {
      id: 3,
      author: "Emma Thompson",
      rating: 5,
      date: "2024-01-15",
      comment: "Exactly what I was looking for. Installation was smooth and it integrates perfectly with my existing setup."
    }
  ];

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <div className="flex items-center gap-6 p-4 bg-app-bg rounded-lg border border-app-border">
        <div className="text-center">
          <div className="text-3xl font-bold text-app-text">{plugin.rating}</div>
          <div className="flex items-center gap-1 mt-1">
            {[...Array(5)].map((_, i) => (
              <Star 
                key={i} 
                className={`w-4 h-4 ${i < Math.floor(plugin.rating) ? 'text-yellow-500 fill-current' : 'text-app-border'}`} 
              />
            ))}
          </div>
          <div className="text-xs text-app-muted mt-1">Based on 127 reviews</div>
        </div>
        
        <div className="flex-1">
          {[5, 4, 3, 2, 1].map(stars => (
            <div key={stars} className="flex items-center gap-2 mb-1">
              <span className="text-xs text-app-muted w-6">{stars}★</span>
              <div className="flex-1 h-2 bg-app-border rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 rounded-full"
                  style={{ width: `${stars === 5 ? 70 : stars === 4 ? 20 : 10}%` }}
                />
              </div>
              <span className="text-xs text-app-muted w-8">{stars === 5 ? 89 : stars === 4 ? 25 : 13}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {mockReviews.map(review => (
          <div key={review.id} className="p-4 border border-app-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-app-accent/20 flex items-center justify-center">
                  <span className="text-sm font-medium text-app-accent">{review.author[0]}</span>
                </div>
                <span className="font-medium text-app-text">{review.author}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`w-3 h-3 ${i < review.rating ? 'text-yellow-500 fill-current' : 'text-app-border'}`} 
                    />
                  ))}
                </div>
                <span className="text-xs text-app-muted">{new Date(review.date).toLocaleDateString()}</span>
              </div>
            </div>
            <p className="text-sm text-app-muted leading-relaxed">{review.comment}</p>
            <div className="flex items-center gap-4 mt-3 text-xs text-app-muted">
              <button className="flex items-center gap-1 hover:text-app-text transition-colors">
                <ThumbsUp className="w-3 h-3" />
                Helpful (12)
              </button>
              <button className="hover:text-app-text transition-colors">Reply</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChangelogTab({ plugin }) {
  // Mock changelog data
  const mockChangelog = [
    {
      version: plugin.version,
      date: plugin.lastUpdated,
      changes: [
        "Fixed memory leak in background processing",
        "Improved performance for large datasets",
        "Added support for dark mode themes",
        "Updated dependencies to latest versions"
      ]
    },
    {
      version: "1.4.1",
      date: "2024-01-10",
      changes: [
        "Fixed compatibility issue with latest Lokus version",
        "Resolved bug where settings weren't persisting",
        "Minor UI improvements"
      ]
    },
    {
      version: "1.4.0",
      date: "2024-01-05",
      changes: [
        "Added new export formats",
        "Introduced batch processing capabilities",
        "Enhanced error handling and reporting",
        "New configuration options for advanced users"
      ]
    }
  ];

  return (
    <div className="space-y-6">
      {mockChangelog.map((release, index) => (
        <div key={release.version} className="relative">
          {index < mockChangelog.length - 1 && (
            <div className="absolute left-4 top-8 bottom-0 w-px bg-app-border" />
          )}
          
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-app-accent/20 border-2 border-app-accent flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 text-app-accent" />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-app-text">Version {release.version}</h3>
                {index === 0 && (
                  <span className="px-2 py-1 bg-app-accent/20 text-app-accent text-xs rounded">Latest</span>
                )}
              </div>
              
              <p className="text-sm text-app-muted mb-3">Released on {formatDate(release.date)}</p>
              
              <ul className="space-y-1">
                {release.changes.map((change, changeIndex) => (
                  <li key={changeIndex} className="flex items-start gap-2 text-sm text-app-muted">
                    <span className="w-1 h-1 rounded-full bg-app-muted mt-2 flex-shrink-0" />
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}