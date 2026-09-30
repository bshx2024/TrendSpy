import fs from "node:fs";
import path from "node:path";
import { GitHubRepoItem } from "./fetch_github.js";

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const DATA_DIR = path.join(CURRENT_DIR, "data");
const INPUT_GITHUB_FILE = path.join(DATA_DIR, "raw_github_repos.json");
const CANDIDATES_FILE = path.join(DATA_DIR, "candidates.json");
const REJECTED_FILE = path.join(DATA_DIR, "rejected_candidates.json");

export interface ViralCandidate {
  id: string;
  source: "github" | "reddit" | "curated";
  sourceName: string;
  sourceUrl: string;
  description: string;
  starsOrScore: number;
  
  // 商业品类与传播度
  categoryTag: string;          // 细分爆款玩法品类
  isB2C: boolean;               // 是否面向大众/普通网民
  shareabilityScore: number;    // 自传播分享意愿得分 (1~10)
  richMediaOutput: string;      // 产出物形态: 卡面/宠物/视频/滤镜/卡片/小票
  
  // 核心 SEO 自然搜索词（黄金法则：控制在 1~2 个单词的简短核心母词！）
  triggerKeyword: string;       // 核心母词/品牌实体词 (Core Entity Root)
  alternativeKeywords: string[];// 备选核心词
  
  // 落地与套利建议
  suggestedAction: string;      // 极速落地形态 (纯前端 Canvas / WebGL / 轻量 API 套壳)
  emdDomainIdeas: string[];     // 精确匹配域名建议 (.com / .io / .net)
  rationale: string;            // 商业逻辑与爆款原因
  status: "accepted" | "rejected";
  rejectReason?: string;
}

// 核心母词提炼规则（严格限制在 1~2 个单词）
interface CategoryRule {
  tag: string;
  triggers: string[];
  primaryKeyword: string;       // 1~2 词黄金母词
  altKeywords: string[];
  outputType: string;
  techAction: string;
  domainPrefix: string;
  score: number;
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    tag: "卡面定制贴纸 (Card Skin)",
    triggers: ["card-design", "card skin", "iso 7810", "credit card", "debit card", "sticker", "card face"],
    primaryKeyword: "card skin",
    altKeywords: ["card sticker", "custom card skin"],
    outputType: "定制卡面贴纸 / 高清卡片设计",
    techAction: "HTML5 Canvas 纯前端排版与高清 PNG 导出 (0 服务器成本)",
    domainPrefix: "cardskin",
    score: 10
  },
  {
    tag: "桌面互动宠物 (Desktop Pet)",
    triggers: ["desktop-habitat", "habitat", "living ecosystem", "desktop pet", "virtual pet", "aquarium"],
    primaryKeyword: "desktop pet",
    altKeywords: ["virtual pet", "desktop shimeji"],
    outputType: "解压互动小宠物 / 桌面微生态动画",
    techAction: "Canvas 动画 + 纯客户端轻量交互 (可封装为 PWA / 微前端)",
    domainPrefix: "desktoppet",
    score: 10
  },
  {
    tag: "AI 口播短视频 (Talking Head AI)",
    triggers: ["talking-head", "reel", "shorts", "caption", "tiktok edit", "vertical video"],
    primaryKeyword: "talking head ai",
    altKeywords: ["ai reel maker", "caption video maker"],
    outputType: "爆款口播短视频 / 自动卡点字幕视频",
    techAction: "轻量 WebCodecs / 第三方开源模型 API 代理单页",
    domainPrefix: "talkingheadai",
    score: 9
  },
  {
    tag: "孔版印刷艺术风 (Risograph)",
    triggers: ["risograph", "riso", "film effect", "halftone", "dither", "retro print"],
    primaryKeyword: "risograph",
    altKeywords: ["riso print", "risograph effect"],
    outputType: "孔版印刷多色套印艺术图 / 怀旧画风海报",
    techAction: "WebGL 着色器调色 + Canvas 粒子噪点算法",
    domainPrefix: "risographart",
    score: 8
  },
  {
    tag: "游戏蓝图与建造模拟 (Minecraft Blueprint)",
    triggers: ["minecraft", "client", "building tools", "schematic", "donut", "palworld", "map"],
    primaryKeyword: "minecraft blueprint",
    altKeywords: ["minecraft schematic", "voxel builder"],
    outputType: "游戏三维蓝图剖面 / 像素点位展示",
    techAction: "纯前端 WebGL 体素渲染器",
    domainPrefix: "craftblueprint",
    score: 8
  },
  {
    tag: "3D 可视化科技树 (3D Tech Tree)",
    triggers: ["tech-tree", "polytech", "three.js", "technology tree", "timeline", "tower of eras"],
    primaryKeyword: "tech tree 3d",
    altKeywords: ["interactive tech tree", "history tech tree"],
    outputType: "3D 可交互科技树 / 历史演进长图",
    techAction: "Three.js 纯前端 3D 场景 + WebGL Canvas",
    domainPrefix: "techtree3d",
    score: 7
  },
  {
    tag: "购物小票与账单生成器 (Receiptify)",
    triggers: ["receipt", "bill", "invoice", "receiptify"],
    primaryKeyword: "receiptify",
    altKeywords: ["receipt maker", "spotify receipt"],
    outputType: "长条形超市小票收据 / 极简账单",
    techAction: "HTML5 Canvas 热敏纸撕边效果渲染",
    domainPrefix: "receiptifyapp",
    score: 9
  },
  {
    tag: "恶搞推文与截图 (Fake Tweet)",
    triggers: ["tweet", "fake tweet", "fake post", "meme generator", "quote card"],
    primaryKeyword: "fake tweet",
    altKeywords: ["fake tweet maker", "meme quote generator"],
    outputType: "高拟真社媒截图 / 恶搞图文海报",
    techAction: "DOM 模板 + html2canvas 纯前端截图",
    domainPrefix: "faketweetmaker",
    score: 9
  }
];

export function evaluateRepo(repo: GitHubRepoItem): ViralCandidate {
  const fullText = `${repo.name} ${repo.description} ${repo.topics.join(" ")}`.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (rule.triggers.some(t => fullText.includes(t.toLowerCase()))) {
      const cleanPrefix = rule.domainPrefix;
      const emdDomainIdeas = [
        `${cleanPrefix}.com`,
        `${cleanPrefix}online.io`,
        `get${cleanPrefix}.com`,
        `${cleanPrefix}tool.com`
      ];

      return {
        id: `gh-${repo.id}`,
        source: "github",
        sourceName: repo.full_name,
        sourceUrl: repo.html_url,
        description: repo.description || "No description provided.",
        starsOrScore: repo.stars,
        categoryTag: rule.tag,
        isB2C: true,
        shareabilityScore: rule.score,
        richMediaOutput: rule.outputType,
        triggerKeyword: rule.primaryKeyword,
        alternativeKeywords: rule.altKeywords,
        suggestedAction: rule.techAction,
        emdDomainIdeas,
        rationale: `项目对应大众真实玩法【${rule.tag}】。提炼 1~2 词简短母词【${rule.primaryKeyword}】，避开生造词，直击大盘海量搜索心智。`,
        status: "accepted"
      };
    }
  }

  // 严格拦截非大众消费型代码库
  return {
    id: `gh-${repo.id}`,
    source: "github",
    sourceName: repo.full_name,
    sourceUrl: repo.html_url,
    description: repo.description || "No description provided.",
    starsOrScore: repo.stars,
    categoryTag: "专有底层组件 / 基础设施",
    isB2C: false,
    shareabilityScore: 3,
    richMediaOutput: "无普适富媒体产物",
    triggerKeyword: repo.name.replace(/[-_]/g, " "),
    alternativeKeywords: [],
    suggestedAction: "暂无",
    emdDomainIdeas: [],
    rationale: "非大众高频消费玩法，无对应的大众搜索母词",
    status: "rejected",
    rejectReason: "缺乏对应的大众消费级母词，不适合套利"
  };
}

export function runViralAnalysis(): { accepted: ViralCandidate[]; rejected: ViralCandidate[] } {
  console.log("=".repeat(60));
  console.log("🧠 启动 1~2 词黄金母词提炼引擎（绝不硬拼 3~4 词长尾伪词）...");
  console.log("=".repeat(60));

  if (!fs.existsSync(INPUT_GITHUB_FILE)) {
    console.warn(`[-] 未找到 GitHub 原始数据文件: ${INPUT_GITHUB_FILE}`);
    return { accepted: [], rejected: [] };
  }

  const rawData = JSON.parse(fs.readFileSync(INPUT_GITHUB_FILE, "utf-8"));
  const repos: GitHubRepoItem[] = rawData.repos || [];

  const candidates = repos.map(evaluateRepo);
  const accepted = candidates.filter(c => c.status === "accepted");
  const rejected = candidates.filter(c => c.status === "rejected");

  // 去重（同一个 triggerKeyword 保留 Star 最高的）
  const uniqueMap = new Map<string, ViralCandidate>();
  for (const c of accepted) {
    if (!uniqueMap.has(c.triggerKeyword) || c.starsOrScore > uniqueMap.get(c.triggerKeyword)!.starsOrScore) {
      uniqueMap.set(c.triggerKeyword, c);
    }
  }
  const finalAccepted = Array.from(uniqueMap.values());
  finalAccepted.sort((a, b) => b.shareabilityScore - a.shareabilityScore || b.starsOrScore - a.starsOrScore);

  fs.writeFileSync(CANDIDATES_FILE, JSON.stringify({ count: finalAccepted.length, candidates: finalAccepted }, null, 2), "utf-8");
  fs.writeFileSync(REJECTED_FILE, JSON.stringify({ count: rejected.length, rejected }, null, 2), "utf-8");

  console.log(`✅ 核心母词提炼完成！`);
  console.log(`   🎯 提炼出短词母词候选: ${finalAccepted.length} 个 (已存入 candidates.json)`);
  console.log(`   ⚠️ 过滤淘汰专有库: ${rejected.length} 个 (已存入 rejected_candidates.json)`);
  console.log("=".repeat(60));

  return { accepted: finalAccepted, rejected };
}

if (process.argv[1] && process.argv[1].endsWith("analyze_viral.ts")) {
  runViralAnalysis();
}
