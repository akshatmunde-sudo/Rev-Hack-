# Collapse Risk Dashboard

A disaster-management web app that shows a photorealistic 3D globe, lets you click any building, and estimates its structural collapse risk from live local weather.

> **Status: prototype.** The risk formula is a placeholder to prove the pipeline works. It is **not** an engineering calculation and must not be used for real safety decisions. Always consult a licensed structural engineer.

---

## Features

- Full-screen 3D map using **CesiumJS** with **Google Photorealistic 3D Tiles**
- Click a building to highlight it and read its height and coordinates
- Live wind data from the **OpenWeather API**
- Collapse risk score (%) with a status: **Low**, **Elevated** or **Critical**
- Recommended actions to lower risk (maintenance, inspections, securing items), tailored to status, wind and height
- Works on small houses too: if a building has no height data, 6 m is assumed, and unmapped spots can still be analyzed

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React (Vite) |
| 3D map | CesiumJS (`cesium`, `vite-plugin-cesium`) |
| Backend | Python, FastAPI, Uvicorn, httpx |
| Weather | OpenWeather API |

## Project structure

```
city-3d-map/
├── .env                      <- Cesium token (frontend)
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── index.css
│   ├── App.jsx               <- dashboard and recommendations
│   └── components/
│       └── CesiumMap.jsx     <- 3D map and click logic
└── backend/
    ├── .env                  <- OpenWeather key (backend)
    └── main.py               <- FastAPI server
```

---

## Prerequisites

- [Node.js](https://nodejs.org) 18 or newer (LTS)
- [Python](https://www.python.org/downloads/) 3.9 or newer
- A free **Cesium ion** account: https://ion.cesium.com
- A free **OpenWeather** account: https://openweathermap.org

## Setup

### 1. Get your API keys

**Cesium ion token**
1. Log in at https://ion.cesium.com and open **Access Tokens**. Copy your default token.
2. Open **Asset Depot**, find **Google Photorealistic 3D Tiles**, and click **Add to my assets**.

**OpenWeather key**
1. Log in at https://openweathermap.org, click your name, then **My API keys**, and copy the key.
2. New keys can take 1 to 2 hours to activate.

### 2. Frontend

In the `city-3d-map` folder, create a file named `.env`:

```
VITE_CESIUM_TOKEN=paste_your_cesium_token_here
```

Then install dependencies:

```powershell
npm install
```

### 3. Backend

In the `backend` folder, create a file named `.env`:

```
OPENWEATHER_API_KEY=paste_your_openweather_key_here
```

Then install the Python packages:

```powershell
cd backend
pip install fastapi uvicorn httpx python-dotenv
```

---

## Running the app

You need **two terminal windows open at the same time**.

**Terminal 1: backend** (inside the `backend` folder)

```powershell
python -m uvicorn main:app --reload
```

It runs at http://localhost:8000. API docs are at http://localhost:8000/docs.

**Terminal 2: frontend** (inside the main `city-3d-map` folder)

```powershell
npm run dev
```

Open the address it prints (usually http://localhost:5173).

## How to use

1. Wait for the 3D New York scene to load.
2. Left-click any building. It turns red.
3. The dashboard (top-left) shows height, wind speed, collapse risk, recommended actions and status.

**Map controls**
- Left-drag: pan
- Scroll or right-drag: zoom
- Ctrl + left-drag (or middle-drag): tilt and rotate

---

## API

### `POST /api/risk-score`

Request:

```json
{ "lat": 40.7128, "lng": -74.006, "height": 100 }
```

Response:

```json
{ "wind_speed": 5.1, "risk_score": 17.6, "status": "Low" }
```

Current placeholder formula:

```
risk = (wind_speed * 1.5) + (height * 0.1)     # clamped to 0-100
Low < 30  |  Elevated 30-59  |  Critical >= 60
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Dashboard says "Backend error" | The backend terminal is not running, or was started from the wrong folder. Start it inside `backend`. |
| "OpenWeather key invalid or not activated yet" | Wait an hour or two after creating the key. Check for stray spaces or quotes in `backend/.env`. |
| Map is blank or gray | Check `VITE_CESIUM_TOKEN` in the main `.env`, and that Google 3D Tiles were added to your Cesium assets. Restart `npm run dev` after editing `.env`. |
| Clicking a house does nothing | It may be missing from OpenStreetMap. The app places a red dot and uses an assumed 6 m height. |
| Height shows 6.0 m | The building has no height data, so a default is assumed. |
| `pip` or `python` not recognized | Reinstall Python and tick **Add Python to PATH**. |

## Known limitations

- Google 3D Tiles cover about 2,500 cities, not the whole Earth. Elsewhere you only get plain extruded boxes.
- Google's tiles are for display only. Building data comes from a hidden OpenStreetMap layer, so heights are estimates.
- The risk formula ignores wind direction, gusts, rain, footprint area, construction type and roof type.
- Check Google's and Cesium's current terms and pricing before any public or commercial deployment.

## Roadmap

- [ ] Real wind-load calculation (pressure, height, exposed area)
- [ ] Construction type and roof type inputs for small houses
- [ ] Gusts, rain and extreme-weather alerts
- [ ] City search bar
- [ ] Wind arrows and rain overlay on the globe
- [ ] "Schedule maintenance" button with a database
- [ ] Deployment

## Security notes

- Never commit your `.env` files. Add `.env` to `.gitignore`.
- Restrict your Cesium token to your domain before deploying.
- Keep the OpenWeather key in the backend only.

## Credits

- 3D map: [CesiumJS](https://cesium.com/platform/cesiumjs/)
- Photorealistic visuals: Google Photorealistic 3D Tiles via Cesium ion
- Building data: [OpenStreetMap](https://www.openstreetmap.org) contributors
- Weather: [OpenWeather](https://openweathermap.org)