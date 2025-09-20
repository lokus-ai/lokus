@echo off
echo Starting Lokus Development with MSVC Fix...
echo.

REM Find Visual Studio installation
set "VSWHERE=C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE%" (
    echo ERROR: Visual Studio installer not found!
    echo Please install Visual Studio Build Tools with C++ workload.
    pause
    exit /b 1
)

REM Get VS installation path
for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do (
    set VS_PATH=%%i
)

if not defined VS_PATH (
    echo ERROR: Visual Studio with C++ tools not found!
    echo Please install Visual Studio Build Tools with "Desktop development with C++" workload.
    pause
    exit /b 1
)

echo Found Visual Studio at: %VS_PATH%

REM Call vcvars64 to set up environment
call "%VS_PATH%\VC\Auxiliary\Build\vcvars64.bat"

echo.
echo MSVC environment configured successfully!
echo Starting development server...
echo.

npm run tauri dev