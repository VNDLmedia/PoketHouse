import { TileType, TILE_SIZE, MAPS } from './map';
import { Entity, Interactable, WeatherType, Particle, MapData, Enemy } from './types';
import { drawParticles } from './particles';

// --- Palette ---
const COLORS = {
    grass: { base: '#95d5b2', light: '#b7e4c7', dark: '#74c69d', blade: '#52b788', mud: '#7f5539' },
    water: { base: '#48cae4', light: '#90e0ef', dark: '#00b4d8', foam: '#caf0f8', deep: '#0077b6' },
    wall: { base: '#e9ecef', shadow: '#ced4da', outline: '#adb5bd' },
    wood: { base: '#ddb892', dark: '#b08968', grain: '#9c6644' },
    roof: { base: '#d62828', dark: '#9d0208', light: '#e63946' }, 
    houseWall: { base: '#fefae0', shadow: '#faedcd' },
    path: { base: '#e6ccb2', light: '#ede0d4', dark: '#d5b99e', stone: '#9c6644', dirt: '#b08968', edge: 'rgba(100, 80, 60, 0.1)' },
    sand: { base: '#faedcd', wet: '#e0d5b5', dune: '#fefae0' },
    dirt: { base: '#6f4e37', dark: '#5e4030', light: '#8b6b55' },
    player: { skin: '#ffcdb2', shirt: '#e76f51', pants: '#264653', hair: '#2a9d8f', backpack: '#8B4513' },
    tree: { 
        trunk: '#6f4e37', 
        leavesLight: '#588157', 
        leavesDark: '#3a5a40', 
        pineDark: '#2d6a4f', 
        pineLight: '#40916c', 
        shadow: 'rgba(0,0,0,0.2)',
        variations: ['#588157', '#3a5a40', '#606c38', '#283618', '#a3b18a'] 
    },
    flower: { stem: '#52b788', petals: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff'] },
    rock: { base: '#6c757d', light: '#adb5bd', dark: '#495057', moss: '#588157', highlight: '#ced4da' },
    bush: { base: '#40916c', light: '#52b788', dark: '#2d6a4f', berries: '#d00000' }
};

const drawRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
};

const drawCircle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
};

// --- Blending Helpers ---

const getBaseColor = (tile: number): string | null => {
    // Return base colors for ground tiles
    if (tile === 0) return COLORS.grass.base; // Grass
    if (tile === 14) return COLORS.dirt.base; // Dirt
    if (tile === 13) return COLORS.sand.base; // Sand
    if (tile === 2) return COLORS.water.base; // Water
    if (tile === 4) return COLORS.path.base; // Path
    
    // Vegetation/Objects default to Grass background to prevent holes
    if (tile === 1 || tile === 7 || tile === 8 || tile === 11 || tile === 12) return COLORS.grass.base;
    
    return null;
};

// Draws rounded water corners if needed
const drawWaterEdges = (ctx: CanvasRenderingContext2D, tile: number, x: number, y: number, map: MapData, tileX: number, tileY: number) => {
    const isWater = (dx: number, dy: number) => {
        const nx = tileX + dx; const ny = tileY + dy;
        if (nx < 0 || nx >= map.tiles[0].length || ny < 0 || ny >= map.tiles.length) return true; 
        return map.tiles[ny][nx] === 2;
    };
    
    const n = isWater(0, -1); const s = isWater(0, 1); const w = isWater(-1, 0); const e = isWater(1, 0);
    
    const ts = TILE_SIZE;
    const radius = 12;
    const myColor = getBaseColor(tile) || COLORS.grass.base;

    const drawCorner = (cx: number, cy: number, startAngle: number) => {
        ctx.fillStyle = COLORS.water.base;
        ctx.fillRect(cx, cy, radius, radius); 
        ctx.fillStyle = myColor;
        
        let centerX = cx, centerY = cy;
        if (cx === x && cy === y) { centerX = x + radius; centerY = y + radius; } 
        if (cx === x + ts - radius && cy === y) { centerX = x + ts - radius; centerY = y + radius; } 
        if (cx === x && cy === y + ts - radius) { centerX = x + radius; centerY = y + ts - radius; } 
        if (cx === x + ts - radius && cy === y + ts - radius) { centerX = x + ts - radius; centerY = y + ts - radius; } 
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2); 
        ctx.fill();
    };

    if (n && w) drawCorner(x, y, Math.PI); 
    if (n && e) drawCorner(x + ts - radius, y, 1.5 * Math.PI); 
    if (s && w) drawCorner(x, y + ts - radius, 0.5 * Math.PI); 
    if (s && e) drawCorner(x + ts - radius, y + ts - radius, 0); 
};

export const drawTile = (ctx: CanvasRenderingContext2D, tile: number, x: number, y: number, time: number, map: MapData, tileX: number, tileY: number) => {
    const ts = TILE_SIZE;
    
    // 1. Draw Base Ground (Clean, No Blending)
    // We check for specific ground types to apply the Water Edge logic (rounded corners)
    // Include objects (1,7,8,11,12) so they have a background and water curves around them
    if (tile === 0 || tile === 13 || tile === 14 || tile === 4 || 
        tile === 1 || tile === 7 || tile === 8 || tile === 11 || tile === 12) {
        const c = getBaseColor(tile);
        if (c) drawRect(ctx, x, y, ts, ts, c);
        
        // Keep Water Edges (Rounded) because user liked "organic" shapes but disliked "fading"
        drawWaterEdges(ctx, tile, x, y, map, tileX, tileY);
    } else if (tile !== 2 && tile !== 9 && tile !== 10 && tile !== 3 && tile !== 5 && tile !== 6) {
         // Fallback for other base tiles if any
         const c = getBaseColor(tile);
         if (c) drawRect(ctx, x, y, ts, ts, c);
    }

    // 2. Special Rendering (Water Effects, Details)
    if (tile === 2) { 
        // Water Rendering
        drawRect(ctx, x, y, ts, ts, COLORS.water.base);

        const isWater = (dx: number, dy: number) => {
            const ny = tileY + dy; const nx = tileX + dx;
            if (ny < 0 || ny >= map.tiles.length || nx < 0 || nx >= map.tiles[0].length) return true; 
            return map.tiles[ny][nx] === 2;
        };
        const n = isWater(0, -1); const s = isWater(0, 1); const w = isWater(-1, 0); const e = isWater(1, 0);
        
        const borderSize = 3; 
        ctx.fillStyle = COLORS.water.foam;
        const wave = Math.sin(time / 400 + tileX) * 1.5;
        
        if (!n) ctx.fillRect(x, y, ts, borderSize + wave);
        if (!s) ctx.fillRect(x, y + ts - borderSize - wave, ts, borderSize + wave);
        if (!w) ctx.fillRect(x, y, borderSize + wave, ts);
        if (!e) ctx.fillRect(x + ts - borderSize - wave, y, borderSize + wave, ts);
        
        if (n && s && w && e) { 
            ctx.fillStyle = COLORS.water.deep; 
            if ((tileX * tileY) % 7 === 0) ctx.fillRect(x + 4, y + 4, ts - 8, ts - 8); 
        }
        return; 
    }

    switch (tile) {
        case 0: // Grass Details
            const seed = (tileX * 7 + tileY * 13);
            if (seed % 7 === 0) { ctx.fillStyle = COLORS.grass.dark; ctx.fillRect(x + (seed%16), y + (seed%16), 4, 4); }
            if (seed % 5 < 2) {
                const sway = Math.sin(time / 800 + tileX) * 2;
                drawRect(ctx, x + 8 + sway, y + 8, 4, 4, COLORS.grass.dark);
                drawRect(ctx, x + 20 + sway, y + 20, 4, 4, COLORS.grass.light);
            }
            break;
            
        case 4: // Path Details
            const pSeed = tileX * 17 + tileY * 23;
            ctx.fillStyle = COLORS.path.stone;
            if (pSeed % 2 === 0) { const sx1 = x + 8 + (pSeed % 10); const sy1 = y + 8 + ((pSeed * 2) % 10); ctx.fillRect(sx1, sy1, 2, 2); }
            if (pSeed % 5 === 0) { ctx.fillStyle = COLORS.path.dirt; ctx.fillRect(x + ts/2, y + ts/2, 3, 3); }
            break;

        case 1: // Tree
            // ... (Keep existing Tree code)
            const tSeed = (tileX * 123 + tileY * 456); 
            const isPine = tSeed % 3 === 0; 
            const sizeMod = (tSeed % 5) - 2; 
            const centerX = x + ts/2; 
            const bottomY = y + ts; 
            const treeSway = Math.sin(time / 1200 + tileX/50) * 3;
            
            ctx.fillStyle = COLORS.tree.shadow; 
            ctx.beginPath(); ctx.ellipse(centerX, bottomY - 2, 12 + sizeMod, 4, 0, 0, Math.PI*2); ctx.fill();
            drawRect(ctx, centerX - 3 + treeSway/4, bottomY - 12 - sizeMod, 6, 10 + sizeMod, COLORS.tree.trunk);
            const vIndex = tSeed % COLORS.tree.variations.length; const mainColor = COLORS.tree.variations[vIndex];
            if (isPine) {
                const colDark = mainColor; const colLight = COLORS.tree.pineLight; 
                ctx.fillStyle = colDark; ctx.beginPath(); ctx.moveTo(centerX - (12+sizeMod) + treeSway, bottomY - 8); ctx.lineTo(centerX + (12+sizeMod) + treeSway, bottomY - 8); ctx.lineTo(centerX + treeSway/2, bottomY - 24 - sizeMod); ctx.fill();
                ctx.fillStyle = colLight; ctx.beginPath(); ctx.moveTo(centerX - (10+sizeMod) + treeSway, bottomY - 18); ctx.lineTo(centerX + (10+sizeMod) + treeSway, bottomY - 18); ctx.lineTo(centerX + treeSway/2, bottomY - 32 - sizeMod*2); ctx.fill();
                ctx.fillStyle = COLORS.tree.leavesLight; ctx.beginPath(); ctx.moveTo(centerX - (6+sizeMod) + treeSway, bottomY - 28); ctx.lineTo(centerX + (6+sizeMod) + treeSway, bottomY - 28); ctx.lineTo(centerX + treeSway/2, bottomY - 38 - sizeMod*3); ctx.fill();
            } else {
                ctx.fillStyle = mainColor; const rBase = 10 + sizeMod; const yBase = bottomY - 18 - sizeMod;
                drawCircle(ctx, centerX + treeSway, yBase, rBase, mainColor);
                const numBlobs = 3 + (tSeed % 3);
                for(let i=0; i<numBlobs; i++) { const bx = centerX + ((tSeed * (i+1)) % 16) - 8 + treeSway; const by = yBase - ((tSeed * (i+2)) % 10); drawCircle(ctx, bx, by, 8, mainColor); }
                ctx.fillStyle = COLORS.tree.leavesLight;
                for(let i=0; i<numBlobs; i++) { const bx = centerX + ((tSeed * (i+1)) % 16) - 8 + treeSway; const by = yBase - ((tSeed * (i+2)) % 10) - 2; drawCircle(ctx, bx, by, 6, COLORS.tree.leavesLight); }
            }
            break;
            
        case 3: // Floor
            drawRect(ctx, x, y, ts, ts, COLORS.wood.base); ctx.fillStyle = COLORS.wood.grain; ctx.fillRect(x, y, ts, 1); ctx.fillRect(x, y + 16, ts, 1); if ((y / ts) % 2 === 0) ctx.fillRect(x, y, 1, 16); else ctx.fillRect(x + 16, y, 1, 16); break;
        case 5: drawRect(ctx, x, y, ts, ts, COLORS.wall.shadow); drawRect(ctx, x + 4, y + 2, ts - 8, ts - 2, COLORS.wood.dark); drawCircle(ctx, x + ts - 8, y + ts/2, 2, '#ffd700'); break;
        case 6: drawRect(ctx, x, y, ts, ts, COLORS.roof.base); drawRect(ctx, x + 2, y + 2, ts - 4, ts - 4, COLORS.roof.dark); break;
        case 8: // Rock
             const rSeed = (tileX * 99 + tileY * 77); const rSize = (rSeed % 3); const rType = (rSeed % 2); const hasMoss = (rSeed % 3 === 0);
            const rx = x + ts/2; const ry = y + ts/2 + 4;
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(rx, ry + 8, 12 + rSize*2, 5, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = COLORS.rock.base; ctx.beginPath();
            if (rType === 0) { ctx.arc(rx, ry, 10 + rSize, 0, Math.PI*2); ctx.arc(rx - 6 - rSize, ry + 4, 6 + rSize, 0, Math.PI*2); ctx.arc(rx + 6 + rSize, ry + 4, 7 + rSize, 0, Math.PI*2); } else { ctx.moveTo(rx, ry - 14 - rSize); ctx.lineTo(rx + 12 + rSize, ry); ctx.lineTo(rx + 8 + rSize, ry + 12 + rSize); ctx.lineTo(rx - 8 - rSize, ry + 12 + rSize); ctx.lineTo(rx - 12 - rSize, ry); }
            ctx.fill();
            ctx.fillStyle = COLORS.rock.dark; ctx.beginPath();
            if (rType === 0) { ctx.arc(rx + 4, ry + 4, 8 + rSize, 0, Math.PI*2); } else { ctx.moveTo(rx + 12 + rSize, ry); ctx.lineTo(rx + 8 + rSize, ry + 12 + rSize); ctx.lineTo(rx, ry + 12 + rSize); }
            ctx.fill();
            ctx.fillStyle = COLORS.rock.light;
            if (rType === 0) { ctx.beginPath(); ctx.arc(rx - 4, ry - 4, 4, 0, Math.PI*2); ctx.fill(); } else { ctx.beginPath(); ctx.moveTo(rx, ry - 14 - rSize); ctx.lineTo(rx - 4, ry); ctx.lineWidth = 2; ctx.strokeStyle = COLORS.rock.light; ctx.stroke(); }
            if (hasMoss) { ctx.fillStyle = COLORS.rock.moss; ctx.beginPath(); ctx.arc(rx, ry - 6, 4, 0, Math.PI*2); ctx.arc(rx - 3, ry - 4, 3, 0, Math.PI*2); ctx.fill(); }
            break;
        case 9: drawRect(ctx, x, y, ts, ts, COLORS.houseWall.base); ctx.fillStyle = COLORS.wood.dark; ctx.fillRect(x, y, 4, ts); ctx.fillRect(x + ts - 4, y, 4, ts); if (y % 64 === 0) ctx.fillRect(x, y + ts - 4, ts, 4); break;
        case 10: drawRect(ctx, x, y, ts, ts, COLORS.roof.base); ctx.fillStyle = COLORS.roof.dark; ctx.fillRect(x, y + 14, ts, 2); ctx.fillRect(x, y + 28, ts, 2); ctx.fillRect(x + 14, y, 2, 14); ctx.fillRect(x + 2, y + 16, 2, 14); break;

        case 13: // Sand Details
            const sWave = Math.sin(tileX/2 + tileY/2) * 5;
            ctx.fillStyle = COLORS.sand.dune; ctx.beginPath(); ctx.ellipse(x + 16 + sWave, y + 16, 12, 6, 0.2, 0, Math.PI * 2); ctx.fill();
            if (tileX % 4 === 0) { ctx.fillStyle = COLORS.sand.wet; drawCircle(ctx, x + 8, y + 24, 2, COLORS.sand.wet); drawCircle(ctx, x + 24, y + 8, 2, COLORS.sand.wet); }
            break;

        case 14: // Dirt Details
            for(let i=0; i<4; i++) { const dx = (tileX * 17 + i * 13) % 24; const dy = (tileY * 19 + i * 7) % 24; ctx.fillStyle = (i%2===0) ? COLORS.dirt.dark : COLORS.dirt.light; ctx.fillRect(x + dx, y + dy, 3, 3); }
            break;

        case 7: // Flower
            const fSeed = (tileX * 11 + tileY * 17); const stemX = x + 16 + (fSeed % 8) - 4; const stemY = y + 24; const fSway = Math.sin(time / 400 + tileX) * 2;
            ctx.strokeStyle = COLORS.flower.stem; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(stemX, stemY); ctx.quadraticCurveTo(stemX + fSway, stemY - 4, stemX + fSway, stemY - 10); ctx.stroke();
            const petalIdx = fSeed % COLORS.flower.petals.length; const petalColor = COLORS.flower.petals[petalIdx];
            if (fSeed % 2 === 0) { drawCircle(ctx, stemX + fSway, stemY - 10, 4, petalColor); drawCircle(ctx, stemX - 3 + fSway, stemY - 12, 3, petalColor); drawCircle(ctx, stemX + 3 + fSway, stemY - 12, 3, petalColor); drawCircle(ctx, stemX + fSway, stemY - 14, 3, petalColor); drawCircle(ctx, stemX + fSway, stemY - 10, 2, '#fff'); } 
            else { ctx.fillStyle = petalColor; ctx.beginPath(); ctx.moveTo(stemX + fSway, stemY - 6); ctx.lineTo(stemX - 4 + fSway, stemY - 14); ctx.lineTo(stemX + fSway, stemY - 10); ctx.lineTo(stemX + 4 + fSway, stemY - 14); ctx.fill(); }
            break;

        case 11: // Bush
            const bSway = Math.sin(time / 600 + tileX) * 1; const bx = x + ts/2; const by = y + ts/2 + 4; const bSeed = tileX * tileY; const bSize = (bSeed % 4); 
            ctx.fillStyle = COLORS.bush.dark; drawCircle(ctx, bx - 6 + bSway - bSize, by + 4, 8 + bSize, COLORS.bush.dark); drawCircle(ctx, bx + 6 + bSway + bSize, by + 4, 8 + bSize, COLORS.bush.dark);
            drawCircle(ctx, bx + bSway, by - 2 - bSize, 10 + bSize, COLORS.bush.base); drawCircle(ctx, bx + bSway, by - 2 - bSize, 6 + bSize, COLORS.bush.light);
            if (tileX % 3 === 0) { drawCircle(ctx, bx - 4 + bSway, by, 2, COLORS.bush.berries); drawCircle(ctx, bx + 4 + bSway, by + 2, 2, COLORS.bush.berries); drawCircle(ctx, bx + bSway, by - 6, 2, COLORS.bush.berries); }
            break;

        case 12: // Tall Grass
            const gSway = Math.sin(time / 300 + tileX + tileY) * 3; ctx.fillStyle = COLORS.grass.blade;
            for(let i=0; i<3; i++) { const gx = x + 8 + (i * 8); const gy = y + 24 + ((tileX*i)%4); ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + 2 + gSway, gy - 12); ctx.lineTo(gx + 4, gy); ctx.fill(); }
            break;

        default: 
            break;
    }
};

export const drawPlayer = (ctx: CanvasRenderingContext2D, player: Entity, x: number, y: number, time: number) => {
    const ts = TILE_SIZE;
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(x + ts/2, y + ts - 2, 10, 4, 0, 0, Math.PI*2); ctx.fill();
    const bounce = player.isMoving ? Math.abs(Math.sin(time / 150)) * 2 : 0;
    const py = y + 2 - bounce; const px = x + 8;

    drawRect(ctx, px, py + 12, 16, 14, COLORS.player.shirt); 
    drawRect(ctx, px, py, 16, 14, COLORS.player.skin);

    if (player.direction === 'up') {
        ctx.fillStyle = COLORS.player.backpack;
        ctx.fillRect(px + 2, py + 4, 12, 10);
        ctx.fillStyle = '#6d4c41'; 
        ctx.fillRect(px + 3, py + 10, 10, 4);
    }
    
    const legOff = player.isMoving ? Math.sin(time / 100) * 4 : 0; 
    drawRect(ctx, px + 2, py + 24, 5, 6 + legOff, COLORS.player.pants); 
    drawRect(ctx, px + 9, py + 24, 5, 6 - legOff, COLORS.player.pants);

    if (player.direction !== 'down') {
        ctx.fillStyle = COLORS.player.shirt; 
        let bx = px + 4; 
        if (player.direction === 'left') bx += 8; 
        if (player.direction === 'right') bx -= 8;
        const armSwing = player.isMoving ? Math.sin(time / 150) * 5 : 0;
        ctx.save();
        ctx.translate(bx, py + 14);
        ctx.rotate(armSwing * 0.1);
        ctx.fillStyle = COLORS.player.shirt;
        ctx.fillRect(0, 0, 6, 8);
        ctx.fillStyle = COLORS.player.skin;
        ctx.fillRect(0, 8, 6, 4);
        ctx.restore();
    } else {
        ctx.fillStyle = COLORS.player.shirt;
        ctx.fillRect(px - 4, py + 14, 4, 8); 
        ctx.fillRect(px + 16, py + 14, 4, 8); 
        ctx.fillStyle = COLORS.player.skin;
        ctx.fillRect(px - 4, py + 22, 4, 4); 
        ctx.fillRect(px + 16, py + 22, 4, 4); 
    }

    ctx.fillStyle = COLORS.player.hair; 
    ctx.fillRect(px, py - 2, 16, 8); 
    ctx.fillRect(px - 2, py + 2, 2, 6); 
    ctx.fillRect(px + 16, py + 2, 2, 6); 
    
    if (player.direction !== 'up') {
        ctx.fillRect(px + 2, py, 4, 4);
        ctx.fillRect(px + 10, py, 4, 4);
        ctx.fillStyle = '#264653'; 
        let eyeOffX = 0; let eyeOffY = 0;
        switch (player.direction) { case 'left': eyeOffX = -3; break; case 'right': eyeOffX = 3; break; case 'down': eyeOffY = 1; break; }
        drawRect(ctx, px + 4 + eyeOffX, py + 8 + eyeOffY, 2, 3, '#264653'); 
        drawRect(ctx, px + 10 + eyeOffX, py + 8 + eyeOffY, 2, 3, '#264653'); 
        if (player.direction === 'down') {
             ctx.fillStyle = '#d00000';
             ctx.fillRect(px + 7, py + 14, 2, 1);
        }
    }
};

export const drawEnemy = (ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, y: number, time: number) => {
    const ts = TILE_SIZE;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(x + ts/2, y + ts - 4, 8, 3, 0, 0, Math.PI*2); ctx.fill();
    
    if (enemy.type === 'slime') {
        const bounce = Math.abs(Math.sin(time / 300)) * 6;
        ctx.fillStyle = '#52b788';
        ctx.beginPath();
        ctx.ellipse(x + 16, y + 24 - bounce/2, 10 - bounce/4, 8 + bounce/2, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#2d6a4f';
        ctx.beginPath(); ctx.arc(x + 12, y + 20 - bounce, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 20, y + 20 - bounce, 2, 0, Math.PI*2); ctx.fill();
    } else if (enemy.type === 'bat') {
        const fly = Math.sin(time / 100) * 4;
        const wing = Math.sin(time / 50) * 8;
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(x + 16, y + 16 + fly, 6, 0, Math.PI*2); ctx.fill(); // Body
        ctx.beginPath(); ctx.moveTo(x + 10, y + 16 + fly); ctx.lineTo(x - 4, y + 8 + fly + wing); ctx.lineTo(x + 10, y + 20 + fly); ctx.fill(); // L Wing
        ctx.beginPath(); ctx.moveTo(x + 22, y + 16 + fly); ctx.lineTo(x + 36, y + 8 + fly + wing); ctx.lineTo(x + 22, y + 20 + fly); ctx.fill(); // R Wing
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 14, y + 14 + fly, 1, 2); ctx.fillRect(x + 17, y + 14 + fly, 1, 2); 
    } else {
        // Fallback generic
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(x + 8, y + 8, 16, 16);
    }
};

export const drawItem = (ctx: CanvasRenderingContext2D, item: Interactable, time: number) => {
    const x = item.position.x; const y = item.position.y; const float = Math.sin(time / 300) * 3;
    if (item.type === 'item') {
        if (item.itemKey === 'flower') { drawCircle(ctx, x+16, y+16+float, 6, '#ffc6ff'); drawCircle(ctx, x+16, y+16+float, 3, '#fff'); } 
        else if (item.itemKey === 'berry') { const by = y + 10 + float; drawRect(ctx, x + 12, by, 8, 8, '#d00000'); drawRect(ctx, x + 16, by - 2, 2, 4, '#52b788'); } 
        else if (item.itemKey?.includes('potion')) { const by = y + 10 + float; drawRect(ctx, x + 12, by, 8, 10, '#ff99c8'); drawRect(ctx, x + 14, by - 4, 4, 4, '#fff'); drawRect(ctx, x + 13, by - 6, 6, 2, '#ad7a99'); ctx.fillStyle = 'rgba(255, 153, 200, 0.3)'; ctx.beginPath(); ctx.arc(x + 16, by + 5, 10 + Math.sin(time/200)*2, 0, Math.PI*2); ctx.fill(); } 
        else if (item.itemKey?.includes('key')) { const by = y + 10 + float; drawRect(ctx, x + 10, by, 12, 8, '#ffd700'); drawRect(ctx, x + 18, by + 8, 2, 6, '#ffd700'); drawRect(ctx, x + 20, by + 12, 2, 2, '#ffd700'); }
        else { 
            // Generic Chest/Item
            ctx.fillStyle = '#ffd700'; drawCircle(ctx, x+16, y+16+float, 6, '#ffd700');
        }
    } else if (item.type === 'sign') {
        drawRect(ctx, x + 14, y + 10, 4, 22, COLORS.wood.dark); drawRect(ctx, x + 2, y + 4, 28, 16, COLORS.wood.base); drawRect(ctx, x + 4, y + 6, 24, 12, COLORS.wood.grain); ctx.fillStyle = COLORS.wood.dark; ctx.fillRect(x + 6, y + 10, 20, 1); ctx.fillRect(x + 6, y + 13, 16, 1);
    } else if (item.type === 'npc') {
        const ts = TILE_SIZE; const px = x + 8; const py = y + 2;
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(x + ts/2, y + ts - 2, 8, 3, 0, 0, Math.PI*2); ctx.fill();
        drawRect(ctx, px, py + 12, 16, 14, '#457b9d'); drawRect(ctx, px, py, 16, 14, '#f4a261'); drawRect(ctx, px, py, 16, 6, '#e5e5e5');
        drawRect(ctx, px - 2, py + 2, 4, 8, '#e5e5e5'); drawRect(ctx, px + 14, py + 2, 4, 8, '#e5e5e5');
        drawRect(ctx, px + 4, py + 8, 2, 2, '#000'); drawRect(ctx, px + 10, py + 8, 2, 2, '#000');
        drawRect(ctx, px + 2, py + 24, 5, 6, '#1d3557'); drawRect(ctx, px + 9, py + 24, 5, 6, '#1d3557');
        if (item.active) { const bounce = Math.sin(time / 200) * 2; ctx.fillStyle = '#ffff00'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText('!', x + 16, y - 5 + bounce); }
    } else if (item.type === 'push_block') {
        const ts = TILE_SIZE;
        ctx.fillStyle = '#8d99ae';
        ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
        ctx.fillStyle = '#edf2f4';
        ctx.fillRect(x + 4, y + 4, ts - 8, ts - 8);
        ctx.strokeStyle = '#2b2d42';
        ctx.strokeRect(x + 6, y + 6, ts - 12, ts - 12);
    } else if (item.type === 'door') {
        if (item.state === 'closed') {
            ctx.fillStyle = '#4a4e69';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#22223b';
            ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            // Keyhole
            ctx.fillStyle = '#000';
            ctx.fillRect(x + 14, y + 16, 4, 6);
        } else {
            // Open door
            ctx.fillStyle = '#000';
            ctx.fillRect(x + 4, y, TILE_SIZE - 8, TILE_SIZE);
        }
    } else if (item.type === 'switch') {
        const ts = TILE_SIZE;
        ctx.fillStyle = '#2b2d42';
        ctx.fillRect(x + 4, y + 4, ts - 8, ts - 8);
        ctx.fillStyle = item.state === 'pressed' ? '#ef233c' : '#d90429';
        const offset = item.state === 'pressed' ? 2 : 0;
        ctx.fillRect(x + 8 + offset, y + 8 + offset, ts - 16 - offset*2, ts - 16 - offset*2);
    }
};

export const drawWeather = (ctx: CanvasRenderingContext2D, width: number, height: number, weather: WeatherType, intensity: number, time: number) => {
    if (intensity <= 0) return;
    ctx.save(); ctx.globalAlpha = intensity;
    if (weather === 'rain' || weather === 'storm') { ctx.fillStyle = 'rgba(0, 0, 50, 0.3)'; ctx.fillRect(0, 0, width, height); }
    if (weather === 'storm') { if (Math.random() > 0.99) { ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.fillRect(0, 0, width, height); } }
    if (weather === 'cloudy') { ctx.fillStyle = 'rgba(200, 200, 200, 0.2)'; ctx.fillRect(0, 0, width, height); }
    ctx.restore();
}

export const drawDayNightCycle = (ctx: CanvasRenderingContext2D, width: number, height: number, timeOfDay: number) => {
    const hexToRgb = (hex: string) => { const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16); return { r, g, b }; }
    let targetColor = {r:0, g:0, b:0}; let targetAlpha = 0;
    if (timeOfDay >= 21 || timeOfDay < 4) { targetColor = hexToRgb('#000022'); targetAlpha = 0.7; } 
    else if (timeOfDay >= 4 && timeOfDay < 6) { const t = (timeOfDay - 4) / 2; const c1 = hexToRgb('#000022'); const a1 = 0.7; const c2 = hexToRgb('#ffcc00'); const a2 = 0.2; targetColor = { r: c1.r+(c2.r-c1.r)*t, g: c1.g+(c2.g-c1.g)*t, b: c1.b+(c2.b-c1.b)*t }; targetAlpha = a1 + (a2-a1)*t; } 
    else if (timeOfDay >= 6 && timeOfDay < 17) { targetAlpha = 0; } 
    else if (timeOfDay >= 17 && timeOfDay < 19) { const t = (timeOfDay - 17) / 2; const c2 = hexToRgb('#ff4500'); const a2 = 0.3; targetColor = c2; targetAlpha = t * a2; } 
    else if (timeOfDay >= 19 && timeOfDay < 21) { const t = (timeOfDay - 19) / 2; const c1 = hexToRgb('#ff4500'); const a1 = 0.3; const c2 = hexToRgb('#330033'); const a2 = 0.4; targetColor = { r: c1.r+(c2.r-c1.r)*t, g: c1.g+(c2.g-c1.g)*t, b: c1.b+(c2.b-c1.b)*t }; targetAlpha = a1 + (a2-a1)*t; }
    if (targetAlpha > 0) { ctx.fillStyle = `rgba(${Math.floor(targetColor.r||0)}, ${Math.floor(targetColor.g||0)}, ${Math.floor(targetColor.b||0)}, ${targetAlpha})`; ctx.fillRect(0, 0, width, height); }
};
