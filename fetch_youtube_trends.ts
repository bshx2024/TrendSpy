import fs from "node:fs";
import path from "node:path";

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const DATA_DIR = path.join(CURRENT_DIR, "data");
const OUTPUT_FILE = path.join(DATA_DIR, "raw_youtube_trends.json");

export interface YouTubeTrendItem {
  id: string;
  title: string;
  sourceType: "shorts" | "trending_video" | "shorts_keyword";
  url: string;
  channelOrAuthor: string;
  pubDate: string;
  extractedKeyword: string;
  demandScore: number;
  emdDomainIdeas: string[];
  suggestedAction: string;
  fetchedAt: string;
}

// 核心探测种子池 (涵盖 Shorts 与 YouTube 爆款 AI 视觉、玩法及工具)
export const YOUTUBE_SEEDS = [
  "ai shorts",
  "ai tool",
  "ai video generator",
  "talking head ai",
  "capcut template",
  "ai animation",
  "nano banana",
  "flux ai",
  "sora ai",
  "cursor rules",
  "ai image generator",
  "ai voice clone"
];

/**
 * 提炼 EMD (Exact Match Domain) 域名建议
 */
function generateEmdIdeas(kw: string): string[] {
  const clean = kw.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!clean || clean.length < 3) return [];
  const base = clean.slice(0, 16);
  return [
    `${base}.com`,
    `${base}app.com`,
    `get${base}.com`,
    `${base}tool.com`,
    `${base}-jp.com`
  ];
}

/**
 * 通道 1: YouTube 官方客户端 Suggest 探针 (嗅探当前网民在 YouTube 搜索 Shorts 的真实热词)
 */
async function fetchYouTubeSuggests(seed: string): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(seed)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 TrendSpy/2.0"
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return [];
    const text = await res.text();
    const match = text.match(/\((.*)\)$/);
    if (!match) return [];
    const json = JSON.parse(match[1]);
    const items: any[] = json?.[1] || [];
    return items.map((it: any) => String(it?.[0] || "").trim()).filter(Boolean);
  } catch (err: any) {
    return [];
  }
}

/**
 * 通道 2: YouTube Shorts 爆款视频实时聚合流 (通过 Google News 结构化 RSS 镜像)
 */
async function fetchYouTubeVideoFeed(query: string, limit = 20): Promise<Array<{ title: string; url: string; pubDate: string; source: string }>> {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 TrendSpy/2.0"
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items: Array<{ title: string; url: string; pubDate: string; source: string }> = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
      const block = match[1];
      const titleMatch = /<title>(.*?)<\/title>/.exec(block);
      const linkMatch = /<link>(.*?)<\/link>/.exec(block);
      const pubDateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(block);
      const sourceMatch = /<source[^>]*>(.*?)<\/source>/.exec(block);

      if (titleMatch && linkMatch) {
        const rawTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();
        // 过滤掉 Google News 站名后缀 " - YouTube"
        const cleanTitle = rawTitle.replace(/\s*-\s*YouTube$/i, "").trim();
        const rawLink = linkMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();
        const pubDate = pubDateMatch ? pubDateMatch[1].trim() : "";
        const sourceName = sourceMatch ? sourceMatch[1].trim() : "YouTube";

        if (cleanTitle && cleanTitle.length > 5 && !cleanTitle.toLowerCase().includes("google news")) {
          items.push({
            title: cleanTitle,
            url: rawLink,
            pubDate,
            source: sourceName
          });
        }
      }
    }

    return items;
  } catch (err: any) {
    return [];
  }
}

/**
 * 通道 3: YouTube Data API v3 官方接口 (若配置环境变量 YOUTUBE_API_KEY 则自动激活)
 */
async function fetchOfficialYouTubeApi(apiKey: string): Promise<Array<{ title: string; url: string; channel: string; views: string; pubDate: string }>> {
  // videoCategoryId 28 = Science & Technology
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&videoCategoryId=28&maxResults=25&key=${apiKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.items || [];
    return items.map((it: any) => ({
      title: it.snippet?.title || "",
      url: `https://www.youtube.com/watch?v=${it.id}`,
      channel: it.snippet?.channelTitle || "YouTube Channel",
      views: it.statistics?.viewCount || "0",
      pubDate: it.snippet?.publishedAt || ""
    }));
  } catch {
    return [];
  }
}

/**
 * 主执行函数：整合多通道数据并输出标准趋势条目
 */
export async function runYouTubeIngestion(): Promise<YouTubeTrendItem[]> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  console.log("=".repeat(60));
  console.log("🎥 正在启动 YouTube Shorts & Trending 热点雷达采集...");
  console.log("=".repeat(60));

  const results: YouTubeTrendItem[] = [];
  const seenTitles = new Set<string>();

  // 1. 嗅探 YouTube 官方 Suggest 探针
  console.log("[1/3] 正在嗅探 YouTube Shorts & AI 爆款词下拉即时意图...");
  for (const seed of YOUTUBE_SEEDS) {
    const suggests = await fetchYouTubeSuggests(seed);
    for (const kw of suggests) {
      if (seenTitles.has(kw.toLowerCase())) continue;
      seenTitles.add(kw.toLowerCase());

      results.push({
        id: `yt-sug-${Buffer.from(kw).toString("hex").slice(0, 10)}`,
        title: `YouTube 飙升搜索意图: "${kw}"`,
        sourceType: "shorts_keyword",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(kw)}`,
        channelOrAuthor: "YouTube Search Trends",
        pubDate: new Date().toISOString(),
        extractedKeyword: kw,
        demandScore: 85,
        emdDomainIdeas: generateEmdIdeas(kw),
        suggestedAction: "针对 YouTube Shorts 痛点制作轻量在线工具单页或 Prompts 提取器",
        fetchedAt: new Date().toISOString()
      });
    }
  }
  console.log(`    -> 捕获到 ${results.length} 个高频 Shorts/视频搜索词群`);

  // 2. 抓取 YouTube Shorts 爆款视频流
  console.log("[2/3] 正在拉取 YouTube Shorts 爆款与 Viral AI 视频流...");
  const videoQueries = [
    'site:youtube.com/shorts ("ai" OR "tool" OR "filter" OR "meme")',
    'site:youtube.com ("ai tool" OR "new ai" OR "nano banana" OR "cursor")'
  ];

  for (const q of videoQueries) {
    const videos = await fetchYouTubeVideoFeed(q, 15);
    for (const v of videos) {
      if (seenTitles.has(v.title.toLowerCase())) continue;
      seenTitles.add(v.title.toLowerCase());

      // 提取核心关键词（去除常见 hashtag 与停用词）
      const cleanKw = v.title
        .replace(/#\w+/g, "")
        .replace(/\[.*?\]/g, "")
        .replace(/\(.*?\)/g, "")
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 2 && !["this", "with", "from", "video", "shorts", "made"].includes(w.toLowerCase()))
        .slice(0, 3)
        .join(" ")
        .toLowerCase() || "ai viral video";

      const isShorts = v.url.includes("/shorts") || v.title.toLowerCase().includes("#shorts");

      results.push({
        id: `yt-vid-${Buffer.from(v.title).toString("hex").slice(0, 10)}`,
        title: v.title,
        sourceType: isShorts ? "shorts" : "trending_video",
        url: v.url,
        channelOrAuthor: v.source || "YouTube",
        pubDate: v.pubDate,
        extractedKeyword: cleanKw,
        demandScore: isShorts ? 90 : 75,
        emdDomainIdeas: generateEmdIdeas(cleanKw),
        suggestedAction: isShorts ? "解构 Shorts 视觉特效并封装为一键 Web 生成器" : "制作该新工具免翻免登录镜像或 API 聚合站",
        fetchedAt: new Date().toISOString()
      });
    }
  }

  // 3. 若有官方 API Key，融合官方数据
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    console.log("[3/3] 检测到 YOUTUBE_API_KEY，正在拉取官方 MostPopular Science/Tech 视频...");
    const officialVideos = await fetchOfficialYouTubeApi(apiKey);
    for (const ov of officialVideos) {
      if (seenTitles.has(ov.title.toLowerCase())) continue;
      seenTitles.add(ov.title.toLowerCase());

      results.push({
        id: `yt-api-${Buffer.from(ov.title).toString("hex").slice(0, 10)}`,
        title: ov.title,
        sourceType: "trending_video",
        url: ov.url,
        channelOrAuthor: ov.channel,
        pubDate: ov.pubDate,
        extractedKeyword: ov.title.slice(0, 25).trim(),
        demandScore: 95,
        emdDomainIdeas: generateEmdIdeas(ov.title.slice(0, 20)),
        suggestedAction: "紧跟头部博主推荐节奏抢注下游衍生域名",
        fetchedAt: new Date().toISOString()
      });
    }
  } else {
    console.log("[3/3] 无须配置 API Key，已通过无损零凭据探针完成全量捕获！");
  }

  // 排序：高需求分排在前
  results.sort((a, b) => b.demandScore - a.demandScore);

  const payload = {
    fetched_at: new Date().toISOString(),
    total: results.length,
    shorts_count: results.filter(r => r.sourceType === "shorts").length,
    keywords_count: results.filter(r => r.sourceType === "shorts_keyword").length,
    videos_count: results.filter(r => r.sourceType === "trending_video").length,
    items: results
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), "utf-8");

  console.log("=".repeat(60));
  console.log(`🎉 YouTube 趋势捕获完成！共收录 ${results.length} 条高价值趋势数据`);
  console.log(`📁 数据已存盘: ${OUTPUT_FILE}`);
  console.log("=".repeat(60));

  return results;
}

if (process.argv[1] && process.argv[1].endsWith("fetch_youtube_trends.ts")) {
  runYouTubeIngestion();
}
