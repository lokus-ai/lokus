/** @part-of ui.tasks */
import { runCore } from "../../bridge/core";
import { app, hasUnsaved, save } from "../../shell/workspace";

/** One piece of work: a note in the tasks folder marked `type: task`. */
export interface Task {
  path: string;
  root: string;
  expected: Record<TaskField, unknown>;
  /** Its short name for people and the assistant: T-12. */
  key: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  assignee: string;
  customer: string;
  due: string;
  labels: string[];
}

export const TASKS_FOLDER = "tasks";
/** Where a task can stand, in board order. A status a team invents shows up after these. */
export const STATUSES = ["backlog", "todo", "doing", "review", "done"];
export const PRIORITIES = ["urgent", "high", "medium", "low"];
const NAMES: Record<string, string> = { backlog: "Backlog", todo: "To do", doing: "In progress", review: "In review", done: "Done" };

export const statusName = (status: string) => NAMES[status] ?? (status ? status.replace(/^./, (c) => c.toUpperCase()) : "No status");
export const isDone = (task: Task) => ["done", "closed", "cancelled", "canceled"].includes(task.status);

interface Row {
  path: string;
  props: Record<string, unknown>;
}

const word = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value) : "");

/** Every task, the most pressing first within whatever order the caller groups them in. */
export async function loadTasks(): Promise<Task[]> {
  const root = app.get().vault?.root;
  if (!root) return [];
  const rows = await runCore<Row[]>("props.rows", { folder: TASKS_FOLDER }, root);
  return rows
    .filter((r) => r.props.type === "task")
    .map((r) => {
      const number = typeof r.props.number === "number" ? r.props.number : 0;
      return {
        path: r.path,
        root,
        expected: { status: r.props.status ?? null, priority: r.props.priority ?? null, assignee: r.props.assignee ?? null, due: r.props.due ?? null },
        number,
        key: `T-${number}`,
        title: r.path.split("/").pop()!.replace(/\.md$/i, ""),
        status: word(r.props.status).toLowerCase(),
        priority: word(r.props.priority).toLowerCase(),
        assignee: word(r.props.assignee),
        customer: word(r.props.customer),
        due: word(r.props.due),
        labels: Array.isArray(r.props.labels) ? r.props.labels.map(String) : [],
      };
    })
    .sort((a, b) => weight(a.priority) - weight(b.priority) || a.number - b.number);
}

const weight = (priority: string) => {
  const at = PRIORITIES.indexOf(priority);
  return at < 0 ? PRIORITIES.length : at;
};

/** Add a task, or change one named by its key. Resolves to where its note is. */
export async function recordTask(task: Partial<Omit<Task, "path" | "root" | "expected" | "number" | "labels">> & { labels?: string[]; text?: string }): Promise<string> {
  const made = await runCore<{ path: string }>("tasks.record", { task }, app.get().vault?.root);
  return made.path;
}

export type TaskField = "status" | "priority" | "assignee" | "due";

export async function editTask(task: Task, field: TaskField, value: string | null): Promise<void> {
  const root = task.root;
  if (app.get().vault?.root !== root) throw new Error("Open the task's workspace before editing it.");
  if (app.get().sync.role === "viewer") throw new Error("Only editors can change shared tasks.");
  await save(task.path);
  if (hasUnsaved(task.path)) throw new Error("Save the task's open tab before changing it here.");
  if (app.get().sync.role === "viewer") throw new Error("Only editors can change shared tasks.");
  await runCore("tasks.record", { task: { path: task.path, [field]: value, expected: { [field]: task.expected[field] } } }, root);
}

/** New boards write JSON arrays, which are also valid YAML flow sequences. */
export function columnOrder(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
  } catch { /* Older boards may use a plain comma-separated order. */ }
  const items = value.replace(/^\[|\]$/g, "").match(/\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^,]*)\s*(?:,|$)/g) ?? [];
  return items.map((raw) => {
    const s = raw.replace(/,$/, "").trim();
    if (s.startsWith('"')) try { return String(JSON.parse(s)); } catch { /* Keep the text as written. */ }
    return /^'.*'$/.test(s) ? s.slice(1, -1).replaceAll("''", "'") : s;
  }).filter(Boolean);
}

/** The columns a board shows: the usual ones, then any other status the tasks use. */
export function columnsOf(tasks: Task[], order: string[] = []): string[] {
  return [...new Set([...STATUSES, ...order, ...tasks.map((t) => t.status)].filter(Boolean))];
}

/** "Dec 1", and whether it has passed. */
export function dueText(due: string): { text: string; late: boolean } | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
  if (!day) return null;
  const at = new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
  return { text: at.toLocaleDateString(undefined, { month: "short", day: "numeric" }), late: at.getTime() < new Date().setHours(0, 0, 0, 0) };
}

/**
 * Who a task can be given to: everyone already named as an assignee or as a customer's owner,
 * and the person signed in. Names only; a new one can always be typed.
 */
export async function loadAssignees(me?: string | null): Promise<string[]> {
  const rows = await runCore<Row[]>("props.rows", { folder: "", deep: true }).catch(() => [] as Row[]);
  const names = new Set<string>();
  for (const row of rows) {
    if (row.props.type === "task") names.add(word(row.props.assignee));
    if (row.props.type === "customer") names.add(word(row.props.owner));
  }
  if (me) names.add(me);
  names.delete("");
  return [...names].sort((a, b) => a.localeCompare(b));
}
