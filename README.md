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
