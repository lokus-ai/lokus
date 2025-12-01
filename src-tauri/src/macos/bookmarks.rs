//! Security-Scoped Bookmarks for macOS
//!
//! This module implements macOS security-scoped bookmarks to maintain persistent
//! access to user-selected files and folders across app restarts.
//!
//! Required for apps using `com.apple.security.files.user-selected.read-write`
//! entitlement.

#[cfg(target_os = "macos")]
use objc::{class, msg_send, sel, sel_impl};
#[cfg(target_os = "macos")]
use objc::runtime::Object;
#[cfg(target_os = "macos")]
use objc_foundation::{NSString, INSString};

/// Create a security-scoped bookmark for a path
///
/// # Arguments
/// * `path` - File system path to create bookmark for
///
/// # Returns
/// * `Ok(Vec<u8>)` - Bookmark data that can be stored and used later
/// * `Err(String)` - Error message if bookmark creation fails
#[cfg(target_os = "macos")]
pub fn create_bookmark(path: &str) -> Result<Vec<u8>, String> {
    unsafe {
        let ns_string = NSString::from_str(path);
        let url: *mut Object = msg_send![class!(NSURL), fileURLWithPath: ns_string];

        if url.is_null() {
            return Err("Failed to create NSURL".to_string());
        }

        // Create bookmark with security scope
        // NSURLBookmarkCreationWithSecurityScope = 1 << 11
        let options: u64 = 1 << 11;
        let keys: *mut Object = msg_send![class!(NSArray), array];
        let mut error: *mut Object = std::ptr::null_mut();

        let bookmark_data: *mut Object = msg_send![
            url,
            bookmarkDataWithOptions: options
            includingResourceValuesForKeys: keys
            relativeToURL: std::ptr::null_mut::<Object>()
            error: &mut error
        ];

        if !error.is_null() {
            let desc: *mut Object = msg_send![error, localizedDescription];
            let err_str: *mut Object = msg_send![desc, UTF8String];
            if !err_str.is_null() {
                let c_str = std::ffi::CStr::from_ptr(err_str as *const i8);
                if let Ok(s) = c_str.to_str() {
                    return Err(format!("Bookmark creation failed: {}", s));
                }
            }
            return Err("Bookmark creation failed (unknown error)".to_string());
        }

        if bookmark_data.is_null() {
            return Err("Failed to create bookmark data".to_string());
        }

        // Convert NSData to Vec<u8>
        let length: usize = msg_send![bookmark_data, length];
        let bytes: *const u8 = msg_send![bookmark_data, bytes];
        let data = std::slice::from_raw_parts(bytes, length).to_vec();

        Ok(data)
    }
}

/// Resolve a bookmark and start accessing the resource
///
/// # Arguments
/// * `bookmark_data` - Previously created bookmark data
///
/// # Returns
/// * `Ok(String)` - Resolved file system path with active security-scoped access
/// * `Err(String)` - Error message if resolution fails
///
/// # Important
/// After successfully resolving, you MUST call `stop_accessing()` when done
/// to release the security-scoped resource.
#[cfg(target_os = "macos")]
pub fn resolve_bookmark(bookmark_data: &[u8]) -> Result<String, String> {
    unsafe {
        // Create NSData from bytes
        let ns_data: *mut Object = msg_send![class!(NSData), alloc];
        let ns_data: *mut Object = msg_send![ns_data, initWithBytes: bookmark_data.as_ptr() length: bookmark_data.len()];

        if ns_data.is_null() {
            return Err("Failed to create NSData from bookmark".to_string());
        }

        let mut is_stale: bool = false;
        let mut error: *mut Object = std::ptr::null_mut();
        // NSURLBookmarkResolutionWithSecurityScope = 1 << 9
        let options: u64 = 1 << 9;

        let url: *mut Object = msg_send![
            class!(NSURL),
            URLByResolvingBookmarkData: ns_data
            options: options
            relativeToURL: std::ptr::null_mut::<Object>()
            bookmarkDataIsStale: &mut is_stale
            error: &mut error
        ];

        if !error.is_null() {
            let desc: *mut Object = msg_send![error, localizedDescription];
            let err_str: *mut Object = msg_send![desc, UTF8String];
            if !err_str.is_null() {
                let c_str = std::ffi::CStr::from_ptr(err_str as *const i8);
                if let Ok(s) = c_str.to_str() {
                    return Err(format!("Bookmark resolution failed: {}", s));
                }
            }
            return Err("Bookmark resolution failed (unknown error)".to_string());
        }

        if url.is_null() {
            return Err("Failed to resolve bookmark to URL".to_string());
        }

        // Start accessing security-scoped resource
        let did_start: bool = msg_send![url, startAccessingSecurityScopedResource];
        if !did_start {
            return Err("Failed to start accessing security-scoped resource".to_string());
        }

        // Get path string
        let path: *mut Object = msg_send![url, path];
        if path.is_null() {
            // Stop accessing if we can't get the path
            let _: () = msg_send![url, stopAccessingSecurityScopedResource];
            return Err("Failed to get path from URL".to_string());
        }

        let path_str: *mut Object = msg_send![path, UTF8String];
        if path_str.is_null() {
            let _: () = msg_send![url, stopAccessingSecurityScopedResource];
            return Err("Failed to convert path to string".to_string());
        }

        let c_str = std::ffi::CStr::from_ptr(path_str as *const i8);
        let path_string = c_str.to_str()
            .map_err(|_| "Failed to convert path to UTF-8".to_string())?
            .to_string();

        Ok(path_string)
    }
}

/// Stop accessing a security-scoped resource
///
/// # Arguments
/// * `path` - File system path to stop accessing
///
/// Call this after you're done accessing a path that was resolved via
/// `resolve_bookmark()` to properly release the security-scoped resource.
#[cfg(target_os = "macos")]
pub fn stop_accessing(path: &str) {
    unsafe {
        let ns_string = NSString::from_str(path);
        let url: *mut Object = msg_send![class!(NSURL), fileURLWithPath: ns_string];
        if !url.is_null() {
            let _: () = msg_send![url, stopAccessingSecurityScopedResource];
        }
    }
}

// Non-macOS stub implementations
#[cfg(not(target_os = "macos"))]
pub fn create_bookmark(_path: &str) -> Result<Vec<u8>, String> {
    Err("Security-scoped bookmarks are only supported on macOS".to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn resolve_bookmark(_bookmark_data: &[u8]) -> Result<String, String> {
    Err("Security-scoped bookmarks are only supported on macOS".to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn stop_accessing(_path: &str) {
    // No-op on non-macOS platforms
}
