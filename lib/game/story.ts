import { Quest } from './types';

export const INITIAL_QUESTS: Record<string, Quest> = {
  'intro_quest': {
    id: 'intro_quest',
    title: 'Ein neuer Anfang',
    description: 'Finde den Dorfältesten, er wartet im Zentrum.',
    status: 'active',
    steps: [
      { id: 'talk_elder', description: 'Sprich mit dem Ältesten', completed: false, requiredFlag: 'met_elder' }
    ]
  },
  'lost_potion': {
    id: 'lost_potion',
    title: 'Die verlorene Medizin',
    description: 'Der Älteste braucht seine Medizin. Sie liegt irgendwo im Wald beim Wasser.',
    status: 'inactive',
    steps: [
      { id: 'find_potion', description: 'Finde den Heiltrank', completed: false, requiredItem: 'potion' },
      { id: 'return_potion', description: 'Bring den Trank zum Ältesten', completed: false, requiredFlag: 'returned_potion' }
    ],
    rewardItem: 'old_key' // Schlüssel zum Haus?
  }
};

export const STORY_FLAGS = {
  INTRO_DONE: 'intro_done',
  MET_ELDER: 'met_elder',
  GOT_POTION: 'got_potion',
  RETURNED_POTION: 'returned_potion'
};

