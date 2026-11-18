# KI-Log – Wie diese Seite entstand

Pro Session: was gebaut wurde, was gut lief, was schwierig war und wo Kevin eingreifen musste.

---

## 2026-11-18 – Phase 0: Setup

**Gebaut**
- Projektgerüst mit Vite 8, React 19, TypeScript 6 (strict), React Three Fiber 9, drei, Rapier und Postprocessing. Alle Versionen sind exakt gepinnt und mindestens 14 Tage alt. Ermittelt habe ich sie per Skript aus den npm-Veröffentlichungsdaten.
- ESLint 10 (Flat Config) mit TypeScript-, React-Hooks- und React-Refresh-Regeln; `npm run typecheck` prüft App und Node-Skripte getrennt.
- Leere Platzhalter-Szene (Meer, Inselscheibe, Neonring) als Beweis, dass Rendering und Deployment funktionieren.
- `npm run screenshots`: Playwright startet `vite preview`, öffnet feste Kameraansichten (`?shot=<name>`), wartet auf `window.__sceneReady` und speichert PNGs nach `docs/screenshots/`.
- GitHub-Actions-Workflow: Typecheck, Lint, Build und Deployment auf GitHub Pages bei jedem Push auf `main`.

**Gut gelaufen**
- Versionswahl per Skript statt aus dem Gedächtnis. Dabei fiel ein Konflikt auf: `typescript-eslint` unterstützt nur TypeScript < 6.1, deshalb ist TS 6.0.3 gepinnt statt 7.0.
- Typecheck, Lint und Build liefen nach einem kleinen Typfehler im Screenshot-Skript fehlerfrei.

**Schwierig**
- Git war nicht installiert. Ich habe es mit Kevins Zustimmung per `winget` nachinstalliert.
- Der Rechner hat keine echte Grafikkarte (nur Basic Display Adapter bzw. Parsec/Remote). Headless Chromium rendert deshalb per Software. Für Phase 0 reicht das, für Performance-Messungen und Stil-Screenshots ab Phase 4 nicht.
- `npm audit` meldet ReDoS-Lücken in `picomatch`/`minimatch`. Die stecken nur in Build-Werkzeugen (Vite, ESLint) und landen nicht im Browser-Bundle. Für `picomatch` gibt es noch keinen Patch, für `minimatch` nur über einen Major-Sprung. Ich habe sie bewusst akzeptiert und behalte sie im Blick.

**Kevin musste eingreifen**
- Git-Installation freigeben, Commit-Identität festlegen, beim ersten Push bei GitHub anmelden.
