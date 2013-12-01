var titleOverlay = {
  profileName: "",

  changeTitle: function(event)
  {
    var prefix = this.profileName + " Profile - "
    if (document.title.indexOf(prefix) != 0)
      document.title =  prefix + document.title;
  },

  getProfileName: function() {
    // Get the profile name
    var DirectoryService = Cc["@mozilla.org/file/directory_service;1"].
                             getService(Ci.nsIProperties);
    var profilePath = DirectoryService.get("ProfD", Ci.nsIFile).path;
    var idx = profilePath.lastIndexOf(".");
    if (idx)
      return profilePath.substr(idx+1);
  },

  // Initialize the extension
  startup: function()
  {
    // Get profile name
    this.profileName = this.getProfileName();

    // Update title a first time
    this.changeTitle();

    // Install DOMTitleChanged event
    document//.getElementById("content")
      .addEventListener("DOMTitleChanged", function(e){
        titleOverlay.changeTitle()}, false);

  },
}

// Install load and unload handlers

window.addEventListener("load", function(e) { titleOverlay.startup(); }, false);
