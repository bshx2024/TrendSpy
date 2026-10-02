/**
 * TrendSpy SaaS 3.0 · Web Console Client Application
 */

// 全局应用状态
const state = {
  activeTab: "tab-breakouts",
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
                             (m.toolifyToolsCount || 0);
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

    const percentWidth = Math.min(Math.round(((item.benchmarkRatio || 0) / maxRatio) * 100), 100);

    return `
      <div class="breakout-card">
        <div class="card-top">
          <div class="keyword-wrap">
            <h4 class="keyword-text">${escapeHtml(item.keyword)}</h4>
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
          <div class="external-links">
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
  fetchOverview();
  fetchBreakouts();
  fetchArbitrage();
  fetchPlatforms();
  fetchReports();
  fetchSeeds();

  // 1. Tab 切换
  document.querySelectorAll(".nav-tab").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      document.querySelectorAll(".nav-tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));

      tabBtn.classList.add("active");
      const targetPane = document.getElementById(tabBtn.dataset.tab);
      if (targetPane) targetPane.classList.add("active");
      state.activeTab = tabBtn.dataset.tab;
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
});
