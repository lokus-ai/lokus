use tauri::{
  AppHandle,
  menu::{MenuBuilder, SubmenuBuilder, PredefinedMenuItem, MenuItemBuilder, CheckMenuItemBuilder},
  Emitter,
};

// Menu item IDs
pub const PREFERENCES_ID: &str = "preferences";
pub const ABOUT_ID: &str = "about";

// File menu IDs
const FILE_NEW_NOTE_ID: &str = "file-new-note";
const FILE_NEW_FOLDER_ID: &str = "file-new-folder";
const FILE_NEW_CANVAS_ID: &str = "file-new-canvas";
const FILE_OPEN_ID: &str = "file-open";
const FILE_OPEN_WORKSPACE_ID: &str = "file-open-workspace";
const FILE_CLOSE_TAB_ID: &str = "file-close-tab";
const FILE_CLOSE_WINDOW_ID: &str = "file-close-window";
const FILE_SAVE_ID: &str = "file-save";
const FILE_SAVE_AS_ID: &str = "file-save-as";
const FILE_EXPORT_PDF_ID: &str = "file-export-pdf";
const FILE_EXPORT_HTML_ID: &str = "file-export-html";
const FILE_PRINT_ID: &str = "file-print";

// Edit menu IDs
const EDIT_FIND_ID: &str = "edit-find";
const EDIT_FIND_REPLACE_ID: &str = "edit-find-replace";
const EDIT_FIND_NEXT_ID: &str = "edit-find-next";
const EDIT_FIND_PREVIOUS_ID: &str = "edit-find-previous";
const EDIT_PASTE_MATCH_STYLE_ID: &str = "edit-paste-match-style";

// View menu IDs
const VIEW_TOGGLE_SIDEBAR_ID: &str = "view-toggle-sidebar";
const VIEW_TOGGLE_SPLIT_ID: &str = "view-toggle-split";
const VIEW_FULL_SCREEN_ID: &str = "view-full-screen";
const VIEW_ACTUAL_SIZE_ID: &str = "view-actual-size";
const VIEW_ZOOM_IN_ID: &str = "view-zoom-in";
const VIEW_ZOOM_OUT_ID: &str = "view-zoom-out";
const VIEW_GRAPH_ID: &str = "view-graph";
const VIEW_KANBAN_ID: &str = "view-kanban";
const VIEW_COMMAND_PALETTE_ID: &str = "view-command-palette";
const VIEW_THEME_LIGHT_ID: &str = "view-theme-light";
const VIEW_THEME_DARK_ID: &str = "view-theme-dark";
const VIEW_THEME_AUTO_ID: &str = "view-theme-auto";

// Insert menu IDs
const INSERT_WIKILINK_ID: &str = "insert-wikilink";
const INSERT_MATH_ID: &str = "insert-math";
const INSERT_TABLE_ID: &str = "insert-table";
const INSERT_IMAGE_ID: &str = "insert-image";
const INSERT_CODE_BLOCK_ID: &str = "insert-code-block";
const INSERT_HORIZONTAL_RULE_ID: &str = "insert-horizontal-rule";
const INSERT_TASK_LIST_ID: &str = "insert-task-list";
const INSERT_H1_ID: &str = "insert-h1";
const INSERT_H2_ID: &str = "insert-h2";
const INSERT_H3_ID: &str = "insert-h3";

// Format menu IDs
const FORMAT_BOLD_ID: &str = "format-bold";
const FORMAT_ITALIC_ID: &str = "format-italic";
const FORMAT_UNDERLINE_ID: &str = "format-underline";
const FORMAT_STRIKETHROUGH_ID: &str = "format-strikethrough";
const FORMAT_CODE_ID: &str = "format-code";
const FORMAT_HIGHLIGHT_ID: &str = "format-highlight";
const FORMAT_CLEAR_ID: &str = "format-clear";

// Window menu IDs
const WINDOW_MINIMIZE_ID: &str = "window-minimize";
const WINDOW_ZOOM_ID: &str = "window-zoom";
const WINDOW_PREV_TAB_ID: &str = "window-prev-tab";
const WINDOW_NEXT_TAB_ID: &str = "window-next-tab";

// Help menu IDs
const HELP_HELP_ID: &str = "help-help";
const HELP_SHORTCUTS_ID: &str = "help-shortcuts";
const HELP_RELEASE_NOTES_ID: &str = "help-release-notes";
const HELP_REPORT_ISSUE_ID: &str = "help-report-issue";

pub fn init(app: &AppHandle) -> tauri::Result<()> {
  // Platform-specific app menu
  #[cfg(target_os = "macos")]
  let app_menu = {
    SubmenuBuilder::new(app, "Lokus")
      .item(&MenuItemBuilder::with_id(ABOUT_ID, "About Lokus")
        .build(app)?)
      .separator()
      .item(&MenuItemBuilder::with_id(PREFERENCES_ID, "Preferences…")
        .accelerator("CmdOrCtrl+,")
        .build(app)?)
      .separator()
      .services()
      .separator()
      .hide()
      .hide_others()
      .show_all()
      .separator()
      .item(&PredefinedMenuItem::quit(app, None)?)
      .build()?
  };

  // Windows doesn't have an app menu like macOS
  #[cfg(not(target_os = "macos"))]
  let _app_menu = None::<tauri::menu::Submenu<tauri::Wry>>;

  // File menu
  let _file_menu = SubmenuBuilder::new(app, "File")
    .item(&MenuItemBuilder::with_id(FILE_NEW_NOTE_ID, "New Note")
      .accelerator("CmdOrCtrl+N")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(FILE_NEW_FOLDER_ID, "New Folder")
      .accelerator("CmdOrCtrl+Shift+N")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(FILE_NEW_CANVAS_ID, "New Canvas")
      .accelerator("CmdOrCtrl+Shift+C")
      .build(app)?)
    .separator()
    .item(&MenuItemBuilder::with_id(FILE_OPEN_ID, "Open…")
      .accelerator("CmdOrCtrl+O")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(FILE_OPEN_WORKSPACE_ID, "Open Workspace…")
      .accelerator("CmdOrCtrl+Shift+O")
      .build(app)?)
    // TODO: Add "Open Recent" submenu
    .separator()
    .item(&MenuItemBuilder::with_id(FILE_CLOSE_TAB_ID, "Close Tab")
      .accelerator("CmdOrCtrl+W")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(FILE_CLOSE_WINDOW_ID, "Close Window")
      .accelerator("CmdOrCtrl+Shift+W")
      .build(app)?)
    .separator()
    .item(&MenuItemBuilder::with_id(FILE_SAVE_ID, "Save")
      .accelerator("CmdOrCtrl+S")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(FILE_SAVE_AS_ID, "Save As…")
      .accelerator("CmdOrCtrl+Shift+S")
      .build(app)?)
    .separator()
    .item(&MenuItemBuilder::with_id(FILE_EXPORT_PDF_ID, "Export as PDF")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(FILE_EXPORT_HTML_ID, "Export as HTML")
      .build(app)?)
    .separator()
    .item(&MenuItemBuilder::with_id(FILE_PRINT_ID, "Print…")
      .accelerator("CmdOrCtrl+P")
      .build(app)?)
    .build()?;

  // Edit menu with comprehensive editing features
  let edit_menu = SubmenuBuilder::new(app, "Edit")
    .undo().redo()
    .separator()
    .cut().copy().paste()
    .item(&MenuItemBuilder::with_id(EDIT_PASTE_MATCH_STYLE_ID, "Paste and Match Style")
      .accelerator("CmdOrCtrl+Alt+Shift+V")
      .build(app)?)
    .separator()
    .item(&MenuItemBuilder::with_id("edit-delete", "Delete")
      .accelerator("Delete")
      .build(app)?)
    .select_all()
    .separator()
    .item(&MenuItemBuilder::with_id(EDIT_FIND_ID, "Find…")
      .accelerator("CmdOrCtrl+F")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(EDIT_FIND_REPLACE_ID, "Find and Replace…")
      .accelerator("CmdOrCtrl+Alt+F")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(EDIT_FIND_NEXT_ID, "Find Next")
      .accelerator("CmdOrCtrl+G")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(EDIT_FIND_PREVIOUS_ID, "Find Previous")
      .accelerator("CmdOrCtrl+Shift+G")
      .build(app)?)
    .build()?;

  // View menu
  let view_menu = SubmenuBuilder::new(app, "View")
    .item(&MenuItemBuilder::with_id(VIEW_TOGGLE_SIDEBAR_ID, "Toggle Sidebar")
      .accelerator("CmdOrCtrl+B")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(VIEW_TOGGLE_SPLIT_ID, "Toggle Split View")
      .accelerator("CmdOrCtrl+\\")
      .build(app)?)
    .separator()
    .item(&MenuItemBuilder::with_id(VIEW_FULL_SCREEN_ID, "Enter Full Screen")
      .accelerator("Ctrl+CmdOrCtrl+F")
      .build(app)?)
    .separator()
    .item(&MenuItemBuilder::with_id(VIEW_ACTUAL_SIZE_ID, "Actual Size")
      .accelerator("CmdOrCtrl+0")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(VIEW_ZOOM_IN_ID, "Zoom In")
      .accelerator("CmdOrCtrl+Plus")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(VIEW_ZOOM_OUT_ID, "Zoom Out")
      .accelerator("CmdOrCtrl+-")
      .build(app)?)
    .separator()
    .item(&MenuItemBuilder::with_id(VIEW_GRAPH_ID, "Show Graph View")
      .accelerator("CmdOrCtrl+Shift+G")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(VIEW_KANBAN_ID, "Show Kanban Board")
      .accelerator("CmdOrCtrl+Shift+K")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(VIEW_COMMAND_PALETTE_ID, "Show Command Palette")
      .accelerator("CmdOrCtrl+K")
      .build(app)?)
    .separator()
    .item(&CheckMenuItemBuilder::with_id(VIEW_THEME_LIGHT_ID, "Light Theme")
      .build(app)?)
    .item(&CheckMenuItemBuilder::with_id(VIEW_THEME_DARK_ID, "Dark Theme")
      .build(app)?)
    .item(&CheckMenuItemBuilder::with_id(VIEW_THEME_AUTO_ID, "Auto Theme")
      .checked(true)
      .build(app)?)
    .build()?;

  // Insert menu (Lokus-specific)
  let insert_menu = SubmenuBuilder::new(app, "Insert")
    .item(&MenuItemBuilder::with_id(INSERT_WIKILINK_ID, "WikiLink…")
      .accelerator("CmdOrCtrl+L")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(INSERT_MATH_ID, "Math Equation…")
      .accelerator("CmdOrCtrl+M")
      .build(app)?)
    .separator()
    .item(&MenuItemBuilder::with_id(INSERT_TABLE_ID, "Table")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(INSERT_IMAGE_ID, "Image…")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(INSERT_CODE_BLOCK_ID, "Code Block")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(INSERT_HORIZONTAL_RULE_ID, "Horizontal Rule")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(INSERT_TASK_LIST_ID, "Task List")
      .build(app)?)
    .separator()
    .item(&MenuItemBuilder::with_id(INSERT_H1_ID, "Heading 1")
      .accelerator("CmdOrCtrl+Alt+1")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(INSERT_H2_ID, "Heading 2")
      .accelerator("CmdOrCtrl+Alt+2")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(INSERT_H3_ID, "Heading 3")
      .accelerator("CmdOrCtrl+Alt+3")
      .build(app)?)
    .build()?;

  // Format menu (Lokus-specific)
  let format_menu = SubmenuBuilder::new(app, "Format")
    .item(&MenuItemBuilder::with_id(FORMAT_BOLD_ID, "Bold")
      .accelerator("CmdOrCtrl+B")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(FORMAT_ITALIC_ID, "Italic")
      .accelerator("CmdOrCtrl+I")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(FORMAT_UNDERLINE_ID, "Underline")
      .accelerator("CmdOrCtrl+U")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(FORMAT_STRIKETHROUGH_ID, "Strikethrough")
      .accelerator("CmdOrCtrl+Shift+X")
      .build(app)?)
    .separator()
    .item(&MenuItemBuilder::with_id(FORMAT_CODE_ID, "Code")
      .accelerator("CmdOrCtrl+E")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(FORMAT_HIGHLIGHT_ID, "Highlight")
      .build(app)?)
    .separator()
    .item(&MenuItemBuilder::with_id(FORMAT_CLEAR_ID, "Clear Formatting")
      .build(app)?)
    .build()?;

  // Window menu
  let window_builder = SubmenuBuilder::new(app, "Window")
    .item(&MenuItemBuilder::with_id(WINDOW_MINIMIZE_ID, "Minimize")
      .accelerator("CmdOrCtrl+M")
      .build(app)?);
  
  #[cfg(target_os = "macos")]
  {
    window_builder = window_builder
      .item(&MenuItemBuilder::with_id(WINDOW_ZOOM_ID, "Zoom")
        .build(app)?)
      .separator()
      .item(&MenuItemBuilder::with_id("window-bring-all-to-front", "Bring All to Front")
        .build(app)?);
  }
  
  let window_menu = window_builder
    .separator()
    .item(&MenuItemBuilder::with_id(WINDOW_PREV_TAB_ID, "Show Previous Tab")
      .accelerator("Ctrl+Shift+Tab")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(WINDOW_NEXT_TAB_ID, "Show Next Tab")
      .accelerator("Ctrl+Tab")
      .build(app)?)
    .build()?;

  // Help menu
  let help_menu = SubmenuBuilder::new(app, "Help")
    .item(&MenuItemBuilder::with_id(HELP_HELP_ID, "Lokus Help")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(HELP_SHORTCUTS_ID, "Keyboard Shortcuts")
      .accelerator("CmdOrCtrl+/")
      .build(app)?)
    .separator()
    .item(&MenuItemBuilder::with_id(HELP_RELEASE_NOTES_ID, "Release Notes")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(HELP_REPORT_ISSUE_ID, "Report an Issue…")
      .build(app)?)
    .build()?;

  // Build the complete menu
  #[cfg(target_os = "macos")]
  {
    let menu = MenuBuilder::new(app)
      .items(&[
        &app_menu, 
        &file_menu, 
        &edit_menu, 
        &view_menu, 
        &insert_menu, 
        &format_menu, 
        &window_menu, 
        &help_menu
      ])
      .build()?;
    app.set_menu(menu)?;
  }

  #[cfg(not(target_os = "macos"))]
  {
    // On Windows, rebuild the file menu with Preferences and Quit added
    let file_menu_with_prefs = SubmenuBuilder::new(app, "File")
      .item(&MenuItemBuilder::with_id(FILE_NEW_NOTE_ID, "New Note")
        .accelerator("CmdOrCtrl+N")
        .build(app)?)
      .item(&MenuItemBuilder::with_id(FILE_NEW_FOLDER_ID, "New Folder")
        .accelerator("CmdOrCtrl+Shift+N")
        .build(app)?)
      .item(&MenuItemBuilder::with_id(FILE_NEW_CANVAS_ID, "New Canvas")
        .build(app)?)
      .separator()
      .item(&MenuItemBuilder::with_id(FILE_OPEN_ID, "Open…")
        .accelerator("CmdOrCtrl+O")
        .build(app)?)
      .item(&MenuItemBuilder::with_id(FILE_OPEN_WORKSPACE_ID, "Open Workspace…")
        .accelerator("CmdOrCtrl+Shift+O")
        .build(app)?)
      .separator()
      .item(&MenuItemBuilder::with_id(FILE_CLOSE_TAB_ID, "Close Tab")
        .accelerator("CmdOrCtrl+W")
        .build(app)?)
      .item(&MenuItemBuilder::with_id(FILE_CLOSE_WINDOW_ID, "Close Window")
        .accelerator("CmdOrCtrl+Shift+W")
        .build(app)?)
      .separator()
      .item(&MenuItemBuilder::with_id(FILE_SAVE_ID, "Save")
        .accelerator("CmdOrCtrl+S")
        .build(app)?)
      .item(&MenuItemBuilder::with_id(FILE_SAVE_AS_ID, "Save As…")
        .accelerator("CmdOrCtrl+Shift+S")
        .build(app)?)
      .separator()
      .item(&MenuItemBuilder::with_id(FILE_EXPORT_PDF_ID, "Export to PDF…")
        .build(app)?)
      .item(&MenuItemBuilder::with_id(FILE_EXPORT_HTML_ID, "Export to HTML…")
        .build(app)?)
      .separator()
      .item(&MenuItemBuilder::with_id(FILE_PRINT_ID, "Print…")
        .accelerator("CmdOrCtrl+P")
        .build(app)?)
      .separator()
      .item(&MenuItemBuilder::with_id(PREFERENCES_ID, "Preferences…")
        .accelerator("CmdOrCtrl+,")
        .build(app)?)
      .separator()
      .item(&PredefinedMenuItem::quit(app, None)?)
      .build()?;
      
    let menu = MenuBuilder::new(app)
      .items(&[
        &file_menu_with_prefs, 
        &edit_menu, 
        &view_menu, 
        &insert_menu, 
        &format_menu, 
        &window_menu, 
        &help_menu
      ])
      .build()?;
    app.set_menu(menu)?;
  }

  // Comprehensive menu event handling
  app.on_menu_event(|app, event| {
    let event_id = event.id().as_ref();
    
    match event_id {
      // App menu
      ABOUT_ID => {
        let _ = app.emit("lokus:show-about", ());
      }
      PREFERENCES_ID => {
        let _ = crate::window_manager::open_preferences_window(app.clone(), None);
      }
      
      // File menu
      FILE_NEW_NOTE_ID => {
        let _ = app.emit("lokus:new-file", ());
      }
      FILE_NEW_FOLDER_ID => {
        let _ = app.emit("lokus:new-folder", ());
      }
      FILE_NEW_CANVAS_ID => {
        let _ = app.emit("lokus:new-canvas", ());
      }
      FILE_OPEN_ID => {
        let _ = app.emit("lokus:open-file", ());
      }
      FILE_OPEN_WORKSPACE_ID => {
        let _ = app.emit("lokus:open-workspace", ());
      }
      FILE_CLOSE_TAB_ID => {
        let _ = app.emit("lokus:close-tab", ());
      }
      FILE_CLOSE_WINDOW_ID => {
        let _ = app.emit("lokus:close-window", ());
      }
      FILE_SAVE_ID => {
        let _ = app.emit("lokus:save-file", ());
      }
      FILE_SAVE_AS_ID => {
        let _ = app.emit("lokus:save-as", ());
      }
      FILE_EXPORT_PDF_ID => {
        let _ = app.emit("lokus:export-pdf", ());
      }
      FILE_EXPORT_HTML_ID => {
        let _ = app.emit("lokus:export-html", ());
      }
      FILE_PRINT_ID => {
        let _ = app.emit("lokus:print", ());
      }
      
      // Edit menu
      EDIT_FIND_ID => {
        let _ = app.emit("lokus:in-file-search", ());
      }
      EDIT_FIND_REPLACE_ID => {
        let _ = app.emit("lokus:find-replace", ());
      }
      EDIT_FIND_NEXT_ID => {
        let _ = app.emit("lokus:find-next", ());
      }
      EDIT_FIND_PREVIOUS_ID => {
        let _ = app.emit("lokus:find-previous", ());
      }
      EDIT_PASTE_MATCH_STYLE_ID => {
        let _ = app.emit("lokus:paste-match-style", ());
      }
      
      // View menu
      VIEW_TOGGLE_SIDEBAR_ID => {
        let _ = app.emit("lokus:toggle-sidebar", ());
      }
      VIEW_TOGGLE_SPLIT_ID => {
        let _ = app.emit("lokus:toggle-split-view", ());
      }
      VIEW_FULL_SCREEN_ID => {
        let _ = app.emit("lokus:toggle-fullscreen", ());
      }
      VIEW_ACTUAL_SIZE_ID => {
        let _ = app.emit("lokus:actual-size", ());
      }
      VIEW_ZOOM_IN_ID => {
        let _ = app.emit("lokus:zoom-in", ());
      }
      VIEW_ZOOM_OUT_ID => {
        let _ = app.emit("lokus:zoom-out", ());
      }
      VIEW_GRAPH_ID => {
        let _ = app.emit("lokus:graph-view", ());
      }
      VIEW_KANBAN_ID => {
        let _ = app.emit("lokus:open-kanban", ());
      }
      VIEW_COMMAND_PALETTE_ID => {
        let _ = app.emit("lokus:command-palette", ());
      }
      VIEW_THEME_LIGHT_ID => {
        let _ = app.emit("lokus:theme-light", ());
      }
      VIEW_THEME_DARK_ID => {
        let _ = app.emit("lokus:theme-dark", ());
      }
      VIEW_THEME_AUTO_ID => {
        let _ = app.emit("lokus:theme-auto", ());
      }
      
      // Insert menu
      INSERT_WIKILINK_ID => {
        let _ = app.emit("lokus:insert-wikilink", ());
      }
      INSERT_MATH_ID => {
        let _ = app.emit("lokus:insert-math", ());
      }
      INSERT_TABLE_ID => {
        let _ = app.emit("lokus:insert-table", ());
      }
      INSERT_IMAGE_ID => {
        let _ = app.emit("lokus:insert-image", ());
      }
      INSERT_CODE_BLOCK_ID => {
        let _ = app.emit("lokus:insert-code-block", ());
      }
      INSERT_HORIZONTAL_RULE_ID => {
        let _ = app.emit("lokus:insert-horizontal-rule", ());
      }
      INSERT_TASK_LIST_ID => {
        let _ = app.emit("lokus:insert-task-list", ());
      }
      INSERT_H1_ID => {
        let _ = app.emit("lokus:insert-heading", 1);
      }
      INSERT_H2_ID => {
        let _ = app.emit("lokus:insert-heading", 2);
      }
      INSERT_H3_ID => {
        let _ = app.emit("lokus:insert-heading", 3);
      }
      
      // Format menu
      FORMAT_BOLD_ID => {
        let _ = app.emit("lokus:format-bold", ());
      }
      FORMAT_ITALIC_ID => {
        let _ = app.emit("lokus:format-italic", ());
      }
      FORMAT_UNDERLINE_ID => {
        let _ = app.emit("lokus:format-underline", ());
      }
      FORMAT_STRIKETHROUGH_ID => {
        let _ = app.emit("lokus:format-strikethrough", ());
      }
      FORMAT_CODE_ID => {
        let _ = app.emit("lokus:format-code", ());
      }
      FORMAT_HIGHLIGHT_ID => {
        let _ = app.emit("lokus:format-highlight", ());
      }
      FORMAT_CLEAR_ID => {
        let _ = app.emit("lokus:format-clear", ());
      }
      
      // Window menu
      WINDOW_MINIMIZE_ID => {
        let _ = app.emit("lokus:window-minimize", ());
      }
      WINDOW_ZOOM_ID => {
        let _ = app.emit("lokus:window-zoom", ());
      }
      WINDOW_PREV_TAB_ID => {
        let _ = app.emit("lokus:prev-tab", ());
      }
      WINDOW_NEXT_TAB_ID => {
        let _ = app.emit("lokus:next-tab", ());
      }
      
      // Help menu
      HELP_HELP_ID => {
        let _ = app.emit("lokus:help", ());
      }
      HELP_SHORTCUTS_ID => {
        let _ = app.emit("lokus:shortcut-help", ());
      }
      HELP_RELEASE_NOTES_ID => {
        let _ = app.emit("lokus:release-notes", ());
      }
      HELP_REPORT_ISSUE_ID => {
        let _ = app.emit("lokus:report-issue", ());
      }
      
      _ => {
        // Handle any unmatched menu items
      }
    }
  });

  Ok(())
}
