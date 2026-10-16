/**
 * 哥飞 Web.Cafe 开放 API / MCP 新词与新站数据采集模块
 * 使用用户的 WEBCAFE_TOKEN 免消耗积分同步官方新词雷达批次
 */

import fs from "node:fs";
import path from "node:path";

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const DATA_DIR = path.join(CURRENT_DIR, "data");
const OUTPUT_WEBCAFE_FILE = path.join(DATA_DIR, "raw_webcafe_keywords.json");

export interface WebCafeKeywordItem {
  id?: string;
  keyword: string;
  category: string;
  verdict?: "yes" | "maybe" | "skip" | string;
  ratio?: number;
  batchId: string;
  fetchedAt: string;
  sourceUrl?: string;
  raw?: any;
}

function getToken(): string {
  if (process.env.WEBCAFE_TOKEN) return process.env.WEBCAFE_TOKEN;
  try {
    const envFile = path.join(CURRENT_DIR, ".env");
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, "utf-8");
      const match = content.match(/WEBCAFE_TOKEN=([^\r\n]+)/);
      if (match) return match[1].trim();
    }
  } catch (e) {}
  return "wc_mcp_779dbe8ffc998c7593ac686de98e9f4b72ce579fce7d9f4c";
}

async function callWebCafeMcp(name: string, args: Record<string, any> = {}): Promise<any> {
  const token = getToken();
  const url = `https://seo.web.cafe/api/mcp?token=${token}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name,
        arguments: args
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Web.Cafe MCP 请求失败: HTTP ${res.status}`);
  }

  const json = await res.json();
  const text = json.result?.content?.[0]?.text;
  if (!text) {
    throw new Error("MCP 返回空内容: " + JSON.stringify(json));
  }

  return JSON.parse(text);
}

/**
 * 抓取最近 N 个批次的新词数据并持久化到本地
 */
export async function runWebCafeIngestion(limitBatches = 5): Promise<WebCafeKeywordItem[]> {
  console.log("\n" + "=".repeat(60));
  console.log("☕ [哥飞 SEO 工具箱] 正在同步 Web.Cafe 最新新词发现批次...");
  console.log("=".repeat(60));

  const listRes = await callWebCafeMcp("keyword_batches", {});
  if (!listRes.ok || !listRes.data?.batches) {
    console.error("[-] 获取批次列表失败:", listRes.error || "未知原因");
    return [];
  }

  const batches = listRes.data.batches.slice(0, limitBatches);
  console.log(`[+] 成功获取最近 ${batches.length} 个新词批次`);

  const allKeywords: WebCafeKeywordItem[] = [];

  for (const b of batches) {
    console.log(`  -> 正在抓取批次 [${b.id}] (${b.keyword_count || 0} 个词)...`);
    try {
      const detailRes = await callWebCafeMcp("keyword_batch", { id: b.id });
      if (detailRes.ok && Array.isArray(detailRes.data?.keywords)) {
        for (const kw of detailRes.data.keywords) {
          allKeywords.push({
            keyword: kw.keyword || kw.name || kw.query,
            category: kw.category || "unknown",
            verdict: kw.verdict || kw.decision || kw.status,
            batchId: b.id,
            fetchedAt: b.finished_at || new Date().toISOString(),
            sourceUrl: b.page_url,
            raw: kw
          });
        }
      }
    } catch (err: any) {
      console.warn(`  [-] 抓取批次 ${b.id} 异常:`, err.message);
    }
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  fs.writeFileSync(
    OUTPUT_WEBCAFE_FILE,
    JSON.stringify(
      {
        fetched_at: new Date().toISOString(),
        total: allKeywords.length,
        batches_synced: batches.map((b: any) => b.id),
        items: allKeywords
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log(`✔ [Web.Cafe 同步成功] 共抓取并保存 ${allKeywords.length} 个精选新词到: ${OUTPUT_WEBCAFE_FILE}`);
  return allKeywords;
}

if (process.argv[1] && process.argv[1].endsWith("fetch_webcafe_trends.ts")) {
  runWebCafeIngestion().catch(console.error);
}
