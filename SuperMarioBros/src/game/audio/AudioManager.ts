/**
 * Procedural Web Audio manager: a look-ahead step sequencer for BGM whose tempo
 * (and timbre) can be shifted live for the Wonder event, plus synthesized SFX.
 * Fully self-contained — no audio assets required.
 */
export type SfxName =
  | 'jump'
  | 'coin'
  | 'stomp'
  | 'break'
  | 'bump'
  | 'powerup'
  | 'powerdown'
  | 'wonder'
  | 'wonderEnd'
  | 'whip'
  | 'drill'
  | 'die'
  | 'glide'
  | 'goal';

const NOTE: Record<string, number> = {};
{
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  for (let o = 1; o <= 7; o++) names.forEach((n, i) => (NOTE[`${n}${o}`] = 440 * Math.pow(2, (o * 12 + i - 57) / 12)));
}

// 16th-note patterns (null = rest), 2 bars
const LEAD = ['E5', 'E5', null, 'E5', null, 'C5', 'E5', null, 'G5', null, null, null, 'G4', null, null, null,
  'C5', null, null, 'G4', null, null, 'E4', null, null, 'A4', null, 'B4', null, 'A#4', 'A4', null];
const BASS = ['C3', null, 'C3', null, 'G2', null, 'G2', null, 'A2', null, 'A2', null, 'F2', null, 'G2', null,
  'C3', null, 'C3', null, 'E3', null, 'E3', null, 'F3', null, 'F3', null, 'G3', null, 'G2', null];
const WONDER_ARP = ['C5', 'E5', 'G5', 'B5', 'C6', 'B5', 'G5', 'E5', 'D5', 'F5', 'A5', 'C6', 'D6', 'C6', 'A5', 'F5',
  'E5', 'G5', 'B5', 'D6', 'E6', 'D6', 'B5', 'G5', 'F5', 'A5', 'C6', 'E6', 'F6', 'E6', 'C6', 'A5'];

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private bpm = 128;
  private wonder = false;
  private step = 0;
  private nextNoteTime = 0;
  private timer: number | null = null;
  private started = false;
  muted = false;

  /** Must be triggered by a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.35;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.7;
    this.sfxGain.connect(this.master);
    this.startMusic();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  setTempo(bpm: number) {
    this.bpm = bpm;
  }

  setWonder(on: boolean) {
    this.wonder = on;
  }

  // ---------------------------------------------------------------- sequencer
  private startMusic() {
    if (!this.ctx || this.started) return;
    this.started = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    const lookahead = 0.12;
    this.timer = window.setInterval(() => {
      if (!this.ctx) return;
      while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
        this.scheduleStep(this.step, this.nextNoteTime);
        const secondsPer16th = 60 / this.bpm / 4;
        this.nextNoteTime += secondsPer16th;
        this.step = (this.step + 1) % 32;
      }
    }, 30);
  }

  private scheduleStep(step: number, t: number) {
    const s16 = 60 / this.bpm / 4;
    const lead = LEAD[step];
    const bass = BASS[step];
    if (lead) this.tone(NOTE[lead], t, s16 * 0.9, this.wonder ? 'sawtooth' : 'square', 0.16, this.musicGain);
    if (bass) this.tone(NOTE[bass], t, s16 * 1.6, 'triangle', 0.28, this.musicGain);
    if (this.wonder) {
      const arp = WONDER_ARP[step];
      if (arp) this.tone(NOTE[arp] * (step % 8 === 0 ? 2 : 1), t, s16 * 0.6, 'sine', 0.12, this.musicGain, 0.01);
    }
    // hi-hat
    if (step % 2 === 0) this.noise(t, 0.03, step % 4 === 0 ? 0.09 : 0.045, this.musicGain);
    if (this.wonder && step % 4 === 2) this.noise(t, 0.08, 0.08, this.musicGain, 1200);
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, slide = 0) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(t: number, dur: number, vol: number, dest: AudioNode, hp = 6000) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(dest);
    src.start(t);
  }

  // ---------------------------------------------------------------- SFX
  play(name: SfxName) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const d = this.sfxGain;
    switch (name) {
      case 'jump':
        this.sweep(300, 720, t, 0.14, 'square', 0.18);
        break;
      case 'coin':
        this.tone(NOTE.B5, t, 0.08, 'square', 0.16, d);
        this.tone(NOTE.E6, t + 0.08, 0.25, 'square', 0.16, d);
        break;
      case 'stomp':
        this.sweep(500, 120, t, 0.12, 'square', 0.2);
        this.noise(t, 0.08, 0.15, d, 2000);
        break;
      case 'break':
        this.noise(t, 0.2, 0.35, d, 800);
        this.sweep(220, 60, t, 0.2, 'sawtooth', 0.15);
        break;
      case 'bump':
        this.sweep(180, 90, t, 0.1, 'square', 0.15);
        break;
      case 'powerup':
        ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => this.tone(NOTE[n], t + i * 0.06, 0.12, 'square', 0.14, d));
        break;
      case 'powerdown':
        ['G5', 'E5', 'C5', 'G4'].forEach((n, i) => this.tone(NOTE[n], t + i * 0.09, 0.14, 'square', 0.14, d));
        break;
      case 'wonder':
        ['C5', 'D5', 'F5', 'G5', 'A#5', 'C6', 'D6', 'F6', 'G6', 'A#6'].forEach((n, i) =>
          this.tone(NOTE[n], t + i * 0.045, 0.3, 'sine', 0.16, d)
        );
        this.sweep(200, 1800, t, 0.6, 'sawtooth', 0.08);
        break;
      case 'wonderEnd':
        ['G6', 'F6', 'D6', 'C6', 'A#5', 'G5', 'F5'].forEach((n, i) => this.tone(NOTE[n], t + i * 0.05, 0.25, 'sine', 0.14, d));
        break;
      case 'whip':
        this.noise(t, 0.12, 0.25, d, 1500);
        this.sweep(900, 200, t, 0.15, 'triangle', 0.12);
        break;
      case 'drill':
        this.noise(t, 0.25, 0.25, d, 400);
        this.sweep(90, 260, t, 0.25, 'sawtooth', 0.12);
        break;
      case 'die':
        ['B4', 'F5', 'F5', 'F5', 'E5', 'D5', 'C5'].forEach((n, i) => this.tone(NOTE[n], t + i * 0.12, 0.18, 'square', 0.15, d));
        break;
      case 'glide':
        this.noise(t, 0.15, 0.06, d, 3000);
        break;
      case 'goal':
        ['G4', 'C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'E6', 'G6'].forEach((n, i) => this.tone(NOTE[n], t + i * 0.1, 0.25, 'square', 0.15, d));
        break;
    }
  }

  private sweep(f0: number, f1: number, t: number, dur: number, type: OscillatorType, vol: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  destroy() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    this.started = false;
    void this.ctx?.close();
    this.ctx = null;
  }
}
