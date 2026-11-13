# Writing a plugin

A plugin is a folder with a `manifest.json` and some JavaScript. It runs in a sandbox: it cannot
see the app's window, files or network. It can only ask the app to do things, and the app checks
each request against the permissions in the manifest.

`examples/plugins/word-count` is a complete plugin that uses everything below.

## Try one

```sh
lokus plugins.install --vault ~/notes from=examples/plugins/word-count
lokus plugins.enable  --vault ~/notes id=word-count
```

Or in the app: Settings, Plugins, "Install from a folder…", then switch it on. After changing a
plugin's files, install it again and run "Plugins: reload" from the command palette.

## The manifest

```json
{
  "id": "word-count",
  "name": "Word Count",
  "version": "1.0.0",
  "description": "Counts the words in the open note.",
  "apiVersion": 1,
  "main": "main.js",
  "permissions": ["vault:read", "editor"],
  "contributes": {
    "commands": [{ "id": "word-count.count", "title": "Word Count: count this note", "keys": "Mod-Shift-c" }],
    "views": [{ "id": "stats", "title": "Word Count", "page": "panel.html" }],
    "settings": [{ "key": "unit", "title": "Count", "type": "select", "options": ["words", "characters"], "default": "words" }],
    "snippets": [{ "label": "Callout", "detail": "> [!note]", "insert": "> [!note] §" }],
    "mcpServers": [{ "name": "search", "url": "https://example.com/mcp" }]
  },
  "activation": ["onStartup"]
}
```

- `id`: lowercase letters, digits and dashes. Command ids must start with `<id>.`.
- `activation`: leave it out and the plugin loads when one of its commands or views is first
  used. `onStartup` loads it with the app.

| Permission | Lets the plugin |
|---|---|
| `vault:read` | Run commands that read notes (`note.read`, `search.query`, `vault.notes`, …), open a note, and hear about note changes |
| `vault:write` | Run commands that change notes (`note.write`, `note.create`, `props.set`, …) |
| `editor` | Read and type in the open note (`editor.state`, `editor.type`, `editor.toggleBold`, …) |
| `net:<host>` | Call `https://<host>` with `fetch`. Every other address is blocked |

`lokus commands.list` prints every core command with what it reads or writes.

## The API

`main.js` runs in a hidden page. The app loads the API for it first, as a global named `lokus`.

```js
// Code for a command declared in the manifest. The return value goes back to the caller.
lokus.commands.handle("word-count.count", async () => {
  const { text } = await lokus.run("editor.state");
  const words = (text.match(/\S+/g) ?? []).length;
  await lokus.notify(`${words} words`);
  return { words };
});
```

| Call | Does |
|---|---|
| `lokus.run(name, args)` | Runs an app command and returns its result. Refused with `code: "forbidden"` without the permission |
| `lokus.notify(text)` | Shows a short message |
| `lokus.commands.handle(id, fn)` | Supplies the code for one of the plugin's commands |
| `lokus.on(event, fn)` | `"active-note"` (`{ path }`), `"vault-changed"`, `"settings-changed"` |
| `lokus.settings.get()` | The plugin's settings, with defaults filled in |
| `lokus.storage.get()` / `.set(value)` | One JSON value (up to 1 MB) kept for the plugin in this vault |
| `lokus.views.open(id)` | Opens one of the plugin's views in the side panel |

## Views

A view is an HTML file from the plugin folder, shown in the side panel. Load the API yourself:

```html
<script src="__lokus.js"></script>
<script src="panel.js"></script>
```

Pages cannot contain inline scripts; put code in files. Styles may be inline.

## What a plugin cannot do

Read or write files directly, reach the app's window or storage, call a network host it did not
declare, manage other plugins, switch vaults, or touch sync and the assistant's keys.
`checks/flows/plugins.sh` installs a plugin that tries all of these and confirms each is refused.
