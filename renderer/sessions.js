/**
 * BAPI Session History — Phase 3
 * Daily sessions, searchable history panel, new session button.
 * Sessions stored in electron-store as { sessions: [...] }
 */

const SESSIONS = {
  _sessions:    [],
  _currentId:   null,
  _panelOpen:   false,

  // ── Init ──────────────────────────────────────────────────────────────────
  async init() {
    const saved = await window.bapi.storeGet('sessions');
    this._sessions = saved || [];
    // Start today's session
    this._ensureTodaySession();
  },

  _todayKey() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  },

  _ensureTodaySession() {
    const today = this._todayKey();
    let sess = this._sessions.find(s => s.date === today);
    if (!sess) {
      sess = { id: `s_${Date.now()}`, date: today, title: `Session ${today}`, messages: [] };
      this._sessions.unshift(sess);
    }
    this._currentId = sess.id;
  },

  getCurrentSession() {
    return this._sessions.find(s => s.id === this._currentId);
  },

  // ── Save a message to current session ────────────────────────────────────
  async addMessage(role, content) {
    const sess = this.getCurrentSession();
    if (!sess) return;
    sess.messages.push({ role, content, ts: Date.now() });
    // Auto-title from first user message
    if (sess.messages.length === 1 && role === 'user') {
      sess.title = content.slice(0, 50) + (content.length > 50 ? '…' : '');
    }
    await this._save();
  },

  async _save() {
    // Keep last 60 sessions max
    const trimmed = this._sessions.slice(0, 60);
    this._sessions = trimmed;
    await window.bapi.storeSet('sessions', trimmed);
  },

  // ── Start a new session ───────────────────────────────────────────────────
  async newSession() {
    const sess = { id: `s_${Date.now()}`, date: this._todayKey(), title: 'New Session', messages: [] };
    this._sessions.unshift(sess);
    this._currentId = sess.id;
    await this._save();
    return sess;
  },

  // ── History panel ─────────────────────────────────────────────────────────
  togglePanel(chatHistory, onLoadSession) {
    if (this._panelOpen) {
      this.closePanel();
    } else {
      this.showPanel(onLoadSession);
    }
  },

  showPanel(onLoadSession) {
    if (document.getElementById('sessions-panel')) return;
    this._panelOpen = true;

    const panel = document.createElement('div');
    panel.id = 'sessions-panel';
    panel.style.cssText = [
      'position:absolute;inset:0;z-index:200',
      'display:flex;flex-direction:column',
      'background:var(--sapBackgroundColor)',
      'border-radius:var(--sapContent_BorderRadius)',
      'animation:fadeSlide .18s ease-out',
    ].join(';');

    panel.innerHTML = `
      <div style="background:var(--sapShellColor);height:44px;
        display:flex;align-items:center;gap:8px;padding:0 14px;
        border-bottom:1px solid var(--sapShell_BorderColor);flex-shrink:0">
        <span style="font-family:var(--sapFontFamily);font-size:.875rem;
          font-weight:700;color:var(--sapShell_TextColor);flex:1">
          📚 Session History
        </span>
        <button id="sessions-new" style="background:var(--sapButton_Emphasized_Background);
          color:var(--sapButton_Emphasized_TextColor);
          border:1px solid var(--sapButton_Emphasized_BorderColor);
          border-radius:var(--sapButton_BorderRadius);
          font-family:var(--sapFontFamily);font-size:.6875rem;font-weight:700;
          padding:4px 10px;cursor:pointer">+ New</button>
        <button id="sessions-close" style="background:none;border:none;
          color:var(--sapShell_TextColor);font-size:1rem;cursor:pointer;
          width:32px;height:32px;display:flex;align-items:center;justify-content:center;
          border-radius:50%;transition:background .15s">✕</button>
      </div>
      <div style="padding:7px 10px;background:var(--sapGroup_ContentBackground);
        border-bottom:1px solid var(--sapList_BorderColor);flex-shrink:0">
        <input id="sessions-search" type="text" placeholder="Search sessions…"
          style="width:100%;background:var(--sapField_Background);
            border:1px solid var(--sapField_BorderColor);
            border-radius:var(--sapField_BorderRadius);
            color:var(--sapField_TextColor);font-family:var(--sapFontFamily);
            font-size:.75rem;padding:5px 9px;outline:none">
      </div>
      <div id="sessions-list" style="flex:1;overflow-y:auto;padding:4px 0"></div>
    `;

    document.getElementById('app').appendChild(panel);
    document.getElementById('sessions-close').addEventListener('click', () => this.closePanel());
    document.getElementById('sessions-search').addEventListener('input', (e) => {
      this._renderList(e.target.value.toLowerCase(), onLoadSession);
    });
    document.getElementById('sessions-new').addEventListener('click', async () => {
      await this.newSession();
      this.closePanel();
      if (onLoadSession) onLoadSession([], true);
    });

    this._renderList('', onLoadSession);
  },

  _renderList(query, onLoadSession) {
    const list = document.getElementById('sessions-list');
    if (!list) return;

    const filtered = query
      ? this._sessions.filter(s =>
          s.title.toLowerCase().includes(query) ||
          s.date.includes(query) ||
          s.messages.some(m => m.content.toLowerCase().includes(query)))
      : this._sessions;

    if (!filtered.length) {
      list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--sapContent_LabelColor);font-size:.75rem;font-family:var(--sapFontFamily)">No sessions found</div>`;
      return;
    }

    list.innerHTML = filtered.map(s => {
      const isCurrent = s.id === this._currentId;
      const msgCount  = s.messages.length;
      const preview   = s.messages.find(m => m.role === 'user')?.content?.slice(0, 55) || 'Empty session';
      return `
        <div class="sess-row" data-id="${s.id}"
          style="padding:9px 14px;cursor:pointer;
            border-bottom:1px solid var(--sapList_BorderColor);
            ${isCurrent ? 'background:var(--sapList_SelectionBackgroundColor);border-left:3px solid var(--sapHighlightColor)' : ''}
            transition:background .1s">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div style="font-family:var(--sapFontFamily);font-size:.8125rem;
              color:${isCurrent ? 'var(--sapHighlightColor)' : 'var(--sapTextColor)'};
              font-weight:${isCurrent ? '700' : '400'};
              max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${s.title}
            </div>
            <span style="font-size:.6rem;color:var(--sapContent_LabelColor);flex-shrink:0;margin-left:4px">${s.date}</span>
          </div>
          <div style="font-family:var(--sapFontFamily);font-size:.6rem;
            color:var(--sapContent_LabelColor);margin-top:2px;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${msgCount} msg${msgCount !== 1 ? 's' : ''} · ${preview}
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.sess-row').forEach(row => {
      row.addEventListener('mouseenter', () => { if (row.dataset.id !== this._currentId) row.style.background = 'var(--sapList_HoverBackground)'; });
      row.addEventListener('mouseleave', () => { if (row.dataset.id !== this._currentId) row.style.background = ''; });
      row.addEventListener('click', () => {
        const sess = this._sessions.find(s => s.id === row.dataset.id);
        if (!sess) return;
        this._currentId = sess.id;
        this.closePanel();
        if (onLoadSession) onLoadSession(sess.messages, false);
      });
    });
  },

  closePanel() {
    document.getElementById('sessions-panel')?.remove();
    this._panelOpen = false;
  },
};
