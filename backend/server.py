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

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
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


# ── Master Stock Models ──────────────────────────────────────────

class MasterStockCreate(BaseModel):
    brand: str
    filament_type: str
    color: str
    color_hex: str = "#ffffff"
    empty_spool_weight: float = 250.0
    weight_total: float = 1000.0
    cost: float = 0.0
    quantity_in_stock: int = 1

class MasterStockUpdate(BaseModel):
    brand: Optional[str] = None
    filament_type: Optional[str] = None
    color: Optional[str] = None
    color_hex: Optional[str] = None
    empty_spool_weight: Optional[float] = None
    weight_total: Optional[float] = None
    cost: Optional[float] = None
    quantity_in_stock: Optional[int] = None


# ── Print Job Models ─────────────────────────────────────────────

class SpoolUsage(BaseModel):
    active_spool_id: str
    weight_used: float

class PrintJobCreate(BaseModel):
    project_name: str
    spools_used: List[SpoolUsage]
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


class SpoolAdjustment(BaseModel):
    amount: float
    type: str = "positive_correction"  # positive_correction, scrap, calibration
    notes: str = ""


# ── Printer Models ───────────────────────────────────────────────

class PrinterCreate(BaseModel):
    name: str
    model: str = ""
    build_volume: str = ""
    power_kwh: float = 0.2
    notes: str = ""

class PrinterUpdate(BaseModel):
    name: Optional[str] = None
    model: Optional[str] = None
    build_volume: Optional[str] = None
    power_kwh: Optional[float] = None
    notes: Optional[str] = None


class CustomOption(BaseModel):
    name: str


class UserPreferencesUpdate(BaseModel):
    country: str = "US"
    currency: str = "USD"
    currency_symbol: str = "$"
    electricity_rate: float = 0.12


class CostEstimateRequest(BaseModel):
    weight_grams: float
    filament_cost_per_kg: float
    printer_power_kw: float
    duration_minutes: float
    electricity_rate: float


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


# ── Unique String ID Generator ───────────────────────────────────

async def generate_unique_string_id(user_id: str, filament_type: str, color: str) -> str:
    """Generate a unique string ID like PLA-BLK-001."""
    type_abbr = filament_type[:3].upper() if filament_type else "UNK"
    color_abbr = color[:3].upper() if color else "UNK"
    prefix = f"{type_abbr}-{color_abbr}"

    existing = await db.active_spools.find(
        {"user_id": user_id, "unique_string_id": {"$regex": f"^{prefix}-"}},
        {"unique_string_id": 1, "_id": 0}
    ).to_list(10000)

    max_num = 0
    for doc in existing:
        sid = doc.get("unique_string_id", "")
        parts = sid.rsplit("-", 1)
        if len(parts) == 2:
            try:
                num = int(parts[1])
                if num > max_num:
                    max_num = num
            except ValueError:
                pass

    return f"{prefix}-{max_num + 1:03d}"


# ── Master Stock Routes ──────────────────────────────────────────

@api_router.get("/master-stock")
async def list_master_stock(
    filament_type: Optional[str] = None,
    brand: Optional[str] = None,
    user=Depends(get_current_user)
):
    query = {"user_id": user["id"]}
    if filament_type:
        query["filament_type"] = filament_type
    if brand:
        query["brand"] = brand
    items = await db.master_stock.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items

@api_router.post("/master-stock")
async def create_master_stock(data: MasterStockCreate, user=Depends(get_current_user)):
    stock_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": stock_id,
        "user_id": user["id"],
        **data.model_dump(),
        "created_at": now,
        "updated_at": now
    }
    await db.master_stock.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/master-stock/{stock_id}")
async def update_master_stock(stock_id: str, data: MasterStockUpdate, user=Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.master_stock.update_one(
        {"id": stock_id, "user_id": user["id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Master stock not found")
    updated = await db.master_stock.find_one({"id": stock_id}, {"_id": 0})
    return updated

@api_router.delete("/master-stock/{stock_id}")
async def delete_master_stock(stock_id: str, user=Depends(get_current_user)):
    result = await db.master_stock.delete_one({"id": stock_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Master stock not found")
    return {"message": "Master stock deleted"}

@api_router.post("/master-stock/{stock_id}/open")
async def open_spool_from_stock(stock_id: str, user=Depends(get_current_user)):
    """Take one spool from warehouse and create an ActiveSpool."""
    stock = await db.master_stock.find_one({"id": stock_id, "user_id": user["id"]}, {"_id": 0})
    if not stock:
        raise HTTPException(status_code=404, detail="Master stock not found")
    if stock.get("quantity_in_stock", 0) <= 0:
        raise HTTPException(status_code=400, detail="No spools left in stock")

    # Decrement quantity
    await db.master_stock.update_one(
        {"id": stock_id},
        {
            "$inc": {"quantity_in_stock": -1},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )

    # Generate unique string ID
    unique_sid = await generate_unique_string_id(user["id"], stock.get("filament_type", ""), stock.get("color", ""))

    # Create active spool
    spool_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    spool_doc = {
        "id": spool_id,
        "user_id": user["id"],
        "unique_string_id": unique_sid,
        "master_stock_id": stock_id,
        "brand": stock.get("brand", ""),
        "filament_type": stock.get("filament_type", ""),
        "color": stock.get("color", ""),
        "color_hex": stock.get("color_hex", "#ffffff"),
        "empty_spool_weight": stock.get("empty_spool_weight", 250.0),
        "weight_total": stock.get("weight_total", 1000.0),
        "weight_remaining": stock.get("weight_total", 1000.0),
        "cost": stock.get("cost", 0.0),
        "status": "OPENED",
        "created_at": now,
        "updated_at": now
    }
    await db.active_spools.insert_one(spool_doc)
    spool_doc.pop("_id", None)

    # Return updated stock + new spool
    updated_stock = await db.master_stock.find_one({"id": stock_id}, {"_id": 0})
    return {"active_spool": spool_doc, "master_stock": updated_stock}


# ── Active Spool Routes ──────────────────────────────────────────

@api_router.get("/active-spools")
async def list_active_spools(
    status: Optional[str] = None,
    user=Depends(get_current_user)
):
    query = {"user_id": user["id"]}
    if status:
        query["status"] = status
    spools = await db.active_spools.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return spools

@api_router.get("/active-spools/{spool_id}")
async def get_active_spool(spool_id: str, user=Depends(get_current_user)):
    spool = await db.active_spools.find_one({"id": spool_id, "user_id": user["id"]}, {"_id": 0})
    if not spool:
        raise HTTPException(status_code=404, detail="Active spool not found")
    return spool


@api_router.post("/active-spools/{spool_id}/return")
async def return_spool_to_warehouse(spool_id: str, user=Depends(get_current_user)):
    """Return an unused spool back to warehouse stock."""
    spool = await db.active_spools.find_one({"id": spool_id, "user_id": user["id"]}, {"_id": 0})
    if not spool:
        raise HTTPException(status_code=404, detail="Active spool not found")
    if spool.get("weight_remaining", 0) != spool.get("weight_total", 0):
        raise HTTPException(
            status_code=400,
            detail="Cannot return a partially used spool to the warehouse."
        )
    # Increment master stock quantity
    master_stock_id = spool.get("master_stock_id")
    if master_stock_id:
        await db.master_stock.update_one(
            {"id": master_stock_id, "user_id": user["id"]},
            {
                "$inc": {"quantity_in_stock": 1},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
    # Delete the active spool
    await db.active_spools.delete_one({"id": spool_id, "user_id": user["id"]})
    return {"message": "Spool returned to warehouse", "master_stock_id": master_stock_id}


@api_router.post("/active-spools/{spool_id}/adjust")
async def adjust_spool(spool_id: str, data: SpoolAdjustment, user=Depends(get_current_user)):
    """Manually adjust spool weight (add/subtract)."""
    spool = await db.active_spools.find_one({"id": spool_id, "user_id": user["id"]}, {"_id": 0})
    if not spool:
        raise HTTPException(status_code=404, detail="Active spool not found")

    # Determine if positive or negative adjustment
    positive_types = {"positive_correction", "add", "found"}
    negative_types = {"scrap", "calibration", "waste", "subtract"}

    if data.type in positive_types:
        new_weight = spool.get("weight_remaining", 0) + abs(data.amount)
    elif data.type in negative_types:
        new_weight = spool.get("weight_remaining", 0) - abs(data.amount)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown adjustment type: {data.type}")

    new_weight = max(0, new_weight)
    # Cap at weight_total
    new_weight = min(new_weight, spool.get("weight_total", 9999))

    # Auto-status logic
    if new_weight <= 0:
        new_status = "DEPLETED"
    elif spool.get("status") == "DEPLETED" and new_weight > 0:
        new_status = "OPENED"
    else:
        new_status = spool.get("status", "OPENED")

    now = datetime.now(timezone.utc).isoformat()
    await db.active_spools.update_one(
        {"id": spool_id},
        {"$set": {
            "weight_remaining": round(new_weight, 2),
            "status": new_status,
            "updated_at": now
        }}
    )

    # Save audit trail
    adjustment_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "active_spool_id": spool_id,
        "unique_string_id": spool.get("unique_string_id", ""),
        "type": data.type,
        "amount": data.amount,
        "weight_before": spool.get("weight_remaining", 0),
        "weight_after": round(new_weight, 2),
        "notes": data.notes,
        "created_at": now
    }
    await db.spool_adjustments.insert_one(adjustment_doc)
    adjustment_doc.pop("_id", None)

    updated_spool = await db.active_spools.find_one({"id": spool_id}, {"_id": 0})
    return {"spool": updated_spool, "adjustment": adjustment_doc}


# ── Print Job Routes ─────────────────────────────────────────────

@api_router.get("/print-jobs")
async def list_print_jobs(user=Depends(get_current_user)):
    jobs = await db.print_jobs.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return jobs

@api_router.post("/print-jobs")
async def create_print_job(data: PrintJobCreate, user=Depends(get_current_user)):
    if not data.spools_used or len(data.spools_used) == 0:
        raise HTTPException(status_code=400, detail="At least one spool must be specified")

    # Validate all spools and collect data
    spool_details = []
    for usage in data.spools_used:
        spool = await db.active_spools.find_one(
            {"id": usage.active_spool_id, "user_id": user["id"]}, {"_id": 0}
        )
        if not spool:
            raise HTTPException(status_code=404, detail=f"Active spool {usage.active_spool_id} not found")
        if spool.get("status") == "DEPLETED":
            raise HTTPException(status_code=400, detail=f"Spool {spool.get('unique_string_id', usage.active_spool_id)} is DEPLETED")
        if usage.weight_used > spool.get("weight_remaining", 0):
            raise HTTPException(
                status_code=400,
                detail=f"Weight {usage.weight_used}g exceeds remaining {spool.get('weight_remaining', 0)}g on spool {spool.get('unique_string_id', usage.active_spool_id)}"
            )
        spool_details.append(spool)

    # Get printer info
    printer_name = ""
    printer_power = 0.2
    if data.printer_id:
        printer = await db.printers.find_one({"id": data.printer_id, "user_id": user["id"]}, {"_id": 0})
        if printer:
            printer_name = printer.get("name", "")
            printer_power = printer.get("power_kwh", 0.2)

    # Get electricity rate
    prefs = await db.user_preferences.find_one({"user_id": user["id"]}, {"_id": 0})
    elec_rate = prefs.get("electricity_rate", 0.12) if prefs else 0.12

    # Calculate costs per spool
    total_filament_cost = 0.0
    spools_used_docs = []
    for i, usage in enumerate(data.spools_used):
        spool = spool_details[i]
        cost_per_g = spool.get("cost", 0) / max(spool.get("weight_total", 1), 1)
        fil_cost = usage.weight_used * cost_per_g
        total_filament_cost += fil_cost

        spools_used_docs.append({
            "active_spool_id": usage.active_spool_id,
            "unique_string_id": spool.get("unique_string_id", ""),
            "weight_used": usage.weight_used,
            "brand": spool.get("brand", ""),
            "filament_type": spool.get("filament_type", ""),
            "color": spool.get("color", ""),
            "color_hex": spool.get("color_hex", "#ffffff"),
            "filament_cost": round(fil_cost, 4),
        })

    est_electricity_cost = printer_power * (data.duration_minutes / 60) * elec_rate
    estimated_cost = total_filament_cost + est_electricity_cost

    # Calculate total weight used for convenience
    total_weight_used = sum(u.weight_used for u in data.spools_used)

    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": job_id,
        "user_id": user["id"],
        "project_name": data.project_name,
        "spools_used": spools_used_docs,
        "total_weight_used": round(total_weight_used, 2),
        "duration_minutes": data.duration_minutes,
        "status": data.status,
        "printer_id": data.printer_id,
        "printer_name": printer_name,
        "notes": data.notes,
        "estimated_cost": round(estimated_cost, 4),
        "est_filament_cost": round(total_filament_cost, 4),
        "est_electricity_cost": round(est_electricity_cost, 4),
        "created_at": now
    }
    await db.print_jobs.insert_one(doc)
    doc.pop("_id", None)

    # Deduct weight from each active spool + auto-depletion
    for usage in data.spools_used:
        spool = await db.active_spools.find_one({"id": usage.active_spool_id}, {"_id": 0})
        new_weight = max(0, spool["weight_remaining"] - usage.weight_used)
        new_status = "DEPLETED" if new_weight <= 0 else spool.get("status", "OPENED")
        await db.active_spools.update_one(
            {"id": usage.active_spool_id},
            {"$set": {
                "weight_remaining": new_weight,
                "status": new_status,
                "updated_at": now
            }}
        )

    return doc

@api_router.delete("/print-jobs/{job_id}")
async def delete_print_job(job_id: str, user=Depends(get_current_user)):
    job = await db.print_jobs.find_one({"id": job_id, "user_id": user["id"]}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Print job not found")

    total_weight_restored = 0.0
    now = datetime.now(timezone.utc).isoformat()

    # Restore weight to each spool
    for spool_usage in job.get("spools_used", []):
        spool_id = spool_usage.get("active_spool_id")
        weight_used = spool_usage.get("weight_used", 0)
        if spool_id and weight_used:
            spool = await db.active_spools.find_one({"id": spool_id}, {"_id": 0})
            if spool:
                new_weight = min(
                    spool.get("weight_total", 0),
                    spool.get("weight_remaining", 0) + weight_used
                )
                new_status = "OPENED" if new_weight > 0 else spool.get("status", "DEPLETED")
                await db.active_spools.update_one(
                    {"id": spool_id},
                    {"$set": {
                        "weight_remaining": new_weight,
                        "status": new_status,
                        "updated_at": now
                    }}
                )
                total_weight_restored += weight_used

    await db.print_jobs.delete_one({"id": job_id, "user_id": user["id"]})
    return {"message": "Print job deleted", "weight_restored": total_weight_restored}


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


# ── User Preferences ─────────────────────────────────────────────

@api_router.get("/user/preferences")
async def get_preferences(user=Depends(get_current_user)):
    prefs = await db.user_preferences.find_one({"user_id": user["id"]}, {"_id": 0})
    if not prefs:
        return {"user_id": user["id"], "country": "US", "currency": "USD", "currency_symbol": "$", "electricity_rate": 0.12}
    return prefs

@api_router.put("/user/preferences")
async def update_preferences(data: UserPreferencesUpdate, user=Depends(get_current_user)):
    await db.user_preferences.update_one(
        {"user_id": user["id"]},
        {"$set": {**data.model_dump(), "user_id": user["id"]}},
        upsert=True
    )
    prefs = await db.user_preferences.find_one({"user_id": user["id"]}, {"_id": 0})
    return prefs


# ── Cost Calculator ──────────────────────────────────────────────

@api_router.post("/calculator/estimate")
async def calculate_cost(data: CostEstimateRequest):
    filament_cost = data.weight_grams * (data.filament_cost_per_kg / 1000)
    electricity_cost = data.printer_power_kw * (data.duration_minutes / 60) * data.electricity_rate
    total = filament_cost + electricity_cost
    return {
        "filament_cost": round(filament_cost, 4),
        "electricity_cost": round(electricity_cost, 4),
        "total_cost": round(total, 4),
        "cost_per_gram": round(filament_cost / max(data.weight_grams, 0.01), 4),
    }


# ── Dashboard ────────────────────────────────────────────────────

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user=Depends(get_current_user)):
    user_id = user["id"]
    master_stocks = await db.master_stock.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    active_spools = await db.active_spools.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    jobs = await db.print_jobs.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)

    # Total warehouse spools + active spools
    warehouse_spools = sum(ms.get("quantity_in_stock", 0) for ms in master_stocks)
    total_filaments = warehouse_spools + len(active_spools)

    # Weight remaining (active spools only)
    total_weight = sum(s.get("weight_remaining", 0) for s in active_spools)

    # Total inventory value = warehouse value + active spool value
    warehouse_value = sum(ms.get("cost", 0) * ms.get("quantity_in_stock", 0) for ms in master_stocks)
    active_value = sum(s.get("cost", 0) for s in active_spools)
    total_value = warehouse_value + active_value

    # Low stock active spools (below 20%)
    low_stock = []
    for s in active_spools:
        wt = s.get("weight_total", 0)
        wr = s.get("weight_remaining", 0)
        if wt > 0 and s.get("status") == "OPENED" and (wr / wt) < 0.2:
            low_stock.append(s)

    # Total weight used from jobs
    total_used = sum(j.get("total_weight_used", 0) for j in jobs)

    # Usage by filament type (from jobs)
    type_usage = {}
    for j in jobs:
        for su in j.get("spools_used", []):
            ft = su.get("filament_type", "Unknown")
            type_usage[ft] = type_usage.get(ft, 0) + su.get("weight_used", 0)
    usage_by_type = [{"name": k, "weight": round(v, 1)} for k, v in type_usage.items()]

    # Type distribution (from master stock + active spools)
    type_count = {}
    for ms in master_stocks:
        ft = ms.get("filament_type", "Unknown")
        type_count[ft] = type_count.get(ft, 0) + ms.get("quantity_in_stock", 0)
    for s in active_spools:
        ft = s.get("filament_type", "Unknown")
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
    spools = await db.active_spools.find(
        {"user_id": user["id"], "status": "OPENED"}, {"_id": 0}
    ).to_list(1000)
    alerts = []
    for s in spools:
        wt = s.get("weight_total", 0)
        wr = s.get("weight_remaining", 0)
        if wt > 0:
            pct = (wr / wt) * 100
            if pct < 10:
                alerts.append({**s, "alert_level": "critical", "remaining_pct": round(pct, 1)})
            elif pct < 20:
                alerts.append({**s, "alert_level": "warning", "remaining_pct": round(pct, 1)})
            elif pct < 30:
                alerts.append({**s, "alert_level": "low", "remaining_pct": round(pct, 1)})
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
    master_stocks = await db.master_stock.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    active_spools = await db.active_spools.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    custom_brands_docs = await db.custom_brands.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    custom_types_docs = await db.custom_types.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)

    ms_brands = set(ms["brand"] for ms in master_stocks if ms.get("brand"))
    ms_types = set(ms["filament_type"] for ms in master_stocks if ms.get("filament_type"))
    as_brands = set(s["brand"] for s in active_spools if s.get("brand"))
    as_types = set(s["filament_type"] for s in active_spools if s.get("filament_type"))
    custom_brand_names = set(d["name"] for d in custom_brands_docs if d.get("name"))
    custom_type_names = set(d["name"] for d in custom_types_docs if d.get("name"))

    brands = sorted(ms_brands | as_brands | custom_brand_names)
    types = sorted(ms_types | as_types | custom_type_names)
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


# ── CSV Import / Export ──────────────────────────────────────────

CSV_COLUMNS = [
    "Location", "Quantity", "Brand", "Type", "Color", "Color Hex",
    "Weight Total (g)", "Weight Remaining (g)", "Cost ($)",
    "Empty Spool Weight (g)", "Notes"
]

@api_router.get("/inventory/export-template")
async def export_csv_template(user=Depends(get_current_user)):
    """Download a CSV template pre-filled with current inventory."""
    user_id = user["id"]
    stocks = await db.master_stock.find({"user_id": user_id}, {"_id": 0}).to_list(10000)
    spools = await db.active_spools.find({"user_id": user_id}, {"_id": 0}).to_list(10000)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_COLUMNS)

    for ms in stocks:
        writer.writerow([
            "WAREHOUSE",
            ms.get("quantity_in_stock", 0),
            ms.get("brand", ""),
            ms.get("filament_type", ""),
            ms.get("color", ""),
            ms.get("color_hex", "#ffffff"),
            ms.get("weight_total", 1000),
            "",  # weight_remaining not applicable for warehouse
            ms.get("cost", 0),
            ms.get("empty_spool_weight", 250),
            "",
        ])

    for sp in spools:
        writer.writerow([
            "ACTIVE",
            "",  # quantity not applicable for active spools
            sp.get("brand", ""),
            sp.get("filament_type", ""),
            sp.get("color", ""),
            sp.get("color_hex", "#ffffff"),
            sp.get("weight_total", 1000),
            sp.get("weight_remaining", 0),
            sp.get("cost", 0),
            sp.get("empty_spool_weight", 250),
            "",
        ])

    # If no data, add example rows
    if not stocks and not spools:
        writer.writerow(["WAREHOUSE", 5, "Hatchbox", "PLA", "Black", "#000000", 1000, "", 25, 250, "Example row"])
        writer.writerow(["ACTIVE", "", "Hatchbox", "PLA", "White", "#ffffff", 1000, 750, 25, 250, "Example row"])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=inventory_template.csv"}
    )


@api_router.post("/inventory/import")
async def import_csv(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Smart CSV import: upsert WAREHOUSE stock, create ACTIVE spools with parent lookup."""
    user_id = user["id"]
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    stats = {"warehouse_created": 0, "warehouse_updated": 0, "spools_created": 0, "errors": []}
    now = datetime.now(timezone.utc).isoformat()

    row_num = 1
    for row in reader:
        row_num += 1
        location = (row.get("Location") or "").strip().upper()
        brand = (row.get("Brand") or "").strip()
        ftype = (row.get("Type") or "").strip()
        color = (row.get("Color") or "").strip()
        color_hex = (row.get("Color Hex") or "#ffffff").strip()

        if not brand or not ftype or not color:
            stats["errors"].append(f"Row {row_num}: Missing Brand, Type, or Color")
            continue

        try:
            weight_total = float(row.get("Weight Total (g)") or 1000)
            cost = float(row.get("Cost ($)") or 0)
            empty_spool = float(row.get("Empty Spool Weight (g)") or 250)
        except ValueError:
            stats["errors"].append(f"Row {row_num}: Invalid numeric value")
            continue

        if location == "WAREHOUSE":
            try:
                quantity = int(row.get("Quantity") or 1)
            except ValueError:
                stats["errors"].append(f"Row {row_num}: Invalid Quantity")
                continue

            # Check if exact match exists
            existing = await db.master_stock.find_one({
                "user_id": user_id,
                "brand": brand,
                "filament_type": ftype,
                "color": color
            })

            if existing:
                await db.master_stock.update_one(
                    {"id": existing["id"]},
                    {
                        "$inc": {"quantity_in_stock": quantity},
                        "$set": {"updated_at": now}
                    }
                )
                stats["warehouse_updated"] += 1
            else:
                stock_id = str(uuid.uuid4())
                await db.master_stock.insert_one({
                    "id": stock_id,
                    "user_id": user_id,
                    "brand": brand,
                    "filament_type": ftype,
                    "color": color,
                    "color_hex": color_hex,
                    "empty_spool_weight": empty_spool,
                    "weight_total": weight_total,
                    "cost": cost,
                    "quantity_in_stock": quantity,
                    "created_at": now,
                    "updated_at": now,
                })
                stats["warehouse_created"] += 1

        elif location == "ACTIVE":
            try:
                weight_remaining = float(row.get("Weight Remaining (g)") or weight_total)
            except ValueError:
                stats["errors"].append(f"Row {row_num}: Invalid Weight Remaining")
                continue

            # Find or create parent MasterStock
            parent = await db.master_stock.find_one({
                "user_id": user_id,
                "brand": brand,
                "filament_type": ftype,
                "color": color
            })

            if not parent:
                parent_id = str(uuid.uuid4())
                parent = {
                    "id": parent_id,
                    "user_id": user_id,
                    "brand": brand,
                    "filament_type": ftype,
                    "color": color,
                    "color_hex": color_hex,
                    "empty_spool_weight": empty_spool,
                    "weight_total": weight_total,
                    "cost": cost,
                    "quantity_in_stock": 0,
                    "created_at": now,
                    "updated_at": now,
                }
                await db.master_stock.insert_one(parent)
                stats["warehouse_created"] += 1

            parent_id = parent["id"]

            # Generate unique string ID
            unique_sid = await generate_unique_string_id(user_id, ftype, color)

            # Create active spool
            spool_id = str(uuid.uuid4())
            status = "DEPLETED" if weight_remaining <= 0 else "OPENED"
            await db.active_spools.insert_one({
                "id": spool_id,
                "user_id": user_id,
                "unique_string_id": unique_sid,
                "master_stock_id": parent_id,
                "brand": brand,
                "filament_type": ftype,
                "color": color,
                "color_hex": color_hex,
                "empty_spool_weight": empty_spool,
                "weight_total": weight_total,
                "weight_remaining": weight_remaining,
                "cost": cost,
                "status": status,
                "created_at": now,
                "updated_at": now,
            })
            stats["spools_created"] += 1

        else:
            stats["errors"].append(f"Row {row_num}: Unknown Location '{location}'. Use WAREHOUSE or ACTIVE.")

    return {
        "message": "Import complete",
        "warehouse_created": stats["warehouse_created"],
        "warehouse_updated": stats["warehouse_updated"],
        "spools_created": stats["spools_created"],
        "errors": stats["errors"][:20],  # Cap errors at 20
        "total_errors": len(stats["errors"]),
    }


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
