import os
import pickle
from pathlib import Path
from typing import Any, Dict, Optional
import fastf1
import pandas as pd
from processor import F1DataProcessor

class TelemetryService:
    def __init__(self) -> None:
        self.processor: Optional[F1DataProcessor] = None
        self.qualifying_data: Optional[Dict[str, Any]] = None
        self.active_session_type = "R"

    def load_session(self, year: int, round_number: int, session_type: str = "R", refresh: bool = False) -> Dict[str, Any]:
        self.active_session_type = session_type
        if session_type in ("Q", "SQ"):
            self.qualifying_data = self._load_qualifying(year, round_number, session_type, refresh=refresh)
            self.processor = None
            return {
                "mode": "qualifying",
                "session_info": self.qualifying_data.get("session_info", {}),
                "total_frames": self.qualifying_data.get("summary", {}).get("max_frames", 0),
                "track_boundaries": self.qualifying_data.get("track_boundaries", {}),
                "qualifying": self.qualifying_data,
            }

        self.qualifying_data = None
        self.processor = F1DataProcessor(year, round_number, session_type)
        if refresh:
            cache_file = self.processor.get_cache_filename()
            if os.path.exists(cache_file):
                os.remove(cache_file)
        
        self.processor.load_session()
        return {
            "mode": "race",
            "session_info": self.processor.get_session_info(),
            "total_frames": len(self.processor.frames),
            "circuit_info": self.processor.get_circuit_info(),
            "track_boundaries": self.processor.get_track_boundaries(),
        }

    def get_frame(self, frame_index: int) -> Dict[str, Any]:
        if self.processor is None:
            return {}
        
        return self.processor.get_frame(frame_index)

    def list_rounds(self, year: int) -> list[Dict[str, Any]]:
        self._enable_cache()
        schedule = fastf1.get_event_schedule(year)
        items = []
        for _, event in schedule.iterrows():
            if event.is_testing():
                continue
            
            items.append(
                {
                    "round_number": int(event["RoundNumber"]),
                    "event_name": event["EventName"],
                    "date": str(event["EventDate"].date()),
                    "country": event["Country"],
                    "type": event["EventFormat"],
                }
            )
        
        return items

    def _enable_cache(self) -> None:
        cache_dir = Path(".fastf1-cache")
        cache_dir.mkdir(exist_ok=True)
        fastf1.Cache.enable_cache(str(cache_dir))

    def _load_qualifying(self, year: int, round_number: int, session_type: str, refresh: bool = False) -> Dict[str, Any]:
        self._enable_cache()
        event_key = f"{year}_R{round_number}_{session_type}"
        cache_file = Path("computed_data") / f"{event_key}_quali_web.pkl"
        cache_file.parent.mkdir(exist_ok=True)

        if cache_file.exists() and not refresh:
            with open(cache_file, "rb") as handle:
                return pickle.load(handle)

        session = fastf1.get_session(year, round_number, session_type)
        session.load(telemetry=True, weather=True)
        results = session.results
        driver_payload: Dict[str, Any] = {}
        max_frames = 0

        for _, row in results.iterrows():
            code = row.get("Abbreviation")
            if not code:
                continue
            
            driver_payload[code] = {"full_name": row.get("FullName"), "segments": {}}
            for segment in ("Q1", "Q2", "Q3"):
                segment_frames = self._driver_segment_frames(session, code, segment)
                driver_payload[code]["segments"][segment] = segment_frames
                max_frames = max(max_frames, len(segment_frames))

        qualifying_results = []
        for _, row in results.iterrows():
            if pd.isna(row.get("Position")):
                continue
            
            qualifying_results.append(
                {
                    "code": row.get("Abbreviation"),
                    "full_name": row.get("FullName"),
                    "position": int(row.get("Position")),
                    "Q1": str(row.get("Q1").total_seconds()) if pd.notna(row.get("Q1")) else None,
                    "Q2": str(row.get("Q2").total_seconds()) if pd.notna(row.get("Q2")) else None,
                    "Q3": str(row.get("Q3").total_seconds()) if pd.notna(row.get("Q3")) else None,
                }
            )

        summary = {
            "session_info": {
                "event_name": session.event["EventName"],
                "round": int(session.event["RoundNumber"]),
                "country": session.event["Country"],
                "location": session.event["Location"],
                "date": str(session.event["EventDate"]),
            },
            "results": qualifying_results,
            "telemetry": driver_payload,
            "summary": {"max_frames": max_frames},
            "track_boundaries": {
                "inner": {"x": [], "y": []},
                "outer": {"x": [], "y": []},
                "center": {"x": [], "y": []},
                "corridor_width_m": 0.0,
                "drs_zones": [],
            },
        }

        with open(cache_file, "wb") as handle:
            pickle.dump(summary, handle, protocol=pickle.HIGHEST_PROTOCOL)
        
        return summary

    def _driver_segment_frames(self, session: Any, driver_code: str, segment: str) -> list[Dict[str, Any]]:
        q1, q2, q3 = session.laps.split_qualifying_sessions()
        seg_map = {"Q1": q1, "Q2": q2, "Q3": q3}
        laps = seg_map.get(segment)
        if laps is None:
            return []
        
        driver_laps = laps.pick_drivers(driver_code)
        if driver_laps.empty:
            return []
        
        fastest = driver_laps.pick_fastest()
        if fastest is None:
            return []
        
        tel = fastest.get_telemetry()
        if tel is None or tel.empty:
            return []
        
        frames = []
        start = tel["Time"].dt.total_seconds().min()
        for _, point in tel.iterrows():
            frames.append(
                {
                    "t": float(point["Time"].total_seconds() - start),
                    "telemetry": {
                        "x": float(point.get("X", 0.0)),
                        "y": float(point.get("Y", 0.0)),
                        "dist": float(point.get("Distance", 0.0)),
                        "rel_dist": float(point.get("RelativeDistance", 0.0)),
                        "speed": float(point.get("Speed", 0.0)),
                        "gear": int(point.get("nGear", 0)),
                        "throttle": float(point.get("Throttle", 0.0)),
                        "brake": float(point.get("Brake", 0.0)) * 100.0,
                        "drs": int(point.get("DRS", 0)),
                    },
                }
            )
        
        return frames