/**
 * Anderson's Grain Ticker Card
 * Scrolling stock-ticker strip showing current bids and changes.
 *
 * Config:
 *   type: custom:andersons-grain-ticker-card
 *   speed: 40             (pixels per second, default 35)
 *   commodities: [corn, soybean, red_wheat]  (optional)
 *   pause_on_hover: true  (optional, default true)
 */
class AndersonsGrainTickerCard extends HTMLElement {
  constructor() {
    super();
    this._animFrame = null;
    this._offset = 0;
    this._paused = false;
    this._lastTs = null;
    this._contentWidth = 0;
    this._containerWidth = 0;
  }

  set hass(hass) {
    const changed = JSON.stringify(this._buildItems(hass)) !== JSON.stringify(this._buildItems(this._hass));
    this._hass = hass;
    if (changed || !this._initialized) {
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

  _commodityLabel(key) {
    return { corn: "CORN", soybean: "SOY", red_wheat: "RED WHT" }[key] || key.toUpperCase();
  }

  _buildItems(hass) {
    if (!hass) return [];
    const items = [];
    for (const commodity of (this._config?.commodities || [])) {
      const entity = hass.states[`sensor.andersons_grain_${commodity}_summary`];
      if (!entity) continue;
      const attrs = entity.attributes || {};
      const bid = parseFloat(entity.state);
      const change = attrs.change !== null && attrs.change !== undefined ? parseFloat(attrs.change) : null;
      items.push({ commodity, label: this._commodityLabel(commodity), bid, change, delivery: attrs.delivery || "" });
    }
    return items;
  }

  _itemHtml(item) {
    const bidStr = isNaN(item.bid) ? "—" : item.bid.toFixed(4);
    let changeStr = "";
    let changeCls = "neutral";
    if (item.change !== null && !isNaN(item.change)) {
      if (item.change > 0) { changeStr = `▲${item.change.toFixed(4)}`; changeCls = "positive"; }
      else if (item.change < 0) { changeStr = `▼${Math.abs(item.change).toFixed(4)}`; changeCls = "negative"; }
      else { changeStr = "unch"; changeCls = "neutral"; }
    }
    return `
      <span class="tick-item">
        <span class="tick-label">${item.label}</span>
        <span class="tick-delivery">${item.delivery}</span>
        <span class="tick-price">${bidStr}</span>
        ${changeStr ? `<span class="tick-change ${changeCls}">${changeStr}</span>` : ""}
        <span class="tick-sep">◆</span>
      </span>`;
  }

  _stopAnimation() {
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
  }

  _startAnimation() {
    this._stopAnimation();
    this._lastTs = null;

    const track = this.shadowRoot?.querySelector(".ticker-track");
    if (!track) return;

    const step = (ts) => {
      if (!this._lastTs) this._lastTs = ts;
      const dt = (ts - this._lastTs) / 1000;
      this._lastTs = ts;

      if (!this._paused) {
        const trackWidth = track.scrollWidth / 2; // duplicated content
        this._offset += this._config.speed * dt;
        if (this._offset >= trackWidth) this._offset -= trackWidth;
        track.style.transform = `translateX(-${this._offset}px)`;
      }

      this._animFrame = requestAnimationFrame(step);
    };
    this._animFrame = requestAnimationFrame(step);
  }

  _render() {
    if (!this._config || !this._hass) return;
    const items = this._buildItems(this._hass);
    const content = items.length
      ? items.map(i => this._itemHtml(i)).join("")
      : `<span class="tick-item"><span class="tick-label">No data</span></span>`;

    this._stopAnimation();

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { overflow: hidden; padding: 0; }
        .ticker-wrap {
          overflow: hidden;
          background: var(--primary-color);
          height: 38px;
          display: flex;
          align-items: center;
          cursor: default;
          position: relative;
        }
        .ticker-track {
          display: flex;
          align-items: center;
          white-space: nowrap;
          will-change: transform;
        }
        .tick-item {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0 8px;
          font-size: 0.82em;
          color: var(--text-primary-color, #fff);
        }
        .tick-label {
          font-weight: 700;
          letter-spacing: 0.04em;
        }
        .tick-delivery {
          font-size: 0.85em;
          opacity: 0.8;
        }
        .tick-price {
          font-family: monospace;
          font-weight: 600;
          font-size: 1em;
        }
        .tick-change {
          font-weight: 700;
          font-size: 0.9em;
        }
        .tick-change.positive { color: #a5d6a7; }
        .tick-change.negative { color: #ef9a9a; }
        .tick-change.neutral { opacity: 0.75; }
        .tick-sep { opacity: 0.4; font-size: 0.6em; padding: 0 4px; }
      </style>
      <ha-card>
        <div class="ticker-wrap" id="wrap">
          <div class="ticker-track">${content}${content}</div>
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

  static getStubConfig() {
    return { speed: 35, pause_on_hover: true };
  }
}

customElements.define("andersons-grain-ticker-card", AndersonsGrainTickerCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "andersons-grain-ticker-card",
  name: "Anderson's Grain Ticker Card",
  description: "Scrolling stock-ticker strip showing current grain bids and price changes.",
  preview: false,
});
