# PowerShell Script for Thumbnail Migration

# --- CONFIGURATION ---
$sourceRoot = "E:\Documents\Export\Thumnails"
$galleryTarget = "C:\CreativeOS\04_Global_Assets\Thumbnails_Mirror"
$archiveRoot = "C:\CreativeOS\02_Exports"
$imageExtensions = @(".jpg", ".jpeg", ".png", ".webp")

# --- SCRIPT LOGIC ---

# Ensure target directories exist
if (-not (Test-Path -Path $galleryTarget)) {
    New-Item -ItemType Directory -Path $galleryTarget -Force | Out-Null
}
if (-not (Test-Path -Path $archiveRoot)) {
    New-Item -ItemType Directory -Path $archiveRoot -Force | Out-Null
}

# Get all files, then filter by extension
$files = Get-ChildItem -Path $sourceRoot -Recurse -File | Where-Object { $imageExtensions -contains $_.Extension }

foreach ($file in $files) {
    try {
        # 1. ANALYZE METADATA
        $creationDate = $file.LastWriteTime
        $dateStamp = Get-Date $creationDate -Format "yyyy-MM-dd"
        $year = $creationDate.Year
        $monthNumber = Get-Date $creationDate -Format "MM"
        $monthName = (Get-Culture).DateTimeFormat.GetMonthName($creationDate.Month)

        # Smart Client and Project Name Logic
        $relativePath = $file.DirectoryName.Substring($sourceRoot.Length).TrimStart('\/')
        $pathParts = $relativePath -split '[\\/]'
        
        $clientName = $pathParts[0]
        
        $projectNameParts = $pathParts[1..($pathParts.Length - 1)]
        $projectName = if ($projectNameParts) {
            ($projectNameParts -join '_') -replace '\s+', ''
        } else {
            # If the file is directly in the client folder, use the client name as the project name
            $clientName
        }


        # Sanitize names for paths and filenames
        $safeClientName = $clientName -replace '[^\w\s-]', ''
        $safeProjectName = $projectName -replace '[^\w\s-]', ''

        # 2. OPERATION A: POPULATE GALLERY (Copy)
        $originalName = $file.Name
        $galleryBaseName = "${dateStamp}_${safeClientName}_${safeProjectName}_$($file.BaseName)"
        $galleryExtension = $file.Extension
        $galleryFileName = "$galleryBaseName$galleryExtension"
        $galleryDestinationPath = Join-Path -Path $galleryTarget -ChildPath $galleryFileName
        
        # Handle duplicates by appending a counter
        $counter = 1
        while (Test-Path -Path $galleryDestinationPath) {
            $galleryFileName = "${galleryBaseName}_$counter$galleryExtension"
            $galleryDestinationPath = Join-Path -Path $galleryTarget -ChildPath $galleryFileName
            $counter++
        }
        
        Copy-Item -Path $file.FullName -Destination $galleryDestinationPath

        # 3. OPERATION B: MOVE TO ARCHIVE (Move)
        $archiveProjectFolder = "${safeClientName}_${safeProjectName}"
        $archiveMonthFolder = "$monthNumber - $monthName"
        $archiveDestinationDir = Join-Path -Path $archiveRoot -ChildPath "\$year\$archiveMonthFolder\$archiveProjectFolder"

        if (-not (Test-Path -Path $archiveDestinationDir)) {
            New-Item -ItemType Directory -Path $archiveDestinationDir -Force | Out-Null
        }
        
        $archiveFilePath = Join-Path -Path $archiveDestinationDir -ChildPath $file.Name
        Move-Item -Path $file.FullName -Destination $archiveFilePath

        # 5. FEEDBACK
        Write-Host "Processed: $($file.Name) -> [Gallery] & [Archive]"

    } catch {
        Write-Error "Failed to process $($file.FullName): $_"
    }
}

# 4. CLEANUP: Remove empty folders in the source directory
Get-ChildItem -Path $sourceRoot -Recurse -Directory | Sort-Object -Property FullName -Descending | ForEach-Object {
    if (-not (Get-ChildItem -Path $_.FullName -Recurse -File)) {
        Write-Host "Removing empty directory: $($_.FullName)"
        Remove-Item -Path $_.FullName -Force
    }
}

Write-Host "Migration script completed."