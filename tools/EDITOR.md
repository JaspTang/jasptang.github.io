# Portfolio editor

Run this small local editor from the portfolio folder:

```bash
python3 tools/admin_server.py
```

Then open <http://127.0.0.1:8765/admin>. The server listens only on your own computer. Choose a page, click text in its preview, and edit. Select text to apply bold, italic, underline, headings, lists, or a link. Choose **Save page** to write the changes to that page's HTML file. Press **Ctrl+C** in the terminal to stop it.

This first version edits page text and basic rich-text formatting. Page layout, images, colors, and spacing still come from the portfolio's HTML and CSS files.
