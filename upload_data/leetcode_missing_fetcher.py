"""
LeetCode Missing Problems Fetcher v1.0
Fetches ONLY problems missing from your existing Leetcode.xlsx
and appends them to the file.
"""

import requests
import json
import time
import re
import os
from html import unescape

# pip install openpyxl pandas
import pandas as pd

GRAPHQL_URL = "https://leetcode.com/graphql"

HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://leetcode.com/problemset/all/",
}

PROBLEMSET_QUERY = """
query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
    problemsetQuestionList: questionList(
        categorySlug: $categorySlug
        limit: $limit
        skip: $skip
        filters: $filters
    ) {
        total: totalNum
        questions: data {
            acRate
            difficulty
            frontendQuestionId: questionFrontendId
            paidOnly: isPaidOnly
            title
            titleSlug
            topicTags {
                name
            }
        }
    }
}
"""

PROBLEM_DETAIL_QUERY = """
query questionContent($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        content
    }
}
"""

PROGRESS_FILE = "missing_progress.json"
INPUT_FILE = "Leetcode.xlsx"
OUTPUT_FILE = "Leetcode.xlsx"


def strip_html(html_str):
    if not html_str:
        return ""
    text = re.sub(r'<[^>]+>', ' ', html_str)
    text = unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def fetch_all_leetcode_problems():
    """Fetch complete problem list from LeetCode."""
    all_problems = []
    skip = 0
    total = None
    batch_size = 100

    print("Step 1: Fetching full problem list from LeetCode...")
    print("-" * 50)

    while True:
        payload = {
            "query": PROBLEMSET_QUERY,
            "variables": {
                "categorySlug": "",
                "skip": skip,
                "limit": batch_size,
                "filters": {}
            }
        }
        try:
            resp = requests.post(GRAPHQL_URL, json=payload, headers=HEADERS, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            qlist = data["data"]["problemsetQuestionList"]

            if total is None:
                total = qlist["total"]
                print(f"Total problems on LeetCode: {total}")

            questions = qlist["questions"]
            if not questions:
                break

            all_problems.extend(questions)
            print(f"  Fetched {len(all_problems)}/{total}...")

            skip += batch_size
            if skip >= total:
                break
            time.sleep(1)

        except Exception as e:
            print(f"  Error at skip={skip}: {e}, retrying...")
            time.sleep(5)
            continue

    print(f"Got {len(all_problems)} problems from LeetCode.\n")
    return all_problems


def fetch_description(title_slug):
    """Fetch short description for one problem."""
    payload = {
        "query": PROBLEM_DETAIL_QUERY,
        "variables": {"titleSlug": title_slug}
    }
    resp = requests.post(GRAPHQL_URL, json=payload, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    content = resp.json().get("data", {}).get("question", {}).get("content", "")
    if not content:
        return "(Premium or unavailable)"
    plain = strip_html(content)
    if len(plain) > 200:
        return plain[:200].rsplit(' ', 1)[0] + "..."
    return plain


def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_progress(data):
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)


def main():
    # Load existing Excel
    print(f"Loading existing file: {INPUT_FILE}")
    df = pd.read_excel(INPUT_FILE)
    existing_ids = set(df['P_ID'].dropna().astype(int).tolist())
    print(f"Existing problems in Excel: {len(existing_ids)}")
    print(f"Columns: {df.columns.tolist()}\n")

    # Fetch all problems from LeetCode
    all_lc = fetch_all_leetcode_problems()

    # Find missing
    missing = []
    for p in all_lc:
        pid = int(p["frontendQuestionId"])
        if pid not in existing_ids:
            missing.append(p)

    print(f"Step 2: Found {len(missing)} missing problems!")
    if not missing:
        print("Nothing to add. Your Excel is up to date!")
        return

    missing.sort(key=lambda x: int(x["frontendQuestionId"]))
    print(f"Missing IDs: {[int(p['frontendQuestionId']) for p in missing[:20]]}{'...' if len(missing)>20 else ''}\n")

    # Fetch descriptions for missing problems (with resume)
    print("Step 3: Fetching descriptions for missing problems...")
    print("-" * 50)
    progress = load_progress()

    for i, p in enumerate(missing):
        slug = p["titleSlug"]
        if slug in progress:
            continue
        try:
            desc = fetch_description(slug)
            progress[slug] = desc
            if (i + 1) % 10 == 0 or (i + 1) == len(missing):
                print(f"  Descriptions: {len(progress)}/{len(missing)}")
                save_progress(progress)
            time.sleep(1.5)
        except Exception as e:
            print(f"  Error on '{slug}': {e}")
            progress[slug] = "(Error fetching)"
            save_progress(progress)
            time.sleep(5)

    save_progress(progress)
    print(f"All {len(progress)} descriptions fetched!\n")

    # Build new rows matching Excel columns: P_ID, Problem Name, Topics, Description, R1-R5, Difficulty
    new_rows = []
    for p in missing:
        slug = p["titleSlug"]
        new_rows.append({
            "P_ID": int(p["frontendQuestionId"]),
            "Problem Name": p["title"],
            "Topics": ", ".join([t["name"] for t in p.get("topicTags", [])]),
            "Description": progress.get(slug, ""),
            "R1": "",
            "R2": "",
            "R3": "",
            "R4": "",
            "R5": "",
            "Difficulty": p["difficulty"],
        })

    new_df = pd.DataFrame(new_rows)
    combined = pd.concat([df, new_df], ignore_index=True)

    # Sort by P_ID
    combined['P_ID'] = combined['P_ID'].astype(int)
    combined.sort_values('P_ID', inplace=True)
    combined.reset_index(drop=True, inplace=True)

    # Save
    combined.to_excel(OUTPUT_FILE, index=False)
    print(f"Step 4: Saved {OUTPUT_FILE}")
    print(f"  Previous: {len(df)} problems")
    print(f"  Added:    {len(new_rows)} new problems")
    print(f"  Total:    {len(combined)} problems")

    # Cleanup progress file
    if os.path.exists(PROGRESS_FILE):
        os.remove(PROGRESS_FILE)

    print("\nDone!")


if __name__ == "__main__":
    main()
