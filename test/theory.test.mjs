import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChordSymbol,
  chordPcs,
  chordMidis,
  transposeChord,
  progressionForKey,
  romanNumeral,
  pcsMatch,
  chordFunction,
  PROGRESSIONS,
  DIG_PALETTE,
  matchProgression,
  toNormalForm,
  qualityClass,
  lintUniqueness,
  lintReachability,
} from '../js/theory.js';

test('parseChordSymbol basics', () => {
  assert.equal(parseChordSymbol('C').rootPc, 0);
  assert.equal(parseChordSymbol('Am').quality, 'm');
  assert.equal(parseChordSymbol('G7').quality, '7');
  assert.equal(parseChordSymbol('F/C').bassPc, 0);
  assert.equal(parseChordSymbol('CM7').quality, 'M7');
  assert.equal(parseChordSymbol('AmM7').quality, 'mM7');
  assert.equal(parseChordSymbol('Am6').quality, 'm6');
});

test('chordPcs C major', () => {
  assert.deepEqual(chordPcs('C'), [0, 4, 7]);
});

test('chordPcs Am', () => {
  assert.deepEqual(chordPcs('Am'), [9, 0, 4]);
});

test('chordPcs AmM7', () => {
  assert.deepEqual(chordPcs('AmM7'), [9, 0, 4, 8]);
});

test('transpose C to G', () => {
  assert.equal(transposeChord('C', 'C', 'G'), 'G');
  assert.equal(transposeChord('Am', 'C', 'G'), 'Em');
});

test('progressionForKey digForm', () => {
  const p = progressionForKey({ example: 'C', digForm: ['C', 'G', 'Am', 'F'] }, 'G');
  assert.deepEqual(p.chords, ['G', 'D', 'Em', 'C']);
});

test('progressionForKey legacy chords+key', () => {
  const p = progressionForKey({ key: 'C', chords: ['C', 'G', 'Am', 'F'] }, 'G');
  assert.deepEqual(p.chords, ['G', 'D', 'Em', 'C']);
});

test('romanNumeral axis in C', () => {
  assert.equal(romanNumeral('C', 'C'), 'I');
  assert.equal(romanNumeral('Am', 'C'), 'vi');
  assert.equal(romanNumeral('F', 'C'), 'IV');
});

test('pcsMatch', () => {
  assert.equal(pcsMatch([0, 4, 7], [0, 4, 7]), true);
  assert.equal(pcsMatch([0, 4], [0, 4, 7]), false);
  assert.equal(pcsMatch([7, 11, 2], [2, 7, 11]), true);
});

test('chordFunction', () => {
  assert.equal(chordFunction('C', 'C'), 'tonic');
  assert.equal(chordFunction('G', 'C'), 'dominant');
  assert.equal(chordFunction('F', 'C'), 'subdominant');
});

test('formatPc katakana', async () => {
  const { formatPc } = await import('../js/theory.js');
  assert.equal(formatPc(0, 'katakana'), 'ド');
  assert.equal(formatPc(4, 'katakana'), 'ミ');
  assert.equal(formatPc(0, 'both'), 'ド (C)');
});

test('qualityClass reduces 7ths to triad class', () => {
  assert.equal(qualityClass(''), 'major');
  assert.equal(qualityClass('7'), 'major');
  assert.equal(qualityClass('M7'), 'major');
  assert.equal(qualityClass('m'), 'minor');
  assert.equal(qualityClass('m7'), 'minor');
  assert.equal(qualityClass('mM7'), 'minor');
  assert.equal(qualityClass('m6'), 'minor');
});

test('PROGRESSIONS is 18 and matches design names/degrees', () => {
  assert.equal(PROGRESSIONS.length, 18);
  const expected = [
    ['canon', 'カノン進行', 'I–V–vi–iii', ['C', 'G', 'Am', 'Em']],
    ['royal-road', '王道進行', 'IV–V–iii–vi', ['F', 'G', 'Em', 'Am']],
    ['komuro', '小室進行', 'vi–IV–V–I', ['Am', 'F', 'G', 'C']],
    ['axis', 'Axis進行', 'I–V–vi–IV', ['C', 'G', 'Am', 'F']],
    ['6415', '6415進行', 'vi–IV–I–V', ['Am', 'F', 'C', 'G']],
    ['stand-by-me', 'スタンド・バイ・ミー進行', 'I–vi–IV–V', ['C', 'Am', 'F', 'G']],
    ['cycle', '循環', 'I–vi–ii–V', ['C', 'Am', 'Dm', 'G']],
    ['3625', 'サンロクニーゴー', 'iii–vi–ii–V', ['Em', 'Am', 'Dm', 'G']],
    ['reverse-cycle', '逆循環', 'ii–V–I–VI', ['Dm', 'G', 'C', 'A7']],
    ['marusa', '丸サ進行', 'IV–III7–vi–I7', ['F', 'E7', 'Am', 'C7']],
    ['6251', '6251進行', 'vi–ii–V–I', ['Am', 'Dm', 'G', 'C']],
    ['blues', 'ブルース進行', 'I7–IV7–I7–V7', ['C7', 'F7', 'C7', 'G7']],
    ['andalusian', 'アンダルシア進行', 'i–VII–VI–V', ['Am', 'G', 'F', 'E']],
    ['major-cliche', 'メジャークリシェ', 'I–IM7–I7–IV', ['C', 'CM7', 'C7', 'F']],
    ['minor-cliche', 'マイナークリシェ', 'i–iM7–i7–i6', ['Am', 'AmM7', 'Am7', 'Am6']],
    ['cadence', '基本カデンツ', 'I–IV–V–I', ['C', 'F', 'G', 'C']],
    ['creep', 'Creep進行', 'I–III–IV–iv', ['C', 'E', 'F', 'Fm']],
    ['sd-minor', 'サブドミナントマイナー終止', 'I–IV–iv–I', ['C', 'F', 'Fm', 'C']],
  ];
  for (let i = 0; i < expected.length; i++) {
    const [id, name, degrees, dig] = expected[i];
    const p = PROGRESSIONS[i];
    assert.equal(p.id, id, `row ${i} id`);
    assert.equal(p.name, name, `row ${i} name`);
    assert.equal(p.degrees, degrees, `row ${i} degrees`);
    assert.deepEqual(p.digForm, dig, `row ${i} digForm`);
    assert.equal(p.digForm.length, 4, `row ${i} dig length`);
  }
  // 旧不整合: royal-road は王道であり小室ではない
  const royal = PROGRESSIONS.find((p) => p.id === 'royal-road');
  assert.equal(royal.name, '王道進行');
  assert.deepEqual(royal.digForm, ['F', 'G', 'Em', 'Am']);
  const komuro = PROGRESSIONS.find((p) => p.id === 'komuro');
  assert.equal(komuro.name, '小室進行');
  assert.ok(PROGRESSIONS.find((p) => p.id === 'canon')?.fullForm?.length > 4);
  assert.ok(PROGRESSIONS.find((p) => p.id === 'blues')?.fullForm?.length > 4);
  assert.equal(PROGRESSIONS.find((p) => p.id === 'major-cliche')?.strictSlots, true);
  assert.equal(PROGRESSIONS.find((p) => p.id === 'minor-cliche')?.strictSlots, true);
});

test('王道ヒット・Axis取り違えなし', () => {
  const royal = matchProgression(['F', 'G', 'Em', 'Am']);
  assert.equal(royal.hit, true);
  assert.equal(royal.id, 'royal-road');
  assert.equal(royal.name, '王道進行');
  assert.equal(royal.kind, 'exact');

  const axis = matchProgression(['C', 'G', 'Am', 'F']);
  assert.equal(axis.hit, true);
  assert.equal(axis.id, 'axis');
  assert.equal(axis.name, 'Axis進行');
  assert.notEqual(axis.id, 'royal-road');

  // Axisを組んで王道にならない
  assert.notEqual(matchProgression(['C', 'G', 'Am', 'F']).id, 'royal-road');
  // 王道を組んでAxisにならない
  assert.notEqual(matchProgression(['F', 'G', 'Em', 'Am']).id, 'axis');
});

test('移調同値', () => {
  // 王道を G キー相当: C–D–Bm–Em
  const t = matchProgression(['C', 'D', 'Bm', 'Em']);
  assert.equal(t.hit, true);
  assert.equal(t.id, 'royal-road');

  // Axis を D: D–A–Bm–G
  const a = matchProgression(['D', 'A', 'Bm', 'G']);
  assert.equal(a.hit, true);
  assert.equal(a.id, 'axis');
});

test('7th互換／クリシェstrict', () => {
  // 王道 7th 形でもヒット（互換）
  const royal7 = matchProgression(['Fmaj7', 'G7', 'Em7', 'Am7']);
  assert.equal(royal7.hit, true);
  assert.equal(royal7.id, 'royal-road');
  assert.equal(royal7.kind, 'compatible');

  // メジャークリシェ exact
  const cliche = matchProgression(['C', 'CM7', 'C7', 'F']);
  assert.equal(cliche.hit, true);
  assert.equal(cliche.id, 'major-cliche');
  assert.equal(cliche.kind, 'exact');

  // C–C–C–F はクリシェ非ヒット（strict）
  const miss = matchProgression(['C', 'C', 'C', 'F']);
  assert.equal(miss.hit, false);
  assert.equal(miss.kind, null);

  // マイナークリシェ: トライアド潰しは非ヒット
  assert.equal(matchProgression(['Am', 'Am', 'Am', 'Am']).hit, false);
  assert.equal(matchProgression(['Am', 'AmM7', 'Am7', 'Am6']).id, 'minor-cliche');
});

test('各 digForm が自身に exact ヒット', () => {
  for (const prog of PROGRESSIONS) {
    const r = matchProgression(prog.digForm);
    assert.equal(r.hit, true, prog.id);
    assert.equal(r.id, prog.id, prog.id);
    assert.equal(r.kind, 'exact', prog.id);
  }
});

test('toNormalForm 移調不変', () => {
  const a = toNormalForm(['F', 'G', 'Em', 'Am']);
  const b = toNormalForm(['C', 'D', 'Bm', 'Em']);
  assert.deepEqual(a, b);
});

test('lintUniqueness 通過', () => {
  const r = lintUniqueness();
  assert.equal(r.ok, true, JSON.stringify(r.conflicts));
  assert.equal(r.conflicts.length, 0);
});

test('lintReachability 通過', () => {
  const r = lintReachability(DIG_PALETTE);
  assert.equal(r.ok, true, JSON.stringify(r.missing));
  assert.equal(r.missing.length, 0);
});

test('chordMidis still works for extended quals', () => {
  assert.ok(chordMidis('CM7').length >= 4);
  assert.ok(chordMidis('AmM7').length >= 4);
  assert.ok(chordMidis('Am6').length >= 4);
});

test('1差ミスは非ヒット', () => {
  // 王道の最後だけ違う
  assert.equal(matchProgression(['F', 'G', 'Em', 'Dm']).hit, false);
  // Axisの最後が王道寄り
  assert.equal(matchProgression(['C', 'G', 'Am', 'Em']).id, 'canon');
});
