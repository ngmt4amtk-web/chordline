import { chordMidis } from './theory.js';

/**
 * 連続再生エンジン（ループしない・世代番号で二重再生を殺す）
 */
export class PlaybackEngine {
  constructor(synth) {
    this.synth = synth;
    /** @type {ReturnType<typeof setTimeout>|null} */
    this._timer = null;
    /** @type {(() => void)|null} */
    this._waitResolve = null;
    this._running = false;
    this._gen = 0;
  }

  get playing() {
    return this._running;
  }

  get generation() {
    return this._gen;
  }

  stop() {
    this._gen += 1;
    this._running = false;
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
    if (this._waitResolve) {
      const resolve = this._waitResolve;
      this._waitResolve = null;
      resolve();
    }
    this.synth.stopAll();
  }

  _wait(ms) {
    return new Promise((resolve) => {
      this._waitResolve = () => {
        this._waitResolve = null;
        resolve();
      };
      this._timer = setTimeout(() => {
        const r = this._waitResolve;
        this._waitResolve = null;
        this._timer = null;
        if (r) r();
      }, ms);
    });
  }

  /**
   * コード列を1周だけ再生。途中 stop / 再呼び出しで前世代は無効化。
   * @param {string[]} chords
   * @param {number} tempo
   * @param {(i: number, chord: string) => void} [onStep]
   * @returns {Promise<boolean>} 最後まで再生できたら true
   */
  async playSequence(chords, tempo, onStep) {
    this.stop();
    const gen = this._gen;
    this._running = true;
    const beatMs = (60 / Math.max(40, Math.min(160, tempo || 72))) * 1000 * 2;

    try {
      for (let i = 0; i < chords.length; i++) {
        if (!this._running || gen !== this._gen) return false;
        const chord = chords[i];
        onStep?.(i, chord);
        const midis = chordMidis(chord);
        await this.synth.playChord(midis, (beatMs / 1000) * 0.85);
        if (!this._running || gen !== this._gen) return false;
        if (i < chords.length - 1) {
          await this._wait(beatMs);
          if (!this._running || gen !== this._gen) return false;
        }
      }
      return gen === this._gen;
    } finally {
      if (gen === this._gen) {
        this._running = false;
        this._timer = null;
        this._waitResolve = null;
      }
    }
  }

  /** 単発。進行中のシーケンスがあれば止める */
  async playChord(symbol) {
    this.stop();
    const midis = chordMidis(symbol);
    await this.synth.playChord(midis);
  }
}
