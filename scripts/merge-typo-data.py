#!/usr/bin/env python3
"""
Merge all useful proofread datasets into the project's typo-data.json.

Sources:
  useful/common_error_pairs.txt   (106) tab-sep wrong→correct
  useful/custom_confusion.txt     (1370) tab-sep wrong→correct→freq  (pycorrector)
  useful/my_custom_confusion.txt  (13) space-sep wrong→correct
  useful/mcsc_test.tsv            (999) tab-sep wrong→correct  (medical)
  useful/train.json               (2336) sentence pairs with wrong_ids
  useful/test.json                (1100) sentence pairs with wrong_ids

Output: src/proofread/typo-data.json  {wrong: correct, ...}
"""
import json, os, re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
USEFUL = os.path.join(BASE, 'src', 'proofread', 'useful')
OUTPUT = os.path.join(BASE, 'src', 'proofread', 'typo-data.json')

# Start with existing entries (flatten grouped JSON)
final = {}
if os.path.exists(OUTPUT):
    with open(OUTPUT, encoding='utf-8') as f:
        raw = json.load(f)
    for entries in raw.values():
        final.update(entries)
    print(f'Loaded existing {len(final)} entries')

def add(w, c, source):
    """Add a wrong→correct pair if multi-char and not already present."""
    if w and c and w != c and len(w) > 1 and w not in final:
        final[w] = c
        return True
    return False

# ═══════════════════════════════════════════════════════════════
# 1. common_error_pairs.txt — tab-separated wrong\tcorrect
# ═══════════════════════════════════════════════════════════════
path = os.path.join(USEFUL, 'common_error_pairs.txt')
n = 0
if os.path.exists(path):
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split('\t')
            if len(parts) >= 2:
                if add(parts[0].strip(), parts[1].strip(), 'common_error_pairs'):
                    n += 1
    print(f'[1] common_error_pairs.txt: {n} entries added')

# ═══════════════════════════════════════════════════════════════
# 2. custom_confusion.txt — tab-separated wrong\tcorrect\t[freq]
# ═══════════════════════════════════════════════════════════════
path = os.path.join(USEFUL, 'custom_confusion.txt')
n = 0
if os.path.exists(path):
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split('\t')
            if len(parts) < 2:
                parts = line.split()
            if len(parts) >= 2:
                w = parts[0].strip()
                c = parts[1].strip()
                # Skip "same word" pairs (whitelist entries like "萧华 萧华")
                if w == c:
                    continue
                if add(w, c, 'custom_confusion'):
                    n += 1
    print(f'[2] custom_confusion.txt: {n} new entries added')

# ═══════════════════════════════════════════════════════════════
# 3. my_custom_confusion.txt — space-separated wrong\tcorrect\t[freq]
# ═══════════════════════════════════════════════════════════════
path = os.path.join(USEFUL, 'my_custom_confusion.txt')
n = 0
if os.path.exists(path):
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split()
            if len(parts) >= 2:
                w, c = parts[0].strip(), parts[1].strip()
                if w == c:
                    continue
                if add(w, c, 'my_custom_confusion'):
                    n += 1
    print(f'[3] my_custom_confusion.txt: {n} new entries added')

# ═══════════════════════════════════════════════════════════════
# 4. mcsc_test.tsv — medical domain, tab-separated wrong\tcorrect
# ═══════════════════════════════════════════════════════════════
path = os.path.join(USEFUL, 'mcsc_test.tsv')
n = 0
if os.path.exists(path):
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split('\t')
            if len(parts) >= 2:
                w, c = parts[0].strip(), parts[1].strip()
                if w == c:
                    continue
                if add(w, c, 'mcsc'):
                    n += 1
    print(f'[4] mcsc_test.tsv (medical): {n} new entries added')

# ═══════════════════════════════════════════════════════════════
# 5. train.json / test.json — sentence pairs with wrong_ids
#    Extract wrong→correct pairs by comparing original vs correct at wrong positions
# ═══════════════════════════════════════════════════════════════
def extract_from_json_sentences(filepath):
    """Extract multi-char wrong→correct pairs from JSON sentence pairs."""
    count = 0
    try:
        with open(filepath, encoding='utf-8') as f:
            data = json.load(f)
    except:
        return 0

    for item in data:
        orig = item.get('original_text', '')
        corr = item.get('correct_text', '')
        wrong_ids = item.get('wrong_ids', [])

        if not orig or not corr or not wrong_ids:
            continue

        # Find consecutive ranges in wrong_ids
        ranges = []
        start = wrong_ids[0]
        end = wrong_ids[0]
        for i in range(1, len(wrong_ids)):
            if wrong_ids[i] == end + 1:
                end = wrong_ids[i]
            else:
                ranges.append((start, end))
                start = wrong_ids[i]
                end = wrong_ids[i]
        ranges.append((start, end))

        for s, e in ranges:
            wrong_seg = orig[s:e+1]
            correct_seg = corr[s:e+1]
            source_name = os.path.basename(filepath)
            if add(wrong_seg, correct_seg, source_name):
                count += 1
    return count

n = extract_from_json_sentences(os.path.join(USEFUL, 'train.json'))
print(f'[5a] train.json: {n} new entries extracted')

n = extract_from_json_sentences(os.path.join(USEFUL, 'test.json'))
print(f'[5b] test.json: {n} new entries extracted')

# ═══════════════════════════════════════════════════════════════
# Summary & save
# ═══════════════════════════════════════════════════════════════
print(f'\nTotal unique entries in typo-data.json: {len(final)}')

# Group by word length before saving
grouped = {}
for wrong, correct in final.items():
    length = len(wrong)
    key = str(length) if length <= 6 else '7+'
    grouped.setdefault(key, {})[wrong] = correct

os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
with open(OUTPUT, 'w', encoding='utf-8') as f:
    json.dump(grouped, f, ensure_ascii=False, indent=2)

size_kb = os.path.getsize(OUTPUT) / 1024
for k in sorted(grouped.keys(), key=lambda x: int(x[0]) if x[0].isdigit() else 99):
    print(f'  {k}字: {len(grouped[k])} 条')
print(f'Saved: {OUTPUT} ({size_kb:.1f} KB)')
