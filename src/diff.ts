/**
 * A small line-based unified diff, enough to show which theme variables
 * drifted. Inputs are a few hundred lines at most, so a plain LCS table is fine.
 */
export function unifiedDiff(expected: string, actual: string, context = 2): string {
  const a = expected.split('\n');
  const b = actual.split('\n');
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const ops: Array<{ kind: ' ' | '-' | '+'; line: string }> = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ kind: ' ', line: a[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      ops.push({ kind: '-', line: a[i++]! });
    } else {
      ops.push({ kind: '+', line: b[j++]! });
    }
  }
  while (i < a.length) ops.push({ kind: '-', line: a[i++]! });
  while (j < b.length) ops.push({ kind: '+', line: b[j++]! });

  const keep = ops.map((op, index) =>
    ops.slice(Math.max(0, index - context), index + context + 1).some((near) => near.kind !== ' '),
  );
  const out: string[] = ['--- expected (from tokens)', '+++ actual (theme file)'];
  let skipping = false;
  ops.forEach((op, index) => {
    if (keep[index]) {
      out.push(`${op.kind}${op.line}`);
      skipping = false;
    } else if (!skipping) {
      out.push('@@');
      skipping = true;
    }
  });
  return out.join('\n');
}
