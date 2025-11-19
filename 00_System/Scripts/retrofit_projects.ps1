# Define the root directory where all client folders are located.
$clientsRoot = "C:\CreativeOS\01_Projects\Clients"

# Define the required text encoding: UTF-8 without Byte Order Mark (BOM).
$utf8NoBomEncoding = [System.Text.UTF8Encoding]::new($false)

# Get all client folders directly under the root.
Get-ChildItem -Path $clientsRoot -Directory | ForEach-Object {
    $clientFolder = $_

    # Inside each client folder, get all the project folders.
    Get-ChildItem -Path $clientFolder.FullName -Directory | ForEach-Object {
        $projectFolder = $_

        # Define the full paths for the files to be created.
        $metaFilePath = Join-Path -Path $projectFolder.FullName -ChildPath ".project_meta.json"
        $notesFilePath = Join-Path -Path $projectFolder.FullName -ChildPath "00_Notes\Idea.md"

        # Check if the metadata file already exists.
        if (-not (Test-Path -Path $metaFilePath)) {
            
            # Find the oldest file recursively. If none found, use the folder's creation time.
            $oldestFile = Get-ChildItem -Path $projectFolder.FullName -File -Recurse | Sort-Object CreationTime | Select-Object -First 1
            
            $creationDate = if ($oldestFile) {
                $oldestFile.CreationTime
            } else {
                $projectFolder.CreationTime
            }

            # Format the creation date as yyyy-MM-dd.
            $creationDateStr = $creationDate.ToString('yyyy-MM-dd')

            # Create a PowerShell custom object with the required metadata.
            $projectMeta = [PSCustomObject]@{
                name     = $projectFolder.Name
                slug     = "${creationDateStr}_$($projectFolder.Name)"
                type     = "Video"
                created  = $creationDateStr
                client   = $clientFolder.Name
                template = "legacy_import"
                root     = $projectFolder.FullName
            }

            # Convert the object to a JSON string.
            $jsonContent = $projectMeta | ConvertTo-Json -Depth 5
            
            # Write the JSON string to the file using the .NET method to ensure no BOM.
            [System.IO.File]::WriteAllText($metaFilePath, $jsonContent, $utf8NoBomEncoding)
        }

        # Check if the notes file already exists.
        if (-not (Test-Path -Path $notesFilePath)) {
            # Create the '00_Notes' directory if it doesn't exist. -Force suppresses errors if it exists.
            $notesDir = Split-Path -Path $notesFilePath -Parent
            if (-not (Test-Path -Path $notesDir)) {
                New-Item -Path $notesDir -ItemType Directory -Force | Out-Null
            }
            
            # Create the empty 'Idea.md' file.
            New-Item -Path $notesFilePath -ItemType File | Out-Null
        }

        # Print a confirmation message to the console.
        Write-Host "Smartified: $($clientFolder.Name) - $($projectFolder.Name)"
    }
}

Write-Host "`nAll projects have been processed."
