import { MapData, Interactable, Entity, Position, Quest } from './types';

export type WeatherType = 'clear' | 'rain' | 'storm' | 'cloudy';

// Update GameState
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
  day: number; // Tagzähler
  weather: WeatherType;
  weatherTimer: number; // Zeit bis zum nächsten Wetterwechsel
  
  particles: Particle[];
  mode: 'intro' | 'game' | 'menu'; 
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type?: 'rain' | 'dust' | 'sparkle';
}
