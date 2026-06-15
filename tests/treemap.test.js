const assert = require("assert");

(async () => {
  const { computeTreemapLayout } = await import("../src/treemap.mjs");

  // Empty / degenerate inputs return nothing rather than throwing.
  assert.deepStrictEqual(computeTreemapLayout([], 100, 100), [], "empty items yield no tiles");
  assert.deepStrictEqual(computeTreemapLayout([{ bytes: 10 }], 0, 100), [], "zero width yields no tiles");
  assert.deepStrictEqual(
    computeTreemapLayout([{ bytes: 0 }, { bytes: 0 }], 100, 100),
    [],
    "all-zero sizes yield no tiles"
  );

  const width = 800;
  const height = 600;
  const items = [
    { id: "a", name: "Users", bytes: 200 * 1024 * 1024 * 1024 },
    { id: "b", name: "Windows", bytes: 60 * 1024 * 1024 * 1024 },
    { id: "c", name: "Program Files", bytes: 40 * 1024 * 1024 * 1024 },
    { id: "d", name: "ProgramData", bytes: 15 * 1024 * 1024 * 1024 },
    { id: "e", name: "Temp", bytes: 5 * 1024 * 1024 * 1024 },
    { id: "f", name: "Misc", bytes: 1 * 1024 * 1024 * 1024 }
  ];

  const tiles = computeTreemapLayout(items, width, height);
  assert.strictEqual(tiles.length, items.length, "every positive item gets a tile");

  const totalArea = width * height;
  let coveredArea = 0;
  for (const tile of tiles) {
    // Tiles stay within the container bounds (allow tiny float epsilon).
    assert(tile.x >= -1e-6 && tile.y >= -1e-6, "tile origin within bounds");
    assert(tile.x + tile.width <= width + 1e-3, `tile right edge within width (${tile.item.name})`);
    assert(tile.y + tile.height <= height + 1e-3, `tile bottom edge within height (${tile.item.name})`);
    assert(tile.width >= 0 && tile.height >= 0, "tile has non-negative size");
    coveredArea += tile.width * tile.height;
  }

  // Squarified layout fully tiles the container (no gaps/overlap beyond float error).
  assert(Math.abs(coveredArea - totalArea) / totalArea < 0.02, "tiles cover ~100% of the container area");

  // Tile area is proportional to byte size.
  const totalBytes = items.reduce((sum, item) => sum + item.bytes, 0);
  for (const tile of tiles) {
    const expectedArea = (tile.value / totalBytes) * totalArea;
    const actualArea = tile.width * tile.height;
    assert(
      Math.abs(actualArea - expectedArea) / expectedArea < 0.02,
      `tile ${tile.item.name} area proportional to bytes`
    );
  }

  // Largest item should produce the largest tile.
  const biggest = tiles.reduce((max, tile) => (tile.value > max.value ? tile : max), tiles[0]);
  assert.strictEqual(biggest.item.id, "a", "largest folder yields the largest tile");

  console.log("treemap layout ok");
})();
