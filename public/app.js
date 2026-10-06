/**
 * TrendSpy SaaS 3.0 · Web Console Client Application
 */

// 全局应用状态
const state = {
  activeTab: "tab-stream",
  streamData: null,
  overview: null,
  breakoutsData: {
    benchmark: "gpts",
    newBreakouts: [],
    reSurging: [],
    highGrowthList: []
  },
  arbitrageData: {
    verified: []
  },
  platformsData: {
    google: [],
    github: [],
    reddit: []
  },
  reports: [],
  activeReport: null,
  seeds: [],
  filters: {
    breakoutStage: "all",
    breakoutCategory: "all",
    breakoutSearch: "",
    arbitrageStatus: "all",
    arbitrageSearch: "",
    seedCategory: "all",
    seedSearch: ""
  },
  sseConnected: false
};

// ==========================================
// Toast 消息提示
// ==========================================
function showToast(message, duration = 3000) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ==========================================
// SSE 实时日志流连接与状态管理
// ==========================================
function setupSSE() {
  const evtSource = new EventSource("/api/scan/stream");

  evtSource.addEventListener("status", (e) => {
    try {
      const data = JSON.parse(e.data);
      updateScanningStatus(data.isScanning, data.pipeline);
      if (data.isScanning === false && data.exitCode !== undefined) {
        showToast(`流水线执行完毕 (退出码: ${data.exitCode})`);
        fetchOverview();
        fetchBreakouts();
        fetchArbitrage();
        fetchReports();
      }
    } catch (err) {
      console.error("SSE status parse error:", err);
    }
  });

  evtSource.addEventListener("log", (e) => {
    try {
      const data = JSON.parse(e.data);
      appendTerminalLog(data.line);
    } catch (err) {
      console.error("SSE log parse error:", err);
    }
  });

  evtSource.onopen = () => {
    state.sseConnected = true;
  };

  evtSource.onerror = () => {
    state.sseConnected = false;
  };
}

function updateScanningStatus(isScanning, pipeline) {
  const statusPill = document.getElementById("statusPill");
  const statusText = document.getElementById("statusText");
  const terminalBadge = document.getElementById("terminalStatusBadge");
  const btnStop = document.getElementById("btnStopScan");

  if (isScanning) {
    statusPill.className = "pipeline-status-pill scanning";
    statusText.innerText = `正在执行流水线 (${pipeline || "NewTrend"})...`;
    terminalBadge.innerText = "RUNNING";
    terminalBadge.style.color = "var(--cyan-primary)";
    btnStop.style.display = "inline-flex";
  } else {
    statusPill.className = "pipeline-status-pill idle";
    statusText.innerText = "系统待命 (Idle)";
    terminalBadge.innerText = "IDLE";
    terminalBadge.style.color = "var(--text-dim)";
    btnStop.style.display = "none";
  }
}

function appendTerminalLog(line) {
  const logArea = document.getElementById("terminalLogArea");
  if (!logArea) return;
  const div = document.createElement("div");
  div.className = "log-line";

  if (line.includes("[系统通知]") || line.includes("🚀") || line.includes("✨") || line.includes("🔗")) {
    div.classList.add("system");
  } else if (line.includes("[-] ") || line.includes("错误") || line.includes("Error") || line.includes("⚠️") || line.includes("失败")) {
    div.classList.add("error");
  }

  if (line.includes("<a ") || line.includes("<span ") || line.includes("<b>") || line.includes("<code>")) {
    div.innerHTML = line;
  } else {
    div.textContent = line;
  }
  logArea.appendChild(div);
  logArea.scrollTop = logArea.scrollHeight;
}

async function checkCloudStatus() {
  try {
    const res = await fetch("/api/scan/cloud-status");
    if (!res.ok) return;
    const info = await res.json();
    if (info.latestRun) {
      const { status, html_url } = info.latestRun;
      if (status === "in_progress" || status === "queued") {
        updateScanningStatus(true, "GitHub Actions 云端巡航");
        const badge = document.getElementById("terminalStatusBadge");
        if (badge) badge.innerText = "CLOUD RUNNING";
      }
    }
  } catch (err) {
    // 忽略后台状态检查错误
  }
}


// ==========================================
// WebCafe 极简实时流动态数据层
// ==========================================
async function fetchStreamData() {
  try {
    const res = await fetch("/api/stream-data");
    const data = await res.json();
    state.streamData = data;
    renderStreamOverview(data.overview);
    renderStreamBatches(data.batches);
  } catch (err) {
    console.error("fetchStreamData error:", err);
  }
}

function renderStreamOverview(ov) {
  if (!ov) return;
  // 关键词库
  if (ov.keywordDb) {
    const kwTotalEl = document.getElementById("streamKwTotal");
    const kwTodayEl = document.getElementById("streamKwToday");
    const kwResurgeEl = document.getElementById("streamKwResurging");
    const kwTimeEl = document.getElementById("streamKwTime");
    if (kwTotalEl) kwTotalEl.innerText = (ov.keywordDb.total || 0).toLocaleString();
    if (kwTodayEl) kwTodayEl.innerText = (ov.keywordDb.todayNew || 0).toLocaleString();
    if (kwResurgeEl) kwResurgeEl.innerText = (ov.keywordDb.reSurging || 0).toLocaleString();
    if (kwTimeEl) kwTimeEl.innerText = `最后更新: ${ov.keywordDb.updatedAt || "近期"}`;
  }
  // HN 新站
  if (ov.hnNew) {
    const hnTotalEl = document.getElementById("streamHnTotal");
    const hn7dEl = document.getElementById("streamHn7d");
    const hn24hEl = document.getElementById("streamHn24h");
    const hnTimeEl = document.getElementById("streamHnTime");
    if (hnTotalEl) hnTotalEl.innerText = (ov.hnNew.total || 0).toLocaleString();
    if (hn7dEl) hn7dEl.innerText = (ov.hnNew.last7Days || 0).toLocaleString();
    if (hn24hEl) hn24hEl.innerText = (ov.hnNew.last24Hours || 0).toLocaleString();
    if (hnTimeEl) hnTimeEl.innerText = `最后更新: ${ov.hnNew.updatedAt || "近期"}`;
  }
  // 托管新站
  if (ov.hostedSites) {
    const hTotalEl = document.getElementById("streamHostedTotal");
    const hCycleEl = document.getElementById("streamHostedCycle");
    const hPioneerEl = document.getElementById("streamHostedPioneer");
    const hTimeEl = document.getElementById("streamHostedTime");
    if (hTotalEl) hTotalEl.innerText = (ov.hostedSites.total || 0).toLocaleString();
    if (hCycleEl) hCycleEl.innerText = (ov.hostedSites.latestCycle || 0).toLocaleString();
    if (hPioneerEl) hPioneerEl.innerText = (ov.hostedSites.pioneers || 0).toLocaleString();
    if (hTimeEl) hTimeEl.innerText = `最后更新: ${ov.hostedSites.updatedAt || "近期"}`;
  }
}

function renderStreamBatches(batches) {
  const container = document.getElementById("streamBatchesContainer");
  if (!container) return;
  if (!batches || batches.length === 0) {
    container.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-dim);">暂无流式巡航批次数据</div>`;
    return;
  }

  // 更新总标题副文
  const latest = batches[0];
  const subTitle = document.getElementById("streamTimelineSubtitle");
  if (subTitle && latest && latest.badges) {
    subTitle.innerText = `每小时自动扫一批 · 今天已跑 ${batches.length} 批，新词 ${latest.badges.newWords || 0}、二次爆火 ${latest.badges.reSurging || 0}、小游戏 ${latest.badges.games || 0}`;
  }

  container.innerHTML = batches.map(batch => {
    const badges = batch.badges || {};
    const ms = batch.metricsSummary || {};
    const cats = batch.categories || {};

    const summaryParts = [];
    if (ms.reviewedCandidates) summaryParts.push(`复核 ${ms.reviewedCandidates} 个候选`);
    if (ms.gamesCount) summaryParts.push(`${ms.gamesCount} 款小游戏`);
    if (ms.wordsAdded) summaryParts.push(`关键词库 +${ms.wordsAdded}`);
    if (ms.serpChecked) summaryParts.push(`查谷歌前两页 ${ms.serpChecked} 个词`);
    if (ms.valuableCount) summaryParts.push(`判断值不值得做 ${ms.valuableCount} 个`);
    if (ms.hnNewCount) summaryParts.push(`HN 新站 +${ms.hnNewCount}`);
    if (ms.durationMinutes) summaryParts.push(`用时 ${ms.durationMinutes} 分钟`);

    const summaryLine = summaryParts.join(" · ");

    function renderPills(items) {
      if (!items || items.length === 0) return `<span style="color:#64748b; font-size:12px;">无</span>`;
      return items.map(it => {
        const isHigh = it.isHigh || (it.ratio && it.ratio > 0.4);
        const ratioTxt = it.ratioFormatted || (it.ratio ? `×${it.ratio.toFixed(2)}` : "");
        const escapedKw = escapeHtml(it.keyword);
        const safeKwForClick = escapedKw.replace(/'/g, "\\'");
        return `
          <button class="stream-pill ${isHigh ? 'high' : ''}" onclick="openKeywordDetail('${safeKwForClick}')" title="点击查看详情、Google SERP 与落地分析">
            <span>${escapedKw}</span>
            ${ratioTxt ? `<span class="stream-pill-ratio">${ratioTxt}</span>` : ""}
          </button>
        `;
      }).join("");
    }

    return `
      <div class="stream-batch-card">
        <div class="stream-batch-top">
          <div class="stream-batch-meta">
            <span class="stream-batch-date">${escapeHtml(batch.dateLabel || batch.timestamp)}</span>
            <span class="stream-batch-relative">${escapeHtml(batch.relativeTime || "")}</span>
            <div class="stream-batch-badges">
              ${badges.newWords ? `<span class="stream-badge badge-new">新词 ${badges.newWords}</span>` : ""}
              ${badges.reSurging ? `<span class="stream-badge badge-resurge">二次爆火 ${badges.reSurging}</span>` : ""}
              ${badges.games ? `<span class="stream-badge badge-game">小游戏 ${badges.games}</span>` : ""}
              ${badges.pushed ? `<span class="stream-badge badge-push">推送 ${badges.pushed}</span>` : ""}
            </div>
          </div>
        </div>

        ${summaryLine ? `<div class="stream-batch-stats">${escapeHtml(summaryLine)}</div>` : ""}

        <div class="stream-batch-content">
          ${cats.newWords && cats.newWords.length > 0 ? `
            <div class="stream-category-row">
              <span class="stream-category-label">新词</span>
              <div class="stream-pills-wrap">${renderPills(cats.newWords)}</div>
            </div>
          ` : ""}

          ${cats.reSurging && cats.reSurging.length > 0 ? `
            <div class="stream-category-row">
              <span class="stream-category-label">二次爆火</span>
              <div class="stream-pills-wrap">${renderPills(cats.reSurging)}</div>
            </div>
          ` : ""}

          ${cats.games && cats.games.length > 0 ? `
            <div class="stream-category-row">
              <span class="stream-category-label">游戏</span>
              <div class="stream-pills-wrap">${renderPills(cats.games)}</div>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");
}

// ==========================================
// 数据请求层
// ==========================================
async function fetchOverview() {
  try {
    const res = await fetch("/api/overview");
    const data = await res.json();
    state.overview = data;

    // 更新 KPI
    const m = data.metrics || {};
    document.getElementById("kpiBreakouts").innerText = m.newBreakoutsCount ?? "--";
    document.getElementById("kpiReSurging").innerText = m.reSurgingCount ?? "--";
    document.getElementById("kpiArbitrage").innerText = m.verifiedOpportunitiesCount ?? "--";
    document.getElementById("kpiEntities").innerText = `${m.seedsCount || 28} 核心实体`;
    const totalMultiSource = (m.githubReposCount || 0) + 
                             (m.googleTrendingCount || 0) + 
                             (m.redditPostsCount || 0) + 
                             (m.tiktokTrendsCount || 0) + 
                             (m.toolifyToolsCount || 0) +
                             (m.youtubeTrendsCount || 0) +
                             (m.twitterPostsCount || 0);
    document.getElementById("kpiMultiSource").innerText = `${totalMultiSource} 条`;

    updateScanningStatus(data.scanStatus?.isScanning, data.scanStatus?.pipeline);
    if (!data.scanStatus?.isScanning) {
      checkCloudStatus();
    }
  } catch (err) {
    console.error("fetchOverview error:", err);
  }
}

async function fetchBreakouts() {
  try {
    const res = await fetch("/api/breakouts");
    const data = await res.json();
    state.breakoutsData = data;

    const totalCount = (data.newBreakouts?.length || 0) + (data.reSurging?.length || 0) + (data.highGrowthList?.length || 0);
    document.getElementById("pillBreakoutsCount").innerText = totalCount;

    renderBreakouts();
  } catch (err) {
    console.error("fetchBreakouts error:", err);
  }
}

async function fetchArbitrage() {
  try {
    const res = await fetch("/api/arbitrage");
    const data = await res.json();
    state.arbitrageData = data;

    const count = data.verified?.length || 0;
    document.getElementById("pillArbitrageCount").innerText = count;

    renderArbitrage();
  } catch (err) {
    console.error("fetchArbitrage error:", err);
  }
}

async function fetchPlatforms() {
  try {
    const res = await fetch("/api/platforms");
    const data = await res.json();
    state.platformsData = data;

    document.getElementById("badgeGoogleCount").innerText = data.google?.length || 0;
    document.getElementById("badgeGithubCount").innerText = data.github?.length || 0;
    document.getElementById("badgeRedditCount").innerText = data.reddit?.length || 0;
    const badgeTiktok = document.getElementById("badgeTiktokCount");
    if (badgeTiktok) badgeTiktok.innerText = data.tiktok?.length || 0;
    const badgeToolify = document.getElementById("badgeToolifyCount");
    if (badgeToolify) badgeToolify.innerText = data.toolify?.length || 0;
    const badgeYoutube = document.getElementById("badgeYoutubeCount");
    if (badgeYoutube) badgeYoutube.innerText = data.youtube?.length || 0;
    const badgeTwitter = document.getElementById("badgeTwitterCount");
    if (badgeTwitter) badgeTwitter.innerText = data.twitter?.length || 0;
    const badgeHosted = document.getElementById("badgeHostedCount");
    if (badgeHosted) badgeHosted.innerText = data.hosted?.length || 0;
    const badgeHn = document.getElementById("badgeHnCount");
    if (badgeHn) badgeHn.innerText = data.hn?.length || 0;

    renderPlatforms();
  } catch (err) {
    console.error("fetchPlatforms error:", err);
  }
}

async function fetchReports() {
  try {
    const res = await fetch("/api/reports");
    const list = await res.json();
    state.reports = list;

    document.getElementById("pillReportsCount").innerText = list.length;
    document.getElementById("reportsCountLabel").innerText = `${list.length} 篇`;

    renderReportsList();

    // 默认展示第一份研报
    if (list.length > 0 && !state.activeReport) {
      loadReport(list[0].filename);
    }
  } catch (err) {
    console.error("fetchReports error:", err);
  }
}

async function loadReport(filename) {
  try {
    const res = await fetch(`/api/reports/${encodeURIComponent(filename)}`);
    const data = await res.json();
    state.activeReport = data;

    document.getElementById("viewerTitle").innerText = filename.replace(/\.md$/, "").replace(/_/g, " ");
    const fileMeta = state.reports.find((r) => r.filename === filename);
    if (fileMeta) {
      document.getElementById("viewerTime").innerText = `最后生成于: ${new Date(fileMeta.updatedAt).toLocaleString("zh-CN")}`;
    }

    const contentArea = document.getElementById("reportContentArea");
    if (window.marked) {
      contentArea.innerHTML = window.marked.parse(data.content);
    } else {
      contentArea.innerText = data.content;
    }

    // 更新列表激活状态
    document.querySelectorAll(".report-item-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filename === filename);
    });
  } catch (err) {
    console.error("loadReport error:", err);
  }
}

async function fetchSeeds() {
  try {
    const res = await fetch("/api/seeds");
    const seeds = await res.json();
    state.seeds = seeds;

    document.getElementById("pillSeedsCount").innerText = seeds.length;
    renderSeeds();
  } catch (err) {
    console.error("fetchSeeds error:", err);
  }
}

// ==========================================
// 页面渲染层
// ==========================================

// 1. 渲染爆发新词列表
function renderBreakouts() {
  const container = document.getElementById("breakoutsContainer");
  const stage = state.filters.breakoutStage;
  const cat = state.filters.breakoutCategory;
  const search = state.filters.breakoutSearch.toLowerCase().trim();

  let items = [];

  const { newBreakouts = [], reSurging = [], highGrowthList = [] } = state.breakoutsData;

  if (stage === "all") {
    items.push(...newBreakouts, ...reSurging, ...highGrowthList);
  } else if (stage === "breakout") {
    items.push(...newBreakouts.filter(i => !i.lifecycleStage?.includes("过气")));
  } else if (stage === "resurging") {
    items.push(...reSurging);
  } else if (stage === "highgrowth") {
    items.push(...highGrowthList.filter(i => !i.lifecycleStage?.includes("过气")));
  } else if (stage === "declining") {
    // 专门展示过气/已熄灭/防接盘词汇
    const all = [...newBreakouts, ...reSurging, ...highGrowthList];
    items.push(...all.filter(i => i.lifecycleStage?.includes("过气") || i.currentMomentum?.includes("过气") || i.currentMomentum?.includes("沉睡")));
  }

  // 过滤分类与搜索
  items = items.filter((item) => {
    if (cat !== "all" && item.category !== cat) return false;
    if (search) {
      const matchKw = item.keyword?.toLowerCase().includes(search);
      const matchEntity = item.entityDisplayName?.toLowerCase().includes(search);
      const matchVariant = item.relatedVariants?.some((v) => v.toLowerCase().includes(search));
      const matchAction = item.suggestedAction?.toLowerCase().includes(search);
      if (!matchKw && !matchEntity && !matchVariant && !matchAction) return false;
    }
    return true;
  });

  if (items.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-dim);">
        <p style="font-size: 16px; margin-bottom: 8px;">未找到匹配的爆发新词</p>
        <p style="font-size: 12px;">请尝试调整筛选条件或重置搜索词</p>
      </div>
    `;
    return;
  }

  // 计算最大倍率用于进度条归一化
  const maxRatio = Math.max(...items.map((i) => i.benchmarkRatio || 0), 1);

  container.innerHTML = items.map((item) => {
    let stageClass = "stage-breakout";
    if (item.lifecycleStage?.includes("二次")) stageClass = "stage-resurging";
    else if (item.lifecycleStage?.includes("上升")) stageClass = "stage-highgrowth";
    else if (item.lifecycleStage?.includes("过气")) stageClass = "stage-declining";

    const isMomentumUp = item.currentMomentum?.includes("上升") || item.currentMomentum?.includes("爆发");
    const isDeclining = item.currentMomentum?.includes("回落") || item.currentMomentum?.includes("过气") || item.currentMomentum?.includes("沉睡");
    const momentumClass = isMomentumUp ? "momentum-up" : (isDeclining ? "momentum-down" : "");
    const momentumArrow = isMomentumUp ? "↑" : (isDeclining ? "↓" : "→");

    const escapedKw = escapeHtml(item.keyword).replace(/'/g, "\\'");

    return `
      <div class="breakout-card clickable-card" onclick="openKeywordDetail('${escapedKw}')" title="点击查看 360° 深度诊断与时序画像">
        <div class="card-top">
          <div class="keyword-wrap">
            <h4 class="keyword-text clickable-keyword">
              ${escapeHtml(item.keyword)}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.6;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </h4>
            <div class="entity-subtext">
              <span>母体: <strong>${escapeHtml(item.entityDisplayName || item.entity)}</strong></span>
              <span>·</span>
              <span>${escapeHtml(item.category)}</span>
            </div>
          </div>
          <span class="stage-badge ${stageClass}">${escapeHtml(item.lifecycleStage || "新词爆发")}</span>
        </div>

        <div class="ratio-metric-box">
          <div class="ratio-label-row">
            <span>标尺对齐 (vs GPTs): <strong class="ratio-highlight">${escapeHtml(item.ratioFormatted || "GPTs×" + (item.benchmarkRatio || 0).toFixed(2))}</strong></span>
            <span class="momentum-tag ${momentumClass}">${momentumArrow} ${escapeHtml(item.currentMomentum || "平稳")} (Peak: ${item.peakTarget || 100})</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${percentWidth}%"></div>
          </div>
        </div>

        ${
          item.suggestedAction
            ? `
          <div class="action-advice-box">
            <strong>💡 落地建议:</strong> ${escapeHtml(item.suggestedAction)}
          </div>
        `
            : ""
        }

        <div class="card-bottom-actions">
          <div class="external-links" onclick="event.stopPropagation()">
            <a href="https://trends.google.com/trends/explore?q=${encodeURIComponent(item.keyword)}" target="_blank" class="link-trends" rel="noopener" title="查看关键词真实趋势">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              Google Trends
            </a>
            <a href="${item.trendsExploreUrl || `https://trends.google.com/trends/explore?date=today%201-m&q=${encodeURIComponent(item.keyword)},gpts`}" target="_blank" class="link-serp" rel="noopener" title="对齐 GPTs 黄金标尺对比">
              ⚖️ vs GPTs
            </a>
            <a href="${item.serpUrl || "#"}" target="_blank" class="link-serp" rel="noopener">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              SERP 搜索
            </a>
          </div>

          <span style="font-size: 11px; color: var(--text-dim);">首发: ${escapeHtml(item.firstSeenDate || "近期")}</span>
        </div>
      </div>
    `;
  }).join("");
}

// 2. 渲染流量套利看板
function renderArbitrage() {
  const container = document.getElementById("arbitrageContainer");
  const statusFilter = state.filters.arbitrageStatus;
  const search = state.filters.arbitrageSearch.toLowerCase().trim();

  let items = state.arbitrageData.verified || [];

  items = items.filter((item) => {
    if (statusFilter === "accepted" && item.isActionable !== true) return false;
    if (statusFilter === "declining" && item.isActionable !== false) return false;
    if (search) {
      const matchKw = item.triggerKeyword?.toLowerCase().includes(search);
      const matchName = item.sourceName?.toLowerCase().includes(search);
      const matchDesc = item.description?.toLowerCase().includes(search);
      const matchAction = item.suggestedAction?.toLowerCase().includes(search);
      const matchEmd = item.emdDomainIdeas?.some((d) => d.toLowerCase().includes(search));
      if (!matchKw && !matchName && !matchDesc && !matchAction && !matchEmd) return false;
    }
    return true;
  });

  if (items.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-dim);">
        <p style="font-size: 16px; margin-bottom: 8px;">未找到匹配的套利机会</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map((item) => {
    const isAccepted = item.isActionable === true;
    const verdictClass = isAccepted ? "verdict-accepted" : "verdict-declining";
    const sourcePillClass = item.source === "github" ? "pill-github" : "pill-reddit";

    return `
      <div class="arbitrage-card ${isAccepted ? "" : "is-declining"}">
        <div class="arb-header">
          <div>
            <div style="display:flex; align-items:center; gap: 8px; margin-bottom: 4px;">
              <span class="arb-source-pill ${sourcePillClass}">${escapeHtml(item.source)}</span>
              <a href="${item.sourceUrl}" target="_blank" style="color:var(--text-muted); font-size:12px; text-decoration:none;">
                ${escapeHtml(item.sourceName)} ↗
              </a>
            </div>
            <h3 class="arb-keyword">${escapeHtml(item.triggerKeyword)}</h3>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 11px; color: var(--text-dim);">热度评分</span>
            <div style="font-family: var(--font-mono); font-weight:700; color:var(--amber-primary); font-size: 16px;">
              ${item.demandScore || 100}/100
            </div>
          </div>
        </div>

        <div class="arb-verdict-banner ${verdictClass}">
          <strong>${isAccepted ? "✅ 具备套利价值" : "📉 风险预警"}:</strong> ${escapeHtml(item.verdictRationale || item.trendStatus || "")}
        </div>

        <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5;">
          ${escapeHtml(item.description)}
        </p>

        ${
          item.emdDomainIdeas && item.emdDomainIdeas.length > 0
            ? `
          <div class="emd-domains-box">
            <div class="emd-title">🎯 精准匹配推荐域名 (EMD):</div>
            <div class="emd-tags">
              ${item.emdDomainIdeas.map((domain) => `
                <span class="emd-tag" onclick="copyText('${escapeHtml(domain)}')">
                  ${escapeHtml(domain)}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </span>
              `).join("")}
            </div>
          </div>
        `
            : ""
        }

        ${
          item.suggestedAction
            ? `
          <div class="action-advice-box">
            <strong>🚀 产品化形态:</strong> ${escapeHtml(item.suggestedAction)}
          </div>
        `
            : ""
        }

        ${
          item.liveGoogleSuggestions && item.liveGoogleSuggestions.length > 0
            ? `
          <div>
            <div style="font-size: 11px; color: var(--text-dim); margin-bottom: 4px;">Google 实时下拉长尾联想:</div>
            <div class="suggest-pills">
              ${item.liveGoogleSuggestions.slice(0, 6).map((s) => `
                <span class="suggest-pill">${escapeHtml(s)}</span>
              `).join("")}
            </div>
          </div>
        `
            : ""
        }

        <div class="card-bottom-actions">
          <div class="external-links">
            <a href="${item.trendsUrl30d || "#"}" target="_blank" class="link-trends">
              近30天趋势
            </a>
            <a href="${item.trendsUrl12m || "#"}" target="_blank" class="link-serp">
              12个月大盘
            </a>
            <a href="${item.googleSerpUrl || "#"}" target="_blank" class="link-serp">
              Google 搜索
            </a>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// 3. 渲染多平台数据
function renderPlatforms() {
  // Google Table
  const googleTbody = document.getElementById("googleTableBody");
  const googleItems = state.platformsData.google || [];

  if (googleItems.length === 0) {
    googleTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-dim);">暂无 Google Trending 原始数据</td></tr>`;
  } else {
    googleTbody.innerHTML = googleItems.map((item) => `
      <tr>
        <td style="font-weight: 700; color: #fff;">${escapeHtml(item.title)}</td>
        <td><span class="badge-amber" style="padding: 2px 8px; border-radius: var(--radius-full); font-size: 11px;">🔥 ${escapeHtml(item.traffic)}</span></td>
        <td style="color: var(--text-dim); font-size: 12px;">${escapeHtml(item.pubDate)}</td>
        <td><span style="font-size: 11px; color: var(--cyan-primary);">Google US RSS</span></td>
        <td>
          <a href="https://trends.google.com/trends/explore?date=today%201-m&q=${encodeURIComponent(item.title)}" target="_blank" style="color: var(--cyan-primary); text-decoration: none; font-size: 12px;">
            趋势分析 ↗
          </a>
        </td>
      </tr>
    `).join("");
  }

  // GitHub Grid
  const githubContainer = document.getElementById("githubContainer");
  const repos = state.platformsData.github || [];

  if (repos.length === 0) {
    githubContainer.innerHTML = `<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-dim);">暂无 GitHub 抓取数据</div>`;
  } else {
    githubContainer.innerHTML = repos.slice(0, 30).map((r) => `
      <div class="repo-card">
        <div class="repo-header">
          <a href="${r.html_url}" target="_blank" class="repo-name">${escapeHtml(r.name)}</a>
          <span class="repo-stars">★ ${r.stars}</span>
        </div>
        <p class="repo-desc">${escapeHtml(r.description || "暂无项目描述")}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-dim);">
          <span>语言: <strong style="color: #cbd5e1;">${escapeHtml(r.language || "Other")}</strong></span>
          <span>更新: ${escapeHtml((r.updated_at || "").split("T")[0])}</span>
        </div>
      </div>
    `).join("");
  }

  // Reddit Grid
  const redditContainer = document.getElementById("redditContainer");
  const posts = state.platformsData.reddit || [];

  if (posts.length === 0) {
    redditContainer.innerHTML = `<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-dim);">暂无 Reddit 抓取数据</div>`;
  } else {
    redditContainer.innerHTML = posts.slice(0, 30).map((p) => `
      <div class="reddit-card">
        <div style="display:flex; justify-content:space-between; font-size: 11px;">
          <span style="color: #ff6b3d; font-weight:600;">r/${escapeHtml(p.subreddit)}</span>
          <span style="color: var(--text-dim);">▲ ${p.score || 0} · 💬 ${p.num_comments || 0}</span>
        </div>
        <a href="${p.permalink}" target="_blank" class="reddit-title">${escapeHtml(p.title)}</a>
        ${p.selftext ? `<p style="font-size:12px; color:var(--text-muted); line-height:1.4;">${escapeHtml(p.selftext.slice(0, 150))}...</p>` : ""}
      </div>
    `).join("");
  }

  // TikTok Table
  const tiktokTbody = document.getElementById("tiktokTableBody");
  const tiktokItems = state.platformsData.tiktok || [];

  if (tiktokTbody) {
    if (tiktokItems.length === 0) {
      tiktokTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-dim);">暂无 TikTok 视频/特效雷达数据 (点击上方一键扫描触发)</td></tr>`;
    } else {
      tiktokTbody.innerHTML = tiktokItems.slice(0, 60).map((item) => `
        <tr>
          <td style="font-weight: 700; color: #fff;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#00f2fe; box-shadow:0 0 8px #00f2fe;"></span>
              <span>${escapeHtml(item.keyword)}</span>
            </div>
          </td>
          <td><span class="badge-blue" style="padding: 2px 8px; border-radius: var(--radius-full); font-size: 11px;">${escapeHtml(item.category)}</span></td>
          <td><strong style="color: var(--cyan-primary); font-family: monospace;">${item.demandScore} / 100</strong></td>
          <td><span class="badge-emerald" style="padding: 2px 8px; border-radius: var(--radius-full); font-size: 11px;">⚡ ${escapeHtml(item.growthTag)}</span></td>
          <td style="color: #cbd5e1; font-size: 12px; max-width: 260px;">${escapeHtml(item.suggestedAction)}</td>
          <td style="font-family: monospace; font-size: 11px; color: #a5b4fc;">${(item.emdDomainIdeas || []).slice(0, 2).map(d => `<span style="background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px; margin-right:4px;">${escapeHtml(d)}</span>`).join("")}</td>
          <td>
            <a href="${item.trendsUrl}" target="_blank" style="color: var(--cyan-primary); text-decoration: none; font-size: 12px; margin-right: 8px;">Trends ↗</a>
            <a href="${item.serpUrl}" target="_blank" style="color: var(--text-dim); text-decoration: none; font-size: 12px;">SERP ↗</a>
          </td>
        </tr>
      `).join("");
    }
  }

  // Toolify Table
  const toolifyTbody = document.getElementById("toolifyTableBody");
  const toolifyItems = state.platformsData.toolify || [];

  if (toolifyTbody) {
    if (toolifyItems.length === 0) {
      toolifyTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-dim);">暂无 Toolify 黑马情报 (可运行 npm run fetch:toolify 触发)</td></tr>`;
    } else {
      toolifyTbody.innerHTML = toolifyItems.map((item) => `
        <tr>
          <td style="font-weight: 700; color: #fff;">
            <div style="margin-bottom: 4px;">
              <a href="${item.toolifyUrl}" target="_blank" style="color:#60a5fa; text-decoration:none; font-weight:700;">
                ${escapeHtml(item.toolName)} ↗
              </a>
            </div>
            <div>
              <span class="${item.isBlackHorse ? 'badge-rose' : 'badge-emerald'}" style="padding: 2px 8px; border-radius: var(--radius-full); font-size: 11px;">
                ${escapeHtml(item.growthStage || (item.isBlackHorse ? '🔥 突变黑马' : '⚡ 初发新星'))}
              </span>
            </div>
          </td>
          <td>
            <div style="font-weight: 600; color: #f1f5f9; font-size: 12px; margin-bottom: 3px;">
              <span class="badge-blue" style="padding: 1px 6px; border-radius: 4px; font-size: 10px;">${escapeHtml(item.category || "垂直工具")}</span>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); line-height: 1.3;">
              ${escapeHtml(item.coreFeature || "特定场景轻量化解决痛点")}
            </div>
          </td>
          <td>
            <div style="font-size: 11px; color: #fbbf24; margin-bottom: 3px;">
              💰 ${escapeHtml(item.monetizationPoint || "免广告会员 / 订阅")}
            </div>
            <div>
              <strong style="color: var(--cyan-primary); font-family: monospace; font-size: 12px;">Google 需求: ${item.demandScore || 0}/100</strong>
            </div>
          </td>
          <td style="font-size: 12px; color: #e2e8f0; line-height: 1.4;">
            <div style="background: rgba(59, 130, 246, 0.08); border-left: 2px solid #3b82f6; padding: 4px 8px; border-radius: 4px;">
              ${escapeHtml(item.verticalOpportunity || "拆解为极简一键单功能页面")}
            </div>
          </td>
          <td style="font-size: 12px; color: #e2e8f0; line-height: 1.4;">
            <div style="font-size: 11px; color: #a5b4fc; margin-bottom: 3px;">
              ${(item.topGeos || []).slice(0, 3).map(g => `<span style="background:rgba(255,255,255,0.06); padding:1px 5px; border-radius:3px; margin-right:3px;">${escapeHtml(g)}</span>`).join("")}
            </div>
            <div style="font-size: 11px; color: #94a3b8; line-height: 1.3;">
              ${escapeHtml(item.localOpportunity || "搭建小语种单页避开欧美红海")}
            </div>
          </td>
          <td style="font-family: monospace; font-size: 11px; color: #a5b4fc;">
            ${(item.emdDomainIdeas || []).slice(0, 2).map(d => `<div style="background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px; margin-bottom:3px;">${escapeHtml(d)}</div>`).join("")}
          </td>
          <td>
            <a href="${item.trendsUrl}" target="_blank" style="color: var(--cyan-primary); text-decoration: none; font-size: 12px; display:block; margin-bottom:4px;">Trends ↗</a>
            <a href="${item.serpUrl}" target="_blank" style="color: var(--text-dim); text-decoration: none; font-size: 12px; display:block;">SERP ↗</a>
          </td>
        </tr>
      `).join("");
    }
  }

  // YouTube Shorts & Trending Table
  const youtubeTbody = document.getElementById("youtubeTableBody");
  const youtubeItems = state.platformsData.youtube || [];

  if (youtubeTbody) {
    if (youtubeItems.length === 0) {
      youtubeTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-dim);">暂无 YouTube Shorts/Trending 数据 (可运行 npm run fetch:youtube 触发)</td></tr>`;
    } else {
      youtubeTbody.innerHTML = youtubeItems.slice(0, 60).map((item) => {
        const isShorts = item.sourceType === "shorts" || item.sourceType === "shorts_keyword";
        return `
        <tr>
          <td style="font-weight: 700; color: #fff; max-width: 280px;">
            <div style="margin-bottom: 4px;">
              <a href="${item.url}" target="_blank" style="color:#ef4444; text-decoration:none; font-weight:700;">
                ▶ ${escapeHtml(item.title)} ↗
              </a>
            </div>
            <div style="font-size: 11px; color: #94a3b8;">
              来源: ${escapeHtml(item.channelOrAuthor || "YouTube")}
            </div>
          </td>
          <td>
            <span class="${isShorts ? 'badge-rose' : 'badge-blue'}" style="padding: 2px 8px; border-radius: var(--radius-full); font-size: 11px;">
              ${isShorts ? '🔥 Shorts' : '📹 视频/热词'}
            </span>
          </td>
          <td style="color: #cbd5e1; font-size: 12px;">${escapeHtml(item.channelOrAuthor || "YouTube")}</td>
          <td><strong style="color: #38bdf8; font-family: monospace;">${escapeHtml(item.extractedKeyword)}</strong></td>
          <td><strong style="color: var(--cyan-primary); font-family: monospace;">${item.demandScore || 85} / 100</strong></td>
          <td style="font-family: monospace; font-size: 11px; color: #a5b4fc;">
            ${(item.emdDomainIdeas || []).slice(0, 2).map(d => `<span style="background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px; margin-right:4px;">${escapeHtml(d)}</span>`).join("")}
          </td>
          <td style="color: #cbd5e1; font-size: 12px; max-width: 220px;">
            ${escapeHtml(item.suggestedAction)}
          </td>
        </tr>
      `;
      }).join("");
    }
  }

  // Twitter/X AI KOL Table
  const twitterTbody = document.getElementById("twitterTableBody");
  const twitterItems = state.platformsData.twitter || [];

  if (twitterTbody) {
    if (twitterItems.length === 0) {
      twitterTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-dim);">暂无 Twitter/X KOL 动态情报 (可运行 npm run fetch:twitter 触发)</td></tr>`;
    } else {
      twitterTbody.innerHTML = twitterItems.slice(0, 50).map((item) => `
        <tr>
          <td style="font-weight: 700; color: #fff;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size: 16px;">𝕏</span>
              <div>
                <a href="${item.tweetUrl}" target="_blank" style="color:#38bdf8; text-decoration:none; font-weight:700;">
                  @${escapeHtml(item.handle)} ↗
                </a>
                <div style="font-size: 11px; color: #94a3b8;">${escapeHtml(item.authorName)}</div>
              </div>
            </div>
          </td>
          <td style="font-size: 12px; color: #e2e8f0; max-width: 180px;">${escapeHtml(item.authorBio?.slice(0, 60))}</td>
          <td style="font-size: 12px; color: #f1f5f9; max-width: 280px; line-height: 1.4;">
            ${escapeHtml(item.tweetTitle)}
          </td>
          <td>
            ${(item.extractedKeywords || []).map(k => `<span class="badge-emerald" style="padding: 1px 6px; border-radius: 4px; font-size: 11px; margin-right: 3px;">${escapeHtml(k)}</span>`).join("") || '<span style="color:#64748b; font-size:11px;">无新实体</span>'}
          </td>
          <td><strong style="color: #f59e0b; font-family: monospace;">★ ${item.impactScore}</strong></td>
          <td>
            <span class="badge-blue" style="padding: 2px 6px; border-radius: 4px; font-size: 10px;">
              ${item.captureChannel === 'nitter_mirror' ? 'Nitter镜像' : (item.captureChannel === 'realtime_x_mention' ? '全网推文流' : '开放元数据')}
            </span>
          </td>
          <td style="color: #cbd5e1; font-size: 12px; max-width: 220px;">
            <div style="margin-bottom: 4px;">${escapeHtml(item.suggestedAction)}</div>
            <a href="${item.tweetUrl}" target="_blank" style="color: #60a5fa; text-decoration: none; font-size: 11px;">查看推文 ↗</a>
          </td>
        </tr>
      `).join("");
    }
  }

  // 免费托管新站雷达 (Vercel / GitHub.io / Pages.dev)
  const hostedTbody = document.getElementById("hostedTableBody");
  const hostedItems = state.platformsData.hosted || [];
  if (hostedTbody) {
    if (hostedItems.length === 0) {
      hostedTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-dim);">暂无托管新站数据 (可运行 npm run fetch:hosted 触发)</td></tr>`;
    } else {
      hostedTbody.innerHTML = hostedItems.slice(0, 100).map((item) => `
        <tr>
          <td style="font-weight: 700; color: #fff;">
            <a href="${item.domain}" target="_blank" style="color: var(--cyan-primary); text-decoration: none; font-size: 13px;">
              ${escapeHtml(item.title || item.domain)} ↗
            </a>
            <div style="font-size: 11px; color: #94a3b8; font-family: monospace;">${escapeHtml(item.domain)}</div>
          </td>
          <td>
            <span class="badge-blue" style="padding: 2px 8px; border-radius: 4px; font-size: 11px;">
              ${item.platform === 'vercel' ? '▲ Vercel' : (item.platform === 'cloudflare' ? '☁ Cloudflare' : '🐙 GitHub')}
            </span>
          </td>
          <td style="font-size: 12px; color: #cbd5e1; max-width: 260px; line-height: 1.4;">
            ${escapeHtml(item.description)}
          </td>
          <td>
            ${(item.extractedKeywords || []).map(k => `<span class="badge-emerald" style="padding: 1px 6px; border-radius: 4px; font-size: 11px; margin-right: 3px;">${escapeHtml(k)}</span>`).join("")}
          </td>
          <td style="font-size: 11px; color: #94a3b8; font-family: monospace;">
            ${item.firstSeenAt ? new Date(item.firstSeenAt).toLocaleDateString() : '近期'}
          </td>
          <td>
            <a href="${item.domain}" target="_blank" style="color: #38bdf8; text-decoration: none; font-size: 12px; display:block; margin-bottom:2px;">访问站点 ↗</a>
            <a href="${item.sourceUrl}" target="_blank" style="color: #64748b; text-decoration: none; font-size: 11px; display:block;">来源代码/搜索 ↗</a>
          </td>
        </tr>
      `).join("");
    }
  }

  // Hacker News 创客新站雷达
  const hnTbody = document.getElementById("hnTableBody");
  const hnItems = state.platformsData.hn || [];
  if (hnTbody) {
    if (hnItems.length === 0) {
      hnTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-dim);">暂无 HN 创客新站数据 (可运行 npm run fetch:hn 触发)</td></tr>`;
    } else {
      hnTbody.innerHTML = hnItems.slice(0, 100).map((item) => `
        <tr>
          <td style="font-weight: 700; color: #fff;">
            <a href="${item.url}" target="_blank" style="color: #fb923c; text-decoration: none; font-size: 13px;">
              ${escapeHtml(item.title)} ↗
            </a>
          </td>
          <td style="font-size: 12px; color: #94a3b8;">${escapeHtml(item.author)}</td>
          <td>
            <span style="color: #f59e0b; font-weight:700; font-size:12px;">▲ ${item.points}</span>
            <span style="color: #64748b; font-size:11px; margin-left:6px;">💬 ${item.commentsCount}</span>
          </td>
          <td style="font-size: 12px; color: #cbd5e1; max-width: 260px; line-height: 1.4;">
            <div style="background: rgba(249, 115, 22, 0.08); border-left: 2px solid #f97316; padding: 4px 8px; border-radius: 4px;">
              ${escapeHtml(item.painPointSummary)}
            </div>
          </td>
          <td>
            ${(item.extractedKeywords || []).map(k => `<span class="badge-cyan" style="padding: 1px 6px; border-radius: 4px; font-size: 11px; margin-right: 3px;">${escapeHtml(k)}</span>`).join("")}
          </td>
          <td>
            <a href="${item.url}" target="_blank" style="color: #38bdf8; text-decoration: none; font-size: 12px; display:block; margin-bottom:2px;">产品官网 ↗</a>
            <a href="${item.hnUrl}" target="_blank" style="color: #fb923c; text-decoration: none; font-size: 11px; display:block;">HN 讨论区 ↗</a>
          </td>
        </tr>
      `).join("");
    }
  }
}

// 4. 渲染研报列表
function renderReportsList() {
  const container = document.getElementById("reportsList");
  const list = state.reports;

  if (list.length === 0) {
    container.innerHTML = `<div style="padding: 20px; text-align:center; color: var(--text-dim);">未发现已生成的研报</div>`;
    return;
  }

  container.innerHTML = list.map((r) => `
    <button class="report-item-btn" data-filename="${r.filename}">
      <div class="report-item-title">${escapeHtml(r.title)}</div>
      <div class="report-item-meta">
        ${(r.sizeBytes / 1024).toFixed(1)} KB · ${new Date(r.updatedAt).toLocaleDateString("zh-CN")}
      </div>
    </button>
  `).join("");

  // 绑定点击事件
  container.querySelectorAll(".report-item-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      loadReport(btn.dataset.filename);
    });
  });
}

// 5. 渲染实体种子库
function renderSeeds() {
  const container = document.getElementById("seedsContainer");
  const cat = state.filters.seedCategory;
  const search = state.filters.seedSearch.toLowerCase().trim();

  let seeds = state.seeds || [];
  seeds = seeds.filter((s) => {
    if (cat !== "all" && s.category !== cat) return false;
    if (search) {
      const matchName = s.displayName?.toLowerCase().includes(search);
      const matchEnt = s.entity?.toLowerCase().includes(search);
      const matchDesc = s.description?.toLowerCase().includes(search);
      if (!matchName && !matchEnt && !matchDesc) return false;
    }
    return true;
  });

  if (seeds.length === 0) {
    container.innerHTML = `<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-dim);">未找到匹配的实体种子</div>`;
    return;
  }

  container.innerHTML = seeds.map((s) => `
    <div class="seed-card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h4 class="seed-title">${escapeHtml(s.displayName)}</h4>
        <span class="badge-cyan" style="font-size:10px; padding:2px 6px; border-radius: var(--radius-full);">${escapeHtml(s.category)}</span>
      </div>
      <div style="font-size: 11px; color: var(--text-dim); font-family: var(--font-mono);">
        Entity Key: ${escapeHtml(s.entity)}
      </div>
      <p class="seed-desc">${escapeHtml(s.description)}</p>
      <div class="seed-action">
        💡 建议动作: ${escapeHtml(s.suggestedActionType || "提示词/小工具")}
      </div>
    </div>
  `).join("");
}

// ==========================================
// 辅助函数
// ==========================================
function escapeHtml(str) {
  if (typeof str !== "string") return str == null ? "" : String(str);
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

window.copyText = function (text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`已复制: ${text}`);
  }).catch(() => {
    showToast("复制失败");
  });
};

// ==========================================
// 事件绑定与交互逻辑
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  setupSSE();
  fetchStreamData();
  fetchOverview();
  fetchBreakouts();
  fetchArbitrage();
  fetchPlatforms();
  fetchReports();
  fetchSeeds();

  // 0. 刷新动态流
  document.getElementById("btnRefreshStream")?.addEventListener("click", () => {
    showToast("正在拉取最新动态流...");
    fetchStreamData();
  });

  // 通用 Tab 切换函数
  window.switchTab = function(tabId, subtabId = null) {
    document.querySelectorAll(".nav-tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));

    const targetTabBtn = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
    if (targetTabBtn) targetTabBtn.classList.add("active");

    const targetPane = document.getElementById(tabId);
    if (targetPane) targetPane.classList.add("active");
    state.activeTab = tabId;

    if (subtabId) {
      document.querySelectorAll(".subtab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".subtab-pane").forEach((p) => p.classList.remove("active"));
      const subBtn = document.querySelector(`.subtab-btn[data-subtab="${subtabId}"]`);
      if (subBtn) subBtn.classList.add("active");
      const subPane = document.getElementById(subtabId);
      if (subPane) subPane.classList.add("active");
    }
  };

  // 0.1 顶部 KPI 卡片点击直达对应结果
  document.getElementById("cardKpiBreakouts")?.addEventListener("click", () => {
    window.switchTab("tab-breakouts");
    document.querySelectorAll("[data-stage]").forEach((c) => c.classList.remove("active"));
    const chip = document.querySelector('[data-stage="breakout"]');
    if (chip) chip.classList.add("active");
    state.filters.breakoutStage = "breakout";
    renderBreakouts();
    document.getElementById("tab-breakouts")?.scrollIntoView({ behavior: "smooth" });
    showToast("已直达【首次爆发新词】结果列表");
  });

  document.getElementById("cardKpiReSurging")?.addEventListener("click", () => {
    window.switchTab("tab-breakouts");
    document.querySelectorAll("[data-stage]").forEach((c) => c.classList.remove("active"));
    const chip = document.querySelector('[data-stage="resurging"]');
    if (chip) chip.classList.add("active");
    state.filters.breakoutStage = "resurging";
    renderBreakouts();
    document.getElementById("tab-breakouts")?.scrollIntoView({ behavior: "smooth" });
    showToast("已直达【老词二次爆火】结果列表");
  });

  document.getElementById("cardKpiArbitrage")?.addEventListener("click", () => {
    window.switchTab("tab-arbitrage");
    document.getElementById("tab-arbitrage")?.scrollIntoView({ behavior: "smooth" });
    showToast("已直达【流量套利与产品机会】看板");
  });

  document.getElementById("cardKpiEntities")?.addEventListener("click", () => {
    window.switchTab("tab-seeds");
    document.getElementById("tab-seeds")?.scrollIntoView({ behavior: "smooth" });
    showToast("已直达【核心实体种子库】");
  });

  document.getElementById("cardKpiMultiSource")?.addEventListener("click", () => {
    window.switchTab("tab-platforms");
    document.getElementById("tab-platforms")?.scrollIntoView({ behavior: "smooth" });
    showToast("已直达【多源监控实时情报】");
  });

  // 0.2 三大板块卡片点击直达
  document.getElementById("cardStreamKeywordDb")?.addEventListener("click", (e) => {
    // 若点击的是具体小列，不重复触发
    if (e.target.closest("#colStreamKwToday") || e.target.closest("#colStreamKwResurging") || e.target.closest("#colStreamKwTotal")) return;
    document.getElementById("streamBatchesContainer")?.scrollIntoView({ behavior: "smooth" });
    showToast("已向下平滑滚动至【更新动态】时间轴");
  });

  document.getElementById("colStreamKwToday")?.addEventListener("click", () => {
    window.switchTab("tab-breakouts");
    document.querySelectorAll("[data-stage]").forEach((c) => c.classList.remove("active"));
    const chip = document.querySelector('[data-stage="breakout"]');
    if (chip) chip.classList.add("active");
    state.filters.breakoutStage = "breakout";
    renderBreakouts();
    document.getElementById("tab-breakouts")?.scrollIntoView({ behavior: "smooth" });
    showToast("已直达【今日新词首次爆发】列表");
  });

  document.getElementById("colStreamKwResurging")?.addEventListener("click", () => {
    window.switchTab("tab-breakouts");
    document.querySelectorAll("[data-stage]").forEach((c) => c.classList.remove("active"));
    const chip = document.querySelector('[data-stage="resurging"]');
    if (chip) chip.classList.add("active");
    state.filters.breakoutStage = "resurging";
    renderBreakouts();
    document.getElementById("tab-breakouts")?.scrollIntoView({ behavior: "smooth" });
    showToast("已直达【老词二次爆火】列表");
  });

  document.getElementById("colStreamKwTotal")?.addEventListener("click", () => {
    window.switchTab("tab-breakouts");
    document.querySelectorAll("[data-stage]").forEach((c) => c.classList.remove("active"));
    const chip = document.querySelector('[data-stage="all"]');
    if (chip) chip.classList.add("active");
    state.filters.breakoutStage = "all";
    renderBreakouts();
    document.getElementById("tab-breakouts")?.scrollIntoView({ behavior: "smooth" });
    showToast("已直达【全部标尺量化词库】");
  });

  document.getElementById("cardStreamHn")?.addEventListener("click", () => {
    window.switchTab("tab-platforms", "subtab-hn");
    document.getElementById("tab-platforms")?.scrollIntoView({ behavior: "smooth" });
    showToast("已直达【HN 创客新站与痛点雷达】");
  });

  document.getElementById("cardStreamHosted")?.addEventListener("click", () => {
    window.switchTab("tab-platforms", "subtab-hosted");
    document.getElementById("tab-platforms")?.scrollIntoView({ behavior: "smooth" });
    showToast("已直达【托管新站雷达 (Vercel/Pages)】");
  });

  // 1. Tab 切换
  document.querySelectorAll(".nav-tab").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      window.switchTab(tabBtn.dataset.tab);
    });
  });

  // 2. 多平台子 Tab 切换
  document.querySelectorAll(".subtab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".subtab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".subtab-pane").forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.subtab);
      if (target) target.classList.add("active");
    });
  });

  // 3. Breakouts 筛选
  document.querySelectorAll("[data-stage]").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("[data-stage]").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.filters.breakoutStage = chip.dataset.stage;
      renderBreakouts();
    });
  });

  document.getElementById("breakoutCategorySelect")?.addEventListener("change", (e) => {
    state.filters.breakoutCategory = e.target.value;
    renderBreakouts();
  });

  document.getElementById("breakoutSearchInput")?.addEventListener("input", (e) => {
    state.filters.breakoutSearch = e.target.value;
    renderBreakouts();
  });

  // 4. Arbitrage 筛选
  document.querySelectorAll("[data-arb-status]").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("[data-arb-status]").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.filters.arbitrageStatus = chip.dataset.arbStatus;
      renderArbitrage();
    });
  });

  document.getElementById("arbitrageSearchInput")?.addEventListener("input", (e) => {
    state.filters.arbitrageSearch = e.target.value;
    renderArbitrage();
  });

  // 5. 实体库筛选
  document.getElementById("seedCategorySelect")?.addEventListener("change", (e) => {
    state.filters.seedCategory = e.target.value;
    renderSeeds();
  });

  document.getElementById("seedSearchInput")?.addEventListener("input", (e) => {
    state.filters.seedSearch = e.target.value;
    renderSeeds();
  });

  // 6. 刷新按钮
  document.getElementById("btnRefresh")?.addEventListener("click", () => {
    showToast("正在重新同步最新数据...");
    fetchStreamData();
    fetchOverview();
    fetchBreakouts();
    fetchArbitrage();
    fetchPlatforms();
    fetchReports();
    fetchSeeds();
  });

  // 7. 扫描模态框控制
  const scanModal = document.getElementById("scanModal");
  document.getElementById("btnOpenScanModal")?.addEventListener("click", () => {
    scanModal.classList.add("active");
  });
  document.getElementById("btnCloseScanModal")?.addEventListener("click", () => {
    scanModal.classList.remove("active");
  });
  document.getElementById("btnCancelScan")?.addEventListener("click", () => {
    scanModal.classList.remove("active");
  });

  // 选项单选高亮
  document.querySelectorAll(".pipeline-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".pipeline-option").forEach((o) => o.classList.remove("active"));
      opt.classList.add("active");
      const radio = opt.querySelector("input[type='radio']");
      if (radio) radio.checked = true;
    });
  });

  // 确认启动扫描
  document.getElementById("btnConfirmScan")?.addEventListener("click", async () => {
    const checkedRadio = document.querySelector("input[name='pipelineChoice']:checked");
    const pipeline = checkedRadio ? checkedRadio.value : "newtrend";

    scanModal.classList.remove("active");
    openTerminalDrawer();

    appendTerminalLog(`[系统通知] 🚀 正在请求启动扫描流水线 (${pipeline})...`);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline })
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message || "扫描指令已发送");
        if (data.isVercel && data.dispatched) {
          updateScanningStatus(true, "GitHub Actions 云端巡航");
          const badge = document.getElementById("terminalStatusBadge");
          if (badge) badge.innerText = "CLOUD RUNNING";

          appendTerminalLog(`[系统通知] 🚀 已成功远程调用 GitHub API 触发 Actions 巡航流水线！`);
          if (data.actionUrl) {
            appendTerminalLog(`[系统通知] 🔗 <a href="${data.actionUrl}" target="_blank" style="color:var(--cyan-primary);text-decoration:underline;">点击进入 GitHub Actions 控制台查看实时构建日志 &gt;</a>`);
          }
          appendTerminalLog(`[系统通知] ⏳ 预计耗时约 5~10 分钟。云端执行完毕后将自动提交数据至 main 分支并触发 Vercel 自动重载，届时刷新此页面即可！`);
        }
      } else {
        if (data.needConfig) {
          showToast("云端一键触发需要配置 GH_PAT");
          appendTerminalLog(`[系统通知] ⚠️ 云端一键触发需要配置 GitHub 密钥：`);
          appendTerminalLog(`  1. 打开 GitHub Settings -> Developer Settings -> Personal access tokens (classic) 生成含 workflow 权限的 Token`);
          appendTerminalLog(`  2. 在 Vercel 控制台 -> Settings -> Environment Variables 添加两个环境变量：`);
          appendTerminalLog(`     • <b>GH_PAT</b> = (您刚刚生成的 Token)`);
          appendTerminalLog(`     • <b>GH_REPO</b> = bshx2024/TrendSpy`);
          if (data.actionUrl) {
            appendTerminalLog(`  3. 🔗 或者现在直接手动运行: <a href="${data.actionUrl}" target="_blank" style="color:var(--cyan-primary);text-decoration:underline;">进入 GitHub Actions 点击 Run workflow</a>`);
          }
        } else {
          showToast(`启动失败: ${data.error || "未知原因"}`);
          appendTerminalLog(`[-] 启动失败: ${data.error || "未知原因"}`);
          if (data.actionUrl) {
            appendTerminalLog(`[系统通知] 🔗 您仍可手动运行: <a href="${data.actionUrl}" target="_blank" style="color:var(--cyan-primary);text-decoration:underline;">点击前往 GitHub Actions</a>`);
          }
        }
      }
    } catch (err) {
      showToast("启动流水线请求失败");
      appendTerminalLog(`[-] 启动请求网络异常: ${err.message}`);
    }
  });

  // 8. 实时控制台抽屉控制
  const terminalDrawer = document.getElementById("terminalDrawer");
  function openTerminalDrawer() {
    terminalDrawer.classList.add("open");
  }
  function closeTerminalDrawer() {
    terminalDrawer.classList.remove("open");
  }

  document.getElementById("btnOpenLogs")?.addEventListener("click", () => {
    terminalDrawer.classList.toggle("open");
  });
  document.getElementById("btnCloseDrawer")?.addEventListener("click", closeTerminalDrawer);
  document.getElementById("btnClearLogs")?.addEventListener("click", () => {
    document.getElementById("terminalLogArea").innerHTML = `<div class="log-line system">[控制台已清屏]</div>`;
  });

  // 9. 手动终止扫描
  document.getElementById("btnStopScan")?.addEventListener("click", async () => {
    if (confirm("确定要强行终止当前流水线任务吗？")) {
      try {
        const res = await fetch("/api/scan/stop", { method: "POST" });
        const data = await res.json();
        showToast(data.message || "已发送终止信号");
      } catch (err) {
        showToast("终止请求失败");
      }
    }
  });

  // 10. 复制研报
  document.getElementById("btnCopyReport")?.addEventListener("click", () => {
    if (state.activeReport?.content) {
      copyText(state.activeReport.content);
    } else {
      showToast("当前暂无研报内容");
    }
  });

  // 11. 关键词 360° 深度详情模态框关闭事件
  const detailModal = document.getElementById("keywordDetailModal");
  function closeDetailModal() {
    if (detailModal) {
      detailModal.style.display = "none";
      detailModal.classList.remove("active");
    }
  }
  document.getElementById("btnCloseDetailModal")?.addEventListener("click", closeDetailModal);
  document.getElementById("btnDetailCloseFooter")?.addEventListener("click", closeDetailModal);
  detailModal?.addEventListener("click", (e) => {
    if (e.target === detailModal) closeDetailModal();
  });
});

// ==========================================
// 关键词 360° 深度诊断模态触发与渲染函数
// ==========================================
window.openKeywordDetail = async function (keyword) {
  console.log("Opening detail for keyword:", keyword);
  const modal = document.getElementById("keywordDetailModal");
  if (!modal) {
    console.error("keywordDetailModal not found!");
    return;
  }

  // 重置初始内容并展示 Loading
  modal.style.display = "flex";
  modal.classList.add("active");
  document.getElementById("modalKeywordTitle").innerText = keyword;
  document.getElementById("modalLifecycleBadge").innerText = "诊断中...";
  document.getElementById("modalRatioVal").innerText = "...";
  document.getElementById("modalFirstSeen").innerText = "...";
  document.getElementById("modalBreakoutDate").innerText = "...";
  document.getElementById("modalMomentumVal").innerText = "...";
  document.getElementById("modalCategoryVal").innerText = "...";
  document.getElementById("modalEntitySub").innerText = "...";
  document.getElementById("modalWhatIsIt").innerText = "正在查询全球数据库与实时 SERP 竞争格局...";
  document.getElementById("modalUserIntent").innerText = "正在逆向搜索意图与需求痛点...";
  document.getElementById("modalActionSuggestion").innerText = "正在生成最佳套利与出海落地路径...";
  document.getElementById("modalSerpSummary").innerText = "正在扫描 Google 前两页排名站点...";
  document.getElementById("modalSerpDominantDomains").innerHTML = "";
  document.getElementById("modalLongtailContainer").innerHTML = "";

  try {
    const res = await fetch(`/api/keyword-detail/${encodeURIComponent(keyword)}`);
    if (!res.ok) throw new Error("获取详情失败");
    const d = await res.json();

    // 填充顶部指标
    document.getElementById("modalKeywordTitle").innerText = d.keyword;
    document.getElementById("modalLifecycleBadge").innerText = d.lifecycleStage;
    document.getElementById("modalFeasibilityBadge").innerText = d.feasibility?.opportunityLevel || "良好机会";
    document.getElementById("modalRatioVal").innerText = d.benchmarkRatioFormatted;
    document.getElementById("modalFirstSeen").innerText = d.firstSeenDate || "近期";
    document.getElementById("modalBreakoutDate").innerText = d.breakoutDate || "近期";
    document.getElementById("modalMomentumVal").innerText = d.currentMomentum || "上升中";
    document.getElementById("modalCategoryVal").innerText = d.category;
    document.getElementById("modalEntitySub").innerText = `归属: ${d.entityDisplayName}`;

    // 填充三段式业务诊断
    document.getElementById("modalWhatIsIt").innerText = d.analysis?.whatIsIt || "--";
    document.getElementById("modalUserIntent").innerText = d.analysis?.userIntent || "--";
    document.getElementById("modalActionSuggestion").innerText = d.analysis?.actionSuggestion || "--";

    // 填充 SERP 前两页竞争
    const f = d.feasibility || {};
    document.getElementById("modalSerpDifficultyText").innerText = `竞争难度分: ${f.difficultyScore}/100 · ${f.opportunityLevel}`;
    document.getElementById("modalSerpSummary").innerText = f.summaryNote || "前排竞争格局扫描完毕";
    const domBox = document.getElementById("modalSerpDominantDomains");
    domBox.innerHTML = (f.dominantDomains || []).map(dom => {
      const isIndie = dom.includes("vercel") || dom.includes("github.io") || dom.includes("pages.dev");
      return `<span style="background:${isIndie ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)'}; border:1px solid ${isIndie ? '#10b981' : 'rgba(255,255,255,0.1)'}; color:${isIndie ? '#34d399' : '#94a3b8'}; padding:2px 8px; border-radius:4px; font-size:11px; font-family:monospace;">${escapeHtml(dom)}${isIndie ? ' (★独立小站)' : ''}</span>`;
    }).join("");

    // 填充内页长尾词
    const ltBox = document.getElementById("modalLongtailContainer");
    const longtails = d.longTailKeywords || [];
    if (longtails.length === 0) {
      ltBox.innerHTML = `<span style="color:#64748b; font-size:12px;">暂无扩展长尾词</span>`;
    } else {
      ltBox.innerHTML = longtails.map(lt => `
        <span class="longtail-pill" onclick="openKeywordDetail('${escapeHtml(lt).replace(/'/g, "\\'")}')" title="点击下钻查看该长尾词详情">
          + ${escapeHtml(lt)}
        </span>
      `).join("");
    }

    // 链接
    document.getElementById("modalLinkTrends").href = d.trendsUrl;
    document.getElementById("modalLinkSerp").href = d.serpUrl;

    // 绘制时序图
    renderModalSvgChart(d.historyPoints || []);

  } catch (err) {
    document.getElementById("modalWhatIsIt").innerText = `加载失败: ${err.message}`;
  }
};

// 绘制轻量 SVG 趋势折线图
function renderModalSvgChart(points) {
  const container = document.getElementById("modalSvgChartContainer");
  if (!container || points.length === 0) return;

  const w = container.clientWidth || 800;
  const h = 130;
  const pad = 25;

  const maxVal = Math.max(...points.map(p => p.value), 10);
  const minVal = 0;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p.value - minVal) / (maxVal - minVal)) * (h - pad * 2);
    return { x, y, date: p.date, val: p.value };
  });

  const pathD = coords.reduce((acc, c, i) => {
    return i === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`;
  }, "");

  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${h - pad} L ${coords[0].x} ${h - pad} Z`;

  container.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 ${w} ${h}">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#00f2fe" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#00f2fe" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <!-- Base Grid Line -->
      <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
      <!-- Area Fill -->
      <path d="${areaD}" fill="url(#chartGrad)"/>
      <!-- Line Stroke -->
      <path d="${pathD}" fill="none" stroke="#00f2fe" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Points & Tooltips -->
      ${coords.map(c => `
        <circle cx="${c.x}" cy="${c.y}" r="4" fill="#090d16" stroke="#00f2fe" stroke-width="2"/>
        <text x="${c.x}" y="${h - 8}" font-size="10" fill="#64748b" text-anchor="middle" font-family="monospace">${c.date}</text>
        <text x="${c.x}" y="${c.y - 8}" font-size="10" fill="#38bdf8" text-anchor="middle" font-weight="700" font-family="monospace">${c.val}</text>
      `).join("")}
    </svg>
  `;
}

