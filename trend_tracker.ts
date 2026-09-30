import fs from "node:fs";
import path from "node:path";

const CURRENT_DIR = typeof import.meta.dirname !== "undefined"
  ? import.meta.dirname
  : path.resolve();
const DATA_DIR = path.join(CURRENT_DIR, "data");
const DATABASE_FILE = path.join(DATA_DIR, "timeline_database.json");

export interface StoredKeywordRecord {
  keyword: string;
  entity: string;
  category: string;
  firstSeenDate: string;        // "2026-09-18"
  breakoutDate: string;         // "2026-09-22"
  lastSeenDate: string;         // "2026-09-29"
  historyRatios: Array<{ date: string; ratio: number; value: number }>;
  peakRatio: number;
  latestRatio: number;
  lifecycleStage: "新词首次爆发" | "老词二次爆火" | "常青大盘老词" | "高涨幅上升词" | "平稳维持" | "过气阴跌";
  suggestedAction: string;
}

export interface TimelineDatabase {
  updatedAt: string;
  records: Record<string, StoredKeywordRecord>;
}

export class TrendTracker {
  private db: TimelineDatabase;

  constructor() {
    this.db = this.loadDatabase();
  }

  private loadDatabase(): TimelineDatabase {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DATABASE_FILE)) {
      try {
        const content = fs.readFileSync(DATABASE_FILE, "utf-8");
        return JSON.parse(content);
      } catch {
        // fallback to empty
      }
    }

    return {
      updatedAt: new Date().toISOString(),
      records: {}
    };
  }

  public saveDatabase(): void {
    this.db.updatedAt = new Date().toISOString();
    fs.writeFileSync(DATABASE_FILE, JSON.stringify(this.db, null, 2), "utf-8");
  }

  /**
   * 记录或更新关键词的时序轨迹并计算生命周期状态
   */
  public trackKeyword(params: {
    keyword: string;
    entity: string;
    category: string;
    ratio: number;
    value: number;
    growthFormatted: string;
    isBreakout: boolean;
    firstSeenEstimate?: string;
    breakoutEstimate?: string;
    suggestedAction?: string;
  }): StoredKeywordRecord {
    const key = params.keyword.trim().toLowerCase();
    const todayStr = new Date().toISOString().split("T")[0];
    const existing = this.db.records[key];

    if (!existing) {
      // 首次出现的新词
      const firstSeen = params.firstSeenEstimate || todayStr;
      const breakout = params.isBreakout ? (params.breakoutEstimate || todayStr) : "";
      const stage = params.isBreakout || params.ratio >= 0.3 ? "新词首次爆发" : "高涨幅上升词";

      const newRecord: StoredKeywordRecord = {
        keyword: params.keyword,
        entity: params.entity,
        category: params.category,
        firstSeenDate: firstSeen,
        breakoutDate: breakout || todayStr,
        lastSeenDate: todayStr,
        historyRatios: [{ date: todayStr, ratio: params.ratio, value: params.value }],
        peakRatio: params.ratio,
        latestRatio: params.ratio,
        lifecycleStage: stage,
        suggestedAction: params.suggestedAction || "极速上线单页工具/提示词库"
      };

      this.db.records[key] = newRecord;
      return newRecord;
    }

    // 已有历史记录：判断是否为老词二次爆火
    const daysSinceFirstSeen = Math.floor(
      (new Date(todayStr).getTime() - new Date(existing.firstSeenDate).getTime()) / (1000 * 3600 * 24)
    );

    let stage: StoredKeywordRecord["lifecycleStage"] = existing.lifecycleStage;

    // 如果该词首次记录已经超过 7 天，且之前热度曾回落，现在重新突破
    if (daysSinceFirstSeen >= 7 && (params.isBreakout || params.ratio > existing.latestRatio * 1.5)) {
      stage = "老词二次爆火";
    } else if (existing.lifecycleStage === "新词首次爆发") {
      stage = "新词首次爆发";
    } else if (params.isBreakout || params.ratio >= 0.3) {
      stage = "高涨幅上升词";
    }

    existing.lastSeenDate = todayStr;
    existing.latestRatio = params.ratio;
    if (params.ratio > existing.peakRatio) {
      existing.peakRatio = params.ratio;
    }
    existing.lifecycleStage = stage;
    existing.historyRatios.push({ date: todayStr, ratio: params.ratio, value: params.value });
    if (params.suggestedAction) {
      existing.suggestedAction = params.suggestedAction;
    }

    return existing;
  }

  public getRecord(keyword: string): StoredKeywordRecord | undefined {
    return this.db.records[keyword.trim().toLowerCase()];
  }

  public getAllRecords(): StoredKeywordRecord[] {
    return Object.values(this.db.records);
  }
}

export const trendTracker = new TrendTracker();
