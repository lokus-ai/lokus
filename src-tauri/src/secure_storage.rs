use std::path::PathBuf;
use std::fs;
use serde::{Serialize, Deserialize};
use aes_gcm::{Aes256Gcm, aead::{Aead, KeyInit}};
use argon2::{Argon2, password_hash::rand_core::OsRng};
use rand::RngCore;
use machine_uid;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SecureStorageError {
    #[error("Encryption error: {0}")]
    Encryption(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Device ID error: {0}")]
    DeviceId(String),
    #[error("Key derivation error: {0}")]
    KeyDerivation(String),
}

#[derive(Serialize, Deserialize)]
struct EncryptedData {
    nonce: Vec<u8>,
    ciphertext: Vec<u8>,
    salt: Vec<u8>,
}

#[derive(Serialize, Deserialize)]
pub struct SessionInfo {
    pub created_at: u64,
    pub last_accessed: u64,
    pub device_id: String,
    pub session_id: String,
}

pub struct SecureStorage {
    base_path: PathBuf,
    device_id: String,
}

impl SecureStorage {
    pub fn new() -> Result<Self, SecureStorageError> {
        let home_dir = dirs::home_dir().ok_or_else(|| {
            SecureStorageError::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Failed to get home directory"
            ))
        })?;

        let base_path = home_dir.join(".lokus").join("secure");

        // Create secure directory with restrictive permissions
        if !base_path.exists() {
            fs::create_dir_all(&base_path)?;

            // Set restrictive permissions (owner only: 700)
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&base_path, fs::Permissions::from_mode(0o700))?;
            }
        }

        // Get device-specific identifier
        let device_id = machine_uid::get()
            .map_err(|e| SecureStorageError::DeviceId(format!("Failed to get device ID: {}", e)))?;

        Ok(Self {
            base_path,
            device_id,
        })
    }

    /// Derive encryption key from device ID and salt
    fn derive_key(&self, salt: &[u8]) -> Result<[u8; 32], SecureStorageError> {
        let argon2 = Argon2::default();

        // Use device ID as password input
        let password = self.device_id.as_bytes();

        // Use provided salt (ensure it's 16 bytes)
        let mut salt_array = [0u8; 16];
        if salt.len() >= 16 {
            salt_array.copy_from_slice(&salt[..16]);
        } else {
            salt_array[..salt.len()].copy_from_slice(salt);
        }

        // Derive key using Argon2 directly into output buffer
        let mut key = [0u8; 32];
        argon2.hash_password_into(password, &salt_array, &mut key)
            .map_err(|e| SecureStorageError::KeyDerivation(format!("Key derivation failed: {}", e)))?;

        Ok(key)
    }

    /// Encrypt data using AES-256-GCM with device-bound key
    pub fn encrypt_data<T: Serialize>(&self, data: &T) -> Result<Vec<u8>, SecureStorageError> {
        // Serialize data
        let plaintext = serde_json::to_vec(data)?;

        // Generate random salt and nonce
        let mut salt = [0u8; 16];
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut salt);
        OsRng.fill_bytes(&mut nonce_bytes);

        // Derive encryption key
        let key_bytes = self.derive_key(&salt)?;
        let key = &key_bytes[..];

        // Encrypt
        let cipher = Aes256Gcm::new(key.into());
        let nonce = aes_gcm::Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher.encrypt(nonce, plaintext.as_ref())
            .map_err(|e| SecureStorageError::Encryption(format!("Encryption failed: {}", e)))?;

        // Package encrypted data
        let encrypted_data = EncryptedData {
            nonce: nonce_bytes.to_vec(),
            ciphertext,
            salt: salt.to_vec(),
        };

        // Serialize encrypted package
        let encrypted_bytes = serde_json::to_vec(&encrypted_data)?;

        Ok(encrypted_bytes)
    }

    /// Decrypt data using AES-256-GCM with device-bound key
    pub fn decrypt_data<T: for<'de> Deserialize<'de>>(&self, encrypted_data: &[u8]) -> Result<T, SecureStorageError> {
        // Deserialize encrypted package
        let encrypted_data: EncryptedData = serde_json::from_slice(encrypted_data)?;

        // Derive decryption key using stored salt
        let key_bytes = self.derive_key(&encrypted_data.salt)?;
        let key = &key_bytes[..];

        // Decrypt
        let cipher = Aes256Gcm::new(key.into());
        let nonce = aes_gcm::Nonce::from_slice(&encrypted_data.nonce);
        let plaintext = cipher.decrypt(nonce, encrypted_data.ciphertext.as_ref())
            .map_err(|e| SecureStorageError::Encryption(format!("Decryption failed: {}", e)))?;

        // Deserialize decrypted data
        let data: T = serde_json::from_slice(&plaintext)?;

        Ok(data)
    }

    /// Store encrypted data to file
    pub fn store<T: Serialize>(&self, key: &str, data: &T) -> Result<(), SecureStorageError> {
        let encrypted_data = self.encrypt_data(data)?;
        let file_path = self.base_path.join(format!("{}.sec", key));

        fs::write(&file_path, encrypted_data)?;

        // Set restrictive file permissions (owner only: 600)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&file_path, fs::Permissions::from_mode(0o600))?;
        }

        println!("🔒 Securely stored data for key: {}", key);
        Ok(())
    }

    /// Retrieve and decrypt data from file
    pub fn retrieve<T: for<'de> Deserialize<'de>>(&self, key: &str) -> Result<Option<T>, SecureStorageError> {
        let file_path = self.base_path.join(format!("{}.sec", key));

        if !file_path.exists() {
            return Ok(None);
        }

        let encrypted_data = fs::read(&file_path)?;
        let data = self.decrypt_data(&encrypted_data)?;

        println!("🔓 Successfully retrieved secure data for key: {}", key);
        Ok(Some(data))
    }

    /// Delete stored data
    pub fn delete(&self, key: &str) -> Result<(), SecureStorageError> {
        let file_path = self.base_path.join(format!("{}.sec", key));

        if file_path.exists() {
            fs::remove_file(&file_path)?;
            println!("🗑️ Deleted secure data for key: {}", key);
        }

        Ok(())
    }

    /// Store session information
    pub fn store_session(&self, session: &SessionInfo) -> Result<(), SecureStorageError> {
        self.store("session", session)
    }

    /// Retrieve session information
    pub fn get_session(&self) -> Result<Option<SessionInfo>, SecureStorageError> {
        self.retrieve("session")
    }

    /// Update session last accessed time
    pub fn update_session_access(&self) -> Result<(), SecureStorageError> {
        if let Some(mut session) = self.get_session()? {
            session.last_accessed = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            self.store_session(&session)?;
        }
        Ok(())
    }

    /// Check if session is valid (not expired)
    pub fn is_session_valid(&self) -> Result<bool, SecureStorageError> {
        if let Some(session) = self.get_session()? {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();

            // Session expires after 30 days of inactivity
            let session_timeout = 30 * 24 * 60 * 60; // 30 days in seconds

            // Check if device ID matches (security check)
            if session.device_id != self.device_id {
                println!("⚠️ Session device ID mismatch - possible token theft attempt");
                return Ok(false);
            }

            // Check if session is not expired
            Ok(now - session.last_accessed < session_timeout)
        } else {
            Ok(false)
        }
    }

    /// Create new session
    pub fn create_session(&self) -> Result<SessionInfo, SecureStorageError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let session_id = uuid::Uuid::new_v4().to_string();

        let session = SessionInfo {
            created_at: now,
            last_accessed: now,
            device_id: self.device_id.clone(),
            session_id,
        };

        self.store_session(&session)?;

        println!("🆔 Created new secure session: {}", session.session_id);
        Ok(session)
    }

    /// Clear all stored data (for logout)
    pub fn clear_all(&self) -> Result<(), SecureStorageError> {
        if self.base_path.exists() {
            for entry in fs::read_dir(&self.base_path)? {
                let entry = entry?;
                if entry.path().extension().and_then(|s| s.to_str()) == Some("sec") {
                    fs::remove_file(entry.path())?;
                }
            }
            println!("🧹 Cleared all secure storage data");
        }
        Ok(())
    }
}

// Deprecated: Sync token commands removed.
// Sync now uses auth tokens from AuthManager via get_auth_token command.
// The dual token system caused auth-sync disconnect issues.

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Serialize, Deserialize};

    #[derive(Serialize, Deserialize, PartialEq, Debug)]
    struct TestData {
        token: String,
        expires_at: u64,
    }

    #[test]
    fn test_encrypt_decrypt() {
        let storage = SecureStorage::new().unwrap();

        let test_data = TestData {
            token: "test_token_12345".to_string(),
            expires_at: 1234567890,
        };

        // Test encryption and decryption
        let encrypted = storage.encrypt_data(&test_data).unwrap();
        let decrypted: TestData = storage.decrypt_data(&encrypted).unwrap();

        assert_eq!(test_data, decrypted);
    }

    #[test]
    fn test_store_retrieve() {
        let storage = SecureStorage::new().unwrap();

        let test_data = TestData {
            token: "stored_token_12345".to_string(),
            expires_at: 1234567890,
        };

        // Store data
        storage.store("test_key", &test_data).unwrap();

        // Retrieve data
        let retrieved: Option<TestData> = storage.retrieve("test_key").unwrap();
        assert_eq!(Some(test_data), retrieved);

        // Clean up
        storage.delete("test_key").unwrap();
    }
}