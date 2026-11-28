/** @part-of ui.calendar */
import { Icon, type IconName } from "../../shell/Icon";
import { pickMenu } from "./menu";

interface Props {
  value: string;
  /** What is shown for the chosen one: cut with an ellipsis when there is no room, never clipped. */
  label: string;
  title: string;
  options: ([value: string, name: string] | null)[];
  onChange: (value: string) => void;
  disabled?: boolean;
  icon?: IconName;
  /** Drawn as a button with an outline, as in the bar; otherwise as plain text in a row. */
  outlined?: boolean;
  /** No tick beside a choice: the menu is a list of things to do. */
  actions?: boolean;
  /** A colour dot before a choice, by its value; the menu is then as wide as the panel around the button. */
  swatches?: Record<string, string>;
}

/** A choice from a list: a button that opens the app's menu. */
export function Pick({ value, label, title, options, onChange, disabled, icon, outlined, actions, swatches }: Props) {
  return (
    <button
      type="button"
      className={`cal-pick${outlined ? " outlined" : ""}`}
      title={title}
      aria-label={`${title}: ${label}`}
      aria-haspopup="menu"
      disabled={disabled}
      onClick={(e) => pickMenu(e.currentTarget, title, options, actions ? null : value, onChange, swatches && { swatches, fill: e.currentTarget.closest<HTMLElement>(".cal-panel") })}
    >
      {icon && <Icon name={icon} size={14} />}
      <span>{label}</span>
      {outlined && <Icon name="down" size={12} />}
    </button>
  );
}
