# RentManager Admin Guide — Web version

A self-contained, single-page web version of `docs/admin-guide/`.

## Open it

- **Standalone:** open `index.html` in any browser, or run
  `python3 -m http.server 8098` in this folder.
- **Inside RentManager:** the builder publishes to `public/admin-guide/`, so
  with the app running it is available at **`/admin-guide`** (sidebar
  **Admin Guide**). This works without a database — it is a static page.

## Rebuild after editing the manual or walkthroughs

```bash
node docs/admin-guide/site/build.mjs
```

This regenerates `index.html` **and** republishes to `public/admin-guide/`.
Diagrams and walkthroughs are defined in `i18n/{en,km,zh}.mjs`.
