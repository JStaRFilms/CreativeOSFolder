# USAGE:
# 1. Open a PowerShell terminal.
# 2. Navigate to the root directory: C:\CreativeOS\01_Projects\
# 3. Run the script: .\migrate_projects.ps1

$ErrorActionPreference = 'Stop' # Exit on critical errors

# --- CONFIGURATION ---
$targetDirectory = "C:\CreativeOS\01_Projects\Video\J_Star_Films"
$currentDate = (Get-Date).ToString("yyyy-MM-dd")
# --- END CONFIGURATION ---

if (-not (Test-Path -Path $targetDirectory)) {
    Write-Error "Error: Target directory not found at '$targetDirectory'."
    exit 1
}

# Get only the immediate subdirectories of the target directory
$projectFolders = Get-ChildItem -Path $targetDirectory -Directory

if ($projectFolders.Count -eq 0) {
    Write-Warning "No project folders found in '$targetDirectory'."
    exit 0
}

Write-Output "Starting retrofit for projects in '$targetDirectory'..."

foreach ($projectFolder in $projectFolders) {
    try {
        $originalFolderName = $projectFolder.Name
        $fullPath = $projectFolder.FullName
        # Find the oldest file recursively. If none, use the folder's creation time.
        $oldestFile = Get-ChildItem -Path $fullPath -File -Recurse | Sort-Object CreationTime | Select-Object -First 1
        $creationTimestamp = if ($oldestFile) {
            $oldestFile.CreationTime
        } else {
            $projectFolder.CreationTime
        }
        $creationDate = $creationTimestamp.ToString("yyyy-MM-dd")

        # --- 1. GENERATE METADATA ---

        # Sanitize folder name for slug: replace spaces and special characters with underscores
        $safeFolderName = $originalFolderName -replace '[^a-zA-Z0-9_.-]+', '_'
        $slug = "{0}_{1}" -f $creationDate, $safeFolderName

        # Create the metadata object.
        $metadata = [pscustomobject]@{
            name     = $originalFolderName
            slug     = $slug
            type     = "Video"
            created  = $creationDate
            client   = "J Star Films"
            template = "legacy_import"
            root     = $fullPath
        }

        # Define the path for the metadata file
        $metaFilePath = Join-Path -Path $fullPath -ChildPath ".project_meta.json"

        # Write JSON file with UTF-8 No BOM encoding to prevent compatibility issues
        $utf8NoBomEncoding = [System.Text.UTF8Encoding]::new($false)
        $jsonContent = $metadata | ConvertTo-Json -Depth 5
        [System.IO.File]::WriteAllText($metaFilePath, $jsonContent, $utf8NoBomEncoding)

        # --- 2. CREATE NOTES ---

        # Ensure "00_Notes" directory exists, create if not
        $notesFolderPath = Join-Path -Path $fullPath -ChildPath "00_Notes"
        if (-not (Test-Path -Path $notesFolderPath)) {
            New-Item -Path $notesFolderPath -ItemType Directory -Force | Out-Null
        }

        # Create the "Idea.md" file with the specified content
        $notesFilePath = Join-Path -Path $notesFolderPath -ChildPath "Idea.md"
        $notesContent = "# $originalFolderName`nRetrofitted on $currentDate"
        Set-Content -Path $notesFilePath -Value $notesContent -Encoding UTF8 -Force

        # --- 3. OUTPUT ---
        Write-Output "Retrofitted: $originalFolderName"

    } catch {
        Write-Error "Failed to process folder '$($projectFolder.Name)': $_.Message"
        # Continue to the next folder
    }
}

Write-Output "`nScript finished. Total projects processed: $($projectFolders.Count)."
