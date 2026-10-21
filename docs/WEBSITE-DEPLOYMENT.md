# Website publisher

`joaoCarvalho1000/open-world-clock-windows` owns the website release pipeline for
`https://openworldclock.com`. Cloudflare Pages project `open-world-clock` and its
account remain unchanged. Android and iOS source and history remain private.

Use `.github/workflows/unit.yml`. It requires unit, browser, desktop and CodeQL
checks, packages the exact tested artifact, and deploys only from current `main`.
The release helper explicitly checks this public repository's main SHA. A private
repository SHA or pull-request ref is rejected. Existing artifact verification,
deployment identity, smoke checks, rollback and audit reports remain in place.
The historical `repository` value in release.json is the site identifier
`open-world-clock`; the SHA is from this public publisher.

## One-time cutover

1. Apply the existing no-bypass main rules, including `CI gate` and the trusted
   `Maintainer review` status. Retain the independent exact-head review process.
2. Configure `website-production` to accept only the `main` branch. Store a
   Cloudflare API token limited to Pages Edit for the existing account as the
   environment secret `CLOUDFLARE_API_TOKEN`. Do not use a personal OAuth token.
3. Keep this repository's `WEBSITE_DEPLOY_ENABLED=false` while preparing and
   reviewing the migration. Do not transfer private mobile files or Git history.
4. Before activating this publisher, set `WEBSITE_DEPLOY_ENABLED=false` in the
   former private publisher. Verify no deployment is still running there. GitHub
   concurrency locks do not span repositories.
5. Merge the reviewed, green change normally. Set this publisher's enable switch
   to true and run the existing main workflow. Verify the live release SHA and
   all three beta routes. Save the deployment report; a workflow start is not a
   successful deployment.

For recovery, reconcile Cloudflare's current deployment with the saved report.
Never enable both publishers or retry an uncertain write without reading state.
This migration does not release Windows installers or publish mobile builds.
