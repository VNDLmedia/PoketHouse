import { TileType, TILE_SIZE } from './map';
import { Entity, Interactable } from './types';

// --- Clean Palette ---
const COLORS = {
    grass: { base: '#95d5b2', light: '#b7e4c7', dark: '#74c69d', blade: '#52b788' },
    water: { base: '#48cae4', light: '#90e0ef', dark: '#00b4d8', foam: '#caf0f8' },
    wall: { base: '#e9ecef', shadow: '#ced4da', outline: '#adb5bd' },
    wood: { base: '#ddb892', dark: '#b08968', grain: '#9c6644' },
    roof: { base: '#e63946', dark: '#d00000', outline: '#9d0208' },
    path: { base: '#e6ccb2', stones: '#d6ccc2' },
    player: { skin: '#ffcdb2', shirt: '#ffb4a2', pants: '#6d6875', hair: '#4a4e69' },
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

// --- Tile Renderer ---

export const drawTile = (ctx: CanvasRenderingContext2D, tile: number, x: number, y: number, time: number) => {
    const ts = TILE_SIZE;
    
    switch (tile) {
        case 0: // Grass
            drawRect(ctx, x, y, ts, ts, COLORS.grass.base);
            // Prozedurale Grasbüschel (deterministisch basierend auf x,y)
            const seed = (x * 7 + y * 13) % 5;
            if (seed < 2) {
                drawRect(ctx, x + 8, y + 8, 4, 4, COLORS.grass.dark);
                drawRect(ctx, x + 20, y + 20, 4, 4, COLORS.grass.light);
            }
            break;
            
        case 1: // Wall / Tree (Outdoor)
            // Wir interpretieren 1 draußen als Baum
            drawRect(ctx, x, y, ts, ts, COLORS.grass.base); // Untergrund
            // Baumstamm
            drawRect(ctx, x + 12, y + 20, 8, 12, COLORS.wood.dark);
            // Krone (Rund)
            drawCircle(ctx, x + 16, y + 14, 14, COLORS.grass.dark);
            drawCircle(ctx, x + 16, y + 12, 10, COLORS.grass.blade);
            break;
            
        case 2: // Water
            drawRect(ctx, x, y, ts, ts, COLORS.water.base);
            // Wellen Animation
            const offset = Math.sin(time / 500 + x) * 2;
            drawRect(ctx, x + 5, y + 10 + offset, 10, 2, COLORS.water.light);
            drawRect(ctx, x + 18, y + 20 - offset, 8, 2, COLORS.water.dark);
            break;
            
        case 3: // Floor (Indoor)
            drawRect(ctx, x, y, ts, ts, COLORS.wood.base);
            // Dielen-Look
            ctx.fillStyle = COLORS.wood.grain;
            ctx.fillRect(x, y, ts, 1);
            ctx.fillRect(x, y + 16, ts, 1);
            // Versetzte Vertikale Fugen
            if ((y / ts) % 2 === 0) {
                 ctx.fillRect(x, y, 1, 16);
            } else {
                 ctx.fillRect(x + 16, y, 1, 16);
            }
            break;

        case 4: // Path
            drawRect(ctx, x, y, ts, ts, COLORS.grass.base); // Gras drunter
            // Weg Overlay (unregelmäßig)
            drawCircle(ctx, x + ts/2, y + ts/2, ts/2 - 2, COLORS.path.base);
            break;
            
        case 5: // Door
             drawRect(ctx, x, y, ts, ts, COLORS.wall.shadow); // Boden
             drawRect(ctx, x + 4, y + 2, ts - 8, ts - 2, COLORS.wood.dark); // Türblatt
             drawCircle(ctx, x + ts - 8, y + ts/2, 2, '#ffd700'); // Knauf
             break;
             
        case 6: // Carpet
            drawRect(ctx, x, y, ts, ts, COLORS.roof.base);
            drawRect(ctx, x + 2, y + 2, ts - 4, ts - 4, COLORS.roof.dark);
            break;
            
        default: // Fallback Wall Indoor
            if (tile === 1) { // Indoor Wall (wiederverwendete ID 1, kontextabhängig wäre besser, hier hack)
                // Da wir TileType 1 für beides nutzen, ist es schwer zu unterscheiden ohne Kontext. 
                // Der Renderer in GameCanvas weiß das Theme. Wir nehmen an Theme wird übergeben?
                // Vereinfachung: Wir zeichnen eine generische Mauer
                 drawRect(ctx, x, y, ts, ts, COLORS.wall.base);
                 drawRect(ctx, x, y + ts - 4, ts, 4, COLORS.wall.shadow);
            }
            break;
    }
};

// --- Player Renderer ---

export const drawPlayer = (ctx: CanvasRenderingContext2D, player: Entity, x: number, y: number, time: number) => {
    const ts = TILE_SIZE;
    
    // Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(x + ts/2, y + ts - 2, 8, 3, 0, 0, Math.PI*2);
    ctx.fill();
    
    // Bobbing Animation beim Laufen
    const bounce = player.isMoving ? Math.abs(Math.sin(time / 150)) * 2 : 0;
    const py = y + 2 - bounce;
    const px = x + 8; // Player ist 16px breit zentriert in 32px
    
    // Körper (Shirt)
    drawRect(ctx, px, py + 12, 16, 14, COLORS.player.shirt);
    
    // Kopf
    drawRect(ctx, px, py, 16, 14, COLORS.player.skin);
    
    // Haare
    drawRect(ctx, px, py, 16, 6, COLORS.player.hair); // Oben
    drawRect(ctx, px - 2, py + 2, 4, 8, COLORS.player.hair); // Links
    drawRect(ctx, px + 14, py + 2, 4, 8, COLORS.player.hair); // Rechts
    
    // Augen (Blickrichtung)
    ctx.fillStyle = '#000';
    let eyeOffX = 0;
    let eyeOffY = 0;
    
    switch (player.direction) {
        case 'left': eyeOffX = -3; break;
        case 'right': eyeOffX = 3; break;
        case 'up': eyeOffY = -1; break; // Rücken
        case 'down': eyeOffY = 1; break;
    }
    
    if (player.direction !== 'up') {
        drawRect(ctx, px + 4 + eyeOffX, py + 8 + eyeOffY, 2, 2, '#000');
        drawRect(ctx, px + 10 + eyeOffX, py + 8 + eyeOffY, 2, 2, '#000');
    }
    
    // Hose / Beine
    const legOff = player.isMoving ? Math.sin(time / 100) * 3 : 0;
    drawRect(ctx, px + 2, py + 24, 5, 6 + legOff, COLORS.player.pants);
    drawRect(ctx, px + 9, py + 24, 5, 6 - legOff, COLORS.player.pants);
};

// --- Interactable Renderer ---

export const drawItem = (ctx: CanvasRenderingContext2D, item: Interactable, time: number) => {
    const x = item.position.x;
    const y = item.position.y;
    const ts = TILE_SIZE;
    
    const float = Math.sin(time / 300) * 3;
    
    if (item.type === 'sign') {
        // Holzschild Pfosten
        drawRect(ctx, x + 14, y + 10, 4, 22, COLORS.wood.dark);
        // Schild
        drawRect(ctx, x + 2, y + 4, 28, 16, COLORS.wood.base);
        drawRect(ctx, x + 4, y + 6, 24, 12, COLORS.wood.grain);
        // Textlinien
        ctx.fillStyle = COLORS.wood.dark;
        ctx.fillRect(x + 6, y + 10, 20, 1);
        ctx.fillRect(x + 6, y + 13, 16, 1);
    } else if (item.type === 'item') {
        // Schwebender Orb / Potion / Key
        if (item.itemKey?.includes('potion')) {
             // Flasche
             const by = y + 10 + float;
             drawRect(ctx, x + 12, by, 8, 10, '#ff99c8'); // Pink Potion
             drawRect(ctx, x + 14, by - 4, 4, 4, '#fff'); // Hals
             drawRect(ctx, x + 13, by - 6, 6, 2, '#ad7a99'); // Korken
        } else if (item.itemKey?.includes('key')) {
             const by = y + 10 + float;
             drawRect(ctx, x + 10, by, 12, 8, '#ffd700'); 
             drawRect(ctx, x + 18, by + 8, 2, 6, '#ffd700');
             drawRect(ctx, x + 20, by + 12, 2, 2, '#ffd700');
        }
    } else if (item.type === 'npc') {
        // NPC (ähnlich Player, andere Farben)
        const px = x + 8;
        const py = y + 2;
        
        // Schatten
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(x + ts/2, y + ts - 2, 8, 3, 0, 0, Math.PI*2);
        ctx.fill();

        // Körper
        drawRect(ctx, px, py + 12, 16, 14, '#457b9d');
        // Kopf
        drawRect(ctx, px, py, 16, 14, '#f4a261');
        // Haare (Weiß/Grau)
        drawRect(ctx, px, py, 16, 6, '#e5e5e5');
        drawRect(ctx, px - 2, py + 2, 4, 8, '#e5e5e5'); 
        drawRect(ctx, px + 14, py + 2, 4, 8, '#e5e5e5');
        
        // Augen
        drawRect(ctx, px + 4, py + 8, 2, 2, '#000');
        drawRect(ctx, px + 10, py + 8, 2, 2, '#000');
        
         // Hose
        drawRect(ctx, px + 2, py + 24, 5, 6, '#1d3557');
        drawRect(ctx, px + 9, py + 24, 5, 6, '#1d3557');
    }
};

