# Jovan Prodanov / wrathchild14

A static portfolio for games, graphics, and machine learning projects. D00M: Rip & Off is the featured browser game, with optional installation and offline play.

## Preview the whole site

```sh
python3 scripts/preview.py
```

Open http://127.0.0.1:8081/. The preview server binds only to localhost and serves public portfolio/game files, excluding hidden paths, repository metadata, tests, and scripts. Use `--port 8082` if the default port is occupied.

The homepage is `index.html` + `styles.css`. It requires no JavaScript. Project links preserve the existing GitHub destinations. The game lives under `doom/`; see [its architecture and controls](doom/README.md).

## Installable game

`doom/manifest.webmanifest` defines the standalone application, icons, and launch shortcut. Installation is optional and browser-dependent. Visitors can use the install section on the game's briefing page or the browser's own install action. The game still requires a desktop keyboard and mouse.

The game caches its full package, including music, when first opened online. Wait for **Ready for offline play** before disconnecting. Storage can be evicted or cleared by the browser; revisit online to restore it.

The service worker is scoped to `doom/`; it does not cache or intercept the portfolio or other projects. Updates wait for existing game tabs/windows to close, preserving a consistent set of files during a run.

Before publishing changes to game assets:

```sh
node doom/scripts/update-offline.mjs
node --test doom/tests/*.test.mjs
```

The generated `doom/offline-assets.js` is committed alongside source. Its content hash changes whenever game assets or service-worker behavior change. The offline tests reject stale generated manifests.

No build step is needed for GitHub Pages. Publish the repository's static files as usual; HTTPS is required for installation/offline features outside localhost. The source changes in this task do not publish themselves.

## Shader controls

**Ember FX** in the pause menu enables the game's animated lava, warm bloom, subtle heat shimmer, and color grading. Turn it off for the original rendering path. Reduced-motion preferences suppress animated distortion, moving grain, and lava flow. Post-processing uses half-resolution glow buffers and releases old GPU targets when resized.

The rendering pipeline is documented in [doom/README.md](doom/README.md).

## Verification

- Gameplay tests exercise combat, movement, waves, rewards, and state transitions.
- Offline tests verify complete caching, interrupted downloads, scoped requests, safe cache cleanup, audio byte ranges, release hashes, and icon dimensions.
- Browser verification covered the portfolio → install → game flow, offline readiness, shader rendering, and reloading the arena with the preview server stopped.
- Native OS installation is left to the visitor's browser confirmation. The embedded preview browser may not offer it.

Implementation references: [MDN installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [web.dev install prompts](https://web.dev/learn/pwa/installation-prompt), and [MDN service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).
