use std::fs;
use std::path::Path;

use crate::models::*;
use crate::types::*;

const PROJECT_CONFIG_DIR: &str = ".writinghelper";
const PROJECT_CONFIG_FILE: &str = "project.json";

fn create_dirs_recursive(root: &Path, entries: &[DirEntry]) -> Result<(), String> {
    for entry in entries {
        let dir_path = root.join(&entry.name);
        fs::create_dir_all(&dir_path)
            .map_err(|e| format!("创建目录 {} 失败: {}", entry.name, e))?;
        if let Some(ref children) = entry.children {
            create_dirs_recursive(&dir_path, children)?;
        }
    }
    Ok(())
}

/// Create the standard project directory structure
/// If skip_defaults is true, default files are not created (used for import).
pub fn create_project_structure(
    root: &str,
    name: &str,
    description: &str,
    cover_path: &str,
    skip_defaults: bool,
) -> Result<ProjectInfo, String> {
    create_project_structure_v2(root, name, description, cover_path, "novel", serde_json::Value::Null, skip_defaults)
}

/// Create project structure based on project type.
pub fn create_project_structure_v2(
    root: &str,
    name: &str,
    description: &str,
    cover_path: &str,
    project_type: &str,
    type_config: serde_json::Value,
    skip_defaults: bool,
) -> Result<ProjectInfo, String> {
    let root_path = Path::new(root);
    let type_def = get_project_type(project_type)
        .ok_or_else(|| format!("未知的项目类型: {}", project_type))?;

    // Create .writinghelper directory
    let config_dir = root_path.join(PROJECT_CONFIG_DIR);
    fs::create_dir_all(&config_dir).map_err(|e| format!("无法创建配置目录: {}", e))?;

    // Create project.json
    let now = chrono_now();
    let project = ProjectInfo {
        path: root.to_string(),
        name: name.to_string(),
        description: description.to_string(),
        cover_path: cover_path.to_string(),
        created_at: now.clone(),
        last_opened_at: now,
        version: type_def.version.clone(),
        project_type: project_type.to_string(),
        type_config,
    };

    let config_path = config_dir.join(PROJECT_CONFIG_FILE);
    let config_json = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("序列化项目配置失败: {}", e))?;
    fs::write(&config_path, &config_json)
        .map_err(|e| format!("写入项目配置失败: {}", e))?;

    // Create directories from type template
    create_dirs_recursive(root_path, &type_def.directory_template)?;

    // Create default files from type template (skip for import)
    if !skip_defaults {
        for file_def in &type_def.default_files {
            let content = file_def.content.replace("{project_name}", name);
            let file_path = root_path.join(&file_def.relative_path);
            if let Some(parent) = file_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("创建父目录失败: {}", e))?;
            }
            fs::write(&file_path, &content)
                .map_err(|e| format!("创建文件 {} 失败: {}", file_def.relative_path, e))?;
        }
    }

    Ok(project)
}

/// Validate and open a project. Auto-migrates V1 projects by adding missing fields.
pub fn open_project(root: &str) -> Result<ProjectInfo, String> {
    let config_path = Path::new(root).join(PROJECT_CONFIG_DIR).join(PROJECT_CONFIG_FILE);

    if !config_path.exists() {
        return Err("此目录不是有效的写作助手项目（未找到 .writinghelper/project.json）".to_string());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取项目配置失败: {}", e))?;

    let mut needs_migration = false;

    // Parse with fallback for old projects missing new fields
    let mut project: ProjectInfo = serde_json::from_str(&content)
        .unwrap_or_else(|_| {
            needs_migration = true;
            // Fallback: parse as JSON value and fill defaults
            let v: serde_json::Value = serde_json::from_str(&content).unwrap_or_default();
            ProjectInfo {
                path: v.get("path").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                name: v.get("name").and_then(|s| s.as_str()).unwrap_or("未知项目").to_string(),
                description: v.get("description").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                cover_path: v.get("coverPath").or_else(|| v.get("cover_path")).and_then(|s| s.as_str()).unwrap_or("").to_string(),
                created_at: v.get("createdAt").or_else(|| v.get("created_at")).and_then(|s| s.as_str()).unwrap_or("").to_string(),
                last_opened_at: v.get("lastOpenedAt").or_else(|| v.get("last_opened_at")).and_then(|s| s.as_str()).unwrap_or("").to_string(),
                version: v.get("version").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                project_type: v.get("projectType").or_else(|| v.get("project_type")).and_then(|s| s.as_str()).unwrap_or("").to_string(),
                type_config: v.get("typeConfig").or_else(|| v.get("type_config")).cloned().unwrap_or(serde_json::Value::Null),
            }
        });

    // Auto-migrate V1 projects: detect missing type/version fields
    if project.version.is_empty() {
        project.version = "1.0".to_string();
        needs_migration = true;
    }
    if project.project_type.is_empty() {
        project.project_type = "novel".to_string();
        needs_migration = true;
    }

    // If the project directory was moved, correct the stored path
    if project.path != root {
        project.path = root.to_string();
        needs_migration = true;
    }

    // Update last opened time
    project.last_opened_at = chrono_now();

    // Write back if migration happened
    if needs_migration {
        project.version = "2.0".to_string();
        let updated = serde_json::to_string_pretty(&project)
            .map_err(|e| format!("序列化项目配置失败: {}", e))?;
        fs::write(&config_path, &updated)
            .map_err(|e| format!("更新项目配置失败: {}", e))?;
    } else {
        // Just update last opened time
        let updated = serde_json::to_string_pretty(&project)
            .map_err(|e| format!("序列化项目配置失败: {}", e))?;
        fs::write(&config_path, &updated)
            .map_err(|e| format!("更新项目配置失败: {}", e))?;
    }

    Ok(project)
}

/// Natural number comparison for Chinese chapter/volume names (e.g. "第2章" < "第10章")
/// Only uses the first consecutive run of digits, ignoring later numbers
/// like dates or revision numbers (e.g. "第1章 修改记录5-25" → "1")
fn natural_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    let a_first = first_number(a);
    let b_first = first_number(b);
    match (a_first, b_first) {
        (Some(an), Some(bn)) if an != bn => an.cmp(&bn),
        _ => a.cmp(b),
    }
}

fn first_number(s: &str) -> Option<u32> {
    let mut digits = String::new();
    let mut found = false;
    for c in s.chars() {
        if c.is_ascii_digit() {
            digits.push(c);
            found = true;
        } else if found {
            // First run of digits ended
            break;
        }
    }
    digits.parse().ok()
}

/// Read directory contents for the file tree
pub fn read_directory_tree(path: &str, depth: u32) -> Result<Vec<FileEntry>, String> {
    if depth > 5 {
        return Ok(vec![]); // Prevent infinite recursion
    }

    let dir = Path::new(path);
    if !dir.is_dir() {
        return Err("路径不是目录".to_string());
    }

    let mut entries = Vec::new();
    let dir_entries = fs::read_dir(dir)
        .map_err(|e| format!("读取目录失败: {}", e))?;

    let mut file_list: Vec<_> = dir_entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            // Skip hidden files and directories (starting with .)
            !name.starts_with('.')
        })
        .collect();

    // Sort: directories first, then by natural numeric order
    file_list.sort_by(|a, b| {
        let a_is_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let b_is_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
        if a_is_dir != b_is_dir {
            return b_is_dir.cmp(&a_is_dir);
        }
        let a_name = a.file_name().to_string_lossy().to_string();
        let b_name = b.file_name().to_string_lossy().to_string();
        natural_cmp(&a_name, &b_name)
    });

    for entry in file_list {
        let name = entry.file_name().to_string_lossy().to_string();
        let path = entry.path().to_string_lossy().to_string();
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let modified = entry.metadata().ok().and_then(|m| {
            m.modified().ok().map(|t| {
                let d = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                let secs = d.as_secs();
                let days = secs / 86400;
                let time_secs = secs % 86400;
                let hours = time_secs / 3600;
                let minutes = (time_secs % 3600) / 60;
                let seconds = time_secs % 60;
                let (year, month, day) = days_to_date(days as i64);
                format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", year, month, day, hours, minutes, seconds)
            })
        });

        let children = if is_dir {
            Some(read_directory_tree(&path, depth + 1).unwrap_or_default())
        } else {
            None
        };

        entries.push(FileEntry {
            name,
            path,
            is_dir,
            children,
            modified,
        });
    }

    Ok(entries)
}

fn chrono_now() -> String {
    // Simple ISO 8601 without chrono dependency
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();

    // Calculate date (simple approach without external crate)
    let days = secs / 86400;
    let time_secs = secs % 86400;
    let hours = time_secs / 3600;
    let minutes = (time_secs % 3600) / 60;
    let seconds = time_secs % 60;

    // Calculate year/month/day from days since epoch
    let (year, month, day) = days_to_date(days as i64);

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}",
        year, month, day, hours, minutes, seconds
    )
}

fn days_to_date(mut days: i64) -> (i64, u32, u32) {
    // Algorithm from http://howardhinnant.github.io/date_algorithms.html
    days += 719468;
    let era = if days >= 0 { days } else { days - 146096 } / 146097;
    let doe = days - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m as u32, d as u32)
}
