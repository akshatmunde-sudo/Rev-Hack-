import { useState, useEffect } from 'react'
import AppOriginal from './AppOriginal.jsx'
import { QRCodeSVG } from 'qrcode.react'

const FREE_MINUTES = 30
const PRICE_PER_HOUR = 50
const CURRENCY = '₹'
const STORAGE_KEY = 'city3d_access_v1'
const UPI_LINK = 'upi://pay?pa=9096113159@ptyes&pn=AKSHAT%20MUNDE&am=' + PRICE_PER_HOUR + '&cu=INR'

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch (e) { return {} }
}
function save(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch (e) {}
}
function fmt(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return (h > 0 ? pad(h) + ':' : '') + pad(m) + ':' + pad(s)
}

const css = `
.gate-wrap{position:fixed;inset:0;overflow-y:auto;background:radial-gradient(1200px 600px at 20% -10%,#1e3a8a 0%,transparent 60%),radial-gradient(900px 500px at 100% 100%,#0e7490 0%,transparent 55%),#0b1020;color:#e5e7eb;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;z-index:99999}
.gate-inner{max-width:980px;margin:0 auto;padding:48px 24px 64px;min-height:100%;display:flex;flex-direction:column;justify-content:center}
.gate-badge{display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.35);color:#7dd3fc;font-size:13px;letter-spacing:.04em;margin-bottom:20px;align-self:flex-start}
.gate-title{font-size:clamp(36px,6vw,64px);line-height:1.05;font-weight:800;margin:0 0 16px;background:linear-gradient(90deg,#fff,#7dd3fc);-webkit-background-clip:text;background-clip:text;color:transparent}
.gate-sub{font-size:clamp(16px,2vw,20px);color:#9ca3af;max-width:640px;margin:0 0 32px;line-height:1.6}
.gate-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:36px}
.gate-card{padding:20px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
.gate-card h3{margin:0 0 6px;font-size:16px;color:#f3f4f6}
.gate-card p{margin:0;font-size:14px;color:#9ca3af;line-height:1.5}
.gate-btn{appearance:none;border:0;cursor:pointer;padding:16px 32px;border-radius:12px;font-size:17px;font-weight:700;color:#04121f;background:linear-gradient(90deg,#38bdf8,#22d3ee);box-shadow:0 10px 30px rgba(34,211,238,.25);transition:transform .15s,box-shadow .15s}
.gate-btn:hover{transform:translateY(-2px);box-shadow:0 14px 36px rgba(34,211,238,.35)}
.gate-note{margin-top:16px;font-size:13px;color:#6b7280}
.pay-card{max-width:440px;margin:0 auto;padding:32px;border-radius:20px;background:rgba(17,24,39,.85);border:1px solid rgba(255,255,255,.1);text-align:center;backdrop-filter:blur(8px)}
.pay-card h2{margin:0 0 8px;font-size:26px;color:#fff}
.pay-card p{margin:0 0 16px;color:#9ca3af;font-size:15px;line-height:1.5}
.pay-qr{width:230px;height:230px;border-radius:14px;background:#fff;padding:8px;margin:8px auto 12px;box-sizing:border-box}
.pay-price{font-size:30px;font-weight:800;color:#7dd3fc;margin-bottom:4px}
.pay-input{width:100%;box-sizing:border-box;padding:14px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#fff;font-size:15px;margin:8px 0 12px;outline:none}
.pay-input:focus{border-color:#38bdf8}
.pay-err{color:#fca5a5;font-size:14px;margin:0 0 10px}
.timer-pill{position:fixed;top:14px;right:14px;z-index:99998;padding:8px 14px;border-radius:999px;background:rgba(11,16,32,.9);border:1px solid rgba(56,189,248,.5);color:#e0f2fe;font:600 14px Inter,system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35)}
.timer-pill.low{border-color:#f59e0b;color:#fde68a}
`

export default function App() {
  const [state, setState] = useState(load)
  const [now, setNow] = useState(Date.now())
  const [txn, setTxn] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const started = !!state.accessEnd
  const remaining = started ? state.accessEnd - now : 0
  const active = started && remaining > 0

  function startFree() {
    const next = { accessEnd: Date.now() + FREE_MINUTES * 60000, payments: [] }
    save(next)
    setState(next)
  }

  function confirmPaid() {
    const id = txn.trim()
    if (id.length < 8) { setErr('Please enter a valid transaction / UTR ID (at least 8 characters).'); return }
    const used = (state.payments || []).some((p) => p.txn === id)
    if (used) { setErr('This transaction ID was already used.'); return }
    const next = {
      accessEnd: Date.now() + 3600000,
      payments: [...(state.payments || []), { txn: id, at: Date.now() }]
    }
    save(next)
    setState(next)
    setTxn('')
    setErr('')
  }

  if (active) {
    return (
      <>
        <style>{css}</style>
        <div className={'timer-pill' + (remaining < 300000 ? ' low' : '')}>Time left: {fmt(remaining)}</div>
        <AppOriginal />
      </>
    )
  }

  if (!started) {
    return (
      <>
        <style>{css}</style>
        <div className="gate-wrap">
          <div className="gate-inner">
            <span className="gate-badge">INTERACTIVE 3D EXPERIENCE</span>
            <h1 className="gate-title">City 3D Map</h1>
            <p className="gate-sub">
              Explore the city in an immersive three-dimensional map. Rotate, zoom and discover every
              building, road and landmark in real time.
            </p>
            <div className="gate-cards">
              <div className="gate-card"><h3>Immersive 3D view</h3><p>Fly through the city with smooth, interactive controls.</p></div>
              <div className="gate-card"><h3>{FREE_MINUTES} minutes free</h3><p>Try everything at no cost. No sign-up required.</p></div>
              <div className="gate-card"><h3>{CURRENCY}{PRICE_PER_HOUR} per extra hour</h3><p>Keep exploring any time by paying for each additional hour.</p></div>
            </div>
            <div>
              <button className="gate-btn" onClick={startFree}>Start free {FREE_MINUTES}-minute session</button>
              <div className="gate-note">The timer starts as soon as you click the button.</div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{css}</style>
      <div className="gate-wrap">
        <div className="gate-inner">
          <div className="pay-card">
            <h2>Your session has ended</h2>
            <p>Scan the QR code with any UPI app to continue for another hour.</p>
            <div className="pay-price">{CURRENCY}{PRICE_PER_HOUR} / hour</div>
            <div className="pay-qr" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <QRCodeSVG value={UPI_LINK} size={214} />
            </div>
            <p>After paying, enter the transaction / UTR ID shown in your payment app.</p>
            <input
              className="pay-input"
              placeholder="Transaction / UTR ID"
              value={txn}
              onChange={(e) => setTxn(e.target.value)}
            />
            {err && <p className="pay-err">{err}</p>}
            <button className="gate-btn" style={{ width: '100%' }} onClick={confirmPaid}>
              I have paid, unlock 1 hour
            </button>
          </div>
        </div>
      </div>
    </>
  )
}