# Credits

Alle fremden Assets in diesem Repository stehen unter **CC0 1.0 Universal** (Public Domain). Namensnennung ist nicht verpflichtend, erfolgt hier aber gern.

| Asset | Quelle | Link | Lizenz | Autor | Verwendet in |
|---|---|---|---|---|---|
| Universal Base Characters [Standard] – `Superhero_Male_FullBody` (Körper, Augen, Augenbrauen), Hauttextur `T_Superhero_Male_Ligh`, Frisur `Hair_SimpleParted` | itch.io | https://quaternius.itch.io/universal-base-characters | CC0 1.0 | Quaternius | `public/assets/models/character.glb` |
| Universal Animation Library [Standard] – Clips `Idle_Loop`, `Walk_Loop`, `Jog_Fwd_Loop`, `Sprint_Loop`, `Jump_Start`, `Jump_Loop`, `Jump_Land`, `Swim_Idle_Loop`, `Swim_Fwd_Loop` | itch.io | https://quaternius.itch.io/universal-animation-library | CC0 1.0 | Quaternius | `public/assets/models/character-anims.glb` |

## Bearbeitungen

- **Charakter:** Kleidung (Techwear-Jacke, Cargo-Hose, Stiefel) und Leuchtnähte wurden per Skript in die Textur gemalt (`scripts/assets/build-character.ts`). Rucksack, Kragen, Taschen, Stiefel und Gleiter sind eigene, im Code erzeugte Meshes. Die Texturen sind verkleinert und als WebP gespeichert, die Geometrie ist mit meshopt komprimiert.
- **Animationen:** Aus 43 Clips wurden nur die 9 benötigten übernommen, und zwar nur als Rotationen plus Beckenposition. Klettern, Hängen am Gleiter und Hochziehen gibt es in der Bibliothek nicht. Diese Posen entstehen im Code (`src/player/poses.ts`).

Die Original-Pakete sind nicht im Repository, nur die daraus erzeugten Dateien.
