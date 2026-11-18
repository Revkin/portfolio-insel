# OFFEN

## 0. Wichtigstes zuerst: Warum `assets/` leer ist

Aus der Cloud-Umgebung waren Poly Haven, ambientCG, Freesound, OpenGameArt, Mixamo, Kenney und Quaternius per Proxy gesperrt (403). Gelesen habe ich sie nur über die Web-Recherche-Tools (Seiten und die Poly-Haven-API), Binärdateien konnte ich nicht ziehen. Mit einem Terminal auf deinem Rechner ging es nicht, weil für diese Sitzung keine Shell auf deinem PC verfügbar war.

**Was du tun musst (ca. 10 Minuten):**

1. In PowerShell im Ordner `ergebnis/` ausführen: `powershell -ExecutionPolicy Bypass -File .\download-assets.ps1`. Das lädt alle Poly-Haven-Texturen, HDRIs und Modelle plus ambientCG-Moos nach `assets/textures`, `assets/hdri`, `assets/models`. Am Ende zeigt es die Gesamtgröße und die zehn größten Dateien.
2. Das Skript ist **ungetestet** (kein Zugriff). Typische Stolpersteine: JSON-Struktur der API weicht ab (dann steht eine Warnung), Datei zu groß. Bitte die Ausgabe an Claude Code geben, der kann es reparieren.

## 1. Manuell herunterladen (ich konnte es nicht)

- **Mixamo** (Adobe-Login): Figur und 12 Animationen laut `assets-recherche.md`, Abschnitt 2.
- **Musik**: 6 Tracks von den Links in `assets-recherche.md`, Abschnitt 6 (OpenGameArt, kein Login nötig). In OGG konvertieren, falls WAV/FLAC.
- **Freesound** (kostenloser Login nötig): 9 Sounds aus Abschnitt 7. Trimmen: Holz-Schritte (16 MB), Grillen (14 MB).
- **Kenney Interface Sounds** (OpenGameArt, kein Login): UI-Klicks.
- Optional: Kenney Nature Kit (Kanu, Zaun), Quaternius Medieval Village MegaKit (Haus). Sie sind nur bei Bedarf nötig, siehe unten.

## 2. Nicht gefunden

- **Schritte im Wasser, Planschen:** keine CC0-Quelle geprüft. Freesound-Suche „water splash footsteps“ mit CC0-Filter, oder im Code eine gefilterte Kombination aus Bach-Sound und Schritt verwenden.
- **Portal öffnet sich, Gleiter-Wind, Sprung/Landung:** Kein verifizierter Treffer. Kenney Sci-fi Sounds und Impact Sounds sind laut Kenney CC0, aber nicht von mir geprüft. Sonst im Code synthetisieren (Web Audio: Sweep + Rauschen).
- **CC0-Modelle für Windmühle, Holzbrücke, Drohne, Antenne/Satellitenschüssel, Zaun:** keine verifiziert gefunden, daher im Code bauen (deckt sich mit der Spec, Abschnitt 13). Das Ruderboot gibt es höchstens als Flat-Low-Poly-Kanu bei Kenney.
- **Fertiges Cottage:** nur modular (Quaternius), nicht als Einzelmodell bestätigt.
- **Techwear-Charakter mit Rucksack:** gibt es nicht fertig. Rucksack und Leuchtnähte im Code ergänzen.

## 3. Unsicherheiten

1. **Mixamo im öffentlichen Repo.** Adobe erlaubt kommerzielle Nutzung von Figuren und Animationen in eigenen Projekten. Ein Beitrag in der Adobe-Community (kein Adobe-Mitarbeiter) behauptet, die Terms verbieten die Weitergabe der Roh-Assets. Ein öffentliches GitHub-Repo mit den FBX/GLB-Dateien ist technisch eine Weitergabe. Ich habe die Terms nicht selbst gelesen. Optionen: (a) Adobe-Terms prüfen, (b) Quaternius-Figuren (CC0) statt Mixamo, (c) das Repo privat halten und nur den Build veröffentlichen (dann steckt die Datei trotzdem im ausgelieferten Bundle, das gleiche Problem). Mein Rat: vor Phase 3 entscheiden.
2. **Mixamo-Animationsnamen** stammen aus dem Gedächtnis (`Climbing Up Wall`, `Braced Hang Shimmy`, …). Bitte beim Download die Suchbegriffe nutzen, falls ein Name abweicht.
3. **Tag-HDRI** ist „teilweise bewölkt“, nicht klar. Wenn du wirklich klaren Himmel willst, nimm den physikalischen Himmel im Code.
4. **Optik nicht geprüft:** Ich habe Texturen, Modelle und Musik nicht gesehen/gehört, nur Namen, Tags und Beschreibungen gelesen. Stil-Check (Moos, Kopfsteinpflaster, Baum-Look, Musik) bitte kurz selbst machen oder Claude Code per Screenshot vergleichen lassen.
5. **Größenbudget:** Rechnerisch 60–85 MB vor Kompression, siehe Ende von `assets-recherche.md`. Die Schätzungen für Modelle und Charakter sind grob, nur HDRIs und Beispieltextur sind gemessen. Das Skript meldet reale Größen.
6. **Polycount:** `modular_wooden_pier` hat ca. 85.000 Polygone, `island_tree_01` ist ebenfalls hochauflösend. Für die Performance-Ziele (Laptop mit integrierter Grafik) ggf. vereinfachen oder prozedural ersetzen.
7. **ambientCG Moss002:** Zip ist 10,4 MB; nur Color, NormalGL, Roughness, AO behalten. Lizenz CC0 ist der ambientCG-Standard, nicht einzeln auf der Seite geprüft.
8. **Autoren der Texturen** (Poly Haven) sind in `CREDITS.md` nicht einzeln ausgeschrieben, nur „siehe Seite“. `https://api.polyhaven.com/info/<id>` liefert sie.
9. **Pixabay Music** habe ich bewusst nicht vorgeschlagen (Lizenz kein CC0, Weitergabe von Rohdateien nicht geprüft).
