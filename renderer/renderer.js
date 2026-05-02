// ── BAPI Renderer v3.1 — Phase 1 + 2 + 3 ────────────────────────────────────

// ── Language config ────────────────────────────────────────────────────────
const LANG_SUFFIXES = {
  en:   '',
  id:   ' Respond in Bahasa Indonesia.',
  auto: ' Detect the user\'s language and respond in the same language.',
};

// ── SCN-style system prompt ────────────────────────────────────────────────
function buildSystemPrompt(lang = 'en') {
  const base = `You are BAPI — a senior SAP ABAP consultant who answers like a top-rated SCN (SAP Community Network) contributor.

IDENTITY: 15+ years ABAP. Classic ABAP, Dialog/Dynpro, Table Controls, ALV, BAdI/Enhancement Framework, OData/SEGW, S/4HANA CDS, RAP, ABAP OO, RFCs, BAPIs, SmartForms, Adobe Forms, Workflow, CRM, SD/FI enhancements. Freelance, ex-Accenture/Deloitte/NTT Data.

ANSWER FORMAT (SCN style):
1. Answer first — code or direct statement. No preamble.
2. Exact SAP artifact names: TCode, FM names, BAPI names, table/field names, class/method names.
3. Code in triple backtick blocks with language tag (e.g. \`\`\`abap).
4. Brief note on gotchas, OSS notes, or version differences if relevant.
5. Multi-step: numbered list. Single answer: one paragraph max.

TONE: Direct. Senior colleague on Slack — not a manual.
- Never say "Great question" or "I hope this helps"
- If something is wrong in user code, say so directly
- Dark humor about SAP is welcome

RESPONSE LENGTH:
- Simple question → 1-3 sentences + code if needed
- Complex topic → structured, concise. Long = bullets not paragraphs
- User is a 13-year ABAP veteran. Skip basics.

Reminder context: When a reminder fires, respond to the time context (morning/midday/EOD).`;
  return base + (LANG_SUFFIXES[lang] || '');
}

// ── SAP Theme config ────────────────────────────────────────────────────────
const SAP_THEMES = {
  'sap_horizon_dark': 'Evening Horizon (S/4HANA 2022+)',
  'sap_fiori_3_dark': 'Quartz Dark (Fiori 3)',
  'sap_belize_deep':  'Belize Deep (Fiori 2)',
  'sap_horizon_hcb':  'High Contrast Black — Horizon',
  'sap_fiori_3_hcb':  'High Contrast Black — Quartz',
};

const MODEL_DEFAULTS = { anthropic: 'claude-sonnet-4-6', google: 'gemma-3-27b-it' };
const MODEL_HINTS = {
  anthropic: 'claude-sonnet-4-6 · claude-haiku-4-5-20251001 (faster/cheaper)',
  google:    'gemma-3-27b-it (free, 14.4K/day) · gemma-3-12b-it · gemini-2.5-flash-preview-04-17',
};
const FREE_MODELS = new Set([
  'gemma-3-1b-it','gemma-3-4b-it','gemma-3-12b-it','gemma-3-27b-it',
  'gemma-3n-e2b-it','gemma-3n-e4b-it','gemma-4-2b-it','gemma-4-9b-it','gemma-4-27b-it',
  'gemini-2.5-flash-preview-04-17',
]);

// ── State ───────────────────────────────────────────────────────────────────
let chatHistory        = [];
let isBusy             = false;
let reminders          = [];
let editReminders      = [];
let allModels          = [];
let currentTheme       = 'sap_fiori_3_dark';
let currentPet         = 'pixel';
let tamagotchiEnabled  = false;
let currentLang        = 'en';

// ── Pet Renderer Coordinator ────────────────────────────────────────────────
const PET_RENDERERS = {
  pixel:   PixelPetRenderer,
  fiori:   FioriPetRenderer,
  desktoy: DeskToyPetRenderer,
};
let activePetRenderer = null;

function mountPetRenderer(petId) {
  const container = document.getElementById('pet-container');
  if (!container) return;
  if (activePetRenderer) { try { activePetRenderer.unmount(); } catch(_) {} activePetRenderer = null; }
  const Cls = PET_RENDERERS[petId] || PET_RENDERERS.pixel;
  activePetRenderer = new Cls(container);
  activePetRenderer.mount();
  currentPet = petId;
  document.querySelectorAll('.pet-swatch').forEach(s => s.classList.toggle('active', s.dataset.pet === petId));
}

async function loadPetDesign() {
  const saved = (await window.bapi.storeGet('petDesign')) || 'pixel';
  mountPetRenderer(saved);
}

// ── DOM refs ────────────────────────────────────────────────────────────────
const petStatus = document.getElementById('pet-status');
const chatArea  = document.getElementById('chat-area');
const pillsEl   = document.getElementById('pills');
const userInput = document.getElementById('user-input');
const sendBtn   = document.getElementById('send-btn');
const overlay   = document.getElementById('settings-overlay');

// ── Pet state machine ────────────────────────────────────────────────────────
const PET = {
  idle()     { if (activePetRenderer) activePetRenderer.setState('idle');     _updateStatus('idle');     },
  thinking() { if (activePetRenderer) activePetRenderer.setState('thinking'); _updateStatus('thinking'); },
  happy()    { if (activePetRenderer) activePetRenderer.setState('happy');    _updateStatus('happy');    },
  error()    { if (activePetRenderer) activePetRenderer.setState('error');    _updateStatus('error');    },
};
function _updateStatus(state) {
  const labels = { idle:'READY', thinking:'THINKING...', happy:'DONE!', error:'ERROR' };
  const colors = { idle:'var(--sapHighlightColor)', thinking:'var(--sapCriticalColor)',
                   happy:'var(--sapPositiveColor)', error:'var(--sapNegativeColor)' };
  if (petStatus) {
    petStatus.textContent = activePetRenderer?.getStatusText(state) ?? labels[state] ?? 'READY';
    petStatus.style.color = colors[state] || 'var(--sapHighlightColor)';
  }
}

// ── Collapse / Expand ────────────────────────────────────────────────────────
function collapse() { document.body.classList.add('collapsed');    window.bapi.collapse(); }
function expand()   { document.body.classList.remove('collapsed'); window.bapi.expand();   }

// ── Phase 1: Render message with inline code highlight ───────────────────────
function renderMessageContent(text) {
  // Split on triple-backtick code blocks
  const parts = [];
  const codeRx = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0, m;
  while ((m = codeRx.exec(text)) !== null) {
    if (m.index > last) parts.push({ type:'text', content: text.slice(last, m.index) });
    parts.push({ type:'code', lang: m[1] || 'abap', content: m[2].trimEnd() });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type:'text', content: text.slice(last) });

  return parts.map(p => {
    if (p.type === 'code') {
      const escaped = p.content.replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return `<pre data-lang="${p.lang}">${escaped}</pre>`;
    } else {
      // Inline code with single backtick
      let html = p.content
        .replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g,'<br>');
      return html;
    }
  }).join('');
}

// ── Chat helpers ────────────────────────────────────────────────────────────
function addMsg(role, text, id) {
  const div = document.createElement('div');
  div.className = `msg msg-${role === 'user' ? 'user' : 'bapi'}`;
  if (role === 'thinking') div.classList.add('msg-thinking');
  if (id) div.id = id;

  if (role === 'assistant' && text !== '...') {
    div.innerHTML = renderMessageContent(text);
    // Action button row — expand, copy, save — grouped so they don't overlap
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    const expandBtn = document.createElement('button');
    expandBtn.className   = 'msg-action-btn msg-expand-btn';
    expandBtn.title       = 'Open in reader popup';
    expandBtn.textContent = '⤢';
    expandBtn.addEventListener('click', e => { e.stopPropagation(); window.bapi.openReader(text, currentTheme); });

    const copyBtn = document.createElement('button');
    copyBtn.className   = 'msg-action-btn msg-copy-btn';
    copyBtn.title       = 'Copy to clipboard';
    copyBtn.textContent = '⎘';
    copyBtn.addEventListener('click', e => {
      e.stopPropagation();
      navigator.clipboard.writeText(text);
      copyBtn.textContent = '✓';
      setTimeout(() => { copyBtn.textContent = '⎘'; }, 1500);
    });

    const saveBtn = document.createElement('button');
    saveBtn.className   = 'msg-action-btn msg-save-btn';
    saveBtn.title       = 'Save to Snippet Vault';
    saveBtn.textContent = '💾';
    saveBtn.addEventListener('click', async e => {
      e.stopPropagation();
      await SNIPPETS.save(text);
      saveBtn.textContent = '✓';
      setTimeout(() => { saveBtn.textContent = '💾'; }, 1500);
    });

    actions.appendChild(expandBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(saveBtn);
    div.appendChild(actions);
  } else {
    div.textContent = text;
  }

  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
  return div;
}

// ── Send message ─────────────────────────────────────────────────────────────
async function sendMessage(overrideText) {
  const text = (overrideText ?? userInput.value).trim();
  if (!text || isBusy) return;

  userInput.value = '';
  userInput.placeholder = 'Ask BAPI…';
  isBusy = true;
  sendBtn.disabled = true;
  addMsg('user', text);
  PET.thinking();
  chatHistory.push({ role: 'user', content: text });
  const bubble = addMsg('thinking', '...', 'live-bubble');

  // Tamagotchi: count as training
  if (tamagotchiEnabled) tamaEngine.onChatMessage();

  try {
    const result = await window.bapi.chat({
      messages: chatHistory,
      system:   buildSystemPrompt(currentLang),
    });

    if (result.error === 'no_api_key') {
      bubble.id = ''; bubble.textContent = 'No API key — click ⚙ to add one.';
      bubble.classList.remove('msg-thinking');
      chatHistory.pop(); PET.error();
    } else if (result.error) {
      bubble.id = ''; bubble.textContent = `Error: ${result.error}`;
      bubble.classList.remove('msg-thinking');
      chatHistory.pop(); PET.error();
    } else {
      const reply = result.content?.[0]?.text ?? 'Empty response — try again.';
      bubble.id = '';
      bubble.classList.remove('msg-thinking');
      // Re-render with inline code highlight
      bubble.innerHTML = renderMessageContent(reply);
      // Re-add action button row
      const actions2 = document.createElement('div');
      actions2.className = 'msg-actions';
      const eb2 = document.createElement('button');
      eb2.className = 'msg-action-btn msg-expand-btn'; eb2.title = 'Open in reader popup'; eb2.textContent = '⤢';
      eb2.addEventListener('click', e => { e.stopPropagation(); window.bapi.openReader(reply, currentTheme); });
      const cb2 = document.createElement('button');
      cb2.className = 'msg-action-btn msg-copy-btn'; cb2.title = 'Copy'; cb2.textContent = '⎘';
      cb2.addEventListener('click', e => {
        e.stopPropagation(); navigator.clipboard.writeText(reply);
        cb2.textContent = '✓'; setTimeout(() => { cb2.textContent = '⎘'; }, 1500);
      });
      const sb2 = document.createElement('button');
      sb2.className = 'msg-action-btn msg-save-btn'; sb2.title = 'Save snippet'; sb2.textContent = '💾';
      sb2.addEventListener('click', async e => {
        e.stopPropagation(); await SNIPPETS.save(reply);
        sb2.textContent = '✓'; setTimeout(() => { sb2.textContent = '💾'; }, 1500);
      });
      actions2.appendChild(eb2); actions2.appendChild(cb2); actions2.appendChild(sb2);
      bubble.appendChild(actions2);

      chatHistory.push({ role: 'assistant', content: reply });
      PET.happy();
      // Save to session history
      await SESSIONS.addMessage('user', text);
      await SESSIONS.addMessage('assistant', reply);
      await window.bapi.storeSet('chatHistory', chatHistory.slice(-40));
    }
  } catch (e) {
    bubble.id = ''; bubble.textContent = `Network error: ${e.message}`;
    bubble.classList.remove('msg-thinking'); chatHistory.pop(); PET.error();
  }

  isBusy = false; sendBtn.disabled = false; userInput.focus();
}

// ── Pills ────────────────────────────────────────────────────────────────────
function renderPills(list) {
  pillsEl.innerHTML = '';
  list.filter(r => r.enabled).forEach(r => {
    const s = document.createElement('span');
    s.className = 'pill'; s.dataset.id = r.id;
    s.textContent = `${r.emoji} ${r.label}`; s.title = r.time;
    s.addEventListener('click', () => handleReminder(r));
    pillsEl.appendChild(s);
  });
}

// ── Reminder ─────────────────────────────────────────────────────────────────
function handleReminder(reminder) {
  const pill = pillsEl.querySelector(`[data-id="${reminder.id}"]`);
  if (pill) { pill.classList.add('active'); setTimeout(() => pill.classList.remove('active'), 3000); }
  if (tamagotchiEnabled) activePetRenderer?.setState('reminder');
  const h = new Date().getHours();
  const ctx = h < 12 ? 'morning' : h < 17 ? 'midday' : 'evening';
  sendMessage(`[${reminder.emoji} ${reminder.label} reminder — ${reminder.time}] ${ctx} check-in`);
}

// ── Tamagotchi mode ───────────────────────────────────────────────────────────
function applyTamagotchiMode(enabled) {
  tamagotchiEnabled = enabled;
  if (enabled) {
    tamaEngine.enable();
    TAMA_UI.renderActionBar();
    tamaEngine.onUpdate  = (stats) => {
      TAMA_UI.updateStats(stats);
      // Update pet state based on health
      if (stats.isSick) activePetRenderer?.setState('error');
      else if (stats.happiness < 20) activePetRenderer?.setState('error');
    };
    tamaEngine.onEvent   = (msg, type) => TAMA_UI.showEventToast(msg, type);
    tamaEngine.onEvolve  = (level)     => TAMA_UI.celebrateEvolution(level);
  } else {
    tamaEngine.disable();
    TAMA_UI.removeActionBar();
    tamaEngine.onUpdate  = null;
    tamaEngine.onEvent   = null;
    tamaEngine.onEvolve  = null;
  }
}

// ── Language pill ─────────────────────────────────────────────────────────────
function updateLangPill() {
  const pill = document.getElementById('lang-pill');
  if (!pill) return;
  const labels = { en:'EN', id:'ID', auto:'🌐' };
  pill.textContent = labels[currentLang] || 'EN';
}

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme(themeId) {
  if (!SAP_THEMES[themeId]) themeId = 'sap_fiori_3_dark';
  document.documentElement.setAttribute('data-sap-theme', themeId);
  currentTheme = themeId;
  document.querySelectorAll('.theme-swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === themeId));
}
async function loadTheme() {
  const t = (await window.bapi.storeGet('theme')) || 'sap_fiori_3_dark';
  applyTheme(t);
}

// ── Settings reminder list ────────────────────────────────────────────────────
function renderReminderList() {
  const list = document.getElementById('reminders-list');
  if (!list) return;
  list.innerHTML = '';
  editReminders.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'r-row';
    row.innerHTML = `
      <div class="toggle r-enabled ${r.enabled ? 'on' : ''}" data-idx="${i}"><div class="toggle-thumb"></div></div>
      <input class="r-emoji" type="text" maxlength="2" value="${r.emoji}" data-idx="${i}" data-field="emoji">
      <input class="r-name"  type="text" value="${r.label}" data-idx="${i}" data-field="label" placeholder="Label">
      <input class="r-time"  type="time" value="${r.time}"  data-idx="${i}" data-field="time">
      <button class="r-del" data-idx="${i}">✕</button>`;
    list.appendChild(row);
  });
  list.querySelectorAll('.r-enabled').forEach(t => {
    t.addEventListener('click', () => { const i=+t.dataset.idx; editReminders[i].enabled=!editReminders[i].enabled; t.classList.toggle('on',editReminders[i].enabled); });
  });
  list.querySelectorAll('input[data-field]').forEach(inp => {
    inp.addEventListener('input', () => { editReminders[+inp.dataset.idx][inp.dataset.field]=inp.value; });
  });
  list.querySelectorAll('.r-del').forEach(btn => {
    btn.addEventListener('click', () => { editReminders.splice(+btn.dataset.idx,1); renderReminderList(); });
  });
}

// ── Settings open/save ────────────────────────────────────────────────────────
async function openSettings() {
  overlay.classList.remove('hidden');
  const [apiKey,model,provider,savedRem,remEnabled,startLogin,opacity,petDesign,tamaEnabled,lang] = await Promise.all([
    window.bapi.storeGet('apiKey'),
    window.bapi.storeGet('apiModel'),
    window.bapi.storeGet('apiProvider'),
    window.bapi.storeGet('reminders'),
    window.bapi.storeGet('remindersEnabled'),
    window.bapi.storeGet('startOnLogin'),
    window.bapi.storeGet('opacity'),
    window.bapi.storeGet('petDesign'),
    window.bapi.storeGet('tamagotchiEnabled'),
    window.bapi.storeGet('language'),
  ]);
  const prov = provider || 'google';
  document.getElementById('inp-provider').value  = prov;
  document.getElementById('inp-apikey').value    = apiKey ? '••••••••••••••••' : '';
  document.getElementById('inp-model').value     = model  || '';
  document.getElementById('inp-language').value  = lang   || 'en';
  updateModelHints(prov);
  setToggle('toggle-reminders',  remEnabled !== false);
  setToggle('toggle-tamagotchi', !!tamaEnabled);
  setToggle('toggle-login',      !!startLogin);
  const opVal = Math.round((opacity || 1.0) * 100);
  document.getElementById('opacity-slider').value     = opVal;
  document.getElementById('opacity-val').textContent  = opVal + '%';
  editReminders = JSON.parse(JSON.stringify(savedRem || []));
  renderReminderList();
  document.querySelectorAll('.theme-swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === currentTheme));
  document.querySelectorAll('.pet-swatch').forEach(s => s.classList.toggle('active', s.dataset.pet === currentPet));
}

function closeSettings() { overlay.classList.add('hidden'); }

async function saveSettings() {
  const provider = document.getElementById('inp-provider').value;
  await window.bapi.storeSet('apiProvider', provider);
  const rawKey = document.getElementById('inp-apikey').value.trim();
  if (rawKey && !rawKey.startsWith('••')) {
    await window.bapi.storeSet('apiKey', rawKey);
    showApiStatus('Key saved ✓', 'var(--sapPositiveColor)');
  }
  const modelInput = document.getElementById('inp-model').value.trim();
  await window.bapi.storeSet('apiModel', modelInput || MODEL_DEFAULTS[provider] || '');
  const newLang    = document.getElementById('inp-language').value;
  currentLang      = newLang;
  await window.bapi.storeSet('language', newLang);
  updateLangPill();
  const valid = editReminders.filter(r => r.label && /^\d{2}:\d{2}$/.test(r.time));
  if (valid.length !== editReminders.length) { showApiStatus('Fix reminder times (HH:MM)', 'var(--sapCriticalColor)'); return; }
  const remEnabled  = isToggleOn('toggle-reminders');
  const tamaOn      = isToggleOn('toggle-tamagotchi');
  const startLogin  = isToggleOn('toggle-login');
  const opPct       = +document.getElementById('opacity-slider').value;
  await Promise.all([
    window.bapi.storeSet('reminders',        valid),
    window.bapi.storeSet('remindersEnabled', remEnabled),
    window.bapi.storeSet('startOnLogin',     startLogin),
    window.bapi.storeSet('theme',            currentTheme),
    window.bapi.storeSet('petDesign',        currentPet),
    window.bapi.storeSet('tamagotchiEnabled', tamaOn),
    window.bapi.storeSet('opacity',          opPct / 100),
  ]);
  window.bapi.setOpacity(opPct / 100);
  applyTamagotchiMode(tamaOn);
  window.bapi.settingsSaved({ startOnLogin: startLogin, reminders: valid });
  reminders = valid;
  renderPills(reminders);
  showApiStatus('Saved ✓', 'var(--sapPositiveColor)');
  setTimeout(closeSettings, 700);
}

function updateModelHints(provider) {
  document.getElementById('inp-model').placeholder     = MODEL_DEFAULTS[provider] || '';
  document.getElementById('model-hint').textContent    = MODEL_HINTS[provider]    || '';
}
function showApiStatus(msg, color) {
  const el = document.getElementById('api-status');
  el.style.display='block'; el.style.color=color; el.textContent=msg;
  setTimeout(() => { el.style.display='none'; }, 3000);
}
function setToggle(id, on)  { document.getElementById(id)?.classList.toggle('on', on); }
function isToggleOn(id)     { return document.getElementById(id)?.classList.contains('on') || false; }

// ── F4 Model Picklist ─────────────────────────────────────────────────────────
function openF4() {
  const provider = document.getElementById('inp-provider')?.value;
  if (provider !== 'google') { showApiStatus('F4 = Google provider only', 'var(--sapCriticalColor)'); return; }
  document.getElementById('f4-overlay').classList.remove('hidden');
  document.getElementById('f4-search').value = '';
  if (allModels.length > 0) { renderF4(allModels); document.getElementById('f4-search').focus(); return; }
  document.getElementById('f4-list').innerHTML = '<div class="f4-state">Fetching from Google…</div>';
  window.bapi.listModels().then(result => {
    if (result.error) { document.getElementById('f4-list').innerHTML = `<div class="f4-state">${result.error}</div>`; return; }
    allModels = result.models;
    renderF4(allModels);
    document.getElementById('f4-search').focus();
  });
}
function closeF4() { document.getElementById('f4-overlay').classList.add('hidden'); }
function renderF4(models) {
  const q       = document.getElementById('f4-search').value.toLowerCase();
  const current = document.getElementById('inp-model').value.trim();
  const list    = q ? models.filter(m => m.id.toLowerCase().includes(q) || m.displayName.toLowerCase().includes(q)) : models;
  if (!list.length) { document.getElementById('f4-list').innerHTML = '<div class="f4-state">No match</div>'; return; }
  const count = document.getElementById('f4-count');
  if (count) count.textContent = `${list.length} models`;
  document.getElementById('f4-list').innerHTML = list.map(m => {
    const free = FREE_MODELS.has(m.id);
    const sel  = m.id === current;
    const desc = m.description ? `<div class="f4-model-desc">${m.description.slice(0,90)}${m.description.length>90?'…':''}</div>` : '';
    return `<div class="f4-row${sel?' selected':''}" data-id="${m.id}">
      <div class="f4-row-left"><div class="f4-model-name">${m.displayName}</div><div class="f4-model-id">${m.id}</div>${desc}</div>
      <span class="f4-badge${free?' free':''}">${free?'free':'paid'}</span>
    </div>`;
  }).join('');
  document.querySelectorAll('.f4-row').forEach(row => {
    row.addEventListener('click', () => { document.getElementById('inp-model').value=row.dataset.id; updateModelHints('google'); closeF4(); });
  });
  const sel = document.querySelector('.f4-row.selected');
  if (sel) sel.scrollIntoView({ block:'center' });
}

// ── Drag (smooth, no webkit-app-region) ──────────────────────────────────────
function setupDrag(el) {
  if (!el) return;
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button,input,select,a,.toggle,.pill')) return;
    e.preventDefault();
    window.bapi.dragStart();
    const onUp = () => { window.bapi.dragEnd(); window.removeEventListener('mouseup',onUp,true); window.removeEventListener('mouseleave',onUp,true); };
    window.addEventListener('mouseup',    onUp, true);
    window.addEventListener('mouseleave', onUp, true);
  });
}

// ── Wire events ───────────────────────────────────────────────────────────────
document.getElementById('btn-close').addEventListener('click',     () => window.bapi.hide());
document.getElementById('btn-minimize').addEventListener('click',  () => window.bapi.minimize());
document.getElementById('btn-hide').addEventListener('click',      () => window.bapi.hide());
document.getElementById('tb-gear').addEventListener('click',       openSettings);
document.getElementById('tb-collapse').addEventListener('click',   collapse);
document.getElementById('pet-area').addEventListener('click', (e) => { if (document.body.classList.contains('collapsed')) expand(); });
document.getElementById('btn-expand').addEventListener('click',    expand);
document.getElementById('settings-back').addEventListener('click', closeSettings);
document.getElementById('save-btn').addEventListener('click',      saveSettings);
document.getElementById('add-reminder').addEventListener('click', () => {
  editReminders.push({ id:'r'+Date.now(), emoji:'🔔', label:'Reminder', time:'10:00', enabled:true });
  renderReminderList();
  document.getElementById('settings-body').scrollTop = 9999;
});
document.getElementById('send-btn').addEventListener('click',      () => sendMessage());
document.getElementById('link-console').addEventListener('click',  () => window.bapi.openUrl('https://console.anthropic.com/'));
document.getElementById('link-google').addEventListener('click',   () => window.bapi.openUrl('https://aistudio.google.com/app/apikey'));
document.getElementById('inp-provider').addEventListener('change', e => updateModelHints(e.target.value));

// Theme swatches
document.querySelectorAll('.theme-swatch').forEach(s => s.addEventListener('click', () => applyTheme(s.dataset.theme)));

// Pet design swatches
document.querySelectorAll('.pet-swatch').forEach(s => {
  s.addEventListener('click', () => { mountPetRenderer(s.dataset.pet); });
});

// Settings toggles
document.querySelectorAll('#settings-overlay .toggle:not(.r-enabled)').forEach(t => {
  t.addEventListener('click', () => t.classList.toggle('on'));
});

// F4
document.getElementById('btn-f4').addEventListener('click',    openF4);
document.getElementById('f4-close').addEventListener('click',  closeF4);
document.getElementById('f4-search').addEventListener('input', () => renderF4(allModels));
document.getElementById('f4-search').addEventListener('keydown', e => { if (e.key==='Escape') closeF4(); });

// Opacity slider
document.getElementById('opacity-slider').addEventListener('input', (e) => {
  const v = +e.target.value;
  document.getElementById('opacity-val').textContent = v + '%';
  window.bapi.setOpacity(v / 100);
});

// Input toolbar — Phase 3
document.getElementById('btn-new-session').addEventListener('click', async () => {
  await SESSIONS.newSession();
  chatHistory = [];
  chatArea.innerHTML = '';
  addMsg('assistant', 'New session started. What are we working on today?');
});
document.getElementById('btn-history').addEventListener('click', () => {
  SESSIONS.togglePanel(chatHistory, (msgs, isNew) => {
    chatHistory = msgs.map(m => ({ role: m.role, content: m.content }));
    chatArea.innerHTML = '';
    chatHistory.slice(-10).forEach(m => addMsg(m.role, m.content));
    if (isNew) addMsg('assistant', 'New session. What are we debugging today?');
  });
});
document.getElementById('btn-snippets').addEventListener('click', () => SNIPPETS.togglePanel());

// Language pill
document.getElementById('lang-pill').addEventListener('click', () => {
  const opts  = ['en', 'id', 'auto'];
  const next  = opts[(opts.indexOf(currentLang) + 1) % opts.length];
  currentLang = next;
  updateLangPill();
  window.bapi.storeSet('language', next);
});

// Keyboard
userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// Drag setup
setupDrag(document.getElementById('titlebar'));
setupDrag(document.getElementById('settings-header'));
setupDrag(document.getElementById('pet-area'));

// IPC from main
window.bapi.onReminder(handleReminder);
window.bapi.onOpenSettings(openSettings);

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await loadTheme();
  await loadPetDesign();
  await SESSIONS.init();
  await SNIPPETS.init();

  const [apiKey, savedHistory, savedRem, savedTama, savedLang, opacity] = await Promise.all([
    window.bapi.storeGet('apiKey'),
    window.bapi.storeGet('chatHistory'),
    window.bapi.storeGet('reminders'),
    window.bapi.storeGet('tamagotchiEnabled'),
    window.bapi.storeGet('language'),
    window.bapi.storeGet('opacity'),
  ]);

  currentLang = savedLang || 'en';
  updateLangPill();

  if (opacity) {
    const pct = Math.round(opacity * 100);
    document.getElementById('opacity-slider').value = pct;
    document.getElementById('opacity-val').textContent = pct + '%';
  }

  reminders = savedRem || [];
  renderPills(reminders);

  tamagotchiEnabled = !!savedTama;
  applyTamagotchiMode(tamagotchiEnabled);

  if (!apiKey) {
    setTimeout(openSettings, 400);
    addMsg('assistant', "Hi! I'm BAPI. Add your API key in ⚙ Settings to get started.");
    return;
  }

  if (savedHistory?.length) {
    chatHistory = savedHistory.slice(-20);
    chatHistory.slice(-6).forEach(m => addMsg(m.role, m.content));
    chatArea.scrollTop = chatArea.scrollHeight;
  } else {
    const h = new Date().getHours();
    const g = h < 12 ? "Morning! BAPI online. What's on the board today?"
            : h < 17 ? "Mid-shift. How's the code holding up?"
            :           "Evening. Still at the terminal?";
    addMsg('assistant', g);
    chatHistory.push({ role:'assistant', content:g });
  }

  PET.idle();
  userInput.focus();
}

init();
