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
 * 实时 Suggest 探针 (针对垂直赛道 + 别名 + US 英文环境定向，捕捉最前沿爆发词)
 */
async function fetchSuggestTrending(
  seed: string,
  category: string = "",
  aliases: string[] = []
): Promise<string[]> {
  const probeList = new Set<string>();

  // 1. 优先注入垂直赛道高价值痛点词根 (Dev / AI / Media / Tool / High Conversion)
  if (category === "大语言模型与代码助手") {
    const devSuffixes = [
      "byok", "api", "key", "proxy", "token", "pricing", "alternative", "free",
      "uncensored", "jailbreak", "system prompt", "webui", "ollama", "benchmark"
    ];
    for (const sfx of devSuffixes) {
      probeList.add(`${seed} ${sfx}`);
      for (const alias of aliases) {
        probeList.add(`${alias} ${sfx}`);
      }
    }
  } else if (category === "AI视频与生图") {
    const visualSuffixes = [
      "prompt", "free", "generator", "lora", "workflow", "comfyui",
      "uncensored", "no filter", "no restriction", "online", "model download"
    ];
    for (const sfx of visualSuffixes) {
      probeList.add(`${seed} ${sfx}`);
    }
  } else if (category === "AI音频与音乐") {
    const audioSuffixes = ["prompt", "free", "vocal", "cover", "lyrics", "realtime", "api", "voice clone"];
    for (const sfx of audioSuffixes) {
      probeList.add(`${seed} ${sfx}`);
    }
  }

  // 2. 基础种子词与别名基础探针
  probeList.add(seed);
  probeList.add(`${seed} `);
  for (const alias of aliases) {
    probeList.add(alias);
    probeList.add(`${alias} `);
  }

  const found = new Set<string>();
  const allAliasesLower = [seed.toLowerCase(), ...aliases.map(a => a.toLowerCase())];

  for (const p of probeList) {
    try {
      // 携带 gl=us&hl=en 确保优先捕捉北美与出海核心市场的最新爆发意图
      const res = await fetch(
        `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(p)}&gl=us&hl=en`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
          }
        }
      );
      if (res.ok) {
        const data = await res.json();
        const suggestions = data?.[1] || [];
        if (suggestions.length > 0) {
          const cleanProbe = p.trim().toLowerCase();
          const isExactSeedOrAlias = cleanProbe === seed.toLowerCase() || aliases.some(a => a.toLowerCase() === cleanProbe);
          if (!isExactSeedOrAlias && cleanProbe.length > 3) {
            found.add(cleanProbe);
          }
          for (const item of suggestions) {
            const clean = String(item).trim().toLowerCase();
            const isExact = clean === seed.toLowerCase() || aliases.some(a => a.toLowerCase() === clean);
            if (!isExact && clean.length > 3) {
              found.add(clean);
            }
          }
        }
      }
    } catch {}
  }
  return Array.from(found).slice(0, 120);
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

    // 1. Google Trends 全球大盘扫描
    try {
      const res = await trendsClient.fetchRelatedQueries(seed.entity, "today 1-m");
      if (res.rising && res.rising.length > 0) {
        console.log(`   🔥 Google Trends 全球发现 ${res.rising.length} 个飙升关联词:`);
        for (const item of res.rising) {
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
      console.warn(`   [-] Trends Explore 全球受限: ${err.message}`);
    }

    // 2. 针对代码助手与出海核心赛道，定向探测美国 (US) 重点市场
    if (seed.category === "大语言模型与代码助手" || seed.category === "出海B2C与社媒神器") {
      try {
        const resUs = await trendsClient.fetchRelatedQueries(seed.entity, "today 1-m", "US");
        if (resUs.rising && resUs.rising.length > 0) {
          console.log(`   🇺🇸 Google Trends 美国发现 ${resUs.rising.length} 个飙升关联词:`);
          for (const item of resUs.rising) {
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
        // 静默容灾
      }
    }

    // 3. 实时 Suggest 垂类意图探针 (常态化运行，0频控实时截获最新网民热搜)
    const suggestTerms = await fetchSuggestTrending(seed.entity, seed.category, seed.aliases || []);
    if (suggestTerms.length > 0) {
      console.log(`   💡 实时 Suggest 探针捕获 ${suggestTerms.length} 条网民高频搜索词`);
      for (const kw of suggestTerms) {
        allRising.push({
          query: kw,
          entity: seed.entity,
          entityDisplayName: seed.displayName,
          category: seed.category,
          value: 16000,
          formattedGrowth: "新热搜索",
          isBreakout: true,
          suggestedActionType: seed.suggestedActionType,
          fetchedAt: nowStr
        });
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
