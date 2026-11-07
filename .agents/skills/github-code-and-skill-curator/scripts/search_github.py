#!/usr/bin/env python3
"""
GitHub Search Helper Script for PTUD_NuoiThu
Searches GitHub repositories using the public REST API and returns top-rated,
compatible open-source implementations for features and architecture patterns.
"""

import argparse
import json
import sys
import urllib.request
import urllib.error
import urllib.parse

# Force UTF-8 stdout for Windows terminals
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def search_github(query: str, lang: str = "", min_stars: int = 10, limit: int = 5):
    # Construct search query
    q_parts = [query]
    if lang:
        q_parts.append(f"language:{lang}")
    if min_stars > 0:
        q_parts.append(f"stars:>={min_stars}")
    
    full_query = " ".join(q_parts)
    encoded_query = urllib.parse.quote(full_query)
    url = f"https://api.github.com/search/repositories?q={encoded_query}&sort=stars&order=desc&per_page={limit}"
    
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Antigravity-Agent-GitHubCurator/1.0",
            "Accept": "application/vnd.github.v3+json"
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                items = data.get("items", [])
                total_count = data.get("total_count", 0)
                
                print(f"\n[INFO] Tìm thấy {total_count} repositories phù hợp trên GitHub (Hiển thị Top {min(limit, len(items))}):")
                print("=" * 80)
                
                for idx, repo in enumerate(items, 1):
                    name = repo.get("full_name", "")
                    stars = repo.get("stargazers_count", 0)
                    desc = repo.get("description") or "Không có mô tả"
                    html_url = repo.get("html_url", "")
                    language = repo.get("language") or "N/A"
                    license_name = (repo.get("license") or {}).get("spdx_id") or "N/A"
                    updated = (repo.get("updated_at") or "")[:10]
                    topics = ", ".join(repo.get("topics", [])[:4])
                    
                    print(f"[{idx}] {name} (Stars: {stars} | Lang: {language} | License: {license_name} | Updated: {updated})")
                    print(f"    URL: {html_url}")
                    print(f"    Mô tả: {desc}")
                    if topics:
                        print(f"    Topics: {topics}")
                    print("-" * 80)
                return items
    except urllib.error.HTTPError as e:
        if e.code == 403:
            print("[WARN] Đã chạm giới hạn GitHub API Rate Limit (không cần token). Vui lòng thử lại sau ít phút hoặc sử dụng tìm kiếm qua Web.")
        else:
            print(f"[ERROR] Lỗi HTTP khi truy vấn GitHub API: {e.code} {e.reason}")
    except Exception as e:
        print(f"[ERROR] Lỗi kết nối GitHub API: {e}")
    return []

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Tìm kiếm repositories GitHub chất lượng cao cho PTUD_NuoiThu")
    parser.add_argument("--query", "-q", required=True, help="Từ khóa tìm kiếm (ví dụ: 'electron transparent pet')")
    parser.add_argument("--lang", "-l", default="TypeScript", help="Ngôn ngữ lập trình (mặc định: TypeScript)")
    parser.add_argument("--min-stars", "-s", type=int, default=10, help="Số sao tối thiểu (mặc định: 10)")
    parser.add_argument("--limit", "-n", type=int, default=5, help="Số lượng kết quả trả về (mặc định: 5)")
    
    args = parser.parse_args()
    search_github(args.query, args.lang, args.min_stars, args.limit)
