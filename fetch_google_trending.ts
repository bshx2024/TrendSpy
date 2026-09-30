import fs from "node:fs";
import path from "node:path";

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const DATA_DIR = path.join(CURRENT_DIR, "data");
const OUTPUT_FILE = path.join(DATA_DIR, "raw_google_trending.json");

export interface GoogleTrendingItem {
  title: string;
  traffic: string;
  pubDate: string;
  description: string;
  source: "google_trending";
}

// 提取 XML 中的字段
function parseRSSItems(xmlText: string): GoogleTrendingItem[] {
  const items: GoogleTrendingItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemBlock = match[1];
    const titleMatch = /<title>(.*?)<\/title>/.exec(itemBlock);
    const trafficMatch = /<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/.exec(itemBlock);
    const pubDateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(itemBlock);
    const descMatch = /<description>([\s\S]*?)<\/description>/.exec(itemBlock);

    if (titleMatch) {
      items.push({
        title: titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim(),
        traffic: trafficMatch ? trafficMatch[1].trim() : "Unknown",
        pubDate: pubDateMatch ? pubDateMatch[1].trim() : "",
        description: descMatch ? descMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim() : "",
        source: "google_trending"
      });
    }
  }

  return items;
}

export async function fetchGoogleTrending(geo = "US"): Promise<GoogleTrendingItem[]> {
  const url = `https://trends.google.com/trending/rss?geo=${geo}`;
  
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 TrendSpy/2.0"
      }
    });

    if (!res.ok) {
      console.warn(`[-] 抓取 Google Trending RSS 失败: HTTP ${res.status}`);
      return [];
    }

    const xml = await res.text();
    return parseRSSItems(xml);
  } catch (err: any) {
    console.error(`[-] Google Trending 抓取异常:`, err.message);
    return [];
  }
}

export async function runGoogleTrendingIngestion(): Promise<GoogleTrendingItem[]> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  console.log("=".repeat(60));
  console.log("📡 正在抓取 Google 官方实时飙升榜 (Trending Breakout Stream)...");
  console.log("=".repeat(60));

  const items = await fetchGoogleTrending("US");
  console.log(`✅ 成功捕获 ${items.length} 个过去 24 小时真实飙升事件`);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ fetched_at: new Date().toISOString(), total: items.length, items }, null, 2), "utf-8");
  return items;
}

if (process.argv[1] && process.argv[1].endsWith("fetch_google_trending.ts")) {
  runGoogleTrendingIngestion();
}
