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
- Git-Installation freigeben, Commit-Identität festlegen (GitHub-noreply-Adresse).
- Beim ersten Push im Browser bei GitHub anmelden. Aus Claudes nicht interaktiver Shell geht das nicht, deshalb lief der Push im Terminal-Panel. Der erste Versuch scheiterte, beim zweiten klappte es.

**Abnahme Phase 0**
- Workflow „Deploy to GitHub Pages“ lief grün (Typecheck, Lint, Build, Deploy).
- https://revkin.github.io/portfolio-insel/ zeigt die Platzhalter-Szene ohne Konsolenfehler.

---

## 2026-11-18 – Phase 1: Graybox

**Gebaut**
- Datenmodell nach SPEC (`Project`, `Localized`), 5 deutlich markierte Platzhalter-Projekte, eigenes kleines i18n (DE/EN, typgeprüft: jeder Schlüssel muss in beiden Sprachen existieren). Startsprache aus `?lang=` oder Browsersprache.
- Prozedurales Gelände (260 × 210 m Raster, 1 m Auflösung): Strand im Süden, Hügel mit Windmühle im Norden, erhöhter Fels im Westen, Pfad wird ins Gelände eingeebnet, Bachbett ausgehoben (Wasser fließt nur bergab), Holzbrücke an der Kreuzung, Platzhalter für Haus, Windmühle und Skyline. Physik und Optik nutzen dasselbe Höhenraster (Rapier-Trimesh).
- Kapsel-Spieler mit kinematischem Rapier-Character-Controller (Autostep, Hangbegrenzung), WASD relativ zur Kamera, Springen, Third-Person-Kamera mit Pointer Lock und Mausrad-Abstand, Kamera bleibt über dem Gelände. Vorläufige Grenze: kein Laufen in tiefes Wasser (Schwimmen folgt in Phase 2).
- Portale werden automatisch aus `projects.ts` erzeugt und gleichmäßig, abwechselnd links/rechts entlang des Pfads verteilt (Abstand zur Brücke wird eingehalten). Unter 3 m erscheint „E – Öffnen“, E öffnet das Overlay, Esc oder Button schließt es, Bewegung pausiert solange.
- Overlay rechts mit Titel, Medien-Platzhalter, Beschreibung, Rolle, Zeitraum, Tags und (falls vorhanden) GitHub/Live-Demo-Buttons. Schrift Saira selbst gehostet über `@fontsource`.
- `npm run test:smoke`: Playwright-Test, der wirklich spielt – laufen, seitlich gehen, springen, den ganzen Pfad vom Strand bis zum Haus ablaufen, jedes Portal anlaufen, Overlay öffnen, Sprache wechseln, schließen.
- Screenshots: `overview`, `gameplay`, `portal`, `overlay`.

**Gut gelaufen**
- Der Pfad-Lauftest fand sofort einen echten Fehler: An der Brücke blieb man hängen, weil das Deck kürzer war als die ausgehobene Bachrinne (Stufe ~0,6 m > 0,45 m Autostep). Brücke jetzt über die ganze Rinne.
- Ein gemeinsames Höhenraster für Physik, Optik, Kamera und Portale vermeidet Abweichungen zwischen sichtbarem und begehbarem Boden.

**Schwierig**
- Widerspruch in der SPEC: Der Bach soll „von West nach Ost“ fließen, aber im Westen über die Klippe ins Meer fallen. Umgesetzt wie in den Referenzbildern: Quelle im Osten, Wasserfall an der Westklippe.
- Der Test-Browser läuft per Software-Rendering mit ca. 22 fps. Feste Wartezeiten im Test waren deshalb zu knapp. Jetzt wartet der Test auf Zustände statt auf Zeiten.
- Rapier bringt seine Physik als eingebettetes WASM mit (~2 MB). Das Bundle ist damit 1,2 MB gzip groß, liegt aber weit unter dem Ladebudget. Code-Splitting folgt in Phase 10.

**Kevin musste eingreifen**
- Nichts in dieser Phase.
