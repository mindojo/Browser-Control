import json, socket, time, sys, os, warnings

class error(Exception):
    """Represents a browser control error"""
    pass

class Browser:
    """Controls the Firefox web browser through a socket interface."""

    browserCommand = "firefox about:blank"
    maxConnectRetryCount = 10

    def __init__(self, url = None, launch_local_browser_instance = True,
                 address = None):
        """
        @param url: Open this URL if specified
        @param launch_local_browser_instance:
                 If true run Browser.browserCommand to open a new browser tab.
                 If false connect to the last open tab.
        @param address: The address and port to connect to.
                        If not specified use a random port from the Python side.
        """
        self._receive_buffer = ""
        self._seq = 0
        if address is None:
            # Python code wait listen on random port and wait for Firefos
            serversock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            serversock.bind(("127.0.0.1", 0)) # Pick a random port
            portnumber = serversock.getsockname()[1];
            serversock.listen(1)
            os.system("firefox -connect-to-port %s &" % portnumber)
            self.sock, addr = serversock.accept()
        else:
            # Python code connect directly to Firefox on a known port
            if launch_local_browser_instance:
                os.system(Browser.browserCommand+" &")
                time.sleep(1) # wait for the new tab to open
            self._connect(address)
        if url is not None:
          self.open(url)

    def _connect(self, address, retryCount = 1):
        if retryCount > Browser.maxConnectRetryCount:
            raise error("Unable to connect to the browser")
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
          self.sock.connect(address)
        except socket.error as e:
          # if starting Firefox for the first time we may need
          # a few more seconds
          sys.stderr.write(str(e) + ", retrying: " + str(retryCount) + "\n")
          time.sleep(1)
          self._connect(address, retryCount+1)

    def _send_message(self, message):
        # Add a sequential identifier to the message
        self._seq = self._seq+1
        message['seq'] = self._seq

        # Send the message
        msg = json.dumps(message) + "\n"
        msg = msg.encode("utf-8")
        msglen = len(msg)
        totalsent = 0
        while totalsent < msglen:
            sent = self.sock.send(msg[totalsent:])
            if sent == 0:
                raise error("socket connection broken")
            totalsent = totalsent + sent

    def _receive_response(self):
        index = self._receive_buffer.find("\n")
        while index == -1:
            chunk = self.sock.recv(1024)
            if chunk == '':
                raise error("socket connection broken")
            self._receive_buffer = self._receive_buffer + chunk
            index = self._receive_buffer.find("\n")
        response = self._receive_buffer[:index]
        self._receive_buffer = self._receive_buffer[index+1:]
        return json.loads(response.decode("utf-8"))

    def _receive_result(self):
        response = self._receive_response()
        if response["seq"] != self._seq:
            warnings.warn("Unexpected response seq id. Expected: %d  received: %s" % (self._seq, response["seq"]))
            return self._receive_result()
        if "error" in response:
            raise error(response["error"])
        if "result" in response:
            return response["result"]

    def open(self, url, wait_page_loaded = True, open_in_new_tab = False):
        """Navigate to url.

        @param url: The url to navigate to
        @param wait_page_loaded: If true the method won't return until the page
                                 is fully loaded and all onload events handlers
                                 have executed
        """
        msg = {"command": "open", "url": url,
               "notifyPageLoaded": wait_page_loaded}
        self._send_message(msg)
        self._receive_result()

    def get_location(self):
        """Return the current url as appears in the browser."""
        msg = {"command": "get_location"}
        self._send_message(msg)
        return self._receive_result()

    def get_html_source(self):
        """Return the entire html of the current dom."""
        msg = {"command": "get_html_source"}
        self._send_message(msg)
        return self._receive_result()
        
    def get_title(self):
        """Return the title of the browser."""
        msg = {"command": "get_title"}
        self._send_message(msg)
        return self._receive_result()
        
    def click(self, obj, wait_page_loaded = False):
        """Simulate click on obj.
         
        @param obj: XPath expression pointing to the HTML element that receive
                    the click event.
        @param wait_page_loaded: If true the method won't return until the
                                 browser has loaded a new page. Set this to
                                 true if the click action loads a new page.
        """
        msg = {"command": "click", "obj": obj,
                  "notifyPageLoaded": wait_page_loaded}
        self._send_message(msg)
        self._receive_result()

    def type_keys(self, obj, text):
        """Type text into obj simulation each keypress event.

        @param obj: XPath expression pointing to the HTML element that receive
                    the simulated keypress.
        """
        msg = {"command": "type_keys", "obj": obj, "text": text}
        self._send_message(msg)
        self._receive_result()

    def type(self, obj, text):
        """Type the text into obj.

        @param obj: XPath expression pointing to an HTML (input, textarea)
                    whose text is replaced
        """
        msg = {"command": "type", "obj": obj, "text": text}
        self._send_message(msg)
        self._receive_result()

    def go_back(self):
        """Go back one page in the history."""
        msg = {"command": "go_back"}
        self._send_message(msg)
        self._receive_result()

    def get_socks(self):
        """Get the manually configured socks proxy

        @return: an (host, port) tupple if there's a manually configured
                 socks proxy. Return None otherwise
        """
        msg = {"command": "get_socks"}
        self._send_message(msg)
        result = self._receive_result()
        if isinstance(result, list):
            return tuple(result)
        return None

    def set_socks(self, host, port):
        """Set the proxy settings to SOCKS5 with host, port
        
        If host is None no proxy is used
        """
        msg = {"command": "set_socks", "host": host, "port": port}
        self._send_message(msg)
        self._receive_result()


    def stop(self):
        """Quit the browser"""
        msg = {"command": "stop"}
        self._send_message(msg)
        self._receive_result()

    def select(self, obj, choice):
        """Select an option from a select dropdown

        @param obj: XPath expression pointing to the HTML select element
        @param choice: Value of the option to select
        """
        msg = {"command": "select", "obj": obj, "choice": choice}
        self._send_message(msg)
        self._receive_result()

    def get_selected_label(self, obj):
        """Returns the "label" of the currently selected option of a select dropdown
        
        The "label" is the contents of the <option> tag.

        @param obj: XPath expression pointing to the HTML select element
        @return: the label. If there's a multiple selection return the
                 the first select item. If there's no selection return None.
        """
        msg = {"command": "get_selected_label", "obj": obj}
        self._send_message(msg)
        return self._receive_result()

    def get_attribute(self, obj, attr):
        """Returns the specified attribute of an HTML element

        @param obj: XPath expression pointing to the HTML element on which
                    we are getting an attribute.
        @param attr: The name of the attribute to retrieve
        @return: the value of the attribute or None if the attribute is not set
        """
        msg = {"command": "get_attribute", "obj": obj, "attr": attr}
        self._send_message(msg)
        return self._receive_result()

    def get_cookies(self):
        """Returns all the cookies in the browser cookies file

        This function retunrs a list of dictionaries.

        Each dictionary contains the following keys:
         - host: the host of the cookie
         - path: the path of the cookie
         - name: the name of the cookie
         - value: the value stored in the cookie
         - isSecure: True if the cookie was transmitted through SSL
         - isSession: True if the cookie is a session cookie
         - expires: expiration time in seconds since January 1, 1970 UTC
         - isHttpOnly: True if the cookie is not accessible to javascript
         - creationTime: creation time of the cookie in microseconds since January 1 1970
        """
        msg = {"command": "get_cookies"}
        self._send_message(msg)
        return self._receive_result()

    def set_cookies(self, cookies):
        """Set the contents of the browser cookies file

        This function takes a list of dictionaries. It replaces all
        cookies in browser cookies file by the cookies in that list.
        Using b.set_cookies([]) will clear all of the browser cookies.
        
        Each dictionary can have the following keys: host, path, name,
        value, isSecure, isHttpOnly, isSession, expires (as described
        in get_cookies()):

        Only name is required. If host is not specified it will be set to
        the host of the current page.
        """
        msg = {"command": "add_cookies", "cookies": cookies, "clear": True}
        self._send_message(msg)
        return self._receive_result()

    def add_cookies(self, cookies):
      """Add or replace cookies in the browser cookies file
      
        This function takes a list of dictionaries
        
        Each dictionary can have the folling keys: host, path, name,
        value, isSecure, isHttpOnly, isSession, expires (as described
        in get_cookies()):

        Only name is required. If host is not specified it will be set to
        the host of the current page.
      """
      msg = {"command": "add_cookies", "cookies": cookies, "clear": False}
      self._send_message(msg)
      return self._receive_result()

    def js_eval(self, str):
      msg = {"command": "js_eval", "str": str}
      self._send_message(msg)
      return self._receive_result()

    def activate(self):
        msg = {"command": "activate"}
        self._send_message(msg)
        self._receive_result()


    def clear_cache(self):
        """Clear the browser cache"""
        msg = {"command": "clear_cache"}
        self._send_message(msg)
        self._receive_result()

    def set_useragent(self, uastring):
        """Set user agent to the given string
        
        If uastring is None it is reset to the default
        """
        msg = {"command": "set_useragent", "uastring": uastring}
        self._send_message(msg)
        self._receive_result()

    def get_useragent(self):
        """Get the manually configured socks proxy

        @return: an (host, port) tupple if there's a manually configured
                 socks proxy. Return None otherwise
        """
        msg = {"command": "get_useragent"}
        self._send_message(msg)
        return self._receive_result()

