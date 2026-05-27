use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64ct::Encoding;
use rand::Rng;
use sha2::{Sha256, Digest};

const APP_SALT: &[u8] = b"writeHelper-v2-ai-keys-2026";

/// Derive a 256-bit key from machine-specific data + fixed salt.
fn derive_key() -> [u8; 32] {
    let machine_id = get_machine_id();
    let mut hasher = Sha256::new();
    hasher.update(APP_SALT);
    hasher.update(machine_id.as_bytes());
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}

fn get_machine_id() -> String {
    // Use hostname as a simple machine identifier
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "unknown-host".to_string())
}

/// Encrypt plaintext with AES-256-GCM. Returns base64(nonce + ciphertext).
pub fn encrypt(plaintext: &str) -> Result<String, String> {
    let key = derive_key();
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("创建加密器失败: {}", e))?;

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("加密失败: {}", e))?;

    // Prepend nonce to ciphertext, then base64 encode
    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(base64ct::Base64::encode_string(&combined))
}

/// Decrypt base64(nonce + ciphertext) back to plaintext.
pub fn decrypt(encoded: &str) -> Result<String, String> {
    let combined = base64ct::Base64::decode_vec(encoded)
        .map_err(|e| format!("Base64 解码失败: {}", e))?;

    if combined.len() < 13 {
        return Err("加密数据损坏".to_string());
    }

    let key = derive_key();
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("创建解密器失败: {}", e))?;

    let nonce = Nonce::from_slice(&combined[..12]);
    let ciphertext = &combined[12..];

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "解密失败：密钥不匹配或数据已损坏".to_string())?;

    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 解码失败: {}", e))
}
