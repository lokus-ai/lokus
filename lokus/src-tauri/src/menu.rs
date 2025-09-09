use tauri::{
  AppHandle,
  menu::{MenuBuilder, SubmenuBuilder, PredefinedMenuItem, MenuItemBuilder},
  Emitter,
};

pub const PREFERENCES_ID: &str = "preferences";
const FILE_SAVE_ID: &str = "file-save";
const FILE_CLOSE_TAB_ID: &str = "file-close-tab";

pub fn init(app: &AppHandle) -> tauri::Result<()> {
  // macOS app menu
  let app_menu = SubmenuBuilder::new(app, "Lokus")
    .item(&MenuItemBuilder::with_id(PREFERENCES_ID, "Preferences…")
      .accelerator("CmdOrCtrl+,")
      .build(app)?)
    .separator()
    .item(&PredefinedMenuItem::quit(app, None)?)
    .build()?;

  // Basic Edit menu for standard shortcuts
  let edit_menu = SubmenuBuilder::new(app, "Edit")
    .undo().redo().separator().cut().copy().paste().select_all()
    .build()?;

  // File menu with explicit accelerators to ensure reliability on macOS/Windows
  let file_menu = SubmenuBuilder::new(app, "File")
    .item(&MenuItemBuilder::with_id(FILE_SAVE_ID, "Save")
      .accelerator("CmdOrCtrl+S")
      .build(app)?)
    .item(&MenuItemBuilder::with_id(FILE_CLOSE_TAB_ID, "Close Tab")
      .accelerator("CmdOrCtrl+W")
      .build(app)?)
    .build()?;

  // Build + set menu
  let menu = MenuBuilder::new(app)
    .items(&[&app_menu, &file_menu, &edit_menu])
    .build()?;
  app.set_menu(menu)?;

  // Menu event handling
  app.on_menu_event(|app, event| {
    match event.id().as_ref() {
      PREFERENCES_ID => {
        let _ = crate::windows::open_preferences_window(app.clone());
      }
      FILE_SAVE_ID => {
        let _ = app.emit("lokus:save-file", ());
      }
      FILE_CLOSE_TAB_ID => {
        let _ = app.emit("lokus:close-tab", ());
      }
      _ => {}
    }
  });

  Ok(())
}
