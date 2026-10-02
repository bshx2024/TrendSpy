/**
 * 核心实体种子库 (Entity Seeds Pool)
 * 覆盖 AI 生态各大垂直赛道、核心大厂模型、创作者爆款平台
 */

export interface EntitySeed {
  entity: string;
  displayName: string;
  category: "AI视频与生图" | "大语言模型与代码助手" | "AI音频与音乐" | "出海B2C与社媒神器";
  description: string;
  suggestedActionType: string;
}

export const ENTITY_SEEDS: EntitySeed[] = [
  // 1. AI 视频与生图生态
  {
    entity: "higgsfield",
    displayName: "Higgsfield AI",
    category: "AI视频与生图",
    description: "近期爆火的 AI 运镜与短剧视频平台 (如 Hotel Lobby / Migos 模版)",
    suggestedActionType: "爆款镜头风格提示词库 / 免登录体验引流单页"
  },
  {
    entity: "kling ai",
    displayName: "快手可灵 (Kling AI)",
    category: "AI视频与生图",
    description: "出海热度顶流的物理世界模拟视频生成模型",
    suggestedActionType: "可灵 Prompts 逆向生成器与创意模板库"
  },
  {
    entity: "minimax",
    displayName: "MiniMax (海螺AI)",
    category: "AI视频与生图",
    description: "MiniMax 视频大模型与语音合成",
    suggestedActionType: "视频生成提示词工具 / 声音克隆展示单页"
  },
  {
    entity: "flux ai",
    displayName: "Flux.1",
    category: "AI视频与生图",
    description: "开源生图顶流，颠覆 SD/Midjourney 创作者生态",
    suggestedActionType: "Flux 在线生图 / LoRA 预设与微调参数字典"
  },
  {
    entity: "luma ai",
    displayName: "Luma Dream Machine",
    category: "AI视频与生图",
    description: "逼真运镜与 3D 渲染视频大模型",
    suggestedActionType: "Luma 相机控制指令生成器 / 爆款作品合集"
  },
  {
    entity: "runway gen-3",
    displayName: "Runway Gen-3",
    category: "AI视频与生图",
    description: "商业级影视视频生成与画质控制",
    suggestedActionType: "Runway 笔刷与 Director Mode 提示词导航"
  },
  {
    entity: "midjourney",
    displayName: "Midjourney",
    category: "AI视频与生图",
    description: "商业插画与概念设计最强生图生态",
    suggestedActionType: "Midjourney v6.1 风格调色板 / sref 参数生成器"
  },
  {
    entity: "pika ai",
    displayName: "Pika AI",
    category: "AI视频与生图",
    description: "Pika 特效生成（融化、爆炸、充气等趣味物理效果）",
    suggestedActionType: "Pika 特效滤镜预设生成器"
  },

  // 2. 大语言模型与代码助手
  {
    entity: "anthropic",
    displayName: "Anthropic / Claude",
    category: "大语言模型与代码助手",
    description: "Claude 3.5 Sonnet / 5.5 系列，代码与复杂推理最强",
    suggestedActionType: "Claude Artifacts 预览工具 / 系统 Prompts 库"
  },
  {
    entity: "claude",
    displayName: "Claude",
    category: "大语言模型与代码助手",
    description: "Claude 生态周边与各类衍生工具",
    suggestedActionType: "Claude 效率插件与格式转换工具"
  },
  {
    entity: "openai",
    displayName: "OpenAI / ChatGPT",
    category: "大语言模型与代码助手",
    description: "GPT-4o, o1, o3-mini 及模型周边动向",
    suggestedActionType: "GPTs 发现导航 / 免登录逆向助手"
  },
  {
    entity: "mistral ai",
    displayName: "Mistral AI",
    category: "大语言模型与代码助手",
    description: "欧洲开源模型巨头 (Codestral, Pixtral, Pimento 等新动向)",
    suggestedActionType: "Mistral 本地部署脚本与在线体验壳"
  },
  {
    entity: "deepseek",
    displayName: "DeepSeek",
    category: "大语言模型与代码助手",
    description: "极致性价比开源大模型 (DeepSeek-V2.5 / Coder)",
    suggestedActionType: "DeepSeek API 价格计算器 / 格式转换中间件"
  },
  {
    entity: "cursor ai",
    displayName: "Cursor AI",
    category: "大语言模型与代码助手",
    description: "AI 编程编辑器，.cursorrules 成为全球顶流生态",
    suggestedActionType: ".cursorrules 一键生成器 / 快捷规则社区"
  },
  {
    entity: "notebooklm",
    displayName: "Google NotebookLM",
    category: "大语言模型与代码助手",
    description: "Google 播客 AI 生成 (Audio Overview) 爆火出圈",
    suggestedActionType: "NotebookLM 播客音视频转录与导图生成器"
  },

  // 3. AI 音频与音乐
  {
    entity: "suno",
    displayName: "Suno AI",
    category: "AI音频与音乐",
    description: "全网第一的 AI 音乐生成平台 (v3.5 / v6 等版本更迭)",
    suggestedActionType: "Suno 风格提示词/歌词排版生成器"
  },
  {
    entity: "udio",
    displayName: "Udio AI",
    category: "AI音频与音乐",
    description: "高保真 AI 作曲平台",
    suggestedActionType: "Udio 音乐扩展与分轨处理工具单页"
  },
  {
    entity: "elevenlabs",
    displayName: "ElevenLabs",
    category: "AI音频与音乐",
    description: "超写实声音克隆与音效生成",
    suggestedActionType: "配音文案转语音助手 / Reader 客户端工具"
  },

  // 4. 出海 B2C 与社媒现象级
  {
    entity: "receiptify",
    displayName: "Receiptify",
    category: "出海B2C与社媒神器",
    description: "长盛不衰的歌单小票生成器",
    suggestedActionType: "小票皮肤 / 多平台歌单小票打印机"
  },
  {
    entity: "palworld",
    displayName: "Palworld (幻兽帕鲁)",
    category: "出海B2C与社媒神器",
    description: "现象级游戏，全网搜索配种与点位地图",
    suggestedActionType: "Leaflet 交互地图与配种计算器"
  },

  // 5. 泛意图与玩法品类种子 (Category Intent Seeds)
  {
    entity: "ai song",
    displayName: "AI 音乐与歌曲生成",
    category: "AI音频与音乐",
    description: "全网对 AI 音乐、短视频伴奏、翻唱玩法的综合搜索",
    suggestedActionType: "爆款 AI 歌曲在线试听 / 歌词与提示词工具"
  },
  {
    entity: "ai filter",
    displayName: "AI 滤镜与特效",
    category: "AI视频与生图",
    description: "TikTok / Instagram 爆款滤镜与换脸变身特效",
    suggestedActionType: "网红同款 AI 滤镜单页 / 提示词逆向库"
  },
  {
    entity: "ai dance",
    displayName: "AI 舞蹈与动作驱动",
    category: "AI视频与生图",
    description: "TikTok 爆款跳舞特效 (如 Viggle / LivePortrait / 骨骼驱动)",
    suggestedActionType: "动作模板生成器 / 绿幕跳舞素材导出"
  },
  {
    entity: "ai voice",
    displayName: "AI 声音与配音克隆",
    category: "AI音频与音乐",
    description: "网红声音克隆、TTS 旁白朗读与趣味变声器",
    suggestedActionType: "纯前端 Web TTS 语音生成器 / 声音预设库"
  },
  {
    entity: "meta ai",
    displayName: "Meta AI 生态",
    category: "大语言模型与代码助手",
    description: "Llama 3.2、Ray-Ban 智能眼镜与智能硬件生态",
    suggestedActionType: "Meta 智能体应用导航 / Llama 本地微调指南"
  },
  {
    entity: "tycoon",
    displayName: "Roblox 经营模拟 (Tycoon)",
    category: "出海B2C与社媒神器",
    description: "Roblox 亿级玩家品类 (Lumber Tycoon, Restaurant Tycoon 等)",
    suggestedActionType: "游戏攻略兑换码、互动点位地图与计算器"
  },
  {
    entity: "qwen",
    displayName: "阿里通义千问 (Qwen)",
    category: "大语言模型与代码助手",
    description: "通义千问开源与多模态模型 (Qwen-2.5 / Image / Coder)",
    suggestedActionType: "Qwen 开源模型 WebUI 部署助手与 Prompts 库"
  },
  {
    entity: "doubao",
    displayName: "字节跳动豆包 (Doubao)",
    category: "大语言模型与代码助手",
    description: "字节豆包大模型与语音助手生态",
    suggestedActionType: "豆包 API 中转接入与衍生应用导航"
  },
  {
    entity: "kimi",
    displayName: "月之暗面 (Kimi / Moonshot)",
    category: "大语言模型与代码助手",
    description: "Kimi 长文本大模型、多模态与出海助手生态",
    suggestedActionType: "Kimi 提效提示词库 / 长文本助手衍生单页"
  }
];

