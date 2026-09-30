import fs from "node:fs";
import path from "node:path";
import { ViralCandidate } from "./analyze_viral.js";
import { probeGoogleDemand, GoogleDemandResult } from "./probe_google.js";

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const DATA_DIR = path.join(CURRENT_DIR, "data");
const CANDIDATES_FILE = path.join(DATA_DIR, "candidates.json");
const VERIFIED_FILE = path.join(DATA_DIR, "verified_radar.json");
const REJECTED_FILE = path.join(DATA_DIR, "rejected_candidates.json");

export const BENCHMARK_TOOL = "receiptify"; // 出海轻量爆款小工具标尺

export type TrendStatusType = 
  | "🔥 真正爆发新词 (Breakout)"       // 过去 7~30 天从 0 陡峭拉升至 80~100 (极少见，千载难逢)
  | "📉 过气阴跌老词 (Declining)"      // 过去 6~12 个月已经达到过峰值，目前正在腰斩阴跌 (严禁接盘!)
  | "💤 平稳常青无异动 (Dormant)"       // 常年趴在 10~20 分的死线，无突发流量红利
  | "❌ 伪造死词/无数据 (No Data)";     // Google 官方查无此词

export interface VerifiedRadarItem extends ViralCandidate {
  trendsUrl30d: string;          // 过去30天走势
  trendsUrl12m: string;          // 过去12个月走势 (防接盘必看!)
  trendsCompareToolUrl: string;  // vs receiptify 标尺
  googleSerpUrl: string;
  trendStatus: TrendStatusType;
  isActionable: boolean;         // 是否真正具备可操作的套利价值 (True / False)
  verdictRationale: string;      // 判决核心依据
  demandScore: number;
  liveGoogleSuggestions: string[];
}

export function buildTrendsUrl(targetKeyword: string, period = "today 1-m"): string {
  return `https://trends.google.com/trends/explore?date=${encodeURIComponent(period)}&q=${encodeURIComponent(targetKeyword)}`;
}

export function buildCompareTrendsUrl(targetKeyword: string, benchmark: string, period = "today 1-m"): string {
  const qCompare = `${encodeURIComponent(targetKeyword)},${encodeURIComponent(benchmark)}`;
  return `https://trends.google.com/trends/explore?date=${encodeURIComponent(period)}&q=${qCompare}`;
}

export function buildSerpUrl(targetKeyword: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(targetKeyword)}`;
}

/**
 * 历史生命周期与真突破判定模型 (Zero-Bullshit Trend Classifier)
 * 拒绝一切虚假推荐，严格排查“过气阴跌”与“常青死线”！
 */
export function classifyTrendLifecycle(keyword: string, probeRes: GoogleDemandResult): {
  status: TrendStatusType;
  isActionable: boolean;
  rationale: string;
} {
  const kw = keyword.toLowerCase();

  // 1. 已被大盘实测证实的过气老词库（历史峰值已过，目前正在阴跌腰斩）
  const DECLINING_KEYWORDS = [
    "card skin",      // 2026 年初已达 100 峰值，目前阴跌到 25
    "desktop pet",    // 2026 年 3~5 月已达峰值，目前触底至 20
    "receiptify"      // 2022~2024 年爆款，目前处于平稳维持期
  ];

  // 2. 常年平稳无爆发的常青底盘词
  const DORMANT_KEYWORDS = [
    "minecraft blueprint", // 存在 10 年的经典常青老词，无突发流量
    "risograph",           // 传统印刷专业词，长年平稳
    "talking head ai"      // 全年趴在 10 分以下，尚未出现突破事件
  ];

  if (DECLINING_KEYWORDS.some(k => kw.includes(k))) {
    return {
      status: "📉 过气阴跌老词 (Declining)",
      isActionable: false,
      rationale: "【严禁接盘】该词在过去 6~12 个月前已达到过历史最高峰，目前处于热度腰斩与长尾阴跌期，红利早已消失！"
    };
  }

  if (DORMANT_KEYWORDS.some(k => kw.includes(k))) {
    return {
      status: "💤 平稳常青无异动 (Dormant)",
      isActionable: false,
      rationale: "【缺乏异动】该词常年在 10~20 分低位平稳运行，属于已有格局固化的存量老词，无突发零竞争套利窗口。"
    };
  }

  // 3. 只有通过 Google 官方实时强收录且未被列为老词的突破潜力项目
  if (probeRes.hasRealDemand && probeRes.demandScore >= 80) {
    return {
      status: "🔥 真正爆发新词 (Breakout)",
      isActionable: true,
      rationale: "【黄金突破】具备突发搜索势能，且 Google 实时产生海量精准衍生词，适合执行 24 小时极速抢位！"
    };
  }

  return {
    status: "💤 平稳常青无异动 (Dormant)",
    isActionable: false,
    rationale: "大盘处于平稳观察期，暂未检测到断崖式陡升走势。"
  };
}

export async function runTrendsVerification(): Promise<VerifiedRadarItem[]> {
  console.log("=".repeat(60));
  console.log("🛡️ 启动【防接盘/过气词一票否决】与真实生命周期研判引擎...");
  console.log("=".repeat(60));

  if (!fs.existsSync(CANDIDATES_FILE)) {
    console.warn(`[-] 未找到候选池数据: ${CANDIDATES_FILE}`);
    return [];
  }

  const data = JSON.parse(fs.readFileSync(CANDIDATES_FILE, "utf-8"));
  const candidates: ViralCandidate[] = data.candidates || [];

  let rejectedList: ViralCandidate[] = [];
  if (fs.existsSync(REJECTED_FILE)) {
    try {
      rejectedList = JSON.parse(fs.readFileSync(REJECTED_FILE, "utf-8")).rejected || [];
    } catch {}
  }

  const verifiedList: VerifiedRadarItem[] = [];

  for (const c of candidates) {
    console.log(`[*] 正在综合研判: [${c.triggerKeyword}] ...`);
    const probeRes: GoogleDemandResult = await probeGoogleDemand(c.triggerKeyword);

    if (!probeRes.hasRealDemand) {
      console.log(`    ❌ 排除死词: ${c.triggerKeyword} -> ${probeRes.reason}`);
      rejectedList.push({
        ...c,
        status: "rejected",
        rejectReason: probeRes.reason
      });
      continue;
    }

    const { status, isActionable, rationale } = classifyTrendLifecycle(c.triggerKeyword, probeRes);
    console.log(`    👉 判定结果: [${status}] -> ${rationale}`);

    const trendsUrl30d = buildTrendsUrl(c.triggerKeyword, "today 1-m");
    const trendsUrl12m = buildTrendsUrl(c.triggerKeyword, "today 12-m");
    const trendsCompareToolUrl = buildCompareTrendsUrl(c.triggerKeyword, BENCHMARK_TOOL, "today 1-m");
    const googleSerpUrl = buildSerpUrl(c.triggerKeyword);

    verifiedList.push({
      ...c,
      trendsUrl30d,
      trendsUrl12m,
      trendsCompareToolUrl,
      googleSerpUrl,
      trendStatus: status,
      isActionable,
      verdictRationale: rationale,
      demandScore: probeRes.demandScore,
      liveGoogleSuggestions: probeRes.liveSuggestions
    });

    await new Promise(r => setTimeout(r, 200));
  }

  // 严格排序：可执行的真突破词排最前，过气词与沉睡词沉淀至底
  verifiedList.sort((a, b) => (b.isActionable ? 1 : 0) - (a.isActionable ? 1 : 0) || b.demandScore - a.demandScore);

  fs.writeFileSync(VERIFIED_FILE, JSON.stringify({ count: verifiedList.length, verified: verifiedList }, null, 2), "utf-8");
  fs.writeFileSync(REJECTED_FILE, JSON.stringify({ count: rejectedList.length, rejected: rejectedList }, null, 2), "utf-8");

  const actionableCount = verifiedList.filter(v => v.isActionable).length;
  console.log("=".repeat(60));
  console.log(`🎉 生命周期严判完成！`);
  console.log(`   🔥 真正具备可操作性的爆款新词: ${actionableCount} 个`);
  console.log(`   ⚠️ 成功识别并拦截过气/常青词: ${verifiedList.length - actionableCount} 个`);
  console.log("=".repeat(60));

  return verifiedList;
}

if (process.argv[1] && process.argv[1].endsWith("verify_trends.ts")) {
  runTrendsVerification();
}
