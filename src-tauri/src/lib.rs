mod ai;
mod commands;
mod models;
mod types;

use std::collections::HashMap;
use tauri::{Emitter, Manager};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};
use tauri::menu::{Menu, MenuItem};
use commands::{config, files, project, recent};
use models::*;
use types::*;
use ai::types::*;

#[tauri::command]
fn cmd_get_project_types() -> Vec<ProjectTypeDefinition> {
    get_all_project_types()
}

#[tauri::command]
fn cmd_create_project(root: String, name: String, description: String, cover_path: String) -> Result<ProjectInfo, String> {
    let project_info = project::create_project_structure(&root, &name, &description, &cover_path, false)?;
    recent::save_recent(&project_info)?;
    Ok(project_info)
}

#[tauri::command]
fn cmd_create_project_v2(
    root: String,
    name: String,
    description: String,
    cover_path: String,
    project_type: String,
    type_config: serde_json::Value,
) -> Result<ProjectInfo, String> {
    let project_info = project::create_project_structure_v2(
        &root, &name, &description, &cover_path,
        &project_type, type_config, false,
    )?;
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
fn cmd_read_file_base64(path: String) -> Result<String, String> {
    files::read_file_base64(&path)
}

#[tauri::command]
fn cmd_write_file(path: String, content: String) -> Result<(), String> {
    files::write_file_content(&path, &content)
}

#[tauri::command]
fn cmd_create_file(path: String) -> Result<(), String> {
    let path = if path.ends_with(".md") || path.ends_with(".html") {
        path
    } else {
        format!("{}.md", path)
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
        let p = std::path::Path::new(&win_path);
        if !p.exists() {
            return Err("文件或目录不存在".to_string());
        }
        if p.is_file() {
            // Use /select, to open the folder and select the file
            std::process::Command::new("explorer")
                .arg("/select,")
                .arg(&win_path)
                .spawn()
                .map_err(|e| format!("打开文件位置失败: {}", e))?;
        } else {
            // Open the folder directly
            let win_path = win_path.trim_end_matches('\\').to_string();
            std::process::Command::new("explorer")
                .arg(&win_path)
                .spawn()
                .map_err(|e| format!("打开文件夹失败: {}", e))?;
        }
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
fn cmd_open_devtools(webview_window: tauri::WebviewWindow) {
    webview_window.open_devtools();
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

// ─── AI Commands ────────────────────────────────────────────

#[tauri::command]
fn cmd_ai_get_providers() -> Vec<ProviderInfo> {
    let mut providers = ai::registry::get_all_providers();

    // Include builtin providers if a key has been imported for them
    let key_statuses = ai::key_store::get_key_statuses().unwrap_or_default();
    for bp in ai::registry::get_builtin_providers() {
        if key_statuses.get(&bp.id).copied().unwrap_or(false) {
            providers.push(bp);
        }
    }

    providers
}

#[tauri::command]
fn cmd_ai_get_key_statuses() -> Result<HashMap<String, bool>, String> {
    ai::key_store::get_key_statuses()
}

#[tauri::command]
fn cmd_ai_save_key(provider_id: String, api_key: String, endpoint: Option<String>, default_model: String) -> Result<(), String> {
    ai::key_store::save_key(&provider_id, &api_key, &endpoint.unwrap_or_default(), &default_model)
}

#[tauri::command]
fn cmd_ai_delete_key(provider_id: String) -> Result<(), String> {
    ai::key_store::delete_key(&provider_id)
}

#[tauri::command]
async fn cmd_ai_test_connection(provider_id: String, api_key: String, endpoint: Option<String>) -> Result<String, String> {
    let providers = ai::registry::get_all_providers();
    let provider = providers.iter().find(|p| p.id == provider_id)
        .ok_or_else(|| format!("未知的模型提供商: {}", provider_id))?;
    let test_model = provider.models.first()
        .map(|m| m.id.as_str())
        .unwrap_or("default");

    let key = if provider.requires_api_key && api_key.is_empty() {
        return Err("该模型需要配置 API Key，请在设置中填写后重试".into());
    } else {
        api_key
    };

    let endpoint = endpoint.unwrap_or_default();
    let effective_endpoint = if endpoint.is_empty() { &provider.default_endpoint } else { &endpoint };

    let messages = vec![
        ChatMessage { role: "user".into(), content: "Hi, respond with just \"OK\".".into() },
    ];
    let options = ChatOptions { max_tokens: Some(10), ..Default::default() };

    match ai::ai_chat(&provider_id, &key, effective_endpoint, test_model, &messages, &options).await {
        Ok(resp) => Ok(resp.content),
        Err(e) => Err(format!("{} (endpoint: {})", e.message, effective_endpoint)),
    }
}

#[tauri::command]
async fn cmd_ai_chat(
    app: tauri::AppHandle,
    provider_id: String,
    model: String,
    endpoint: Option<String>,
    messages: Vec<ChatMessage>,
    stream: bool,
) -> Result<String, String> {
    let endpoint = endpoint.unwrap_or_default();

    // Get decrypted API key (only required for providers that need it)
    let providers = ai::registry::get_all_providers();
    let provider = providers.iter().find(|p| p.id == provider_id);
    let requires_key = provider.map(|p| p.requires_api_key).unwrap_or(true);

    let api_key = if requires_key {
        ai::key_store::get_decrypted_key(&provider_id)?
            .ok_or_else(|| format!("请先在设置中为 {} 配置 API Key（或切换至本地模型）", provider_id))?
    } else {
        String::new()
    };

    let options = ChatOptions { stream, ..Default::default() };

    if stream {
        let request_id = uuid::Uuid::new_v4().to_string();
        let rid = request_id.clone();
        let app_handle = app.clone();

        tauri::async_runtime::spawn(async move {
            let _ = ai::ai_chat_stream(
                &provider_id, &api_key, &endpoint, &model, &messages, &options,
                move |chunk, done| {
                    let payload = serde_json::json!({
                        "request_id": rid,
                        "content": chunk,
                        "done": done,
                    });
                    let _ = app_handle.emit("ai:chunk", &payload);
                },
            ).await;
        });

        Ok(request_id)
    } else {
        let response = ai::ai_chat(&provider_id, &api_key, &endpoint, &model, &messages, &options).await
            .map_err(|e| e.message)?;
        Ok(response.content)
    }
}

#[tauri::command]
fn cmd_ai_get_saved_keys() -> Result<Vec<ai::types::SavedKeyInfo>, String> {
    ai::key_store::get_saved_key_infos()
}

#[tauri::command]
fn cmd_ai_get_skills() -> Vec<ai::skills::WritingSkill> {
    ai::skills::get_all_skills()
}

#[tauri::command]
fn cmd_ai_cancel(request_id: String) {
    ai::cancel_stream(&request_id);
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
            // Import built-in keys if available
            if let Err(e) = ai::key_store::import_builtin_keys() {
                log::warn!("Failed to import builtin keys: {}", e);
            }

            // System tray for boss key
            if let Ok(show_item) = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>) {
                if let Ok(quit_item) = MenuItem::with_id(app, "quit", "退出", true, None::<&str>) {
                    if let Ok(menu) = Menu::with_items(app, &[&show_item, &quit_item]) {
                        let icon = app.default_window_icon().cloned();
                        let mut builder = TrayIconBuilder::new()
                            .menu(&menu)
                            .tooltip("写作助手")
                            .on_menu_event(|app, event| {
                                match event.id.as_ref() {
                                    "show" => {
                                        if let Some(window) = app.get_webview_window("main") {
                                            let _ = window.show();
                                            let _ = window.set_focus();
                                            let _ = window.unminimize();
                                        }
                                    }
                                    "quit" => {
                                        app.exit(0);
                                    }
                                    _ => {}
                                }
                            })
                            .on_tray_icon_event(|tray, event| {
                                if let TrayIconEvent::Click {
                                    button: MouseButton::Left,
                                    button_state: MouseButtonState::Up,
                                    ..
                                } = event {
                                    if let Some(window) = tray.app_handle().get_webview_window("main") {
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                        let _ = window.unminimize();
                                    }
                                }
                            });
                        if let Some(icon) = icon {
                            builder = builder.icon(icon);
                        }
                        let _ = builder.build(app);
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd_get_project_types,
            cmd_create_project,
            cmd_create_project_v2,
            cmd_create_import_project,
            cmd_open_project,
            cmd_read_directory,
            cmd_read_file,
            cmd_read_file_base64,
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
            cmd_open_devtools,
            config::cmd_get_config,
            config::cmd_get_all_config,
            config::cmd_set_config,
            config::cmd_set_auto_start,
            config::cmd_get_config_dir,
            config::cmd_get_auto_start,
            cmd_ai_get_providers,
            cmd_ai_get_key_statuses,
            cmd_ai_save_key,
            cmd_ai_delete_key,
            cmd_ai_test_connection,
            cmd_ai_chat,
            cmd_ai_get_saved_keys,
            cmd_ai_get_skills,
            cmd_ai_cancel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
