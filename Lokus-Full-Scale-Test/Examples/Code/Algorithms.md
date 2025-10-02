# 🧮 Algorithm Examples

## 🔍 Search Algorithms
Binary search connecting to [[Programming Examples]] and [[Mathematics Showcase]].

```python
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
    return -1
```

Complexity: $O(\log n)$

Related: [[Research/AI/Machine Learning Basics]], [[Tutorials/JavaScript/Basics]]
