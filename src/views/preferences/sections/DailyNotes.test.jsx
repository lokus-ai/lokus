import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DailyNotes from "./DailyNotes.jsx";

vi.mock("../../../platform/index.js", async (importOriginal) => ({
  ...(await importOriginal()),
  isDesktop: () => true,
}));

const settings = {
  format: "yyyy-MM-dd",
  folder: "Daily Notes",
  template: "# {{date}}",
  openOnStartup: false,
};

describe("DailyNotes preferences", () => {
  it("previews the filename today's note will get", () => {
    render(<DailyNotes settings={settings} onChange={() => {}} onSave={() => {}} />);
    expect(screen.getByText(/^\d{4}-\d{2}-\d{2}\.md$/)).toBeTruthy();
  });

  it("falls back to the default format when the pattern is invalid", () => {
    render(
      <DailyNotes settings={{ ...settings, format: "yyyy-MM-DD" }} onChange={() => {}} onSave={() => {}} />
    );
    expect(screen.getByText(/^\d{4}-\d{2}-\d{2}\.md$/)).toBeTruthy();
  });

  it("saves text fields on blur", () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    render(<DailyNotes settings={settings} onChange={onChange} onSave={onSave} />);
    const field = screen.getByDisplayValue("Daily Notes");
    fireEvent.change(field, { target: { value: "Journal" } });
    expect(onChange).toHaveBeenCalledWith({ folder: "Journal" });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.blur(field);
    expect(onSave).toHaveBeenCalled();
  });

  it("saves the startup toggle immediately", () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    render(<DailyNotes settings={settings} onChange={onChange} onSave={onSave} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith({ openOnStartup: true });
    expect(onSave).toHaveBeenCalled();
  });
});
