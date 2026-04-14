import re
from typing import Any

TYRE_COMPOUNDS_INTS = {
    "SOFT": 0,
    "MEDIUM": 1,
    "HARD": 2,
    "INTERMEDIATE": 3,
    "WET": 4,
}

def get_tyre_compound_int(compound_str: Any) -> int:
    if compound_str is None:
        return -1
    
    s = str(compound_str).strip()
    if not s or s.lower() in ("nan", "none"):
        return -1
    
    return int(TYRE_COMPOUNDS_INTS.get(s.upper(), -1))

def tyre_index_for_frame(compound_str: Any) -> int:
    base = get_tyre_compound_int(compound_str)
    if base >= 0:
        return base
    
    s = str(compound_str).strip() if compound_str is not None else ""
    if not s or s.lower() in ("nan", "none", "unknown"):
        return -1
    
    u = s.upper()
    m = re.search(r"\bC(\d)\b", u)
    if m:
        n = int(m.group(1))
        if 1 <= n <= 5:
            if n <= 2:
                return 2
            if n == 3:
                return 1
            return 0
    if "WET" in u:
        return 4
    if "INTER" in u or "INTERMEDIATE" in s.lower():
        return 3
    if "HARD" in u:
        return 2
    if "MEDIUM" in u:
        return 1
    if "SOFT" in u:
        return 0
    return -1
