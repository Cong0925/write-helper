use crate::ai::types::*;

pub fn get_all_providers() -> Vec<ProviderInfo> {
    vec![
        ProviderInfo {
            id: "openai".into(),
            name: "OpenAI".into(),
            category: "international".into(),
            default_endpoint: "https://api.openai.com/v1".into(),
            models: vec![
                ModelInfo { id: "gpt-4o".into(), name: "GPT-4o".into(), description: "多模态旗舰，约 $5/1M 输入".into() },
                ModelInfo { id: "gpt-4.1".into(), name: "GPT-4.1".into(), description: "最新代码与指令模型".into() },
                ModelInfo { id: "gpt-4.1-mini".into(), name: "GPT-4.1 Mini".into(), description: "轻量高效，约 $0.6/1M 输入".into() },
                ModelInfo { id: "o3".into(), name: "o3".into(), description: "深度推理旗舰".into() },
                ModelInfo { id: "o4-mini".into(), name: "o4-mini".into(), description: "轻量推理，性价比高".into() },
            ],
            requires_api_key: true,
            requires_secret_key: false,
        },
        ProviderInfo {
            id: "deepseek".into(),
            name: "DeepSeek".into(),
            category: "international".into(),
            default_endpoint: "https://api.deepseek.com/v1".into(),
            models: vec![
                ModelInfo { id: "deepseek-v4-pro".into(), name: "DeepSeek V4 Pro".into(), description: "旗舰推理，约 ¥0.6/1M 输入".into() },
                ModelInfo { id: "deepseek-v4-flash".into(), name: "DeepSeek V4 Flash".into(), description: "极速响应，约 ¥0.2/1M 输入".into() },
                ModelInfo { id: "deepseek-chat".into(), name: "DeepSeek V3".into(), description: "经典通用，约 ¥0.14/1M 输入".into() },
                ModelInfo { id: "deepseek-reasoner".into(), name: "DeepSeek R1".into(), description: "深度推理，约 ¥0.55/1M 输入".into() },
            ],
            requires_api_key: true,
            requires_secret_key: false,
        },
        ProviderInfo {
            id: "anthropic".into(),
            name: "Anthropic Claude".into(),
            category: "international".into(),
            default_endpoint: "https://api.anthropic.com/v1".into(),
            models: vec![
                ModelInfo { id: "claude-opus-4-7".into(), name: "Claude Opus 4.7".into(), description: "最强旗舰，约 $15/1M 输入".into() },
                ModelInfo { id: "claude-sonnet-4-6".into(), name: "Claude Sonnet 4.6".into(), description: "性能速度平衡，约 $3/1M".into() },
                ModelInfo { id: "claude-haiku-4-5".into(), name: "Claude Haiku 4.5".into(), description: "快速轻量，约 $1/1M 输入".into() },
            ],
            requires_api_key: true,
            requires_secret_key: false,
        },
        ProviderInfo {
            id: "google".into(),
            name: "Google Gemini".into(),
            category: "international".into(),
            default_endpoint: "https://generativelanguage.googleapis.com/v1beta".into(),
            models: vec![
                ModelInfo { id: "gemini-2.5-pro".into(), name: "Gemini 2.5 Pro".into(), description: "旗舰多模态".into() },
                ModelInfo { id: "gemini-2.5-flash".into(), name: "Gemini 2.5 Flash".into(), description: "快速响应".into() },
            ],
            requires_api_key: true,
            requires_secret_key: false,
        },
        ProviderInfo {
            id: "zhipu".into(),
            name: "智谱 ChatGLM".into(),
            category: "domestic".into(),
            default_endpoint: "https://open.bigmodel.cn/api/paas/v4".into(),
            models: vec![
                ModelInfo { id: "glm-4".into(), name: "GLM-4".into(), description: "旗舰模型".into() },
                ModelInfo { id: "glm-4-flash".into(), name: "GLM-4 Flash".into(), description: "快速版本(免费额度)".into() },
                ModelInfo { id: "glm-4-air".into(), name: "GLM-4 Air".into(), description: "轻量版本".into() },
            ],
            requires_api_key: true,
            requires_secret_key: false,
        },
        ProviderInfo {
            id: "qwen".into(),
            name: "阿里通义千问".into(),
            category: "domestic".into(),
            default_endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1".into(),
            models: vec![
                ModelInfo { id: "qwen-max".into(), name: "Qwen-Max".into(), description: "旗舰模型".into() },
                ModelInfo { id: "qwen-plus".into(), name: "Qwen-Plus".into(), description: "增强版本".into() },
                ModelInfo { id: "qwen-turbo".into(), name: "Qwen-Turbo".into(), description: "快速版本".into() },
            ],
            requires_api_key: true,
            requires_secret_key: false,
        },
        ProviderInfo {
            id: "moonshot".into(),
            name: "月之暗面 Kimi".into(),
            category: "domestic".into(),
            default_endpoint: "https://api.moonshot.cn/v1".into(),
            models: vec![
                ModelInfo { id: "moonshot-v1-8k".into(), name: "Kimi 8K".into(), description: "8K 上下文".into() },
                ModelInfo { id: "moonshot-v1-32k".into(), name: "Kimi 32K".into(), description: "32K 上下文".into() },
                ModelInfo { id: "moonshot-v1-128k".into(), name: "Kimi 128K".into(), description: "128K 超长上下文".into() },
            ],
            requires_api_key: true,
            requires_secret_key: false,
        },
        ProviderInfo {
            id: "baidu".into(),
            name: "百度文心一言".into(),
            category: "domestic".into(),
            default_endpoint: "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat".into(),
            models: vec![
                ModelInfo { id: "ernie-4.0-turbo".into(), name: "ERNIE 4.0 Turbo".into(), description: "旗舰模型".into() },
                ModelInfo { id: "ernie-3.5".into(), name: "ERNIE 3.5".into(), description: "稳定版本".into() },
            ],
            requires_api_key: true,
            requires_secret_key: true,  // Baidu needs API Key + Secret Key
        },
        ProviderInfo {
            id: "bytedance".into(),
            name: "字节豆包".into(),
            category: "domestic".into(),
            default_endpoint: "https://ark.cn-beijing.volces.com/api/v3".into(),
            models: vec![
                ModelInfo { id: "doubao-pro-32k".into(), name: "豆包 Pro 32K".into(), description: "旗舰模型".into() },
                ModelInfo { id: "doubao-lite-32k".into(), name: "豆包 Lite 32K".into(), description: "轻量版本".into() },
            ],
            requires_api_key: true,
            requires_secret_key: false,
        },
        ProviderInfo {
            id: "ollama".into(),
            name: "Ollama (本地)".into(),
            category: "local".into(),
            default_endpoint: "http://localhost:11434/v1".into(),
            models: vec![
                ModelInfo { id: "llama3".into(), name: "Llama 3".into(), description: "Meta 开源，ollama pull llama3".into() },
                ModelInfo { id: "qwen2.5".into(), name: "Qwen 2.5".into(), description: "阿里开源，ollama pull qwen2.5".into() },
                ModelInfo { id: "deepseek-r1".into(), name: "DeepSeek R1".into(), description: "开源推理，ollama pull deepseek-r1".into() },
            ],
            requires_api_key: false,   // Local Ollama doesn't need API key
            requires_secret_key: false,
        },
        ProviderInfo {
            id: "custom".into(),
            name: "自定义 OpenAI 兼容".into(),
            category: "local".into(),
            default_endpoint: "".into(),
            models: vec![
                ModelInfo { id: "custom-model".into(), name: "自定义模型".into(), description: "填入模型名称后使用".into() },
            ],
            requires_api_key: false,   // Optional — user can leave blank for local LLM
            requires_secret_key: false,
        },
    ]
}

/// Get the builtin provider list. These are providers that the developer
/// may have pre-configured via builtin_keys.json. They show in the provider
/// list only if a key has been imported for them.
pub fn get_builtin_providers() -> Vec<ProviderInfo> {
    vec![
        ProviderInfo {
            id: "builtin".into(),
            name: "系统内置 (DeepSeek)".into(),
            category: "builtin".into(),
            default_endpoint: "https://api.deepseek.com/v1".into(),
            models: vec![
                ModelInfo { id: "deepseek-v4-flash".into(), name: "DeepSeek V4 Flash".into(), description: "系统默认，极速响应".into() },
                ModelInfo { id: "deepseek-v4-pro".into(), name: "DeepSeek V4 Pro".into(), description: "旗舰推理，按需使用".into() },
                ModelInfo { id: "deepseek-chat".into(), name: "DeepSeek V3".into(), description: "经典通用".into() },
            ],
            requires_api_key: false,    // Key is pre-configured
            requires_secret_key: false,
        },
    ]
}
