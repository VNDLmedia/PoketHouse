export type Position = { x: number, y: number };

export type WeatherType = 'clear' | 'cloudy' | 'rain' | 'storm';

export interface Particle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
    alpha: number;
    type?: 'rain' | 'dust' | 'sparkle' | 'water' | 'damage';
}

export interface Stats {
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
}

export interface Entity {
    id: string;
    position: Position;
    color: string;
    direction: 'up' | 'down' | 'left' | 'right';
    isMoving: boolean;
    backpack?: string; 
    stats?: Stats;
    isAttacking?: boolean;
    attackTimer?: number;
    invincibleTimer?: number;
    width?: number; // Hitbox width
    height?: number; // Hitbox height
}

export interface Enemy extends Entity {
    type: 'slime' | 'bat' | 'skeleton' | 'boss';
    state: 'idle' | 'chase' | 'attack' | 'retreat';
    detectionRange: number;
    attackRange: number;
    cooldown: number;
    patrolPoint?: Position;
}

export interface Interactable {
    id: string;
    position: Position;
    width: number;
    height: number;
    type: 'sign' | 'npc' | 'item' | 'switch' | 'push_block' | 'door' | 'chest';
    text?: string[]; // For signs/NPCs
    itemKey?: string; // For items/chests
    active: boolean;
    trigger: 'touch' | 'press' | 'attack';
    reqFlag?: string; // Flag required to interact/unlock
    setFlag?: string; // Flag set upon interaction
    state?: 'open' | 'closed' | 'pressed' | 'unpressed'; // For switches/doors/chests
}

export interface Portal {
    x: number;
    y: number;
    width: number;
    height: number;
    targetMap: string;
    targetX: number;
    targetY: number;
    direction?: 'up' | 'down' | 'left' | 'right';
}

export interface MapData {
    id: string;
    tiles: number[][];
    interactables: Interactable[];
    enemies: Enemy[]; // New: Enemies list
    portals: Portal[];
    theme: 'outdoor' | 'indoor' | 'dungeon' | 'cave';
}

export interface QuestStep {
    id: string;
    description: string;
    completed: boolean;
    requiredFlag?: string;
    requiredItem?: string;
    requiredKill?: string; // Kill x enemies
    count?: number; // Progress counter
    targetCount?: number;
}

export interface Quest {
    id: string;
    title: string;
    description: string;
    status: 'inactive' | 'active' | 'completed' | 'failed';
    steps: QuestStep[];
    rewardItem?: string;
    rewardXp?: number;
}

export interface GameState {
  currentMapId: string;
  loadedMaps: Record<string, MapData>;
  player: Entity;
  flags: Record<string, boolean>; 
  inventory: string[]; 
  quests: Record<string, Quest>; 
  dialog: {
    isOpen: boolean;
    text: string[];
    speaker?: string; 
    currentLine: number;
    onFinish?: () => void;
    choices?: { text: string, action: () => void }[]; // New: Dialog choices
  };
  menuOpen: boolean;
  
  // Time & Weather
  timeOfDay: number; // 0..24
  day: number; 
  weather: WeatherType;
  targetWeather: WeatherType; 
  weatherIntensity: number; 
  weatherTimer: number;
  
  particles: Particle[];
  mode: 'intro' | 'game' | 'menu' | 'dead'; 
  
  // Messages/Notifications
  notifications: { text: string, time: number }[];
}
