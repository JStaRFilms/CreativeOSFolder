# PowerShell Script for Creative Assets Migration
# This script reorganizes files from E:\_CreativeAssets to E:\Assets using Robocopy.
# VERSION 5: Renamed "Presets_Downloaded" to "Presets" based on user feedback.

# --- Configuration ---
$sourceRoot = "E:\_CreativeAssets"
$destRoot = "E:\Assets"
$rescueRoot = "C:\CreativeOS\01_Projects\Code"

# --- Helper Function ---
function Move-Asset {
    param(
        [string]$Source,
        [string]$Destination,
        [string]$Description
    )
    if (Test-Path $Source) {
        Write-Host " migrating $Description..." -ForegroundColor Yellow
        Write-Host "  FROM: $Source"
        Write-Host "  TO:   $Destination"
        # Ensure destination directory exists
        New-Item -ItemType Directory -Force -Path $Destination | Out-Null
        
        # Robocopy Call:
        # /E    :: Copy subdirectories, including empty ones.
        # /XO   :: Exclude older files.
        # /MOVE :: Move files and directories (delete from source).
        # /DCOPY:T :: Copies directory timestamps.
        robocopy $Source $Destination /E /XO /MOVE /DCOPY:T
        
        Write-Host "  Done migrating $Description." -ForegroundColor Green
        Write-Host ""
    } else {
        # This is not an error, it just means the source was already moved.
        Write-Host "SKIPPING: '$Description' source not found (already moved): $Source" -ForegroundColor DarkGray
        Write-Host ""
    }
}

# --- Preparation ---
Write-Host "Starting Creative Assets Migration (Version 5)..."
Write-Host "Source: $sourceRoot"
Write-Host "Destination: $destRoot"
Write-Host "---"

# Create/verify all possible destination directories
$destDirs = @(
    "$destRoot\Audio\Music",
    "$destRoot\Audio\SFX",
    "$destRoot\Software\AfterEffects",
    "$destRoot\Software\Premiere",
    "$destRoot\Software\Resolve",
    "$destRoot\Software\Plugins",
    "$destRoot\Software\Photoshop\Templates",
    "$destRoot\Software\Presets",
    "$destRoot\Graphics\Textures",
    "$destRoot\Graphics\PNGs",
    "$destRoot\Graphics\Icons",
    "$destRoot\Graphics\Stock_Images",
    "$destRoot\Graphics\HDRI",
    "$destRoot\Fonts",
    "$destRoot\Reference",
    "$destRoot\Video\Overlays",
    "$destRoot\Video\Stock_Footage",
    $rescueRoot
)

Write-Host "Verifying destination folders..."
foreach ($dir in $destDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}
Write-Host "Done."
Write-Host ""


# --- 1. RESCUE MISSION ---
Write-Host "1. Performing High-Priority Rescue Mission..." -ForegroundColor Cyan
$rescueSource = "$sourceRoot\03_Stock_Library\02_Audio\wavelength"
$rescueDest = "$rescueRoot\wavelength"
Move-Asset -Source $rescueSource -Destination $rescueDest -Description "Wavelength project"


# --- 2. AUDIO MIGRATION ---
Write-Host "2. Migrating Audio..." -ForegroundColor Cyan
Move-Asset -Source "$sourceRoot\03_Stock_Library\02_Audio\Music" -Destination "$destRoot\Audio\Music" -Description "Music library"
Move-Asset -Source "$sourceRoot\03_Stock_Library\02_Audio\Sound_Effects" -Destination "$destRoot\Audio\SFX" -Description "Sound Effects library"


# --- 3. SOFTWARE ASSETS ---
Write-Host "3. Migrating Software Assets..." -ForegroundColor Cyan

# Search and move folders by name (After Effects, Premiere, etc.)
$searchPaths = @("$sourceRoot\02_Presets_and_LUTs", "$sourceRoot\03_Stock_Library")
$moveToAfterEffects = @("After Effects", "AEMotion Graphics")
$moveToPremiere = @("Premiere Pro")
$moveToResolve = @("Davinci Resolve")

foreach ($path in $searchPaths) {
    if(Test-Path $path){
        # Use -ErrorAction SilentlyContinue for paths that might have been deleted
        Get-ChildItem -Path $path -Directory -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
            if ($_.Name -in $moveToAfterEffects) {
                Move-Asset -Source $_.FullName -Destination "$destRoot\Software\AfterEffects" -Description "$($_.Name) assets"
            }
            if ($_.Name -in $moveToPremiere) {
                Move-Asset -Source $_.FullName -Destination "$destRoot\Software\Premiere" -Description "$($_.Name) assets"
            }
            if ($_.Name -in $moveToResolve) {
                Move-Asset -Source $_.FullName -Destination "$destRoot\Software\Resolve" -Description "$($_.Name) assets"
            }
        }
    }
}

# Move other specific software assets
Move-Asset -Source "$sourceRoot\01_Plugins" -Destination "$destRoot\Software\Plugins" -Description "Plugins"
Move-Asset -Source "$sourceRoot\03_Stock_Library\04_Templates_and_Presets\Photoshop" -Destination "$destRoot\Software\Photoshop\Templates" -Description "Photoshop Templates"
# Move downloaded presets, preserving their internal structure
Move-Asset -Source "$sourceRoot\02_Presets_and_LUTs\Presets\Presets" -Destination "$destRoot\Software\Presets" -Description "Presets"


# --- 4. GRAPHICS & IMAGES ---
Write-Host "4. Migrating Graphics & Images..." -ForegroundColor Cyan
Move-Asset -Source "$sourceRoot\03_Stock_Library\03_Images\Textures" -Destination "$destRoot\Graphics\Textures" -Description "Textures"
Move-Asset -Source "$sourceRoot\03_Stock_Library\03_Images\PNGs_and_Cutouts" -Destination "$destRoot\Graphics\PNGs" -Description "PNGs & Cutouts"
Move-Asset -Source "$sourceRoot\03_Stock_Library\Icons" -Destination "$destRoot\Graphics\Icons" -Description "Icons"
Move-Asset -Source "$sourceRoot\03_Stock_Library\Emoji" -Destination "$destRoot\Graphics\Icons" -Description "Emoji Icons"
Move-Asset -Source "$sourceRoot\03_Stock_Library\HDRI" -Destination "$destRoot\Graphics\HDRI" -Description "HDRI files"
Move-Asset -Source "$sourceRoot\03_Stock_Library\05_Technical" -Destination "$destRoot\Graphics\HDRI" -Description "Technical files (HDRI Zip)"

# Move the rest of the images
Move-Asset -Source "$sourceRoot\03_Stock_Library\03_Images" -Destination "$destRoot\Graphics\Stock_Images" -Description "Remaining Stock Images"


# --- 5. VIDEO ---
Write-Host "5. Migrating Video..." -ForegroundColor Cyan
Move-Asset -Source "$sourceRoot\03_Stock_Library\01_Video\Overlays_and_Effects" -Destination "$destRoot\Video\Overlays" -Description "Video Overlays"
# Move the rest of the video footage
Move-Asset -Source "$sourceRoot\03_Stock_Library\01_Video" -Destination "$destRoot\Video\Stock_Footage" -Description "Stock Video Footage"


# --- 6. FONTS ---
Write-Host "6. Migrating Fonts..." -ForegroundColor Cyan
Move-Asset -Source "$sourceRoot\05_Fonts" -Destination "$destRoot\Fonts" -Description "Fonts"


# --- 7. REFERENCE ---
Write-Host "7. Migrating Reference Material..." -ForegroundColor Cyan
Move-Asset -Source "$sourceRoot\03_Stock_Library\06_Reference_and_Inspo" -Destination "$destRoot\Reference" -Description "Reference & Inspiration"


# --- Completion ---
Write-Host "---"
Write-Host "Migration script finished." -ForegroundColor Green
Write-Host "Please review the output above for any errors or skipped files."
Write-Host "The original folder structure at '$sourceRoot' should now be mostly empty."
pause
