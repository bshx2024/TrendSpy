/**
 * Google Trends 官方底层 API 探针客户端 (Cookie Session + Widget Token 机制)
 * 支持免 Key 稳定拉取 Related Queries (Rising/Top) 与 Multiline Timeline 对比数据
 */

export interface RelatedQueryItem {
  query: string;
  value: number;
  formattedValue: string; // "Breakout" 或 "+350%" 或 "100"
  isBreakout: boolean;
}

export interface RelatedQueriesResult {
  keyword: string;
  top: RelatedQueryItem[];
  rising: RelatedQueryItem[];
}

export interface TimelinePoint {
  time: string;
  formattedTime: string;
  values: number[]; // [targetValue, benchmarkValue]
}

export interface TimelineCompareResult {
  targetKeyword: string;
  benchmarkKeyword: string;
  sumTarget: number;
  sumBenchmark: number;
  benchmarkRatio: number;      // e.g. 0.737 -> "GPTs × 0.737"
  peakTarget: number;
  currentMomentum: "上升中 ↗️" | "高位维持 ➡️" | "回落中 ↘️" | "底部沉睡 💤";
  firstSeenEstimate: string;
  breakoutEstimate: string;
  timeline: TimelinePoint[];
}

export class GoogleTrendsClient {
  private cookieCache: string = "";
  private cookieFetchedAt: number = 0;
  private readonly COOKIE_TTL = 30 * 60 * 1000; // 30 分钟缓存
  private readonly USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

  /**
   * 获取或复用 Google Trends 会话 Cookie
   */
  private async getSessionCookies(): Promise<string> {
    const now = Date.now();
    if (this.cookieCache && now - this.cookieFetchedAt < this.COOKIE_TTL) {
      return this.cookieCache;
    }

    try {
      const res = await fetch("https://trends.google.com/trends/", {
        headers: {
          "User-Agent": this.USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });

      const rawSetCookie = res.headers.get("set-cookie") || "";
      if (rawSetCookie) {
        this.cookieCache = rawSetCookie
          .split(/,\s*(?=[a-zA-Z0-9_-]+=)/)
          .map((c) => c.split(";")[0])
          .join("; ");
        this.cookieFetchedAt = now;
      }
      return this.cookieCache;
    } catch {
      return "";
    }
  }

  /**
   * 获取 Explore Widgets Token
   */
  private async fetchExploreWidgets(
    comparisonItems: Array<{ keyword: string; geo?: string; time?: string }>
  ): Promise<any[]> {
    const cookies = await this.getSessionCookies();
    const reqObj = {
      comparisonItem: comparisonItems.map((item) => ({
        keyword: item.keyword,
        geo: item.geo || "",
        time: item.time || "today 1-m"
      })),
      category: 0,
      property: ""
    };

    const url = `https://trends.google.com/trends/api/explore?hl=en-US&tz=-480&req=${encodeURIComponent(
      JSON.stringify(reqObj)
    )}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": this.USER_AGENT,
        Accept: "application/json, text/plain, */*",
        Cookie: cookies,
        Referer: "https://trends.google.com/trends/explore"
      }
    });

    if (!res.ok) {
      throw new Error(`Explore API returned HTTP ${res.status}`);
    }

    const text = await res.text();
    const cleanJson = text.replace(/^\)\]\}',?\s*/, "");
    const parsed = JSON.parse(cleanJson);
    return parsed.widgets || [];
  }

  /**
   * 抓取指定关键词的 Related Queries (TOP + RISING 飙升词)
   * 支持指定国家地区 (如 "US" 或默认全球 "")
   */
  public async fetchRelatedQueries(keyword: string, period = "today 1-m", geo = ""): Promise<RelatedQueriesResult> {
    try {
      const widgets = await this.fetchExploreWidgets([{ keyword, time: period, geo }]);
      const relatedWidget = widgets.find((w: any) => w.id === "RELATED_QUERIES");

      if (!relatedWidget) {
        return { keyword, top: [], rising: [] };
      }

      const cookies = await this.getSessionCookies();
      const relatedUrl = `https://trends.google.com/trends/api/widgetdata/relatedsearches?hl=en-US&tz=-480&req=${encodeURIComponent(
        JSON.stringify(relatedWidget.request)
      )}&token=${encodeURIComponent(relatedWidget.token)}`;

      const res = await fetch(relatedUrl, {
        headers: {
          "User-Agent": this.USER_AGENT,
          Cookie: cookies,
          Referer: "https://trends.google.com/trends/explore"
        }
      });

      if (!res.ok) {
        return { keyword, top: [], rising: [] };
      }

      const text = await res.text();
      const cleanJson = text.replace(/^\)\]\}',?\s*/, "");
      const parsed = JSON.parse(cleanJson);
      const rankedLists = parsed.default?.rankedList || [];

      const topList: RelatedQueryItem[] = [];
      const risingList: RelatedQueryItem[] = [];

      // List 0: Top, List 1: Rising
      if (rankedLists[0]?.rankedKeyword) {
        for (const item of rankedLists[0].rankedKeyword) {
          topList.push({
            query: item.query,
            value: Number(item.value) || 0,
            formattedValue: String(item.formattedValue || item.value),
            isBreakout: false
          });
        }
      }

      if (rankedLists[1]?.rankedKeyword) {
        for (const item of rankedLists[1].rankedKeyword) {
          const isBreakout = item.formattedValue === "Breakout" || item.value > 5000;
          risingList.push({
            query: item.query,
            value: Number(item.value) || 0,
            formattedValue: String(item.formattedValue || `+${item.value}%`),
            isBreakout
          });
        }
      }

      return { keyword, top: topList, rising: risingList };
    } catch (err: any) {
      console.warn(`[-] 抓取 [${keyword}] 相关飙升词失败: ${err.message}`);
      return { keyword, top: [], rising: [] };
    }
  }

  /**
   * 抓取目标词 vs 标尺词的时序折线并计算量化比率 (Benchmark Ratio)
   */
  public async fetchCompareTimeline(
    targetKeyword: string,
    benchmarkKeyword = "gpts",
    period = "today 1-m"
  ): Promise<TimelineCompareResult | null> {
    try {
      const widgets = await this.fetchExploreWidgets([
        { keyword: targetKeyword, time: period },
        { keyword: benchmarkKeyword, time: period }
      ]);

      const timeseriesWidget = widgets.find((w: any) => w.id === "TIMESERIES");
      if (!timeseriesWidget) return null;

      const cookies = await this.getSessionCookies();
      const multilineUrl = `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=-480&req=${encodeURIComponent(
        JSON.stringify(timeseriesWidget.request)
      )}&token=${encodeURIComponent(timeseriesWidget.token)}`;

      const res = await fetch(multilineUrl, {
        headers: {
          "User-Agent": this.USER_AGENT,
          Cookie: cookies,
          Referer: "https://trends.google.com/trends/explore"
        }
      });

      if (!res.ok) return null;

      const text = await res.text();
      const cleanJson = text.replace(/^\)\]\}',?\s*/, "");
      const parsed = JSON.parse(cleanJson);
      const rawTimeline = parsed.default?.timelineData || [];

      let sumTarget = 0;
      let sumBenchmark = 0;
      let peakTarget = 0;
      const targetValues: number[] = [];
      const timeline: TimelinePoint[] = [];

      let firstSeenDate = "";
      let breakoutDate = "";

      for (const point of rawTimeline) {
        const valTarget = point.value[0] || 0;
        const valBench = point.value[1] || 0;
        sumTarget += valTarget;
        sumBenchmark += valBench;
        if (valTarget > peakTarget) peakTarget = valTarget;

        targetValues.push(valTarget);
        timeline.push({
          time: point.time,
          formattedTime: point.formattedAxisTime || point.formattedTime || "",
          values: [valTarget, valBench]
        });

        // 首次出现估计 (首次 > 0)
        if (!firstSeenDate && valTarget > 0) {
          firstSeenDate = point.formattedAxisTime || point.formattedTime || "";
        }
        // 爆发点估计 (首次达到峰值的 50% 或 > 25)
        if (!breakoutDate && valTarget >= 25) {
          breakoutDate = point.formattedAxisTime || point.formattedTime || "";
        }
      }

      const benchmarkRatio = sumBenchmark > 0 ? sumTarget / sumBenchmark : 0;

      // 走势斜率计算 (近 5 天)
      const last5 = targetValues.slice(-5);
      let momentum: "上升中 ↗️" | "高位维持 ➡️" | "回落中 ↘️" | "底部沉睡 💤" = "底部沉睡 💤";

      if (last5.length > 0) {
        const diff = last5[last5.length - 1] - last5[0];
        const recentAvg = last5.reduce((a, b) => a + b, 0) / last5.length;

        if (recentAvg < 3) {
          momentum = "底部沉睡 💤";
        } else if (diff > 5) {
          momentum = "上升中 ↗️";
        } else if (diff < -5) {
          momentum = "回落中 ↘️";
        } else {
          momentum = "高位维持 ➡️";
        }
      }

      return {
        targetKeyword,
        benchmarkKeyword,
        sumTarget,
        sumBenchmark,
        benchmarkRatio,
        peakTarget,
        currentMomentum: momentum,
        firstSeenEstimate: firstSeenDate || "近期",
        breakoutEstimate: breakoutDate || firstSeenDate || "近期",
        timeline
      };
    } catch (err: any) {
      console.warn(`[-] 抓取 [${targetKeyword} vs ${benchmarkKeyword}] 时序失败: ${err.message}`);
      return null;
    }
  }

  /**
   * 独立单词 30 天时序探针 (用于准确追溯该词真实从 0 抬头的首发日)
   */
  public async fetchSingleTimeline(
    targetKeyword: string,
    period = "today 1-m"
  ): Promise<{
    peakTarget: number;
    firstSeenEstimate: string;
    breakoutEstimate: string;
    currentMomentum: "上升中 ↗️" | "高位维持 ➡️" | "回落中 ↘️" | "底部沉睡 💤";
    timeline: { time: string; formattedTime: string; value: number }[];
  } | null> {
    try {
      const widgets = await this.fetchExploreWidgets([{ keyword: targetKeyword, time: period }]);
      const timeseriesWidget = widgets.find((w: any) => w.id === "TIMESERIES");
      if (!timeseriesWidget) return null;

      const cookies = await this.getSessionCookies();
      const multilineUrl = `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=-480&req=${encodeURIComponent(
        JSON.stringify(timeseriesWidget.request)
      )}&token=${encodeURIComponent(timeseriesWidget.token)}`;

      const res = await fetch(multilineUrl, {
        headers: {
          "User-Agent": this.USER_AGENT,
          Cookie: cookies,
          Referer: "https://trends.google.com/trends/explore"
        }
      });

      if (!res.ok) return null;

      const text = await res.text();
      const cleanJson = text.replace(/^\)\]\}',?\s*/, "");
      const parsed = JSON.parse(cleanJson);
      const rawTimeline = parsed.default?.timelineData || [];

      let peakTarget = 0;
      const targetValues: number[] = [];
      const timeline: { time: string; formattedTime: string; value: number }[] = [];

      let firstSeenDate = "";
      let breakoutDate = "";

      for (const point of rawTimeline) {
        const valTarget = point.value?.[0] || 0;
        if (valTarget > peakTarget) peakTarget = valTarget;

        targetValues.push(valTarget);
        const fTime = point.formattedAxisTime || point.formattedTime || "";
        timeline.push({
          time: point.time,
          formattedTime: fTime,
          value: valTarget
        });

        // 首次抬头估计 (首次 > 0)
        if (!firstSeenDate && valTarget > 0) {
          firstSeenDate = fTime;
        }
        // 爆发点估计 (首次达到峰值的 40% 或 >= 20)
        if (!breakoutDate && valTarget >= 20) {
          breakoutDate = fTime;
        }
      }

      // 走势斜率计算 (近 5 天)
      const last5 = targetValues.slice(-5);
      let momentum: "上升中 ↗️" | "高位维持 ➡️" | "回落中 ↘️" | "底部沉睡 💤" = "底部沉睡 💤";

      if (last5.length > 0) {
        const diff = last5[last5.length - 1] - last5[0];
        const recentAvg = last5.reduce((a, b) => a + b, 0) / last5.length;

        if (recentAvg < 3) {
          momentum = "底部沉睡 💤";
        } else if (diff >= 10) {
          momentum = "上升中 ↗️";
        } else if (diff <= -10) {
          momentum = "回落中 ↘️";
        } else {
          momentum = "高位维持 ➡️";
        }
      }

      return {
        peakTarget,
        firstSeenEstimate: firstSeenDate,
        breakoutEstimate: breakoutDate || firstSeenDate,
        currentMomentum: momentum,
        timeline
      };
    } catch {
      return null;
    }
  }

  /**
   * 12 个月历史基线探针 (Evergreen vs True Emerging Filter)
   * 检查过去 12 个月中前 75% 时间段（即 3~12 个月前）的历史平均热度
   * 如果前 75% 时间平均热度 >= 15，说明是存在多年的常青老词 (Evergreen)；
   * 如果前 75% 时间平均热度 < 10 (贴地)，说明是近 1~3 个月真正诞生的纯新词 (True Breakout)！
   */
  public async checkHistoricalBaseline(keyword: string): Promise<{
    isTrueNewTerm: boolean;
    historicalBaselineAvg: number;
    reason: string;
  }> {
    try {
      const widgets = await this.fetchExploreWidgets([{ keyword, time: "today 12-m" }]);
      const timeseriesWidget = widgets.find((w: any) => w.id === "TIMESERIES");
      if (!timeseriesWidget) {
        return { isTrueNewTerm: true, historicalBaselineAvg: 0, reason: "查无长期数据，默认视为新词" };
      }

      const cookies = await this.getSessionCookies();
      const multilineUrl = `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=-480&req=${encodeURIComponent(
        JSON.stringify(timeseriesWidget.request)
      )}&token=${encodeURIComponent(timeseriesWidget.token)}`;

      const res = await fetch(multilineUrl, {
        headers: {
          "User-Agent": this.USER_AGENT,
          Cookie: cookies,
          Referer: "https://trends.google.com/trends/explore"
        }
      });

      if (!res.ok) {
        // Fallback: 启发式规则识别传统常青词
        const isGenericTool = /\b(maker|generator|template|calculator|converter|invoice|receipt|resume|builder)\b/i.test(keyword) &&
                              !/\b(ai|sora|flux|kling|higgsfield|claude|deepseek|genjutsu|migos|capafy)\b/i.test(keyword);
        if (isGenericTool) {
          return { isTrueNewTerm: false, historicalBaselineAvg: 35, reason: "通用传统工具词规则识别 (Evergreen)" };
        }
        return { isTrueNewTerm: true, historicalBaselineAvg: 0, reason: "时序响应受限" };
      }

      const text = await res.text();
      const cleanJson = text.replace(/^\)\]\}',?\s*/, "");
      const parsed = JSON.parse(cleanJson);
      const points = parsed.default?.timelineData || [];

      if (points.length < 15) {
        return { isTrueNewTerm: true, historicalBaselineAvg: 0, reason: "历史数据点较少" };
      }

      // 取前 75% 的点位 (即 3 个月到 12 个月前的大盘历史均值)
      const historicalPoints = points.slice(0, Math.floor(points.length * 0.75));
      const historicalSum = historicalPoints.reduce((acc: number, p: any) => acc + (p.value?.[0] || 0), 0);
      const historicalAvg = historicalSum / historicalPoints.length;

      if (historicalAvg >= 15) {
        return {
          isTrueNewTerm: false,
          historicalBaselineAvg: Number(historicalAvg.toFixed(1)),
          reason: `历史 12 个月前大盘平均热度 ${historicalAvg.toFixed(1)}，属于多年存在的常青工具词`
        };
      }

      return {
        isTrueNewTerm: true,
        historicalBaselineAvg: Number(historicalAvg.toFixed(1)),
        reason: `历史上绝大部分时间贴地 (${historicalAvg.toFixed(1)}分)，属于近期突发诞生的纯新词`
      };
    } catch {
      return { isTrueNewTerm: true, historicalBaselineAvg: 0, reason: "历史探测跳过" };
    }
  }
}

export const trendsClient = new GoogleTrendsClient();

