/** @typedef {{id:number, y:number, x0:number, x1:number, runs:Array}} LayoutLine */
/** @typedef {{kind:'single'|'double'|'uncertain', gutter?:number}} ColumnDecision */

/** 页坐标单位为 pt，y 向上。保留输入 run 与原数组的顺序。 */
export function mergeRuns(runs) {
  const rows = [];
  for (const run of [...runs].sort((a, b) => b.sy - a.sy)) {
    const row = rows.at(-1);
    if (!row || row[0].sy - run.sy > Math.max(2, 0.4 * run.fontSize)) rows.push([run]);
    else row.push(run);
  }
  const lines = [];
  rows.forEach((row) => {
    const y = row[0].sy;
    let line;
    for (const run of row.sort((a, b) => a.x - b.x)) {
      if (!line || run.x - line.x1 > 2.5 * run.fontSize) {
        line = { id: lines.length, y, x0: run.x, x1: run.x, runs: [] };
        lines.push(line);
      }
      line.x1 = Math.max(line.x1, run.x + run.w);
      line.runs.push(run);
    }
  });
  return lines;
}

/** 原始 TextItem 的水平区间。只在端点处更新覆盖数，无需按页宽分配位图。 */
export function detectColumns(items, pageWidth) {
  const lo = pageWidth * 0.15, hi = pageWidth * 0.85;
  const events = new Map([[lo, 0], [hi, items.length + 1]]);
  const starts = items.map(item => item.x0).sort((a, b) => a - b);
  const ends = items.map(item => item.x1).sort((a, b) => a - b);
  // 端点钳入搜索区间，区间外的 item 在同一端点相互抵消。
  items.forEach(({ x0, x1 }) => {
    const a = Math.min(hi, Math.max(lo, x0));
    const b = Math.min(hi, Math.max(lo, x1));
    events.set(a, (events.get(a) ?? 0) + 1);
    events.set(b, (events.get(b) ?? 0) - 1);
  });
  const bands = [];
  let coverage = 0, start = lo;
  const limit = items.length * 0.05;
  // hi 处的哨兵结束最后一条开放带。相同坐标的事件合并后再判断跨界。
  [...events].sort(([a], [b]) => a - b).forEach(([x, change]) => {
    const next = coverage + change;
    if ((coverage <= limit) !== (next <= limit)) {
      if (next > limit) bands.push([start, x]);
      else start = x;
    }
    coverage = next;
  });
  let left = 0, beforeRight = 0, score = 0;
  let decision = { kind: 'single' };
  starts.push(Infinity);
  ends.push(Infinity);
  bands.filter(([a, b]) => b - a >= 10).forEach(([a, b]) => {
    while (ends[left] <= a + 2) left++;
    while (starts[beforeRight] < b - 2) beforeRight++;
    const balance = Math.min(left, items.length - beforeRight);
    if (balance <= score) return;
    score = balance;
    decision = balance >= items.length * 0.25
      ? { kind: 'double', gutter: (a + b) / 2 } : { kind: 'uncertain' };
  });
  return decision;
}

/** null 表示使用该页原有 Markdown；只有各页索引参与整篇投票。 */
export function readingOrder(pages, decisions) {
  const enabled = decisions.filter(d => d.kind === 'double').length >= pages.length * 0.6;
  const fallbackPages = [];
  const lineIdsByPage = pages.map((lines, i) => {
    const { kind, gutter } = decisions[i];
    if (!enabled || kind !== 'double') {
      if (kind !== 'single') fallbackPages.push(i);
      return null;
    }
    const ids = [], right = [];
    for (const line of [...lines].sort((a, b) => b.y - a.y)) {
      if (line.x0 < gutter - 5 && line.x1 > gutter + 5) {
        for (const id of right) ids.push(id);
        right.length = 0;
        ids.push(line.id);
      } else if ((line.x0 + line.x1) / 2 < gutter) ids.push(line.id);
      else right.push(line.id);
    }
    return ids.concat(right);
  });
  return { lineIdsByPage, fallbackPages };
}

/** 每一页返回命中的行号集合；同页内的重复不计入跨页频次。 */
export function repeatedMargins(pages) {
  const seen = new Map();
  pages.forEach(({ lines, height }, page) => {
    lines.forEach(({ y, text, id }) => {
      if (y > height * 0.08 && y < height * 0.92) return;
      const value = text.trim();
      if (!value || [...value].length >= 80) return;
      const key = (y < height / 2 ? 'bottom:' : 'top:') + value.replace(/[\p{N}\p{P}\s]/gu, '');
      const hits = seen.get(key) ?? [];
      hits.push({ page, id });
      seen.set(key, hits);
    });
  });
  const masks = pages.map(() => new Set());
  for (const hits of seen.values()) {
    if (hits[0].page === hits.at(-1).page) continue;
    for (const { page, id } of hits) masks[page].add(id);
  }
  return masks;
}
