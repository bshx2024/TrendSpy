import fs from "node:fs";
import path from "node:path";
import { GoogleTrendsClient } from "./google_trends_client.js";

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const DATA_DIR = path.join(CURRENT_DIR, "data");
const OUTPUT_FILE = path.join(DATA_DIR, "raw_tiktok_trends.json");

export interface TikTokTrendItem {
  id: string;
  keyword: string;
  category: "AI特效与滤镜" | "CapCut与视频模板" | "AI音频与变声" | "短视频热梗与玩法";
  seedSource: string;
  demandScore: number;
  growthTag: string;
  liveSuggestions: string[];
  suggestedAction: string;
  emdDomainIdeas: string[];
  trendsUrl: string;
  serpUrl: string;
  fetchedAt: string;
}

// 核心探测种子池 (涵盖 TikTok/CapCut 视觉与视频新玩法)
const TIKTOK_SEEDS = [
  { seed: "tiktok filter", category: "AI特效与滤镜", action: "纯前端 WebGL 滤镜模拟 / 免登录在线体验单页" },
  { seed: "tiktok ai", category: "AI特效与滤镜", action: "AI 视频生成逆向提示词 / 轻量模型 API 套壳" },
  { seed: "capcut template", category: "CapCut与视频模板", action: "爆款卡点模板跳转库 / 剪辑脚本生成器" },
  { seed: "tiktok video effect", category: "AI特效与滤镜", action: "HTML5 Canvas 动效模拟器 / 特效参数预设库" },
  { seed: "tiktok trend", category: "短视频热梗与玩法", action: "热梗背景故事说明单页 / Meme 生成器" },
  { seed: "tiktok ai voice", category: "AI音频与变声", action: "Web Speech / TTS 网红声线在线试听与配音工具" },
  { seed: "ai filter online", category: "AI特效与滤镜", action: "免安装浏览器原生 AI 换脸/变身体验工具" },
  { seed: "tiktok dance", category: "短视频热梗与玩法", action: "骨骼驱动跳舞生成器 / 绿幕素材下载库" }
] as const;

/**
 * 通过 Google Suggest 探针嗅探 TikTok 相关的真实网民即时搜索意图
 */
async function probeSuggestions(query: string): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 TrendSpy/3.0"
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.[1] || []).map((s: string) => s.trim().toLowerCase());
  } catch {
    return [];
  }
}

/**
 * 提炼 EMD (Exact Match Domain) 域名建议
 */
function generateEmdIdeas(kw: string): string[] {
  const clean = kw.replace(/[^a-zA-Z0-9]/g, "").slice(0, 18);
  if (!clean) return [];
  return [
    `${clean}.com`,
    `${clean}app.com`,
    `get${clean}.com`,
    `${clean}online.io`
  ];
}

/**
 * 商业价值与独立工具意图评分
 */
function scoreCommercialIntent(kw: string): number {
  let score = 50;
  const highIntentTokens = ["free", "online", "without tiktok", "remover", "generator", "maker", "download", "template", "app", "tool"];
  for (const token of highIntentTokens) {
    if (kw.includes(token)) score += 10;
  }
  return Math.min(98, score);
}

export async function fetchTikTokTrends(): Promise<TikTokTrendItem[]> {
  console.log("=".repeat(60));
  console.log("🎵 正在执行 TikTok 视频/特效/模板雷达探测 (多源探针嗅探)...");
  console.log("=".repeat(60));

  const items: TikTokTrendItem[] = [];
  const seenKeywords = new Set<string>();

  // 1. Google Chrome 实时联想嗅探
  for (const item of TIKTOK_SEEDS) {
    console.log(`[*] 嗅探种子: "${item.seed}" ...`);
    const suggestions = await probeSuggestions(item.seed);

    for (const sugg of suggestions) {
      if (sugg === item.seed || seenKeywords.has(sugg)) continue;
      seenKeywords.add(sugg);

      const score = scoreCommercialIntent(sugg);
      const emdDomainIdeas = generateEmdIdeas(sugg);

      items.push({
        id: `tt-${Math.random().toString(36).slice(2, 9)}`,
        keyword: sugg,
        category: item.category,
        seedSource: item.seed,
        demandScore: score,
        growthTag: score >= 80 ? "高商业意图" : "持续上升",
        liveSuggestions: suggestions.filter(s => s !== sugg).slice(0, 4),
        suggestedAction: item.action,
        emdDomainIdeas,
        trendsUrl: `https://trends.google.com/trends/explore?date=today%201-m&q=${encodeURIComponent(sugg)}`,
        serpUrl: `https://www.google.com/search?q=${encodeURIComponent(sugg)}`,
        fetchedAt: new Date().toISOString()
      });
    }

    // 适度防抖
    await new Promise(r => setTimeout(r, 120));
  }

  // 2. 尝试从 Google Trends 获取相关上升词
  try {
    const client = new GoogleTrendsClient();
    const risingSeeds = ["tiktok filter", "capcut template"];
    for (const seed of risingSeeds) {
      const related = await client.fetchRelatedQueries(seed, "today 1-m", "US");
      if (related && related.rising.length > 0) {
        for (const r of related.rising.slice(0, 5)) {
          const kw = r.query.toLowerCase().trim();
          if (seenKeywords.has(kw)) continue;
          seenKeywords.add(kw);

          const emdDomainIdeas = generateEmdIdeas(kw);
          items.push({
            id: `tt-rising-${Math.random().toString(36).slice(2, 9)}`,
            keyword: kw,
            category: seed.includes("capcut") ? "CapCut与视频模板" : "AI特效与滤镜",
            seedSource: seed,
            demandScore: r.isBreakout ? 95 : 85,
            growthTag: r.formattedValue || "飙升",
            liveSuggestions: [],
            suggestedAction: "抢注精准匹配域名，上线极简单页工具",
            emdDomainIdeas,
            trendsUrl: `https://trends.google.com/trends/explore?date=today%201-m&q=${encodeURIComponent(kw)}`,
            serpUrl: `https://www.google.com/search?q=${encodeURIComponent(kw)}`,
            fetchedAt: new Date().toISOString()
          });
        }
      }
    }
  } catch (err: any) {
    console.warn(`[-] Google Trends 飙升词补充接口暂不可达，使用探针数据: ${err.message}`);
  }

  // 排序：需求得分最高者优先
  items.sort((a, b) => b.demandScore - a.demandScore);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const payload = {
    fetched_at: new Date().toISOString(),
    total: items.length,
    items
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`✅ TikTok 视频新词雷达捕获完成！共收录 ${items.length} 个高潜力新词与模板`);
  console.log(`💾 数据已持久化至: ${OUTPUT_FILE}`);
  console.log("=".repeat(60));

  return items;
}

if (process.argv[1] && process.argv[1].endsWith("fetch_tiktok_trends.ts")) {
  fetchTikTokTrends();
}
