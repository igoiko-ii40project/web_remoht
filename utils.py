import urlparse, urllib
import webapp2
import model
import re

import logging
import json
from google.appengine.api import xmpp, users, channel

import config

MAIN_PAGE_HTML = """\
<html>
  <head>
   <title> Ibon's Console for ii40</title>
   <h2>Ibon's Console</h2>
  </head>
  <body>
    <p>Delete identified resource from current user (from internal json dict)</p>
    <form method="post">
      <div><textarea name="resource_name" rows="2" cols="60"></textarea></div>
      <div><input type="submit" value="Delete resource"></div>
    </form>
    <hr>
    <p>Delete ALL messaging-lcsw_hangouts(from internal json dict)</p>
    <form method="post">
      <div><input type="submit" value="Delete messaging-lcsw"></div>
    </form>

  </body>
</html>
"""



#-----------------------------------------------------------------------------------------------------
class Ibon_Handler(webapp2.RequestHandler):
    def get(self):
        self.response.write(MAIN_PAGE_HTML)
#        self.response.headers['Content-Type'] = 'text/plain'
#        self.response.out.write('This is the Console for Ibon')

    def post(self):
        self.response.write('<html><body>Following resource will be deleted:<pre>')
        resource_name=self.request.get('resource_name')
        self.response.write(resource_name)
        self.response.write('</pre></body></html>')

        delete_resources_from_XMPPUser(resource_name)

#        user = users.get_current_user()
#        if not user:
#          self.redirect(users.create_login_url(self.request.uri))
#          return

#        self.render('index')

################################################################

#-----------------------------------------------------------------------------------------------------
def urlencode(uri):
    '''
    Jinja template filter.  See:
    https://github.com/mitsuhiko/jinja2/issues/17
    '''
    return urllib.quote(uri,safe='')
#    return urllib.urlencode( uri_part )
#    parts = list(urlparse.urlparse(uri))
#    q = urlparse.parse_qs(parts[4])
#    q.update(query)
#    parts[4] = urllib.urlencode(q)
#    return urlparse.urlunparse(parts)


#-----------------------------------------------------------------------------------------------------
def is_mobile(_):
    '''
    Custom jinja2 test.  Use like this:
    {% if _ is mobile %}  (it expects some variable...
    '''
    req = webapp2.get_request()
#    logging.debug( "UA ----------- %s", handler.request.user_agent )
    for ua in ('iPhone','Android','iPod','iPad','BlackBerry','webOS','IEMobile'):
        try: 
            if req.user_agent.index(ua) >= 0: return True
        except ValueError: pass # substring not found, continue
    return False


#-----------------------------------------------------------------------------------------------------
def delete_resources_from_XMPPUser(resource_name_input):
    xmpp_user = model.XMPPUser.get_by_jid("ibon.ii40project@gmail.com")
    list_of_resources=xmpp_user.resources.keys()

    delete_multiple_resources=False
    if delete_multiple_resources:
        for resource_name in list_of_resources:
            logging.info('resource is: %s', resource_name)
            if resource_name.startswith(("messaging-lcsw_hangouts","ES-MAD-5K0")):
                logging.info('deleting key! %s', resource_name)
                del xmpp_user.resources[resource_name]
                continue
    #        if resource_name.find("pi_[0-9a-fA-F]{8}"):
    #            logging.info('deleting key! %s', resource_name)
    #            del xmpp_user.resources[resource_name]
    else:
        del xmpp_user.resources[resource_name_input]
    xmpp_user.put()


#-----------------------------------------------------------------------------------------------------
def Save_get_readings_to_datastore(data):
    data['datestamp_data']
    data['temp_c']
    data['light_pct']
    data['pir']
    pass

'''
    device = model.Device(
        owner = user,
        jid = jid,
        resource = resource,
        presence = avail )
    device.put()
'''
