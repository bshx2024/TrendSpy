import fs from "node:fs";
import path from "node:path";
import { NewTrendRadarResult, BenchmarkVerifiedItem, runBenchmarkEngine } from "./benchmark_engine.js";

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const DATA_DIR = path.join(CURRENT_DIR, "data");
const REPORTS_DIR = path.join(CURRENT_DIR, "reports");
const RADAR_FILE = path.join(DATA_DIR, "benchmark_radar_output.json");
const REPORT_MD_FILE = path.join(REPORTS_DIR, "newtrend_radar_report.md");

export function formatNewTrendBrief(result: NewTrendRadarResult): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const timeTag = `${month}-${day} ${hours}:${minutes}`;

  let out = `NewTrend 新词监控　${timeTag}\n`;

  // 1. 新词
  out += `新词（${result.newBreakouts.length}）\n`;
  if (result.newBreakouts.length === 0) {
    out += `暂无突破性首发新词\n`;
  } else {
    result.newBreakouts.forEach((item, idx) => {
      const variantStr = item.relatedVariants.length > 0 ? ` · 含衍生词×${item.relatedVariants.length}` : "";
      out += `${idx + 1}. ${item.keyword}　${item.firstSeenDate} 出现 · ${item.breakoutDate} 爆发 · ${item.currentMomentum} · ${item.ratioFormatted}${variantStr}\n`;
    });
  }

  // 2. 老词二次爆火
  out += `\n老词二次爆火（${result.reSurging.length}）\n`;
  if (result.reSurging.length === 0) {
    out += `暂无老词二次爆火\n`;
  } else {
    result.reSurging.forEach((item, idx) => {
      out += `${idx + 1}. ${item.keyword}　${item.breakoutDate} 爆发 · ${item.currentMomentum} · ${item.ratioFormatted}\n`;
    });
  }

  // 3. 高涨幅上升词
  out += `\n高涨幅上升词（${result.highGrowthList.length}，≥1000% 或飙升）\n`;
  result.highGrowthList.slice(0, 30).forEach((item, idx) => {
    out += `${idx + 1}. ${item.keyword}　${item.growthStatus}　${item.entity}\n`;
  });

  return out;
}

export function generateFullMarkdownReport(result: NewTrendRadarResult): string {
  // 识别极速交付型商业新词 (Fast-Cashout Candidates)
  const deliveryRegex = /\b(video|generator|filter|template|song|music|dance|voice|clone|skin|sticker|sticker|converter|widget|tools|maker|prompt|prompts|model|lora)\b/i;
  const fastCashoutItems = result.highGrowthList.filter(item => 
    item.isCommercial && deliveryRegex.test(item.keyword)
  ).slice(0, 10);

  let md = `# 🎯 NewTrend AI 新词与飙升雷达研报（带【${result.benchmark}】绝对量级标尺）\n\n`;
  md += `> **生成时间**：${new Date().toLocaleString("zh-CN")}\n`;
  md += `> **对比标尺（Benchmark）**：\`${result.benchmark}\`（全球月搜约 10 万+ 的大盘基准）\n`;
  md += `> **方法论参考**：[📘 新词极速变现标准指南 (Playbook)](file:///g:/1.旅行携带资料/TrendSpy/docs/NEW_TREND_MONETIZATION_PLAYBOOK.md)\n`;
  md += `> **降噪策略**：已启用【商业意图过滤器】、【GEO 8大推荐规范】与【语义聚类去重】。\n\n`;
  md += `---\n\n`;

  // 极速交付型商业新词精选 (Monetization Fast-Track)
  md += `## ⚡ 一、 极速交付型商业新词精选 (Monetization Fast-Track · 24小时上站)\n\n`;
  md += `> **核心逻辑**：基于 \`hotel lobby ai\` 与 \`raindance ai\` 案例，用户**带着明确付费意图**寻找成品。24 小时内用现成 API 封装上线，做**一次性积分包（$4.99~$9.99）**，吃透 7~30 天 AI 搜索推荐（GEO）窗口期。\n\n`;

  if (fastCashoutItems.length === 0) {
    md += `*本次暂无高匹配的极速交付型新词。*\n\n`;
  } else {
    md += `| # | 目标新词 | 交付物形态 | 标尺热度 | 变现模式 | 💡 建议 GEO 落地 H1 标语 | 🚀 验证 |\n`;
    md += `|---|---|---|---|---|---|---|\n`;
    fastCashoutItems.forEach((item, idx) => {
      let deliveryType = "AI 视频/模版";
      let geoH1 = `Two inputs. One ${item.keyword} result.`;
      const kw = item.keyword.toLowerCase();
      if (kw.includes("filter")) {
        deliveryType = "AI 特效与自传播滤镜";
        geoH1 = `Turn your photo into ${item.keyword} in 3 seconds.`;
      } else if (kw.includes("voice") || kw.includes("clone")) {
        deliveryType = "AI 声音与配音克隆";
        geoH1 = `Clone voice and generate speech in seconds.`;
      } else if (kw.includes("song") || kw.includes("music")) {
        deliveryType = "AI 歌曲与歌词排版";
        geoH1 = `Generate full track with lyrics instantly.`;
      } else if (kw.includes("video") || kw.includes("lobby") || kw.includes("dance")) {
        deliveryType = "AI 双人/动作运镜视频";
        geoH1 = `Two photos. One ${item.keyword} video.`;
      } else if (kw.includes("skin") || kw.includes("card")) {
        deliveryType = "纯前端 Canvas 卡面贴纸";
        geoH1 = `Custom card skin generator online free.`;
      }

      md += `| ${idx + 1} | **${item.keyword}** | \`${deliveryType}\` | ${item.ratioFormatted} | **一次性积分包 ($5.99)**<br>送极小试用预览 | \`${geoH1}\` | [📈 Trends](${item.trendsExploreUrl}) \\| [🔍 SERP](${item.serpUrl}) |\n`;
    });
    md += `\n`;
  }

  md += `## 🌟 二、 新词首次爆发 (Breakout Candidates - 商业高潜)\n\n`;
  if (result.newBreakouts.length === 0) {
    md += `*本次巡检暂无达到严格商业门槛的首次爆发新词。*\n\n`;
  } else {
    md += `| # | 目标关键词 | 归属实体 | 出现 / 爆发时间 | 相对 GPTs 倍率 | 当前动量 | 💡 落地与套利建议 | 🚀 验证链接 |\n`;
    md += `|---|---|---|---|---|---|---|---|\n`;
    result.newBreakouts.forEach((item, idx) => {
      let variantsHtml = "";
      if (item.relatedVariants.length > 0) {
        variantsHtml = `<br><span style="color:#666;font-size:12px"><b>同类词群:</b> ${item.relatedVariants.slice(0, 3).join(", ")}</span>`;
      }
      md += `| ${idx + 1} | **${item.keyword}**${variantsHtml} | \`${item.entity}\` | ${item.firstSeenDate} 出现 · ${item.breakoutDate} 爆发 | **${item.ratioFormatted}** | ${item.currentMomentum} | ${item.suggestedAction} | [📈 Trends 对比](${item.trendsExploreUrl}) \\| [🔍 SERP](${item.serpUrl}) |\n`;
    });
    md += `\n`;
  }

  md += `## 🔄 三、 老词二次爆火 (Re-Surging Keywords)\n\n`;
  if (result.reSurging.length === 0) {
    md += `*时序数据库处于积累期，本次暂无二次翻红老词（定时监控 3~7 天后将自动识别）。*\n\n`;
  } else {
    md += `| # | 关键词 | 归属实体 | 爆发时间 | 相对 GPTs 倍率 | 当前动量 | 💡 落地与套利建议 | 🚀 验证链接 |\n`;
    md += `|---|---|---|---|---|---|---|---|\n`;
    result.reSurging.forEach((item, idx) => {
      md += `| ${idx + 1} | **${item.keyword}** | \`${item.entity}\` | ${item.breakoutDate} 爆发 | **${item.ratioFormatted}** | ${item.currentMomentum} | ${item.suggestedAction} | [📈 Trends 对比](${item.trendsExploreUrl}) \\| [🔍 SERP](${item.serpUrl}) |\n`;
    });
    md += `\n`;
  }

  md += `## 📈 四、 高涨幅上升词全景榜单（≥1000% 或飙升）\n\n`;
  md += `| # | 关键词 | 涨幅状态 | 归属实体 | 赛道类型 | 标尺热度 | 商业属性 | 快速验证 |\n`;
  md += `|---|---|---|---|---|---|---|---|\n`;
  result.highGrowthList.forEach((item, idx) => {
    const commTag = item.isCommercial ? "✅ 工具/产品" : "📰 新闻/资讯";
    md += `| ${String(idx + 1).padStart(2, "0")} | **${item.keyword}** | \`${item.growthStatus}\` | **${item.entityDisplayName}** (\`${item.entity}\`) | \`${item.category}\` | ${item.ratioFormatted} | ${commTag} | [📈 对比验证](${item.trendsExploreUrl}) |\n`;
  });

  md += `\n---\n\n`;
  md += `## 🎯 极速变现决策原则（结合《新词极速变现标准指南》）：\n\n`;
  md += `1. **选词金三角**：是新词吗？用户想「做出一个东西」吗？能用现成 API 极低成本一键交付吗？三个都为“是”才入场；\n`;
  md += `2. **不要迷恋大词**：小 20 倍的词（如 \`raindance ai\`）竞品为 0，转化率反而高达 12%~25%，小团队首选抢占 0 竞品精准匹配域名（EMD）；\n`;
  md += `3. **全面贯彻 GEO 8 大文案军规**：标题复述用户问句、H1 一句话讲清输入输出、参数与步骤全用数字、FAQ 首句给结论，让 ChatGPT 在头 48 小时直接向提问用户推荐你的站；\n`;
  md += `4. **收费模式**：坚决采用**一次性积分包（One-time Credits, $4.99~$9.99）**，严禁死磕月订阅制（MRR）；免费试用必须设置每日总预算封顶；\n`;
  md += `5. **防翻车工程底线**：Google 一键登录必须置顶（防邮箱额度卡死）、上线前实测自付走通完整交付、第一天埋设 UTM / Referrer 渠道追踪。\n`;

  return md;
}

export function runReportGeneration(): string {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  let result: NewTrendRadarResult;
  if (fs.existsSync(RADAR_FILE)) {
    result = JSON.parse(fs.readFileSync(RADAR_FILE, "utf-8"));
  } else {
    console.warn("[-] 未找到雷达数据文件，执行即时核验...");
    return "";
  }

  const briefText = formatNewTrendBrief(result);
  const markdownText = generateFullMarkdownReport(result);

  fs.writeFileSync(REPORT_MD_FILE, markdownText, "utf-8");

  console.log("\n" + "=".repeat(60));
  console.log("📱 极简监控播报预览 (可在推送机器人中使用):");
  console.log("=".repeat(60));
  console.log(briefText);
  console.log("=".repeat(60));
  console.log(`📑 完整 Markdown 雷达研报已保存至: ${REPORT_MD_FILE}`);

  return REPORT_MD_FILE;
}

if (process.argv[1] && process.argv[1].endsWith("generate_newtrend_report.ts")) {
  runReportGeneration();
}
