# Start the Windows build of Lokus and use it the way a person would, through the dev channel:
# open a folder, make a note, read it back from the window and from disk, and keep a picture.
# Run by CI on a Windows machine after `pnpm tauri build --debug --no-bundle`.
$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot\.."
$app = Join-Path $root "target\debug\lokus-desktop.exe"
$cli = Join-Path $root "target\debug\lokus.exe"
$vault = Join-Path $env:RUNNER_TEMP "lokus-smoke"
$out = Join-Path $root "windows-smoke"
New-Item -ItemType Directory -Force -Path $vault, $out | Out-Null

function Lokus { & $cli app @args; if ($LASTEXITCODE -ne 0) { throw "lokus app $args failed" } }
function Shot($name) {
  Add-Type -AssemblyName System.Windows.Forms, System.Drawing
  $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
  $bmp.Save((Join-Path $out "$name.png"))
}

$proc = Start-Process -FilePath $app -PassThru -RedirectStandardError (Join-Path $out "app.log")
try {
  $up = $false
  foreach ($i in 1..60) {
    if (Test-NetConnection -ComputerName 127.0.0.1 -Port 47615 -InformationLevel Quiet -WarningAction SilentlyContinue) { $up = $true; break }
    if ($proc.HasExited) { throw "Lokus exited with $($proc.ExitCode) before it was ready" }
    Start-Sleep -Seconds 2
  }
  if (-not $up) { throw "Lokus did not open its dev channel within two minutes" }
  Start-Sleep -Seconds 5
  Shot "1-started"

  Lokus vault.open "path=$vault" | Out-Null
  Start-Sleep -Seconds 3
  Lokus note.create "path=Hello Windows.md" "text=# Hello Windows`n`nWritten by the smoke test." | Out-Null
  Start-Sleep -Seconds 2
  if (-not (Test-Path (Join-Path $vault "Hello Windows.md"))) { throw "the note was not written to disk" }

  $seen = (Lokus ui.measure "selector=body") -join "`n"
  $seen | Set-Content (Join-Path $out "window.json")
  if ($seen -notmatch "Hello Windows") { throw "the window does not show the note that was made" }
  $size = $seen | ConvertFrom-Json
  if ($size.window.width -lt 400) { throw "the window is $($size.window.width) wide; nothing was laid out" }

  $read = (Lokus note.read "path=Hello Windows.md") -join "`n"
  if ($read -notmatch "Written by the smoke test") { throw "the note read back is not the note written" }
  $found = (Lokus search.query "q=smoke") -join "`n"
  $found | Set-Content (Join-Path $out "search.json")
  Shot "2-note-made"
  Write-Host "Lokus runs on Windows: folder opened, note written, shown, read back and searched."
}
finally {
  if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
}
