use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WritingSkill {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub description: String,
    pub system_prompt: String,
    pub requires_selection: bool, // whether the skill needs editor selection
}

/// Get all built-in writing skills. Each skill tailors the AI's behavior
/// for a specific writing task via a specialized system prompt.
pub fn get_all_skills() -> Vec<WritingSkill> {
    vec![
        WritingSkill {
            id: "continue".into(),
            name: "续写".into(),
            icon: "→".into(),
            description: "根据上下文继续创作，保持一致的风格和语气".into(),
            system_prompt: "你是一个专业作家，请根据上文继续写下去。保持相同的风格、语气和节奏。不要重复已有内容，自然地延续情节或论述。".into(),
            requires_selection: true,
        },
        WritingSkill {
            id: "rewrite".into(),
            name: "改写".into(),
            icon: "✎".into(),
            description: "重写选中内容，使表达更加流畅优美".into(),
            system_prompt: "你是一个文字编辑专家。请改写用户提供的内容，使其更加流畅、优美、有表现力。保持原意不变，但可以调整句式、用词和节奏。不要在前后添加任何解释，直接输出改写后的内容。".into(),
            requires_selection: true,
        },
        WritingSkill {
            id: "expand".into(),
            name: "扩写".into(),
            icon: "⊕".into(),
            description: "丰富选中内容，增加细节描写和深度".into(),
            system_prompt: "你是一个创作指导。请对用户提供的内容进行扩写，增加更多细节、描写、对话或论证，使内容更加丰富饱满。保持原有风格，自然地扩展。".into(),
            requires_selection: true,
        },
        WritingSkill {
            id: "shorten".into(),
            name: "缩写".into(),
            icon: "⊖".into(),
            description: "精简内容，保留核心信息".into(),
            system_prompt: "你是一个文字精简专家。请精简用户提供的内容，去除冗余表述，保留核心信息和关键情节。压缩后内容应简洁有力，不失原意。".into(),
            requires_selection: true,
        },
        WritingSkill {
            id: "polish".into(),
            name: "润色".into(),
            icon: "✨".into(),
            description: "优化遣词造句，提升文本质感".into(),
            system_prompt: "你是一个文字润色师。请对用户提供的内容进行润色：优化用词，调整句式节奏，消除重复表述，提升文本的文学质感。保持原有风格和语气特征，不做大幅改写。".into(),
            requires_selection: true,
        },
        WritingSkill {
            id: "outline".into(),
            name: "大纲".into(),
            icon: "☰".into(),
            description: "根据内容生成结构化大纲".into(),
            system_prompt: "请将用户提供的内容整理为结构化大纲，使用层级缩进展示章节/段落结构。每个节点应简洁明了，能概括对应部分的核心内容。".into(),
            requires_selection: true,
        },
        WritingSkill {
            id: "titles".into(),
            name: "标题".into(),
            icon: "#".into(),
            description: "生成多个备选标题方案".into(),
            system_prompt: "你是一个标题创作专家。请为以下内容生成10个备选标题，涵盖不同风格：悬念型、抒情型、简洁型、文艺型、通俗型。每个标题单独一行。".into(),
            requires_selection: true,
        },
        WritingSkill {
            id: "summary".into(),
            name: "总结".into(),
            icon: "📋".into(),
            description: "提炼核心要点，简洁概括".into(),
            system_prompt: "请用简洁的语言总结以下内容的核心要点。用 3-5 个要点概括，每个要点一行，先加粗关键词再用一句话说明。".into(),
            requires_selection: true,
        },
        WritingSkill {
            id: "translate_en".into(),
            name: "英译".into(),
            icon: "🌐".into(),
            description: "将中文内容翻译为英文".into(),
            system_prompt: "你是一个专业翻译。请将以下中文内容翻译为地道、流畅的英文。注意保持原文风格和语气，文学性内容需注意意译。".into(),
            requires_selection: true,
        },
        WritingSkill {
            id: "brainstorm".into(),
            name: "头脑风暴".into(),
            icon: "💡".into(),
            description: "围绕主题发散思考，提供创意点子和方向".into(),
            system_prompt: "你是一个创意顾问。请围绕用户提出的主题进行头脑风暴，提供多个有趣的创意方向、情节构思或切入角度。每个创意用一段话简要说明。".into(),
            requires_selection: false,
        },
        WritingSkill {
            id: "character".into(),
            name: "人设".into(),
            icon: "👤".into(),
            description: "根据描述生成详细的人物设定".into(),
            system_prompt: "你是一个角色设计师。请根据用户的描述，生成详细的人物设定：姓名、年龄、外貌特征、性格特点、背景故事、口头禅、习惯动作、人际关系等。格式清晰，信息丰富。".into(),
            requires_selection: false,
        },
        WritingSkill {
            id: "worldbuilding".into(),
            name: "世界观".into(),
            icon: "🌍".into(),
            description: "构建世界观设定，包括时代背景、规则体系等".into(),
            system_prompt: "你是一个世界观架构师。请根据用户的描述，构建详细的世界观设定：时代背景、地理环境、社会结构、力量体系/科技水平、特殊规则、主要势力等。".into(),
            requires_selection: false,
        },
    ]
}
