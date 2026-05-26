use std::fs;
use std::path::Path;

use crate::models::*;

const PROJECT_CONFIG_DIR: &str = ".writinghelper";
const PROJECT_CONFIG_FILE: &str = "project.json";

/// Create the standard project directory structure
/// If skip_defaults is true, the default 第1卷/第1章.md is not created (used for import).
pub fn create_project_structure(root: &str, name: &str, description: &str, cover_path: &str, skip_defaults: bool) -> Result<ProjectInfo, String> {
    let root_path = Path::new(root);

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
    };

    let config_path = config_dir.join(PROJECT_CONFIG_FILE);
    let config_json = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("序列化项目配置失败: {}", e))?;
    fs::write(&config_path, &config_json)
        .map_err(|e| format!("写入项目配置失败: {}", e))?;

    // Create standard directories
    let dirs = ["大纲", "分卷", "人设", "设定", "素材", "输出"];
    for dir in &dirs {
        fs::create_dir_all(root_path.join(dir))
            .map_err(|e| format!("创建目录 {} 失败: {}", dir, e))?;
    }

    // Create initial outline file
    let outline_content = format!("# {} 大纲\n\n## 主线大纲\n\n", name);
    fs::write(root_path.join("大纲/主线大纲.md"), &outline_content)
        .map_err(|e| format!("创建大纲文件失败: {}", e))?;

    // Create default 第1卷/第1章 (skipped for import)
    if !skip_defaults {
        let volume_dir = root_path.join("分卷/第1卷");
        fs::create_dir_all(&volume_dir)
            .map_err(|e| format!("创建第1卷失败: {}", e))?;
        let chapter_content = format!("# 第1章\n\n");
        fs::write(volume_dir.join("第1章.md"), &chapter_content)
            .map_err(|e| format!("创建第1章失败: {}", e))?;
    }

    Ok(project)
}

/// Validate and open a project
pub fn open_project(root: &str) -> Result<ProjectInfo, String> {
    let config_path = Path::new(root).join(PROJECT_CONFIG_DIR).join(PROJECT_CONFIG_FILE);

    if !config_path.exists() {
        return Err("此目录不是有效的写作助手项目（未找到 .writinghelper/project.json）".to_string());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取项目配置失败: {}", e))?;

    // Parse with fallback for old projects missing new fields
    let mut project: ProjectInfo = serde_json::from_str(&content)
        .unwrap_or_else(|_| {
            // Fallback: parse as JSON value and fill defaults
            let v: serde_json::Value = serde_json::from_str(&content).unwrap_or_default();
            ProjectInfo {
                path: v.get("path").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                name: v.get("name").and_then(|s| s.as_str()).unwrap_or("未知项目").to_string(),
                description: v.get("description").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                cover_path: v.get("cover_path").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                created_at: v.get("created_at").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                last_opened_at: v.get("last_opened_at").and_then(|s| s.as_str()).unwrap_or("").to_string(),
            }
        });

    // Update last opened time
    project.last_opened_at = chrono_now();
    let updated = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("序列化项目配置失败: {}", e))?;
    fs::write(&config_path, &updated)
        .map_err(|e| format!("更新项目配置失败: {}", e))?;

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
