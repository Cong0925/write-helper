use serde::{Deserialize, Serialize};

/// Definition of a project type — each type defines the directory structure,
/// default files, preferred editor, and metadata schema.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectTypeDefinition {
    pub type_id: String,
    pub display_name: String,
    pub description: String,
    pub icon: String,
    pub version: String,
    pub directory_template: Vec<DirEntry>,
    pub default_files: Vec<DefaultFile>,
    pub editor_type: EditorType,
    pub enabled_panels: Vec<String>,
    pub content_root: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<DirEntry>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultFile {
    pub relative_path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EditorType {
    CodeMirror,
    TipTap,
    Mixed,
}

/// Return all registered project types.
pub fn get_all_project_types() -> Vec<ProjectTypeDefinition> {
    vec![novel_type(), wechat_article_type(), toutiao_article_type()]
}

/// Look up a project type by ID.
pub fn get_project_type(type_id: &str) -> Option<ProjectTypeDefinition> {
    get_all_project_types().into_iter().find(|t| t.type_id == type_id)
}

// ─── Novel ────────────────────────────────────────────────────────

fn novel_type() -> ProjectTypeDefinition {
    ProjectTypeDefinition {
        type_id: "novel".to_string(),
        display_name: "小说".to_string(),
        description: "长篇小说创作，分卷管理章节，支持角色、大纲、设定".to_string(),
        icon: "book".to_string(),
        version: "2.0".to_string(),
        content_root: "分卷".to_string(),
        editor_type: EditorType::CodeMirror,
        enabled_panels: vec![
            "proofread".into(), "outline".into(), "character".into(),
            "setting".into(), "material".into(),
        ],
        directory_template: vec![
            DirEntry { name: "大纲".into(), children: None },
            DirEntry { name: "分卷".into(), children: Some(vec![
                DirEntry { name: "第1卷".into(), children: None },
            ])},
            DirEntry { name: "人设".into(), children: None },
            DirEntry { name: "设定".into(), children: None },
            DirEntry { name: "素材".into(), children: None },
            DirEntry { name: "输出".into(), children: None },
        ],
        default_files: vec![
            DefaultFile {
                relative_path: "大纲/主线大纲.md".into(),
                content: "# {project_name} 大纲\n\n## 主线大纲\n\n".into(),
            },
            DefaultFile {
                relative_path: "分卷/第1卷/第1章.md".into(),
                content: "# 第1章\n\n".into(),
            },
        ],
    }
}

// ─── WeChat Article ───────────────────────────────────────────────

fn wechat_article_type() -> ProjectTypeDefinition {
    ProjectTypeDefinition {
        type_id: "wechat_article".to_string(),
        display_name: "公众号文章".to_string(),
        description: "微信公众号文章创作，支持封面、摘要、原创设置，手机预览".to_string(),
        icon: "wechat".to_string(),
        version: "2.0".to_string(),
        content_root: "articles".to_string(),
        editor_type: EditorType::CodeMirror,
        enabled_panels: vec!["proofread".into(), "material".into()],
        directory_template: vec![
            DirEntry { name: "articles".into(), children: None },
            DirEntry { name: "images".into(), children: None },
            DirEntry { name: "素材".into(), children: None },
            DirEntry { name: "输出".into(), children: None },
        ],
        default_files: vec![
            DefaultFile {
                relative_path: "articles/未命名文章.html".into(),
                content: "<h1>文章标题</h1>\n\n".into(),
            },
        ],
    }
}

// ─── Toutiao Article ──────────────────────────────────────────────

fn toutiao_article_type() -> ProjectTypeDefinition {
    ProjectTypeDefinition {
        type_id: "toutiao_article".to_string(),
        display_name: "头条文章".to_string(),
        description: "头条号文章创作，支持多标题、多封面、广告设置、分类".to_string(),
        icon: "toutiao".to_string(),
        version: "2.0".to_string(),
        content_root: "articles".to_string(),
        editor_type: EditorType::CodeMirror,
        enabled_panels: vec!["proofread".into(), "material".into()],
        directory_template: vec![
            DirEntry { name: "articles".into(), children: None },
            DirEntry { name: "images".into(), children: None },
            DirEntry { name: "素材".into(), children: None },
            DirEntry { name: "输出".into(), children: None },
        ],
        default_files: vec![
            DefaultFile {
                relative_path: "articles/未命名文章.html".into(),
                content: "<h1>文章标题</h1>\n\n".into(),
            },
        ],
    }
}
