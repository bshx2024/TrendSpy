import fs from "node:fs";
import path from "node:path";

interface TrendItem {
  id: number;
  keyword: string;
  category: "AI大模型衍生" | "热门游戏/娱乐" | "社媒现象级" | "新兴软硬件痛点";
  rationale: string;
  suggestedAction: string;
}

// 经过深度量级初筛的、具备“与 gpts 掰手腕”潜力的新兴生态热词池
const CANDIDATES: TrendItem[] = [
  {
    id: 1,
    keyword: "Flux AI",
    category: "AI大模型衍生",
    rationale: "Black Forest Labs 开源的次世代生图模型，颠覆 Midjourney/SD，全球创作者生态全面转向",
    suggestedAction: "极速上线 Flux 在线生图/提示词生成/LoRA 模型合辑单页站"
  },
  {
    id: 2,
    keyword: "DeepSeek API",
    category: "AI大模型衍生",
    rationale: "全球开发者公认性价比极高的开源大模型，大量人搜索免翻使用、API 格式转换与价格对比",
    suggestedAction: "制作 DeepSeek Token 价格计算器 / Web 客户端免配置壳"
  },
  {
    id: 3,
    keyword: "Claude 3.5 Sonnet",
    category: "AI大模型衍生",
    rationale: "代码能力封神之后，引发大量寻找“免费体验/API 接入/Artifacts 增强”的强搜索需求",
    suggestedAction: "Claude Artifacts 导出与全屏预览工具、Prompts 库"
  },
  {
    id: 4,
    keyword: "Sora AI",
    category: "AI大模型衍生",
    rationale: "OpenAI 视频模型虽然正式名额受限，但外围的 prompt 逆向、视频生成替代需求一直维持高位",
    suggestedAction: "Sora 风格提示词生成器与 AI 视频作品展示站（吃早期占位）"
  },
  {
    id: 5,
    keyword: "Palworld Map",
    category: "热门游戏/娱乐",
    rationale: "现象级开放世界生存游戏，玩家对全资源点位、配种模拟器的需求是刚需中的刚需",
    suggestedAction: "高互动 Leaflet.js 地图站，挂横幅广告变现"
  },
  {
    id: 6,
    keyword: "Spatial Video",
    category: "新兴软硬件痛点",
    rationale: "Apple Vision Pro 与 Meta Quest 3 普及带来的新格式，普通 2D 视频转 3D 空间视频需求陡增",
    suggestedAction: "基于 WebCodecs 的在线空间视频格式检测与轻量转换站"
  },
  {
    id: 7,
    keyword: "Receiptify",
    category: "社媒现象级",
    rationale: "长盛不衰的社媒晒单神器，将 Spotify/Apple Music 歌单转为购物小票，全网受众极其庞大",
    suggestedAction: "扩展支持 YouTube Music / 网易云等小票皮肤生成器"
  },
  {
    id: 8,
    keyword: "NotebookLM",
    category: "AI大模型衍生",
    rationale: "Google 近期爆火的播客 AI 生成功能，全网播客创作者和大学生都在找其下游使用技巧与工具",
    suggestedAction: "NotebookLM 格式转换器（音转文/思维导图提取单页）"
  },
  {
    id: 9,
    keyword: "Cursor AI",
    category: "AI大模型衍生",
    rationale: "AI 编程编辑器顶流，围绕 Rules、快捷键、扩展插件的周边搜索量出现阶梯式暴涨",
    suggestedAction: "Cursor 规则共享社区 / .cursorrules 一键可视化生成器"
  },
  {
    id: 10,
    keyword: "Kling AI",
    category: "AI大模型衍生",
    rationale: "快手可灵视频大模型出海爆火，全球创作者在寻找其免注册体验入口与提示词配方",
    suggestedAction: "Kling AI 提示词库与视频教程聚合站点"
  }
];

const BENCHMARK = "gpts"; // 黄金对照基准词

function generateReportMarkdown(items: TrendItem[]): string {
  const dateStr = new Date().toISOString().split("T")[0];
  let md = `# 🎯 高量级蓝海新词雷达报告（带【${BENCHMARK}】绝对量级标尺）\n\n`;
  md += `> **生成时间**：${new Date().toLocaleString("zh-CN")}\n`;
  md += `> **对比标尺（Benchmark）**：\`${BENCHMARK}\`（月搜约 10 万+ 的大盘基准）\n`;
  md += `> **核心规则**：点开 Trends 链接，**直接看新词的折线能不能打到标尺线（红线）的一半以上甚至超越它！** 如果被压成贴地平线，0 秒直接淘汰！\n\n`;
  md += `---\n\n`;
  md += `## 📊 高潜大词雷达表（已自动注入 Benchmark 对比）\n\n`;
  md += `| # | 目标关键词 | 赛道类型 | 痛点背景与产品形态建议 | 🚀 标尺对比验证链接 | 🔍 SERP 竞争检查 |\n`;
  md += `|---|---|---|---|---|---|\n`;

  for (const item of items) {
    const qTarget = encodeURIComponent(item.keyword);
    const qCompare = `${qTarget},${encodeURIComponent(BENCHMARK)}`;
    const trendsUrl = `https://trends.google.com/trends/explore?date=today%201-m&q=${qCompare}`;
    const serpUrl = `https://www.google.com/search?q=${qTarget}`;

    md += `| ${String(item.id).padStart(2, "0")} | **${item.keyword}** | \`${item.category}\` | ${item.rationale}<br>💡 *建议*：${item.suggestedAction} | [📈 **vs ${BENCHMARK} (30天)**](${trendsUrl}) | [🔍 Google SERP](${serpUrl}) |\n`;
  }

  md += `\n---\n\n`;
  md += `## 🎯 极速决策法则（3秒过一个词）：\n\n`;
  md += `1. **点开链接看双线对比**：\n`;
  md += `   - 🔵 蓝线（目标词） | 🔴 红线（${BENCHMARK} 标尺）\n`;
  md += `2. **淘汰条件**：如果蓝线贴着地面（数值低于 5），果断关掉标签页，下一个；\n`;
  md += `3. **合格条件**：蓝线稳定在红线的 30%~100% 以上，或者在某些天数**反超红线**！这就是具备巨大流量池的黄金词！\n`;

  return md;
}

const outputPath = path.join(import.meta.dir, "reports", "benchmark_trends_report.md");
fs.writeFileSync(outputPath, generateReportMarkdown(CANDIDATES), "utf-8");
console.log(`✅ 成功生成带标尺对比的趋势报告: ${outputPath}`);
