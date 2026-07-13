import { Synth } from '../audio.js';
import { chordMidis, progressionForKey, PROGRESSIONS } from '../theory.js';

export class PlaybackEngine {
  constructor(synth) {
    this.synth = synth;
    this._timer = null;
    this._index = 0;
    this._running = false;
    this._onStep = null;
  }

  stop() {
    this._running = false;
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
    this.synth.stopAll();
  }

  onStep(fn) {
    this._onStep = fn;
  }

  async playProgression(prog, key, tempo, onStep) {
    this.stop();
    const p = progressionForKey(prog, key);
    this._running = true;
    this._index = 0;
    const beatMs = (60 / tempo) * 1000 * 2;

    const step = async () => {
      if (!this._running) return;
      const chord = p.chords[this._index];
      const midis = chordMidis(chord);
      onStep?.(this._index, chord, p);
      await this.synth.playChord(midis, beatMs / 1000 * 0.85);
      this._index = (this._index + 1) % p.chords.length;
      this._timer = setTimeout(step, beatMs);
    };
    await step();
  }

  async playChord(symbol) {
    this.synth.stopAll();
    const midis = chordMidis(symbol);
    await this.synth.playChord(midis);
  }
}

export function getProgression(state) {
  return PROGRESSIONS.find((p) => p.id === state.progressionId) || PROGRESSIONS[0];
}
