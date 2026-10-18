# City 3D Map

An interactive 3D city map web app with a professional landing page, a 30-minute free trial, and paid hourly access via UPI.

## Features

- Landing page shown before the map loads
- 30 minutes of free access, with a live countdown timer
- After the free time, users pay for each additional hour by scanning a UPI QR code
- Payment IDs are validated (exactly 12 digits) and must be approved by the site owner before access is unlocked
- Each transaction ID can be used only once

## Tech stack

- Frontend: React + Vite
- Backend: Python, FastAPI, Uvicorn
- QR code generation: qrcode.react

## Requirements

- Node.js 18 or newer
- Python 3.10 or newer

## Setup (run once)

Open PowerShell inside the project root folder (the folder that contains `package.json`) and run:

```powershell
npm install
cd backend
pip install -r requirements.txt
cd ..
```

## Run the app

Option 1: one command (Windows). In PowerShell inside the project root folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

This opens two PowerShell windows, one for the backend and one for the website.

Option 2: two windows by hand.

Window 1 (backend), opened in the project root folder:

```powershell
cd backend
python -m uvicorn main:app --reload
```

Window 2 (website), opened in the project root folder:

```powershell
npm run dev
```

Then open http://localhost:5173/ in your browser. The backend runs on http://localhost:8000.

## How access and payment work

1. The user opens the site and sees the landing page.
2. Clicking **Start free 30-minute session** starts a countdown and opens the map.
3. When the time runs out, a payment screen appears with a UPI QR code (price per hour is set in `src/App.jsx` as `PRICE_PER_HOUR`).
4. After paying, the user enters the 12-digit transaction / UTR ID.
5. The ID is sent to the backend as "pending" and the user sees "Waiting for confirmation".
6. The site owner opens the admin page, checks the ID against their UPI / bank app, and clicks **Approve** or **Reject**.
7. When approved, the user's page unlocks automatically for 1 hour. The cycle repeats for every further hour.

## Testing the payment flow (for evaluators)

1. Start the app and open http://localhost:5173/
2. Skip the free 30 minutes: press F12, open the **Console** tab, paste this and press Enter:

```javascript
localStorage.clear(); localStorage.setItem('city3d_access_v1', JSON.stringify({accessEnd: Date.now()+3000})); location.reload()
```

3. After 3 seconds the payment screen appears. Enter any 12-digit number, for example `123456789012`, and click **Submit payment ID**.
4. Open the admin page in a new browser tab:

5. Click **Approve**. The website tab unlocks within about 3 seconds.

To go back to the landing page, paste this in the browser Console:

```javascript
localStorage.clear(); location.reload()
```

## Configuration

- Price per hour and free minutes: constants at the top of `src/App.jsx` (`PRICE_PER_HOUR`, `FREE_MINUTES`).
- Admin key: set the `PAYMENT_ADMIN_KEY` environment variable before starting the backend. If it is not set, the default key in `backend/payments.py` is used. Change it before any real deployment.
- Payment requests are stored locally in `backend/payments.json`, which is created automatically and is not committed to Git.

## Project structure

## Limitations

- Payments are not verified automatically. The owner approves each transaction ID manually after checking their payment app.
- The free-trial timer is stored in the browser, so clearing site data resets it.
- The backend must be running for payments to be submitted and approved.
- Fully automatic payment verification would require a payment gateway such as Razorpay.
