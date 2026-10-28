# D00M: Rip & Off

A fast, low-poly survival shooter using Jovan Prodanov's original arena, textures, and soundtrack. Vanilla JavaScript modules, HTML, CSS, and WebGL 2. No framework, build step, or runtime package installation.

## Run it

From the repository root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory doom
```

Open http://127.0.0.1:8080/. The existing `/doom/` GitHub Pages route also works. Use a desktop keyboard and mouse with a WebGL 2 browser.

## Controls

| Input              | Action                                                         |
| ------------------ | -------------------------------------------------------------- |
| WASD               | Move; running is the default                                   |
| Mouse / left click | Aim / fire; hold to keep firing                                |
| Shift or Space     | Dash in the movement direction, or forward when standing still |
| F or E             | Melee; automatically finish a staggered enemy in reach         |
| Q                  | Activate berserk when rage is full                             |
| 1 / 2              | Pulse rifle / scattergun                                       |
| R                  | Reload; melee can interrupt a reload                           |
| Esc or P           | Pause                                                          |

If mouse capture is unavailable, choose **Play in windowed mode**. Right-drag or arrow keys aim. Pause, lost focus, and hidden tabs freeze the simulation and clear held input.

## Combat loop

- **Jab → cross → crush:** tap melee again within 0.85 seconds of a successful hit to continue the chain. The third hit cleaves nearby enemies in front of you. A miss or expired window resets the chain.
- **Stagger → finisher:** enemies below 30% health glow gold and stop attacking for three seconds. Get within reach, face them, and press F. A finisher grants up to 30 health, full magazines, one dash charge, and a short damage grace period. The HUD shows a prompt only when the target is reachable and unobstructed.
- **Dash:** two charges, 1.3 seconds to recharge each. A dash grants brief damage immunity. Walls still block it.
- **Berserk:** kills build rage; melee kills and finishers build it faster. At 100%, press Q for seven seconds of double melee damage, faster movement, and an immediate dash refill. Rage does not refill while berserk is active.
- **Stay aggressive:** melee kills recover 10 health, every fourth kill drops a health orb, and a cleared wave restores 15 health. Kills within four seconds build a score multiplier up to 4×. Melee and finishers award extra score.
- **Read the enemy:** hunters pursue, casters strafe and throw fireballs, and brutes begin appearing in wave two. A brute glows red before charging in a fixed direction; dash sideways to evade it.

Score records use a new local storage key for this ruleset so scores from the previous balance are not mixed in.

## Architecture

The boundary is simple: **simulation decides what happens; presentation shows it.** No entity framework, event bus, service locator, or build system.

| File                | Owns                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `game/game.js`      | Four-line browser entry point                                        |
| `game/Game.js`      | Loading, browser lifecycle, pause/resume, frame loop, saving records |
| `game/Run.js`       | One run's state, update order, damage, scoring, rewards, and pickups |
| `game/Player.js`    | Position, aiming, movement, dash, and berserk                        |
| `game/Combat.js`    | Guns, reloads, melee chains, stagger, and finishers                  |
| `game/Enemies.js`   | Enemy creation, waves, AI, charges, and projectiles                  |
| `game/collision.js` | Pure geometry helpers: rays, sight, and swept movement               |
| `game/config.js`    | Named tuning values for player, weapons, melee, enemies, and waves   |
| `game/Input.js`     | Browser events → one input snapshot per frame                        |
| `game/Arena.js`     | Original glTF assets and world-space collision bounds                |
| `game/View.js`      | Camera, entity meshes, particles, gun/fist animation, and rendering  |
| `game/Hud.js`       | HUD, menus, ability meters, finisher prompt, and results             |
| `game/Audio.js`     | Music and short synthesized sound effects                            |
| `game/engine/`      | The existing reusable glTF loader, scene graph, and WebGL renderer   |

`Run`, `Player`, `Combat`, `Enemies`, and `collision` have no DOM, WebGL, audio, or glMatrix dependency. Entities are plain objects. A new run is a new `Run` instance, so restart cannot inherit old cooldowns or projectiles.

Each frame follows this path:

1. `Input.read()` collects held controls and consumes discrete actions.
2. `Game` divides the elapsed time into steps of at most 1/120 second. Mouse deltas and discrete actions apply only on the first step.
3. `Run.update()` handles aiming/actions, player movement, combat, enemies, and pickups.
4. `Run.drainEvents()` returns plain event objects such as `shot`, `melee`, and `finisher`. `View` and `Audio` consume them once.
5. `View` draws the current simulation; `Hud` updates changed text and meters.

To adjust weapon feel, edit `config.js`. To change melee rules, edit `Combat.js`. To change presentation, edit `View.js` or the stylesheets. Do not put DOM calls into the simulation.

The shared palette and button rules live in `common/theme.css`. The landing page and game each have their own stylesheet. Source is formatted with four-space indentation and a 100-column target; vendored libraries under `lib/` remain untouched.

## Checks

With Node.js 22 or later, from the repository root:

```sh
node --test doom/tests/*.test.mjs
```

Or run `npm test` inside `doom/`; no install is needed. Tests exercise gameplay directly, without fake browser globals or GPU setup.

Optional source formatting uses the pinned formatter version:

```sh
cd doom
npx --yes prettier@3.6.2 --write 'game/**/*.{js,html,css}' 'tests/*.mjs' index.html index.css common/theme.css
```

Manual checks: deploy, fire both weapons, reload, dash twice, land a melee chain, stagger and finish an enemy, activate berserk, pause/resume, lose focus, die, and restart. Check the windowed fallback when mouse capture is unavailable.

## Deliberate limits

The original irregular rocks use conservative bounding boxes. Enemy steering is local pursuit and obstacle sliding, not a navigation mesh. Rendering honors reduced-motion preferences by disabling dash field-of-view changes, weapon bob, and finisher screen flashes. The game is designed for desktop controls; touch controls are not implemented.

## Install and play offline

The briefing page includes an install section. In browsers that expose an installation prompt, its button opens that prompt. Otherwise it shows browser-specific guidance. Installation launches the same game in a standalone window; it does not add mobile controls.

`install.js` registers `sw.js` from both the briefing and arena pages. The worker precaches the complete release before reporting readiness, including all imported JavaScript modules, textures, the model, and the soundtrack. Cached audio supports byte-range requests. It never forces a new worker to replace the one serving a live run.

After changing anything included in the offline package, regenerate the asset list **after formatting**:

```sh
node doom/scripts/update-offline.mjs
node --test doom/tests/*.test.mjs
```

`offline-assets.js` is generated from actual files and includes a content hash. Tests verify that it matches the current files and includes model and module dependencies. Updates apply after all game windows/tabs are closed. The portfolio is outside the worker's scope.

## Ember shader pipeline

`engine/PostProcessing.js` owns the render targets and pass ordering. `engine/postShaders.js` contains the GLSL, keeping shader tuning separate from GPU setup.

1. Draw the world and held weapon into an RGBA8 scene texture with a depth buffer.
2. Extract bright, warm surfaces and blur them horizontally into a half-resolution target.
3. Blur vertically into a second half-resolution target.
4. Composite the original scene with warm bloom, teal shadow grading, soft highlight compression, vignette, fine grain, and heat-source-localized distortion. The DOM HUD is drawn above the result and remains sharp.

The composite also adds horizontal ember-light streaks, peripheral dash trails with a cool tint and chromatic separation, expanding amber finisher shockwaves, and a flowing berserk aura. Combat effects use the current dash and presentation feedback timers, so they pause and reset with the run. The center stays clear for aiming. These effects share the existing composite pass and require no additional render targets; dash trail samples run only during a dash. Reduced motion disables trails, shockwaves, and color separation, and freezes the aura.

The material shader in `engine/shaders.js` also gives lava textures gentle UV flow and pulsing emissive veins. This is enabled only for the actual lava material, so enemy faces and UI are not distorted.

Combat materials add animated plasma veins to fireballs, muzzle flashes, and sparks. Fireballs have three tapered trailing embers (capped at 24 projectile trails), and firing briefly lights the held weapon. Kills leave a visual-only copy of the enemy that dissolves through glowing burn edges over 0.65 seconds; at most 24 copies exist, with no collision or gameplay state. Reduced motion freezes plasma flow and disables the additional trails, weapon illumination/enlargement, and death dissolves. Ember FX switches all these additions off. Restart clears transient effects.

The **Ember FX** checkbox bypasses the post-processing and animated material effects. Reduced-motion preferences freeze shader time and disable animated distortion/grain. The pipeline uses standard WebGL 2 RGBA8 targets without requiring floating-point framebuffer extensions. Old targets are deleted on resize, and unavailable targets fall back to the original renderer.
