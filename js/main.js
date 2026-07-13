import { Synth } from './audio.js';
import { PlaybackEngine } from './engine.js';
import {
  isDiscovered,
  loadState,
  registerDiscovery,
  saveMyLine,
  saveState,
} from './state.js';
import {
  PROGRESSIONS,
  chordPcs,
  matchProgression,
  pcsMatch,
} from './theory.js';
import {
  buildToneSession,
  finishToneSession,
  loadTonesState,
  recordToneAttempt,
  saveTonesState,
} from './tones.js';
import { renderApp } from './ui/screens.js';

const root = document.getElementById('app');
const synth = new Synth();
const engine = new PlaybackEngine(synth);
const saved = loadState();

let state = {
  ...saved,
  mode: 'dig',
  settingsOpen: false,
  libraryOpen: window.matchMedia?.('(min-width: 760px)').matches || false,
  libraryDetailId: null,
  playing: false,
  playIndex: -1,
  slots: [null, null, null, null],
  activeSlot: 0,
  hasListened: false,
  digRated: false,
  digNotice: '',
  plaque: null,
  tones: loadTonesState(),
  toneSession: null,
  _kb: null,
  _tonesView: null,
};

function persist() {
  saveState(state);
}

function persistTones() {
  saveTonesState(state.tones);
}

function rerender() {
  if (state._kb) {
    state._kb.destroy();
    state._kb = null;
  }
  renderApp({ root, state, actions });
}

function stopPlayback() {
  engine.stop();
  state.playing = false;
  state.playIndex = -1;
}

function resetDigAfterEdit() {
  state.hasListened = false;
  state.digRated = false;
  state.digNotice = '';
  state.plaque = null;
}

function makeToneSession() {
  return {
    queue: buildToneSession({ cells: state.tones.cells }),
    index: 0,
    selected: [],
    hintLevel: 0,
    confirmed: false,
    correct: null,
    currentResult: null,
    results: [],
    complete: false,
  };
}

const actions = {
  switchMode(mode) {
    if (!['dig', 'tones'].includes(mode)) return;
    stopPlayback();
    state.mode = mode;
    state.settingsOpen = false;
    state.plaque = null;
    if (mode === 'tones' && !state.toneSession) state.toneSession = makeToneSession();
    rerender();
  },

  openSettings() {
    stopPlayback();
    state.settingsOpen = true;
    rerender();
  },

  closeSettings() {
    state.settingsOpen = false;
    rerender();
  },

  setKey(key) {
    state.key = key;
    persist();
    rerender();
  },

  setShowRoman(value) {
    state.showRoman = value;
    persist();
    rerender();
  },

  setNoteStyle(value) {
    state.noteStyle = value;
    persist();
    rerender();
  },

  setVolume(value) {
    state.volume = value;
    synth.setVolume(value);
    persist();
  },

  setTempo(value) {
    state.tempo = value;
    persist();
  },

  selectSlot(index) {
    stopPlayback();
    state.activeSlot = index;
    rerender();
  },

  clearSlot(index) {
    stopPlayback();
    state.slots = [...state.slots];
    state.slots[index] = null;
    state.activeSlot = index;
    resetDigAfterEdit();
    rerender();
  },

  placeChord(symbol) {
    stopPlayback();
    const slots = [...state.slots];
    const index = state.activeSlot ?? 0;
    slots[index] = symbol;
    state.slots = slots;
    const nextEmpty = slots.findIndex((item, slotIndex) => !item && slotIndex > index);
    const firstEmpty = slots.findIndex((item) => !item);
    state.activeSlot = nextEmpty >= 0 ? nextEmpty : (firstEmpty >= 0 ? firstEmpty : index);
    resetDigAfterEdit();
    engine.playChord(symbol).catch(() => {});
    rerender();
  },

  async toggleDigPlay() {
    if (state.playing) {
      stopPlayback();
      rerender();
      return;
    }
    const chords = state.slots.filter(Boolean);
    if (chords.length !== 4) return;
    state.playing = true;
    state.playIndex = -1;
    state.digRated = false;
    state.digNotice = '';
    rerender();
    let completed = false;
    try {
      completed = await engine.playSequence(chords, state.tempo, (index) => {
        state.playIndex = index;
        document.querySelectorAll('.dig-slot').forEach((slot, slotIndex) => {
          slot.classList.toggle('playing', slotIndex === index);
        });
      });
      if (completed) state.hasListened = true;
    } catch (_) {
      completed = false;
      stopPlayback();
    } finally {
      if (completed || !engine.playing) {
        state.playing = false;
        state.playIndex = -1;
        rerender();
      }
    }
  },

  rateDig(rating) {
    const chords = state.slots.filter(Boolean);
    if (chords.length !== 4 || !state.hasListened || state.playing || state.digRated) return;
    state.digRated = true;
    const hit = matchProgression(chords);

    if (!hit.hit) {
      if (rating === 'good') {
        const savedLine = saveMyLine(state, chords);
        state.myLines = savedLine.myLines;
        state.digNotice = '図鑑名はない。響きは「未登録の棚」に残した。';
        persist();
      } else {
        state.digNotice = '図鑑名はない。コードを入れ替えて次を試せる。';
      }
      rerender();
      return;
    }

    const wasDiscovered = isDiscovered(state, hit.id);
    if (!wasDiscovered) {
      const registered = registerDiscovery(state, hit.id, chords);
      state.discovered = registered.discovered;
      state.unlockedChords = registered.unlockedChords;
    }
    state.ratings = { ...(state.ratings || {}), [hit.id]: rating };
    persist();

    const progression = PROGRESSIONS.find((item) => item.id === hit.id);
    state.plaque = {
      id: hit.id,
      name: hit.name,
      degrees: progression?.degrees || '',
      rating,
      isNew: !wasDiscovered,
    };
    state.digNotice = wasDiscovered
      ? `既知の ${hit.name}。評価を更新した。`
      : `${hit.name} を図鑑に刻んだ。`;
    rerender();
    synth.playEngrave().catch(() => {});
  },

  dismissPlaque() {
    state.plaque = null;
    rerender();
  },

  showDiscovery(id) {
    state.plaque = null;
    state.libraryOpen = true;
    state.libraryDetailId = id;
    rerender();
    requestAnimationFrame(() => document.getElementById('library')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  },

  toggleLibrary() {
    state.libraryOpen = !state.libraryOpen;
    if (!state.libraryOpen) state.libraryDetailId = null;
    rerender();
  },

  openLibraryDetail(id) {
    state.libraryOpen = true;
    state.libraryDetailId = id;
    rerender();
  },

  closeLibraryDetail() {
    state.libraryDetailId = null;
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
    try {
      await engine.playSequence(chords, state.tempo);
    } catch (_) {
      stopPlayback();
    } finally {
      state.playing = false;
      state.playIndex = -1;
      rerender();
    }
  },

  redigFrom(id) {
    const progression = PROGRESSIONS.find((item) => item.id === id);
    if (!progression) return;
    stopPlayback();
    state.mode = 'dig';
    state.slots = [...progression.digForm];
    state.activeSlot = 0;
    state.libraryOpen = false;
    state.libraryDetailId = null;
    resetDigAfterEdit();
    state.digNotice = `${progression.name} の並びを載せた。再生して確かめられる。`;
    rerender();
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  },

  loadMyLineToDig(chords) {
    if (!chords?.length) return;
    stopPlayback();
    const slots = [...chords].slice(0, 4);
    while (slots.length < 4) slots.push(null);
    state.mode = 'dig';
    state.slots = slots;
    state.activeSlot = Math.max(0, slots.findIndex((item) => !item));
    state.libraryOpen = false;
    state.libraryDetailId = null;
    resetDigAfterEdit();
    state.digNotice = '保存した響きをスロットへ戻した。';
    rerender();
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  },

  startToneSession() {
    stopPlayback();
    state.mode = 'tones';
    state.toneSession = makeToneSession();
    rerender();
  },

  toggleTonePc(pc) {
    const session = state.toneSession;
    if (!session || session.complete || session.confirmed) return;
    const selected = [...(session.selected || [])];
    const index = selected.indexOf(pc);
    if (index >= 0) selected.splice(index, 1);
    else selected.push(pc);
    session.selected = selected;
    if (state._tonesView) state._tonesView.updateSelection(selected);
    else rerender();
  },

  useToneHint() {
    const session = state.toneSession;
    if (!session || session.complete || session.confirmed || session.hintLevel >= 3) return;
    session.hintLevel += 1;
    rerender();
  },

  confirmToneAnswer() {
    const session = state.toneSession;
    if (!session || session.complete || session.confirmed || !session.selected.length) return;
    const symbol = session.queue[session.index];
    const correct = pcsMatch(session.selected, chordPcs(symbol));
    const result = { symbol, correct, hintLevel: session.hintLevel };
    state.tones = recordToneAttempt(state.tones, result);
    session.confirmed = true;
    session.correct = correct;
    session.currentResult = result;
    persistTones();
    rerender();
    synth.playChord(symbol).catch(() => {});
  },

  nextToneQuestion() {
    const session = state.toneSession;
    if (!session?.confirmed || !session.currentResult) return;
    const results = [...session.results, session.currentResult];
    if (session.index + 1 >= session.queue.length) {
      state.tones = finishToneSession(state.tones, results);
      persistTones();
      state.toneSession = { ...session, results, complete: true };
      rerender();
      return;
    }
    state.toneSession = {
      ...session,
      index: session.index + 1,
      selected: [],
      hintLevel: 0,
      confirmed: false,
      correct: null,
      currentResult: null,
      results,
    };
    rerender();
  },
};

synth.setVolume(state.volume);
document.addEventListener('pointerdown', () => synth.ensureRunning(), { once: true });
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (state.plaque) actions.dismissPlaque();
  else if (state.settingsOpen) actions.closeSettings();
});
rerender();
