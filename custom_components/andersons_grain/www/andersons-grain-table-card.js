/**
 * Anderson's Grain Table Card
 * Full price table mimicking the website layout.
 *
 * Config:
 *   type: custom:andersons-grain-table-card
 *   title: "Grain Prices"          (optional)
 *   commodities: [corn, soybean, red_wheat]  (optional, shows all if omitted)
 *   columns: [delivery, bid, basis, change, futures, last_trade]  (optional)
 */
class AndersonsGrainTableCard extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  setConfig(config) {
    this._config = {
      title: config.title || "Grain Prices — Dunkirk, IN",
      commodities: config.commodities || ["corn", "soybean", "red_wheat"],
      columns: config.columns || ["delivery", "bid", "basis", "change", "futures", "last_trade"],
    };
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
  }

  _getEntityData(commodity) {
    const summaryId = `sensor.andersons_grain_${commodity}_summary`;
    const entity = this._hass?.states[summaryId];
    if (!entity) return null;
    const attrs = entity.attributes || {};
    return attrs.all_months || null;
  }

  _formatChange(val) {
    if (val === null || val === undefined) return "—";
    const n = parseFloat(val);
    if (isNaN(n)) return val;
    const sign = n > 0 ? "▲" : n < 0 ? "▼" : "■";
    const cls = n > 0 ? "positive" : n < 0 ? "negative" : "neutral";
    return `<span class="change ${cls}">${sign} ${Math.abs(n).toFixed(4)}</span>`;
  }

  _formatPrice(val) {
    if (val === null || val === undefined) return "—";
    const n = parseFloat(val);
    return isNaN(n) ? val : n.toFixed(4);
  }

  _colLabel(col) {
    const labels = {
      delivery: "Delivery",
      bid: "Bid",
      basis: "Basis",
      change: "Chg",
      futures: "Futures",
      last_trade: "Last Trade",
    };
    return labels[col] || col;
  }

  _colValue(row, col) {
    switch (col) {
      case "delivery": return row.delivery || "—";
      case "bid": return this._formatPrice(row.bid);
      case "basis": return this._formatPrice(row.basis);
      case "change": return this._formatChange(row.change);
      case "futures": return row.futures || "—";
      case "last_trade": return row.last_trade || "—";
      default: return "—";
    }
  }

  _commodityLabel(key) {
    return { corn: "Corn", soybean: "Soybean", red_wheat: "Red Wheat" }[key] || key;
  }

  _render() {
    if (!this._config || !this._hass) return;
    const cols = this._config.columns;

    let tablesHtml = "";
    for (const commodity of this._config.commodities) {
      const months = this._getEntityData(commodity);
      const label = this._commodityLabel(commodity);

      if (!months || months.length === 0) {
        tablesHtml += `
          <div class="commodity-section">
            <h3 class="commodity-title">${label}</h3>
            <p class="no-data">No data available</p>
          </div>`;
        continue;
      }

      const headerRow = cols.map(c => `<th>${this._colLabel(c)}</th>`).join("");
      const dataRows = months.map(row => {
        const cells = cols.map(c => {
          const val = this._colValue(row, c);
          const cls = c === "change"
            ? ""
            : c === "bid" ? "price-cell" : "";
          return `<td class="${cls}">${val}</td>`;
        }).join("");
        return `<tr>${cells}</tr>`;
      }).join("");

      tablesHtml += `
        <div class="commodity-section">
          <h3 class="commodity-title">${label}</h3>
          <div class="table-wrapper">
            <table>
              <thead><tr>${headerRow}</tr></thead>
              <tbody>${dataRows}</tbody>
            </table>
          </div>
        </div>`;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 16px; }
        .card-title {
          font-size: 1.1em;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--primary-text-color);
          border-bottom: 2px solid var(--primary-color);
          padding-bottom: 6px;
        }
        .commodity-section { margin-bottom: 20px; }
        .commodity-title {
          font-size: 1em;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--primary-color);
          margin: 0 0 8px 0;
        }
        .table-wrapper { overflow-x: auto; }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.88em;
        }
        thead tr {
          background: var(--primary-color);
          color: var(--text-primary-color, #fff);
        }
        th {
          padding: 8px 12px;
          text-align: left;
          font-weight: 600;
          white-space: nowrap;
        }
        tbody tr {
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
          transition: background 0.15s;
        }
        tbody tr:hover { background: var(--secondary-background-color); }
        tbody tr:nth-child(even) { background: var(--table-row-background-color, rgba(0,0,0,0.03)); }
        tbody tr:nth-child(even):hover { background: var(--secondary-background-color); }
        td {
          padding: 7px 12px;
          white-space: nowrap;
          color: var(--primary-text-color);
        }
        .price-cell { font-weight: 600; font-family: monospace; }
        .change.positive { color: #2e7d32; font-weight: 600; }
        .change.negative { color: #c62828; font-weight: 600; }
        .change.neutral { color: var(--secondary-text-color); }
        .no-data { color: var(--secondary-text-color); font-style: italic; }
      </style>
      <ha-card>
        <div class="card-title">${this._config.title}</div>
        ${tablesHtml}
      </ha-card>`;
  }

  getCardSize() { return this._config?.commodities?.length * 5 || 10; }

  static getConfigElement() {
    return document.createElement("andersons-grain-table-card-editor");
  }

  static getStubConfig() {
    return { commodities: ["corn", "soybean", "red_wheat"] };
  }
}

customElements.define("andersons-grain-table-card", AndersonsGrainTableCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "andersons-grain-table-card",
  name: "Anderson's Grain Table Card",
  description: "Full grain price table (all delivery months) inspired by Anderson's Grain website layout.",
  preview: false,
});
