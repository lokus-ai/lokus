import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export const TEAM_SYNC_STATES = Object.freeze([
  'idle',
  'syncing',
  'synced',
  'offline',
  'error',
  'conflict',
  'key_pending',
]);

const VALID_SYNC_STATES = new Set(TEAM_SYNC_STATES);

export const EMPTY_TEAM_COLLABORATION = Object.freeze({
  syncState: 'idle',
  outboxCount: 0,
  lastSyncedAt: null,
  collaborators: Object.freeze([]),
});

export const useTeamCollaborationStore = create(
  subscribeWithSelector((set) => ({
    spaces: {},

    updateNote: (spaceId, noteId, patch) => {
      const scope = normalizeScope(spaceId, noteId);
      const normalizedPatch = normalizePatch(patch);
      if (Object.keys(normalizedPatch).length === 0) return;

      set((state) => {
        const previous = state.spaces[scope.spaceId]?.[scope.noteId]
          ?? EMPTY_TEAM_COLLABORATION;
        const next = { ...previous, ...normalizedPatch };
        if (sameRecord(previous, next)) return state;

        return {
          spaces: {
            ...state.spaces,
            [scope.spaceId]: {
              ...state.spaces[scope.spaceId],
              [scope.noteId]: next,
            },
          },
        };
      });
    },

    resetNote: (spaceId, noteId) => {
      const scope = normalizeScope(spaceId, noteId);
      set((state) => {
        const space = state.spaces[scope.spaceId];
        if (!space?.[scope.noteId]) return state;

        const nextSpace = { ...space };
        delete nextSpace[scope.noteId];
        const nextSpaces = { ...state.spaces };
        if (Object.keys(nextSpace).length === 0) {
          delete nextSpaces[scope.spaceId];
        } else {
          nextSpaces[scope.spaceId] = nextSpace;
        }
        return { spaces: nextSpaces };
      });
    },

    resetSpace: (spaceId) => {
      const safeSpaceId = normalizeId(spaceId, 'spaceId');
      set((state) => {
        if (!state.spaces[safeSpaceId]) return state;
        const spaces = { ...state.spaces };
        delete spaces[safeSpaceId];
        return { spaces };
      });
    },

    resetAll: () => set((state) => (
      Object.keys(state.spaces).length === 0 ? state : { spaces: {} }
    )),
  })),
);

export function selectTeamCollaboration(spaceId, noteId) {
  const safeSpaceId = optionalId(spaceId);
  const safeNoteId = optionalId(noteId);
  return (state) => (
    safeSpaceId && safeNoteId
      ? state.spaces[safeSpaceId]?.[safeNoteId] ?? EMPTY_TEAM_COLLABORATION
      : EMPTY_TEAM_COLLABORATION
  );
}

export const teamCollaboration = Object.freeze({
  get(spaceId, noteId) {
    return selectTeamCollaboration(spaceId, noteId)(
      useTeamCollaborationStore.getState(),
    );
  },
  update(spaceId, noteId, patch) {
    useTeamCollaborationStore.getState().updateNote(spaceId, noteId, patch);
  },
  resetNote(spaceId, noteId) {
    useTeamCollaborationStore.getState().resetNote(spaceId, noteId);
  },
  resetSpace(spaceId) {
    useTeamCollaborationStore.getState().resetSpace(spaceId);
  },
  resetAll() {
    useTeamCollaborationStore.getState().resetAll();
  },
  subscribe(...args) {
    return useTeamCollaborationStore.subscribe(...args);
  },
});

function normalizePatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new TypeError('Team collaboration update must be an object');
  }

  const normalized = {};
  if (Object.prototype.hasOwnProperty.call(patch, 'syncState')) {
    if (!VALID_SYNC_STATES.has(patch.syncState)) {
      throw new TypeError(`Invalid team sync state: ${String(patch.syncState)}`);
    }
    normalized.syncState = patch.syncState;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'outboxCount')) {
    if (!Number.isInteger(patch.outboxCount) || patch.outboxCount < 0) {
      throw new TypeError('Team outbox count must be a non-negative integer');
    }
    normalized.outboxCount = patch.outboxCount;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'lastSyncedAt')) {
    normalized.lastSyncedAt = normalizeTimestamp(patch.lastSyncedAt);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'collaborators')) {
    normalized.collaborators = normalizeCollaborators(patch.collaborators);
  }
  return normalized;
}

function normalizeCollaborators(collaborators) {
  if (!Array.isArray(collaborators)) {
    throw new TypeError('Team collaborators must be an array');
  }

  const byId = new Map();
  for (const collaborator of collaborators) {
    if (!collaborator || typeof collaborator !== 'object') continue;
    const id = safeString(collaborator.id ?? collaborator.userId, 128);
    if (!id) continue;
    const next = {
      id,
      name:
        safeString(
          collaborator.name
          ?? collaborator.displayName
          ?? collaborator.display_name,
          80,
        ) ?? 'Teammate',
      avatarUrl: safeAvatarUrl(
        collaborator.avatarUrl ?? collaborator.avatar_url,
      ),
      mode: collaborator.mode === 'editing' ? 'editing' : 'viewing',
      isSelf: collaborator.isSelf === true,
    };
    const current = byId.get(id);
    byId.set(id, current
      ? {
          ...current,
          name: current.name === 'Teammate' ? next.name : current.name,
          avatarUrl: current.avatarUrl ?? next.avatarUrl,
          mode:
            current.mode === 'editing' || next.mode === 'editing'
              ? 'editing'
              : 'viewing',
          isSelf: current.isSelf || next.isSelf,
        }
      : next);
  }

  return [...byId.values()].sort((left, right) => {
    if (left.isSelf !== right.isSelf) return left.isSelf ? -1 : 1;
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
  });
}

function normalizeTimestamp(value) {
  if (value === null) return null;
  const timestamp = value instanceof Date
    ? value.getTime()
    : typeof value === 'string'
      ? Date.parse(value)
      : value;
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new TypeError('Team last sync time must be a valid timestamp');
  }
  return timestamp;
}

function normalizeScope(spaceId, noteId) {
  return {
    spaceId: normalizeId(spaceId, 'spaceId'),
    noteId: normalizeId(noteId, 'noteId'),
  };
}

function normalizeId(value, field) {
  const id = optionalId(value);
  if (!id) throw new TypeError(`${field} is required`);
  return id;
}

function optionalId(value) {
  return safeString(value, 256);
}

function safeString(value, maxLength) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function safeAvatarUrl(value) {
  const url = safeString(value, 2048);
  if (!url) return null;
  try {
    const parsed = new URL(
      url,
      globalThis.location?.origin ?? 'https://lokus.local',
    );
    return ['http:', 'https:', 'blob:'].includes(parsed.protocol) ? url : null;
  } catch {
    return null;
  }
}

function sameRecord(left, right) {
  return left.syncState === right.syncState
    && left.outboxCount === right.outboxCount
    && left.lastSyncedAt === right.lastSyncedAt
    && sameCollaborators(left.collaborators, right.collaborators);
}

function sameCollaborators(left, right) {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((collaborator, index) => {
    const other = right[index];
    return collaborator.id === other.id
      && collaborator.name === other.name
      && collaborator.avatarUrl === other.avatarUrl
      && collaborator.mode === other.mode
      && collaborator.isSelf === other.isSelf;
  });
}
