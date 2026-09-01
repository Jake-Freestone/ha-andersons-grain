/**
 * Anderson's Grain Table Card — minimal HA style
 *
 * type: custom:andersons-grain-table-card
 * title: "Grain Prices"           (optional)
 * commodities: [corn, soybean, red_wheat]
 * columns: [delivery, bid, basis, change]
 */
class AndersonsGrainTableCard extends HTMLElement {
  connectedCallback() {
    // Watch our own size and notify HA whenever it changes
    this._ro = new ResizeObserver(() => {
      this.dispatchEvent(new Event("card-height-changed", { bubbles: true, composed: true }));
    });
    this._ro.observe(this);
  }

  disconnectedCallback() {
    this._ro?.disconnect();
  }

  set hass(hass) { this._hass = hass; this._render(); }

  setConfig(config) {
    this._config = {
      commodities: config.commodities || ["corn", "soybean", "red_wheat"],
      columns: config.columns || ["delivery", "bid", "basis", "change"],
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

  _label(col) {
    return { delivery: "Delivery", bid: "Bid", basis: "Basis", change: "Chg", futures: "Futures", last_trade: "Last Trade" }[col] || col;
  }

  _cell(row, col) {
    switch (col) {
      case "delivery": return row.delivery || "—";
      case "bid":      return row.bid != null ? parseFloat(row.bid).toFixed(2) : "—";
      case "basis":    return row.basis != null ? parseFloat(row.basis).toFixed(2) : "—";
      case "change": {
        if (row.change == null) return "—";
        const n = parseFloat(row.change);
        const sign = n > 0 ? "▲" : n < 0 ? "▼" : "";
        const cls = n > 0 ? "pos" : n < 0 ? "neg" : "";
        return `<span class="${cls}">${sign} ${Math.abs(n).toFixed(2)}</span>`;
      }
      case "futures":    return row.futures || "—";
      case "last_trade": return row.last_trade || "—";
      default: return "—";
    }
  }

  _commodityLabel(k) {
    return { corn: "Corn", soybean: "Soybean", red_wheat: "Red Wheat" }[k] || k;
  }

  _render() {
    if (!this._config || !this._hass) return;
    const cols = this._config.columns;

    const body = this._config.commodities.map(commodity => {
      const entity = this._findSummaryEntity(commodity);
      const months = entity?.attributes?.all_months;
      if (!months?.length) return `
        <tr class="section-header"><td colspan="${cols.length}">${this._commodityLabel(commodity)}</td></tr>
        <tr><td colspan="${cols.length}" class="empty">No data</td></tr>`;

      const header = `<tr class="section-header"><td colspan="${cols.length}">${this._commodityLabel(commodity)}</td></tr>`;
      const rows = months.map(row =>
        `<tr>${cols.map(c => `<td>${this._cell(row, c)}</td>`).join("")}</tr>`
      ).join("");
      return header + rows;
    }).join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 0; height: auto !important; overflow: visible !important; }
        .card-header { padding: 16px 16px 0; font-size: 1em; font-weight: 500; }
        table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
        th, td { padding: 6px 12px; text-align: left; border-bottom: 1px solid var(--divider-color); color: var(--primary-text-color); }
        th { font-weight: 500; color: var(--secondary-text-color); font-size: 0.85em; }
        tr.section-header td {
          padding: 10px 12px 4px;
          font-weight: 600;
          font-size: 0.8em;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--secondary-text-color);
          border-bottom: none;
        }
        .empty { color: var(--secondary-text-color); font-style: italic; }
        .pos { color: var(--success-color, #4CAF50); }
        .neg { color: var(--error-color, #F44336); }
      </style>
      <ha-card>
        
        <table>
          <thead><tr>${cols.map(c => `<th>${this._label(c)}</th>`).join("")}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </ha-card>`;

    requestAnimationFrame(() => {
      const card = this.shadowRoot?.querySelector("ha-card");
      if (!card) return;
      this.style.height = "auto";
      this.style.minHeight = card.scrollHeight + "px";
      this.dispatchEvent(new Event("card-height-changed", { bubbles: true, composed: true }));
    });
  }

  getCardSize() {
    let rows = 1; // thead
    for (const commodity of (this._config?.commodities || [])) {
      const entity = this._findSummaryEntity(commodity);
      const months = entity?.attributes?.all_months?.length || 7;
      rows += 1 + months; // section label + data rows
    }
    return Math.ceil(rows / 2);
  }
  static getStubConfig() { return { commodities: ["corn", "soybean", "red_wheat"] }; }
}

customElements.define("andersons-grain-table-card", AndersonsGrainTableCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "andersons-grain-table-card", name: "Anderson's Grain Table Card", description: "Full grain price table for all delivery months." });
