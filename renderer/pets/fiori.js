/**
 * BAPI Pet Renderer — Design 2: Fiori Float
 * Glassmorphic Fiori-style card with rotating 3D polyhedron.
 * Uses CSS 3D transforms (no Three.js dependency) for zero-install.
 * Colors adapt to the active SAP theme via CSS variables.
 */
class FioriPetRenderer {
  constructor(container) {
    this.container = container;
    this._rafId    = null;
    this._angle    = 0;
    this._targetColor = 'var(--sapHighlightColor)';
    this._currentState = 'idle';
  }

  mount() {
    this.container.innerHTML = `
      <style>
        #ff-card {
          width:110px;
          background:color-mix(in srgb, var(--sapBaseColor) 85%, transparent);
          border:1px solid var(--sapContent_ForegroundBorderColor);
          border-radius:var(--sapContent_BorderRadius);
          padding:10px 8px 8px;
          display:flex; flex-direction:column; align-items:center; gap:6px;
          backdrop-filter:blur(8px);
          box-shadow:0 4px 24px rgba(0,0,0,.35);
          position:relative; overflow:hidden;
        }
        /* Glow halo behind crystal */
        #ff-glow {
          position:absolute; top:50%; left:50%;
          width:70px; height:70px;
          transform:translate(-50%,-60%);
          border-radius:50%;
          background:radial-gradient(circle, var(--ff-accent,var(--sapHighlightColor)) 0%, transparent 70%);
          opacity:.25; transition:opacity .4s, background .4s;
          pointer-events:none;
        }
        /* Crystal stage */
        #ff-stage {
          width:70px; height:70px;
          perspective:200px; position:relative;
        }
        #ff-crystal {
          width:70px; height:70px;
          position:relative;
          transform-style:preserve-3d;
          transform:rotateY(0deg) rotateX(15deg);
          transition:transform .1s linear;
        }
        /* 8 faces of octahedron using CSS clip-path */
        .ff-face {
          position:absolute; width:35px; height:30px;
          border:1px solid;
          opacity:.82;
          transition:background .4s, border-color .4s;
        }
        /* Icon stream for AI state */
        #ff-icons {
          position:absolute; inset:0;
          display:none; align-items:center; justify-content:center;
          gap:6px; flex-wrap:wrap; padding:6px;
        }
        .ff-icon {
          width:14px; height:14px; opacity:.7;
          animation:ff-float 1.2s ease-in-out infinite;
          color:var(--sapHighlightColor);
        }
        .ff-icon:nth-child(2){animation-delay:.2s}
        .ff-icon:nth-child(3){animation-delay:.4s}
        .ff-icon:nth-child(4){animation-delay:.6s}
        @keyframes ff-float{ 0%,100%{transform:translateY(0) scale(1);opacity:.5} 50%{transform:translateY(-4px) scale(1.1);opacity:1} }

        /* Status row */
        #ff-status-row {
          display:flex; align-items:center; justify-content:space-between;
          width:100%;
        }
        #ff-brand {
          font-family:var(--sapFontFamily); font-size:.5625rem; font-weight:700;
          color:var(--sapHighlightColor); letter-spacing:.1em;
        }
        #ff-dot {
          width:6px; height:6px; border-radius:50%;
          background:var(--sapPositiveColor);
          animation:ff-pulse 2s ease-in-out infinite;
        }
        @keyframes ff-pulse{ 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.8)} }
        #ff-status-text {
          font-family:var(--sapFontFamily); font-size:.5rem;
          color:var(--sapContent_LabelColor); letter-spacing:.08em;
          text-align:center; text-transform:uppercase;
        }

        /* Reminder pulse ring */
        #ff-ring {
          position:absolute; inset:-4px; border-radius:50%;
          border:2px solid var(--sapCriticalColor);
          opacity:0; pointer-events:none;
          animation:none;
        }
        #ff-ring.active { opacity:1; animation:ff-ring-pulse .8s ease-in-out infinite; }
        @keyframes ff-ring-pulse{ 0%,100%{transform:scale(1);opacity:.8} 50%{transform:scale(1.12);opacity:.3} }

        /* Loading arc */
        #ff-loader {
          position:absolute; inset:0; display:none;
          align-items:center; justify-content:center;
        }
        #ff-loader svg { animation:ff-spin 1.2s linear infinite; }
        @keyframes ff-spin{ to{transform:rotate(360deg)} }
      </style>

      <div id="ff-card">
        <div id="ff-glow"></div>
        <div id="ff-stage">
          <div id="ff-ring"></div>
          <div id="ff-crystal" id="ff-crystal">
            <!-- Rendered via JS drawCrystal() -->
          </div>
          <div id="ff-icons">
            <!-- SAP-style mini SVG icons stream during AI state -->
            <svg class="ff-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M5 3L2 8l3 5M11 3l3 5-3 5"/></svg>
            <svg class="ff-icon" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="9" width="2" height="5"/><rect x="6" y="5" width="2" height="9"/><rect x="10" y="2" width="2" height="12"/></svg>
            <svg class="ff-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="8" cy="8" r="5"/><path d="M5.5 8l1.8 1.8L10.5 6"/></svg>
            <svg class="ff-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="2" y="3" width="12" height="10" rx="1"/><path d="M5 7h6M5 10h4"/></svg>
          </div>
          <div id="ff-loader">
            <svg width="40" height="40" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" fill="none" stroke="var(--sapHighlightColor)"
                stroke-width="2" stroke-dasharray="60 40" opacity=".8"/>
            </svg>
          </div>
        </div>

        <div id="ff-status-row">
          <span id="ff-brand">BAPI</span>
          <div id="ff-dot"></div>
        </div>
        <div id="ff-status-text">ready</div>
      </div>`;

    this._startRotation();
    this._applyState('idle');
  }

  // ── CSS 3D octahedron ────────────────────────────────────────────────────────
  _startRotation() {
    const crystal = document.getElementById('ff-crystal');
    if (!crystal) return;
    const speeds = { idle: 0.4, thinking: 1.8, happy: 2.5, reminder: 0.8, error: 0.6 };
    let ax = 15; let ay = 0;

    const tick = () => {
      const speed = speeds[this._currentState] || 0.4;
      ay += speed;
      ax  = this._currentState === 'thinking' ? 15 + Math.sin(ay * 0.05) * 20 : 15;
      crystal.style.transform = `rotateY(${ay}deg) rotateX(${ax}deg)`;
      this._rafId = requestAnimationFrame(tick);
    };
    // Build octahedron faces
    this._buildCrystal(crystal);
    tick();
  }

  _buildCrystal(el) {
    el.innerHTML = '';
    const faces = [
      { clip:'polygon(50% 0%, 100% 100%, 0% 100%)', top:'0px',  left:'17px', rot:'rotateY(0deg)   rotateX(0deg)',   z:'35px' },
      { clip:'polygon(50% 0%, 100% 100%, 0% 100%)', top:'0px',  left:'17px', rot:'rotateY(90deg)  rotateX(0deg)',   z:'35px' },
      { clip:'polygon(50% 0%, 100% 100%, 0% 100%)', top:'0px',  left:'17px', rot:'rotateY(180deg) rotateX(0deg)',   z:'35px' },
      { clip:'polygon(50% 0%, 100% 100%, 0% 100%)', top:'0px',  left:'17px', rot:'rotateY(270deg) rotateX(0deg)',   z:'35px' },
      { clip:'polygon(50% 100%, 100% 0%, 0% 0%)',   top:'30px', left:'17px', rot:'rotateY(0deg)   rotateX(180deg)', z:'35px' },
      { clip:'polygon(50% 100%, 100% 0%, 0% 0%)',   top:'30px', left:'17px', rot:'rotateY(90deg)  rotateX(180deg)', z:'35px' },
      { clip:'polygon(50% 100%, 100% 0%, 0% 0%)',   top:'30px', left:'17px', rot:'rotateY(180deg) rotateX(180deg)', z:'35px' },
      { clip:'polygon(50% 100%, 100% 0%, 0% 0%)',   top:'30px', left:'17px', rot:'rotateY(270deg) rotateX(180deg)', z:'35px' },
    ];
    faces.forEach((f, i) => {
      const d = document.createElement('div');
      d.className = 'ff-face';
      d.id        = `ff-f${i}`;
      d.style.cssText = `
        clip-path:${f.clip};top:${f.top};left:${f.left};
        transform:${f.rot} translateZ(${f.z});
        background:color-mix(in srgb,var(--sapHighlightColor) ${20 + i*3}%,transparent);
        border-color:color-mix(in srgb,var(--sapHighlightColor) 60%,transparent);`;
      el.appendChild(d);
    });
  }

  _applyState(state) {
    this._currentState = state;
    const glow    = document.getElementById('ff-glow');
    const ring    = document.getElementById('ff-ring');
    const icons   = document.getElementById('ff-icons');
    const loader  = document.getElementById('ff-loader');
    const dot     = document.getElementById('ff-dot');
    const txt     = document.getElementById('ff-status-text');
    if (!glow) return;

    // Reset
    if (ring)   ring.classList.remove('active');
    if (icons)  icons.style.display = 'none';
    if (loader) loader.style.display = 'none';

    const colorMap = {
      idle:      'var(--sapHighlightColor)',
      thinking:  '#ffffff',
      happy:     'var(--sapPositiveColor)',
      reminder:  'var(--sapCriticalColor)',
      error:     'var(--sapNegativeColor)',
    };
    const c = colorMap[state] || colorMap.idle;
    glow.style.background = `radial-gradient(circle, ${c} 0%, transparent 70%)`;
    glow.style.opacity    = state === 'thinking' ? '.45' : '.25';

    // Update face colors
    document.querySelectorAll('.ff-face').forEach((f, i) => {
      f.style.background   = `color-mix(in srgb,${c} ${18 + i*3}%,transparent)`;
      f.style.borderColor  = `color-mix(in srgb,${c} 55%,transparent)`;
    });

    if (state === 'thinking') {
      if (icons)  icons.style.display  = 'flex';
      if (loader) loader.style.display = 'flex';
      if (dot)    dot.style.background = 'var(--sapCriticalColor)';
      if (txt)    txt.textContent      = 'thinking…';
    } else if (state === 'happy') {
      if (dot)    dot.style.background = 'var(--sapPositiveColor)';
      if (txt)    txt.textContent      = 'done!';
      setTimeout(() => this._applyState('idle'), 2800);
    } else if (state === 'reminder') {
      if (ring)   ring.classList.add('active');
      if (dot)    dot.style.background = 'var(--sapCriticalColor)';
      if (txt)    txt.textContent      = 'reminder';
    } else if (state === 'error') {
      if (dot)    dot.style.background = 'var(--sapNegativeColor)';
      if (txt)    txt.textContent      = 'error';
      setTimeout(() => this._applyState('idle'), 3000);
    } else {
      if (dot)    dot.style.background = 'var(--sapPositiveColor)';
      if (txt)    txt.textContent      = 'ready';
    }
  }

  setState(state) { this._applyState(state); }

  getStatusText(state) {
    return { idle:'', thinking:'', happy:'', reminder:'', error:'' }[state] ?? '';
    // Fiori renderer shows status inside the card, not in the outer pet-status label
  }

  unmount() {
    cancelAnimationFrame(this._rafId);
    this.container.innerHTML = '';
  }
}
