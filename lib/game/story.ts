import { Quest } from './types';

export const COIN_COUNT = 20;

export const INITIAL_QUESTS: Record<string, Quest> = {
  'coin_quest': {
    id: 'coin_quest',
    title: 'Münzjäger',
    description: `Sammle alle ${COIN_COUNT} Münzen auf dem Gelände.`,
    status: 'active',
    steps: [
      { id: 'collect_coins', description: `Münzen gesammelt`, completed: false, count: 0, targetCount: COIN_COUNT }
    ]
  },
};

export const STORY_FLAGS = {
  INTRO_DONE: 'intro_done',
  FOUND_STRUCTURE: 'found_structure',
  ENTERED_DUNGEON: 'entered_dungeon',
  KILLED_BOSS: 'killed_boss'
};
