"""Constants for the Anderson's Grain integration."""

DOMAIN = "andersons_grain"
URL = "https://www.andersonsgrain.com/locations/in/dunkirk/"

DEFAULT_SCAN_INTERVAL = 10  # minutes
CONF_SCAN_INTERVAL = "scan_interval"

COMMODITIES = ["corn", "soybean", "red_wheat"]
COMMODITY_DISPLAY = {
    "corn": "Corn",
    "soybean": "Soybean",
    "red_wheat": "Red Wheat",
}

PRICE_TYPES = ["bid", "basis", "change"]
PRICE_TYPE_UNITS = {
    "bid": "USD/bu",
    "basis": "USD/bu",
    "change": "USD/bu",
}

ATTR_DELIVERY = "delivery"
ATTR_BID = "bid"
ATTR_BASIS = "basis"
ATTR_FUTURES = "futures"
ATTR_CHANGE = "change"
ATTR_SYMBOL = "symbol"
ATTR_LAST_TRADE = "last_trade"
ATTR_COMMODITY = "commodity"
ATTR_ALL_MONTHS = "all_months"
