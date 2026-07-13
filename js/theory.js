// 音理・コード解析（純関数のみ）

export const A4_DEFAULT = 442;

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const NOTE_NAMES_KATA = ['ド', 'ド♯', 'レ', 'レ♯', 'ミ', 'ファ', 'ファ♯', 'ソ', 'ソ♯', 'ラ', 'ラ♯', 'シ'];
export const NOTE_NAMES_KATA_FLAT = ['ド', 'レ♭', 'レ', 'ミ♭', 'ミ', 'ファ', 'ソ♭', 'ソ', 'ラ♭', 'ラ', 'シ♭', 'シ'];

/** @param {number} pc @param {'abc'|'katakana'|'both'} style */
export function formatPc(pc, style = 'both', preferFlat = false) {
  const i = ((pc % 12) + 12) % 12;
  const abc = (preferFlat ? NOTE_NAMES_FLAT : NOTE_NAMES)[i];
  const kata = (preferFlat ? NOTE_NAMES_KATA_FLAT : NOTE_NAMES_KATA)[i];
  if (style === 'abc') return abc;
  if (style === 'katakana') return kata;
  return `${kata} (${abc})`;
}

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
  mM7: [0, 3, 7, 11],
  mMaj7: [0, 3, 7, 11],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  add9: [0, 4, 7, 14],
};

const QUALITY_DEGREES = {
  '': [0, 2, 4],
  M: [0, 2, 4],
  maj: [0, 2, 4],
  m: [0, 2, 4],
  min: [0, 2, 4],
  dim: [0, 2, 4],
  aug: [0, 2, 4],
  sus2: [0, 1, 4],
  sus4: [0, 3, 4],
  '7': [0, 2, 4, 6],
  maj7: [0, 2, 4, 6],
  M7: [0, 2, 4, 6],
  m7: [0, 2, 4, 6],
  min7: [0, 2, 4, 6],
  mM7: [0, 2, 4, 6],
  mMaj7: [0, 2, 4, 6],
  dim7: [0, 2, 4, 6],
  m7b5: [0, 2, 4, 6],
  '6': [0, 2, 4, 5],
  m6: [0, 2, 4, 5],
  add9: [0, 2, 4, 1],
};

/** 7th等を三和音類へ還元したクオリティ類（互換判定用） */
const QUALITY_CLASS = {
  '': 'major',
  M: 'major',
  maj: 'major',
  '7': 'major',
  maj7: 'major',
  M7: 'major',
  '6': 'major',
  add9: 'major',
  m: 'minor',
  min: 'minor',
  m7: 'minor',
  min7: 'minor',
  m6: 'minor',
  mM7: 'minor',
  mMaj7: 'minor',
  dim: 'dim',
  dim7: 'dim',
  m7b5: 'dim',
  aug: 'aug',
  sus2: 'sus2',
  sus4: 'sus4',
};

const SEVENTH_COMPATIBLE = new Set([
  '', 'M', 'maj', '7', 'maj7', 'M7',
  'm', 'min', 'm7', 'min7', 'mM7', 'mMaj7',
]);

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
    if (qual === 'min') qual = 'm';
    else if (qual === 'maj') qual = '';
    else if (qual === 'mMaj7') qual = 'mM7';
  }
  if (!QUALITY_INTERVALS[qual]) throw new Error(`Unknown quality: ${qual} in ${symbol}`);

  return { rootPc, quality: qual, bassPc: bass, symbol: raw };
}

export function chordPcs(symbol) {
  const { rootPc, quality } = parseChordSymbol(symbol);
  return QUALITY_INTERVALS[quality].map((i) => (rootPc + i) % 12);
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_PCS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTER_KATAKANA = { C: 'ド', D: 'レ', E: 'ミ', F: 'ファ', G: 'ソ', A: 'ラ', B: 'シ' };

function accidentalFor(delta) {
  if (delta === -2) return '♭♭';
  if (delta === -1) return '♭';
  if (delta === 1) return '♯';
  if (delta === 2) return '♯♯';
  return '';
}

/**
 * ルートの綴りを保ってコード構成音を返す（例: C# → C#, E#, G#）。
 * @param {string} symbol
 * @param {'abc'|'katakana'|'both'} style
 */
export function spellChordTones(symbol, style = 'abc') {
  const parsed = parseChordSymbol(symbol);
  const rootMatch = symbol.trim().match(/^([A-G])([#b]?)/);
  if (!rootMatch) return chordPcs(symbol).map((pc) => formatPc(pc, style));
  const rootIndex = LETTERS.indexOf(rootMatch[1]);
  const intervals = QUALITY_INTERVALS[parsed.quality];
  const degrees = QUALITY_DEGREES[parsed.quality] || intervals.map((_, i) => i * 2);

  return intervals.map((interval, i) => {
    const letter = LETTERS[(rootIndex + degrees[i]) % LETTERS.length];
    const targetPc = (parsed.rootPc + interval) % 12;
    let delta = (targetPc - NATURAL_PCS[letter] + 12) % 12;
    if (delta > 6) delta -= 12;
    const accidental = accidentalFor(delta);
    const abc = `${letter}${accidental}`;
    const kata = `${LETTER_KATAKANA[letter]}${accidental}`;
    if (style === 'katakana') return kata;
    if (style === 'both') return `${kata} (${abc})`;
    return abc;
  });
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
  if (quality.includes('7') && !quality.includes('maj') && quality !== 'mM7' && quality !== 'M7') r += '7';
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

/**
 * ダイアトニック＋借用の最小パレット（初期18進行の digForm を C/Am 例で組める集合）
 * @type {readonly string[]}
 */
export const DIG_PALETTE = Object.freeze([
  'C', 'CM7', 'C7', 'Dm', 'E', 'Em', 'E7', 'F', 'Fm', 'F7',
  'G', 'G7', 'Am', 'AmM7', 'Am7', 'Am6', 'A7',
]);

/**
 * 初期18進行DB（発掘形=digForm 4コード。フル形は図鑑用）
 * @typedef {{
 *   id: string,
 *   name: string,
 *   degrees: string,
 *   example: string,
 *   digForm: string[],
 *   fullForm?: string[],
 *   strictSlots?: boolean|boolean[],
 *   aliases?: string[],
 * }} Progression
 * @type {Progression[]}
 */
export const PROGRESSIONS = [
  {
    id: 'canon',
    name: 'カノン進行',
    degrees: 'I–V–vi–iii',
    example: 'C',
    digForm: ['C', 'G', 'Am', 'Em'],
    fullForm: ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G'],
    aliases: ['Canon', 'パヘルベル'],
  },
  {
    id: 'royal-road',
    name: '王道進行',
    degrees: 'IV–V–iii–vi',
    example: 'C',
    digForm: ['F', 'G', 'Em', 'Am'],
    aliases: ['4536'],
  },
  {
    id: 'komuro',
    name: '小室進行',
    degrees: 'vi–IV–V–I',
    example: 'Am',
    digForm: ['Am', 'F', 'G', 'C'],
  },
  {
    id: 'axis',
    name: 'Axis進行',
    degrees: 'I–V–vi–IV',
    example: 'C',
    digForm: ['C', 'G', 'Am', 'F'],
    aliases: ['Four Chords'],
  },
  {
    id: '6415',
    name: '6415進行',
    degrees: 'vi–IV–I–V',
    example: 'Am',
    digForm: ['Am', 'F', 'C', 'G'],
    aliases: ['Axis回転'],
  },
  {
    id: 'stand-by-me',
    name: 'スタンド・バイ・ミー進行',
    degrees: 'I–vi–IV–V',
    example: 'C',
    digForm: ['C', 'Am', 'F', 'G'],
    aliases: ['Doo-wop'],
  },
  {
    id: 'cycle',
    name: '循環',
    degrees: 'I–vi–ii–V',
    example: 'C',
    digForm: ['C', 'Am', 'Dm', 'G'],
    aliases: ['Turnaround'],
  },
  {
    id: '3625',
    name: 'サンロクニーゴー',
    degrees: 'iii–vi–ii–V',
    example: 'C',
    digForm: ['Em', 'Am', 'Dm', 'G'],
  },
  {
    id: 'reverse-cycle',
    name: '逆循環',
    degrees: 'ii–V–I–VI',
    example: 'C',
    digForm: ['Dm', 'G', 'C', 'A7'],
  },
  {
    id: 'marusa',
    name: '丸サ進行',
    degrees: 'IV–III7–vi–I7',
    example: 'C',
    digForm: ['F', 'E7', 'Am', 'C7'],
  },
  {
    id: '6251',
    name: '6251進行',
    degrees: 'vi–ii–V–I',
    example: 'Am',
    digForm: ['Am', 'Dm', 'G', 'C'],
  },
  {
    id: 'blues',
    name: 'ブルース進行',
    degrees: 'I7–IV7–I7–V7',
    example: 'C',
    digForm: ['C7', 'F7', 'C7', 'G7'],
    fullForm: ['C7', 'C7', 'C7', 'C7', 'F7', 'F7', 'C7', 'C7', 'G7', 'F7', 'C7', 'G7'],
  },
  {
    id: 'andalusian',
    name: 'アンダルシア進行',
    degrees: 'i–VII–VI–V',
    example: 'Am',
    digForm: ['Am', 'G', 'F', 'E'],
  },
  {
    id: 'major-cliche',
    name: 'メジャークリシェ',
    degrees: 'I–IM7–I7–IV',
    example: 'C',
    digForm: ['C', 'CM7', 'C7', 'F'],
    strictSlots: true,
  },
  {
    id: 'minor-cliche',
    name: 'マイナークリシェ',
    degrees: 'i–iM7–i7–i6',
    example: 'Am',
    digForm: ['Am', 'AmM7', 'Am7', 'Am6'],
    strictSlots: true,
  },
  {
    id: 'cadence',
    name: '基本カデンツ',
    degrees: 'I–IV–V–I',
    example: 'C',
    digForm: ['C', 'F', 'G', 'C'],
  },
  {
    id: 'creep',
    name: 'Creep進行',
    degrees: 'I–III–IV–iv',
    example: 'C',
    digForm: ['C', 'E', 'F', 'Fm'],
  },
  {
    id: 'sd-minor',
    name: 'サブドミナントマイナー終止',
    degrees: 'I–IV–iv–I',
    example: 'C',
    digForm: ['C', 'F', 'Fm', 'C'],
  },
];

/** @param {boolean|boolean[]|undefined} strictSlots @param {number} i */
function isStrictSlot(strictSlots, i) {
  if (strictSlots === true) return true;
  if (Array.isArray(strictSlots)) return Boolean(strictSlots[i]);
  return false;
}

/** @param {string} quality */
export function qualityClass(quality) {
  const cls = QUALITY_CLASS[quality];
  if (!cls) throw new Error(`No quality class for: ${quality}`);
  return cls;
}

/** @param {string} quality */
function qualityIntervalsKey(quality) {
  return QUALITY_INTERVALS[quality].join(',');
}

/**
 * 先頭ルートを0にした相対半音列＋クオリティ（互換=類 / strict=完全）
 * @param {string[]} chords
 * @param {{ strictSlots?: boolean|boolean[], mode?: 'compatible'|'exact' }} [opts]
 * @returns {{ rel: number, token: string }[]}
 */
export function toNormalForm(chords, opts = {}) {
  const mode = opts.mode || 'compatible';
  const parsed = chords.map((c) => parseChordSymbol(c));
  const base = parsed[0].rootPc;
  return parsed.map((p, i) => {
    const rel = (p.rootPc - base + 12) % 12;
    const strict = mode === 'exact' || isStrictSlot(opts.strictSlots, i);
    const token = strict
      ? `exact:${qualityIntervalsKey(p.quality)}`
      : `class:${qualityClass(p.quality)}`;
    return { rel, token };
  });
}

function normalFormKey(form) {
  return form.map((s) => `${s.rel}|${s.token}`).join(';');
}

/**
 * 入力進行を1件のDBエントリと照合
 * @returns {'exact'|'compatible'|null}
 */
function matchKindAgainst(inputChords, prog) {
  const target = prog.digForm;
  if (!inputChords || inputChords.length !== target.length) return null;

  const inputParsed = inputChords.map((c) => parseChordSymbol(c));
  const targetParsed = target.map((c) => parseChordSymbol(c));
  const inBase = inputParsed[0].rootPc;
  const tgBase = targetParsed[0].rootPc;

  let anyCompat = false;
  for (let i = 0; i < target.length; i++) {
    const inRel = (inputParsed[i].rootPc - inBase + 12) % 12;
    const tgRel = (targetParsed[i].rootPc - tgBase + 12) % 12;
    if (inRel !== tgRel) return null;

    const strict = isStrictSlot(prog.strictSlots, i);
    if (strict) {
      if (qualityIntervalsKey(inputParsed[i].quality) !== qualityIntervalsKey(targetParsed[i].quality)) {
        return null;
      }
    } else {
      const inCls = qualityClass(inputParsed[i].quality);
      const tgCls = qualityClass(targetParsed[i].quality);
      if (inCls !== tgCls) return null;
      const sameIntervals = qualityIntervalsKey(inputParsed[i].quality)
        === qualityIntervalsKey(targetParsed[i].quality);
      if (!sameIntervals) {
        // 三和音と7th系だけを互換扱いにする。6/add9 は過大ヒットになる。
        if (!SEVENTH_COMPATIBLE.has(inputParsed[i].quality)
          || !SEVENTH_COMPATIBLE.has(targetParsed[i].quality)) return null;
        anyCompat = true;
      }
    }
  }
  return anyCompat ? 'compatible' : 'exact';
}

/**
 * @param {string[]} chords
 * @returns {{ hit: boolean, id: string|null, name: string|null, kind: 'exact'|'compatible'|null }}
 */
export function matchProgression(chords) {
  if (!Array.isArray(chords) || chords.length === 0) {
    return { hit: false, id: null, name: null, kind: null };
  }
  for (const prog of PROGRESSIONS) {
    const kind = matchKindAgainst(chords, prog);
    if (kind) {
      return { hit: true, id: prog.id, name: prog.name, kind };
    }
  }
  return { hit: false, id: null, name: null, kind: null };
}

/**
 * 正規形の一意性（strict枠はexactトークン、他は互換類）。衝突があれば不合格。
 * @returns {{ ok: boolean, conflicts: { a: string, b: string, key: string }[] }}
 */
export function lintUniqueness() {
  const seen = new Map();
  const conflicts = [];
  const names = new Map();

  for (const prog of PROGRESSIONS) {
    const form = toNormalForm(prog.digForm, { strictSlots: prog.strictSlots });
    const key = normalFormKey(form);
    if (seen.has(key)) {
      conflicts.push({ a: seen.get(key), b: prog.id, key });
    } else {
      seen.set(key, prog.id);
    }
    if (names.has(prog.name)) {
      conflicts.push({ a: names.get(prog.name), b: prog.id, key: `name:${prog.name}` });
    } else {
      names.set(prog.name, prog.id);
    }
  }
  return { ok: conflicts.length === 0, conflicts };
}

/**
 * digForm（および fullForm）の全コードがパレット語彙に含まれるか
 * @param {string[]} [paletteChords]
 * @returns {{ ok: boolean, missing: { id: string, chord: string }[] }}
 */
export function lintReachability(paletteChords = DIG_PALETTE) {
  const set = new Set(paletteChords);
  const missing = [];
  for (const prog of PROGRESSIONS) {
    const chords = [...prog.digForm, ...(prog.fullForm || [])];
    for (const chord of chords) {
      if (!set.has(chord)) missing.push({ id: prog.id, chord });
    }
  }
  return { ok: missing.length === 0, missing };
}

/** @param {{ key?: string, example?: string, chords?: string[], digForm?: string[] }} prog */
export function progressionForKey(prog, key) {
  const fromKey = prog.example || prog.key;
  const source = prog.digForm || prog.chords || [];
  return {
    ...prog,
    key,
    chords: source.map((c) => transposeChord(c, fromKey, key)),
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
