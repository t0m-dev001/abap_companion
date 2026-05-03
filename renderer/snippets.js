/**
 * BAPI Snippet Vault — Phase 3
 * Save any BAPI answer as a named snippet.
 * Browse and copy back to clipboard.
 * Stored in electron-store as { snippets: [...] }
 */

const SNIPPETS = {
  _snippets: [],
  _panelOpen: false,

  async init() {
    const saved = await window.bapi.storeGet('snippets');
    this._snippets = saved || [];
  },

  async save(content, title) {
    const snip = {
      id:      `sn_${Date.now()}`,
      title:   title || content.slice(0, 40).replace(/\n/g, ' ').trim() + '…',
      content,
      created: new Date().toISOString().slice(0, 16).replace('T', ' '),
    };
    this._snippets.unshift(snip);
    if (this._snippets.length > 200) this._snippets = this._snippets.slice(0, 200);
    await window.bapi.storeSet('snippets', this._snippets);
    return snip;
  },

  async delete(id) {
    this._snippets = this._snippets.filter(s => s.id !== id);
    await window.bapi.storeSet('snippets', this._snippets);
  },

  // ── Panel ─────────────────────────────────────────────────────────────────
  togglePanel() {
    if (this._panelOpen) this.closePanel();
    else this.showPanel();
  },

  showPanel() {
    if (document.getElementById('snippets-panel')) return;
    this._panelOpen = true;

    const panel = document.createElement('div');
    panel.id = 'snippets-panel';
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
          💾 Snippet Vault
        </span>
        <span style="font-size:.6875rem;color:var(--sapShell_TextColor);opacity:.7">
          ${this._snippets.length} saved
        </span>
        <button id="snippets-close" style="background:none;border:none;
          color:var(--sapShell_TextColor);font-size:1rem;cursor:pointer;
          width:32px;height:32px;display:flex;align-items:center;justify-content:center;
          border-radius:50%;transition:background .15s">✕</button>
      </div>
      <div style="padding:7px 10px;background:var(--sapGroup_ContentBackground);
        border-bottom:1px solid var(--sapList_BorderColor);flex-shrink:0">
        <input id="snippets-search" type="text" placeholder="Search snippets…"
          style="width:100%;background:var(--sapField_Background);
            border:1px solid var(--sapField_BorderColor);
            border-radius:var(--sapField_BorderRadius);
            color:var(--sapField_TextColor);font-family:var(--sapFontFamily);
            font-size:.75rem;padding:5px 9px;outline:none">
      </div>
      <div id="snippets-list" style="flex:1;overflow-y:auto;padding:4px 0"></div>
    `;

    document.getElementById('app').appendChild(panel);
    document.getElementById('snippets-close').addEventListener('click', () => this.closePanel());
    document.getElementById('snippets-search').addEventListener('input', (e) => {
      this._renderList(e.target.value.toLowerCase());
    });
    this._renderList('');
  },

  _renderList(query) {
    const list = document.getElementById('snippets-list');
    if (!list) return;

    const filtered = query
      ? this._snippets.filter(s =>
          s.title.toLowerCase().includes(query) ||
          s.content.toLowerCase().includes(query))
      : this._snippets;

    if (!filtered.length) {
      list.innerHTML = `
        <div style="padding:30px 20px;text-align:center;font-family:var(--sapFontFamily)">
          <div style="font-size:24px;margin-bottom:8px">💾</div>
          <div style="font-size:.75rem;color:var(--sapContent_LabelColor)">
            No snippets yet.<br>Hover any BAPI message and click 💾 to save it.
          </div>
        </div>`;
      return;
    }

    list.innerHTML = filtered.map(s => `
      <div class="snip-row" data-id="${s.id}"
        style="padding:8px 12px;border-bottom:1px solid var(--sapList_BorderColor);
          transition:background .1s;cursor:default">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div style="font-family:var(--sapFontFamily);font-size:.8125rem;
            color:var(--sapTextColor);font-weight:600;flex:1;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${s.title}
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0">
            <button class="snip-copy" data-id="${s.id}" title="Copy to clipboard"
              style="background:none;border:1px solid var(--sapButton_BorderColor);
                border-radius:var(--sapElement_BorderRadius);
                color:var(--sapContent_LabelColor);font-size:.625rem;
                padding:2px 6px;cursor:pointer;font-family:var(--sapFontFamily);
                transition:color .15s,border-color .15s">⎘</button>
            <button class="snip-del" data-id="${s.id}" title="Delete"
              style="background:none;border:1px solid var(--sapButton_BorderColor);
                border-radius:var(--sapElement_BorderRadius);
                color:var(--sapContent_LabelColor);font-size:.625rem;
                padding:2px 6px;cursor:pointer;font-family:var(--sapFontFamily);
                transition:color .15s">✕</button>
          </div>
        </div>
        <div style="font-family:var(--sapFontFamily);font-size:.6rem;
          color:var(--sapContent_LabelColor);margin-top:2px">
          ${s.created} · ${s.content.length} chars
        </div>
        <div style="font-family:'Courier New',monospace;font-size:.625rem;
          color:var(--sapContent_LabelColor);margin-top:4px;
          max-height:36px;overflow:hidden;
          border-left:2px solid var(--sapContent_ForegroundBorderColor);
          padding-left:6px;line-height:1.4">
          ${s.content.slice(0, 120).replace(/</g,'&lt;').replace(/>/g,'&gt;')}${s.content.length > 120 ? '…' : ''}
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.snip-row').forEach(row => {
      row.addEventListener('mouseenter', () => row.style.background = 'var(--sapList_HoverBackground)');
      row.addEventListener('mouseleave', () => row.style.background = '');
    });

    list.querySelectorAll('.snip-copy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const snip = this._snippets.find(s => s.id === btn.dataset.id);
        if (!snip) return;
        navigator.clipboard.writeText(snip.content).then(() => {
          btn.textContent = '✓';
          btn.style.color = 'var(--sapPositiveColor)';
          setTimeout(() => { btn.textContent = '⎘'; btn.style.color = ''; }, 1500);
        });
      });
    });

    list.querySelectorAll('.snip-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.delete(btn.dataset.id);
        this._renderList(document.getElementById('snippets-search')?.value?.toLowerCase() || '');
      });
    });
  },

  closePanel() {
    document.getElementById('snippets-panel')?.remove();
    this._panelOpen = false;
  },
};
