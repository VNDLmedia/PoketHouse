import { TileType, TILE_SIZE } from './map';
import { Interactable, Portal, MapData } from './types';

export const GENERATED_MAP_SIZE = 100;

export interface GeneratedWorld {
    worldMap: MapData;
    interiorMaps: Record<string, MapData>;
    spawn: { x: number, y: number };
}

class RNG {
  private seed: number;
  constructor(seed: number) { this.seed = seed; }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

class SimpleNoise {
  private rng: RNG;
  private perm: number[] = [];
  constructor(seed: number) {
    this.rng = new RNG(seed * 10000);
    for (let i = 0; i < 256; i++) this.perm[i] = i;
    for (let i = 0; i < 256; i++) {
        const j = Math.floor(this.rng.next() * 256);
        const t = this.perm[i]; this.perm[i] = this.perm[j]; this.perm[j] = t;
    }
    this.perm = [...this.perm, ...this.perm];
  }
  private fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
  private lerp(t: number, a: number, b: number) { return a + t * (b - a); }
  private grad(hash: number, x: number, y: number) {
      const h = hash & 15;
      const u = h < 8 ? x : y;
      const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  public noise(x: number, y: number): number {
      const X = Math.floor(x) & 255;
      const Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      const u = this.fade(x); const v = this.fade(y);
      const A = this.perm[X] + Y; const B = this.perm[X + 1] + Y;
      return this.lerp(v, 
          this.lerp(u, this.grad(this.perm[A], x, y), this.grad(this.perm[B], x - 1, y)),
          this.lerp(u, this.grad(this.perm[A + 1], x, y - 1), this.grad(this.perm[B + 1], x - 1, y - 1))
      );
  }
}

export const generateWorld = (seed: number = Date.now()): GeneratedWorld => {
    const noise = new SimpleNoise(seed);
    const forestNoise = new SimpleNoise(seed + 123);
    const rng = new RNG(seed);
    const tiles: number[][] = [];
    const interactables: Interactable[] = [];
    const portals: Portal[] = [];
    const interiorMaps: Record<string, MapData> = {};
    
    let spawn = { x: 50, y: 50 };
    let spawnFound = false;

    // 1. Terrain Base Generation
    for (let y = 0; y < GENERATED_MAP_SIZE; y++) {
        const row: number[] = [];
        for (let x = 0; x < GENERATED_MAP_SIZE; x++) {
            const scale = 0.08;
            const elevation = noise.noise(x * scale, y * scale);
            const moisture = noise.noise(x * scale * 0.5 + 500, y * scale * 0.5 + 500);
            
            // Forest Density Noise für Biome
            const forestDensity = forestNoise.noise(x * 0.15, y * 0.15);

            let tile = 0; // Gras

            if (elevation < -0.25) tile = 2; // Wasser
            else if (elevation < 0.35) {
                // Land Area
                if (forestDensity > 0.1) {
                    // Dichter Wald
                    if (rng.next() > 0.1) tile = 1; // Baum
                    else if (rng.next() > 0.5) tile = 11; // Busch
                    else tile = 12; // Hohes Gras (Lichtung)
                } else if (forestDensity > -0.2) {
                    // Mischwald / Wiese
                    if (rng.next() > 0.7) tile = 1; // Vereinzelte Bäume
                    else if (rng.next() > 0.6) tile = 11; // Büsche
                    else if (rng.next() > 0.6) tile = 7; // Blumen
                    else if (rng.next() > 0.8) tile = 12; // Hohes Gras
                } else {
                    // Offene Wiese / Steppe
                    if (moisture < -0.3) tile = 4; // Trockener Boden / Sand
                    else if (rng.next() > 0.95) tile = 8; // Steine
                    else if (rng.next() > 0.9) tile = 7; // Blumen
                    else if (rng.next() > 0.8) tile = 12; // Hohes Gras Patches
                }
            } else {
                tile = 1; // Berg/Wand
            }
            
            // Map Rand
            if (x < 2 || x > GENERATED_MAP_SIZE - 3 || y < 2 || y > GENERATED_MAP_SIZE - 3) tile = 1;

            row.push(tile);

            if (!spawnFound && tile === 0 && x > 45 && x < 55 && y > 45 && y < 55) {
                spawn = { x, y };
                spawnFound = true;
            }
        }
        tiles.push(row);
    }

    // 2. Häuser generieren
    const numHouses = 8;
    for (let i = 0; i < numHouses; i++) {
        let hx = 0, hy = 0;
        let valid = false;
        let attempts = 0;
        
        while (!valid && attempts < 50) {
            hx = Math.floor(rng.next() * (GENERATED_MAP_SIZE - 10)) + 5;
            hy = Math.floor(rng.next() * (GENERATED_MAP_SIZE - 10)) + 5;
            
            valid = true;
            for(let dy=0; dy<5; dy++) {
                for(let dx=0; dx<5; dx++) {
                    const t = tiles[hy+dy][hx+dx];
                    if (t === 2 || t === 1) valid = false; // Nicht auf Wasser oder Wald/Berg bauen
                }
            }
            attempts++;
        }

        if (valid) {
            // Haus bauen (5x4)
            for(let dx=0; dx<5; dx++) { tiles[hy][hx+dx] = 10; tiles[hy+1][hx+dx] = 10; }
            for(let dx=0; dx<5; dx++) { tiles[hy+2][hx+dx] = 9; tiles[hy+3][hx+dx] = 9; }
            tiles[hy+3][hx+2] = 5; 
            
            // Bereich um das Haus aufräumen (Garten)
            for(let dy=-1; dy<6; dy++) {
                for(let dx=-1; dx<6; dx++) {
                    if (hy+dy >= 0 && hy+dy < GENERATED_MAP_SIZE && hx+dx >= 0 && hx+dx < GENERATED_MAP_SIZE) {
                         const t = tiles[hy+dy][hx+dx];
                         // Wenn Busch oder Baum direkt vorm Haus, weg damit
                         if (t === 1 || t === 11 || t === 12) tiles[hy+dy][hx+dx] = 0;
                         // Weg zur Tür
                         if (dx === 2 && dy >= 4) tiles[hy+dy][hx+dx] = 4;
                    }
                }
            }

            const houseId = `house_${hx}_${hy}`;
            
            portals.push({
                x: (hx + 2) * TILE_SIZE,
                y: (hy + 3) * TILE_SIZE,
                width: TILE_SIZE,
                height: TILE_SIZE,
                targetMap: houseId,
                targetX: TILE_SIZE * 4, 
                targetY: TILE_SIZE * 6,
                direction: 'up'
            });

            const interiorTiles: number[][] = [];
            const w = 9, h = 8;
            for(let iy=0; iy<h; iy++) {
                const iRow = [];
                for(let ix=0; ix<w; ix++) {
                    if (iy===0 || iy===h-1 || ix===0 || ix===w-1) iRow.push(1); 
                    else iRow.push(3); 
                }
                interiorTiles.push(iRow);
            }
            interiorTiles[4][4] = 6; interiorTiles[4][3] = 6; interiorTiles[4][5] = 6;
            interiorTiles[h-1][4] = 5;

            const interiorInteractables: Interactable[] = [];
            if (rng.next() > 0.5) {
                interiorInteractables.push({
                    id: `npc_${houseId}`,
                    position: { x: 4 * TILE_SIZE, y: 3 * TILE_SIZE },
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                    type: 'npc',
                    text: ["Willkommen!", "Ich habe gerade den Garten gemacht."],
                    active: true,
                    trigger: 'press'
                });
            }

            interiorMaps[houseId] = {
                id: houseId,
                tiles: interiorTiles,
                interactables: interiorInteractables,
                portals: [{
                    x: 4 * TILE_SIZE,
                    y: (h-1) * TILE_SIZE,
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                    targetMap: 'generated',
                    targetX: (hx + 2) * TILE_SIZE,
                    targetY: (hy + 4) * TILE_SIZE,
                    direction: 'down'
                }],
                theme: 'indoor'
            };
        }
    }

    // 3. World Items & NPCs
    for (let i = 0; i < 30; i++) {
        const x = Math.floor(rng.next() * (GENERATED_MAP_SIZE - 2)) + 1;
        const y = Math.floor(rng.next() * (GENERATED_MAP_SIZE - 2)) + 1;
        
        if (tiles[y][x] === 0 || tiles[y][x] === 12 || tiles[y][x] === 11) { 
            if (rng.next() > 0.6) {
                // Auf Büschen Beeren generieren
                let itemType = rng.next() > 0.5 ? 'potion' : 'flower';
                if (tiles[y][x] === 11) itemType = 'berry';

                interactables.push({
                    id: `gen_item_${i}`,
                    position: { x: x * 32, y: y * 32 },
                    width: 32,
                    height: 32,
                    type: 'item',
                    itemKey: itemType,
                    active: true,
                    trigger: 'press'
                });
            }
        }
    }

    const worldMap: MapData = {
        id: 'generated',
        tiles: tiles,
        interactables: interactables,
        portals: portals,
        theme: 'outdoor'
    };

    return { worldMap, interiorMaps, spawn };
};
