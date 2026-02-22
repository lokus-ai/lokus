//! Native macOS notifications module for Lokus.
//!
//! Provides native `UNUserNotificationCenter` integration with action buttons
//! and a click handler delegate.  This replaces the broken
//! `tauri-plugin-notification` approach, which offers no click handler on
//! desktop targets.
//!
//! # macOS-specific items
//!
//! All Objective-C interop lives under `#[cfg(target_os = "macos")]`.
//! Non-macOS targets receive empty stub implementations so the crate compiles
//! on all platforms.
//!
//! # Event emitted
//!
//! When the user clicks a notification action button the delegate emits
//! `lokus:notification-action` with the following JSON payload:
//!
//! ```json
//! { "action": "start_recording" }
//! ```
//!
//! or
//!
//! ```json
//! { "action": "dismiss" }
//! ```
//!
//! The `action` field is the raw action identifier string as returned by
//! `UNNotificationResponse.actionIdentifier`.  The built-in macOS identifiers
//! (default tap and dismiss) are forwarded as-is:
//!
//! - `"com.apple.UNNotificationDefaultActionIdentifier"` — user tapped the
//!   notification body without choosing an action button.
//! - `"com.apple.UNNotificationDismissActionIdentifier"` — user dismissed the
//!   notification.

// ---------------------------------------------------------------------------
// macOS implementation
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
mod macos_impl {
    use std::sync::OnceLock;

    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2::runtime::NSObject;
    use objc2::{define_class, msg_send, AnyThread};
    use objc2_foundation::{NSArray, NSObjectProtocol, NSSet, NSString, NSUUID};
    use objc2_user_notifications::{
        UNMutableNotificationContent, UNNotificationAction, UNNotificationActionOptions,
        UNNotificationCategory, UNNotificationCategoryOptions, UNNotificationPresentationOptions,
        UNNotificationRequest, UNNotificationResponse, UNTimeIntervalNotificationTrigger,
        UNUserNotificationCenter, UNUserNotificationCenterDelegate,
    };
    use tauri::Emitter;

    // -----------------------------------------------------------------------
    // Static storage — prevents the delegate from being dropped prematurely.
    // The notification center stores only a *weak* reference to its delegate,
    // so the caller must keep a strong reference alive for the lifetime of the
    // process.
    // -----------------------------------------------------------------------

    /// Retains the delegate for the lifetime of the process.
    static DELEGATE: OnceLock<Retained<NotificationDelegate>> = OnceLock::new();

    /// Retains the `AppHandle` so the delegate can emit Tauri events from its
    /// Objective-C callbacks.
    static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();

    // -----------------------------------------------------------------------
    // Notification action event payload
    // -----------------------------------------------------------------------

    #[derive(serde::Serialize, Clone, Debug)]
    struct NotificationActionPayload {
        action: String,
    }

    // -----------------------------------------------------------------------
    // Delegate class definition
    // -----------------------------------------------------------------------

    /// Ivars type for `NotificationDelegate`.
    ///
    /// We store nothing in ivars — all state lives in the process-wide statics.
    struct DelegateIvars;

    define_class!(
        // SAFETY:
        // - The superclass `NSObject` has no subclassing requirements.
        // - `NotificationDelegate` does not implement `Drop`.
        #[unsafe(super(NSObject))]
        #[thread_kind = AnyThread]
        #[ivars = DelegateIvars]
        struct NotificationDelegate;

        unsafe impl NSObjectProtocol for NotificationDelegate {}

        unsafe impl UNUserNotificationCenterDelegate for NotificationDelegate {
            // Called when a notification is delivered while the app is in
            // the foreground.  We ask the system to present it as a banner
            // with sound so it appears even when Lokus has focus.
            #[unsafe(method(userNotificationCenter:willPresentNotification:withCompletionHandler:))]
            fn will_present(
                &self,
                _center: &UNUserNotificationCenter,
                _notification: &objc2_user_notifications::UNNotification,
                completion_handler: &block2::DynBlock<
                    dyn Fn(UNNotificationPresentationOptions),
                >,
            ) {
                let options =
                    UNNotificationPresentationOptions::Banner
                    | UNNotificationPresentationOptions::Sound;
                completion_handler.call((options,));
            }

            // Called when the user taps the notification or one of its action
            // buttons.  We emit a Tauri event so the frontend can react.
            #[unsafe(method(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:))]
            fn did_receive(
                &self,
                _center: &UNUserNotificationCenter,
                response: &UNNotificationResponse,
                completion_handler: &block2::DynBlock<dyn Fn()>,
            ) {
                let action_id_nsstr = response.actionIdentifier();
                let action_id: String = action_id_nsstr.to_string();

                tracing::info!(action = %action_id, "Notification action received");

                if let Some(handle) = APP_HANDLE.get() {
                    let payload = NotificationActionPayload {
                        action: action_id,
                    };
                    if let Err(e) = handle.emit("lokus:notification-action", &payload) {
                        tracing::warn!(error = %e, "Failed to emit notification-action event");
                    }
                } else {
                    tracing::warn!("APP_HANDLE not set — cannot emit notification-action event");
                }

                completion_handler.call(());
            }
        }
    );

    // Constructor
    impl NotificationDelegate {
        fn new() -> Retained<Self> {
            let this = Self::alloc().set_ivars(DelegateIvars);
            unsafe { msg_send![super(this), init] }
        }
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /// Request macOS notification permission (Alert + Sound + Badge).
    ///
    /// This is idempotent — the OS will only show the permission dialog once.
    /// Subsequent calls are silent no-ops from the user's perspective.
    pub fn request_notification_permission() {
        let center = UNUserNotificationCenter::currentNotificationCenter();

        let options = objc2_user_notifications::UNAuthorizationOptions::Alert
            | objc2_user_notifications::UNAuthorizationOptions::Sound
            | objc2_user_notifications::UNAuthorizationOptions::Badge;

        let completion = RcBlock::new(move |granted: objc2::runtime::Bool, error: *mut objc2_foundation::NSError| {
            if !error.is_null() {
                tracing::warn!("Notification permission request returned an error");
            } else if granted.as_bool() {
                tracing::info!("Notification permission granted");
            } else {
                tracing::warn!("Notification permission denied by user");
            }
        });

        center.requestAuthorizationWithOptions_completionHandler(options, &completion);
    }

    /// Register the "MEETING_ALERT" notification category with two actions:
    /// - `start_recording` — "Start Recording" (foreground, brings app to front)
    /// - `dismiss` — "Dismiss" (background)
    ///
    /// Must be called once on startup, before any notifications are sent.
    pub fn register_notification_categories() {
        let start_id = NSString::from_str("start_recording");
        let start_title = NSString::from_str("Start Recording");
        let start_action = UNNotificationAction::actionWithIdentifier_title_options(
            &start_id,
            &start_title,
            UNNotificationActionOptions::Foreground,
        );

        let dismiss_id = NSString::from_str("dismiss");
        let dismiss_title = NSString::from_str("Dismiss");
        let dismiss_action = UNNotificationAction::actionWithIdentifier_title_options(
            &dismiss_id,
            &dismiss_title,
            UNNotificationActionOptions::empty(),
        );

        let actions: Retained<NSArray<UNNotificationAction>> =
            NSArray::from_retained_slice(&[start_action, dismiss_action]);

        let intent_ids: Retained<NSArray<NSString>> = NSArray::new();

        let category_id = NSString::from_str("MEETING_ALERT");
        let category =
            UNNotificationCategory::categoryWithIdentifier_actions_intentIdentifiers_options(
                &category_id,
                &actions,
                &intent_ids,
                UNNotificationCategoryOptions::empty(),
            );

        let categories: Retained<NSSet<UNNotificationCategory>> =
            NSSet::from_retained_slice(&[category]);

        let center = UNUserNotificationCenter::currentNotificationCenter();
        center.setNotificationCategories(&categories);

        tracing::info!("Notification category 'MEETING_ALERT' registered");
    }

    /// Install the `UNUserNotificationCenterDelegate` and store the
    /// `AppHandle` in a process-wide static so callbacks can emit Tauri
    /// events.
    ///
    /// CRITICAL: The delegate is stored in a `OnceLock<Retained<…>>` so it
    /// is never dropped.  The notification center holds only a *weak*
    /// reference; if we stored the delegate in a local variable it would be
    /// deallocated immediately after this function returns and callbacks would
    /// silently stop firing.
    pub fn install_notification_delegate(app_handle: tauri::AppHandle) {
        // Store the app handle (ignore if already set — idempotent).
        let _ = APP_HANDLE.set(app_handle);

        // Create and permanently retain the delegate.
        let delegate = DELEGATE.get_or_init(NotificationDelegate::new);

        let center = UNUserNotificationCenter::currentNotificationCenter();

        // `setDelegate:` expects a `ProtocolObject<dyn UNUserNotificationCenterDelegate>`.
        // We obtain one by casting our concrete type.  The explicit turbofish
        // `from_ref::<NotificationDelegate>` is required because the compiler
        // cannot infer `T` when `Retained<NotificationDelegate>` implements
        // `AsRef` for multiple target types.
        use objc2::runtime::ProtocolObject;
        let delegate_ref: &ProtocolObject<dyn UNUserNotificationCenterDelegate> =
            ProtocolObject::from_ref::<NotificationDelegate>(delegate);
        center.setDelegate(Some(delegate_ref));

        tracing::info!("Notification delegate installed");
    }

    /// Schedule a native notification with the "MEETING_ALERT" category so
    /// that the "Start Recording" and "Dismiss" action buttons appear.
    ///
    /// The notification fires after 0.1 seconds (effectively immediately).
    /// A new UUID is used for each call so notifications do not overwrite
    /// each other.
    pub fn send_meeting_notification(title: &str, body: &str) {
        let content = UNMutableNotificationContent::new();
        content.setTitle(&NSString::from_str(title));
        content.setBody(&NSString::from_str(body));
        content.setCategoryIdentifier(&NSString::from_str("MEETING_ALERT"));

        let trigger =
            UNTimeIntervalNotificationTrigger::triggerWithTimeInterval_repeats(0.1, false);

        let uuid = NSUUID::new();
        let identifier = uuid.UUIDString();

        // `requestWithIdentifier:content:trigger:` expects a
        // `&UNNotificationContent`, but `content` is a
        // `Retained<UNMutableNotificationContent>`.  We deref to get
        // a `&UNMutableNotificationContent` and then coerce via Deref
        // to the base class.
        use std::ops::Deref;
        let base_content: &objc2_user_notifications::UNNotificationContent = content.deref();

        let request = UNNotificationRequest::requestWithIdentifier_content_trigger(
            &identifier,
            base_content,
            Some(trigger.deref()),
        );

        let center = UNUserNotificationCenter::currentNotificationCenter();

        let completion = RcBlock::new(|error: *mut objc2_foundation::NSError| {
            if error.is_null() {
                tracing::info!("Meeting notification scheduled successfully");
            } else {
                tracing::warn!("Failed to schedule meeting notification");
            }
        });

        center.addNotificationRequest_withCompletionHandler(&request, Some(&completion));
    }
}

// ---------------------------------------------------------------------------
// macOS public re-exports
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
pub use macos_impl::{
    install_notification_delegate, register_notification_categories,
    request_notification_permission, send_meeting_notification,
};

// ---------------------------------------------------------------------------
// Non-macOS stubs
// ---------------------------------------------------------------------------

#[cfg(not(target_os = "macos"))]
pub fn request_notification_permission() {}

#[cfg(not(target_os = "macos"))]
pub fn register_notification_categories() {}

#[cfg(not(target_os = "macos"))]
pub fn install_notification_delegate(_app_handle: tauri::AppHandle) {}

#[cfg(not(target_os = "macos"))]
pub fn send_meeting_notification(_title: &str, _body: &str) {}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Request macOS notification permission.
///
/// Safe to call multiple times — the OS only shows the permission dialog once.
#[tauri::command]
pub async fn request_notification_permission_cmd() -> Result<(), String> {
    request_notification_permission();
    Ok(())
}

/// Schedule a native meeting notification with action buttons.
///
/// On non-macOS platforms this is a no-op that always returns `Ok`.
#[tauri::command]
pub async fn send_native_notification(title: String, body: String) -> Result<(), String> {
    send_meeting_notification(&title, &body);
    Ok(())
}
