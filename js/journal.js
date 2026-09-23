/**
 * OmniDesk My Journals Module
 * Daily journaling, mood tracking, date-based persistence, archive & streaks.
 */

class JournalModule {
  constructor() {
    this.journals = []; // Array of { id, date: 'YYYY-MM-DD', title, content, mood, updatedAt }
    this.currentDate = this.getTodayDateString();
    this.selectedMood = '😊';
    this.currentViewMode = 'write'; // 'write' or 'archive'
    this._saveTimer = null;

    // DOM Elements
    this.dateDisplayEl = null;
    this.dateInputEl = null;
    this.prevDayBtn = null;
    this.nextDayBtn = null;
    this.todayBtn = null;
    this.titleInput = null;
    this.contentInput = null;
    this.moodButtons = [];
    this.saveStatusEl = null;
    this.wordCountEl = null;
    this.streakEl = null;
    this.archiveContainer = null;
    this.writeContainer = null;
    this.tabWriteBtn = null;
    this.tabArchiveBtn = null;
    this.archiveListEl = null;
    this.archiveSearchInput = null;
  }

  async init() {
    this.dateDisplayEl = document.getElementById('journalDateDisplay');
    this.dateInputEl = document.getElementById('journalDateInput');
    this.prevDayBtn = document.getElementById('journalPrevDayBtn');
    this.nextDayBtn = document.getElementById('journalNextDayBtn');
    this.todayBtn = document.getElementById('journalTodayBtn');
    this.titleInput = document.getElementById('journalTitleInput');
    this.contentInput = document.getElementById('journalContentInput');
    this.saveStatusEl = document.getElementById('journalSaveStatus');
    this.wordCountEl = document.getElementById('journalWordCount');
    this.streakEl = document.getElementById('journalStreakCount');
    this.archiveContainer = document.getElementById('journalArchiveContainer');
    this.writeContainer = document.getElementById('journalWriteContainer');
    this.tabWriteBtn = document.getElementById('journalTabWrite');
    this.tabArchiveBtn = document.getElementById('journalTabArchive');
    this.archiveListEl = document.getElementById('journalArchiveList');
    this.archiveSearchInput = document.getElementById('journalArchiveSearch');

    // Load initial data
    this.journals = await window.storage.getCollection('journals', [
      {
        id: 'journal-sample-1',
        date: this.getTodayDateString(),
        title: 'Starting my OmniDesk Journal',
        content: 'Excited to have an all-in-one productivity suite that runs directly in my browser, works offline, and syncs across all my devices for free!',
        mood: '⚡',
        updatedAt: Date.now()
      }
    ]);

    this.bindEvents();
    this.loadEntryForDate(this.currentDate);
    this.calculateStreak();

    // Listen for storage events
    window.storage.on('change:journals', (updated) => {
      this.journals = updated;
      this.calculateStreak();
      if (this.currentViewMode === 'archive') this.renderArchive();
    });

    window.storage.on('restore', (data) => {
      if (data && data.journals) {
        this.journals = data.journals;
        this.loadEntryForDate(this.currentDate);
        this.calculateStreak();
        if (this.currentViewMode === 'archive') this.renderArchive();
      }
    });
  }

  getTodayDateString() {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }

  bindEvents() {
    // Date Navigation
    this.prevDayBtn?.addEventListener('click', () => this.shiftDate(-1));
    this.nextDayBtn?.addEventListener('click', () => this.shiftDate(1));
    this.todayBtn?.addEventListener('click', () => {
      this.currentDate = this.getTodayDateString();
      this.loadEntryForDate(this.currentDate);
    });

    this.dateInputEl?.addEventListener('change', (e) => {
      if (e.target.value) {
        this.currentDate = e.target.value;
        this.loadEntryForDate(this.currentDate);
      }
    });

    // Mood buttons
    const moodBtns = document.querySelectorAll('.mood-btn');
    moodBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        moodBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedMood = btn.dataset.mood;
        this.triggerAutoSave();
      });
    });

    // Prompt chips
    const promptChips = document.querySelectorAll('.prompt-chip');
    promptChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.dataset.prompt || chip.textContent;
        if (this.contentInput) {
          const current = this.contentInput.value.trim();
          this.contentInput.value = current ? `${current}\n\n**${text}**\n` : `**${text}**\n`;
          this.contentInput.focus();
          this.triggerAutoSave();
          this.updateStats();
        }
      });
    });

    // Auto-save on typing (debounced 600ms)
    this.titleInput?.addEventListener('input', () => this.triggerAutoSave());
    this.contentInput?.addEventListener('input', () => {
      this.triggerAutoSave();
      this.updateStats();
    });

    // Tab switcher between Write & Archive
    this.tabWriteBtn?.addEventListener('click', () => this.switchMode('write'));
    this.tabArchiveBtn?.addEventListener('click', () => this.switchMode('archive'));

    // Archive search
    this.archiveSearchInput?.addEventListener('input', () => this.renderArchive());
  }

  shiftDate(days) {
    const current = new Date(this.currentDate + 'T00:00:00');
    current.setDate(current.getDate() + days);
    this.currentDate = current.toISOString().split('T')[0];
    this.loadEntryForDate(this.currentDate);
  }

  loadEntryForDate(dateStr) {
    // Format friendly label
    const dateObj = new Date(dateStr + 'T00:00:00');
    const todayStr = this.getTodayDateString();

    let displayLabel = dateObj.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    if (dateStr === todayStr) {
      displayLabel = `Today (${displayLabel})`;
    }

    if (this.dateDisplayEl) this.dateDisplayEl.textContent = displayLabel;
    if (this.dateInputEl) this.dateInputEl.value = dateStr;

    // Find existing entry
    const entry = this.journals.find(j => j.date === dateStr);

    if (entry) {
      if (this.titleInput) this.titleInput.value = entry.title || '';
      if (this.contentInput) this.contentInput.value = entry.content || '';
      this.selectedMood = entry.mood || '😊';
    } else {
      if (this.titleInput) this.titleInput.value = '';
      if (this.contentInput) this.contentInput.value = '';
      this.selectedMood = '😊';
    }

    // Update mood button UI
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.mood === this.selectedMood);
    });

    if (this.saveStatusEl) this.saveStatusEl.textContent = entry ? 'Saved' : 'Draft';
    this.updateStats();
  }

  triggerAutoSave() {
    if (this.saveStatusEl) this.saveStatusEl.textContent = 'Saving...';
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      await this.saveCurrentEntry();
      if (this.saveStatusEl) this.saveStatusEl.textContent = 'All changes saved';
    }, 600);
  }

  async saveCurrentEntry() {
    const title = (this.titleInput?.value || '').trim();
    const content = (this.contentInput?.value || '').trim();

    if (!title && !content) {
      // If blank, remove entry if previously stored
      this.journals = this.journals.filter(j => j.date !== this.currentDate);
      await window.storage.saveCollection('journals', this.journals);
      return;
    }

    let entry = this.journals.find(j => j.date === this.currentDate);
    if (entry) {
      entry.title = title;
      entry.content = content;
      entry.mood = this.selectedMood;
      entry.updatedAt = Date.now();
    } else {
      entry = {
        id: 'journal_' + this.currentDate,
        date: this.currentDate,
        title: title || 'Journal Entry',
        content,
        mood: this.selectedMood,
        updatedAt: Date.now()
      };
      this.journals.unshift(entry);
    }

    await window.storage.saveCollection('journals', this.journals);
    this.calculateStreak();
  }

  updateStats() {
    const text = (this.contentInput?.value || '').trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;
    if (this.wordCountEl) {
      this.wordCountEl.textContent = `${words} words · ${chars} chars`;
    }
  }

  calculateStreak() {
    if (!this.journals || this.journals.length === 0) {
      if (this.streakEl) this.streakEl.textContent = '0 days';
      return;
    }

    const dates = new Set(this.journals.filter(j => (j.content || '').trim()).map(j => j.date));
    let streak = 0;
    const checkDate = new Date();

    // Check if wrote today
    const todayStr = checkDate.toISOString().split('T')[0];
    if (!dates.has(todayStr)) {
      // Check yesterday
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dStr = checkDate.toISOString().split('T')[0];
      if (dates.has(dStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    if (this.streakEl) this.streakEl.textContent = `${streak} ${streak === 1 ? 'day' : 'days'}`;
  }

  switchMode(mode) {
    this.currentViewMode = mode;
    if (mode === 'write') {
      this.tabWriteBtn?.classList.add('active');
      this.tabArchiveBtn?.classList.remove('active');
      if (this.writeContainer) this.writeContainer.style.display = 'flex';
      if (this.archiveContainer) this.archiveContainer.style.display = 'none';
      this.loadEntryForDate(this.currentDate);
    } else {
      this.tabWriteBtn?.classList.remove('active');
      this.tabArchiveBtn?.classList.add('active');
      if (this.writeContainer) this.writeContainer.style.display = 'none';
      if (this.archiveContainer) this.archiveContainer.style.display = 'flex';
      this.renderArchive();
    }
  }

  renderArchive() {
    if (!this.archiveListEl) return;

    const query = (this.archiveSearchInput?.value || '').toLowerCase().trim();

    let list = this.journals.filter(j => (j.content || '').trim() || (j.title || '').trim());
    if (query) {
      list = list.filter(j =>
        (j.title || '').toLowerCase().includes(query) ||
        (j.content || '').toLowerCase().includes(query) ||
        (j.date || '').includes(query) ||
        (j.mood || '').includes(query)
      );
    }

    list.sort((a, b) => b.date.localeCompare(a.date));

    if (list.length === 0) {
      this.archiveListEl.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          <p>No journal entries found matching search.</p>
        </div>
      `;
      return;
    }

    this.archiveListEl.innerHTML = list.map(entry => {
      const d = new Date(entry.date + 'T00:00:00');
      const formattedDate = d.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      return `
        <div class="journal-entry-card" style="cursor: pointer;" onclick="window.journalModule.openEntry('${entry.date}')">
          <div class="journal-entry-meta">
            <span style="font-weight: 600; color: var(--text-primary);">${formattedDate}</span>
            <span>Mood: <strong style="font-size: 16px;">${entry.mood || '😊'}</strong></span>
          </div>
          <h4 style="font-size: 16px; font-weight: 700; color: var(--accent-purple);">${this.escapeHtml(entry.title || 'Journal Entry')}</h4>
          <div class="journal-entry-body-preview">${this.escapeHtml(entry.content || '')}</div>
        </div>
      `;
    }).join('');
  }

  openEntry(dateStr) {
    this.currentDate = dateStr;
    this.switchMode('write');
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Global Journal Module
window.journalModule = new JournalModule();
