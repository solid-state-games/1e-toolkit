# 1e Character Sheet for Owlbear Rodeo

A rules-as-written AD&D 1st Edition character sheet for players, plus GM-only Encounters, Treasure and Combat tabs. Static site, no build step: host the folder root on GitHub Pages.

- Manifest URL (placeholder until published): `https://solid-state-games.github.io/1e-toolkit/manifest.json`
- Setup and use: [SETUP.md](SETUP.md) and [guide.html](guide.html)
- Notes, permissions design and every interpretation: [NOTES.md](NOTES.md)
- Try without Owlbear: open `index.html?dev=gm` or `index.html?dev=player` (serve the folder, for example `python3 -m http.server 8770 --bind 127.0.0.1`)
- Checks: `node test/toolkit.test.js --check`; browser run: `node test/browser_run.js` (see the file header)

Layout: `manifest.json`, `index.html` (action popover and sheet), `background.html` (context menu), `lib/` (shared rules libraries, do not edit here), `js/`, `css/`, `vendor/` (Owlbear SDK 3.1.0).

Licence: MIT, copyright Solid State Games 2026 ([LICENSE](LICENSE)). The vendored SDK is MIT (Owlbear Rodeo), see vendor/README.md.

Icons: Phosphor Icons 2.1.1 (MIT, copyright (c) 2023 Phosphor Icons), only the SVGs used, in `vendor/icons/` with its licence.

Unofficial fan work, built from the AD&D 1st Edition Dungeon Masters Guide, Players Handbook and Monster Manual. Not affiliated with or endorsed by the rights holders.
