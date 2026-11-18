# Asset-Recherche Portfolio-Insel

Stand: 19.10.2026. Recherche per Web-Tools und der Poly-Haven-API (`api.polyhaven.com`).

**Wichtig vorab:** Die Cloud-Umgebung, in der ich gearbeitet habe, darf Poly Haven, ambientCG, Freesound und OpenGameArt nicht direkt herunterladen (Proxy blockt mit 403). Deshalb liegen in `assets/` noch keine Dateien. Stattdessen liegt `download-assets.ps1` bei: Das Skript lädt alle als „beste Wahl“ markierten Poly-Haven-Assets (Texturen, HDRIs, Modelle) automatisch in die richtige Ordnerstruktur, ohne Login. Alles andere steht mit direkten Links in `OFFEN.md`.

Legende: **fett** = beste Wahl. „Verifiziert“ = Lizenz und Autor habe ich auf der Quellseite bzw. per API gelesen. Dateigrößen: nur angegeben, wo die Quelle sie nennt, sonst „–“ (das Skript gibt die echten Größen nach dem Download aus).

Texturen: Standard ist **1K** mit den Karten `diff` (Farbe), `nor_gl` (Normal, OpenGL, passt zu Three.js) und `arm` (AO/Roughness/Metal in einem Bild). Das ergibt grob 3 MB pro Material (Beispiel mossy_rock: 1,12 + 1,00 + 0,93 MB). Später im Projekt zu KTX2 komprimiert, dann deutlich kleiner.

---

## 1. Charakter

Ehrliche Einschätzung vorab: Kein kostenloses Modell entspricht dem Sheet (Techwear-Jacke, Cargo-Hose, Stiefel, Rucksack, Cartoon-Gesichtsstil à la `06-character-sheet.png`) vollständig. Der Rucksack und die Leuchtnähte müssen ohnehin im Code ergänzt werden (Rucksack als eigenes Mesh am Spine-Bone).

| # | Name | Link | Lizenz | Autor | Format | Größe | Nennung | Einschätzung |
|---|---|---|---|---|---|---|---|---|
| A | **Mixamo-Charakter (junger Mann, Jacke und Hose)** | https://www.mixamo.com/#/?page=1&type=Character | Adobe-Mixamo-Bedingungen (kommerzielle Nutzung erlaubt, laut Adobe-FAQ „royalty free für persönliche, kommerzielle und gemeinnützige Projekte“); **kein CC0** | Adobe | FBX | – | nicht in den FAQ gefordert | Passt am besten zu „halbrealistisch“ und liefert alle benötigten Animationen aus einem Rig. **Rechtliches Risiko:** Ein Adobe-Community-Beitrag (nicht offiziell) sagt, Weitergabe der Roh-Assets sei laut Terms nicht erlaubt. In einem öffentlichen GitHub-Repo liegen die Dateien aber öffentlich. Siehe `OFFEN.md`, bitte vor dem Upload klären. Genaue Figur (z. B. Remy, Ty, Aj) musst du im Browser auswählen, die Namen habe ich nicht verifizieren können. |
| B | Quaternius Universal Base Characters + Universal Animation Library | https://quaternius.itch.io/universal-base-characters und https://quaternius.com/packs/universalanimationlibrary.html | **CC0** (verifiziert) | Quaternius | glTF/GLB, FBX, Blend | Charaktere: Standard-Paket 122 MB (zu groß, nur 1–2 Modelle extrahieren); ca. 13k Dreiecke pro Modell | nein | Sauberste Lizenz, ohne Rechtsrisiko im öffentlichen Repo. Gemeinsamer Humanoid-Rig, 120+ Animationen inkl. Schwimmen. Klettern und Gleiten nicht bestätigt. Basismodelle tragen nur schwarze Minimalkleidung, Jacke/Hose müssten per Materialfarbe und Zusatzmeshes gebaut werden. Teen-Proportionen passen gut zum Sheet. |
| C | Quaternius Modular Character Outfits – Fantasy | https://quaternius.itch.io/modular-character-outfits-fantasy | CC0 laut Quaternius-Seiten (nicht einzeln geprüft) | Quaternius | glTF/FBX | – | nein | Nur Plan B: Outfit-Stil Fantasy, nicht Techwear. Würde zum Fantasy-Teil der Insel passen, aber nicht zum Sheet. |

**Empfehlung:** A, wenn du die Mixamo-Lizenzfrage für ein öffentliches Repo akzeptabel findest (Dateien alternativ erst beim Build laden, nicht im Repo). Sonst B.

## 2. Animationen (Mixamo)

Die Namen sind aus meiner Erinnerung an die Mixamo-Bibliothek und konnten von hier aus nicht gegen die Seite geprüft werden (Mixamo braucht Login). Falls ein Name nicht exakt existiert, steht in der Spalte „Ersatz“ das Suchwort.

**Download-Einstellungen für alle:** Format **FBX Binary (.fbx)**, **Skin: „With Skin“ nur bei der ersten Animation** (Idle), bei allen weiteren **„Without Skin“** (spart Größe, Rig ist identisch), **30 FPS**, Keyframe Reduction **none** (oder uniform, wenn die Datei groß wird). **„In Place“ = ja** für alle Bewegungen, die der Code selbst fortbewegt (Gehen, Rennen, Schwimmen, Klettern). Bei Springen und Hochziehen: In Place **nein**, wenn du die Eigenbewegung der Figur nutzen willst, sonst ja (der Controller bewegt die Kapsel).

| Zweck | Mixamo-Name | In Place | Ersatz / Hinweis |
|---|---|---|---|
| Idle | `Idle` (alternativ `Breathing Idle`) | ja | – |
| Gehen | `Walking` | ja | – |
| Rennen | `Running` (alternativ `Standard Run`) | ja | – |
| Springen | `Jump` oder `Running Jump` | nein | Für Absprung aus dem Stand `Jump`, aus dem Lauf `Running Jump` |
| Fallen (Luft) | `Falling Idle` | ja | Brücke zwischen Sprung und Landen |
| Landen | `Falling To Landing` (hart: `Hard Landing`) | ja | – |
| Schwimmen an der Oberfläche | `Swimming` und für Stillstand `Treading Water` | ja | Suche „swim“ |
| Gleiten (Hängepose) | `Hanging Idle` | ja | Passt zum Sheet (Arme nach oben am Gleiter). Alternative: `Freehang Drop` o. Ä. suchen |
| Klettern hoch | `Climbing Up Wall` | ja | Suche „climb“ |
| Klettern runter | `Climbing Down Wall` | ja | – |
| Klettern links/rechts | `Braced Hang Shimmy` (links und rechts als zwei Varianten) | ja | Suche „shimmy“; falls es nur eine Richtung gibt, im Code spiegeln (Scale X = -1) |
| Hochziehen an Kante | `Braced Hang To Crouch` (alternativ `Climbing To Top`) | nein | Danach `Idle` überblenden |

Eine zusammengelegte Download-Liste (14 Clips) ist ca. 10–20 MB als FBX; im Projekt später in eine GLB mit nur einer Skin konvertieren (Claude Code kann das mit gltf-transform/FBX2glTF).

## 3. PBR-Texturen

Alle Poly Haven: CC0, Autoren je Asset auf der Seite, Nennung nicht nötig. Link-Muster: `https://polyhaven.com/a/<id>`. IDs per API verifiziert.

| Zweck | Kandidaten (id) | Autor/Quelle | Lizenz | Einschätzung |
|---|---|---|---|---|
| bemooster Fels | **`mossy_rock`**, `rock_pitted_mossy`, `aerial_rocks_02` | Poly Haven | CC0 | `mossy_rock` ist im Namen und laut Karten (1K diff 1,12 MB, nor 1,00 MB, arm 0,93 MB) das naheliegendste für Klippe und Felsen. Optik habe ich nicht gesehen. |
| Kopfsteinpflaster | **`cobblestone_floor_01`**, `cobblestone_floor_08`, `cobblestone_04` | Poly Haven | CC0 | Alle in der API-Liste bestätigt. Bei Bedarf Vorschau auf der Seite prüfen, welche am besten zum Referenzpfad (flache Steine, Erde) passt. |
| Erdweg | **`park_dirt`**, `dirt_floor`, `brown_mud_rocks_01` | Poly Haven | CC0 | `brown_mud_rocks_01` hat zusätzlich Steine und passt ggf. besser zu „Erdpfad mit flachen Steinen“. |
| verwittertes Holz | **`old_planks_02`**, `medieval_wood`, `moss_wood` | Poly Haven | CC0 | `moss_wood` für Stege/Zäune mit Moos. |
| Beton (Portale) | **`concrete_moss`**, `concrete_wall_006`, `rough_concrete` | Poly Haven | CC0 | `concrete_moss` passt direkt zu „Beton mit Moos“ am Portalrahmen. |
| rostiges/verwittertes Metall | **`rusty_metal_02`**, `rust_coarse_01`, `worn_corrugated_iron` | Poly Haven | CC0 | – |
| Moos | **Moss002** (ambientCG), `Moss001`/`Moss003` nicht geprüft | ambientCG | CC0 | ambientCG-Zip (1K-JPG) ist 10,4 MB groß, enthält mehr Karten als nötig. Nur Color, NormalGL, Roughness, AO daraus verwenden. Alternativ `mossy_rock` zusätzlich für Bodenmoos tinten. |
| Sand | **`coast_sand_01`**, `coast_sand_05`, `aerial_sand` | Poly Haven | CC0 | – |
| Dachschindeln | **`roof_slates_02`**, `clay_roof_tiles_02`, `grey_roof_tiles` | Poly Haven | CC0 | Für warmes Cottage wären Tonziegel (`clay_roof_tiles_02`) stimmiger, Schiefer wirkt kühler und passt besser zu Neon. Du entscheidest. |

Grasboden: Das Gras kommt per Instancing aus dem Code. Als Bodentextur unter dem Gras eignet sich `forest_ground_04` oder `grass_path_2` (beide in der API-Liste), ist aber nicht Teil der Pflichtliste, nicht eingeplant.

## 4. HDRIs (Poly Haven, CC0)

| Zweck | Kandidaten | Autor | 1K-HDR | 2K-HDR | Einschätzung |
|---|---|---|---|---|---|
| Tag | **`farm_field_puresky`**, `kloppenheim_06_puresky` | Dimitrios Savva (Foto), Jarod Guest (Sky) | 1,34 MB | 5,03 MB | „Midday, teilweise bewölkt, diffuses Licht“. Kein komplett klarer Himmel, aber „pure sky“ ohne Bodenobjekte. Für wirklich klar im Skyshader den physikalischen Himmel nutzen (Spec erlaubt das). |
| Sonnenuntergang | **`belfast_sunset_puresky`**, `kloppenheim_06_puresky` | Greg Zaal, D. Savva, J. Guest | 1,19 MB | 4,56 MB | Warm, pure sky, passt zur Dämmerung (`07`). |
| Nacht | **`rogland_clear_night`**, `qwantani_night_puresky`, `moonless_golf` | Greg Zaal | 1,69 MB | 6,84 MB | Klarer Sternenhimmel mit Milchstraße. Hat Wüsten-Horizont, ggf. verdeckt durch Meer und Nebel. `qwantani_night_puresky` hat keinen Bodenanteil. |

Das Skript lädt die **1K-HDR** (Summe ca. 4,2 MB). Für den Himmel reicht das, weil nur Beleuchtung und Reflexion darüber läuft; als sichtbaren Hintergrund besser 2K.

## 5. Modelle

Poly Haven hat Bäume, Büsche, Felsen, Fässer, Kisten, Laterne und einen Steg. Haus, Windmühle, Boot, Zaun, Drohne und Antenne gibt es dort nicht. Hier sind meine Quellen: Quaternius und Kenney (beide CC0), aber Kenney ist Low-Poly-flat (passt weniger zu „kein Flat-Low-Poly“).

| Objekt | Kandidaten | Link | Lizenz | Autor | Format | Größe | Nennung | Einschätzung |
|---|---|---|---|---|---|---|---|---|
| Laubbaum | **`island_tree_01`**, `tree_small_02` | polyhaven.com/a/island_tree_01 | CC0 | Rob Tuytel, Rico Cilliers | glTF 1K | Normalmap allein 1,2 MB, Gesamt unbekannt | nein | Fotoscan-Stil, passt zu „stilisiert realistisch“. Küstenbaum, passt zur Insel. Polycount hoch → nur wenige Instanzen oder LOD. |
| Nadelbaum | **`pine_sapling_small`** | polyhaven.com/a/pine_sapling_small | CC0 | Rob Tuytel, Rico Cilliers | glTF 1K | – | nein | Kleiner Nadelbaum, für größere Bäume skalieren. Alternativ Quaternius Stylized Nature MegaKit (40 Bäume, CC0, https://quaternius.com/packs/stylizednaturemegakit.html), Download dort manuell. |
| Busch | **`shrub_01`** | polyhaven.com/a/shrub_01 | CC0 | Rico Cilliers | glTF 1K | – | nein | – |
| Felsen | **`boulder_01`**, `rock_moss_set_01` | polyhaven.com/a/boulder_01 | CC0 | Rico Cilliers / Kless Gyzen | glTF 1K | – | nein | `rock_moss_set_01` bringt Moos-Steine passend zur Klippe. |
| Haus/Cottage | **Quaternius Medieval Village MegaKit** (modular), Kenney Fantasy Town Kit nicht geprüft | https://quaternius.com/packs/medievalvillagemegakit.html | CC0 (verifiziert) | Quaternius | glTF/FBX/OBJ | Größe nicht angegeben | nein | 300+ modulare Wand-/Dach-/Tür-Teile; fertiges Cottage nicht bestätigt, aber aus Modulen baubar. Download nur über Quaternius/itch (kein Direktlink für mich). |
| Windmühle | **prozedural bauen** | – | – | – | – | – | – | Kein CC0-glTF-Windmühlenmodell von mir verifiziert gefunden. Die Treffer (Sketchfab/CGTrader) haben Lizenzen, die ich nicht prüfen konnte. Für Kevins Spec („Neon-Kanten an Flügeln“) ist ein selbst gebautes Modell (Turm, Dach, Flügel) ohnehin sauberer. |
| Ruderboot | **Kenney Nature Kit** (Kanu mit Paddel), Kenney Pirate Kit | https://opengameart.org/content/nature-kit | CC0 (verifiziert) | Kenney | glTF/FBX/OBJ | ZIP 10,5 MB | nein (optional „Kenney.nl“) | Das Kanu ist laut Tags enthalten. Flat-Low-Poly-Stil, ggf. mit PBR-Holztextur überziehen. Pirate Kit (3,2 MB) soll Schiffe enthalten, Ruderboot nicht bestätigt. |
| Holzsteg | **`modular_wooden_pier`** | polyhaven.com/a/modular_wooden_pier | CC0 | Rico Cilliers | glTF | – | nein | **Achtung:** 84.780 Polygone, Texturen bis 8K. Nur 1K laden, nur 1–2 Module nutzen oder Steg prozedural bauen (Spec: Code). |
| Holzbrücke | **prozedural** | – | – | – | – | – | – | Laut Spec Code. Kein Poly-Haven-Modell bestätigt. |
| Zaun | **Kenney Nature Kit** (Zaun) oder prozedural | s. o. | CC0 | Kenney | glTF | s. o. | nein | Spec sieht Code (Pfosten + Kabel) vor. |
| Fässer | **`wooden_barrels_01`**, `Barrel_01` (Metall-Ölfass) | polyhaven.com/a/wooden_barrels_01 | CC0 | James Ray Cock / Jorge Camacho | glTF 1K | – | nein | `wooden_barrels_01` für Holzfässer, `Barrel_01` für Industrie-Look am Haus. |
| Kisten | **`wooden_crate_01`** | polyhaven.com/a/wooden_crate_01 | CC0 | James Ray Cock | glTF 1K | – | nein | „Fancy colonial chest“-Look, evtl. zu edel. Alternative Kenney Survival Kit (nicht geprüft). |
| Laterne | **`Lantern_01`** | polyhaven.com/a/Lantern_01 | CC0 | Rajil Jose Macatangay | glTF 1K | 1K ca. 1,4 MB (bin 0,86 + Texturen 0,55) | nein | Handlaterne mit Messing, passt zur Fantasy-Seite. |
| kleine Drohne | **prozedural** (Rumpf + 4 Rotoren) | – | – | – | – | – | – | Keine bestätigte CC0-Drohne gefunden. Quaternius Sci-Fi Essentials Kit (CC0, https://opengameart.org/content/sci-fi-essentials-kit, 87,8 MB Modelle-ZIP) enthält laut Seite Roboter, keine Drohne bestätigt. |
| Antenne/Schüssel | **prozedural** | – | – | – | – | – | – | Einfacher Zylinder + Halbkugel reicht. Kein CC0-Modell bestätigt. |

## 6. Musik

Ich konnte die Tracks nicht anhören (nur Seiten, Lizenz und Tags gelesen). Reinhören vor der Einbindung ist Pflicht. Alle unten: **CC0** (auf der Seite verifiziert), keine Namensnennung erforderlich (teils erbeten). Nicht empfohlen: Pixabay Music, weil dessen Lizenz kein CC0 ist und Weitergabe als Rohdatei in einem öffentlichen Repo eingeschränkt sein kann (Lizenzseite habe ich nicht geprüft).

### Tag (ruhig, akustisch)

| Name | Autor | Link | Format/Größe | Einschätzung |
|---|---|---|---|---|
| **Exploration** | johnclark | https://opengameart.org/content/exploration-0 | WAV 4,1 MB (→ OGG ca. 1 MB) | „Chill acoustic guitar loop“, Beschreibung passt am besten. |
| **In the middle of nowhere** | Centurion_of_war | https://opengameart.org/content/in-the-middle-of-nowhere | MP3 2,7 MB (bassed) und 1,6 MB (ambience) | „Chill guitar based music“. |
| Slow Stride | isaiah658 | https://opengameart.org/content/slow-stride | OGG 2 MB | „Relaxed, mellow“, Stil unbekannt (Synth/Akustik?). Dritter Track. |
| Fouler l'horizon | Loyalty Freak Music (Komiku) | https://opengameart.org/content/fouler-lhorizon | MP3 4,5 MB | Akustisch, aber getaggt „epic/adventure“, evtl. zu energisch. |

### Nacht (ruhig, leicht elektronisch)

| Name | Autor | Link | Format/Größe | Einschätzung |
|---|---|---|---|---|
| **Ambient Relaxing Loop** | isaiah658 | https://opengameart.org/content/ambient-relaxing-loop | OGG 1,3 MB | Pad-lastiger Ambient-Loop, naheliegend für Nacht. |
| **Feel good slow ambient track with a beat** | annandistance | https://opengameart.org/content/feel-good-slow-ambient-track-with-a-beat | OGG 1,9 MB | Langsamer Beat, A-Dur; „cozy“. |
| Calm Loop | wipics | https://opengameart.org/content/calm-loop | MP3 0,3 MB | Synths + Percussion, sehr klein. |

Gesamt Musik realistisch ca. 8–10 MB als OGG.

## 7. Sounds

Freesound-Downloads brauchen einen kostenlosen Login. Auswahl nur CC0 (auf der jeweiligen Seite gelesen). Trotz Suche nach „CC0“ liefert Freesound auch CC-BY und CC-BY-NC; unten sind solche Treffer mit Vermerk ausgeschlossen. Kandidaten zeigen 1–2 Alternativen.

| Sound | Beste Wahl | Lizenz | Dauer / Größe (Original) | Alternativen |
|---|---|---|---|---|
| Schritte Gras | **Grassy Footstep 4** von OwlStorm, https://freesound.org/people/OwlStorm/sounds/151235/ | CC0 | 0,5 s, 90 KB | `footsteps grass.wav` von Yuval, /people/Yuval/sounds/206030/ (CC0, 35 s, 4,8 MB, Schritte selbst schneiden) |
| Schritte Stein | **Footsteps - Stone, Rock, Concrete, Cement** von SecureSubset, /people/SecureSubset/sounds/813622/ | CC0 | 6,7 s, 950 KB | – |
| Schritte Holz | **Shoe footsteps on Wood** von Noted451, /people/Noted451/sounds/582202/ | CC0 | 59,5 s, 16,4 MB (trimmen!) | – |
| Schritte Wasser | nicht gefunden | – | – | siehe OFFEN.md |
| Sprung/Landung | Kenney Impact Sounds (https://kenney.nl/assets/impact-sounds) | CC0 laut Kenney (nicht von mir geprüft) | – | – |
| Wind | **Wind Loop** von Jakegwizdak, /people/Jakegwizdak/sounds/565491/ | CC0 | 4,75 s, 1,2 MB | Wind Ambience von jackyyang09 (**CC BY 4.0**, Nennung nötig, 52 s) |
| Vögel | **Forest birds – ambient seamless loop** von Magnesus, /people/Magnesus/sounds/723913/ | CC0 | 27 s, 5 MB | Forest_Birds (loop) 02 von VKProduktion /231537/ (CC0, 10,1 MB) |
| Meereswellen | **(Loop) By the Sea** von plasterbrain, /people/plasterbrain/sounds/464918/ | CC0 | 16 s, 1,5 MB FLAC | Ocean Waves Loop – Day von Koops (**CC BY 4.0**, 20,6 MB) |
| Bach | **Relaxing river stream running water seamless loop** von steaq, /people/steaq/sounds/548767/ | CC0 | 10 s, 1,7 MB | Creek 06 (loop) von VKProduktion /231536/ (CC0, 12,1 MB) |
| Grillen | **Night Crickets Ambience on Rural Property** von OwlStorm, /people/OwlStorm/sounds/320145/ | CC0 | 82 s, 13,9 MB (auf ca. 20 s kürzen) | Robinhood76 „Cricket ambience“ nicht verwenden (**CC BY-NC**) |
| leises elektrisches Summen | **Flickering Fluorescent Light with Background Hum (Seamless Loop)** von kentspublicdomain, /people/kentspublicdomain/sounds/777053/ | CC0 | 9 s, 775 KB | „Electrical hum“ von Hyperchromatics nicht verwenden (**CC BY-NC**) |
| Portal öffnet sich | nicht gefunden | – | – | Kenney Sci-fi Sounds (https://kenney.nl/assets/sci-fi-sounds), CC0 laut Kenney, nicht geprüft |
| Gleiter-Wind | nicht gefunden | – | – | `Wind Loop` leicht gefiltert/lauter als Behelf |
| UI-Klicks | **Kenney Interface Sounds**, https://opengameart.org/content/interface-sounds | CC0 (verifiziert) | ZIP 834,5 KB, 100 OGG | – |

Alle Sounds nach OGG (mono, ca. 64–96 kbit/s) konvertieren, dann Gesamtgröße ca. 5–8 MB.

## Größenabschätzung (alles zusammen, vor KTX2-Kompression)

Texturen (9 Materialien, 1K diff+nor+arm): ca. 27 MB. HDRIs (3× 1K): 4,2 MB. Modelle Poly Haven (ca. 8 Stück, 1K): geschätzt 8–15 MB (nicht gemessen). Musik: 8–10 MB. SFX: 5–8 MB. Charakter plus Animationen: 10–20 MB. Summe grob 60–85 MB, also **über dem 60-MB-Ziel**, bevor Kompression greift. Hebel: Texturen nur `diff`+`nor_gl`+`arm` bei 1K, später als KTX2 komprimiert (Einsparung nicht gemessen, typischerweise deutlich), Modelle mit Draco/meshopt, Musik in 64-kbit-OGG. Nachladen von Musik und Nicht-Startbereichen deckt die Spec ab.
