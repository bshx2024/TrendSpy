# ⚡ TrendSpy · 全球新词雷达与流量套利 SaaS

> 基于 Google Trends 标尺量化、Google Chrome 实时下拉探针、GitHub 与 Reddit 多源情报的全球新词探测与出海流量套利 SaaS 决策平台。

---

## 🌟 核心特性

- **🚀 爆发新词与黄金标尺量化 (NewTrend 3.0)**：
  - 覆盖 28+ 核心 AI 实体种子库（AI 视频与生图、LLM/代码助手、AI 音频、出海 B2C 神器）。
  - Google Chrome 实时联想词与 Google Trends 过去 30 天飙升词（Rising Queries & Breakout >5000%）探测。
  - 对齐 **GPTs 黄金标尺**，精准量化相对热度倍率（如 `GPTs×4.8`），判定时序生命周期（新词爆发、二次爆火、稳态、衰退）。

- **🎯 流量套利与出海产品机会 (Radar 2.0)**：
  - 自动逆向挖掘 GitHub 敏捷爆款项目与 Reddit 独立开发讨论中的高需求母词。
  - 自动推荐 **EMD (Exact Match Domain) 精准匹配域名**。
  - 智能拦截热度腰斩或历史过气词，规避接盘风险。

- **💻 现代化 Web SaaS 控制台 (Web Console)**：
  - 深黑曜石质感、玻璃拟态、流光微动效。
  - KPI 实时指标看板、动态筛选（生命周期、赛道、搜索）。
  - 多源监控情报（Google Trending 每日实时热榜、GitHub Repos、Reddit 社区）。
  - 内置决策研报 Markdown 在线预览与一键复制。
  - **实时流式日志终端 (SSE Stream)**：网页端一键执行扫描流水线，实时查看任务进度。

---

## 🚀 快速启动

### 1. 安装依赖
```bash
npm install
```

### 2. 启动 Web SaaS 控制台
```bash
npm start
# 或者
npm run web
```
启动后在浏览器打开：`http://localhost:3200`

---

## 📦 核心流水线命令 (CLI)

```bash
# 执行 NewTrend 3.0 实体衍生与 GPTs 标尺量化全自动流水线
npm run newtrend

# 执行 Radar 2.0 GitHub + Google Trending 多源套利雷达
npm run radar

# 单独抓取实体飙升词与下拉词探针
npm run fetch:entity

# 单独执行标尺量化计算
npm run benchmark

# 单独生成研报
npm run report
```

---

## 🏗️ 目录结构

```text
TrendSpy/
├── data/                       # 原始抓取与量化数据输出 (JSON)
├── reports/                    # 生成的 Markdown 决策研报
├── public/                     # Web SaaS 控制台静态前端 (HTML/CSS/JS)
├── entity_seeds.ts             # 28+ 垂直生态核心实体种子池
├── fetch_entity_trends.ts      # 实体上升词与 Chrome 下拉探针
├── google_trends_client.ts     # Google Trends 官方接口封装与多时序解析
├── benchmark_engine.ts         # GPTs 黄金标尺量化计算与生命周期状态机
├── fetch_github.ts             # GitHub 敏捷爆发项目采集器
├── fetch_google_trending.ts    # Google Trending RSS 实时飙升榜采集
├── fetch_reddit.ts             # Reddit 出海板块热帖采集
├── run_newtrend_pipeline.ts    # 3.0 全自动流水线入口
├── run_radar.ts                # 2.0 多源雷达流水线入口
├── server.ts                   # Web SaaS 后端 Express + SSE 服务
└── package.json
```

---

## 📄 开源许可
MIT License.
