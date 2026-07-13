import {
  chordLabel,
  chordMidis,
  chordPcs,
  formatPc,
  DIG_PALETTE,
  PROGRESSIONS,
  pcsMatch,
} from '../theory.js';
import { KEYS, discoveredCount, isDiscovered } from '../state.js';
import { createKeyboard } from './keyboard.js';

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

function noteStyleLabel(style) {
  return { abc: 'ABC', katakana: 'カタカナ', both: 'カタカナ+ABC' }[style] || style;
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

  if (state.screen === 'dig') {
    wrap.appendChild(renderDig(state, synth, actions));
  } else if (state.screen === 'dex') {
    wrap.appendChild(renderDex(state, actions));
  } else if (state.screen === 'dex-detail') {
    wrap.appendChild(renderDexDetail(state, actions));
  } else if (state.screen === 'chunk') {
    wrap.appendChild(renderChunk(state, synth, actions));
  } else if (state.screen === 'settings') {
    wrap.appendChild(renderSettings(state, actions));
  } else if (state.screen === 'my-lines') {
    wrap.appendChild(renderMyLines(state, actions));
  }

  if (state.plaque) {
    wrap.appendChild(renderPlaque(state.plaque));
  }
}

function renderTopBar(state, actions) {
  const bar = el('header', 'topbar');
  const settingsHidden = state.screen === 'settings';
  bar.innerHTML = `
    <button type="button" class="btn ghost back" data-action="home">←</button>
    <div class="topbar-title">${titleForScreen(state.screen)}</div>
    ${settingsHidden ? '<span></span>' : '<button type="button" class="btn ghost" data-action="settings">設定</button>'}
  `;
  bar.querySelector('[data-action="home"]').onclick = () => {
    if (state.screen === 'dex-detail') actions.openScreen('dex');
    else actions.goHome();
  };
  const settingsBtn = bar.querySelector('[data-action="settings"]');
  if (settingsBtn) settingsBtn.onclick = () => actions.openSettings();
  return bar;
}

function titleForScreen(screen) {
  return {
    dig: '発掘',
    dex: '図鑑',
    'dex-detail': '図鑑',
    chunk: '構成音',
    settings: '設定',
    'my-lines': 'マイライン',
  }[screen] || '';
}

function renderHome(state, actions) {
  const n = discoveredCount(state);
  const s = el('section', 'screen home');
  s.innerHTML = `
    <div class="brand">
      <div class="brand-mark">CHORDLINE</div>
      <p class="brand-tag">4つ並べて聴く。当たれば、名が刻まれる。</p>
    </div>
    <nav class="mode-list">
      <button type="button" class="mode-card mode-primary" data-screen="dig">
        <span class="mode-name">発掘</span>
        <span class="mode-desc">コードを選んで連続再生。有名進行を掘り当てる</span>
      </button>
      <button type="button" class="mode-card" data-screen="dex">
        <span class="mode-name">図鑑</span>
        <span class="mode-desc">発見 ${n} / 18</span>
      </button>
      <button type="button" class="mode-card" data-screen="chunk">
        <span class="mode-name">構成音</span>
        <span class="mode-desc">発掘済みコードの構成音を1分で確認</span>
      </button>
      <button type="button" class="mode-card" data-screen="settings">
        <span class="mode-name">設定</span>
        <span class="mode-desc">キー・音名・テンポ・音量</span>
      </button>
    </nav>
    <div class="home-meta">${noteStyleLabel(state.noteStyle)} · Tempo ${state.tempo}
      ${state.myLines?.length ? ` · マイライン ${state.myLines.length}` : ''}
    </div>
    ${state.myLines?.length ? '<button type="button" class="btn ghost home-lines" data-screen="my-lines">マイラインを見る</button>' : ''}
  `;
  s.querySelectorAll('[data-screen]').forEach((btn) => {
    btn.onclick = () => actions.openScreen(btn.dataset.screen);
  });
  return s;
}

function renderDig(state, synth, actions) {
  const slots = state.slots || [null, null, null, null];
  const active = state.activeSlot ?? 0;
  const phase = state.digPhase || 'edit'; // edit | rated
  const filled = slots.every(Boolean);
  const s = el('section', 'screen dig');

  const slotsRow = el('div', 'dig-slots');
  slots.forEach((ch, i) => {
    const cell = el('button', `dig-slot ${i === active ? 'active' : ''} ${ch ? 'filled' : ''} ${state.playIndex === i ? 'playing' : ''}`);
    cell.type = 'button';
    cell.innerHTML = ch
      ? `<span class="slot-sym">${ch}</span>`
      : `<span class="slot-empty">${i + 1}</span>`;
    cell.onclick = () => actions.selectSlot(i);
    cell.ondblclick = () => actions.clearSlot(i);
    slotsRow.appendChild(cell);
  });
  s.appendChild(slotsRow);

  const hint = el('p', 'dig-hint', 'パレットから選ぶ。スロット再タップで消去。');
  s.appendChild(hint);

  const palette = el('div', 'dig-palette');
  DIG_PALETTE.forEach((sym) => {
    const b = el('button', 'chip', sym);
    b.type = 'button';
    b.onclick = () => actions.placeChord(sym);
    palette.appendChild(b);
  });
  s.appendChild(palette);

  const transport = el('div', 'transport dig-transport');
  const playLabel = state.playing ? '停止' : '再生';
  transport.innerHTML = `
    <button type="button" class="btn primary" data-play ${filled ? '' : 'disabled'}>${playLabel}</button>
    <label class="tempo">Tempo <input type="range" min="40" max="120" value="${state.tempo}" data-tempo></label>
  `;
  const playBtn = transport.querySelector('[data-play]');
  playBtn.disabled = !filled && !state.playing;
  playBtn.onclick = () => actions.toggleDigPlay();
  transport.querySelector('[data-tempo]').oninput = (e) => actions.setTempo(Number(e.target.value));
  s.appendChild(transport);

  if (phase === 'rated' && filled && !state.playing) {
    const rate = el('div', 'dig-rate');
    rate.innerHTML = `
      <p class="dig-rate-label">聴いた感触は</p>
      <div class="dig-rate-row">
        <button type="button" class="btn" data-rate="meh">微妙</button>
        <button type="button" class="btn primary" data-rate="good">良い</button>
      </div>
    `;
    rate.querySelector('[data-rate="meh"]').onclick = () => actions.rateMeh();
    rate.querySelector('[data-rate="good"]').onclick = () => actions.rateGood();
    s.appendChild(rate);
  }

  if (state.digNotice) {
    const notice = el('p', 'dig-notice', state.digNotice);
    s.appendChild(notice);
  }

  return s;
}

function renderPlaque(plaque) {
  const phase = plaque.phase || 'still';
  const overlay = el('div', `plaque-overlay phase-${phase}`);
  overlay.innerHTML = `
    <div class="plaque-card">
      <div class="plaque-light" aria-hidden="true"></div>
      <p class="plaque-kicker">発掘</p>
      <h2 class="plaque-name">${escapeHtml(plaque.name || '')}</h2>
      <p class="plaque-degrees">${escapeHtml(plaque.degrees || '')}</p>
    </div>
  `;
  return overlay;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderDex(state, actions) {
  const n = discoveredCount(state);
  const s = el('section', 'screen dex');
  const head = el('div', 'panel-head');
  head.innerHTML = `
    <h2 class="panel-title">図鑑</h2>
    <p class="panel-note">発見 ${n} / 18。未発見はシルエット（手がかりのみ）。</p>
  `;
  s.appendChild(head);

  const list = el('div', 'dex-list');
  PROGRESSIONS.forEach((prog) => {
    const found = isDiscovered(state, prog.id);
    const row = el('button', `dex-row ${found ? 'found' : 'silhouette'}`);
    row.type = 'button';
    if (found) {
      row.innerHTML = `
        <span class="dex-name">${prog.name}</span>
        <span class="dex-deg">${prog.degrees}</span>
      `;
      row.onclick = () => actions.openDexDetail(prog.id);
    } else {
      row.innerHTML = `
        <span class="dex-name muted">未発見</span>
        <span class="dex-hint">${escapeHtml(silhouetteHint(prog.degrees))}</span>
      `;
      row.disabled = true;
    }
    list.appendChild(row);
  });
  s.appendChild(list);
  return s;
}

/** 度数の一部だけ見せる（先頭のみ実体、残りは骨格） */
function silhouetteHint(degrees) {
  const parts = String(degrees || '')
    .split(/[–—−-]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return '· – · – · – ·';
  if (parts.length === 1) return `${parts[0]} – ···`;
  const skeleton = parts.map((p, i) => (i === 0 ? p : '·')).join(' – ');
  return skeleton;
}

function renderDexDetail(state, actions) {
  const prog = PROGRESSIONS.find((p) => p.id === state.dexId) || PROGRESSIONS[0];
  const s = el('section', 'screen dex-detail');
  const aliases = (prog.aliases || []).join(' · ');
  s.innerHTML = `
    <div class="panel-head">
      <h2 class="panel-title">${prog.name}</h2>
      <p class="panel-sub">${prog.degrees}</p>
      ${aliases ? `<p class="panel-note">${aliases}</p>` : ''}
    </div>
    <div class="dex-specimen">
      <p class="dex-label">発掘形</p>
      <div class="dex-chords">${prog.digForm.map((c) => `<span class="chip static">${c}</span>`).join('')}</div>
    </div>
    ${prog.fullForm ? `
      <div class="dex-specimen">
        <p class="dex-label">フル形</p>
        <div class="dex-chords">${prog.fullForm.map((c) => `<span class="chip static">${c}</span>`).join('')}</div>
      </div>
    ` : ''}
    <div class="transport dex-actions">
      <button type="button" class="btn primary" data-play-dig>発掘形を再生</button>
      ${prog.fullForm ? '<button type="button" class="btn" data-play-full>フル形を再生</button>' : ''}
      <button type="button" class="btn" data-redig>この進行で再発掘</button>
    </div>
  `;
  s.querySelector('[data-play-dig]').onclick = () => actions.playChordList(prog.digForm);
  const fullBtn = s.querySelector('[data-play-full]');
  if (fullBtn) fullBtn.onclick = () => actions.playChordList(prog.fullForm);
  s.querySelector('[data-redig]').onclick = () => actions.redigFrom(prog.id);
  return s;
}

function renderChunk(state, synth, actions) {
  const unlocked = state.unlockedChords || [];
  const s = el('section', 'screen chunk');

  if (unlocked.length === 0) {
    s.innerHTML = `
      <div class="panel-head">
        <h2 class="panel-title">構成音</h2>
        <p class="panel-note">まだ解放されたコードがない。発掘で進行を当てると、そのコードがここで使える。</p>
      </div>
      <button type="button" class="btn primary" data-to-dig>発掘へ</button>
    `;
    s.querySelector('[data-to-dig]').onclick = () => actions.openScreen('dig');
    return s;
  }

  if (state.chunkResult) {
    const r = state.chunkResult;
    s.innerHTML = `
      <div class="panel-head">
        <h2 class="panel-title">構成音 · 結果</h2>
        <p class="chunk-result-score">正解 ${r.score}</p>
        <p class="panel-note chunk-result-line">${escapeHtml(r.line || '')}</p>
      </div>
      <div class="practice-actions">
        <button type="button" class="btn primary" data-again>もう一度</button>
        <button type="button" class="btn ghost" data-dismiss>閉じる</button>
      </div>
    `;
    s.querySelector('[data-again]').onclick = () => actions.startChunk();
    s.querySelector('[data-dismiss]').onclick = () => actions.dismissChunkResult();
    return s;
  }

  if (!state.chunkActive) {
    s.innerHTML = `
      <div class="panel-head">
        <h2 class="panel-title">構成音</h2>
        <p class="panel-note">60秒。発掘済みコードの構成音を鍵盤で押す。語彙 ${unlocked.length} 種。</p>
      </div>
      <button type="button" class="btn primary" data-start>開始</button>
    `;
    s.querySelector('[data-start]').onclick = () => actions.startChunk();
    return s;
  }

  const target = state.chunkTarget;
  const selected = state.chunkSelected || [];
  const style = state.noteStyle || 'both';
  const remain = Math.max(0, state.chunkRemain ?? 60);

  const head = el('div', 'chunk-head');
  head.innerHTML = `
    <span class="chunk-timer">${remain}s</span>
    <span class="chunk-score">正解 ${state.chunkScore || 0}</span>
  `;
  s.appendChild(head);

  const targetBox = el('div', 'practice-target');
  targetBox.innerHTML = `
    <div class="practice-label">このコードの構成音</div>
    <div class="practice-symbol">${target || '—'}</div>
    ${state.showRoman && target ? `<div class="practice-roman">${chordLabel(target, state.key)}</div>` : ''}
    <div class="practice-selected">選択: ${selected.length ? selected.map((pc) => formatPc(pc, style)).join(' ') : '—'}</div>
  `;
  s.appendChild(targetBox);

  const row = el('div', 'practice-actions');
  const check = el('button', 'btn primary', '判定');
  const clear = el('button', 'btn ghost', 'クリア');
  const hear = el('button', 'btn ghost', '聴く');
  if (state._chunkChecking) {
    check.disabled = true;
    clear.disabled = true;
  }
  check.onclick = () => actions.checkChunk();
  clear.onclick = () => actions.clearChunkSelect();
  hear.onclick = () => target && synth.playChord(chordMidis(target));
  row.append(check, clear, hear);
  s.appendChild(row);

  const kbHost = el('div', 'keyboard-host');
  s.appendChild(kbHost);
  const kb = createKeyboard({
    container: kbHost,
    noteStyle: style === 'abc' ? 'abc' : 'katakana',
    onNoteOn: ({ midi, pc }) => {
      synth.playMidi(midi, 0.35, state.volume * 0.35);
      actions.toggleChunkPc(pc);
    },
  });
  kb.setHighlight([...new Set([...(state.chunkSelected || [])])]);
  state._kb = kb;
  return s;
}

function renderMyLines(state, actions) {
  const s = el('section', 'screen my-lines');
  s.innerHTML = `<div class="panel-head"><h2 class="panel-title">マイライン</h2><p class="panel-note">「良い」だが図鑑未登録の並び。</p></div>`;
  const list = el('div', 'dex-list');
  (state.myLines || []).forEach((line) => {
    const row = el('div', 'myline-row');
    const play = el('button', 'dex-row found myline-play');
    play.type = 'button';
    play.innerHTML = `<span class="dex-name">${line.chords.join(' – ')}</span>`;
    play.onclick = () => actions.playChordList(line.chords);
    const load = el('button', 'btn ghost myline-load', 'この並びを発掘に戻す');
    load.type = 'button';
    load.onclick = () => actions.loadMyLineToDig(line.chords);
    row.append(play, load);
    list.appendChild(row);
  });
  if (!(state.myLines || []).length) {
    list.appendChild(el('p', 'panel-note', 'まだない。'));
  }
  s.appendChild(list);
  return s;
}

function renderSettings(state, actions) {
  const s = el('section', 'screen settings');
  const noteStyle = state.noteStyle || 'both';
  s.innerHTML = `
    <div class="settings-group">
      <label class="field">Key（ローマ数字の基準）
        <select data-key>${KEYS.map((k) => `<option value="${k}" ${k === state.key ? 'selected' : ''}>${k}</option>`).join('')}</select>
      </label>
      <label class="field">音名表記
        <select data-note-style>
          <option value="katakana" ${noteStyle === 'katakana' ? 'selected' : ''}>カタカナ（ド レ ミ）</option>
          <option value="both" ${noteStyle === 'both' ? 'selected' : ''}>カタカナ + ABC</option>
          <option value="abc" ${noteStyle === 'abc' ? 'selected' : ''}>ABC のみ</option>
        </select>
      </label>
      <label class="field">Roman numerals
        <input type="checkbox" data-roman ${state.showRoman ? 'checked' : ''}>
      </label>
      <label class="field">Tempo
        <input type="range" min="40" max="120" value="${state.tempo}" data-tempo>
      </label>
      <label class="field">Volume
        <input type="range" min="0.2" max="1" step="0.05" value="${state.volume}" data-vol>
      </label>
    </div>
    <button type="button" class="btn primary" data-back>戻る</button>
  `;
  s.querySelector('[data-key]').onchange = (e) => actions.setKey(e.target.value);
  s.querySelector('[data-note-style]').onchange = (e) => actions.setNoteStyle(e.target.value);
  s.querySelector('[data-roman]').onchange = (e) => actions.setShowRoman(e.target.checked);
  s.querySelector('[data-tempo]').oninput = (e) => actions.setTempo(Number(e.target.value));
  s.querySelector('[data-vol]').oninput = (e) => actions.setVolume(Number(e.target.value));
  s.querySelector('[data-back]').onclick = () => actions.goHome();
  return s;
}

export { pcsMatch, chordPcs };
