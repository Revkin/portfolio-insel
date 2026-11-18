# Spezifikation – Portfolio-Insel

## 1. Konzept
Eine kleine Insel im Meer, frei begehbar. Ein Pfad führt vom Strand über eine Brücke bis zu einem Haus auf dem Hügel. Entlang des Pfads stehen Neon-Portale, jedes steht für ein Projekt. Tagsüber wirkt die Insel wie eine ruhige, natürliche Fantasy-Landschaft. Bei Dämmerung „erwacht“ die Technik: Lichtstreifen, Portale, Hologramme und die Skyline am Horizont gehen nacheinander an. Nachts dominiert Neon.

Zielgruppe: Recruiter, Hochschulen, Interessierte. Die Seite muss auch ohne Spielerfahrung schnell verständlich sein, deshalb gibt es immer eine klassische 2D-Ansicht als Alternative.

## 2. Referenzbilder
Kevin legt die Bilder unter `docs/reference/` ab. Sie definieren Stil, Licht und Stimmung, nicht die exakte Geometrie. Die Inselform und die Portale variieren zwischen den Bildern – verbindlich ist diese Spezifikation.

| Datei | Zeigt | Verbindlich für |
|---|---|---|
| `01-overview-day.png` | Insel von oben, Tag, Cyberpunk-Mix | Gesamtlayout, Tageslicht, Skyline im Dunst |
| `02-overview-night.png` | Insel von oben, Nacht | Neon-Farben, nasse Spiegelungen, Nachtstimmung |
| `03-gameplay-view.png` | Spielkamera hinter dem Charakter | Kameraabstand, Vordergrund-Detail, Nachmittagslicht |
| `04-portal-closeup-night.png` | Portal nah, nachts | **Portal-Design**, Hologramm, Interaktionshinweis |
| `05-overlay-ui.png` | Overlay, Minimap, HUD | **UI-Stil** (das runde Wirbel-Portal im Bild ist NICHT das Portal-Design) |
| `06-character-sheet.png` | Charakter in fünf Posen | **Charakter-Stil** und Gleiter |
| `07-dusk-awakening.png` | Dämmerung, Neon geht an | Übergang Tag → Nacht |
| `08-start-screen.png` | Startbildschirm | Startscreen-Layout |

## 3. Visueller Stil
- **Richtung:** stilisierter Realismus. Physikalisch basierte Materialien, realistisches Licht, Fototexturen, aber leicht vereinfachte Formen und kräftigere Farben als die Realität. Kein Flat-Low-Poly, kein Fotorealismus.
- **Natur:** dichtes, unregelmäßiges Gras mit Farbverlauf und Wind, Moos in Felsspalten, verwittertes Holz, Kopfstein- und Erdpfad mit flachen Steinen.
- **Technik:** wächst in die Natur hinein. Kabel entlang der Zaunpfosten, Lichtstreifen an den Pfadkanten, Portale mit Moos und Ranken, Antennen und Neonschilder am Haus, ein paar Drohnen.
- **Palette:**
  - Nachthimmel `#1B1F45`, tiefes Meer `#0E2A3A`
  - Neon-Cyan `#3EF2E6` (Hauptakzent, Pfad, UI)
  - Neon-Magenta `#FF3FB4`, Violett `#9B5CFF`, Amber `#FFB23E`, Lime `#9DFF4A` (Portalfarben)
  - Gras am Tag `#6E8F3A`, Pfadstein `#8A8278`
  - UI-Panel `rgba(10, 20, 30, 0.72)`, UI-Text `#E6FBFF`
- **Postprocessing:** Bloom (nur auf leuchtenden Materialien), leichte Farbkorrektur je Tageszeit, Vignette. Auf der Qualitätsstufe „Niedrig“ ohne Bloom.

## 4. Welt-Layout
Insel etwa 200 × 150 m, Pfadlänge etwa 250 m.

1. **Strand im Süden:** Startpunkt des Spielers, Steg mit Ruderboot an der Ostküste.
2. **Pfad:** Kopfstein und Erde mit Neon-Lichtstreifen an beiden Kanten, Zäune mit Kabeln abschnittsweise, Laternen.
3. **Bach:** fließt von West nach Ost quer über die Insel, mündet als kleiner Wasserfall über die Felsklippe ins Meer. Holzbrücke über den Bach auf dem Pfad.
4. **Felsklippe im Westen:** hoch genug zum Klettern und Abgleiten.
5. **Hügel im Norden:** Windmühle mit Neon-Kanten an den Flügeln.
6. **Haus am Pfadende:** warmes Licht in den Fenstern, Neonschilder, Antennen, Kisten und Fässer, Rauch aus dem Schornstein.
7. **Skyline:** futuristische Stadt im Nordwesten auf der anderen Seite des Meeres. Nur Hintergrund (nicht erreichbar), tagsüber im Dunst, nachts mit Neon-Fenstern.
8. **Unsichtbare Grenze:** Schwimmen nur bis kurz hinter die Küste, danach sanfte Rückführung.

Die Portale sind gleichmäßig entlang des Pfads verteilt. Ihre Positionen werden aus der Anzahl der Projekte berechnet (Start: 5 Platzhalter). Jedes Portal steht seitlich am Pfad und ist zum Pfad hin ausgerichtet.

## 5. Portale
Design nach `04-portal-closeup-night.png`:
- Eckiger, schwerer Rahmen aus verwittertem Beton und Metall, oben leicht abgeschrägt, mit Moos, Ranken und Kabeln am Sockel.
- Innen ein doppelter Neonrahmen in der Projektfarbe.
- Im geschlossenen Zustand ist die Innenfläche transparent mit leichtem Flimmern, man sieht die Landschaft dahinter.
- Daneben schwebt ein Hologramm-Bildschirm mit Projektvorschau (Bild oder Code-Ausschnitt), Scanlines und leichtem Flackern als Shader.
- Interaktion: Bei Annäherung (unter etwa 3 m) erscheint „E – Öffnen“ bzw. „E – Open“. Beim Öffnen leuchtet der Rahmen auf, die Innenfläche füllt sich mit hellem Licht, dann öffnet sich das Overlay.
- Tagsüber leuchten Portale nur schwach, ab der Dämmerung voll.
- Das Modell wird im Code aus Geometrie aufgebaut, mit PBR-Texturen für Beton, Metall und Moos. Falls ein passendes CC0-Modell existiert, darf es stattdessen verwendet werden.

## 6. Charakter
Stil nach `06-character-sheet.png`: junger Mensch, halbrealistisch-stilisiert, Techwear-Jacke mit leuchtenden Nähten, Cargo-Hose, Stiefel, kleiner Rucksack.
- **Lizenzregel:** ausschließlich CC0-Assets. **Kein Mixamo**, weil Adobes Bedingungen die freie Weitergabe der Rohdateien verbieten und das Repo öffentlich ist.
- **Quelle:** Quaternius „Universal Base Characters“ (CC0) als Basisfigur, Quaternius „Universal Animation Library“ (CC0) für die Animationen. Nur die benötigten Modelle und Clips ins Repo übernehmen, nicht das ganze Paket. Ziel ist die Richtung des Sheets, keine exakte Kopie.
- **Kleidung:** Die Basisfigur trägt schlichte Kleidung. Techwear-Look über Materialfarben (dunkles Grau, Schwarz), Rucksack als eigenes Mesh am Rücken-Knochen, Jackenkragen bzw. Taschen als einfache Zusatz-Meshes.
- **Leuchtnähte:** werden im Code als emissive Linien oder Masken ergänzt (Neon-Cyan).
- **Gleiter:** wird als eigenes Modell gebaut, Dreiecksflügel mit Neon-Kanten in Cyan und Magenta.
- **Animationen (Quaternius):**
  - Idle, Gehen, Rennen, Springen und Landen
  - Schwimmen an der Oberfläche
  - Gleiten (Hängepose)
  - Klettern in vier Richtungen, Hochziehen an der Kante
  - Fehlt ein Clip in der Bibliothek (wahrscheinlich bei Klettern und Gleiten), wird er im Code aus Knochenrotationen erzeugt (prozedurale Pose bzw. einfache Keyframes) oder aus einem vorhandenen Clip abgeleitet. Kein Blender.
  - Übergänge zwischen allen Animationen weich überblenden

## 7. Steuerung und Bewegung
| Eingabe | Aktion |
|---|---|
| WASD | Bewegen (relativ zur Kamera) |
| Maus | Kamera drehen (Pointer Lock nach Klick ins Spiel) |
| Mausrad | Kameraabstand |
| Shift | Sprinten (verbraucht Ausdauer) |
| Leertaste | Springen; in der Luft erneut: Gleiter öffnen/schließen |
| Gegen steile Felswand laufen | Klettern starten; Leertaste beim Klettern: Sprung nach oben |
| E | Portal öffnen / interagieren |
| Esc | Overlay schließen bzw. Pausemenü |

- **Ausdauer:** Sprinten, Klettern und schnelles Schwimmen verbrauchen sie, sie regeneriert sich am Boden. Bei 0 endet das Klettern und der Charakter fällt; im Wasser wird nur langsam geschwommen.
- **Kamera:** Third Person, Schulterhöhe wie in `03-gameplay-view.png`, Kollision mit Gelände und Objekten, sanftes Nachführen.
- **Physik:** Rapier mit kinematischem Character Controller. Kletterbare Flächen werden über Neigung und Material markiert.

## 8. Tag-Nacht-Zyklus
- Voller Zyklus etwa 12 Minuten: Tag 6, Dämmerung 1,5, Nacht 3,5, Morgen 1.
- Manueller Wechsel jederzeit in den Einstellungen.
- **Tag:** HDRI-Himmel bzw. physikalischer Himmel, Sonne mit Schatten, Dunst über dem Meer, Neon nur angedeutet.
- **Dämmerung („Erwachen“):** Sobald die Sonne unter den Horizont sinkt, schalten die Lichtstreifen in etwa 8 Sekunden vom Strand bis zum Haus nacheinander ein, danach die Portale und die Skyline.
- **Nacht:** Mond und Sterne, Neon voll aktiv mit Bloom, warmes Licht aus den Hausfenstern, Glühwürmchen und schwebende Lichtpartikel, leichter Nebel über dem Meer. Nasse Spiegelungen auf den Steinen werden über Material-Tricks gefälscht, nicht über echte Spiegelungen berechnet.

## 9. UI
Stil nach `05-overlay-ui.png` und `08-start-screen.png`: dunkles, leicht transparentes Glas-Panel, dünne Cyan-Kanten, abgeschrägte Ecken als Akzent, klare Lesbarkeit. Schrift: Saira (selbst gehostet), Überschriften in Saira Semi Condensed.

- **Startscreen:** unscharfe Insel nachts im Hintergrund, Titel „Kevin – Portfolio“, Buttons „Insel betreten“ und „Klassische Ansicht“, Sprachumschaltung. Der Klick auf „Insel betreten“ startet auch das Audio (Autoplay-Regeln der Browser).
- **Ladebildschirm:** Fortschrittsanzeige und Steuerungshinweise, Motiv der Dämmerung.
- **HUD:**
  - runde Minimap oben rechts mit Spielerpfeil, Pfad und farbigen Portal-Icons
  - schlanke Ausdauerleiste unten (nur sichtbar, wenn Ausdauer verbraucht wird)
  - Sprachumschaltung DE | EN oben links
- **Projekt-Overlay (rechte Bildschirmhälfte):**
  - Projekttitel, Bild- bzw. Video-Galerie, Beschreibung, eigene Rolle, Technologie-Tags
  - Buttons „GitHub“ und „Live-Demo“ (nur wenn vorhanden)
  - Schließen per Esc oder Button
  - Das Spiel pausiert die Bewegung, die Welt läuft im Hintergrund weiter
- **Einstellungen:**
  - Qualitätsstufe (Niedrig, Mittel, Hoch, Auto), Tageszeit, Mausempfindlichkeit
  - Lautstärke getrennt für Musik, Umgebung und Effekte
  - Steuerungsübersicht
- **Barrierefreiheit:** Alle UI-Elemente per Tastatur erreichbar, sichtbarer Fokus, `prefers-reduced-motion` reduziert Kamerabewegungen und Partikel.

## 10. Inhalte und Datenmodell
```ts
type Localized = { de: string; en: string };

interface Project {
  id: string;
  color: 'cyan' | 'magenta' | 'violet' | 'amber' | 'lime';
  title: Localized;
  summary: Localized;      // 1–2 Sätze, für Hologramm und 2D-Karte
  description: Localized;  // ausführlich, Markdown erlaubt
  role: Localized;         // was Kevin konkret gemacht hat
  period?: string;         // z. B. "2025"
  tags: string[];          // Technologien
  media: { type: 'image' | 'video'; src: string; alt: Localized }[];
  links?: { github?: string; demo?: string; other?: { label: Localized; url: string }[] };
}
```
- Start: 5 klar erkennbare Platzhalter-Projekte. Kevin entscheidet später, welche echten Projekte hineinkommen.
- Ein späteres sechstes Portal „Wie diese Seite entstand“ speist sich aus `docs/ai-log.md`.
- Hinweis für Kevin: Arbeiten aus dem Unternehmen nur nach Klärung mit dem Arbeitgeber veröffentlichen.

## 11. Klassische 2D-Ansicht
- Eigene Route, z. B. `/#/classic`, nutzt dieselben Projektdaten.
- Standard auf Mobilgeräten und bei fehlender WebGL-Unterstützung, mit Button „3D trotzdem starten“.
- Aufbau: Kopfbereich mit Name und Kurzprofil, Projektkarten, Kontakt, Links. Optik passend zum Neon-UI.
- Ist auch die Grundlage für Suchmaschinen (Meta-Tags, Open-Graph-Bild, semantisches HTML).

## 12. Audio
- **Musik:** ruhige, gemütliche Tracks mit freier Lizenz (z. B. Pixabay Music, Lizenz pro Track prüfen; OpenGameArt mit CC0-Filter). Zwei Stimmungen: Tag (warm, akustisch) und Nacht (ruhig, leicht elektronisch). Weich überblenden.
- **Umgebung (Freesound, CC0-Filter):**
  - Tag: Wind, Vögel, Wellen, Bach
  - Nacht: Grillen, Wellen, leises elektrisches Summen in Portalnähe (positional)
- **Effekte:**
  - Schritte je nach Untergrund (Gras, Stein, Holz, Wasser), Sprung und Landung, Gleiter
  - Portal öffnen, UI-Klicks
- Alles leise abgemischt, Standard-Gesamtlautstärke etwa 50 %. Format OGG mit MP3 als Fallback.

## 13. Assets und Lizenzen
| Bereich | Quelle | Wer |
|---|---|---|
| Gelände, Pfad, Bach, Zäune, Brücke, Portale, Steg, Lichtstreifen, Skyline | Code (prozedural) | Claude |
| PBR-Texturen (Fels, Erde, Holz, Beton, Metall, Moos) | Poly Haven, ambientCG (CC0) | Claude |
| Himmel / HDRI | Poly Haven (CC0) | Claude |
| Bäume, Felsen, Fässer, Kisten, Laterne | Poly Haven (CC0) | Claude Code lädt (Skript `docs/assets/download-assets.ps1` bzw. gleiche Logik in Node) |
| Haus, Windmühle, Boot, Drohne, Antenne | prozedural, Haus optional aus Quaternius Medieval Village MegaKit (CC0) | Claude Code |
| Charakter und Animationen | Quaternius Universal Base Characters + Universal Animation Library (CC0) | Claude Code lädt, falls die Seite es zulässt, sonst Kevin |
| Musik | OpenGameArt (nur CC0), Kandidaten in `docs/assets/assets-recherche.md` | Claude Code lädt Kandidaten, Kevin wählt nach Gehör aus |
| Sounds | Freesound (nur CC0, Login nötig), Kenney (CC0) | Kevin lädt Freesound-Dateien, Claude Code den Rest und schneidet/konvertiert mit ffmpeg |

Ausgangspunkt ist die Asset-Recherche in `docs/assets/` (Tabellen, Lizenzen, offene Punkte). **Nur CC0.** Assets mit anderer Lizenz (auch CC-BY oder Pixabay) nur nach Rückfrage bei Kevin.

## 14. Performance
- **Zielwerte:**
  - Desktop mit dedizierter Grafikkarte: 60 fps auf „Hoch“
  - Laptop mit integrierter Grafik: mindestens 30 fps auf „Niedrig“
- **Qualitätsstufe „Auto“:** misst die ersten Sekunden die Bildrate und stuft herunter.
- **Ladebudget:** erster Download unter 25 MB bis spielbar, gesamt unter 60 MB. Musik und Nicht-Startbereiche werden nachgeladen.
- **Techniken:**
  - Instancing für Gras, Blumen, Steine und Bäume, Detailstufen nach Entfernung
  - höchstens 8 echte Punktlichter gleichzeitig, sonst leuchtende Materialien plus Bloom
  - Schatten nur von der Sonne
- **Aufräumen:** Geometrien, Texturen und Materialien beim Verlassen von Szenen freigeben.

## 15. Hosting und Recht
- **Hosting:** öffentliches GitHub-Repository und GitHub Pages, Deployment über GitHub Actions bei Push auf `main`. `base` in der Vite-Konfiguration passend setzen.
- **Domain:** optional eigene Subdomain (z. B. `portfolio.digitalbase.dev`) per CNAME.
- **Datenschutz und Impressum:**
  - keine Cookies, kein Tracking, keine externen Requests (Schriften und Assets selbst gehostet)
  - einfache Seiten für Impressum und Datenschutz, Inhalte liefert Kevin
- **Assets:** keine Inhalte aus bestehenden Spielen oder Filmen.

## 16. Bewusst nicht enthalten
- 3D-Touch-Steuerung für Handys (Handys nutzen die 2D-Ansicht, 3D nur optional)
- Multiplayer, Backend, Accounts
- Tauchen, Kämpfe, Inventar

## 17. Roadmap mit Abnahmekriterien

| Phase | Inhalt | Fertig, wenn … |
|---|---|---|
| 0 Setup | Repo, Vite/React/TS/R3F, Lint, Typecheck, Playwright-Screenshots, Deployment | Live-URL auf GitHub Pages zeigt eine leere 3D-Szene; Push deployt automatisch |
| 1 Graybox | Grobes Gelände, Pfad, Bach, Kapsel-Spieler mit Kamera und Physik, 5 Portal-Platzhalter aus Daten, Overlay mit Platzhaltern, i18n-Grundgerüst | Man kann über die Insel laufen, ein Portal mit E öffnen und das Overlay in DE/EN sehen |
| 2 Bewegung | Sprint mit Ausdauer, Springen, Schwimmen, Gleiten, Klettern, Kamera-Kollision | Alle Bewegungen funktionieren mit der Kapsel ohne Hängenbleiben |
| 3 Charakter | Quaternius-Figur und -Animationen, fehlende Clips im Code, Techwear-Anpassung, Rucksack, Leuchtnähte, Gleiter-Modell | Charakter animiert in allen Zuständen mit weichen Übergängen |
| 4 Welt Tag | Finales Gelände, PBR-Materialien, Gras mit Wind, Bäume, Felsen, Wasser-Shader, Bach und Wasserfall, Haus, Windmühle, Steg, Skyline, Himmel und Dunst | Screenshot aus der Spielkamera trifft die Stimmung von `03-gameplay-view.png` |
| 5 Portale | Finales Portal-Modell, Hologramm-Shader, Öffnungsanimation | Portal nachts trifft `04-portal-closeup-night.png` |
| 6 Tag-Nacht | Zyklus, Dämmerungs-Sequenz, Nacht-Beleuchtung, Bloom, Glühwürmchen, gefälschte Nässe | Dämmerung und Nacht treffen `07` und `02` |
| 7 UI | Startscreen, Ladebildschirm, HUD mit Minimap, finales Overlay, Einstellungen, Pausemenü | Komplett per Maus und Tastatur bedienbar, Stil wie `05` und `08` |
| 8 Audio | Musik, Umgebung, Schritte, Effekte, Lautstärkeregler | Alles hörbar, leise abgemischt, Lizenzen in CREDITS.md |
| 9 2D und SEO | Klassische Ansicht, Mobil-Weiterleitung, Meta-Tags, Impressum und Datenschutz | 2D-Ansicht auf dem Handy nutzbar; Lighthouse-SEO ≥ 90 |
| 10 Feinschliff | Performance-Stufen, Ladebudget, Bugfixes, Kevins Feedback | Zielwerte aus Abschnitt 14 erreicht, Kevin gibt frei |
| 11 Inhalte | Echte Projekte von Kevin, Portal „Wie diese Seite entstand“ | Alle Platzhalter ersetzt |

## 18. Was Kevin tun muss
1. Öffentliches GitHub-Repository anlegen und Pages auf „GitHub Actions“ stellen.
2. Startdateien liegen im Repo (`CLAUDE.md`, `docs/SPEC.md`, `docs/reference/`, `docs/assets/`).
3. Claude Code lokal in der Desktop-App mit diesem Repo starten (auf dem eigenen Laptop, nicht in einer VM ohne Grafikkarte). Claude Code lädt die Assets selbst herunter.
4. Freesound-Sounds herunterladen (Login nötig). Die Musik ist bereits ausgewählt (`docs/assets/AUSWAHL.md`), Kevin muss sie nicht anhören.
5. Nach jeder Phase im Browser testen und Feedback geben.
6. Später: echte Projektinhalte, Impressum-Daten, optional eigene Domain.
