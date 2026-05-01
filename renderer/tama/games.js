/**
 * BAPI Tamagotchi Games — Phase 2
 * "Catch the Dump" — tap falling DUMP texts before they hit the ground.
 * Score drives happiness + XP gain in the engine.
 */

const TAMA_GAMES = {

  launchCatchTheDump() {
    if (document.getElementById('tama-game-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'tama-game-modal';
    modal.style.cssText = [
      'position:absolute;inset:0;z-index:300',
      'display:flex;flex-direction:column',
      'background:var(--sapBackgroundColor)',
      'border-radius:var(--sapContent_BorderRadius)',
      'overflow:hidden',
    ].join(';');

    modal.innerHTML = `
      <div style="background:var(--sapGroup_TitleBackground);padding:10px 14px;
        border-bottom:1px solid var(--sapGroup_BorderColor);
        display:flex;align-items:center;gap:8px;flex-shrink:0">
        <span style="font-family:var(--sapFontFamily);font-size:.875rem;
          font-weight:700;color:var(--sapTextColor);flex:1">
          🎮 Catch the Dump!
        </span>
        <span id="ctd-score-display" style="font-family:'Courier New',monospace;
          font-size:.75rem;color:var(--sapHighlightColor);font-weight:700">Score: 0</span>
        <button id="tama-game-close" style="background:none;border:none;color:var(--sapTextColor);
          font-size:1rem;cursor:pointer;width:28px;height:28px;
          display:flex;align-items:center;justify-content:center;border-radius:50%">✕</button>
      </div>
      <div id="ctd-arena" style="flex:1;position:relative;overflow:hidden;
        background:var(--sapBaseColor);cursor:crosshair;
        border-bottom:1px solid var(--sapList_BorderColor)">
        <!-- Falling items render here -->
        <div id="ctd-ground" style="position:absolute;bottom:0;left:0;right:0;
          height:3px;background:var(--sapNegativeColor);opacity:.5"></div>
        <div id="ctd-msg" style="position:absolute;inset:0;display:flex;
          flex-direction:column;align-items:center;justify-content:center;
          font-family:var(--sapFontFamily);gap:8px">
          <div style="font-size:.875rem;color:var(--sapTextColor);font-weight:700">Tap to Start</div>
          <div style="font-size:.6875rem;color:var(--sapContent_LabelColor);text-align:center;max-width:200px">
            Catch the falling DUMPs!<br>Let 3 hit the ground and it's game over.
          </div>
          <button id="ctd-start" style="background:var(--sapButton_Emphasized_Background);
            color:var(--sapButton_Emphasized_TextColor);
            border:1px solid var(--sapButton_Emphasized_BorderColor);
            border-radius:var(--sapButton_BorderRadius);
            font-family:var(--sapFontFamily);font-size:.75rem;font-weight:700;
            padding:6px 16px;cursor:pointer;margin-top:4px">
            Start Game
          </button>
        </div>
      </div>
      <div style="padding:6px 12px;background:var(--sapGroup_ContentBackground);
        font-family:var(--sapFontFamily);font-size:.6rem;color:var(--sapContent_LabelColor);
        display:flex;justify-content:space-between;align-items:center">
        <span>❤️ Lives: <span id="ctd-lives">3</span></span>
        <span>High Score: <span id="ctd-highscore">0</span></span>
      </div>
    `;

    document.getElementById('app').appendChild(modal);
    document.getElementById('tama-game-close').addEventListener('click', () => {
      TAMA_GAMES._stopGame();
      modal.remove();
    });
    document.getElementById('ctd-start').addEventListener('click', () => TAMA_GAMES._startGame());

    // Load high score
    window.bapi.storeGet('ctdHighScore').then(hs => {
      const el = document.getElementById('ctd-highscore');
      if (el) el.textContent = hs || 0;
    });
  },

  _gameState: null,

  _startGame() {
    const msg = document.getElementById('ctd-msg');
    if (msg) msg.style.display = 'none';

    this._gameState = {
      score:     0,
      lives:     3,
      items:     [],
      speed:     1.2,
      spawnRate: 2000,
      running:   true,
      spawnTimer: null,
      rafId:     null,
      lastTime:  0,
    };

    const arena = document.getElementById('ctd-arena');
    if (!arena) return;

    // Click handler on arena
    arena.addEventListener('click', (e) => this._handleClick(e));

    this._scheduleSpawn();
    this._gameState.rafId = requestAnimationFrame((t) => this._gameLoop(t));
  },

  _stopGame() {
    if (!this._gameState) return;
    this._gameState.running = false;
    clearTimeout(this._gameState.spawnTimer);
    cancelAnimationFrame(this._gameState.rafId);
    // Remove all item elements
    this._gameState.items.forEach(item => item.el?.remove());
    this._gameState = null;
  },

  _scheduleSpawn() {
    if (!this._gameState?.running) return;
    const rate = Math.max(700, this._gameState.spawnRate);
    this._gameState.spawnTimer = setTimeout(() => {
      this._spawnItem();
      this._gameState.spawnRate *= 0.97; // gradually faster
      this._scheduleSpawn();
    }, rate);
  },

  _DUMP_WORDS: ['DUMP', 'SE37', 'RFC_ERROR', 'SY-SUBRC≠0', 'SYNTAX ERR', 'OOM', 'TIMEOUT', 'SHORT DUMP', 'ABAP OOM'],

  _spawnItem() {
    const arena = document.getElementById('ctd-arena');
    if (!arena || !this._gameState?.running) return;
    const arenaW = arena.offsetWidth;
    const word   = this._DUMP_WORDS[Math.floor(Math.random() * this._DUMP_WORDS.length)];
    const x      = 10 + Math.random() * (arenaW - 80);
    const el     = document.createElement('div');
    el.textContent = word;
    el.style.cssText = [
      'position:absolute',
      `left:${x}px`, 'top:-24px',
      'font-family:"Courier New",monospace',
      'font-size:.625rem', 'font-weight:700',
      'color:var(--sapNegativeColor)',
      'background:var(--sapGroup_ContentBackground)',
      'border:1px solid var(--sapNegativeColor)',
      'padding:2px 5px', 'border-radius:3px',
      'cursor:pointer', 'white-space:nowrap',
      'user-select:none',
      'transition:opacity .15s',
    ].join(';');
    arena.appendChild(el);

    const item = { el, y: -24, speed: this._gameState.speed + Math.random() * 0.8, caught: false };
    this._gameState.items.push(item);
  },

  _handleClick(e) {
    if (!this._gameState?.running) return;
    const arena  = document.getElementById('ctd-arena');
    if (!arena) return;
    const rect   = arena.getBoundingClientRect();
    const cx     = e.clientX - rect.left;
    const cy     = e.clientY - rect.top;

    for (const item of this._gameState.items) {
      if (item.caught) continue;
      const elRect = item.el.getBoundingClientRect();
      const ielRect = { left: elRect.left - rect.left, top: elRect.top - rect.top,
                        right: elRect.right - rect.left, bottom: elRect.bottom - rect.top };
      if (cx >= ielRect.left - 8 && cx <= ielRect.right + 8 &&
          cy >= ielRect.top  - 8 && cy <= ielRect.bottom + 8) {
        item.caught = true;
        item.el.style.opacity = '0';
        item.el.style.transform = 'scale(1.4)';
        setTimeout(() => item.el?.remove(), 150);
        this._gameState.score++;
        this._gameState.speed += 0.02;
        const sd = document.getElementById('ctd-score-display');
        if (sd) sd.textContent = `Score: ${this._gameState.score}`;
        this._showCatchFeedback(cx, cy, arena);
        break;
      }
    }
    this._gameState.items = this._gameState.items.filter(i => !i.caught);
  },

  _showCatchFeedback(x, y, arena) {
    const fb = document.createElement('div');
    fb.textContent = '+1';
    fb.style.cssText = `position:absolute;left:${x}px;top:${y}px;
      font-family:'Courier New',monospace;font-size:.75rem;font-weight:700;
      color:var(--sapPositiveColor);pointer-events:none;
      animation:ff-float .6s ease-out forwards`;
    arena.appendChild(fb);
    setTimeout(() => fb.remove(), 600);
  },

  _gameLoop(timestamp) {
    if (!this._gameState?.running) return;
    const arena = document.getElementById('ctd-arena');
    if (!arena) return;
    const arenaH = arena.offsetHeight - 3;
    const toRemove = [];

    this._gameState.items.forEach((item, idx) => {
      if (item.caught) return;
      item.y += item.speed;
      item.el.style.top = item.y + 'px';
      if (item.y >= arenaH - 20) {
        // Missed — lose a life
        item.el.style.opacity = '0';
        setTimeout(() => item.el?.remove(), 100);
        toRemove.push(idx);
        this._gameState.lives--;
        const lv = document.getElementById('ctd-lives');
        if (lv) lv.textContent = this._gameState.lives;
        if (this._gameState.lives <= 0) {
          this._gameOver();
          return;
        }
      }
    });

    this._gameState.items = this._gameState.items.filter((_, i) => !toRemove.includes(i));
    this._gameState.rafId = requestAnimationFrame((t) => this._gameLoop(t));
  },

  async _gameOver() {
    if (!this._gameState) return;
    const score = this._gameState.score;
    this._stopGame();

    // Save high score
    const oldHs = (await window.bapi.storeGet('ctdHighScore')) || 0;
    const newHs  = Math.max(score, oldHs);
    await window.bapi.storeSet('ctdHighScore', newHs);

    const arena = document.getElementById('ctd-arena');
    if (!arena) return;

    const isNew  = score > oldHs && score > 0;
    const msg    = document.createElement('div');
    msg.id       = 'ctd-msg';
    msg.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--sapFontFamily);gap:8px;background:rgba(0,0,0,.75)';
    msg.innerHTML = `
      <div style="font-size:1.2rem">${score > 10 ? '🏆' : score > 5 ? '🎉' : '😅'}</div>
      <div style="font-size:.875rem;color:#fff;font-weight:700">Game Over</div>
      <div style="font-size:.75rem;color:var(--sapHighlightColor)">Score: ${score}${isNew ? ' 🏆 New High!' : ''}</div>
      <div style="font-size:.6rem;color:var(--sapContent_LabelColor);margin-top:2px">
        ${score === 0 ? 'Better luck next time…' : score > 5 ? 'BAPI is impressed!' : 'Not bad!'}
      </div>
      <button id="ctd-play-again" style="background:var(--sapButton_Emphasized_Background);
        color:var(--sapButton_Emphasized_TextColor);
        border:1px solid var(--sapButton_Emphasized_BorderColor);
        border-radius:var(--sapButton_BorderRadius);
        font-family:var(--sapFontFamily);font-size:.75rem;font-weight:700;
        padding:6px 16px;cursor:pointer;margin-top:6px">
        Play Again
      </button>
    `;
    arena.appendChild(msg);
    document.getElementById('ctd-play-again').addEventListener('click', () => {
      msg.remove();
      TAMA_GAMES._startGame();
    });

    // Notify engine
    tamaEngine.play(score);

    const hs = document.getElementById('ctd-highscore');
    if (hs) hs.textContent = newHs;
  },
};
