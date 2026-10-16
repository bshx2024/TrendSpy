/**
 * ⚡ TrendSpy · 专有新词极速评估器 (Fast Trend Arbitrage Evaluator)
 * 
 * 用途：
 * 接收社群一线爆款词（如来自 vid2prompt.app/trends、微信群、TikTok 新梗），
 * 5 秒内完成：Google 下拉探针 + SERP 竞品体检 + EMD 域名推荐 + API 套利测算 + GEO 落地文案！
 * 
 * 运行方式：
 * npm run eval -- "higgsfield dance"
 * 或者:
 * npx tsx fast_eval_trend.ts "bulin 47 trend ai"
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { evaluateSerpDifficulty, SerpAnalysisResult } from "./serp_evaluator.js";

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const DATA_DIR = path.join(CURRENT_DIR, "data");
const CANDIDATES_FILE = path.join(DATA_DIR, "candidates.json");
const ALERTS_FILE = path.join(DATA_DIR, "live_alerts.json");

export interface FastEvalReport {
  keyword: string;
  evaluatedAt: string;
  classification: {
    level: "S (极速交付)" | "A (高潜模版)" | "B (关注)";
    deliveryType: string;
    backendApiRecommendation: string;
    estimatedCost: string;
    recommendedPricing: string;
    grossMargin: string;
  };
  serp: SerpAnalysisResult;
  googleSuggests: string[];
  recommendedDomains: string[];
  geoCopyFramework: {
    pageTitle: string;
    h1: string;
    metaDescription: string;
    threeSteps: string[];
    faq: { q: string; a: string }[];
  };
  actionVerdict: string;
}

/**
 * 抓取 Google 官方 Chrome Suggest 联想词
 */
async function fetchGoogleSuggests(kw: string): Promise<string[]> {
  const suggestions: string[] = [];
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(kw + " ")}&gl=us&hl=en`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
      }
    });
    if (res.ok) {
      const data = await res.json();
      const list: string[] = data?.[1] || [];
      for (const item of list) {
        if (item.toLowerCase() !== kw.toLowerCase()) {
          suggestions.push(item);
        }
      }
    }
  } catch {}
  return suggestions.slice(0, 8);
}

/**
 * 域名推荐引擎
 */
function generateEmdIdeas(kw: string): string[] {
  const clean = kw.toLowerCase().replace(/[^a-z0-9]/g, "");
  const short = clean.length > 15 ? clean.slice(0, 15) : clean;
  return [
    `${short}ai.com`,
    `${short}app.com`,
    `try${short}.com`,
    `${short}online.com`,
    `${short}tool.com`,
    `${short}.io`
  ];
}

/**
 * 极速商业化与交付模型推导
 */
export async function evaluateFastTrend(rawKeyword: string): Promise<FastEvalReport> {
  const kw = rawKeyword.trim().toLowerCase();
  const now = new Date().toISOString();

  // 1. Google SERP 竞争体检
  const serp = await evaluateSerpDifficulty(kw);

  // 2. Google Suggest 探针
  const suggests = await fetchGoogleSuggests(kw);

  // 3. 商业交付与 API 匹配推导
  let level: "S (极速交付)" | "A (高潜模版)" | "B (关注)" = "S (极速交付)";
  let deliveryType = "AI 视频与换脸运镜模版";
  let backendApiRecommendation = "Fal.ai / Replicate (Wan2.1 / Kling / Luma API)";
  let estimatedCost = "$0.10 ~ $0.35 / 每次生成";
  let recommendedPricing = "$5.99 一次性积分包 (赠送 15 次生成)";
  let grossMargin = "85% ~ 92%";

  if (kw.includes("filter")) {
    deliveryType = "AI 自传播社交滤镜单页";
    backendApiRecommendation = "Fal.ai (Flux LoRA / FaceSwap)";
    estimatedCost = "$0.04 / 次";
    recommendedPricing = "$4.99 一次性积分包";
  } else if (kw.includes("skin") || kw.includes("card") || kw.includes("roblox skin")) {
    deliveryType = "纯前端 Canvas 卡面/贴纸生成器";
    backendApiRecommendation = "纯前端运行 (0 API 成本，纯静态部署)";
    estimatedCost = "$0.00 / 次";
    recommendedPricing = "$2.99 高清免水印导出或展示广告变现";
    grossMargin = "99%";
  } else if (kw.includes("prompt") || kw.includes("vid2prompt")) {
    deliveryType = "视频逆向 Prompts 提取与风格模版库";
    backendApiRecommendation = "SenseNova / OpenAI Vision (视觉特征提取)";
    estimatedCost = "$0.01 / 次";
    recommendedPricing = "$4.99 / 月 或 一次性购买完整 Prompt 字典";
    grossMargin = "95%";
  } else if (kw.includes("codes") || kw.includes("calculator") || kw.includes("game")) {
    level = "A (高潜模版)";
    deliveryType = "游戏礼包码聚合与即时计算器单页";
    backendApiRecommendation = "GitHub Actions 每日定时爬虫 + 纯静态 JSON";
    estimatedCost = "$0.00 / 次";
    recommendedPricing = "Google AdSense / 买量联盟分成";
    grossMargin = "98%";
  }

  // 4. EMD 域名建议
  const recommendedDomains = generateEmdIdeas(kw);

  // 5. GEO 8 大军规落地页文案框架
  const capitalizedKw = kw.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const pageTitle = `${capitalizedKw} - Free Two-Photo AI Generator (2026)`;
  const h1 = `Two photos. One ${capitalizedKw} in 30 seconds.`;
  const metaDescription = `Turn 2 photos into viral ${capitalizedKw} video instantly. 100% online, no complex app installation, 9:16 vertical export for TikTok & Reels.`;
  
  const threeSteps = [
    "Step 1: Upload 1-2 clear front-facing portrait photos (JPG/PNG under 10MB).",
    `Step 2: Select the viral ${capitalizedKw} preset motion template and click Generate.`,
    "Step 3: Preview free 720p output in 30s, or unlock 1080p HD watermark-free export for $5.99."
  ];

  const faq = [
    {
      q: `Is this ${capitalizedKw} tool free to use?`,
      a: "Yes. Every new user receives 1 free preview credit with no credit card required."
    },
    {
      q: `Do I need previous video editing experience?`,
      a: `No. Our AI handles facial alignment, optical flow, and music tempo synchronization automatically.`
    },
    {
      q: `Can I export in vertical format for TikTok and Instagram Reels?`,
      a: `Yes, all generated outputs are formatted in native 9:16 (1080×1920) for immediate social posting.`
    }
  ];

  // 6. 行动决策裁决
  let actionVerdict = "⭐⭐⭐ 强烈建议立即上站！SERP 处于极早期信息真空，24小时上线极易吃满首发红利。";
  if (serp.difficultyScore >= 80) {
    actionVerdict = "⭐⭐ 建议做差异化长尾词内页（主词已有大厂霸榜，需加 free/template 后缀）。";
  } else if (serp.hasSmallSiteRanking) {
    actionVerdict = "⭐⭐⭐⭐ 黄金机会！已有独立托管站排在前排，证明权威度门槛极低，上线即有曝光！";
  }

  const report: FastEvalReport = {
    keyword: kw,
    evaluatedAt: now,
    classification: {
      level,
      deliveryType,
      backendApiRecommendation,
      estimatedCost,
      recommendedPricing,
      grossMargin
    },
    serp,
    googleSuggests: suggests,
    recommendedDomains,
    geoCopyFramework: {
      pageTitle,
      h1,
      metaDescription,
      threeSteps,
      faq
    },
    actionVerdict
  };

  // 7. 写入数据落盘 (同步至 candidates.json)
  saveToCandidates(report);

  return report;
}

/**
 * 保存评估结果至 candidates.json 便于 Web SaaS 控制台直接查看
 */
function saveToCandidates(report: FastEvalReport) {
  try {
    let data: any = { count: 0, candidates: [] };
    if (fs.existsSync(CANDIDATES_FILE)) {
      data = JSON.parse(fs.readFileSync(CANDIDATES_FILE, "utf-8"));
      if (!Array.isArray(data.candidates)) data.candidates = [];
    }

    const id = `fast-eval-${Date.now()}`;
    const newCandidate = {
      id,
      source: "fast-eval-probe",
      sourceName: "User Exclusive Trend Input",
      sourceUrl: `https://trends.google.com/trends/explore?q=${encodeURIComponent(report.keyword)}`,
      description: `【极速出单评估】${report.classification.deliveryType} | ${report.actionVerdict}`,
      starsOrScore: 99,
      categoryTag: report.classification.deliveryType,
      isB2C: true,
      shareabilityScore: 10,
      richMediaOutput: report.classification.deliveryType,
      triggerKeyword: report.keyword,
      alternativeKeywords: report.googleSuggests.slice(0, 4),
      suggestedAction: report.classification.backendApiRecommendation,
      emdDomainIdeas: report.recommendedDomains.slice(0, 4),
      rationale: `选词金三角快速评估通过。SERP 难度评分: ${report.serp.difficultyScore} (${report.serp.opportunityLevel})。毛利率: ${report.classification.grossMargin}。`,
      status: "accepted",
      evaluatedAt: report.evaluatedAt,
      geoCopy: report.geoCopyFramework
    };

    // 去重更新
    data.candidates = [newCandidate, ...data.candidates.filter((c: any) => c.triggerKeyword !== report.keyword)].slice(0, 50);
    data.count = data.candidates.length;
    fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err: any) {
    console.warn("[-] 写入 candidates.json 失败:", err.message);
  }
}

/**
 * 格式化终端输出
 */
export function printReport(report: FastEvalReport) {
  console.log("\n" + "=".repeat(65));
  console.log(`⚡ 【TrendSpy 专有新词闪电研报】: "${report.keyword.toUpperCase()}"`);
  console.log("=".repeat(65));

  console.log(`\n📌 1. 评级与交付形态:`);
  console.log(`   - 评级: \x1b[32m${report.classification.level}\x1b[0m`);
  console.log(`   - 交付形态: ${report.classification.deliveryType}`);
  console.log(`   - 建议后端 API: ${report.classification.backendApiRecommendation}`);
  console.log(`   - 成本预估: ${report.classification.estimatedCost}`);
  console.log(`   - 定价建议: ${report.classification.recommendedPricing} (毛利 ${report.classification.grossMargin})`);

  console.log(`\n🔍 2. SERP 竞争态势:`);
  console.log(`   - 机会评级: ${report.serp.opportunityLevel}`);
  console.log(`   - 难度评分: ${report.serp.difficultyScore}/100`);
  console.log(`   - 是否有独立小站排前排: ${report.serp.hasSmallSiteRanking ? "✅ 是 (低权重站已有肉吃)" : "❌ 暂无"}`);
  console.log(`   - 前排域名: ${report.serp.dominantDomains.slice(0, 5).join(", ") || "无"}`);

  if (report.googleSuggests.length > 0) {
    console.log(`\n📈 3. Google Chrome 实时联想长尾词 (用户真正在搜什么):`);
    report.googleSuggests.forEach((s, idx) => console.log(`   ${idx + 1}. ${s}`));
  }

  console.log(`\n🌐 4. 黄金 EMD 域名推荐:`);
  console.log(`   ${report.recommendedDomains.slice(0, 4).join("  |  ")}`);

  console.log(`\n🤖 5. GEO 落地页 8 大军规核心文案 (喂给 AI 搜索的答案):`);
  console.log(`   - Title: \x1b[36m${report.geoCopyFramework.pageTitle}\x1b[0m`);
  console.log(`   - H1:    \x1b[33m${report.geoCopyFramework.h1}\x1b[0m`);
  console.log(`   - Meta:  ${report.geoCopyFramework.metaDescription}`);
  console.log(`   - 步骤:`);
  report.geoCopyFramework.threeSteps.forEach(st => console.log(`     • ${st}`));
  console.log(`   - 首句 FAQ (ChatGPT 收录首选):`);
  console.log(`     Q: ${report.geoCopyFramework.faq[0].q}`);
  console.log(`     A: ${report.geoCopyFramework.faq[0].a}`);

  console.log("\n" + "-".repeat(65));
  console.log(`🎯 决策结论: \x1b[1m\x1b[32m${report.actionVerdict}\x1b[0m`);
  console.log(`💾 结果已同步至控制台数据库: data/candidates.json`);
  console.log("=".repeat(65) + "\n");
}

// CLI 执行入口
async function main() {
  const args = process.argv.slice(2);
  let keyword = args.join(" ").trim();

  if (!keyword) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    keyword = await new Promise<string>((resolve) => {
      rl.question("\n请输入你要极速评估的 AI 视频新词 / 社交新玩法 (例如: higgsfield dance, bulin 47 trend ai): ", (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    });
  }

  if (!keyword) {
    console.log("[-] 未输入任何关键词，退出。");
    process.exit(0);
  }

  console.log(`\n⚡ 正在对关键词 "${keyword}" 执行 360° 极速可行性评估与 SERP 体检...`);
  const report = await evaluateFastTrend(keyword);
  printReport(report);
}

if (process.argv[1] && process.argv[1].endsWith("fast_eval_trend.ts")) {
  main().catch((err) => {
    console.error("[-] 评估失败:", err);
    process.exit(1);
  });
}
