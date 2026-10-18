import os
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")

app = FastAPI(title="Collapse Risk API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)

# Estimated wind-pressure capacity (Pa) of a structure in good condition.
# These are simplified teaching values, NOT engineering design values.
CAPACITY = {
    "rcc": 3500,
    "steel": 3000,
    "brick_masonry": 2200,
    "wood": 1800,
    "mud": 1000,
    "sheet": 800,
}
ROOF_FACTOR = {"flat_rcc": 1.0, "sloped_tile": 0.85, "metal_sheet": 0.7, "thatch": 0.55}
CONDITION_FACTOR = {"good": 1.0, "fair": 0.8, "poor": 0.55}

NAMES = {
    "rcc": "reinforced concrete",
    "steel": "steel frame",
    "brick_masonry": "brick/block masonry",
    "wood": "timber",
    "mud": "mud/adobe",
    "sheet": "light sheet walls",
    "flat_rcc": "flat concrete slab roof",
    "sloped_tile": "sloped tile roof",
    "metal_sheet": "metal sheet roof",
    "thatch": "thatch roof",
}

STORM_TIPS = {
    "rcc": "Keep people away from balconies, parapets and projecting slabs. Anchor rooftop water tanks and check parapet walls for looseness.",
    "steel": "Check bolted and welded joints and bracing for looseness. Avoid upper floors and large glazed areas during the peak of the storm.",
    "brick_masonry": "Stay away from tall freestanding walls, gable ends and compound walls, which are the first masonry elements to topple in high wind.",
    "wood": "Check post-to-beam connections and add temporary bracing if it is safe to do so. Keep clear of large trees near the house.",
    "mud": "Mud and adobe walls have little resistance to wind and lose strength when wet. Move to a sturdier shelter before the storm arrives.",
    "sheet": "Light sheet walls can peel off in strong gusts. Add temporary fasteners and shelter in a stronger building if possible.",
}
CARE_TIPS = {
    "rcc": "Inspect columns and beams for cracks, rust stains and spalling concrete. Repair exposed rebar and apply an anti-corrosion coat.",
    "steel": "Inspect joints and base plates for rust. Repaint and tighten any loose bolts.",
    "brick_masonry": "Repair cracked mortar and diagonal cracks near doors and windows. Ask an engineer whether tie-beams or bands are present.",
    "wood": "Inspect posts and bases for termites and rot. Treat or replace damaged timber.",
    "mud": "Protect wall bases with a plinth or waterproof plaster and repair cracks before the rainy season.",
    "sheet": "Replace rusted sheets and fasteners and add wind bracing.",
}
ROOF_STORM_TIPS = {
    "flat_rcc": "Make sure rooftop tanks, solar mounts and antennas are anchored, and clear drain outlets so water does not pond.",
    "sloped_tile": "Tiles lift easily in wind. Clip or mortar the ridge and edge tiles and remove any loose ones.",
    "metal_sheet": "Sheet roofs are often the first part to fail. Add fasteners at every purlin, strap the roof to the walls and remove loose sheets.",
    "thatch": "Thatch is easily lifted and soaks through. Weigh it down with ropes or netting and do not shelter beneath it.",
}
ROOF_CARE_TIPS = {
    "flat_rcc": "Check the slab for cracks and waterproofing failure, and keep drains clear.",
    "sloped_tile": "Replace cracked tiles and re-seal the ridge before the storm season.",
    "metal_sheet": "Replace rusted fasteners and sheets and check the roof-to-wall connections.",
    "thatch": "Re-thatch worn areas and add rope or net tie-downs before the storm season.",
}


class BuildingRequest(BaseModel):
    lat: float
    lng: float
    height: float
    construction: str = "brick_masonry"
    roof: str = "sloped_tile"
    condition: str = "fair"
    age_years: int = 20
    simulated_wind: Optional[float] = None  # m/s; None means use live weather


def build_recommendations(status, c, r, cond, age, height, gust, rain, score):
    recs = []

    def add(priority, text):
        recs.append({"priority": priority, "text": text})

    storm_priority = "urgent" if status == "Critical" else "soon"

    if status == "Critical":
        add("urgent", f"Wind load is about {score:.0f}% of this structure's estimated capacity. Move people to an official shelter or a sturdier building now.")
    elif status == "Elevated":
        add("soon", f"Wind load is about {score:.0f}% of estimated capacity. Secure the structure and be ready to relocate if conditions worsen.")

    if status == "Low":
        add("routine", CARE_TIPS[c])
        add("routine", ROOF_CARE_TIPS[r])
    else:
        add(storm_priority, STORM_TIPS[c])
        add(storm_priority, ROOF_STORM_TIPS[r])

    if cond == "poor":
        add("soon", "The building is in poor condition, which cuts its estimated capacity by about 45%. Book a structural inspection before the next storm.")
    elif cond == "fair" and status != "Low":
        add("soon", "Fix known defects (cracks, loose fixings, leaks) after this event so the building is in better shape for the next one.")

    if age >= 50:
        add("soon", "Buildings over 50 years old often predate modern wind codes. Ask an engineer about retrofits such as roof-to-wall ties and wall strengthening.")

    if height >= 30:
        add(storm_priority if status != "Low" else "routine", "Wind speed increases with height. Check facade panels, glazing and rooftop equipment on the upper floors.")
    elif height <= 8:
        add("routine" if status == "Low" else "soon", "For a low-rise building, identify the strongest small interior room, away from windows, to shelter in.")

    if rain >= 2.5:
        add("soon", "Heavy rain is falling. Clear drains and check for water entering at the foundation and roof edges.")

    if gust >= 17:
        add("soon", f"Gusts of about {gust:.0f} m/s are expected. Bring in or tie down loose outdoor items such as furniture, signs and sheets.")

    order = {"urgent": 0, "soon": 1, "routine": 2}
    recs.sort(key=lambda x: order[x["priority"]])
    return recs[:7]


@app.get("/")
def home():
    return {"message": "Backend is running"}


@app.post("/api/risk-score")
async def risk_score(b: BuildingRequest):
    construction = b.construction if b.construction in CAPACITY else "brick_masonry"
    roof = b.roof if b.roof in ROOF_FACTOR else "sloped_tile"
    condition = b.condition if b.condition in CONDITION_FACTOR else "fair"
    age = max(0, min(b.age_years, 120))
    height = max(b.height, 3.0)

    # ---- Weather: simulated scenario or live OpenWeather ----
    if b.simulated_wind is not None:
        wind_speed = gust = max(0.0, b.simulated_wind)
        rain = 0.0
        description = "Simulated storm scenario"
        source = "simulated"
    else:
        if not OPENWEATHER_API_KEY:
            raise HTTPException(status_code=500, detail="Missing OPENWEATHER_API_KEY in backend/.env")
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    "https://api.openweathermap.org/data/2.5/weather",
                    params={"lat": b.lat, "lon": b.lng, "appid": OPENWEATHER_API_KEY, "units": "metric"},
                )
        except httpx.RequestError:
            raise HTTPException(status_code=502, detail="Could not reach OpenWeather")
        if r.status_code == 401:
            raise HTTPException(status_code=502, detail="OpenWeather key invalid or not activated yet")
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail="OpenWeather error")

        data = r.json()
        wind = data.get("wind", {})
        wind_speed = float(wind.get("speed", 0.0))
        gust = float(wind.get("gust", wind_speed))
        rain = float(data.get("rain", {}).get("1h", 0.0))
        description = ((data.get("weather") or [{}])[0].get("description", "") or "").capitalize()
        source = "live"

    # ---- Wind load at the building's height ----
    design_speed = max(wind_speed, gust)
    speed_at_height = design_speed * (height / 10.0) ** 0.14
    pressure = 0.5 * 1.225 * speed_at_height**2  # Pascals

    # ---- Estimated capacity ----
    capacity = (
        CAPACITY[construction]
        * ROOF_FACTOR[roof]
        * CONDITION_FACTOR[condition]
        * (1 - age / 200)
    )
    if construction == "mud" and rain >= 2.5:
        capacity *= 0.8

    score = max(0.0, min(100.0, pressure / capacity * 100))

    if score >= 60:
        status = "Critical"
    elif score >= 30:
        status = "Elevated"
    else:
        status = "Low"

    factors = [
        f"Wind used: {design_speed:.1f} m/s ({source}), about {speed_at_height:.1f} m/s at {height:.0f} m height",
        f"Wind pressure on the building: about {pressure:.0f} Pa",
        f"Estimated capacity: about {capacity:.0f} Pa ({NAMES[construction]}, {NAMES[roof]}, {condition} condition, {age} years old)",
        "Risk = wind pressure / capacity",
    ]

    return {
        "source": source,
        "description": description,
        "wind_speed": round(wind_speed, 1),
        "gust": round(gust, 1),
        "rain_mm": round(rain, 1),
        "pressure_pa": round(pressure),
        "capacity_pa": round(capacity),
        "risk_score": round(score, 1),
        "status": status,
        "factors": factors,
        "recommendations": build_recommendations(
            status, construction, roof, condition, age, height, gust, rain, score
        ),
    }

from payments import router as payments_router
app.include_router(payments_router)
