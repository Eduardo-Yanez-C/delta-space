@echo off
REM Arranque local profesional: API (puerto 4000) + Web (puerto 3000).
REM Ejecutar desde la raíz del monorepo (donde está package.json).
cd /d "%~dp0.."
echo Iniciando API y Web...
call npm run start:local
