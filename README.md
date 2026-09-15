# Bape Jesus Fantasy Football — League HQ

A dependency-free, mobile-first Sleeper league companion for **Bape Jesus Fantasy Football**.

## What V2 includes

- Lit dark/chrome/neon visual system
- 2026 league + draft preconfigured
- All 12 managers, team names, avatars, and draft slots
- **Universal shared mode** — no login, no “my team,” no private war room
- Live Sleeper draft polling and 18-round snake board
- Optional **Team Focus** selector that only changes the visual highlight; every manager can focus every team
- Click any manager or draft-order card to focus that team on the shared draft board
- Shared current-pick / upcoming-pick panel
- Draft countdown and scoring-format callouts
- Historical season loader that follows Sleeper `previous_league_id`
- All-time manager W/L/points aggregation
- Past-draft scouting engine with the same tendency data available to all 12 managers
- Offline seed mode so the current room still renders if Sleeper cannot be reached

## Fair-use design

The site does **not** authenticate or claim a viewer is a specific manager. Everyone gets the same league data and the same tools.

Selecting a team in **Team Focus** is only a display filter:

- highlights that team's draft column
- shows that team's upcoming picks
- shows the picks occurring before that team's next selection

It does not unlock private information or change permissions.

## Open it locally

No install is required. You can double-click `index.html`, but some browsers restrict network requests from `file://` pages.

Best local option:

```bash
python -m http.server 5173
```

Then visit:

```text
http://localhost:5173
```

## Deploy

This is a static site. Put these files in any GitHub repository and deploy the repo to Vercel, Netlify, Cloudflare Pages, or GitHub Pages. No build step or environment variables are required.

## Sleeper IDs currently configured

- League: `1382152189975199744`
- Draft: `1382152189979410432`

## Notes

Historical scouting is intentionally based only on observable past draft behavior (position/round tendencies). It does not pretend historical ADP data is available when it is not.

This is an unofficial fan-made league companion. Sleeper data is fetched from Sleeper's public API.

## Dynamic season flow

- One shared selected week for home, weekly HQ and existing lineup overlay. The default advances on Tuesday at midnight America/New_York; history stays selected across automatic refreshes. Return with Current week.
- ESPN regular-season scoreboard supplies kickoff/opponents and completion. PREP before kickoff; LIVE from first kickoff until all scheduled games finish; FINAL until Tuesday. On schedule failure, the labeled calendar fallback uses Tue/Wed PREP and Thu–Mon LIVE; it cannot verify the final whistle. Weeks cap at 18. The calendar assumes the usual NFL Labor Day opening week; unusual future season calendars need an updated anchor. The configured league remains season-specific.
- Sleeper supplies each week's actual fantasy matchups, starters, scores and identities. Custom commissioner totals are honored. Public data refreshes every 60 seconds while visible and on returning to the tab.
- Historical regular-season records are rebuilt through the selected completed week, stopping before playoff_week_start. Standings sort win percentage (ties count half), points for, then name for deterministic display. This league has no divisions or extra median game; these variants would need additional rules. Sleeper remains authoritative for official playoff seeding.
- Power remains 50% record / 30% all-play / 20% recent scoring, computed using that snapshot only. Movement compares the preceding completed snapshot. First results show NEW because the old site had a preseason tie, not a real baseline ranking.
- Home recap shows the selected final week or the preceding completed week: high/low scores (including zero), biggest margin and closest game. Fantasy alerts retain the large neon comedy style and label PREP/LIVE/FINAL honestly.
- Existing mobile/desktop matchup overlay shows the selected week's lineup, NFL opponent and local kickoff time, and current injury status. Historical player team/injury metadata is current, not a saved weekly player snapshot.

### Data boundaries

No keys or paid services were added. The ESPN public site endpoint is an unofficial integration and may change or fail CORS; failures are labeled. Projections, historical injuries, waiver-news/editorial ticker items, bench optimization and prediction-based upsets are not provided by the documented Sleeper matchup feed and are not fabricated. The ticker currently shows week/state, lineup guidance, recap and power snapshot. The modal labels projections unavailable. The existing player catalog loads once per page session. An already open modal is a snapshot; reopen for refreshed scores.

### Validation

Run `node --test tests/season.test.cjs` for the clock, final/rollover boundaries, records, negative scores, ties and rank movement. This project is plain HTML/CSS/JavaScript: no package install or compilation build is needed. Serve the root with a static server. Syntax-check the JavaScript files with `node --check`.
