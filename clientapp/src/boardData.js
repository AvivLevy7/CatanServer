// Standard Catan terrain distribution: 4 forest, 4 pasture, 4 fields, 3 hills, 3 mountains, 1 desert.
const TERRAIN_POOL = [
  ...Array(4).fill('Forest'),
  ...Array(4).fill('Pasture'),
  ...Array(4).fill('Fields'),
  ...Array(3).fill('Hills'),
  ...Array(3).fill('Mountains'),
  'Desert',
];

// Standard token distribution: 2 and 12 appear once, everything else twice, no 7.
const TOKEN_POOL = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

// Rows of the classic board, top to bottom.
export const ROW_LENGTHS = [3, 4, 5, 4, 3];

function shuffle(source) {
  const items = [...source];
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Builds the 19 tiles laid out in rows of 3/4/5/4/3.
 * The desert gets no token and starts with the robber.
 */
export function createBoard() {
  const terrain = shuffle(TERRAIN_POOL);
  const tokens = shuffle(TOKEN_POOL);

  let tokenIndex = 0;
  let tileIndex = 0;
  const tiles = [];

  ROW_LENGTHS.forEach((count, row) => {
    for (let col = 0; col < count; col++) {
      const type = terrain[tileIndex];
      const isDesert = type === 'Desert';

      tiles.push({
        id: `${row}-${col}`,
        row,
        col,
        rowLength: count,
        type,
        numberToken: isDesert ? null : tokens[tokenIndex++],
        hasRobber: isDesert,
      });

      tileIndex++;
    }
  });

  return tiles;
}
