// ── BAPI Renderer v3 ──────────────────────────────────────────────────────────

// ── SCN-style system prompt ───────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are BAPI — a senior SAP ABAP consultant who answers like a top-rated SCN (SAP Community Network) contributor.

IDENTITY: 15+ years ABAP. Covered everything: Classic ABAP, Dialog/Dynpro, Table Controls, ALV, BAdI/Enhancement Framework, OData/SEGW, S/4HANA CDS, RAP, ABAP OO, RFCs, BAPIs, SmartForms, Adobe Forms, Workflow, CRM, SD/FI enhancements. Freelance, ex-Accenture/Deloitte/NTT Data. Knows legacy code pain firsthand.

ANSWER FORMAT (SCN style):
1. Answer first — code or direct statement. No preamble.
2. Use exact SAP artifact names: TCode (SE38, SM30, SEGW...), FM names, BAPI names, table/field names, class/method names.
3. Code in triple backtick blocks. ABAP code only, no filler.
4. Brief note on gotchas, OSS notes, or version differences if relevant.
5. For multi-step procedures: numbered list. For single answers: one paragraph max.

TONE: Direct. Like a senior replying to a colleague's urgent Slack message.
- Never say "Great question" or "I hope this helps"
- Never say "you might want to consider" — say what to do
- If something is wrong in user's code, say so directly
- Dark humor about SAP is welcome: missing FM docs, Table MARA having 800+ fields, etc.

RESPONSE LENGTH: 
- Simple question → 1-3 sentences + code if needed
- Complex topic → structured but still concise. Long = use bullet points, not paragraphs
- User is a 13-year ABAP veteran. Skip basics. Don't explain what a LOOP is.

When a reminder fires, check the time context label and respond accordingly:
- Morning: energize, ask about today's tickets/tasks
- Midday: progress check, one-liner ABAP joke
- EOD: celebrate or commiserate on the day's bugs, prep tomorrow`;

// ── SAP Theme config ──────────────────────────────────────────────────────────
// All 5 theme token sets are EMBEDDED in index.html as html[data-sap-theme="..."] blocks.
// applyTheme() simply sets the attribute — instant, zero network dependency.
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

// ── State ─────────────────────────────────────────────────────────────────────
let chatHistory  = [];
let isBusy       = false;
let reminders    = [];
let editReminders = [];
let allModels    = [];
let currentTheme = 'hacker';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const petWrap   = document.getElementById('pet-wrap');
const petStatus = document.getElementById('pet-status');
const antDot    = document.getElementById('ant-dot');
const mouth     = document.getElementById('bapi-mouth');
const chatArea  = document.getElementById('chat-area');
const pillsEl   = document.getElementById('pills');
const userInput = document.getElementById('user-input');
const sendBtn   = document.getElementById('send-btn');
const overlay   = document.getElementById('settings-overlay');

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme(themeId) {
  // Directly set the data-sap-theme attribute on <html>.
  // CSS selectors html[data-sap-theme="..."] are already embedded in index.html —
  // this is instant, no network call, no CDN latency.
  if (!SAP_THEMES[themeId]) themeId = 'sap_fiori_3_dark'; // fallback to Quartz Dark
  document.documentElement.setAttribute('data-sap-theme', themeId);
  currentTheme = themeId;
  document.querySelectorAll('.theme-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.theme === themeId);
  });
}

async function loadTheme() {
  const t = (await window.bapi.storeGet('theme')) || 'sap_fiori_3_dark';
  applyTheme(t);
}

// ── Pet state machine ─────────────────────────────────────────────────────────
const PET = {
  idle() {
    petWrap.style.animation = 'floatAnim 3.4s ease-in-out infinite';
    petStatus.textContent   = 'READY'; petStatus.style.color = 'var(--accent)';
    antDot.style.animation  = 'glow 2s ease-in-out infinite';
    mouth.setAttribute('d', 'M27 62 Q46 75 65 62'); mouth.style.opacity = '.82';
  },
  thinking() {
    petWrap.style.animation = 'none';
    petStatus.textContent   = 'THINKING...'; petStatus.style.color = 'var(--amber)';
    antDot.style.animation  = 'fastFlash .22s infinite';
    mouth.setAttribute('d', 'M32 64 Q46 64 60 64'); mouth.style.opacity = '.3';
  },
  happy() {
    petWrap.style.animation = 'bounceAnim .42s ease-in-out 3';
    petStatus.textContent   = 'DONE!'; petStatus.style.color = 'var(--accent)';
    antDot.style.animation  = 'glow .55s infinite';
    mouth.setAttribute('d', 'M22 58 Q46 76 70 58'); mouth.style.opacity = '1';
    setTimeout(() => PET.idle(), 2800);
  },
  error() {
    petWrap.style.animation = 'shake .4s ease-in-out';
    petStatus.textContent   = 'ERROR'; petStatus.style.color = 'var(--red)';
    antDot.style.animation  = 'fastFlash .5s infinite';
    mouth.setAttribute('d', 'M28 68 Q46 60 64 68'); mouth.style.opacity = '.7';
    setTimeout(() => PET.idle(), 3000);
  },
};

// ── Collapse / Expand ─────────────────────────────────────────────────────────
function collapse() {
  document.body.classList.add('collapsed');
  window.bapi.collapse();
}
function expand() {
  document.body.classList.remove('collapsed');
  window.bapi.expand();
}

// ── Chat ──────────────────────────────────────────────────────────────────────
function addMsg(role, text, id) {
  const div = document.createElement('div');
  div.className = `msg msg-${role === 'user' ? 'user' : 'bapi'}`;
  if (role === 'thinking') div.classList.add('msg-thinking');
  if (id) div.id = id;
  div.textContent = text;

  // Add expand-to-reader button for BAPI messages (not thinking placeholders)
  if (role === 'assistant') {
    const btn = document.createElement('button');
    btn.className = 'msg-expand-btn';
    btn.title     = 'Open in reader';
    btn.textContent = '⤢';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.bapi.openReader(text, currentTheme);
    });
    div.appendChild(btn);
  }

  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
  return div;
}

async function sendMessage(overrideText) {
  const text = (overrideText ?? userInput.value).trim();
  if (!text || isBusy) return;

  userInput.value = '';
  isBusy = true;
  sendBtn.disabled = true;
  addMsg('user', text);
  PET.thinking();
  chatHistory.push({ role: 'user', content: text });
  const bubble = addMsg('thinking', '...', 'live-bubble');

  try {
    const result = await window.bapi.chat({ messages: chatHistory, system: SYSTEM_PROMPT });

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
      bubble.id = ''; bubble.textContent = reply;
      bubble.classList.remove('msg-thinking');
      // Add expand button to this bubble
      const btn = document.createElement('button');
      btn.className = 'msg-expand-btn'; btn.title = 'Open in reader'; btn.textContent = '⤢';
      btn.addEventListener('click', (e) => { e.stopPropagation(); window.bapi.openReader(reply, currentTheme); });
      bubble.appendChild(btn);
      chatHistory.push({ role: 'assistant', content: reply });
      PET.happy();
      await window.bapi.storeSet('chatHistory', chatHistory.slice(-40));
    }
  } catch (e) {
    bubble.id = ''; bubble.textContent = `Network error: ${e.message}`;
    bubble.classList.remove('msg-thinking'); chatHistory.pop(); PET.error();
  }

  isBusy = false; sendBtn.disabled = false; userInput.focus();
}

// ── Pills ─────────────────────────────────────────────────────────────────────
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

// ── Reminder ──────────────────────────────────────────────────────────────────
function handleReminder(reminder) {
  const pill = pillsEl.querySelector(`[data-id="${reminder.id}"]`);
  if (pill) { pill.classList.add('active'); setTimeout(() => pill.classList.remove('active'), 3000); }
  const h = new Date().getHours();
  const ctx = h < 12 ? 'morning' : h < 17 ? 'midday' : 'evening';
  sendMessage(`[${reminder.emoji} ${reminder.label} reminder — ${reminder.time}] ${ctx} check-in`);
}

// ── Settings: reminders editor ────────────────────────────────────────────────
function renderReminderList() {
  const list = document.getElementById('reminders-list');
  list.innerHTML = '';
  editReminders.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'r-row';
    row.innerHTML = `
      <div class="toggle r-enabled ${r.enabled ? 'on' : ''}" data-idx="${i}"><div class="toggle-thumb"></div></div>
      <input class="r-emoji" type="text" maxlength="2" value="${r.emoji}" data-idx="${i}" data-field="emoji">
      <input class="r-name"  type="text" value="${r.label}"  data-idx="${i}" data-field="label" placeholder="Label">
      <input class="r-time"  type="time" value="${r.time}"   data-idx="${i}" data-field="time">
      <button class="r-del" data-idx="${i}">✕</button>`;
    list.appendChild(row);
  });
  list.querySelectorAll('.r-enabled').forEach(t => {
    t.addEventListener('click', () => {
      const i = +t.dataset.idx; editReminders[i].enabled = !editReminders[i].enabled;
      t.classList.toggle('on', editReminders[i].enabled);
    });
  });
  list.querySelectorAll('input[data-field]').forEach(inp => {
    inp.addEventListener('input', () => { editReminders[+inp.dataset.idx][inp.dataset.field] = inp.value; });
  });
  list.querySelectorAll('.r-del').forEach(btn => {
    btn.addEventListener('click', () => { editReminders.splice(+btn.dataset.idx, 1); renderReminderList(); });
  });
}

// ── Settings open/save ────────────────────────────────────────────────────────
async function openSettings() {
  overlay.classList.remove('hidden');
  const [apiKey, model, provider, savedRem, remEnabled, startLogin, opacity] = await Promise.all([
    window.bapi.storeGet('apiKey'),
    window.bapi.storeGet('apiModel'),
    window.bapi.storeGet('apiProvider'),
    window.bapi.storeGet('reminders'),
    window.bapi.storeGet('remindersEnabled'),
    window.bapi.storeGet('startOnLogin'),
    window.bapi.storeGet('opacity'),
  ]);

  const prov = provider || 'google';
  document.getElementById('inp-provider').value = prov;
  document.getElementById('inp-apikey').value   = apiKey ? '••••••••••••••••' : '';
  document.getElementById('inp-model').value    = model  || '';
  updateModelHints(prov);
  setToggle('toggle-reminders', remEnabled !== false);
  setToggle('toggle-login',     !!startLogin);

  const opVal = Math.round((opacity || 1.0) * 100);
  document.getElementById('opacity-slider').value = opVal;
  document.getElementById('opacity-val').textContent = opVal + '%';

  editReminders = JSON.parse(JSON.stringify(savedRem || []));
  renderReminderList();

  // Mark active theme swatch
  document.querySelectorAll('.theme-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.theme === currentTheme);
  });
}

function closeSettings() { overlay.classList.add('hidden'); }

async function saveSettings() {
  const provider = document.getElementById('inp-provider').value;
  await window.bapi.storeSet('apiProvider', provider);

  const rawKey = document.getElementById('inp-apikey').value.trim();
  if (rawKey && !rawKey.startsWith('••')) {
    await window.bapi.storeSet('apiKey', rawKey);
    showApiStatus('Key saved ✓', 'var(--accent)');
  }

  const modelInput = document.getElementById('inp-model').value.trim();
  await window.bapi.storeSet('apiModel', modelInput || MODEL_DEFAULTS[provider] || '');

  const valid = editReminders.filter(r => r.label && /^\d{2}:\d{2}$/.test(r.time));
  if (valid.length !== editReminders.length) {
    showApiStatus('Fix reminder times (HH:MM)', 'var(--amber)'); return;
  }

  const remEnabled  = isToggleOn('toggle-reminders');
  const startLogin  = isToggleOn('toggle-login');
  const opPct       = +document.getElementById('opacity-slider').value;

  await Promise.all([
    window.bapi.storeSet('reminders',        valid),
    window.bapi.storeSet('remindersEnabled', remEnabled),
    window.bapi.storeSet('startOnLogin',     startLogin),
    window.bapi.storeSet('theme',            currentTheme),
    window.bapi.storeSet('opacity',          opPct / 100),
  ]);

  window.bapi.setOpacity(opPct / 100);
  window.bapi.settingsSaved({ startOnLogin: startLogin, reminders: valid });

  reminders = valid;
  renderPills(reminders);
  showApiStatus('Saved ✓', 'var(--accent)');
  setTimeout(closeSettings, 700);
}

function updateModelHints(provider) {
  document.getElementById('inp-model').placeholder = MODEL_DEFAULTS[provider] || '';
  document.getElementById('model-hint').textContent = MODEL_HINTS[provider] || '';
}

function showApiStatus(msg, color) {
  const el = document.getElementById('api-status');
  el.style.display = 'block'; el.style.color = color; el.textContent = msg;
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}
function setToggle(id, on)   { document.getElementById(id).classList.toggle('on', on); }
function isToggleOn(id)      { return document.getElementById(id).classList.contains('on'); }

// ── F4 Model Picklist ─────────────────────────────────────────────────────────
function openF4() {
  const provider = document.getElementById('inp-provider')?.value;
  if (provider !== 'google') { showApiStatus('F4 = Google provider only', 'var(--amber)'); return; }
  document.getElementById('f4-overlay').classList.remove('hidden');
  document.getElementById('f4-search').value = '';
  if (allModels.length > 0) { renderF4(allModels); document.getElementById('f4-search').focus(); return; }
  document.getElementById('f4-list').innerHTML = '<div class="f4-loading">fetching from Google...</div>';
  window.bapi.listModels().then(result => {
    if (result.error) { document.getElementById('f4-list').innerHTML = `<div class="f4-error">${result.error}</div>`; return; }
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
  if (!list.length) { document.getElementById('f4-list').innerHTML = '<div class="f4-loading">no match</div>'; return; }
  document.getElementById('f4-list').innerHTML = list.map(m => {
    const free = FREE_MODELS.has(m.id);
    const sel  = m.id === current;
    const desc = m.description ? `<div class="f4-model-desc">${m.description.slice(0, 90)}${m.description.length > 90 ? '…' : ''}</div>` : '';
    return `<div class="f4-row${sel ? ' selected' : ''}" data-id="${m.id}">
      <div class="f4-row-left">
        <div class="f4-model-name">${m.displayName}</div>
        <div class="f4-model-id">${m.id}</div>${desc}
      </div>
      <span class="f4-badge${free ? ' free' : ''}">${free ? 'free' : 'paid'}</span>
    </div>`;
  }).join('');
  document.querySelectorAll('.f4-row').forEach(row => {
    row.addEventListener('click', () => {
      document.getElementById('inp-model').value = row.dataset.id;
      updateModelHints('google');
      closeF4();
    });
  });
  const sel = document.querySelector('.f4-row.selected');
  if (sel) sel.scrollIntoView({ block: 'center' });
}


// ── Window drag (smooth, no -webkit-app-region lag) ──────────────────────────
// Called on mousedown on any draggable surface.
// Main process polls screen.getCursorScreenPoint() at 60fps.
function setupDrag(el) {
  if (!el) return;
  el.addEventListener('mousedown', (e) => {
    // Only left-button drag; ignore clicks on buttons/inputs/selects
    if (e.button !== 0) return;
    if (['BUTTON','INPUT','SELECT','TEXTAREA','A'].includes(e.target.tagName)) return;
    if (e.target.closest('button, input, select, a')) return;

    e.preventDefault();
    window.bapi.dragStart();

    const onUp = () => {
      window.bapi.dragEnd();
      window.removeEventListener('mouseup',   onUp,   true);
      window.removeEventListener('mouseleave', onUp,  true);
    };
    window.addEventListener('mouseup',    onUp, true);
    window.addEventListener('mouseleave', onUp, true);
  });
}

// ── Wire events ───────────────────────────────────────────────────────────────
document.getElementById('btn-close').addEventListener('click',     () => window.bapi.hide());
document.getElementById('btn-minimize').addEventListener('click',  () => window.bapi.minimize());
document.getElementById('btn-hide').addEventListener('click',      () => window.bapi.hide());
document.getElementById('tb-gear').addEventListener('click',       openSettings);

// ── Attach drag to all draggable surfaces ──
setupDrag(document.getElementById('titlebar'));
setupDrag(document.getElementById('settings-header'));
setupDrag(document.getElementById('pet-area'));   // works in both normal + collapsed mode
document.getElementById('tb-collapse').addEventListener('click',   collapse);
document.getElementById('pet-area').addEventListener('click', (e) => {
  if (document.body.classList.contains('collapsed')) expand();
});
document.getElementById('btn-expand').addEventListener('click',    expand);
document.getElementById('settings-back').addEventListener('click', closeSettings);
document.getElementById('save-btn').addEventListener('click',      saveSettings);
document.getElementById('add-reminder').addEventListener('click', () => {
  editReminders.push({ id: 'r' + Date.now(), emoji: '🔔', label: 'Reminder', time: '10:00', enabled: true });
  renderReminderList();
  document.getElementById('settings-body').scrollTop = 9999;
});
document.getElementById('send-btn').addEventListener('click', () => sendMessage());
document.getElementById('link-console').addEventListener('click', () => window.bapi.openUrl('https://console.anthropic.com/'));
document.getElementById('link-google').addEventListener('click',  () => window.bapi.openUrl('https://aistudio.google.com/app/apikey'));
document.getElementById('inp-provider').addEventListener('change', e => updateModelHints(e.target.value));

// Theme swatches
document.querySelectorAll('.theme-swatch').forEach(s => {
  s.addEventListener('click', () => applyTheme(s.dataset.theme));
});

// Opacity slider — live preview
document.getElementById('opacity-slider').addEventListener('input', (e) => {
  const v = +e.target.value;
  document.getElementById('opacity-val').textContent = v + '%';
  window.bapi.setOpacity(v / 100);
});

// Settings overlay toggles
document.querySelectorAll('#settings-overlay .toggle:not(.r-enabled)').forEach(t => {
  t.addEventListener('click', () => t.classList.toggle('on'));
});

// F4
document.getElementById('btn-f4').addEventListener('click',    openF4);
document.getElementById('f4-close').addEventListener('click',  closeF4);
document.getElementById('f4-search').addEventListener('input', () => renderF4(allModels));
document.getElementById('f4-search').addEventListener('keydown', e => { if (e.key === 'Escape') closeF4(); });

// Keyboard
userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// IPC from main
window.bapi.onReminder(handleReminder);
window.bapi.onOpenSettings(openSettings);

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await loadTheme();

  const [apiKey, savedHistory, savedRem, collapsed, opacity] = await Promise.all([
    window.bapi.storeGet('apiKey'),
    window.bapi.storeGet('chatHistory'),
    window.bapi.storeGet('reminders'),
    window.bapi.storeGet('collapsed'),
    window.bapi.storeGet('opacity'),
  ]);

  // Apply opacity display
  if (opacity) {
    const pct = Math.round(opacity * 100);
    document.getElementById('opacity-slider').value = pct;
    document.getElementById('opacity-val').textContent = pct + '%';
  }

  // Restore collapsed state
  if (collapsed) document.body.classList.add('collapsed');

  reminders = savedRem || [];
  renderPills(reminders);

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
    chatHistory.push({ role: 'assistant', content: g });
  }

  PET.idle();
  userInput.focus();
}

init();
