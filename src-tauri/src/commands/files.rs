use std::fs;
use std::path::Path;

use regex::Regex;

use crate::models::*;

/// Read a file's content as string
pub fn read_file_content(path: &str) -> Result<String, String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err("文件不存在".to_string());
    }
    if p.is_dir() {
        return Err("不能读取目录".to_string());
    }

    fs::read_to_string(p).map_err(|e| format!("读取文件失败: {}", e))
}

/// Write content to a file
pub fn write_file_content(path: &str, content: &str) -> Result<(), String> {
    let p = Path::new(path);

    // Ensure parent directory exists
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("创建父目录失败: {}", e))?;
        }
    }

    fs::write(p, content).map_err(|e| format!("写入文件失败: {}", e))
}

/// Create a new file
pub fn create_file_item(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    if p.exists() {
        return Err("文件已存在".to_string());
    }

    if let Some(parent) = p.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("创建父目录失败: {}", e))?;
        }
    }

    fs::write(p, "").map_err(|e| format!("创建文件失败: {}", e))
}

/// Create a new directory
pub fn create_directory_item(path: &str) -> Result<(), String> {
    fs::create_dir_all(Path::new(path))
        .map_err(|e| format!("创建目录失败: {}", e))
}

/// Rename a file or directory
pub fn rename_item(old_path: &str, new_name: &str) -> Result<(), String> {
    let old = Path::new(old_path);
    if !old.exists() {
        return Err("源文件不存在".to_string());
    }

    let parent = old.parent().ok_or("无法获取父目录")?;
    let new_path = parent.join(new_name);

    fs::rename(old, &new_path).map_err(|e| format!("重命名失败: {}", e))
}

/// Delete a file or directory
pub fn delete_item(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err("文件不存在".to_string());
    }

    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| format!("删除目录失败: {}", e))
    } else {
        fs::remove_file(p).map_err(|e| format!("删除文件失败: {}", e))
    }
}

/// Get word count from text
pub fn count_words(text: &str) -> WordCount {
    let total_chars = text.chars().count();
    let chinese_chars = text.chars().filter(|&c| c >= '\u{4e00}' && c <= '\u{9fff}').count();
    let lines = text.lines().count();

    // Simple word count: split by whitespace for non-CJK, count each CJK char as a word
    let words: usize = text
        .split(|c: char| c.is_whitespace() || c.is_ascii_punctuation())
        .filter(|s| !s.is_empty() && !s.chars().all(|c| c.is_ascii_punctuation()))
        .count();

    WordCount {
        total_chars,
        chinese_chars,
        words,
        lines,
    }
}

/// Export: combine all markdown files from a directory into one file
pub fn export_to_file(source_dir: &str, output_path: &str) -> Result<(), String> {
    let dir = Path::new(source_dir);
    if !dir.is_dir() {
        return Err("源目录不存在".to_string());
    }

    let mut output = String::new();
    let mut entries = collect_markdown_files(dir, 0)?;
    entries.sort();

    for entry in entries {
        let content = fs::read_to_string(&entry)
            .map_err(|e| format!("读取文件 {} 失败: {}", entry.display(), e))?;

        let relative = entry
            .strip_prefix(dir)
            .unwrap_or(&entry)
            .to_string_lossy()
            .to_string();

        output.push_str(&format!("\n<!-- {} -->\n\n", relative));
        output.push_str(&content);
        output.push_str("\n\n---\n\n");
    }

    // Write output
    if let Some(parent) = Path::new(output_path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("创建输出目录失败: {}", e))?;
        }
    }

    fs::write(output_path, &output)
        .map_err(|e| format!("写入导出文件失败: {}", e))?;

    Ok(())
}

/// Search for text across all markdown files in a project
pub fn search_in_project(root: &str, query: &str) -> Result<Vec<SearchResult>, String> {
    if query.is_empty() {
        return Ok(vec![]);
    }

    let root_path = Path::new(root);
    let md_files = collect_markdown_files(root_path, 0)?;
    let query_lower = query.to_lowercase();
    let mut results: Vec<SearchResult> = Vec::new();

    for file_path in &md_files {
        let content = fs::read_to_string(file_path)
            .map_err(|e| format!("读取文件失败: {}", e))?;

        let mut matches = Vec::new();
        for (i, line) in content.lines().enumerate() {
            let line_lower = line.to_lowercase();
            if let Some(pos) = line_lower.find(&query_lower) {
                matches.push(SearchMatch {
                    file_path: file_path.to_string_lossy().to_string(),
                    file_name: file_path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                    line_number: i + 1,
                    line_content: line.to_string(),
                    match_start: pos,
                    match_end: pos + query.len(),
                });
            }
        }

        if !matches.is_empty() {
            results.push(SearchResult {
                file_path: file_path.to_string_lossy().to_string(),
                file_name: file_path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                matches,
            });
        }
    }

    Ok(results)
}

/// Find and replace text in project files
pub fn find_and_replace(root: &str, query: &str, replacement: &str, scope_file: &str) -> Result<usize, String> {
    let root_path = Path::new(root);

    let md_files = if scope_file.is_empty() {
        collect_markdown_files(root_path, 0)?
    } else {
        let p = Path::new(scope_file);
        if p.exists() {
            vec![p.to_path_buf()]
        } else {
            return Err("文件不存在".to_string());
        }
    };

    let mut total_replaced = 0;
    let query_lower = query.to_lowercase();

    for file_path in &md_files {
        let content = fs::read_to_string(file_path)
            .map_err(|e| format!("读取文件失败: {}", e))?;

        // Case-insensitive replace while preserving original case of replacement
        let mut new_content = String::new();
        let mut last_end = 0;
        let content_lower = content.to_lowercase();
        let mut pos = 0;

        while let Some(start) = content_lower[pos..].find(&query_lower) {
            let abs_start = pos + start;
            new_content.push_str(&content[last_end..abs_start]);
            new_content.push_str(replacement);
            last_end = abs_start + query.len();
            pos = abs_start + query.len();
            total_replaced += 1;
        }

        new_content.push_str(&content[last_end..]);

        fs::write(file_path, &new_content)
            .map_err(|e| format!("写入文件失败: {}", e))?;
    }

    Ok(total_replaced)
}

/// Get the next chapter/volume number based on existing items in a directory
pub fn get_next_number(dir: &str, prefix: &str, _ext: &str) -> Result<i32, String> {
    let dir_path = Path::new(dir);
    if !dir_path.exists() {
        return Ok(1);
    }

    let mut max_num = 0;
    let read_dir = fs::read_dir(dir_path)
        .map_err(|e| format!("读取目录失败: {}", e))?;

    for entry in read_dir.filter_map(|e| e.ok()) {
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.contains(prefix) {
            continue;
        }
        // Pattern A: "第1章", "第5章 标题.md" — number after '第'
        let num_a: String = name.chars().skip_while(|c| *c != '第').skip(1).take_while(|c| c.is_digit(10)).collect();
        if let Ok(n) = num_a.parse::<i32>() {
            if n > max_num { max_num = n; }
            continue;
        }
        // Pattern B: "分类1", "角色2", "分类3" — number after prefix
        if let Some(pos) = name.find(prefix) {
            let digits: String = name[pos + prefix.len()..].chars().take_while(|c| c.is_digit(10)).collect();
            if let Ok(n) = digits.parse::<i32>() {
                if n > max_num { max_num = n; }
            }
        }
    }

    Ok(max_num + 1)
}

/// Search with advanced options (case_sensitive, whole_word, use_regex)
pub fn search_in_project_advanced(
    root: &str,
    query: &str,
    case_sensitive: bool,
    whole_word: bool,
    use_regex: bool,
) -> Result<Vec<SearchResult>, String> {
    if query.is_empty() {
        return Ok(vec![]);
    }

    let root_path = Path::new(root);
    let md_files = collect_markdown_files(root_path, 0)?;

    // Build regex pattern
    let pattern_str = if use_regex {
        query.to_string()
    } else if whole_word {
        format!(r"(?<!\w){}(?!\w)", regex::escape(query))
    } else {
        regex::escape(query)
    };

    let re = if case_sensitive {
        Regex::new(&pattern_str).map_err(|e| format!("正则表达式错误: {}", e))?
    } else {
        Regex::new(&format!("(?i){}", pattern_str))
            .map_err(|e| format!("正则表达式错误: {}", e))?
    };

    let mut results: Vec<SearchResult> = Vec::new();

    for file_path in &md_files {
        let content = fs::read_to_string(file_path)
            .map_err(|e| format!("读取文件失败: {}", e))?;

        let mut matches = Vec::new();
        for (i, line) in content.lines().enumerate() {
            for cap in re.find_iter(line) {
                matches.push(SearchMatch {
                    file_path: file_path.to_string_lossy().to_string(),
                    file_name: file_path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                    line_number: i + 1,
                    line_content: line.to_string(),
                    match_start: cap.start(),
                    match_end: cap.end(),
                });
            }
        }

        if !matches.is_empty() {
            results.push(SearchResult {
                file_path: file_path.to_string_lossy().to_string(),
                file_name: file_path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                matches,
            });
        }
    }

    Ok(results)
}

/// Find and replace with advanced options
pub fn find_and_replace_advanced(
    root: &str,
    query: &str,
    replacement: &str,
    scope_file: &str,
    case_sensitive: bool,
    whole_word: bool,
    use_regex: bool,
) -> Result<usize, String> {
    let root_path = Path::new(root);

    let md_files = if scope_file.is_empty() {
        collect_markdown_files(root_path, 0)?
    } else {
        let p = Path::new(scope_file);
        if p.exists() {
            vec![p.to_path_buf()]
        } else {
            return Err("文件不存在".to_string());
        }
    };

    // Build regex pattern
    let pattern_str = if use_regex {
        query.to_string()
    } else if whole_word {
        format!(r"(?<!\w){}(?!\w)", regex::escape(query))
    } else {
        regex::escape(query)
    };

    let re = if case_sensitive {
        Regex::new(&pattern_str).map_err(|e| format!("正则表达式错误: {}", e))?
    } else {
        Regex::new(&format!("(?i){}", pattern_str))
            .map_err(|e| format!("正则表达式错误: {}", e))?
    };

    let mut total_replaced = 0usize;

    for file_path in &md_files {
        let content = fs::read_to_string(file_path)
            .map_err(|e| format!("读取文件失败: {}", e))?;

        let new_content = re.replace_all(&content, replacement).to_string();
        let count = re.find_iter(&content).count();
        total_replaced += count;

        if count > 0 {
            fs::write(file_path, &new_content)
                .map_err(|e| format!("写入文件失败: {}", e))?;
        }
    }

    Ok(total_replaced)
}

fn collect_markdown_files(dir: &Path, depth: u32) -> Result<Vec<std::path::PathBuf>, String> {
    if depth > 10 {
        return Ok(vec![]);
    }

    let mut result = Vec::new();
    let read_dir = fs::read_dir(dir)
        .map_err(|e| format!("读取目录失败: {}", e))?;

    let mut entries: Vec<_> = read_dir
        .filter_map(|e| e.ok())
        .collect();
    entries.sort_by_key(|e| e.file_name());

    for entry in entries {
        let path = entry.path();
        if path.is_dir() {
            // Skip hidden directories
            if path.file_name().map(|n| n.to_string_lossy().starts_with('.')).unwrap_or(false) {
                continue;
            }
            result.extend(collect_markdown_files(&path, depth + 1)?);
        } else if path.extension().map(|e| e == "md").unwrap_or(false) {
            result.push(path);
        }
    }

    Ok(result)
}

/// Extract text content from a .docx file
pub fn read_docx_text(path: &str) -> Result<String, String> {
    use std::io::Read;
    let file = std::fs::File::open(std::path::Path::new(path))
        .map_err(|e| format!("打开文件失败: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("读取docx失败: {}", e))?;
    let mut xml = String::new();
    archive.by_name("word/document.xml")
        .map_err(|_| "无法读取docx内容，文件可能已损坏".to_string())?
        .read_to_string(&mut xml)
        .map_err(|e| format!("读取docx内容失败: {}", e))?;

    // Extract text from <w:t> tags
    let mut result = String::new();
    let mut pos = 0;
    let bytes = xml.as_bytes();
    while pos < bytes.len() {
        // Find "<w:t"
        match xml[pos..].find("<w:t") {
            None => break,
            Some(rel) => {
                let tag_start = pos + rel;
                // Find closing '>' of the opening tag
                match xml[tag_start..].find('>') {
                    None => break,
                    Some(gt_rel) => {
                        let content_start = tag_start + gt_rel + 1;
                        // Find "</w:t>"
                        match xml[content_start..].find("</w:t>") {
                            None => break,
                            Some(end_rel) => {
                                let text = &xml[content_start..content_start + end_rel];
                                result.push_str(text);
                                pos = content_start + end_rel + 6;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(result)
}

/// Merge all .md files in a volume directory into one output file
/// fmt: "md" | "txt" | "html"
pub fn merge_volume_export(volume_dir: &str, output_path: &str, fmt: &str) -> Result<(), String> {
    let dir = Path::new(volume_dir);
    if !dir.is_dir() {
        return Err("卷目录不存在".to_string());
    }

    let vol_name = dir.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let mut md_files: Vec<_> = std::fs::read_dir(dir)
        .map_err(|e| format!("读取目录失败: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().extension().map(|ext| ext == "md").unwrap_or(false)
        })
        .collect();
    md_files.sort_by_key(|e| e.file_name());

    let mut combined = String::new();

    match fmt {
        "html" => {
            combined.push_str("<!DOCTYPE html>\n<html>\n<head><meta charset=\"utf-8\"></head>\n<body>\n");
            combined.push_str(&format!("<h1>{}</h1>\n", vol_name));
            for entry in &md_files {
                let content = fs::read_to_string(entry.path())
                    .map_err(|e| format!("读取文件失败: {}", e))?;
                let name = entry.file_name().to_string_lossy().to_string();
                combined.push_str(&format!("<h2>{}</h2>\n", name.replace(".md", "")));
                for line in content.lines() {
                    if line.starts_with("# ") {
                        combined.push_str(&format!("<h3>{}</h3>\n", &line[2..]));
                    } else if !line.trim().is_empty() {
                        combined.push_str(&format!("<p>{}</p>\n", line));
                    }
                }
                combined.push_str("<hr/>\n");
            }
            combined.push_str("</body>\n</html>\n");
        }
        "txt" => {
            combined.push_str(&format!("{}\n\n", vol_name));
            for entry in &md_files {
                let content = fs::read_to_string(entry.path())
                    .map_err(|e| format!("读取文件失败: {}", e))?;
                let name = entry.path().file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                combined.push_str(&format!("{}\n", name));
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("# ") {
                        combined.push_str(&format!("{}\n", &trimmed[2..]));
                    } else if !trimmed.is_empty() {
                        combined.push_str(&format!("{}\n", line));
                    }
                }
                combined.push_str("\n");
            }
        }
        _ => {
            // Default: clean md format, compatible with import
            combined.push_str(&format!("{}\n\n", vol_name));
            for entry in &md_files {
                let content = fs::read_to_string(entry.path())
                    .map_err(|e| format!("读取文件失败: {}", e))?;
                let name = entry.path().file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                combined.push_str(&format!("{}\n", name));
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("# ") {
                        combined.push_str(&format!("{}\n", &trimmed[2..]));
                    } else if !trimmed.is_empty() {
                        combined.push_str(&format!("{}\n", line));
                    }
                }
                combined.push_str("\n");
            }
        }
    }

    // Ensure parent directory exists
    if let Some(parent) = Path::new(output_path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("创建输出目录失败: {}", e))?;
        }
    }

    fs::write(output_path, &combined)
        .map_err(|e| format!("写入导出文件失败: {}", e))?;

    Ok(())
}

pub fn merge_files_export(file_paths: &[String], output_path: &str, fmt: &str) -> Result<(), String> {
    let mut combined = String::new();
    let mut current_vol = String::new();

    for path in file_paths {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("读取文件失败: {}", e))?;
        let p = std::path::Path::new(path);
        let vol_name = p.parent()
            .and_then(|pp| pp.file_name())
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let name = p.file_stem().map(|s| s.to_string_lossy()).unwrap_or_default().to_string();

        match fmt {
            "html" => {
                if combined.is_empty() {
                    combined.push_str("<!DOCTYPE html>\n<html>\n<head><meta charset=\"utf-8\"></head>\n<body>\n");
                }
                if !vol_name.is_empty() && vol_name != current_vol {
                    combined.push_str(&format!("<h1>{}</h1>\n", vol_name));
                    current_vol = vol_name;
                }
                combined.push_str(&format!("<h2>{}</h2>\n", name));
                for line in content.lines() {
                    if line.starts_with("# ") {
                        combined.push_str(&format!("<h3>{}</h3>\n", &line[2..]));
                    } else if !line.trim().is_empty() {
                        combined.push_str(&format!("<p>{}</p>\n", line));
                    }
                }
                combined.push_str("<hr/>\n");
            }
            _ => {
                // txt and md: same clean format
                if !vol_name.is_empty() && vol_name != current_vol {
                    if !combined.is_empty() {
                        combined.push('\n');
                    }
                    combined.push_str(&format!("{}\n\n", vol_name));
                    current_vol = vol_name;
                }

                combined.push_str(&format!("{}\n", name));
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("# ") {
                        combined.push_str(&format!("{}\n", &trimmed[2..]));
                    } else if !trimmed.is_empty() {
                        combined.push_str(&format!("{}\n", line));
                    }
                }
                combined.push_str("\n");
            }
        }
    }

    if fmt == "html" {
        combined.push_str("</body>\n</html>\n");
    }

    // Ensure parent directory exists
    if let Some(parent) = std::path::Path::new(output_path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("创建输出目录失败: {}", e))?;
        }
    }

    fs::write(output_path, &combined)
        .map_err(|e| format!("写入导出文件失败: {}", e))?;

    Ok(())
}
