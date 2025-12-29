import { Position, Entity, Interactable, Portal, MapData, Enemy } from './types';
import { TILE_SIZE } from './map';

export const isSolid = (tile: number): boolean => {
  // 1: Wall/Tree, 2: Water, 8: Rock, 9: HouseWall
  return tile === 1 || tile === 2 || tile === 8 || tile === 9;
};

export const checkCollision = (position: Position, map: MapData): boolean => {
  if (!map) return true;

  const padding = 4;
  const left = position.x + padding;
  const right = position.x + TILE_SIZE - padding;
  const top = position.y + padding;
  const bottom = position.y + TILE_SIZE - padding;

  const points = [
    { x: left, y: top },
    { x: right, y: top },
    { x: left, y: bottom },
    { x: right, y: bottom },
  ];

  for (const point of points) {
    const tileX = Math.floor(point.x / TILE_SIZE);
    const tileY = Math.floor(point.y / TILE_SIZE);

    if (
      tileY < 0 ||
      tileY >= map.tiles.length ||
      tileX < 0 ||
      tileX >= map.tiles[0].length
    ) {
      return true; // Außerhalb der Map
    }

    const tile = map.tiles[tileY][tileX];
    if (isSolid(tile)) {
      return true;
    }
  }

  // Check for Interactables collision (push blocks, closed doors)
  for (const item of map.interactables) {
    if (item.type === 'push_block' || (item.type === 'door' && item.state === 'closed')) {
        if (
            right > item.position.x &&
            left < item.position.x + item.width &&
            bottom > item.position.y &&
            top < item.position.y + item.height
        ) {
            return true;
        }
    }
  }

  return false;
};

export const checkPortal = (player: Entity, portals: Portal[]): Portal | null => {
    const centerX = player.position.x + TILE_SIZE / 2;
    const centerY = player.position.y + TILE_SIZE / 2;

    for (const portal of portals) {
        if (
            centerX >= portal.x &&
            centerX <= portal.x + portal.width &&
            centerY >= portal.y &&
            centerY <= portal.y + portal.height
        ) {
            return portal;
        }
    }
    return null;
};

export const checkInteraction = (player: Entity, interactables: Interactable[]): Interactable | null => {
  const interactDistance = TILE_SIZE / 2;
  const center = {
    x: player.position.x + TILE_SIZE / 2,
    y: player.position.y + TILE_SIZE / 2
  };
  
  let targetX = center.x;
  let targetY = center.y;

  switch (player.direction) {
    case 'up': targetY -= interactDistance + TILE_SIZE/2; break;
    case 'down': targetY += interactDistance + TILE_SIZE/2; break;
    case 'left': targetX -= interactDistance + TILE_SIZE/2; break;
    case 'right': targetX += interactDistance + TILE_SIZE/2; break;
  }

  for (const item of interactables) {
    if (!item.active) continue;
    if (item.trigger !== 'press') continue; // Only 'press' trigger
    
    // Einfache Box-Kollision
    if (
      targetX >= item.position.x &&
      targetX <= item.position.x + item.width &&
      targetY >= item.position.y &&
      targetY <= item.position.y + item.height
    ) {
      return item;
    }
  }

  return null;
};

export const checkAttack = (attacker: Entity, enemies: Enemy[]): Enemy[] => {
    const hitEnemies: Enemy[] = [];
    const range = 24;
    const center = {
        x: attacker.position.x + TILE_SIZE/2,
        y: attacker.position.y + TILE_SIZE/2
    };

    let hitBox = { x: 0, y: 0, w: 0, h: 0 };
    
    switch (attacker.direction) {
        case 'up': 
            hitBox = { x: center.x - 16, y: center.y - range - 16, w: 32, h: 24 }; 
            break;
        case 'down': 
            hitBox = { x: center.x - 16, y: center.y + 16, w: 32, h: 24 }; 
            break;
        case 'left': 
            hitBox = { x: center.x - range - 16, y: center.y - 16, w: 24, h: 32 }; 
            break;
        case 'right': 
            hitBox = { x: center.x + 16, y: center.y - 16, w: 24, h: 32 }; 
            break;
    }

    for (const enemy of enemies) {
        const ex = enemy.position.x;
        const ey = enemy.position.y;
        if (
            hitBox.x < ex + TILE_SIZE &&
            hitBox.x + hitBox.w > ex &&
            hitBox.y < ey + TILE_SIZE &&
            hitBox.y + hitBox.h > ey
        ) {
            hitEnemies.push(enemy);
        }
    }
    return hitEnemies;
};

export const resolvePush = (player: Entity, block: Interactable, map: MapData): boolean => {
    // Try to move block in player's direction
    let nextX = block.position.x;
    let nextY = block.position.y;
    
    if (player.direction === 'up') nextY -= TILE_SIZE;
    if (player.direction === 'down') nextY += TILE_SIZE;
    if (player.direction === 'left') nextX -= TILE_SIZE;
    if (player.direction === 'right') nextX += TILE_SIZE;

    // Check if new position is valid (not solid)
    // We reuse checkCollision but we need to trick it or adapt it.
    // Let's just check the center point of the new position.
    
    // Temporarily remove the block from map interactables to avoid self-collision
    // But checkCollision iterates interactables.
    // The block is the one being moved.
    
    // We need to check if *next* position collides with WALLS or OTHER Interactables (excluding itself)
    
    const tileX = Math.floor((nextX + TILE_SIZE/2) / TILE_SIZE);
    const tileY = Math.floor((nextY + TILE_SIZE/2) / TILE_SIZE);
    
    if (tileY < 0 || tileY >= map.tiles.length || tileX < 0 || tileX >= map.tiles[0].length) return false;
    if (isSolid(map.tiles[tileY][tileX])) return false;
    
    // Check other interactables
    for (const other of map.interactables) {
        if (other === block) continue;
        if (other.type === 'push_block' || (other.type === 'door' && other.state === 'closed')) {
             if (Math.abs(other.position.x - nextX) < 4 && Math.abs(other.position.y - nextY) < 4) return false;
        }
    }
    
    return true;
}
