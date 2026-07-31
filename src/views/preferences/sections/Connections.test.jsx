import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Connections from "./Connections.jsx";

vi.mock("../../../components/Calendar/index.js", () => ({
  CalendarSettings: () => <div data-testid="calendar-settings" />,
}));

const calendarService = vi.hoisted(() => ({
  ical: { addSubscription: vi.fn(), syncSubscription: vi.fn(), removeSubscription: vi.fn() },
  caldav: { connect: vi.fn(), disconnect: vi.fn(), refreshCalendars: vi.fn() },
}));
vi.mock("../../../services/calendar.js", () => ({ default: calendarService }));

function baseProps(overrides = {}) {
  return {
    icalSubscriptions: [],
    setIcalSubscriptions: vi.fn(),
    icalUrl: "",
    setIcalUrl: vi.fn(),
    icalLoading: false,
    setIcalLoading: vi.fn(),
    caldavAccount: null,
    setCaldavAccount: vi.fn(),
    caldavCalendars: [],
    setCaldavCalendars: vi.fn(),
    caldavForm: { serverUrl: "https://caldav.icloud.com", username: "", password: "" },
    setCaldavForm: vi.fn(),
    caldavLoading: false,
    setCaldavLoading: vi.fn(),
    ...overrides,
  };
}

describe("Connections preferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invites a first subscription when there are none", () => {
    render(<Connections {...baseProps()} />);
    expect(screen.getByText(/Paste a calendar address/)).toBeTruthy();
  });

  it("lists subscriptions with their feed colour and last sync", () => {
    render(
      <Connections
        {...baseProps({
          icalSubscriptions: [{ id: "1", name: "Team", color: "#5856D6", last_synced: "2026-01-02T00:00:00Z" }],
        })}
      />
    );
    expect(screen.getByText("Team")).toBeTruthy();
    expect(screen.getByText("Sync")).toBeTruthy();
  });

  it("reports an add failure inline instead of alerting", async () => {
    calendarService.ical.addSubscription.mockRejectedValueOnce(new Error("Not a calendar"));
    const props = baseProps({ icalUrl: "https://example.com/x.ics" });
    render(<Connections {...props} />);
    fireEvent.click(screen.getByText("Follow"));
    await waitFor(() => expect(screen.getByText("Not a calendar")).toBeTruthy());
    expect(props.setIcalLoading).toHaveBeenCalledWith(false);
  });

  it("never renders the CalDAV password in the clear", () => {
    render(<Connections {...baseProps({ caldavForm: { serverUrl: "s", username: "a@icloud.com", password: "secret" } })} />);
    const field = screen.getByDisplayValue("secret");
    expect(field.type).toBe("password");
  });

  it("shows the connected account and its calendars", () => {
    render(
      <Connections
        {...baseProps({
          caldavAccount: { username: "a@icloud.com", display_name: "Ada" },
          caldavCalendars: [{ id: "c1", name: "Home", is_primary: true }],
        })}
      />
    );
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByText("a@icloud.com")).toBeTruthy();
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Primary")).toBeTruthy();
    expect(screen.queryByPlaceholderText("xxxx-xxxx-xxxx-xxxx")).toBeNull();
  });

  it("confirms before removing a subscription", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Connections {...baseProps({ icalSubscriptions: [{ id: "1", name: "Team" }] })} />);
    fireEvent.click(screen.getByText("Remove"));
    expect(confirmSpy).toHaveBeenCalled();
    expect(calendarService.ical.removeSubscription).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
