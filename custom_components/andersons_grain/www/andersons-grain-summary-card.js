/**
 * Anderson's Grain Summary Card
 * Market overview grid — nearest delivery month for each commodity.
 *
 * Config:
 *   type: custom:andersons-grain-summary-card
 *   title: "Grain Prices"         (optional)
 *   show_last_updated: true       (optional)
 *   commodities: [corn, soybean, red_wheat]  (optional)
 */
class AndersonsGrainSummaryCard extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  setConfig(config) {
    this._config = {
      title: config.title || "Grain Prices — Dunkirk, IN",
      show_last_updated: config.show_last_updated !== false,
      commodities: config.commodities || ["corn", "soybean", "red_wheat"],
    };
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
  }

  _getEntity(commodity) {
    const labels = { corn: "Corn", soybean: "Soybean", red_wheat: "Red Wheat" };
    const label = labels[commodity] || commodity;
    for (const [, state] of Object.entries(this._hass?.states || {})) {
      const attrs = state.attributes || {};
      if (attrs.all_months && attrs.commodity === label) return state;
    }
    return null;
  }

  _commodityIcon(key) {
    return { corn: "🌽", soybean: "🫘", red_wheat: "🌾" }[key] || "📈";
  }

  _commodityLabel(key) {
    return { corn: "Corn", soybean: "Soybean", red_wheat: "Red Wheat" }[key] || key;
  }

  _changeHtml(val) {
    if (val === null || val === undefined) return `<span class="change neutral">— unch</span>`;
    const n = parseFloat(val);
    if (isNaN(n)) return `<span class="change neutral">—</span>`;
    if (n > 0) return `<span class="change positive">▲ ${n.toFixed(2)}</span>`;
    if (n < 0) return `<span class="change negative">▼ ${Math.abs(n).toFixed(2)}</span>`;
    return `<span class="change neutral">■ unch</span>`;
  }

  _render() {
    if (!this._config || !this._hass) return;

    let lastUpdated = "";
    const cards = this._config.commodities.map(commodity => {
      const entity = this._getEntity(commodity);
      const icon = this._commodityIcon(commodity);
      const label = this._commodityLabel(commodity);

      if (!entity) {
        return `
          <div class="commodity-card loading">
            <div class="icon">${icon}</div>
            <div class="name">${label}</div>
            <div class="price">—</div>
            <div class="meta">No data</div>
          </div>`;
      }

      const attrs = entity.attributes || {};
      const bid = parseFloat(entity.state);
      const priceStr = isNaN(bid) ? "—" : bid.toFixed(2);
      const delivery = attrs.delivery || "—";
      const basis = attrs.basis !== null && attrs.basis !== undefined
        ? `Basis: ${parseFloat(attrs.basis) >= 0 ? "+" : ""}${parseFloat(attrs.basis).toFixed(2)}`
        : "";
      const change = this._changeHtml(attrs.change);

      if (this._config.show_last_updated && attrs.last_trade) {
        lastUpdated = attrs.last_trade;
      }

      return `
        <div class="commodity-card">
          <div class="icon">${icon}</div>
          <div class="name">${label}</div>
          <div class="delivery">${delivery}</div>
          <div class="price">${priceStr}</div>
          <div class="unit">USD/bu</div>
          <div class="change-row">${change}</div>
          <div class="basis">${basis}</div>
        </div>`;
    }).join("");

    const footer = this._config.show_last_updated && lastUpdated
      ? `<div class="footer">Last trade: ${lastUpdated}</div>`
      : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 16px; }
        .card-header {
          font-size: 1.05em;
          font-weight: 700;
          color: var(--primary-text-color);
          margin-bottom: 14px;
          border-bottom: 2px solid var(--primary-color);
          padding-bottom: 6px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 12px;
        }
        .commodity-card {
          background: var(--card-background-color, var(--secondary-background-color));
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 10px;
          padding: 14px 10px 12px;
          text-align: center;
          transition: box-shadow 0.2s;
        }
        .commodity-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.12); }
        .commodity-card.loading { opacity: 0.5; }
        .icon { font-size: 2em; margin-bottom: 4px; }
        .name {
          font-size: 0.8em;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--secondary-text-color);
          margin-bottom: 4px;
        }
        .delivery {
          font-size: 0.75em;
          color: var(--secondary-text-color);
          margin-bottom: 6px;
        }
        .price {
          font-size: 1.55em;
          font-weight: 700;
          font-family: monospace;
          color: var(--primary-text-color);
          line-height: 1.1;
        }
        .unit {
          font-size: 0.68em;
          color: var(--secondary-text-color);
          margin-bottom: 6px;
        }
        .change-row { margin: 4px 0; font-size: 0.88em; font-weight: 600; }
        .change.positive { color: #2e7d32; }
        .change.negative { color: #c62828; }
        .change.neutral { color: var(--secondary-text-color); }
        .basis { font-size: 0.72em; color: var(--secondary-text-color); }
        .footer {
          margin-top: 12px;
          font-size: 0.72em;
          color: var(--secondary-text-color);
          text-align: right;
        }
      </style>
      <ha-card>
        <div class="card-header">${this._config.title}</div>
        <div class="grid">${cards}</div>
        ${footer}
      </ha-card>`;
  }

  getCardSize() { return 4; }

  static getStubConfig() {
    return { title: "Grain Prices — Dunkirk, IN", show_last_updated: true };
  }
}

customElements.define("andersons-grain-summary-card", AndersonsGrainSummaryCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "andersons-grain-summary-card",
  name: "Anderson's Grain Summary Card",
  description: "Market overview grid showing current bid, basis, and change for each commodity.",
  preview: false,
});
