__author__ = '105031691'

import os
import logging
import webapp2
import jinja2
from google.appengine.api import xmpp, taskqueue, users
from google.appengine.ext import ndb
import datetime
import json
import model
from . import BaseHandler

COUNTER_PAGE_HTML = """\
<!DOCTYPE html>
<html>
<body>
<form action="#" method="POST">
  <label for="key">Key:</label><input type="text" name="key" id="key">
  <input type="submit" value="+1">
</form>
</body>
</html>
"""

# -----------------------------------------------------------------------------------
class Counter(ndb.Model):
    count = ndb.IntegerProperty(indexed=False)

# -----------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
class CounterHandler(webapp2.RequestHandler):
    def get(self):
        try:
            self.response.write(COUNTER_PAGE_HTML)
            logging.info("CounterHandler GET: page counter shown")
        except Exception as ex:
            logging.warn("Error in GET counterhandler")

    def post(self):
        try:
            key = self.request.get('key')
            logging.debug("button clicked: key: %s",key)

            # Add the task to the default queue.
            taskqueue.add(url='/poll_worker', queue_name='default', params={'key': key})
        except Exception as ex:
            logging.warn("Error in POST counterhandler")

        self.redirect('/')

# -----------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
class PollWorker(webapp2.RequestHandler):
    def post(self): # should run at most 1/s due to entity group limit
        key = self.request.get('key')
        logging.debug("***************** Log entered as a result of a qued task: key was %s ************************", key)

        if True:
            # request readings ....
            jid_to_poll = self.request.get('jid')
            when_to_execute = self.request.get('eta')
            this_is_datetime=datetime.datetime.now().strftime("%Y/%m/%d-%H:%M:%S")
            msg = { "cmd" : "get_readings"}
            logging.debug(this_is_datetime+": Sending request for get_readings as part of PollWorker to %s",jid_to_poll)
            logging.debug(this_is_datetime+": %s", msg)
            xmpp.send_message(jid_to_poll, json.dumps(msg))

            # request relays....
            msg = { "cmd" : "get_relays"}
            logging.debug(this_is_datetime+": Sending request for get_relays as part of PollWorker to %s",jid_to_poll)
            logging.debug(this_is_datetime+": %s", msg)
            xmpp.send_message(jid_to_poll, json.dumps(msg))

        @ndb.transactional
        def update_counter():
            counter = Counter.get_or_insert(key, count=0)
            counter.count += 1
            counter.put()
        update_counter()


# -----------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
class FunsHandler(BaseHandler):          # i enable a page to manage different action requests (funs) coming from UI javascript
    def post(self, device_id, fun=None):
        user = users.get_current_user()
        if not user: return self.unauthorized()

        device = model.Device.get_by_id(int(device_id))
        if device is None: return self.notfound()
        logging.info("Device ID: %d, %s", int(device_id),device.full_jid)

#        fun = self.request.get('fun')     # i pass "fun" in the "POST", not in the "request"

        if fun==1:
            fun_code="get_code"
        elif fun==2:
            fun_code="get_cred"
        elif fun==3:
            fun_code="request_image"
        else:
            funcode=''
            logging.debug("ERROR: FunsHandler Received unknown code: %s",fun)

        if fun_code == 'request_image':
            # request image ....
            this_is_datetime=datetime.datetime.now().strftime("%Y/%m/%d-%H:%M:%S")
            msg = { "cmd" : "get_image"}
            logging.debug(this_is_datetime+": Sending request for get_image to %s",device.full_jid)
            xmpp.send_message(device.full_jid, json.dumps(msg))
            pass
        elif fun_code=='beep':
            pass
        elif fun_code=='get_cred':
            # get new credentials from propietary bucket....
            this_is_datetime=datetime.datetime.now().strftime("%Y/%m/%d-%H:%M:%S")
            msg = { "cmd" : "get_cred"}
            logging.debug(this_is_datetime+": Sending request for get_cred to %s",device.full_jid)
            xmpp.send_message(device.full_jid, json.dumps(msg))
            pass
        elif fun_code=='get_code':
            # get new code from propietary bucket....
            this_is_datetime=datetime.datetime.now().strftime("%Y/%m/%d-%H:%M:%S")
            msg = { "cmd" : "get_code"}
            logging.debug(this_is_datetime+": Sending request for get_cred to %s",device.full_jid)
            xmpp.send_message(device.full_jid, json.dumps(msg))
            pass
        else:
            logging.debug("ERROR: Received request to perform unknown function: %s",fun)

#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
class FunsButtonsHandler(BaseHandler):

    def post(self, device_id, fun):

        user = users.get_current_user()
        if not user: return self.unauthorized()

        device = model.Device.get_by_id(int(device_id))
        if device is None: return self.notfound()
        logging.info("Device ID: %d, %s", int(device_id),device.full_jid)

        logging.debug("function %s to %s", fun, device_id)
        msg = { "cmd" : "fun",
                "params" : { "param1" : 0,
                             "param2" : 1 } }

        to_jid = device.full_jid

        logging.debug(datetime.datetime.now().strftime("%H:%M:%S")+": Sending toggle_relay to %s, %s=%s", to_jid, relay, state)
#        xmpp.send_message( to_jid, json.dumps(msg))#, from_jid=from_jid)
#        self.render_json({"msg":"OK","relays":device.relays})











