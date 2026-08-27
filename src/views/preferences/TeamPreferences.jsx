import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Check,
  Copy,
  Eye,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  Plus,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { teamControlClient } from '../../core/team/TeamControlClient';
import * as P from './primitives.jsx';

const FIELD_CLASS = 'w-full rounded-md border border-app-border bg-app-panel px-3 py-2 text-sm text-app-text outline-none transition-colors placeholder:text-app-muted focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50';
const PENDING_TEAM_INVITE_KEY = 'pending-team-invite';

export default function TeamPreferences({
  userId,
  isAuthenticated,
  isGuest,
}) {
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [spaceGrants, setSpaceGrants] = useState({});
  const [inviteLink, setInviteLink] = useState(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteId, setInviteId] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [detailsError, setDetailsError] = useState('');
  const joinDetailsRef = useRef(null);

  const selectedTeam = useMemo(
    () => teams.find(({ id }) => id === selectedTeamId) ?? null,
    [selectedTeamId, teams],
  );
  const selectedRole = selectedTeam?.membership?.role ?? selectedTeam?.role;
  const selectedStatus = selectedTeam?.membership?.status ?? selectedTeam?.status;
  const canAdmin = ['owner', 'admin'].includes(selectedRole);
  const spaces = selectedTeam?.spaces ?? [];

  const refresh = useCallback(async () => {
    if (!userId || !isAuthenticated || isGuest) return;
    setLoading(true);
    setLoadError('');
    try {
      await teamControlClient.initialize(userId);
      const nextTeams = await teamControlClient.listTeams(userId);
      setTeams(nextTeams);
      setSelectedTeamId((current) => (
        nextTeams.some(({ id }) => id === current)
          ? current
          : nextTeams[0]?.id ?? ''
      ));
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isGuest, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId || !isAuthenticated || isGuest) return;
    let cancelled = false;
    (async () => {
      const encoded = await invoke('secure_store_get', {
        key: PENDING_TEAM_INVITE_KEY,
      });
      if (!encoded || cancelled) return;
      await invoke('secure_store_delete', { key: PENDING_TEAM_INVITE_KEY });
      const pending = JSON.parse(encoded);
      if (!pending?.inviteId || !pending?.token || cancelled) return;

      setBusy('accept');
      try {
        await teamControlClient.initialize(userId);
        await teamControlClient.acceptInvite(pending.inviteId, pending.token);
        if (cancelled) return;
        await refresh();
        toast.success('Team joined — encryption keys are being prepared');
      } catch (error) {
        if (cancelled) return;
        setInviteId(pending.inviteId);
        setInviteToken(pending.token);
        if (joinDetailsRef.current) joinDetailsRef.current.open = true;
        toast.error(`Could not join team: ${errorMessage(error)}`);
      } finally {
        if (!cancelled) setBusy('');
      }
    })().catch((error) => {
      if (!cancelled) toast.error(`Could not open team invite: ${errorMessage(error)}`);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isGuest, refresh, userId]);

  useEffect(() => {
    setMembers([]);
    setPendingInvites([]);
    setDetailsError('');
    setSpaceGrants({});
    setInviteLink(null);
    setInviteCopied(false);
    if (!selectedTeamId) return undefined;

    let cancelled = false;
    setDetailsLoading(true);
    const memberRequest = teamControlClient.listTeamMembers(selectedTeamId);
    const inviteRequest = canAdmin
      ? teamControlClient.listPendingInvites(selectedTeamId)
      : Promise.resolve([]);

    Promise.allSettled([memberRequest, inviteRequest])
      .then(([memberResult, inviteResult]) => {
        if (cancelled) return;
        const errors = [];
        if (memberResult.status === 'fulfilled') {
          setMembers(memberResult.value);
        } else {
          errors.push(`Members: ${errorMessage(memberResult.reason)}`);
        }
        if (inviteResult.status === 'fulfilled') {
          setPendingInvites(inviteResult.value);
        } else {
          errors.push(`Invites: ${errorMessage(inviteResult.reason)}`);
        }
        setDetailsError(errors.join(' '));
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canAdmin, selectedTeamId]);

  const createTeam = async (event) => {
    event?.preventDefault();
    if (!teamName.trim()) return;
    setBusy('create');
    try {
      const created = await teamControlClient.createTeam(teamName.trim());
      setTeamName('');
      await refresh();
      setSelectedTeamId(created.team_id ?? created.id);
      toast.success('Team created');
    } catch (error) {
      toast.error(`Could not create team: ${errorMessage(error)}`);
    } finally {
      setBusy('');
    }
  };

  const createInvite = async (event) => {
    event?.preventDefault();
    if (!selectedTeam || !inviteEmail.trim()) return;
    setBusy('invite');
    setInviteLink(null);
    setInviteCopied(false);
    const email = inviteEmail.trim();
    try {
      const created = await teamControlClient.createInvite({
        teamId: selectedTeam.id,
        email,
        role: inviteRole,
        grants: spaces.flatMap((space) => {
          const role = spaceGrants[space.id];
          return role && role !== 'none' ? [{ space_id: space.id, role }] : [];
        }),
      });
      const url = await teamControlClient.buildInviteUrl(created.inviteId, created.token);
      setInviteLink({ email, url });
      setInviteEmail('');
      try {
        setPendingInvites(await teamControlClient.listPendingInvites(selectedTeam.id));
      } catch (refreshError) {
        setDetailsError(`Invites: ${errorMessage(refreshError)}`);
      }
      toast.success('Invite created');
    } catch (error) {
      toast.error(`Could not create invite: ${errorMessage(error)}`);
    } finally {
      setBusy('');
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink?.url) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable');
      await navigator.clipboard.writeText(inviteLink.url);
      setInviteCopied(true);
      toast.success('Invite link copied');
    } catch (error) {
      toast.error(`Could not copy invite link: ${errorMessage(error)}`);
    }
  };

  const revokeInvite = async (invite) => {
    const id = invite.id ?? invite.invite_id;
    if (!id) return;
    setBusy(`revoke:${id}`);
    try {
      await teamControlClient.revokeInvite(id);
      setPendingInvites((current) => current.filter(
        (item) => (item.id ?? item.invite_id) !== id,
      ));
      toast.success('Invite revoked');
    } catch (error) {
      toast.error(`Could not revoke invite: ${errorMessage(error)}`);
    } finally {
      setBusy('');
    }
  };

  const acceptInvite = async (event) => {
    event?.preventDefault();
    if (!inviteId.trim() || !inviteToken.trim()) return;
    setBusy('accept');
    try {
      await teamControlClient.acceptInvite(inviteId.trim(), inviteToken.trim());
      setInviteId('');
      setInviteToken('');
      await refresh();
      toast.success('Invite accepted — encryption keys are being prepared');
    } catch (error) {
      toast.error(`Could not accept invite: ${errorMessage(error)}`);
    } finally {
      setBusy('');
    }
  };

  const provision = async () => {
    if (!selectedTeam) return;
    setBusy('provision');
    try {
      const devices = await teamControlClient.provisionMissingDevices(selectedTeam.id);
      setMembers(await teamControlClient.listTeamMembers(selectedTeam.id));
      toast.success(
        devices.length
          ? `Encryption keys prepared for ${devices.length} device${devices.length === 1 ? '' : 's'}`
          : 'Every member device already has encryption keys',
      );
    } catch (error) {
      toast.error(`Could not prepare encryption keys: ${errorMessage(error)}`);
    } finally {
      setBusy('');
    }
  };

  const removeMember = async (member) => {
    if (!selectedTeam || member.user_id === userId) return;
    setBusy(`remove:${member.user_id}`);
    try {
      await teamControlClient.removeMember({
        teamId: selectedTeam.id,
        targetUserId: member.user_id,
      });
      setMembers(await teamControlClient.listTeamMembers(selectedTeam.id));
      toast.success('Member removed and encryption keys rotated');
    } catch (error) {
      toast.error(`Could not remove member: ${errorMessage(error)}`);
    } finally {
      setBusy('');
    }
  };

  if (!isAuthenticated || isGuest || !userId || userId === 'guest') {
    return (
      <P.Page
        title="Teams"
        lede="Collaborate on encrypted notes without giving up your local files."
      >
        <P.Empty>Sign in to create or join teams.</P.Empty>
      </P.Page>
    );
  }

  if (loading) {
    return (
      <P.Page title="Teams" lede="Your notes stay local-first and sync as encrypted revisions.">
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 py-8 text-sm text-app-muted"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading teams…
        </div>
      </P.Page>
    );
  }

  return (
    <P.Page
      title="Teams"
      lede="Team notes remain ordinary local files. Lokus shares end-to-end encrypted revisions with only the people and spaces you choose."
    >
      <P.Group label="Your teams" hint="Choose a team to review its people and note spaces.">
        {loadError && (
          <div role="alert" className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-red-500/25 bg-red-500/5 p-3">
            <div>
              <p className="text-sm font-medium text-red-500">Teams could not be loaded</p>
              <p className="mt-0.5 text-xs text-app-muted">{loadError}</p>
            </div>
            <P.Button onClick={refresh}>Try again</P.Button>
          </div>
        )}

        {teams.length ? (
          <div role="list" aria-label="Teams" className="grid gap-2 sm:grid-cols-2">
            {teams.map((team) => {
              const selected = team.id === selectedTeamId;
              const role = team.membership?.role ?? team.role;
              const status = team.membership?.status ?? team.status;
              return (
                <div key={team.id} role="listitem">
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`group flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                      selected
                        ? 'border-blue-500/60 bg-blue-500/10'
                        : 'border-app-border bg-app-panel hover:border-app-muted hover:bg-app-hover'
                    }`}
                  >
                    <span className={`rounded-md p-2 ${selected ? 'bg-blue-500/15 text-blue-500' : 'bg-app-bg text-app-muted'}`}>
                      <Users className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-app-text">
                        {team.name || team.id}
                      </span>
                      <span className="mt-0.5 block text-xs text-app-muted">
                        {roleLabel(role)} · {membershipStatus(status).label}
                      </span>
                    </span>
                    {selected && <Check className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          !loadError && <P.Empty>No teams yet. Create one to start a private, encrypted workspace.</P.Empty>
        )}

        <form onSubmit={createTeam} className="mt-3 flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-xs font-medium text-app-muted">New team name</span>
            <input
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="Product team"
              autoComplete="off"
              className={FIELD_CLASS}
            />
          </label>
          <ActionButton
            type="submit"
            disabled={!teamName.trim() || !!busy}
            icon={Plus}
            loading={busy === 'create'}
          >
            Create team
          </ActionButton>
        </form>
      </P.Group>

      {selectedTeam && (
        <P.Group
          label={`${selectedTeam.name || selectedTeam.id} spaces`}
          hint="Readable spaces appear here. Editor access is required to share or move a note."
        >
          {selectedStatus === 'key_pending' && (
            <div role="status" className="mb-2 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-app-muted">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
              Your membership is confirmed, but this device is waiting for encryption keys. An admin needs to provision them before you can read team notes.
            </div>
          )}
          {spaces.length ? (
            <div role="list" aria-label={`${selectedTeam.name || 'Team'} spaces`} className="divide-y divide-app-border/60">
              {spaces.map((space) => (
                <div key={space.id} role="listitem" className="flex items-center gap-3 py-3">
                  <span className={`rounded-md p-1.5 ${
                    space.key_pending
                      ? 'bg-amber-500/10 text-amber-500'
                      : space.can_write
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'bg-app-panel text-app-muted'
                  }`}>
                    {space.key_pending
                      ? <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                      : space.can_write
                        ? <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-app-text">
                      {space.name || (space.key_pending ? 'Encrypted space' : space.id)}
                    </span>
                    {space.key_pending && (
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-app-muted">
                        {space.id}
                      </span>
                    )}
                  </span>
                  <AccessBadge writable={space.can_write} pending={space.key_pending} />
                </div>
              ))}
            </div>
          ) : (
            <P.Empty>No readable note spaces are available for this team yet.</P.Empty>
          )}
        </P.Group>
      )}

      {selectedTeam && (
        <P.Group
          label="People"
          hint="A member waiting for keys cannot decrypt team notes until an admin provisions their device."
        >
          {detailsLoading ? (
            <InlineLoading label="Loading members and invites…" />
          ) : (
            <>
              {detailsError && (
                <p role="alert" className="mb-2 rounded-md border border-red-500/25 bg-red-500/5 px-3 py-2 text-xs text-red-500">
                  {detailsError}
                </p>
              )}
              {members.length ? (
                <div role="list" aria-label={`${selectedTeam.name || 'Team'} members`} className="divide-y divide-app-border/60">
                  {members.map((member) => {
                    const identity = memberIdentity(member);
                    const status = membershipStatus(member.status);
                    return (
                      <div key={member.user_id ?? member.id} role="listitem" className="flex items-center gap-3 py-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-panel font-medium text-app-muted" aria-hidden="true">
                          {identity.initials}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-medium text-app-text ${identity.fallback ? 'font-mono text-xs' : ''}`} title={identity.title}>
                            {identity.primary}
                          </p>
                          {identity.secondary && (
                            <p className="mt-0.5 truncate text-xs text-app-muted" title={identity.secondary}>
                              {identity.secondary}
                            </p>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-app-panel px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-app-muted">
                              {roleLabel(member.role)}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.className}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>
                        {canAdmin && member.user_id !== userId && (
                          <button
                            type="button"
                            disabled={!!busy}
                            onClick={() => removeMember(member)}
                            className="rounded-md px-2.5 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 disabled:opacity-50"
                          >
                            {busy === `remove:${member.user_id}` ? 'Rotating keys…' : 'Remove'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                !detailsError && <P.Empty>No members were returned for this team.</P.Empty>
              )}
              {canAdmin && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-app-border bg-app-panel/60 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-app-text">Encryption key access</p>
                    <p className="mt-0.5 text-xs leading-5 text-app-muted">
                      Securely prepare missing keys for member devices.
                    </p>
                  </div>
                  <ActionButton
                    onClick={provision}
                    disabled={!!busy}
                    icon={KeyRound}
                    loading={busy === 'provision'}
                    variant="secondary"
                  >
                    Provision keys
                  </ActionButton>
                </div>
              )}
            </>
          )}
        </P.Group>
      )}

      {selectedTeam && canAdmin && (
        <P.Group
          label="Invite someone"
          hint="Choose their team role and only the note spaces they should access. No space is granted automatically."
        >
          <form onSubmit={createInvite} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
              <label>
                <span className="mb-1.5 block text-xs font-medium text-app-muted">Email address</span>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="teammate@example.com"
                  autoComplete="email"
                  className={FIELD_CLASS}
                />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-app-muted">Team role</span>
                <select
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value)}
                  className={FIELD_CLASS}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </div>

            <fieldset>
              <legend className="text-xs font-medium text-app-muted">Space access</legend>
              <p className="mt-1 text-xs leading-5 text-app-muted">
                Reader can decrypt and view notes. Editor can also share, move, and update notes.
              </p>
              {spaces.length ? (
                <div className="mt-2 divide-y divide-app-border/60 rounded-lg border border-app-border px-3">
                  {spaces.map((space) => {
                    const name = space.name || (space.key_pending ? 'Encrypted space' : space.id);
                    return (
                      <div key={space.id} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-app-text">{name}</p>
                          <p className="mt-0.5 text-[11px] text-app-muted">
                            Your access: {space.key_pending
                              ? 'Waiting for encryption key'
                              : space.can_write ? 'Editor' : 'Reader'}
                          </p>
                        </div>
                        <label className="sr-only" htmlFor={`invite-space-${space.id}`}>
                          {name} access
                        </label>
                        <select
                          id={`invite-space-${space.id}`}
                          aria-label={`${name} access`}
                          value={spaceGrants[space.id] ?? 'none'}
                          onChange={(event) => setSpaceGrants((current) => ({
                            ...current,
                            [space.id]: event.target.value,
                          }))}
                          className="rounded-md border border-app-border bg-app-panel px-2.5 py-1.5 text-xs text-app-text outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20"
                        >
                          <option value="none">No access</option>
                          <option value="reader">Reader</option>
                          <option value="editor">Editor</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <P.Note>The invite can join the team, but there are no readable spaces to grant.</P.Note>
              )}
            </fieldset>

            <div className="flex justify-end">
              <ActionButton
                type="submit"
                disabled={!inviteEmail.trim() || !!busy}
                icon={UserPlus}
                loading={busy === 'invite'}
              >
                Create invite link
              </ActionButton>
            </div>
          </form>

          {inviteLink && (
            <div role="status" aria-live="polite" className="mt-3 flex items-center gap-3 rounded-lg border border-green-500/25 bg-green-500/5 p-3">
              <span className="rounded-full bg-green-500/10 p-2 text-green-500">
                <Lock className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-app-text">Invite link ready</p>
                <p className="mt-0.5 truncate text-xs text-app-muted">{inviteLink.email}</p>
              </div>
              <ActionButton
                onClick={copyInviteLink}
                icon={inviteCopied ? Check : Copy}
                variant="secondary"
              >
                {inviteCopied ? 'Copied' : 'Copy link'}
              </ActionButton>
            </div>
          )}
        </P.Group>
      )}

      {selectedTeam && canAdmin && (
        <P.Group
          label="Pending invites"
          hint="Invite links expire automatically. Revoke any link that should no longer work."
        >
          {detailsLoading ? (
            <InlineLoading label="Loading pending invites…" />
          ) : pendingInvites.length ? (
            <div role="list" aria-label="Pending invites" className="divide-y divide-app-border/60">
              {pendingInvites.map((pending) => {
                const id = pending.id ?? pending.invite_id;
                const recipient = pending.email ?? pending.email_normalized ?? id;
                return (
                  <div key={id} role="listitem" className="flex items-center gap-3 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-panel text-app-muted">
                      <UserPlus className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-app-text" title={recipient}>
                        {recipient}
                      </p>
                      <p className="mt-0.5 text-xs text-app-muted">
                        {roleLabel(pending.role)} · Expires {formatInviteDate(pending.expires_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Revoke invite for ${recipient}`}
                      disabled={!!busy}
                      onClick={() => revokeInvite(pending)}
                      className="rounded-md px-2.5 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 disabled:opacity-50"
                    >
                      {busy === `revoke:${id}` ? 'Revoking…' : 'Revoke'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <P.Empty>No pending invites.</P.Empty>
          )}
        </P.Group>
      )}

      <P.Group
        label="Join a team"
        hint="Invite links open Lokus with the secure details filled in. Use manual entry only if a link does not open."
      >
        <details ref={joinDetailsRef} className="rounded-lg border border-app-border bg-app-panel/40">
          <summary className="cursor-pointer rounded-lg px-3 py-2.5 text-sm text-app-text outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30">
            Enter invite details manually
          </summary>
          <form onSubmit={acceptInvite} className="space-y-3 border-t border-app-border p-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-app-muted">Invite ID</span>
              <input
                value={inviteId}
                onChange={(event) => setInviteId(event.target.value)}
                placeholder="Invite ID"
                autoComplete="off"
                spellCheck={false}
                className={`${FIELD_CLASS} font-mono text-xs`}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-app-muted">Secure invite token</span>
              <input
                type="password"
                value={inviteToken}
                onChange={(event) => setInviteToken(event.target.value)}
                placeholder="Invite token"
                autoComplete="off"
                spellCheck={false}
                className={`${FIELD_CLASS} font-mono text-xs`}
              />
            </label>
            <div className="flex justify-end">
              <ActionButton
                type="submit"
                disabled={!inviteId.trim() || !inviteToken.trim() || !!busy}
                icon={UserPlus}
                loading={busy === 'accept'}
              >
                Join team
              </ActionButton>
            </div>
          </form>
        </details>
      </P.Group>
    </P.Page>
  );
}

function ActionButton({
  icon: Icon,
  loading = false,
  children,
  type = 'button',
  variant = 'primary',
  ...props
}) {
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      {...props}
      className={`inline-flex shrink-0 items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50 ${
        variant === 'secondary'
          ? 'border-app-border bg-app-panel text-app-text hover:bg-app-hover'
          : 'border-blue-600 bg-blue-600 text-white hover:border-blue-500 hover:bg-blue-500'
      }`}
    >
      {loading
        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        : <Icon className="mr-2 h-4 w-4" aria-hidden="true" />}
      {children}
    </button>
  );
}

function InlineLoading({ label }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 py-4 text-sm text-app-muted">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

function AccessBadge({ writable, pending }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${
      pending
        ? 'bg-amber-500/10 text-amber-500'
        : writable ? 'bg-blue-500/10 text-blue-500' : 'bg-app-panel text-app-muted'
    }`}>
      {pending
        ? <KeyRound className="h-3 w-3" aria-hidden="true" />
        : writable
          ? <Pencil className="h-3 w-3" aria-hidden="true" />
          : <Eye className="h-3 w-3" aria-hidden="true" />}
      {pending ? 'Key pending' : writable ? 'Can edit' : 'View only'}
    </span>
  );
}

function memberIdentity(member) {
  const profile = member.profile ?? member.profiles ?? {};
  const name = member.display_name
    ?? member.full_name
    ?? member.name
    ?? profile.display_name
    ?? profile.full_name
    ?? profile.name;
  const email = member.email ?? member.email_normalized ?? profile.email;
  const id = member.user_id ?? member.id ?? 'Unknown member';
  const primary = name || email || id;
  const secondary = name ? (email || id) : (email ? id : '');
  return {
    primary,
    secondary,
    title: id,
    fallback: !name && !email,
    initials: initialsFor(name || email || id),
  };
}

function initialsFor(value) {
  const parts = String(value).trim().split(/[\s@._-]+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

function membershipStatus(status) {
  const states = {
    active: {
      label: 'Active member',
      className: 'bg-green-500/10 text-green-500',
    },
    key_pending: {
      label: 'Waiting for encryption keys',
      className: 'bg-amber-500/10 text-amber-500',
    },
    invited: {
      label: 'Invited',
      className: 'bg-blue-500/10 text-blue-500',
    },
    suspended: {
      label: 'Suspended',
      className: 'bg-red-500/10 text-red-500',
    },
  };
  return states[status] ?? {
    label: status ? String(status).replaceAll('_', ' ') : 'Status unavailable',
    className: 'bg-app-panel text-app-muted',
  };
}

function roleLabel(role) {
  if (!role) return 'Member';
  return `${String(role)[0].toUpperCase()}${String(role).slice(1)}`;
}

function formatInviteDate(value) {
  if (!value) return 'on the scheduled date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'on the scheduled date';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function errorMessage(error) {
  return error?.message || String(error);
}
