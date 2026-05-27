use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,    // "system" | "user" | "assistant"
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatOptions {
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub top_p: Option<f32>,
    pub stream: bool,
}

impl Default for ChatOptions {
    fn default() -> Self {
        ChatOptions {
            temperature: Some(0.7),
            max_tokens: Some(4096),
            top_p: None,
            stream: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub content: String,
    pub model: String,
    pub usage: Option<UsageInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageInfo {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunk {
    pub request_id: String,
    pub content: String,
    pub done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub category: String,    // "international" | "domestic" | "local" | "builtin"
    pub default_endpoint: String,
    pub models: Vec<ModelInfo>,
    pub requires_api_key: bool,     // false for local/Ollama where no auth needed
    pub requires_secret_key: bool,  // true for providers needing API Key + Secret Key (Baidu)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderKeyConfig {
    pub encrypted_key: String,
    pub endpoint: String,
    pub default_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedKeyInfo {
    pub provider_id: String,
    pub has_key: bool,
    pub api_key: String,
    pub endpoint: String,
    pub default_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiError {
    pub message: String,
    pub code: String,
}

impl std::fmt::Display for AiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl From<String> for AiError {
    fn from(s: String) -> Self {
        AiError { message: s, code: "internal_error".into() }
    }
}
