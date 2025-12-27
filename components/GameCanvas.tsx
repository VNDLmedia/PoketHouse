'use client';

import { useRef, useState, useEffect } from 'react';
import { useGameLoop } from '@/hooks/useGameLoop';
import { useInput } from '@/hooks/useInput';
import { Entity, GameState, WeatherType } from '@/lib/game/types';
import { MAPS, TILE_SIZE, ITEMS } from '@/lib/game/map';
import { checkCollision, checkInteraction, checkPortal } from '@/lib/game/physics';
import { DialogBox } from '@/components/DialogBox';
import { drawTile, drawPlayer, drawItem, drawDayNightCycle, drawWeather } from '@/lib/game/renderer';
import { createParticle, updateParticles, drawParticles } from '@/lib/game/particles';
import { generateWorld } from '@/lib/game/procgen';
import { INITIAL_QUESTS, STORY_FLAGS } from '@/lib/game/story';

const INTERNAL_WIDTH = 320;
const INTERNAL_HEIGHT = 240;
const SPEED = 0.12;
const DAY_DURATION = 120000; // 2 Minuten für einen Tag
const WEATHER_CHANGE_CHANCE = 0.001; // Chance pro Frame

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { keys, setKey } = useInput();
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [gameState, setGameState] = useState<GameState>({
    mode: 'intro',
    currentMapId: 'generated',
    loadedMaps: { ...MAPS },
    player: {
      id: 'player',
      position: { x: 0, y: 0 }, 
      color: '#ff0000',
      direction: 'down',
      isMoving: false,
    },
    flags: {},
    inventory: [],
    quests: INITIAL_QUESTS,
    dialog: {
        isOpen: false,
        text: [],
        currentLine: 0
    },
    menuOpen: false,
    timeOfDay: 8,
    day: 1,
    weather: 'clear',
    weatherTimer: 0,
    particles: []
  });

  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    }
  };

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
  const startTimeRef = useRef(Date.now());

  const update = (deltaTime: number) => {
    if (!isLoaded) return;
    const currentState = gameStateRef.current;
    
    // Time Cycle Logic
    const elapsed = Date.now() - startTimeRef.current;
    const totalHours = 8 + (elapsed / DAY_DURATION) * 24;
    const timeOfDay = totalHours % 24;
    const day = Math.floor(totalHours / 24) + 1;
    
    // Weather Logic
    let weather = currentState.weather;
    if (Math.random() < WEATHER_CHANGE_CHANCE) {
        const r = Math.random();
        if (r < 0.6) weather = 'clear';
        else if (r < 0.8) weather = 'cloudy';
        else if (r < 0.95) weather = 'rain';
        else weather = 'storm';
    }

    if (currentState.dialog.isOpen || currentState.menuOpen || currentState.mode === 'intro') {
        const particles = updateParticles(currentState.particles);
        // Auch während Pause Regen fallen lassen
        if (weather === 'rain' || weather === 'storm') {
             if (Math.random() > 0.5) {
                particles.push(createParticle(Math.random() * INTERNAL_WIDTH, 0, '', 'rain'));
            }
        }
        gameStateRef.current = { ...currentState, particles, timeOfDay, day, weather };
        return;
    }

    const player = { ...currentState.player };
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

    // Partikel Logic
    let newParticles = [...currentState.particles];
    
    // Staub beim Laufen
    if (moved && Math.random() > 0.8 && currentMap.theme === 'outdoor' && weather !== 'rain' && weather !== 'storm') {
        newParticles.push(createParticle(player.position.x + 16, player.position.y + 28, '#fff', 'dust'));
    }
    
    // Regen
    if ((weather === 'rain' || weather === 'storm') && currentMap.theme === 'outdoor') {
        // Regen im sichtbaren Bereich erzeugen (Kamera-basiert wäre besser, aber Screen-Space reicht für den Effekt hier)
        // Da Particles in World-Space sind, müssen wir die Kamera berücksichtigen, 
        // ABER wir rendern Partikel momentan global. Für einfachen Regen rendern wir ihn im Screen Space am besten.
        // HIER: Wir nutzen Particles im Screen Space Hack oder World Space.
        // World Space Rain ist schwerer. Wir machen es im Renderer als Overlay oder hier als "Screen Particles".
        // Lass uns Partikel im Renderer "immer oben" spawnen relativ zur Kamera.
        // Vereinfachung: Wir nutzen createParticle hier, müssen aber im Renderer aufpassen.
        // Besser: Regen direkt im Renderer zeichnen als Overlay.
        // Aber User wollte Partikel System. Also:
        
        // World Space Rain spawnen um den Spieler herum
        const cameraX = player.position.x - INTERNAL_WIDTH/2;
        const cameraY = player.position.y - INTERNAL_HEIGHT/2;
        
        for(let i=0; i<2; i++) {
             newParticles.push(createParticle(
                 cameraX + Math.random() * INTERNAL_WIDTH, 
                 cameraY + Math.random() * INTERNAL_HEIGHT - 100, // Etwas oberhalb
                 '', 
                 'rain'
             ));
        }
    }

    if (moved) {
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
    newParticles = updateParticles(newParticles);
    
    gameStateRef.current = { ...currentState, player, particles: newParticles, timeOfDay, day, weather };
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

    const { player, currentMapId, menuOpen, inventory, loadedMaps, particles, timeOfDay, mode, quests, day, weather } = gameStateRef.current;
    
    ctx.imageSmoothingEnabled = false;

    // --- INTRO SCREEN ---
    if (mode === 'intro') {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 30px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText("POCKET", width/2, height/2 - 40);
        ctx.fillStyle = '#fff';
        ctx.fillText("ADVENTURE", width/2, height/2);
        
        const blink = Math.floor(Date.now() / 500) % 2 === 0;
        if (blink) {
            ctx.fillStyle = '#888';
            ctx.font = '12px monospace';
            ctx.fillText("- PRESS SPACE TO START -", width/2, height/2 + 60);
        }
        return;
    }

    // --- GAME RENDER ---

    const currentMap = loadedMaps[currentMapId];
    if (!currentMap) return;
    
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

    drawParticles(ctx, particles);

    ctx.restore();

    // --- OVERLAYS ---

    if (currentMap.theme === 'outdoor') {
        drawDayNightCycle(ctx, width, height, timeOfDay);
        drawWeather(ctx, width, height, weather, now);
    }

    // UI
    if (menuOpen) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = '#fff';
        ctx.font = '10px "Courier New", monospace'; 
        ctx.textAlign = 'center';
        ctx.fillText("- MENU -", width/2, 20);
        ctx.fillText(`Day ${day} - ${Math.floor(timeOfDay)}:00`, width/2, 35);
        ctx.fillStyle = '#aaa';
        ctx.fillText(`Weather: ${weather}`, width/2, 45);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffcc00';
        ctx.fillText("QUESTS:", 20, 60);
        let qY = 75;
        Object.values(quests).forEach(q => {
            if (q.status === 'active') {
                ctx.fillStyle = '#fff';
                ctx.fillText(`! ${q.title}`, 20, qY);
                ctx.fillStyle = '#aaa';
                ctx.fillText(`  ${q.description}`, 20, qY + 12);
                qY += 30;
            }
        });

        ctx.fillStyle = '#ffcc00';
        ctx.fillText("BAG:", 160, 60);
        inventory.forEach((key, index) => {
            const item = ITEMS[key];
            ctx.fillStyle = '#eee';
            ctx.fillText(`> ${item?.name || key}`, 160, 75 + (index * 15));
        });
        
        ctx.fillStyle = '#ffff00';
        ctx.textAlign = 'center';
        ctx.fillText("[ESC] Back", width/2, height - 10);
    } else {
        // Mini HUD
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        const hours = Math.floor(timeOfDay);
        const mins = Math.floor((timeOfDay - hours) * 60);
        
        // Wetter Icon (Text basierend)
        let weatherIcon = '';
        if (weather === 'rain') weatherIcon = '🌧';
        if (weather === 'storm') weatherIcon = '⛈';
        if (weather === 'cloudy') weatherIcon = '☁';
        if (weather === 'clear') weatherIcon = '☀';

        ctx.fillText(`Day ${day} ${weatherIcon} ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`, width - 10, 15);
    }
  };

  useGameLoop(update, render, canvasRef);

  // Intro Key Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (gameState.mode === 'intro' && (e.code === 'Space' || e.code === 'Enter')) {
            setGameState(prev => ({ ...prev, mode: 'game' }));
            setTimeout(() => {
                setGameState(prev => ({
                    ...prev,
                    dialog: {
                        isOpen: true,
                        text: ["Willkommen in der Welt.", "Deine Reise beginnt jetzt."],
                        currentLine: 0
                    }
                }));
            }, 1000);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.mode]);

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
      
      <button 
        onClick={enterFullscreen}
        className="absolute top-4 right-4 text-white/50 hover:text-white z-50 text-xs border border-white/20 px-2 py-1 rounded"
      >
        [Fullscreen]
      </button>

      {gameState.mode === 'game' && (
      <>
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
      </>
      )}

      <DialogBox 
        isOpen={gameState.dialog.isOpen}
        text={gameState.dialog.text}
        onClose={() => setGameState(prev => ({ ...prev, dialog: { ...prev.dialog, isOpen: false } }))}
        onNext={() => {}} 
      />
    </div>
  );
}
