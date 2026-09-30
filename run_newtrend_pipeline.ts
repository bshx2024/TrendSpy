import { fetchAllEntityRisingQueries } from "./fetch_entity_trends.js";
import { runBenchmarkEngine } from "./benchmark_engine.js";
import { runReportGeneration } from "./generate_newtrend_report.js";

export async function main() {
  console.log("\n" + "#".repeat(65));
  console.log("🚀 TrendSpy 3.0 · NewTrend 实体种子拓词与 GPTs 标尺量化全自动流水线");
  console.log("#".repeat(65) + "\n");

  const startTime = Date.now();

  try {
    // 阶段 1: 扫描 AI 核心实体种子库，捕获全部飙升/上升关联词
    console.log("【阶段 1/3】📡 扫描核心 AI 实体种子库 (Entity-Seeded Rising Queries)");
    await fetchAllEntityRisingQueries();

    // 阶段 2: 自动对齐 GPTs 黄金标尺，计算相对倍率与时序生命周期状态
    console.log("\n【阶段 2/3】🧠 Google Trends 标尺量化比率计算与时序状态机判定");
    await runBenchmarkEngine(12, 600);

    // 阶段 3: 输出极简播报与完整 Markdown 决策研报
    console.log("\n【阶段 3/3】📝 生成 NewTrend 监控播报与雷达研报");
    const reportPath = runReportGeneration();

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("\n" + "#".repeat(65));
    console.log(`✨ 全部流水线执行完毕！总耗时: ${durationSec} 秒`);
    console.log(`📑 最终研报路径: ${reportPath}`);
    console.log("#".repeat(65) + "\n");
  } catch (err: any) {
    console.error("[-] 流水线执行过程中发生错误:", err.message);
  }
}

main();
