# n8n-nodes-apivault-linkedin-profile

Official n8n community node for the **Apivault Labs LinkedIn Profile Scraper**.

Send public LinkedIn `/in/` URLs or usernames to the hosted Apify Actor and receive the available public profile data as nested JSON or flat CRM rows. No LinkedIn login or cookies are supplied to the node.

The package name and internal node name remain unchanged so existing n8n installations can upgrade normally.

## Installation

In n8n, open **Settings → Community Nodes → Install** and enter `n8n-nodes-apivault-linkedin-profile`.

## Inputs

- Public LinkedIn profile URLs or usernames.
- Optional CRM records containing `{url, id}` for output correlation.
- Optional public-field research signals.
- Nested JSON or flat CRM output.
- Up to 100 combined unique profiles per Actor run.

The node validates empty and oversized input before starting a paid Actor run. Demo mode is disabled by default in n8n to avoid accidental demo-result charges.

## Architecture

This package is only an integration funnel: it validates the public input, starts the hosted Actor, polls its status and returns Dataset rows. It contains no profile collection implementation, private endpoints, session credentials or Actor internals.

## Resources

- [LinkedIn Profile Scraper on Apify](https://apify.com/apivault_labs/linkedin-profile-scraper-no-cookies)
- [Apivault Labs Actors](https://apify.com/apivault_labs)
- [n8n community-node documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE)
