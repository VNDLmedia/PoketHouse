// 0: Grass, 1: Wall/Tree, 2: Water, 3: Floor (House), 4: Path, 5: Door, 6: Carpet, 7: Flower, 8: Rock, 9: HouseWall, 10: Roof, 11: Bush, 12: TallGrass, 13: Sand, 14: Dirt
export type TileType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export const TILE_SIZE = 32;

export const ITEMS: Record<string, {name: string, description: string}> = {
    'potion': { name: "Heiltrank", description: "Heilt 20 HP. Leuchtet magisch." },
    'old_key': { name: "Alter Schlüssel", description: "Rostig, aber stabil." },
    'flower': { name: "Wildblume", description: "Hübsch anzusehen." },
    'berry': { name: "Waldbeere", description: "Süß und saftig." },
};

export const MAPS: Record<string, any> = {}; 
