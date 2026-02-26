# PowerShell Migration Script for CreativeOS
# This script uses Robocopy to migrate video production files to a new structured system.

# --- Configuration ---
$sourceBase = "E:\Documents\Edit FIles"
$destBase = "C:\CreativeOS"
$robocopyFlags = "/E /XO /R:1 /W:1" # /E: Recursive, /XO: Exclude Older, /R: Retry 1 time, /W: Wait 1 second between retries

# Excluded top-level directories from any copy operation
$excludedDirs = @(
    "$sourceBase\CacheClip",
    "$sourceBase\.gallery",
    "$sourceBase\Resolve Project Backups",
    "$sourceBase\Media Cache",
    "$sourceBase\ProxyMedia"
)

# --- Helper Function ---
Function Invoke-Robocopy {
    param(
        [string]$source,
        [string]$destination,
        [string]$folderName
    )

    if (-not (Test-Path -Path $source)) {
        Write-Warning "Source folder '$source' not found. Skipping '$folderName'."
        return
    }

    Write-Host "Migrating $folderName..."
    # Ensure the parent of the destination exists before creating the final directory
    $destParent = Split-Path -Path $destination -Parent
    if (-not (Test-Path -Path $destParent)) {
        New-Item -ItemType Directory -Path $destParent -Force | Out-Null
    }
    # Robocopy will create the final destination directory
    
    # Construct the full Robocopy command
    $excludeString = ($excludedDirs | ForEach-Object { "/XD ""$_""" }) -join " "
    $command = "robocopy ""$source"" ""$destination"" $robocopyFlags $excludeString"
    
    Write-Host "Executing: $command"
    Invoke-Expression $command
    Write-Host "`n" # Add a newline for better readability
}

# --- 1. Client Folders ---
Write-Host "--- Starting Client Migration ---
"
$clientSourceBasePath = Join-Path -Path $sourceBase -ChildPath "Video"
$clientDestBasePath = Join-Path -Path $destBase -ChildPath "01_Projects\Clients"
$clientFolders = @(
    "SternUP", "TedX", "Monjola", "Sharon", 
    "Paul Praise", "School Rex", "success light"
)

$processedVideoFolders = [System.Collections.Generic.List[string]]::new()
$clientFolders | ForEach-Object { $processedVideoFolders.Add($_) }


foreach ($client in $clientFolders) {
    $sourcePath = Join-Path -Path $clientSourceBasePath -ChildPath $client
    $destPath = Join-Path -Path $clientDestBasePath -ChildPath $client
    Invoke-Robocopy -source $sourcePath -destination $destPath -folderName "Client: $client"
}

# --- 2. YouTube Channel ---
Write-Host "--- Starting YouTube Migration ---
"
$youtubeFolderName = "J Star Films"
$youtubeDestName = "J_Star_Films" # Destination has a different name
$processedVideoFolders.Add($youtubeFolderName)

$youtubeSourcePath = Join-Path -Path $clientSourceBasePath -ChildPath $youtubeFolderName
$youtubeDestPath = Join-Path -Path $destBase -ChildPath "01_Projects\Video\$youtubeDestName"
Invoke-Robocopy -source $youtubeSourcePath -destination $youtubeDestPath -folderName "YouTube: $youtubeFolderName"

# --- 3. Other Video Folders ---
Write-Host "--- Migrating Miscellaneous Video Folders ---
"
$miscDestPath = Join-Path -Path $destBase -ChildPath "01_Projects\Video\Misc"
$allVideoFolders = Get-ChildItem -Path $clientSourceBasePath -Directory | Select-Object -ExpandProperty Name

$otherVideoFolders = $allVideoFolders | Where-Object { $_ -notin $processedVideoFolders }

if ($otherVideoFolders) {
    foreach ($folder in $otherVideoFolders) {
        $sourcePath = Join-Path -Path $clientSourceBasePath -ChildPath $folder
        # Place it inside a subfolder within Misc to preserve its name
        $destPath = Join-Path -Path $miscDestPath -ChildPath $folder
        Invoke-Robocopy -source $sourcePath -destination $destPath -folderName "Misc Video: $folder"
    }
} else {
    Write-Host "No miscellaneous video folders found to migrate."
}


# --- 4. Global Assets (Stock) ---
Write-Host "--- Starting Global Assets Migration ---
"
$stockSourcePath = Join-Path -Path $sourceBase -ChildPath "Stock"
$stockDestPath = ""

if (Test-Path -Path "D:\") {
    $stockDestPath = "D:\Assets\Stock"
    Write-Host "D: drive detected. Setting assets destination to $stockDestPath"
} else {
    $stockDestPath = Join-Path -Path $destBase -ChildPath "04_Global_Assets\Stock"
    Write-Host "D: drive not found. Setting assets destination to $stockDestPath"
}
Invoke-Robocopy -source $stockSourcePath -destination $stockDestPath -folderName "Global Assets: Stock"

# --- 5. Scripts ---
Write-Host "--- Starting Scripts Migration ---
"
$scriptsSourcePath = Join-Path -Path $sourceBase -ChildPath "Scripts\Templates"
$scriptsDestPath = Join-Path -Path $destBase -ChildPath "00_System\Templates\Old_Imports"
Invoke-Robocopy -source $scriptsSourcePath -destination $scriptsDestPath -folderName "Scripts: Templates"

# --- Completion ---
Write-Host "----------------------------------------"
Write-Host "Migration script finished."
Write-Host "Please review the Robocopy output above for any errors."
Write-Host "----------------------------------------
"

Pause # Pause to keep the window open for review
