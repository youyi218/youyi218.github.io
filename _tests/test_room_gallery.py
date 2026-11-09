"""Run after bin/build: python3 -m unittest discover -s _tests."""
from html.parser import HTMLParser
from pathlib import Path
import unittest


class PageResources(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.tags = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class RoomGalleryTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.site = Path(__file__).resolve().parents[1] / '_site'
        cls.page = PageResources((cls.site / 'rooms/index.html').read_text())

    def test_initial_page_does_not_download_or_render_models(self):
        self.assertFalse([attrs for tag, attrs in self.page.tags if tag == 'model-viewer'])
        sources = [attrs.get('src', '') for _, attrs in self.page.tags]
        self.assertFalse([src for src in sources if '.glb' in src or 'model-viewer.min.js' in src])

    def test_every_room_has_a_small_local_cover_and_load_button(self):
        covers = [attrs for tag, attrs in self.page.tags
                  if tag == 'img' and 'room-cover' in attrs.get('class', '').split()]
        buttons = [attrs for tag, attrs in self.page.tags
                   if tag == 'button' and 'room-open' in attrs.get('class', '').split()]
        rooms = [attrs for tag, attrs in self.page.tags
                 if tag == 'article' and 'room' in attrs.get('class', '').split()]
        self.assertGreater(len(rooms), 0)
        self.assertEqual(len(covers), len(rooms))
        self.assertEqual(len(buttons), len(rooms))
        for cover in covers:
            image = self.site / cover['src'].lstrip('/')
            self.assertTrue(image.is_file())
            self.assertLess(image.stat().st_size, 250_000)
        for button in buttons:
            self.assertTrue(button.get('aria-label'))


if __name__ == '__main__':
    unittest.main()
