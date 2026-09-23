/**
 * Unified Storage Manager for OmniDesk
 * Local-First IndexedDB + GitHub Gist Free Cloud Sync + JSON Export/Import
 */

class StorageManager {
  constructor() {
    this.dbName = 'OmniDeskDB';
    this.dbVersion = 1;
    this.db = null;
    this.isReady = false;
    this.listeners = new Map(); // event -> callbacks
    this.initPromise = this.initDB();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported, falling back to localStorage');
        this.isReady = true;
        resolve(false);
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('collections')) {
          db.createObjectStore('collections', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.isReady = true;
        resolve(true);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        this.isReady = true;
        resolve(false);
      };
    });
  }

  // Event Subscription for real-time reactivity
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }

  async getCollection(name, defaultValue = []) {
    await this.initPromise;
    if (this.db) {
      return new Promise((resolve) => {
        try {
          const transaction = this.db.transaction(['collections'], 'readonly');
          const store = transaction.objectStore('collections');
          const request = store.get(name);
          request.onsuccess = () => {
            if (request.result && request.result.data !== undefined) {
              resolve(request.result.data);
            } else {
              resolve(defaultValue);
            }
          };
          request.onerror = () => resolve(defaultValue);
        } catch (e) {
          resolve(defaultValue);
        }
      });
    } else {
      // LocalStorage fallback
      try {
        const val = localStorage.getItem(`omnidesk_${name}`);
        return val ? JSON.parse(val) : defaultValue;
      } catch (e) {
        return defaultValue;
      }
    }
  }

  async saveCollection(name, data) {
    await this.initPromise;
    if (this.db) {
      return new Promise((resolve, reject) => {
        try {
          const transaction = this.db.transaction(['collections'], 'readwrite');
          const store = transaction.objectStore('collections');
          store.put({ id: name, data: data, updatedAt: Date.now() });
          transaction.oncomplete = () => {
            this.emit(`change:${name}`, data);
            this.handleAutoCloudSync();
            resolve(true);
          };
          transaction.onerror = (err) => reject(err);
        } catch (e) {
          reject(e);
        }
      });
    } else {
      try {
        localStorage.setItem(`omnidesk_${name}`, JSON.stringify(data));
        this.emit(`change:${name}`, data);
        this.handleAutoCloudSync();
        return true;
      } catch (e) {
        return false;
      }
    }
  }

  // Backup & Restore
  async exportAllData() {
    const todos = await this.getCollection('todos', []);
    const notes = await this.getCollection('notes', []);
    const journals = await this.getCollection('journals', []);
    const scratchpad = await this.getCollection('scratchpad', '');
    const settings = await this.getCollection('settings', {});

    return {
      version: 1,
      appName: 'OmniDesk',
      exportedAt: new Date().toISOString(),
      data: { todos, notes, journals, scratchpad, settings }
    };
  }

  async importAllData(payload) {
    if (!payload || !payload.data) {
      throw new Error('Invalid backup file format');
    }
    const { todos, notes, journals, scratchpad, settings } = payload.data;
    if (todos) await this.saveCollection('todos', todos);
    if (notes) await this.saveCollection('notes', notes);
    if (journals) await this.saveCollection('journals', journals);
    if (scratchpad !== undefined) await this.saveCollection('scratchpad', scratchpad);
    if (settings) await this.saveCollection('settings', settings);

    this.emit('restore', payload.data);
    return true;
  }

  // GitHub Gist Cloud Sync (100% Free Forever)
  async getSyncSettings() {
    return await this.getCollection('settings', {
      githubToken: '',
      gistId: '',
      autoSync: false,
      lastSync: null
    });
  }

  async saveSyncSettings(settings) {
    const current = await this.getSyncSettings();
    const updated = { ...current, ...settings };
    await this.saveCollection('settings', updated);
    return updated;
  }

  async syncToGitHubGist() {
    const settings = await this.getSyncSettings();
    const token = (settings.githubToken || '').trim();
    if (!token) {
      throw new Error('Please enter a GitHub Personal Access Token in Sync Settings.');
    }

    const exportPayload = await this.exportAllData();
    const content = JSON.stringify(exportPayload, null, 2);
    const fileName = 'omnidesk_sync_data.json';

    let gistId = (settings.gistId || '').trim();

    if (gistId) {
      // Update existing Gist
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: 'OmniDesk Personal Productivity Cloud Sync Data',
          files: {
            [fileName]: { content: content }
          }
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update Gist (${res.status})`);
      }
    } else {
      // Create new private Gist
      const res = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: 'OmniDesk Personal Productivity Cloud Sync Data',
          public: false,
          files: {
            [fileName]: { content: content }
          }
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create Gist (${res.status})`);
      }

      const createdGist = await res.json();
      gistId = createdGist.id;
      await this.saveSyncSettings({ gistId: gistId });
    }

    const lastSyncTime = new Date().toISOString();
    await this.saveSyncSettings({ lastSync: lastSyncTime });
    this.emit('sync:complete', { type: 'push', gistId, lastSync: lastSyncTime });
    return { gistId, lastSync: lastSyncTime };
  }

  async pullFromGitHubGist() {
    const settings = await this.getSyncSettings();
    const token = (settings.githubToken || '').trim();
    const gistId = (settings.gistId || '').trim();

    if (!token || !gistId) {
      throw new Error('Please ensure both GitHub Token and Gist ID are configured.');
    }

    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch cloud backup (${res.status})`);
    }

    const gistData = await res.json();
    const file = gistData.files && gistData.files['omnidesk_sync_data.json'];
    if (!file || !file.content) {
      throw new Error('Sync file not found in Gist.');
    }

    const parsed = JSON.parse(file.content);
    await this.importAllData(parsed);

    const lastSyncTime = new Date().toISOString();
    await this.saveSyncSettings({ lastSync: lastSyncTime });
    this.emit('sync:complete', { type: 'pull', gistId, lastSync: lastSyncTime });
    return { lastSync: lastSyncTime };
  }

  handleAutoCloudSync() {
    // Debounced cloud sync
    if (this._autoSyncTimer) clearTimeout(this._autoSyncTimer);
    this._autoSyncTimer = setTimeout(async () => {
      const settings = await this.getSyncSettings();
      if (settings.autoSync && settings.githubToken && settings.gistId) {
        try {
          await this.syncToGitHubGist();
          console.log('Auto-synced to GitHub Gist');
        } catch (e) {
          console.warn('Auto-sync notice:', e.message);
        }
      }
    }, 4000);
  }
}

// Global Singleton
window.storage = new StorageManager();
