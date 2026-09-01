/**
 * Anderson's Grain Summary Card — minimal HA style
 *
 * type: custom:andersons-grain-summary-card
 * title: "Grain Prices"
 * commodities: [corn, soybean, red_wheat]
 */
class AndersonsGrainSummaryCard extends HTMLElement {
  set hass(hass) { this._hass = hass; this._render(); }

  setConfig(config) {
    this._config = {
      title: config.title || "Grain Prices — Dunkirk, IN",
      commodities: config.commodities || ["corn", "soybean", "red_wheat"],
    };
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
  }

  _findSummaryEntity(commodity) {
    const labels = { corn: "Corn", soybean: "Soybean", red_wheat: "Red Wheat" };
    const label = labels[commodity] || commodity;
    for (const [, state] of Object.entries(this._hass?.states || {})) {
      const a = state.attributes || {};
      if (a.all_months && a.commodity === label) return state;
    }
    return null;
  }

  _render() {
    if (!this._config || !this._hass) return;

    const rows = this._config.commodities.map(commodity => {
      const labels = { corn: "Corn", soybean: "Soybean", red_wheat: "Red Wheat" };
      const entity = this._findSummaryEntity(commodity);
      const label = labels[commodity] || commodity;

      if (!entity) return `
        <div class="row">
          <span class="name">${label}</span>
          <span class="empty">No data</span>
        </div>`;

      const attrs = entity.attributes || {};
      const bid = parseFloat(entity.state);
      const bidStr = isNaN(bid) ? "—" : bid.toFixed(2);
      const change = attrs.change != null ? parseFloat(attrs.change) : null;
      const chgStr = change != null
        ? `<span class="${change > 0 ? "pos" : change < 0 ? "neg" : ""}">${change > 0 ? "▲" : change < 0 ? "▼" : ""}${Math.abs(change).toFixed(2)}</span>`
        : "—";
      const basis = attrs.basis != null ? parseFloat(attrs.basis).toFixed(2) : "—";
      const delivery = attrs.delivery || "";

      return `
        <div class="row">
          <span class="name">${label}</span>
          <span class="delivery">${delivery}</span>
          <span class="bid">${bidStr}</span>
          <span class="change">${chgStr}</span>
          <span class="basis secondary">Basis ${basis}</span>
        </div>`;
    }).join("");

    this.shadowRoot.innerHTML = `
      <style>
        ha-card { padding: 16px; }
        .card-header { font-size: 1em; font-weight: 500; margin-bottom: 12px; }
        .row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid var(--divider-color);
          font-size: 0.9em;
        }
        .row:last-child { border-bottom: none; }
        .name { font-weight: 500; width: 80px; color: var(--primary-text-color); }
        .delivery { color: var(--secondary-text-color); font-size: 0.85em; width: 55px; }
        .bid { font-weight: 600; width: 60px; color: var(--primary-text-color); }
        .change { width: 70px; }
        .secondary { margin-left: auto; color: var(--secondary-text-color); font-size: 0.85em; }
        .empty { color: var(--secondary-text-color); font-style: italic; }
        .pos { color: var(--success-color, #4CAF50); }
        .neg { color: var(--error-color, #F44336); }
      </style>
      <ha-card>
        <div class="card-header">${this._config.title}</div>
        ${rows}
      </ha-card>`;
  }

  getCardSize() { return 3; }
  static getStubConfig() { return { title: "Grain Prices — Dunkirk, IN" }; }
}

customElements.define("andersons-grain-summary-card", AndersonsGrainSummaryCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "andersons-grain-summary-card", name: "Anderson's Grain Summary Card", description: "Current bid, change, and basis for each commodity." });
