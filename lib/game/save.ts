import { GameState } from './types';

const SAVE_KEY = 'pokethouse_save_v1';

export const saveGame = (state: GameState) => {
    try {
        const serialized = JSON.stringify(state);
        localStorage.setItem(SAVE_KEY, serialized);
        return true;
    } catch (e) {
        console.error("Save failed", e);
        return false;
    }
};

export const loadGame = (): GameState | null => {
    try {
        const serialized = localStorage.getItem(SAVE_KEY);
        if (!serialized) return null;
        return JSON.parse(serialized);
    } catch (e) {
        console.error("Load failed", e);
        return null;
    }
};

export const hasSaveGame = (): boolean => {
    return !!localStorage.getItem(SAVE_KEY);
};

