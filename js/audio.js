// Web Audio シンセ（刺激音）

const ATTACK = 0.02;
const RELEASE = 0.22;
const PARTIALS = [1, 0.32, 0.1];

export class Synth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this._voices = new Set();
    this._volume = 0.85;
  }

  async ensureRunning() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
    return this.ctx;
  }

  setVolume(v) {
    this._volume = v;
    if (this.master) this.master.gain.value = v;
  }

  stopAll() {
    for (const v of this._voices) {
      try { v.stop(); } catch (_) {}
    }
    this._voices.clear();
  }

  async playMidi(midi, dur = 0.55, vol = 0.35) {
    await this.ensureRunning();
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const freq = 442 * Math.pow(2, (midi - 69) / 12);
    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0, t0);
    voiceGain.gain.linearRampToValueAtTime(vol, t0 + ATTACK);
    voiceGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    voiceGain.connect(this.master);

    const oscs = PARTIALS.map((amp, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq * (i + 1);
      const g = ctx.createGain();
      g.gain.value = amp * 0.45;
      o.connect(g);
      g.connect(voiceGain);
      o.start(t0);
      o.stop(t0 + dur + RELEASE);
      return o;
    });

    const stopAt = t0 + dur + RELEASE;
    const voice = {
      stop: () => oscs.forEach((o) => { try { o.stop(); } catch (_) {} }),
    };
    this._voices.add(voice);
    setTimeout(() => this._voices.delete(voice), (stopAt - t0) * 1000 + 50);
  }

  async playChord(midis, dur = 0.9, vol = 0.28) {
    this.stopAll();
    await Promise.all(midis.map((m, i) => this.playMidi(m, dur, vol * (i === 0 ? 1 : 0.85))));
  }

  async playSuccess() {
    await this.ensureRunning();
    await this.playMidi(72, 0.12, 0.2);
    setTimeout(() => this.playMidi(76, 0.18, 0.18), 80);
  }

  /** 銘板用: 低め単音・減衰長め（確定の重さ） */
  async playEngrave() {
    await this.ensureRunning();
    await this.playMidi(52, 1.4, 0.14);
  }

  async playMiss() {
    await this.ensureRunning();
    await this.playMidi(58, 0.2, 0.15);
  }
}
