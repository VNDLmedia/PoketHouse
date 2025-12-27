import { TileType, TILE_SIZE } from './map';
import { Entity, Interactable, WeatherType, Particle } from './types';
import { drawParticles } from './particles';

// --- Clean Palette ---
const COLORS = {
    grass: { base: '#95d5b2', light: '#b7e4c7', dark: '#74c69d', blade: '#52b788' },
    water: { base: '#48cae4', light: '#90e0ef', dark: '#00b4d8', foam: '#caf0f8' },
    wall: { base: '#e9ecef', shadow: '#ced4da', outline: '#adb5bd' },
    wood: { base: '#ddb892', dark: '#b08968', grain: '#9c6644' },
    roof: { base: '#e63946', dark: '#d00000', outline: '#9d0208' },
    path: { base: '#e6ccb2', stones: '#d6ccc2' },
    player: { skin: '#ffcdb2', shirt: '#ffb4a2', pants: '#6d6875', hair: '#4a4e69' },
    tree: { trunk: '#6f4e37', leavesLight: '#588157', leavesDark: '#3a5a40', shadow: 'rgba(0,0,0,0.2)' },
    ui: { bg: '#212529', text: '#f8f9fa', border: '#495057' }
};

// --- Helper Functions ---
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

export const drawTile = (ctx: CanvasRenderingContext2D, tile: number, x: number, y: number, time: number) => {
    const ts = TILE_SIZE;
    
    switch (tile) {
        case 0: // Grass
            drawRect(ctx, x, y, ts, ts, COLORS.grass.base);
            const seed = (x * 7 + y * 13) % 5;
            if (seed < 2) {
                drawRect(ctx, x + 8, y + 8, 4, 4, COLORS.grass.dark);
                drawRect(ctx, x + 20, y + 20, 4, 4, COLORS.grass.light);
            }
            break;
            
        case 1: // Wall / Tree
            drawRect(ctx, x, y, ts, ts, COLORS.grass.base); 
            
            // Neuer Baum Renderer - Mehrschichtig und voluminöser
            const centerX = x + ts/2;
            const bottomY = y + ts;
            
            // Schatten
            ctx.fillStyle = COLORS.tree.shadow;
            ctx.beginPath();
            ctx.ellipse(centerX, bottomY - 2, 12, 4, 0, 0, Math.PI*2);
            ctx.fill();

            // Stamm
            drawRect(ctx, centerX - 3, bottomY - 12, 6, 10, COLORS.tree.trunk);

            // Blattwerk Layer (Pyramiden-artig aus Kreisen/Pixelhaufen)
            // Layer 1 (Unten, Dunkel)
            ctx.fillStyle = COLORS.tree.leavesDark;
            ctx.beginPath();
            ctx.arc(centerX - 8, bottomY - 14, 8, 0, Math.PI * 2);
            ctx.arc(centerX + 8, bottomY - 14, 8, 0, Math.PI * 2);
            ctx.arc(centerX, bottomY - 18, 10, 0, Math.PI * 2);
            ctx.fill();

            // Layer 2 (Oben, Hell)
            ctx.fillStyle = COLORS.tree.leavesLight;
            ctx.beginPath();
            ctx.arc(centerX - 5, bottomY - 20, 7, 0, Math.PI * 2);
            ctx.arc(centerX + 5, bottomY - 20, 7, 0, Math.PI * 2);
            ctx.arc(centerX, bottomY - 24, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // Highlight
            ctx.fillStyle = '#a3b18a';
            ctx.beginPath();
            ctx.arc(centerX - 3, bottomY - 26, 3, 0, Math.PI*2);
            ctx.fill();

            break;
            
        case 2: // Water
            drawRect(ctx, x, y, ts, ts, COLORS.water.base);
            const offset = Math.sin(time / 500 + x) * 2;
            drawRect(ctx, x + 5, y + 10 + offset, 10, 2, COLORS.water.light);
            drawRect(ctx, x + 18, y + 20 - offset, 8, 2, COLORS.water.dark);
            break;
            
        case 3: // Floor
            drawRect(ctx, x, y, ts, ts, COLORS.wood.base);
            ctx.fillStyle = COLORS.wood.grain;
            ctx.fillRect(x, y, ts, 1);
            ctx.fillRect(x, y + 16, ts, 1);
            if ((y / ts) % 2 === 0) ctx.fillRect(x, y, 1, 16);
            else ctx.fillRect(x + 16, y, 1, 16);
            break;

        case 4: // Path
            drawRect(ctx, x, y, ts, ts, COLORS.grass.base);
            drawCircle(ctx, x + ts/2, y + ts/2, ts/2 - 2, COLORS.path.base);
            break;
            
        case 5: // Door
             drawRect(ctx, x, y, ts, ts, COLORS.wall.shadow);
             drawRect(ctx, x + 4, y + 2, ts - 8, ts - 2, COLORS.wood.dark);
             drawCircle(ctx, x + ts - 8, y + ts/2, 2, '#ffd700');
             break;
             
        case 6: // Carpet
            drawRect(ctx, x, y, ts, ts, COLORS.roof.base);
            drawRect(ctx, x + 2, y + 2, ts - 4, ts - 4, COLORS.roof.dark);
            break;
            
        default: 
             drawRect(ctx, x, y, ts, ts, COLORS.wall.base);
             drawRect(ctx, x, y + ts - 4, ts, 4, COLORS.wall.shadow);
            break;
    }
};

export const drawPlayer = (ctx: CanvasRenderingContext2D, player: Entity, x: number, y: number, time: number) => {
    const ts = TILE_SIZE;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(x + ts/2, y + ts - 2, 8, 3, 0, 0, Math.PI*2);
    ctx.fill();
    
    const bounce = player.isMoving ? Math.abs(Math.sin(time / 150)) * 2 : 0;
    const py = y + 2 - bounce;
    const px = x + 8;
    
    drawRect(ctx, px, py + 12, 16, 14, COLORS.player.shirt);
    drawRect(ctx, px, py, 16, 14, COLORS.player.skin);
    drawRect(ctx, px, py, 16, 6, COLORS.player.hair);
    drawRect(ctx, px - 2, py + 2, 4, 8, COLORS.player.hair); 
    drawRect(ctx, px + 14, py + 2, 4, 8, COLORS.player.hair);
    
    ctx.fillStyle = '#000';
    let eyeOffX = 0;
    let eyeOffY = 0;
    
    switch (player.direction) {
        case 'left': eyeOffX = -3; break;
        case 'right': eyeOffX = 3; break;
        case 'up': eyeOffY = -1; break;
        case 'down': eyeOffY = 1; break;
    }
    
    if (player.direction !== 'up') {
        drawRect(ctx, px + 4 + eyeOffX, py + 8 + eyeOffY, 2, 2, '#000');
        drawRect(ctx, px + 10 + eyeOffX, py + 8 + eyeOffY, 2, 2, '#000');
    }
    
    const legOff = player.isMoving ? Math.sin(time / 100) * 3 : 0;
    drawRect(ctx, px + 2, py + 24, 5, 6 + legOff, COLORS.player.pants);
    drawRect(ctx, px + 9, py + 24, 5, 6 - legOff, COLORS.player.pants);
};

export const drawItem = (ctx: CanvasRenderingContext2D, item: Interactable, time: number) => {
    const x = item.position.x;
    const y = item.position.y;
    const ts = TILE_SIZE;
    const float = Math.sin(time / 300) * 3;
    
    if (item.type === 'sign') {
        drawRect(ctx, x + 14, y + 10, 4, 22, COLORS.wood.dark);
        drawRect(ctx, x + 2, y + 4, 28, 16, COLORS.wood.base);
        drawRect(ctx, x + 4, y + 6, 24, 12, COLORS.wood.grain);
        ctx.fillStyle = COLORS.wood.dark;
        ctx.fillRect(x + 6, y + 10, 20, 1);
        ctx.fillRect(x + 6, y + 13, 16, 1);
    } else if (item.type === 'item') {
        if (item.itemKey?.includes('potion')) {
             const by = y + 10 + float;
             drawRect(ctx, x + 12, by, 8, 10, '#ff99c8'); 
             drawRect(ctx, x + 14, by - 4, 4, 4, '#fff');
             drawRect(ctx, x + 13, by - 6, 6, 2, '#ad7a99');
             ctx.fillStyle = 'rgba(255, 153, 200, 0.3)';
             ctx.beginPath();
             ctx.arc(x + 16, by + 5, 10 + Math.sin(time/200)*2, 0, Math.PI*2);
             ctx.fill();
        } else if (item.itemKey?.includes('key')) {
             const by = y + 10 + float;
             drawRect(ctx, x + 10, by, 12, 8, '#ffd700'); 
             drawRect(ctx, x + 18, by + 8, 2, 6, '#ffd700');
             drawRect(ctx, x + 20, by + 12, 2, 2, '#ffd700');
        }
    } else if (item.type === 'npc') {
        const px = x + 8;
        const py = y + 2;
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(x + ts/2, y + ts - 2, 8, 3, 0, 0, Math.PI*2);
        ctx.fill();
        drawRect(ctx, px, py + 12, 16, 14, '#457b9d');
        drawRect(ctx, px, py, 16, 14, '#f4a261');
        drawRect(ctx, px, py, 16, 6, '#e5e5e5');
        drawRect(ctx, px - 2, py + 2, 4, 8, '#e5e5e5'); 
        drawRect(ctx, px + 14, py + 2, 4, 8, '#e5e5e5');
        drawRect(ctx, px + 4, py + 8, 2, 2, '#000');
        drawRect(ctx, px + 10, py + 8, 2, 2, '#000');
        drawRect(ctx, px + 2, py + 24, 5, 6, '#1d3557');
        drawRect(ctx, px + 9, py + 24, 5, 6, '#1d3557');
        
        if (item.active) {
            const bounce = Math.sin(time / 200) * 2;
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('!', x + 16, y - 5 + bounce);
        }
    }
};

export const drawWeather = (ctx: CanvasRenderingContext2D, width: number, height: number, weather: WeatherType, time: number) => {
    if (weather === 'rain' || weather === 'storm') {
        ctx.fillStyle = 'rgba(0, 0, 50, 0.2)'; // Blauton Overlay
        ctx.fillRect(0, 0, width, height);
    }
    if (weather === 'storm') {
        // Blitze
        if (Math.random() > 0.98) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(0, 0, width, height);
        }
        ctx.fillStyle = 'rgba(0, 0, 20, 0.3)'; // Dunkleres Overlay bei Sturm
        ctx.fillRect(0, 0, width, height);
    }
    if (weather === 'cloudy') {
        ctx.fillStyle = 'rgba(200, 200, 200, 0.1)';
        ctx.fillRect(0, 0, width, height);
    }
}

export const drawDayNightCycle = (ctx: CanvasRenderingContext2D, width: number, height: number, timeOfDay: number) => {
    let color = '';
    let alpha = 0;

    if (timeOfDay >= 21 || timeOfDay < 4) { // Tiefe Nacht
        color = '#000022';
        alpha = 0.7;
    } else if (timeOfDay >= 19 || timeOfDay < 21) { // Abend / Dämmerung
        color = '#330033'; // Lila/Dunkelblau
        alpha = 0.4;
    } else if (timeOfDay >= 17 && timeOfDay < 19) { // Sonnenuntergang
        color = '#ff4500';
        alpha = 0.3;
    } else if (timeOfDay >= 4 && timeOfDay < 6) { // Sonnenaufgang
        color = '#ffcc00';
        alpha = 0.2;
    } else {
        return; // Tag
    }

    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1.0;
};
