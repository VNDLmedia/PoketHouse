const fs = require('fs');

const COLS = 264;
const ROWS = 200;

// Tile IDs
const GRASS = 0;
const TREE = 1;
const WATER = 2;
const SAND = 3;
const FLOWER = 4;
const TALL_GRASS = 5;
const DARK_GRASS = 6;
const PATH = 7;
const BRIDGE = 8;
const FENCE = 9;
const ROCK = 10;
const WALL = 11;
const DOOR = 12;
const ROOF = 13;
const ROOFTOP = 14;
const ROAD = 15;
const BUILDING = 16;
const SIDEWALK = 17;
const PARKING = 18;
const PLAZA = 19;
const HEDGE = 20;
const SPORT = 21;
const BUILDING_DARK = 22;
const BIG_TREE = 23;

// Create grid filled with grass
const tiles = [];
for (let y = 0; y < ROWS; y++) {
  tiles.push(new Array(COLS).fill(GRASS));
}

// Helper: fill rectangle
function rect(x1, y1, w, h, tile) {
  for (let y = y1; y < y1 + h && y < ROWS; y++) {
    for (let x = x1; x < x1 + w && x < COLS; x++) {
      if (x >= 0 && y >= 0) tiles[y][x] = tile;
    }
  }
}

// Helper: outline rectangle (border only)
function outline(x1, y1, w, h, tile) {
  for (let x = x1; x < x1 + w && x < COLS; x++) {
    if (x >= 0 && y1 >= 0 && y1 < ROWS) tiles[y1][x] = tile;
    if (x >= 0 && y1 + h - 1 >= 0 && y1 + h - 1 < ROWS) tiles[y1 + h - 1][x] = tile;
  }
  for (let y = y1; y < y1 + h && y < ROWS; y++) {
    if (y >= 0 && x1 >= 0 && x1 < COLS) tiles[y][x1] = tile;
    if (y >= 0 && x1 + w - 1 >= 0 && x1 + w - 1 < COLS) tiles[y][x1 + w - 1] = tile;
  }
}

// Helper: scatter tiles randomly in a region
function scatter(x1, y1, w, h, tile, density) {
  for (let y = y1; y < y1 + h && y < ROWS; y++) {
    for (let x = x1; x < x1 + w && x < COLS; x++) {
      if (x >= 0 && y >= 0 && Math.random() < density) tiles[y][x] = tile;
    }
  }
}

// Helper: place trees in a region (BigTree clusters and regular trees)
function treeArea(x1, y1, w, h, density = 0.6) {
  for (let y = y1; y < y1 + h && y < ROWS; y++) {
    for (let x = x1; x < x1 + w && x < COLS; x++) {
      if (x >= 0 && y >= 0 && Math.random() < density) {
        tiles[y][x] = Math.random() < 0.55 ? BIG_TREE : TREE;
      }
    }
  }
}

// Helper: tree row (line of trees)
function treeRow(x1, y1, len, vertical = false) {
  for (let i = 0; i < len; i++) {
    const x = vertical ? x1 : x1 + i;
    const y = vertical ? y1 + i : y1;
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
      tiles[y][x] = (i % 2 === 0) ? BIG_TREE : TREE;
    }
  }
}

// Helper: building with optional courtyard
function building(x1, y1, w, h, dark = false) {
  const tile = dark ? BUILDING_DARK : BUILDING;
  rect(x1, y1, w, h, tile);
}

// Helper: U-shaped building (open side: 'n','s','e','w')
function uBuilding(x1, y1, w, h, openSide, thickness, dark = false) {
  const tile = dark ? BUILDING_DARK : BUILDING;
  switch (openSide) {
    case 'n':
      rect(x1, y1, thickness, h, tile); // left wall
      rect(x1 + w - thickness, y1, thickness, h, tile); // right wall
      rect(x1, y1 + h - thickness, w, thickness, tile); // bottom
      break;
    case 's':
      rect(x1, y1, thickness, h, tile); // left wall
      rect(x1 + w - thickness, y1, thickness, h, tile); // right wall
      rect(x1, y1, w, thickness, tile); // top
      break;
    case 'e':
      rect(x1, y1, w, thickness, tile); // top
      rect(x1, y1 + h - thickness, w, thickness, tile); // bottom
      rect(x1, y1, thickness, h, tile); // left wall
      break;
    case 'w':
      rect(x1, y1, w, thickness, tile); // top
      rect(x1, y1 + h - thickness, w, thickness, tile); // bottom
      rect(x1 + w - thickness, y1, thickness, h, tile); // right wall
      break;
  }
}

// Helper: L-shaped building
function lBuilding(x1, y1, w, h, corner, armW, armH, dark = false) {
  const tile = dark ? BUILDING_DARK : BUILDING;
  switch (corner) {
    case 'nw':
      rect(x1, y1, w, armH, tile);
      rect(x1, y1, armW, h, tile);
      break;
    case 'ne':
      rect(x1, y1, w, armH, tile);
      rect(x1 + w - armW, y1, armW, h, tile);
      break;
    case 'sw':
      rect(x1, y1 + h - armH, w, armH, tile);
      rect(x1, y1, armW, h, tile);
      break;
    case 'se':
      rect(x1, y1 + h - armH, w, armH, tile);
      rect(x1 + w - armW, y1, armW, h, tile);
      break;
  }
}

// ============================================================
// MAP GENERATION — Siemens Campus Munich approximation
// ============================================================

// ------ PERIMETER ROADS ------

// Carl-Wery-Straße (left vertical road)
rect(0, 0, 5, ROWS, SIDEWALK);
rect(5, 0, 8, ROWS, ROAD);
rect(13, 0, 3, ROWS, SIDEWALK);

// Top horizontal road
rect(0, 0, COLS, 4, ROAD);
rect(0, 4, COLS, 2, SIDEWALK);

// Arnold-Sommerfeld-Straße (right side, roughly vertical)
rect(220, 0, 3, ROWS, SIDEWALK);
rect(223, 0, 8, ROWS, ROAD);
rect(231, 0, 3, ROWS, SIDEWALK);

// Area outside campus (right of Arnold-Sommerfeld-Str.)
rect(234, 0, 30, ROWS, GRASS);
// Parking Ost at bottom-right
rect(238, 155, 22, 30, PARKING);
// Some buildings on the right
building(236, 10, 18, 12, true);
building(236, 30, 14, 10);
building(238, 75, 20, 15, true);
building(236, 100, 16, 12);

// Bottom area (below campus)
rect(0, 180, COLS, 20, SIDEWALK);
rect(0, 184, COLS, 16, ROAD);
// S-Bahn area bottom-left
rect(16, 185, 25, 12, PLAZA);

// ------ INTERNAL ROAD NETWORK ------
// Main campus area: cols 16-220, rows 6-180

// Major N-S internal roads
rect(56, 6, 4, 174, ROAD);    // road 1
rect(108, 6, 4, 174, ROAD);   // road 2 (central)
rect(158, 6, 4, 174, ROAD);   // road 3
rect(196, 6, 4, 174, ROAD);   // road 4

// Major E-W internal roads
rect(16, 36, 204, 4, ROAD);   // road A
rect(16, 72, 204, 4, ROAD);   // road B
rect(16, 108, 204, 4, ROAD);  // road C
rect(16, 140, 204, 4, ROAD);  // road D
rect(16, 172, 204, 4, ROAD);  // road E

// Sidewalks along internal roads (thin strips)
rect(55, 6, 1, 174, SIDEWALK);
rect(60, 6, 1, 174, SIDEWALK);
rect(107, 6, 1, 174, SIDEWALK);
rect(112, 6, 1, 174, SIDEWALK);
rect(157, 6, 1, 174, SIDEWALK);
rect(162, 6, 1, 174, SIDEWALK);
rect(195, 6, 1, 174, SIDEWALK);
rect(200, 6, 1, 174, SIDEWALK);

rect(16, 35, 204, 1, SIDEWALK);
rect(16, 40, 204, 1, SIDEWALK);
rect(16, 71, 204, 1, SIDEWALK);
rect(16, 76, 204, 1, SIDEWALK);
rect(16, 107, 204, 1, SIDEWALK);
rect(16, 112, 204, 1, SIDEWALK);
rect(16, 139, 204, 1, SIDEWALK);
rect(16, 144, 204, 1, SIDEWALK);
rect(16, 171, 204, 1, SIDEWALK);
rect(16, 176, 204, 1, SIDEWALK);

// ------ BUILDING BLOCKS ------
// Grid cells between roads, each gets a building complex

// === ROW 1 (y: 6-35) ===

// Block A1 (x: 16-55, y: 6-35)
uBuilding(18, 8, 35, 25, 's', 8);
treeArea(26, 18, 19, 10, 0.5);
treeRow(18, 7, 35, false);

// Block B1 (x: 61-107, y: 6-35)
building(63, 8, 18, 12, true);
building(85, 8, 20, 12);
rect(63, 22, 42, 3, PLAZA);
treeArea(63, 26, 42, 8, 0.45);
treeRow(63, 7, 44, false);

// Block C1 (x: 113-157, y: 6-35)
uBuilding(115, 8, 40, 25, 's', 8, true);
treeArea(123, 16, 24, 10, 0.5);
rect(115, 25, 40, 3, SIDEWALK);
building(125, 28, 20, 6);

// Block D1 (x: 163-195, y: 6-35)
building(165, 8, 28, 10, true);
building(165, 22, 28, 12);
treeArea(167, 19, 24, 3, 0.6);
rect(165, 20, 28, 2, PATH);

// === ROW 2 (y: 41-71) ===

// Block A2 (x: 16-55, y: 41-71)
building(18, 43, 15, 12, true);
building(36, 43, 17, 12);
rect(18, 56, 35, 3, SIDEWALK);
building(20, 60, 32, 10);
treeRow(18, 42, 35, false);

// Block B2 (x: 61-107, y: 41-71) — Central campus area
uBuilding(63, 42, 42, 28, 'n', 10, true);
rect(73, 42, 22, 14, PLAZA);
treeArea(75, 44, 18, 10, 0.4);
scatter(73, 42, 22, 14, HEDGE, 0.08);

// Block C2 (x: 113-157, y: 41-71)
building(115, 42, 20, 14);
building(138, 42, 18, 14, true);
rect(115, 57, 40, 2, PATH);
building(118, 60, 36, 10);
treeRow(115, 57, 40, false);

// Block D2 (x: 163-195, y: 41-71)
uBuilding(165, 42, 28, 28, 'w', 8);
treeArea(173, 48, 12, 16, 0.55);
rect(165, 56, 28, 2, SIDEWALK);

// === ROW 3 (y: 77-107) ===

// Block A3 (x: 16-55, y: 77-107)
building(18, 78, 35, 8);
rect(18, 87, 35, 3, SIDEWALK);
building(18, 91, 14, 15, true);
building(36, 91, 17, 15, true);
treeArea(20, 87, 10, 3, 0.5);

// Block B3 (x: 61-107, y: 77-107)
lBuilding(63, 78, 42, 28, 'ne', 12, 10);
rect(63, 88, 30, 2, PATH);
treeArea(63, 90, 30, 8, 0.45);
building(80, 94, 25, 12, true);

// Block C3 (x: 113-157, y: 77-107)
building(115, 78, 40, 10, true);
rect(115, 89, 40, 3, PLAZA);
uBuilding(118, 93, 34, 14, 'n', 8);
treeArea(126, 93, 18, 8, 0.4);

// Block D3 (x: 163-195, y: 77-107)
building(165, 78, 28, 12);
rect(165, 91, 28, 3, SIDEWALK);
building(168, 95, 22, 12, true);

// === ROW 4 (y: 113-139) ===

// Block A4 (x: 16-55, y: 113-139)
uBuilding(18, 114, 35, 24, 'e', 7, true);
treeArea(25, 118, 20, 14, 0.5);
rect(40, 114, 13, 24, PLAZA);

// Block B4 (x: 61-107, y: 113-139)
building(63, 114, 20, 24);
rect(84, 114, 4, 24, PATH);
building(89, 114, 16, 24, true);
treeRow(83, 114, 24, true);

// Block C4 (x: 113-157, y: 113-139)
building(115, 114, 18, 10, true);
building(136, 114, 20, 10);
rect(115, 125, 40, 3, SIDEWALK);
building(118, 129, 36, 10);
treeRow(115, 126, 40, false);

// Block D4 (x: 163-195, y: 113-139)
building(165, 114, 28, 10);
treeArea(167, 125, 24, 4, 0.6);
building(165, 130, 28, 9, true);

// === ROW 5 (y: 145-171) ===

// Block A5 (x: 16-55, y: 145-171)
building(18, 146, 35, 12, true);
rect(18, 159, 35, 3, PATH);
treeArea(18, 162, 35, 9, 0.5);

// Block B5 (x: 61-107, y: 145-171)
uBuilding(63, 146, 42, 24, 's', 10);
treeArea(73, 156, 22, 10, 0.5);
rect(63, 164, 42, 3, SIDEWALK);

// Block C5 (x: 113-157, y: 145-171)
building(115, 146, 40, 10);
rect(115, 157, 40, 3, PLAZA);
building(120, 161, 30, 10, true);

// Block D5 (x: 163-195, y: 145-171)
building(165, 146, 12, 24);
building(181, 146, 12, 24, true);
rect(177, 146, 4, 24, PATH);
treeRow(178, 146, 24, true);

// ------ TREE-LINED AVENUES between blocks ------
// Vertical tree lines along internal roads
for (let y = 6; y < 176; y += 2) {
  if (tiles[y]?.[54] === GRASS || tiles[y]?.[54] === SIDEWALK) tiles[y][54] = BIG_TREE;
  if (tiles[y]?.[61] === GRASS || tiles[y]?.[61] === SIDEWALK) tiles[y][61] = BIG_TREE;
  if (tiles[y]?.[106] === GRASS || tiles[y]?.[106] === SIDEWALK) tiles[y][106] = TREE;
  if (tiles[y]?.[113] === GRASS || tiles[y]?.[113] === SIDEWALK) tiles[y][113] = TREE;
  if (tiles[y]?.[156] === GRASS || tiles[y]?.[156] === SIDEWALK) tiles[y][156] = BIG_TREE;
  if (tiles[y]?.[163] === GRASS || tiles[y]?.[163] === SIDEWALK) tiles[y][163] = BIG_TREE;
  if (tiles[y]?.[194] === GRASS || tiles[y]?.[194] === SIDEWALK) tiles[y][194] = TREE;
  if (tiles[y]?.[201] === GRASS || tiles[y]?.[201] === SIDEWALK) tiles[y][201] = TREE;
}

// Horizontal tree lines along E-W roads
for (let x = 16; x < 220; x += 2) {
  [34, 41, 70, 77, 106, 113, 138, 145, 170, 177].forEach(y => {
    if (x < COLS && y < ROWS && (tiles[y][x] === GRASS || tiles[y][x] === SIDEWALK)) {
      tiles[y][x] = Math.random() < 0.5 ? BIG_TREE : TREE;
    }
  });
}

// ------ ADDITIONAL GREEN SPACES ------
// Large green area between some building blocks (courtyards)
treeArea(72, 44, 20, 10, 0.3);
treeArea(125, 16, 20, 10, 0.3);
treeArea(173, 48, 14, 14, 0.3);

// Hedge rows along some paths
for (let x = 18; x < 53; x++) {
  if (tiles[42]?.[x] === GRASS) tiles[42][x] = HEDGE;
}
for (let x = 63; x < 105; x++) {
  if (tiles[112]?.[x] === GRASS) tiles[112][x] = HEDGE;
}
for (let x = 115; x < 155; x++) {
  if (tiles[76]?.[x] === GRASS) tiles[76][x] = HEDGE;
}

// ------ PARKING AREAS ------
rect(18, 177, 36, 3, PARKING);
rect(200, 8, 18, 8, PARKING);
rect(200, 77, 18, 8, PARKING);
rect(200, 146, 18, 10, PARKING);

// ------ PLAZAS / ENTRANCE AREAS ------
rect(100, 36, 8, 4, PLAZA);
rect(148, 72, 10, 4, PLAZA);
rect(58, 108, 8, 4, PLAZA);

// ------ SPORTS FIELD (bottom area) ------
rect(140, 178, 30, 10, SPORT);

// ------ SCATTERED FLOWERS in green areas ------
scatter(20, 160, 30, 10, FLOWER, 0.06);
scatter(125, 155, 20, 8, FLOWER, 0.05);

// ------ SOME TALL GRASS patches ------
scatter(24, 20, 15, 8, TALL_GRASS, 0.08);
scatter(130, 95, 10, 6, TALL_GRASS, 0.1);

// ------ PERIMETER FENCING on campus boundary ------
for (let y = 6; y < 176; y++) {
  if (tiles[y][16] === GRASS) tiles[y][16] = FENCE;
  if (tiles[y][219] === GRASS) tiles[y][219] = FENCE;
}
for (let x = 16; x < 220; x++) {
  if (tiles[6][x] === GRASS) tiles[6][x] = FENCE;
  if (tiles[176][x] === GRASS) tiles[176][x] = FENCE;
}

// ------ GENERATE OUTPUT ------
const mapData = {
  id: 'siemens-campus',
  tiles: tiles,
  interactables: [],
  enemies: [],
  portals: [],
  theme: 'outdoor',
};

const outputPath = process.argv[2] || 'public/siemens-campus.json';
fs.writeFileSync(outputPath, JSON.stringify(mapData));
console.log(`Map generated: ${COLS}x${ROWS} tiles → ${outputPath}`);
console.log(`File size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
