/** @part-of ui.plugins */
import { pluginUrl } from "../../bridge/core";

/** One plugin view: the plugin's own page in a sandboxed frame. */
export function PluginView({ plugin, page }: { plugin: string; page: string }) {
  return <iframe key={`${plugin}/${page}`} className="plugin-view" sandbox="allow-scripts" data-plugin={plugin} src={pluginUrl(plugin, page)} title={plugin} />;
}
