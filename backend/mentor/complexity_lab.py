"""Step-Count Complexity Lab comparing algorithms deterministically via tracer.py."""

from __future__ import annotations

from pydantic import BaseModel

from mentor.tracer import trace_python_code


class ComplexitySideSpec(BaseModel):
    """One algorithm implementation inside a complexity comparison pair."""

    label: str
    big_o: str
    description: str


class ComplexityPairMeta(BaseModel):
    """Metadata describing an interactive step-count comparison pair."""

    id: str
    title: str
    subtitle: str
    min_n: int
    max_n: int
    step_n: int
    default_n: int
    takeaway: str
    left: ComplexitySideSpec
    right: ComplexitySideSpec


COMPLEXITY_PAIRS: list[ComplexityPairMeta] = [
    ComplexityPairMeta(
        id="linear_vs_binary",
        title="Searching a Sorted List",
        subtitle="Worst-case lookup for the final item in a sorted list of size N",
        min_n=8,
        max_n=64,
        step_n=8,
        default_n=32,
        takeaway="Doubling N doubles Linear Scan steps, while Binary Search only adds ~1 extra check.",
        left=ComplexitySideSpec(
            label="Linear Scan",
            big_o="O(n)",
            description="Checks items one by one from index 0 to the end.",
        ),
        right=ComplexitySideSpec(
            label="Binary Search",
            big_o="O(log n)",
            description="Cuts the remaining search range in half every iteration.",
        ),
    ),
    ComplexityPairMeta(
        id="nested_vs_set_dups",
        title="Finding Duplicate Numbers",
        subtitle="Checking whether a list of N numbers contains a duplicate",
        min_n=8,
        max_n=40,
        step_n=4,
        default_n=20,
        takeaway="Nested loops multiply work (N x N), whereas a set/hash lookup checks each item once.",
        left=ComplexitySideSpec(
            label="Nested Loop Pair Check",
            big_o="O(n^2)",
            description="Compares every index i against every later index j.",
        ),
        right=ComplexitySideSpec(
            label="Hash Set Seen Tracker",
            big_o="O(n)",
            description="Remembers seen values in a set for instant membership checks.",
        ),
    ),
    ComplexityPairMeta(
        id="fib_recursive_vs_memo",
        title="Repeated Subproblems (Fibonacci)",
        subtitle="Computing fib(N) with naive recursion vs. caching results in a dict",
        min_n=4,
        max_n=12,
        step_n=1,
        default_n=9,
        takeaway="Caching solved subproblems inside a dict turns explosive branching into linear steps.",
        left=ComplexitySideSpec(
            label="Naive Tree Recursion",
            big_o="O(2^n)",
            description="Recomputes the exact same smaller fib() calls over and over.",
        ),
        right=ComplexitySideSpec(
            label="Memoized Dict Cache",
            big_o="O(n)",
            description="Computes each value once and saves it inside memo[n].",
        ),
    ),
]


def _build_pair_code(pair_id: str, n: int) -> tuple[str, str]:
    if pair_id == "linear_vs_binary":
        left = f"""nums = list(range({n}))
target = {n - 1}
found = -1
for i in range(len(nums)):
    if nums[i] == target:
        found = i
        break
print("Found:", found)
"""
        right = f"""nums = list(range({n}))
target = {n - 1}
low = 0
high = len(nums) - 1
found = -1
while low <= high:
    mid = (low + high) // 2
    if nums[mid] == target:
        found = mid
        break
    elif nums[mid] < target:
        low = mid + 1
    else:
        high = mid - 1
print("Found:", found)
"""
        return left, right

    if pair_id == "nested_vs_set_dups":
        left = f"""nums = list(range({n}))
has_dup = False
for i in range(len(nums)):
    for j in range(i + 1, len(nums)):
        if nums[i] == nums[j]:
            has_dup = True
print("Duplicate:", has_dup)
"""
        right = f"""nums = list(range({n}))
seen = set()
has_dup = False
for x in nums:
    if x in seen:
        has_dup = True
        break
    seen.add(x)
print("Duplicate:", has_dup)
"""
        return left, right

    # fib_recursive_vs_memo
    left = f"""def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib({n}))
"""
    right = f"""memo = {{}}
def fib(n):
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fib(n - 1) + fib(n - 2)
    return memo[n]

print(fib({n}))
"""
    return left, right


def get_complexity_pairs() -> list[ComplexityPairMeta]:
    """Return metadata for all Step-Count Complexity Lab comparisons."""
    return COMPLEXITY_PAIRS


def run_complexity_comparison(pair_id: str, n: int) -> dict[str, object]:
    """Execute both algorithms in a pair at size N and return exact trace step counts."""
    pair = next((p for p in COMPLEXITY_PAIRS if p.id == pair_id), None)
    if pair is None:
        raise ValueError(f"Unknown complexity pair '{pair_id}'")

    clamped_n = max(pair.min_n, min(pair.max_n, int(n)))
    left_code, right_code = _build_pair_code(pair.id, clamped_n)

    left_trace = trace_python_code(left_code, max_steps=2500, timeout_seconds=4.0)
    right_trace = trace_python_code(right_code, max_steps=2500, timeout_seconds=4.0)

    return {
        "pair": pair.model_dump(),
        "n": clamped_n,
        "left": {
            **pair.left.model_dump(),
            "steps": left_trace.total_steps,
            "truncated": left_trace.truncated,
            "error": left_trace.error,
            "code": left_code,
        },
        "right": {
            **pair.right.model_dump(),
            "steps": right_trace.total_steps,
            "truncated": right_trace.truncated,
            "error": right_trace.error,
            "code": right_code,
        },
    }
