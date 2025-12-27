import { MapData, Portal, Interactable } from './types';

// 0: Grass, 1: Wall/Tree, 2: Water, 3: Floor (House), 4: Path, 5: Door, 6: Carpet
export type TileType = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const TILE_COLORS: Record<number, string> = {
  0: '#7CFC00', // Lawn Green (Gras)
  1: '#808080', // Gray (Wand/Stein)
  2: '#00BFFF', // Deep Sky Blue (Wasser)
  3: '#DEB887', // Burlywood (Holzboden)
  4: '#F4A460', // Sandy Brown (Weg)
  5: '#8B4513', // Saddle Brown (Tür)
  6: '#DC143C', // Crimson (Teppich)
};

export const TILE_SIZE = 32;

// --- MAPS ---

const WORLD_MAP_TILES: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 1, 1, 5, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Haus mit Tür (5)
  [1, 0, 0, 1, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 1, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 0, 0, 0, 1],
  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 1],
  [1, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 1],
  [1, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 0, 0, 0, 1],
  [1, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 1],
  [1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const HOUSE_INTERIOR_TILES: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 6, 6, 6, 3, 3, 3, 1],
  [1, 3, 3, 6, 6, 6, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 1, 1, 1, 5, 5, 1, 1, 1, 1],
];

const WORLD_INTERACTABLES: Interactable[] = [
  {
    id: 'sign_1',
    position: { x: TILE_SIZE * 6, y: TILE_SIZE * 7 },
    width: TILE_SIZE,
    height: TILE_SIZE,
    text: [
        "Willkommen in PoketHouse Town!", 
        "HINWEIS: Man kann jetzt Häuser betreten!",
        "Drücke Space vor der Tür oben links."
    ],
    type: 'sign',
    active: true,
    trigger: 'press'
  },
  {
    id: 'npc_1',
    position: { x: TILE_SIZE * 18, y: TILE_SIZE * 12 },
    width: TILE_SIZE,
    height: TILE_SIZE,
    text: [
        "Hallo Reisender!",
        "Ich habe meinen Schlüssel verloren...",
        "Vielleicht liegt er im Haus?"
    ],
    type: 'npc',
    active: true,
    trigger: 'press'
  },
  {
    id: 'item_potion',
    position: { x: TILE_SIZE * 25, y: TILE_SIZE * 5 },
    width: TILE_SIZE,
    height: TILE_SIZE,
    type: 'item',
    itemKey: 'potion',
    active: true,
    trigger: 'press'
  }
];

const HOUSE_INTERACTABLES: Interactable[] = [
    {
        id: 'npc_mom',
        position: { x: TILE_SIZE * 5, y: TILE_SIZE * 3 },
        width: TILE_SIZE,
        height: TILE_SIZE,
        text: [
            "Oh, hallo!",
            "Fühl dich wie zuhause.",
            "Draußen ist es gefährlich, nimm das hier!"
        ],
        type: 'npc',
        active: true,
        trigger: 'press'
    },
    {
        id: 'item_key',
        position: { x: TILE_SIZE * 2, y: TILE_SIZE * 2 },
        width: TILE_SIZE,
        height: TILE_SIZE,
        type: 'item',
        itemKey: 'old_key',
        active: true,
        trigger: 'press'
    }
];

export const MAPS: Record<string, MapData> = {
  'world': {
    id: 'world',
    tiles: WORLD_MAP_TILES,
    interactables: WORLD_INTERACTABLES,
    portals: [
      {
        x: TILE_SIZE * 5,
        y: TILE_SIZE * 3, // Position der Tür in World Coords (Zeile 3, Spalte 5 in WORLD_MAP_TILES)
        width: TILE_SIZE,
        height: TILE_SIZE,
        targetMap: 'house_1',
        targetX: TILE_SIZE * 4.5, // Mitte des Raums
        targetY: TILE_SIZE * 6,   // Unten vor der Tür
        direction: 'up'
      }
    ],
    theme: 'outdoor'
  },
  'house_1': {
    id: 'house_1',
    tiles: HOUSE_INTERIOR_TILES,
    interactables: HOUSE_INTERACTABLES,
    portals: [
      {
        x: TILE_SIZE * 4,
        y: TILE_SIZE * 7, // Tür Ausgang
        width: TILE_SIZE * 2,
        height: TILE_SIZE,
        targetMap: 'world',
        targetX: TILE_SIZE * 5,
        targetY: TILE_SIZE * 4, // Vor das Haus
        direction: 'down'
      }
    ],
    theme: 'indoor'
  }
};

export const ITEMS: Record<string, {name: string, description: string}> = {
    'potion': { name: "Heiltrank", description: "Heilt 20 HP. Riecht nach Minze." },
    'old_key': { name: "Alter Schlüssel", description: "Rostig, aber stabil." },
};
