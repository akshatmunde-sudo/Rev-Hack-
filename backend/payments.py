import json
import os
import re
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/payments")

DB_FILE = Path(__file__).parent / "payments.json"
ADMIN_KEY = os.environ.get("PAYMENT_ADMIN_KEY", "akshat-admin-2026")


def read_db():
    if DB_FILE.exists():
        try:
            return json.loads(DB_FILE.read_text())
        except Exception:
            return {}
    return {}


def write_db(db):
    DB_FILE.write_text(json.dumps(db, indent=2))


def check_key(key):
    if key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Wrong admin key.")


class Submit(BaseModel):
    txn: str


@router.post("/submit")
def submit(body: Submit):
    txn = body.txn.strip()
    if not re.fullmatch(r"\d{12}", txn):
        raise HTTPException(status_code=400, detail="Transaction ID must be exactly 12 digits.")
    db = read_db()
    if txn in db:
        raise HTTPException(status_code=409, detail="This transaction ID was already submitted.")
    db[txn] = {"status": "pending", "created": time.time(), "used": False}
    write_db(db)
    return {"status": "pending"}


@router.get("/status/{txn}")
def status(txn: str):
    item = read_db().get(txn)
    if not item:
        raise HTTPException(status_code=404, detail="Unknown transaction ID.")
    if item.get("used"):
        return {"status": "used"}
    return {"status": item["status"]}


@router.post("/claim/{txn}")
def claim(txn: str):
    db = read_db()
    item = db.get(txn)
    if not item or item["status"] != "approved":
        raise HTTPException(status_code=400, detail="Not approved.")
    if item.get("used"):
        raise HTTPException(status_code=409, detail="Already used.")
    item["used"] = True
    write_db(db)
    return {"ok": True}


def set_status(txn, new_status):
    db = read_db()
    if txn in db and db[txn]["status"] == "pending":
        db[txn]["status"] = new_status
        write_db(db)


@router.get("/approve")
def approve(txn: str, key: str = ""):
    check_key(key)
    set_status(txn, "approved")
    return RedirectResponse("/api/payments/admin?key=" + key)


@router.get("/reject")
def reject(txn: str, key: str = ""):
    check_key(key)
    set_status(txn, "rejected")
    return RedirectResponse("/api/payments/admin?key=" + key)


@router.get("/admin", response_class=HTMLResponse)
def admin(key: str = ""):
    check_key(key)
    db = read_db()
    rows = ""
    for txn, item in sorted(db.items(), key=lambda kv: kv[1]["created"], reverse=True):
        when = time.strftime("%d %b %H:%M", time.localtime(item["created"]))
        if item["status"] == "pending":
            action = (
                '<a href="/api/payments/approve?txn=' + txn + "&key=" + key + '">Approve</a> | '
                '<a href="/api/payments/reject?txn=' + txn + "&key=" + key + '">Reject</a>'
            )
        else:
            action = "-"
        rows += (
            "<tr><td>" + txn + "</td><td>" + when + "</td><td>"
            + item["status"] + ("" if not item.get("used") else " (used)")
            + "</td><td>" + action + "</td></tr>"
        )
    html = (
        "<html><head><meta charset='utf-8'><title>Payments</title>"
        "<style>body{font-family:sans-serif;padding:24px}"
        "td,th{padding:8px 14px;border-bottom:1px solid #ddd;text-align:left}</style></head><body>"
        "<h2>Payment requests</h2>"
        "<p>Approve only if this 12-digit ID appears in your UPI/bank app for the right amount.</p>"
        "<table><tr><th>Transaction ID</th><th>Time</th><th>Status</th><th>Action</th></tr>"
        + rows
        + "</table><p><a href=''>Refresh</a></p></body></html>"
    )
    return html