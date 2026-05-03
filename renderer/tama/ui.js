/**
 * BAPI Tamagotchi UI — Phase 2
 * Interaction bar, stats panel, food menu modal, evolution celebration.
 * Requires tamaEngine (engine.js) to be loaded first.
 */

const TAMA_UI = {

  // ── Interaction bar ────────────────────────────────────────────────────────
  renderActionBar() {
    let bar = document.getElementById('tama-action-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'tama-action-bar';
      bar.style.cssText = [
        'display:flex;justify-content:space-between;align-items:center',
        'padding:5px 12px',
        'background:var(--sapBaseColor)',
        'border-bottom:1px solid var(--sapList_BorderColor)',
        'gap:4px',
      ].join(';');
      const pillsWrap = document.getElementById('pills-wrap');
      if (pillsWrap) pillsWrap.parentNode.insertBefore(bar, pillsWrap);
    }

    bar.innerHTML = `
      <style>
        .tama-btn {
          background:none;
          border:1px solid var(--sapContent_ForegroundBorderColor);
          border-radius:var(--sapElement_BorderRadius);
          width:34px; height:28px; font-size:13px;
          cursor:pointer; transition:background .12s, border-color .12s, transform .1s;
          display:flex; align-items:center; justify-content:center;
          position:relative;
        }
        .tama-btn:hover { background:var(--sapList_HoverBackground); border-color:var(--sapHighlightColor); }
        .tama-btn:active { transform:scale(.92); }
        .tama-btn:disabled { opacity:.3; cursor:not-allowed; }
        .tama-btn-label {
          font-family:var(--sapFontFamily); font-size:.45rem;
          color:var(--sapContent_LabelColor); text-align:center;
          margin-top:1px; letter-spacing:.02em;
        }
        .tama-btn-wrap { display:flex; flex-direction:column; align-items:center; gap:1px; }
        #tama-stats-toggle {
          background:none; border:none;
          font-family:var(--sapFontFamily); font-size:.625rem;
          color:var(--sapHighlightColor); cursor:pointer;
          padding:2px 5px; letter-spacing:.03em;
          border-radius:var(--sapElement_BorderRadius);
          transition:background .12s;
          white-space:nowrap;
        }
        #tama-stats-toggle:hover { background:var(--sapList_HoverBackground); }
      </style>
      <div style="display:flex;gap:4px;align-items:flex-end">
        <div class="tama-btn-wrap">
          <button class="tama-btn" id="tama-btn-feed"     title="Feed BAPI">🍕</button>
          <span class="tama-btn-label">Feed</span>
        </div>
        <div class="tama-btn-wrap">
          <button class="tama-btn" id="tama-btn-play"     title="Play a mini-game">🎮</button>
          <span class="tama-btn-label">Play</span>
        </div>
        <div class="tama-btn-wrap">
          <button class="tama-btn" id="tama-btn-clean"    title="Clean BAPI's bugs">🧼</button>
          <span class="tama-btn-label">Clean</span>
        </div>
        <div class="tama-btn-wrap">
          <button class="tama-btn" id="tama-btn-medicine" title="Give medicine when sick">💊</button>
          <span class="tama-btn-label">Med</span>
        </div>
        <div class="tama-btn-wrap">
          <button class="tama-btn" id="tama-btn-train"    title="Train BAPI — ask a question">💡</button>
          <span class="tama-btn-label">Train</span>
        </div>
      </div>
      <button id="tama-stats-toggle">📊 Stats</button>
    `;

    document.getElementById('tama-btn-feed').addEventListener('click',     () => TAMA_UI.showFoodMenu());
    document.getElementById('tama-btn-play').addEventListener('click',     () => TAMA_UI.showGame());
    document.getElementById('tama-btn-clean').addEventListener('click',    () => { tamaEngine.clean(); TAMA_UI.flashBtn('tama-btn-clean'); });
    document.getElementById('tama-btn-medicine').addEventListener('click', () => { tamaEngine.medicine(); TAMA_UI.flashBtn('tama-btn-medicine'); });
    document.getElementById('tama-btn-train').addEventListener('click',    () => {
      const input = document.getElementById('user-input');
      if (input) { input.focus(); input.placeholder = '💡 Ask BAPI something to train it…'; }
    });
    document.getElementById('tama-stats-toggle').addEventListener('click', () => TAMA_UI.toggleStatsPanel());
  },

  flashBtn(id) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.style.background = 'var(--sapList_SelectionBackgroundColor)';
    setTimeout(() => { btn.style.background = ''; }, 400);
  },

  removeActionBar() {
    const bar = document.getElementById('tama-action-bar');
    if (bar) bar.remove();
    const panel = document.getElementById('tama-stats-panel');
    if (panel) panel.remove();
  },

  // ── Stats panel ────────────────────────────────────────────────────────────
  toggleStatsPanel() {
    let panel = document.getElementById('tama-stats-panel');
    if (panel) { panel.remove(); return; }
    this.showStatsPanel();
  },

  showStatsPanel(stats) {
    let panel = document.getElementById('tama-stats-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'tama-stats-panel';
      panel.style.cssText = [
        'padding:10px 14px',
        'background:var(--sapGroup_ContentBackground)',
        'border-bottom:1px solid var(--sapList_BorderColor)',
        'font-family:var(--sapFontFamily)',
        'animation:fadeSlide .18s ease-out',
      ].join(';');
      const bar = document.getElementById('tama-action-bar');
      if (bar) bar.after(panel);
    }
    const s = stats || tamaEngine.getStats();
    const lvl = tamaEngine.getCurrentLevelInfo();
    const nxt = tamaEngine.getNextLevelInfo();
    const xpp = tamaEngine.getXPProgress();

    const bar = (val, color) => {
      const pct = Math.round(Math.max(0, Math.min(100, val)));
      const barColor = pct < 25 ? 'var(--sapNegativeColor)' : pct < 50 ? 'var(--sapCriticalColor)' : color;
      return `
        <div style="flex:1;height:7px;background:var(--sapContent_ForegroundColor);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width .3s"></div>
        </div>
        <span style="font-size:.6rem;color:var(--sapContent_LabelColor);width:26px;text-align:right">${pct}%</span>`;
    };

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:.75rem;font-weight:700;color:var(--sapTextColor)">${lvl.emoji} ${lvl.name}</span>
        <span style="font-size:.6rem;color:var(--sapContent_LabelColor)">
          🔥 ${s.streak || 0} day streak
          ${s.isSick ? ' · 🤒 Sick' : ''}
        </span>
      </div>
      ${[
        ['❤️ Bond',       s.bond,        'var(--sapHighlightColor)'],
        ['🍔 Hunger',      s.hunger,      'var(--sapPositiveColor)'],
        ['😊 Happiness',  s.happiness,   'var(--sapPositiveColor)'],
        ['⚡ Energy',      s.energy,      'var(--sapCriticalColor)'],
      ].map(([label, val, color]) => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
          <span style="font-size:.625rem;width:68px;color:var(--sapContent_LabelColor)">${label}</span>
          ${bar(val, color)}
        </div>
      `).join('')}
      <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
        <span style="font-size:.625rem;width:68px;color:var(--sapContent_LabelColor)">🧠 XP ${nxt ? `→ Lv.${nxt.level}` : 'MAX'}</span>
        <div style="flex:1;height:7px;background:var(--sapContent_ForegroundColor);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${xpp}%;background:var(--sapHighlightColor);border-radius:4px;transition:width .3s"></div>
        </div>
        <span style="font-size:.6rem;color:var(--sapContent_LabelColor);width:26px;text-align:right">${xpp}%</span>
      </div>
      ${nxt ? `<div style="font-size:.55rem;color:var(--sapContent_LabelColor);margin-top:4px;text-align:right">Next: ${nxt.emoji} ${nxt.name} at ${nxt.xp} XP</div>` : ''}
    `;
  },

  updateStats(stats) {
    if (document.getElementById('tama-stats-panel')) this.showStatsPanel(stats);
    // Update medicine button state
    const medBtn = document.getElementById('tama-btn-medicine');
    if (medBtn) medBtn.style.opacity = stats.isSick ? '1' : '.5';
  },

  // ── Food menu modal ────────────────────────────────────────────────────────
  showFoodMenu() {
    if (document.getElementById('tama-food-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'tama-food-modal';
    modal.style.cssText = [
      'position:absolute;inset:0;z-index:300',
      'display:flex;flex-direction:column',
      'background:var(--sapBackgroundColor)',
      'border-radius:var(--sapContent_BorderRadius)',
      'animation:fadeSlide .18s ease-out',
    ].join(';');

    modal.innerHTML = `
      <div style="background:var(--sapGroup_TitleBackground);padding:10px 14px;
        border-bottom:1px solid var(--sapGroup_BorderColor);
        display:flex;align-items:center;gap:8px;flex-shrink:0">
        <span style="font-size:.875rem;font-weight:700;color:var(--sapTextColor);font-family:var(--sapFontFamily);flex:1">
          🍽 Feed BAPI
        </span>
        <button id="tama-food-close" style="background:none;border:none;color:var(--sapTextColor);
          font-size:1rem;cursor:pointer;width:28px;height:28px;
          display:flex;align-items:center;justify-content:center;border-radius:50%">✕</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:8px">
        ${FOOD_MENU.map(food => `
          <button class="tama-food-item" data-food="${food.id}"
            style="width:100%;display:flex;align-items:center;gap:10px;
              padding:8px 12px;margin-bottom:5px;
              background:var(--sapGroup_ContentBackground);
              border:1px solid var(--sapGroup_BorderColor);
              border-radius:var(--sapElement_BorderRadius);
              cursor:pointer;text-align:left;
              font-family:var(--sapFontFamily);
              transition:background .12s,border-color .12s">
            <span style="font-size:20px;flex-shrink:0">${food.icon}</span>
            <div>
              <div style="font-size:.8125rem;color:var(--sapTextColor);font-weight:600">${food.name}</div>
              <div style="font-size:.6rem;color:var(--sapContent_LabelColor);margin-top:1px">
                ${TAMA_UI._foodHint(food.id)}
              </div>
            </div>
          </button>
        `).join('')}
      </div>
      <div style="padding:8px 12px;border-top:1px solid var(--sapList_BorderColor);
        font-size:.6rem;color:var(--sapContent_LabelColor);font-family:var(--sapFontFamily)">
        Tip: SELECT * makes BAPI temporarily sick 😅
      </div>
    `;

    document.getElementById('app').appendChild(modal);
    document.getElementById('tama-food-close').addEventListener('click', () => modal.remove());

    modal.querySelectorAll('.tama-food-item').forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.background   = 'var(--sapList_HoverBackground)';
        btn.style.borderColor  = 'var(--sapHighlightColor)';
        btn.style.color        = 'var(--sapTextColor)';
      });
      btn.addEventListener('mouseleave', () => {
        // Must explicitly reset — clearing to '' drops the inline style value
        // causing the item to appear permanently hovered after first interaction
        btn.style.background   = 'var(--sapGroup_ContentBackground)';
        btn.style.borderColor  = 'var(--sapGroup_BorderColor)';
        btn.style.color        = '';
      });
      btn.addEventListener('click', () => {
        tamaEngine.feed(btn.dataset.food);
        modal.remove();
      });
    });
  },

  _foodHint(foodId) {
    const hints = {
      coffee:  '+Energy · +Happiness · The dev staple',
      commit:  '+Hunger · +Happiness · Clean and committed',
      pizza:   '+Hunger · +Happiness · Maximum satisfaction',
      reqdoc:  '+Hunger · −Happiness · Dry but filling',
      select:  '+Hunger · −Happiness · Brief indigestion guaranteed',
    };
    return hints[foodId] || '';
  },

  // ── Mini-game launcher ────────────────────────────────────────────────────
  showGame() {
    TAMA_GAMES.launchCatchTheDump();
  },

  // ── Evolution celebration ─────────────────────────────────────────────────
  celebrateEvolution(level) {
    const lvlInfo = EVOLUTION_LEVELS.find(l => l.level === level);
    if (!lvlInfo) return;

    const cel = document.createElement('div');
    cel.id = 'tama-evolution-cel';
    cel.style.cssText = [
      'position:absolute;inset:0;z-index:400',
      'display:flex;flex-direction:column',
      'align-items:center;justify-content:center',
      'background:rgba(0,0,0,.8)',
      'border-radius:var(--sapContent_BorderRadius)',
      'text-align:center;gap:10px',
      'animation:fadeSlide .3s ease-out',
    ].join(';');

    cel.innerHTML = `
      <div style="font-size:48px;animation:bounceAnim .6s ease-in-out 3">${lvlInfo.emoji}</div>
      <div style="font-family:var(--sapFontFamily);font-size:.875rem;font-weight:700;color:#fff">
        LEVEL UP!
      </div>
      <div style="font-family:var(--sapFontFamily);font-size:1rem;font-weight:700;
        color:var(--sapHighlightColor)">${lvlInfo.name}</div>
      <div style="font-family:var(--sapFontFamily);font-size:.75rem;
        color:var(--sapContent_LabelColor);max-width:220px;line-height:1.5">${lvlInfo.desc}</div>
      <button onclick="this.parentNode.remove()" style="
        margin-top:8px;background:var(--sapButton_Emphasized_Background);
        color:var(--sapButton_Emphasized_TextColor);
        border:1px solid var(--sapButton_Emphasized_BorderColor);
        border-radius:var(--sapButton_BorderRadius);
        font-family:var(--sapFontFamily);font-size:.75rem;font-weight:700;
        padding:6px 20px;cursor:pointer">
        Amazing! ✓
      </button>
    `;

    document.getElementById('app').appendChild(cel);
    setTimeout(() => { if (cel.parentNode) cel.remove(); }, 8000);
  },

  // ── Event toast ───────────────────────────────────────────────────────────
  showEventToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = [
      'position:absolute;bottom:60px;left:10px;right:10px;z-index:350',
      'background:var(--sapGroup_ContentBackground)',
      `border-left:3px solid ${type === 'happy' ? 'var(--sapPositiveColor)' : type === 'warn' || type === 'sick' ? 'var(--sapCriticalColor)' : type === 'evolve' ? 'var(--sapHighlightColor)' : 'var(--sapInformativeColor)'}`,
      'border:1px solid var(--sapGroup_BorderColor)',
      'padding:8px 10px',
      'border-radius:var(--sapElement_BorderRadius)',
      'font-family:var(--sapFontFamily);font-size:.75rem',
      'color:var(--sapTextColor);line-height:1.5',
      'box-shadow:0 2px 8px rgba(0,0,0,.3)',
      'animation:fadeSlide .2s ease-out',
    ].join(';');
    toast.textContent = message;
    document.getElementById('app')?.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4500);
  },
};
