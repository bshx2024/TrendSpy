import fs from "node:fs";
import path from "node:path";
import { EntityRisingQuery } from "./fetch_entity_trends.js";
import { trendsClient, TimelineCompareResult } from "./google_trends_client.js";
import { trendTracker, StoredKeywordRecord } from "./trend_tracker.js";
import { probeGoogleDemand } from "./probe_google.js";

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const DATA_DIR = path.join(CURRENT_DIR, "data");
const INPUT_RISING_FILE = path.join(DATA_DIR, "raw_entity_rising.json");
const BENCHMARK_RADAR_FILE = path.join(DATA_DIR, "benchmark_radar_output.json");

export const GOLDEN_BENCHMARK = "gpts";

// 纯新闻、人事、诉讼、学术吃瓜负面词
const GOSSIP_NEWS_REGEX =
  /\b(quits|quit|resigns|resigned|lawsuit|lawsuits|terminated|contractors|contractor|equation|court|interview|critique|controversy|allegations|discovery|died|arrested|fired|salary|net worth|billionaire|legal action)\b/i;

// 实体同名传统实体/日用品/服饰箱包干扰词 (例如 adidas flux, samsonite flux, mistral food warmer)
const COMMODITY_HOMONYM_REGEX =
  /\b(adidas|nike|shoes|sneaker|samsonite|spinner|luggage|suitcase|buffet|warmer|heater|appliance|unit of light|light flux|clothing|women|men|shirt|pants|shop lc)\b/i;

export function evaluateCommercialIntent(query: string): { isCommercial: boolean; rejectReason?: string } {
  const clean = query.trim().toLowerCase();

  if (clean.length <= 3 && !["ai", "app"].includes(clean)) {
    return { isCommercial: false, rejectReason: "超短无意义词/噪点" };
  }

  if (GOSSIP_NEWS_REGEX.test(clean)) {
    return { isCommercial: false, rejectReason: "纯新闻/人事/诉讼/学术非工具词" };
  }

  if (COMMODITY_HOMONYM_REGEX.test(clean)) {
    return { isCommercial: false, rejectReason: "同名传统工业品/服饰箱包干扰" };
  }

  if (clean.includes("jacob coxon") || clean.includes("sam altman") || clean.includes("jason isbell")) {
    return { isCommercial: false, rejectReason: "人名新闻八卦" };
  }

  return { isCommercial: true };
}

export interface BenchmarkVerifiedItem {
  id: number;
  keyword: string;
  clusterRoot: string;
  relatedVariants: string[];
  entity: string;
  entityDisplayName: string;
  category: string;
  growthStatus: string;
  isBreakout: boolean;
  benchmarkRatio: number;
  ratioFormatted: string;
  peakTarget: number;
  currentMomentum: string;
  lifecycleStage: "新词首次爆发" | "老词二次爆火" | "常青大盘老词" | "高涨幅上升词" | "平稳维持" | "过气阴跌";
  isCommercial: boolean;
  firstSeenDate: string;
  breakoutDate: string;
  suggestedAction: string;
  trendsExploreUrl: string;
  serpUrl: string;
}

export interface NewTrendRadarResult {
  generatedAt: string;
  benchmark: string;
  newBreakouts: BenchmarkVerifiedItem[];
  reSurging: BenchmarkVerifiedItem[];
  highGrowthList: BenchmarkVerifiedItem[];
}

function formatDateShort(isoOrStr: string): string {
  if (!isoOrStr) return "近期";
  const parts = isoOrStr.split("-");
  if (parts.length >= 3) {
    return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
  }
  return isoOrStr;
}

function extractClusterRoot(query: string, entity: string): string {
  const stopWords = new Set([
    "ai", "free", "video", "generator", "online", "app", "tool", "login",
    "download", "tutorial", "maker", "prompt", "model", entity.toLowerCase()
  ]);
  const words = query.toLowerCase().split(/[\s\-_]+/).filter((w) => !stopWords.has(w) && w.length > 2);
  if (words.length > 0) {
    return words[0];
  }
  return query.toLowerCase();
}

export async function runBenchmarkEngine(
  maxDetailedVerify = 20,
  delayMs = 800
): Promise<NewTrendRadarResult> {
  console.log("=".repeat(60));
  console.log(`🧠 启动【商业意图清洗 + 语义聚类 + GPTs 标尺量化引擎】...`);
  console.log(`   🎯 基准标尺: [${GOLDEN_BENCHMARK}]`);
  console.log("=".repeat(60));

  let rawRisingItems: EntityRisingQuery[] = [];

  if (fs.existsSync(INPUT_RISING_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(INPUT_RISING_FILE, "utf-8"));
      rawRisingItems = data.items || [];
    } catch {}
  }

  // 1. 先进行语义事件聚类 (Clustering)
  const clusterMap = new Map<string, EntityRisingQuery[]>();
  for (const item of rawRisingItems) {
    const root = extractClusterRoot(item.query, item.entity);
    const clusterKey = `${item.entity}::${root}`;
    if (!clusterMap.has(clusterKey)) {
      clusterMap.set(clusterKey, []);
    }
    clusterMap.get(clusterKey)!.push(item);
  }

  const clusteredCandidates: Array<{
    representative: EntityRisingQuery;
    clusterRoot: string;
    variants: string[];
    isCommercial: boolean;
  }> = [];

  for (const [clusterKey, group] of clusterMap.entries()) {
    const root = clusterKey.split("::")[1];

    // 优先选有 free/maker/ai/generator 且 Breakout 的
    group.sort((a, b) => {
      const aTool = /\b(free|maker|generator|video|online|login)\b/i.test(a.query);
      const bTool = /\b(free|maker|generator|video|online|login)\b/i.test(b.query);
      if (aTool && !bTool) return -1;
      if (!aTool && bTool) return 1;
      return (b.isBreakout ? 1 : 0) - (a.isBreakout ? 1 : 0) || b.value - a.value;
    });

    const rep = group[0];
    const commercialCheck = evaluateCommercialIntent(rep.query);
    const variants = group.slice(1).map((g) => g.query);

    clusteredCandidates.push({
      representative: rep,
      clusterRoot: root,
      variants,
      isCommercial: commercialCheck.isCommercial
    });
  }

  // 优先排序：商业可变现 + Breakout 优先
  clusteredCandidates.sort((a, b) => {
    if (a.isCommercial && !b.isCommercial) return -1;
    if (!a.isCommercial && b.isCommercial) return 1;
    return (
      (b.representative.isBreakout ? 1 : 0) - (a.representative.isBreakout ? 1 : 0) ||
      b.representative.value - a.representative.value
    );
  });

  const allVerified: BenchmarkVerifiedItem[] = [];
  const itemsToVerify = clusteredCandidates.slice(0, maxDetailedVerify);

  for (let i = 0; i < itemsToVerify.length; i++) {
    const { representative: item, clusterRoot, variants, isCommercial } = itemsToVerify[i];

    console.log(
      `[${i + 1}/${itemsToVerify.length}] 正在研判 [${item.query}] (母词: ${clusterRoot}, 商业属性: ${
        isCommercial ? "✅ 工具/产品" : "❌ 资讯八卦"
      }) ...`
    );

    let ratio = item.isBreakout ? 0.45 : 0.15;
    let momentum = "上升中";
    let firstSeen = "";
    let breakout = "";
    let peak = 50;

    // 尝试拉取 Trends 时序对比
    try {
      const compareRes = await trendsClient.fetchCompareTimeline(item.query, GOLDEN_BENCHMARK, "today 1-m");
      if (compareRes) {
        ratio = compareRes.benchmarkRatio;
        peak = compareRes.peakTarget;
        momentum = compareRes.currentMomentum.replace(/[^一-龟a-zA-Z]/g, "") || "上升中";
        firstSeen = compareRes.firstSeenEstimate;
        breakout = compareRes.breakoutEstimate;
      } else {
        // Fallback: 使用 Google Suggest 探针计算需求强度
        const probe = await probeGoogleDemand(item.query);
        ratio = probe.hasRealDemand ? Math.max(0.3, (probe.demandScore / 100) * 0.8) : 0.05;
      }
    } catch {
      ratio = item.isBreakout ? 0.35 : 0.1;
    }

    const record = trendTracker.trackKeyword({
      keyword: item.query,
      entity: item.entity,
      category: item.category,
      ratio,
      value: item.value,
      growthFormatted: item.formattedGrowth,
      isBreakout: item.isBreakout,
      firstSeenEstimate: firstSeen,
      breakoutEstimate: breakout,
      suggestedAction: item.suggestedActionType
    });

    // 🔬 12 个月历史基线探测：区分“真首发新词”与“常青存量老词”
    let isEvergreen = false;

    // 1. 通用工具词规则拦截 (无具体 AI 新生实体，带 maker/receipt/generator/template 等存量词)
    const isGenericTool =
      /\b(maker|generator|template|calculator|converter|invoice|receipt|resume|builder)\b/i.test(item.query) &&
      !/\b(ai|sora|flux|kling|higgsfield|claude|deepseek|genjutsu|migos|capafy|musicgpt)\b/i.test(item.query);

    if (isGenericTool) {
      isEvergreen = true;
      console.log(`   🏛️ [${item.query}] 命中通用工具命名规则，识别为多年常青词 (剥离出新词主榜)`);
    } else if (isCommercial && ratio >= 0.25) {
      try {
        const baseline = await trendsClient.checkHistoricalBaseline(item.query);
        if (!baseline.isTrueNewTerm) {
          isEvergreen = true;
          console.log(`   🏛️ [${item.query}] 命中常青老词基线: ${baseline.reason}`);
        } else {
          console.log(`   🌟 [${item.query}] 12个月基线确认纯新词: ${baseline.reason}`);
        }
      } catch {}
    }

    const finalStage = isEvergreen ? "常青大盘老词" : record.lifecycleStage;

    const qTarget = encodeURIComponent(item.query);
    const qCompare = `${qTarget},${encodeURIComponent(GOLDEN_BENCHMARK)}`;
    const trendsExploreUrl = `https://trends.google.com/trends/explore?date=today%201-m&q=${qCompare}`;
    const serpUrl = `https://www.google.com/search?q=${qTarget}`;

    allVerified.push({
      id: i + 1,
      keyword: item.query,
      clusterRoot,
      relatedVariants: variants,
      entity: item.entity,
      entityDisplayName: item.entityDisplayName,
      category: item.category,
      growthStatus: item.isBreakout ? "飙升" : item.formattedGrowth,
      isBreakout: item.isBreakout,
      benchmarkRatio: Number(ratio.toFixed(3)),
      ratioFormatted: `GPTs×${ratio.toFixed(3)}`,
      peakTarget: peak,
      currentMomentum: momentum,
      lifecycleStage: finalStage,
      isCommercial,
      firstSeenDate: formatDateShort(record.firstSeenDate),
      breakoutDate: formatDateShort(record.breakoutDate),
      suggestedAction: record.suggestedAction,
      trendsExploreUrl,
      serpUrl
    });

    if (i < itemsToVerify.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  // 补充剩余候选词入全量高涨幅表
  const remaining = clusteredCandidates.slice(maxDetailedVerify);
  for (let j = 0; j < remaining.length; j++) {
    const { representative: item, clusterRoot, variants, isCommercial } = remaining[j];
    const qTarget = encodeURIComponent(item.query);
    const qCompare = `${qTarget},${encodeURIComponent(GOLDEN_BENCHMARK)}`;

    allVerified.push({
      id: itemsToVerify.length + j + 1,
      keyword: item.query,
      clusterRoot,
      relatedVariants: variants,
      entity: item.entity,
      entityDisplayName: item.entityDisplayName,
      category: item.category,
      growthStatus: item.isBreakout ? "飙升" : item.formattedGrowth,
      isBreakout: item.isBreakout,
      benchmarkRatio: 0.05,
      ratioFormatted: "GPTs×0.050",
      peakTarget: 10,
      currentMomentum: "上升中",
      lifecycleStage: "高涨幅上升词",
      isCommercial,
      firstSeenDate: "近期",
      breakoutDate: "近期",
      suggestedAction: item.suggestedActionType,
      trendsExploreUrl: `https://trends.google.com/trends/explore?date=today%201-m&q=${qCompare}`,
      serpUrl: `https://www.google.com/search?q=${qTarget}`
    });
  }

  trendTracker.saveDatabase();

  // 严苛精选主榜 (极简高信噪比：商业意图 + 实体去重 + 达到门槛)
  const seenEntities = new Set<string>();
  const topNewBreakouts: BenchmarkVerifiedItem[] = [];

  for (const item of allVerified) {
    if (
      item.isCommercial &&
      item.benchmarkRatio >= 0.25 &&
      item.currentMomentum !== "底部沉睡" &&
      item.lifecycleStage === "新词首次爆发"
    ) {
      // 每个母实体下在精选榜中只给 1 个最强代表名额，避免霸屏
      if (!seenEntities.has(item.entity)) {
        seenEntities.add(item.entity);
        topNewBreakouts.push(item);
      }
    }
  }

  const reSurging = allVerified.filter(
    (item) =>
      item.isCommercial &&
      item.benchmarkRatio >= 0.25 &&
      item.currentMomentum !== "底部沉睡" &&
      item.lifecycleStage === "老词二次爆火"
  );

  const result: NewTrendRadarResult = {
    generatedAt: new Date().toISOString(),
    benchmark: GOLDEN_BENCHMARK,
    newBreakouts: topNewBreakouts.slice(0, 3), // 主榜控制在 1~3 个真正值得重仓的黄金词
    reSurging: reSurging.slice(0, 3),
    highGrowthList: allVerified
  };

  fs.writeFileSync(BENCHMARK_RADAR_FILE, JSON.stringify(result, null, 2), "utf-8");

  console.log("=".repeat(60));
  console.log(`✅ 商业精滤与聚类量化完毕！`);
  console.log(`   🌟 高信噪比核心新词: ${result.newBreakouts.length} 个 (严格控制在 1~3 个)`);
  console.log(`   🔄 老词二次爆火: ${result.reSurging.length} 个`);
  console.log(`   📈 全景上升词池: ${result.highGrowthList.length} 个`);
  console.log("=".repeat(60));

  return result;
}

if (process.argv[1] && process.argv[1].endsWith("benchmark_engine.ts")) {
  runBenchmarkEngine();
}
