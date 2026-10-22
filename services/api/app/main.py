from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import account, challenges, photos, recommendations, street_life, tours

app = FastAPI(title="Zacatecas Deslumbrante API", version="0.1.0")

# Express (:3000) es la puerta de entrada; CORS solo para el dev local directo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["content-type", "authorization"],
)

app.include_router(account.router)
app.include_router(challenges.router)
app.include_router(photos.router)
app.include_router(recommendations.router)
app.include_router(street_life.router)
app.include_router(tours.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
