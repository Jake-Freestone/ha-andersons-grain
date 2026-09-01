"""Sensor platform for Anderson's Grain Prices."""
from __future__ import annotations

import logging
import re

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import (
    ATTR_ALL_MONTHS,
    ATTR_BASIS,
    ATTR_BID,
    ATTR_CHANGE,
    ATTR_COMMODITY,
    ATTR_DELIVERY,
    ATTR_FUTURES,
    ATTR_LAST_TRADE,
    ATTR_SYMBOL,
    COMMODITY_DISPLAY,
    DOMAIN,
    PRICE_TYPE_UNITS,
    PRICE_TYPES,
)
from .coordinator import AndersonsGrainCoordinator

_LOGGER = logging.getLogger(__name__)


def _slug(text: str) -> str:
    """Convert a string to a snake_case slug for use in entity IDs."""
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Anderson's Grain sensors from a config entry."""
    coordinator: AndersonsGrainCoordinator = hass.data[DOMAIN][config_entry.entry_id]

    entities: list[SensorEntity] = []

    for commodity, months in coordinator.data.items():
        if not months:
            continue

        # Per-delivery-month sensors for bid, basis, change
        for month_data in months:
            delivery = month_data.get(ATTR_DELIVERY, "")
            if not delivery:
                continue
            delivery_slug = _slug(delivery)

            for price_type in PRICE_TYPES:
                entities.append(
                    GrainPriceSensor(
                        coordinator,
                        commodity,
                        delivery,
                        delivery_slug,
                        price_type,
                    )
                )

        # One summary sensor per commodity (nearest delivery month, all months as attribute)
        entities.append(
            GrainCommoditySummarySensor(coordinator, commodity)
        )

    async_add_entities(entities)


class GrainPriceSensor(CoordinatorEntity, SensorEntity):
    """Sensor for a single price type of a single commodity delivery month."""

    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: AndersonsGrainCoordinator,
        commodity: str,
        delivery: str,
        delivery_slug: str,
        price_type: str,
    ) -> None:
        super().__init__(coordinator)
        self._commodity = commodity
        self._delivery = delivery
        self._delivery_slug = delivery_slug
        self._price_type = price_type

        display_commodity = COMMODITY_DISPLAY.get(commodity, commodity.title())
        self._attr_name = f"{display_commodity} {delivery} {price_type.title()}"
        self._attr_unique_id = f"andersons_grain_{commodity}_{delivery_slug}_{price_type}"
        self._attr_native_unit_of_measurement = PRICE_TYPE_UNITS.get(price_type)

    def _get_month_data(self) -> dict | None:
        months = (self.coordinator.data or {}).get(self._commodity, [])
        for m in months:
            if m.get(ATTR_DELIVERY, "").upper() == self._delivery.upper():
                return m
        return None

    @property
    def native_value(self):
        data = self._get_month_data()
        if data is None:
            return None
        return data.get(self._price_type)

    @property
    def extra_state_attributes(self) -> dict:
        data = self._get_month_data()
        if not data:
            return {}
        return {
            ATTR_COMMODITY: COMMODITY_DISPLAY.get(self._commodity, self._commodity),
            ATTR_DELIVERY: data.get(ATTR_DELIVERY),
            ATTR_FUTURES: data.get(ATTR_FUTURES),
            ATTR_SYMBOL: data.get(ATTR_SYMBOL),
            ATTR_LAST_TRADE: data.get(ATTR_LAST_TRADE),
            ATTR_BID: data.get(ATTR_BID),
            ATTR_BASIS: data.get(ATTR_BASIS),
            ATTR_CHANGE: data.get(ATTR_CHANGE),
        }

    @property
    def available(self) -> bool:
        return self.coordinator.last_update_success and self._get_month_data() is not None

    @property
    def device_info(self):
        return {
            "identifiers": {(DOMAIN, self._commodity)},
            "name": f"Anderson's Grain — {COMMODITY_DISPLAY.get(self._commodity, self._commodity)}",
            "manufacturer": "Anderson's Grain",
            "model": "Dunkirk, IN",
        }


class GrainCommoditySummarySensor(CoordinatorEntity, SensorEntity):
    """Summary sensor for a commodity — shows nearest-month bid as state, all months as attributes."""

    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_has_entity_name = True

    def __init__(self, coordinator: AndersonsGrainCoordinator, commodity: str) -> None:
        super().__init__(coordinator)
        self._commodity = commodity
        display = COMMODITY_DISPLAY.get(commodity, commodity.title())
        self._attr_name = f"{display} Current Bid"
        self._attr_unique_id = f"andersons_grain_{commodity}_summary"
        self._attr_native_unit_of_measurement = "USD/bu"

    @property
    def native_value(self):
        months = (self.coordinator.data or {}).get(self._commodity, [])
        if not months:
            return None
        return months[0].get(ATTR_BID)

    @property
    def extra_state_attributes(self) -> dict:
        months = (self.coordinator.data or {}).get(self._commodity, [])
        if not months:
            return {}
        nearest = months[0]
        return {
            ATTR_COMMODITY: COMMODITY_DISPLAY.get(self._commodity, self._commodity),
            ATTR_DELIVERY: nearest.get(ATTR_DELIVERY),
            ATTR_BASIS: nearest.get(ATTR_BASIS),
            ATTR_CHANGE: nearest.get(ATTR_CHANGE),
            ATTR_FUTURES: nearest.get(ATTR_FUTURES),
            ATTR_SYMBOL: nearest.get(ATTR_SYMBOL),
            ATTR_LAST_TRADE: nearest.get(ATTR_LAST_TRADE),
            ATTR_ALL_MONTHS: months,
        }

    @property
    def available(self) -> bool:
        return self.coordinator.last_update_success

    @property
    def device_info(self):
        return {
            "identifiers": {(DOMAIN, self._commodity)},
            "name": f"Anderson's Grain — {COMMODITY_DISPLAY.get(self._commodity, self._commodity)}",
            "manufacturer": "Anderson's Grain",
            "model": "Dunkirk, IN",
        }
