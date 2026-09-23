/**
 * OmniDesk Quick Notes Module
 * Scratchpad auto-save and card-based notes with pinning, colors, and search.
 */

class NotesModule {
  constructor() {
    this.notes = [];
    this.scratchpadText = '';
    this.searchQuery = '';
    this._scratchpadTimer = null;

    // DOM Elements
    this.scratchpadEl = null;
    this.scratchpadStatusEl = null;
    this.notesGridEl = null;
    this.searchInput = null;
    this.addNoteModal = null;
    this.openAddNoteBtn = null;
    this.closeModalBtn = null;
    this.saveNoteBtn = null;
    this.noteTitleInput = null;
    this.noteBodyInput = null;
    this.noteColorSelect = null;
    this.notePinCheckbox = null;
  }

  async init() {
    this.scratchpadEl = document.getElementById('scratchpadTextarea');
    this.scratchpadStatusEl = document.getElementById('scratchpadStatus');
    this.notesGridEl = document.getElementById('notesGrid');
    this.searchInput = document.getElementById('notesSearchInput');
    this.addNoteModal = document.getElementById('addNoteModal');
    this.openAddNoteBtn = document.getElementById('openAddNoteBtn');
    this.closeModalBtn = document.getElementById('closeNoteModalBtn');
    this.saveNoteBtn = document.getElementById('saveNoteModalBtn');
    this.noteTitleInput = document.getElementById('modalNoteTitle');
    this.noteBodyInput = document.getElementById('modalNoteBody');
    this.noteColorSelect = document.getElementById('modalNoteColor');
    this.notePinCheckbox = document.getElementById('modalNotePin');

    // Load initial data
    this.scratchpadText = await window.storage.getCollection('scratchpad', 'Draft your quick thoughts here... it auto-saves!');
    if (this.scratchpadEl) this.scratchpadEl.value = this.scratchpadText;

    this.notes = await window.storage.getCollection('notes', [
      {
        id: 'note-sample-1',
        title: 'Project Ideas 💡',
        body: '1. Build personal productivity dashboard\n2. Host on GitHub Pages\n3. Sync notes across phone and laptop',
        color: 'blue',
        pinned: true,
        updatedAt: Date.now()
      },
      {
        id: 'note-sample-2',
        title: 'Quick Shortcuts ⚡',
        body: '• Spacebar toggles timer start/pause\n• Add to Home Screen in Safari/Chrome for PWA standalone mode',
        color: 'yellow',
        pinned: false,
        updatedAt: Date.now()
      }
    ]);

    this.bindEvents();
    this.render();

    // Listen for storage events
    window.storage.on('change:notes', (updated) => {
      this.notes = updated;
      this.render();
    });

    window.storage.on('change:scratchpad', (updated) => {
      this.scratchpadText = updated;
      if (this.scratchpadEl && this.scratchpadEl.value !== updated) {
        this.scratchpadEl.value = updated;
      }
    });

    window.storage.on('restore', (data) => {
      if (data) {
        if (data.notes) this.notes = data.notes;
        if (data.scratchpad !== undefined) {
          this.scratchpadText = data.scratchpad;
          if (this.scratchpadEl) this.scratchpadEl.value = data.scratchpad;
        }
        this.render();
      }
    });
  }

  bindEvents() {
    // Scratchpad auto-save (debounced 500ms)
    this.scratchpadEl?.addEventListener('input', () => {
      if (this.scratchpadStatusEl) this.scratchpadStatusEl.textContent = 'Saving...';
      clearTimeout(this._scratchpadTimer);
      this._scratchpadTimer = setTimeout(async () => {
        this.scratchpadText = this.scratchpadEl.value;
        await window.storage.saveCollection('scratchpad', this.scratchpadText);
        if (this.scratchpadStatusEl) this.scratchpadStatusEl.textContent = 'All changes saved';
      }, 500);
    });

    // Modal open/close
    this.openAddNoteBtn?.addEventListener('click', () => {
      this.openModal();
    });

    this.closeModalBtn?.addEventListener('click', () => {
      this.closeModal();
    });

    // Save note
    this.saveNoteBtn?.addEventListener('click', () => this.saveNote());

    // Search filter
    this.searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.render();
    });
  }

  openModal() {
    if (this.noteTitleInput) this.noteTitleInput.value = '';
    if (this.noteBodyInput) this.noteBodyInput.value = '';
    if (this.notePinCheckbox) this.notePinCheckbox.checked = false;
    if (this.addNoteModal) this.addNoteModal.classList.add('active');
  }

  closeModal() {
    if (this.addNoteModal) this.addNoteModal.classList.remove('active');
  }

  async saveNote() {
    const title = (this.noteTitleInput?.value || '').trim() || 'Untitled Note';
    const body = (this.noteBodyInput?.value || '').trim();
    const color = this.noteColorSelect?.value || 'blue';
    const pinned = this.notePinCheckbox?.checked || false;

    if (!body && !title) return;

    const newNote = {
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title,
      body,
      color,
      pinned,
      updatedAt: Date.now()
    };

    this.notes.unshift(newNote);
    await window.storage.saveCollection('notes', this.notes);

    this.closeModal();
    this.render();
    window.app?.showToast('Note saved', 'success');
  }

  async togglePin(id) {
    const note = this.notes.find(n => n.id === id);
    if (note) {
      note.pinned = !note.pinned;
      await window.storage.saveCollection('notes', this.notes);
      this.render();
    }
  }

  async deleteNote(id) {
    this.notes = this.notes.filter(n => n.id !== id);
    await window.storage.saveCollection('notes', this.notes);
    this.render();
    window.app?.showToast('Note deleted', 'warning');
  }

  copyNote(id) {
    const note = this.notes.find(n => n.id === id);
    if (note) {
      const text = `${note.title}\n\n${note.body}`;
      navigator.clipboard.writeText(text).then(() => {
        window.app?.showToast('Copied note to clipboard', 'success');
      }).catch(() => {
        window.app?.showToast('Could not copy', 'error');
      });
    }
  }

  render() {
    if (!this.notesGridEl) return;

    // Filter by search
    let filtered = this.notes.filter(n => {
      if (!this.searchQuery) return true;
      return n.title.toLowerCase().includes(this.searchQuery) ||
             n.body.toLowerCase().includes(this.searchQuery);
    });

    // Pinned notes first, then chronological
    filtered.sort((a, b) => {
      if (a.pinned === b.pinned) return b.updatedAt - a.updatedAt;
      return a.pinned ? -1 : 1;
    });

    if (filtered.length === 0) {
      this.notesGridEl.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p>No notes found. Click "Add Note" to create one!</p>
        </div>
      `;
      return;
    }

    this.notesGridEl.innerHTML = filtered.map(note => `
      <div class="note-card color-${note.color} ${note.pinned ? 'pinned' : ''}" data-id="${note.id}">
        <div class="note-card-top">
          <h4 class="note-card-title">${this.escapeHtml(note.title)}</h4>
          <span class="pin-indicator ${note.pinned ? '' : 'inactive'}" onclick="window.notesModule.togglePin('${note.id}')" title="${note.pinned ? 'Unpin Note' : 'Pin Note'}">
            📌
          </span>
        </div>
        <div class="note-card-body">${this.escapeHtml(note.body)}</div>
        <div class="note-card-footer">
          <span>${new Date(note.updatedAt).toLocaleDateString()}</span>
          <div class="note-card-actions">
            <button class="todo-action-btn" onclick="window.notesModule.copyNote('${note.id}')" title="Copy Content">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
            <button class="todo-action-btn delete" onclick="window.notesModule.deleteNote('${note.id}')" title="Delete Note">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `).join('');
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

// Global Notes Module
window.notesModule = new NotesModule();
