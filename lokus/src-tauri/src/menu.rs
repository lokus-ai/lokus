use tauri::{
  AppHandle,
  menu::{MenuBuilder, SubmenuBuilder, PredefinedMenuItem, MenuItemBuilder},
};

pub const PREFERENCES_ID: &str = "preferences";

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

  // Build + set menu
  let menu = MenuBuilder::new(app)
    .items(&[&app_menu, &edit_menu])
    .build()?;
  app.set_menu(menu)?;

  // Menu event handling
  app.on_menu_event(|app, event| {
    if event.id().as_ref() == PREFERENCES_ID {
      let _ = crate::windows::open_preferences_window(app.clone());
    }
  });

  Ok(())
}
