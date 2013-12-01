// The usual syntactic shortcuts
const Cr = Components.results;
const Cc = Components.classes;
const Ci = Components.interfaces;

// Console logging
function log(message) {
  var consoleService = Cc["@mozilla.org/consoleservice;1"]
                        .getService(Ci.nsIConsoleService);
  consoleService.logStringMessage(message);
}

// Retrive an element through XPath
function getXpathElement(XPathExpr, document) {
  var iterator = document.evaluate(XPathExpr, document, null, 4, null);
  var thisNode = iterator.iterateNext();
  if (!thisNode)
    throw "No node found";
  else if (iterator.iterateNext())
    throw "XPath expression match more than one node";
  else if (thisNode.nodeType != 1)
    throw "XPath expression doesn't match an element node";
  return thisNode;
}

// Remove hash from URL
String.prototype.removeHash = function() {
  return this.replace(/\/?(#.*)?$/, '');
}

function unicodeToUtf8(str) {
  var converter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
                  .getService(Ci.nsIScriptableUnicodeConverter);
  converter.charset = 'UTF-8';
  return converter.ConvertFromUnicode(str);
}

function utf8ToUnicode(str) {
  var converter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
                  .getService(Ci.nsIScriptableUnicodeConverter);
  converter.charset = 'UTF-8';
  return converter.ConvertToUnicode(str);
}

String.prototype.escapeJs = function() {
  var str = this.toSource();
  return str.substring(12, str.length-2);
}

// Get the most recent browser window or create a new
// one (if only the download manager is open for instance)
function getBrowserWindow(callback) {
  // set this.browser to the topmost browser window
  var browserWindow = Cc["@mozilla.org/appshell/window-mediator;1"]
   .getService(Ci.nsIWindowMediator)
   .getMostRecentWindow("navigator:browser")

  if (browserWindow) {
    callback(browserWindow);
  } else {
    var urlStr = Cc["@mozilla.org/supports-string;1"]
                 .createInstance(Ci.nsISupportsString);
    urlStr.data = "about:blank";

    var bw = Cc["@mozilla.org/embedcomp/window-watcher;1"]
                      .getService(Ci.nsIWindowWatcher)
                      .openWindow(null, "chrome://browser/content/browser.xul", "_blank", "chrome,all,dialog=no", urlStr);
    var onload = function() {
      bw.removeEventListener("load", onload, true);
      callback(bw);
    }
    bw.addEventListener("load", onload, true);
  }
}

// Functions representing the remote commands
// provided through this extension
var remoteCommands = {
  open: function (command) {
    // Check if open only changes the URL hash
    // In which case wont see the page reloading
    var newUrl = command.url.removeHash();
    var currentUrl = this.browser.currentURI.spec.removeHash();
    if (command.url.indexOf("#") != -1 && newUrl == currentUrl)
      command.notifyPageLoaded = false;

    var _this = this;
    if (command.notifyPageLoaded) {
      this.onNextPageLoaded = function() {
        command.sendResult();
      };
    }

    if (!this.browser || !this.browser.contentDocument) {
      // If our browser window is gone bind to the current one instead
      if (this.browser.removeProgressListener)
        this.browser.removeProgressListener(this, Ci.nsIWebProgress.NOTIFY_STATE_WINDOW);
      getBrowserWindow(function(browserWindow) {
        _this.initializeBrowserObjects(browserWindow);
        _this.browser.loadURI(command.url)
        if (!command.notifyPageLoaded)
          command.sendResult();
      });
    } else {
      this.browser.loadURI(command.url)
      if (!command.notifyPageLoaded)
        command.sendResult();
    }
  },
  get_location: function (command) {
    var location = this.browser.currentURI.spec;
    command.sendResult(location);
  },
  get_html_source: function (command) {
    var XMLSerializer = Cc["@mozilla.org/xmlextras/xmlserializer;1"]
                          .createInstance(Ci.nsIDOMSerializer);
    var htmlSource = XMLSerializer.serializeToString(this.document);
    command.sendResult(htmlSource);
  },
  get_title: function (command) {
    var title = this.browser.contentTitle;
    command.sendResult(title);
  },
  click: function (command) {
    if (command.notifyPageLoaded) {
      this.onNextPageLoaded = function() {
        command.sendResult();
      };
    }

    var element = getXpathElement(command.obj, this.document);

    var evt = this.document.createEvent("MouseEvents");
    evt.initMouseEvent("mousedown", true, true, this.window,
    1, 0, 0, 0, 0, false, false, false, false, 0, null);
    element.dispatchEvent(evt);

    var evt = this.document.createEvent("MouseEvents");
    evt.initMouseEvent("mouseup", true, true, this.window,
    1, 0, 0, 0, 0, false, false, false, false, 0, null);
    element.dispatchEvent(evt);

    var evt = this.document.createEvent("MouseEvents");
    evt.initMouseEvent("click", true, true, this.window,
    1, 0, 0, 0, 0, false, false, false, false, 0, null);
    element.dispatchEvent(evt);

    if (!command.notifyPageLoaded)
      command.sendResult();
  },
  type_keys: function (command) {
    var element = getXpathElement(command.obj, this.document);

    // focus the browser window
    this.tabbrowser.selectedTab = this.tab;
    this.window.focus();
    var utils = this.window.QueryInterface(Ci.nsIInterfaceRequestor)
                  .getInterface(Ci.nsIDOMWindowUtils);
    utils.focus(element);
    for (var i = 0; i < command.text.length; i++) {
      utils.sendKeyEvent("keydown", 0, command.text.charCodeAt(i), 0);
      utils.sendKeyEvent("keypress", 0, command.text.charCodeAt(i), 0);
      utils.sendKeyEvent("keyup", 0, command.text.charCodeAt(i), 0);
    }
    command.sendResult();
  },
  type: function (command) {
    var element = getXpathElement(command.obj, this.document);
    element.value = command.text;

    // Trigger change event
    var evt = element.ownerDocument.createEvent('HTMLEvents');
    evt.initEvent('change', true, true );
    element.dispatchEvent( evt ); 

    command.sendResult();
  },
  go_back: function (command) {
    if (!this.browser.canGoBack)
      throw "Can't go back";
    
    // Check if going back only change the hash
    var history = this.browser.sessionHistory;
    var previousEntry = history.getEntryAtIndex(history.index-1, false);
    var previousUrl = previousEntry.URI.spec.removeHash();
    var currentUrl = this.browser.currentURI.spec.removeHash();

    // If only the hash changes don't wait for a
    // reload. There won't be any
    if (previousUrl == currentUrl) {
      this.browser.goBack();
      command.sendResult();
    } else {
      this.onNextPageLoaded = function() {
        command.sendResult();
      };
      this.browser.goBack();
    }
  },
  get_socks: function (command) {
    // Return the configured socks proxy if it was set manually
    var prefs = Cc["@mozilla.org/preferences-service;1"]
                        .getService(Ci.nsIPrefService);
    prefs = prefs.getBranch("network.proxy.");
    if (prefs.getIntPref("type") == 1) { // manual
      command.sendResult([ prefs.getCharPref("socks"),
                           prefs.getIntPref("socks_port") ]);
    } else {
      command.sendResult();
    }
  },
  set_socks: function (command) {
    var prefs = Cc["@mozilla.org/preferences-service;1"]
                        .getService(Ci.nsIPrefService);
    prefs = prefs.getBranch("network.proxy.");
    if (command.host) {
      // Use specified socks proxy
      prefs.setCharPref("http", "");
      prefs.setCharPref("ssl", "");
      prefs.setCharPref("ftp", "");
      prefs.setCharPref("gopher", "");
      prefs.setCharPref("socks", command.host);
      prefs.setIntPref("socks_port", command.port);
      prefs.setIntPref("socks_version", 5);
      prefs.setIntPref("type", 1);
    } else {
      // Use no proxy
      try {
        prefs.clearUserPref("type");
      } catch (e) {
      }
    }
    command.sendResult();
  },
  stop: function (command) {
    // Exit Firefox
    // Note: a page can still prevent the browser from
    // closing right away by displaying an alert() in
    // the onunload event.
    var appStartup = Cc["@mozilla.org/toolkit/app-startup;1"]
                 .getService(Ci.nsIAppStartup);
    appStartup.quit(appStartup.eForceQuit);
    command.sendResult();
  },
  select: function (command) {
    // Ensure a <select> is used
    var element = getXpathElement(command.obj, this.document);
    try {
      element.QueryInterface(Ci.nsIDOMHTMLSelectElement);
    } catch (e if e.result == Cr.NS_NOINTERFACE) {
      throw "elem is not a select element";
    }

    // Set selected value
    element.value = command.choice;
    if (element.value != command.choice)
      throw "This choice is not avalaible";

    // Simulate change event
    var evt = element.ownerDocument.createEvent('HTMLEvents');
    evt.initEvent('change', true, true );
    element.dispatchEvent( evt ); 

    command.sendResult();
  },
  get_selected_label: function(command) {
    var element = getXpathElement(command.obj, this.document);
    if (element.selectedIndex < 0) {
      command.sendResult();
    } else {
      var label = element.options[element.selectedIndex].text;
      command.sendResult(label);
    }
  },
  get_attribute: function(command) {
    var element = getXpathElement(command.obj, this.document);
    var value = element.getAttribute(command.attr);
    command.sendResult(value);
  },
  get_cookies: function (command) {
    var cookieMgr = Cc["@mozilla.org/cookiemanager;1"]
             .getService(Ci.nsICookieManager);

    var cookieList = [];
    for (var e = cookieMgr.enumerator; e.hasMoreElements();) {
      var cookie = e.getNext().QueryInterface(Ci.nsICookie2); 
      cookieList.push({
          "expires": cookie.expires,
          "host": cookie.host,
          "isSecure": cookie.isSecure,
          "name": cookie.name,
          "path": cookie.path,
          "value": cookie.value,
          "creationTime": cookie.creationTime,
          "isHttpOnly": cookie.isHttpOnly,
          "isSession": cookie.isSession});
    }
    command.sendResult(cookieList);
  },
  add_cookies: function (command) {
    var cookieMgr = Cc["@mozilla.org/cookiemanager;1"]
             .getService(Ci.nsICookieManager2);

    if (command.clear)
      cookieMgr.removeAll();

    for each (c in command.cookies) {
      if (!c.name)
        throw "Please specify a name for each cookie";
      if (!c.value)
        c.value = "";
      if (!c.host) {
        try {
          c.host = this.browser.currentURI.host;
        } catch (e) {
          throw "Please specify the host or open an http page first";
        }
      }
      if (!c.path)
        c.path = "/";
      if (!c.isSecure)
        c.isSecure = false;
      if (!c.isHttpOnly)
        c.isHttpOnly = false;
      if (!c.isSession)
        c.isSession = false;
      if (!c.expires)
        c.expires = new Date("January 1, 2100 00:00:00");
      cookieMgr.add(c.host, c.path, c.name, c.value,
                    c.isSecure, c.isHttpOnly, c.isSession,
                    c.expires);
    }
    command.sendResult();
  },
  js_eval: function (command) {
    // Use setTimeout() to evaluate code in the context of the page
    // I would use Components.utils.evalInSandbox() but that behaves
    // strangely possibly due to Bug #484459
    var _this = this;
    removeCallbacks = function() {
      delete _this.window.wrappedJSObject.__Eval__Result__;
      delete _this.window.wrappedJSObject.__Eval__Error__;
    }

    this.window.wrappedJSObject.__Eval__Result__ = function(result) {
      removeCallbacks();
      // If JSON encoding fail return a string representation
      // of the result
      try {
        var JSON = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
        JSON.encode(result);
      } catch (e) {
        obj = obj.toString();
      }
      command.sendResult(result);
    }

    this.window.wrappedJSObject.__Eval__Error__ = function(err) {
      removeCallbacks();
      _this.sendResponse({"error": err.toString(), seq: command.seq});
    }

    var code = "try {" +
               "  window.__Eval__Result__(eval("+command.str.escapeJs()+"));" +
               "} catch(e) {window.__Eval__Error__(e)}";
    this.window.setTimeout(code, 0);
  },
  activate: function (command) {
   var baseWindow = this.browserWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
           .getInterface(Components.interfaces.nsIWebNavigation)
           .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
           .treeOwner
           .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
           .getInterface(Components.interfaces.nsIXULWindow)
           .docShell
           .QueryInterface(Components.interfaces.nsIBaseWindow);


    var activator = Cc["@example.com/remote-control-activate-window;1"]
          .createInstance()
          .QueryInterface(Ci.bbcIActivateWindow);

    activator.activate(baseWindow);

    command.sendResult();
  },
  clear_cache: function (command) {
    var cacheService = Cc["@mozilla.org/network/cache-service;1"].getService(Ci.nsICacheService);
    cacheService.evictEntries(Ci.nsICache.STORE_ON_DISK);
    cacheService.evictEntries(Ci.nsICache.STORE_IN_MEMORY);
    command.sendResult();
  },
  set_useragent: function (command) {
    var prefs = Cc["@mozilla.org/preferences-service;1"]
                        .getService(Ci.nsIPrefService);
    prefs = prefs.getBranch("general.useragent.");
    if (command.uastring) {
      prefs.setCharPref("override", command.uastring);
    }
    else {
      try {
        prefs.clearUserPref("override")
      } catch (e) {
      }
    }
    command.sendResult();
  },
  get_useragent: function (command) {
    command.sendResult(this.window.navigator.userAgent);
  }
};

// RemoteConnection represents a TCP socket
// connection that receives browser control commands
function RemoteConnection(socket) {
  var _this = this;
  this.input = socket.openInputStream(0, 0, 0).QueryInterface(Ci.nsIAsyncInputStream);
  this.output = socket.openOutputStream(Ci.nsITransport.OPEN_BLOCKING, 0, 0);

  getBrowserWindow(function(browserWindow) {
    _this.initialize(browserWindow);
  });
}

RemoteConnection.prototype = {
  initialize : function(browserWindow) {
    this.initializeBrowserObjects(browserWindow);

    this.buffer = "";

    // when input is avalaible call this.onInputStreamReady() on the main thread
    var tm = Cc["@mozilla.org/thread-manager;1"].getService();
    this.input.asyncWait(this, 0, 0, tm.mainThread);
  },

  initializeBrowserObjects : function(browserWindow) {
    this.browserWindow = browserWindow;
    this.tabbrowser = browserWindow.gBrowser;
    this.tab = this.tabbrowser.selectedTab;
    this.browser = this.tabbrowser.selectedBrowser;
    this.window = this.browser.contentWindow;
    this.document = this.browser.contentDocument;
    this.browser.addProgressListener(this, Ci.nsIWebProgress.NOTIFY_STATE_WINDOW);
  },

  commandReceived: function (inputLine) {
    var _this = this;
    var commandObject;
    var JSON = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
    try {
      try {
        var commandObject = JSON.decode(inputLine);
      } catch (err) {
        throw "JSON decoding error";
      }
      if (!remoteCommands.hasOwnProperty(commandObject.command)) {
        throw "unknown command";
        return;
      }
      commandObject.sendResult = function(result) {
        _this.sendResponse({"result": result, seq: this.seq});
      }
      remoteCommands[commandObject.command].call(this, commandObject);
    } catch (err) {
      if (commandObject)
        this.sendResponse({"error": err.toString(), seq: commandObject.seq});
      else
        this.sendResponse({"error": err.toString()});
    }
  },

  // Called by AsyncInputStream
  // Check if a line of input is available and pass it to commandReceived
  onInputStreamReady: function (input) {
    var sin = Cc["@mozilla.org/scriptableinputstream;1"]
                .createInstance(Ci.nsIScriptableInputStream);
    sin.init(input);

    var closed = false;
    try {
      while (sin.available()) {
        this.buffer += sin.read(1024);
        var eolIndex = this.buffer.indexOf("\n");
        if (eolIndex !== -1) {
          var line = this.buffer.substr(0, eolIndex);
          var line = utf8ToUnicode(line);
          this.commandReceived(line);
          this.buffer = this.buffer.substr(eolIndex + 1);
        }
      }
    } catch (e if e.result == Cr.NS_BASE_STREAM_CLOSED) {
      // Socket closed. Avoid printing a scary error message
      log("Remote Control: Connection closed");
      closed = true;
    }

    if (!closed) {
      // Receive further input on the main thread
      var tm = Cc["@mozilla.org/thread-manager;1"].getService();
      input.asyncWait(this, 0, 0, tm.mainThread);
    }
  },

  sendResponse: function (response) {
    var JSON = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
    var jsonResponse = JSON.encode(response) + "\n";
    this.outputString(jsonResponse);
  },
 
  // Write a string on the socket
  outputString: function(str) {
    var encodedString = unicodeToUtf8(str);
    var count = 0;
    var length = encodedString.length;
    while (count < length) {
      count += this.output.write(encodedString.substr(count), length-count);
    }
  },

  QueryInterface: function(aIID)
  {
   if (aIID.equals(Ci.nsIWebProgressListener) ||
       aIID.equals(Ci.nsISupportsWeakReference) ||
       aIID.equals(Ci.nsISupports))
     return this;
   throw Components.results.NS_NOINTERFACE;
  },

  // Check if the document finished loading
  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
    if ((aStateFlags & Ci.nsIWebProgressListener.STATE_STOP) &&
        (aStateFlags & Ci.nsIWebProgressListener.STATE_IS_WINDOW)) {
      // remove hash from url
      var contextUrl = this.browser.currentURI.spec.removeHash();
      var requestUrl = aRequest.name.removeHash();
      if (requestUrl == contextUrl) {
        if (this.onNextPageLoaded) {
          this.onNextPageLoaded();
          this.onNextPageLoaded = null;
        }
        this.window = this.browser.contentWindow;
        this.document = this.browser.contentDocument;
      }
    }
  },

  onLocationChange: function(a, b, c) {},
  onProgressChange: function(a, b, c, d, e, f) {},
  onStatusChange: function(a, b, c, d) {},
  onSecurityChange: function(a, b, c) {}
};

// Returns the DOM of the current browser window
function getBrowserDom() {
  var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
             .getService(Ci.nsIWindowMediator);
  var recentWindow = wm.getMostRecentWindow("navigator:browser");
  return recentWindow ? recentWindow.content : null;
}

var serverSocket = {
  socket: null,

  // Get socket preferences
  getPreferences: function() {
    var prefs = Cc["@mozilla.org/preferences-service;1"]
                        .getService(Ci.nsIPrefService);
    prefs = prefs.getBranch("extensions.basic-browser-control.");
    return {
      port: prefs.getIntPref("port"),
      loopbackOnly: prefs.getBoolPref("loopbackOnly")
    };
  },

  // Start listening on a new socket
  startListening: function() {
    // Close old socket
    if (this.socket)
      this.socket.close();

    var prefs = this.getPreferences();

    this.socket = Cc["@mozilla.org/network/server-socket;1"]
                         .createInstance(Ci.nsIServerSocket);
    try {
      this.socket.init(prefs.port, prefs.loopbackOnly, -1);
      this.socket.asyncListen(this);
    } catch (e) {
      log("Remote Control: problem opening port "+prefs.port);
    }
  },

  // Accept a new connection
  onSocketAccepted: function (serverSocket, clientSocket) {
      log("Remote Control: "+
        "Accepted connection from " + clientSocket.host + ":" + clientSocket.port);
      new RemoteConnection(clientSocket);
  },

  onStopListening: function(serverSocket, status) {
  }
};

var preferencesObserver = {
  prefs: null,

  // Register to receive notifications of preference changes
  register: function() {
    this.prefs = Cc["@mozilla.org/preferences-service;1"]
        .getService(Ci.nsIPrefService)
        .getBranch("extensions.basic-browser-control.");
    this.prefs.QueryInterface(Ci.nsIPrefBranch2);
    this.prefs.addObserver("", this, false);
  },

  // Called on a preference change
  observe: function(subject, topic, data)
  {
    if (topic != "nsPref:changed")
      return;

    if (data == "port" || data == "loopbackOnly")
      serverSocket.startListening();
  }
}


// Code below handle the "profile-after-change" event (i.e. browser startup)
// and also handle command line arguments passed to the browser
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function BBCStartup() {
}

BBCStartup.prototype = {
  classDescription: "Remote Control Extension Entry Point",
  classID: Components.ID("593c0b60-ba0e-11df-851a-0800200c9a66"),
  contractID: "@example.com/remote-control-startup;1",
  _xpcom_categories: [
    { category: "profile-after-change" },
    { category: "command-line-handler" },
  ],
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsICommandLineHandler]),
  /* Implements nsIObserver */
  observe: function(subject, topic, data) {
    if (topic == "profile-after-change") {
      serverSocket.startListening();

      preferencesObserver.register();
    }
  },
  /* Implemets nsICommandLineHandler */
  handle: function(commandLine) {
      // Update preferences from command line
      var prefs = Cc["@mozilla.org/preferences-service;1"]
                            .getService(Ci.nsIPrefService);
      prefs = prefs.getBranch("extensions.basic-browser-control.");

      var listenPort = commandLine.handleFlagWithParam("listen-port", false);
      if (listenPort !== null) {
        prefs.setIntPref("port", listenPort);
      }

      var loopbackOnly = commandLine.handleFlagWithParam("listen-loopback-only", false);
      if (loopbackOnly != null) {
        loopbackOnly = (loopbackOnly == "true" ? true : false);
        prefs.setBoolPref("loopbackOnly", loopbackOnly);
      }

      // if one of these -listen-* option is specified but
      // Firefox is alredy running don't open
      // another window just change the pref
      if (listenPort !== null || loopbackOnly != null) {
        var w = Cc["@mozilla.org/appshell/window-mediator;1"]
         .getService(Ci.nsIWindowMediator)
         .getMostRecentWindow(null)
       if (w)
        commandLine.preventDefault = true;
      }
         

      // Reverse port listen
      var port = commandLine.handleFlagWithParam("connect-to-port", false);
      var host = commandLine.handleFlagWithParam("connect-to-host", false);
      if (!port)
        return;
      if (!host)
        host = "localhost";

      commandLine.preventDefault = true;

      var transportService = Cc["@mozilla.org/network/socket-transport-service;1"]
                    .getService(Ci.nsISocketTransportService);

      var socket = transportService.createTransport(null, 0, host, port, null);
      new RemoteConnection(socket);
  },
  helpInfo: "-connect-to-port     Connect to the given port\n"+
            "-connect-to-host     Connect ot the given host"
}

var myComponents = [BBCStartup];

// Use the proper code for Gecko 2
if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory(myComponents);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule(myComponents);

