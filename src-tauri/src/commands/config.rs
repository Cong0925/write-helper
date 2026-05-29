use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Default)]
struct AppConfig {
    data: HashMap<String, String>,
}

fn get_config_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "无法获取配置目录".to_string())?
        .join("writeHelper");
    fs::create_dir_all(&config_dir).map_err(|e| format!("创建配置目录失败: {}", e))?;
    Ok(config_dir.join("config.json"))
}

fn read_config(path: &PathBuf) -> AppConfig {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn cmd_get_config(key: String) -> Result<String, String> {
    let path = get_config_path()?;
    let config = read_config(&path);
    Ok(config.data.get(&key).cloned().unwrap_or_default())
}

#[tauri::command]
pub fn cmd_get_all_config() -> Result<HashMap<String, String>, String> {
    let path = get_config_path()?;
    let config = read_config(&path);
    Ok(config.data)
}

#[tauri::command]
pub fn cmd_set_config(key: String, value: String) -> Result<(), String> {
    let path = get_config_path()?;
    let mut config = read_config(&path);
    config.data.insert(key, value);
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("写入配置文件失败: {}", e))
}

// ===== Auto-start via Windows Registry =====

const AUTO_START_KEY: &str = "writeHelper";

#[tauri::command]
pub fn cmd_set_auto_start(enabled: bool) -> Result<(), String> {
    let exe_path = std::env::current_exe().map_err(|e| format!("获取程序路径失败: {}", e))?;
    let exe_str = exe_path.to_string_lossy().to_string();

    if enabled {
        let output = std::process::Command::new("reg")
            .args([
                "add", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v", AUTO_START_KEY,
                "/t", "REG_SZ",
                "/d", &exe_str,
                "/f",
            ])
            .output()
            .map_err(|e| format!("写入注册表失败: {}", e))?;
        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(format!("写入注册表失败: {}", err));
        }
    } else {
        let output = std::process::Command::new("reg")
            .args([
                "delete", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v", AUTO_START_KEY,
                "/f",
            ])
            .output()
            .map_err(|e| format!("删除注册表项失败: {}", e))?;
        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            // Ignore "not found" errors — the key may already be gone
            if !err.contains("does not exist") && !err.contains("找不到") {
                return Err(format!("删除注册表项失败: {}", err));
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn cmd_get_config_dir() -> Result<String, String> {
    let path = get_config_path()?;
    Ok(path.parent().unwrap_or(&path).to_string_lossy().to_string())
}

#[tauri::command]
pub fn cmd_get_auto_start() -> Result<bool, String> {
    let output = std::process::Command::new("reg")
        .args([
            "query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
            "/v", AUTO_START_KEY,
        ])
        .output()
        .map_err(|e| format!("查询注册表失败: {}", e))?;
    Ok(output.status.success())
}
