from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)

class ReportCreate(BaseModel):
    title: str
    description: str | None = None
    category: str
    lat: float
    lng: float
    photo_url: str | None = None
    cloudinary_id: str | None = None

@app.get("/")
def root():
    return {"status": "ok", "message": "API Mapa Denúncias rodando!"}

@app.get("/reports")
def get_reports():
    response = supabase.table("reports").select("*, photos(*)").execute()
    return response.data

@app.post("/reports")
def create_report(report: ReportCreate, authorization: str = Header(...)):
    try:
        token = authorization.replace("Bearer ", "")
        user = supabase.auth.get_user(token)
        user_id = user.user.id

        new_report = supabase.table("reports").insert({
            "user_id": user_id,
            "title": report.title,
            "description": report.description,
            "category": report.category,
            "lat": report.lat,
            "lng": report.lng,
        }).execute()

        report_id = new_report.data[0]["id"]

        if report.photo_url:
            supabase.table("photos").insert({
                "report_id": report_id,
                "url": report.photo_url,
                "cloudinary_id": report.cloudinary_id or "",
            }).execute()

        return new_report.data[0]

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.patch("/reports/{report_id}/status")
def update_status(report_id: str, body: dict, authorization: str = Header(...)):
    try:
        token = authorization.replace("Bearer ", "")
        user = supabase.auth.get_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Token inválido")

        response = supabase.table("reports").update(
            {"status": body["status"]}
        ).eq("id", report_id).execute()

        return response.data[0]

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))