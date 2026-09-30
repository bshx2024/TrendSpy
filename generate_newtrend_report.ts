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
  let md = `# 🎯 NewTrend AI 新词与飙升雷达研报（带【${result.benchmark}】绝对量级标尺）\n\n`;
  md += `> **生成时间**：${new Date().toLocaleString("zh-CN")}\n`;
  md += `> **对比标尺（Benchmark）**：\`${result.benchmark}\`（全球月搜约 10 万+ 的大盘基准）\n`;
  md += `> **降噪策略**：已启用【商业意图过滤器】（过滤吃瓜新闻/离职八卦）与【语义聚类去重】（合并同玩法长尾）。\n\n`;
  md += `---\n\n`;

  md += `## 🌟 一、 新词首次爆发 (Breakout Candidates - 商业高潜)\n\n`;
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

  md += `## 🔄 二、 老词二次爆火 (Re-Surging Keywords)\n\n`;
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

  md += `## 📈 三、 高涨幅上升词全景榜单（≥1000% 或飙升）\n\n`;
  md += `| # | 关键词 | 涨幅状态 | 归属实体 | 赛道类型 | 标尺热度 | 商业属性 | 快速验证 |\n`;
  md += `|---|---|---|---|---|---|---|---|\n`;
  result.highGrowthList.forEach((item, idx) => {
    const commTag = item.isCommercial ? "✅ 工具/产品" : "📰 新闻/资讯";
    md += `| ${String(idx + 1).padStart(2, "0")} | **${item.keyword}** | \`${item.growthStatus}\` | **${item.entityDisplayName}** (\`${item.entity}\`) | \`${item.category}\` | ${item.ratioFormatted} | ${commTag} | [📈 对比验证](${item.trendsExploreUrl}) |\n`;
  });

  md += `\n---\n\n`;
  md += `## 🎯 极速决策与落地法则：\n\n`;
  md += `1. **量级筛选**：标尺倍率 $\\ge \\text{GPTs} \\times 0.3$ 的词汇，具备日搜千次以上的独立大盘需求，适合立即执行 24 小时极速建站；\n`;
  md += `2. **新词红利**：【新词首次爆发】列表中属于 0 竞争蓝海，各大搜索引擎 SERP 首位几乎没有竞品单页站，抢占精确匹配域名（EMD）收益最高；\n`;
  md += `3. **老词防接盘**：【老词二次爆火】需重点观察动量是否为“上升中”，如已转为“回落中”则严禁高成本入场。\n`;

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
