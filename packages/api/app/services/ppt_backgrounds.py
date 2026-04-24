from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

REPO_ROOT = Path(__file__).resolve().parents[4]
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_ROOT = BASE_DIR / "uploads"
SLIDES_ROOT = UPLOAD_ROOT / "slides"

PRESET_DIR = REPO_ROOT / "packages" / "web" / "public" / "ppt-backgrounds"
PRESET_INDEX = PRESET_DIR / "index.json"

UPLOADS_DIR = UPLOAD_ROOT / "assets" / "ppt_backgrounds" / "uploads"

BACKGROUND_CONFIG_NAME = "backgrounds.json"


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _load_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _write_json(path: Path, payload: Dict[str, Any]) -> None:
    _ensure_dir(path.parent)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def list_preset_assets() -> List[Dict[str, Any]]:
    payload = _load_json(PRESET_INDEX)
    assets = payload.get("assets", [])
    results: List[Dict[str, Any]] = []
    for asset in assets:
        asset_id = asset.get("id")
        file_name = asset.get("file")
        if not asset_id or not file_name:
            continue
        results.append(
            {
                "id": f"preset:{asset_id}",
                "name": asset.get("name") or asset_id,
                "tags": asset.get("tags") or [],
                "author": asset.get("author"),
                "source": asset.get("source"),
                "source_url": asset.get("source_url"),
                "license": asset.get("license"),
                "url": f"/ppt-backgrounds/{file_name}",
                "file": str(PRESET_DIR / file_name),
            }
        )
    return results


def _uploads_index_path(user_id: str) -> Path:
    return UPLOADS_DIR / user_id / "index.json"


def list_upload_assets(user_id: str) -> List[Dict[str, Any]]:
    index_path = _uploads_index_path(user_id)
    payload = _load_json(index_path)
    assets = payload.get("assets", [])
    results: List[Dict[str, Any]] = []
    for asset in assets:
        asset_id = asset.get("id")
        file_name = asset.get("file")
        if not asset_id or not file_name:
            continue
        results.append(
            {
                "id": f"upload:{asset_id}",
                "name": asset.get("name") or file_name,
                "tags": asset.get("tags") or [],
                "author": asset.get("author"),
                "source": asset.get("source") or "upload",
                "source_url": asset.get("source_url"),
                "license": asset.get("license"),
                "url": asset.get("url"),
                "file": asset.get("file_path"),
            }
        )
    return results


def record_upload_asset(user_id: str, asset: Dict[str, Any]) -> None:
    index_path = _uploads_index_path(user_id)
    payload = _load_json(index_path)
    assets = payload.get("assets", [])
    assets.append(asset)
    payload["assets"] = assets
    payload["updated_at"] = datetime.utcnow().isoformat()
    _write_json(index_path, payload)


def resolve_asset_path(asset_id: str, user_id: Optional[str]) -> Optional[Path]:
    if asset_id.startswith("preset:"):
        preset_id = asset_id.split("preset:", 1)[1]
        for asset in list_preset_assets():
            if asset["id"] == f"preset:{preset_id}":
                file_path = asset.get("file")
                if file_path:
                    return Path(file_path)
        return None
    if asset_id.startswith("upload:") and user_id:
        upload_id = asset_id.split("upload:", 1)[1]
        for asset in list_upload_assets(user_id):
            if asset["id"] == f"upload:{upload_id}":
                file_path = asset.get("file")
                if file_path:
                    return Path(file_path)
        return None
    return None


def background_config_path(meeting_id: str) -> Path:
    return SLIDES_ROOT / meeting_id / BACKGROUND_CONFIG_NAME


def load_background_config(meeting_id: str) -> Dict[str, Any]:
    path = background_config_path(meeting_id)
    payload = _load_json(path)
    slides = payload.get("slides") or {}
    normalized: Dict[str, Any] = {
        "global_id": payload.get("global_id"),
        "slides": {str(k): v for k, v in slides.items()},
    }
    return normalized


def save_background_config(meeting_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    normalized = load_background_config(meeting_id)
    global_id = payload.get("global_id", normalized.get("global_id"))
    slides = payload.get("slides") or normalized.get("slides") or {}
    normalized = {
        "global_id": global_id,
        "slides": {str(k): v for k, v in slides.items()},
        "updated_at": datetime.utcnow().isoformat(),
    }
    path = background_config_path(meeting_id)
    _write_json(path, normalized)
    return normalized
