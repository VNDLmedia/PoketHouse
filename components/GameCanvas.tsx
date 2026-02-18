'use client';

import { useRef, useState, useEffect } from 'react';
import { useGameLoop } from '@/hooks/useGameLoop';
import { useInput } from '@/hooks/useInput';
import { Entity, GameState, WeatherType, Enemy } from '@/lib/game/types';
import { MAPS, TILE_SIZE, ITEMS, WALKABLE_TILES } from '@/lib/game/map';
import { COIN_COUNT } from '@/lib/game/story';
import { checkCollision, checkInteraction, checkPortal, checkAttack, resolvePush } from '@/lib/game/physics';
import { DialogBox } from '@/components/DialogBox';
import { drawTile, drawPlayer, drawItem, drawDayNightCycle, drawWeather, drawEnemy } from '@/lib/game/renderer';
import { createParticle, updateParticles, drawParticles } from '@/lib/game/particles';
import { INITIAL_QUESTS } from '@/lib/game/story';
import { updateEnemies } from '@/lib/game/ai';
import { audio } from '@/lib/game/audio';
import { saveGame, loadGame, hasSaveGame } from '@/lib/game/save';

const INTERNAL_WIDTH = 320;
const INTERNAL_HEIGHT = 240;
const SPEED = 0.12;
const DAY_DURATION = 120000; 
const WEATHER_CHANGE_CHANCE = 0.0005;

const MINIMAP_COLORS: Record<number, string> = {
  0: '#95d5b2', 1: '#3a5a40', 2: '#48cae4', 3: '#faedcd', 4: '#ff6b6b',
  5: '#74c69d', 6: '#52b788', 7: '#e6ccb2', 8: '#ddb892', 9: '#adb5bd',
  10: '#6c757d', 11: '#e9ecef', 12: '#ddb892', 13: '#d62828', 14: '#9d0208',
  15: '#555', 16: '#b0b0b0', 17: '#d0ccc4', 18: '#707070', 19: '#c4b8a8',
  20: '#2d6a4f', 21: '#4caf50', 22: '#808080', 23: '#2d5a30',
};

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { keys, setKey } = useInput();
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false); 
  const mapOpenRef = useRef(false);
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapDirty = useRef(true);

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
      stats: { hp: 6, maxHp: 6, attack: 1, defense: 0, speed: 1 },
      invincibleTimer: 0,
      isAttacking: false,
      attackTimer: 0
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
    targetWeather: 'clear',
    weatherIntensity: 0,
    weatherTimer: 0,
    particles: [],
    notifications: []
  });

  // Audio Init on first interaction
  useEffect(() => {
    const initAudio = () => {
        audio.init();
        window.removeEventListener('click', initAudio);
        window.removeEventListener('keydown', initAudio);
    };
    window.addEventListener('click', initAudio);
    window.addEventListener('keydown', initAudio);
    return () => {
        window.removeEventListener('click', initAudio);
        window.removeEventListener('keydown', initAudio);
    };
  }, []);

  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    }
  };

  const loadSave = () => {
      const saved = loadGame();
      if (saved) {
          setGameState(saved);
          setIsLoaded(true);
      }
  };

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) setShowControls(true);

    if (gameState.mode === 'intro' && !isLoaded) {
        fetch('/maps/1.1.json')
            .then(res => res.json())
            .then((mapData) => {
                const spawnX = 185;
                const spawnY = 50;

                // Spawn coins on walkable tiles within 30 tiles of spawn
                const COIN_RADIUS = 30;
                const walkable: {x: number, y: number}[] = [];
                const minY = Math.max(0, spawnY - COIN_RADIUS);
                const maxY = Math.min(mapData.tiles.length - 1, spawnY + COIN_RADIUS);
                const minX = Math.max(0, spawnX - COIN_RADIUS);
                const maxX = Math.min(mapData.tiles[0].length - 1, spawnX + COIN_RADIUS);
                for (let ty = minY; ty <= maxY; ty++) {
                    for (let tx = minX; tx <= maxX; tx++) {
                        const dist = Math.sqrt((tx - spawnX) ** 2 + (ty - spawnY) ** 2);
                        if (dist <= COIN_RADIUS && dist > 3 && WALKABLE_TILES.has(mapData.tiles[ty][tx])) {
                            walkable.push({ x: tx, y: ty });
                        }
                    }
                }
                for (let i = walkable.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [walkable[i], walkable[j]] = [walkable[j], walkable[i]];
                }
                const coins = walkable.slice(0, COIN_COUNT).map((pos, i) => ({
                    id: `coin_${i}`,
                    position: { x: pos.x * TILE_SIZE, y: pos.y * TILE_SIZE },
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                    type: 'item' as const,
                    itemKey: `coin_${i}`,
                    active: true,
                    trigger: 'touch' as const,
                }));
                const hackathonNpc = {
                    id: 'npc_hackathon',
                    position: { x: 187 * TILE_SIZE, y: 50 * TILE_SIZE },
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                    type: 'npc' as const,
                    text: [
                        'Hey! Willkommen beim Siemens Hackathon!',
                        'Schön, dass du da bist.',
                        'Erkunde das Gelände und sammle alle Münzen!',
                        'Viel Erfolg und vor allem: Viel Spaß!',
                    ],
                    active: true,
                    trigger: 'press' as const,
                };
                mapData.interactables = [...(mapData.interactables || []), ...coins, hackathonNpc];

                setGameState(prev => ({
                    ...prev,
                    loadedMaps: {
                        ...prev.loadedMaps,
                        'generated': mapData,
                    },
                    player: {
                        ...prev.player,
                        position: { x: spawnX * TILE_SIZE, y: spawnY * TILE_SIZE }
                    }
                }));
                minimapDirty.current = true;
                setIsLoaded(true);
            })
            .catch(e => {
                console.error("Failed to load map:", e);
                setError("Fehler beim Laden der Karte. Bitte neu laden.");
            });
    }
  }, []);

  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  const lastInteractionTime = useRef(0);
  const startTimeRef = useRef(Date.now());

  const update = (deltaTime: number) => {
    if (!isLoaded) return;
    const currentState = gameStateRef.current;
    
    // Time Cycle
    const elapsed = Date.now() - startTimeRef.current;
    const totalHours = 8 + (elapsed / DAY_DURATION) * 24;
    const timeOfDay = totalHours % 24;
    const day = Math.floor(totalHours / 24) + 1;
    
    // Weather
    let { weather, targetWeather, weatherIntensity } = currentState;
    if (Math.random() < WEATHER_CHANGE_CHANCE) {
        const r = Math.random();
        let newTarget: WeatherType = 'clear';
        if (r < 0.6) newTarget = 'clear';
        else if (r < 0.8) newTarget = 'cloudy';
        else if (r < 0.95) newTarget = 'rain';
        else newTarget = 'storm';
        if (newTarget !== targetWeather) targetWeather = newTarget;
    }
    if (weather !== targetWeather) {
        weatherIntensity -= 0.01;
        if (weatherIntensity <= 0) { weather = targetWeather; weatherIntensity = 0; }
    } else {
        if (weather !== 'clear') { if (weatherIntensity < 1) weatherIntensity += 0.01; } 
        else weatherIntensity = 0;
    }

    // Map overlay toggle (must be before early-return so it works while paused)
    if (keys['KeyM']) {
         const now = Date.now();
         if (now - lastInteractionTime.current > 300) {
             lastInteractionTime.current = now;
             mapOpenRef.current = !mapOpenRef.current;
         }
    }
    // Menu / close overlays (must be before early-return)
    if (keys['Escape']) {
         const now = Date.now();
         if (now - lastInteractionTime.current > 300) {
             lastInteractionTime.current = now;
             if (mapOpenRef.current) { mapOpenRef.current = false; }
             else { setGameState(prev => ({ ...prev, menuOpen: !prev.menuOpen })); }
         }
    }

    if (currentState.dialog.isOpen || currentState.menuOpen || mapOpenRef.current || currentState.mode === 'intro') {
        const particles = updateParticles(currentState.particles);
        if (weather === 'rain' || weather === 'storm') {
             if (Math.random() > 0.5) particles.push(createParticle(Math.random() * INTERNAL_WIDTH, 0, '', 'rain'));
        }
        gameStateRef.current = { ...currentState, particles, timeOfDay, day, weather, targetWeather, weatherIntensity };
        return;
    }
    
    // Check Death
    if (currentState.player.stats && currentState.player.stats.hp <= 0) {
        setGameState(prev => ({ ...prev, mode: 'intro', dialog: { isOpen: true, text: ["Du bist besiegt..."], currentLine: 0 } }));
        // Reset player or reload save? For now just soft reset to intro
        return;
    }

    const player = { ...currentState.player };
    const currentMap = currentState.loadedMaps[currentState.currentMapId];
    if (!currentMap) return;
    
    let moved = false;
    let nextX = player.position.x;
    let nextY = player.position.y;

    // Movement
    if (!player.isAttacking) {
        if (keys['ArrowUp'] || keys['KeyW']) { nextY -= SPEED * deltaTime; player.direction = 'up'; moved = true; } 
        else if (keys['ArrowDown'] || keys['KeyS']) { nextY += SPEED * deltaTime; player.direction = 'down'; moved = true; } 
        else if (keys['ArrowLeft'] || keys['KeyA']) { nextX -= SPEED * deltaTime; player.direction = 'left'; moved = true; } 
        else if (keys['ArrowRight'] || keys['KeyD']) { nextX += SPEED * deltaTime; player.direction = 'right'; moved = true; }
    }

    // Cooldowns
    if (player.invincibleTimer && player.invincibleTimer > 0) player.invincibleTimer -= deltaTime;
    if (player.attackTimer && player.attackTimer > 0) {
        player.attackTimer -= deltaTime;
        if (player.attackTimer <= 0) player.isAttacking = false;
    }
    

    // Action (Interact / Attack)
    if (keys['Space'] || keys['Enter'] || keys['ButtonB']) {
        const now = Date.now();
        if (now - lastInteractionTime.current > 300) { 
            // Try Interact First
            const target = checkInteraction(player, currentMap.interactables);
            if (target) {
                lastInteractionTime.current = now;
                if (target.type === 'item' && target.itemKey) {
                    const itemName = ITEMS[target.itemKey]?.name || target.itemKey;
                    audio.playCollect();
                    setGameState(prev => {
                         if (prev.inventory.includes(target.itemKey!)) return prev;
                        return {
                            ...prev,
                            inventory: [...prev.inventory, target.itemKey!],
                            dialog: { isOpen: true, text: [`Du hast ${itemName} gefunden!`], currentLine: 0 }
                        };
                    });
                } else if (target.text) {
                    setGameState(prev => ({ ...prev, dialog: { isOpen: true, text: target.text!, currentLine: 0 } }));
                } else if (target.type === 'push_block') {
                    // Push logic handled in movement collision?
                    // Actually we want to push it HERE if we press space OR just by walking into it?
                    // Zelda usually pushes by walking into it.
                }
                return; 
            } else {
                // Attack
                if (!player.isAttacking) {
                    player.isAttacking = true;
                    player.attackTimer = 300; // ms
                    audio.playAttack();
                    lastInteractionTime.current = now;
                    
                    // Check hits
                    const hits = checkAttack(player, currentMap.enemies || []);
                    if (hits.length > 0) {
                        hits.forEach(enemy => {
                            audio.playHit();
                            // Damage Enemy (Modify enemies in place via ref/copy - simplified here)
                            // We need to update enemy state in map
                            // Ideally we dispatch an event or mark enemy as hit
                            // For this prototype we will modify the map data directly (dirty but fast)
                            // But we have updateEnemies below which returns new list. 
                            // We should handle damage there or here. 
                            // Let's add a `hurt` flag to enemy or just remove HP if we had it.
                            // Assuming enemies die in 1 hit for now or add HP to Enemy type.
                            enemy.state = 'retreat'; // visual feedback
                            // Remove enemy?
                             setGameState(prev => {
                                 const map = prev.loadedMaps[prev.currentMapId];
                                 const newEnemies = map.enemies.filter(e => e.id !== enemy.id); // One hit kill for now
                                 return {
                                     ...prev,
                                     loadedMaps: {
                                         ...prev.loadedMaps,
                                         [prev.currentMapId]: { ...map, enemies: newEnemies }
                                     }
                                 };
                             });
                        });
                    }
                }
            }
        }
    }

    // Movement & Collision
    if (moved) {
        // Player Collision
        if (!checkCollision({ x: nextX, y: player.position.y }, currentMap)) {
            player.position.x = nextX;
        } 
        if (!checkCollision({ x: player.position.x, y: nextY }, currentMap)) {
            player.position.y = nextY;
        }

        // Push Block Logic (Walking into)
        // If we collided, check if it was a push block
        // Simplified: checkCollision returns true if solid. 
        // We need to check specifically for push block overlap in direction
        const pushTarget = currentMap.interactables.find(i => i.type === 'push_block' && 
            Math.abs(i.position.x - nextX) < TILE_SIZE && Math.abs(i.position.y - nextY) < TILE_SIZE);
        
        if (pushTarget) {
            if (resolvePush(player, pushTarget, currentMap)) {
                // Move block
                if (player.direction === 'up') pushTarget.position.y -= SPEED * deltaTime;
                if (player.direction === 'down') pushTarget.position.y += SPEED * deltaTime;
                if (player.direction === 'left') pushTarget.position.x -= SPEED * deltaTime;
                if (player.direction === 'right') pushTarget.position.x += SPEED * deltaTime;
                audio.playStep(); // Grinding sound placeholder
            }
        }
        
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
    // Auto-pickup touch-triggered items (coins)
    const pcx = player.position.x + TILE_SIZE / 2;
    const pcy = player.position.y + TILE_SIZE / 2;
    for (const item of currentMap.interactables) {
        if (item.trigger !== 'touch' || !item.active || item.type !== 'item' || !item.itemKey) continue;
        if (currentState.inventory.includes(item.itemKey)) continue;
        const ix = item.position.x + item.width / 2;
        const iy = item.position.y + item.height / 2;
        if (Math.abs(pcx - ix) < TILE_SIZE * 0.7 && Math.abs(pcy - iy) < TILE_SIZE * 0.7) {
            audio.playCollect();
            setGameState(prev => {
                if (prev.inventory.includes(item.itemKey!)) return prev;
                const newInv = [...prev.inventory, item.itemKey!];
                const coinCount = newInv.filter(k => k.startsWith('coin_')).length;
                const newQuests = { ...prev.quests };
                if (newQuests['coin_quest'] && newQuests['coin_quest'].status === 'active') {
                    const step = { ...newQuests['coin_quest'].steps[0] };
                    step.count = coinCount;
                    if (coinCount >= (step.targetCount || COIN_COUNT)) {
                        step.completed = true;
                        newQuests['coin_quest'] = { ...newQuests['coin_quest'], steps: [step], status: 'completed' };
                    } else {
                        newQuests['coin_quest'] = { ...newQuests['coin_quest'], steps: [step] };
                    }
                }
                const isComplete = coinCount >= COIN_COUNT;
                return {
                    ...prev,
                    inventory: newInv,
                    quests: newQuests,
                    dialog: {
                        isOpen: true,
                        text: isComplete
                            ? [`Münze ${coinCount}/${COIN_COUNT} gesammelt!`, 'Alle Münzen gefunden! Quest abgeschlossen!']
                            : [`Münze ${coinCount}/${COIN_COUNT} gesammelt!`],
                        currentLine: 0,
                    },
                };
            });
            break;
        }
    }

    player.isMoving = moved;
    if (moved && Math.floor(Date.now() / 300) % 2 === 0) {
        // Footsteps?
    }

    // AI Update
    if (currentMap.enemies) {
        const newEnemies = updateEnemies(currentMap.enemies, player, currentMap, deltaTime);
        currentMap.enemies = newEnemies; // Mutating ref for perf, or setGameState logic
        
        // Check Player Hit
        if (!player.invincibleTimer || player.invincibleTimer <= 0) {
            for (const enemy of newEnemies) {
                if (Math.abs(enemy.position.x - player.position.x) < 16 && Math.abs(enemy.position.y - player.position.y) < 16) {
                    player.stats!.hp -= 1;
                    player.invincibleTimer = 1000;
                    audio.playDamage();
                    // Knockback
                    const dx = player.position.x - enemy.position.x;
                    const dy = player.position.y - enemy.position.y;
                    player.position.x += dx * 2;
                    player.position.y += dy * 2;
                }
            }
        }
    }

    // Particles
    let newParticles = [...currentState.particles];
    if (moved && Math.random() > 0.8 && currentMap.theme === 'outdoor' && weather !== 'rain' && weather !== 'storm') {
        newParticles.push(createParticle(player.position.x + 16, player.position.y + 28, '#fff', 'dust'));
    }
    if ((weather === 'rain' || weather === 'storm') && currentMap.theme === 'outdoor') {
        if (Math.random() < 0.5 * weatherIntensity) {
             const cx = player.position.x - INTERNAL_WIDTH/2;
             const cy = player.position.y - INTERNAL_HEIGHT/2;
             newParticles.push(createParticle(cx + Math.random() * INTERNAL_WIDTH, cy + Math.random() * INTERNAL_HEIGHT - 100, '', 'rain'));
        }
    }
    newParticles = updateParticles(newParticles);
    
    gameStateRef.current = { ...currentState, player, particles: newParticles, timeOfDay, day, weather, targetWeather, weatherIntensity };
  };

  const render = (ctx: CanvasRenderingContext2D) => {
     const { width, height } = ctx.canvas;

    if (error) {
        ctx.fillStyle = '#200'; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#f00'; ctx.textAlign = 'center'; ctx.fillText(error, width/2, height/2);
        return;
    }

    if (!isLoaded) {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('Generating World...', width/2, height/2);
        return;
    }

    const { player, currentMapId, menuOpen, inventory, loadedMaps, particles, timeOfDay, mode, quests, day, weather, weatherIntensity } = gameStateRef.current;
    
    ctx.imageSmoothingEnabled = false;

    if (mode === 'intro') {
         ctx.fillStyle = '#111'; ctx.fillRect(0, 0, width, height);
         ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 30px "Courier New", monospace'; ctx.textAlign = 'center';
         ctx.fillText("POCKET", width/2, height/2 - 40);
         ctx.fillStyle = '#fff'; ctx.fillText("ADVENTURE", width/2, height/2);
         
         const blink = Math.floor(Date.now() / 500) % 2 === 0;
         if (blink) {
            ctx.fillStyle = '#888'; ctx.font = '12px monospace';
            ctx.fillText("- PRESS SPACE TO START -", width/2, height/2 + 60);
         }
         
         if (hasSaveGame()) {
             ctx.fillStyle = '#4cc9f0';
             ctx.fillText("[L] Load Game", width/2, height/2 + 80);
         }
         return;
    }

    const currentMap = loadedMaps[currentMapId];
    if (!currentMap) return;
    
    const mapWidth = currentMap.tiles[0].length * TILE_SIZE;
    const mapHeight = currentMap.tiles.length * TILE_SIZE;
    
    let cameraX = Math.round(player.position.x - width / 2 + TILE_SIZE / 2);
    let cameraY = Math.round(player.position.y - height / 2 + TILE_SIZE / 2);
    cameraX = Math.max(0, Math.min(cameraX, mapWidth - width));
    cameraY = Math.max(0, Math.min(cameraY, mapHeight - height));

    ctx.fillStyle = currentMap.theme === 'indoor' || currentMap.theme === 'dungeon' ? '#1a1a1a' : '#a2d2ff'; 
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
        drawTile(ctx, tile, x * TILE_SIZE, y * TILE_SIZE, now, currentMap, x, y);
      }
    }

    const renderList = [
        ...currentMap.interactables.filter(i => {
             return i.active && 
                    !(i.type === 'item' && i.itemKey && inventory.includes(i.itemKey)) &&
                    i.position.x + i.width > cameraX && i.position.x < cameraX + width &&
                    i.position.y + i.height > cameraY && i.position.y < cameraY + height;
        }).map(i => ({ type: 'interactable', obj: i, y: i.position.y })),
        ... (currentMap.enemies || []).map(e => ({ type: 'enemy', obj: e, y: e.position.y })),
        { type: 'player', obj: player, y: player.position.y }
    ];
    
    renderList.sort((a, b) => a.y - b.y);
    
    for (const item of renderList) {
        if (item.type === 'player') {
            drawPlayer(ctx, item.obj as Entity, (item.obj as Entity).position.x, (item.obj as Entity).position.y, now);
            // Attack Animation
            if ((item.obj as Entity).isAttacking) {
                const p = item.obj as Entity;
                ctx.fillStyle = '#fff';
                let ax = p.position.x + 8;
                let ay = p.position.y + 8;
                if (p.direction === 'up') ay -= 24;
                if (p.direction === 'down') ay += 24;
                if (p.direction === 'left') ax -= 24;
                if (p.direction === 'right') ax += 24;
                
                ctx.beginPath();
                ctx.arc(ax, ay, 12, 0, Math.PI*2);
                ctx.fill();
            }
        } else if (item.type === 'enemy') {
            drawEnemy(ctx, item.obj as Enemy, (item.obj as Enemy).position.x, (item.obj as Enemy).position.y, now);
        } else {
            drawItem(ctx, item.obj as any, now);
        }
    }

    drawParticles(ctx, particles);
    ctx.restore();

    // Overlays
    if (currentMap.theme === 'outdoor') {
        drawDayNightCycle(ctx, width, height, timeOfDay);
        drawWeather(ctx, width, height, weather, weatherIntensity, now);
    }

    // HUD (Hearts + Coin counter)
    if (gameState.mode === 'game' && !menuOpen) {
        const hp = player.stats?.hp || 6;
        const maxHp = player.stats?.maxHp || 6;
        for (let i = 0; i < Math.ceil(maxHp / 2); i++) {
            const full = (i + 1) * 2 <= hp;
            const half = (i + 1) * 2 - 1 === hp;
            ctx.fillStyle = full ? '#f00' : (half ? '#f88' : '#444');
            const hx = 14 + i * 16;
            const hy = 14;
            const r = 4;
            ctx.beginPath();
            ctx.moveTo(hx, hy + 2);
            ctx.arc(hx - r / 2, hy - r / 2, r, Math.PI * 0.25, Math.PI, false);
            ctx.lineTo(hx - r / 2 - r, hy - r / 2);
            ctx.arc(hx + r / 2, hy - r / 2, r, Math.PI, Math.PI * 1.75, false);
            ctx.closePath();
            ctx.fill();
            // Simpler approach: filled rects for pixel hearts
            ctx.fillRect(hx - 5, hy - 4, 4, 4);
            ctx.fillRect(hx + 1, hy - 4, 4, 4);
            ctx.fillRect(hx - 6, hy - 2, 12, 4);
            ctx.fillRect(hx - 5, hy + 2, 10, 2);
            ctx.fillRect(hx - 3, hy + 4, 6, 2);
            ctx.fillRect(hx - 1, hy + 6, 2, 1);
            // Highlight
            ctx.fillStyle = full ? '#ff6666' : (half ? '#fbb' : '#555');
            ctx.fillRect(hx - 4, hy - 3, 2, 2);
        }

        // Coin counter
        const coinCount = inventory.filter(k => k.startsWith('coin_')).length;
        const coinY = 28;
        const coinSpin = Math.sin(now / 250);
        const cw = Math.max(2, Math.abs(coinSpin) * 5);
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.ellipse(16, coinY, cw, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        if (cw > 3) { ctx.fillStyle = '#ffec80'; ctx.beginPath(); ctx.ellipse(15, coinY - 1, cw * 0.4, 3, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 8px "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${coinCount}/${COIN_COUNT}`, 24, coinY + 3);

        // Player coordinates (top-right)
        const ptx = Math.floor(player.position.x / TILE_SIZE);
        const pty = Math.floor(player.position.y / TILE_SIZE);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(width - 62, 4, 58, 14);
        ctx.fillStyle = '#fff';
        ctx.font = '8px "Courier New", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`X:${ptx} Y:${pty}`, width - 6, 14);
    }

    // UI
    if (menuOpen) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)'; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#fff'; ctx.font = '10px "Courier New", monospace'; ctx.textAlign = 'center';
        ctx.fillText("- MENU -", width/2, 20);
        ctx.fillText(`Day ${day} - ${Math.floor(timeOfDay)}:00`, width/2, 35);
        ctx.fillStyle = '#aaa'; ctx.fillText(`Weather: ${weather}`, width/2, 45);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffcc00'; ctx.fillText("QUESTS:", 20, 60);
        let qY = 75;
        Object.values(quests).forEach(q => {
            if (q.status === 'active' || q.status === 'completed') {
                const done = q.status === 'completed';
                ctx.fillStyle = done ? '#4caf50' : '#fff';
                ctx.fillText(`${done ? '✓' : '!'} ${q.title}`, 20, qY);
                ctx.fillStyle = '#aaa';
                const step = q.steps[0];
                const progress = step.targetCount ? ` (${step.count || 0}/${step.targetCount})` : '';
                ctx.fillText(`  ${step.description}${progress}`, 20, qY + 12);
                qY += 30;
            }
        });

        // NPCs
        const npcs = currentMap.interactables.filter(i => i.type === 'npc');
        if (npcs.length > 0) {
            ctx.fillStyle = '#4cc9f0'; ctx.fillText("NPCs:", 160, 60);
            npcs.forEach((npc, i) => {
                const nx = Math.floor(npc.position.x / TILE_SIZE);
                const ny = Math.floor(npc.position.y / TILE_SIZE);
                ctx.fillStyle = '#ccc';
                ctx.fillText(`${npc.id} (${nx},${ny})`, 162, 73 + i * 12);
            });
        }

        // Uncollected coins
        const uncollected = currentMap.interactables.filter(i =>
            i.type === 'item' && i.itemKey?.startsWith('coin_') && !inventory.includes(i.itemKey!)
        );
        const collected = currentMap.interactables.filter(i =>
            i.type === 'item' && i.itemKey?.startsWith('coin_') && inventory.includes(i.itemKey!)
        );
        const coinListY = 60 + (npcs.length > 0 ? 14 + npcs.length * 12 : 0);
        ctx.fillStyle = '#ffd700'; ctx.fillText(`MÜNZEN (${collected.length}/${collected.length + uncollected.length}):`, 160, coinListY);
        let cy = coinListY + 13;
        uncollected.forEach(c => {
            if (cy > height - 40) return;
            const cx = Math.floor(c.position.x / TILE_SIZE);
            const cyy = Math.floor(c.position.y / TILE_SIZE);
            ctx.fillStyle = '#aaa';
            ctx.fillText(`  (${cx},${cyy})`, 160, cy);
            cy += 10;
        });
        if (uncollected.length === 0) {
            ctx.fillStyle = '#4caf50';
            ctx.fillText('  Alle gesammelt!', 160, cy);
        }

        // Player coords in menu
        const mpx = Math.floor(player.position.x / TILE_SIZE);
        const mpy = Math.floor(player.position.y / TILE_SIZE);
        ctx.fillStyle = '#aaa'; ctx.fillText(`Spieler: (${mpx},${mpy})`, 20, height - 44);

        // Save Button
        ctx.fillStyle = '#4cc9f0';
        ctx.fillText("[S] Save Game", 20, height - 30);
        
        ctx.fillStyle = '#ffff00'; ctx.textAlign = 'center'; ctx.fillText("[ESC] Back", width/2, height - 10);
    }

    // Full map overlay (M key)
    if (mapOpenRef.current && currentMap) {
        const cols = currentMap.tiles[0].length;
        const rows = currentMap.tiles.length;

        // Pre-render minimap to offscreen canvas (only when dirty)
        if (minimapDirty.current || !minimapCanvasRef.current) {
            const offscreen = document.createElement('canvas');
            offscreen.width = cols;
            offscreen.height = rows;
            const oc = offscreen.getContext('2d')!;
            for (let ty = 0; ty < rows; ty++) {
                for (let tx = 0; tx < cols; tx++) {
                    oc.fillStyle = MINIMAP_COLORS[currentMap.tiles[ty][tx]] || '#000';
                    oc.fillRect(tx, ty, 1, 1);
                }
            }
            minimapCanvasRef.current = offscreen;
            minimapDirty.current = false;
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, width, height);

        const padding = 16;
        const availW = width - padding * 2;
        const availH = height - padding * 2 - 20;
        const scale = Math.min(availW / cols, availH / rows);
        const mapW = cols * scale;
        const mapH = rows * scale;
        const ox = Math.floor((width - mapW) / 2);
        const oy = Math.floor((height - mapH) / 2) + 6;

        // Border
        ctx.fillStyle = '#333';
        ctx.fillRect(ox - 2, oy - 2, mapW + 4, mapH + 4);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(minimapCanvasRef.current, ox, oy, mapW, mapH);
        ctx.imageSmoothingEnabled = false;

        // Player position marker
        const px = player.position.x / TILE_SIZE;
        const py = player.position.y / TILE_SIZE;
        const markerX = ox + px * scale;
        const markerY = oy + py * scale;

        // Blinking player dot
        const blink = Math.floor(Date.now() / 300) % 2 === 0;
        if (blink) {
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(markerX, markerY, Math.max(3, scale * 2), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(markerX, markerY, Math.max(1.5, scale), 0, Math.PI * 2);
        ctx.fill();

        // Viewport rectangle
        const vpX = ox + (cameraX / TILE_SIZE) * scale;
        const vpY = oy + (cameraY / TILE_SIZE) * scale;
        const vpW = (width / TILE_SIZE) * scale;
        const vpH = (height / TILE_SIZE) * scale;
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 1;
        ctx.strokeRect(vpX, vpY, vpW, vpH);

        // Title and hint
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('MAP', width / 2, oy - 6);
        ctx.fillStyle = '#888';
        ctx.font = '8px "Courier New", monospace';
        ctx.fillText('[M] Close', width / 2, oy + mapH + 12);
    }
  };

  useGameLoop(update, render, canvasRef);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (gameState.mode === 'intro') {
            if (e.code === 'Space' || e.code === 'Enter') {
                audio.playTheme();
                setGameState(prev => ({ ...prev, mode: 'game' }));
                setTimeout(() => {
                    setGameState(prev => ({
                        ...prev,
                        dialog: { isOpen: true, text: ["Hallo und herzlich willkommen zum Hackathon bei Siemens!"], currentLine: 0 }
                    }));
                }, 1000);
            } else if (e.code === 'KeyL') {
                loadSave();
            }
        } else if (gameState.menuOpen) {
            if (e.code === 'KeyS') {
                saveGame(gameStateRef.current);
                setGameState(prev => ({ ...prev, dialog: { isOpen: true, text: ["Spiel gespeichert."], currentLine: 0 }, menuOpen: false }));
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.mode, gameState.menuOpen]);

  return (
    <div className="w-screen h-screen bg-black flex justify-center items-center relative overflow-hidden">
      <canvas
        ref={canvasRef}
        width={INTERNAL_WIDTH}
        height={INTERNAL_HEIGHT}
        className="w-full h-full object-contain"
        style={{ imageRendering: 'pixelated' }}
      />
      
      <div className="absolute top-4 right-4 flex gap-2">
         <button onClick={() => setShowControls(prev => !prev)} className="text-white/50 hover:text-white z-50 text-xs border border-white/20 px-2 py-1 rounded">[Controls]</button>
          <button onClick={enterFullscreen} className="text-white/50 hover:text-white z-50 text-xs border border-white/20 px-2 py-1 rounded">[Fullscreen]</button>
      </div>

      {(gameState.mode === 'game' && showControls) && (
      <>
        <div className="absolute bottom-8 left-8 flex flex-col gap-2 opacity-60 hover:opacity-100 transition-opacity">
            <div className="flex justify-center">
                <button className="w-16 h-16 bg-white/20 rounded-t active:bg-white/40 backdrop-blur-md border border-white/30 text-white text-2xl font-bold" 
                    onTouchStart={() => setKey('ArrowUp', true)} onTouchEnd={() => setKey('ArrowUp', false)}
                    onMouseDown={() => setKey('ArrowUp', true)} onMouseUp={() => setKey('ArrowUp', false)}>▲</button>
            </div>
            <div className="flex gap-2">
                <button className="w-16 h-16 bg-white/20 rounded-l active:bg-white/40 backdrop-blur-md border border-white/30 text-white text-2xl font-bold" 
                    onTouchStart={() => setKey('ArrowLeft', true)} onTouchEnd={() => setKey('ArrowLeft', false)}
                    onMouseDown={() => setKey('ArrowLeft', true)} onMouseUp={() => setKey('ArrowLeft', false)}>◀</button>
                <button className="w-16 h-16 bg-white/20 rounded active:bg-white/40 backdrop-blur-md border border-white/30 text-white text-2xl font-bold" 
                    onTouchStart={() => setKey('ArrowDown', true)} onTouchEnd={() => setKey('ArrowDown', false)}
                    onMouseDown={() => setKey('ArrowDown', true)} onMouseUp={() => setKey('ArrowDown', false)}>▼</button>
                <button className="w-16 h-16 bg-white/20 rounded-r active:bg-white/40 backdrop-blur-md border border-white/30 text-white text-2xl font-bold" 
                    onTouchStart={() => setKey('ArrowRight', true)} onTouchEnd={() => setKey('ArrowRight', false)}
                    onMouseDown={() => setKey('ArrowRight', true)} onMouseUp={() => setKey('ArrowRight', false)}>▶</button>
            </div>
        </div>

        <div className="absolute bottom-8 right-8 flex gap-4 opacity-60 hover:opacity-100 transition-opacity">
            <button className="w-20 h-20 bg-red-500/30 rounded-full active:bg-red-500/50 backdrop-blur-md border border-white/30 flex items-center justify-center text-white font-bold text-xl" 
                onTouchStart={() => setKey('Space', true)} onTouchEnd={() => setKey('Space', false)}
                onMouseDown={() => setKey('Space', true)} onMouseUp={() => setKey('Space', false)}>A</button>
            <button className="w-14 h-14 mt-6 bg-blue-500/30 rounded-full active:bg-blue-500/50 backdrop-blur-md border border-white/30 flex items-center justify-center text-white text-sm" 
                onTouchStart={() => setKey('Escape', true)} onTouchEnd={() => setKey('Escape', false)}
                onMouseDown={() => setKey('Escape', true)} onMouseUp={() => setKey('Escape', false)}>MENU</button>
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
