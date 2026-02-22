/**
 * MeetingTimer — formats a raw seconds count as MM:SS.
 *
 * Props:
 *   duration  number  Elapsed seconds since recording started
 */
export default function MeetingTimer({ duration = 0 }) {
  const minutes = Math.floor(duration / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (duration % 60).toString().padStart(2, '0');

  return (
    <span className="font-mono text-sm tabular-nums text-app-text">
      {minutes}:{seconds}
    </span>
  );
}
