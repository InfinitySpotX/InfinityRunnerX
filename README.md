# InfinityRunnerX
# 🌆 NEON DRIFT — Endless Runner

A premium, glassmorphic, neon-cyberpunk endless runner built with plain HTML, CSS & JS. No build step, no dependencies except Google Fonts — works straight out of a GitHub Pages deploy.

## Features
- Loading screen shown once per page load; only a refresh brings it back
- Glass/neon home menu → **Start Game**, **Shop**, **Settings**
- Shop with **Skins**, **Themes**, and **Character Trails** — unlocked automatically as your best score grows, selections persist and show up in-game
- Settings: swipe sensitivity slider, sound toggle, "How to Play"
- 3-lane swipe runner (left/right), red blocks end the run
- Coins (+15 score), **Shield** power-up (glowing one-hit protection), **Magnet** power-up (auto-collects nearby coins)
- Procedurally generated background music & SFX (Web Audio API — no external audio files, zero licensing concerns)
- Phone vibration on crash (where supported)
- Max score saved in `localStorage`
- Animated glass score box on home, HUD, and game-over screens
- Game over screen with **Retry** and **Menu**

## File structure
```
neon-drift/
├── index.html   → screens & structure
├── style.css    → glass/neon design system
├── game.js      → all game logic (organised into numbered sections)
└── README.md
```

## Run locally
Just open `index.html` in a browser — or serve it (recommended, so audio/vibration behave like a real deploy):
```bash
npx serve .
# or
python3 -m http.server 8000
```

## Deploy to GitHub Pages
1. Create a new repo on GitHub and push these files:
   ```bash
   git init
   git add .
   git commit -m "Neon Drift v1"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Source → Deploy from branch → `main` / root**.
3. Wait a minute, then your game is live at:
   `https://<your-username>.github.io/<repo-name>/`

## Extending it (built to be easy to grow)
- **Add a skin/theme/trail:** open `game.js`, find the `CATALOG` object near the top, and add a new entry with an `id`, `name`, and `unlockScore`. It appears in the Shop automatically — no other code changes needed.
- **Tune difficulty:** adjust `baseSpeed`, `spawnInterval`, or the ramp multipliers inside `update()` in `game.js`.
- **New power-up:** add a case in `spawnEntity()`'s type roll, draw it in `drawEntity()`, and handle it in `handleCollision()`.

Enjoy, and have fun tuning it further! 🚀
