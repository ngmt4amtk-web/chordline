import { Synth } from './audio.js';
import { PlaybackEngine, getProgression } from './engine.js';
import { loadState, saveState } from './state.js';
import { renderApp, pcsMatch, chordPcs } from './ui/screens.js';
import { chordMidis } from './theory.js';

const root = document.getElementById('app');
const synth = new Synth();
const engine = new PlaybackEngine(synth);

let state = { ...loadState(), screen: 'home', playing: false, playIndex: 0, practiceSelected: [] };

function rerender() {
  if (state._kb) {
    state._kb.destroy();
    state._kb = null;
  }
  renderApp({ root, state, synth, engine, actions });
}

const actions = {
  goHome() {
    engine.stop();
    state.playing = false;
    state.screen = 'home';
    rerender();
  },
  goBack() {
    state.screen = state.mode || 'home';
    rerender();
  },
  openMode(mode) {
    state.mode = mode;
    state.screen = mode;
    state.practiceIndex = 0;
    state.practiceSelected = [];
    state.playIndex = 0;
    rerender();
  },
  openSettings() {
    state.screen = 'settings';
    rerender();
  },
  setKey(key) {
    state.key = key;
    saveState(state);
    rerender();
  },
  setShowRoman(v) {
    state.showRoman = v;
    saveState(state);
    rerender();
  },
  setVolume(v) {
    state.volume = v;
    synth.setVolume(v);
    saveState(state);
  },
  setTempo(t) {
    state.tempo = t;
    saveState(state);
    if (state.playing) {
      engine.stop();
      actions.togglePlay();
    }
  },
  setProgression(id) {
    state.progressionId = id;
    state.playIndex = 0;
    state.practiceIndex = 0;
    saveState(state);
    rerender();
  },
  setChordSymbol(sym) {
    state.chordSymbol = sym;
    rerender();
  },
  setPlayIndex(i) {
    state.playIndex = i;
    rerender();
  },
  async togglePlay() {
    if (state.playing) {
      engine.stop();
      state.playing = false;
      updatePlayUi();
      return;
    }
    state.playing = true;
    updatePlayUi();
    const prog = getProgression(state);
    const { progressionForKey } = await import('./theory.js');
    await engine.playProgression(prog, state.key, state.tempo, (i, chord) => {
      state.playIndex = i;
      document.querySelectorAll('.timeline-cell').forEach((el, idx) => {
        el.classList.toggle('active', idx === i);
      });
      if (state._kb) state._kb.setHighlight(chordPcs(chord));
    });
    state.playing = false;
    updatePlayUi();
  },
  togglePracticePc(pc) {
    const sel = [...(state.practiceSelected || [])];
    const idx = sel.indexOf(pc);
    if (idx >= 0) sel.splice(idx, 1);
    else sel.push(pc);
    state.practiceSelected = sel;
    rerender();
  },
  clearPractice() {
    state.practiceSelected = [];
    rerender();
  },
  async checkPractice() {
    const prog = getProgression(state);
    const { progressionForKey } = await import('./theory.js');
    const p = progressionForKey(prog, state.key);
    const target = p.chords[state.practiceIndex % p.chords.length];
    const targetPcs = chordPcs(target);
    const ok = pcsMatch(state.practiceSelected, targetPcs);
    if (state._kb) state._kb.flashResult(ok);
    if (ok) {
      await synth.playSuccess();
      state.practiceIndex = (state.practiceIndex + 1) % p.chords.length;
      state.practiceSelected = [];
    } else {
      await synth.playMiss();
    }
    rerender();
  },
};

function updatePlayUi() {
  const btn = document.querySelector('[data-play]');
  if (btn) btn.textContent = state.playing ? '停止' : '再生';
}

synth.setVolume(state.volume);

document.addEventListener('pointerdown', () => synth.ensureRunning(), { once: true });

rerender();
