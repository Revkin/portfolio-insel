# Credits

Alle fremden Assets in diesem Repository stehen unter **CC0 1.0 Universal** (Public Domain). Namensnennung ist nicht verpflichtend, erfolgt hier aber gern.

| Asset | Quelle | Link | Lizenz | Autor | Verwendet in |
|---|---|---|---|---|---|
| Universal Base Characters [Standard] – `Superhero_Male_FullBody` (Körper, Augen, Augenbrauen), Hauttextur `T_Superhero_Male_Ligh`, Frisur `Hair_SimpleParted` | itch.io | https://quaternius.itch.io/universal-base-characters | CC0 1.0 | Quaternius | `public/assets/models/character.glb` |
| Universal Animation Library [Standard] – Clips `Idle_Loop`, `Walk_Loop`, `Jog_Fwd_Loop`, `Sprint_Loop`, `Jump_Start`, `Jump_Loop`, `Jump_Land`, `Swim_Idle_Loop`, `Swim_Fwd_Loop` | itch.io | https://quaternius.itch.io/universal-animation-library | CC0 1.0 | Quaternius | `public/assets/models/character-anims.glb` |
| Mossy Rock (Textur) | Poly Haven | https://polyhaven.com/a/mossy_rock | CC0 1.0 | Rob Tuytel | `terrain-*.webp` (Fels), `stone-*.webp` |
| Cobblestone Floor 01 (Textur) | Poly Haven | https://polyhaven.com/a/cobblestone_floor_01 | CC0 1.0 | Rob Tuytel | `terrain-*.webp` (Pfad), `cobble-*.webp` |
| Park Dirt (Textur) | Poly Haven | https://polyhaven.com/a/park_dirt | CC0 1.0 | Christopher Melani | `terrain-*.webp` (Erde) |
| Coast Sand 01 (Textur) | Poly Haven | https://polyhaven.com/a/coast_sand_01 | CC0 1.0 | Rob Tuytel | `terrain-*.webp` (Strand) |
| Aerial Grass Rock (Textur) | Poly Haven | https://polyhaven.com/a/aerial_grass_rock | CC0 1.0 | Rob Tuytel | `terrain-*.webp` (Boden unter dem Gras) |
| Old Planks 02 (Textur) | Poly Haven | https://polyhaven.com/a/old_planks_02 | CC0 1.0 | Rob Tuytel | `wood-*.webp` (Brücke, Steg, Zäune, Haus) |
| Clay Roof Tiles 02 (Textur) | Poly Haven | https://polyhaven.com/a/clay_roof_tiles_02 | CC0 1.0 | Amal Kumar | `roof-*.webp` (Dach) |
| Rock Moss Set 01 (Modell) | Poly Haven | https://polyhaven.com/a/rock_moss_set_01 | CC0 1.0 | Kless Gyzen | `models/world/rocks.glb` |
| Barrel 01 (Modell) | Poly Haven | https://polyhaven.com/a/Barrel_01 | CC0 1.0 | Jorge Camacho | `models/world/barrel.glb` |
| Wooden Crate 01 (Modell) | Poly Haven | https://polyhaven.com/a/wooden_crate_01 | CC0 1.0 | James Ray Cock | `models/world/crate.glb` |
| Lantern 01 (Modell) | Poly Haven | https://polyhaven.com/a/Lantern_01 | CC0 1.0 | Rajil Jose Macatangay | `models/world/lantern.glb` |

## Bearbeitungen

- **Charakter:** Kleidung (Techwear-Jacke, Cargo-Hose, Stiefel) und Leuchtnähte wurden per Skript in die Textur gemalt (`scripts/assets/build-character.ts`). Rucksack, Kragen, Taschen, Stiefel und Gleiter sind eigene, im Code erzeugte Meshes. Die Texturen sind verkleinert und als WebP gespeichert, die Geometrie ist mit meshopt komprimiert.
- **Animationen:** Aus 43 Clips wurden nur die 9 benötigten übernommen, und zwar nur als Rotationen plus Beckenposition. Klettern, Hängen am Gleiter und Hochziehen gibt es in der Bibliothek nicht. Diese Posen entstehen im Code (`src/player/poses.ts`).

- **Poly Haven:** Texturen auf 1024 bzw. 512 px verkleinert und als WebP gespeichert; die fünf Bodentexturen sind zu je einem Bild für Farbe und Normalen gestapelt. Modelle mit meshoptimizer vereinfacht (höchstens ca. 1.400–2.400 Dreiecke pro Mesh), Texturen als WebP, Geometrie mit meshopt komprimiert (`scripts/assets/build-world-assets.ts`).
- **Im Code erzeugt (keine fremden Assets):** Gras, Bäume, Büsche, Himmel, Wasser, Haus, Windmühle, Steg, Boot, Zäune und Skyline. Die Blatttextur der Bäume wird zur Laufzeit gezeichnet.

Die Original-Pakete sind nicht im Repository, nur die daraus erzeugten Dateien.
