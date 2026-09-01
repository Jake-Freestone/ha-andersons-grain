# Anderson's Grain Prices — Home Assistant Integration

A HACS-compatible Home Assistant integration that tracks live grain prices from [Anderson's Grain — Dunkirk, IN](https://www.andersonsgrain.com/locations/in/dunkirk/).

## Features

- Tracks **Corn**, **Soybean**, and **Red Wheat** prices across all delivery months
- Monitors **Bid**, **Basis**, **Change**, **Futures**, and **Last Trade** values
- Polls every 10 minutes (configurable, minimum 5 minutes)
- 4 custom Lovelace cards for your dashboard

## Installation

### Via HACS (Private Repo)

1. In HACS, go to **Integrations → Custom Repositories**
2. Add this repo URL with your GitHub Personal Access Token
3. Install "Anderson's Grain Prices"
4. Restart Home Assistant

### Manual

1. Copy `custom_components/andersons_grain/` into your HA `config/custom_components/` folder
2. Restart Home Assistant
3. Go to **Settings → Integrations → Add Integration** and search for "Anderson's Grain"

## Custom Lovelace Cards

Copy the `www/andersons-grain-cards/` folder into your HA `config/www/` directory, then add each JS file as a Lovelace resource under **Settings → Dashboards → Resources**.

### Card Types

| Card | Description |
|------|-------------|
| `andersons-grain-table-card` | Full price table (mimics the website layout) |
| `andersons-grain-summary-card` | Market overview grid — current price + change for all commodities |
| `andersons-grain-ticker-card` | Scrolling stock-ticker style strip |
| `andersons-grain-commodity-card` | Single-commodity detail with all delivery months |

### Example Dashboard YAML

```yaml
# Full price table
type: custom:andersons-grain-table-card
commodities:
  - corn
  - soybean
  - red_wheat

# Market overview
type: custom:andersons-grain-summary-card
title: Grain Prices - Dunkirk
show_last_updated: true

# Ticker strip
type: custom:andersons-grain-ticker-card
speed: 30

# Single commodity detail
type: custom:andersons-grain-commodity-card
commodity: corn
show_futures: true
show_basis: true
```

## Sensors Created

Each sensor is named `sensor.andersons_grain_{commodity}_{delivery}_{type}`, for example:
- `sensor.andersons_grain_corn_sep26_bid`
- `sensor.andersons_grain_corn_sep26_basis`
- `sensor.andersons_grain_corn_sep26_change`

## Data Source

Prices are scraped from [andersonsgrain.com](https://www.andersonsgrain.com/locations/in/dunkirk/). Cash prices update every 10 minutes; basis values update daily at 5:10pm EST.
