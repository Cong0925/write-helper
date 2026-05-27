use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use crate::ai::crypto;
use crate::ai::types::{ProviderKeyConfig, SavedKeyInfo};

fn key_store_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "无法获取配置目录".to_string())?
        .join("writeHelper");
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("创建配置目录失败: {}", e))?;
    Ok(config_dir.join("ai_keys.json"))
}

/// Load all stored key configs. Returns map of provider_id -> config.
pub fn load_keys() -> Result<HashMap<String, ProviderKeyConfig>, String> {
    let path = key_store_path()?;
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("读取密钥文件失败: {}", e))?;
    Ok(serde_json::from_str::<HashMap<String, ProviderKeyConfig>>(&content).unwrap_or_else(|_| HashMap::new()))
}

/// Save a key config for a provider (encrypts the key before writing).
pub fn save_key(provider_id: &str, api_key: &str, endpoint: &str, default_model: &str) -> Result<(), String> {
    let encrypted_key = if api_key.is_empty() {
        String::new()
    } else {
        crypto::encrypt(api_key)?
    };

    let config = ProviderKeyConfig {
        encrypted_key,
        endpoint: endpoint.to_string(),
        default_model: default_model.to_string(),
    };

    let mut keys = load_keys()?;
    keys.insert(provider_id.to_string(), config);

    let path = key_store_path()?;
    let json = serde_json::to_string_pretty(&keys)
        .map_err(|e| format!("序列化密钥失败: {}", e))?;
    fs::write(&path, &json)
        .map_err(|e| format!("写入密钥文件失败: {}", e))
}

/// Delete a stored key for a provider.
pub fn delete_key(provider_id: &str) -> Result<(), String> {
    let mut keys = load_keys()?;
    keys.remove(provider_id);
    let path = key_store_path()?;
    let json = serde_json::to_string_pretty(&keys)
        .map_err(|e| format!("序列化密钥失败: {}", e))?;
    fs::write(&path, &json)
        .map_err(|e| format!("写入密钥文件失败: {}", e))
}

/// Get the decrypted API key for a provider.
pub fn get_decrypted_key(provider_id: &str) -> Result<Option<String>, String> {
    let keys = load_keys()?;
    match keys.get(provider_id) {
        Some(config) if !config.encrypted_key.is_empty() => {
            let key = crypto::decrypt(&config.encrypted_key)?;
            Ok(Some(key))
        }
        _ => Ok(None),
    }
}

/// Get key statuses — which providers have keys configured (no values).
pub fn get_key_statuses() -> Result<HashMap<String, bool>, String> {
    let keys = load_keys()?;
    Ok(keys.iter().map(|(k, v)| (k.clone(), !v.encrypted_key.is_empty())).collect())
}

/// Get all saved key configs including decrypted keys.
pub fn get_saved_key_infos() -> Result<Vec<SavedKeyInfo>, String> {
    let keys = load_keys()?;
    let mut result = Vec::new();
    for (id, config) in &keys {
        let api_key = if config.encrypted_key.is_empty() {
            String::new()
        } else {
            crypto::decrypt(&config.encrypted_key).unwrap_or_default()
        };
        result.push(SavedKeyInfo {
            provider_id: id.clone(),
            has_key: !config.encrypted_key.is_empty(),
            api_key,
            endpoint: config.endpoint.clone(),
            default_model: config.default_model.clone(),
        });
    }
    Ok(result)
}

/// Try to import a built-in key from the config directory.
/// The developer can place a `builtin_keys.json` file alongside `ai_keys.json`
/// to pre-configure a default model for users. The keys will be encrypted on import.
///
/// Format:
/// ```json
/// {
///   "builtin": {
///     "provider_id": "deepseek",
///     "api_key": "sk-xxx",
///     "endpoint": "",
///     "default_model": "deepseek-v4-flash"
///   }
/// }
/// ```
pub fn import_builtin_keys() -> Result<usize, String> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "无法获取配置目录".to_string())?
        .join("writeHelper");

    let builtin_path = config_dir.join("builtin_keys.json");
    if !builtin_path.exists() {
        return Ok(0);
    }

    let content = fs::read_to_string(&builtin_path)
        .map_err(|e| format!("读取内置密钥文件失败: {}", e))?;

    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析内置密钥文件失败: {}", e))?;

    let mut imported = 0;
    let mut keys = load_keys()?;

    // Support both single "builtin" key and array of entries
    let entries: Vec<&serde_json::Value> = if let Some(arr) = json.as_array() {
        arr.iter().collect()
    } else if let Some(obj) = json.get("builtin") {
        vec![obj]
    } else {
        vec![&json]
    };

    for entry in entries {
        let provider_id = entry.get("provider_id").and_then(|v| v.as_str()).unwrap_or("");
        if provider_id.is_empty() { continue; }

        // Skip if already configured
        if keys.contains_key(provider_id) { continue; }

        let api_key = entry.get("api_key").and_then(|v| v.as_str()).unwrap_or("");
        let endpoint = entry.get("endpoint").and_then(|v| v.as_str()).unwrap_or("");
        let default_model = entry.get("default_model").and_then(|v| v.as_str()).unwrap_or("");

        let encrypted_key = if api_key.is_empty() {
            String::new()
        } else {
            crypto::encrypt(api_key)?
        };

        keys.insert(provider_id.to_string(), ProviderKeyConfig {
            encrypted_key,
            endpoint: endpoint.to_string(),
            default_model: default_model.to_string(),
        });
        imported += 1;
    }

    if imported > 0 {
        let path = key_store_path()?;
        let json = serde_json::to_string_pretty(&keys)
            .map_err(|e| format!("序列化密钥失败: {}", e))?;
        fs::write(&path, &json)
            .map_err(|e| format!("写入密钥文件失败: {}", e))?;

        // Remove the builtin file so it's not re-imported
        let _ = fs::remove_file(&builtin_path);
    }

    Ok(imported)
}
