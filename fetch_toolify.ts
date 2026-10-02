import fs from "node:fs";
import path from "node:path";
import { probeGoogleDemand, GoogleDemandResult } from "./probe_google.js";

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const DATA_DIR = path.join(CURRENT_DIR, "data");
const OUTPUT_FILE = path.join(DATA_DIR, "raw_toolify_new.json");
const HISTORY_FILE = path.join(DATA_DIR, "toolify_history.json");

export interface ToolifyNewToolItem {
  id: string;
  slug: string;
  toolName: string;
  extractedKeyword: string;
  toolifyUrl: string;
  category: string;
  hasRealDemand: boolean;
  demandScore: number;
  isBlackHorse: boolean;            // 是否符合 JsonChao 黑马标准 (突然起量/新进前列)
  growthStage: string;              // "🔥 突变黑马 (新进激增)" | "📈 稳态高活" | "⚡ 初发新星"
  coreFeature: string;              // 1. 核心功能
  monetizationPoint: string;        // 2. 主要付费点
  topGeos: string[];                // 3. 来源国家与出海区域分布
  verticalOpportunity: string;      // 4. 垂直化套利机会 (Verticalization)
  localOpportunity: string;         // 5. 本地化套利机会 (Localization)
  liveSuggestions: string[];
  suggestedAction: string;
  emdDomainIdeas: string[];
  trendsUrl: string;
  serpUrl: string;
  firstSeenAt: string;
  fetchedAt: string;
}

interface ToolifyHistoryRecord {
  slug: string;
  firstSeenDate: string;
  lastSeenDate: string;
  historicalDemandScore: number;
  seenCount: number;
}

/**
 * 清洗工具名称，提炼供 Google 探针验真的核心搜索母词
 */
function cleanToolToKeyword(rawTitle: string, slug: string): string {
  let title = decodeURIComponent(rawTitle.replace(/\+/g, " ")).trim();
  
  title = title
    .replace(/-(?:\s*[a-zA-Z0-9_.-]+)+$/i, "")
    .replace(/\.(?:co|io|ai|com|tech|app|xyz)$/i, "")
    .replace(/[|•·].*$/, "")
    .trim();

  const words = title.split(/\s+/).filter(w => w.length > 0);
  if (words.length > 4) {
    title = words.slice(0, 4).join(" ");
  }

  title = title.replace(/[^a-zA-Z0-9\s-]/g, "").trim();
  return title.toLowerCase() || slug.replace(/-/g, " ");
}

/**
 * 根据关键词自动归因核心功能与赛道
 */
function inferCategoryAndFeature(kw: string, toolName: string): { category: string; coreFeature: string; monetization: string } {
  const text = `${kw} ${toolName}`.toLowerCase();

  if (/image|photo|picture|editor|avatar|logo|design|canvas|remove/i.test(text)) {
    return {
      category: "AI图像与视觉创意",
      coreFeature: "基于提示词的免配置图像生成、变体修复与画质超分",
      monetization: "高清无水印导出、批量批处理 Token、商用版权授权"
    };
  }
  if (/video|reel|shorts|clip|animation|dance|capcut|movie|motion/i.test(text)) {
    return {
      category: "短视频与动效生成",
      coreFeature: "一键生成卡点视频、数字人运镜与特效动作驱动",
      monetization: "算力排队 VIP 通道、4K 60FPS 渲染导出、商业片源模板"
    };
  }
  if (/audio|voice|speech|music|song|tts|sound|podcast/i.test(text)) {
    return {
      category: "AI音频与声音克隆",
      coreFeature: "超逼真声音克隆、文本转歌词编曲与短视频配音",
      monetization: "按配音分钟数计费、专属声线训练与多语种音色包"
    };
  }
  if (/code|dev|agent|workflow|automation|paperclip|scrap|api/i.test(text)) {
    return {
      category: "开发者与效率智能体",
      coreFeature: "工作流编排、特定场景自动化脚本与无代码微应用集成",
      monetization: "月付席位订阅 (Seat)、Webhook 高并发中转、私有化部署"
    };
  }
  if (/writing|copy|seo|blog|article|email|chat|summary/i.test(text)) {
    return {
      category: "出海营销与内容写作",
      coreFeature: "SEO 霸屏长文扩写、爆款社媒文案与多平台矩阵分发",
      monetization: "字数包充值、关键词排位监控看板、矩阵多账号授权"
    };
  }

  return {
    category: "垂直工具与生活效率",
    coreFeature: "特定场景轻量化解决痛点、即开即用的免登录工具",
    monetization: "免广告会员、无限次使用解锁、云端数据同步"
  };
}

/**
 * JsonChao 核心法则：推演垂直化 (Verticalization) 机会
 */
function deriveVerticalOpportunity(category: string, kw: string): string {
  if (category === "AI图像与视觉创意") {
    return `🎯 针对【亚马逊/Shopify 跨境电商】做白底图换假模特专用站，或针对【LinkedIn 职场求职】做职业商务西装照专用版；`;
  }
  if (category === "短视频与动效生成") {
    return `🎯 针对【房地产经纪人房源巡礼】或【知识付费口播短剧】做垂直场景卡点模板工具，避开通用大模型混战；`;
  }
  if (category === "AI音频与声音克隆") {
    return `🎯 针对【有声书主播/儿童睡前故事】做特定情绪音色包，或针对【游戏解说/外服陪玩】做变声器小工具；`;
  }
  if (category === "开发者与效率智能体") {
    return `🎯 针对【出海独立开发者 (Indie Hackers)】做一键对接 Stripe 与 SEO 元数据的轻量微套件；`;
  }
  return `🎯 锁定单一高客单价高频痛点垂直人群，将综合大工具拆解为极简一键单功能页面。`;
}

/**
 * JsonChao 核心法则：推演来源国家与本地化 (Localization) 机会
 */
function deriveLocalizationOpportunity(kw: string): { topGeos: string[]; localOpportunity: string } {
  // 根据语义与出海痛点推测热点国家
  const isVisualOrGaming = /video|dance|filter|image|photo|voice/i.test(kw);
  
  if (isVisualOrGaming) {
    return {
      topGeos: ["🇯🇵 日本 (JP)", "🇺🇸 美国 (US)", "🇧🇷 巴西 (BR)", "🇮🇩 印尼 (ID)"],
      localOpportunity: `🌍 该赛道在日韩与拉美搜索需求极度旺盛。建议立即搭建日文专属单页 (如 {slug}-jp.com) 或西语单页，避开欧美英文红海！`
    };
  }

  return {
    topGeos: ["🇺🇸 美国 (US)", "🇬🇧 英国 (UK)", "🇩🇪 德国 (DE)", "🇮🇳 印度 (IN)"],
    localOpportunity: `🌍 欧美主站为主要购买力。德国/欧洲对数据合规与免登录敏感，可做欧洲 GDPR 友好型镜像站抢占 Google 欧区搜索。`
  };
}

/**
 * 提炼 EMD (Exact Match Domain) 域名建议 (包含通用与本地化双重建议)
 */
function generateEmdIdeas(kw: string): string[] {
  const clean = kw.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
  if (!clean) return [];
  return [
    `${clean}.com`,
    `${clean}app.com`,
    `get${clean}.com`,
    `${clean}-jp.com` // 增加本地化域名选项
  ];
}

/**
 * 获取 Toolify 最新的 Sitemap 链接
 */
async function getLatestToolSitemapUrl(): Promise<string> {
  const rootSitemapUrl = "https://www.toolify.ai/sitemap.xml";
  try {
    const res = await fetch(rootSitemapUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 TrendSpy/3.0"
      }
    });

    if (!res.ok) return "https://www.toolify.ai/sitemap_tools_15.xml";

    const xml = await res.text();
    const toolSitemaps = [...xml.matchAll(/<loc>(https:\/\/www\.toolify\.ai\/sitemap_tools_\d+\.xml)<\/loc>/g)].map(m => m[1]);
    if (toolSitemaps.length > 0) return toolSitemaps[toolSitemaps.length - 1];
  } catch {}
  return "https://www.toolify.ai/sitemap_tools_15.xml";
}

/**
 * 执行强化版 Toolify 黑马与四维归因分析流水线
 */
export async function fetchToolifyNewTools(maxProbeCount = 30): Promise<ToolifyNewToolItem[]> {
  console.log("=".repeat(60));
  console.log("🛠️ 启动 Toolify 黑马雷达与四维归因引擎 (JsonChao 方法论)");
  console.log("=".repeat(60));

  // 读取或初始化时序历史库
  let historyMap = new Map<string, ToolifyHistoryRecord>();
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      const histData: Record<string, ToolifyHistoryRecord> = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
      historyMap = new Map(Object.entries(histData));
    } catch {}
  }

  const targetSitemap = await getLatestToolSitemapUrl();
  console.log(`📡 正在解析最新产品分片: ${targetSitemap}`);

  let xmlText = "";
  try {
    const res = await fetch(targetSitemap, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 TrendSpy/3.0"
      }
    });
    if (!res.ok) return [];
    xmlText = await res.text();
  } catch (err: any) {
    console.error(`[-] 抓取分片异常:`, err.message);
    return [];
  }

  const urlBlocks = xmlText.match(/<url>([\s\S]*?)<\/url>/g) || [];
  const toolMap = new Map<string, string>();

  for (const block of urlBlocks) {
    const locMatch = /<loc>https:\/\/www\.toolify\.ai\/(?:[a-z]{2}\/)?tool\/([^<]+)<\/loc>/.exec(block);
    const titleMatch = /<image:title>([^<]+)<\/image:title>/.exec(block);

    if (locMatch) {
      const slug = locMatch[1];
      const title = titleMatch ? titleMatch[1] : slug.replace(/-/g, " ");
      if (!toolMap.has(slug)) {
        toolMap.set(slug, title);
      }
    }
  }

  const allTools = [...toolMap.entries()];
  console.log(`✅ 成功从 Toolify 捕获 ${allTools.length} 个最新产品，准备进行 Google 需求验真与归因分析...`);

  const candidatesToProbe = allTools.slice(-maxProbeCount).reverse();
  const results: ToolifyNewToolItem[] = [];
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.split("T")[0];

  for (const [slug, rawTitle] of candidatesToProbe) {
    const cleanKw = cleanToolToKeyword(rawTitle, slug);
    const cleanTitle = decodeURIComponent(rawTitle.replace(/\+/g, " "));

    // 1. Google 需求验真
    let probe: GoogleDemandResult;
    try {
      probe = await probeGoogleDemand(cleanKw);
    } catch {
      probe = {
        keyword: cleanKw,
        hasRealDemand: false,
        demandScore: 10,
        liveSuggestions: [],
        reason: "探测超时"
      };
    }

    // 2. 结合历史数据库做时序判定 (是否为突变黑马)
    const prevRecord = historyMap.get(slug);
    const isNewEntrant = !prevRecord;
    const isHighDemand = probe.hasRealDemand && probe.demandScore >= 60;
    
    // 黑马定义：新进入前列 且 具备强真实搜索需求
    const isBlackHorse = isHighDemand && (isNewEntrant || probe.demandScore > (prevRecord?.historicalDemandScore || 0) + 20);

    let growthStage = "⚡ 初发新星";
    if (isBlackHorse) {
      growthStage = "🔥 突变黑马 (新进激增)";
    } else if (isHighDemand) {
      growthStage = "📈 稳态高活";
    }

    // 更新时序历史记录
    historyMap.set(slug, {
      slug,
      firstSeenDate: prevRecord?.firstSeenDate || todayStr,
      lastSeenDate: todayStr,
      historicalDemandScore: probe.demandScore,
      seenCount: (prevRecord?.seenCount || 0) + 1
    });

    // 3. 四维归因推演 (JsonChao 方法)
    const { category, coreFeature, monetization } = inferCategoryAndFeature(cleanKw, cleanTitle);
    const { topGeos, localOpportunity } = deriveLocalizationOpportunity(cleanKw);
    const verticalOpportunity = deriveVerticalOpportunity(category, cleanKw);

    const emdIdeas = generateEmdIdeas(cleanKw);
    let suggestedAction = "关注供给侧动态";
    if (isBlackHorse) {
      suggestedAction = "🚀 确认高爆黑马！建议立即复制其核心功能，快速上线日文/西语本地化单页或特定行业版！";
    } else if (probe.hasRealDemand) {
      suggestedAction = "具备真实自然搜索流量，可搭建轻量级 API 套壳或功能聚焦单页";
    }

    results.push({
      id: `tf-${slug}`,
      slug,
      toolName: cleanTitle,
      extractedKeyword: cleanKw,
      toolifyUrl: `https://www.toolify.ai/tool/${slug}`,
      category,
      hasRealDemand: probe.hasRealDemand,
      demandScore: probe.demandScore,
      isBlackHorse,
      growthStage,
      coreFeature,
      monetizationPoint: monetization,
      topGeos,
      verticalOpportunity,
      localOpportunity,
      liveSuggestions: probe.liveSuggestions || [],
      suggestedAction,
      emdDomainIdeas: emdIdeas,
      trendsUrl: `https://trends.google.com/trends/explore?date=today%201-m&q=${encodeURIComponent(cleanKw)}`,
      serpUrl: `https://www.google.com/search?q=${encodeURIComponent(cleanKw)}`,
      firstSeenAt: prevRecord?.firstSeenDate || todayStr,
      fetchedAt: nowIso
    });

    await new Promise(r => setTimeout(r, 60));
  }

  // 排序权重：黑马置顶 > 需求得分最高
  results.sort((a, b) => {
    if (a.isBlackHorse && !b.isBlackHorse) return -1;
    if (!a.isBlackHorse && b.isBlackHorse) return 1;
    return b.demandScore - a.demandScore;
  });

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // 持久化输出与时序快照
  const histObj = Object.fromEntries(historyMap.entries());
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(histObj, null, 2), "utf-8");

  const payload = {
    fetched_at: nowIso,
    total: results.length,
    black_horses_count: results.filter(r => r.isBlackHorse).length,
    sitemap_source: targetSitemap,
    items: results
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`💾 Toolify 黑马与四维归因研报已保存至: ${OUTPUT_FILE}`);
  console.log(`🎯 命中「突变黑马」工具: ${payload.black_horses_count} 个`);
  console.log(`📊 命中真实搜索需求工具: ${results.filter(r => r.hasRealDemand).length} 个`);
  console.log("=".repeat(60));

  return results;
}

if (process.argv[1] && process.argv[1].endsWith("fetch_toolify.ts")) {
  fetchToolifyNewTools();
}
