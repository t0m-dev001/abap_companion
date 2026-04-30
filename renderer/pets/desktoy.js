/**
 * BAPI Pet Renderer — Design 3: Desk Toy "Coming Soon"
 * Placeholder renderer. Shows a preview card with "In Development" badge.
 * Slot is reserved in the picker so the UI feels premium from day one.
 */
class DeskToyPetRenderer {
  constructor(container) {
    this.container = container;
  }

  mount() {
    this.container.innerHTML = `
      <style>
        #dt-card {
          width:110px;
          background:var(--sapGroup_ContentBackground);
          border:1px dashed var(--sapContent_ForegroundBorderColor);
          border-radius:var(--sapContent_BorderRadius);
          padding:14px 10px;
          display:flex; flex-direction:column; align-items:center; gap:8px;
          opacity:.7;
        }
        #dt-robot {
          font-size:36px; line-height:1;
          filter:grayscale(1);
          animation:dt-bob 3s ease-in-out infinite;
        }
        @keyframes dt-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        #dt-badge {
          font-family:var(--sapFontFamily); font-size:.5625rem;
          font-weight:700; letter-spacing:.08em;
          color:var(--sapCriticalColor);
          border:1px solid var(--sapCriticalColor);
          border-radius:var(--sapButton_BorderRadius);
          padding:2px 7px; text-transform:uppercase;
        }
        #dt-label {
          font-family:var(--sapFontFamily); font-size:.625rem;
          color:var(--sapContent_LabelColor); text-align:center;
          line-height:1.4;
        }
      </style>
      <div id="dt-card">
        <div id="dt-robot">🤖</div>
        <div id="dt-badge">Coming Soon</div>
        <div id="dt-label">Holographic<br>Desk Toy</div>
      </div>`;
  }

  // Desk toy placeholder does nothing for state changes yet
  setState(state) {}
  getStatusText(state) { return 'SOON'; }
  unmount() { this.container.innerHTML = ''; }
}
