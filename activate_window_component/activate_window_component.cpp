#include <mozilla/ModuleUtils.h>
#include <nsIClassInfoImpl.h>
#include <nsIBaseWindow.h>
#include <gtk/gtkwindow.h>
#include <gdk/gdkx.h>

#include "activate_window_component.h"


class bbcActivateWindow : public bbcIActivateWindow
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_BBCIACTIVATEWINDOW

  bbcActivateWindow();

private:
  ~bbcActivateWindow();
};

NS_IMPL_ISUPPORTS1(bbcActivateWindow, bbcIActivateWindow)

bbcActivateWindow::bbcActivateWindow()
{
}

bbcActivateWindow::~bbcActivateWindow()
{
}


/* void activate (in nsIBaseWindow aBaseWindow); */
NS_IMETHODIMP bbcActivateWindow::Activate(nsIBaseWindow *aBaseWindow)
{
    GdkWindow *p;
    aBaseWindow->GetParentNativeWindow((void**)&p);
    p = gdk_window_get_toplevel(GDK_WINDOW(p));
    gdk_x11_window_move_to_current_desktop(p);
    gdk_window_show(p);
    gdk_window_focus(p, GDK_CURRENT_TIME);
    return NS_OK;
}


// b21c84f1-d787-4c26-a556-2938a7ec115f
#define BBC_ACTIVATE_WINDOW_CID \
{ 0xb21c84f1, 0xd787, 0x4c26, \
  { 0xa5, 0x56, 0x29, 0x38, 0xa7, 0xec, 0x11, 0x5f } }


#define BBC_ACTIVATE_WINDOW_CONTRACTID \
       "@example.com/remote-control-activate-window;1"

NS_GENERIC_FACTORY_CONSTRUCTOR(bbcActivateWindow)

NS_DEFINE_NAMED_CID(BBC_ACTIVATE_WINDOW_CID);

static const mozilla::Module::CIDEntry kActivateWindowCIDs[] = {
    { &kBBC_ACTIVATE_WINDOW_CID, false, NULL, bbcActivateWindowConstructor },
    { NULL }
};

static const mozilla::Module::ContractIDEntry kActivateWindowContracts[] = {
    { BBC_ACTIVATE_WINDOW_CONTRACTID, &kBBC_ACTIVATE_WINDOW_CID },
    { NULL }
};

static const mozilla::Module kActivateWindowModule = {
    mozilla::Module::kVersion,
    kActivateWindowCIDs,
    kActivateWindowContracts,
    NULL
};

NSMODULE_DEFN(nsSampleModule) = &kActivateWindowModule;

NS_IMPL_MOZILLA192_NSGETMODULE(&kActivateWindowModule)

