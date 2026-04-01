# Part of Mashora. See LICENSE file for full copyright and licensing details.

from mashora import http
from mashora.addons.iot_drivers.tools import route

proxy_drivers = {}


class ProxyController(http.Controller):
    @route.iot_route('/hw_proxy/hello', type='http', cors='*')
    def hello(self):
        return "ping"

    @route.iot_route('/hw_proxy/status_json', type='jsonrpc', cors='*')
    def status_json(self):
        return {
            driver: instance.get_status()
            for driver, instance in proxy_drivers.items()
        }
