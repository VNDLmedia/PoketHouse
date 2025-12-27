import { TileType, TILE_SIZE, MAPS } from './map';
import { Entity, Interactable, WeatherType, Particle, MapData } from './types';
import { drawParticles } from './particles';

// --- Palette ---
const COLORS = {
    grass: { base: '#95d5b2', light: '#b7e4c7', dark: '#74c69d', blade: '#52b788' },
    water: { base: '#48cae4', light: '#90e0ef', dark: '#00b4d8', foam: '#caf0f8', deep: '#0077b6' },
    wall: { base: '#e9ecef', shadow: '#ced4da', outline: '#adb5bd' },
    wood: { base: '#ddb892', dark: '#b08968', grain: '#9c6644' },
    roof: { base: '#d62828', dark: '#9d0208', light: '#e63946' }, 
    houseWall: { base: '#fefae0', shadow: '#faedcd' },
    path: { base: '#e6ccb2', stones: '#d6ccc2' },
    player: { skin: '#ffcdb2', shirt: '#e76f51', pants: '#264653', hair: '#2a9d8f' },
    tree: { trunk: '#6f4e37', leavesLight: '#588157', leavesDark: '#3a5a40', pineDark: '#2d6a4f', pineLight: '#40916c', shadow: 'rgba(0,0,0,0.2)' },
    flower: { stem: '#52b788', petals: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff'] },
    rock: { base: '#6c757d', light: '#adb5bd', dark: '#495057' },
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

export const drawTile = (ctx: CanvasRenderingContext2D, tile: number, x: number, y: number, time: number, map: MapData, tileX: number, tileY: number) => {
    const ts = TILE_SIZE;
    
    // Grundboden immer Gras außer bei Wasser, Hausboden, Teppich
    if (tile !== 2 && tile !== 3 && tile !== 6 && tile !== 9 && tile !== 10) {
        drawRect(ctx, x, y, ts, ts, COLORS.grass.base);
    }

    // --- Kontext-Check für Wasser (Autotiling) ---
    if (tile === 2) { // Water
        drawRect(ctx, x, y, ts, ts, COLORS.water.base);
        
        // Check neighbors
        const isWater = (dx: number, dy: number) => {
            const ny = tileY + dy;
            const nx = tileX + dx;
            if (ny < 0 || ny >= map.tiles.length || nx < 0 || nx >= map.tiles[0].length) return true; // Rand ist Wasser
            return map.tiles[ny][nx] === 2;
        };

        const n = isWater(0, -1);
        const s = isWater(0, 1);
        const w = isWater(-1, 0);
        const e = isWater(1, 0);

        // Kanten zeichnen (Foam/Shore)
        const borderSize = 4;
        ctx.fillStyle = COLORS.water.foam;
        
        // Wellen-Animation offset
        const wave = Math.sin(time / 400 + tileX) * 2;

        if (!n) ctx.fillRect(x, y, ts, borderSize + wave);
        if (!s) ctx.fillRect(x, y + ts - borderSize - wave, ts, borderSize + wave);
        if (!w) ctx.fillRect(x, y, borderSize + wave, ts);
        if (!e) ctx.fillRect(x + ts - borderSize - wave, y, borderSize + wave, ts);

        // Deep Water in der Mitte
        if (n && s && w && e) {
             ctx.fillStyle = COLORS.water.deep;
             ctx.fillRect(x + 4, y + 4, ts - 8, ts - 8);
        }
        
        return; // Early exit for water
    }

    switch (tile) {
        case 0: // Grass
            const seed = (tileX * 7 + tileY * 13);
            if (seed % 5 < 2) {
                const sway = Math.sin(time / 800 + tileX) * 2;
                drawRect(ctx, x + 8 + sway, y + 8, 4, 4, COLORS.grass.dark);
                drawRect(ctx, x + 20 + sway, y + 20, 4, 4, COLORS.grass.light);
            }
            break;
            
        case 1: // Tree (Variable & Chaotic)
            const tSeed = (tileX * 123 + tileY * 456);
            const isPine = tSeed % 3 === 0;
            // Varianz: Größe
            const sizeMod = (tSeed % 5) - 2; // -2 bis +2
            
            const centerX = x + ts/2;
            const bottomY = y + ts;
            const treeSway = Math.sin(time / 1200 + tileX/50) * 3;

            // Schatten
            ctx.fillStyle = COLORS.tree.shadow;
            ctx.beginPath(); ctx.ellipse(centerX, bottomY - 2, 12 + sizeMod, 4, 0, 0, Math.PI*2); ctx.fill();
            
            // Stamm (Variabel in Dicke/Höhe)
            drawRect(ctx, centerX - 3 + treeSway/4, bottomY - 12 - sizeMod, 6, 10 + sizeMod, COLORS.tree.trunk);

            if (isPine) {
                // Tanne
                const colDark = COLORS.tree.pineDark;
                const colLight = COLORS.tree.pineLight;
                
                // Varianz: Farbe (leicht)
                // Layer 1
                ctx.fillStyle = colDark;
                ctx.beginPath(); ctx.moveTo(centerX - (12+sizeMod) + treeSway, bottomY - 8); ctx.lineTo(centerX + (12+sizeMod) + treeSway, bottomY - 8); ctx.lineTo(centerX + treeSway/2, bottomY - 24 - sizeMod); ctx.fill();
                // Layer 2
                ctx.fillStyle = colLight;
                ctx.beginPath(); ctx.moveTo(centerX - (10+sizeMod) + treeSway, bottomY - 18); ctx.lineTo(centerX + (10+sizeMod) + treeSway, bottomY - 18); ctx.lineTo(centerX + treeSway/2, bottomY - 32 - sizeMod*2); ctx.fill();
                 // Layer 3
                ctx.fillStyle = COLORS.tree.leavesLight; 
                ctx.beginPath(); ctx.moveTo(centerX - (6+sizeMod) + treeSway, bottomY - 28); ctx.lineTo(centerX + (6+sizeMod) + treeSway, bottomY - 28); ctx.lineTo(centerX + treeSway/2, bottomY - 38 - sizeMod*3); ctx.fill();

            } else {
                // Eiche
                // Varianz: Zufällige "Blobs" für Laubkrone statt fester Kreise
                ctx.fillStyle = COLORS.tree.leavesDark;
                
                // Base Blob
                const rBase = 10 + sizeMod;
                const yBase = bottomY - 18 - sizeMod;
                drawCircle(ctx, centerX + treeSway, yBase, rBase, COLORS.tree.leavesDark);
                
                // Random Blobs
                const numBlobs = 3 + (tSeed % 3);
                for(let i=0; i<numBlobs; i++) {
                    const bx = centerX + ((tSeed * (i+1)) % 16) - 8 + treeSway;
                    const by = yBase - ((tSeed * (i+2)) % 10);
                    drawCircle(ctx, bx, by, 8, COLORS.tree.leavesDark);
                }

                // Highlights
                ctx.fillStyle = COLORS.tree.leavesLight;
                for(let i=0; i<numBlobs; i++) {
                    const bx = centerX + ((tSeed * (i+1)) % 16) - 8 + treeSway;
                    const by = yBase - ((tSeed * (i+2)) % 10) - 2;
                    drawCircle(ctx, bx, by, 6, COLORS.tree.leavesLight);
                }
            }
            break;
            
        // ... (Floor, Path, Door, Carpet, Roof, HouseWall unchanged, copy paste if needed or keep implicit via ...rest)
        case 3: 
            drawRect(ctx, x, y, ts, ts, COLORS.wood.base); ctx.fillStyle = COLORS.wood.grain;
            ctx.fillRect(x, y, ts, 1); ctx.fillRect(x, y + 16, ts, 1);
            if ((y / ts) % 2 === 0) ctx.fillRect(x, y, 1, 16); else ctx.fillRect(x + 16, y, 1, 16);
            break;
        case 4: 
            // Path Variation
            const pSeed = (tileX + tileY);
            drawCircle(ctx, x + ts/2, y + ts/2, ts/2 - 2 + (pSeed%3), COLORS.path.base);
            if (pSeed % 4 === 0) drawCircle(ctx, x+4, y+4, 2, COLORS.path.stones); // Kies
            break;
        case 5: drawRect(ctx, x, y, ts, ts, COLORS.wall.shadow); drawRect(ctx, x + 4, y + 2, ts - 8, ts - 2, COLORS.wood.dark); drawCircle(ctx, x + ts - 8, y + ts/2, 2, '#ffd700'); break;
        case 6: drawRect(ctx, x, y, ts, ts, COLORS.roof.base); drawRect(ctx, x + 2, y + 2, ts - 4, ts - 4, COLORS.roof.dark); break;
        case 8: drawCircle(ctx, x + 16, y + 20, 10, COLORS.rock.base); drawCircle(ctx, x + 14, y + 18, 6, COLORS.rock.light); drawCircle(ctx, x + 18, y + 22, 3, COLORS.rock.dark); break;
        case 9: drawRect(ctx, x, y, ts, ts, COLORS.houseWall.base); ctx.fillStyle = COLORS.wood.dark; ctx.fillRect(x, y, 4, ts); ctx.fillRect(x + ts - 4, y, 4, ts); if (y % 64 === 0) ctx.fillRect(x, y + ts - 4, ts, 4); break;
        case 10: drawRect(ctx, x, y, ts, ts, COLORS.roof.base); ctx.fillStyle = COLORS.roof.dark; ctx.fillRect(x, y + 14, ts, 2); ctx.fillRect(x, y + 28, ts, 2); ctx.fillRect(x + 14, y, 2, 14); ctx.fillRect(x + 2, y + 16, 2, 14); break;

        case 7: // Flower (High Variance)
            const fSeed = (tileX * 11 + tileY * 17);
            const stemX = x + 16 + (fSeed % 8) - 4; // Random Pos
            const stemY = y + 24;
            const fSway = Math.sin(time / 400 + tileX) * 2;
            
            ctx.strokeStyle = COLORS.flower.stem;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(stemX, stemY); ctx.quadraticCurveTo(stemX + fSway, stemY - 4, stemX + fSway, stemY - 10); ctx.stroke();
            
            const petalIdx = fSeed % COLORS.flower.petals.length;
            const petalColor = COLORS.flower.petals[petalIdx];
            
            // Random Flower Types
            if (fSeed % 2 === 0) {
                // Round
                drawCircle(ctx, stemX + fSway, stemY - 10, 4, petalColor);
                drawCircle(ctx, stemX - 3 + fSway, stemY - 12, 3, petalColor);
                drawCircle(ctx, stemX + 3 + fSway, stemY - 12, 3, petalColor);
                drawCircle(ctx, stemX + fSway, stemY - 10, 2, '#fff'); 
            } else {
                // Tulip-like
                ctx.fillStyle = petalColor;
                ctx.beginPath();
                ctx.moveTo(stemX + fSway, stemY - 6);
                ctx.lineTo(stemX - 4 + fSway, stemY - 14);
                ctx.lineTo(stemX + fSway, stemY - 10);
                ctx.lineTo(stemX + 4 + fSway, stemY - 14);
                ctx.fill();
            }
            break;

        case 11: // Bush (High Variance)
            const bSway = Math.sin(time / 600 + tileX) * 1;
            const bx = x + ts/2;
            const by = y + ts/2 + 4;
            
            const bSeed = tileX * tileY;
            const bSize = (bSeed % 4); 

            ctx.fillStyle = COLORS.bush.dark;
            drawCircle(ctx, bx - 6 + bSway - bSize, by + 4, 8 + bSize, COLORS.bush.dark);
            drawCircle(ctx, bx + 6 + bSway + bSize, by + 4, 8 + bSize, COLORS.bush.dark);
            drawCircle(ctx, bx + bSway, by - 2 - bSize, 10 + bSize, COLORS.bush.base);
            drawCircle(ctx, bx + bSway, by - 2 - bSize, 6 + bSize, COLORS.bush.light);

            if (tileX % 3 === 0) {
                drawCircle(ctx, bx - 4 + bSway, by, 2, COLORS.bush.berries);
                drawCircle(ctx, bx + 4 + bSway, by + 2, 2, COLORS.bush.berries);
                drawCircle(ctx, bx + bSway, by - 6, 2, COLORS.bush.berries);
            }
            break;

        case 12: // Tall Grass
            const gSway = Math.sin(time / 300 + tileX + tileY) * 3;
            ctx.fillStyle = COLORS.grass.blade;
            for(let i=0; i<3; i++) {
                const gx = x + 8 + (i * 8);
                const gy = y + 24 + ((tileX*i)%4); // Random Height offset
                ctx.beginPath();
                ctx.moveTo(gx, gy);
                ctx.lineTo(gx + 2 + gSway, gy - 12);
                ctx.lineTo(gx + 4, gy);
                ctx.fill();
            }
            break;

        default: 
             drawRect(ctx, x, y, ts, ts, COLORS.wall.base);
            break;
    }
};

// ... (drawPlayer, drawItem, drawWeather, drawDayNightCycle can be reused from previous file content if no change needed, 
// BUT we are overwriting the file, so we must include them)

export const drawPlayer = (ctx: CanvasRenderingContext2D, player: Entity, x: number, y: number, time: number) => {
    // Standard Player Renderer
    const ts = TILE_SIZE;
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(x + ts/2, y + ts - 2, 10, 4, 0, 0, Math.PI*2); ctx.fill();
    const bounce = player.isMoving ? Math.abs(Math.sin(time / 150)) * 2 : 0;
    const py = y + 2 - bounce; const px = x + 8;
    if (player.direction !== 'down') {
        ctx.fillStyle = '#8d99ae'; let bx = px + 4; if (player.direction === 'left') bx += 8; if (player.direction === 'right') bx -= 8;
        drawRect(ctx, bx, py + 14, 8, 10, '#8d99ae');
    }
    drawRect(ctx, px, py + 12, 16, 14, COLORS.player.shirt); drawRect(ctx, px, py, 16, 14, COLORS.player.skin);
    ctx.fillStyle = COLORS.player.hair; ctx.fillRect(px, py, 16, 6); ctx.fillRect(px - 2, py + 2, 4, 6); ctx.fillRect(px + 14, py + 2, 4, 6); ctx.fillRect(px + 6, py - 2, 4, 4); 
    ctx.fillStyle = '#264653'; let eyeOffX = 0; let eyeOffY = 0;
    switch (player.direction) { case 'left': eyeOffX = -3; break; case 'right': eyeOffX = 3; break; case 'up': eyeOffY = -1; break; case 'down': eyeOffY = 1; break; }
    if (player.direction !== 'up') { drawRect(ctx, px + 4 + eyeOffX, py + 8 + eyeOffY, 2, 2, '#264653'); drawRect(ctx, px + 10 + eyeOffX, py + 8 + eyeOffY, 2, 2, '#264653'); drawRect(ctx, px + 7 + eyeOffX, py + 12 + eyeOffY, 2, 1, '#d00000'); }
    const legOff = player.isMoving ? Math.sin(time / 100) * 4 : 0; drawRect(ctx, px + 2, py + 24, 5, 6 + legOff, COLORS.player.pants); drawRect(ctx, px + 9, py + 24, 5, 6 - legOff, COLORS.player.pants);
};

export const drawItem = (ctx: CanvasRenderingContext2D, item: Interactable, time: number) => {
    const x = item.position.x; const y = item.position.y; const float = Math.sin(time / 300) * 3;
    if (item.type === 'item') {
        if (item.itemKey === 'flower') {
            // Draw a nice flower item (icon)
            drawCircle(ctx, x+16, y+16+float, 6, '#ffc6ff');
            drawCircle(ctx, x+16, y+16+float, 3, '#fff');
        } else if (item.itemKey === 'berry') {
            const by = y + 10 + float; drawRect(ctx, x + 12, by, 8, 8, '#d00000'); drawRect(ctx, x + 16, by - 2, 2, 4, '#52b788');
        } else if (item.itemKey?.includes('potion')) {
             const by = y + 10 + float; drawRect(ctx, x + 12, by, 8, 10, '#ff99c8'); drawRect(ctx, x + 14, by - 4, 4, 4, '#fff'); drawRect(ctx, x + 13, by - 6, 6, 2, '#ad7a99'); ctx.fillStyle = 'rgba(255, 153, 200, 0.3)'; ctx.beginPath(); ctx.arc(x + 16, by + 5, 10 + Math.sin(time/200)*2, 0, Math.PI*2); ctx.fill();
        } else if (item.itemKey?.includes('key')) {
             const by = y + 10 + float; drawRect(ctx, x + 10, by, 12, 8, '#ffd700'); drawRect(ctx, x + 18, by + 8, 2, 6, '#ffd700'); drawRect(ctx, x + 20, by + 12, 2, 2, '#ffd700');
        }
    } else if (item.type === 'sign') {
        drawRect(ctx, x + 14, y + 10, 4, 22, COLORS.wood.dark); drawRect(ctx, x + 2, y + 4, 28, 16, COLORS.wood.base); drawRect(ctx, x + 4, y + 6, 24, 12, COLORS.wood.grain); ctx.fillStyle = COLORS.wood.dark; ctx.fillRect(x + 6, y + 10, 20, 1); ctx.fillRect(x + 6, y + 13, 16, 1);
    } else if (item.type === 'npc') {
        // Simple NPC
        const ts = TILE_SIZE; const px = x + 8; const py = y + 2;
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(x + ts/2, y + ts - 2, 8, 3, 0, 0, Math.PI*2); ctx.fill();
        drawRect(ctx, px, py + 12, 16, 14, '#457b9d'); drawRect(ctx, px, py, 16, 14, '#f4a261'); drawRect(ctx, px, py, 16, 6, '#e5e5e5');
        drawRect(ctx, px - 2, py + 2, 4, 8, '#e5e5e5'); drawRect(ctx, px + 14, py + 2, 4, 8, '#e5e5e5');
        drawRect(ctx, px + 4, py + 8, 2, 2, '#000'); drawRect(ctx, px + 10, py + 8, 2, 2, '#000');
        drawRect(ctx, px + 2, py + 24, 5, 6, '#1d3557'); drawRect(ctx, px + 9, py + 24, 5, 6, '#1d3557');
        if (item.active) { const bounce = Math.sin(time / 200) * 2; ctx.fillStyle = '#ffff00'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText('!', x + 16, y - 5 + bounce); }
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
