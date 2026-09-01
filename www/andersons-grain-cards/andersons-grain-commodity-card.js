/**
 * Anderson's Grain Commodity Card
 * Deep-dive card for a single commodity — all delivery months with full details.
 *
 * Config:
 *   type: custom:andersons-grain-commodity-card
 *   commodity: corn          (required: corn | soybean | red_wheat)
 *   show_futures: true       (optional, default true)
 *   show_basis: true         (optional, default true)
 *   show_last_trade: true    (optional, default true)
 *   highlight_nearest: true  (optional, default true — bolds the nearest delivery row)
 */
class AndersonsGrainCommodityCard extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  setConfig(config) {
    if (!config.commodity) throw new Error("commodity is required");
    this._config = {
      commodity: config.commodity,
      show_futures: config.show_futures !== false,
      show_basis: config.show_basis !== false,
      show_last_trade: config.show_last_trade !== false,
      highlight_nearest: config.highlight_nearest !== false,
    };
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
  }

  _commodityLabel(key) {
    return { corn: "Corn", soybean: "Soybean", red_wheat: "Red Wheat" }[key] || key;
  }

  _commodityIcon(key) {
    return { corn: "🌽", soybean: "🫘", red_wheat: "🌾" }[key] || "📈";
  }

  _formatPrice(val) {
    if (val === null || val === undefined) return "—";
    const n = parseFloat(val);
    return isNaN(n) ? "—" : n.toFixed(4);
  }

  _changeHtml(val, compact = false) {
    if (val === null || val === undefined) return `<span class="neutral">—</span>`;
    const n = parseFloat(val);
    if (isNaN(n)) return `<span class="neutral">—</span>`;
    const abs = Math.abs(n).toFixed(4);
    if (n > 0) return `<span class="positive">▲ ${abs}</span>`;
    if (n < 0) return `<span class="negative">▼ ${abs}</span>`;
    return `<span class="neutral">■ unch</span>`;
  }

  _sparkbar(val, allVals) {
    const nums = allVals.map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (!nums.length) return "";
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const range = max - min;
    const n = parseFloat(val);
    if (isNaN(n) || range === 0) return `<div class="spark-bar" style="width:100%"></div>`;
    const pct = ((n - min) / range * 100).toFixed(1);
    return `<div class="spark-track"><div class="spark-bar" style="width:${pct}%"></div></div>`;
  }

  _render() {
    if (!this._config || !this._hass) return;
    const { commodity, show_futures, show_basis, show_last_trade, highlight_nearest } = this._config;
    const entity = this._hass.states[`sensor.andersons_grain_${commodity}_summary`];
    const label = this._commodityLabel(commodity);
    const icon = this._commodityIcon(commodity);

    if (!entity) {
      this.shadowRoot.innerHTML = `
        <style>:host{display:block}ha-card{padding:16px}</style>
        <ha-card><p style="color:var(--secondary-text-color)">No data for ${label}</p></ha-card>`;
      return;
    }

    const attrs = entity.attributes || {};
    const months = attrs.all_months || [];
    const allBids = months.map(m => m.bid);

    // Header stats from nearest month
    const nearest = months[0] || {};
    const currentBid = this._formatPrice(entity.state);
    const delivery = nearest.delivery || "—";
    const lastTrade = attrs.last_trade || nearest.last_trade || "";

    // Build columns
    const cols = ["delivery", "bid", "change"];
    if (show_basis) cols.push("basis");
    if (show_futures) cols.push("futures");
    if (show_last_trade) cols.push("last_trade");

    const colLabels = { delivery: "Delivery", bid: "Bid", change: "Chg", basis: "Basis", futures: "Futures", last_trade: "Last Trade" };

    const headerRow = cols.map(c => `<th>${colLabels[c]}</th>`).join("");
    const dataRows = months.map((row, idx) => {
      const isNearest = idx === 0 && highlight_nearest;
      const cells = cols.map(c => {
        if (c === "change") return `<td>${this._changeHtml(row.change)}</td>`;
        if (c === "bid") return `<td class="bid-cell">${this._formatPrice(row.bid)}${this._sparkbar(row.bid, allBids)}</td>`;
        if (c === "delivery") return `<td class="delivery-cell">${row.delivery || "—"}</td>`;
        if (c === "basis") return `<td class="basis-cell">${this._formatPrice(row.basis)}</td>`;
        if (c === "futures") return `<td>${row.futures || "—"}</td>`;
        if (c === "last_trade") return `<td class="time-cell">${row.last_trade || "—"}</td>`;
        return `<td>—</td>`;
      }).join("");
      return `<tr class="${isNearest ? "nearest-row" : ""}">${cells}</tr>`;
    }).join("");

    const basisDisp = nearest.basis !== null && nearest.basis !== undefined
      ? `${parseFloat(nearest.basis) >= 0 ? "+" : ""}${parseFloat(nearest.basis).toFixed(4)}`
      : "—";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 0; overflow: hidden; }
        .card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--primary-color);
          color: var(--text-primary-color, #fff);
          padding: 14px 16px 10px;
        }
        .header-icon { font-size: 2em; }
        .header-text { flex: 1; }
        .commodity-name { font-size: 1.15em; font-weight: 700; }
        .header-sub { font-size: 0.78em; opacity: 0.85; }
        .stats-bar {
          display: flex;
          gap: 0;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }
        .stat {
          flex: 1;
          padding: 10px 14px;
          text-align: center;
          border-right: 1px solid var(--divider-color, #e0e0e0);
        }
        .stat:last-child { border-right: none; }
        .stat-label {
          font-size: 0.68em;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--secondary-text-color);
        }
        .stat-value {
          font-size: 1.1em;
          font-weight: 700;
          font-family: monospace;
          color: var(--primary-text-color);
          margin-top: 2px;
        }
        .table-wrap { overflow-x: auto; padding: 0; }
        table { width: 100%; border-collapse: collapse; font-size: 0.86em; }
        thead tr { background: var(--secondary-background-color); }
        th {
          padding: 8px 12px;
          text-align: left;
          font-weight: 600;
          font-size: 0.85em;
          color: var(--secondary-text-color);
          border-bottom: 2px solid var(--divider-color, #e0e0e0);
          white-space: nowrap;
        }
        tbody tr {
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
          transition: background 0.1s;
        }
        tbody tr:hover { background: var(--secondary-background-color); }
        .nearest-row { font-weight: 700; background: color-mix(in srgb, var(--primary-color) 8%, transparent) !important; }
        .nearest-row td { color: var(--primary-color); }
        td { padding: 7px 12px; white-space: nowrap; color: var(--primary-text-color); }
        .bid-cell { font-family: monospace; font-weight: 600; }
        .delivery-cell { font-weight: 600; }
        .basis-cell { font-family: monospace; }
        .time-cell { font-size: 0.82em; color: var(--secondary-text-color); }
        .positive { color: #2e7d32; font-weight: 700; }
        .negative { color: #c62828; font-weight: 700; }
        .neutral { color: var(--secondary-text-color); }
        .spark-track {
          height: 3px;
          background: var(--divider-color, #e0e0e0);
          border-radius: 2px;
          margin-top: 3px;
        }
        .spark-bar {
          height: 3px;
          background: var(--primary-color);
          border-radius: 2px;
          min-width: 4px;
        }
        .footer {
          padding: 6px 14px;
          font-size: 0.7em;
          color: var(--secondary-text-color);
          text-align: right;
          border-top: 1px solid var(--divider-color, #e0e0e0);
        }
      </style>
      <ha-card>
        <div class="card-header">
          <div class="header-icon">${icon}</div>
          <div class="header-text">
            <div class="commodity-name">${label}</div>
            <div class="header-sub">Anderson's Grain — Dunkirk, IN</div>
          </div>
        </div>
        <div class="stats-bar">
          <div class="stat">
            <div class="stat-label">Bid (${delivery})</div>
            <div class="stat-value">${currentBid}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Basis</div>
            <div class="stat-value">${basisDisp}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Change</div>
            <div class="stat-value">${this._changeHtml(nearest.change)}</div>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr>${headerRow}</tr></thead>
            <tbody>${dataRows}</tbody>
          </table>
        </div>
        ${lastTrade ? `<div class="footer">Last trade: ${lastTrade}</div>` : ""}
      </ha-card>`;
  }

  getCardSize() { return 6; }

  static getStubConfig() {
    return { commodity: "corn", show_futures: true, show_basis: true };
  }
}

customElements.define("andersons-grain-commodity-card", AndersonsGrainCommodityCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "andersons-grain-commodity-card",
  name: "Anderson's Grain Commodity Card",
  description: "Single-commodity detail card with all delivery months, bid spark bars, and price stats.",
  preview: false,
});
