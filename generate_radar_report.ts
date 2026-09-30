import fs from "node:fs";
import path from "node:path";
import { VerifiedRadarItem, BENCHMARK_TOOL } from "./verify_trends.js";
import { ViralCandidate } from "./analyze_viral.js";

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const DATA_DIR = path.join(CURRENT_DIR, "data");
const REPORTS_DIR = path.join(CURRENT_DIR, "reports");
const VERIFIED_FILE = path.join(DATA_DIR, "verified_radar.json");
const REJECTED_FILE = path.join(DATA_DIR, "rejected_candidates.json");

export function generateRadarReportMarkdown(items: VerifiedRadarItem[], rejected: ViralCandidate[]): string {
  const dateStr = new Date().toISOString().split("T")[0];
  const timeStr = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

  const actionableItems = items.filter(i => i.isActionable);
  const nonActionableItems = items.filter(i => !i.isActionable);

  let md = `# 🎯 TrendSpy 2.0 · 出海流量雷达与真实生命周期研报 (诚实验真版)\n\n`;
  md += `> **生成时间**：${timeStr}  \n`;
  md += `> **实战黄金原则**：**宁缺毋滥，拒绝粉饰！只做“0 到 100 陡峭拔地而起”的爆发新词，坚决不为“已过顶峰的过气老词”接盘！**  \n\n`;

  // 诚实警报条 (Honest Status Banner)
  if (actionableItems.length === 0) {
    md += `> [!WARNING]  \n`;
    md += `> **⚠️ 今日大盘实战研判结论：【今日暂无可做的黄金新词，强烈建议观望，严禁盲目建站！】**  \n`;
    md += `> 本轮监测的候选项目中，**全部属于「过气阴跌老词」或「常青无异动词」**（如 \`card skin\` 和 \`desktop pet\` 顶峰均在半年前，目前正处于腰斩下跌走势）。  \n`;
    md += `> 市场今天没有出现原作者那种“3~5 天从 0 陡增至 100”的真正突破新玩法，**捂紧钱包、不买域名、不做无效开发才是最明智的黑客增长策略！**\n\n`;
  } else {
    md += `> [!IMPORTANT]  \n`;
    md += `> **🔥 今日发现 ${actionableItems.length} 个真正处于“0 到 100 陡拉金叉”阶段的爆发新词！建议立即执行 24 小时卡位战！**\n\n`;
  }

  md += `---\n\n`;

  md += `## 📊 全链路词汇生命周期穿透大表（防接盘必看 12 个月大盘）\n\n`;
  md += `| # | 是否可做 | 真实生命周期研判 | 🎯 核心搜索词 | 🔍 实战判定依据与大盘真相 | 📈 Google Trends 实测直达 (12个月大盘) | 💡 建议动作 |\n`;
  md += `|---|---|---|---|---|---|---|\n`;

  items.forEach((item, idx) => {
    const num = String(idx + 1).padStart(2, "0");
    const actionableBadge = item.isActionable ? "🟢 **可以做**" : "🔴 **不能做**";
    const trendsLinks = `[📈 **12个月大盘 (防接盘必看)**](${item.trendsUrl12m})<br>[🗓️ 30天走势](${item.trendsUrl30d})<br>[📊 vs ${BENCHMARK_TOOL}](${item.trendsCompareToolUrl})`;

    md += `| ${num} | ${actionableBadge} | **${item.trendStatus}** | **\`${item.triggerKeyword}\`**<br><small>原型: [${item.sourceName}](${item.sourceUrl})</small> | ${item.verdictRationale} | ${trendsLinks} | \`${item.isActionable ? "极速抢注 EMD 上站" : "放弃，严禁入场接盘"}\` |\n`;
  });

  md += `\n---\n\n`;

  md += `## 💡 怎样一眼识别一个词“能不能做”？（4 种走势对照法）\n\n`;
  md += `1. **🔥 真正可套利的爆发新词（金叉）**：\n`;
  md += `   - **形态**：过去 1 年甚至 1 个月前，折线是一条贴地的死线（0~10分）；在最近 3~7 天内**直插云霄、断崖式拉起到 80~100 分**！\n`;
  md += `   - **本质**：全新的专有玩法/新产品（如刚出时的 \`napkin ai\`、\`flux ai\`），全网尚无专门网站，空降 Google 第一名！\n\n`;
  md += `2. **📉 过气阴跌老词（千万别做！）**：\n`;
  md += `   - **形态**：看 12 个月大盘，峰值 100 出现在半年前或 3 个月前，目前折线一路往下掉（腰斩到 20~30 分）。\n`;
  md += `   - **典型**：\`card skin\`、\`desktop pet\`。你现在进去就是给半年前的老站当分母，白买域名白建站！\n\n`;
  md += `3. **💤 平稳常青老词（做不做意义不大）**：\n`;
  md += `   - **形态**：长年平缓在 10~20 分，没有波动，也没有爆发。\n`;
  md += `   - **典型**：\`minecraft blueprint\`、\`risograph\`。蛋糕已被老牌大站分光，没有套利真空。\n\n`;
  md += `4. **❌ 统计噪点孤针（骗子形态）**：\n`;
  md += `   - **形态**：长尾拼凑词（如 4 个单词组合），某 1 个小时因为 2 个人搜索被放大成 100 尖刺，前后全是 0。\n`;

  md += `---\n\n`;

  md += `## 🛠️ 下一步：如何捕捉真正的“今日爆发新词”？\n\n`;
  md += `1. **扩大雷达广度**：已接入 Google 官方每日飙升榜 (\`fetch_google_trending.ts\`) 与 GitHub 实时 Velocity 监控；\n`;
  md += `2. **每天早上跑一次 \`npm run radar\`**：\n`;
  md += `   - 如果早报显示 🔴 **全部不能做**，**0 秒关闭，不浪费一分钱**；\n`;
  md += `   - 一旦早报亮起 🟢 **发现真金叉**，立刻在 24 小时内拿下域名抢位上站！\n\n`;

  return md;
}

export function runReportGeneration(): string {
  console.log("=".repeat(60));
  console.log("📝 正在生成【防接盘/真实生命周期】雷达早报...");
  console.log("=".repeat(60));

  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const verifiedData = JSON.parse(fs.readFileSync(VERIFIED_FILE, "utf-8"));
  const verifiedItems: VerifiedRadarItem[] = verifiedData.verified || [];

  let rejectedItems: ViralCandidate[] = [];
  if (fs.existsSync(REJECTED_FILE)) {
    try {
      rejectedItems = JSON.parse(fs.readFileSync(REJECTED_FILE, "utf-8")).rejected || [];
    } catch {}
  }

  const reportMd = generateRadarReportMarkdown(verifiedItems, rejectedItems);
  const dateStr = new Date().toISOString().split("T")[0];
  const reportPath = path.join(REPORTS_DIR, `arbitrage_radar_report_${dateStr}.md`);

  fs.writeFileSync(reportPath, reportMd, "utf-8");

  console.log(`🎉 研判早报生成成功！`);
  console.log(`📁 报告路径: ${reportPath}`);
  console.log("=".repeat(60));

  return reportPath;
}

if (process.argv[1] && process.argv[1].endsWith("generate_radar_report.ts")) {
  runReportGeneration();
}
