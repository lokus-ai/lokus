/** @part-of ui.tasks */
import { runCore } from "../../bridge/core";

/** One piece of work: a note in the tasks folder marked `type: task`. */
export interface Task {
  path: string;
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
  const rows = await runCore<Row[]>("props.rows", { folder: TASKS_FOLDER });
  return rows
    .filter((r) => r.props.type === "task")
    .map((r) => {
      const number = typeof r.props.number === "number" ? r.props.number : 0;
      return {
        path: r.path,
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
export async function recordTask(task: Partial<Omit<Task, "path" | "number" | "labels">> & { labels?: string[]; text?: string }): Promise<string> {
  const made = await runCore<{ path: string }>("tasks.record", { task });
  return made.path;
}

/** The columns a board shows: the usual ones, then any other status the tasks use. */
export function columnsOf(tasks: Task[]): string[] {
  const others = [...new Set(tasks.map((t) => t.status).filter((s) => s && !STATUSES.includes(s)))];
  return [...STATUSES, ...others];
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
