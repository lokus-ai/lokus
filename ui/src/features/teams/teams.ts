/** @part-of ui.teams */
import { accessToken } from "../../bridge/auth";
import { HOME, relay } from "../../bridge/sync";
import { createStore } from "../../shell/store";
import { app, nameTeam } from "../../shell/workspace";

/**
 * The teams the signed-in account is in, as the relay names them, with how many people each
 * has. A folder can be called anything ("Clean 2", a teammate's "Lokus"), and two teams can
 * share a name: the team's own name and its size are what tell them apart.
 */
export interface Known {
  name: string;
  /** Null when the relay did not say. */
  members: number | null;
}

/** `home`: the built-in relay has answered for the account signed in, so a team it left out is one this account is not in. */
export const teams = createStore<{ known: Record<string, Known>; home: boolean }>({ known: {}, home: false });

export const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** "4 members"; a team with nobody else in it says so. */
export const howMany = (members: number | null | undefined) => (members == null ? "Team" : members === 1 ? "Only you" : `${members} members`);

/** One relay's answer: this account's teams there, each with its size. */
export async function teamsOn(server: string, token: string): Promise<Record<string, Known>> {
  const mine = await relay<{ id: string; name: string }[]>(server, token, "GET", "/v1/workspaces");
  const sized = await Promise.all(
    mine.map(async (w) => {
      const members = await relay<unknown[]>(server, token, "GET", `/v1/workspaces/${w.id}/members`).then((m) => m.length, () => null);
      return [w.id, { name: w.name, members }] as const;
    }),
  );
  return Object.fromEntries(sized);
}

let asked = 0;
/** Ask again: on opening the list, on connecting, when someone signs in or the team changes. */
export async function lookAtTeams(): Promise<void> {
  const mine = ++asked;
  const { account, sync, team, vault } = app.get();
  const known: Record<string, Known> = {};
  const accountToken = account ? await accessToken().catch(() => null) : null;
  const home = HOME && accountToken ? await teamsOn(HOME, accountToken).catch(() => null) : null;
  Object.assign(known, home);
  // A relay of one's own is asked only once the open folder is connected to it: no sign-in goes anywhere new.
  const open = team && team.root === vault?.root && sync.status === "online" ? team : null;
  const token = open ? (open.token ?? accountToken) : null;
  if (open && token && open.server.replace(/\/+$/, "") !== HOME) Object.assign(known, await teamsOn(open.server, token).catch(() => ({})));
  if (mine !== asked || app.get().account?.id !== account?.id) return;
  teams.set({ known, home: home !== null });
  if (open && known[open.workspace]) await nameTeam(open.workspace, known[open.workspace].name);
}
