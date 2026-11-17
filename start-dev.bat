@echo off
echo Starting Navodaya Connect Backend and Mobile App...
start "Navodaya API Server (Port 3001)" cmd /k "pnpm --filter @workspace/api-server dev"
timeout /t 3 /nobreak >nul
start "Navodaya Mobile App (Port 8081)" cmd /k "pnpm --filter @workspace/mobile dev"
echo Both servers started! Open http://localhost:8081 in your browser.

