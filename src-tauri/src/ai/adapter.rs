use async_trait::async_trait;
use crate::ai::types::*;

#[async_trait]
#[allow(dead_code)]
pub trait ModelAdapter: Send + Sync {
    fn provider_id(&self) -> &str;
    fn provider_name(&self) -> &str;
    fn default_endpoint(&self) -> &str;
    fn default_models(&self) -> Vec<ModelInfo>;

    /// Send a non-streaming chat request
    async fn chat(
        &self,
        api_key: &str,
        endpoint: &str,
        model: &str,
        messages: &[ChatMessage],
        options: &ChatOptions,
    ) -> Result<ChatResponse, AiError>;

    /// Send a streaming chat request. Returns chunks via callback.
    async fn chat_stream(
        &self,
        api_key: &str,
        endpoint: &str,
        model: &str,
        messages: &[ChatMessage],
        options: &ChatOptions,
        on_chunk: &(dyn Fn(String, bool) + Send + Sync),
    ) -> Result<(), AiError>;
}
