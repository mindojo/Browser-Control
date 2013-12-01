import unittest, time, os
from browserc import Browser

class TestBrowser(unittest.TestCase):
    URL1 = "file://"+os.getcwd()+"/test_page1.html"
    URL2 = "file://"+os.getcwd()+"/test_page2.html"

    def setUp(self):
        #Assume browser alredy running
        self.b = Browser(TestBrowser.URL1, False, address=("localhost", 4000))

    def tearDown(self):
        # reset proxy
        self.b.set_socks(None, 0)
        # clear all cookies
        self.b.set_cookies([])
        # reset useragent
        self.b.set_useragent(None)
 
    def assertPageContains(self, str):
        source = self.b.get_html_source()
        str_index = source.find(str)
        self.assertNotEqual(str_index, -1)

    def test_get_location(self):
        self.assertEqual(self.b.get_location(), TestBrowser.URL1)

    def test_open(self):
        self.b.open(TestBrowser.URL2)
        self.assertEqual(self.b.get_location(), TestBrowser.URL2)

    def test_get_html_source(self):
        self.assertPageContains("<title>Test Page</title>")

    def test_get_title(self):
        self.assertEqual(self.b.get_title(), "Test Page")

    def test_click(self):
        self.b.click("//input[@value='Change title']")
        self.assertEqual(self.b.get_title(), "New Title")

    def test_type_keys_input(self):
        self.b.type_keys("//div[@id='testdiv']", "abcd")
        self.assertPageContains('DIV: keypress')

    def test_type_and_click(self):
        self.b.type("//input[@id='testinput']", TestBrowser.URL2)
        self.b.click("//input[@value='Open URL']", True)
        self.assertEqual(self.b.get_location(), TestBrowser.URL2)

    def test_type_triggers_change_event(self):
        self.b.type("//input[@id='testinput']", TestBrowser.URL2)
        self.assertPageContains("INPUT: change")

    def test_open_and_go_back(self):
        self.b.open(TestBrowser.URL2)
        self.assertEqual(self.b.get_location(), TestBrowser.URL2)
        self.b.go_back()
        self.assertEqual(self.b.get_location(), TestBrowser.URL1)

    def test_open_and_go_back_with_hash(self):
        self.b.open(TestBrowser.URL2+"#A")
        self.assertEqual(self.b.get_location(), TestBrowser.URL2+"#A")
        self.b.open(TestBrowser.URL2+"#B")
        self.assertEqual(self.b.get_location(), TestBrowser.URL2+"#B")
        self.b.go_back()
        self.assertEqual(self.b.get_location(), TestBrowser.URL2+"#A")
        self.b.go_back()
        self.assertEqual(self.b.get_location(), TestBrowser.URL1)

    def test_select(self):
        self.b.select("//select", 2)
        selected_label = self.b.get_selected_label("//select");
        self.assertEqual(selected_label, "B")

    def test_select_triggers_change_event(self):
        self.b.select("//select", 1)
        self.assertPageContains("SELECT: change")

    def test_get_attribute(self):
        select_size = self.b.get_attribute("//select", "size");
        self.assertEqual(select_size, "5")

    def test_socks(self):
        self.b.set_socks("1.1.1.1", 123)
        s = self.b.get_socks()
        self.assertEqual(s, ("1.1.1.1", 123))

    def test_cookies(self):
        # testing this correctly would require network access
        # and an http server with predictable cookies
        self.b.add_cookies([{"host": "example.com", "name": "n", "value": "v"}])
        
        found = False
        cookies = self.b.get_cookies()
        for c in cookies:
            if (c["host"] == "example.com" and c["name"] == "n"):
                found = True
                self.assertEquals(c["value"], "v")
        self.assertTrue(found)

    def test_js(self):
        t = self.b.js_eval("document.title.toUpperCase()")
        self.assertEquals(t, "TEST PAGE")

    def test_set_useragent(self):
        self.b.set_useragent("Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)")
        ua = self.b.js_eval("navigator.userAgent")
        self.assertEquals(ua, "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)")

    def test_get_useragent(self):
        self.b.set_useragent("Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)")
        ua = self.b.get_useragent()
        self.assertEquals(ua, "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)")


if __name__ == '__main__':
    unittest.main()

