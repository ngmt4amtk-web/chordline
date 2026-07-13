import { KEYS, PROGRESSIONS } from './theory.js';

const STORAGE_KEY = 'chordline:v2';
// v1 は読まない・消さない

const defaults = {
  screen: 'home',
  key: 'C',
  showRoman: true,
  noteStyle: 'both',
  tempo: 72,
  volume: 0.85,
  /** @type {Record<string, number>} progressionId → discoveredAt */
  discovered: {},
  /** @type {string[]} */
  unlockedChords: [],
  /** @type {{ chords: string[], at: number }[]} */
  myLines: [],
};

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults, discovered: {}, unlockedChords: [], myLines: [] };
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      discovered: parsed.discovered && typeof parsed.discovered === 'object' ? parsed.discovered : {},
      unlockedChords: Array.isArray(parsed.unlockedChords) ? parsed.unlockedChords : [],
      myLines: Array.isArray(parsed.myLines) ? parsed.myLines : [],
    };
  } catch {
    return { ...defaults, discovered: {}, unlockedChords: [], myLines: [] };
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
      discovered: state.discovered || {},
      unlockedChords: state.unlockedChords || [],
      myLines: state.myLines || [],
    }));
  } catch (_) {}
}

export function discoveredCount(state) {
  return Object.keys(state.discovered || {}).length;
}

export function isDiscovered(state, id) {
  return Boolean(state.discovered && state.discovered[id]);
}

/**
 * 進行を図鑑に刻印し、コード語彙を解放する
 * @param {object} state
 * @param {string} id
 * @param {string[]} [playedChords]
 */
export function registerDiscovery(state, id, playedChords = []) {
  const next = {
    ...state,
    discovered: { ...state.discovered, [id]: Date.now() },
    unlockedChords: [...(state.unlockedChords || [])],
  };
  const prog = PROGRESSIONS.find((p) => p.id === id);
  const pool = [...(prog?.digForm || []), ...playedChords];
  for (const c of pool) {
    if (c && !next.unlockedChords.includes(c)) next.unlockedChords.push(c);
  }
  return next;
}

export function saveMyLine(state, chords) {
  const entry = { chords: [...chords], at: Date.now() };
  return {
    ...state,
    myLines: [entry, ...(state.myLines || [])].slice(0, 40),
  };
}

export { KEYS, PROGRESSIONS, STORAGE_KEY };
