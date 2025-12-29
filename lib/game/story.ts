import { Quest } from './types';

export const INITIAL_QUESTS: Record<string, Quest> = {
  'intro_quest': {
    id: 'intro_quest',
    title: 'Ein neuer Anfang',
    description: 'Erkunde die Welt und finde Zivilisation.',
    status: 'active',
    steps: [
      { id: 'explore', description: 'Finde ein Haus oder Ruine', completed: false, requiredFlag: 'found_structure' }
    ]
  },
  'dungeon_quest': {
    id: 'dungeon_quest',
    title: 'Das dunkle Gewölbe',
    description: 'Eine dunkle Aura geht von den Ruinen aus.',
    status: 'inactive',
    steps: [
      { id: 'enter_dungeon', description: 'Betrete das Gewölbe', completed: false, requiredFlag: 'entered_dungeon' },
      { id: 'kill_boss', description: 'Besiege den Wächter', completed: false, requiredFlag: 'killed_boss' }
    ],
    rewardXp: 100,
    rewardItem: 'legendary_sword'
  }
};

export const STORY_FLAGS = {
  INTRO_DONE: 'intro_done',
  FOUND_STRUCTURE: 'found_structure',
  ENTERED_DUNGEON: 'entered_dungeon',
  KILLED_BOSS: 'killed_boss'
};
