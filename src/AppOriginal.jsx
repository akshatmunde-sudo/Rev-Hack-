import { useEffect, useState } from 'react'
import CesiumMap from './components/CesiumMap'

const API_URL = 'http://localhost:8000/api/risk-score'

const CONSTRUCTION = [
  ['rcc', 'Reinforced concrete (RCC)'],
  ['steel', 'Steel frame'],
  ['brick_masonry', 'Brick / block masonry'],
  ['wood', 'Timber / wood'],
  ['mud', 'Mud / adobe'],
  ['sheet', 'Tin / light sheet walls'],
]
const ROOF = [
  ['flat_rcc', 'Flat concrete slab'],
  ['sloped_tile', 'Sloped tile roof'],
  ['metal_sheet', 'Metal / asbestos sheet'],
  ['thatch', 'Thatch / palm leaf'],
]
const CONDITION = [
  ['good', 'Good (well maintained)'],
  ['fair', 'Fair (minor defects)'],
  ['poor', 'Poor (cracks, rust, leaks)'],
]
const AGE = [
  ['5', 'Under 10 years'],
  ['20', '10 to 30 years'],
  ['40', '30 to 50 years'],
  ['60', 'Over 50 years'],
]
const SCENARIO = [
  ['live', 'Live weather'],
  ['20', 'Gale: 20 m/s (72 km/h)'],
  ['30', 'Severe storm: 30 m/s (108 km/h)'],
  ['40', 'Cyclone: 40 m/s (144 km/h)'],
  ['55', 'Severe cyclone: 55 m/s (198 km/h)'],
]
const PRIORITY = {
  urgent: { label: 'Urgent', color: '#dc2626' },
  soon: { label: 'Soon', color: '#f97316' },
  routine: { label: 'Routine', color: '#16a34a' },
}

// Reasonable starting guess based on building height
function defaultProfile(h) {
  if (h >= 30) return { construction: 'rcc', roof: 'flat_rcc', condition: 'good', age: '20' }
  if (h >= 12) return { construction: 'rcc', roof: 'flat_rcc', condition: 'fair', age: '20' }
  return { construction: 'brick_masonry', roof: 'sloped_tile', condition: 'fair', age: '20' }
}

export default function App() {
  const [building, setBuilding] = useState(null)
  const [profile, setProfile] = useState(defaultProfile(6))
  const [scenario, setScenario] = useState('live')
  const [showBuildings, setShowBuildings] = useState(false)
  const [target, setTarget] = useState(null)
  const [risk, setRisk] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function handleSelect(b) {
    setBuilding(b)
    setRisk(null)
    setError(null)
    if (b) setProfile(defaultProfile(b.height))
  }

  // Recalculate whenever the building, its details or the scenario change
  useEffect(() => {
    if (!building) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        lat: building.lat,
        lng: building.lng,
        height: building.height,
        construction: profile.construction,
        roof: profile.roof,
        condition: profile.condition,
        age_years: Number(profile.age),
        simulated_wind: scenario === 'live' ? null : Number(scenario),
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Server error ${res.status}`)
        return res.json()
      })
      .then(setRisk)
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [building, profile, scenario])

  const setField = (key) => (value) => setProfile((p) => ({ ...p, [key]: value }))

  const status = risk?.status
  const statusColor =
    status === 'Critical' ? '#dc2626' : status === 'Elevated' ? '#f97316' : '#16a34a'

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <CesiumMap onSelect={handleSelect} showBuildings={showBuildings} target={target} />

      {/* Search bar: top-left, above the dashboard */}
      <SearchBar onPick={setTarget} />

      {/* Dashboard card: sits below the search bar */}
      <div
        style={{
          position: 'absolute',
          top: 76,
          left: 16,
          zIndex: 10,
          width: 360,
          maxHeight: 'calc(100vh - 92px)',
          overflowY: 'auto',
          padding: 16,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.95)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          color: '#1f2937',
          fontSize: 14,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Collapse Risk Dashboard</h1>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showBuildings}
            onChange={(e) => setShowBuildings(e.target.checked)}
          />
          Show clickable buildings on the map
        </label>

        {!building && (
          <p style={{ marginTop: 10, color: '#4b5563' }}>
            Search for a place in the bar above, then click any building to analyze it.
            Tip: zoom in close (under about 300 m high) to click small houses.
          </p>
        )}

        {building && (
          <div style={{ marginTop: 12 }}>
            <Row
              label="Building height"
              value={`${building.height.toFixed(1)} m${building.estimated ? ' (estimated)' : ''}`}
            />
            <Row label="Location" value={`${building.lat.toFixed(4)}, ${building.lng.toFixed(4)}`} />

            <div style={{ marginTop: 12, fontWeight: 600 }}>About this building</div>
            <div style={{ marginTop: 6 }}>
              <Field label="Construction" value={profile.construction} onChange={setField('construction')} options={CONSTRUCTION} />
              <Field label="Roof type" value={profile.roof} onChange={setField('roof')} options={ROOF} />
              <Field label="Condition" value={profile.condition} onChange={setField('condition')} options={CONDITION} />
              <Field label="Age" value={profile.age} onChange={setField('age')} options={AGE} />
              <Field label="Weather scenario" value={scenario} onChange={setScenario} options={SCENARIO} />
            </div>

            {loading && <p style={{ color: '#6b7280' }}>Calculating risk...</p>}

            {error && (
              <p style={{ color: '#dc2626' }}>
                Backend error: {error}. Is the Python server running?
              </p>
            )}

            {risk && (
              <>
                <div
                  style={{
                    marginTop: 8,
                    padding: 12,
                    borderRadius: 8,
                    background: statusColor,
                    color: '#fff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.9 }}>Status</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{risk.status}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, opacity: 0.9 }}>Collapse risk</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>
                      {Number(risk.risk_score).toFixed(1)} %
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 8 }}>
                  <Row
                    label={risk.source === 'simulated' ? 'Simulated wind' : 'Live wind'}
                    value={`${risk.wind_speed} m/s (gusts ${risk.gust})`}
                  />
                  <Row label="Rain (last hour)" value={`${risk.rain_mm} mm`} />
                  {risk.description && <Row label="Conditions" value={risk.description} />}
                </div>

                <div style={{ marginTop: 12, fontWeight: 600 }}>
                  Recommended actions for this structure
                </div>
                <div style={{ marginTop: 6 }}>
                  {risk.recommendations.map((rec, i) => {
                    const p = PRIORITY[rec.priority] || PRIORITY.routine
                    return (
                      <div
                        key={i}
                        style={{
                          marginBottom: 8,
                          padding: 10,
                          borderRadius: 8,
                          background: '#f3f4f6',
                          borderLeft: `4px solid ${p.color}`,
                          fontSize: 13,
                          lineHeight: 1.45,
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700, color: p.color, textTransform: 'uppercase' }}>
                          {p.label}
                        </span>
                        <div>{rec.text}</div>
                      </div>
                    )
                  })}
                </div>

                <details style={{ marginTop: 8, fontSize: 12, color: '#4b5563' }}>
                  <summary style={{ cursor: 'pointer' }}>How this score is estimated</summary>
                  <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
                    {risk.factors.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </details>

                <p style={{ margin: '10px 0 0', fontSize: 11, color: '#6b7280' }}>
                  Simplified estimate for learning and planning only. It is not an
                  engineering assessment. Consult a licensed structural engineer
                  for real decisions.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- Search bar ---------------- */

// Matches "13.0827, 80.2707" style coordinates
function parseCoords(text) {
  const m = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

// Turns a place's bounding box into a camera radius in metres
function radiusFromBox(box, lat) {
  if (!box) return 400
  const [south, north, west, east] = box.map(Number)
  const dLat = (north - south) * 111320
  const dLng = (east - west) * 111320 * Math.cos((lat * Math.PI) / 180)
  return Math.hypot(dLat, dLng) / 2
}

function SearchBar({ onPick }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function search() {
    const q = query.trim()
    if (!q) return
    setMessage('')

    const coords = parseCoords(q)
    if (coords) {
      onPick({ ...coords, radius: 300, label: `${coords.lat}, ${coords.lng}`, id: Date.now() })
      setOpen(false)
      return
    }

    setBusy(true)
    try {
      const url =
        'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=' +
        encodeURIComponent(q)
      const res = await fetch(url)
      if (!res.ok) throw new Error('Search service error')
      const data = await res.json()
      setResults(data)
      setOpen(true)
      if (data.length === 0) setMessage('No places found. Try adding the city or state.')
    } catch (e) {
      setResults([])
      setOpen(true)
      setMessage('Search failed. Check your internet connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  function choose(place) {
    const lat = Number(place.lat)
    const lng = Number(place.lon)
    onPick({
      lat,
      lng,
      radius: radiusFromBox(place.boundingbox, lat),
      label: place.display_name.split(',')[0],
      id: Date.now(),
    })
    setQuery(place.display_name)
    setOpen(false)
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 30,
        width: 360,
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          height: 48,
          background: '#ffffff',
          borderRadius: 10,
          border: '2px solid #2563eb',
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') search()
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="Search city, locality or address..."
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            padding: '0 12px',
            fontSize: 14,
            background: 'transparent',
            color: '#1f2937',
            minWidth: 0,
          }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              setResults([])
              setOpen(false)
              setMessage('')
            }}
            title="Clear"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 8px', fontSize: 16, color: '#6b7280' }}
          >
            ✕
          </button>
        )}
        <button
          onClick={search}
          disabled={busy}
          style={{
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            padding: '0 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? '...' : 'Search'}
        </button>
      </div>

      {open && (
        <div
          style={{
            marginTop: 6,
            background: '#ffffff',
            borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            overflow: 'hidden',
            maxHeight: '55vh',
            overflowY: 'auto',
          }}
        >
          {results.map((p) => (
            <button
              key={p.place_id}
              onClick={() => choose(p)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                border: 'none',
                borderBottom: '1px solid #e5e7eb',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                color: '#1f2937',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontWeight: 600 }}>{p.display_name.split(',')[0]}</div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>{p.display_name}</div>
            </button>
          ))}
          {message && (
            <div style={{ padding: '10px 12px', fontSize: 13, color: '#6b7280' }}>{message}</div>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------- Small helper components ---------------- */

function Field({ label, value, onChange, options }) {
  return (
    <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
      <span style={{ display: 'block', color: '#6b7280', marginBottom: 2 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '6px 8px',
          borderRadius: 6,
          border: '1px solid #d1d5db',
          background: '#fff',
          color: '#1f2937',
        }}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}

function Row({ label, value }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '6px 0',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  )
}