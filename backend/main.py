import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from app.api.insights import router as insights_router
from app.api.qualifying import router as qualifying_router
from app.api.replay import router as replay_router
from app.api.session import router as session_router
from app.api.ws import router as ws_router

app = FastAPI(title="F1 Simulation", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(session_router)
app.include_router(replay_router)
app.include_router(qualifying_router)
app.include_router(insights_router)
app.include_router(ws_router)

@app.get("/")
async def root():
    return {"status": "ok", "service": "F1 Simulation API"}

if __name__ == "__main__":
    use_reload = os.environ.get("F1_API_RELOAD", "").strip().lower() in ("1", "true", "yes")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=use_reload,
        log_level="info",
    )