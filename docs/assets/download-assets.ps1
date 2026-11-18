# download-assets.ps1  (ueberarbeitete Version)
# Laedt die CC0-Assets von Poly Haven und ambientCG in .\assets\
# Aufruf in PowerShell im Ordner "ergebnis":
#   powershell -ExecutionPolicy Bypass -File .\download-assets.ps1
#
# Aenderungen gegenueber der Cowork-Version:
# - Fortschrittsbalken aus (macht Invoke-WebRequest in PowerShell 5.1 um ein Vielfaches schneller)
# - eigener User-Agent fuer die Poly-Haven-API
# - bereits vorhandene Dateien werden uebersprungen (Skript kann erneut gestartet werden)
# - Fehlerliste am Ende
# - modular_wooden_pier entfernt (ca. 85.000 Polygone, Steg wird laut SPEC im Code gebaut)
# - Dach: clay_roof_tiles_02 (warme Tonziegel wie in den Referenzbildern) statt roof_slates_02

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root   = Join-Path $PSScriptRoot 'assets'
$api    = 'https://api.polyhaven.com/files'
$ua     = 'portfolio-insel-asset-script'
$failed = New-Object System.Collections.Generic.List[string]

function Get-Dir($p) {
    if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
}

function Save-Url($url, $dest) {
    if (Test-Path $dest) { Write-Host "  vorhanden: $(Split-Path $dest -Leaf)"; return }
    Get-Dir (Split-Path $dest)
    try {
        Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -UserAgent $ua
        Write-Host "  geladen:   $(Split-Path $dest -Leaf)"
    }
    catch {
        Write-Warning "FEHLER: $url -> $($_.Exception.Message)"
        $script:failed.Add($url)
    }
}

function Get-Info($id) {
    try { Invoke-RestMethod -Uri "$api/$id" -UserAgent $ua }
    catch {
        Write-Warning "API-Fehler bei $id : $($_.Exception.Message)"
        $script:failed.Add("API $id")
        $null
    }
}

# ---- Texturen (1K: Farbe, Normal OpenGL, ARM) ----
$textures = [ordered]@{
  'mossy-rock'     = 'mossy_rock'
  'cobblestone'    = 'cobblestone_floor_01'
  'dirt-path'      = 'park_dirt'
  'weathered-wood' = 'old_planks_02'
  'concrete-moss'  = 'concrete_moss'
  'rusty-metal'    = 'rusty_metal_02'
  'sand'           = 'coast_sand_01'
  'roof-clay'      = 'clay_roof_tiles_02'
}
foreach ($name in $textures.Keys) {
    $id = $textures[$name]
    Write-Host "Textur $id"
    $f = Get-Info $id
    if (-not $f) { continue }
    $dir = Join-Path $root "textures\$($name)_1k"
    foreach ($map in @('Diffuse','nor_gl','arm')) {
        $u = $f.$map.'1k'.jpg.url
        if ($u) { Save-Url $u (Join-Path $dir "$($name)_$($map)_1k.jpg") }
        else    { Write-Warning "Karte $map fehlt bei $id"; $failed.Add("$id/$map") }
    }
}

# ---- HDRIs (1K .hdr) ----
$hdris = [ordered]@{
  'day-farm-field-puresky' = 'farm_field_puresky'
  'sunset-belfast-puresky' = 'belfast_sunset_puresky'
  'night-rogland-clear'    = 'rogland_clear_night'
}
foreach ($name in $hdris.Keys) {
    $id = $hdris[$name]
    Write-Host "HDRI $id"
    $f = Get-Info $id
    if (-not $f) { continue }
    $u = $f.hdri.'1k'.hdr.url
    if ($u) { Save-Url $u (Join-Path $root "hdri\$($name)_1k.hdr") }
    else    { Write-Warning "Kein 1K-HDR bei $id"; $failed.Add("$id/hdr") }
}

# ---- Modelle (glTF 1K inkl. .bin und Texturen) ----
$models = [ordered]@{
  'island-tree-01'   = 'island_tree_01'
  'pine-sapling'     = 'pine_sapling_small'
  'shrub-01'         = 'shrub_01'
  'boulder-01'       = 'boulder_01'
  'rock-moss-set-01' = 'rock_moss_set_01'
  'wooden-barrels'   = 'wooden_barrels_01'
  'oil-barrel'       = 'Barrel_01'
  'wooden-crate'     = 'wooden_crate_01'
  'lantern'          = 'Lantern_01'
}
foreach ($name in $models.Keys) {
    $id = $models[$name]
    Write-Host "Modell $id"
    $f = Get-Info $id
    if (-not $f) { continue }
    $g = $f.gltf.'1k'.gltf
    if (-not $g) { Write-Warning "Kein 1K-glTF bei $id"; $failed.Add("$id/gltf"); continue }
    $dir = Join-Path $root "models\$name"
    Save-Url $g.url (Join-Path $dir "$name.gltf")
    if ($g.include) {
        foreach ($p in $g.include.PSObject.Properties) {
            $rel = $p.Name -replace '/', '\'
            Save-Url $p.Value.url (Join-Path $dir $rel)
        }
    }
}

# ---- ambientCG Moos (Zip, 1K JPG) ----
$mossDir = Join-Path $root 'textures\moss-ground_1k'
if (-not (Test-Path $mossDir)) {
    Write-Host "Textur Moss002 (ambientCG)"
    $mossZip = Join-Path $PSScriptRoot 'moss002_1k.zip'
    Save-Url 'https://ambientcg.com/get?file=Moss002_1K-JPG.zip' $mossZip
    if (Test-Path $mossZip) {
        Expand-Archive -Path $mossZip -DestinationPath $mossDir -Force
        Remove-Item $mossZip
    }
} else {
    Write-Host "Textur Moss002 vorhanden"
}

# ---- Zusammenfassung ----
$files = Get-ChildItem $root -Recurse -File | Where-Object { $_.Name -ne '_leer.txt' }
$mb = [math]::Round((($files | Measure-Object Length -Sum).Sum) / 1MB, 1)
Write-Host ""
Write-Host "Fertig: $($files.Count) Dateien, $mb MB gesamt."
Write-Host "Groesste Dateien:"
$files | Sort-Object Length -Descending | Select-Object -First 10 |
    ForEach-Object { "{0,8:N2} MB  {1}" -f ($_.Length / 1MB), $_.FullName.Substring($root.Length) }

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Warning "$($failed.Count) Problem(e):"
    $failed | ForEach-Object { Write-Host "  - $_" }
    Write-Host "Diese Ausgabe an Claude geben."
} else {
    Write-Host "Keine Fehler."
}
