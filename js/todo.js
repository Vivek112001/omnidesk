/**
 * OmniDesk To-Do List Module
 * Task management with categories, priority flags, due dates, and search.
 */

class TodoModule {
  constructor() {
    this.todos = [];
    this.currentCategory = 'all';
    this.currentStatusFilter = 'all'; // all, active, completed
    this.searchQuery = '';

    // DOM Elements
    this.listEl = null;
    this.inputTitle = null;
    this.selectCategory = null;
    this.selectPriority = null;
    this.inputDueDate = null;
    this.addBtn = null;
    this.categoryTabsContainer = null;
    this.searchInput = null;
  }

  async init() {
    this.listEl = document.getElementById('todoList');
    this.inputTitle = document.getElementById('todoInputTitle');
    this.selectCategory = document.getElementById('todoSelectCategory');
    this.selectPriority = document.getElementById('todoSelectPriority');
    this.inputDueDate = document.getElementById('todoInputDueDate');
    this.addBtn = document.getElementById('todoAddBtn');
    this.categoryTabsContainer = document.getElementById('todoCategoryTabs');
    this.searchInput = document.getElementById('todoSearchInput');

    // Load initial data
    this.todos = await window.storage.getCollection('todos', [
      {
        id: 'todo-sample-1',
        title: 'Welcome to OmniDesk! Try adding your tasks.',
        category: 'Personal',
        priority: 'medium',
        dueDate: '',
        completed: false,
        createdAt: Date.now()
      },
      {
        id: 'todo-sample-2',
        title: 'Check Sync Settings to connect free GitHub Gist sync.',
        category: 'Work',
        priority: 'high',
        dueDate: '',
        completed: false,
        createdAt: Date.now()
      }
    ]);

    this.bindEvents();
    this.render();

    // Listen for storage changes
    window.storage.on('change:todos', (updated) => {
      this.todos = updated;
      this.render();
    });

    window.storage.on('restore', (data) => {
      if (data && data.todos) {
        this.todos = data.todos;
        this.render();
      }
    });
  }

  bindEvents() {
    // Add task on button click or Enter key
    this.addBtn?.addEventListener('click', () => this.addTask());
    this.inputTitle?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.addTask();
    });

    // Category filter tabs
    this.categoryTabsContainer?.addEventListener('click', (e) => {
      const tab = e.target.closest('.category-tab');
      if (tab) {
        document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentCategory = tab.dataset.category || 'all';
        this.render();
      }
    });

    // Search filter
    this.searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.render();
    });
  }

  async addTask() {
    const title = (this.inputTitle?.value || '').trim();
    if (!title) return;

    const category = this.selectCategory?.value || 'Personal';
    const priority = this.selectPriority?.value || 'medium';
    const dueDate = this.inputDueDate?.value || '';

    const newTodo = {
      id: 'todo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title,
      category,
      priority,
      dueDate,
      completed: false,
      createdAt: Date.now()
    };

    this.todos.unshift(newTodo);
    await window.storage.saveCollection('todos', this.todos);

    // Reset input
    if (this.inputTitle) this.inputTitle.value = '';
    this.render();
    window.app?.showToast('Task added successfully', 'success');
  }

  async toggleTodo(id) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
      await window.storage.saveCollection('todos', this.todos);
      this.render();
    }
  }

  async deleteTodo(id) {
    this.todos = this.todos.filter(t => t.id !== id);
    await window.storage.saveCollection('todos', this.todos);
    this.render();
    window.app?.showToast('Task removed', 'warning');
  }

  render() {
    if (!this.listEl) return;

    let filtered = this.todos.filter(t => {
      const matchesCategory = this.currentCategory === 'all' || t.category.toLowerCase() === this.currentCategory.toLowerCase();
      const matchesSearch = !this.searchQuery || t.title.toLowerCase().includes(this.searchQuery);
      return matchesCategory && matchesSearch;
    });

    // Update badge in sidebar navigation
    const activeCount = this.todos.filter(t => !t.completed).length;
    const badge = document.getElementById('todoNavBadge');
    if (badge) badge.textContent = activeCount.toString();

    if (filtered.length === 0) {
      this.listEl.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
          </svg>
          <p>No tasks found. Add a new task above!</p>
        </div>
      `;
      return;
    }

    this.listEl.innerHTML = filtered.map(todo => `
      <li class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
        <div class="todo-left">
          <div class="todo-checkbox" onclick="window.todoModule.toggleTodo('${todo.id}')">
            <svg viewBox="0 0 24 24" fill="none">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div class="todo-content">
            <span class="todo-title">${this.escapeHtml(todo.title)}</span>
            <div class="todo-tags-row">
              <span class="priority-pill ${todo.priority}">${todo.priority}</span>
              <span class="category-badge">${this.escapeHtml(todo.category)}</span>
              ${todo.dueDate ? `<span class="due-date-badge">📅 ${todo.dueDate}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="todo-actions">
          <button class="todo-action-btn delete" onclick="window.todoModule.deleteTodo('${todo.id}')" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </li>
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

// Global Todo Module
window.todoModule = new TodoModule();
