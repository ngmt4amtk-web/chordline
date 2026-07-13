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
} from '../js/theory.js';

test('parseChordSymbol basics', () => {
  assert.equal(parseChordSymbol('C').rootPc, 0);
  assert.equal(parseChordSymbol('Am').quality, 'm');
  assert.equal(parseChordSymbol('G7').quality, '7');
  assert.equal(parseChordSymbol('F/C').bassPc, 0);
});

test('chordPcs C major', () => {
  assert.deepEqual(chordPcs('C'), [0, 4, 7]);
});

test('chordPcs Am', () => {
  assert.deepEqual(chordPcs('Am'), [9, 0, 4]);
});

test('transpose C to G', () => {
  assert.equal(transposeChord('C', 'C', 'G'), 'G');
  assert.equal(transposeChord('Am', 'C', 'G'), 'Em');
});

test('progressionForKey', () => {
  const p = progressionForKey({ key: 'C', chords: ['C', 'G', 'Am', 'F'] }, 'G');
  assert.deepEqual(p.chords, ['G', 'D', 'Bm', 'C']);
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

test('chordMidis returns sorted midis', () => {
  const m = chordMidis('C');
  assert.ok(m.length >= 3);
  assert.ok(m[0] < m[m.length - 1]);
});
