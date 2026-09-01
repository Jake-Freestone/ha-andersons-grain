"""Anderson's Grain Prices integration."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
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
    """Register static path for card JS files."""
    www_path = Path(__file__).parent / "www"

    await hass.http.async_register_static_paths(
        [StaticPathConfig(f"/{DOMAIN}/cards", str(www_path), False)]
    )

    async def _register_resources(_event=None):
        await _async_register_lovelace_resources(hass)

    if hass.is_running:
        await _register_resources()
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _register_resources)

    return True


async def _async_register_lovelace_resources(hass: HomeAssistant) -> None:
    """Add card JS files as Lovelace resources if not already present."""
    try:
        from homeassistant.components.lovelace.resources import ResourceStorageCollection

        lovelace = hass.data.get("lovelace")
        if not lovelace:
            _LOGGER.warning("Lovelace not available — skipping card resource registration")
            return

        resources = lovelace.get("resources")
        if not isinstance(resources, ResourceStorageCollection):
            _LOGGER.warning(
                "Lovelace is in YAML mode — add cards manually as resources"
            )
            return

        existing_urls = {item["url"] for item in resources.async_items()}

        for card in CARDS:
            url = f"/{DOMAIN}/cards/{card}"
            if url not in existing_urls:
                await resources.async_create_item({"res_type": "module", "url": url})
                _LOGGER.info("Registered Lovelace resource: %s", url)
            else:
                _LOGGER.debug("Lovelace resource already registered: %s", url)

    except Exception as err:
        _LOGGER.error("Failed to register Lovelace resources: %s", err)


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
