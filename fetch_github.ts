import fs from "node:fs";
import path from "node:path";

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const OUTPUT_DIR = path.join(CURRENT_DIR, "data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "raw_github_repos.json");

export interface GitHubRepoItem {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  homepage: string | null;
  stars: number;
  forks: number;
  language: string | null;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
}

// 针对普通 C 端/自传播特质的搜索意图集合
const SEARCH_QUERIES = [
  "(generator OR maker) (card OR avatar OR meme OR receipt OR cover)",
  "(filter OR converter OR visualizer) (canvas OR web OR online)",
  "(fun OR tool OR interactive) (share OR social OR test)"
];

async function fetchGitHubSearch(query: string, perPage = 25): Promise<GitHubRepoItem[]> {
  const dateAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const q = `${query} created:>${dateAgo} stars:5..600`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${perPage}`;
  
  const headers: Record<string, string> = {
    "User-Agent": "TrendSpy-Radar/2.0",
    "Accept": "application/vnd.github.v3+json"
  };

  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  // 增加 2 次自动重试机制
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        console.warn(`[-] GitHub Search 请求异常: HTTP ${res.status} (${res.statusText})`);
        return [];
      }

      const data = await res.json();
      const items = data?.items || [];
      
      return items.map((item: any) => ({
        id: item.id,
        name: item.name,
        full_name: item.full_name,
        description: (item.description || "").trim(),
        html_url: item.html_url,
        homepage: item.homepage || null,
        stars: item.stargazers_count || 0,
        forks: item.forks_count || 0,
        language: item.language || null,
        topics: item.topics || [],
        created_at: item.created_at,
        updated_at: item.updated_at,
        pushed_at: item.pushed_at
      }));
    } catch (err: any) {
      if (attempt === 2) {
        console.error(`[-] 采集 GitHub 失败 [${query}]:`, err.message);
        return [];
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return [];
}

export async function runGitHubIngestion(): Promise<GitHubRepoItem[]> {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("=".repeat(60));
  console.log("⚡ 开始巡检 GitHub 敏捷雷达（C 端自传播与轻量工具开源库）...");
  console.log("=".repeat(60));

  const repoMap = new Map<number, GitHubRepoItem>();

  // 历史数据合并（避免网络单次抖动丢失数据）
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const prevData = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
      for (const r of (prevData.repos || [])) {
        repoMap.set(r.id, r);
      }
    } catch {}
  }

  for (const q of SEARCH_QUERIES) {
    console.log(`[*] 执行 C 端意图搜索: ${q} ...`);
    const repos = await fetchGitHubSearch(q, 20);
    console.log(`    -> 捕获到 ${repos.length} 个符合初筛条件的项目`);
    for (const r of repos) {
      repoMap.set(r.id, r);
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  const allRepos = Array.from(repoMap.values());
  allRepos.sort((a, b) => b.stars - a.stars);

  const result = {
    fetched_at: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
    total_repos: allRepos.length,
    repos: allRepos
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf-8");

  console.log("=".repeat(60));
  console.log(`🎉 GitHub 巡检完成！共去重捕获 ${allRepos.length} 个潜在 C 端新项目。`);
  console.log(`📁 原始仓库数据已保存至: ${OUTPUT_FILE}`);
  console.log("=".repeat(60));

  return allRepos;
}

if (process.argv[1] && process.argv[1].endsWith("fetch_github.ts")) {
  runGitHubIngestion();
}
