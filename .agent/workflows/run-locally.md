---
description: How to run the Jekyll site locally for review
---

To run the site locally and preview your changes:

1. **Install dependencies** (only if you haven't before, or if the Gemfile changed):
   ```bash
   bundle install
   ```

2. **Start the Jekyll server**:
   ```bash
   bundle exec jekyll serve
   ```

3. **View the site**:
   Open [http://localhost:4000](http://localhost:4000) in your browser.

> [!TIP]
> Use the `--livereload` flag to automatically refresh the browser when you save changes:
> `bundle exec jekyll serve --livereload`
