@echo off
setlocal
title HyperDrive Live Bridge - F1 26
cd /d "%~dp0"

echo.
echo ==============================================
echo  HYPERDRIVE LIVE BRIDGE - F1 26
echo ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado.
  echo Instala Node.js 20 o superior y vuelve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

echo Actualizando Live Bridge desde GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/HyperDriveLeague/hyperdriveleague.github.io/main/tools/live-bridge/bridge.js' -OutFile 'bridge.js';" ^
  "Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/HyperDriveLeague/hyperdriveleague.github.io/main/tools/live-bridge/package.json' -OutFile 'package.json';" ^
  "Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/HyperDriveLeague/hyperdriveleague.github.io/main/tools/live-bridge/README.md' -OutFile 'README.md';"

if errorlevel 1 (
  echo.
  echo [ERROR] No se pudo descargar la ultima version desde GitHub.
  echo Comprueba tu conexion a Internet.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] No se pudieron instalar las dependencias.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo Iniciando HyperDrive Live Bridge...
echo Mantén esta ventana abierta durante Qualy y Carrera.
echo.
call npm start
pause
