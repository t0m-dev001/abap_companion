/**
 * BAPI Pet Renderer — Design 1: Retro Pixel "Code Sprite"
 * Classic 8-bit Tamagotchi style. Pixel-art robot, green data particles,
 * scrolling transport banner on reminder, mini keyboard on AI active.
 * Zero GPU cost — pure CSS + SVG animation.
 */
class PixelPetRenderer {
  constructor(container) {
    this.container = container;
    this.particleTimer  = null;
    this.scrollTimer    = null;
    this.blinkTimer     = null;
  }

  mount() {
    this.container.innerHTML = `
      <style>
        /* ── Pixel renderer scoped styles ── */
        #px-casing {
          display:inline-flex; flex-direction:column; align-items:center;
          background:#c8c0a8; border:3px solid #6a6050;
          border-radius:6px; padding:6px 8px; box-shadow:2px 2px 0 #3a3028;
          position:relative; cursor:default;
        }
        #px-screen {
          width:82px; height:72px;
          background:#0a1a0a; border:2px solid #3a4a3a;
          border-radius:2px; overflow:hidden; position:relative;
          image-rendering:pixelated;
        }
        #px-screen.blue  { background:#000a1a; border-color:#0a2a4a; }
        #px-screen.amber { background:#1a0a00; border-color:#4a2a00; }
        /* Particle canvas layer */
        #px-particles { position:absolute; inset:0; pointer-events:none; }
        /* Sprite grid — 14×14 pixels rendered as CSS */
        #px-sprite {
          position:absolute; bottom:6px; left:50%;
          transform:translateX(-50%);
          display:grid; grid-template-columns:repeat(14,4px);
          gap:0; image-rendering:pixelated;
        }
        .px { width:4px; height:4px; }
        /* Scrolling banner */
        #px-banner {
          position:absolute; bottom:0; left:0; right:0; height:12px;
          background:#1a2a1a; overflow:hidden; display:none;
        }
        #px-banner-text {
          position:absolute; white-space:nowrap;
          font-family:'Courier New',monospace; font-size:8px;
          color:#ffaa00; line-height:12px; padding-left:82px;
          animation:px-scroll 6s linear infinite;
        }
        @keyframes px-scroll { from{transform:translateX(0)} to{transform:translateX(-100%)} }
        /* Buttons below screen */
        #px-buttons {
          display:flex; gap:6px; margin-top:5px;
        }
        .px-btn {
          width:14px; height:8px;
          background:#7a6a58; border:1px solid #3a3028;
          border-radius:10px; box-shadow:0 1px 0 #3a3028;
        }
        /* Pixel status text */
        #px-status-label {
          font-family:'Courier New',monospace; font-size:8px;
          color:#88aa88; margin-top:3px; letter-spacing:.5px;
        }
        /* LED indicators */
        #px-leds {
          position:absolute; top:5px; right:6px;
          display:flex; flex-direction:column; gap:2px;
        }
        .px-led { width:4px; height:4px; border-radius:50%; background:#1a3a1a; }
        .px-led.on  { background:#00ff44; box-shadow:0 0 3px #00ff44; }
        .px-led.amber { background:#ffaa00; box-shadow:0 0 3px #ffaa00; animation:px-blink .5s infinite; }
        .px-led.blue  { background:#0088ff; box-shadow:0 0 3px #0088ff; }
        @keyframes px-blink { 0%,100%{opacity:1} 50%{opacity:.2} }
        /* Typing keyboard */
        #px-keyboard {
          position:absolute; bottom:14px; left:4px; right:4px;
          height:16px; display:none;
          background:#0a0a0a; border:1px solid #1a3a1a;
          border-radius:1px; overflow:hidden;
        }
        .px-key-row {
          display:flex; gap:1px; padding:1px;
        }
        .px-key {
          height:5px; flex:1; background:#1a3a1a;
          border-radius:1px; animation:px-keypress .3s infinite;
        }
        .px-key:nth-child(even) { animation-delay:.15s; }
        .px-key:nth-child(3n)   { animation-delay:.08s; }
        @keyframes px-keypress { 0%,100%{background:#1a3a1a} 50%{background:#00ff44} }
        /* Loading bar */
        #px-loadbar {
          position:absolute; top:4px; left:4px; right:4px;
          height:6px; background:#0a1a0a; border:1px solid #0a4a0a; display:none;
        }
        #px-loadfill {
          height:100%; background:#00ff44; width:0%;
          transition:width .1s; box-shadow:0 0 4px #00ff44;
        }
        #px-load-icons {
          position:absolute; top:12px; left:0; right:0;
          display:none; justify-content:center; gap:3px;
        }
        .px-ticon {
          width:8px; height:8px; background:#00ff44;
          opacity:.6; clip-path:polygon(50% 0%,100% 100%,0% 100%);
          animation:px-spin 1s linear infinite;
        }
        .px-ticon:nth-child(2){ animation-delay:.33s; }
        .px-ticon:nth-child(3){ animation-delay:.66s; }
        @keyframes px-spin { to{transform:rotate(360deg)} }
        #px-thumbs {
          position:absolute; bottom:20px; left:50%;
          transform:translateX(-50%); display:none;
          font-size:16px; animation:px-pop .3s ease-out;
        }
        @keyframes px-pop { from{transform:translateX(-50%) scale(0)} to{transform:translateX(-50%) scale(1)} }
      </style>

      <div id="px-casing">
        <div id="px-leds">
          <div class="px-led on" id="px-led1"></div>
          <div class="px-led" id="px-led2"></div>
        </div>

        <div id="px-screen">
          <canvas id="px-particles" width="82" height="72"></canvas>
          <div id="px-sprite"></div>
          <div id="px-banner">
            <div id="px-banner-text">★ REMINDER: Check Transports! ★ SY-SUBRC = 0 ★ Have you COMMIT WORK today? ★</div>
          </div>
          <div id="px-keyboard">
            <div class="px-key-row"><div class="px-key"></div><div class="px-key"></div><div class="px-key"></div><div class="px-key"></div><div class="px-key"></div></div>
            <div class="px-key-row"><div class="px-key"></div><div class="px-key"></div><div class="px-key"></div><div class="px-key"></div></div>
          </div>
          <div id="px-loadbar"><div id="px-loadfill"></div></div>
          <div id="px-load-icons">
            <div class="px-ticon"></div><div class="px-ticon"></div><div class="px-ticon"></div>
          </div>
          <div id="px-thumbs">👍</div>
        </div>

        <div id="px-buttons">
          <div class="px-btn"></div>
          <div class="px-btn"></div>
          <div class="px-btn"></div>
        </div>
        <div id="px-status-label">READY</div>
      </div>`;

    this._initParticles();
    this.setState('idle');
  }

  // ── Sprite pixel maps ────────────────────────────────────────────────────────
  _sprites() {
    const G = '#00ff44'; const D = '#009922'; const B = '#000000'; const _ = null;
    return {
      idle: [
        _,_,_,G,G,G,G,G,G,G,_,_,_,_,
        _,_,G,G,G,G,G,G,G,G,G,_,_,_,
        _,G,G,D,D,G,G,D,D,G,G,G,_,_,
        _,G,G,D,G,G,G,D,G,G,G,G,_,_,
        _,G,G,D,D,G,G,D,D,G,G,G,_,_,
        _,_,G,G,G,G,G,G,G,G,G,_,_,_,
        _,_,G,G,D,D,D,D,G,G,G,_,_,_,
        _,_,G,G,G,G,G,G,G,G,_,_,_,_,
        _,G,G,G,G,G,G,G,G,G,G,_,_,_,
        G,_,G,G,G,G,G,G,G,G,_,G,_,_,
        _,_,G,G,G,G,G,G,G,G,_,_,_,_,
        _,_,_,G,_,_,_,_,G,_,_,_,_,_,
        _,_,_,G,G,_,_,G,G,_,_,_,_,_,
        _,_,_,_,_,_,_,_,_,_,_,_,_,_,
      ],
      alert: [
        _,_,_,G,G,G,G,G,G,G,_,_,_,_,
        _,_,G,G,G,G,G,G,G,G,G,_,_,_,
        _,G,G,G,G,G,G,G,G,G,G,G,_,_,
        _,G,G,D,G,G,G,D,G,G,G,G,_,_,
        _,G,G,D,G,G,G,D,G,G,G,G,_,_,
        _,_,G,G,G,G,G,G,G,G,G,_,_,_,
        _,_,G,G,G,D,D,G,G,G,G,_,_,_,
        _,_,G,G,G,G,G,G,G,G,_,_,_,_,
        _,G,G,G,G,G,G,G,G,G,G,_,_,_,
        G,G,G,G,G,G,G,G,G,G,G,G,_,_,
        _,_,G,G,G,G,G,G,G,G,_,_,_,_,
        _,_,_,G,_,_,_,_,G,_,_,_,_,_,
        _,_,_,G,G,_,_,G,G,_,_,_,_,_,
        _,_,_,_,_,_,_,_,_,_,_,_,_,_,
      ],
    };
  }

  _renderSprite(type) {
    const sprites = this._sprites();
    const map     = sprites[type] || sprites.idle;
    const el      = document.getElementById('px-sprite');
    if (!el) return;
    el.innerHTML  = map.map(c =>
      `<div class="px" style="background:${c || 'transparent'}"></div>`
    ).join('');
  }

  // ── Particle system ──────────────────────────────────────────────────────────
  _initParticles() {
    const canvas = document.getElementById('px-particles');
    if (!canvas) return;
    const ctx    = canvas.getContext('2d');
    const W = 82; const H = 72;
    const particles = Array.from({length: 12}, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vy: -(0.3 + Math.random() * 0.4),
      alpha: Math.random(),
      size: Math.random() > 0.5 ? 2 : 1,
    }));

    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => {
        p.y  += p.vy;
        p.alpha -= 0.008;
        if (p.alpha <= 0 || p.y < 0) {
          p.x = Math.random() * W; p.y = H; p.alpha = 0.6 + Math.random() * 0.4;
        }
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle   = '#00ff44';
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      });
      ctx.globalAlpha = 1;
      this._particleRAF = requestAnimationFrame(tick);
    };
    tick();
  }

  // ── Loading bar animation ────────────────────────────────────────────────────
  _startLoadbar() {
    const fill = document.getElementById('px-loadfill');
    if (!fill) return;
    fill.style.width = '0%';
    let w = 0;
    this._loadInterval = setInterval(() => {
      w = Math.min(w + (2 + Math.random() * 4), 95);
      fill.style.width = w + '%';
    }, 80);
  }
  _finishLoadbar() {
    clearInterval(this._loadInterval);
    const fill = document.getElementById('px-loadfill');
    if (fill) fill.style.width = '100%';
  }

  // ── Public state API (called by PetRenderer coordinator) ────────────────────
  setState(state) {
    const screen   = document.getElementById('px-screen');
    const banner   = document.getElementById('px-banner');
    const keyboard = document.getElementById('px-keyboard');
    const loadbar  = document.getElementById('px-loadbar');
    const icons    = document.getElementById('px-load-icons');
    const thumbs   = document.getElementById('px-thumbs');
    const led1     = document.getElementById('px-led1');
    const led2     = document.getElementById('px-led2');
    const label    = document.getElementById('px-status-label');
    if (!screen) return;

    // Reset all overlays
    [banner, keyboard, loadbar, icons, thumbs].forEach(el => { if(el) el.style.display = 'none'; });
    screen.className     = '';
    led1.className       = 'px-led on';
    led2.className       = 'px-led';
    clearInterval(this._loadInterval);

    if (state === 'idle') {
      this._renderSprite('idle');
      if (label) label.textContent = 'READY';
    }
    else if (state === 'thinking') {
      screen.classList.add('blue');
      led2.className = 'px-led blue';
      this._renderSprite('idle');
      if (keyboard)     { keyboard.style.display = 'block'; }
      if (loadbar)      { loadbar.style.display = 'block'; this._startLoadbar(); }
      if (icons)        icons.style.display = 'flex';
      if (label)        label.textContent = 'WORKING';
    }
    else if (state === 'happy') {
      screen.classList.add('blue');
      this._finishLoadbar();
      if (loadbar)  loadbar.style.display = 'block';
      if (thumbs)   { thumbs.style.display = 'block'; }
      if (label)    label.textContent = 'DONE!';
      setTimeout(() => this.setState('idle'), 2800);
    }
    else if (state === 'reminder') {
      screen.classList.add('amber');
      led1.className = 'px-led amber';
      this._renderSprite('alert');
      if (banner) banner.style.display = 'block';
      if (label)  label.textContent = 'ALERT';
    }
    else if (state === 'error') {
      led1.className = 'px-led amber';
      this._renderSprite('alert');
      if (label) label.textContent = 'ERR';
      setTimeout(() => this.setState('idle'), 3000);
    }
  }

  getStatusText(state) {
    return { idle:'READY', thinking:'WORKING...', happy:'DONE!', reminder:'ALERT', error:'ERR' }[state] || 'READY';
  }

  unmount() {
    cancelAnimationFrame(this._particleRAF);
    clearInterval(this._loadInterval);
    this.container.innerHTML = '';
  }
}
