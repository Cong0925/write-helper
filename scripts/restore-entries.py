#!/usr/bin/env python3
"""Restore all 2-char entries from original pycorrector data."""
import json

DICT = 'src/proofread/typo-data.json'
RAW = 'scripts/confusion_raw.txt'

# 1. Load current entries
d = {}
current = json.load(open(DICT, encoding='utf-8'))
for entries in current.values():
    d.update(entries)
print(f'Current entries: {len(d)}')

# 2. Add ALL entries from original pycorrector data
raw = {}
with open(RAW, encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        parts = line.split('\t')
        if len(parts) < 2:
            parts = line.split()
        if len(parts) >= 2:
            w, c = parts[0].strip(), parts[1].strip()
            if w and c and w != c:
                raw[w] = c

added = 0
for w, c in raw.items():
    if w not in d:
        d[w] = c
        added += 1
print(f'Added from pycorrector: {added}')

# 3. Add common extras
extras = {
    '登陆': '登录', '登入': '登录', '帐号': '账号', '帐户': '账户',
    '以经': '已经', '早以': '早已', '必竞': '毕竟',
    '在说': '再说', '在做': '再做', '在来': '再来',
    '在次': '再次', '在考虑': '再考虑', '在见': '再见',
    '既使': '即使', '即然': '既然',
    '听将': '听讲', '决对': '绝对',
    '不可思意': '不可思议', '银行帐号': '银行账号',
    '用户帐号': '用户账号',
}
for w, c in extras.items():
    if w not in d:
        d[w] = c
        added += 1
    elif d[w] != c:
        d[w] = c
print(f'Added extras: {len(extras)} checked')

# 4. Regroup by word length
grouped = {}
for wrong, correct in d.items():
    length = len(wrong)
    key = str(length) if length <= 6 else '7+'
    grouped.setdefault(key, {})[wrong] = correct

for k in sorted(grouped.keys(), key=lambda x: int(x[0]) if x[0].isdigit() else 99):
    print(f'  {k}字: {len(grouped[k])} 条')
print(f'Total: {sum(len(v) for v in grouped.values())}')

with open(DICT, 'w', encoding='utf-8') as f:
    json.dump(grouped, f, ensure_ascii=False, indent=2)
print('Saved.')
