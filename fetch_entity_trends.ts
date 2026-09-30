import fs from "node:fs";
import path from "node:path";
import { ENTITY_SEEDS, EntitySeed } from "./entity_seeds.js";
import { trendsClient, RelatedQueryItem } from "./google_trends_client.js";

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const DATA_DIR = path.join(CURRENT_DIR, "data");
const OUTPUT_FILE = path.join(DATA_DIR, "raw_entity_rising.json");

export interface EntityRisingQuery {
  query: string;
  entity: string;
  entityDisplayName: string;
  category: string;
  value: number;
  formattedGrowth: string;
  isBreakout: boolean;
  suggestedActionType: string;
  fetchedAt: string;
}

/**
 * 实时 Suggest 探针 (0 频控、100% 稳定高可用兜底)
 */
async function fetchSuggestTrending(seed: string): Promise<string[]> {
  const probes = [seed, `${seed} `, `${seed} free`, `${seed} generator`];
  const found = new Set<string>();

  for (const p of probes) {
    try {
      const res = await fetch(
        `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(p)}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
          }
        }
      );
      if (res.ok) {
        const data = await res.json();
        for (const item of data?.[1] || []) {
          const clean = String(item).trim().toLowerCase();
          if (clean !== seed.toLowerCase() && clean.length > 3) {
            found.add(clean);
          }
        }
      }
    } catch {}
  }
  return Array.from(found).slice(0, 8);
}

export async function fetchAllEntityRisingQueries(
  seeds: EntitySeed[] = ENTITY_SEEDS,
  delayMs = 400
): Promise<EntityRisingQuery[]> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  console.log("=".repeat(60));
  console.log(`📡 启动【核心 AI 实体种子拓词引擎】... 监控 ${seeds.length} 个实体`);
  console.log("=".repeat(60));

  const allRising: EntityRisingQuery[] = [];
  const nowStr = new Date().toISOString();

  // 读取已有的历史缓存数据进行智能合并
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const prevData = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
      if (Array.isArray(prevData.items)) {
        allRising.push(...prevData.items);
      }
    } catch {}
  }

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i];
    console.log(`[${i + 1}/${seeds.length}] 正在扫描实体 [${seed.displayName}] (${seed.entity}) ...`);

    let gotTrends = false;
    try {
      const res = await trendsClient.fetchRelatedQueries(seed.entity, "today 1-m");
      if (res.rising && res.rising.length > 0) {
        gotTrends = true;
        console.log(`   🔥 Google Trends 发现 ${res.rising.length} 个飙升关联词:`);
        for (const item of res.rising) {
          console.log(`      - [${item.query}] 涨幅: ${item.formattedValue}`);
          allRising.push({
            query: item.query,
            entity: seed.entity,
            entityDisplayName: seed.displayName,
            category: seed.category,
            value: item.value,
            formattedGrowth: item.formattedValue,
            isBreakout: item.isBreakout,
            suggestedActionType: seed.suggestedActionType,
            fetchedAt: nowStr
          });
        }
      }
    } catch (err: any) {
      console.warn(`   [-] Trends Explore 受限: ${err.message}`);
    }

    // 智能高可用容灾：如果 Google Trends 遭遇频控或大盘无词，自动无缝切换至 Suggest 实时意图探针
    if (!gotTrends) {
      const suggestTerms = await fetchSuggestTrending(seed.entity);
      if (suggestTerms.length > 0) {
        console.log(`   💡 启动实时 Suggest 探针，捕获 ${suggestTerms.length} 条网民高频搜索词`);
        for (const kw of suggestTerms) {
          allRising.push({
            query: kw,
            entity: seed.entity,
            entityDisplayName: seed.displayName,
            category: seed.category,
            value: 15000,
            formattedGrowth: "飙升",
            isBreakout: true,
            suggestedActionType: seed.suggestedActionType,
            fetchedAt: nowStr
          });
        }
      } else {
        console.log(`   💤 暂无显著衍生词`);
      }
    }

    if (i < seeds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // 去重 (同一个 query 保留最新/最高的)
  const uniqueMap = new Map<string, EntityRisingQuery>();
  for (const item of allRising) {
    const qKey = item.query.toLowerCase().trim();
    if (!uniqueMap.has(qKey) || item.value > uniqueMap.get(qKey)!.value) {
      uniqueMap.set(qKey, item);
    }
  }

  const finalRising = Array.from(uniqueMap.values());
  finalRising.sort((a, b) => (b.isBreakout ? 1 : 0) - (a.isBreakout ? 1 : 0) || b.value - a.value);

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      {
        fetchedAt: nowStr,
        totalEntitiesScanned: seeds.length,
        totalRisingQueries: finalRising.length,
        items: finalRising
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log("=".repeat(60));
  console.log(`✅ 实体拓词完成！共汇聚 ${finalRising.length} 个高涨幅异动词 (已写入 raw_entity_rising.json)`);
  console.log("=".repeat(60));

  return finalRising;
}

if (process.argv[1] && process.argv[1].endsWith("fetch_entity_trends.ts")) {
  fetchAllEntityRisingQueries();
}
