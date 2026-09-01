"""Data update coordinator for Anderson's Grain Prices."""
from __future__ import annotations

import logging
import re
from datetime import timedelta

import aiohttp
from bs4 import BeautifulSoup

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import DOMAIN, URL

_LOGGER = logging.getLogger(__name__)

# Known commodity name patterns to match page headers
COMMODITY_PATTERNS = {
    "corn": re.compile(r"\bcorn\b", re.IGNORECASE),
    "soybean": re.compile(r"\bsoy\s*bean\b", re.IGNORECASE),
    "red_wheat": re.compile(r"\bred\s*wheat\b", re.IGNORECASE),
}

# Delivery month pattern: e.g. "SEP 26", "DEC 26", "JAN 27"
DELIVERY_PATTERN = re.compile(r"[A-Z]{3}\s+\d{2}", re.IGNORECASE)

# Column header aliases
COL_ALIASES = {
    "delivery": ["delivery", "month", "contract"],
    "bid": ["bid", "cash", "price"],
    "basis": ["basis", "base", "basic"],
    "futures": ["futures", "future"],
    "change": ["chg", "change", "chng"],
    "symbol": ["symbol", "sym", "contract"],
    "last_trade": ["last trade", "last", "updated", "time"],
}


def _safe_float(text: str) -> float | None:
    """Parse a float from a string, stripping non-numeric chars except . and -."""
    try:
        cleaned = re.sub(r"[^\d.\-]", "", text.strip())
        return float(cleaned) if cleaned else None
    except (ValueError, TypeError):
        return None


def _map_headers(header_cells: list) -> dict[str, int]:
    """Map canonical column names to column indices from header row."""
    mapping: dict[str, int] = {}
    for idx, cell in enumerate(header_cells):
        text = cell.get_text(strip=True).lower()
        for canonical, aliases in COL_ALIASES.items():
            if any(alias in text for alias in aliases):
                if canonical not in mapping:
                    mapping[canonical] = idx
    return mapping


def _identify_commodity(text: str) -> str | None:
    """Return commodity key if text matches a known commodity name."""
    for key, pattern in COMMODITY_PATTERNS.items():
        if pattern.search(text):
            return key
    return None


def _parse_row(cells: list, col_map: dict[str, int]) -> dict | None:
    """Parse a single price row into a dict. Returns None if row looks invalid."""
    def get(col: str) -> str:
        idx = col_map.get(col)
        if idx is None or idx >= len(cells):
            return ""
        return cells[idx].get_text(strip=True)

    delivery = get("delivery")
    if not DELIVERY_PATTERN.search(delivery):
        return None

    return {
        "delivery": delivery.upper(),
        "bid": _safe_float(get("bid")),
        "basis": _safe_float(get("basis")),
        "futures": get("futures"),
        "change": _safe_float(get("change")),
        "symbol": get("symbol"),
        "last_trade": get("last_trade"),
    }


class AndersonsGrainCoordinator(DataUpdateCoordinator):
    """Coordinator that fetches and parses grain prices from Anderson's website."""

    def __init__(self, hass: HomeAssistant, scan_interval_minutes: int) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(minutes=scan_interval_minutes),
        )

    async def _async_update_data(self) -> dict[str, list[dict]]:
        """Fetch and parse grain price data."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    URL,
                    timeout=aiohttp.ClientTimeout(total=15),
                    headers={"User-Agent": "HomeAssistant/AndersonsGrainIntegration"},
                ) as response:
                    response.raise_for_status()
                    html = await response.text()
        except aiohttp.ClientError as err:
            raise UpdateFailed(f"Error fetching Anderson's Grain data: {err}") from err

        try:
            return self._parse_html(html)
        except Exception as err:
            raise UpdateFailed(f"Error parsing Anderson's Grain data: {err}") from err

    def _parse_html(self, html: str) -> dict[str, list[dict]]:
        """Parse the HTML and return structured price data."""
        soup = BeautifulSoup(html, "lxml")
        result: dict[str, list[dict]] = {}

        # Strategy: walk through the page looking for commodity headers
        # followed by tables. We search all block-level elements in order.
        current_commodity: str | None = None
        all_elements = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "div", "section", "table"])

        for element in all_elements:
            tag = element.name

            # Check if this element (or its text) names a commodity
            if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
                detected = _identify_commodity(element.get_text())
                if detected:
                    current_commodity = detected

            # Also check divs/sections that might be commodity labels
            elif tag in ("div", "section"):
                text = element.get_text(separator=" ")
                detected = _identify_commodity(text)
                if detected and len(text.strip()) < 60:
                    current_commodity = detected

            elif tag == "table":
                rows = element.find_all("tr")
                if not rows:
                    continue

                # Try to identify commodity from within the table if not found yet
                table_text = element.get_text()
                if current_commodity is None:
                    current_commodity = _identify_commodity(table_text)

                # Find header row
                header_row = None
                col_map: dict[str, int] = {}
                for row in rows:
                    headers = row.find_all("th")
                    if headers:
                        col_map = _map_headers(headers)
                        if "bid" in col_map or "delivery" in col_map:
                            header_row = row
                            break
                    # Some tables use td for headers in first row
                    tds = row.find_all("td")
                    if tds:
                        trial_map = _map_headers(tds)
                        if "bid" in trial_map and "delivery" in trial_map:
                            col_map = trial_map
                            header_row = row
                            break

                if not col_map or "delivery" not in col_map:
                    # Not a price table — try fallback: look for delivery-month rows
                    parsed = self._parse_by_delivery_pattern(rows)
                    if parsed and current_commodity:
                        result.setdefault(current_commodity, []).extend(parsed)
                    continue

                # Parse data rows
                past_header = header_row is None
                parsed_rows = []
                for row in rows:
                    if not past_header:
                        if row == header_row:
                            past_header = True
                        continue
                    cells = row.find_all(["td", "th"])
                    if not cells:
                        continue
                    entry = _parse_row(cells, col_map)
                    if entry:
                        parsed_rows.append(entry)

                if parsed_rows and current_commodity:
                    result.setdefault(current_commodity, []).extend(parsed_rows)

        _LOGGER.debug("Parsed grain data: %s", {k: len(v) for k, v in result.items()})
        return result

    def _parse_by_delivery_pattern(self, rows: list) -> list[dict]:
        """Fallback: find rows that contain a delivery month pattern and extract prices."""
        parsed = []
        for row in rows:
            cells = row.find_all(["td", "th"])
            if not cells:
                continue
            texts = [c.get_text(strip=True) for c in cells]
            if not texts:
                continue
            if DELIVERY_PATTERN.search(texts[0]):
                entry = {
                    "delivery": texts[0].upper(),
                    "bid": _safe_float(texts[1]) if len(texts) > 1 else None,
                    "basis": _safe_float(texts[2]) if len(texts) > 2 else None,
                    "futures": texts[3] if len(texts) > 3 else "",
                    "change": _safe_float(texts[4]) if len(texts) > 4 else None,
                    "symbol": texts[5] if len(texts) > 5 else "",
                    "last_trade": texts[6] if len(texts) > 6 else "",
                }
                parsed.append(entry)
        return parsed
