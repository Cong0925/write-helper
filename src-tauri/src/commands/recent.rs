use std::fs;
use std::path::PathBuf;

use crate::models::*;

const RECENT_FILE_NAME: &str = "recent_projects.json";

/// Get the path to the recent projects config file
fn recent_file_path() -> Result<PathBuf, String> {
    let mut path = dirs_config_path()?;
    fs::create_dir_all(&path).map_err(|e| format!("创建配置目录失败: {}", e))?;
    path.push(RECENT_FILE_NAME);
    Ok(path)
}

fn dirs_config_path() -> Result<PathBuf, String> {
    // Use a platform-appropriate config directory
    if let Some(dir) = dirs::data_local_dir() {
        Ok(dir.join("write-helper"))
    } else {
        Err("无法获取应用数据目录".to_string())
    }
}

/// Get list of recent projects
pub fn get_recent() -> Result<Vec<ProjectInfo>, String> {
    let path = recent_file_path()?;
    if !path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("读取最近项目列表失败: {}", e))?;

    let projects: Vec<ProjectInfo> = serde_json::from_str(&content)
        .unwrap_or_else(|_| {
            // Fallback: try to parse with default values for new fields
            let arr: Vec<serde_json::Value> = serde_json::from_str(&content).unwrap_or_default();
            arr.into_iter().map(|v| ProjectInfo {
                path: v.get("path").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                name: v.get("name").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                description: v.get("description").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                cover_path: v.get("cover_path").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                created_at: v.get("created_at").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                last_opened_at: v.get("last_opened_at").and_then(|s| s.as_str()).unwrap_or("").to_string(),
            }).collect()
        });

    // Filter out projects whose directories no longer exist
    let valid: Vec<ProjectInfo> = projects
        .into_iter()
        .filter(|p| PathBuf::from(&p.path).join(".writinghelper/project.json").exists())
        .collect();

    Ok(valid)
}

/// Remove a project from recent list by path
pub fn remove_recent(path: &str) -> Result<(), String> {
    let mut recent = get_recent()?;
    recent.retain(|p| p.path != path);
    let content = serde_json::to_string_pretty(&recent)
        .map_err(|e| format!("序列化最近项目列表失败: {}", e))?;
    fs::write(recent_file_path()?, &content)
        .map_err(|e| format!("保存最近项目列表失败: {}", e))
}

/// Update project name in project.json
pub fn update_project_name(path: &str, new_name: &str) -> Result<(), String> {
    let config_path = std::path::Path::new(path)
        .join(".writinghelper")
        .join("project.json");
    if !config_path.exists() {
        return Err("项目配置文件不存在".to_string());
    }
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取项目配置失败: {}", e))?;
    let mut project: ProjectInfo = serde_json::from_str(&content)
        .map_err(|_| "解析项目配置失败".to_string())?;
    project.name = new_name.to_string();
    let updated = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("序列化项目配置失败: {}", e))?;
    fs::write(&config_path, &updated)
        .map_err(|e| format!("写入项目配置失败: {}", e))?;
    // Also update in recent list
    let mut recent = get_recent()?;
    for p in &mut recent {
        if p.path == path {
            p.name = new_name.to_string();
            break;
        }
    }
    let r_content = serde_json::to_string_pretty(&recent)
        .map_err(|e| format!("序列化最近项目列表失败: {}", e))?;
    fs::write(recent_file_path()?, &r_content)
        .map_err(|e| format!("保存最近项目列表失败: {}", e))?;
    Ok(())
}

/// Save a project to recent list
pub fn save_recent(project: &ProjectInfo) -> Result<(), String> {
    let mut recent = get_recent()?;

    // Remove if already exists (to update position)
    recent.retain(|p| p.path != project.path);
    // Insert at front
    recent.insert(0, project.clone());
    // Keep max 10
    recent.truncate(10);

    let content = serde_json::to_string_pretty(&recent)
        .map_err(|e| format!("序列化最近项目列表失败: {}", e))?;

    fs::write(recent_file_path()?, &content)
        .map_err(|e| format!("保存最近项目列表失败: {}", e))
}
