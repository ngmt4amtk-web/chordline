import {
  chordFunction,
  chordLabel,
  chordMidis,
  chordPcs,
  progressionForKey,
  PROGRESSIONS,
  pcsMatch,
} from '../theory.js';
import { KEYS } from '../state.js';
import { createKeyboard } from './keyboard.js';

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

function fnLabel(fn) {
  const map = { tonic: 'T', subdominant: 'SD', dominant: 'D', borrowed: '外', other: '—' };
  return map[fn] || '—';
}

export function renderApp({ root, state, synth, engine, actions }) {
  root.innerHTML = '';
  const wrap = el('div', 'shell');
  root.appendChild(wrap);

  if (state.screen === 'home') {
    wrap.appendChild(renderHome(state, actions));
    return;
  }

  wrap.appendChild(renderTopBar(state, actions));

  if (state.screen === 'progression') {
    wrap.appendChild(renderProgression(state, synth, engine, actions));
  } else if (state.screen === 'chord') {
    wrap.appendChild(renderChord(state, synth, actions));
  } else if (state.screen === 'practice') {
    wrap.appendChild(renderPractice(state, synth, actions));
  } else if (state.screen === 'settings') {
    wrap.appendChild(renderSettings(state, actions));
  }
}

function renderTopBar(state, actions) {
  const bar = el('header', 'topbar');
  bar.innerHTML = `
    <button type="button" class="btn ghost back" data-action="home">←</button>
    <div class="topbar-title">${titleForScreen(state.screen)}</div>
    <button type="button" class="btn ghost" data-action="settings">設定</button>
  `;
  bar.querySelector('[data-action="home"]').onclick = () => actions.goHome();
  bar.querySelector('[data-action="settings"]').onclick = () => actions.openSettings();
  return bar;
}

function titleForScreen(screen) {
  return { progression: '進行', chord: 'コード', practice: '練習', settings: '設定' }[screen] || '';
}

function renderHome(state, actions) {
  const s = el('section', 'screen home');
  s.innerHTML = `
    <div class="brand">
      <div class="brand-mark">CHORDLINE</div>
      <p class="brand-tag">コードと進行を、見て・聴いて・弾く。</p>
    </div>
    <nav class="mode-list">
      <button type="button" class="mode-card" data-mode="progression">
        <span class="mode-name">進行</span>
        <span class="mode-desc">プリセット進行をタイムラインで聴く</span>
      </button>
      <button type="button" class="mode-card" data-mode="chord">
        <span class="mode-name">コード</span>
        <span class="mode-desc">記号と構成音の対応を確認</span>
      </button>
      <button type="button" class="mode-card" data-mode="practice">
        <span class="mode-name">練習</span>
        <span class="mode-desc">進行を1コードずつ鍵盤で入力</span>
      </button>
    </nav>
    <div class="home-meta">Key: ${state.key} · ${state.showRoman ? 'Roman ON' : 'Roman OFF'}</div>
  `;
  s.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.onclick = () => actions.openMode(btn.dataset.mode);
  });
  return s;
}

function renderProgression(state, synth, engine, actions) {
  const prog = PROGRESSIONS.find((p) => p.id === state.progressionId) || PROGRESSIONS[0];
  const p = progressionForKey(prog, state.key);
  const s = el('section', 'screen progression');
  const head = el('div', 'panel-head');
  head.innerHTML = `
    <h2 class="panel-title">${prog.name}</h2>
    <p class="panel-sub">${prog.subtitle}</p>
    <p class="panel-note">${prog.description}</p>
  `;
  s.appendChild(head);

  const picker = el('div', 'prog-picker');
  PROGRESSIONS.forEach((item) => {
    const b = el('button', `chip ${item.id === state.progressionId ? 'active' : ''}`, item.name);
    b.onclick = () => actions.setProgression(item.id);
    picker.appendChild(b);
  });
  s.appendChild(picker);

  const timeline = el('div', 'timeline');
  p.chords.forEach((ch, i) => {
    const fn = chordFunction(ch, state.key);
    const cell = el('button', `timeline-cell fn-${fn} ${state.playIndex === i ? 'active' : ''}`);
    cell.innerHTML = `
      <span class="cell-symbol">${ch}</span>
      ${state.showRoman ? `<span class="cell-roman">${chordLabel(ch, state.key).match(/\((.+)\)/)?.[1] || ''}</span>` : ''}
      <span class="cell-fn">${fnLabel(fn)}</span>
    `;
    cell.onclick = async () => {
      actions.setPlayIndex(i);
      await synth.playChord(chordMidis(ch));
    };
    timeline.appendChild(cell);
  });
  s.appendChild(timeline);

  const controls = el('div', 'transport');
  controls.innerHTML = `
    <button type="button" class="btn primary" data-play>${state.playing ? '停止' : '再生'}</button>
    <label class="tempo">Tempo <input type="range" min="40" max="120" value="${state.tempo}" data-tempo></label>
  `;
  const playBtn = controls.querySelector('[data-play]');
  playBtn.onclick = () => actions.togglePlay();
  controls.querySelector('[data-tempo]').oninput = (e) => actions.setTempo(Number(e.target.value));
  s.appendChild(controls);

  const kbHost = el('div', 'keyboard-host');
  s.appendChild(kbHost);
  const activeChord = p.chords[state.playIndex ?? 0];
  const kb = createKeyboard({
    container: kbHost,
    onNoteOn: ({ midi }) => synth.playMidi(midi, 0.4, state.volume * 0.4),
  });
  kb.setHighlight(chordPcs(activeChord));
  state._kb = kb;
  return s;
}

function renderChord(state, synth, actions) {
  const s = el('section', 'screen chord');
  const symbols = ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bm', 'Cmaj7', 'Dm7', 'G7', 'Am7', 'Fmaj7'];
  const sym = state.chordSymbol || 'C';
  const pcs = chordPcs(sym);
  const fn = chordFunction(sym, state.key);

  const display = el('div', 'chord-display');
  display.innerHTML = `
    <div class="chord-big">${sym}</div>
    <div class="chord-meta">${chordLabel(sym, state.key, state.showRoman)} · ${fnLabel(fn)}</div>
    <div class="chord-tones">${pcs.map((pc) => {
      const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      return names[pc];
    }).join(' · ')}</div>
  `;
  s.appendChild(display);

  const grid = el('div', 'chord-grid');
  symbols.forEach((c) => {
    const b = el('button', `chip ${c === sym ? 'active' : ''}`, c);
    b.onclick = async () => {
      actions.setChordSymbol(c);
      await synth.playChord(chordMidis(c));
    };
    grid.appendChild(b);
  });
  s.appendChild(grid);

  const playRow = el('div', 'transport');
  const pb = el('button', 'btn primary', '再生');
  pb.onclick = () => synth.playChord(chordMidis(sym));
  playRow.appendChild(pb);
  s.appendChild(playRow);

  const kbHost = el('div', 'keyboard-host');
  s.appendChild(kbHost);
  const kb = createKeyboard({
    container: kbHost,
    onNoteOn: ({ midi }) => synth.playMidi(midi, 0.4, state.volume * 0.4),
  });
  kb.setHighlight(pcs);
  state._kb = kb;
  return s;
}

function renderPractice(state, synth, actions) {
  const prog = PROGRESSIONS.find((p) => p.id === state.progressionId) || PROGRESSIONS[0];
  const p = progressionForKey(prog, state.key);
  const idx = state.practiceIndex % p.chords.length;
  const target = p.chords[idx];
  const targetPcs = chordPcs(target);
  const selected = state.practiceSelected || [];

  const s = el('section', 'screen practice');
  s.innerHTML = `
    <div class="practice-head">
      <span class="practice-prog">${prog.name}</span>
      <span class="practice-step">${idx + 1} / ${p.chords.length}</span>
    </div>
    <div class="practice-target">
      <div class="practice-label">このコードを押す</div>
      <div class="practice-symbol">${target}</div>
      ${state.showRoman ? `<div class="practice-roman">${chordLabel(target, state.key)}</div>` : ''}
    </div>
    <div class="practice-selected">選択: ${selected.length ? selected.map((pc) => ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][pc]).join(' ') : '—'}</div>
  `;

  const row = el('div', 'practice-actions');
  const check = el('button', 'btn primary', '判定');
  const clear = el('button', 'btn ghost', 'クリア');
  const hear = el('button', 'btn ghost', '聴く');
  check.onclick = () => actions.checkPractice();
  clear.onclick = () => actions.clearPractice();
  hear.onclick = () => synth.playChord(chordMidis(target));
  row.append(check, clear, hear);
  s.appendChild(row);

  const kbHost = el('div', 'keyboard-host');
  s.appendChild(kbHost);
  const kb = createKeyboard({
    container: kbHost,
    onNoteOn: ({ midi, pc }) => {
      synth.playMidi(midi, 0.35, state.volume * 0.35);
      actions.togglePracticePc(pc);
    },
  });
  const selPcs = [...new Set(selected)];
  kb.setHighlight([...new Set([...targetPcs, ...selPcs])]);
  selPcs.forEach((pc) => {
    // highlight selected differently via pressed state handled in main
  });
  state._kb = kb;
  return s;
}

function renderSettings(state, actions) {
  const s = el('section', 'screen settings');
  s.innerHTML = `
    <div class="settings-group">
      <label class="field">Key
        <select data-key>${KEYS.map((k) => `<option value="${k}" ${k === state.key ? 'selected' : ''}>${k}</option>`).join('')}</select>
      </label>
      <label class="field">Roman numerals
        <input type="checkbox" data-roman ${state.showRoman ? 'checked' : ''}>
      </label>
      <label class="field">Volume
        <input type="range" min="0.2" max="1" step="0.05" value="${state.volume}" data-vol>
      </label>
      <label class="field">Default progression
        <select data-prog>${PROGRESSIONS.map((p) => `<option value="${p.id}" ${p.id === state.progressionId ? 'selected' : ''}>${p.name}</option>`).join('')}</select>
      </label>
    </div>
    <button type="button" class="btn primary" data-back>戻る</button>
  `;
  s.querySelector('[data-key]').onchange = (e) => actions.setKey(e.target.value);
  s.querySelector('[data-roman]').onchange = (e) => actions.setShowRoman(e.target.checked);
  s.querySelector('[data-vol]').oninput = (e) => actions.setVolume(Number(e.target.value));
  s.querySelector('[data-prog]').onchange = (e) => actions.setProgression(e.target.value);
  s.querySelector('[data-back]').onclick = () => actions.goBack();
  return s;
}

export { pcsMatch, chordPcs };
