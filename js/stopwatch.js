/**
 * OmniDesk Stopwatch Module
 * Precision millisecond tracking with lap times, splits, and fastest/slowest lap detection.
 */

class StopwatchModule {
  constructor() {
    this.startTime = 0;
    this.elapsedTime = 0;
    this.isRunning = false;
    this.animationFrame = null;
    this.laps = []; // { id, lapTime, splitTime }
    this.lastLapTime = 0;

    // DOM Elements
    this.mainTimeEl = null;
    this.msTimeEl = null;
    this.startBtn = null;
    this.pauseBtn = null;
    this.lapBtn = null;
    this.resetBtn = null;
    this.lapsListEl = null;
    this.lapsContainer = null;
  }

  init() {
    this.mainTimeEl = document.getElementById('stopwatchMainTime');
    this.msTimeEl = document.getElementById('stopwatchMsTime');
    this.startBtn = document.getElementById('stopwatchStartBtn');
    this.pauseBtn = document.getElementById('stopwatchPauseBtn');
    this.lapBtn = document.getElementById('stopwatchLapBtn');
    this.resetBtn = document.getElementById('stopwatchResetBtn');
    this.lapsListEl = document.getElementById('stopwatchLapsList');
    this.lapsContainer = document.getElementById('stopwatchLapsCard');

    this.bindEvents();
    this.updateDisplay(0);
  }

  bindEvents() {
    this.startBtn?.addEventListener('click', () => this.start());
    this.pauseBtn?.addEventListener('click', () => this.pause());
    this.lapBtn?.addEventListener('click', () => this.recordLap());
    this.resetBtn?.addEventListener('click', () => this.reset());
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = performance.now() - this.elapsedTime;

    if (this.startBtn) this.startBtn.style.display = 'none';
    if (this.pauseBtn) this.pauseBtn.style.display = 'inline-flex';
    if (this.lapBtn) this.lapBtn.disabled = false;

    this.loop();
  }

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    cancelAnimationFrame(this.animationFrame);

    if (this.startBtn) {
      this.startBtn.style.display = 'inline-flex';
      this.startBtn.textContent = 'Resume';
    }
    if (this.pauseBtn) this.pauseBtn.style.display = 'none';
    if (this.lapBtn) this.lapBtn.disabled = true;
  }

  reset() {
    this.isRunning = false;
    cancelAnimationFrame(this.animationFrame);
    this.elapsedTime = 0;
    this.startTime = 0;
    this.lastLapTime = 0;
    this.laps = [];

    if (this.startBtn) {
      this.startBtn.style.display = 'inline-flex';
      this.startBtn.textContent = 'Start';
    }
    if (this.pauseBtn) this.pauseBtn.style.display = 'none';
    if (this.lapBtn) this.lapBtn.disabled = true;

    this.updateDisplay(0);
    this.renderLaps();
  }

  recordLap() {
    if (!this.isRunning) return;
    const currentSplit = this.elapsedTime;
    const lapDuration = currentSplit - this.lastLapTime;
    this.lastLapTime = currentSplit;

    const lapNumber = this.laps.length + 1;
    this.laps.unshift({
      number: lapNumber,
      lapDuration,
      splitDuration: currentSplit
    });

    this.renderLaps();
  }

  loop() {
    if (!this.isRunning) return;
    this.elapsedTime = performance.now() - this.startTime;
    this.updateDisplay(this.elapsedTime);
    this.animationFrame = requestAnimationFrame(() => this.loop());
  }

  updateDisplay(ms) {
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);

    const pad = (n) => n.toString().padStart(2, '0');

    if (this.mainTimeEl) {
      if (hours > 0) {
        this.mainTimeEl.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      } else {
        this.mainTimeEl.textContent = `${pad(minutes)}:${pad(seconds)}`;
      }
    }

    if (this.msTimeEl) {
      this.msTimeEl.textContent = `.${pad(centiseconds)}`;
    }
  }

  renderLaps() {
    if (!this.lapsListEl) return;

    if (this.laps.length === 0) {
      if (this.lapsContainer) this.lapsContainer.style.display = 'none';
      this.lapsListEl.innerHTML = '';
      return;
    }

    if (this.lapsContainer) this.lapsContainer.style.display = 'flex';

    // Find fastest and slowest if laps >= 2
    let minIdx = -1;
    let maxIdx = -1;
    if (this.laps.length >= 2) {
      let minDuration = Infinity;
      let maxDuration = -Infinity;
      this.laps.forEach((lap, idx) => {
        if (lap.lapDuration < minDuration) {
          minDuration = lap.lapDuration;
          minIdx = idx;
        }
        if (lap.lapDuration > maxDuration) {
          maxDuration = lap.lapDuration;
          maxIdx = idx;
        }
      });
    }

    this.lapsListEl.innerHTML = this.laps.map((lap, idx) => {
      let rowClass = 'lap-row';
      let badgeHtml = '';

      if (idx === minIdx) {
        rowClass += ' fastest';
        badgeHtml = '<span class="lap-badge fastest">Fastest</span>';
      } else if (idx === maxIdx) {
        rowClass += ' slowest';
        badgeHtml = '<span class="lap-badge slowest">Slowest</span>';
      }

      return `
        <tr class="${rowClass}">
          <td>#${lap.number.toString().padStart(2, '0')} ${badgeHtml}</td>
          <td>${this.formatMs(lap.lapDuration)}</td>
          <td>${this.formatMs(lap.splitDuration)}</td>
        </tr>
      `;
    }).join('');
  }

  formatMs(ms) {
    const totalSec = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    const cs = Math.floor((ms % 1000) / 10);
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(minutes)}:${pad(seconds)}.${pad(cs)}`;
  }
}

// Global Stopwatch
window.stopwatchModule = new StopwatchModule();
