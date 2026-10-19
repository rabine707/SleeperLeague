# Sleeper Trade Lab

Private, unlinked workspace at `/trade-lab` for Bape Jesus. Existing HQ pages, scripts and navigation are unchanged. Defaults to **Brrr’s House of Ice** (matched by team name, with owner ID fallback) and **Win Now**. Live league configuration controls starting slots and scoring; the current league is 12-team Superflex.

## Enable access later

Access is **disabled by default**. No actual code or signing secret is included. A static host alone cannot run this feature; deploy the branch to the existing Vercel project with its Node.js Functions enabled. Do not merge/deploy production until reviewed.

1. On your own computer run `node scripts/configure-trade-lab.cjs` in an interactive terminal. Choose a unique random code or long passphrase, 16–256 characters. Input is hidden. The helper prints a salted scrypt hash and a random session signing secret, never the plaintext code.
2. Add the generated `TRADE_LAB_CODE_HASH` and `TRADE_LAB_SESSION_SECRET` to the intended Vercel environment. Keep them out of Git, browser code, URLs and any `PUBLIC` environment variables. `.env.example` contains blank names only. Redeploy that environment for changes to take effect.
3. Visit `/trade-lab` and enter your code. The cookie lasts four hours. Lock Lab clears the browser cookie and rendered rosters. Rotating either server variable invalidates all previously issued cookies; a copied stateless cookie otherwise remains valid until expiration. No manager identity or account role is inferred from the chosen team.

The visible HTML/login shell, CSS and calculation engine are public assets. Every Lab data request and session check requires server authorization. The public Sleeper data is also independently available directly from Sleeper; this gate restricts use of this site's Lab endpoint, not Sleeper itself. The hidden URL and noindex headers are discoverability controls, not authentication.

Verification uses scrypt and constant-time hash comparison. Sessions use HMAC-SHA256, HttpOnly, SameSite=Strict cookies and Secure in production. POST requests require a matching Origin. Responses containing session/data are private and no-store. Invalid codes are throttled to five attempts per IP per 15 minutes **per running function instance**. This is not a distributed limiter: choose a high-entropy code. For stronger global attempt limits, configure a hosting-level rate limit on POST `/api/trade-lab?action=login` before public use; no hosting rules were changed by this branch.

## Use it

- Refresh rosters loads all league owners, rosters and the rostered player catalog. No offline or seed rosters are substituted on failure. Player catalog requests are cached for a day; roster and finalized scoring requests for a minute per process. A new function instance starts with an empty cache.
- Manual analyzer: choose a partner, select outgoing/incoming players, optionally edit baseline points, then Analyze. Search by player, position or NFL team. Compare both optimized starting lineups before/after the trade.
- Finder: search all other teams for 1-for-1 deals and optional 2-for-1/1-for-2 packages among each team's top eight baseline scorers. Filter by minimum gain, value balance or mutual improvement. Top 50 matches are ranked and can be loaded into the manual analyzer. Search can be cancelled. This is a bounded player-package search, not an exhaustive search over arbitrarily large packages.
- Baseline points average the available `players_points` samples in up to five finalized league weeks, through Sleeper's `last_scored_leg`. Zero scores count; missing values are unknown. These league-scored historical averages are **not projections or market values**. For limited samples, injuries, byes or rookies, supply your own estimates. Before the first finalized week, manual estimates are required for useful results. Local estimates reset on refresh and are never saved on the server.
- Optimization uses exact weighted assignment with actual slot eligibility, including dual-position players and Superflex. IR/taxi players are excluded from starting lineups; incoming players enter the active roster. Empty starter slots are allowed and warned about. An empty slot can score above a negative baseline.
- Win Now score = `2 * your gain + 0.35 * partner gain - (100 - balance) / 20`. Mutual Benefit weights both gains equally. Balance is `100 * min(outgoing, incoming) / max(outgoing, incoming)` using sums of nonnegative baselines. This is a transparent sorting heuristic, not an acceptance prediction. No value model, paid API or AI service was added.
- Package trades warn about active roster overflow and are excluded from finder results until they fit. Manual trades do not automatically choose drops, fill waivers or model reserve eligibility changes. Draft picks, FAAB and keeper contract valuation are not included. No Sleeper trade is submitted.

## Local run and tests

Use Node.js 24. No package installation or build is needed.

```text
node --test tests/season.test.cjs tests/trade-lab.test.cjs
node scripts/trade-lab-dev.cjs
```

Open `http://127.0.0.1:5173/trade-lab`. Without process environment variables, the page correctly stays locked. For an unlocked local review, set the two generated values only in that terminal session before starting the preview. The preview adapter does not automatically load `.env` files. Existing static HQ previews still work, but the Trade Lab needs the API adapter or Vercel Functions. Existing HQ deployment instructions continue to apply to HQ itself.

Tests cover exact optimizer comparisons against exhaustive assignment, Superflex/IR/taxi, negative and unknown samples, ownership validation, package capacity, rankings/cancellation, default identity, hash verification, session forgery/expiry/rotation, origin rejection, fail-closed setup and throttling. Live/browser QA findings are documented in the pull request.

Sources: [Sleeper public API](https://docs.sleeper.com/) and [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js).
