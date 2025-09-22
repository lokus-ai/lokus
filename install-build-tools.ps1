# Simple Windows Build Tools Installation Script for Lokus

Write-Host "Installing Visual Studio Build Tools..." -ForegroundColor Cyan

# Download Build Tools installer
$installerUrl = "https://aka.ms/vs/17/release/vs_buildtools.exe"
$installerPath = "$env:TEMP\vs_buildtools.exe"

Write-Host "Downloading installer..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath

Write-Host "Starting installation..." -ForegroundColor Yellow
Write-Host "This will open the Visual Studio Installer." -ForegroundColor Green
Write-Host "Please select 'Desktop development with C++' workload and click Install." -ForegroundColor Green

# Start installer with C++ workload
Start-Process -FilePath $installerPath -ArgumentList "--add", "Microsoft.VisualStudio.Workload.VCTools", "--includeRecommended", "--passive" -Wait

Write-Host "`nInstallation started!" -ForegroundColor Green
Write-Host "Once complete, you can run: START-DEV-NOW.bat" -ForegroundColor Cyan