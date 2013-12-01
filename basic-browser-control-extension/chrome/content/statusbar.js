var statusbarPreferences = {
  prefs: null,
  
  updateLabel: function()
  {
    var port = this.prefs.getIntPref("port");
    var loopbackOnly = this.prefs.getBoolPref("loopbackOnly")

    var statusbar = document.getElementById('bbcStatusBar');
    statusbar.label = "Browser Control port: "+port+" loopbackOnly: "+loopbackOnly;
  },

  // Initialize the extension
  startup: function()
  {
    // Register to receive notifications of preference changes
    this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefService)
        .getBranch("extensions.basic-browser-control.");
    this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
    this.prefs.addObserver("", this, false);

    this.updateLabel();
  },
  
  // Clean up after ourselves and save the prefs
  shutdown: function()
  {
    this.prefs.removeObserver("", this);
  },
  
  // Called when events occur on the preferences
  observe: function(subject, topic, data)
  {
    if (topic != "nsPref:changed")
      return;

    if (data == "port" || data == "loopbackOnly")
      this.updateLabel();
  },

  // Open the preference dialog
  open: function() {
    var pref = Components.classes["@mozilla.org/preferences-service;1"]
                    .getService(Components.interfaces.nsIPrefBranch2);
    var optionsURL = 'chrome://basic-browser-control/content/options.xul';

    var windows = Components.classes['@mozilla.org/appshell/window-mediator;1']
                            .getService(Components.interfaces.nsIWindowMediator)
                            .getEnumerator(null);
    while (windows.hasMoreElements()) {
      var win = windows.getNext();
      if (win.document.documentURI == optionsURL) {
        win.focus();
        return;
      }
    }

    var features = false;
    try {
      var instantApply = pref.getBoolPref("browser.preferences.instantApply");
    }
    catch (e) {
    }
    features = "chrome,titlebar,toolbar,centerscreen" + (instantApply ? ",dialog=no" : ",modal");
    openDialog(optionsURL, "", features);
  }          
}

// Install load and unload handlers

window.addEventListener("load", function(e) { statusbarPreferences.startup(); }, false);
window.addEventListener("unload", function(e) { statusbarPreferences.shutdown(); }, false);
