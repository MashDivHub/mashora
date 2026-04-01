from mashora import http
from mashora.http import request
from mashora.addons.web.controllers.home import CREDENTIAL_PARAMS


CREDENTIAL_PARAMS.append('webauthn_response')


class WebauthnController(http.Controller):
    @http.route(['/auth/passkey/start-auth'], type='jsonrpc', auth='public')
    def json_start_authentication(self):
        auth_options = request.env['auth.passkey.key']._start_auth()
        return auth_options
