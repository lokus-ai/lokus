/** @part-of ui.customers */
import { runCore } from "../../bridge/core";

export type Scalar = string | number | boolean | null;
export type Cell = Scalar | Scalar[];

export interface Row {
  path: string;
  title: string;
  props: Record<string, Cell>;
}

/** One thing that happened with a customer: an issue, a message, a payment. A note in the customer's folder. */
export interface Item {
  path: string;
  title: string;
  /** issue, message or event. */
  kind: string;
  /** Where it came from: slack, linear, admin and so on. */
  source: string;
  from: string;
  status: string;
  /** For a message: the conversation it belongs to, and where that conversation is held. */
  thread: string;
  channel: string;
  /** For a message: true when the customer said it, false when we did. */
  inbound: boolean;
  /** Set when this records a detail changing (a plan, a price): the detail's name. */
  field: string;
  /** Milliseconds since 1970, or 0 when the note gives no time. */
  at: number;
}

export interface Customer {
  path: string;
  name: string;
  props: Record<string, Cell>;
  items: Item[];
  open: number;
  /** When anything last happened, in milliseconds; 0 when nothing is known. */
  last: number;
  /** When the oldest message we have not answered arrived, in milliseconds; 0 when none waits. */
  waiting: number;
}

/** One conversation with a customer: its messages, oldest first. */
export interface Thread {
  id: string;
  source: string;
  channel: string;
  messages: Item[];
  /** The customer spoke last, so the next word is ours. */
  waiting: boolean;
  /** When the last message was sent. */
  at: number;
}

/** A customer's messages as conversations, the most recently active first. A message with no thread is its own. */
export function threads(items: Item[]): Thread[] {
  const found = new Map<string, Item[]>();
  for (const item of items) {
    if (item.kind !== "message") continue;
    const id = item.thread || item.path;
    found.set(id, [...(found.get(id) ?? []), item]);
  }
  return [...found.entries()]
    .map(([id, messages]) => {
      messages.sort((a, b) => a.at - b.at);
      const last = messages[messages.length - 1];
      return { id, source: last.source, channel: last.channel, messages, waiting: last.inbound, at: last.at };
    })
    .sort((a, b) => b.at - a.at);
}

/** When the oldest unanswered conversation was last heard from; 0 when nothing waits on us. */
export function waitingSince(items: Item[]): number {
  const waiting = threads(items).filter((t) => t.waiting);
  return waiting.length ? Math.min(...waiting.map((t) => t.at)) : 0;
}

/** Properties that describe the page, not the customer. */
export const HIDDEN = new Set(["icon", "cover", "cover_layout", "view", "source", "group", "order", "type", "summary", "archived"]);

/** A customer the team has put away: kept, with everything about it, but out of the list. */
export const isArchived = (c: { props: Record<string, Cell> }) => c.props.archived === true || show(c.props.archived) === "true";

/** What a detail is, which decides how it is shown, sorted and typed in. */
export const KINDS = { text: "Text", number: "Number", money: "Money", date: "Date", person: "Person", choice: "Label", link: "Link" } as const;
export type Kind = keyof typeof KINDS;
/** What a new team starts with. Each is only a default: the team's own choice wins. */
const STARTER: Record<string, Kind> = { plan: "choice", owner: "person", mrr: "money", domain: "link", renewal: "date" };

/**
 * How one team looks at its customers: what each detail is, which are hidden, and which are
 * columns in the list. Kept in the list's own note, so the whole team shares it.
 */
export interface Schema {
  /** The list's note, where this is saved; null when the vault has none yet. */
  path: string | null;
  kinds: Record<string, Kind>;
  hidden: string[];
  columns: string[];
}

const list = (value: Cell | undefined): string[] => (Array.isArray(value) ? value.map(String) : show(value) ? [show(value)] : []);

/** The team's choices for the customers kept in `folder`. */
export async function loadSchema(folder: string): Promise<Schema> {
  const rows = await runCore<Row[]>("props.rows", { folder: "" });
  const home = rows.find((r) => show(r.props.view) === "customers" && (show(r.props.source) || "customers").replace(/^\/|\/$/g, "") === folder);
  const kinds: Record<string, Kind> = {};
  for (const entry of list(home?.props.fields)) {
    const [name, kind] = entry.trim().split(/\s+/);
    if (name && kind in KINDS) kinds[name] = kind as Kind;
  }
  return { path: home?.path ?? null, kinds, hidden: list(home?.props.hidden), columns: list(home?.props.columns) };
}

/** Save one part of the team's choices. Resolves to the schema as it now stands. */
export async function saveSchema(schema: Schema, change: Partial<Pick<Schema, "kinds" | "hidden" | "columns">>): Promise<Schema> {
  const next = { ...schema, ...change };
  if (!schema.path) return next;
  const write = (key: string, value: string[]) => runCore("props.set", { path: schema.path, key, value: value.length ? value : null });
  if (change.kinds) await write("fields", Object.entries(next.kinds).map(([name, kind]) => `${name} ${kind}`));
  if (change.hidden) await write("hidden", next.hidden);
  if (change.columns) await write("columns", next.columns);
  return next;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;
/** What a detail is: the team's choice, else the starting choice, else what its value looks like. */
export function kindOf(schema: Schema, key: string, value: Cell | undefined): Kind {
  const chosen = schema.kinds[key] ?? STARTER[key];
  if (chosen) return chosen;
  if (typeof value === "number" || /^-?\d+(\.\d+)?$/.test(show(value))) return "number";
  return ISO_DAY.test(show(value)) ? "date" : "text";
}

const NAMES: Record<string, string> = { mrr: "Monthly revenue", arr: "Yearly revenue" };
/** A detail's name as people read it: `signed_up` is "Signed up". */
export const label = (key: string) => NAMES[key] ?? key.replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());

/** A day written as 2026-12-15 means that day here, not midnight in London. */
export function parseDay(value: string): number {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])).getTime() : Date.parse(value);
}

/** The folder a customer's note sits in, which is the folder its list is about. */
export const folderOf = (customer: string) => (customer.includes("/") ? customer.slice(0, customer.lastIndexOf("/")) : "");
export const HEALTH = ["good", "watch", "at risk"];

export const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
export const show = (value: Cell | undefined): string =>
  value === null || value === undefined ? "" : Array.isArray(value) ? value.join(", ") : String(value);

/** Turn what was typed into a number, a yes/no or text. */
export function parse(text: string): Scalar {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed;
}

const CLOSED = new Set(["done", "closed", "resolved", "canceled", "cancelled", "fixed"]);
export const isOpenIssue = (item: Item) => item.kind === "issue" && !CLOSED.has(item.status.toLowerCase());

export type Tone = "good" | "watch" | "risk" | "none";
export function tone(health: string): Tone {
  const h = health.toLowerCase();
  if (!h) return "none";
  if (/risk|bad|red|churn/.test(h)) return "risk";
  if (/watch|warn|yellow/.test(h)) return "watch";
  return /good|healthy|green|great/.test(h) ? "good" : "none";
}

const DAY = 86_400_000;
export const daysSince = (at: number) => (at ? Math.floor((Date.now() - at) / DAY) : Infinity);

/** "3h ago", "2d ago", "Nov 2": short enough for a table cell. */
export function ago(at: number): string {
  if (!at) return "";
  const minutes = Math.floor((Date.now() - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 60 * 24 * 14) return `${Math.floor(minutes / 60 / 24)}d ago`;
  const date = new Date(at);
  const year = date.getFullYear() === new Date().getFullYear() ? {} : ({ year: "numeric" } as const);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", ...year });
}

/** "Today", "Yesterday" or the date: the heading a day's items sit under. */
export function dayLabel(at: number): string {
  if (!at) return "No date";
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Date(at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export const money = (value: Cell | undefined): string =>
  typeof value === "number" ? `$${value.toLocaleString()}` : show(value);

const stem = (path: string) => path.split("/").pop()!.replace(/\.md$/i, "");

function toItem(row: Row): Item {
  const time = Date.parse(show(row.props.at));
  return {
    path: row.path,
    title: show(row.props.title) || row.title || stem(row.path),
    kind: show(row.props.kind) || "event",
    source: show(row.props.source),
    from: show(row.props.from),
    status: show(row.props.status),
    field: show(row.props.field),
    thread: show(row.props.thread),
    channel: show(row.props.channel),
    inbound: show(row.props.direction) !== "out",
    at: Number.isNaN(time) ? 0 : time,
  };
}

const newestFirst = (a: Item, b: Item) => b.at - a.at;

/** What has happened with one customer: the notes in the folder that carries its name. */
export async function loadItems(customer: string): Promise<Item[]> {
  const rows = await runCore<Row[]>("props.rows", { folder: customer.replace(/\.md$/i, "") });
  return rows.map(toItem).sort(newestFirst);
}

/** Every customer in a folder, each with what has happened to it. */
export async function loadCustomers(folder: string): Promise<Customer[]> {
  const rows = await runCore<Row[]>("props.rows", { folder, deep: true });
  const prefix = folder ? `${folder}/` : "";
  const customers = new Map<string, Customer>();
  for (const row of rows) {
    const rest = row.path.slice(prefix.length);
    if (!rest.includes("/") && show(row.props.type) === "customer") {
      customers.set(stem(row.path), { path: row.path, name: stem(row.path), props: row.props, items: [], open: 0, last: 0, waiting: 0 });
    }
  }
  for (const row of rows) {
    const [owner, ...deeper] = row.path.slice(prefix.length).split("/");
    if (deeper.length === 1) customers.get(owner)?.items.push(toItem(row));
  }
  for (const c of customers.values()) {
    c.items.sort(newestFirst);
    c.open = c.items.filter(isOpenIssue).length;
    const said = Date.parse(show(c.props.last_contact));
    c.waiting = waitingSince(c.items);
    c.last = Math.max(c.items[0]?.at ?? 0, Number.isNaN(said) ? 0 : said);
  }
  return [...customers.values()];
}

/** How much a customer needs someone to look: health first, then open issues, then silence. */
export function attention(c: Customer): number {
  const health = { risk: 2, watch: 1, good: 0, none: 0 }[tone(show(c.props.health))];
  const quiet = Math.min(daysSince(c.last), 60);
  const unanswered = c.waiting ? 80 + Math.min(daysSince(c.waiting), 30) * 20 : 0;
  return health * 1000 + c.open * 50 + unanswered + quiet;
}

const QUIET = 14;
const SOON = 45;
/**
 * Why this customer needs someone, in words, most pressing first: open issues, a date coming up
 * (any detail the team typed as a date), and silence. Empty when nothing stands out.
 */
export function reasons(schema: Schema, props: Record<string, Cell>, open: number, last: number, waiting = 0): string[] {
  const out: string[] = [];
  if (waiting) out.push(daysSince(waiting) < 1 ? "Waiting on our reply" : `Waiting on our reply for ${daysSince(waiting)}d`);
  if (open > 0) out.push(`${open} open ${open === 1 ? "issue" : "issues"}`);
  for (const [key, value] of Object.entries(props)) {
    if (HIDDEN.has(key) || kindOf(schema, key, value) !== "date") continue;
    const days = Math.ceil((parseDay(show(value)) - Date.now()) / DAY);
    if (days >= 0 && days <= SOON) out.push(`${label(key)} in ${days}d`);
  }
  const quiet = daysSince(last);
  if (quiet >= QUIET) out.push(quiet === Infinity ? "No contact yet" : `Quiet for ${quiet}d`);
  return out;
}

/** Does this customer need someone now? At risk, or anything pressing while not marked good. */
export function needsAttention(schema: Schema, c: Customer): boolean {
  const health = tone(show(c.props.health));
  return health === "risk" || (health !== "good" && reasons(schema, c.props, c.open, c.last, c.waiting).length > 0) || daysSince(c.last) >= QUIET;
}

/** What an item says: its note's own text, without the properties block. Empty when it has none. */
export async function readBody(path: string): Promise<string> {
  const note = await runCore<{ text: string }>("note.read", { path });
  return note.text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

/** Someone at a customer: a note marked `type: person` whose `customer` names the customer. */
export interface Person {
  path: string;
  name: string;
  props: Record<string, Cell>;
  /** Open issues they raised. */
  asks: number;
  /** A conversation is waiting on us and they spoke last. */
  waiting: boolean;
  /** When they were last heard from, in milliseconds; 0 when never. */
  last: number;
}

/**
 * Did this person say or raise this? A person is the same person whether a tool knows them by
 * name, email or Slack name; `also` lists any other names they go by.
 */
export function isFrom(item: Item, name: string, props: Record<string, Cell>): boolean {
  const who = item.from.trim().toLowerCase();
  if (!who) return false;
  return [name, show(props.email), show(props.slack), ...list(props.also)].some((known) => known.trim().toLowerCase() === who);
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The people at one customer, the ones with something waiting first. */
export async function loadPeople(customer: string, items: Item[]): Promise<Person[]> {
  const rows = await runCore<Row[]>("props.rows", { folder: "", deep: true });
  const waiting = threads(items).filter((t) => t.waiting);
  return rows
    .filter((r) => show(r.props.type) === "person" && sameName(show(r.props.customer), customer))
    .map((r) => {
      const name = stem(r.path);
      const theirs = items.filter((i) => isFrom(i, name, r.props));
      return {
        path: r.path,
        name,
        props: r.props,
        asks: theirs.filter(isOpenIssue).length,
        waiting: waiting.some((t) => isFrom(t.messages[t.messages.length - 1], name, r.props)),
        last: theirs[0]?.at ?? 0,
      };
    })
    .sort((a, b) => Number(b.waiting) - Number(a.waiting) || b.asks - a.asks || b.last - a.last);
}

/**
 * Everything one person said or raised, plus the whole of any conversation they took part in,
 * and the note of the customer they belong to.
 */
export async function loadPersonItems(name: string, props: Record<string, Cell>): Promise<{ items: Item[]; customer: string | null }> {
  const rows = await runCore<Row[]>("props.rows", { folder: "", deep: true });
  const home = rows.find((r) => show(r.props.type) === "customer" && sameName(stem(r.path), show(props.customer)));
  if (!home) return { items: [], customer: null };
  const folder = `${home.path.replace(/\.md$/i, "")}/`;
  const all = rows.filter((r) => r.path.startsWith(folder)).map(toItem);
  const joined = new Set(all.filter((i) => i.thread && isFrom(i, name, props)).map((i) => i.thread));
  const items = all.filter((i) => isFrom(i, name, props) || (i.thread && joined.has(i.thread))).sort(newestFirst);
  return { items, customer: home.path };
}
