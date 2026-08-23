import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, KeyRound, Loader2, Plus, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { teamControlClient } from '../../core/team/TeamControlClient';
import * as P from './primitives.jsx';

export default function TeamPreferences({
  userId,
  isAuthenticated,
  isGuest,
}) {
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [members, setMembers] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invite, setInvite] = useState(null);
  const [inviteId, setInviteId] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);

  const selectedTeam = useMemo(
    () => teams.find(({ id }) => id === selectedTeamId) ?? null,
    [selectedTeamId, teams],
  );
  const canAdmin = ['owner', 'admin'].includes(selectedTeam?.membership?.role);

  const refresh = useCallback(async () => {
    if (!userId || !isAuthenticated || isGuest) return;
    setLoading(true);
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
      toast.error(`Could not load teams: ${error?.message || error}`);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isGuest, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedTeamId) {
      setMembers([]);
      return;
    }
    teamControlClient.listTeamMembers(selectedTeamId)
      .then(setMembers)
      .catch((error) => toast.error(`Could not load members: ${error?.message || error}`));
  }, [selectedTeamId]);

  const createTeam = async () => {
    if (!teamName.trim()) return;
    setBusy('create');
    try {
      const created = await teamControlClient.createTeam(teamName.trim());
      setTeamName('');
      await refresh();
      setSelectedTeamId(created.team_id);
      toast.success('Team created');
    } catch (error) {
      toast.error(`Could not create team: ${error?.message || error}`);
    } finally {
      setBusy('');
    }
  };

  const createInvite = async () => {
    if (!selectedTeam || !inviteEmail.trim()) return;
    setBusy('invite');
    try {
      const created = await teamControlClient.createInvite({
        teamId: selectedTeam.id,
        email: inviteEmail.trim(),
        role: 'member',
        grants: selectedTeam.spaces.map(({ id }) => ({
          space_id: id,
          role: 'editor',
        })),
      });
      setInvite(created);
      setInviteEmail('');
    } catch (error) {
      toast.error(`Could not create invite: ${error?.message || error}`);
    } finally {
      setBusy('');
    }
  };

  const acceptInvite = async () => {
    if (!inviteId.trim() || !inviteToken.trim()) return;
    setBusy('accept');
    try {
      await teamControlClient.acceptInvite(inviteId.trim(), inviteToken.trim());
      setInviteId('');
      setInviteToken('');
      await refresh();
      toast.success('Invite accepted — waiting for encrypted keys');
    } catch (error) {
      toast.error(`Could not accept invite: ${error?.message || error}`);
    } finally {
      setBusy('');
    }
  };

  const provision = async () => {
    if (!selectedTeam) return;
    setBusy('provision');
    try {
      const devices = await teamControlClient.provisionMissingDevices(selectedTeam.id);
      toast.success(devices.length ? `Provisioned ${devices.length} device${devices.length === 1 ? '' : 's'}` : 'All devices already have keys');
      setMembers(await teamControlClient.listTeamMembers(selectedTeam.id));
    } catch (error) {
      toast.error(`Could not provision devices: ${error?.message || error}`);
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
      toast.success('Member removed and keys rotated');
    } catch (error) {
      toast.error(`Could not remove member: ${error?.message || error}`);
    } finally {
      setBusy('');
    }
  };

  if (!isAuthenticated || isGuest || !userId || userId === 'guest') {
    return (
      <P.Page title="Teams">
        <P.Empty>Sign in to create or join teams.</P.Empty>
      </P.Page>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-app-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading teams…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <P.Group label="Your teams" hint="Team notes stay as ordinary local files and sync as end-to-end encrypted revisions.">
        <div className="space-y-3">
          {!!teams.length && (
            <div className="grid gap-2 sm:grid-cols-2">
              {teams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setSelectedTeamId(team.id)}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                    team.id === selectedTeamId
                      ? 'border-blue-500/60 bg-blue-500/8'
                      : 'border-app-border bg-app-panel hover:bg-app-hover'
                  }`}
                >
                  <Users className="h-4 w-4 text-app-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-app-text">{team.name}</span>
                    <span className="block text-xs text-app-muted">
                      {team.membership.role} · {team.membership.status}
                    </span>
                  </span>
                  {team.id === selectedTeamId && <Check className="h-4 w-4 text-blue-500" />}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="Team name"
              className="min-w-0 flex-1 rounded-md border border-app-border bg-app-panel px-3 py-2 text-sm text-app-text outline-none focus:border-blue-500"
            />
            <ActionButton
              onClick={createTeam}
              disabled={!teamName.trim() || !!busy}
              icon={Plus}
              loading={busy === 'create'}
            >
              Create team
            </ActionButton>
          </div>
        </div>
      </P.Group>

      {selectedTeam && (
        <P.Group label={`${selectedTeam.name} members`} hint="Removing a member rotates team and space keys before access is revoked.">
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.user_id} className="flex items-center gap-3 rounded-lg border border-app-border bg-app-panel px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-app-text">{member.user_id}</p>
                  <p className="text-xs text-app-muted">{member.role} · {member.status}</p>
                </div>
                {canAdmin && member.user_id !== userId && (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => removeMember(member)}
                    className="rounded-md px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {busy === `remove:${member.user_id}` ? 'Rotating keys…' : 'Remove'}
                  </button>
                )}
              </div>
            ))}
            {canAdmin && (
              <ActionButton
                onClick={provision}
                disabled={!!busy}
                icon={KeyRound}
                loading={busy === 'provision'}
              >
                Provision pending devices
              </ActionButton>
            )}
          </div>
        </P.Group>
      )}

      {selectedTeam && canAdmin && (
        <P.Group label="Invite a member" hint="The bearer token is shown once. Send both values through a private channel.">
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="member@example.com"
              className="min-w-0 flex-1 rounded-md border border-app-border bg-app-panel px-3 py-2 text-sm text-app-text outline-none focus:border-blue-500"
            />
            <ActionButton
              onClick={createInvite}
              disabled={!inviteEmail.trim() || !!busy}
              icon={UserPlus}
              loading={busy === 'invite'}
            >
              Create invite
            </ActionButton>
          </div>
          {invite && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/8 p-3">
              <p className="mb-2 text-xs text-app-muted">Invite ID</p>
              <CopyValue value={invite.inviteId} />
              <p className="mb-2 mt-3 text-xs text-app-muted">Bearer token</p>
              <CopyValue value={invite.token} />
            </div>
          )}
        </P.Group>
      )}

      <P.Group label="Accept an invite" hint="Paste the invite ID and bearer token sent by a team admin.">
        <div className="space-y-2">
          <input
            value={inviteId}
            onChange={(event) => setInviteId(event.target.value)}
            placeholder="Invite ID"
            className="w-full rounded-md border border-app-border bg-app-panel px-3 py-2 font-mono text-xs text-app-text outline-none focus:border-blue-500"
          />
          <input
            value={inviteToken}
            onChange={(event) => setInviteToken(event.target.value)}
            placeholder="Bearer token"
            className="w-full rounded-md border border-app-border bg-app-panel px-3 py-2 font-mono text-xs text-app-text outline-none focus:border-blue-500"
          />
          <ActionButton
            onClick={acceptInvite}
            disabled={!inviteId.trim() || !inviteToken.trim() || !!busy}
            icon={UserPlus}
            loading={busy === 'accept'}
          >
            Accept invite
          </ActionButton>
        </div>
      </P.Group>
    </div>
  );
}

function ActionButton({ icon: Icon, loading, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex shrink-0 items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
      {children}
    </button>
  );
}

function CopyValue({ value }) {
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 overflow-hidden text-ellipsis rounded bg-app-bg px-2 py-1.5 text-xs text-app-text">
        {value}
      </code>
      <button
        type="button"
        aria-label="Copy"
        onClick={() => navigator.clipboard?.writeText(value)}
        className="rounded-md p-2 text-app-muted hover:bg-app-hover hover:text-app-text"
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
  );
}
