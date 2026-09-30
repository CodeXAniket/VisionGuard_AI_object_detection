# Starts all three VisionGuard services, each in its own PowerShell window.
# Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File .\visionguard-ai\start-dev.ps1
#
# Prerequisites: MongoDB running, `npm install` done in backend/ and frontend/,
# and the Python venv created in vision/.venv (see README "Setup").

$root = $PSScriptRoot

function Start-Service-Window($title, $folder, $command) {
    $script = "`$Host.UI.RawUI.WindowTitle = '$title'; Set-Location '$root\$folder'; $command"
    Start-Process powershell -ArgumentList '-NoExit', '-Command', $script
}

if (-not (Test-Path "$root\vision\.venv\Scripts\python.exe")) {
    Write-Host "Python venv not found. Create it first:" -ForegroundColor Red
    Write-Host "  cd '$root\vision'; py -3.12 -m venv .venv; .\.venv\Scripts\python.exe -m pip install -r requirements.txt"
    exit 1
}

Start-Service-Window 'VisionGuard - vision (Python)' 'vision' '.\.venv\Scripts\python.exe server.py'
Start-Service-Window 'VisionGuard - backend (Node)' 'backend' 'npm run dev'
Start-Service-Window 'VisionGuard - frontend (React)' 'frontend' 'npm run dev'

Write-Host 'Started 3 windows. Open http://localhost:5173 once the frontend window shows "ready".' -ForegroundColor Green
