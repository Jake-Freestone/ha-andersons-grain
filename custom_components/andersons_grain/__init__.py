"""Anderson's Grain Prices integration."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL, DOMAIN
from .coordinator import AndersonsGrainCoordinator

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor"]

CARDS = [
    "andersons-grain-table-card.js",
    "andersons-grain-summary-card.js",
    "andersons-grain-ticker-card.js",
    "andersons-grain-commodity-card.js",
]


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Register static www path and Lovelace resources once at startup."""
    www_path = Path(__file__).parent / "www"

    hass.http.register_static_path(
        f"/{DOMAIN}/cards",
        str(www_path),
        cache_headers=False,
    )

    # Auto-register each card as a Lovelace resource
    resource_list = hass.data.get("lovelace", {}).get("resources")
    if resource_list is not None:
        existing = {r["url"] for r in await resource_list.async_get_info() if "url" in r}
        for card in CARDS:
            url = f"/{DOMAIN}/cards/{card}"
            if url not in existing:
                await resource_list.async_create_item({"res_type": "module", "url": url})
                _LOGGER.debug("Registered Lovelace resource: %s", url)

    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Anderson's Grain from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    scan_interval = entry.options.get(
        CONF_SCAN_INTERVAL,
        entry.data.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL),
    )

    coordinator = AndersonsGrainCoordinator(hass, scan_interval)
    await coordinator.async_config_entry_first_refresh()

    hass.data[DOMAIN][entry.entry_id] = coordinator

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    entry.async_on_unload(entry.add_update_listener(_async_update_listener))

    return True


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Handle options update — reload the entry."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok
