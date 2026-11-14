/** @part-of ui.connections */
import {
  siAsana,
  siAtlassian,
  siGithub,
  siGmail,
  siGooglecalendar,
  siGoogledrive,
  siHubspot,
  siImessage,
  siIntercom,
  siLinear,
  siNotion,
  siSentry,
  siStripe,
  siZapier,
} from "simple-icons";

import granola from "./marks/granola.png";
import slack from "./marks/slack.png";

/** Services whose mark is a picture: their own app icon, used whole. */
const PICTURES: Record<string, string> = { slack, granola };

/** Each service's own mark, by connector id. One without a mark here shows its first letter. */
const MARKS: Record<string, { path: string; hex: string }> = {
  linear: siLinear,
  notion: siNotion,
  sentry: siSentry,
  atlassian: siAtlassian,
  stripe: siStripe,
  intercom: siIntercom,
  zapier: siZapier,
  github: siGithub,
  gmail: siGmail,
  "google-calendar": siGooglecalendar,
  "google-drive": siGoogledrive,
  asana: siAsana,
  hubspot: siHubspot,
  imessage: siImessage,
};

/** Marks so pale they vanish on the white tile are drawn dark instead. */
const TOO_PALE = new Set(["6AFDEF"]);

/** A service's mark on a white tile, the way it looks in that service's own app icon. */
export function Logo({ id, name, size = 32 }: { id: string; name: string; size?: number }) {
  const mark = MARKS[id];
  if (PICTURES[id]) return <img className={`conn-logo picture ${id}`} src={PICTURES[id]} alt="" style={{ width: size, height: size }} />;
  return (
    <span className="conn-logo" style={{ width: size, height: size }}>
      {mark ? (
        <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} aria-hidden>
          <path d={mark.path} fill={TOO_PALE.has(mark.hex) ? "#1f1f1f" : `#${mark.hex}`} />
        </svg>
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
