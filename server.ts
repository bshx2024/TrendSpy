import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { spawn, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ENTITY_SEEDS } from "./entity_seeds.js";
import { evaluateSerpDifficulty } from "./serp_evaluator.js";
import { getStreamData } from "./batch_timeline_service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3200;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// 首页静态入口
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const DATA_DIR = path.join(__dirname, "data");
const REPORTS_DIR = path.join(__dirname, "reports");

// 实时扫描状态与日志广播管理
interface ScanState {
  isScanning: boolean;
  pipeline: string | null;
  startedAt: string | null;
  logs: string[];
}

const scanState: ScanState = {
  isScanning: false,
  pipeline: null,
  startedAt: null,
  logs: []
};

let activeProcess: ChildProcess | null = null;
const sseClients: express.Response[] = [];

function broadcastSSE(type: string, data: any) {
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

function safeReadJson(filePath: string, fallback: any = null) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return fallback;
}

// 0. Web Cafe 极简流式看板与动态批次 API
app.get("/api/stream-data", (_req, res) => {
  try {
    const data = getStreamData();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1. 概览指标 API
app.get("/api/overview", (_req, res) => {
  const benchmarkData = safeReadJson(path.join(DATA_DIR, "benchmark_radar_output.json"), {});
  const verifiedData = safeReadJson(path.join(DATA_DIR, "verified_radar.json"), {});
  const githubData = safeReadJson(path.join(DATA_DIR, "raw_github_repos.json"), {});
  const googleData = safeReadJson(path.join(DATA_DIR, "raw_google_trending.json"), {});
  const redditData = safeReadJson(path.join(DATA_DIR, "raw_reddit_posts.json"), {});
  const tiktokData = safeReadJson(path.join(DATA_DIR, "raw_tiktok_trends.json"), {});
  const toolifyData = safeReadJson(path.join(DATA_DIR, "raw_toolify_new.json"), {});
  const youtubeData = safeReadJson(path.join(DATA_DIR, "raw_youtube_trends.json"), {});
  const twitterData = safeReadJson(path.join(DATA_DIR, "raw_twitter_kol.json"), {});
  const timelineDb = safeReadJson(path.join(DATA_DIR, "timeline_database.json"), {});

  const newBreakoutsCount = benchmarkData.newBreakouts?.length || 0;
  const reSurgingCount = benchmarkData.reSurging?.length || 0;
  const highGrowthCount = benchmarkData.highGrowthList?.length || 0;
  const verifiedOpportunitiesCount = verifiedData.verified?.length || 0;
  const trackedKeywordsCount = Object.keys(timelineDb.records || {}).length;

  const hostedSitesData = safeReadJson(path.join(DATA_DIR, "raw_hosted_sites.json"), {});
  const hnData = safeReadJson(path.join(DATA_DIR, "raw_hn_new.json"), {});
  const serpData = safeReadJson(path.join(DATA_DIR, "serp_feasibility_results.json"), []);

  res.json({
    scanStatus: {
      isScanning: scanState.isScanning,
      pipeline: scanState.pipeline,
      startedAt: scanState.startedAt
    },
    metrics: {
      newBreakoutsCount,
      reSurgingCount,
      highGrowthCount,
      verifiedOpportunitiesCount,
      trackedKeywordsCount: trackedKeywordsCount || (newBreakoutsCount + reSurgingCount + highGrowthCount),
      seedsCount: ENTITY_SEEDS.length,
      githubReposCount: githubData.total_repos || githubData.repos?.length || 0,
      googleTrendingCount: googleData.total || googleData.items?.length || 0,
      redditPostsCount: redditData.total || redditData.posts?.length || 0,
      tiktokTrendsCount: tiktokData.total || tiktokData.items?.length || 0,
      toolifyToolsCount: toolifyData.total || toolifyData.items?.length || 0,
      youtubeTrendsCount: youtubeData.total || youtubeData.items?.length || 0,
      twitterPostsCount: twitterData.total_posts || twitterData.posts?.length || 0,
      hostedSitesCount: hostedSitesData.totalSites || hostedSitesData.sites?.length || 0,
      hostedKeywordsCount: hostedSitesData.totalKeywords || 0,
      hnProjectsCount: hnData.totalProjects || hnData.projects?.length || 0,
      serpEvaluatedCount: Array.isArray(serpData) ? serpData.length : 0
    },
    lastGenerated: {
      benchmark: benchmarkData.generatedAt || null,
      radar: verifiedData.fetched_at || null,
      timelineUpdated: timelineDb.updatedAt || null,
      hostedSites: hostedSitesData.fetchedAt || null,
      hn: hnData.fetchedAt || null
    }
  });
});

// 2. 突破爆发新词与标尺量化 API
app.get("/api/breakouts", (_req, res) => {
  const benchmarkData = safeReadJson(path.join(DATA_DIR, "benchmark_radar_output.json"), {
    generatedAt: null,
    benchmark: "gpts",
    newBreakouts: [],
    reSurging: [],
    highGrowthList: []
  });
  res.json(benchmarkData);
});

// 3. 流量套利与出海产品机会 API
app.get("/api/arbitrage", (_req, res) => {
  const verifiedData = safeReadJson(path.join(DATA_DIR, "verified_radar.json"), { count: 0, verified: [] });
  const candidatesData = safeReadJson(path.join(DATA_DIR, "candidates.json"), []);
  const rejectedData = safeReadJson(path.join(DATA_DIR, "rejected_candidates.json"), []);
  res.json({
    verified: verifiedData.verified || [],
    candidatesCount: Array.isArray(candidatesData) ? candidatesData.length : 0,
    rejectedCount: Array.isArray(rejectedData) ? rejectedData.length : 0
  });
});

// 4. 多平台实时源数据 API (Google, GitHub, Reddit, TikTok, Toolify, YouTube, Twitter)
app.get("/api/platforms", (_req, res) => {
  const googleData = safeReadJson(path.join(DATA_DIR, "raw_google_trending.json"), { items: [] });
  const githubData = safeReadJson(path.join(DATA_DIR, "raw_github_repos.json"), { repos: [] });
  const redditData = safeReadJson(path.join(DATA_DIR, "raw_reddit_posts.json"), { posts: [] });
  const tiktokData = safeReadJson(path.join(DATA_DIR, "raw_tiktok_trends.json"), { items: [] });
  const toolifyData = safeReadJson(path.join(DATA_DIR, "raw_toolify_new.json"), { items: [] });
  const youtubeData = safeReadJson(path.join(DATA_DIR, "raw_youtube_trends.json"), { items: [] });
  const twitterData = safeReadJson(path.join(DATA_DIR, "raw_twitter_kol.json"), { posts: [] });
  const hostedData = safeReadJson(path.join(DATA_DIR, "raw_hosted_sites.json"), { sites: [] });
  const hnData = safeReadJson(path.join(DATA_DIR, "raw_hn_new.json"), { projects: [] });
  res.json({
    google: googleData.items || [],
    github: githubData.repos || [],
    reddit: redditData.posts || [],
    tiktok: tiktokData.items || [],
    toolify: toolifyData.items || [],
    youtube: youtubeData.items || [],
    twitter: twitterData.posts || [],
    hosted: hostedData.sites || [],
    hn: hnData.projects || []
  });
});

// 4.1 YouTube 专属趋势 API
app.get("/api/youtube", (_req, res) => {
  const youtubeData = safeReadJson(path.join(DATA_DIR, "raw_youtube_trends.json"), { items: [] });
  res.json(youtubeData);
});

// 4.2 Twitter AI KOL 专属情报 API
app.get("/api/twitter", (_req, res) => {
  const twitterData = safeReadJson(path.join(DATA_DIR, "raw_twitter_kol.json"), { posts: [] });
  res.json(twitterData);
});

// 5. 免费托管新站雷达 API
app.get("/api/hosted-sites", (_req, res) => {
  const data = safeReadJson(path.join(DATA_DIR, "raw_hosted_sites.json"), {
    fetchedAt: null,
    totalSites: 0,
    totalKeywords: 0,
    sites: []
  });
  res.json(data);
});

// 6. Hacker News 创客新站雷达 API
app.get("/api/hn-projects", (_req, res) => {
  const data = safeReadJson(path.join(DATA_DIR, "raw_hn_new.json"), {
    fetchedAt: null,
    totalProjects: 0,
    projects: []
  });
  res.json(data);
});

// 7. SERP 竞争难度与小站吃肉评估 API
app.get("/api/serp-eval", (_req, res) => {
  const data = safeReadJson(path.join(DATA_DIR, "serp_feasibility_results.json"), []);
  res.json(data);
});

// 8. 实体种子库 API
app.get("/api/seeds", (_req, res) => {
  res.json(ENTITY_SEEDS);
});

// 9. 单个词时序历史 API
app.get("/api/timeline/:keyword", (req, res) => {
  const kw = decodeURIComponent(req.params.keyword).toLowerCase().trim();
  const timelineDb = safeReadJson(path.join(DATA_DIR, "timeline_database.json"), { records: {} });
  const record = timelineDb.records?.[kw] || null;
  res.json({ keyword: kw, record });
});

// 10. 关键词 360° 深度诊断与详情 API (对标截图完整详情模态)
app.get("/api/keyword-detail/:keyword", async (req, res) => {
  const kw = decodeURIComponent(req.params.keyword).toLowerCase().trim();

  // 1. 读取基础数据库与研报输出
  const timelineDb = safeReadJson(path.join(DATA_DIR, "timeline_database.json"), { records: {} });
  const benchmarkData = safeReadJson(path.join(DATA_DIR, "benchmark_radar_output.json"), {});
  const verifiedData = safeReadJson(path.join(DATA_DIR, "verified_radar.json"), {});
  const serpCache = safeReadJson(path.join(DATA_DIR, "serp_feasibility_results.json"), []);
  const rawRising = safeReadJson(path.join(DATA_DIR, "raw_entity_rising.json"), { items: [] });

  const allBenchmarkItems = [
    ...(benchmarkData.newBreakouts || []),
    ...(benchmarkData.reSurging || []),
    ...(benchmarkData.highGrowthList || [])
  ];

  const matchedBenchmark = allBenchmarkItems.find(
    (b: any) => b.keyword?.toLowerCase() === kw || b.relatedVariants?.some((v: string) => v.toLowerCase() === kw)
  );

  const matchedVerified = (verifiedData.verified || []).find(
    (v: any) => v.triggerKeyword?.toLowerCase() === kw
  );

  const timelineRecord = timelineDb.records?.[kw] || null;

  // 2. 获取或即时评估 SERP 前两页与小站情况
  let serpInfo = serpCache.find((s: any) => s.keyword?.toLowerCase() === kw);
  if (!serpInfo) {
    try {
      serpInfo = await evaluateSerpDifficulty(kw);
    } catch {}
  }

  // 3. 计算长尾衍生词 / 可以做成内页的词 (基于 Google Suggest 探针)
  const longTailKeywords: string[] = [];
  try {
    const sRes = await fetch(
      `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(kw + " ")}&gl=us&hl=en`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
        }
      }
    );
    if (sRes.ok) {
      const data = await sRes.json();
      const suggestions = data?.[1] || [];
      for (const s of suggestions) {
        if (s.toLowerCase() !== kw && s.length > 2) {
          longTailKeywords.push(s);
        }
      }
    }
  } catch {}

  // 4. 构建趋势曲线点（如果有时序则用时序，无时序则模拟规范化点阵）
  let historyPoints: Array<{ date: string; value: number }> = [];
  if (timelineRecord && Array.isArray(timelineRecord.historyRatios)) {
    historyPoints = timelineRecord.historyRatios.map((h: any) => ({
      date: h.date,
      value: Math.round((h.ratio || 0.1) * 100)
    }));
  }
  if (historyPoints.length < 5) {
    const today = new Date();
    const peak = matchedBenchmark?.peakTarget || 85;
    historyPoints = [
      { date: new Date(today.getTime() - 28 * 86400000).toISOString().slice(5, 10), value: Math.round(peak * 0.1) },
      { date: new Date(today.getTime() - 21 * 86400000).toISOString().slice(5, 10), value: Math.round(peak * 0.18) },
      { date: new Date(today.getTime() - 14 * 86400000).toISOString().slice(5, 10), value: Math.round(peak * 0.45) },
      { date: new Date(today.getTime() - 7 * 86400000).toISOString().slice(5, 10), value: Math.round(peak * 0.88) },
      { date: new Date(today.getTime() - 1 * 86400000).toISOString().slice(5, 10), value: peak }
    ];
  }

  // 5. 组合并返回深度画像
  res.json({
    keyword: kw,
    entity: matchedBenchmark?.entity || timelineRecord?.entity || "通用搜索需求",
    entityDisplayName: matchedBenchmark?.entityDisplayName || timelineRecord?.entity || "通用意图",
    category: matchedBenchmark?.category || timelineRecord?.category || "工具与应用",
    lifecycleStage: matchedBenchmark?.lifecycleStage || timelineRecord?.lifecycleStage || "新词首次爆发",
    growthStatus: matchedBenchmark?.growthStatus || "飙升",
    benchmarkRatioFormatted: matchedBenchmark?.ratioFormatted || `GPTs×${(matchedBenchmark?.benchmarkRatio || 0.05).toFixed(3)}`,
    currentMomentum: matchedBenchmark?.currentMomentum || "上升中",
    firstSeenDate: timelineRecord?.firstSeenDate || matchedBenchmark?.firstSeenDate || "近期",
    breakoutDate: timelineRecord?.breakoutDate || matchedBenchmark?.breakoutDate || "近期",
    peakTarget: matchedBenchmark?.peakTarget || 80,
    historyPoints,
    
    // 三段式业务诊断 (这是什么 / 用户想干什么 / 我们该怎么做)
    analysis: {
      whatIsIt: matchedVerified?.description || matchedBenchmark?.suggestedAction || `${kw} 属于近期搜索量爆发的 AI/技术需求词或游戏工具。`,
      userIntent: matchedBenchmark?.isCommercial ? "用户寻找免登录体验工具、API 接口、一键生成器或相关工作流下载。" : "用户跟踪最新版本发布与使用教程。",
      actionSuggestion: matchedVerified?.suggestedAction || matchedBenchmark?.suggestedAction || "搭建极简单页，优化精准长尾词，避开顶级大站直接截取自然搜索流量。"
    },

    // 竞争与可行性评级
    feasibility: {
      difficultyScore: serpInfo?.difficultyScore || 45,
      opportunityLevel: serpInfo?.opportunityLevel || "良好机会 (大站内页薄弱)",
      hasSmallSiteRanking: serpInfo?.hasSmallSiteRanking || false,
      summaryNote: serpInfo?.summaryNote || "SERP 存在长尾排名空间，适合敏捷落地。",
      dominantDomains: serpInfo?.dominantDomains || ["google.com", "youtube.com", "reddit.com"]
    },

    // 衍生内页长尾词
    longTailKeywords: Array.from(new Set([...(matchedBenchmark?.relatedVariants || []), ...longTailKeywords])).slice(0, 15),

    // 验证与外链
    trendsUrl: `https://trends.google.com/trends/explore?date=today%201-m&q=${encodeURIComponent(kw)},gpts`,
    serpUrl: `https://www.google.com/search?q=${encodeURIComponent(kw)}`
  });
});

// 7. 研报列表 API
app.get("/api/reports", (_req, res) => {
  try {
    if (!fs.existsSync(REPORTS_DIR)) {
      return res.json([]);
    }
    const files = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith(".md"));
    const list = files.map((filename) => {
      const fullPath = path.join(REPORTS_DIR, filename);
      const stat = fs.statSync(fullPath);
      return {
        filename,
        title: filename.replace(/\.md$/, "").replace(/_/g, " "),
        sizeBytes: stat.size,
        updatedAt: stat.mtime.toISOString()
      };
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. 读取单个研报 Markdown
app.get("/api/reports/:filename", (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const fullPath = path.join(REPORTS_DIR, filename);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "Report not found" });
    }
    const content = fs.readFileSync(fullPath, "utf-8");
    res.json({ filename, content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. 启动全自动扫描流水线 API (支持本地子进程与 Vercel 云端 GitHub Actions 远程调度)
app.post("/api/scan", async (req, res) => {
  if (process.env.VERCEL) {
    const ghPat = process.env.GH_PAT || process.env.GITHUB_TOKEN;
    const ghRepo = process.env.GH_REPO || "bshx2024/TrendSpy";
    const workflowFile = "daily_scan.yml";
    const actionUrl = `https://github.com/${ghRepo}/actions/workflows/${workflowFile}`;

    if (!ghPat) {
      return res.status(400).json({
        success: false,
        isVercel: true,
        needConfig: true,
        message: "未在 Vercel 中检测到 GH_PAT。请在 Vercel 环境变量中配置 GH_PAT (需包含 workflow 权限的 GitHub Token)，即可一键云端自动触发！",
        actionUrl
      });
    }

    try {
      const ghRes = await fetch(
        `https://api.github.com/repos/${ghRepo}/actions/workflows/${workflowFile}/dispatches`,
        {
          method: "POST",
          headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${ghPat}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "TrendSpy-SaaS-3.0"
          },
          body: JSON.stringify({ ref: "main" })
        }
      );

      if (ghRes.status === 204 || ghRes.ok) {
        return res.json({
          success: true,
          isVercel: true,
          dispatched: true,
          message: "🚀 已成功向 GitHub Actions 发送扫描指令！云端正在执行巡航任务...",
          actionUrl
        });
      } else {
        const errText = await ghRes.text();
        return res.status(ghRes.status).json({
          success: false,
          isVercel: true,
          error: `GitHub 触发失败 (${ghRes.status}): ${errText}`,
          actionUrl
        });
      }
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        isVercel: true,
        error: `调用 GitHub API 异常: ${e.message}`,
        actionUrl
      });
    }
  }

  const { pipeline } = req.body; // 'newtrend' | 'radar' | 'tiktok'
  if (scanState.isScanning) {
    return res.status(409).json({
      error: "流水线任务正在执行中，请勿重复触发",
      currentPipeline: scanState.pipeline,
      startedAt: scanState.startedAt
    });
  }

  let scriptName = "run_newtrend_pipeline.ts";
  if (pipeline === "radar") {
    scriptName = "run_radar.ts";
  } else if (pipeline === "tiktok") {
    scriptName = "fetch_tiktok_trends.ts";
  } else if (pipeline === "toolify") {
    scriptName = "fetch_toolify.ts";
  }
  const scriptPath = path.join(__dirname, scriptName);

  if (!fs.existsSync(scriptPath)) {
    return res.status(400).json({ error: `脚本不存在: ${scriptName}` });
  }

  scanState.isScanning = true;
  scanState.pipeline = pipeline || "newtrend";
  scanState.startedAt = new Date().toISOString();
  scanState.logs = [`[系统通知] 启动流水线任务: ${scriptName} (${scanState.startedAt})`];

  broadcastSSE("status", { isScanning: true, pipeline: scanState.pipeline, startedAt: scanState.startedAt });
  broadcastSSE("log", { line: scanState.logs[0] });

  // 跨平台调用 npx tsx
  const isWin = process.platform === "win32";
  const cmd = isWin ? "npx.cmd" : "npx";
  const args = ["tsx", scriptName];

  try {
    activeProcess = spawn(cmd, args, {
      cwd: __dirname,
      shell: true,
      env: { ...process.env, FORCE_COLOR: "0" }
    });

    const handleChunk = (chunk: Buffer) => {
      const text = chunk.toString("utf-8");
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      for (const line of lines) {
        scanState.logs.push(line);
        if (scanState.logs.length > 1000) scanState.logs.shift(); // 最多保留 1000 行
        broadcastSSE("log", { line });
      }
    };

    activeProcess.stdout?.on("data", handleChunk);
    activeProcess.stderr?.on("data", handleChunk);

    activeProcess.on("close", (code) => {
      const finishMsg = `[系统通知] 流水线执行结束，退出码: ${code}`;
      scanState.logs.push(finishMsg);
      broadcastSSE("log", { line: finishMsg });

      scanState.isScanning = false;
      scanState.pipeline = null;
      activeProcess = null;

      broadcastSSE("status", { isScanning: false, pipeline: null, exitCode: code });
    });

    activeProcess.on("error", (err) => {
      const errMsg = `[系统错误] 流水线进程启动异常: ${err.message}`;
      scanState.logs.push(errMsg);
      broadcastSSE("log", { line: errMsg });

      scanState.isScanning = false;
      scanState.pipeline = null;
      activeProcess = null;

      broadcastSSE("status", { isScanning: false, error: err.message });
    });

    res.json({
      success: true,
      message: `已成功启动流水线: ${scriptName}`,
      startedAt: scanState.startedAt
    });
  } catch (err: any) {
    scanState.isScanning = false;
    scanState.pipeline = null;
    activeProcess = null;
    res.status(500).json({ error: err.message });
  }
});

// 10. 停止扫描流水线 API
app.post("/api/scan/stop", (_req, res) => {
  if (!scanState.isScanning || !activeProcess) {
    return res.json({ success: true, message: "当前没有正在运行的流水线" });
  }

  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(activeProcess.pid), "/f", "/t"]);
    } else {
      activeProcess.kill("SIGTERM");
    }
    scanState.isScanning = false;
    scanState.pipeline = null;
    activeProcess = null;

    const stopMsg = "[系统通知] 扫描任务已由用户手动终止";
    scanState.logs.push(stopMsg);
    broadcastSSE("log", { line: stopMsg });
    broadcastSSE("status", { isScanning: false, stopped: true });

    res.json({ success: true, message: "扫描已终止" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10.1 查询云端 GitHub Actions 巡航执行状态 API
app.get("/api/scan/cloud-status", async (_req, res) => {
  const ghPat = process.env.GH_PAT || process.env.GITHUB_TOKEN;
  const ghRepo = process.env.GH_REPO || "bshx2024/TrendSpy";
  const workflowFile = "daily_scan.yml";

  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "TrendSpy-SaaS-3.0",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (ghPat) {
    headers["Authorization"] = `Bearer ${ghPat}`;
  }

  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/${ghRepo}/actions/workflows/${workflowFile}/runs?per_page=1`,
      { headers }
    );
    if (!ghRes.ok) {
      return res.status(ghRes.status).json({ error: "Failed to fetch GitHub runs", configured: Boolean(ghPat) });
    }
    const data: any = await ghRes.json();
    const latestRun = data.workflow_runs?.[0] || null;
    return res.json({
      configured: Boolean(ghPat),
      repo: ghRepo,
      latestRun: latestRun ? {
        id: latestRun.id,
        name: latestRun.name,
        status: latestRun.status,
        conclusion: latestRun.conclusion,
        html_url: latestRun.html_url,
        created_at: latestRun.created_at,
        updated_at: latestRun.updated_at
      } : null
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 11. SSE 实时日志流终端
app.get("/api/scan/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });

  // 立即发送当前状态与近 50 条历史日志
  res.write(`event: status\ndata: ${JSON.stringify({ isScanning: scanState.isScanning, pipeline: scanState.pipeline })}\n\n`);
  const recentLogs = scanState.logs.slice(-50);
  for (const line of recentLogs) {
    res.write(`event: log\ndata: ${JSON.stringify({ line })}\n\n`);
  }

  sseClients.push(res);

  req.on("close", () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) {
      sseClients.splice(idx, 1);
    }
  });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n========================================================`);
    console.log(`🚀 TrendSpy Web SaaS 控制台已启动！`);
    console.log(`🌐 访问地址: http://localhost:${PORT}`);
    console.log(`📡 API 文档及数据监控服务已就绪`);
    console.log(`========================================================\n`);
  });
}

export default app;
export { app };
