/**
 * 免费托管新站雷达 (Hosted Sites Radar)
 * 监控 vercel.app, github.io, pages.dev 等免费托管域名的最新出海独立站
 * 抓取产品定位、关键词与潜在流量机会
 */
import fs from "node:fs";
import path from "node:path";

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const DATA_DIR = path.join(CURRENT_DIR, "data");
const OUTPUT_FILE = path.join(DATA_DIR, "raw_hosted_sites.json");

export interface HostedSite {
  domain: string;
  platform: "vercel" | "github" | "cloudflare" | "other";
  title: string;
  description: string;
  extractedKeywords: string[];
  firstSeenAt: string;
  sourceUrl: string;
}

export interface HostedSitesPayload {
  fetchedAt: string;
  totalSites: number;
  totalKeywords: number;
  sites: HostedSite[];
}

const COMMON_PROBES = [
  "site:vercel.app ai generator",
  "site:vercel.app tool free",
  "site:vercel.app prompt",
  "site:pages.dev ai",
  "site:pages.dev calculator",
  "site:github.io game",
  "site:github.io ai webui"
];

/**
 * 从 GitHub Code & Readme 搜索近期部署在 vercel.app / pages.dev / github.io 的新开源工具
 */
async function searchGitHubDeployments(): Promise<HostedSite[]> {
  const sites: HostedSite[] = [];
  const queries = [
    "vercel.app ai in:readme pushed:>2026-09-01",
    "pages.dev tool in:readme pushed:>2026-09-01",
    "github.io webui in:readme pushed:>2026-09-01"
  ];

  for (const q of queries) {
    try {
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=15`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "TrendSpy-HostedRadar/2.1",
          Accept: "application/vnd.github.v3+json"
        }
      });
      if (!res.ok) continue;
      const data = await res.json();
      const items = data.items || [];

      for (const item of items) {
        let domain = "";
        let platform: HostedSite["platform"] = "other";

        if (item.homepage && item.homepage.includes(".vercel.app")) {
          domain = item.homepage;
          platform = "vercel";
        } else if (item.homepage && item.homepage.includes(".pages.dev")) {
          domain = item.homepage;
          platform = "cloudflare";
        } else if (item.homepage && item.homepage.includes(".github.io")) {
          domain = item.homepage;
          platform = "github";
        } else if (item.has_pages) {
          domain = `https://${item.owner.login.toLowerCase()}.github.io/${item.name.toLowerCase()}`;
          platform = "github";
        }

        if (domain) {
          // 提取可能的相关关键词
          const keywords = [
            item.name.replace(/[-_]/g, " "),
            ...(item.topics || [])
          ].filter(k => k.length > 2);

          sites.push({
            domain,
            platform,
            title: item.name,
            description: item.description || "No description provided",
            extractedKeywords: Array.from(new Set(keywords)),
            firstSeenAt: new Date().toISOString(),
            sourceUrl: item.html_url
          });
        }
      }
    } catch (err: any) {
      console.warn(`[HostedSites] Query '${q}' failed:`, err.message);
    }
  }
  return sites;
}

/**
 * 基于 Google Suggest 反查热门托管站名
 */
async function searchSuggestHostedSites(): Promise<HostedSite[]> {
  const hosts = ["vercel app", "pages dev", "github io"];
  const sites: HostedSite[] = [];

  for (const host of hosts) {
    try {
      const res = await fetch(
        `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(host + " ")}&gl=us&hl=en`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
          }
        }
      );
      if (res.ok) {
        const data = await res.json();
        const suggestions: string[] = data?.[1] || [];
        for (const s of suggestions) {
          if (s.toLowerCase().includes(host)) {
            const clean = s.trim();
            const platform = host.includes("vercel") ? "vercel" : host.includes("pages") ? "cloudflare" : "github";
            sites.push({
              domain: `https://${clean.replace(/\s+/g, "-")}`,
              platform,
              title: clean,
              description: `Community trending search query on ${host}`,
              extractedKeywords: [clean, host],
              firstSeenAt: new Date().toISOString(),
              sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(clean)}`
            });
          }
        }
      }
    } catch {}
  }
  return sites;
}

export async function runHostedSitesIngestion(): Promise<HostedSitesPayload> {
  console.log("=".repeat(60));
  console.log("🌐 启动【托管新站雷达 (vercel.app / github.io / pages.dev)】...");

  let existing: HostedSitesPayload = {
    fetchedAt: new Date().toISOString(),
    totalSites: 0,
    totalKeywords: 0,
    sites: []
  };

  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
    } catch {}
  }

  const existingMap = new Map<string, HostedSite>();
  for (const s of existing.sites || []) {
    existingMap.set(s.domain.toLowerCase(), s);
  }

  const [ghSites, suggestSites] = await Promise.all([
    searchGitHubDeployments(),
    searchSuggestHostedSites()
  ]);

  const newlyFound = [...ghSites, ...suggestSites];
  let addedCount = 0;

  for (const s of newlyFound) {
    const key = s.domain.toLowerCase();
    if (!existingMap.has(key)) {
      existingMap.set(key, s);
      addedCount++;
    }
  }

  const allSites = Array.from(existingMap.values());
  const allKeywords = new Set<string>();
  allSites.forEach(s => s.extractedKeywords.forEach(k => allKeywords.add(k.toLowerCase())));

  const payload: HostedSitesPayload = {
    fetchedAt: new Date().toISOString(),
    totalSites: allSites.length,
    totalKeywords: allKeywords.size,
    sites: allSites
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`✔ [托管新站雷达] 抓取完成！当前收录站点: ${allSites.length} (+${addedCount} 新增)，关键词池: ${allKeywords.size}`);
  return payload;
}

if (process.argv[1] && process.argv[1].endsWith("fetch_hosted_sites.ts")) {
  runHostedSitesIngestion().catch(console.error);
}
