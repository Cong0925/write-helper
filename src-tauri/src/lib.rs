mod commands;
mod models;

use commands::{config, files, project, recent};
use models::*;

#[tauri::command]
fn cmd_create_project(root: String, name: String, description: String, cover_path: String) -> Result<ProjectInfo, String> {
    let project_info = project::create_project_structure(&root, &name, &description, &cover_path, false)?;
    recent::save_recent(&project_info)?;
    Ok(project_info)
}

#[tauri::command]
fn cmd_create_import_project(root: String, name: String) -> Result<ProjectInfo, String> {
    let project_info = project::create_project_structure(&root, &name, "", "", true)?;
    recent::save_recent(&project_info)?;
    Ok(project_info)
}

#[tauri::command]
fn cmd_open_project(root: String) -> Result<ProjectInfo, String> {
    let project_info = project::open_project(&root)?;
    recent::save_recent(&project_info)?;
    Ok(project_info)
}

#[tauri::command]
fn cmd_read_directory(path: String) -> Result<Vec<FileEntry>, String> {
    project::read_directory_tree(&path, 0)
}

#[tauri::command]
fn cmd_read_file(path: String) -> Result<String, String> {
    files::read_file_content(&path)
}

#[tauri::command]
fn cmd_write_file(path: String, content: String) -> Result<(), String> {
    files::write_file_content(&path, &content)
}

#[tauri::command]
fn cmd_create_file(path: String) -> Result<(), String> {
    let path = if !path.ends_with(".md") {
        format!("{}.md", path)
    } else {
        path
    };
    files::create_file_item(&path)
}

#[tauri::command]
fn cmd_create_directory(path: String) -> Result<(), String> {
    files::create_directory_item(&path)
}

#[tauri::command]
fn cmd_rename_item(old_path: String, new_name: String) -> Result<(), String> {
    files::rename_item(&old_path, &new_name)
}

#[tauri::command]
fn cmd_delete_item(path: String) -> Result<(), String> {
    files::delete_item(&path)
}

#[tauri::command]
fn cmd_get_recent_projects() -> Result<Vec<ProjectInfo>, String> {
    recent::get_recent()
}

#[tauri::command]
fn cmd_remove_recent_project(path: String) -> Result<(), String> {
    recent::remove_recent(&path)
}

#[tauri::command]
fn cmd_rename_project_config(path: String, new_name: String) -> Result<(), String> {
    recent::update_project_name(&path, &new_name)
}

#[tauri::command]
fn cmd_get_word_count(text: String) -> WordCount {
    files::count_words(&text)
}

#[tauri::command]
fn cmd_export_project(source_dir: String, output_path: String) -> Result<(), String> {
    files::export_to_file(&source_dir, &output_path)
}

#[tauri::command]
fn cmd_search_in_project(root: String, query: String) -> Result<Vec<SearchResult>, String> {
    files::search_in_project(&root, &query)
}

#[tauri::command]
fn cmd_find_and_replace(root: String, query: String, replacement: String, scope_file: String) -> Result<usize, String> {
    files::find_and_replace(&root, &query, &replacement, &scope_file)
}

#[tauri::command]
fn cmd_search_in_project_adv(
    root: String,
    query: String,
    case_sensitive: bool,
    whole_word: bool,
    use_regex: bool,
) -> Result<Vec<SearchResult>, String> {
    files::search_in_project_advanced(&root, &query, case_sensitive, whole_word, use_regex)
}

#[tauri::command]
fn cmd_find_and_replace_adv(
    root: String,
    query: String,
    replacement: String,
    scope_file: String,
    case_sensitive: bool,
    whole_word: bool,
    use_regex: bool,
) -> Result<usize, String> {
    files::find_and_replace_advanced(&root, &query, &replacement, &scope_file, case_sensitive, whole_word, use_regex)
}

#[tauri::command]
fn cmd_get_next_number(dir: String, prefix: String, ext: String) -> Result<i32, String> {
    files::get_next_number(&dir, &prefix, &ext)
}

#[tauri::command]
fn cmd_rename_file(old_path: String, new_path: String) -> Result<(), String> {
    let old = std::path::Path::new(&old_path);
    let new = std::path::Path::new(&new_path);
    if !old.exists() {
        return Err("源文件不存在".to_string());
    }
    if new.exists() {
        return Err("目标文件已存在".to_string());
    }
    if let Some(parent) = new.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }
    std::fs::rename(old, new).map_err(|e| format!("重命名失败: {}", e))
}

#[tauri::command]
fn cmd_merge_volume_export(volume_dir: String, output_path: String, fmt: String) -> Result<(), String> {
    files::merge_volume_export(&volume_dir, &output_path, &fmt)
}

#[tauri::command]
fn cmd_merge_files_export(file_paths: Vec<String>, output_path: String, fmt: String) -> Result<(), String> {
    files::merge_files_export(&file_paths, &output_path, &fmt)
}

#[tauri::command]
fn cmd_read_docx_text(path: String) -> Result<String, String> {
    files::read_docx_text(&path)
}

#[tauri::command]
fn cmd_open_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // Normalize forward slashes to backslashes for explorer.exe
        let win_path = path.replace('/', "\\");
        // Strip trailing separators so /select, works reliably
        let win_path = win_path.trim_end_matches('\\').to_string();
        let p = std::path::Path::new(&win_path);
        if !p.exists() {
            return Err("目录不存在".to_string());
        }
        // Open the folder directly in explorer (no /select, since that only
        // works reliably for files, not directories)
        std::process::Command::new("explorer")
            .arg(&win_path)
            .spawn()
            .map_err(|e| format!("打开文件夹失败: {}", e))?;
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        let p = std::path::Path::new(&path);
        if !p.exists() {
            return Err("目录不存在".to_string());
        }
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("打开文件夹失败: {}", e))?;
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        let p = std::path::Path::new(&path);
        if !p.exists() {
            return Err("目录不存在".to_string());
        }
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("打开文件夹失败: {}", e))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        return Err("不支持的操作系统".to_string());
    }
}

#[tauri::command]
fn cmd_delete_project_folder(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err("项目目录不存在".to_string());
    }
    std::fs::remove_dir_all(p)
        .map_err(|e| format!("删除项目目录失败: {}", e))
}

#[tauri::command]
fn cmd_move_item(old_path: String, new_dir: String) -> Result<(), String> {
    let old = std::path::Path::new(&old_path);
    if !old.exists() {
        return Err("源文件不存在".to_string());
    }
    let name = old.file_name().ok_or("无法获取文件名")?;
    let new_path = std::path::Path::new(&new_dir).join(name);
    if new_path.exists() {
        return Err("目标文件已存在".to_string());
    }
    std::fs::create_dir_all(new_path.parent().ok_or("无效目录")?)
        .map_err(|e| format!("创建目录失败: {}", e))?;
    std::fs::rename(old, &new_path).map_err(|e| format!("移动失败: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd_create_project,
            cmd_create_import_project,
            cmd_open_project,
            cmd_read_directory,
            cmd_read_file,
            cmd_write_file,
            cmd_create_file,
            cmd_create_directory,
            cmd_rename_item,
            cmd_delete_item,
            cmd_get_recent_projects,
            cmd_remove_recent_project,
            cmd_rename_project_config,
            cmd_get_word_count,
            cmd_export_project,
            cmd_search_in_project,
            cmd_search_in_project_adv,
            cmd_find_and_replace,
            cmd_find_and_replace_adv,
            cmd_get_next_number,
            cmd_rename_file,
            cmd_merge_volume_export,
            cmd_merge_files_export,
            cmd_read_docx_text,
            cmd_open_in_explorer,
            cmd_delete_project_folder,
            cmd_move_item,
            config::cmd_get_config,
            config::cmd_get_all_config,
            config::cmd_set_config,
            config::cmd_set_auto_start,
            config::cmd_get_config_dir,
            config::cmd_get_auto_start,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
