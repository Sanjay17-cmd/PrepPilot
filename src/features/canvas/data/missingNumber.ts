import type { CanvasArtifact } from '../../../types'

/**
 * Missing Number — Phase 1 Learning Canvas demo.
 * Input: [3, 0, 1]   Expected output: 2
 *
 * Algorithm: Sum formula
 *   n = len(nums)
 *   expected_sum = n * (n + 1) // 2
 *   actual_sum = sum(nums)
 *   return expected_sum - actual_sum
 */

export const MISSING_NUMBER_DEMO: CanvasArtifact = {
  title: 'Missing Number',
  language: 'python',
  code: [
    'def missingNumber(nums):',
    '    n = len(nums)',
    '    expected_sum = n * (n + 1) // 2',
    '    actual_sum = sum(nums)',
    '    return expected_sum - actual_sum',
    '',
    '# nums = [3, 0, 1]',
    '# output → 2',
  ],
  steps: [
    {
      step: 1,
      line: 1,
      variables: {},
      array: [3, 0, 1],
      pointers: {},
      markers: {},
      highlightIndices: [],
      explanation:
        'We begin with the input array [3, 0, 1]. ' +
        'The array contains numbers from 0 to n with exactly one missing. ' +
        'Our goal is to find that missing number without sorting.',
    },
    {
      step: 2,
      line: 2,
      variables: { n: 3 },
      array: [3, 0, 1],
      pointers: {},
      markers: {},
      highlightIndices: [],
      explanation:
        'Step 2: Compute n = len(nums) = 3.\n' +
        'n tells us that the complete sequence should be 0 → 1 → 2 → 3 (four numbers).',
    },
    {
      step: 3,
      line: 3,
      variables: { n: 3, expected_sum: 6 },
      array: [3, 0, 1],
      pointers: {},
      markers: {},
      highlightIndices: [],
      explanation:
        'Step 3: expected_sum = n × (n + 1) ÷ 2 = 3 × 4 ÷ 2 = 6.\n' +
        'This is the sum of [0, 1, 2, 3] if no number were missing.',
    },
    {
      step: 4,
      line: 4,
      variables: { n: 3, expected_sum: 6, actual_sum: 4 },
      array: [3, 0, 1],
      pointers: {},
      markers: {},
      highlightIndices: [0, 1, 2],
      explanation:
        'Step 4: actual_sum = sum([3, 0, 1]) = 4.\n' +
        'This is the sum of the numbers we actually have. ' +
        'All three elements are highlighted.',
    },
    {
      step: 5,
      line: 5,
      variables: { n: 3, expected_sum: 6, actual_sum: 4, result: 2 },
      array: [3, 0, 1],
      pointers: {},
      markers: { missing: 2 },
      highlightIndices: [],
      explanation:
        'Step 5: result = expected_sum − actual_sum = 6 − 4 = 2.\n' +
        'The missing number is 2. ' +
        'This O(n) time, O(1) space solution avoids sorting entirely.',
    },
  ],
}
