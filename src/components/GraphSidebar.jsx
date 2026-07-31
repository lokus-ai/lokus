import React, { useEffect, useMemo, useReducer } from 'react';
import {
  Network, Link, FileText, Tag, Paperclip, Ghost, ChevronDown, ChevronRight,
  Search, Palette, Filter, Zap, Image, RotateCcw, Crosshair,
} from 'lucide-react';
import { useGraphConfig } from '../core/graph2/graphConfig.js';
import { getGraphEngine } from '../core/graph2/graphEngine.js';
import { countMatches } from '../core/graph2/colorGroups.js';

/**
 * GraphSidebar — the graph control panel.
 *
 * Reads and writes `useGraphConfig` directly: every control is a live patch
 * into the engine (settings apply instantly, disk write is debounced). Stats
 * and color-group match counts are read straight off the engine and stay live
 * as the index and the layout change.
 *
 * Used by the right sidebar (when the graph tab is focused) and by GraphView's
 * settings rail — both drive the same singleton engine.
 */

/**
 * Re-render on engine changes, throttled.
 *
 * The engine notifies on every simulation tick (~60/s); nothing in this panel
 * needs that rate. Throttling keeps stats and match counts live without making
 * the controls thrash while the layout settles.
 */
function useEngineTick(intervalMs = 350) {
  const [tick, bump] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    let last = 0;
    let timer = null;
    const onChange = () => {
      const wait = intervalMs - (Date.now() - last);
      if (wait <= 0) {
        last = Date.now();
        bump();
      } else if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          last = Date.now();
          bump();
        }, wait);
      }
    };
    const unsub = getGraphEngine().subscribe(onChange);
    return () => { unsub(); clearTimeout(timer); };
  }, [intervalMs]);
  return tick;
}

function baseName(path) {
  if (!path) return '';
  const file = path.split('/').pop() || path;
  return file.replace(/\.md$/i, '');
}

export default function GraphSidebar({ className = '', hideHeader = false }) {
  const config = useGraphConfig((s) => s.config);
  const update = useGraphConfig((s) => s.update);
  const reset = useGraphConfig((s) => s.reset);
  const tick = useEngineTick();

  const engine = getGraphEngine();
  const stats = useMemo(() => engine.stats(), [engine, tick]);
  // The engine mutates its node array in place, so `tick` is what invalidates.
  const nodes = useMemo(() => engine.nodes(), [engine, tick]);
  const focusPath = useMemo(() => engine.getFocus(), [engine, tick]);

  const groups = config.colorGroups || [];
  const matchCounts = useMemo(
    () => groups.map((g) => countMatches(g.query, nodes)),
    [groups, nodes, tick] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const toggleCollapse = (section) =>
    update({ [`collapse-${section}`]: !config[`collapse-${section}`] });

  const patchGroups = (next) => update({ colorGroups: next });
  const editGroup = (index, patch) => {
    const next = [...groups];
    next[index] = { ...next[index], ...patch };
    patchGroups(next);
  };
  const moveGroup = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= groups.length) return;
    const next = [...groups];
    [next[index], next[target]] = [next[target], next[index]];
    patchGroups(next);
  };

  return (
    <div className={`h-full flex flex-col overflow-hidden bg-app-panel ${className}`}>
      {!hideHeader && (
        <div className="px-4 py-3 border-b border-app-border">
          <h3 className="text-sm font-semibold text-app-text flex items-center gap-2">
            <Network className="w-4 h-4" strokeWidth={1.5} />
            Graph Settings
          </h3>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* FILTERS */}
        <Section
          icon={<Filter className="w-4 h-4" />}
          title="Filters"
          collapsed={config['collapse-filter']}
          onToggle={() => toggleCollapse('filter')}
        >
          <div>
            <label className="text-xs text-app-muted mb-1.5 block">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-app-muted" />
              <input
                type="text"
                value={config.search || ''}
                onChange={(e) => update({ search: e.target.value })}
                placeholder="Highlight nodes…"
                className="w-full pl-8 pr-3 py-2 bg-app-bg border border-app-border rounded text-xs text-app-text placeholder-app-muted focus:outline-none focus:border-app-accent"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Toggle
              label="Show Tags"
              checked={config.showTags ?? true}
              onChange={(v) => update({ showTags: v })}
            />
            <Toggle
              label="Show Attachments"
              checked={config.showAttachments ?? false}
              onChange={(v) => update({ showAttachments: v })}
            />
            <Toggle
              label="Hide Unresolved (placeholders)"
              checked={config.hideUnresolved ?? false}
              onChange={(v) => update({ hideUnresolved: v })}
            />
            <Toggle
              label="Show Orphans (no connections)"
              checked={config.showOrphans ?? true}
              onChange={(v) => update({ showOrphans: v })}
            />
          </div>

          {/* Local graph — a neighborhood filter around the active file */}
          <div className="pt-3 border-t border-app-border space-y-3">
            <Toggle
              label="Local graph"
              checked={config.localMode ?? false}
              onChange={(v) => update({ localMode: v })}
            />
            <div className="text-xs text-app-muted -mt-1.5">
              Show only notes within a few hops of the active file.
            </div>

            {config.localMode && (
              <>
                <Slider
                  label="Depth"
                  value={config.localDepth ?? 1}
                  min={1}
                  max={5}
                  step={1}
                  onChange={(v) => update({ localDepth: v })}
                  format={(v) => `${v} hop${v === 1 ? '' : 's'}`}
                />
                <div className="text-xs p-2 bg-app-bg rounded border border-app-border flex items-start gap-2">
                  <Crosshair className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-app-accent" />
                  {focusPath ? (
                    <span className="text-app-muted">
                      Centered on <span className="text-app-text font-medium">{baseName(focusPath)}</span>
                    </span>
                  ) : (
                    <span className="text-app-muted">
                      No active file — open a note to see its neighborhood.
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </Section>

        {/* DISPLAY */}
        <Section
          icon={<Palette className="w-4 h-4" />}
          title="Display"
          collapsed={config['collapse-display']}
          onToggle={() => toggleCollapse('display')}
        >
          <div className="space-y-2">
            <Toggle
              label="Show Arrows"
              checked={config.showArrow ?? true}
              onChange={(v) => update({ showArrow: v })}
            />
            <Toggle
              label="Highlight neighbors on hover"
              checked={config.highlightNeighbors ?? true}
              onChange={(v) => update({ highlightNeighbors: v })}
            />
            <Toggle
              label="Follow active file"
              checked={config.followFocus ?? true}
              onChange={(v) => update({ followFocus: v })}
            />
            <div className="text-xs text-app-muted">
              The camera glides to whichever note you have open.
            </div>
          </div>

          <Slider
            label="Text Fade"
            value={config.textFadeMultiplier ?? 1.3}
            min={0}
            max={3}
            step={0.1}
            onChange={(v) => update({ textFadeMultiplier: v })}
            format={(v) => v.toFixed(1)}
          />
          <Slider
            label="Node Size"
            value={config.nodeSizeMultiplier ?? 1.0}
            min={0.5}
            max={2}
            step={0.05}
            onChange={(v) => update({ nodeSizeMultiplier: v })}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            label="Line Size"
            value={config.lineSizeMultiplier ?? 1.0}
            min={0.5}
            max={3}
            step={0.1}
            onChange={(v) => update({ lineSizeMultiplier: v })}
            format={(v) => v.toFixed(2)}
          />
        </Section>

        {/* FORCES */}
        <Section
          icon={<Zap className="w-4 h-4" />}
          title="Forces"
          collapsed={config['collapse-forces']}
          onToggle={() => toggleCollapse('forces')}
        >
          <Slider
            label="Center Force"
            value={config.centerStrength ?? 0.1}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => update({ centerStrength: v })}
            format={(v) => v.toFixed(2)}
            hint="Pull nodes toward center"
          />
          <Slider
            label="Repel Force"
            value={config.repelStrength ?? 100}
            min={10}
            max={500}
            step={10}
            onChange={(v) => update({ repelStrength: v })}
            format={(v) => String(Math.round(v))}
            hint="Push nodes apart (higher = more spread)"
          />
          <Slider
            label="Link Stiffness"
            value={config.linkStrength ?? 0.3}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => update({ linkStrength: v })}
            format={(v) => v.toFixed(2)}
            hint="How rigidly links hold nodes together"
          />
          <Slider
            label="Link Distance"
            value={config.linkDistance ?? 80}
            min={20}
            max={300}
            step={5}
            onChange={(v) => update({ linkDistance: v })}
            format={(v) => `${Math.round(v)}px`}
            hint="Target distance between connected nodes"
          />
        </Section>

        {/* COLOR GROUPS */}
        <Section
          icon={<Palette className="w-4 h-4" />}
          title="Color Groups"
          collapsed={config['collapse-groups']}
          onToggle={() => toggleCollapse('groups')}
        >
          <div>
            <label className="text-xs text-app-muted mb-1.5 block">Color Scheme</label>
            <select
              value={config.colorScheme || 'type'}
              onChange={(e) => update({ colorScheme: e.target.value })}
              className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-xs text-app-text focus:outline-none focus:border-app-accent"
            >
              <option value="type">By Type (note/placeholder/tag)</option>
              <option value="folder">By Folder</option>
              <option value="tag">By Primary Tag</option>
              <option value="creation-date">By Creation Date</option>
              <option value="modification-date">By Modification Date</option>
            </select>
            <div className="text-xs text-app-muted mt-1.5">
              {config.colorScheme === 'folder' && 'Colors nodes by the folder they live in'}
              {config.colorScheme === 'tag' && 'Colors nodes by their primary tag'}
              {config.colorScheme === 'creation-date' && 'Colors nodes by creation date (recent to old)'}
              {config.colorScheme === 'modification-date' && 'Colors nodes by modification date'}
              {(!config.colorScheme || config.colorScheme === 'type') &&
                'Colors nodes by their type (note, placeholder, tag, attachment)'}
            </div>
          </div>

          <div className="text-xs text-app-muted mb-1">Color Overrides</div>

          {groups.length > 0 && (
            <div className="space-y-2">
              {groups.map((group, index) => {
                const matchCount = matchCounts[index] ?? 0;
                return (
                  <div key={index} className="flex items-center gap-2 p-2 bg-app-bg rounded border border-app-border">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveGroup(index, -1)}
                        disabled={index === 0}
                        className="text-[10px] text-app-muted hover:text-app-text disabled:opacity-30 leading-none"
                        title="Move up (higher priority)"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveGroup(index, 1)}
                        disabled={index === groups.length - 1}
                        className="text-[10px] text-app-muted hover:text-app-text disabled:opacity-30 leading-none"
                        title="Move down (lower priority)"
                      >
                        ▼
                      </button>
                    </div>
                    <input
                      type="color"
                      value={group.color}
                      onChange={(e) => editGroup(index, { color: e.target.value })}
                      className="w-7 h-7 rounded border border-app-border cursor-pointer shrink-0"
                      title="Group color"
                    />
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={group.query}
                        onChange={(e) => editGroup(index, { query: e.target.value })}
                        placeholder="folder:path/ or tag:name or text"
                        className="w-full px-2 py-1 bg-app-panel border border-app-border rounded text-xs text-app-text focus:outline-none focus:border-app-accent"
                      />
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                        matchCount > 0 ? 'bg-app-accent/20 text-app-accent' : 'bg-app-bg text-app-muted'
                      }`}
                      title={`${matchCount} node${matchCount !== 1 ? 's' : ''} matched`}
                    >
                      {matchCount}
                    </span>
                    <button
                      onClick={() => patchGroups(groups.filter((_, i) => i !== index))}
                      className="text-xs text-app-muted hover:text-red-400 shrink-0 transition-colors"
                      title="Remove group"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() =>
              patchGroups([
                ...groups,
                { query: '', color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0') },
              ])
            }
            className="w-full px-3 py-2 bg-app-accent/10 hover:bg-app-accent/20 text-app-accent rounded text-xs font-medium transition-colors"
          >
            + Add Color Group
          </button>

          <div className="text-[11px] text-app-muted space-y-1 p-2 bg-app-bg rounded border border-app-border">
            <div><span className="text-app-text font-mono">folder:path/</span> — match by folder</div>
            <div><span className="text-app-text font-mono">tag:name</span> — match by tag</div>
            <div><span className="text-app-text font-mono">type:phantom</span> — match by node type</div>
            <div><span className="text-app-text font-mono">-query</span> — negate any of the above</div>
            <div><span className="text-app-text font-mono">text</span> — match by title or path</div>
            <div className="text-app-muted mt-1">First match wins. Use arrows to reorder priority.</div>
          </div>
        </Section>

        {/* BACKGROUND */}
        <Section
          icon={<Image className="w-4 h-4" />}
          title="Background"
          collapsed={config['collapse-background']}
          onToggle={() => toggleCollapse('background')}
        >
          <div>
            <label className="text-xs text-app-muted mb-1.5 block">Background Type</label>
            <select
              value={config.backgroundType || 'none'}
              onChange={(e) => update({ backgroundType: e.target.value })}
              className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-xs text-app-text focus:outline-none focus:border-app-accent"
            >
              <option value="none">None (transparent)</option>
              <option value="solid">Solid Color</option>
              <option value="gradient">Linear Gradient</option>
              <option value="radial">Radial Gradient</option>
              <option value="dots">Dot Pattern</option>
              <option value="grid">Grid Pattern</option>
            </select>
          </div>

          {config.backgroundType && config.backgroundType !== 'none' && (
            <>
              <ColorField
                label={config.backgroundType === 'solid' ? 'Background Color' : 'Primary Color'}
                value={config.backgroundColor || '#1e1b4b'}
                onChange={(v) => update({ backgroundColor: v })}
              />

              {config.backgroundType !== 'solid' && (
                <ColorField
                  label="Secondary Color"
                  value={config.backgroundSecondary || '#6366f1'}
                  onChange={(v) => update({ backgroundSecondary: v })}
                />
              )}

              <Slider
                label="Opacity"
                value={config.backgroundOpacity ?? 0.1}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => update({ backgroundOpacity: v })}
                format={(v) => v.toFixed(2)}
              />

              {(config.backgroundType === 'dots' || config.backgroundType === 'grid') && (
                <>
                  <Slider
                    label={config.backgroundType === 'dots' ? 'Dot Size' : 'Line Width'}
                    value={config.backgroundDotSize ?? 2}
                    min={1}
                    max={10}
                    step={0.5}
                    onChange={(v) => update({ backgroundDotSize: v })}
                    format={(v) => `${v}px`}
                  />
                  <Slider
                    label="Spacing"
                    value={config.backgroundDotSpacing ?? 30}
                    min={10}
                    max={100}
                    step={5}
                    onChange={(v) => update({ backgroundDotSpacing: v })}
                    format={(v) => `${Math.round(v)}px`}
                  />
                </>
              )}

              <div className="text-xs text-app-muted p-2 bg-app-bg rounded border border-app-border">
                {config.backgroundType === 'solid' && 'Solid background fill'}
                {config.backgroundType === 'gradient' && 'Linear gradient from top to bottom'}
                {config.backgroundType === 'radial' && 'Radial gradient from center outward'}
                {config.backgroundType === 'dots' && 'Dot pattern overlay'}
                {config.backgroundType === 'grid' && 'Grid pattern overlay'}
              </div>
            </>
          )}
        </Section>

        {/* STATISTICS */}
        <div className="px-4 py-4">
          <div className="text-xs font-semibold text-app-muted uppercase tracking-wide mb-3">
            Statistics
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard icon={<Network className="w-4 h-4" />} label="Nodes" value={stats.nodes ?? 0} />
            <StatCard icon={<Link className="w-4 h-4" />} label="Links" value={stats.links ?? 0} />
            <StatCard icon={<FileText className="w-4 h-4" />} label="Notes" value={stats.files ?? 0} />
            <StatCard icon={<Ghost className="w-4 h-4" />} label="Placeholders" value={stats.phantoms ?? 0} />
            {stats.tags !== undefined && (
              <StatCard icon={<Tag className="w-4 h-4" />} label="Tags" value={stats.tags} />
            )}
            {stats.attachments !== undefined && (
              <StatCard icon={<Paperclip className="w-4 h-4" />} label="Attachments" value={stats.attachments} />
            )}
          </div>
          <div className="text-[11px] text-app-muted mt-2">Counts reflect the current filters.</div>
        </div>

        {/* RESET */}
        <div className="px-4 pb-4">
          <button
            onClick={reset}
            className="w-full px-3 py-2 flex items-center justify-center gap-2 bg-app-bg hover:bg-app-panel-secondary border border-app-border hover:border-app-accent rounded text-xs font-medium text-app-muted hover:text-app-text transition-colors"
            title="Restore every graph setting to its default"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- building blocks --------------------------------------------------------

function Section({ icon, title, collapsed, onToggle, children }) {
  return (
    <div className="border-b border-app-border">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-app-bg/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-app-text">
          {icon}
          <span>{title}</span>
        </div>
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {!collapsed && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-xs text-app-text cursor-pointer hover:text-app-accent transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-app-border accent-app-accent"
      />
      <span>{label}</span>
    </label>
  );
}

function Slider({ label, value, min, max, step, onChange, format, hint }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-app-muted">{label}</span>
        <span className="text-app-text font-medium">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-app-accent"
      />
      {hint && <div className="text-xs text-app-muted mt-1">{hint}</div>}
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <div>
      <label className="text-xs text-app-muted mb-1.5 block">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-10 rounded border border-app-border cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 bg-app-bg border border-app-border rounded text-xs text-app-text font-mono focus:outline-none focus:border-app-accent"
        />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-app-bg rounded-lg p-3 border border-app-border">
      <div className="flex items-center gap-2 text-app-muted mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-xl font-bold text-app-text">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}
