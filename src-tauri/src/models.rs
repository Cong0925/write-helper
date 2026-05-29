use serde::{Deserialize, Serialize};

fn default_version() -> String {
    "1.0".to_string()
}

fn default_project_type() -> String {
    "novel".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub path: String,
    pub name: String,
    pub description: String,
    pub cover_path: String,
    pub created_at: String,
    pub last_opened_at: String,
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(default = "default_project_type")]
    pub project_type: String,
    #[serde(default)]
    pub type_config: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileEntry>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordCount {
    pub total_chars: usize,
    pub chinese_chars: usize,
    pub words: usize,
    pub lines: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub file_path: String,
    pub file_name: String,
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub file_path: String,
    pub file_name: String,
    pub matches: Vec<SearchMatch>,
}
