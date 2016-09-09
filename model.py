# Copyright (c) 2011 Thom Nichols

from google.appengine.ext import ndb
from google.appengine.api import users, memcache

CACHE_RESOURCE_KEY = "full-resource.%s/%s"
##########################################################################################################
#                                                                                                        #
##########################################################################################################
class XMPPUser(ndb.Model):
    user = ndb.UserProperty(required=True)
    jid = ndb.StringProperty(required=True) # TODO validate JID format
    resources = ndb.JsonProperty(default=dict()) # dict of {resource:presence} pairs

    @classmethod
    def new(cls):
        user = users.get_current_user()
        return XMPPUser(user=user, jid=user.email())

    @classmethod
    def get_current_user(cls):
        return cls.query(cls.user == users.get_current_user()).get()

    @classmethod
    def get_by_jid(cls,jid):
        return cls.query(cls.jid == jid).get()


def cache_full_resource(jid, short_resource, full_resource):
        memcache.set( CACHE_RESOURCE_KEY % (jid, short_resource), full_resource )

def get_full_resource(jid, short_resource):
        return memcache.get( CACHE_RESOURCE_KEY % (jid, short_resource) ) or short_resource



##########################################################################################################
#                                                                                                        #
##########################################################################################################
class XMPP_Admin(ndb.Model):
    user = ndb.UserProperty(required=True)
    jid = ndb.StringProperty(required=True) # TODO validate JID format

    @classmethod
    def new(cls):
        user = users.get_current_user()
        return XMPP_Admin(user=user, jid=user.email())

    @classmethod
    def get_current_user(cls):
        return cls.query(cls.user == users.get_current_user()).get()

    @classmethod
    def get_by_jid(cls,jid):
        return cls.query(cls.jid == jid).get()



##########################################################################################################
# Data Model for a Device with XMPP communcation capabilities
#   - this communicates with the webapp, and keeps jid address, comm status, etc
#   - in the current implementation, it has a "relays" Json property that holds some device HW data
#    - the idea (April 2015) is that this Device holds some internal individually distinguisable Elements (sensors, controllers, actuators) that are related to this device and can hold distinguisable data
##########################################################################################################
class Device(ndb.Model):            #these are the devices that have been signed up to the service. It does not have the full_resource as a property: instead, this is encoded as "cache_full_resource" and "get_full_resource"
    Ind_Device_Name = ndb.StringProperty()
    Ind_Device_Description = ndb.StringProperty()
    Ind_Device_Elements = ndb.StringProperty()
    owner = ndb.UserProperty(required=True)
    allowed_admins = ndb.UserProperty(repeated=True)
    jid = ndb.StringProperty(required=True) #macarbox002@gmail.com # TODO validate JID format
    resource = ndb.StringProperty(required=True) #pi_white
    presence = ndb.StringProperty(default='available')
    relays = ndb.JsonProperty(default=dict())  # dict of {relay_name:state} items
    id = ndb.ComputedProperty( lambda self: self.key.id() if self.key else None )   # will need to remove this

    @property
    def full_jid(self):
        return '%s/%s' % (self.jid, self.full_resource)         #ibon.ii40project@gmail.com/pi_0

    @property
    def full_resource(self):
        result = memcache.get( CACHE_RESOURCE_KEY % (self.jid, self.resource) )
        return result or self.resource

    @classmethod
    def from_resource(cls,resource,jid=None):                   # jid=ibon.ii40project@gmail.com ------- resource: pi_0
        if jid is None:
            q = cls.query( cls.resource == resource,
                    cls.owner == users.get_current_user() )
        else:
            q = cls.query( cls.resource == resource,
                    cls.jid == jid )
        return q.get()

    @classmethod
    def all_by_jid(cls, jid):
        return cls.query( cls.jid == jid ).fetch()

    @classmethod
    def all_by_user(cls):
        return cls.query( cls.owner == users.get_current_user() ).fetch()

    @classmethod
    def all(cls,limit=20,offset=None):
        return cls.query(
                cls.owner == users.get_current_user()
                ).fetch(limit=limit,offset=offset)




##########################################################################################################
# Data Model for an Industrial Element (without XMPP communication capabilities), tied to a Device
#   - this individually distinguisable Element (sensors, controllers, actuators) that is related to a Device
#
# Ind_CPU and Ind_Asset (with temp sensor & relays) will be one of the of the Ind_Elements
#
# This will be a table with the list of elements uploaded to the webapp.
# The individual data will be posted & stored in a separate table
##########################################################################################################
class Ind_Element(ndb.Model):            #these are the indivually distinguisable elements, tied to a Device, and that hold unique data values that are broadcasted
    Ind_Element_Name = ndb.StringProperty(required=True)
    Ind_Element_Description = ndb.StringProperty(required=True)
    Ind_Element_Owner = ndb.StringProperty()    #macarbox002@gmail.com
    owner = ndb.UserProperty(required=True)
    Ind_Element_Parent = ndb.StringProperty() # Parent for the Industial_Element. Could be a Ind_Device or another Insustrial_Element
    Ind_Element_Type = ndb.StringProperty() # type of industrial element: CPU, Sensor, Controller, Actuator,....
    Ind_Element_BroadCast_data_type = ndb.StringProperty(required=True)   #type of data being broadcasted. description of data being broadcasted
    Ind_Element_id = ndb.ComputedProperty( lambda self: self.key.id() if self.key else None )

# ---------------
#    owner = "owner of the parent Ind_Device"
#    Ind_Element_Parent = "Macarbox002"
#    Ind_Element_Type = "CPU for Raspberry_Pi enabled device"
#    Ind_Element_Name = "Macarbox002_CPU""
#    Ind_Element_Description = "this is the CPU element part of Ind_Asset Macarbox002"
#    Ind_Element_BroadCast_data_type = "Tuple vble with functional information"
#    Ind_Element_id = ndb.ComputedProperty( lambda self: self.key.id() if self.key else None )


##########################################################################################################
# Data Model to store a data point from a remote Device/Element:
# It holds:
#   -when the datapoint was received
#   -when the datapoint was TAKEN at the remote location
#   -the dict with the remote data point
#   -when datapoint, in float, if this is a simple value
# The table will list all the received datapoints broadcasted by the remote ind_elements: (from all devices and all elements)
##########################################################################################################
class Ind_Datapoint(ndb.Model): #these are the datapoints broadcasted by individual Devices/(Industrial_Elements), and that will be stored in the datastore to be processed
    Ind_Datapoint_reception_timestamp = ndb.DateTimeProperty(auto_now_add=True)  #timestamp for reception (when data was added to datastore) by Wbapp Datastore
    Ind_Datapoint_owner = ndb.StringProperty(required=True)      #macarbox002@gmail.com/pi_white
    Ind_Datapoint_data_source = ndb.StringProperty(required=True)      #macarbox002@gmail.com/pi_white/Device_CPU   Industrial Element (sensor/controller/actuator) broadcasting the data
    Ind_Datapoint_data_timestamp = ndb.DateTimeProperty(indexed=False) #timestamp for the collected data By broadcasting device
    Ind_Datapoint_data_value_float = ndb.FloatProperty(repeated=True,indexed=False) #float data values being broadcasted. for single value broadcasted data
    Ind_Datapoint_data_value = ndb.JsonProperty(default=dict())  # dict of {data_structure:data_value} items. for complex data structures, a JSON

#