//! @part-of desktop
//! The desktop binary. Everything lives in the library so that the same code
//! is the entry point on phones.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    lokus_desktop_lib::run();
}
