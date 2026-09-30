/**
 * 全自动巡航主入口 (Full Automated Cruise Runner)
 * 供 GitHub Actions 定时任务与云端 Cron 调用
 */
import { runGitHubIngestion } from "./fetch_github.js";
import { runGoogleTrendingIngestion } from "./fetch_google_trending.js";
import { runViralAnalysis } from "./analyze_viral.js";
import { runTrendsVerification } from "./verify_trends.js";
import { runReportGeneration as runRadarReport } from "./generate_radar_report.js";

import { fetchAllEntityRisingQueries } from "./fetch_entity_trends.js";
import { runBenchmarkEngine } from "./benchmark_engine.js";
import { runReportGeneration as runNewtrendReport } from "./generate_newtrend_report.js";

async function runSafe(name: string, fn: () => Promise<any> | any) {
  const start = Date.now();
  console.log(`\n>>> [任务开始] ${name}...`);
  try {
    await fn();
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✔ [任务成功] ${name} 完成，耗时: ${duration}s`);
  } catch (err: any) {
    console.error(`✖ [任务降级] ${name} 遇到异常 (已捕获兜底，不中断主流程):`, err.message);
  }
}

export async function main() {
  console.log("\n" + "=".repeat(65));
  console.log("🚀 TrendSpy · 全球新词探测与流量套利自动化定时巡航启动");
  console.log(`🕒 启动时间 (UTC): ${new Date().toISOString()}`);
  console.log("=".repeat(65));

  const totalStart = Date.now();

  // 1. Google 官方 Trending 实时飙升榜采集
  await runSafe("Google Trending 每日飙升榜采集", () => runGoogleTrendingIngestion());

  // 2. GitHub 敏捷爆发代码库采集
  await runSafe("GitHub 敏捷项目采集", () => runGitHubIngestion());

  // 3. C 端自传播特征与意图逆向
  await runSafe("C端自传播特征与意图逆向分析", () => runViralAnalysis());

  // 4. 套利雷达核验与报告生成
  await runSafe("Google Trends 标尺核验与异动评分", () => runTrendsVerification());
  await runSafe("套利决策雷达报告生成", () => runRadarReport());

  // 5. 核心 AI 实体种子库与 Chrome 下拉探针拓词
  await runSafe("扫描核心 AI 实体种子库与下拉探针", () => fetchAllEntityRisingQueries());

  // 6. GPTs 黄金标尺比率量化与时序生命周期状态机
  await runSafe("GPTs 黄金标尺量化与生命周期判定", () => runBenchmarkEngine(12, 600));

  // 7. NewTrend 决策研报与播报看板输出
  await runSafe("NewTrend 研报生成", () => runNewtrendReport());

  const totalSec = ((Date.now() - totalStart) / 1000).toFixed(1);
  console.log("\n" + "=".repeat(65));
  console.log(`✨ 本轮全自动化巡航完成！总耗时: ${totalSec} 秒`);
  console.log("=".repeat(65) + "\n");
}

main();
