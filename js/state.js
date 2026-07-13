import { KEYS, PROGRESSIONS } from './theory.js';

const STORAGE_KEY = 'chordline:v1';

const defaults = {
  screen: 'home',
  mode: null,
  key: 'C',
  showRoman: true,
  noteStyle: 'both',
  tempo: 72,
  volume: 0.85,
  progressionId: PROGRESSIONS[0].id,
  chordSymbol: 'C',
  practiceIndex: 0,
  practiceSelected: [],
};

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      key: state.key,
      showRoman: state.showRoman,
      noteStyle: state.noteStyle,
      tempo: state.tempo,
      volume: state.volume,
      progressionId: state.progressionId,
    }));
  } catch (_) {}
}

export { KEYS, PROGRESSIONS };
