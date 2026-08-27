import { useState } from 'react';

const DEFAULT_MAX_VISIBLE = 3;

export default function PresenceBar({
  collaborators = [],
  maxVisible = DEFAULT_MAX_VISIBLE,
  className = '',
}) {
  const people = collaborators.filter(
    (collaborator) => collaborator && typeof collaborator === 'object',
  );
  if (people.length === 0) return null;

  const visibleCount = Math.max(1, Math.floor(maxVisible) || DEFAULT_MAX_VISIBLE);
  const visible = people.slice(0, visibleCount);
  const hidden = people.slice(visibleCount);
  const countLabel = `${people.length} ${
    people.length === 1 ? 'collaborator' : 'collaborators'
  } present`;

  return (
    <div
      className={`flex items-center -space-x-1.5 ${className}`.trim()}
      role="group"
      aria-label={countLabel}
    >
      {visible.map((collaborator, index) => (
        <PresenceAvatar
          key={collaborator.id ?? `${collaborator.name ?? 'teammate'}-${index}`}
          collaborator={collaborator}
        />
      ))}
      {hidden.length > 0 && (
        <span
          className="relative z-10 inline-flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-app-panel bg-app-panel-secondary px-1 text-[10px] font-semibold text-app-text ring-1 ring-app-border"
          role="img"
          aria-label={`${hidden.length} more ${
            hidden.length === 1 ? 'collaborator' : 'collaborators'
          }: ${hidden.map(displayName).join(', ')}`}
          title={hidden.map(displayName).join(', ')}
        >
          +{hidden.length}
        </span>
      )}
    </div>
  );
}

function PresenceAvatar({ collaborator }) {
  const [imageFailed, setImageFailed] = useState(false);
  const name = displayName(collaborator);
  const mode = collaborator.mode === 'editing' ? 'editing' : 'viewing';
  const selfLabel = collaborator.isSelf ? ' (you)' : '';
  const avatarUrl = safeAvatarUrl(collaborator.avatarUrl);

  return (
    <span
      className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-app-panel bg-app-panel-secondary text-[9px] font-semibold uppercase text-app-text ring-1 ring-app-border"
      role="img"
      aria-label={`${name}${selfLabel}, ${mode}`}
      title={`${name}${selfLabel} · ${mode}`}
    >
      {avatarUrl && !imageFailed ? (
        <img
          src={avatarUrl}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
      <span
        className={`absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full ring-1 ring-app-panel ${
          mode === 'editing' ? 'bg-app-accent' : 'bg-app-success'
        }`}
        aria-hidden="true"
      />
    </span>
  );
}

function displayName(collaborator) {
  const name = typeof collaborator?.name === 'string'
    ? collaborator.name.trim()
    : '';
  return name || 'Teammate';
}

function initials(name) {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1
    ? words[0].slice(0, 2)
    : `${words[0][0]}${words.at(-1)[0]}`;
  return letters.toLocaleUpperCase();
}

function safeAvatarUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(
      value,
      globalThis.location?.origin ?? 'https://lokus.local',
    );
    return ['http:', 'https:', 'blob:'].includes(parsed.protocol)
      ? value
      : null;
  } catch {
    return null;
  }
}
