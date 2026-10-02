import { runGitHubIngestion } from "./fetch_github.js";
import { runGoogleTrendingIngestion } from "./fetch_google_trending.js";
import { fetchTikTokTrends } from "./fetch_tiktok_trends.js";
import { fetchToolifyNewTools } from "./fetch_toolify.js";
import { runViralAnalysis } from "./analyze_viral.js";
import { runTrendsVerification } from "./verify_trends.js";
import { runReportGeneration } from "./generate_radar_report.js";

async function main() {
  console.log("\n" + "#".repeat(65));
  console.log("🚀 TrendSpy 2.0 · 全球新词雷达与流量套利自动化流水线启动");
  console.log("#".repeat(65) + "\n");

  const startTime = Date.now();

  try {
    // 阶段 1：多源数据采集 (Ingestion) - GitHub + Google Trending + TikTok + Toolify AI
    console.log("【阶段 1/4】📡 多源实时采集 (GitHub + Google Trending + TikTok + Toolify)");
    await runGitHubIngestion();
    await runGoogleTrendingIngestion();
    await fetchTikTokTrends();
    await fetchToolifyNewTools();

    // 阶段 2：初筛与意图逆向 (Classification & Trigger Keyword Extraction)
    console.log("\n【阶段 2/4】🧠 C 端自传播性评估 & 搜索触发词逆向");
    runViralAnalysis();

    // 阶段 3：黄金标尺双线核验与异动评分 (Benchmark Verification)
    console.log("\n【阶段 3/4】📈 Google Trends 黄金标尺核验与异动评分");
    await runTrendsVerification();

    // 阶段 4：报告与看板生成 (Report & Arbitrage Dashboard)
    console.log("\n【阶段 4/4】📝 流量套利雷达研报生成");
    const reportPath = runReportGeneration();

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("\n" + "#".repeat(65));
    console.log(`✨ 全部流水线执行完毕！总耗时: ${durationSec} 秒`);
    console.log(`📑 最新套利决策报告已生成至: ${reportPath}`);
    console.log("#".repeat(65) + "\n");
  } catch (err: any) {
    console.error("[-] 流水线执行过程中发生错误:", err.message);
  }
}

main();
