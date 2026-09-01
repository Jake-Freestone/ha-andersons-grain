"""Config flow for Anderson's Grain Prices."""
from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback

from .const import CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL, DOMAIN


class AndersonsGrainConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle config flow for Anderson's Grain Prices."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial setup step."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            return self.async_create_entry(
                title="Anderson's Grain — Dunkirk, IN",
                data=user_input,
            )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        CONF_SCAN_INTERVAL, default=DEFAULT_SCAN_INTERVAL
                    ): vol.All(int, vol.Range(min=5, max=1440)),
                }
            ),
            description_placeholders={
                "url": "https://www.andersonsgrain.com/locations/in/dunkirk/"
            },
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return AndersonsGrainOptionsFlow(config_entry)


class AndersonsGrainOptionsFlow(config_entries.OptionsFlow):
    """Handle options flow."""

    def __init__(self, config_entry):
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        current = self.config_entry.options.get(
            CONF_SCAN_INTERVAL,
            self.config_entry.data.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL),
        )

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Optional(CONF_SCAN_INTERVAL, default=current): vol.All(
                        int, vol.Range(min=5, max=1440)
                    ),
                }
            ),
        )
