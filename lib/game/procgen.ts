// Einfacher Pseudo-Random Number Generator mit Seed
class RNG {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Linear Congruential Generator
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

// Einfaches 2D Noise (Value Noise basierend)
class SimpleNoise {
  private rng: RNG;
  private perm: number[] = [];

  constructor(seed: number = Math.random()) {
    this.rng = new RNG(seed * 10000);
    // Permutation Table initialisieren
    for (let i = 0; i < 256; i++) {
        this.perm[i] = i;
    }
    // Shuffle
    for (let i = 0; i < 256; i++) {
        const j = Math.floor(this.rng.next() * 256);
        const temp = this.perm[i];
        this.perm[i] = this.perm[j];
        this.perm[j] = temp;
    }
    // Verdoppeln für einfachen Überlaufzugriff
    this.perm = [...this.perm, ...this.perm];
  }

  private fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number) {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number) {
      const h = hash & 15;
      const u = h < 8 ? x : y;
      const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  // 2D Perlin-like Noise
  public noise(x: number, y: number): number {
      const X = Math.floor(x) & 255;
      const Y = Math.floor(y) & 255;

      x -= Math.floor(x);
      y -= Math.floor(y);

      const u = this.fade(x);
      const v = this.fade(y);

      const A = this.perm[X] + Y;
      const B = this.perm[X + 1] + Y;

      return this.lerp(v, 
          this.lerp(u, this.grad(this.perm[A], x, y), this.grad(this.perm[B], x - 1, y)),
          this.lerp(u, this.grad(this.perm[A + 1], x, y - 1), this.grad(this.perm[B + 1], x - 1, y - 1))
      );
  }
}

import { TileType } from './map';
import { Interactable } from './types';

export const GENERATED_MAP_SIZE = 100; // 100x100 Tiles

export interface GeneratedMap {
    tiles: number[][];
    interactables: Interactable[];
    spawn: { x: number, y: number };
}

export const generateWorld = (seed: number = Date.now()): GeneratedMap => {
    const noise = new SimpleNoise(seed);
    const tiles: number[][] = [];
    const interactables: Interactable[] = [];
    let spawn = { x: 50, y: 50 };
    let spawnFound = false;

    // 1. Terrain generieren
    for (let y = 0; y < GENERATED_MAP_SIZE; y++) {
        const row: number[] = [];
        for (let x = 0; x < GENERATED_MAP_SIZE; x++) {
            // Skalierung für Noise Frequenz
            const scale = 0.1;
            const elevation = noise.noise(x * scale, y * scale);
            const moisture = noise.noise(x * scale * 0.5 + 500, y * scale * 0.5 + 500);

            let tile = 0; // Gras Default

            if (elevation < -0.2) {
                tile = 2; // Wasser (Deep)
            } else if (elevation < 0.3) {
                // Land
                if (moisture > 0.3) {
                    tile = 1; // Wald/Baum (bei hoher Feuchtigkeit)
                    // Noise für Baum-Dichte
                    if (Math.random() > 0.4) tile = 0; // Nicht alles voller Bäume
                } else {
                    tile = 0; // Gras
                    // Sand/Path Flecken
                    if (moisture < -0.4) tile = 4; // Sand/Erde
                }
            } else {
                tile = 1; // Berge/Wände
            }

            // Randmauern erzwingen
            if (x === 0 || x === GENERATED_MAP_SIZE - 1 || y === 0 || y === GENERATED_MAP_SIZE - 1) {
                tile = 1;
            }

            row.push(tile);

            // Spawn Point suchen (Erstes Gras in der Mitte)
            if (!spawnFound && tile === 0 && x > 40 && x < 60 && y > 40 && y < 60) {
                spawn = { x, y };
                spawnFound = true;
            }
        }
        tiles.push(row);
    }

    // 2. Dekoration & Items platzieren
    const rng = new RNG(seed);
    for (let i = 0; i < 20; i++) {
        const x = Math.floor(rng.next() * (GENERATED_MAP_SIZE - 2)) + 1;
        const y = Math.floor(rng.next() * (GENERATED_MAP_SIZE - 2)) + 1;
        
        if (tiles[y][x] === 0) { // Nur auf Gras
            // 50% Chance Item, 50% NPC/Schild
            if (rng.next() > 0.5) {
                interactables.push({
                    id: `gen_item_${i}`,
                    position: { x: x * 32, y: y * 32 }, // Position wird später angepasst an TILE_SIZE
                    width: 32,
                    height: 32,
                    type: 'item',
                    itemKey: rng.next() > 0.5 ? 'potion' : 'old_key',
                    active: true,
                    trigger: 'press'
                });
            } else {
                 interactables.push({
                    id: `gen_npc_${i}`,
                    position: { x: x * 32, y: y * 32 },
                    width: 32,
                    height: 32,
                    type: 'npc',
                    text: ["Ich habe mich in diesem prozeduralen Wald verlaufen...", "Kennst du den Weg?"],
                    active: true,
                    trigger: 'press'
                });
            }
        }
    }

    return { tiles, interactables, spawn };
};

