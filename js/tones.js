import { chordPcs, parseChordSymbol, spellChordTones } from './theory.js';

export const TONES_STORAGE_KEY = 'chordline:tones:v1';

export const TONE_ROOTS = Object.freeze([
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
]);

export const TONE_QUALITIES = Object.freeze([
  { id: 'major', suffix: '', label: 'メジャー', formula: '1・3・5' },
  { id: 'minor', suffix: 'm', label: 'マイナー', formula: '1・♭3・5' },
  { id: 'dominant7', suffix: '7', label: 'セブンス', formula: '1・3・5・♭7' },
  { id: 'major7', suffix: 'M7', label: 'メジャーセブンス', formula: '1・3・5・7' },
  { id: 'minor7', suffix: 'm7', label: 'マイナーセブンス', formula: '1・♭3・5・♭7' },
  { id: 'diminished', suffix: 'dim', label: 'ディミニッシュ', formula: '1・♭3・♭5' },
  { id: 'augmented', suffix: 'aug', label: 'オーギュメント', formula: '1・3・♯5' },
  { id: 'sus4', suffix: 'sus4', label: 'サスフォー', formula: '1・4・5' },
]);

export const TONE_POOL = Object.freeze(
  TONE_QUALITIES.flatMap((quality) => TONE_ROOTS.map((root) => `${root}${quality.suffix}`)),
);

const defaults = { version: 1, cells: {}, sessions: 0, lastSession: null };
const DAY = 24 * 60 * 60 * 1000;

function cleanCell(cell) {
  return {
    attempts: Number(cell?.attempts) || 0,
    silentHits: Number(cell?.silentHits) || 0,
    hintedHits: Number(cell?.hintedHits) || 0,
    misses: Number(cell?.misses) || 0,
    lastSeenAt: Number(cell?.lastSeenAt) || 0,
    dueAt: Number(cell?.dueAt) || 0,
    lastOutcome: cell?.lastOutcome || null,
  };
}

export function loadTonesState(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(TONES_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return { ...defaults, cells: {} };
    const cells = {};
    for (const [symbol, cell] of Object.entries(parsed.cells || {})) cells[symbol] = cleanCell(cell);
    return {
      ...defaults,
      ...parsed,
      version: 1,
      cells,
      sessions: Number(parsed.sessions) || 0,
    };
  } catch {
    return { ...defaults, cells: {} };
  }
}

export function saveTonesState(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(TONES_STORAGE_KEY, JSON.stringify({
      version: 1,
      cells: state.cells || {},
      sessions: Number(state.sessions) || 0,
      lastSession: state.lastSession || null,
    }));
  } catch (_) {}
}

export function silentCoverage(state) {
  return Object.values(state?.cells || {}).filter((cell) => Number(cell?.silentHits) > 0).length;
}

function shuffled(items, random) {
  return items
    .map((value) => ({ value, order: random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ value }) => value);
}

function weakScore(symbol, cells, now) {
  const cell = cleanCell(cells[symbol]);
  const overdueDays = cell.dueAt && cell.dueAt <= now ? Math.min(30, (now - cell.dueAt) / DAY) : 0;
  return cell.misses * 8 + cell.hintedHits * 2 + overdueDays - cell.silentHits * 0.5;
}

/** 弱点3・未出題3・復習2を目安に、重複なしで8問を作る。 */
export function buildToneSession({
  pool = TONE_POOL,
  cells = {},
  now = Date.now(),
  count = 8,
  random = Math.random,
} = {}) {
  const seen = pool.filter((symbol) => cells[symbol]);
  const fresh = shuffled(pool.filter((symbol) => !cells[symbol]), random);
  const weak = shuffled(
    seen.filter((symbol) => {
      const cell = cleanCell(cells[symbol]);
      return cell.misses > 0 || (cell.dueAt > 0 && cell.dueAt <= now);
    }),
    random,
  ).sort((a, b) => weakScore(b, cells, now) - weakScore(a, cells, now));
  const review = shuffled(seen.filter((symbol) => !weak.includes(symbol)), random)
    .sort((a, b) => cleanCell(cells[a]).dueAt - cleanCell(cells[b]).dueAt);

  const picked = [];
  const take = (items, max) => {
    for (const symbol of items) {
      if (picked.length >= count || max <= 0) break;
      if (!picked.includes(symbol)) {
        picked.push(symbol);
        max -= 1;
      }
    }
  };
  take(weak, 3);
  take(fresh, 3);
  take(review, 2);
  take([...weak, ...fresh, ...review, ...shuffled(pool, random)], count);
  return shuffled(picked.slice(0, count), random);
}

export function recordToneAttempt(state, {
  symbol,
  correct,
  hintLevel = 0,
  now = Date.now(),
}) {
  const previous = cleanCell(state?.cells?.[symbol]);
  const cell = { ...previous, attempts: previous.attempts + 1, lastSeenAt: now };
  if (!correct) {
    cell.misses += 1;
    cell.lastOutcome = 'miss';
    cell.dueAt = now + 10 * 60 * 1000;
  } else if (hintLevel > 0) {
    cell.hintedHits += 1;
    cell.lastOutcome = 'hinted';
    cell.dueAt = now + 6 * 60 * 60 * 1000;
  } else {
    cell.silentHits += 1;
    cell.lastOutcome = 'silent';
    const intervals = [1, 3, 7, 14, 30];
    cell.dueAt = now + intervals[Math.min(cell.silentHits - 1, intervals.length - 1)] * DAY;
  }
  return { ...state, cells: { ...(state?.cells || {}), [symbol]: cell } };
}

export function finishToneSession(state, results, now = Date.now()) {
  const summary = summarizeToneResults(results);
  return {
    ...state,
    sessions: (Number(state?.sessions) || 0) + 1,
    lastSession: { ...summary, at: now },
  };
}

export function summarizeToneResults(results = []) {
  return results.reduce((summary, result) => {
    if (!result.correct) summary.misses += 1;
    else if (result.hintLevel > 0) summary.hinted += 1;
    else summary.silent += 1;
    return summary;
  }, { silent: 0, hinted: 0, misses: 0, total: results.length });
}

export function toneDefinition(symbol) {
  const quality = parseChordSymbol(symbol).quality;
  return TONE_QUALITIES.find((item) => item.suffix === quality) || TONE_QUALITIES[0];
}

export function toneHint(symbol, level, style = 'both') {
  const definition = toneDefinition(symbol);
  if (level <= 0) return '';
  if (level === 1) return `${definition.label}。${chordPcs(symbol).length}音でできる。`;
  if (level === 2) return `度数は ${definition.formula}。`;
  const tones = spellChordTones(symbol, style);
  const reveal = tones[Math.min(1, tones.length - 1)];
  return `1音だけ開く: ${reveal}`;
}

export function displayChordSymbol(symbol) {
  return String(symbol).replace(/([A-G])b/g, '$1♭').replace(/#/g, '♯');
}
