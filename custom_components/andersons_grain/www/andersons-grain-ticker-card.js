/**
 * Anderson's Grain Ticker Card — minimal HA style
 *
 * type: custom:andersons-grain-ticker-card
 * speed: 35
 * commodities: [corn, soybean, red_wheat]
 * pause_on_hover: true
 */
class AndersonsGrainTickerCard extends HTMLElement {
  constructor() {
    super();
    this._animFrame = null;
    this._offset = 0;
    this._paused = false;
    this._lastTs = null;
  }

  set hass(hass) {
    const prev = JSON.stringify(this._items(this._hass));
    this._hass = hass;
    if (JSON.stringify(this._items(hass)) !== prev || !this._initialized) {
      this._render();
      this._initialized = true;
    }
  }

  setConfig(config) {
    this._config = {
      speed: config.speed || 35,
      commodities: config.commodities || ["corn", "soybean", "red_wheat"],
      pause_on_hover: config.pause_on_hover !== false,
    };
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
  }

  _findSummaryEntity(hass, commodity) {
    const labels = { corn: "Corn", soybean: "Soybean", red_wheat: "Red Wheat" };
    const label = labels[commodity] || commodity;
    for (const [, state] of Object.entries(hass?.states || {})) {
      const a = state.attributes || {};
      if (a.all_months && a.commodity === label) return state;
    }
    return null;
  }

  _items(hass) {
    if (!hass || !this._config) return [];
    return this._config.commodities.flatMap(commodity => {
      const entity = this._findSummaryEntity(hass, commodity);
      if (!entity) return [];
      const labels = { corn: "Corn", soybean: "Soybean", red_wheat: "Red Wheat" };
      const bid = parseFloat(entity.state);
      const change = entity.attributes?.change != null ? parseFloat(entity.attributes.change) : null;
      return [{ label: labels[commodity] || commodity, bid, change, delivery: entity.attributes?.delivery || "" }];
    });
  }

  _stopAnimation() {
    if (this._animFrame) { cancelAnimationFrame(this._animFrame); this._animFrame = null; }
  }

  _startAnimation() {
    this._stopAnimation();
    this._lastTs = null;
    const track = this.shadowRoot?.querySelector(".track");
    if (!track) return;
    const step = (ts) => {
      if (!this._lastTs) this._lastTs = ts;
      const dt = (ts - this._lastTs) / 1000;
      this._lastTs = ts;
      if (!this._paused) {
        const half = track.scrollWidth / 2;
        this._offset = (this._offset + this._config.speed * dt) % half;
        track.style.transform = `translateX(-${this._offset}px)`;
      }
      this._animFrame = requestAnimationFrame(step);
    };
    this._animFrame = requestAnimationFrame(step);
  }

  _render() {
    if (!this._config || !this._hass) return;
    this._stopAnimation();

    const items = this._items(this._hass);
    const itemHtml = items.map(item => {
      const bid = isNaN(item.bid) ? "—" : item.bid.toFixed(2);
      let chg = "", chgCls = "";
      if (item.change != null && !isNaN(item.change)) {
        chgCls = item.change > 0 ? "pos" : item.change < 0 ? "neg" : "";
        chg = `<span class="${chgCls}">${item.change > 0 ? "▲" : item.change < 0 ? "▼" : ""}${Math.abs(item.change).toFixed(2)}</span>`;
      }
      return `<span class="item"><span class="name">${item.label}</span> <span class="delivery">${item.delivery}</span> <span class="bid">${bid}</span>${chg ? ` ${chg}` : ""}<span class="sep"> · </span></span>`;
    }).join("");

    const content = items.length ? itemHtml : `<span class="item">No data</span>`;

    this.shadowRoot.innerHTML = `
      <style>
        ha-card { overflow: hidden; }
        .wrap {
          overflow: hidden;
          height: 36px;
          display: flex;
          align-items: center;
          background: var(--secondary-background-color);
          border-top: 1px solid var(--divider-color);
          border-bottom: 1px solid var(--divider-color);
        }
        .track { display: flex; align-items: center; white-space: nowrap; will-change: transform; }
        .item { display: inline-flex; align-items: center; gap: 4px; padding: 0 4px; font-size: 0.85em; color: var(--primary-text-color); }
        .name { font-weight: 500; }
        .delivery { color: var(--secondary-text-color); font-size: 0.8em; }
        .bid { font-weight: 600; }
        .sep { color: var(--secondary-text-color); }
        .pos { color: var(--success-color, #4CAF50); }
        .neg { color: var(--error-color, #F44336); }
      </style>
      <ha-card>
        <div class="wrap" id="wrap">
          <div class="track">${content}${content}</div>
        </div>
      </ha-card>`;

    if (this._config.pause_on_hover) {
      const wrap = this.shadowRoot.querySelector("#wrap");
      wrap.addEventListener("mouseenter", () => { this._paused = true; });
      wrap.addEventListener("mouseleave", () => { this._paused = false; });
    }
    if (items.length) this._startAnimation();
  }

  disconnectedCallback() { this._stopAnimation(); }
  getCardSize() { return 1; }
  static getStubConfig() { return { speed: 35 }; }
}

customElements.define("andersons-grain-ticker-card", AndersonsGrainTickerCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "andersons-grain-ticker-card", name: "Anderson's Grain Ticker Card", description: "Scrolling ticker strip with current bids and changes." });
