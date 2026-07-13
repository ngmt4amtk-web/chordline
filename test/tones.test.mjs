import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TONE_POOL,
  buildToneSession,
  finishToneSession,
  recordToneAttempt,
  silentCoverage,
  summarizeToneResults,
  toneHint,
} from '../js/tones.js';

test('96コードを全開放する', () => {
  assert.equal(TONE_POOL.length, 96);
  assert.equal(new Set(TONE_POOL).size, 96);
});

test('8問は重複せず発掘状態を必要としない', () => {
  const queue = buildToneSession({ random: () => 0.25 });
  assert.equal(queue.length, 8);
  assert.equal(new Set(queue).size, 8);
});

test('誤答セルと期限セルを次セッションの弱点枠に含める', () => {
  const now = 1_000_000;
  const cells = {
    C: { attempts: 1, misses: 1, silentHits: 0, hintedHits: 0, dueAt: now + 1000 },
    Dm: { attempts: 1, misses: 0, silentHits: 1, hintedHits: 0, dueAt: now - 1 },
  };
  const queue = buildToneSession({ cells, now, random: () => 0.1 });
  assert.ok(queue.includes('C'));
  assert.ok(queue.includes('Dm'));
});

test('無音正解・ヒント正解・誤答を分離して記録する', () => {
  let state = { cells: {}, sessions: 0 };
  state = recordToneAttempt(state, { symbol: 'C', correct: true, hintLevel: 0, now: 100 });
  state = recordToneAttempt(state, { symbol: 'Dm', correct: true, hintLevel: 2, now: 200 });
  state = recordToneAttempt(state, { symbol: 'G7', correct: false, hintLevel: 0, now: 300 });
  assert.equal(state.cells.C.silentHits, 1);
  assert.equal(state.cells.Dm.silentHits, 0);
  assert.equal(state.cells.Dm.hintedHits, 1);
  assert.equal(state.cells.G7.misses, 1);
  assert.equal(silentCoverage(state), 1);
});

test('8問サマリーを保存する', () => {
  const results = [
    { correct: true, hintLevel: 0 },
    { correct: true, hintLevel: 1 },
    { correct: false, hintLevel: 0 },
  ];
  assert.deepEqual(summarizeToneResults(results), { silent: 1, hinted: 1, misses: 1, total: 3 });
  const done = finishToneSession({ cells: {}, sessions: 0 }, results, 1234);
  assert.equal(done.sessions, 1);
  assert.equal(done.lastSession.at, 1234);
});

test('ヒントは型・度数・1音の三段階', () => {
  assert.match(toneHint('C', 1), /メジャー/);
  assert.match(toneHint('C', 2), /1・3・5/);
  assert.match(toneHint('C', 3, 'abc'), /E/);
});
