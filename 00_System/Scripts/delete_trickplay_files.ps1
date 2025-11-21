Add-Type -AssemblyName Microsoft.VisualBasic

$nfoFiles = Get-ChildItem -Path . -Include *.nfo -Recurse
foreach ($file in $nfoFiles) {
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($file.FullName, 'OnlyErrorDialogs', 'SendToRecycleBin')
}

$trickplayDirs = Get-ChildItem -Path . -Include *.trickplay -Recurse
foreach ($dir in $trickplayDirs) {
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($dir.FullName, 'OnlyErrorDialogs', 'SendToRecycleBin')
}

$posterFiles = Get-ChildItem -Path . -Include *-poster.jpg -Recurse
foreach ($file in $posterFiles) {
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($file.FullName, 'OnlyErrorDialogs', 'SendToRecycleBin')
}