export const DURATIONS = { breath: 60, sound: 180, move: 120 };

export class PracticeSession {
  constructor(kind, { now = () => performance.now(), setTimer = (callback, ms) => globalThis.setInterval(callback, ms), clearTimer = id => globalThis.clearInterval(id),
    onUpdate = () => {}, onComplete = () => {} } = {}) {
    this.duration = DURATIONS[kind];
    if (!this.duration) throw Error('Unknown practice');
    Object.assign(this, { kind, now, setTimer, clearTimer, onUpdate, onComplete });
    this.remaining = this.duration; this.running = false; this.disposed = false; this.completed = false; this.timer = null;
  }
  state() { return { kind: this.kind, remaining: this.remaining, elapsed: this.duration - this.remaining,
    running: this.running, completed: this.completed }; }
  emit() { this.onUpdate(this.state()); }
  start() {
    if (this.disposed || this.running || this.completed) return;
    this.running = true; this.endAt = this.now() + this.remaining * 1000;
    this.timer = this.setTimer(() => this.tick(), 100); this.emit();
  }
  tick() {
    if (!this.running || this.disposed) return;
    this.remaining = Math.max(0, Math.ceil((this.endAt - this.now()) / 1000));
    if (this.remaining === 0) {
      this.stopTimer(); this.completed = true; this.emit(); this.onComplete();
    } else this.emit();
  }
  stopTimer() { this.running = false; if (this.timer !== null) this.clearTimer(this.timer); this.timer = null; }
  pause() {
    if (!this.running) return;
    this.remaining = Math.max(0, Math.ceil((this.endAt - this.now()) / 1000));
    this.stopTimer(); this.emit();
  }
  reset() {
    if (this.disposed) return;
    this.stopTimer(); this.remaining = this.duration; this.completed = false; this.emit();
  }
  dispose() { this.disposed = true; this.stopTimer(); }
}
