# Vendored: @owlbear-rodeo/sdk 3.1.0

- Package: `@owlbear-rodeo/sdk@3.1.0` (npm, latest 3.x at 2026-11-12), fetched with `npm pack`.
- Licence: MIT, Copyright (C) 2023 Owlbear Rodeo. Full text: `OBR-SDK-LICENSE.txt` (the SDK's own licence, separate from this toolkit's LICENSE).
- The npm package ships TypeScript output (`lib/`) with bare imports and no browser bundle. `obr-sdk.js` is that `lib/` bundled once with esbuild
  (`esbuild lib/index.js --bundle --format=esm --minify`), which inlines its dependencies `events` (MIT), `immer` (MIT), `js-base64` (BSD-3-Clause) and `uuid` (MIT).
  This is a one-off vendoring step; the site itself has no build step.
- Use: `import OBR from "./vendor/obr-sdk.js"`.
