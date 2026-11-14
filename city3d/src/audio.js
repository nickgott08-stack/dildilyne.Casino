// synthesized sounds (no files needed)
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.listener = { x: 0, z: 0 };
  }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    // noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // brown noise for ambience
    const bb = ctx.createBuffer(1, len, ctx.sampleRate);
    const bd = bb.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    const amb = ctx.createBufferSource();
    amb.buffer = bb;
    amb.loop = true;
    const ag = ctx.createGain();
    ag.gain.value = 0.12;
    const af = ctx.createBiquadFilter();
    af.type = 'lowpass';
    af.frequency.value = 600;
    amb.connect(af).connect(ag).connect(this.master);
    amb.start();
    // engine
    this.eng = ctx.createGain();
    this.eng.gain.value = 0;
    const ef = ctx.createBiquadFilter();
    ef.type = 'lowpass';
    ef.frequency.value = 900;
    ef.Q.value = 2;
    this.engF = ef;
    this.o1 = ctx.createOscillator();
    this.o1.type = 'sawtooth';
    this.o2 = ctx.createOscillator();
    this.o2.type = 'square';
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    this.o1.connect(ef);
    this.o2.connect(g2).connect(ef);
    ef.connect(this.eng).connect(this.master);
    this.o1.start();
    this.o2.start();
    // siren
    this.sir = ctx.createGain();
    this.sir.gain.value = 0;
    this.so = ctx.createOscillator();
    this.so.type = 'square';
    const sf = ctx.createBiquadFilter();
    sf.type = 'lowpass';
    sf.frequency.value = 1800;
    this.so.connect(sf).connect(this.sir).connect(this.master);
    this.so.start();
    // horn
    this.hornG = ctx.createGain();
    this.hornG.gain.value = 0;
    for (const f of [370, 466]) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      o.connect(this.hornG);
      o.start();
    }
    const hf = ctx.createBiquadFilter();
    hf.type = 'lowpass';
    hf.frequency.value = 1500;
    this.hornG.connect(hf).connect(this.master);
    this.lastHonk = 0;
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.7;
  }
  dist(p) {
    const d = Math.hypot(p.x - this.listener.x, p.z - this.listener.z);
    return Math.max(0, 1 - d / 90) ** 2;
  }
  burst(vol, f0, dur, type = 'bandpass', q = 1, f1) {
    if (!this.ctx || vol < 0.01) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }
  tone(vol, f0, f1, dur, type = 'sine') {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  shot(kind, vol = 1) {
    if (kind === 'ak') {
      this.burst(0.9 * vol, 1400, 0.18, 'bandpass', 0.7, 300);
      this.tone(0.5 * vol, 160, 50, 0.12, 'triangle');
    } else if (kind === 'pistol') {
      this.burst(0.8 * vol, 2200, 0.14, 'bandpass', 0.8, 500);
      this.tone(0.4 * vol, 220, 60, 0.1, 'triangle');
    } else if (kind === 'punch') {
      this.burst(0.5 * vol, 300, 0.08, 'lowpass', 1);
    }
  }
  click() { this.tone(0.2, 2000, 1500, 0.03, 'square'); }
  reload() { this.burst(0.25, 3000, 0.05, 'highpass'); setTimeout(() => this.burst(0.3, 2500, 0.06, 'highpass'), 380); }
  crash(v) { this.burst(0.9 * v, 500, 0.35, 'lowpass', 1, 120); this.burst(0.4 * v, 3000, 0.2, 'highpass'); }
  thud(v) { this.tone(0.6 * v, 120, 40, 0.18, 'sine'); }
  explode(v) { this.burst(1.2 * v, 900, 1.6, 'lowpass', 0.8, 60); this.tone(0.9 * v, 90, 30, 0.8, 'sine'); }
  pickup() { this.tone(0.25, 660, 1320, 0.15, 'triangle'); setTimeout(() => this.tone(0.2, 990, 1760, 0.12, 'triangle'), 90); }
  hurt() { this.tone(0.25, 300, 120, 0.15, 'sawtooth'); }
  door() { this.burst(0.35, 600, 0.1, 'lowpass', 2); }
  star() { this.tone(0.2, 880, 440, 0.25, 'square'); }
  honkAt(p) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastHonk < 1.5) return;
    this.lastHonk = now;
    const v = this.dist(p) * 0.35;
    const g = this.hornG.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(v, now);
    g.setValueAtTime(0, now + 0.35);
  }
  horn(on) {
    if (!this.ctx) return;
    this.hornG.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.02);
  }
  engine(on, rpm, thr) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.eng.gain.setTargetAtTime(on ? 0.06 + thr * 0.08 : 0, t, 0.08);
    const f = 38 + rpm * 120;
    this.o1.frequency.setTargetAtTime(f, t, 0.05);
    this.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engF.frequency.setTargetAtTime(400 + rpm * 1400 + thr * 500, t, 0.05);
  }
  siren(v, time) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sir.gain.setTargetAtTime(v * 0.08, t, 0.1);
    const f = (Math.floor(time * 1.5) % 2 ? 440 : 587); // Martinshorn: tatü-tata
    this.so.frequency.setTargetAtTime(f, t, 0.03);
  }
}
