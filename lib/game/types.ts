import { MapData, Interactable, Entity, Position, Quest, WeatherType, Particle } from './types';

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
  targetWeather: WeatherType; // Für Transitions
  weatherIntensity: number; // 0..1 (Fade Factor)
  
  particles: Particle[];
  mode: 'intro' | 'game' | 'menu'; 
}
