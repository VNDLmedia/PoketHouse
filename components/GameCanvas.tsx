'use client';

import { useRef, useState, useEffect } from 'react';
import { useGameLoop } from '@/hooks/useGameLoop';
import { useInput } from '@/hooks/useInput';
import { Entity, GameState } from '@/lib/game/types';
import { MAPS, TILE_SIZE, ITEMS } from '@/lib/game/map';
import { checkCollision, checkInteraction, checkPortal } from '@/lib/game/physics';
import { DialogBox } from '@/components/DialogBox';
import { drawTile, drawPlayer, drawItem } from '@/lib/game/renderer';
import { generateWorld } from '@/lib/game/procgen';

const INTERNAL_WIDTH = 320;
const INTERNAL_HEIGHT = 240;
const SPEED = 0.12;

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { keys, setKey } = useInput();
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [gameState, setGameState] = useState<GameState>({
    currentMapId: 'generated',
    loadedMaps: { ...MAPS }, // Statische Maps laden
    player: {
      id: 'player',
      position: { x: 0, y: 0 }, 
      color: '#ff0000',
      direction: 'down',
      isMoving: false,
    },
    flags: {},
    inventory: [],
    dialog: {
        isOpen: false,
        text: [],
        currentLine: 0
    },
    menuOpen: false
  });

  useEffect(() => {
    try {
        const world = generateWorld();
        
        setGameState(prev => ({
            ...prev,
            loadedMaps: {
                ...prev.loadedMaps,
                'generated': {
                    id: 'generated',
                    tiles: world.tiles,
                    interactables: world.interactables,
                    portals: [], 
                    theme: 'outdoor'
                }
            },
            player: {
                ...prev.player,
                position: { x: world.spawn.x * TILE_SIZE, y: world.spawn.y * TILE_SIZE }
            }
        }));
        setIsLoaded(true);
    } catch (e) {
        console.error("Failed to generate world:", e);
        setError("Fehler bei der Welt-Generierung. Bitte neu laden.");
    }
  }, []);

  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  const lastInteractionTime = useRef(0);

  const update = (deltaTime: number) => {
    if (!isLoaded) return;
    const currentState = gameStateRef.current;
    if (currentState.dialog.isOpen || currentState.menuOpen) return;

    const player = { ...currentState.player };
    // Map aus State laden
    const currentMap = currentState.loadedMaps[currentState.currentMapId];
    if (!currentMap) return;
    
    let moved = false;
    let nextX = player.position.x;
    let nextY = player.position.y;

    if (keys['ArrowUp'] || keys['KeyW']) {
      nextY -= SPEED * deltaTime;
      player.direction = 'up';
      moved = true;
    } else if (keys['ArrowDown'] || keys['KeyS']) {
      nextY += SPEED * deltaTime;
      player.direction = 'down';
      moved = true;
    } else if (keys['ArrowLeft'] || keys['KeyA']) {
      nextX -= SPEED * deltaTime;
      player.direction = 'left';
      moved = true;
    } else if (keys['ArrowRight'] || keys['KeyD']) {
      nextX += SPEED * deltaTime;
      player.direction = 'right';
      moved = true;
    }
    
    // Menu
    if (keys['Escape'] || keys['KeyM']) {
         const now = Date.now();
         if (now - lastInteractionTime.current > 300) {
             lastInteractionTime.current = now;
             setGameState(prev => ({ ...prev, menuOpen: !prev.menuOpen }));
             return;
         }
    }

    // Interact
    if (keys['Space'] || keys['Enter'] || keys['ButtonB']) {
        const now = Date.now();
        if (now - lastInteractionTime.current > 500) { 
            const target = checkInteraction(player, currentMap.interactables);
            if (target) {
                lastInteractionTime.current = now;
                if (target.type === 'item' && target.itemKey) {
                    const itemName = ITEMS[target.itemKey]?.name || target.itemKey;
                    setGameState(prev => {
                         if (prev.inventory.includes(target.itemKey!)) return prev;
                        return {
                            ...prev,
                            inventory: [...prev.inventory, target.itemKey!],
                            dialog: { isOpen: true, text: [`Du hast ${itemName} gefunden!`], currentLine: 0 }
                        };
                    });
                } else if (target.text) {
                    setGameState(prev => ({
                        ...prev,
                        dialog: { isOpen: true, text: target.text!, currentLine: 0 }
                    }));
                }
                return; 
            }
        }
    }

    if (moved) {
        // Kollisions-Check jetzt mit Map-Objekt
        if (!checkCollision({ x: nextX, y: player.position.y }, currentMap)) player.position.x = nextX;
        if (!checkCollision({ x: player.position.x, y: nextY }, currentMap)) player.position.y = nextY;
        
        const portal = checkPortal(player, currentMap.portals);
        if (portal) {
            setGameState(prev => ({
                ...prev,
                currentMapId: portal.targetMap,
                player: {
                    ...prev.player,
                    position: { x: portal.targetX, y: portal.targetY },
                    direction: portal.direction || prev.player.direction
                }
            }));
            return; 
        }
    }
    player.isMoving = moved;
    gameStateRef.current = { ...currentState, player };
  };

  const render = (ctx: CanvasRenderingContext2D) => {
    const { width, height } = ctx.canvas;

    if (error) {
        ctx.fillStyle = '#200';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#f00';
        ctx.textAlign = 'center';
        ctx.fillText(error, width/2, height/2);
        return;
    }

    if (!isLoaded) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = '12px monospace';
        ctx.fillText('Generating World...', width/2, height/2);
        return;
    }

    const { player, currentMapId, menuOpen, inventory, loadedMaps } = gameStateRef.current;
    const currentMap = loadedMaps[currentMapId];
    if (!currentMap) return;
    
    ctx.imageSmoothingEnabled = false;

    const mapWidth = currentMap.tiles[0].length * TILE_SIZE;
    const mapHeight = currentMap.tiles.length * TILE_SIZE;
    
    let cameraX = Math.round(player.position.x - width / 2 + TILE_SIZE / 2);
    let cameraY = Math.round(player.position.y - height / 2 + TILE_SIZE / 2);

    cameraX = Math.max(0, Math.min(cameraX, mapWidth - width));
    cameraY = Math.max(0, Math.min(cameraY, mapHeight - height));

    ctx.fillStyle = currentMap.theme === 'indoor' ? '#1a1a1a' : '#a2d2ff'; 
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    const now = Date.now();

    const startCol = Math.floor(cameraX / TILE_SIZE);
    const endCol = Math.floor((cameraX + width) / TILE_SIZE) + 1;
    const startRow = Math.floor(cameraY / TILE_SIZE);
    const endRow = Math.floor((cameraY + height) / TILE_SIZE) + 1;

    for (let y = startRow; y < endRow; y++) {
      for (let x = startCol; x < endCol; x++) {
        if (y < 0 || y >= currentMap.tiles.length || x < 0 || x >= currentMap.tiles[0].length) continue;
        const tile = currentMap.tiles[y][x];
        drawTile(ctx, tile, x * TILE_SIZE, y * TILE_SIZE, now);
      }
    }

    const renderList = [
        ...currentMap.interactables.filter(i => {
             return i.active && 
                    !(i.type === 'item' && i.itemKey && inventory.includes(i.itemKey)) &&
                    i.position.x + i.width > cameraX && i.position.x < cameraX + width &&
                    i.position.y + i.height > cameraY && i.position.y < cameraY + height;
        }).map(i => ({ type: 'interactable', obj: i, y: i.position.y })),
        { type: 'player', obj: player, y: player.position.y }
    ];
    
    renderList.sort((a, b) => a.y - b.y);
    
    for (const item of renderList) {
        if (item.type === 'player') {
            drawPlayer(ctx, item.obj as Entity, (item.obj as Entity).position.x, (item.obj as Entity).position.y, now);
        } else {
            drawItem(ctx, item.obj as any, now);
        }
    }

    ctx.restore();

    if (menuOpen) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = '#fff';
        ctx.font = '10px "Courier New", monospace'; 
        ctx.textAlign = 'center';
        ctx.fillText("- PAUSE -", width/2, 20);

        ctx.textAlign = 'left';
        if (inventory.length === 0) {
            ctx.fillStyle = '#888';
            ctx.fillText("Empty Pocket", 20, 50);
        } else {
            inventory.forEach((key, index) => {
                const item = ITEMS[key];
                ctx.fillStyle = '#eee';
                ctx.fillText(`> ${item?.name || key}`, 20, 50 + (index * 15));
            });
        }
        
        ctx.fillStyle = '#ffff00';
        ctx.textAlign = 'center';
        ctx.fillText("[ESC] Back", width/2, height - 10);
    }
  };

  useGameLoop(update, render, canvasRef);

  return (
    <div className="w-screen h-screen bg-black flex justify-center items-center relative overflow-hidden">
      <canvas
        ref={canvasRef}
        width={INTERNAL_WIDTH}
        height={INTERNAL_HEIGHT}
        className="w-full h-full object-contain"
        style={{ 
            imageRendering: 'pixelated'
        }}
      />
      
      <div className="absolute bottom-8 left-8 flex flex-col gap-2 opacity-50 hover:opacity-100 transition-opacity md:hidden">
         <div className="flex justify-center">
            <button 
                className="w-12 h-12 bg-white/20 rounded-t active:bg-white/40 backdrop-blur-md border border-white/30"
                onTouchStart={() => setKey('ArrowUp', true)}
                onTouchEnd={() => setKey('ArrowUp', false)}
            >▲</button>
         </div>
         <div className="flex gap-2">
            <button 
                className="w-12 h-12 bg-white/20 rounded-l active:bg-white/40 backdrop-blur-md border border-white/30"
                onTouchStart={() => setKey('ArrowLeft', true)}
                onTouchEnd={() => setKey('ArrowLeft', false)}
            >◀</button>
            <button 
                className="w-12 h-12 bg-white/20 rounded active:bg-white/40 backdrop-blur-md border border-white/30"
                onTouchStart={() => setKey('ArrowDown', true)}
                onTouchEnd={() => setKey('ArrowDown', false)}
            >▼</button>
            <button 
                className="w-12 h-12 bg-white/20 rounded-r active:bg-white/40 backdrop-blur-md border border-white/30"
                onTouchStart={() => setKey('ArrowRight', true)}
                onTouchEnd={() => setKey('ArrowRight', false)}
            >▶</button>
         </div>
      </div>

      <div className="absolute bottom-8 right-8 flex gap-4 opacity-50 hover:opacity-100 transition-opacity md:hidden">
          <button 
                className="w-16 h-16 bg-red-500/30 rounded-full active:bg-red-500/50 backdrop-blur-md border border-white/30 flex items-center justify-center text-white font-bold"
                onTouchStart={() => setKey('Space', true)}
                onTouchEnd={() => setKey('Space', false)}
          >A</button>
          <button 
                className="w-12 h-12 mt-4 bg-blue-500/30 rounded-full active:bg-blue-500/50 backdrop-blur-md border border-white/30 flex items-center justify-center text-white text-xs"
                onTouchStart={() => setKey('Escape', true)}
                onTouchEnd={() => setKey('Escape', false)}
          >M</button>
      </div>

      <DialogBox 
        isOpen={gameState.dialog.isOpen}
        text={gameState.dialog.text}
        onClose={() => setGameState(prev => ({ ...prev, dialog: { ...prev.dialog, isOpen: false } }))}
        onNext={() => {}} 
      />
    </div>
  );
}
