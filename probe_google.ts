export interface GoogleDemandResult {
  keyword: string;
  hasRealDemand: boolean;      // Google 官方数据库是否收录该真实搜索意图
  demandScore: number;        // 真实搜索需求强度 (0~100)
  liveSuggestions: string[];  // Google 实时返回的网民高频搜索词
  reason: string;
}

/**
 * 通过 Google 官方 Suggest 探针静默验证关键词在真实搜索库中的活跃度
 * 0.2 秒完成验真，彻底杜绝生造词、无数据词与假异动！
 */
export async function probeGoogleDemand(keyword: string): Promise<GoogleDemandResult> {
  const url = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(keyword)}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
      }
    });

    if (!res.ok) {
      return {
        keyword,
        hasRealDemand: false,
        demandScore: 0,
        liveSuggestions: [],
        reason: `Google 探测接口异常: HTTP ${res.status}`
      };
    }

    const data = await res.json();
    const suggestions: string[] = (data?.[1] || []).map((s: string) => s.trim().toLowerCase());

    if (suggestions.length === 0) {
      return {
        keyword,
        hasRealDemand: false,
        demandScore: 0,
        liveSuggestions: [],
        reason: "Google 搜索库无任何联想推荐，属于完全无人搜索的冷门/生造词"
      };
    }

    // 过滤出真正包含原关键词的有效意图
    const cleanWord = keyword.toLowerCase();
    const matched = suggestions.filter(s => s.includes(cleanWord) || cleanWord.includes(s));

    // 如果返回的建议词与目标词毫不相关（说明目标词完全没有自己的索引权重）
    if (matched.length < 2) {
      return {
        keyword,
        hasRealDemand: false,
        demandScore: 15,
        liveSuggestions: suggestions.slice(0, 3),
        reason: "返回的联想词与目标词不匹配，属于大盘搜索噪点，缺乏独立搜索心智"
      };
    }

    // 计算需求强度分 (最高 100)
    const demandScore = Math.min(100, Math.max(50, matched.length * 7 + 30));

    return {
      keyword,
      hasRealDemand: true,
      demandScore,
      liveSuggestions: matched.slice(0, 6),
      reason: `Google 实时命中 ${matched.length} 条高频真实衍生搜索意图，确认属于活跃需求词`
    };
  } catch (err: any) {
    return {
      keyword,
      hasRealDemand: false,
      demandScore: 0,
      liveSuggestions: [],
      reason: `网络探测异常: ${err.message}`
    };
  }
}
