import unittest, time
from browserc import Browser

class TestWikipedia(unittest.TestCase):
    def test_wikipdia(self):
        # Open Wikipedia
        b = Browser("http://en.wikipedia.org")
 
        # Assert the redirect worked as expected
        self.assertEqual(b.get_location(), "http://en.wikipedia.org/wiki/Main_Page")
 
        # Type "aicra" in the search box
        b.type_keys("//input[@name='search']", "aircra")
 
        # Wait for the autocompletion to do its job
        time.sleep(2);
 
        # Click on "aircraft" in the suggestion list
        b.click("//div[@class='suggestions-result' and @title='Aircraft']", True)

        # Assert the page title contains "Aircraft"
        title = b.get_title()
        self.assertNotEqual(title.find("Aircraft"), -1)

        # Go back and assert that we are on the main page again
        b.go_back()
        self.assertEqual(b.get_location(), "http://en.wikipedia.org/wiki/Main_Page")


if __name__ == '__main__':
    unittest.main()

