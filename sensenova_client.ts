/**
 * 商汤科技 SenseNova (DeepSeek-v4-flash) 智能诊断引擎
 * 用于全自动生成新词出海商业化评估与“灵魂三问”：
 * 1. 这是什么 (What is it)
 * 2. 用户想要什么 (User intent)
 * 3. 我们怎么做 (Action suggestion: 单独立站 vs 大站内页, 工具 vs 资源页)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 简易读取 .env
function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...values] = trimmed.split("=");
      if (key && values.length > 0) {
        const val = values.join("=").trim().replace(/^["']|["']$/g, "");
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = val;
        }
      }
    }
  }
}

loadEnv();

const API_KEY = process.env.SENSENOVA_API_KEY || "";
const BASE_URL = process.env.SENSENOVA_BASE_URL || "https://token.sensenova.cn/v1";
const MODEL = process.env.SENSENOVA_MODEL || "deepseek-v4-flash";

export interface KeywordDiagnosticContext {
  sourceEntity?: string;
  category?: string;
  ratio?: number;
  stage?: string;
  longtails?: string[];
  serpDomains?: string[];
}

export interface KeywordDiagnosisResult {
  keyword: string;
  whatIsIt: string;
  userIntent: string;
  actionSuggestion: string;
  verdictLevel: "值得做·单独立站" | "可以试·做内页" | "观望·暂不建站" | "避坑·版权或衰退";
  verdictSummary: string;
  contentAngle: string[];
  modelUsed: string;
  analyzedAt: string;
}

let lastCallTime = 0;
const MIN_CALL_INTERVAL_MS = 2500;

async function throttleCall() {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_CALL_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_CALL_INTERVAL_MS - elapsed));
  }
  lastCallTime = Date.now();
}

/**
 * 调用商汤科技 DeepSeek-v4-flash 对关键词进行出海商业化诊断
 */
export async function diagnoseKeyword(
  keyword: string,
  context: KeywordDiagnosticContext = {}
): Promise<KeywordDiagnosisResult> {
  const cleanKw = keyword.trim();
  const endpoint = `${BASE_URL.replace(/\/+$/, "")}/chat/completions`;

  const prompt = `你是一位顶级海外流量专家、出海独立开发者与 SEO 实战操盘手（对标 Web Cafe 商业分析标准）。
请针对正在海外爆发/飙升的目标关键词，给出极其精炼、地道、具备实操落地价值的“出海商业化诊断”：

【目标关键词】: "${cleanKw}"
【背景信息】:
- 归属实体/分类: ${context.sourceEntity || context.category || "全网热搜/新词"}
- 相对 GPTs 标尺倍率: ${context.ratio !== undefined ? `×${context.ratio}` : "新发现，尚未完全量化"}
- 生命周期阶段: ${context.stage || "爆发/上升期"}
- 关联搜索长尾: ${context.longtails && context.longtails.length > 0 ? context.longtails.slice(0, 5).join(", ") : "暂无"}
- 谷歌前排域名情况: ${context.serpDomains && context.serpDomains.length > 0 ? context.serpDomains.slice(0, 5).join(", ") : "暂无"}

请严格按照以下 JSON 格式输出，不要输出任何额外的 Markdown 代码块外的废话：
{
  "whatIsIt": "一两句话点出这是什么（事实背景，如某个复古唱片、某款新出的游戏/AI工具、某位网络人物、特定技术故障代码）",
  "userIntent": "搜这个词的用户核心想得到什么（例如：寻找试听/购买二手唱片、寻找免登录免费版体验、找报错修复方案、找攻略或礼包码）",
  "actionSuggestion": "出海站长/独立开发者该怎么做（明确给出建议：做单独立站还是在大站上做内页？形式是工具、资源聚合页、下载页还是博客？是否有版权风险？）",
  "verdictLevel": "值得做·单独立站 | 可以试·做内页 | 观望·暂不建站 | 避坑·版权或衰退 四选一",
  "verdictSummary": "极其精炼的决策一句话（例如：'可以试 做内页 · 热度仅 GPTs×0.02，偏低，但仍在上升'）",
  "contentAngle": ["落地页面可包含的第1个核心功能或内容模块", "第2个功能/模块", "第3个变现或转化点"]
}`;

  let lastError: Error | null = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await throttleCall();

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "system",
              content: "You are an expert in global SEO, programmatic content arbitrage, and indie hacking monetization. Always return valid JSON only."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 1500
        })
      });

      if (res.status === 429) {
        const waitMs = attempt * 3000;
        console.warn(`[DeepSeek] 429 速率限制，第 ${attempt} 次重试中，等待 ${waitMs}ms...`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`商汤 API 响应异常 HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      const msg = data.choices?.[0]?.message || {};
      const content = msg.content || msg.reasoning_content || "";

      // 提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`未能从模型回复中解析出 JSON: ${content}`);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        keyword: cleanKw,
        whatIsIt: parsed.whatIsIt || "尚未识别具体背景",
        userIntent: parsed.userIntent || "寻找相关资讯或工具",
        actionSuggestion: parsed.actionSuggestion || "建议做长尾内页尝试截流",
        verdictLevel: parsed.verdictLevel || "可以试·做内页",
        verdictSummary: parsed.verdictSummary || `热度指数稳定，建议关注`,
        contentAngle: Array.isArray(parsed.contentAngle) ? parsed.contentAngle : [],
        modelUsed: `${MODEL} (SenseNova)`,
        analyzedAt: new Date().toISOString()
      };
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
  }

  // 兜底保障
  console.error(`[DeepSeek-v4-flash] 诊断关键词 "${keyword}" 最终失败:`, lastError?.message);
  return {
    keyword: cleanKw,
    whatIsIt: `关于 ${cleanKw} 的海外热度激增词条`,
    userIntent: `用户正在搜索与 ${cleanKw} 相关的具体信息、方案或资源`,
    actionSuggestion: `建议在大站建立相关专题内页进行轻量级测试`,
    verdictLevel: "观望·暂不建站",
    verdictSummary: `分析降级：${lastError?.message || "网络抖动"}`,
    contentAngle: ["核心概念与背景介绍", "常见问答与痛点解决"],
    modelUsed: `${MODEL} (fallback)`,
    analyzedAt: new Date().toISOString()
  };
}

// 命令行直接测试支持
if (process.argv[1] && process.argv[1].endsWith("sensenova_client.ts")) {
  const testWord = process.argv[2] || "rumpelstiltskin 1978";
  console.log(`[SenseNova] 正在使用 ${MODEL} 测试诊断关键词: "${testWord}"...`);
  diagnoseKeyword(testWord, {
    ratio: 0.02,
    sourceEntity: "rumpelstiltskin",
    stage: "上升中"
  }).then((res) => {
    console.log("\n--- 诊断结果 ---");
    console.log(JSON.stringify(res, null, 2));
  });
}
