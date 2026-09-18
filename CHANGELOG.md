# Changelog

## 0.2.0

- Migrate from the retired `linkedin-profile-scraper` slug to `linkedin-profile-scraper-no-cookies`.
- Replace obsolete per-field toggles with the current public Actor schema.
- Add CRM `{url, id}` correlation records, nested/flat output, enrichment and demo controls.
- Validate empty and oversized inputs before starting a run.
- Add asynchronous polling and an option to return run metadata for separate workflows.
- Preserve the package and internal node names for upgrade compatibility.

## 0.1.0
- Initial release. Wraps Apify Actor `apivault_labs/linkedin-profile-scraper`.
