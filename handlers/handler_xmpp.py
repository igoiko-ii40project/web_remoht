import json
import logging
import model
import datetime
import utils

import webapp2
from google.appengine.api import xmpp, channel, users, taskqueue

# GTalk puts a hash on the end of resources.  Look for this character to 
# remove the hash
RESOURCE_TAG = ':'

#------------------------------------------------------------------------------------------------
# list of things to-do
#TODO memcache
#TODO logs
#TODO SMS via twilio
#TODO task queues
#TODO modules (module for default web requests, module for mobile requests, module for backend processing
#------------------------------------------------------------------------------------------------

#------------------------------------------------------------------------------------------------
def split_jid(full_jid):
    jid, resource = full_jid.split('/')
    if  resource.find(RESOURCE_TAG) >=0:
        resource = resource.split(RESOURCE_TAG)[0] 

    return jid, resource            # jid=ibon.ii40project@gmail.com ------- resource: pi_0

#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
class ChatHandler(webapp2.RequestHandler):
    # when pi sends a message, it is processed here by webapp
    def post(self):
        logging.info(str(datetime.datetime.now())+': chat message! %s', self.request.POST)
        message = xmpp.Message(self.request.POST)

        try:
            parsed = json.loads(message.body)       # body has the "payload", all the info sent form pi
                                                    # payload has "cmd"(the code identifying the type of info) and "data"(the json with all info coming from ind_element)

        except Exception as ex:
            logging.warn("Error parsing message %s", message.body)
            return

        msg_from=message.sender
        from_jid, resource = split_jid(message.sender)      # jid=ibon.ii40project@gmail.com ------- resource: pi_white (not :123456)
        full_resource = self.request.get('from').split('/')[1]          #pi_0:F3861874

        device = model.Device.from_resource(resource, from_jid)    #locates based on past combination of jid & resource. migh tnot be the current one
        if device == None: 
            logging.debug( "Message from unknown device %s/%s", from_jid, resource )
            return

        # parsed (the payload) has "cmd"(the code identifying the type of info) and "data"(the json with all info coming from ind_element)
        # message has:
        # 'cmd' = parsed [cmd]
        # 'data'
        #
        #additionally, the xmpp might have the following:
        # 'msg' = parsed [msg]
        # 'status' =
        # 'datestamp'  ????


        if 'msg' in parsed:
            msg_msg = parsed['msg']
            msg_status = parsed['status']
            if (msg_msg != "OK") or (msg_status!=0):
                logging.error( "Message received not OK: msg:%s status:%s", msg_msg, msg_status)
            return

        msg_cmd = parsed['cmd']
        msg_data = parsed['data']
        msg_ID = parsed['msg_ID']
        logging.debug('---- COMMAND: %s', msg_cmd)

#        logging.debug( "Message cmd: %s", cmd)
        if msg_cmd == 'get_relays':   #info is in "data" {"datestamp" : data[1],"relays": {"relay_1" : int(data[2]),"relay_2" : int(data[3]) }}
            logging.debug("Device.id: %s",device.id)
            logging.debug("NEW RELAYS: %s",parsed.get('data',None))
            if device.relays is None: device.relays = {}

            if 'ind_elem_data' in parsed['data']:       # this is the new structure, where the data is in the ind_elem_data
                msg_data =parsed['data']['ind_elem_data']

            for relay,state in msg_data['relays'].iteritems():   # relays: dict of {relay_name:state} items
                device.relays[relay] = state

            logging.debug("Updated relays for %s : %s", message.sender, msg_data)
            device.put()

            # pass the message on to the web UI user
            channel_id = device.owner.user_id()
            msg_data['device_id'] = device.id
            channel.send_message( channel_id,
                    json.dumps({
                        "datestamp_msg": parsed['data']['datestamp_msg'],
                        "from_msg": msg_from,
                        "cmd" : msg_cmd,
                        "data": msg_data
                        })
                    )

#------------------------------------------------------------------------------------------------
        elif msg_cmd == 'get_readings':     #XXXXXXX OLD: info is in "data" {"datestamp" : data[1],"temp_c": float(data[2]),"light_pct" : float(data[3]),"pir": bool(int(data[4])) }
                                            #info is now in structure   : datestamp_msg, ind_elem_info, ind_elem_data(datestamp_data, temp_c, light_pct,....)
            logging.debug("Device.id: %s",device.id)
            logging.debug("NEW READINGS: %s",parsed.get('data',None))

            if 'ind_elem_data' in parsed['data']:       # this is the new structure, where the data is in the ind_elem_data
                msg_data =parsed['data']['ind_elem_data']

            # pass the message on to the web UI user
            channel_id = device.owner.user_id()
            msg_data['device_id'] = device.id                 #adds the device.id and jid to the data passed to the browser using channel
            msg_data['jid'] = device.full_resource
#            msg_data['signed_jid'] = "ppito_get_readings"
            logging.debug("data being passed thru channel: %s",msg_data)
            utils.Save_get_readings_to_datastore(msg_data)
            channel.send_message( channel_id,
                    json.dumps({
                        "datestamp_msg": parsed['data']['datestamp_msg'],
                        "resource_msg": resource,
                        "from_msg": msg_from,
                        "cmd" : msg_cmd,
                        "data": msg_data
                        })
                    )


#------------------------------------------------------------------------------------------------
        elif msg_cmd == 'get_CPU':     #op_data:
            pass
#------------------------------------------------------------------------------------------------
        elif msg_cmd == 'get_image':        #XXXXXXX
                                            #
            logging.debug("Device.id: %s",device.id)
            logging.debug("DEVICE IMAGE: %s",parsed.get('data',None))

            if 'ind_elem_data' in parsed['data']:       # this is the new structure, where the data is in the ind_elem_data
                msg_data =parsed['data']['ind_elem_data']

            # pass the message on to the web UI user
            channel_id = device.owner.user_id()
            msg_data['device_id'] = device.id                 #adds the device.id and jid to the data passed to the browser using channel
            msg_data['jid'] = device.full_resource
            logging.debug("data being passed thru channel: %s",msg_data)
#            utils.Save_get_readings_to_datastore(msg_data)
            channel.send_message( channel_id,
                    json.dumps({
                        "datestamp_msg": parsed['data']['datestamp_msg'],
                        "resource_msg": resource,
                        "from_msg": msg_from,
                        "cmd" : msg_cmd,
                        "data": msg_data
                        })
                    )

#------------------------------------------------------------------------------------------------
        elif msg_cmd == 'auth_login':                        #the asset responded to a poll after a sendpresence. that asset is logged in
                                                            #XXXXXXXXXX OLD:info is in "data"{"datestamp" : data[1],"my_id_is":data[2],"auth_token": data[3]}
                                                            #info is now in the wallet structure, with the auth_token PLUS the device element structure
                                                            # data: cmd, data
            logging.debug("Device.id: %s",device.id)
            logging.debug("LOGIN CONFIRMATION FROM ASSET")
            if msg_data['ind_elem_data']['auth_token']=='AaBbCcDd123456':
                logging.debug("LOGIN AUTH CODE CORRECT %s", msg_data['ind_elem_data']['auth_token'])

                model.cache_full_resource(from_jid, resource, full_resource)    #set memcache for that device, NEED TO TWEAK TO ENSURE THAT IT IS UPDATED ONLY WITH THE ACTIVE xmpp_user
                logging.debug( "memcache set for %s/%s/%s", from_jid, resource, full_resource)

                # I create a task to incrment the counter each time an auth login, and with a 30sec delay.
                datetime_for_task=datetime.datetime.now()+datetime.timedelta(seconds=30)

                logging.debug( "task added poll_worker to be run at: %s",datetime_for_task.strftime("%Y/%m/%d-%H:%M:%S"))

                taskqueue.add(url='/poll_worker', queue_name='default', params={'key': "ppito", 'jid':msg_from, "eta":datetime_for_task}, eta=datetime_for_task)


            else:
                logging.debug("LOGIN AUTH CODE INCORRECT %s !!!!!", msg_data['auth_token'])

            msg_data['device_id'] = device.id                 #adds the device.id and jid to the data passed to the browser using channel
            msg_data['jid'] = device.full_resource
            msg_data['signed_jid'] = device.full_resource
            # pass the message on to the web UI user
            channel_id = device.owner.user_id()
            channel.send_message( channel_id,
                    json.dumps({
                        "datestamp_msg": parsed['data']['datestamp_msg'],
                        "resource_msg": resource,
                        "from_msg": msg_from,
                        "cmd" : msg_cmd,
                        "data": msg_data
                        })
                    )

#------------------------------------------------------------------------------------------------
        elif msg_cmd== 'ind_elem_data':
            logging.debug("Ind Element msg/data received. Going to store in table")

            ind_eleme_msg = parsed['data']
            logging.debug("parsed[data]: %s", ind_eleme_msg)

            ind_eleme_datestamp_msg = ind_eleme_msg['datestamp_msg']
            logging.debug("parsed[datestamp_msg]: %s", ind_eleme_datestamp_msg)

            ind_eleme_info = ind_eleme_msg['ind_elem_info']
            logging.debug("parsed[ind_eleme_info]: %s", ind_eleme_info)

            ind_eleme_data = ind_eleme_msg['ind_elem_data']
            logging.debug("parsed[ind_elem_data]: %s", ind_eleme_data)

            ind_eleme_datestamp2=datetime.datetime.strptime(ind_eleme_datestamp_msg, "%Y/%m/%d-%H:%M:%S")
            ind_eleme_datestamp3=datetime.datetime.now()
            logging.debug("datestamp to datetimeformat: %s", ind_eleme_datestamp2)
            logging.debug("datestamp now              : %s", datetime.datetime.now())

            ind_eleme_datapoint=model.Ind_Datapoint(
                Ind_Datapoint_data_timestamp = ind_eleme_datestamp2,                     #timestamp for the collected data By broadcasting device
                Ind_Datapoint_owner = ind_eleme_info['Device_owner'],
                Ind_Datapoint_data_source = ind_eleme_info['ind_elem_name'],
                Ind_Datapoint_data_value = ind_eleme_data               # dict of {data_structure:data_value} items. for complex data structures, a JSON
            )
            ind_eleme_datapoint.put()

            # pass the message on to the web UI user
            channel_id = device.owner.user_id()
            channel.send_message( channel_id,
                    json.dumps({
                        "datestamp_msg": ind_eleme_datestamp_msg,
                        "resource_msg": resource,
                        "from_msg": msg_from,
                        "cmd" : msg_cmd,
                        "data": ind_eleme_data
                        })
                    )


#------------------------------------------------------------------------------------------------
        elif msg_cmd == 'wallet_data':     #wallet info: what is the device
                                            # {"device_description":self.ind_device_description,"device_elements":self.ind_device_elements}

                                                #TODO check if wallet_data can be removed as it is transmitted in auth_login....
            logging.debug("WALLET DATA received")
            msg_data = parsed['data']
            channel_id = device.owner.user_id()
            channel.send_message( channel_id,
                    json.dumps({
                        "cmd" : msg_cmd,
                        "resource_msg": resource,
                        "from_msg": msg_from,
                        "data": msg_data
                        })
                    )

#------------------------------------------------------------------------------------------------
        elif msg_cmd == 'tweet_feed':     #tweet:
                                            # tweet_text
            logging.debug("twitter feed received")
            msg_data = parsed['data']
            channel_id = device.owner.user_id()
            channel.send_message( channel_id,
                    json.dumps({
                        "cmd" : msg_cmd,
                        "resource_msg": resource,
                        "from_msg": msg_from,
                        "data": msg_data
                        })
                    )
#------------------------------------------------------------------------------------------------
        elif msg_cmd == 'get_feeder_op_data':     #op_data:
            pass
#------------------------------------------------------------------------------------------------
        elif msg_cmd == 'get_flexo1_op_data':     #op_data:
            pass
#------------------------------------------------------------------------------------------------
        elif msg_cmd == 'get_flexo1_config_data':     #config_data:
            pass
#------------------------------------------------------------------------------------------------
        elif msg_cmd == 'get_flexo2_op_data':     #op_data:
            pass
#------------------------------------------------------------------------------------------------
        elif msg_cmd == 'get_flexo2_config_data':     #config_data:
            pass
#------------------------------------------------------------------------------------------------
        elif msg_cmd == 'get_slotter_op_data':     #op_data:
            pass
#------------------------------------------------------------------------------------------------
        elif msg_cmd == 'get_diecutter_op_data':     #op_data:
            pass
#------------------------------------------------------------------------------------------------
        elif msg_cmd == 'get_folder_op_data':     #op_data:
            pass


        else:
            logging.warn("Unknown command: %s", msg_cmd)
            error_msg="Unknown command: "+msg_cmd
#------------------------------------------------------------------------------------------------
        error_msg=""

        msg = { "cmd" : "xmpp_ackn",
                "params" : {"last_cmd" : msg_cmd, "error_msg":error_msg, "msg_ID":msg_ID} }
        message.reply(json.dumps(msg))



#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
#----------------------------   --------------------------------------------------------------------
class PresenceHandler(webapp2.RequestHandler):
    def post(self,operation):
        logging.info(str(datetime.datetime.now())+': Presence! %s', self.request.POST)     #Presence! MultiDict([('from', u'ibon.ii40project@gmail.com/pi_0:F3861874')
        from_jid, resource = split_jid( self.request.get('from') )      #from_jid=ibon.ii40project@gmail.com ....... resource=pi_0
        full_resource = self.request.get('from').split('/')[1]          #pi_0:F3861874

        msg_from=self.request.get('from')

        xmpp_user = model.XMPPUser.get_by_jid( from_jid )

        if xmpp_user is None:
            logging.debug( "1: Presence from unknown user %s ... %s", from_jid, resource )
            return
        #------------------------------------------------------------------
        if operation == 'probe':
            xmpp.send_presence( from_jid,
                    status="ready for action!",
#                    presence_show="available")
                    presence_show="chat")
            logging.debug( "operation was probe")
            return
        elif operation == 'available':
            logging.debug( "operation was available")
            pass
        elif operation == 'unavailable':
            logging.debug( "operation was unavailable")
            pass
        else:
            logging.debug( "operation was "+operation)

        if not resource: return logging.debug("No resource on %s", from_jid)
        if resource.startswith("messaging-lcsw_hangouts"): return logging.debug("Resource %s ignored", resource)

        # TODO: need to make sure that the connected device has the appropiate full_resource (incl. google_hash)
        # get the full_resource of the currently connected device
        #if the full_resource corresponds to the device broadcasting the presence, then update the status
        #if not, maybe this is a device connecting with a new Google_Hash, and i will need to confirm
        #   for that, send a connection_request message, and if response is ok, then update the device that is connected

        xmpp_user.resources[resource] = operation
        xmpp_user.put()

        # see if we have a device for this resource:
        device = model.Device.from_resource(resource, from_jid)     ##resource=pi_0 ...... from_jid=ibon.ii40project@gmail.com .......

#        logging.info("Current active device's full_jid is %s ; device that is broadcasting presence is %s", full_resource_current_signed_up_device, full_resource)

        if device != None:
            logging.debug( "Device identified: %s ", device.full_jid)
            if device.presence != operation:
                device.presence = operation
                device.put()
            this_is_datetime=datetime.datetime.now().strftime("%Y/%m/%d-%H:%M:%S")

            full_resource_current_signed_up_device = model.get_full_resource(from_jid, resource)     #what is the full_JID in the model for that XMPP_user+resource (could be from a previous xmpp instance)
            logging.debug( "full_resource: %s full_resource_current_signed_up_device: %s", full_resource,full_resource_current_signed_up_device)

            if full_resource!=full_resource_current_signed_up_device:                               #the database has a different full_JID: send an auth request to them
                if full_resource_current_signed_up_device == None:
                    logging.warn("Device %s is not previously registered ", full_resource)
                else:
                    logging.warn("Current active device(resource)'s full_jid %s is different from device that is broadcasting presence %s", full_resource_current_signed_up_device, full_resource)

                msg = { "cmd" : "auth_login",
                        "params" : {"currently_signed_up" : full_resource_current_signed_up_device} }  #TODO use this to ask specific information to authenticate device, before taking ist full_resource address for the active device. Currently, i am sending the full_resource of the device connected
                if operation=='available':
                    logging.debug(this_is_datetime+": Sending request to confirm login to %s", self.request.get('from'))
                    logging.debug(this_is_datetime+": %s", msg)
                    xmpp.send_message(self.request.get('from'), json.dumps(msg))
            else:
                if operation=='available':
                    logging.debug("Presence from the device already logged in, but sending the auth login request anyway for testing")
                    msg = { "cmd" : "auth_login",
                            "params" : {"currently_signed_up" : full_resource_current_signed_up_device} }  #TODO use this to ask specific information to authenticate device, before taking ist full_resource address for the active device. Currently, i am sending the full_resource of the device connected
                    logging.debug(this_is_datetime+": Sending request to confirm login to %s", self.request.get('from'))
                    logging.debug(this_is_datetime+": %s", msg)
                    xmpp.send_message(self.request.get('from'), json.dumps(msg))
                    pass

        elif device is None:
            logging.debug( "2:Presence from unknown device %s/%s", from_jid, resource )

#        model.cache_full_resource(from_jid, resource, full_resource)    #set memcache for that device, NEED TO TWEAK TO ENSURE THAT IT IS UPDATED ONLY WITH THE ACTIVE xmpp_user
#        logging.debug( "YES REMAPPED AT PRESENCE: memcache set for %s/%s/%s", from_jid, resource, full_resource)
#        logging.debug( "NOT DONE AT PRESENCE: memcache set for %s/%s/%s", from_jid, resource, full_resource)

        # attempt to send presence down to the owner.  If 
        # the owner is not online, no error so no problem
        channel_id = xmpp_user.user.user_id()

        msg = { "cmd" : "presence",
                "from_msg": msg_from,
                "datestamp_msg": this_is_datetime,
                "data" : {
                    "jid" : from_jid,
                    "signed_jid" : full_resource_current_signed_up_device,
                    "resource" : resource,
                    "full_resource" : full_resource,
                    "presence" : operation }
                }
        channel.send_message(channel_id, json.dumps(msg) )      #webapp sends the information to the channel of the xmpp_user


#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
class SubscriptionHandler(webapp2.RequestHandler):
    def post(self,operation):
        logging.info(str(datetime.datetime.now())+': Subscribe! %s', self.request.POST)
        from_jid = split_jid( self.request.get('from') )[0]

        if operation == 'subscribe':
            xmpp.send_presence(from_jid, status="available")
            pass

        elif operation == 'subscribed':
            pass

        elif operation == 'unsubscribe':
            # TODO delete JID?
            pass

        elif operation == 'unsubscribed':
            # TODO delete JID?
            pass


#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------
class ErrorHandler(webapp2.RequestHandler):
    def post(self):
        logging.warn(str(datetime.datetime.now())+': Error! %s', self.request.POST)
        
