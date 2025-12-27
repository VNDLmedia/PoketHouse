import { Position, Entity, Interactable, Portal, MapData } from './types';
import { TILE_SIZE } from './map';

export const isSolid = (tile: number): boolean => {
  // 1: Wall, 2: Water
  return tile === 1 || tile === 2;
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
