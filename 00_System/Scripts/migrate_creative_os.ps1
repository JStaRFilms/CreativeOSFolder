# PowerShell Script for Creative Asset Migration to "CreativeOS"
#
# MODE: COPY ONLY
# This script copies files from a source archive to a new structured destination.
# It does not delete or modify the source files.

# --- CONFIGURATION ---
Param(
    [string]$SourceBase = "E:\Documents\Export",
    [string]$DestBase = "C:\CreativeOS\02_Exports"
)

# --- SCRIPT INITIALIZATION ---
Write-Host "Starting Creative Archive Migration..."
Write-Host "Source: $SourceBase"
Write-Host "Destination: $DestBase"
Write-Host "Mode: COPY ONLY"

# 1. Validate Source Path
if (-not (Test-Path -Path $SourceBase -PathType Container)) {
    Write-Error "FATAL: Source directory '$SourceBase' not found. Please check the path. Exiting."
    exit
}

# Define the three main category paths
$SourceImages = Join-Path -Path $SourceBase -ChildPath "Images"
$SourceVideos = Join-Path -Path $SourceBase -ChildPath "Videos"
$SourceRenders = Join-Path -Path $SourceBase -ChildPath "Renders"

# --- MAIN PROCESSING ---

# 2. Get all files from the source directory recursively
try {
    $allFiles = Get-ChildItem -Path $SourceBase -Recurse -File -ErrorAction Stop
}
catch {
    Write-Error "FATAL: Failed to read files from '$SourceBase'. Error: $($_.Exception.Message). Exiting."
    exit
}

Write-Host "Found $($allFiles.Count) total files to process."
$processedCount = 0

# 3. Iterate over each file and apply the correct logic
foreach ($file in $allFiles) {
    $targetSubfolder = $null
    $fullPath = $file.FullName

    # Determine the file's category and derive the target subfolder name
    if ($fullPath.StartsWith($SourceImages, [System.StringComparison]::OrdinalIgnoreCase)) {
        # --- CATEGORY A: IMAGES (Photography) ---
        $relativeDirPath = $file.Directory.FullName.Substring($SourceImages.Length).TrimStart('\')
        if ([string]::IsNullOrWhiteSpace($relativeDirPath)) { continue } # Skip files directly in 'Images' root
        
        $dirParts = $relativeDirPath.Split([System.IO.Path]::DirectorySeparatorChar)
        
        if ($dirParts.Length -gt 1) {
            # Source: Images\<Category>\<ProjectName> -> Use <ProjectName>
            $targetSubfolder = $dirParts[-1]
        }
        # else: Source: Images\<Category>, file is loose. No project subfolder will be created.

    }
    elseif ($fullPath.StartsWith($SourceVideos, [System.StringComparison]::OrdinalIgnoreCase)) {
        # --- CATEGORY B: VIDEOS (Projects) - Final Flexible Logic ---
        # This logic filters out ANY directory part that looks like a date component (year, month, or day)
        # regardless of its position in the path, to determine the true project name.

        $monthsRegex = '^(Jan(uary)?|Feb(ruary)?|Mar(ch)?|Apr(il)?|May|Jun(e)?|Jul(y)?|Aug(ust)?|Sep(tember)?|Oct(ober)?|Nov(ember)?|Dec(ember)?)$'
        
        $relativeDirPath = $file.Directory.FullName.Substring($SourceVideos.Length).TrimStart('\')
        if ([string]::IsNullOrWhiteSpace($relativeDirPath)) { continue } # Skip files directly in 'Videos' root

        $dirParts = $relativeDirPath.Split([System.IO.Path]::DirectorySeparatorChar) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
        
        # Filter out any directory parts that look like years, months, or days.
        $projectParts = $dirParts | Where-Object {
            $part = $_
            $isDatePart = $false
            if ($part -match '^\d{4}$') {
                $isDatePart = $true
            }
            elseif ($part -match $monthsRegex) {
                $isDatePart = $true
            }
            elseif ($part -match '^\d{1,2}$') {
                $num = 0
                if ([int]::TryParse($part, [ref]$num) -and $num -ge 1 -and $num -le 31) {
                    # It's a valid month or day number
                    $isDatePart = $true
                }
            }
            -not $isDatePart
        }

        if ($projectParts.Count -gt 0) {
            $targetSubfolder = $projectParts -join '_'
        } else {
            $targetSubfolder = $null # No project parts were found
        }
    }
    elseif ($fullPath.StartsWith($SourceRenders, [System.StringComparison]::OrdinalIgnoreCase)) {
        # --- CATEGORY C: RENDERS (Applications) ---
        $relativeDirPath = $file.Directory.FullName.Substring($SourceRenders.Length).TrimStart('\')
        if ([string]::IsNullOrWhiteSpace($relativeDirPath)) { continue } # Skip files directly in 'Renders' root

        $dirParts = $relativeDirPath.Split([System.IO.Path]::DirectorySeparatorChar) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

        if ($dirParts.Length -gt 0) {
            $appName = $dirParts[0]
            if ($dirParts.Length -gt 1) {
                # Source: Renders\<AppName>\<Project> -> <AppName>_<Project>
                $projectName = $dirParts[1..($dirParts.Length - 1)] -join '_'
                $targetSubfolder = "${appName}_${projectName}"
            } else {
                # Source: Renders\<AppName> -> <AppName>
                $targetSubfolder = $appName
            }
        }
    }
    else {
        # Skip files that are not in the three main categories
        continue
    }

    # --- FILE COPY LOGIC ---
    $processedCount++

    # 1. Get Date components from file's LastWriteTime
    $fileDate = $file.LastWriteTime
    $year = $fileDate.ToString("yyyy")
    $monthNum = $fileDate.ToString("MM")
    $monthName = $fileDate.ToString("MMMM")
    $datePath = Join-Path -Path $year -ChildPath "$monthNum - $monthName"

    # 2. Construct the full destination directory path
    $destinationDir = Join-Path -Path $DestBase -ChildPath $datePath
    if (-not [string]::IsNullOrWhiteSpace($targetSubfolder)) {
        $destinationDir = Join-Path -Path $destinationDir -ChildPath $targetSubfolder
    }

    # 3. Create destination directory if it doesn't exist
    if (-not (Test-Path -Path $destinationDir -PathType Container)) {
        try {
            New-Item -Path $destinationDir -ItemType Directory -Force -ErrorAction Stop | Out-Null
        }
        catch {
            Write-Error "ERROR: Could not create directory '$destinationDir'. Skipping file '$($file.FullName)'. Error: $($_.Exception.Message)"
            continue
        }
    }

    # 4. Check if file already exists and should be skipped
    $idealDestPath = Join-Path -Path $destinationDir -ChildPath $file.Name
    if (Test-Path -Path $idealDestPath -PathType Leaf) {
        $destFileItem = Get-Item -Path $idealDestPath
        if ($destFileItem.Length -eq $file.Length) {
            Write-Host "SKIPPING: `"$($file.FullName)`" (already exists with same size)"
            continue # Skip to the next file
        }
    }

    # 5. Handle filename collisions for new or changed files
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    $extension = $file.Extension # Includes the dot "."
    
    $finalDestPath = $idealDestPath
    $version = 2
    while (Test-Path -Path $finalDestPath -PathType Leaf) {
        $newName = "$($baseName)_v$($version)$($extension)"
        $finalDestPath = Join-Path -Path $destinationDir -ChildPath $newName
        $version++
    }

    # 6. Copy the file and provide feedback
    Write-Host "Copying `"$($file.FullName)`" -> `"$($finalDestPath)`""
    try {
        Copy-Item -Path $file.FullName -Destination $finalDestPath -Force -ErrorAction Stop
    }
    catch {
        Write-Error "ERROR: Failed to copy file '$($file.FullName)'. Error: $($_.Exception.Message)"
    }
}

Write-Host "--------------------------------------------------"
Write-Host "Migration script finished."
Write-Host "Processed $processedCount files matching the defined categories."
Write-Host "--------------------------------------------------"
