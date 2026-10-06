import fs from "node:fs";
import path from "node:path";

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const DATA_DIR = path.join(CURRENT_DIR, "data");
const OUTPUT_FILE = path.join(DATA_DIR, "raw_twitter_kol.json");

export interface TwitterKolItem {
  id: string;
  handle: string;
  authorName: string;
  authorBio: string;
  followersCount: number;
  tweetTitle: string;
  tweetUrl: string;
  pubDate: string;
  extractedKeywords: string[];
  emdDomainIdeas: string[];
  impactScore: number;
  suggestedAction: string;
  captureChannel: "fxtwitter_metadata" | "realtime_x_mention" | "nitter_mirror";
  fetchedAt: string;
}

// 核心关注的全球头部 AI KOL 与独立开发领军人物
export const TARGET_KOLS = [
  { handle: "sama", name: "Sam Altman", org: "OpenAI", weight: 100 },
  { handle: "karpathy", name: "Andrej Karpathy", org: "Eureka Labs / ex-OpenAI", weight: 98 },
  { handle: "ylecun", name: "Yann LeCun", org: "Meta AI / AMI Labs", weight: 95 },
  { handle: "DrJimFan", name: "Jim Fan", org: "NVIDIA GEAR", weight: 95 },
  { handle: "gdb", name: "Greg Brockman", org: "OpenAI", weight: 92 },
  { handle: "rowancheung", name: "Rowan Cheung", org: "The Rundown AI", weight: 90 },
  { handle: "levelsio", name: "Pieter Levels", org: "Indie Hacker 标杆", weight: 92 },
  { handle: "swyx", name: "Shawn Wang", org: "Latent Space / AI Engineer", weight: 88 },
  { handle: "emostaque", name: "Emad Mostaque", org: "Schelling AI / ex-Stability", weight: 88 },
  { handle: "bindureddy", name: "Bindu Reddy", org: "Abacus.AI", weight: 86 }
];

// Nitter 与第三方开源镜像容灾池
const NITTER_MIRRORS = [
  "https://nitter.privacydev.net",
  "https://xcancel.com",
  "https://nitter.poast.org",
  "https://nitter.lucabased.xyz"
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
    `${base}ai.com`
  ];
}

/**
 * 从文本中智能提取高频技术新词与项目名
 */
function extractTechKeywords(text: string): string[] {
  const words: string[] = [];
  // 匹配特定版本号、大写命名或专有名词，如 Qwen, Flux, Claude 3.5, Nano, etc.
  const regex = /\b([A-Z][a-zA-Z0-9_\-\.]{2,18})\b/g;
  let m;
  const stopWords = new Set(["The", "And", "For", "With", "This", "That", "From", "About", "Just", "Have", "Will", "News", "Post", "Today", "Year"]);
  while ((m = regex.exec(text)) !== null) {
    const w = m[1];
    if (!stopWords.has(w) && !words.includes(w)) {
      words.push(w);
    }
  }
  return words.slice(0, 4);
}

/**
 * 通道 1: FxTwitter 开放元数据接口 (实时获取 KOL 档案、推文数变动与简介更新)
 */
async function fetchFxTwitterUser(handle: string): Promise<any | null> {
  const url = `https://api.fxtwitter.com/${handle}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 TrendSpy/2.0"
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.user || null;
  } catch {
    return null;
  }
}

/**
 * 通道 2: Google 实时全网 X/Twitter 提及与爆款推文流 (零成本绕过 X API 封锁)
 */
async function fetchKolGoogleMentions(name: string, handle: string, limit = 5): Promise<Array<{ title: string; url: string; pubDate: string }>> {
  const query = `("${name}" OR "@${handle}") (site:x.com OR site:twitter.com OR "Twitter" OR "AI")`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 TrendSpy/2.0"
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items: Array<{ title: string; url: string; pubDate: string }> = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
      const block = match[1];
      const titleMatch = /<title>(.*?)<\/title>/.exec(block);
      const linkMatch = /<link>(.*?)<\/link>/.exec(block);
      const pubDateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(block);

      if (titleMatch && linkMatch) {
        const rawTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();
        const rawLink = linkMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();
        const pubDate = pubDateMatch ? pubDateMatch[1].trim() : "";

        if (rawTitle && !rawTitle.toLowerCase().includes("google news")) {
          items.push({
            title: rawTitle,
            url: rawLink,
            pubDate
          });
        }
      }
    }
    return items;
  } catch {
    return [];
  }
}

/**
 * 通道 3: Nitter / 第三方镜像轮询 (在镜像存活期间直接抓取原始推文 RSS)
 */
async function fetchNitterRss(handle: string): Promise<Array<{ title: string; url: string; pubDate: string }>> {
  for (const mirror of NITTER_MIRRORS) {
    try {
      const url = `${mirror}/${handle}/rss`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 TrendSpy/2.0" },
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const xml = await res.text();
        const items: Array<{ title: string; url: string; pubDate: string }> = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
          const block = match[1];
          const title = /<title>(.*?)<\/title>/.exec(block)?.[1] || "";
          const link = /<link>(.*?)<\/link>/.exec(block)?.[1] || "";
          const pubDate = /<pubDate>(.*?)<\/pubDate>/.exec(block)?.[1] || "";
          if (title && link) {
            items.push({
              title: title.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim(),
              url: link.replace(mirror, "https://x.com"),
              pubDate
            });
          }
        }
        if (items.length > 0) return items;
      }
    } catch {
      // 容灾继续尝试下一个镜像
    }
  }
  return [];
}

/**
 * 主执行函数：巡检所有头部 AI KOL，形成推特情报雷达
 */
export async function runTwitterKolIngestion(): Promise<TwitterKolItem[]> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  console.log("=".repeat(60));
  console.log("🐦 正在启动 Twitter/X 关键 AI KOL 追踪雷达 (多源轻量无损抓取)...");
  console.log("=".repeat(60));

  const allItems: TwitterKolItem[] = [];

  for (const kol of TARGET_KOLS) {
    console.log(`[*] 正在追踪 @${kol.handle} (${kol.name} · ${kol.org})...`);

    // 1. 获取 FxTwitter 用户元数据
    const userData = await fetchFxTwitterUser(kol.handle);
    const followers = userData?.followers || 0;
    const bio = userData?.description || `${kol.org} 领军人物`;

    // 2. 尝试从 Nitter 镜像抓取推文
    const nitterTweets = await fetchNitterRss(kol.handle);
    let capturedCount = 0;

    if (nitterTweets.length > 0) {
      console.log(`    -> [Nitter镜像] 捕获到 ${nitterTweets.length} 条原始推文`);
      for (const t of nitterTweets) {
        const kws = extractTechKeywords(t.title);
        allItems.push({
          id: `x-nitter-${Buffer.from(t.title).toString("hex").slice(0, 10)}`,
          handle: kol.handle,
          authorName: kol.name,
          authorBio: bio,
          followersCount: followers,
          tweetTitle: t.title,
          tweetUrl: t.url,
          pubDate: t.pubDate || new Date().toISOString(),
          extractedKeywords: kws,
          emdDomainIdeas: kws.length > 0 ? generateEmdIdeas(kws[0]) : [],
          impactScore: kol.weight,
          suggestedAction: "紧跟 KOL 推特官宣技术，抢先占领衍生教程与开源包装单页",
          captureChannel: "nitter_mirror",
          fetchedAt: new Date().toISOString()
        });
      }
      capturedCount += nitterTweets.length;
    }

    // 3. 通道 2: Google 实时全网 X 提及流 (补充最新爆款话题)
    const mentions = await fetchKolGoogleMentions(kol.name, kol.handle, 3);
    if (mentions.length > 0) {
      console.log(`    -> [全网推文流] 捕获到 ${mentions.length} 条相关最新推文与报道`);
      for (const m of mentions) {
        const kws = extractTechKeywords(m.title);
        allItems.push({
          id: `x-mention-${Buffer.from(m.title).toString("hex").slice(0, 10)}`,
          handle: kol.handle,
          authorName: kol.name,
          authorBio: bio,
          followersCount: followers,
          tweetTitle: m.title,
          tweetUrl: m.url,
          pubDate: m.pubDate || new Date().toISOString(),
          extractedKeywords: kws,
          emdDomainIdeas: kws.length > 0 ? generateEmdIdeas(kws[0]) : [],
          impactScore: kol.weight - 5,
          suggestedAction: "KOL 引发全网热议的新技术概念，建议立即建立对比或评测站",
          captureChannel: "realtime_x_mention",
          fetchedAt: new Date().toISOString()
        });
      }
      capturedCount += mentions.length;
    }

    // 4. 若上述均未捕获新动态，至少保存 KOL 基础资料更新
    if (capturedCount === 0 && userData) {
      allItems.push({
        id: `x-meta-${kol.handle}`,
        handle: kol.handle,
        authorName: kol.name,
        authorBio: bio,
        followersCount: followers,
        tweetTitle: `@${kol.handle} 最新个人简介: "${bio.slice(0, 100)}"`,
        tweetUrl: `https://x.com/${kol.handle}`,
        pubDate: new Date().toISOString(),
        extractedKeywords: extractTechKeywords(bio),
        emdDomainIdeas: [],
        impactScore: kol.weight - 10,
        suggestedAction: "关注该 KOL 最新投资或研发项目动向",
        captureChannel: "fxtwitter_metadata",
        fetchedAt: new Date().toISOString()
      });
    }

    // 微小间隔避免频控
    await new Promise(r => setTimeout(r, 600));
  }

  // 排序：影响力得分高的排在前面
  allItems.sort((a, b) => b.impactScore - a.impactScore);

  const payload = {
    fetched_at: new Date().toISOString(),
    total_tracked_kols: TARGET_KOLS.length,
    total_posts: allItems.length,
    posts: allItems
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), "utf-8");

  console.log("=".repeat(60));
  console.log(`🎉 Twitter/X AI KOL 追踪完成！共收录 ${allItems.length} 条推特动态情报`);
  console.log(`📁 数据已存盘: ${OUTPUT_FILE}`);
  console.log("=".repeat(60));

  return allItems;
}

if (process.argv[1] && process.argv[1].endsWith("fetch_twitter_kol.ts")) {
  runTwitterKolIngestion();
}
