/**
 * Hacker News (HN) 创客新站与痛点雷达 (HN New Products Radar)
 * 实时监控 HN 的 "Show HN" / "Ask HN" / "newest"
 * 提炼痛点、发布网站、独立开发者产品与冲高关键词
 */
import fs from "node:fs";
import path from "node:path";

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const DATA_DIR = path.join(CURRENT_DIR, "data");
const OUTPUT_FILE = path.join(DATA_DIR, "raw_hn_new.json");

export interface HnProjectItem {
  id: number;
  title: string;
  url: string;
  author: string;
  points: number;
  commentsCount: number;
  postedAt: string;
  painPointSummary: string;
  extractedKeywords: string[];
  hnUrl: string;
}

export interface HnProjectsPayload {
  fetchedAt: string;
  totalProjects: number;
  projects: HnProjectItem[];
}

/**
 * 从标题与内容中提取可能的需求痛点与关键词
 */
function extractPainPointsAndKeywords(title: string): { summary: string; keywords: string[] } {
  const clean = title.replace(/^Show HN:\s*/i, "").replace(/^Ask HN:\s*/i, "").trim();
  const keywords: string[] = [];

  // 提取关键词
  const tokens = clean.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/);
  const stopWords = new Set(["a", "an", "the", "in", "on", "for", "with", "to", "of", "and", "or", "is", "are", "i", "we", "my", "built", "made", "simple", "tool", "app"]);
  const meaningful = tokens.filter(t => t.length > 2 && !stopWords.has(t));

  for (let i = 0; i < meaningful.length; i++) {
    keywords.push(meaningful[i]);
    if (i < meaningful.length - 1) {
      keywords.push(`${meaningful[i]} ${meaningful[i + 1]}`);
    }
  }

  let summary = clean;
  if (clean.includes("–") || clean.includes("-") || clean.includes(":")) {
    const parts = clean.split(/[-–:]/);
    if (parts.length > 1) {
      summary = parts.slice(1).join(" ").trim();
    }
  }

  return {
    summary,
    keywords: Array.from(new Set(keywords)).slice(0, 8)
  };
}

export async function runHnIngestion(): Promise<HnProjectsPayload> {
  console.log("=".repeat(60));
  console.log("📰 启动【Hacker News (HN) 创客新站雷达】...");

  let existing: HnProjectsPayload = {
    fetchedAt: new Date().toISOString(),
    totalProjects: 0,
    projects: []
  };

  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
    } catch {}
  }

  const existingMap = new Map<number, HnProjectItem>();
  for (const p of existing.projects || []) {
    existingMap.set(p.id, p);
  }

  // 1. 获取 Show HN 与 Newest
  try {
    const [showStoriesRes, newStoriesRes] = await Promise.all([
      fetch("https://hacker-news.firebaseio.com/v0/showstories.json"),
      fetch("https://hacker-news.firebaseio.com/v0/newstories.json")
    ]);

    const showIds: number[] = showStoriesRes.ok ? await showStoriesRes.json() : [];
    const newIds: number[] = newStoriesRes.ok ? await newStoriesRes.json() : [];

    // 合并前 40 个最新故事进行分析
    const targetIds = Array.from(new Set([...(showIds.slice(0, 30)), ...(newIds.slice(0, 15))]));
    let newlyAdded = 0;

    for (const id of targetIds) {
      if (existingMap.has(id)) continue;
      try {
        const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        if (!itemRes.ok) continue;
        const item = await itemRes.json();
        if (!item || !item.title) continue;

        // 仅关注独立产品、新站、开源工具
        const isShow = item.title.toLowerCase().startsWith("show hn");
        const hasUrl = Boolean(item.url);

        if (isShow || hasUrl) {
          const { summary, keywords } = extractPainPointsAndKeywords(item.title);
          const project: HnProjectItem = {
            id: item.id,
            title: item.title,
            url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
            author: item.by || "anonymous",
            points: item.score || 1,
            commentsCount: item.descendants || 0,
            postedAt: new Date((item.time || Date.now() / 1000) * 1000).toISOString(),
            painPointSummary: summary,
            extractedKeywords: keywords,
            hnUrl: `https://news.ycombinator.com/item?id=${item.id}`
          };
          existingMap.set(id, project);
          newlyAdded++;
        }
      } catch {}
    }

    const allProjects = Array.from(existingMap.values())
      .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
      .slice(0, 500); // 保留最新 500 个

    const payload: HnProjectsPayload = {
      fetchedAt: new Date().toISOString(),
      totalProjects: allProjects.length,
      projects: allProjects
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), "utf-8");
    console.log(`✔ [HN 新站雷达] 抓取完成！当前跟踪项目: ${allProjects.length} (+${newlyAdded} 本次新增)`);
    return payload;
  } catch (err: any) {
    console.error("✖ [HN 新站雷达] 抓取失败:", err.message);
    return existing;
  }
}

if (process.argv[1] && process.argv[1].endsWith("fetch_hn_new.ts")) {
  runHnIngestion().catch(console.error);
}
