# Portfolio-Insel – Arbeitsanweisungen für Claude Code

Begehbare 3D-Portfolio-Webseite von Kevin: eine Insel im Mix aus Fantasy-Open-World und Cyberpunk. Ein Pfad führt an Neon-Portalen vorbei, jedes Portal öffnet ein Overlay mit einem Projekt. Die vollständige Spezifikation steht in `docs/SPEC.md` – vor jeder größeren Aufgabe lesen.

## Ziel und Rollen
- Zwei Ziele: (1) öffentliche Portfolio-Seite für Bewerbungen, (2) Experiment, wie weit man mit KI kommt.
- Claude baut praktisch alles selbst. Kevin testet im Browser, gibt Feedback und erledigt nur Dinge, die ein Mensch tun muss (Accounts, Logins, Asset-Downloads hinter Login, Freigaben).
- Wenn etwas nur Kevin erledigen kann, klar und kurz sagen, was genau zu tun ist, und mit anderen Aufgaben weitermachen.

## Arbeitsweise
- Phasenweise nach der Roadmap in `docs/SPEC.md` arbeiten. Eine Phase gilt erst als fertig, wenn ihre Abnahmekriterien erfüllt sind, `npm run build` und `npm run typecheck` fehlerfrei laufen und der Stand deployed ist.
- Nach jeder Phase: kurze Zusammenfassung für Kevin (was ist neu, was soll er im Browser prüfen, offene Fragen).
- Visuelle Kontrolle: Screenshots per Playwright (headless Chromium) aus festen Kamerapositionen erstellen und mit den Referenzbildern in `docs/reference/` vergleichen. Das ersetzt nicht Kevins Feedback zum Spielgefühl.
- Kleine, thematische Commits mit aussagekräftigen Nachrichten auf Deutsch oder Englisch (einheitlich bleiben).
- KI-Log führen: In `docs/ai-log.md` pro Session kurz festhalten, was gebaut wurde, was gut lief, was schwierig war und wo Kevin eingreifen musste. Das wird später Inhalt eines eigenen Portals („Wie diese Seite entstand“).
- Keine Aufgabe als erledigt melden, die nicht getestet ist. Bei Unsicherheit lieber nachfragen als raten.

## Stack
- Vite + React + TypeScript (strict)
- React Three Fiber, `@react-three/drei`, `@react-three/rapier` (Physik), `@react-three/postprocessing` (Bloom, Farbkorrektur)
- `zustand` für Spielzustand, eigenes schlankes i18n (DE/EN) oder `i18next`
- Schriften selbst hosten über `@fontsource/*` (keine Einbindung von Google-Fonts-Servern, DSGVO)
- Abhängigkeiten auf exakte, stabile Versionen pinnen, die mindestens zwei Wochen alt sind

## Befehle
- `npm run dev` – Entwicklungsserver
- `npm run build` – Produktions-Build
- `npm run preview` – Build lokal ansehen
- `npm run typecheck` – `tsc --noEmit`
- `npm run lint` – ESLint
- `npm run screenshots` – Playwright-Skript, das Referenzansichten (Tag, Dämmerung, Nacht, Portal nah, Overlay offen, Startscreen) nach `docs/screenshots/` rendert

## Projektstruktur
```
src/
  content/       Projektdaten (projects.ts) und UI-Texte (i18n)
  world/         Gelände, Pfad, Bach, Wasser, Vegetation, Gebäude, Skyline, Himmel
  portals/       Portal-Modell, Hologramm-Shader, Öffnungsanimation
  player/        Controller, Bewegungszustände, Kamera, Animationen
  systems/       Tag-Nacht, Audio, Interaktion, Qualitätsstufen, Eingabe
  ui/            Startscreen, HUD (Minimap, Ausdauer, Sprache), Overlay, Einstellungen
  fallback/      Klassische 2D-Ansicht (gleiche Projektdaten)
public/assets/   Modelle (glTF), Texturen (KTX2), Audio (OGG/MP3)
docs/            SPEC.md, reference/, screenshots/, ai-log.md
CREDITS.md       Lizenznachweis für jedes fremde Asset
```

## Feste Regeln
- Projekte sind datengetrieben: Portale entstehen automatisch aus `src/content/projects.ts`. Neue Projekte dürfen nie Code-Änderungen an der Welt erfordern.
- Nur CC0-Assets verwenden (das Repo ist öffentlich). Kein Mixamo, keine CC-BY-, Pixabay- oder sonstigen Lizenzen ohne Rückfrage bei Kevin. Jedes fremde Asset sofort in `CREDITS.md` eintragen: Name, Quelle, Link, Lizenz, Autor.
- Ausgangspunkt für Assets ist `docs/assets/` (Recherche-Tabellen, offene Punkte, Download-Skript). Nur die tatsächlich genutzten Dateien ins Repo übernehmen, nicht ganze Pakete.
- Keine Assets, Namen oder Figuren aus bestehenden Spielen oder Filmen.
- Performance-Budget einhalten (siehe SPEC): Assets komprimieren (glTF mit Draco oder meshopt, Texturen als KTX2), Vegetation instanzieren, wenige echte Lichtquellen.
- Alle sichtbaren Texte über i18n, nie hart codiert.
- Keine Cookies, kein Tracking, keine externen Requests zur Laufzeit.
- Inhalte zu Kevins Projekten nicht erfinden. Bis Kevin echte Inhalte liefert, deutlich erkennbare Platzhalter verwenden.
