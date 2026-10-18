# City 3D Map

A 3D city map website with a React/Vite frontend and a Python (FastAPI) backend.

## Requirements
- Node.js 18 or newer
- Python 3.10 or newer

## Setup (run once, in PowerShell, inside the project root folder)
```powershell
npm install
cd backend
pip install -r requirements.txt
cd ..
```

## Run option 1: two PowerShell windows

Window 1 (backend):
```powershell
cd backend
python -m uvicorn main:app --reload
```

Window 2 (website), opened in the project root folder:
```powershell
npm run dev
```

## Run option 2: one command (Windows)

In PowerShell, inside the project root folder:
```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```
This opens both windows automatically.

## Open the site
Open the address printed by `npm run dev` in your browser (usually http://localhost:5173).

## Environment variables
If a `.env.example` file exists, copy it to `.env` and fill in the values.
