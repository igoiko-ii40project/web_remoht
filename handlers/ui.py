import webapp2
import logging
import json
from google.appengine.api import xmpp, users, channel

from . import BaseHandler
import config
import model
import datetime
import main

#base_jid = "rpc@rehmote.appspotchat.com"

#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
class RootHandler(BaseHandler):
    def get(self):
        user = users.get_current_user()
#        if not user:
#          self.redirect(users.create_login_url(self.request.uri))
#          return

        self.render('index')


#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
class Ind_Elem_Handler(BaseHandler):
    def get(self,ghost=None):
        user = users.get_current_user()
#        if not user:
#          self.redirect(users.create_login_url(self.request.uri))
#          return

        self.render('ind_elem')


#------------------------------------------------------------------------------------------------
class add_admin_Handler(BaseHandler):
    def get(self,ghost=None):
        user = users.get_current_user()
        jid = user.email()

        admin = model.XMPP_Admin(
                user = user,
                jid = jid       )
        admin.put()


#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
class DeviceHandler(BaseHandler):

    def get(self,_id=None):
        logging.debug("DeviceHandler GET")
        if _id is None:
            devices = model.Device.all()

        else:
            device = model.Device.get_by_id(int(_id))
            if device.owner != users.get_current_user():
                return self.unauthorized()

            devices = [device]

        self.render_json( {"msg":"OK","devices":devices} )


    def post(self):
        logging.debug("DeviceHandler PUT")
        resource = self.request.get('resource')

        user = users.get_current_user()
        jid = user.email()
        full_resource = model.get_full_resource( jid, resource )
        full_jid = '%s/%s' % (jid, full_resource)
        online, avail = xmpp.get_presence(full_jid, get_show=True)

        device = model.Device.from_resource(resource)

        msg = "OK"
        if device != None:
            logging.debug("Device %s allready in system", full_jid)
            msg = "JID %s is already added" % jid
            self.response.status = 200 #fixme

        else:
            logging.debug("Adding device %s", full_jid)
            device = model.Device( 
                    Ind_Device_Name = resource,
                    Ind_Device_Description = "**description not loaded yet**",
                    Ind_Device_Elements = "**elements not loaded yet**",
                    owner = user,
                    jid = jid,
                    resource = resource,
                    presence = avail )
            device.put()

        self.render_json({'msg':msg,"device":device})


#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
class ResourcesHandler(BaseHandler):
    def get(self):
        user = users.get_current_user()
        if not user:
            return self.unauthorized()

        xmpp_user = model.XMPPUser.get_current_user()

        jid = user.email()
        if xmpp_user is None:
            xmpp_user = model.XMPPUser.new()
            xmpp_user.put()
            xmpp.send_invite(jid)

        xmpp.send_presence(jid, presence_type=xmpp.PRESENCE_TYPE_PROBE)
        self.render_json({"msg":"OK", "resources":xmpp_user.resources})


#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
class RelayHandler(BaseHandler):

    def get(self,device_id,relay=None):
        logging.debug("Get relay %s", relay)

        user = users.get_current_user()
        if not user: return self.unauthorized()

        device = model.Device.get_by_id(int(device_id))
        if device is None: return self.notfound()
        logging.info("Device ID: %d, %s", int(device_id),device.full_jid)

        msg = { "cmd" : "get_relays",
                "params" : {"relay_id" : relay } }

        logging.debug(datetime.datetime.now().strftime("%H:%M:%S")+": Sending get_relay to %s", device.full_jid)
        xmpp.send_message(device.full_jid, json.dumps(msg))
        self.render_json({"msg":"OK","relays":device.relays})

        #when selected new resource to monitor:
        #(2) update new logged_in resource in dict_of_jid_resources
        #(1) clear page content
        #(3) send request to read, wait for channel to that resource

        if device.jid in main.dict_of_jid_resources:
            logged_in_resource=main.dict_of_jid_resources[device.jid]
            logging.info("... logged_in resource is: %s", logged_in_resource)
        else:
            logged_in_resource=''
            logging.info("... no logged_in resource (is empty)")

        old_logged_in_resource=logged_in_resource
        new_logged_in_resource=device.resource
        if new_logged_in_resource != old_logged_in_resource:
            main.dict_of_jid_resources[device.jid]=new_logged_in_resource
            logging.info("new current logged in resource is: %s", new_logged_in_resource)
        else:
            logging.info("logged in resource not changed. current logged in resource is: %s", logged_in_resource)

        user_admin = users.get_current_user()
        jid_admin = user_admin.email()
        new_admin = model.XMPP_Admin(
                user = user_admin,
                jid = jid_admin       )
        new_admin.put()
        logging.debug("XMPP admin added: %s",jid_admin)



    def post(self, device_id, relay):

        user = users.get_current_user()
        if not user: return self.unauthorized()

        device = model.Device.get_by_id(int(device_id))
        if device is None: return self.notfound()
        logging.info("Device ID: %d, %s", int(device_id),device.full_jid)

        state = self.request.get("state",None)
        logging.debug("Toggle relay %s to %s", relay, state)
        msg = { "cmd" : "toggle_relay",
                "params" : { "relay_id" : relay,
                             "state" : int(state) } }

        to_jid = device.full_jid
        
        logging.debug(datetime.datetime.now().strftime("%H:%M:%S")+": Sending toggle_relay to %s, %s=%s", to_jid, relay, state)
#        from_jid = "%s/user-%s" % (base_jid, user.user_id())
        xmpp.send_message( to_jid, json.dumps(msg))#, from_jid=from_jid)
        self.render_json({"msg":"OK","relays":device.relays})




#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
class Device_Log_Handler(BaseHandler):

    def get(self,device_id,relay=None):
        logging.debug("Device_Log_Handler GET")


    def post(self, device_id):
        logging.debug("Device_Log_Handler POST")

        user = users.get_current_user()
        if not user: return self.unauthorized()

        device = model.Device.get_by_id(int(device_id))
        if device is None: return self.notfound()
        logging.info("Device ID: %d, %s", int(device_id),device.full_jid)

        msg = { "cmd" : "auth_login",
                        "params" : {"currently_signed_up" : "name of currently signed up device"} }  #TODO use this to ask specific information to authenticate device, before taking ist full_resource address for the active device. Currently, i am sending the full_resource of the device connected

        to_jid = device.full_jid

        logging.debug(datetime.datetime.now().strftime("%H:%M:%S")+": Sending auth_login request to %s", to_jid)
        xmpp.send_message( to_jid, json.dumps(msg))#, from_jid=from_jid)
        self.render_json({"msg":"OK","device":device.full_jid})
