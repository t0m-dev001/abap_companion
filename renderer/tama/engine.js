/**
 * BAPI Tamagotchi Engine — Phase 2
 * Manages all pet needs, evolution, streaks, and ABAP humor events.
 * Fully self-contained — reads/writes via window.bapi.storeGet/Set.
 * Decays run on a 5-minute renderer interval (not main process).
 */

const TAMA_DEFAULTS = {
  hunger:      80,   // 0–100, decays over time
  happiness:   80,   // 0–100, decays over time
  energy:      100,  // 0–100, resets at midnight
  bond:        50,   // 0–100, very slow decay
  intelligence: 0,   // 0–∞, never decays
  xp:          0,    // cumulative, drives evolution
  level:       1,    // 1–5
  streak:      0,    // consecutive days used
  lastUsedDate: '',  // YYYY-MM-DD
  lastSaved:   0,    // timestamp of last save
  isSick:      false,
  lastFed:     0,
  lastPlayed:  0,
};

// ── Evolution thresholds ───────────────────────────────────────────────────────
const EVOLUTION_LEVELS = [
  { level: 1, name: 'Baby BAPI',      xp: 0,   emoji: '🐣', desc: 'Just hatched. Still figuring out ABAP.' },
  { level: 2, name: 'Junior BAPI',    xp: 30,  emoji: '👔', desc: 'Got the tie. Asking about SELECT *.' },
  { level: 3, name: 'Senior BAPI',    xp: 100, emoji: '☕', desc: 'Glasses on. Coffee in hand. Knows every BAPI.' },
  { level: 4, name: 'Principal BAPI', xp: 250, emoji: '🎓', desc: 'Wrote the enhancement framework. Twice.' },
  { level: 5, name: 'Architect BAPI', xp: 500, emoji: '✨', desc: 'Transcended transport requests. Glowing.' },
];

// ── SAP Dark Humor Events ──────────────────────────────────────────────────────
const HUMOR_EVENTS = {
  fedSelectStar: {
    msg: '🤢 You fed BAPI a SELECT *! Brief indigestion… but it survives. We always survive.',
    hungerDelta: +10, happinessDelta: -15, makesSick: true, sickDuration: 5000,
  },
  fedCommitWork: {
    msg: '✅ COMMIT WORK! BAPI feels clean and committed. SY-SUBRC = 0.',
    hungerDelta: +25, happinessDelta: +15, makesSick: false,
  },
  fedCoffee: {
    msg: '☕ Coffee absorbed. Energy levels: CRITICAL → MAXIMUM. Ready for overnight debugging.',
    hungerDelta: +15, happinessDelta: +20, energyDelta: +30, makesSick: false,
  },
  fedRequirementsDoc: {
    msg: '📋 Requirements doc consumed. Dry but filling. Happiness slightly reduced — as expected.',
    hungerDelta: +20, happinessDelta: -5, makesSick: false,
  },
  fedPizza: {
    msg: '🍕 Pizza! The universal developer food. BAPI is very happy.',
    hungerDelta: +35, happinessDelta: +25, makesSick: false,
  },
  ignoredTooLong: {
    msg: '😞 BAPI has been alone for too long… Shows a DUMP error face. It misses you.',
  },
  level5Reached: {
    msg: '✨ BAPI has reached Architect level. It whispers: "I have seen things in function modules no developer should see."',
  },
};

// ── Food menu definition ───────────────────────────────────────────────────────
const FOOD_MENU = [
  { id: 'coffee',   icon: '☕', name: 'Coffee',           event: 'fedCoffee',           cost: 0 },
  { id: 'commit',   icon: '✅', name: 'COMMIT WORK',      event: 'fedCommitWork',        cost: 0 },
  { id: 'pizza',    icon: '🍕', name: 'Pizza',            event: 'fedPizza',             cost: 0 },
  { id: 'reqdoc',   icon: '📋', name: 'Requirements Doc', event: 'fedRequirementsDoc',   cost: 0 },
  { id: 'select',   icon: '⚠️', name: 'SELECT *',         event: 'fedSelectStar',        cost: 0 },
];

// ── Engine class ───────────────────────────────────────────────────────────────
class TamagotchiEngine {
  constructor() {
    this.stats       = { ...TAMA_DEFAULTS };
    this.decayTimer  = null;
    this.onUpdate    = null;   // callback(stats)
    this.onEvent     = null;   // callback(message, type)
    this.onEvolve    = null;   // callback(newLevel)
    this._enabled    = false;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  async init() {
    const saved = await window.bapi.storeGet('tamaStats');
    if (saved) {
      this.stats = { ...TAMA_DEFAULTS, ...saved };
    }
    this._checkStreak();
    this._checkIgnored();
    this._applyOfflineDecay();
    this._startDecayLoop();
    this._notify();
  }

  enable()  { this._enabled = true;  this.init(); }
  disable() { this._enabled = false; this._stopDecayLoop(); }

  // ── Streak ─────────────────────────────────────────────────────────────────
  _checkStreak() {
    const today    = new Date().toISOString().slice(0, 10);
    const lastDate = this.stats.lastUsedDate;
    if (!lastDate) {
      this.stats.streak      = 1;
      this.stats.lastUsedDate = today;
      return;
    }
    if (lastDate === today) return; // Already counted today
    const diff = Math.floor((new Date(today) - new Date(lastDate)) / 86400000);
    if (diff === 1) {
      this.stats.streak++;
    } else if (diff > 1) {
      this.stats.streak = 1; // Broke the streak
    }
    this.stats.lastUsedDate = today;
  }

  // ── Offline decay — apply decay for time spent away ────────────────────────
  _applyOfflineDecay() {
    if (!this.stats.lastSaved) return;
    const hoursAway = (Date.now() - this.stats.lastSaved) / 3600000;
    if (hoursAway < 0.1) return;
    const hrs = Math.min(hoursAway, 24); // cap at 24h of decay
    this.stats.hunger    = Math.max(0, this.stats.hunger    - hrs * 4);
    this.stats.happiness = Math.max(0, this.stats.happiness - hrs * 2);
    this.stats.energy    = Math.max(0, this.stats.energy    - hrs * 3);
    this.stats.bond      = Math.max(0, this.stats.bond      - hrs * 0.5);
    if (this.stats.hunger < 20) this.stats.isSick = true;
  }

  _checkIgnored() {
    if (!this.stats.lastSaved) return;
    const hoursAway = (Date.now() - this.stats.lastSaved) / 3600000;
    if (hoursAway > 8 && this.onEvent) {
      setTimeout(() => this.onEvent(HUMOR_EVENTS.ignoredTooLong.msg, 'warn'), 1500);
    }
  }

  // ── Decay loop — runs every 5 minutes ─────────────────────────────────────
  _startDecayLoop() {
    this._stopDecayLoop();
    this.decayTimer = setInterval(() => this._tick(), 5 * 60 * 1000);
  }
  _stopDecayLoop() {
    if (this.decayTimer) { clearInterval(this.decayTimer); this.decayTimer = null; }
  }

  _tick() {
    this.stats.hunger    = Math.max(0, this.stats.hunger    - 3);
    this.stats.happiness = Math.max(0, this.stats.happiness - 1.5);
    this.stats.energy    = Math.max(0, this.stats.energy    - 2);
    this.stats.bond      = Math.max(0, this.stats.bond      - 0.2);
    if (this.stats.hunger < 15 && !this.stats.isSick) {
      this.stats.isSick = true;
      if (this.onEvent) this.onEvent('🤒 BAPI is getting sick — low energy. Feed it something!', 'warn');
    }
    this._notify();
    this.save();
  }

  // ── Interactions ──────────────────────────────────────────────────────────
  feed(foodId) {
    const food  = FOOD_MENU.find(f => f.id === foodId);
    if (!food)  return;
    const event = HUMOR_EVENTS[food.event];
    if (!event) return;

    this.stats.hunger    = Math.min(100, this.stats.hunger    + (event.hungerDelta    || 0));
    this.stats.happiness = Math.min(100, this.stats.happiness + (event.happinessDelta || 0));
    this.stats.energy    = Math.min(100, this.stats.energy    + (event.energyDelta    || 0));
    this.stats.lastFed   = Date.now();

    if (event.makesSick) {
      this.stats.isSick = true;
      setTimeout(() => { this.stats.isSick = false; this._notify(); }, event.sickDuration || 5000);
    } else {
      this.stats.isSick = false;
    }

    this._addXP(5);
    if (this.onEvent) this.onEvent(event.msg, event.makesSick ? 'sick' : 'happy');
    this._notify();
    this.save();
  }

  play(score) {
    const happGain = Math.min(25, 5 + score * 2);
    this.stats.happiness = Math.min(100, this.stats.happiness + happGain);
    this.stats.energy    = Math.max(0,   this.stats.energy    - 10);
    this.stats.lastPlayed = Date.now();
    this._addXP(3 + score);
    if (this.onEvent) this.onEvent(`🎮 Game over! Score: ${score}. BAPI ${score > 5 ? 'loved it!' : 'had fun.'}`, 'happy');
    this._notify();
    this.save();
  }

  clean() {
    this.stats.happiness = Math.min(100, this.stats.happiness + 15);
    this.stats.isSick    = false;
    this._addXP(2);
    if (this.onEvent) this.onEvent('🧼 Bugs squashed! BAPI feels fresh. Like a clean transport.', 'happy');
    this._notify();
    this.save();
  }

  medicine() {
    if (!this.stats.isSick) {
      if (this.onEvent) this.onEvent('💊 BAPI is not sick. Medicine wasted — like a hotfix on a stable system.', 'info');
      return;
    }
    this.stats.isSick    = false;
    this.stats.hunger    = Math.min(100, this.stats.hunger    + 20);
    this.stats.happiness = Math.min(100, this.stats.happiness + 10);
    this._addXP(2);
    if (this.onEvent) this.onEvent('💊 Medicine administered. BAPI recovers. SY-SUBRC = 0 again.', 'happy');
    this._notify();
    this.save();
  }

  train(questionsAnswered = 1) {
    const gain = questionsAnswered * 3;
    this.stats.intelligence = (this.stats.intelligence || 0) + gain;
    this.stats.energy       = Math.max(0, this.stats.energy - 5);
    this._addXP(questionsAnswered * 5);
    this._notify();
    this.save();
  }

  // Called when user sends a chat message
  onChatMessage() {
    if (!this._enabled) return;
    this.stats.bond       = Math.min(100, this.stats.bond       + 2);
    this.stats.happiness  = Math.min(100, this.stats.happiness  + 3);
    this.train(1);
  }

  // ── XP + Evolution ────────────────────────────────────────────────────────
  _addXP(amount) {
    this.stats.xp    = (this.stats.xp || 0) + amount;
    const oldLevel   = this.stats.level;
    const newLevel   = this._calcLevel();
    this.stats.level = newLevel;
    if (newLevel > oldLevel) {
      if (newLevel === 5 && this.onEvent) {
        this.onEvent(HUMOR_EVENTS.level5Reached.msg, 'evolve');
      }
      if (this.onEvolve) this.onEvolve(newLevel);
    }
  }

  _calcLevel() {
    for (let i = EVOLUTION_LEVELS.length - 1; i >= 0; i--) {
      if ((this.stats.xp || 0) >= EVOLUTION_LEVELS[i].xp) return EVOLUTION_LEVELS[i].level;
    }
    return 1;
  }

  getCurrentLevelInfo() {
    return EVOLUTION_LEVELS.find(l => l.level === this.stats.level) || EVOLUTION_LEVELS[0];
  }

  getNextLevelInfo() {
    return EVOLUTION_LEVELS.find(l => l.level === this.stats.level + 1) || null;
  }

  getXPProgress() {
    const cur  = EVOLUTION_LEVELS.find(l => l.level === this.stats.level);
    const next = this.getNextLevelInfo();
    if (!next) return 100;
    const base  = cur.xp;
    const range = next.xp - base;
    const prog  = (this.stats.xp || 0) - base;
    return Math.min(100, Math.floor((prog / range) * 100));
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  async save() {
    this.stats.lastSaved = Date.now();
    await window.bapi.storeSet('tamaStats', this.stats);
  }

  _notify() {
    if (this.onUpdate) this.onUpdate({ ...this.stats });
  }

  // ── Getters ───────────────────────────────────────────────────────────────
  getStats() { return { ...this.stats }; }
  isEnabled() { return this._enabled; }
}

// ── Exports ───────────────────────────────────────────────────────────────────
const tamaEngine = new TamagotchiEngine();
