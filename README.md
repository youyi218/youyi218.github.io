# youyi.name

This is the Jekyll source for [youyi.name](https://youyi.name), hosted with GitHub Pages.

## Local preview

The site uses Ruby 3.3, matching the GitHub Actions deployment environment.

First-time setup on macOS:

```bash
brew install ruby@3.3
./bin/setup
```

Start the local preview:

```bash
./bin/preview
```

Open <http://127.0.0.1:4000>. The browser refreshes automatically when a source file changes. Press `Ctrl+C` to stop the server.

To check the same production build used for deployment:

```bash
./bin/build
```

If port 4000 is busy, choose another one:

```bash
PORT=4001 ./bin/preview
```

## Publish

The workflow in `.github/workflows/jekyll.yml` deploys every push to `master`. After reviewing the local preview:

```bash
git add <changed-files>
git commit -m "Describe the change"
git push origin master
```

This assumes **Settings → Pages → Build and deployment → Source** is set to **GitHub Actions**, as required by the repository's deployment workflow.

Then check the repository's **Actions** tab. When the `Deploy Jekyll with GitHub Pages dependencies preinstalled` workflow succeeds, the update is live at [youyi.name](https://youyi.name). If work was done on another branch, merge it into `master` first; pushing only that other branch will not deploy.
