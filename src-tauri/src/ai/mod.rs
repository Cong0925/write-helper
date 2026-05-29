pub mod types;
pub mod adapter;
pub mod registry;
pub mod openai_compat;
pub mod crypto;
pub mod key_store;
pub mod skills;

use std::collections::HashMap;
use std::sync::Mutex;

use once_cell::sync::Lazy;
use uuid::Uuid;

use crate::ai::adapter::ModelAdapter;
use crate::ai::openai_compat::OpenAICompatibleAdapter;
use crate::ai::registry::get_all_providers;
use crate::ai::types::*;

static STREAM_CANCELS: Lazy<Mutex<HashMap<String, bool>>> = Lazy::new(|| Mutex::new(HashMap::new()));

fn build_adapter(provider_id: &str) -> Option<Box<dyn ModelAdapter>> {
    let providers = get_all_providers();
    let provider = providers.iter().find(|p| p.id == provider_id)?;

    // Most providers use OpenAI-compatible API format
    Some(Box::new(OpenAICompatibleAdapter::new(
        &provider.id,
        &provider.name,
        &provider.default_endpoint,
        provider.models.clone(),
    )))
}

/// Start a chat completion. Returns (request_id, response_text_or_error).
/// The actual streaming is handled by Tauri events from the caller.
pub async fn ai_chat(
    provider_id: &str,
    api_key: &str,
    endpoint: &str,
    model: &str,
    messages: &[ChatMessage],
    options: &ChatOptions,
) -> Result<ChatResponse, AiError> {
    let adapter = build_adapter(provider_id)
        .ok_or_else(|| AiError { message: format!("未知的模型提供商: {}", provider_id), code: "unknown_provider".into() })?;

    adapter.chat(api_key, endpoint, model, messages, options).await
}

/// Start a streaming chat. Returns a request_id. Chunks are delivered via the on_chunk callback.
pub async fn ai_chat_stream(
    provider_id: &str,
    api_key: &str,
    endpoint: &str,
    model: &str,
    messages: &[ChatMessage],
    options: &ChatOptions,
    on_chunk: impl Fn(String, bool) + Send + Sync + 'static,
) -> Result<String, AiError> {
    let request_id = Uuid::new_v4().to_string();

    {
        let mut cancels = STREAM_CANCELS.lock().unwrap();
        cancels.insert(request_id.clone(), false);
    }

    let adapter = build_adapter(provider_id)
        .ok_or_else(|| AiError { message: format!("未知的模型提供商: {}", provider_id), code: "unknown_provider".into() })?;

    let rid = request_id.clone();
    adapter.chat_stream(api_key, endpoint, model, messages, options, &move |chunk, done| {
        let cancels = STREAM_CANCELS.lock().unwrap();
        if *cancels.get(&rid).unwrap_or(&false) {
            return;
        }
        drop(cancels);
        on_chunk(chunk, done);
    }).await?;

    // Clean up
    {
        let mut cancels = STREAM_CANCELS.lock().unwrap();
        cancels.remove(&request_id);
    }

    Ok(request_id)
}

/// Cancel an in-progress streaming request.
pub fn cancel_stream(request_id: &str) {
    let mut cancels = STREAM_CANCELS.lock().unwrap();
    if let Some(flag) = cancels.get_mut(request_id) {
        *flag = true;
    }
}
