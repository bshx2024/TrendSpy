import json
import os
import sys
import time
from datetime import datetime
import urllib.request
import urllib.error

# 监控的高价值板块
SUBREDDITS = [
    "SideProject",
    "InternetIsBeautiful",
    "webdev",
    "CoolGithubProjects",
    "ChatGPTCoding",
    "IndieHackers"
]

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "raw_reddit_posts.json")

def fetch_subreddit(subreddit, listing="hot", limit=25):
    """
    通过 Reddit 原生免 API 的 .json 端点拉取帖子
    """
    url = f"https://www.reddit.com/r/{subreddit}/{listing}.json?limit={limit}"
    
    # 模拟真实浏览器请求头，避免被 Reddit 限流或 429 拦截
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 TrendSpy/1.0"
    }

    req = urllib.request.Request(url, headers=headers)
    
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                posts = []
                for child in data.get("data", {}).get("children", []):
                    post_data = child.get("data", {})
                    # 过滤置顶贴 (stickied)
                    if post_data.get("stickied"):
                        continue
                    
                    # 整理精简信息，方便大模型后续精准提词
                    posts.append({
                        "id": post_data.get("id"),
                        "subreddit": subreddit,
                        "title": post_data.get("title", "").strip(),
                        "selftext": (post_data.get("selftext", "") or "")[:500].strip(), # 截取前 500 字，提炼需求足够
                        "score": post_data.get("score", 0),
                        "num_comments": post_data.get("num_comments", 0),
                        "permalink": f"https://reddit.com{post_data.get('permalink')}",
                        "created_utc": post_data.get("created_utc")
                    })
                return posts
    except urllib.error.HTTPError as e:
        print(f"[-] HTTP Error [{e.code}] on r/{subreddit}: {e.reason}")
    except urllib.error.URLError as e:
        print(f"[-] Network Error on r/{subreddit}: {e.reason}")
    except Exception as e:
        print(f"[-] Unknown error on r/{subreddit}: {str(e)}")
    
    return []

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    all_posts = []
    
    print("=" * 60)
    print("🚀 开始采集 Reddit 热门出海与独立开发社区...")
    print("=" * 60)

    for sub in SUBREDDITS:
        print(f"[*] 正在抓取 r/{sub} ...")
        # 抓取 hot 和 top (当周高赞) 保证样本质量
        posts = fetch_subreddit(sub, listing="hot", limit=20)
        print(f"    -> 成功抓取 {len(posts)} 篇帖子")
        all_posts.extend(posts)
        time.sleep(1.5)  # 礼貌间隔，防止触碰 Reddit 频控

    # 按点赞数 score 倒序排序
    all_posts.sort(key=lambda x: x["score"], reverse=True)

    result = {
        "fetched_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_posts": len(all_posts),
        "posts": all_posts
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print("=" * 60)
    print(f"🎉 抓取完成！共收集 {len(all_posts)} 条高质量帖子。")
    print(f"📁 原始数据已保存至: {OUTPUT_FILE}")
    print("=" * 60)

if __name__ == "__main__":
    main()
