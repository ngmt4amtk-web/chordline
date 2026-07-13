// 音理・コード解析（純関数のみ）

export const A4_DEFAULT = 442;

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Am', 'Em', 'Dm'];

const ROOT_MAP = {
  C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11,
};

const QUALITY_INTERVALS = {
  '': [0, 4, 7],
  M: [0, 4, 7],
  maj: [0, 4, 7],
  m: [0, 3, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  M7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  min7: [0, 3, 7, 10],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  add9: [0, 4, 7, 14],
};

const SCALE_MAJOR = [0, 2, 4, 5, 7, 9, 11];
const SCALE_MINOR = [0, 2, 3, 5, 7, 8, 10];

const ROMAN_MAJOR = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const ROMAN_MINOR = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

export function freqOfMidi(midi, a4 = A4_DEFAULT) {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

export function pcOfNote(name) {
  const m = name.match(/^([A-G])([#b]?)/);
  if (!m) return null;
  const key = m[1] + (m[2] || '');
  return ROOT_MAP[key] ?? null;
}

export function noteName(pc, preferFlat = false) {
  const names = preferFlat ? NOTE_NAMES_FLAT : NOTE_NAMES;
  return names[((pc % 12) + 12) % 12];
}

/** @returns {{ rootPc: number, quality: string, bassPc: number|null, symbol: string }} */
export function parseChordSymbol(symbol) {
  const raw = symbol.trim().replace(/\s+/g, '');
  const slash = raw.split('/');
  const main = slash[0];
  const bass = slash[1] ? pcOfNote(slash[1]) : null;

  const m = main.match(/^([A-G][#b]?)(.*)$/);
  if (!m) throw new Error(`Invalid chord: ${symbol}`);
  const rootPc = pcOfNote(m[1]);
  if (rootPc == null) throw new Error(`Invalid root: ${symbol}`);
  let qual = m[2] || '';
  if (qual === 'M') qual = '';
  if (!QUALITY_INTERVALS[qual] && qual !== '') {
    // try common aliases
    if (qual === 'min') qual = 'm';
    else if (qual === 'maj') qual = '';
  }
  if (!QUALITY_INTERVALS[qual]) throw new Error(`Unknown quality: ${qual} in ${symbol}`);

  return { rootPc, quality: qual, bassPc: bass, symbol: raw };
}

export function chordPcs(symbol) {
  const { rootPc, quality } = parseChordSymbol(symbol);
  return QUALITY_INTERVALS[quality].map((i) => (rootPc + i) % 12);
}

export function chordMidis(symbol, octave = 4) {
  const base = (octave + 1) * 12;
  const { rootPc, quality, bassPc } = parseChordSymbol(symbol);
  const pcs = QUALITY_INTERVALS[quality].map((i) => (rootPc + i) % 12);
  let midis = pcs.map((pc) => {
    let m = base + pc;
    while (m < 48) m += 12;
    while (m > 72) m -= 12;
    return m;
  });
  if (bassPc != null) {
    const bassMidi = base + bassPc;
    midis = [bassMidi < midis[0] ? bassMidi : bassMidi - 12, ...midis];
  }
  return [...new Set(midis)].sort((a, b) => a - b);
}

export function keyRootPc(key) {
  const isMinor = /m$/.test(key) && key !== 'B' && key.length > 1;
  const rootName = isMinor ? key.replace(/m$/, '') : key;
  return pcOfNote(rootName);
}

export function keyScale(key) {
  const root = keyRootPc(key);
  const minor = /m$/.test(key) && !['B', 'F', 'C'].includes(key) || key === 'Am' || key === 'Em' || key === 'Dm';
  const steps = minor ? SCALE_MINOR : SCALE_MAJOR;
  return steps.map((s) => (root + s) % 12);
}

export function chordFunction(symbol, key) {
  const scale = keyScale(key);
  const { rootPc } = parseChordSymbol(symbol);
  const deg = scale.indexOf(rootPc);
  if (deg < 0) return 'borrowed';
  const minorKey = /m$/.test(key) && ['Am', 'Em', 'Dm'].includes(key);
  if (minorKey) {
    if ([0, 5].includes(deg)) return 'tonic';
    if ([3, 4].includes(deg)) return 'subdominant';
    if ([6, 1].includes(deg)) return 'dominant';
    return 'other';
  }
  if ([0, 5].includes(deg)) return 'tonic';
  if ([1, 3].includes(deg)) return 'subdominant';
  if ([4, 6].includes(deg)) return 'dominant';
  return 'other';
}

export function romanNumeral(symbol, key) {
  const scale = keyScale(key);
  const { rootPc, quality } = parseChordSymbol(symbol);
  const deg = scale.indexOf(rootPc);
  if (deg < 0) return '?';
  const minorKey = ['Am', 'Em', 'Dm'].includes(key);
  const romans = minorKey ? ROMAN_MINOR : ROMAN_MAJOR;
  let r = romans[deg];
  if (quality.startsWith('m') || quality === 'dim' || quality === 'm7' || quality === 'm7b5') {
    if (!r.startsWith('i') && !r.startsWith('v')) r = r.toLowerCase();
  }
  if (quality.includes('7') && !quality.includes('maj')) r += '7';
  return r;
}

export function transposeChord(symbol, fromKey, toKey) {
  const fromRoot = keyRootPc(fromKey);
  const toRoot = keyRootPc(toKey);
  const delta = (toRoot - fromRoot + 12) % 12;
  const { rootPc, quality, bassPc } = parseChordSymbol(symbol);
  const newRoot = noteName((rootPc + delta) % 12);
  const newBass = bassPc != null ? '/' + noteName((bassPc + delta) % 12) : '';
  return newRoot + quality + newBass;
}

export const PROGRESSIONS = [
  {
    id: 'axis',
    name: 'Axis',
    subtitle: 'I – V – vi – IV',
    key: 'C',
    chords: ['C', 'G', 'Am', 'F'],
    description: 'ポップスで最頻出の骨格。耳に残りやすい循環。',
  },
  {
    id: 'doo-wop',
    name: 'Doo-wop',
    subtitle: 'I – vi – IV – V',
    key: 'C',
    chords: ['C', 'Am', 'F', 'G'],
    description: '50年代から続く定番。終止感がはっきりする。',
  },
  {
    id: 'ii-v-i',
    name: 'ii – V – I',
    subtitle: 'ジャズの基本解決',
    key: 'C',
    chords: ['Dm7', 'G7', 'Cmaj7'],
    description: 'ドミナントからトニックへの最短ルート。',
  },
  {
    id: 'canon',
    name: 'Canon',
    subtitle: 'I – V – vi – iii – IV',
    key: 'C',
    chords: ['C', 'G', 'Am', 'Em', 'F'],
    description: 'カノン進行。下行ベースの印象。',
  },
  {
    id: 'royal-road',
    name: '小室進行',
    subtitle: 'vi – IV – V – I',
    key: 'Am',
    chords: ['Am', 'F', 'G', 'C'],
    description: 'J-POPでおなじみの進行。マイナー始まり。',
  },
  {
    id: 'blues',
    name: 'Blues 12-bar',
    subtitle: 'I – IV – I – V',
    key: 'C',
    chords: ['C7', 'C7', 'C7', 'F7', 'F7', 'C7', 'G7', 'F7', 'C7', 'G7'],
    description: 'ブルースの骨格（短縮版10コード）。',
  },
];

export function progressionForKey(prog, key) {
  const fromKey = prog.key;
  return {
    ...prog,
    key,
    chords: prog.chords.map((c) => transposeChord(c, fromKey, key)),
  };
}

export function chordLabel(symbol, key, showRoman = true) {
  const roman = showRoman ? romanNumeral(symbol, key) : '';
  return roman && roman !== '?' ? `${symbol} (${roman})` : symbol;
}

export function pcsMatch(selected, target) {
  const a = [...new Set(selected.map((x) => ((x % 12) + 12) % 12))].sort((x, y) => x - y);
  const b = [...new Set(target.map((x) => ((x % 12) + 12) % 12))].sort((x, y) => x - y);
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}
