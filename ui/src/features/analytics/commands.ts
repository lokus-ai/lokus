/** @part-of ui.analytics */
import { analyticsEnabled, setAnalyticsEnabled } from "../../bridge/analytics";
import type { Command } from "../../shell/commands";

export function analyticsCommands(notify: (message: string) => void): Command[] {
  return [
    {
      id: "analytics.toggle",
      title: "Usage analytics: turn on or off",
      run() {
        const on = !analyticsEnabled();
        setAnalyticsEnabled(on);
        notify(on ? "Usage analytics on. Note contents are never sent." : "Usage analytics off.");
        return { enabled: on };
      },
    },
  ];
}
