/**
 * SERP 竞争格局与可行性评估引擎 (SERP Difficulty & Small Site Opportunity Evaluator)
 * 模拟爬取/分析目标关键词的 Google 搜索前两页
 * 判断：是否有小站已排上前两页？大厂霸榜程度？是否值得出海立项？
 */
import fs from "node:fs";
import path from "node:path";

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const DATA_DIR = path.join(CURRENT_DIR, "data");
const OUTPUT_FILE = path.join(DATA_DIR, "serp_feasibility_results.json");

export interface SerpAnalysisResult {
  keyword: string;
  evaluatedAt: string;
  difficultyScore: number; // 0 (极易) ~ 100 (极难)
  opportunityLevel: "极高机会 (已有小站吃肉)" | "良好机会 (大站内页薄弱)" | "竞争激烈 (官方/维基霸榜)" | "待定";
  hasSmallSiteRanking: boolean; // 是否有 vercel.app, github.io, 个人独立新域名排在前列
  dominantDomains: string[];
  summaryNote: string;
  recommendedAction: string;
}

const BIG_TECH_DOMAINS = [
  "wikipedia.org", "github.com", "microsoft.com", "google.com", 
  "apple.com", "huggingface.co", "reddit.com", "youtube.com", 
  "openai.com", "anthropic.com", "amazon.com", "baidu.com"
];

const INDIE_PLATFORMS = [
  "vercel.app", "pages.dev", "github.io", "netlify.app", 
  "streamlit.app", "replit.app", "glitch.me", "firebaseapp.com"
];

/**
 * 评估关键词的 SERP 竞争格局
 */
export async function evaluateSerpDifficulty(keyword: string): Promise<SerpAnalysisResult> {
  const cleanKw = keyword.trim().toLowerCase();
  
  try {
    // 通过 Google 搜索页面的轻量探针 (带常见 US 浏览器特征)
    const url = `https://www.google.com/search?q=${encodeURIComponent(cleanKw)}&gl=us&hl=en&num=20`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    const html = await res.text();

    // 简单提取 SERP 中的域名
    const linkMatches = html.matchAll(/href="(https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^"]*)"/g);
    const discoveredDomains: string[] = [];

    for (const m of linkMatches) {
      try {
        const parsed = new URL(m[1]);
        const hostname = parsed.hostname.toLowerCase();
        if (!hostname.includes("google.") && !hostname.includes("gstatic.") && !discoveredDomains.includes(hostname)) {
          discoveredDomains.push(hostname);
        }
      } catch {}
    }

    const topDomains = discoveredDomains.slice(0, 15);
    
    // 检查是否有小站 / 托管平台在排
    const smallSite = topDomains.find(d => INDIE_PLATFORMS.some(platform => d.endsWith(platform)));
    const bigTechCount = topDomains.filter(d => BIG_TECH_DOMAINS.some(b => d.includes(b))).length;

    let difficultyScore = 50;
    let opportunityLevel: SerpAnalysisResult["opportunityLevel"] = "良好机会 (大站内页薄弱)";
    let summaryNote = "SERP 处于开放竞争状态";
    let recommendedAction = "快速制作单页或提示词库，做精准意图页面截流";

    if (smallSite) {
      difficultyScore = 25;
      opportunityLevel = "极高机会 (已有小站吃肉)";
      summaryNote = `检测到独立托管站点 (${smallSite}) 已排进前排，SEO 门槛低，极易套利`;
      recommendedAction = "立即克隆类似功能或聚合站，抢占长尾词第一第二位";
    } else if (bigTechCount >= 6) {
      difficultyScore = 85;
      opportunityLevel = "竞争激烈 (官方/维基霸榜)";
      summaryNote = "大厂官方或维基、GitHub、Reddit 占领绝大多数坑位，自然排名难度较高";
      recommendedAction = "避开主词正面竞争，改为加后缀 (如 uncensored, comfyui, byok) 做差异化长尾";
    }

    return {
      keyword: cleanKw,
      evaluatedAt: new Date().toISOString(),
      difficultyScore,
      opportunityLevel,
      hasSmallSiteRanking: Boolean(smallSite),
      dominantDomains: topDomains.slice(0, 6),
      summaryNote,
      recommendedAction
    };
  } catch (err: any) {
    return {
      keyword: cleanKw,
      evaluatedAt: new Date().toISOString(),
      difficultyScore: 50,
      opportunityLevel: "待定",
      hasSmallSiteRanking: false,
      dominantDomains: [],
      summaryNote: `评估遇到网络限制: ${err.message}`,
      recommendedAction: "可先行通过 Google Trends 爆发度决定是否测试上线"
    };
  }
}

/**
 * 批量评估候选关键词
 */
export async function batchEvaluateKeywords(keywords: string[]): Promise<SerpAnalysisResult[]> {
  console.log("=".repeat(60));
  console.log(`🔍 启动【SERP 竞争可行性评估】... 共 ${keywords.length} 个候选词`);

  const results: SerpAnalysisResult[] = [];
  for (const kw of keywords) {
    const res = await evaluateSerpDifficulty(kw);
    results.push(res);
    // 保护性间隔
    await new Promise(r => setTimeout(r, 600));
  }

  try {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf-8");
  } catch {}

  console.log(`✔ [SERP 评估引擎] 完成！共评估 ${results.length} 个词条，发现 ${results.filter(r => r.hasSmallSiteRanking).length} 个小站吃肉机会`);
  return results;
}

if (process.argv[1] && process.argv[1].endsWith("serp_evaluator.ts")) {
  batchEvaluateKeywords(["strata qwen", "qwen image 2.1 comfyui", "qwen-image-2.1 uncensored"]).catch(console.error);
}
