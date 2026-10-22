export class RainAudio {
  constructor(contextFactory = () => {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw Error('Audio unavailable');
    return new Context();
  }) { this.factory = contextFactory; this.context = null; this.volume = 0.18; this.generation = 0; }
  async start() {
    this.stop(); const generation = ++this.generation;
    const context = this.factory(); this.context = context;
    try {
      await context.resume();
      if (generation !== this.generation || this.context !== context) return;
      const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
      const samples = buffer.getChannelData(0); let last = 0;
      for (let i = 0; i < samples.length; i++) { last = (last + Math.random() * 0.12 - 0.06) / 1.02; samples[i] = last * 3.5; }
      this.source = context.createBufferSource(); this.source.buffer = buffer; this.source.loop = true;
      this.gain = context.createGain(); this.gain.gain.value = this.volume;
      this.source.connect(this.gain); this.gain.connect(context.destination); this.source.start();
    } catch (error) {
      const active = generation === this.generation;
      if (active) { this.stop(); throw error; }
    }
  }
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(0.6, volume));
    if (this.gain && this.context) this.gain.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.15);
  }
  stop() {
    this.generation++;
    if (this.source) { try { this.source.stop(); } catch {} }
    const context = this.context; this.context = null; this.source = null; this.gain = null;
    if (context) { try { Promise.resolve(context.close()).catch(() => {}); } catch {} }
  }
}
