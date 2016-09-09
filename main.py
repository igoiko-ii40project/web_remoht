# Copyright (c) 2011 Thom Nichols
# http://groovy-legacy-814.appspot.com/

__author__ = 'Ibon Goikoetxea'

import config
import os
import sys
import logging


# Force sys.path to have our own directory first, so we can import from it.
sys.path.insert(0, config.APP_ROOT_DIR)
sys.path.insert(1, os.path.join(config.APP_ROOT_DIR, 'lib'))

import webapp2
import utils
from google.appengine.api import users
import handlers
from handlers import handler_xmpp, ui, channel, ui_ibon


# Configure logging for debug if in dev environment
if config.DEBUG: logging.getLogger().setLevel(logging.DEBUG)

#logging.debug("Env: %s",os.environ)
logging.info('Loading %s, version = %s',
        os.getenv('APPLICATION_ID'),
        os.getenv('CURRENT_VERSION_ID'))


ROUTES = [
    ('/_ah/xmpp/message/chat/',       handler_xmpp.ChatHandler),
    ('/_ah/xmpp/presence/(\w+)/',     handler_xmpp.PresenceHandler),
    ('/_ah/xmpp/subscription/(\w+)/', handler_xmpp.SubscriptionHandler),
    ('/_ah/xmpp/error/',              handler_xmpp.ErrorHandler),

    ('/_ah/channel/(\w+)/',   channel.ConnectionHandler),
    ('/token/',                channel.TokenRequestHandler),

    ('/$',                        ui.RootHandler),
    ('/resources/$',              ui.ResourcesHandler),
    ('/device/',                  ui.DeviceHandler),
    ('/device/(\d+)/relay/(.*)$', ui.RelayHandler),

    ('/device/(\d+)/login/',       ui.Device_Log_Handler),      #handle the auth_login request, as sent by the device selection. TODO: unify all function handlers in one
#    ('/device/(\d+)/funs/',         ui_ibon.FunsHandler),       #handle for the funs sent programatically (get_image,...) to the page
#    ('/device/(\d+)/funs/(.*)$',    ui_ibon.FunsButtonsHandler),       #handle for the funs sent VIA BUTTON in the ind_elem page
    ('/device/(\d+)/funs/(.*)$',    ui_ibon.FunsHandler),       #handle for the funs sent VIA BUTTON in the ind_elem page

    #('/device/(\d+)/ind_elem/',    ui.Ind_Elem_Handler),
    ('/ind_elem/',                  ui.Ind_Elem_Handler),
    ('/add_admin/',                  ui.add_admin_Handler),
    ('/ibon_console/',                  utils.Ibon_Handler),
    ('/counter',                  ui_ibon.CounterHandler),
    ('/poll_worker',              ui_ibon.PollWorker),


    ('/logout',          handlers.LogoutHandler),
    ]


APP_CONFIG= {
    'webapp2_extras.sessions' : {
        'secret_key' : 'askdfs',
        'session_max_age' : 60*60*12 # 12 hours
    },
    'webapp2_extras.jinja2' : {
        'template_path' : 'views',
        'globals' : config.PAGE,
        'environment_args' : {
            'auto_reload' : config.DEBUG,
            'autoescape' : handlers.guess_autoescape, 
            'extensions' : ['jinja2.ext.autoescape']
        }
    }
}

app = webapp2.WSGIApplication(ROUTES, debug=config.DEBUG, config=APP_CONFIG)


dict_of_jid_resources={}

def main():
    dict_of_jid_resources['macarbox003@gmail.com']="pi_black"
    app.run()

if __name__ == "__main__":
    main()
