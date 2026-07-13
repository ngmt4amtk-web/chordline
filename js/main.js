import { Synth } from './audio.js';
import { PlaybackEngine } from './engine.js';
import {
  loadState,
  saveState,
  registerDiscovery,
  saveMyLine,
  isDiscovered,
} from './state.js';
import { renderApp, pcsMatch, chordPcs } from './ui/screens.js';
import { matchProgression, PROGRESSIONS } from './theory.js';

const root = document.getElementById('app');
const synth = new Synth();
const engine = new PlaybackEngine(synth);

let state = {
  ...loadState(),
  screen: 'home',
  playing: false,
  playIndex: -1,
  slots: [null, null, null, null],
  activeSlot: 0,
  digPhase: 'edit',
  digNotice: '',
  plaque: null,
  dexId: null,
  chunkActive: false,
  chunkResult: null,
  chunkTarget: null,
  chunkSelected: [],
  chunkScore: 0,
  chunkRemain: 60,
  chunkTimer: null,
  _kb: null,
  _plaqueLock: false,
  _chunkChecking: false,
};

function persist() {
  saveState(state);
}

function rerender() {
  if (state._kb) {
    state._kb.destroy();
    state._kb = null;
  }
  renderApp({ root, state, synth, engine, actions });
}

function stopPlayback() {
  engine.stop();
  state.playing = false;
  state.playIndex = -1;
}

function clearChunkTimer() {
  if (state.chunkTimer) {
    clearInterval(state.chunkTimer);
    state.chunkTimer = null;
  }
}

function pickChunkTarget() {
  const pool = state.unlockedChords || [];
  if (!pool.length) return null;
  let next = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1 && next === state.chunkTarget) {
    next = pool[(pool.indexOf(next) + 1) % pool.length];
  }
  return next;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function chunkResultLine(score) {
  if (score <= 0) return '耳は温まっている。また掘ろう。';
  if (score <= 3) return '手がコードの輪郭を覚え始めている。';
  if (score <= 7) return '塊として掴める瞬間が増えた。';
  return '語彙が身体に残っている。';
}

function endChunkSession() {
  clearChunkTimer();
  const score = state.chunkScore || 0;
  state.chunkActive = false;
  state._chunkChecking = false;
  state.chunkResult = {
    score,
    line: chunkResultLine(score),
  };
  stopPlayback();
  rerender();
}

const actions = {
  goHome() {
    stopPlayback();
    clearChunkTimer();
    state.chunkActive = false;
    state.chunkResult = null;
    state._chunkChecking = false;
    state.plaque = null;
    state._plaqueLock = false;
    state.screen = 'home';
    state.digNotice = '';
    rerender();
  },

  openScreen(screen) {
    stopPlayback();
    clearChunkTimer();
    state.chunkActive = false;
    state.chunkResult = null;
    state._chunkChecking = false;
    state.plaque = null;
    state._plaqueLock = false;
    state.screen = screen;
    state.digNotice = '';
    rerender();
  },

  openSettings() {
    actions.openScreen('settings');
  },

  openDexDetail(id) {
    stopPlayback();
    state.dexId = id;
    state.screen = 'dex-detail';
    rerender();
  },

  setKey(key) {
    state.key = key;
    persist();
    rerender();
  },

  setShowRoman(v) {
    state.showRoman = v;
    persist();
    rerender();
  },

  setNoteStyle(v) {
    state.noteStyle = v;
    persist();
    rerender();
  },

  setVolume(v) {
    state.volume = v;
    synth.setVolume(v);
    persist();
  },

  setTempo(t) {
    state.tempo = t;
    persist();
  },

  selectSlot(i) {
    if (state._plaqueLock) return;
    stopPlayback();
    if (state.slots[i] && state.activeSlot === i) {
      state.slots[i] = null;
      state.digPhase = 'edit';
      state.digNotice = '';
    }
    state.activeSlot = i;
    rerender();
  },

  clearSlot(i) {
    if (state._plaqueLock) return;
    stopPlayback();
    state.slots[i] = null;
    state.activeSlot = i;
    state.digPhase = 'edit';
    state.digNotice = '';
    rerender();
  },

  placeChord(sym) {
    if (state._plaqueLock) return;
    stopPlayback();
    const slots = [...(state.slots || [null, null, null, null])];
    let idx = state.activeSlot ?? 0;
    if (slots[idx]) {
      const empty = slots.findIndex((c) => !c);
      if (empty >= 0) idx = empty;
    }
    slots[idx] = sym;
    state.slots = slots;
    state.activeSlot = Math.min(idx + 1, 3);
    state.digPhase = 'edit';
    state.digNotice = '';
    engine.playChord(sym).catch(() => {});
    rerender();
  },

  async toggleDigPlay() {
    if (state._plaqueLock) return;
    if (state.playing) {
      stopPlayback();
      rerender();
      return;
    }
    const chords = (state.slots || []).filter(Boolean);
    if (chords.length !== 4) return;
    state.playing = true;
    state.digNotice = '';
    rerender();
    let done = false;
    try {
      done = await engine.playSequence(chords, state.tempo, (i) => {
        state.playIndex = i;
        document.querySelectorAll('.dig-slot').forEach((el, idx) => {
          el.classList.toggle('playing', idx === i);
        });
      });
      if (done) state.digPhase = 'rated';
    } catch (_) {
      done = false;
      stopPlayback();
    } finally {
      if (done || !engine.playing) {
        state.playing = false;
        state.playIndex = -1;
        rerender();
      }
    }
  },

  rateMeh() {
    if (state._plaqueLock) return;
    state.digPhase = 'edit';
    state.digNotice = '続けて並べ替えられる。';
    rerender();
  },

  async rateGood() {
    if (state._plaqueLock) return;
    const chords = (state.slots || []).filter(Boolean);
    if (chords.length !== 4) return;

    const hit = matchProgression(chords);
    if (!hit.hit) {
      const saved = saveMyLine(state, chords);
      state.myLines = saved.myLines;
      state.digPhase = 'edit';
      state.digNotice = 'マイラインに残した。図鑑の進行ではなかった。';
      persist();
      rerender();
      return;
    }

    // 再発見: 銘板なし
    if (isDiscovered(state, hit.id)) {
      state.digPhase = 'edit';
      state.digNotice = `既知: ${hit.name}`;
      rerender();
      return;
    }

    const prog = PROGRESSIONS.find((p) => p.id === hit.id);
    state._plaqueLock = true;
    state.digPhase = 'edit';
    state.digNotice = '';
    state.plaque = {
      id: hit.id,
      name: hit.name,
      degrees: prog?.degrees || '',
      phase: 'still',
    };
    rerender();

    await delay(380);
    if (!state.plaque) return;
    state.plaque = { ...state.plaque, phase: 'chime' };
    rerender();
    await synth.playEngrave();
    await delay(180);

    if (!state.plaque) return;
    state.plaque = { ...state.plaque, phase: 'light' };
    rerender();
    await delay(520);

    if (!state.plaque) return;
    state.plaque = { ...state.plaque, phase: 'name' };
    const registered = registerDiscovery(state, hit.id, chords);
    state.discovered = registered.discovered;
    state.unlockedChords = registered.unlockedChords;
    persist();
    rerender();
    await delay(1600);

    state.plaque = null;
    state._plaqueLock = false;
    state.digNotice = `${hit.name} を図鑑に刻印した。`;
    rerender();
  },

  async playChordList(chords) {
    if (!chords?.length) return;
    if (state.playing) {
      stopPlayback();
      rerender();
      return;
    }
    state.playing = true;
    rerender();
    let done = false;
    try {
      done = await engine.playSequence(chords, state.tempo, (i) => {
        state.playIndex = i;
      });
    } catch (_) {
      done = false;
      stopPlayback();
    } finally {
      if (done || !engine.playing) {
        state.playing = false;
        state.playIndex = -1;
        rerender();
      }
    }
  },

  redigFrom(id) {
    const prog = PROGRESSIONS.find((p) => p.id === id);
    if (!prog) return;
    stopPlayback();
    state.slots = [...prog.digForm];
    state.activeSlot = 0;
    state.digPhase = 'edit';
    state.digNotice = `${prog.name} の発掘形を載せた。`;
    state.screen = 'dig';
    state.plaque = null;
    rerender();
  },

  loadMyLineToDig(chords) {
    if (!chords?.length) return;
    stopPlayback();
    const four = [...chords].slice(0, 4);
    while (four.length < 4) four.push(null);
    state.slots = four;
    state.activeSlot = four.findIndex((c) => !c);
    if (state.activeSlot < 0) state.activeSlot = 0;
    state.digPhase = 'edit';
    state.digNotice = 'マイラインを発掘スロットに戻した。';
    state.screen = 'dig';
    state.plaque = null;
    rerender();
  },

  startChunk() {
    stopPlayback();
    clearChunkTimer();
    state.chunkResult = null;
    state._chunkChecking = false;
    const target = pickChunkTarget();
    if (!target) {
      state.screen = 'chunk';
      rerender();
      return;
    }
    state.chunkActive = true;
    state.chunkTarget = target;
    state.chunkSelected = [];
    state.chunkScore = 0;
    state.chunkRemain = 60;
    state.screen = 'chunk';
    state.chunkTimer = setInterval(() => {
      state.chunkRemain -= 1;
      if (state.chunkRemain <= 0) {
        endChunkSession();
        return;
      }
      const timerEl = document.querySelector('.chunk-timer');
      if (timerEl) timerEl.textContent = `${state.chunkRemain}s`;
    }, 1000);
    rerender();
  },

  dismissChunkResult() {
    state.chunkResult = null;
    rerender();
  },

  toggleChunkPc(pc) {
    if (!state.chunkActive || state._chunkChecking) return;
    const sel = [...(state.chunkSelected || [])];
    const idx = sel.indexOf(pc);
    if (idx >= 0) sel.splice(idx, 1);
    else sel.push(pc);
    state.chunkSelected = sel;
    rerender();
  },

  clearChunkSelect() {
    if (state._chunkChecking) return;
    state.chunkSelected = [];
    rerender();
  },

  async checkChunk() {
    if (!state.chunkActive || !state.chunkTarget || state._chunkChecking) return;
    const ok = pcsMatch(state.chunkSelected || [], chordPcs(state.chunkTarget));
    if (state._kb) state._kb.flashResult(ok);

    state._chunkChecking = true;
    if (ok) {
      // 連打二重加点防止: await 前に同期で加点・次問へ
      state.chunkScore = (state.chunkScore || 0) + 1;
      state.chunkTarget = pickChunkTarget();
      state.chunkSelected = [];
      rerender();
      try {
        await synth.playSuccess();
      } finally {
        state._chunkChecking = false;
      }
      return;
    }

    try {
      await synth.playMiss();
    } finally {
      state._chunkChecking = false;
      rerender();
    }
  },
};

synth.setVolume(state.volume);
document.addEventListener('pointerdown', () => synth.ensureRunning(), { once: true });
rerender();
