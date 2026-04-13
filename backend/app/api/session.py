from fastapi import APIRouter, HTTPException
from app.core.state import replay_service, telemetry_service
from app.models.schemas import SessionLoadRequest
import numpy as np

router = APIRouter(prefix="/api", tags=["session"])

def _convert_native(obj):
    if isinstance(obj, np.integer):
        return int(obj)
    
    if isinstance(obj, np.floating):
        return float(obj)
    
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    
    if isinstance(obj, dict):
        return {k: _convert_native(v) for k, v in obj.items()}
    
    if isinstance(obj, list):
        return [_convert_native(v) for v in obj]
    
    return obj

@router.post("/load-session")
async def load_session(payload: SessionLoadRequest):
    try:
        data = telemetry_service.load_session(
            year=payload.year,
            round_number=payload.round_number,
            session_type=payload.session_type,
            refresh=payload.refresh,
        )

        replay_service.set_total_frames(data.get("total_frames", 0))
        return _convert_native({"status": "loaded", **data})
    
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

@router.get("/sessions/{year}")
async def list_sessions(year: int):
    try:
        rounds = telemetry_service.list_rounds(year)
        return {"year": year, "rounds": rounds}
    
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
