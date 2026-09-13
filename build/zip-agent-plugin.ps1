# Writes a ZIP from Bun's explicit, sorted file list using Windows' built-in .NET API.
# Entry timestamps are fixed; hidden manifests are included because no globbing is used.
param(
  [Parameter(Mandatory = $true)][string]$SourceRoot,
  [Parameter(Mandatory = $true)][string]$ArchivePath,
  [Parameter(Mandatory = $true)][string]$FileList
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$entryNames = Get-Content -LiteralPath $FileList -Raw | ConvertFrom-Json
$entryTimestamp = [DateTimeOffset]::Parse('1980-01-01T00:00:00+00:00', [Globalization.CultureInfo]::InvariantCulture)
$archive = [IO.Compression.ZipFile]::Open($ArchivePath, [IO.Compression.ZipArchiveMode]::Create)
try {
  $entryNames | ForEach-Object {
    $sourcePath = Join-Path -Path $SourceRoot -ChildPath $_
    $entry = $archive.CreateEntry($_, [IO.Compression.CompressionLevel]::Optimal)
    $entry.LastWriteTime = $entryTimestamp
    $inputStream = [IO.File]::OpenRead($sourcePath)
    try {
      $outputStream = $entry.Open()
      try {
        $inputStream.CopyTo($outputStream)
      } finally {
        $outputStream.Dispose()
      }
    } finally {
      $inputStream.Dispose()
    }
  }
} finally {
  $archive.Dispose()
}
