import fs from "node:fs";
import path from "node:path";

// 挑选出海工具、AI 编程与独立开发最高价值的核心板块
export const SUBREDDITS = [
  "cursor",
  "LocalLLaMA",
  "ChatGPTCoding",
  "SideProject",
  "webdev",
  "CoolGithubProjects",
  "IndieHackers",
  "InternetIsBeautiful"
];

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const OUTPUT_DIR = path.join(CURRENT_DIR, "data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "raw_reddit_posts.json");

interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  permalink: string;
  created_utc: number;
}

async function fetchSubreddit(subreddit: string, listing = "hot", limit = 25): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/${listing}.json?limit=${limit}`;
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 TrendSpy/1.0"
  };

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn(`[-] r/${subreddit} 请求失败: HTTP ${res.status} (${res.statusText})`);
      return [];
    }

    const json = await res.json();
    const children = json?.data?.children || [];
    const posts: RedditPost[] = [];

    for (const item of children) {
      const p = item.data;
      if (p.stickied) continue; // 排除置顶

      posts.push({
        id: p.id,
        subreddit: subreddit,
        title: (p.title || "").trim(),
        selftext: (p.selftext || "").slice(0, 500).trim(),
        score: p.score || 0,
        num_comments: p.num_comments || 0,
        permalink: `https://reddit.com${p.permalink}`,
        created_utc: p.created_utc
      });
    }

    return posts;
  } catch (err: any) {
    console.error(`[-] 抓取 r/${subreddit} 出错:`, err.message);
    return [];
  }
}

export async function runRedditIngestion(): Promise<RedditPost[]> {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("=".repeat(60));
  console.log("🚀 开始抓取 Reddit 高潜力独立开发、AI 编程与工具板块...");
  console.log("=".repeat(60));

  const allPosts: RedditPost[] = [];

  for (const sub of SUBREDDITS) {
    console.log(`[*] 正在采集 r/${sub} ...`);
    const posts = await fetchSubreddit(sub, "hot", 20);
    console.log(`    -> 采集到 ${posts.length} 条热帖`);
    allPosts.push(...posts);
    await new Promise((r) => setTimeout(r, 1200)); // 避免频控
  }

  // 按点赞热度降序排列
  allPosts.sort((a, b) => b.score - a.score);

  const result = {
    fetched_at: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
    total_posts: allPosts.length,
    posts: allPosts
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf-8");

  console.log("=".repeat(60));
  console.log(`🎉 Reddit 抓取完成！共收集 ${allPosts.length} 条数据。`);
  console.log(`📁 原始帖子已保存至: ${OUTPUT_FILE}`);
  console.log("=".repeat(60));

  return allPosts;
}

if (process.argv[1] && process.argv[1].endsWith("fetch_reddit.ts")) {
  runRedditIngestion();
}
