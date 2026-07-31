import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Shortcuts from "./Shortcuts.jsx";

const actions = [
  { id: "save-file", name: "Save file" },
  { id: "open-graph", name: "Open graph" },
];
const keymap = { "save-file": "CommandOrControl+S", "open-graph": null };

function setup(overrides = {}) {
  const props = {
    actions,
    keymap,
    query: "",
    onQueryChange: vi.fn(),
    editing: null,
    onBeginEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onKeyCapture: vi.fn(),
    onResetAll: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<Shortcuts {...props} />) };
}

describe("Shortcuts preferences", () => {
  it("renders a keycap per accelerator part and marks unbound actions", () => {
    setup();
    expect(screen.getByText("S").tagName).toBe("KBD");
    expect(screen.getByText("Not set")).toBeTruthy();
  });

  it("makes the whole row the rebind affordance", () => {
    const { props } = setup();
    fireEvent.click(screen.getByText("Save file"));
    expect(props.onBeginEdit).toHaveBeenCalledWith("save-file");
  });

  it("captures keys while editing and cancels on blur", () => {
    const { props } = setup({ editing: "save-file" });
    const capture = screen.getByLabelText("New shortcut for Save file");
    fireEvent.keyDown(capture, { key: "j" });
    expect(props.onKeyCapture).toHaveBeenCalled();
    fireEvent.blur(capture);
    expect(props.onCancelEdit).toHaveBeenCalled();
  });

  it("filters by the search query", () => {
    setup({ query: "graph" });
    expect(screen.queryByText("Save file")).toBeNull();
    expect(screen.getByText("Open graph")).toBeTruthy();
  });

  it("invites a shorter search when nothing matches", () => {
    setup({ query: "zzz" });
    expect(screen.getByText(/Try a shorter word/)).toBeTruthy();
  });
});
