use async_trait::async_trait;
use crate::ai::adapter::ModelAdapter;
use crate::ai::types::*;

/// Adapter for any OpenAI-compatible API (OpenAI, DeepSeek, Zhipu, Qwen, Moonshot, Ollama, etc.)
pub struct OpenAICompatibleAdapter {
    provider_id: String,
    provider_name: String,
    default_endpoint: String,
    models: Vec<ModelInfo>,
}

impl OpenAICompatibleAdapter {
    pub fn new(
        provider_id: &str,
        provider_name: &str,
        default_endpoint: &str,
        models: Vec<ModelInfo>,
    ) -> Self {
        OpenAICompatibleAdapter {
            provider_id: provider_id.to_string(),
            provider_name: provider_name.to_string(),
            default_endpoint: default_endpoint.to_string(),
            models,
        }
    }
}

#[async_trait]
impl ModelAdapter for OpenAICompatibleAdapter {
    fn provider_id(&self) -> &str { &self.provider_id }
    fn provider_name(&self) -> &str { &self.provider_name }
    fn default_endpoint(&self) -> &str { &self.default_endpoint }
    fn default_models(&self) -> Vec<ModelInfo> { self.models.clone() }

    async fn chat(
        &self,
        api_key: &str,
        endpoint: &str,
        model: &str,
        messages: &[ChatMessage],
        options: &ChatOptions,
    ) -> Result<ChatResponse, AiError> {
        let ep = if endpoint.is_empty() { &self.default_endpoint } else { endpoint };
        let url = format!("{}/chat/completions", ep.trim_end_matches('/'));

        let body = serde_json::json!({
            "model": model,
            "messages": messages.iter().map(|m| serde_json::json!({
                "role": m.role,
                "content": m.content,
            })).collect::<Vec<_>>(),
            "temperature": options.temperature.unwrap_or(0.7),
            "max_tokens": options.max_tokens.unwrap_or(4096),
            "top_p": options.top_p,
        });

        let client = reqwest::Client::new();
        let resp = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AiError { message: format!("请求失败: {}", e), code: "network_error".into() })?;

        let status = resp.status();
        let body_text = resp.text().await
            .map_err(|e| AiError { message: format!("读取响应失败: {}", e), code: "read_error".into() })?;

        if !status.is_success() {
            return Err(AiError {
                message: format!("API 返回错误 ({}): {}", status.as_u16(), body_text),
                code: "api_error".into(),
            });
        }

        let json: serde_json::Value = serde_json::from_str(&body_text)
            .map_err(|e| AiError { message: format!("JSON 解析失败: {}", e), code: "parse_error".into() })?;

        let content = json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let usage = match (
            json["usage"]["prompt_tokens"].as_u64(),
            json["usage"]["completion_tokens"].as_u64(),
            json["usage"]["total_tokens"].as_u64(),
        ) {
            (Some(p), Some(c), Some(t)) => Some(UsageInfo {
                prompt_tokens: p as u32,
                completion_tokens: c as u32,
                total_tokens: t as u32,
            }),
            _ => None,
        };

        Ok(ChatResponse { content, model: model.to_string(), usage })
    }

    async fn chat_stream(
        &self,
        api_key: &str,
        endpoint: &str,
        model: &str,
        messages: &[ChatMessage],
        options: &ChatOptions,
        on_chunk: &(dyn Fn(String, bool) + Send + Sync),
    ) -> Result<(), AiError> {
        let ep = if endpoint.is_empty() { &self.default_endpoint } else { endpoint };
        let url = format!("{}/chat/completions", ep.trim_end_matches('/'));

        let body = serde_json::json!({
            "model": model,
            "messages": messages.iter().map(|m| serde_json::json!({
                "role": m.role,
                "content": m.content,
            })).collect::<Vec<_>>(),
            "temperature": options.temperature.unwrap_or(0.7),
            "max_tokens": options.max_tokens.unwrap_or(4096),
            "top_p": options.top_p,
            "stream": true,
        });

        let client = reqwest::Client::new();
        let resp = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AiError { message: format!("请求失败: {}", e), code: "network_error".into() })?;

        if !resp.status().is_success() {
            let body_text = resp.text().await.unwrap_or_default();
            return Err(AiError {
                message: format!("API 返回错误: {}", body_text),
                code: "api_error".into(),
            });
        }

        use futures_util::StreamExt;
        let mut stream = resp.bytes_stream();

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result
                .map_err(|e| AiError { message: format!("流读取失败: {}", e), code: "stream_error".into() })?;
            let text = String::from_utf8_lossy(&chunk);

            for line in text.lines() {
                let line = line.trim();
                if line.is_empty() || !line.starts_with("data: ") {
                    continue;
                }
                let data = &line[6..];
                if data == "[DONE]" {
                    on_chunk(String::new(), true);
                    return Ok(());
                }

                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(delta) = json["choices"][0]["delta"]["content"].as_str() {
                        let finish = json["choices"][0]["finish_reason"].as_str().map_or(false, |r| !r.is_empty() && r != "null");
                        on_chunk(delta.to_string(), finish);
                        if finish {
                            return Ok(());
                        }
                    }
                }
            }
        }

        // Stream ended without [DONE]
        on_chunk(String::new(), true);
        Ok(())
    }
}
