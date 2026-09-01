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

COMMODITY_PATTERNS = {
    "corn": re.compile(r"\bcorn\b", re.IGNORECASE),
    "soybean": re.compile(r"\bsoy\s*bean\b", re.IGNORECASE),
    "red_wheat": re.compile(r"\bwheat\b", re.IGNORECASE),
}

# Search for a valid 3-letter month within any cell text (handles artifacts like "SNOV 26" → "NOV 26")
DELIVERY_SEARCH = re.compile(
    r"\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{2})\b",
    re.IGNORECASE,
)

COL_ALIASES = {
    "delivery": ["delivery", "month", "contract"],
    "bid": ["bid", "cash", "price"],
    "basis": ["basis", "base", "basic"],
    "futures": ["futures", "future"],
    "change": ["chg", "change", "chng"],
    "symbol": ["symbol", "sym"],
    "last_trade": ["last trade", "last", "updated", "time"],
}


def _safe_float(text: str) -> float | None:
    try:
        cleaned = re.sub(r"[^\d.\-]", "", text.strip())
        return float(cleaned) if cleaned else None
    except (ValueError, TypeError):
        return None


def _identify_commodity(text: str) -> str | None:
    for key, pattern in COMMODITY_PATTERNS.items():
        if pattern.search(text):
            return key
    return None


def _map_headers(cells: list) -> dict[str, int]:
    mapping: dict[str, int] = {}
    for idx, cell in enumerate(cells):
        text = cell.get_text(strip=True).lower()
        for canonical, aliases in COL_ALIASES.items():
            if any(alias in text for alias in aliases):
                if canonical not in mapping:
                    mapping[canonical] = idx
    return mapping


def _parse_table(table) -> list[dict]:
    """Parse a price table, returning a list of row dicts."""
    rows = table.find_all("tr")
    if not rows:
        return []

    # Find header row — prefer <th> cells, fall back to first <td> row that looks like headers
    col_map: dict[str, int] = {}
    header_idx = -1

    for i, row in enumerate(rows):
        ths = row.find_all("th")
        if ths:
            col_map = _map_headers(ths)
            header_idx = i
            break
        tds = row.find_all("td")
        if tds:
            trial = _map_headers(tds)
            if "bid" in trial and "delivery" in trial:
                col_map = trial
                header_idx = i
                break

    # Parse data rows
    parsed = []
    for i, row in enumerate(rows):
        if i <= header_idx:
            continue
        cells = row.find_all(["td", "th"])
        if not cells:
            continue

        def get_text(cell):
            return cell.get_text(separator=" ", strip=True)

        def extract_delivery(cell):
            """Extract a clean MON YY string, ignoring any surrounding artifact chars."""
            m = DELIVERY_SEARCH.search(get_text(cell))
            return f"{m.group(1).upper()} {m.group(2)}" if m else None

        def get(col):
            idx = col_map.get(col)
            if idx is None or idx >= len(cells):
                return ""
            return get_text(cells[idx])

        if col_map and "delivery" in col_map:
            delivery = extract_delivery(cells[col_map["delivery"]])
        else:
            delivery = extract_delivery(cells[0])

        if not delivery:
            continue

        if col_map and "delivery" in col_map:
            entry = {
                "delivery": delivery,
                "bid": _safe_float(get("bid")),
                "basis": _safe_float(get("basis")),
                "futures": get("futures"),
                "change": _safe_float(get("change")),
                "symbol": get("symbol"),
                "last_trade": get("last_trade"),
            }
        else:
            texts = [get_text(c) for c in cells]
            entry = {
                "delivery": delivery,
                "bid": _safe_float(texts[1]) if len(texts) > 1 else None,
                "basis": _safe_float(texts[2]) if len(texts) > 2 else None,
                "futures": texts[3] if len(texts) > 3 else "",
                "change": _safe_float(texts[4]) if len(texts) > 4 else None,
                "symbol": texts[5] if len(texts) > 5 else "",
                "last_trade": texts[6] if len(texts) > 6 else "",
            }

        parsed.append(entry)

    return parsed


def _find_table_commodity(table) -> str | None:
    """Find the commodity for a table by scanning backwards through the document."""
    # 1. Check all preceding headings (nearest first)
    for heading in reversed(table.find_all_previous(["h1", "h2", "h3", "h4", "h5", "h6"])):
        commodity = _identify_commodity(heading.get_text())
        if commodity:
            return commodity

    # 2. Walk up the parent chain and check small text blobs
    parent = table.parent
    while parent and parent.name not in ("body", "html", "[document]"):
        text = parent.get_text(separator=" ")[:120]
        commodity = _identify_commodity(text)
        if commodity:
            return commodity
        parent = parent.parent

    return None


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
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    URL,
                    timeout=aiohttp.ClientTimeout(total=15),
                    headers={"User-Agent": "Mozilla/5.0 HomeAssistant/AndersonsGrain"},
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
        soup = BeautifulSoup(html, "lxml")
        result: dict[str, list[dict]] = {}
        seen: dict[str, set] = {}  # commodity -> set of seen delivery months to avoid duplicates

        for table in soup.find_all("table"):
            rows = _parse_table(table)
            if not rows:
                continue

            commodity = _find_table_commodity(table)
            if not commodity:
                _LOGGER.debug("Could not identify commodity for table, skipping")
                continue

            seen.setdefault(commodity, set())
            for row in rows:
                delivery = row.get("delivery", "")
                if delivery and delivery not in seen[commodity]:
                    seen[commodity].add(delivery)
                    result.setdefault(commodity, []).append(row)

        _LOGGER.debug(
            "Parsed: %s",
            {k: [r["delivery"] for r in v] for k, v in result.items()},
        )
        return result
