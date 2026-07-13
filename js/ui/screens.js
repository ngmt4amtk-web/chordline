import {
  DIG_PALETTE,
  PROGRESSIONS,
  chordPcs,
  formatPc,
  pcsMatch,
  romanNumeral,
  spellChordTones,
} from '../theory.js';
import { KEYS, discoveredCount, isDiscovered } from '../state.js';
import {
  TONE_POOL,
  displayChordSymbol,
  silentCoverage,
  summarizeToneResults,
  toneHint,
} from '../tones.js';
import { createKeyboard } from './keyboard.js';

function el(tag, cls, html) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function prettySymbol(symbol) {
  return escapeHtml(displayChordSymbol(symbol || ''));
}

function noteStyleLabel(style) {
  return { abc: 'ABC', katakana: 'カタカナ', both: 'カタカナ＋ABC' }[style] || style;
}

export function renderApp({ root, state, actions }) {
  root.innerHTML = '';
  state._tonesView = null;
  const shell = el('div', `app-shell mode-${state.mode}`);
  shell.appendChild(renderHeader(state, actions));
  shell.appendChild(state.mode === 'tones' ? renderTones(state, actions) : renderDig(state, actions));
  if (state.settingsOpen) shell.appendChild(renderSettings(state, actions));
  if (state.plaque) shell.appendChild(renderPlaque(state, actions));
  root.appendChild(shell);
}

function renderHeader(state, actions) {
  const header = el('header', 'app-header');
  header.innerHTML = `
    <div class="brand-row">
      <div>
        <div class="brand-mark">CHORDLINE</div>
        <div class="brand-sub">CHORD PROGRESSION LAB</div>
      </div>
      <button type="button" class="icon-button settings-button" data-settings aria-label="設定">設定</button>
    </div>
    <nav class="mode-switch" aria-label="モード">
      <button type="button" data-mode="dig" aria-pressed="${state.mode === 'dig'}">発掘</button>
      <button type="button" data-mode="tones" aria-pressed="${state.mode === 'tones'}">構成音</button>
    </nav>
  `;
  header.querySelectorAll('[data-mode]').forEach((button) => {
    button.onclick = () => actions.switchMode(button.dataset.mode);
  });
  header.querySelector('[data-settings]').onclick = () => actions.openSettings();
  return header;
}

function renderDig(state, actions) {
  const slots = state.slots || [null, null, null, null];
  const filled = slots.every(Boolean);
  const canRate = filled && state.hasListened && !state.playing && !state.digRated;
  const screen = el('main', 'screen dig-screen');
  screen.innerHTML = `
    <section class="mode-intro">
      <p class="eyebrow">PROGRESSION DISCOVERY</p>
      <h1>4つ選ぶ。聴く。<br>響きの名前を掘り当てる。</h1>
      <p>正解を当てるゲームではない。好きな並びから、知っている進行が見つかる。</p>
    </section>
  `;

  const layout = el('div', 'dig-layout');
  const workspace = el('section', 'workspace-card');
  workspace.innerHTML = '<div class="section-heading"><span>01</span><h2>進行をつくる</h2></div>';

  const slotsRow = el('div', 'dig-slots');
  slots.forEach((symbol, index) => {
    const wrap = el('div', `slot-wrap ${index === state.activeSlot ? 'active' : ''} ${symbol ? 'filled' : ''}`);
    const slot = el('button', `dig-slot ${state.playIndex === index ? 'playing' : ''}`);
    slot.type = 'button';
    slot.setAttribute('aria-label', symbol ? `${symbol}。スロット${index + 1}` : `空のスロット${index + 1}`);
    slot.innerHTML = symbol
      ? `<span class="slot-index">0${index + 1}</span><span class="slot-symbol">${prettySymbol(symbol)}</span>${state.showRoman ? `<span class="slot-roman">${escapeHtml(romanNumeral(symbol, state.key))}</span>` : ''}`
      : `<span class="slot-index">0${index + 1}</span><span class="slot-empty">選択</span>`;
    slot.onclick = () => actions.selectSlot(index);
    wrap.appendChild(slot);
    if (symbol) {
      const clear = el('button', 'slot-clear', '×');
      clear.type = 'button';
      clear.setAttribute('aria-label', `スロット${index + 1}の${symbol}を消去`);
      clear.onclick = () => actions.clearSlot(index);
      wrap.appendChild(clear);
    }
    slotsRow.appendChild(wrap);
  });
  workspace.appendChild(slotsRow);

  const instruction = el('p', 'workspace-instruction', filled
    ? (state.hasListened ? '再生済み。響きを評価すると進行名を照合する。' : '並びができた。下の「再生」で聴く。')
    : '空いている位置を選び、コードを置く。');
  workspace.appendChild(instruction);

  const palette = el('div', 'dig-palette');
  DIG_PALETTE.forEach((symbol) => {
    const button = el('button', 'palette-chord');
    button.type = 'button';
    const roman = state.showRoman ? romanNumeral(symbol, state.key) : '';
    button.innerHTML = `<span>${prettySymbol(symbol)}</span>${roman ? `<small>${escapeHtml(roman)}</small>` : ''}`;
    button.setAttribute('aria-label', `${symbol}${roman ? ` ${roman}` : ''}を置く`);
    button.onclick = () => actions.placeChord(symbol);
    palette.appendChild(button);
  });
  workspace.appendChild(palette);

  if (state.digNotice) {
    const notice = el('p', 'dig-notice', escapeHtml(state.digNotice));
    notice.setAttribute('role', 'status');
    workspace.appendChild(notice);
  }

  layout.appendChild(workspace);
  layout.appendChild(renderLibrary(state, actions));
  screen.appendChild(layout);

  const dock = el('div', 'dig-action-dock');
  dock.setAttribute('role', 'group');
  dock.setAttribute('aria-label', '進行の再生と評価');
  dock.innerHTML = `
    <button type="button" class="dock-play" data-play ${filled || state.playing ? '' : 'disabled'}>
      <span class="play-glyph" aria-hidden="true">${state.playing ? '■' : '▶'}</span>
      <span>${state.playing ? '停止' : '再生'}</span>
    </button>
    <button type="button" class="dock-rate" data-rate="meh" ${canRate ? '' : 'disabled'}>微妙</button>
    <button type="button" class="dock-rate dock-good" data-rate="good" ${canRate ? '' : 'disabled'}>良い</button>
  `;
  dock.querySelector('[data-play]').onclick = () => actions.toggleDigPlay();
  dock.querySelector('[data-rate="meh"]').onclick = () => actions.rateDig('meh');
  dock.querySelector('[data-rate="good"]').onclick = () => actions.rateDig('good');
  screen.appendChild(dock);
  return screen;
}

function renderLibrary(state, actions) {
  const count = discoveredCount(state);
  const section = el('section', `library-zone ${state.libraryOpen ? 'open' : ''}`);
  section.id = 'library';

  const peek = el('button', 'library-peek');
  peek.type = 'button';
  peek.setAttribute('aria-expanded', String(Boolean(state.libraryOpen)));
  peek.setAttribute('aria-controls', 'library-panel');
  peek.innerHTML = `
    <span class="library-title"><small>02</small> 進行図鑑</span>
    <span class="library-progress">${count} / ${PROGRESSIONS.length}</span>
    <span class="library-toggle-label">${state.libraryOpen ? '閉じる' : '開く'}</span>
  `;
  peek.onclick = () => actions.toggleLibrary();
  section.appendChild(peek);

  const markers = el('div', 'library-markers');
  PROGRESSIONS.forEach((progression) => {
    const marker = el('span', isDiscovered(state, progression.id) ? 'found' : '');
    marker.setAttribute('aria-hidden', 'true');
    markers.appendChild(marker);
  });
  section.appendChild(markers);

  if (!state.libraryOpen) return section;

  const panel = el('div', 'library-panel');
  panel.id = 'library-panel';
  if (state.libraryDetailId) panel.appendChild(renderLibraryDetail(state, actions));

  const grid = el('div', 'catalog-grid');
  PROGRESSIONS.forEach((progression, index) => {
    const found = isDiscovered(state, progression.id);
    if (!found) {
      const unknown = el('div', 'catalog-card unknown');
      unknown.innerHTML = `<span class="catalog-number">${String(index + 1).padStart(2, '0')}</span><span class="catalog-name">未発見</span><span class="catalog-hint">${escapeHtml(silhouetteHint(progression.degrees))}</span>`;
      grid.appendChild(unknown);
      return;
    }
    const card = el('button', `catalog-card found ${state.libraryDetailId === progression.id ? 'selected' : ''}`);
    card.type = 'button';
    const rating = state.ratings?.[progression.id];
    card.innerHTML = `
      <span class="catalog-number">${String(index + 1).padStart(2, '0')}</span>
      <span class="catalog-name">${escapeHtml(progression.name)}</span>
      <span class="catalog-degrees">${escapeHtml(progression.degrees)}</span>
      ${rating ? `<span class="catalog-rating">${rating === 'good' ? '良い' : '微妙'}</span>` : ''}
    `;
    card.onclick = () => actions.openLibraryDetail(progression.id);
    grid.appendChild(card);
  });
  panel.appendChild(grid);

  if (state.myLines?.length) panel.appendChild(renderSavedLines(state, actions));
  section.appendChild(panel);
  return section;
}

function renderLibraryDetail(state, actions) {
  const progression = PROGRESSIONS.find((item) => item.id === state.libraryDetailId);
  const detail = el('article', 'library-detail');
  if (!progression) return detail;
  detail.innerHTML = `
    <button type="button" class="detail-close" data-close aria-label="詳細を閉じる">×</button>
    <p class="eyebrow">DISCOVERED PROGRESSION</p>
    <h3>${escapeHtml(progression.name)}</h3>
    <p class="detail-degrees">${escapeHtml(progression.degrees)}</p>
    <div class="detail-chords">${progression.digForm.map((symbol) => `<span>${prettySymbol(symbol)}</span>`).join('')}</div>
    <div class="detail-actions">
      <button type="button" data-play-dig>発掘形を再生</button>
      ${progression.fullForm ? '<button type="button" data-play-full>フル形を再生</button>' : ''}
      <button type="button" data-redig>この並びを載せる</button>
    </div>
  `;
  detail.querySelector('[data-close]').onclick = () => actions.closeLibraryDetail();
  detail.querySelector('[data-play-dig]').onclick = () => actions.playChordList(progression.digForm);
  const full = detail.querySelector('[data-play-full]');
  if (full) full.onclick = () => actions.playChordList(progression.fullForm);
  detail.querySelector('[data-redig]').onclick = () => actions.redigFrom(progression.id);
  return detail;
}

function renderSavedLines(state, actions) {
  const section = el('section', 'saved-lines');
  section.innerHTML = '<div class="saved-lines-head"><h3>未登録の棚</h3><span>「良い」で残した響き</span></div>';
  const list = el('div', 'saved-lines-list');
  state.myLines.slice(0, 12).forEach((line) => {
    const row = el('div', 'saved-line');
    row.innerHTML = `<span>${line.chords.map(prettySymbol).join(' – ')}</span>`;
    const actionsRow = el('div', 'saved-line-actions');
    const play = el('button', '', '再生');
    const load = el('button', '', 'スロットへ');
    play.type = 'button';
    load.type = 'button';
    play.onclick = () => actions.playChordList(line.chords);
    load.onclick = () => actions.loadMyLineToDig(line.chords);
    actionsRow.append(play, load);
    row.appendChild(actionsRow);
    list.appendChild(row);
  });
  section.appendChild(list);
  return section;
}

function renderTones(state, actions) {
  const screen = el('main', 'screen tones-screen');
  const session = state.toneSession;
  if (!session) {
    screen.innerHTML = '<button type="button" class="primary-button" data-start>8問を始める</button>';
    screen.querySelector('[data-start]').onclick = () => actions.startToneSession();
    return screen;
  }
  if (session.complete) return renderToneSummary(state, actions, screen);

  const target = session.queue[session.index];
  const selected = session.selected || [];
  const correctPcs = chordPcs(target);
  const confirmed = Boolean(session.confirmed);
  const style = state.noteStyle || 'both';
  const answerTones = spellChordTones(target, style);
  const coverage = silentCoverage(state.tones);

  screen.innerHTML = `
    <section class="mode-intro tones-intro">
      <p class="eyebrow">CHORD TONE RECALL</p>
      <h1>音を鳴らす前に、<br>構成音を取り出す。</h1>
      <p>全96コードから8問。ヒントなしの正解と、助けを使った正解を分けて記録する。</p>
    </section>
    <section class="tone-card">
      <div class="tone-progress-row">
        <span>QUESTION ${session.index + 1} / ${session.queue.length}</span>
        <span>無音で正解 ${coverage} / ${TONE_POOL.length}</span>
      </div>
      <div class="tone-progress-track"><span style="width:${((session.index + (confirmed ? 1 : 0)) / session.queue.length) * 100}%"></span></div>
      <div class="tone-target">
        <p>構成音を鍵盤で選ぶ</p>
        <h2>${prettySymbol(target)}</h2>
      </div>
      <div class="tone-selection" aria-live="polite">
        <span class="tone-note-count">${selected.length}音を選択</span>
        <strong class="tone-selected-list">${selected.length ? selected.map((pc) => escapeHtml(formatPc(pc, style))).join('・') : '—'}</strong>
      </div>
      ${session.hintLevel ? `<div class="tone-hint"><span>HINT ${session.hintLevel}</span><p>${escapeHtml(toneHint(target, session.hintLevel, style))}</p></div>` : ''}
      ${confirmed ? `
        <div class="tone-feedback ${session.correct ? 'correct' : 'incorrect'}" role="status">
          <p class="feedback-title">${session.correct ? (session.hintLevel ? 'ヒントありで正解' : '無音で正解') : '今回は違う'}</p>
          <p class="feedback-answer">${answerTones.map(escapeHtml).join('・')}</p>
          <p>${session.correct ? '確定後の響きを聴いて、鍵盤の形と結びつける。' : '緑の鍵盤を見てから響きを聴き、次の回で取り出す。'}</p>
        </div>
      ` : ''}
      <div class="keyboard-host"></div>
      <div class="tone-actions">
        ${confirmed
          ? '<button type="button" class="primary-button" data-next>次の問題</button>'
          : `<button type="button" class="secondary-button" data-hint ${session.hintLevel >= 3 ? 'disabled' : ''}>${session.hintLevel ? '次のヒント' : 'ヒント'}</button><button type="button" class="primary-button" data-confirm ${selected.length ? '' : 'disabled'}>確定して聴く</button>`}
      </div>
    </section>
  `;

  const keyboardHost = screen.querySelector('.keyboard-host');
  const keyboard = createKeyboard({
    container: keyboardHost,
    noteStyle: style === 'abc' ? 'abc' : 'katakana',
    onNoteOn: ({ pc }) => actions.toggleTonePc(pc),
  });
  if (confirmed) keyboard.showResult(correctPcs, selected);
  else keyboard.setSelection(selected);
  state._kb = keyboard;

  if (confirmed) {
    screen.querySelector('[data-next]').onclick = () => actions.nextToneQuestion();
  } else {
    screen.querySelector('[data-hint]').onclick = () => actions.useToneHint();
    const confirm = screen.querySelector('[data-confirm]');
    confirm.onclick = () => actions.confirmToneAnswer();
    state._tonesView = {
      updateSelection(pcs) {
        const list = screen.querySelector('.tone-selected-list');
        const count = screen.querySelector('.tone-note-count');
        list.textContent = pcs.length ? pcs.map((pc) => formatPc(pc, style)).join('・') : '—';
        count.textContent = `${pcs.length}音を選択`;
        confirm.disabled = pcs.length === 0;
        keyboard.setSelection(pcs);
      },
    };
  }
  return screen;
}

function renderToneSummary(state, actions, screen) {
  const summary = summarizeToneResults(state.toneSession.results || []);
  screen.innerHTML = `
    <section class="tone-summary">
      <p class="eyebrow">SESSION COMPLETE</p>
      <h1>8問終了。</h1>
      <p class="summary-lead">速さではなく、どこまで自力で取り出せたかを残す。</p>
      <div class="summary-grid">
        <div><strong>${summary.silent}</strong><span>無音で正解</span></div>
        <div><strong>${summary.hinted}</strong><span>ヒント正解</span></div>
        <div><strong>${summary.misses}</strong><span>次回の弱点</span></div>
      </div>
      <p class="summary-note">誤答はこの場で再出題せず、次の8問で優先する。</p>
      <div class="summary-actions">
        <button type="button" class="primary-button" data-again>もう8問</button>
        <button type="button" class="secondary-button" data-dig>発掘へ</button>
      </div>
    </section>
  `;
  screen.querySelector('[data-again]').onclick = () => actions.startToneSession();
  screen.querySelector('[data-dig]').onclick = () => actions.switchMode('dig');
  return screen;
}

function renderPlaque(state, actions) {
  const plaque = state.plaque;
  const overlay = el('div', 'overlay plaque-overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'plaque-title');
  overlay.innerHTML = `
    <article class="plaque-card">
      <button type="button" class="overlay-close" data-close aria-label="閉じる">×</button>
      <p class="eyebrow">${plaque.isNew ? 'NEW DISCOVERY' : 'KNOWN PROGRESSION'}</p>
      <div class="engrave-line"></div>
      <h2 id="plaque-title">${escapeHtml(plaque.name)}</h2>
      <p class="plaque-degrees">${escapeHtml(plaque.degrees)}</p>
      <p class="plaque-rating">あなたの評価: ${plaque.rating === 'good' ? '良い' : '微妙'}</p>
      <div class="plaque-actions">
        <button type="button" class="secondary-button" data-dismiss>続ける</button>
        <button type="button" class="primary-button" data-library>図鑑で見る</button>
      </div>
    </article>
  `;
  overlay.querySelector('[data-close]').onclick = () => actions.dismissPlaque();
  overlay.querySelector('[data-dismiss]').onclick = () => actions.dismissPlaque();
  overlay.querySelector('[data-library]').onclick = () => actions.showDiscovery(plaque.id);
  return overlay;
}

function renderSettings(state, actions) {
  const overlay = el('div', 'overlay settings-overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'settings-title');
  overlay.innerHTML = `
    <section class="settings-sheet">
      <div class="sheet-head">
        <div><p class="eyebrow">PREFERENCES</p><h2 id="settings-title">設定</h2></div>
        <button type="button" class="overlay-close" data-close aria-label="設定を閉じる">×</button>
      </div>
      <div class="settings-fields">
        <label>キー <span>ローマ数字の基準</span>
          <select data-key>${KEYS.map((key) => `<option value="${key}" ${key === state.key ? 'selected' : ''}>${key}</option>`).join('')}</select>
        </label>
        <label>音名表記 <span>${noteStyleLabel(state.noteStyle)}</span>
          <select data-note-style>
            <option value="katakana" ${state.noteStyle === 'katakana' ? 'selected' : ''}>カタカナ</option>
            <option value="both" ${state.noteStyle === 'both' ? 'selected' : ''}>カタカナ＋ABC</option>
            <option value="abc" ${state.noteStyle === 'abc' ? 'selected' : ''}>ABC</option>
          </select>
        </label>
        <label class="check-field">ローマ数字を表示
          <input type="checkbox" data-roman ${state.showRoman ? 'checked' : ''}>
        </label>
        <label>テンポ <output data-tempo-output>${state.tempo}</output>
          <input type="range" min="40" max="120" value="${state.tempo}" data-tempo>
        </label>
        <label>音量
          <input type="range" min="0.2" max="1" step="0.05" value="${state.volume}" data-volume>
        </label>
      </div>
      <button type="button" class="primary-button sheet-done" data-done>完了</button>
    </section>
  `;
  const close = () => actions.closeSettings();
  overlay.querySelector('[data-close]').onclick = close;
  overlay.querySelector('[data-done]').onclick = close;
  overlay.onclick = (event) => { if (event.target === overlay) close(); };
  overlay.querySelector('[data-key]').onchange = (event) => actions.setKey(event.target.value);
  overlay.querySelector('[data-note-style]').onchange = (event) => actions.setNoteStyle(event.target.value);
  overlay.querySelector('[data-roman]').onchange = (event) => actions.setShowRoman(event.target.checked);
  overlay.querySelector('[data-tempo]').oninput = (event) => {
    overlay.querySelector('[data-tempo-output]').textContent = event.target.value;
    actions.setTempo(Number(event.target.value));
  };
  overlay.querySelector('[data-volume]').oninput = (event) => actions.setVolume(Number(event.target.value));
  return overlay;
}

function silhouetteHint(degrees) {
  const parts = String(degrees || '').split(/[–—−-]/).map((item) => item.trim()).filter(Boolean);
  if (!parts.length) return '· – · – · – ·';
  return parts.map((part, index) => (index === 0 ? part : '·')).join(' – ');
}

export { chordPcs, pcsMatch };
