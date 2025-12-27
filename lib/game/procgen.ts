import { TileType, TILE_SIZE } from './map';
import { Interactable, Portal, MapData } from './types';

export const GENERATED_MAP_SIZE = 120; // Etwas größer für mehr Platz

export interface GeneratedWorld {
    worldMap: MapData;
    interiorMaps: Record<string, MapData>;
    spawn: { x: number, y: number };
}

// Helper: Simple Priority Queue für A*
class PriorityQueue<T> {
    items: { element: T, priority: number }[] = [];
    enqueue(element: T, priority: number) {
        this.items.push({ element, priority });
        this.items.sort((a, b) => a.priority - b.priority);
    }
    dequeue() { return this.items.shift()?.element; }
    isEmpty() { return this.items.length === 0; }
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
    const rng = new RNG(seed);
    const noise = new SimpleNoise(seed);
    const forestNoise = new SimpleNoise(seed + 99);
    
    const tiles: number[][] = [];
    const interactables: Interactable[] = [];
    const portals: Portal[] = [];
    const interiorMaps: Record<string, MapData> = {};

    // 1. Init Empty Map
    for (let y = 0; y < GENERATED_MAP_SIZE; y++) {
        tiles[y] = new Array(GENERATED_MAP_SIZE).fill(0); // 0 = Grass default
    }

    // 2. Generate Points of Interest (POIs)
    const pois: { x: number, y: number, type: 'spawn' | 'house' | 'ruin' | 'lake' }[] = [];
    
    // Spawn Center
    const spawn = { x: Math.floor(GENERATED_MAP_SIZE/2), y: Math.floor(GENERATED_MAP_SIZE/2) };
    pois.push({ ...spawn, type: 'spawn' });

    // Random POIs
    const numPOIs = 12;
    for (let i = 0; i < numPOIs; i++) {
        const x = Math.floor(rng.next() * (GENERATED_MAP_SIZE - 20)) + 10;
        const y = Math.floor(rng.next() * (GENERATED_MAP_SIZE - 20)) + 10;
        
        // Abstand prüfen
        let tooClose = false;
        for (const p of pois) {
            const dist = Math.sqrt((p.x-x)**2 + (p.y-y)**2);
            if (dist < 15) tooClose = true;
        }
        
        if (!tooClose) {
            const type = rng.next() > 0.7 ? 'ruin' : 'house';
            pois.push({ x, y, type });
        }
    }

    // 3. Connect POIs with Paths (A*)
    // Wir verbinden jeden POI mit dem nächstgelegenen, der bereits im Netzwerk ist (Prim's-like)
    const connected: number[] = [0]; // Index in pois array
    const unconnected: number[] = [];
    for(let i=1; i<pois.length; i++) unconnected.push(i);

    while (unconnected.length > 0) {
        let bestDist = Infinity;
        let bestFrom = -1;
        let bestTo = -1;
        let bestToIndex = -1;

        for (const uIdx of connected) {
            for (let i=0; i<unconnected.length; i++) {
                const vIdx = unconnected[i];
                const u = pois[uIdx];
                const v = pois[vIdx];
                const dist = Math.abs(u.x - v.x) + Math.abs(u.y - v.y);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestFrom = uIdx;
                    bestTo = vIdx;
                    bestToIndex = i;
                }
            }
        }

        if (bestFrom !== -1) {
            // Pfad graben von pois[bestFrom] zu pois[bestTo]
            const start = pois[bestFrom];
            const end = pois[bestTo];
            
            // Simpler L-Shape Pfad mit Noise Deviation
            let currX = start.x;
            let currY = start.y;
            
            while (currX !== end.x || currY !== end.y) {
                // Zeichne Pfad
                tiles[currY][currX] = 4; // Path
                // Breite Variation
                if (rng.next() > 0.7) {
                    if (currY+1 < GENERATED_MAP_SIZE) tiles[currY+1][currX] = 4;
                    if (currX+1 < GENERATED_MAP_SIZE) tiles[currY][currX+1] = 4;
                }

                // Move
                if (rng.next() > 0.5) {
                    if (currX !== end.x) currX += (end.x > currX ? 1 : -1);
                    else if (currY !== end.y) currY += (end.y > currY ? 1 : -1);
                } else {
                    if (currY !== end.y) currY += (end.y > currY ? 1 : -1);
                    else if (currX !== end.x) currX += (end.x > currX ? 1 : -1);
                }
            }
            
            connected.push(bestTo);
            unconnected.splice(bestToIndex, 1);
        } else {
            break; // Should not happen
        }
    }

    // 4. Terrain & Biomes
    for (let y = 0; y < GENERATED_MAP_SIZE; y++) {
        for (let x = 0; x < GENERATED_MAP_SIZE; x++) {
            // Existing Path protect
            if (tiles[y][x] === 4) continue;

            const elev = noise.noise(x * 0.05, y * 0.05);
            const forest = forestNoise.noise(x * 0.1, y * 0.1);
            
            // Wasser (Lakes)
            if (elev < -0.3) {
                tiles[y][x] = 2; // Water
                continue;
            }

            // POI Areas clearen (Radius um POIs)
            let isPOIArea = false;
            for (const p of pois) {
                if (Math.abs(p.x - x) < 6 && Math.abs(p.y - y) < 5) {
                    isPOIArea = true;
                    // Untergrund für POI
                    if (p.type === 'house') tiles[y][x] = 0; // Wiese
                    if (p.type === 'ruin') tiles[y][x] = (rng.next() > 0.5 ? 4 : 0); // Dreck/Wiese
                    break;
                }
            }
            if (isPOIArea) continue;

            // Biome Vegetation
            if (forest > 0.2) {
                // Dichter Wald
                if (rng.next() > 0.15) tiles[y][x] = 1; // Baum
                else tiles[y][x] = 11; // Busch
            } else if (forest > 0.0) {
                // Mischwald
                if (rng.next() > 0.7) tiles[y][x] = 1;
                else if (rng.next() > 0.6) tiles[y][x] = 11;
                else if (rng.next() > 0.8) tiles[y][x] = 7; // Blume
            } else {
                // Wiese / Offen
                if (rng.next() > 0.95) tiles[y][x] = 12; // Hohes Gras
                else if (rng.next() > 0.97) tiles[y][x] = 7; // Blume
                else if (rng.next() > 0.99) tiles[y][x] = 8; // Stein
            }
        }
    }

    // 5. Build POI Structures
    for (const p of pois) {
        if (p.type === 'house') {
            // Haus bauen
            // Prüfen ob Platz (einfacher check reicht meist durch Clearing oben)
            const hx = p.x - 2;
            const hy = p.y - 2;
            
            // Haus 5x4
            for(let dx=0; dx<5; dx++) { tiles[hy][hx+dx] = 10; tiles[hy+1][hx+dx] = 10; }
            for(let dx=0; dx<5; dx++) { tiles[hy+2][hx+dx] = 9; tiles[hy+3][hx+dx] = 9; }
            tiles[hy+3][hx+2] = 5; // Tür
            // Weg zur Tür
            tiles[hy+4][hx+2] = 4;

            // Interior
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

            // Innenraum generieren
            const interiorTiles: number[][] = [];
            const w = 9, h = 8;
            for(let iy=0; iy<h; iy++) {
                const row = [];
                for(let ix=0; ix<w; ix++) {
                    if (iy===0 || iy===h-1 || ix===0 || ix===w-1) row.push(1); 
                    else row.push(3);
                }
                interiorTiles.push(row);
            }
            interiorTiles[h-1][4] = 5;
            
            // Möbel/Deko
            interiorTiles[4][4] = 6; // Teppich

            const iInteractables: Interactable[] = [];
            if (rng.next() > 0.3) {
                iInteractables.push({
                    id: `npc_${houseId}`,
                    position: { x: 4 * TILE_SIZE, y: 3 * TILE_SIZE },
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                    type: 'npc',
                    text: ["Hallo!", "Schön, dass du mich besuchst."],
                    active: true,
                    trigger: 'press'
                });
            }

            interiorMaps[houseId] = {
                id: houseId,
                tiles: interiorTiles,
                interactables: iInteractables,
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
        } else if (p.type === 'ruin') {
            // Ruinen: Steine und Säulen (nutze Tile 8 und 1)
            for(let dy=-2; dy<=2; dy++) {
                for(let dx=-2; dx<=2; dx++) {
                    if (rng.next() > 0.6) tiles[p.y+dy][p.x+dx] = 8; // Stein
                    if (rng.next() > 0.8) tiles[p.y+dy][p.x+dx] = 4; // Alter Boden
                }
            }
            // Loot
            interactables.push({
                id: `ruin_loot_${p.x}_${p.y}`,
                position: { x: p.x * TILE_SIZE, y: p.y * TILE_SIZE },
                width: TILE_SIZE,
                height: TILE_SIZE,
                type: 'item',
                itemKey: rng.next() > 0.5 ? 'potion' : 'old_key',
                active: true,
                trigger: 'press'
            });
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
