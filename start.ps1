$root = $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$root\backend'; python -m uvicorn main:app --reload"
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$root'; npm run dev"
