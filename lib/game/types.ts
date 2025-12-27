export interface Position {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface Entity {
  id: string;
  position: Position;
  sprite?: string; 
  color?: string; 
  direction: 'up' | 'down' | 'left' | 'right';
  isMoving: boolean;
}

export interface Interactable {
  id: string;
  position: Position;
  width: number;
  height: number;
  text?: string[]; 
  type: 'sign' | 'npc' | 'item';
  active: boolean; 
  trigger: 'press' | 'touch'; 
  itemKey?: string; 
  reqFlag?: string; 
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
  portals: Portal[];
  theme: 'outdoor' | 'indoor';
}

export interface Item {
  key: string;
  name: string;
  description: string;
}

export type QuestStatus = 'inactive' | 'active' | 'completed';

export interface Quest {
  id: string;
  title: string;
  description: string;
  status: QuestStatus;
  steps: {
    id: string;
    description: string;
    completed: boolean;
    requiredFlag?: string; 
    requiredItem?: string; 
  }[];
  rewardItem?: string;
}

export type WeatherType = 'clear' | 'rain' | 'storm' | 'cloudy';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type?: 'rain' | 'dust' | 'sparkle' | 'water';
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
  };
  menuOpen: boolean;
  
  // Time & Weather
  timeOfDay: number; // 0..24
  day: number; 
  weather: WeatherType;
  weatherTimer: number; 
  
  particles: Particle[];
  mode: 'intro' | 'game' | 'menu'; 
}
