/**
 * Anderson's Grain Commodity Card — minimal HA style
 *
 * type: custom:andersons-grain-commodity-card
 * commodity: corn
 * show_futures: false
 * show_basis: true
 * show_last_trade: false
 */
class AndersonsGrainCommodityCard extends HTMLElement {
  set hass(hass) { this._hass = hass; this._render(); }

  setConfig(config) {
    if (!config.commodity) throw new Error("commodity is required");
    this._config = {
      commodity: config.commodity,
      show_futures: config.show_futures || false,
      show_basis: config.show_basis !== false,
      show_last_trade: config.show_last_trade || false,
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
    const { commodity, show_futures, show_basis, show_last_trade } = this._config;
    const labels = { corn: "Corn", soybean: "Soybean", red_wheat: "Red Wheat" };
    const label = labels[commodity] || commodity;
    const entity = this._findSummaryEntity(commodity);

    if (!entity) {
      this.shadowRoot.innerHTML = `
        <style>ha-card{padding:16px}</style>
        <ha-card><div style="color:var(--secondary-text-color)">No data for ${label}</div></ha-card>`;
      return;
    }

    const attrs = entity.attributes || {};
    const months = attrs.all_months || [];
    const nearest = months[0] || {};
    const bid = parseFloat(entity.state);
    const change = attrs.change != null ? parseFloat(attrs.change) : null;
    const basis = attrs.basis != null ? parseFloat(attrs.basis) : null;

    const chgStr = change != null
      ? `<span class="${change > 0 ? "pos" : change < 0 ? "neg" : ""}">${change > 0 ? "▲" : change < 0 ? "▼" : ""}${Math.abs(change).toFixed(2)}</span>`
      : "—";

    const cols = ["delivery", "bid", "change"];
    if (show_basis) cols.push("basis");
    if (show_futures) cols.push("futures");
    if (show_last_trade) cols.push("last_trade");

    const colLabels = { delivery: "Delivery", bid: "Bid", change: "Chg", basis: "Basis", futures: "Futures", last_trade: "Last Trade" };

    const headerRow = cols.map(c => `<th>${colLabels[c]}</th>`).join("");

    const dataRows = months.map((row, i) => {
      const cells = cols.map(c => {
        if (c === "change") {
          const n = row.change != null ? parseFloat(row.change) : null;
          if (n == null) return `<td>—</td>`;
          return `<td><span class="${n > 0 ? "pos" : n < 0 ? "neg" : ""}">${n > 0 ? "▲" : n < 0 ? "▼" : ""}${Math.abs(n).toFixed(2)}</span></td>`;
        }
        if (c === "bid" || c === "basis") {
          const n = row[c] != null ? parseFloat(row[c]).toFixed(2) : "—";
          return `<td>${n}</td>`;
        }
        return `<td>${row[c] || "—"}</td>`;
      }).join("");
      return `<tr class="${i === 0 ? "nearest" : ""}">${cells}</tr>`;
    }).join("");

    this.shadowRoot.innerHTML = `
      <style>
        ha-card { padding: 16px; }
        .header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
        .title { font-size: 1em; font-weight: 500; }
        .subtitle { font-size: 0.85em; color: var(--secondary-text-color); }
        .stats { display: flex; gap: 24px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--divider-color); }
        .stat-label { font-size: 0.75em; color: var(--secondary-text-color); margin-bottom: 2px; }
        .stat-value { font-size: 1.1em; font-weight: 600; color: var(--primary-text-color); }
        table { width: 100%; border-collapse: collapse; font-size: 0.88em; }
        th { text-align: left; padding: 4px 8px 8px 0; font-weight: 500; font-size: 0.82em; color: var(--secondary-text-color); border-bottom: 1px solid var(--divider-color); }
        td { padding: 6px 8px 6px 0; border-bottom: 1px solid var(--divider-color); color: var(--primary-text-color); }
        tr:last-child td { border-bottom: none; }
        tr.nearest td { font-weight: 600; }
        .pos { color: var(--success-color, #4CAF50); }
        .neg { color: var(--error-color, #F44336); }
      </style>
      <ha-card>
        <div class="header">
          <span class="title">${label}</span>
        </div>
        <div class="stats">
          <div>
            <div class="stat-label">Bid (${nearest.delivery || "—"})</div>
            <div class="stat-value">${isNaN(bid) ? "—" : bid.toFixed(2)}</div>
          </div>
          <div>
            <div class="stat-label">Change</div>
            <div class="stat-value">${chgStr}</div>
          </div>
          ${show_basis ? `<div>
            <div class="stat-label">Basis</div>
            <div class="stat-value">${basis != null ? basis.toFixed(2) : "—"}</div>
          </div>` : ""}
        </div>
        <table>
          <thead><tr>${headerRow}</tr></thead>
          <tbody>${dataRows}</tbody>
        </table>
      </ha-card>`;
  }

  getCardSize() { return 5; }
  static getStubConfig() { return { commodity: "corn" }; }
}

customElements.define("andersons-grain-commodity-card", AndersonsGrainCommodityCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "andersons-grain-commodity-card", name: "Anderson's Grain Commodity Card", description: "Single commodity detail with all delivery months." });
