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

set CACHEBUST=%RANDOM%%RANDOM%%RANDOM%
echo Descargando la version actual del Live Bridge...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} 'https://raw.githubusercontent.com/HyperDriveLeague/hyperdriveleague.github.io/main/tools/live-bridge/bridge.js?v=%CACHEBUST%' -OutFile 'bridge.js';" ^
  "Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} 'https://raw.githubusercontent.com/HyperDriveLeague/hyperdriveleague.github.io/main/tools/live-bridge/package.json?v=%CACHEBUST%' -OutFile 'package.json';" ^
  "Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} 'https://raw.githubusercontent.com/HyperDriveLeague/hyperdriveleague.github.io/main/tools/live-bridge/README.md?v=%CACHEBUST%' -OutFile 'README.md';"

if errorlevel 1 (
  echo.
  echo [ERROR] No se pudo descargar la ultima version desde GitHub.
  echo Comprueba tu conexion a Internet.
  echo.
  pause
  exit /b 1
)

echo.
echo Actualizando dependencias...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo [ERROR] No se pudieron instalar o actualizar las dependencias.
  echo.
  pause
  exit /b 1
)

echo.
echo Iniciando HyperDrive Live Bridge...
echo Manten esta ventana abierta durante Qualy y Carrera.
echo.
call npm start
pause
