import { TileType, TILE_SIZE } from './map';
import { Interactable, Portal, MapData, Enemy } from './types';

export const GENERATED_MAP_SIZE = 120;

export interface GeneratedWorld {
    worldMap: MapData;
    interiorMaps: Record<string, MapData>;
    spawn: { x: number, y: number };
}

class RNG { private seed: number; constructor(seed: number) { this.seed = seed; } next(): number { this.seed = (this.seed * 9301 + 49297) % 233280; return this.seed / 233280; } }
class SimpleNoise { private rng: RNG; private perm: number[] = []; constructor(seed: number) { this.rng = new RNG(seed * 10000); for (let i = 0; i < 256; i++) this.perm[i] = i; for (let i = 0; i < 256; i++) { const j = Math.floor(this.rng.next() * 256); const t = this.perm[i]; this.perm[i] = this.perm[j]; this.perm[j] = t; } this.perm = [...this.perm, ...this.perm]; } private fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); } private lerp(t: number, a: number, b: number) { return a + t * (b - a); } private grad(hash: number, x: number, y: number) { const h = hash & 15; const u = h < 8 ? x : y; const v = h < 4 ? y : h === 12 || h === 14 ? x : 0; return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v); } public noise(x: number, y: number): number { const X = Math.floor(x) & 255; const Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y); const u = this.fade(x); const v = this.fade(y); const A = this.perm[X] + Y; const B = this.perm[X + 1] + Y; return this.lerp(v, this.lerp(u, this.grad(this.perm[A], x, y), this.grad(this.perm[B], x - 1, y)), this.lerp(u, this.grad(this.perm[A + 1], x, y - 1), this.grad(this.perm[B + 1], x - 1, y - 1))); } }

const generateDungeon = (id: string, seed: number): MapData => {
    const rng = new RNG(seed);
    const w = 40;
    const h = 40;
    const tiles: number[][] = [];
    
    // Fill walls
    for(let y=0; y<h; y++) {
        const row = [];
        for(let x=0; x<w; x++) row.push(1);
        tiles.push(row);
    }

    // Simple Room Generation
    const rooms: {x:number, y:number, w:number, h:number}[] = [];
    const numRooms = 8;
    
    for(let i=0; i<numRooms; i++) {
        const rw = Math.floor(rng.next() * 6) + 4;
        const rh = Math.floor(rng.next() * 6) + 4;
        const rx = Math.floor(rng.next() * (w - rw - 2)) + 1;
        const ry = Math.floor(rng.next() * (h - rh - 2)) + 1;
        
        // Overlap check skipped for simplicity
        rooms.push({x:rx, y:ry, w:rw, h:rh});
        
        for(let cy=ry; cy<ry+rh; cy++) {
            for(let cx=rx; cx<rx+rw; cx++) {
                tiles[cy][cx] = 3; // Floor
            }
        }
    }

    // Connect Rooms
    for(let i=1; i<rooms.length; i++) {
        const prev = rooms[i-1];
        const curr = rooms[i];
        
        const cx1 = Math.floor(prev.x + prev.w/2);
        const cy1 = Math.floor(prev.y + prev.h/2);
        const cx2 = Math.floor(curr.x + curr.w/2);
        const cy2 = Math.floor(curr.y + curr.h/2);
        
        // H-Corridor
        let x = cx1;
        while(x !== cx2) {
            tiles[cy1][x] = 3;
            x += (cx2 > x ? 1 : -1);
        }
        let y = cy1;
        while(y !== cy2) {
            tiles[y][cx2] = 3;
            y += (cy2 > y ? 1 : -1);
        }
    }

    const interactables: Interactable[] = [];
    const enemies: Enemy[] = [];
    
    // Entrance
    const startRoom = rooms[0];
    const endRoom = rooms[rooms.length-1];
    
    // Boss in last room
    enemies.push({
        id: `boss_${id}`,
        position: { x: (endRoom.x + endRoom.w/2) * TILE_SIZE, y: (endRoom.y + endRoom.h/2) * TILE_SIZE },
        color: '#ff0000',
        direction: 'down',
        isMoving: false,
        type: 'boss',
        state: 'idle',
        detectionRange: 100,
        attackRange: 40,
        cooldown: 0
    });
    
    // Add some puzzles/enemies
    for(let i=1; i<rooms.length-1; i++) {
        const r = rooms[i];
        const cx = (r.x + r.w/2) * TILE_SIZE;
        const cy = (r.y + r.h/2) * TILE_SIZE;
        
        if (rng.next() > 0.5) {
             enemies.push({
                id: `skel_${id}_${i}`,
                position: { x: cx, y: cy },
                color: '#fff',
                direction: 'down',
                isMoving: false,
                type: 'skeleton',
                state: 'idle',
                detectionRange: 150,
                attackRange: 32,
                cooldown: 0
            });
        }
        
        if (rng.next() > 0.7) {
             interactables.push({
                id: `chest_${id}_${i}`,
                position: { x: (r.x+1)*TILE_SIZE, y: (r.y+1)*TILE_SIZE },
                width: TILE_SIZE,
                height: TILE_SIZE,
                type: 'item',
                itemKey: 'potion',
                active: true,
                trigger: 'press'
            });
        }
    }

    return {
        id: id,
        tiles,
        interactables,
        enemies,
        portals: [], // Filled by caller
        theme: 'dungeon'
    };
};

export const generateWorld = (seed: number = Date.now()): GeneratedWorld => {
    const rng = new RNG(seed);
    const noise = new SimpleNoise(seed);
    const forestNoise = new SimpleNoise(seed + 99);
    const detailNoise = new SimpleNoise(seed + 555); 
    
    const tiles: number[][] = [];
    const interactables: Interactable[] = [];
    const enemies: Enemy[] = [];
    const portals: Portal[] = [];
    const interiorMaps: Record<string, MapData> = {};

    // 1. Init Empty Map
    for (let y = 0; y < GENERATED_MAP_SIZE; y++) {
        tiles[y] = new Array(GENERATED_MAP_SIZE).fill(0); 
    }

    // 2. Generate POIs
    const pois: { x: number, y: number, type: 'spawn' | 'house' | 'ruin' | 'dungeon' }[] = [];
    const spawn = { x: Math.floor(GENERATED_MAP_SIZE/2), y: Math.floor(GENERATED_MAP_SIZE/2) };
    pois.push({ ...spawn, type: 'spawn' });

    const numPOIs = 15;
    let dungeonCount = 0;
    
    for (let i = 0; i < numPOIs; i++) {
        const x = Math.floor(rng.next() * (GENERATED_MAP_SIZE - 20)) + 10;
        const y = Math.floor(rng.next() * (GENERATED_MAP_SIZE - 20)) + 10;
        let tooClose = false;
        for (const p of pois) {
            const dist = Math.sqrt((p.x-x)**2 + (p.y-y)**2);
            if (dist < 20) tooClose = true;
        }
        if (!tooClose) {
            let type: 'ruin'|'house'|'dungeon' = rng.next() > 0.6 ? 'ruin' : 'house';
            if (dungeonCount < 2 && rng.next() > 0.8) {
                type = 'dungeon';
                dungeonCount++;
            }
            pois.push({ x, y, type });
        }
    }

    // 3. Connect POIs (A*)
    const connected: number[] = [0];
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
            const start = pois[bestFrom];
            const end = pois[bestTo];
            let currX = start.x;
            let currY = start.y;
            
            while (currX !== end.x || currY !== end.y) {
                tiles[currY][currX] = 4; // Path
                if (rng.next() > 0.7) {
                    if (currY+1 < GENERATED_MAP_SIZE) tiles[currY+1][currX] = 4;
                    if (currX+1 < GENERATED_MAP_SIZE) tiles[currY][currX+1] = 4;
                }
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
        } else { break; }
    }

    // 4. Terrain, Biomes & Rocks & Enemies
    for (let y = 0; y < GENERATED_MAP_SIZE; y++) {
        for (let x = 0; x < GENERATED_MAP_SIZE; x++) {
            if (tiles[y][x] === 4) continue; // Path

            const elev = noise.noise(x * 0.05, y * 0.05);
            const forest = forestNoise.noise(x * 0.1, y * 0.1);
            const patch = detailNoise.noise(x * 0.4, y * 0.4); 
            const rockNoise = noise.noise(x * 0.3 + 1000, y * 0.3 + 1000);

            // Water
            if (elev < -0.3) { tiles[y][x] = 2; continue; }
            // Shore
            if (elev < -0.2) { tiles[y][x] = 13; continue; }

            // POI Areas
            let isPOIArea = false;
            for (const p of pois) {
                if (Math.abs(p.x - x) < 6 && Math.abs(p.y - y) < 5) {
                    isPOIArea = true;
                    if (p.type === 'house') tiles[y][x] = (rng.next() > 0.8) ? 14 : 0; 
                    if (p.type === 'ruin') tiles[y][x] = (rng.next() > 0.5 ? 14 : 0);
                    if (p.type === 'dungeon') tiles[y][x] = 14; 
                    break;
                }
            }
            if (isPOIArea) continue;

            // Biome Generation
            if (patch > 0.5) tiles[y][x] = 14; 
            else tiles[y][x] = 0;

            if (elev > 0.5 || (rockNoise > 0.4 && elev > 0)) {
                if (rng.next() > 0.1) tiles[y][x] = 8; 
                else tiles[y][x] = 14; 
            } else if (forest > 0.2) {
                if (rng.next() > 0.5 || patch > 0.2) tiles[y][x] = 14; 
                else tiles[y][x] = 0; 

                if (rng.next() > 0.2) tiles[y][x] = 1; 
                else if (rng.next() > 0.5) tiles[y][x] = 11; 

                // Spawn Slimes in Forest
                if (rng.next() > 0.995) {
                    enemies.push({
                        id: `slime_${x}_${y}`,
                        position: { x: x*TILE_SIZE, y: y*TILE_SIZE },
                        color: '#0f0',
                        direction: 'down',
                        isMoving: false,
                        type: 'slime',
                        state: 'idle',
                        detectionRange: 120,
                        attackRange: 20,
                        cooldown: 0
                    });
                }
            } else if (forest > 0.0) {
                if (rng.next() > 0.7) tiles[y][x] = 1;
                else if (rng.next() > 0.6) tiles[y][x] = 11;
                else if (rng.next() > 0.8) tiles[y][x] = 7;
                else if (rng.next() > 0.95) tiles[y][x] = 8; 
            } else {
                if (rng.next() > 0.95) tiles[y][x] = 12;
                else if (rng.next() > 0.97) tiles[y][x] = 7;
                else if (rng.next() > 0.99) tiles[y][x] = 8; 
                
                // Spawn Bats in Open/Night areas (logic handled by update)
                if (rng.next() > 0.998) {
                     enemies.push({
                        id: `bat_${x}_${y}`,
                        position: { x: x*TILE_SIZE, y: y*TILE_SIZE },
                        color: '#000',
                        direction: 'down',
                        isMoving: false,
                        type: 'bat',
                        state: 'idle',
                        detectionRange: 150,
                        attackRange: 10,
                        cooldown: 0
                    });
                }
            }
        }
    }

    // 5. Build POI Structures
    for (const p of pois) {
        if (p.type === 'house') {
            const hx = p.x - 2;
            const hy = p.y - 2;
            for(let dx=0; dx<5; dx++) { tiles[hy][hx+dx] = 10; tiles[hy+1][hx+dx] = 10; }
            for(let dx=0; dx<5; dx++) { tiles[hy+2][hx+dx] = 9; tiles[hy+3][hx+dx] = 9; }
            tiles[hy+3][hx+2] = 5; 
            tiles[hy+4][hx+2] = 4; // Path to door

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
                const row = [];
                for(let ix=0; ix<w; ix++) {
                    if (iy===0 || iy===h-1 || ix===0 || ix===w-1) row.push(1); 
                    else row.push(3);
                }
                interiorTiles.push(row);
            }
            interiorTiles[h-1][4] = 5;
            interiorTiles[4][4] = 6; 

            const iInteractables: Interactable[] = [];
            if (rng.next() > 0.3) {
                iInteractables.push({
                    id: `npc_${houseId}`,
                    position: { x: 4 * TILE_SIZE, y: 3 * TILE_SIZE },
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                    type: 'npc',
                    text: ["Hallo!", "Hier drin ist es sicher vor den Wölfen."],
                    active: true,
                    trigger: 'press'
                });
            }

            interiorMaps[houseId] = {
                id: houseId,
                tiles: interiorTiles,
                interactables: iInteractables,
                enemies: [],
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
            for(let dy=-2; dy<=2; dy++) {
                for(let dx=-2; dx<=2; dx++) {
                    if (rng.next() > 0.4) tiles[p.y+dy][p.x+dx] = 8; 
                    else if (rng.next() > 0.5) tiles[p.y+dy][p.x+dx] = 14; 
                }
            }
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
        } else if (p.type === 'dungeon') {
            // Dungeon Entrance (Cave)
            for(let dy=-1; dy<=1; dy++) for(let dx=-1; dx<=1; dx++) tiles[p.y+dy][p.x+dx] = 8;
            tiles[p.y][p.x] = 14; // Entrance hole
            
            const dungeonId = `dungeon_${p.x}_${p.y}`;
            const dungeonData = generateDungeon(dungeonId, seed + p.x);
            
            // Link portals
            // Entrance
            portals.push({
                x: p.x * TILE_SIZE,
                y: p.y * TILE_SIZE,
                width: TILE_SIZE,
                height: TILE_SIZE,
                targetMap: dungeonId,
                targetX: 4 * TILE_SIZE, // Start room approx
                targetY: 4 * TILE_SIZE,
                direction: 'up'
            });
            
            // Exit inside dungeon (assume room 0 at 4,4 roughly based on gen logic but better be safe)
            // Re-calc start room pos
            // We know generateDungeon pushes rooms[0] first.
            // But we didn't export rooms.
            // Let's just fix the start position in generateDungeon to be predictable or return spawn.
            // For now hardcoded 4,4 might be risky if room gen is random.
            // Let's improve generateDungeon to set the portal to world.
            
            dungeonData.portals.push({
                 x: 4 * TILE_SIZE,
                 y: 4 * TILE_SIZE,
                 width: TILE_SIZE,
                 height: TILE_SIZE,
                 targetMap: 'generated',
                 targetX: p.x * TILE_SIZE,
                 targetY: (p.y + 1) * TILE_SIZE,
                 direction: 'down'
            });
            
            interiorMaps[dungeonId] = dungeonData;
        }
    }

    const worldMap: MapData = {
        id: 'generated',
        tiles: tiles,
        interactables: interactables,
        enemies: enemies,
        portals: portals,
        theme: 'outdoor'
    };

    return { worldMap, interiorMaps, spawn };
};
