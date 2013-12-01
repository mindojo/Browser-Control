Basic Browser Control Module
============================

Description
-----------

This Firefox module allow basic control of the browser through a TCP connection.

Installation
-------------
Copy basic-browser-control-extension.xpi into your extension directory. The
default extension directory is ~/.mozilla/firefox/[profile]/extension.

Check that the module is loaded in the Add-ons manager (Tools > Add-ons)


Connecting to the extension
---------------------------

There are two ways of connecting to the extension:

* The extension can connect to a TCP port specified on the command line
* The extension can also act as a TCP server accepting connection on its own
   port

To make the extension connect to a specified port start firefox with
the -connect-to-port option i.e "firefox -connect-to-port 5555". You can also
specify the host with -connect-to-host. If not specified the host is
"localhost". This option can be used on a running Firefox instance but only if
it wasn't started with the -no-remote argument.

The extension can also act as a TCP server, listening on predefined port. That
makes it easy to connect to an existing browser instance even when -no-remote
is used.

When listening on a port the extension use two settings:

* extensions.basic-browser-control.loopbackOnly
    * Only accept connections from localhost
* extensions.basic-browser-control.port
    * Configure the port that the extension listens on

By default the extension TCP server listen on port 4000.
Settings can be changed by clicking on the port number in the status bar or by
passing the -listen-port and -listen-loopback-only command line arguments to
Firefox. 

Starting Firefox with "firefox -listen-port 3333 -listen-loopback-only false"
for instance makes the extension listen on port 3333 and accept connections
from any host (assuming your firewall allows it). That setting is preserved
in the profile so you don't have to pass these arguments each time firefox is
started. You can also use those argument to change the port of a running
instance but only if it wasn't started with -no-remote.

When loopbackOnly is used you can only connect through the loopback interface.
If listening on port 4444 with loopbackOnly that means "nc localhost 4444" will
work but "nc [network_card_ip] 4444" will not.


Communication protocol
----------------------
When a TCP connection is established it takes control of the most recent
browser tab. Commands are sent through that connection in the form of
JSON encoded objects followed by a wewline character. For each commands the
module send a JSON encoded response followed by newline.

For instance you can verify that www.example.com is open in Firefox by
manually sending the get_location command using netcat:

    $ nc localhost 4444
    {"command": "get_location"}
    {"result":"http://www.example.com/"}

Each command must have the "command" property set to the name of the command
and can have other properties.

Normal responses are:
    {} (no result) 
    {"result": "result_text"}
    {"error": "error_text}

Commands and responses can also contain a "seq" property. When the seq property
is set in a message it is echoed back in the response. For instance:

    {"command": "get_location", "seq": 33}
    {"result":"http://www.example.com/","seq":33}

All messages and responses can contain the "seq" property even if it is not
written explicitly in their description bellow.

Supported commands
------------------

__{"command": "open", "url": "url", "notifyPageLoaded": [true|false]}__

The response is always {}. If notifyPageLoaded is true the response will only
arrive once the page has finished loading and all onload event handlers are
finished.

The open command is the same as typing an URL in the browser location bar.
Consequently when opening an URL where only the hash differ form the url
of the current page the browser will jump to the specified section of the page
without reloading it. The extension automatically set notifyPageLoaded to false
in this case.

---

__{"command": "go_back"}__

Go back one node in the browser history. Same as clicking the back button.
The normal response is {}.

If only one page was visited the response
is {"error":"Can't go back"}.

The go_back command is the same as clicking the browser back button.
Consequently when visiting the same URL twice the go_back command will
directly go back to the page that was opened prior to that, just as the
back button would.

---

__{"command": "get_location"}__

Retrieve the current location (URL).

---

__{"command": "get_html_source"}__

Get the current page source (the current dom)

---

__{"command": "get_title"}__

Get the page title (in the current dom)

---

__{"command": "click", "obj": "XPathExpr", "notifyPageLoaded": [true|false]}__

Click on the element referred to by XPathExpr. The response is always {}.
If notifyPageLoaded is true the response will only arrive once a page has
finished loading. Use notifyPageLoaded to wait for click actions that loads a
new page.

---

__{"command": "type", "obj": "XPathExpr", "text": "someText"}__

Set the test of the element referred to by XPathExpr.

---

__{"command": "type_keys", "obj": "XPathExpr", "text": "someText"}__

Send keypress events for each character in someText to the element referred
to by the XPathExpr.

---

__{"command": "get_socks"}__

Get the manually configured socks proxy

The result is an [host, port] array if there's a manually configured socks
proxy in the browser preferences. There is no result otherwise.

---

__{"command": "set_socks", "host": "someHost, "port": somePort}__

Set the proxy settings to SOCKS5 with the specified host and port.
If host is null no proxy is used

---

__{"command": "stop"}__

Quit the browser

---

__{"command": "select", "obj": "XPathExpr", "choice", "someValue"}__

Select an option from a select dropdown.

obj: an XPath expression pointing to the HTML select element.
choice: value of the option to select.

---

__{"command": "get_selected_label", "obj": "XPathExpr"}__

---

The response contains the label of the first selected option in the select
element or None if no option is selected.

obj: XPath expression pointing to the HTML select element

---

__{"command": "get_attribute", "obj": "XPathExpr", "attr": "someAttributeName"}__

Get the value of an HTML attribute. The result contains the attribute value or
is empty if the attribute is not set.

obj: XPath expression pointing to the HTML select element
attr: Name of the attribute

---

__{"command": "get_cookies"}__

Returns all the cookies in the browser cookies file

This function returns a list of objects.

Each object in the list contains the following keys:

* host: the host of the cookie
* path: the path of the cookie
* name: the name of the cookie
* value: the value stored in the cookie
* isSecure: True if the cookie was transmitted through SSL
* isSession: True if the cookie is a session cookie
* expires: expiration time in seconds since January 1, 1970 UTC
* isHttpOnly: True if the cookie is not accessible to javascript
* creationTime: creation time of the cookie in microseconds since January 1 1970

---

__{"command": "add_cookies", "cookies": [{"name": "n", "value": "v"}], "clear": [true|false]}__

Add or replace cookies in the browser cookies file
      
cookie is a list of objects. Each object can have the following keys: host, path,
name, value, isSecure, isHttpOnly, isSession, expires (as described
in the get_cookies command).

If clear is true the browser cookie file is emptied before adding the cookies.


Known Issues
------------

Firefox 3.5 (unlike 3.6 and 4.0b) return upper case tag names from
get_html_source() for HTML documents but not for XHTML document.

When using the stop command a page can still prevent the browser from closing
right away by displaying an alert() in the onunload event.

On Mac OS X the type_keys command doesn't work unless you manually bring
the Firefox window to the foreground before executing it.

Python module
-------------

There is a Python module in python/browserc.py

Check testbrowser.py and testwikipedia.py to get usage samples.

The HTML documentation for the python module is in the python_doc directory


