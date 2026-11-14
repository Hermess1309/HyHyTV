# tv-ui reference review

Reviewed on 2026-11-14, commit `689af51da5f657af5a83acd323b615e266f735c2`.

Source: https://github.com/jposn3r/tv-ui

Read README, `src/engine/FocusEngine.ts`, `InputManager.ts`, `ScrollEngine.ts`, `components/HeroBanner.tsx`, and `ContentRow.tsx`.

The repository tree did not contain a LICENSE or COPYING file. Public visibility does not grant permission to redistribute its code. HyHyTv contains an independent Kotlin implementation and no copied React/TypeScript, visual assets, trademarks, or source files from tv-ui. Reference snapshots are excluded from the deliverable archive.

Design observations translated into native APIs:

| Observation | HyHyTv implementation |
| --- | --- |
| Row/column navigation and row memory | Compose focus groups, per-row slug memory, FocusRequester, stable lazy keys |
| Explicit input actions | Android D-pad focus dispatch, BackHandler, Media3 remote key handling |
| Large hero with readable left/bottom gradients | Compose image with horizontal/vertical gradient layers and crossfade |
| Parallax and focus scaling | Small native graphicsLayer translation and animated poster scale; reduced-motion setting |
| Only visible rows/cards rendered | LazyColumn, LazyRow, LazyVerticalGrid; no custom renderer |
| Cached content and artwork | Bounded in-flight request cache, OkHttp disk cache, Coil memory/disk cache |

Native focus traversal owns direction calculations and key repeat. HyHyTv does not port the reference engine or its JavaScript scrolling system.
