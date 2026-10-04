@echo off
title HyperDrive Live Bridge - F1 26
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js no esta instalado.
  echo Instala Node.js 20 o superior y vuelve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo Instalando dependencias del Live Bridge...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] No se pudieron instalar las dependencias.
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
