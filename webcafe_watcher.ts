/**
 * 哥飞 Web.Cafe 实时新词同步监听与秒级报警器
 * (Web.Cafe Real-time Watcher & Instant Alert Dispatcher)
 * 
 * 机制：
 * 1. 5~10 分钟轻量轮询 keyword_batches (0 积分消耗，0.3秒极速返回)
 * 2. 毫秒级识别哥飞新发布的 batch
 * 3. 严格套用《新词极速变现标准指南》(选词金三角)，筛出 S 级/A 级出单词
 * 4. 触发多通道即时告警 (控制台哔声 / 实时数据落盘 / 飞书/企微/钉钉/Bark Webhook 推送)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIR, "webcafe_sync_state.json");
const ALERTS_FILE = path.join(DATA_DIR, "live_alerts.json");

interface WatcherState {
  lastBatchId: string;
  lastCheckedAt: string;
  alertHistory: string[];
}

interface AlertItem {
  id: string;
  keyword: string;
  category: string;
  level: "S (极速交付)" | "A (高潜模版)" | "B (关注)";
  deliveryType: string;
  suggestedH1: string;
  batchId: string;
  detectedAt: string;
  trendsUrl: string;
  serpUrl: string;
}

function getToken(): string {
  if (process.env.WEBCAFE_TOKEN) return process.env.WEBCAFE_TOKEN;
  try {
    const envFile = path.join(__dirname, ".env");
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, "utf-8");
      const match = content.match(/WEBCAFE_TOKEN=([^\r\n]+)/);
      if (match) return match[1].trim();
    }
  } catch (e) {}
  return "wc_mcp_779dbe8ffc998c7593ac686de98e9f4b72ce579fce7d9f4c";
}

function getWebhookUrl(): string {
  if (process.env.ALERT_WEBHOOK_URL) return process.env.ALERT_WEBHOOK_URL;
  try {
    const envFile = path.join(__dirname, ".env");
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, "utf-8");
      const match = content.match(/ALERT_WEBHOOK_URL=([^\r\n]+)/);
      if (match) return match[1].trim();
    }
  } catch (e) {}
  return "";
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
      params: { name, arguments: args }
    })
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const text = json.result?.content?.[0]?.text;
  if (!text) throw new Error("Empty response");
  return JSON.parse(text);
}

function loadState(): WatcherState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch (e) {}
  return { lastBatchId: "", lastCheckedAt: "", alertHistory: [] };
}

function saveState(state: WatcherState) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function classifyKeyword(kw: string): { isMonetizable: boolean; level: AlertItem["level"]; deliveryType: string; suggestedH1: string } {
  const clean = kw.toLowerCase().trim();

  // 1. S 级特征：极速交付型视频/滤镜/换脸/模版 (类似 hotel lobby / raindance)
  if (/\b(video|filter|template|generator|clone|face|dance|skin)\b/i.test(clean) && !/\b(download|movie|episode|news)\b/i.test(clean)) {
    let deliveryType = "AI 视频与换脸运镜模版";
    if (clean.includes("filter")) deliveryType = "AI 自传播滤镜";
    else if (clean.includes("clone") || clean.includes("voice")) deliveryType = "AI 声音克隆";
    else if (clean.includes("skin")) deliveryType = "纯前端卡面生成器";

    return {
      isMonetizable: true,
      level: "S (极速交付)",
      deliveryType,
      suggestedH1: `Two photos. One ${kw} in 30 seconds.`
    };
  }

  // 2. A 级特征：音乐/神曲二创/提示词 (类似 hotel lobby song / krea prompt)
  if (/\b(song|music|prompt|lyrics|voice)\b/i.test(clean) && clean.includes("ai")) {
    return {
      isMonetizable: true,
      level: "A (高潜模版)",
      deliveryType: "AI 音乐与短剧二创",
      suggestedH1: `Generate ${kw} instantly with lyrics.`
    };
  }

  return { isMonetizable: false, level: "B (关注)", deliveryType: "常规", suggestedH1: "" };
}

async function dispatchWebhookAlert(alerts: AlertItem[]) {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl || alerts.length === 0) return;

  const title = `🚨 哥飞新词雷达报警！发现 ${alerts.length} 个 S/A 级出单词`;
  const textLines = alerts.map((a, i) => 
    `${i + 1}. [${a.level}] **${a.keyword}**\n   - 交付物: ${a.deliveryType}\n   - 建议H1: ${a.suggestedH1}\n   - 验证: https://trends.google.com/trends/explore?q=${encodeURIComponent(a.keyword)}`
  ).join("\n\n");

  try {
    // 兼容飞书、钉钉、企微通用格式
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "text",
        content: { text: `${title}\n\n${textLines}` },
        text: { content: `${title}\n\n${textLines}` }
      })
    });
    console.log(`[+] 成功通过 Webhook 发送报警消息至: ${webhookUrl.slice(0, 30)}...`);
  } catch (err: any) {
    console.warn(`[-] Webhook 推送失败:`, err.message);
  }
}

/**
 * 单次轮询检查
 */
export async function checkWebCafeUpdateOnce(): Promise<AlertItem[]> {
  const state = loadState();
  const nowStr = new Date().toISOString();

  try {
    const listRes = await callWebCafeMcp("keyword_batches", {});
    if (!listRes.ok || !listRes.data?.batches || listRes.data.batches.length === 0) {
      return [];
    }

    const latestBatch = listRes.data.batches[0];
    const isNewBatch = latestBatch.id !== state.lastBatchId;

    if (!isNewBatch) {
      // 批次未更新
      return [];
    }

    console.log(`\n🔔 [Web.Cafe 发现新批次] ${latestBatch.id} (共 ${latestBatch.keyword_count || 0} 个词)！`);
    console.log(`🕒 发布时间: ${latestBatch.finished_at}`);

    // 拉取批次详情
    const detailRes = await callWebCafeMcp("keyword_batch", { id: latestBatch.id });
    const keywords: any[] = detailRes.data?.keywords || [];

    const newAlerts: AlertItem[] = [];

    for (const item of keywords) {
      const kw = item.keyword || item.name || item.query;
      if (!kw) continue;

      const analysis = classifyKeyword(kw);
      if (analysis.isMonetizable && !state.alertHistory.includes(kw)) {
        newAlerts.push({
          id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          keyword: kw,
          category: item.category || "ai",
          level: analysis.level,
          deliveryType: analysis.deliveryType,
          suggestedH1: analysis.suggestedH1,
          batchId: latestBatch.id,
          detectedAt: nowStr,
          trendsUrl: `https://trends.google.com/trends/explore?q=${encodeURIComponent(kw)}`,
          serpUrl: `https://www.google.com/search?q=${encodeURIComponent(kw)}`
        });
        state.alertHistory.push(kw);
      }
    }

    // 更新状态
    state.lastBatchId = latestBatch.id;
    state.lastCheckedAt = nowStr;
    saveState(state);

    if (newAlerts.length > 0) {
      // 终端警报 (发出响铃)
      process.stdout.write("\x07"); 
      console.log("\n" + "🔥".repeat(30));
      console.log(`🚨 【哥飞新词战斗警报】检出 ${newAlerts.length} 个极速出单交付词！`);
      console.log("🔥".repeat(30));
      newAlerts.forEach(a => {
        console.log(`\n⭐ [${a.level}] 关键词: "${a.keyword}"`);
        console.log(`   - 交付形态: ${a.deliveryType}`);
        console.log(`   - 落地 H1 建议: "${a.suggestedH1}"`);
        console.log(`   - Google Trends: ${a.trendsUrl}`);
      });
      console.log("\n" + "🔥".repeat(30));

      // 持久化到 live_alerts.json
      let existingAlerts: AlertItem[] = [];
      try {
        if (fs.existsSync(ALERTS_FILE)) existingAlerts = JSON.parse(fs.readFileSync(ALERTS_FILE, "utf-8"));
      } catch (e) {}
      fs.writeFileSync(ALERTS_FILE, JSON.stringify([...newAlerts, ...existingAlerts].slice(0, 50), null, 2), "utf-8");

      // 触发 Webhook 推送
      await dispatchWebhookAlert(newAlerts);
    } else {
      console.log(`✔ 批次 [${latestBatch.id}] 分析完毕，未发现符合严格交付标准的 S/A 级词汇。`);
    }

    return newAlerts;
  } catch (err: any) {
    console.error("[-] 检查 Web.Cafe 批次失败:", err.message);
    return [];
  }
}

/**
 * 启动常驻定时轮询监听器
 */
export function startWebCafeWatcher(intervalMinutes = 5) {
  console.log(`🚀 [Web.Cafe 实时监听器] 启动！每 ${intervalMinutes} 分钟自动同步一次官方新词批次...`);
  const ms = intervalMinutes * 60 * 1000;

  // 立即执行首轮
  checkWebCafeUpdateOnce().catch(() => {});

  // 循环定时
  setInterval(() => {
    checkWebCafeUpdateOnce().catch(() => {});
  }, ms);
}

if (process.argv[1] && process.argv[1].endsWith("webcafe_watcher.ts")) {
  startWebCafeWatcher(5);
}
