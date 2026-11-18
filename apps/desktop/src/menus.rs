//! @part-of desktop
//! Native presentation of the window's registered commands, not another command registry.

use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

#[derive(Clone, Serialize)]
pub struct Item {
    id: &'static str,
    scope: &'static str,
    #[serde(skip)]
    title: &'static str,
    #[serde(skip)]
    keys: Option<&'static str>,
}

const fn item(
    id: &'static str,
    scope: &'static str,
    title: &'static str,
    keys: Option<&'static str>,
) -> Item {
    Item {
        id,
        scope,
        title,
        keys,
    }
}

const SETTINGS: Item = item("settings.open", "app", "Settings…", Some("CmdOrCtrl+,"));
const FILE: &[Item] = &[
    item("note.new", "workspace", "New Note", Some("CmdOrCtrl+N")),
    item(
        "note.daily",
        "workspace",
        "Open Today's Note",
        Some("CmdOrCtrl+Shift+D"),
    ),
    item(
        "note.fromTemplate",
        "workspace",
        "New Note from Template…",
        None,
    ),
    item("window.new", "app", "New Window", Some("CmdOrCtrl+Shift+N")),
    item("vault.choose", "app", "Open Vault…", None),
    item("note.save", "note", "Save", Some("CmdOrCtrl+S")),
];
const CLOSE: Item = item("note.close", "app", "Close Tab", Some("CmdOrCtrl+W"));
const EDIT: &[Item] = &[item(
    "search.open",
    "workspace",
    "Search in All Notes…",
    Some("CmdOrCtrl+Shift+F"),
)];
const FORMAT: &[Item] = &[
    item("editor.toggleBold", "editor", "Bold", Some("CmdOrCtrl+B")),
    item(
        "editor.toggleItalic",
        "editor",
        "Italic",
        Some("CmdOrCtrl+I"),
    ),
    item(
        "editor.toggleCode",
        "editor",
        "Inline Code",
        Some("CmdOrCtrl+E"),
    ),
    item(
        "editor.toggleStrikethrough",
        "editor",
        "Strikethrough",
        Some("CmdOrCtrl+Shift+X"),
    ),
    item(
        "editor.toggleHighlight",
        "editor",
        "Highlight",
        Some("CmdOrCtrl+Shift+H"),
    ),
    item(
        "editor.insertLink",
        "editor",
        "Insert Link…",
        Some("CmdOrCtrl+K"),
    ),
    item("editor.heading1", "editor", "Heading 1", None),
    item("editor.heading2", "editor", "Heading 2", None),
    item("editor.heading3", "editor", "Heading 3", None),
    item("editor.paragraph", "editor", "Normal Text", None),
];
const VIEW: &[Item] = &[
    item(
        "palette.commands",
        "workspace",
        "Command Palette…",
        Some("CmdOrCtrl+Shift+P"),
    ),
    item(
        "palette.notes",
        "workspace",
        "Go to Note…",
        Some("CmdOrCtrl+O"),
    ),
    item(
        "note.headings",
        "note",
        "Go to Heading…",
        Some("CmdOrCtrl+Shift+O"),
    ),
    item(
        "sidebar.toggle",
        "workspace",
        "Show or Hide Sidebar",
        Some("CmdOrCtrl+Backslash"),
    ),
    item(
        "ai.open",
        "workspace",
        "Show or Hide Assistant",
        Some("CmdOrCtrl+J"),
    ),
    item(
        "graph.toggle",
        "workspace",
        "Show or Hide Graph",
        Some("CmdOrCtrl+G"),
    ),
];
const WINDOW: &[Item] = &[
    item("tab.next", "tabs", "Next Tab", Some("Ctrl+Tab")),
    item(
        "tab.previous",
        "tabs",
        "Previous Tab",
        Some("Ctrl+Shift+Tab"),
    ),
];

#[tauri::command]
pub fn menu_commands() -> Vec<Item> {
    [
        std::slice::from_ref(&SETTINGS),
        std::slice::from_ref(&CLOSE),
        FILE,
        EDIT,
        FORMAT,
        VIEW,
        WINDOW,
    ]
    .concat()
}

#[derive(Default)]
pub struct State(Mutex<HashMap<String, HashSet<String>>>);

#[tauri::command]
pub fn menu_enabled(window: WebviewWindow, enabled: Vec<String>, state: tauri::State<'_, State>) {
    if let Ok(mut windows) = state.0.lock() {
        windows.insert(window.label().to_owned(), enabled.into_iter().collect());
    }
    if window.is_focused().unwrap_or(false) {
        refresh(window.app_handle(), window.label());
    }
}

pub fn refresh(app: &AppHandle, label: &str) {
    let Some(menu) = app.menu() else { return };
    let state = app.state::<State>();
    let enabled = state
        .0
        .lock()
        .ok()
        .and_then(|windows| windows.get(label).cloned())
        .unwrap_or_default();
    for group in menu.items().unwrap_or_default() {
        if let tauri::menu::MenuItemKind::Submenu(group) = group {
            for item in menu_commands() {
                if let Some(tauri::menu::MenuItemKind::MenuItem(native)) = group.get(item.id) {
                    let _ = native.set_enabled(enabled.contains(item.id));
                }
            }
        }
    }
}

pub fn on_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    match event {
        tauri::WindowEvent::Focused(true) => refresh(window.app_handle(), window.label()),
        tauri::WindowEvent::Destroyed => {
            if let Ok(mut windows) = window.state::<State>().0.lock() {
                windows.remove(window.label());
            }
        }
        _ => {}
    }
}

pub fn on_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    let id = event.id().as_ref();
    match id {
        "close-window" => crate::windows::close_front(app),
        "quit" => crate::background::quit_or_put_away(app),
        _ if menu_commands().iter().any(|item| item.id == id) => {
            if let Some(front) = crate::windows::focused(app) {
                let _ = app.emit_to(front.label(), "menu:command", id);
            }
        }
        _ => {}
    }
}

pub fn build(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
    let native = |item: &Item| {
        let mut builder = MenuItemBuilder::with_id(item.id, item.title).enabled(false);
        if let Some(keys) = item.keys {
            builder = builder.accelerator(keys);
        }
        builder.build(app)
    };
    let settings = native(&SETTINGS)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit Lokus")
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;
    let mut menu = MenuBuilder::new(app);
    #[cfg(target_os = "macos")]
    {
        let app_menu = SubmenuBuilder::new(app, "Lokus")
            .about(None)
            .separator()
            .item(&settings)
            .separator()
            .services()
            .separator()
            .hide()
            .hide_others()
            .show_all()
            .separator()
            .item(&quit)
            .build()?;
        menu = menu.item(&app_menu);
    }
    let mut file = SubmenuBuilder::new(app, "File");
    for item in FILE {
        if matches!(item.id, "vault.choose" | "note.save") {
            file = file.separator();
        }
        file = file.item(&native(item)?);
    }
    // The system Close Window also owns Cmd+W; only our tab command may own it.
    let close_tab = native(&CLOSE)?;
    let close_window = MenuItemBuilder::with_id("close-window", "Close Window")
        .accelerator("CmdOrCtrl+Shift+W")
        .build(app)?;
    file = file.separator().item(&close_tab).item(&close_window);
    #[cfg(not(target_os = "macos"))]
    {
        file = file.separator().item(&quit);
    }
    let mut edit = SubmenuBuilder::new(app, "Edit");
    #[cfg(target_os = "macos")]
    {
        edit = edit.undo().redo().separator();
    }
    edit = edit.cut().copy().paste().select_all().separator();
    for item in EDIT {
        edit = edit.item(&native(item)?);
    }
    #[cfg(not(target_os = "macos"))]
    {
        edit = edit.separator().item(&settings);
    }
    let mut format = SubmenuBuilder::new(app, "Format");
    for item in FORMAT {
        if item.id == "editor.heading1" {
            format = format.separator();
        }
        format = format.item(&native(item)?);
    }
    let mut view = SubmenuBuilder::new(app, "View");
    for item in VIEW {
        if item.id == "sidebar.toggle" {
            view = view.separator();
        }
        view = view.item(&native(item)?);
    }
    let mut window = SubmenuBuilder::new(app, "Window");
    #[cfg(not(target_os = "linux"))]
    {
        window = window.minimize().maximize();
    }
    #[cfg(target_os = "macos")]
    {
        window = window.fullscreen();
    }
    #[cfg(not(target_os = "linux"))]
    {
        window = window.separator();
    }
    for item in WINDOW {
        window = window.item(&native(item)?);
    }
    menu = menu.items(&[
        &file.build()?,
        &edit.build()?,
        &format.build()?,
        &view.build()?,
        &window.build()?,
    ]);
    #[cfg(not(target_os = "macos"))]
    {
        menu = menu.item(&SubmenuBuilder::new(app, "Help").about(None).build()?);
    }
    menu.build()
}
