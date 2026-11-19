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

**Kevins Feedback zur Graybox**
- „Funktioniert alles super“, nur ein Sprint fehlte. Der kommt mit Phase 2.
- Bestätigt: Claude Code läuft in einer VM ohne Grafikkarte. Kevin prüft Optik und Performance auf seinem eigenen Rechner und kann ab Phase 4 Screenshots beisteuern.

---

## 2026-11-18 – Phase 2: Bewegung

**Gebaut**
- Eigene Zustandsmaschine `player/locomotion.ts` mit den Modi Boden, Luft, Gleiten, Schwimmen, Klettern und Hochziehen. Grundlage ist weiterhin der kinematische Character Controller von Rapier.
- **Sprint und Ausdauer:** Shift sprintet (8 statt 4,5 m/s). Sprint, Klettern, Klettersprung und schnelles Schwimmen verbrauchen Ausdauer, die sich nur am Boden regeneriert. Ist sie leer, ist man erschöpft und kann erst ab 30 % wieder sprinten. Die schlanke Ausdauerleiste erscheint nur bei Verbrauch.
- **Schwimmen:** Ab ausreichender Wassertiefe treibt man an der Oberfläche, mit Shift schneller. Eine weiche unsichtbare Grenze kurz hinter der Küste führt sanft zurück.
- **Gleiten:** Leertaste in der Luft öffnet den Gleiter, erneut gedrückt schließt sie ihn. Man gleitet mit etwa 8,5 m/s vorwärts, sinkt nur langsam und lenkt mit WASD. Der Gleiter ist vorerst ein Platzhalter-Dreieck mit Neon-Kanten.
- **Klettern:** Läuft man gegen einen steilen, als kletterbar markierten Hang, beginnt das Klettern. W/A/S/D bewegen entlang der Wand, Leertaste macht einen Klettersprung, S + Leertaste stößt von der Wand ab. Oben zieht man sich über die Kante hoch. Bei leerer Ausdauer fällt man und kann sich erst nach der Landung wieder festhalten.
- Neuer Tafelfels im Westen (9 m hoch, steile Wände, flaches Plateau) zum Klettern und Abgleiten.
- **Kamera-Kollision:** Ein Strahl vom Kopf zur Kamera holt die Kamera sofort heran, wenn etwas im Weg ist, und lässt sie danach sanft wieder zurückfahren.
- Smoke-Test um 27 Bewegungsprüfungen erweitert. Gemessen wird in Spielzeit statt Echtzeit.

**Gut gelaufen**
- Die detaillierten Protokolle pro Bild haben echte Fehler schnell sichtbar gemacht:
  - Die Korrektur, die die Kapsel an die Wand heranzieht, wirkte entlang der schrägen Wandnormale und drückte sie dadurch nach unten. Am Wandfuß blieb die Kapsel deshalb fast stehen. Jetzt wirkt die Korrektur nur waagerecht.
  - Im Klettermodus hält der Character Controller die Wand selbst für „Boden“, weil er dort auf 89° eingestellt ist. S schaltete deshalb sofort aufs Laufen um. Jetzt erkennt ein Strahl nach unten, ob man wirklich unten angekommen ist.
  - Der Schwimmer schleifte über flache Sandbänke. Ob man schwimmt, richtet sich jetzt nach der Wassertiefe bis zum Grund statt nach der Tiefe an den Füßen.

**Schwierig**
- Software-Rendering in der VM: Die Bildrate schwankt je nach Blickwinkel stark. Weil das Spiel pro Bild höchstens 1/20 s rechnet, läuft dann alles in Zeitlupe. Tests mit Echtzeit-Messungen waren deshalb unzuverlässig. Lösung: ein Spielzeit-Zähler in der Debug-Schnittstelle, und alle Tests messen in Spielzeit.
- Mehrere fehlgeschlagene Tests lagen am Testszenario, nicht am Spiel:
  - Der Startpunkt westlich des Felsens lag schon an der Meeresklippe.
  - Direkt an der Kante löst die Leertaste den Coyote-Sprung aus, nicht den Gleiter.
  - Ein sehr kurzer Sturz fiel zwischen zwei Abfragen des Tests durch.

**Kevin musste eingreifen**
- Nichts in dieser Phase.

**Kevins Feedback zu Phase 2**
- „Alles funktioniert sehr gut.“

---

## 2026-11-19 – Phase 3: Charakter

**Gebaut**
- Die kostenlosen CC0-Pakete *Universal Base Characters* und *Universal Animation Library* von Quaternius über itch.io heruntergeladen (mit Kevins Freigabe). Sie liegen außerhalb des Repos, im Repo landen nur die erzeugten Dateien.
- Build-Skript `npm run assets:character` (gltf-transform, sharp, meshoptimizer):
  - **Figur:** Basisfigur plus Frisur. Die Kleidung (Jacke, Hose, Stiefel) wird per Bone-Gewichten erkannt und in die Textur gemalt: Jedes Dreieck wird in den UV-Raum gerastert, und die T-Pose-Position jedes Pixels steuert auch die Leuchtnähte als Emissive-Maske. Texturen sind 1024 px WebP, die Geometrie ist mit meshopt komprimiert. Ergebnis: 0,5 MB.
  - **Animationen:** 9 von 43 Clips, nur Rotationen plus an die Figur angepasste Beckenposition. So bleiben die Proportionen der Figur erhalten. Ergebnis: 0,27 MB.
- Charakter im Spiel:
  - Weiches Überblenden zwischen Idle, Gehen, Joggen, Sprint, Sprung, Fallen, Landen, Schwimmen und Wassertreten. Das Abspieltempo richtet sich nach der Geschwindigkeit.
  - Rucksack, Jackenkragen, Cargo-Taschen und Stiefel sind eigene Meshes an den Knochen. Die Haare sind dunkelbraun eingefärbt, der Kopf etwas vergrößert (wirkt jünger).
- **Fehlende Animationen im Code** (Klettern, Hängepose am Gleiter, Hochziehen): Arme und Beine werden auf Zielrichtungen im Charakterraum ausgerichtet („aim“). Das funktioniert unabhängig von den Knochenachsen des Rigs. Der Kletterzyklus läuft mit der geklommenen Strecke mit.
- **Schwimmen:** Die Swim-Clips sind auf unterschiedlichen Höhen animiert. Eine automatische Anhebung hält beim Schwimmen den Brustkorb und beim Wassertreten den Kopf an der Wasseroberfläche.
- **Gleiter-Modell:** Deltaflügel mit Rahmen, Steuerbügel und Neon-Kanten (vorn Cyan, hinten Magenta).
- **Neue Screenshots:**
  - `char-*`: Nahaufnahmen mit erzwungenem Animationszustand.
  - `npm run screenshots:action`: Aufnahmen aus der echten Spielkamera beim Klettern, Hochziehen, Gleiten, Schwimmen, Sprinten und Springen.

**Gut gelaufen**
- Das Skelett der Figur und das der Animationen sind identisch (65 Knochen). Die Clips passen direkt.
- Die „Aim“-Posen funktionierten auf Anhieb ohne Wissen über Knochenachsen.
- Die Screenshots aus der Spielkamera haben Fehler sofort sichtbar gemacht. Zum Beispiel lag der Schwimmer unsichtbar unter der Wasseroberfläche.

**Schwierig**
- Die kostenlose Standard-Version der Basisfiguren enthält nur die muskulösen „Superhero“-Proportionen. Die Teen-Figur, die besser zum Sheet passen würde, gibt es nur im kostenpflichtigen Source-Paket. Ausgleich: Kleidung, größerer Kopf, etwas kleinere Gesamtgröße, abgeschwächte Muskel-Normal-Map.
- In der Character-glTF verweisen zwei Bild-Pfade auf nicht vorhandene Dateien (`*_png.png`). Der Lesecode fängt das ab.
- gltf-transform: Nach dem Entfernen von 34 Animationen blieben deren Keyframe-Daten in der Datei, weil Sampler bei `Animation.dispose()` erhalten bleiben. Die Datei war dadurch 2,7 statt 0,27 MB groß. Jetzt werden Sampler und Kanäle ausdrücklich mit entfernt.
- Gleiter-Tests waren zeitabhängig: Je nach Bildrate traf die Leertaste den Boden, also einen Sprung, statt die Luft. Eine zustandsbasierte Testhilfe drückt jetzt nur, wenn die Figur hoch genug in der Luft ist.

**Kevin musste eingreifen**
- Download der beiden Quaternius-Pakete freigeben.
