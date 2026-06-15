// Squarified treemap layout (Bruls, Huizing, van Wijk).
// Pure + dependency-free so the layout math can be unit-tested without a DOM.
// Returns tiles in the same order as the input items that have positive size.

export function computeTreemapLayout(items = [], width = 0, height = 0) {
  const nodes = (Array.isArray(items) ? items : [])
    .map((item) => ({ item, value: Math.max(0, Number(item?.bytes) || 0) }))
    .filter((node) => node.value > 0);

  if (!nodes.length || width <= 0 || height <= 0) return [];

  const totalValue = nodes.reduce((sum, node) => sum + node.value, 0);
  if (totalValue <= 0) return [];

  const totalArea = width * height;
  for (const node of nodes) {
    node.area = (node.value / totalValue) * totalArea;
  }

  const tiles = [];
  const rect = { x: 0, y: 0, width, height };
  let row = [];

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    const side = Math.min(rect.width, rect.height);
    if (row.length === 0 || worstRatio(row, side) >= worstRatio([...row, node], side)) {
      row.push(node);
    } else {
      layoutRow(row, rect, tiles);
      row = [node];
    }
  }
  if (row.length) layoutRow(row, rect, tiles);

  return tiles;
}

function worstRatio(row, side) {
  if (!row.length || side <= 0) return Infinity;
  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  for (const node of row) {
    sum += node.area;
    if (node.area > max) max = node.area;
    if (node.area < min) min = node.area;
  }
  const sum2 = sum * sum;
  const side2 = side * side;
  if (sum2 <= 0 || min <= 0) return Infinity;
  return Math.max((side2 * max) / sum2, sum2 / (side2 * min));
}

function layoutRow(row, rect, tiles) {
  const sum = row.reduce((total, node) => total + node.area, 0);
  if (sum <= 0) return;

  if (rect.width < rect.height) {
    // Horizontal strip across the top of the free rectangle.
    const rowHeight = clamp(sum / rect.width, 0, rect.height);
    let x = rect.x;
    for (const node of row) {
      const tileWidth = rowHeight > 0 ? node.area / rowHeight : 0;
      tiles.push({ item: node.item, value: node.value, x, y: rect.y, width: tileWidth, height: rowHeight });
      x += tileWidth;
    }
    rect.y += rowHeight;
    rect.height -= rowHeight;
  } else {
    // Vertical strip down the left of the free rectangle.
    const rowWidth = clamp(sum / rect.height, 0, rect.width);
    let y = rect.y;
    for (const node of row) {
      const tileHeight = rowWidth > 0 ? node.area / rowWidth : 0;
      tiles.push({ item: node.item, value: node.value, x: rect.x, y, width: rowWidth, height: tileHeight });
      y += tileHeight;
    }
    rect.x += rowWidth;
    rect.width -= rowWidth;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
