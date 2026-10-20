# SmryX usage analytics

Property: **G-WV65497MC0**. The Cloudflare Worker is deployed at **https://beast-mode-analytics.luckyclover1.workers.dev** and the extension's `/events` URL is configured. Collection still requires the private GA secret and an enabled analytics preference.

The public website also uses this property through `docs/analytics.js`. That Google tag loads only after the visitor selects **Allow analytics**; website and extension preferences/identifiers are separate. In GA Admin → Data streams → stream **16155757434**, rename the stream to **SmryX** and set its Website URL to **https://smryx.com/**. Keep Measurement ID **G-WV65497MC0** and its existing secret. Renaming or changing that URL does not itself start collection.

Visit the live site, select **Allow analytics**, open its installation dialog, and check GA **Reports → Realtime overview** for `page_view` and `website_install_opened`. Download/build-guide links emit `website_download_clicked`. Extension use emits separate names such as `popup_opened` and `summary_completed`. A Google tag is appropriate on the public website; Chrome Manifest V3 extension pages use Measurement Protocol instead of remotely hosted tag code. The Worker `/health` result and HTTP 204 responses do not independently verify GA reporting. Ordinary reports can populate later than Realtime.

Usage analytics is enabled by default when no preference has been saved. An existing explicit opt-out stays off. Users can disable it in **Settings → Usage analytics**, which stops sends and clears local analytics identifiers. The extension still sends nothing without a configured HTTPS relay. This release does not reuse the previous publisher's identifiers.

## Activate the Cloudflare deployment

1. In Google Analytics, go to **Admin → Data streams**, select the Web stream with Measurement ID **G-WV65497MC0**, then open **Measurement Protocol API secrets → Create**. Name it **SmryX relay** and copy the generated secret value. Editor or Administrator access is required; accept the Measurement Protocol terms if prompted.
2. In Cloudflare, open **Workers & Pages → beast-mode-analytics → Settings → Variables and Secrets → Add**. Select **Secret**, name it exactly **GA_API_SECRET**, paste the value, and deploy/save. Do not add it to the public source files or send it in chat.
3. In Chrome, open **chrome://extensions** and reload **SmryX**. Open its **Settings → Usage analytics** and select **Check connection**.
4. Once the connection is ready, confirm **Share usage statistics with SmryX** is checked. It is enabled by default; if you previously turned it off, check it to enable it again. Use the extension, then check the property's Realtime report. HTTP success alone does not prove GA accepted the events.

This deployment allows `chrome-extension://onjmcmgcffeimccdjjolinhhhjigmmdi`, the ID observed when loading this project path in Chromium. If your installed extension has another ID, the connection check shows the exact origin to add to `ALLOWED_EXTENSION_ORIGINS`. Keep `analytics-server/wrangler.jsonc` in sync with any public variable changes in Cloudflare before redeploying.

Deployment commands from the project root:

```powershell
wrangler deploy --config analytics-server/wrangler.jsonc
wrangler secret put GA_API_SECRET --config analytics-server/wrangler.jsonc
```

The second command prompts privately for the secret as an alternative to the dashboard. No secret is committed. The Worker has no database or paid storage bindings; it fits Workers Free's 100,000 daily request allowance and 10 ms CPU limit. Requests above the free allowance can fail; there has been no plan upgrade. Rate limiting allows 60 events per installation per minute per Cloudflare location; it is not a global daily quota. The allowlist and public extension-ID header identify browser clients, not authenticate arbitrary HTTP clients. Privileged Chrome requests can omit `Origin`, so the extension sends `X-Beast-Mode-Extension` as a fallback; a supplied, unapproved Origin is still rejected.

The `/health` endpoint reports configuration readiness without sending an event to Google or exposing a secret. The connection check does not validate the GA secret's correctness; only GA-side validation/reporting can confirm that.

## Start the relay

Requires Node.js 20 or newer; no npm dependencies. Deploy this folder together with `shared/analytics-schema.js` to a Node host behind HTTPS. Set these environment variables through the host's private environment settings:

- `GA_API_SECRET`: create under GA Admin → Data streams → your Web stream → Measurement Protocol API secrets. Keep it server-side; never put it in the extension or commit it.
- `GA_MEASUREMENT_ID`: `G-WV65497MC0` (also the default).
- `ALLOWED_EXTENSION_ORIGINS`: comma-separated origins such as `chrome-extension://YOUR_PUBLISHED_EXTENSION_ID`. Use the actual development ID when testing an unpacked build. The origin allowlist is a browser restriction, not authentication against non-browser clients.
- `HOST` and `PORT`: default `127.0.0.1:3000`; set according to your hosting platform.

Run `node analytics-server/server.cjs` from the project root. Configure HTTPS at your host/reverse proxy and apply request-size, connection, and rate limits there. The handler also limits accepted payloads to 2 KiB and 1,000 requests per minute per process. Distributed deployments need shared edge limits before scaling traffic. No raw events or client IPs are logged or forwarded to GA by this code; configure hosting access logs according to your retention policy.

## Connect the extension

Set `endpoint` in `shared/analytics-config.js` to your deployed HTTPS URL ending in `/events`. Mirror the same public file into `SafariPort/SummarizeSafariExtension/Resources/shared/analytics-config.js` if distributing that port. Do not put an API secret in either copy. Reload the extension and enable **Usage analytics** to test.

## Events and data

Allowed events: `popup_opened`, `settings_opened`, `batch_opened`, `summary_requested`, `summary_completed`, `question_asked`, `batch_started`, `batch_completed`, `batch_paused`.

Summary events count uncached engine requests, including batch chunks/reduction requests; they do not measure unique pages. Batch-start count is the starting queue size; completion/pause count is the number of completed pages in that run, including pages appended while it runs. A completed batch can contain failed rows, so its count can be smaller than its starting size.

Only a random installation ID, session ID, extension version, event name and applicable count are forwarded. No page URL/title, article text, summaries, question text, ChatGPT identity, browser fingerprint, raw error or stack is accepted by the forwarding schema. Advertising consent is explicitly denied. The relay still receives normal network connection metadata from clients; it does not send that metadata to GA.

Opt-out stops pending sends and clears local analytics IDs. It cannot retract events already received by GA. Events are best-effort, have a short timeout, are never retried, and cannot delay summaries. The fixed 100 ms engagement parameter enables standard event reporting; it is a placeholder, not measured reading time. Measurement-Protocol-only reporting does not reproduce all metrics supplied by website tagging. A successful HTTP response does not guarantee that GA accepted an event into reports.

## Validate

Run `node --test --test-isolation=none tests/analytics.test.cjs tests/analytics-worker.test.mjs`. These tests mock Google's endpoint and do not send real events. Once the server is configured, validate the payload with Google's Measurement Protocol validation endpoint in a private server-side environment, then check your own property's Realtime report. Update your distribution's privacy disclosure before publishing the analytics-enabled build.
