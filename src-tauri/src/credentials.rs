use serde::{Deserialize, Serialize};
use tauri::command;

/// Encrypted credential storage using OS-specific secure storage
/// 
/// This module provides secure credential storage using:
/// - macOS: Keychain
/// - Windows: Credential Manager
/// - Linux: Secret Service (libsecret)

#[derive(Debug, Serialize, Deserialize)]
pub struct GitCredentials {
    pub username: String,
    #[serde(skip_serializing)]
    pub token: String, // Never serialize token
}

#[derive(Debug)]
#[allow(dead_code)] // Infrastructure for error handling, will be used when credentials are integrated
pub enum CredentialError {
    NotFound,
    StorageError(String),
    EncryptionError(String),
}

impl std::fmt::Display for CredentialError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            CredentialError::NotFound => write!(f, "Credentials not found"),
            CredentialError::StorageError(msg) => write!(f, "Storage error: {}", msg),
            CredentialError::EncryptionError(msg) => write!(f, "Encryption error: {}", msg),
        }
    }
}

/// Store git credentials securely in OS keychain
#[command]
pub async fn store_git_credentials(
    workspace_id: String,
    username: String,
    token: String,
) -> Result<(), String> {
    let service_name = format!("lokus.git.{}", workspace_id);
    
    #[cfg(target_os = "macos")]
    {
        use security_framework::passwords::*;
        
        // Store username and token separately
        // Store token with service name
        set_generic_password(&service_name, &username, token.as_bytes())
            .map_err(|e| format!("Failed to store credentials in Keychain: {}", e))?;
        
        // Store username in a separate entry
        let username_service = format!("{}.username", service_name);
        set_generic_password(&username_service, "lokus", username.as_bytes())
            .map_err(|e| format!("Failed to store username in Keychain: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Security::Credentials::*;
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        
        // Store in Windows Credential Manager
        let target_name: Vec<u16> = OsStr::new(&service_name)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        
        let username_wide: Vec<u16> = OsStr::new(&username)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        
        let credential_blob = token.as_bytes();
        
        let credential = CREDENTIALW {
            Flags: CRED_FLAGS(0),
            Type: CRED_TYPE_GENERIC,
            TargetName: windows::core::PWSTR::from_raw(target_name.as_ptr() as *mut u16),
            Comment: windows::core::PWSTR::null(),
            LastWritten: Default::default(),
            CredentialBlobSize: credential_blob.len() as u32,
            CredentialBlob: credential_blob.as_ptr() as *mut u8,
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            AttributeCount: 0,
            Attributes: std::ptr::null_mut(),
            TargetAlias: windows::core::PWSTR::null(),
            UserName: windows::core::PWSTR::from_raw(username_wide.as_ptr() as *mut u16),
        };
        
        unsafe {
            CredWriteW(&credential, 0)
                .map_err(|e| format!("Failed to store credentials in Credential Manager: {}", e))?;
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        use secret_service::{SecretService, EncryptionType};
        use std::collections::HashMap;
        
        // Store in Linux Secret Service
        let ss = SecretService::new(EncryptionType::Dh)
            .map_err(|e| format!("Failed to connect to Secret Service: {}", e))?;
        
        let collection = ss.get_default_collection()
            .map_err(|e| format!("Failed to get default collection: {}", e))?;
        
        let mut attributes = HashMap::new();
        attributes.insert("service", service_name.as_str());
        attributes.insert("username", username.as_str());
        
        collection.create_item(
            &format!("Lokus Git Credentials for {}", workspace_id),
            attributes,
            token.as_bytes(),
            true, // Replace existing
            "text/plain",
        )
        .map_err(|e| format!("Failed to store credentials: {}", e))?;
    }
    
    Ok(())
}

/// Retrieve git credentials from OS keychain
#[command]
pub async fn retrieve_git_credentials(
    workspace_id: String,
) -> Result<GitCredentials, String> {
    let service_name = format!("lokus.git.{}", workspace_id);
    
    #[cfg(target_os = "macos")]
    {
        use security_framework::passwords::*;
        
        // Retrieve password from macOS Keychain
        let password = get_generic_password(&service_name, &"")
            .map_err(|e| format!("Credentials not found in Keychain: {}", e))?;
        
        let token = String::from_utf8(password)
            .map_err(|e| format!("Invalid token encoding: {}", e))?;
        
        // Retrieve username from separate entry
        let username_service = format!("{}.username", workspace_id);
        let username_bytes = get_generic_password(&username_service, "lokus")
            .map_err(|e| format!("Username not found in Keychain: {}", e))?;
        
        let username = String::from_utf8(username_bytes)
            .map_err(|e| format!("Invalid username encoding: {}", e))?;
        
        return Ok(GitCredentials {
            username,
            token,
        });
    }
    
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Security::Credentials::*;
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        use std::slice;
        
        // Retrieve from Windows Credential Manager
        let target_name: Vec<u16> = OsStr::new(&service_name)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        
        let mut credential_ptr: *mut CREDENTIALW = std::ptr::null_mut();
        
        unsafe {
            CredReadW(windows::core::PCWSTR::from_raw(target_name.as_ptr()), CRED_TYPE_GENERIC, Some(0), &mut credential_ptr)
                .map_err(|e| format!("Credentials not found in Credential Manager: {}", e))?;
            
            if credential_ptr.is_null() {
                return Err("Credentials not found".to_string());
            }
            
            let credential = &*credential_ptr;
            
            let token_bytes = slice::from_raw_parts(
                credential.CredentialBlob,
                credential.CredentialBlobSize as usize,
            );
            
            let token = String::from_utf8(token_bytes.to_vec())
                .map_err(|e| format!("Invalid token encoding: {}", e))?;
            
            // Get username
            let username_ptr = credential.UserName.as_ptr();
            let username = if !username_ptr.is_null() {
                let len = (0..).take_while(|&i| *username_ptr.offset(i) != 0).count();
                let username_slice = std::slice::from_raw_parts(username_ptr, len);
                String::from_utf16_lossy(username_slice)
            } else {
                String::new()
            };
            
            // Free credential  
            CredFree(credential_ptr as *const _);
            
            return Ok(GitCredentials {
                username,
                token,
            });
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        use secret_service::{SecretService, EncryptionType};
        use std::collections::HashMap;
        
        // Retrieve from Linux Secret Service
        let ss = SecretService::new(EncryptionType::Dh)
            .map_err(|e| format!("Failed to connect to Secret Service: {}", e))?;
        
        let collection = ss.get_default_collection()
            .map_err(|e| format!("Failed to get default collection: {}", e))?;
        
        let mut search_attributes = HashMap::new();
        search_attributes.insert("service", service_name.as_str());
        
        let items = collection.search_items(search_attributes)
            .map_err(|e| format!("Failed to search credentials: {}", e))?;
        
        if items.is_empty() {
            return Err("Credentials not found".to_string());
        }
        
        let item = &items[0];
        let secret = item.get_secret()
            .map_err(|e| format!("Failed to retrieve secret: {}", e))?;
        
        let token = String::from_utf8(secret)
            .map_err(|e| format!("Invalid token encoding: {}", e))?;
        
        // Get username from attributes
        let attributes = item.get_attributes()
            .map_err(|e| format!("Failed to get attributes: {}", e))?;
        
        let username = attributes.get("username")
            .ok_or("Username not found in attributes")?
            .to_string();
        
        return Ok(GitCredentials {
            username,
            token,
        });
    }
}

/// Delete git credentials from OS keychain
#[command]
pub async fn delete_git_credentials(workspace_id: String) -> Result<(), String> {
    let service_name = format!("lokus.git.{}", workspace_id);
    
    #[cfg(target_os = "macos")]
    {
        use security_framework::passwords::*;
        
        // Delete token from macOS Keychain
        delete_generic_password(&service_name, "")
            .map_err(|e| format!("Failed to delete credentials from Keychain: {}", e))?;
        
        // Delete username entry
        let username_service = format!("{}.username", workspace_id);
        let _ = delete_generic_password(&username_service, "lokus");
        // Ignore error if username entry doesn't exist
    }
    
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Security::Credentials::*;
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        
        // Delete from Windows Credential Manager
        let target_name: Vec<u16> = OsStr::new(&service_name)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        
        unsafe {
            CredDeleteW(windows::core::PCWSTR::from_raw(target_name.as_ptr()), CRED_TYPE_GENERIC, Some(0))
                .map_err(|e| format!("Failed to delete credentials from Credential Manager: {}", e))?;
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        use secret_service::{SecretService, EncryptionType};
        use std::collections::HashMap;

        // Delete from Linux Secret Service
        let ss = SecretService::new(EncryptionType::Dh)
            .map_err(|e| format!("Failed to connect to Secret Service: {}", e))?;

        let collection = ss.get_default_collection()
            .map_err(|e| format!("Failed to get default collection: {}", e))?;

        let mut search_attributes = HashMap::new();
        search_attributes.insert("service", service_name.as_str());

        let items = collection.search_items(search_attributes)
            .map_err(|e| format!("Failed to search credentials: {}", e))?;

        for item in items {
            item.delete()
                .map_err(|e| format!("Failed to delete credential: {}", e))?;
        }
    }

    Ok(())
}

/// Store iroh private key securely in OS keychain
#[command]
pub async fn store_iroh_keys(
    workspace_id: String,
    private_key: Vec<u8>,
) -> Result<(), String> {
    let service_name = format!("lokus.iroh.{}", workspace_id);

    #[cfg(target_os = "macos")]
    {
        use security_framework::passwords::*;

        // Store private key with service name
        set_generic_password(&service_name, "iroh-key", private_key.as_slice())
            .map_err(|e| format!("Failed to store iroh keys in Keychain: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Security::Credentials::*;
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        // Store in Windows Credential Manager
        let target_name: Vec<u16> = OsStr::new(&service_name)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let username_wide: Vec<u16> = OsStr::new("iroh-key")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let credential = CREDENTIALW {
            Flags: CRED_FLAGS(0),
            Type: CRED_TYPE_GENERIC,
            TargetName: windows::core::PWSTR::from_raw(target_name.as_ptr() as *mut u16),
            Comment: windows::core::PWSTR::null(),
            LastWritten: Default::default(),
            CredentialBlobSize: private_key.len() as u32,
            CredentialBlob: private_key.as_ptr() as *mut u8,
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            AttributeCount: 0,
            Attributes: std::ptr::null_mut(),
            TargetAlias: windows::core::PWSTR::null(),
            UserName: windows::core::PWSTR::from_raw(username_wide.as_ptr() as *mut u16),
        };

        unsafe {
            CredWriteW(&credential, 0)
                .map_err(|e| format!("Failed to store iroh keys in Credential Manager: {}", e))?;
        }
    }

    #[cfg(target_os = "linux")]
    {
        use secret_service::{SecretService, EncryptionType};
        use std::collections::HashMap;

        // Store in Linux Secret Service
        let ss = SecretService::new(EncryptionType::Dh)
            .map_err(|e| format!("Failed to connect to Secret Service: {}", e))?;

        let collection = ss.get_default_collection()
            .map_err(|e| format!("Failed to get default collection: {}", e))?;

        let mut attributes = HashMap::new();
        attributes.insert("service", service_name.as_str());
        attributes.insert("key-type", "iroh-key");

        collection.create_item(
            &format!("Lokus Iroh Keys for {}", workspace_id),
            attributes,
            &private_key,
            true, // Replace existing
            "application/octet-stream",
        )
        .map_err(|e| format!("Failed to store iroh keys: {}", e))?;
    }

    Ok(())
}

/// Retrieve iroh private key from OS keychain
#[command]
pub async fn retrieve_iroh_keys(
    workspace_id: String,
) -> Result<Vec<u8>, String> {
    let service_name = format!("lokus.iroh.{}", workspace_id);

    #[cfg(target_os = "macos")]
    {
        use security_framework::passwords::*;

        // Retrieve key from macOS Keychain
        let key_bytes = get_generic_password(&service_name, "iroh-key")
            .map_err(|e| format!("Iroh keys not found in Keychain: {}", e))?;

        return Ok(key_bytes);
    }

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Security::Credentials::*;
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        use std::slice;

        // Retrieve from Windows Credential Manager
        let target_name: Vec<u16> = OsStr::new(&service_name)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut credential_ptr: *mut CREDENTIALW = std::ptr::null_mut();

        unsafe {
            CredReadW(windows::core::PCWSTR::from_raw(target_name.as_ptr()), CRED_TYPE_GENERIC, Some(0), &mut credential_ptr)
                .map_err(|e| format!("Iroh keys not found in Credential Manager: {}", e))?;

            if credential_ptr.is_null() {
                return Err("Iroh keys not found".to_string());
            }

            let credential = &*credential_ptr;

            let key_bytes = slice::from_raw_parts(
                credential.CredentialBlob,
                credential.CredentialBlobSize as usize,
            ).to_vec();

            // Free credential
            CredFree(credential_ptr as *const _);

            return Ok(key_bytes);
        }
    }

    #[cfg(target_os = "linux")]
    {
        use secret_service::{SecretService, EncryptionType};
        use std::collections::HashMap;

        // Retrieve from Linux Secret Service
        let ss = SecretService::new(EncryptionType::Dh)
            .map_err(|e| format!("Failed to connect to Secret Service: {}", e))?;

        let collection = ss.get_default_collection()
            .map_err(|e| format!("Failed to get default collection: {}", e))?;

        let mut search_attributes = HashMap::new();
        search_attributes.insert("service", service_name.as_str());

        let items = collection.search_items(search_attributes)
            .map_err(|e| format!("Failed to search iroh keys: {}", e))?;

        if items.is_empty() {
            return Err("Iroh keys not found".to_string());
        }

        let item = &items[0];
        let secret = item.get_secret()
            .map_err(|e| format!("Failed to retrieve iroh keys: {}", e))?;

        return Ok(secret);
    }
}

/// Delete iroh keys from OS keychain
#[command]
pub async fn delete_iroh_keys(workspace_id: String) -> Result<(), String> {
    let service_name = format!("lokus.iroh.{}", workspace_id);

    #[cfg(target_os = "macos")]
    {
        use security_framework::passwords::*;

        // Delete key from macOS Keychain
        delete_generic_password(&service_name, "iroh-key")
            .map_err(|e| format!("Failed to delete iroh keys from Keychain: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Security::Credentials::*;
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        // Delete from Windows Credential Manager
        let target_name: Vec<u16> = OsStr::new(&service_name)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        unsafe {
            CredDeleteW(windows::core::PCWSTR::from_raw(target_name.as_ptr()), CRED_TYPE_GENERIC, Some(0))
                .map_err(|e| format!("Failed to delete iroh keys from Credential Manager: {}", e))?;
        }
    }

    #[cfg(target_os = "linux")]
    {
        use secret_service::{SecretService, EncryptionType};
        use std::collections::HashMap;

        // Delete from Linux Secret Service
        let ss = SecretService::new(EncryptionType::Dh)
            .map_err(|e| format!("Failed to connect to Secret Service: {}", e))?;

        let collection = ss.get_default_collection()
            .map_err(|e| format!("Failed to get default collection: {}", e))?;

        let mut search_attributes = HashMap::new();
        search_attributes.insert("service", service_name.as_str());

        let items = collection.search_items(search_attributes)
            .map_err(|e| format!("Failed to search iroh keys: {}", e))?;

        for item in items {
            item.delete()
                .map_err(|e| format!("Failed to delete iroh key: {}", e))?;
        }
    }

    Ok(())
}
