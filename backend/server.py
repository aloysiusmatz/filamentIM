from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import io
import csv
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.getenv('MONGO_URL')
db_name = os.getenv('DB_NAME')
jwt_secret = os.getenv('JWT_SECRET')

if not mongo_url or not db_name or not jwt_secret:
    raise Exception("Environment variables not set properly")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

JWT_SECRET = jwt_secret
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 72

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()


# ── Pydantic Models ──────────────────────────────────────────────

class UserRegister(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class FilamentCreate(BaseModel):
    brand: str
    filament_type: str
    color: str
    color_hex: str = "#ffffff"
    weight_total: float
    weight_remaining: float
    cost: float = 0.0
    diameter: float = 1.75
    temp_nozzle: int = 200
    temp_bed: int = 60
    purchase_date: Optional[str] = None
    notes: str = ""

class FilamentUpdate(BaseModel):
    brand: Optional[str] = None
    filament_type: Optional[str] = None
    color: Optional[str] = None
    color_hex: Optional[str] = None
    weight_total: Optional[float] = None
    weight_remaining: Optional[float] = None
    cost: Optional[float] = None
    diameter: Optional[float] = None
    temp_nozzle: Optional[int] = None
    temp_bed: Optional[int] = None
    purchase_date: Optional[str] = None
    notes: Optional[str] = None

class PrintJobCreate(BaseModel):
    filament_id: str
    project_name: str
    weight_used: float
    duration_minutes: int = 0
    status: str = "success"
    printer_id: str = ""
    notes: str = ""


class PrintJobUpdate(BaseModel):
    project_name: Optional[str] = None
    duration_minutes: Optional[int] = None
    status: Optional[str] = None
    printer_id: Optional[str] = None
    notes: Optional[str] = None


class PrinterCreate(BaseModel):
    name: str
    model: str = ""
    build_volume: str = ""
    notes: str = ""


class PrinterUpdate(BaseModel):
    name: Optional[str] = None
    model: Optional[str] = None
    build_volume: Optional[str] = None
    notes: Optional[str] = None


class CustomOption(BaseModel):
    name: str


# ── Auth Helpers ─────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Auth Routes ──────────────────────────────────────────────────

@api_router.post("/auth/register")
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": data.username,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id)
    return {"token": token, "user": {"id": user_id, "username": data.username, "email": data.email}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"])
    return {"token": token, "user": {"id": user["id"], "username": user["username"], "email": user["email"]}}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return user


# ── Filament Routes ──────────────────────────────────────────────

@api_router.get("/filaments")
async def list_filaments(
    filament_type: Optional[str] = None,
    brand: Optional[str] = None,
    user=Depends(get_current_user)
):
    query = {"user_id": user["id"]}
    if filament_type:
        query["filament_type"] = filament_type
    if brand:
        query["brand"] = brand
    filaments = await db.filaments.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return filaments

@api_router.post("/filaments")
async def create_filament(data: FilamentCreate, user=Depends(get_current_user)):
    filament_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": filament_id,
        "user_id": user["id"],
        **data.model_dump(),
        "created_at": now,
        "updated_at": now
    }
    await db.filaments.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/filaments/export")
async def export_filaments(user=Depends(get_current_user)):
    filaments = await db.filaments.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Brand", "Type", "Color", "Color Hex", "Weight Total (g)",
        "Weight Remaining (g)", "Cost ($)", "Diameter (mm)",
        "Nozzle Temp", "Bed Temp", "Purchase Date", "Notes"
    ])
    for f in filaments:
        writer.writerow([
            f.get("brand", ""), f.get("filament_type", ""), f.get("color", ""),
            f.get("color_hex", ""), f.get("weight_total", 0), f.get("weight_remaining", 0),
            f.get("cost", 0), f.get("diameter", 1.75), f.get("temp_nozzle", 200),
            f.get("temp_bed", 60), f.get("purchase_date", ""), f.get("notes", ""),
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=filaments_export.csv"}
    )


@api_router.post("/filaments/import")
async def import_filaments(file: UploadFile = File(...), user=Depends(get_current_user)):
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
    count = 0
    for row in reader:
        filament_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "id": filament_id,
            "user_id": user["id"],
            "brand": row.get("Brand", ""),
            "filament_type": row.get("Type", ""),
            "color": row.get("Color", ""),
            "color_hex": row.get("Color Hex", "#ffffff"),
            "weight_total": float(row.get("Weight Total (g)", 1000)),
            "weight_remaining": float(row.get("Weight Remaining (g)", 1000)),
            "cost": float(row.get("Cost ($)", 0)),
            "diameter": float(row.get("Diameter (mm)", 1.75)),
            "temp_nozzle": int(float(row.get("Nozzle Temp", 200))),
            "temp_bed": int(float(row.get("Bed Temp", 60))),
            "purchase_date": row.get("Purchase Date", None) or None,
            "notes": row.get("Notes", ""),
            "created_at": now,
            "updated_at": now,
        }
        await db.filaments.insert_one(doc)
        count += 1
    return {"message": f"Imported {count} filaments", "count": count}


@api_router.put("/filaments/{filament_id}")
async def update_filament(filament_id: str, data: FilamentUpdate, user=Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.filaments.update_one(
        {"id": filament_id, "user_id": user["id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Filament not found")
    updated = await db.filaments.find_one({"id": filament_id}, {"_id": 0})
    return updated

@api_router.delete("/filaments/{filament_id}")
async def delete_filament(filament_id: str, user=Depends(get_current_user)):
    result = await db.filaments.delete_one({"id": filament_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Filament not found")
    return {"message": "Filament deleted"}


# ── Print Job Routes ─────────────────────────────────────────────

@api_router.get("/print-jobs")
async def list_print_jobs(user=Depends(get_current_user)):
    jobs = await db.print_jobs.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return jobs

@api_router.post("/print-jobs")
async def create_print_job(data: PrintJobCreate, user=Depends(get_current_user)):
    filament = await db.filaments.find_one(
        {"id": data.filament_id, "user_id": user["id"]}, {"_id": 0}
    )
    if not filament:
        raise HTTPException(status_code=404, detail="Filament not found")
    new_weight = max(0, filament["weight_remaining"] - data.weight_used)
    await db.filaments.update_one(
        {"id": data.filament_id},
        {"$set": {"weight_remaining": new_weight, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    printer_name = ""
    if data.printer_id:
        printer = await db.printers.find_one({"id": data.printer_id, "user_id": user["id"]}, {"_id": 0})
        if printer:
            printer_name = printer.get("name", "")
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": job_id,
        "user_id": user["id"],
        **data.model_dump(),
        "filament_brand": filament.get("brand", ""),
        "filament_type": filament.get("filament_type", ""),
        "filament_color": filament.get("color", ""),
        "filament_color_hex": filament.get("color_hex", "#ffffff"),
        "printer_name": printer_name,
        "created_at": now
    }
    await db.print_jobs.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.delete("/print-jobs/{job_id}")
async def delete_print_job(job_id: str, user=Depends(get_current_user)):
    result = await db.print_jobs.delete_one({"id": job_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Print job not found")
    return {"message": "Print job deleted"}


@api_router.put("/print-jobs/{job_id}")
async def update_print_job(job_id: str, data: PrintJobUpdate, user=Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if "printer_id" in update_data and update_data["printer_id"]:
        printer = await db.printers.find_one({"id": update_data["printer_id"], "user_id": user["id"]}, {"_id": 0})
        update_data["printer_name"] = printer.get("name", "") if printer else ""
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.print_jobs.update_one(
        {"id": job_id, "user_id": user["id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Print job not found")
    updated = await db.print_jobs.find_one({"id": job_id}, {"_id": 0})
    return updated


# ── Printer Routes ───────────────────────────────────────────────

@api_router.get("/printers")
async def list_printers(user=Depends(get_current_user)):
    printers = await db.printers.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return printers

@api_router.post("/printers")
async def create_printer(data: PrinterCreate, user=Depends(get_current_user)):
    printer_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": printer_id,
        "user_id": user["id"],
        **data.model_dump(),
        "created_at": now,
        "updated_at": now
    }
    await db.printers.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/printers/{printer_id}")
async def update_printer(printer_id: str, data: PrinterUpdate, user=Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.printers.update_one(
        {"id": printer_id, "user_id": user["id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Printer not found")
    updated = await db.printers.find_one({"id": printer_id}, {"_id": 0})
    return updated

@api_router.delete("/printers/{printer_id}")
async def delete_printer(printer_id: str, user=Depends(get_current_user)):
    result = await db.printers.delete_one({"id": printer_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Printer not found")
    return {"message": "Printer deleted"}


# ── Dashboard ────────────────────────────────────────────────────

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user=Depends(get_current_user)):
    user_id = user["id"]
    filaments = await db.filaments.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    jobs = await db.print_jobs.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)

    total_filaments = len(filaments)
    total_weight = sum(f.get("weight_remaining", 0) for f in filaments)
    total_value = sum(f.get("cost", 0) for f in filaments)
    low_stock = [
        f for f in filaments
        if f.get("weight_total", 0) > 0 and (f.get("weight_remaining", 0) / f.get("weight_total", 1)) < 0.2
    ]
    total_used = sum(j.get("weight_used", 0) for j in jobs)

    type_usage = {}
    for j in jobs:
        ft = j.get("filament_type", "Unknown")
        type_usage[ft] = type_usage.get(ft, 0) + j.get("weight_used", 0)
    usage_by_type = [{"name": k, "weight": round(v, 1)} for k, v in type_usage.items()]

    type_count = {}
    for f in filaments:
        ft = f.get("filament_type", "Unknown")
        type_count[ft] = type_count.get(ft, 0) + 1
    type_distribution = [{"name": k, "count": v} for k, v in type_count.items()]

    return {
        "total_filaments": total_filaments,
        "total_weight_remaining": round(total_weight, 1),
        "total_inventory_value": round(total_value, 2),
        "low_stock_count": len(low_stock),
        "low_stock_filaments": low_stock[:5],
        "recent_jobs": jobs[:5],
        "usage_by_type": usage_by_type,
        "type_distribution": type_distribution,
        "total_prints": len(jobs),
        "total_used": round(total_used, 1),
    }


# ── Alerts ───────────────────────────────────────────────────────

@api_router.get("/alerts")
async def get_alerts(user=Depends(get_current_user)):
    filaments = await db.filaments.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    alerts = []
    for f in filaments:
        wt = f.get("weight_total", 0)
        wr = f.get("weight_remaining", 0)
        if wt > 0:
            pct = (wr / wt) * 100
            if pct < 10:
                alerts.append({**f, "alert_level": "critical", "remaining_pct": round(pct, 1)})
            elif pct < 20:
                alerts.append({**f, "alert_level": "warning", "remaining_pct": round(pct, 1)})
            elif pct < 30:
                alerts.append({**f, "alert_level": "low", "remaining_pct": round(pct, 1)})
    alerts.sort(key=lambda x: x.get("remaining_pct", 100))
    return alerts


# ── Reference Data ───────────────────────────────────────────────

@api_router.get("/reference/brands")
async def get_brands():
    return [
        "Hatchbox", "Prusament", "eSUN", "Polymaker", "Overture", "Sunlu",
        "Inland", "MatterHackers", "ColorFabb", "Proto-pasta", "Bambu Lab",
        "Creality", "Eryone", "TTYT3D", "Geeetech", "Elegoo", "Anycubic",
        "3D Solutech", "Duramic", "ZIRO", "Other"
    ]

@api_router.get("/reference/types")
async def get_types():
    return [
        "PLA", "PLA+", "ABS", "ABS+", "PETG", "PETG+", "TPU", "Nylon",
        "ASA", "PC", "HIPS", "PVA", "Wood PLA", "Carbon Fiber PLA",
        "Silk PLA", "Marble PLA", "Glow-in-Dark PLA", "Metal Fill PLA",
        "PEEK", "PEI", "Other"
    ]


@api_router.get("/reference/user-options")
async def get_user_options(user=Depends(get_current_user)):
    filaments = await db.filaments.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    custom_brands_docs = await db.custom_brands.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    custom_types_docs = await db.custom_types.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    filament_brands = set(f["brand"] for f in filaments if f.get("brand"))
    filament_types = set(f["filament_type"] for f in filaments if f.get("filament_type"))
    custom_brand_names = set(d["name"] for d in custom_brands_docs if d.get("name"))
    custom_type_names = set(d["name"] for d in custom_types_docs if d.get("name"))
    brands = sorted(filament_brands | custom_brand_names)
    types = sorted(filament_types | custom_type_names)
    return {"brands": brands, "types": types}


@api_router.post("/reference/custom-brands")
async def add_custom_brand(data: CustomOption, user=Depends(get_current_user)):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Brand name required")
    existing = await db.custom_brands.find_one({"user_id": user["id"], "name": name})
    if not existing:
        await db.custom_brands.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "name": name,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    return {"message": "Brand saved", "name": name}


@api_router.post("/reference/custom-types")
async def add_custom_type(data: CustomOption, user=Depends(get_current_user)):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Type name required")
    existing = await db.custom_types.find_one({"user_id": user["id"], "name": name})
    if not existing:
        await db.custom_types.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "name": name,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    return {"message": "Type saved", "name": name}


# ── App Setup ────────────────────────────────────────────────────

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
