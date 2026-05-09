"""Media metadata extraction helpers for worker actors."""
from __future__ import annotations

import json
import subprocess
import tempfile
from io import BytesIO
from pathlib import Path
from typing import Any

from mutagen import File as MutagenFile
from PIL import Image


def _run_ffprobe(path: Path) -> dict[str, Any]:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_format",
        "-show_streams",
        "-print_format",
        "json",
        str(path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(result.stdout or "{}")


def _duration_from_ffprobe(ffprobe_json: dict[str, Any]) -> int | None:
    fmt = ffprobe_json.get("format", {})
    value = fmt.get("duration")
    if value is None:
        return None
    try:
        return int(float(value) * 1000)
    except (TypeError, ValueError):
        return None


def extract_image_metadata(payload: bytes) -> tuple[int | None, int | None, int | None, dict[str, Any]]:
    with Image.open(BytesIO(payload)) as img:
        width, height = img.size
        metadata = {
            "extractor": "pillow",
            "format": img.format,
            "mode": img.mode,
        }
    return width, height, None, metadata


def extract_audio_metadata(payload: bytes) -> tuple[int | None, int | None, int | None, dict[str, Any]]:
    metadata: dict[str, Any] = {"extractor": "mutagen"}
    duration_ms: int | None = None

    parsed = MutagenFile(BytesIO(payload))
    if parsed is not None and getattr(parsed, "info", None) is not None:
        info = parsed.info
        metadata["mutagen_type"] = parsed.__class__.__name__
        metadata["codec"] = info.__class__.__name__
        length = getattr(info, "length", None)
        if isinstance(length, (int, float)):
            duration_ms = int(length * 1000)
        bitrate = getattr(info, "bitrate", None)
        if isinstance(bitrate, int):
            metadata["bitrate"] = bitrate
        sample_rate = getattr(info, "sample_rate", None)
        if isinstance(sample_rate, int):
            metadata["sample_rate"] = sample_rate

    with tempfile.NamedTemporaryFile(suffix=".audio", delete=True) as tmp:
        tmp.write(payload)
        tmp.flush()
        ffprobe_json = _run_ffprobe(Path(tmp.name))
        metadata["ffprobe"] = ffprobe_json
        duration_ms = duration_ms or _duration_from_ffprobe(ffprobe_json)

    return None, None, duration_ms, metadata


def extract_video_metadata(payload: bytes) -> tuple[int | None, int | None, int | None, dict[str, Any]]:
    with tempfile.NamedTemporaryFile(suffix=".video", delete=True) as tmp:
        tmp.write(payload)
        tmp.flush()
        ffprobe_json = _run_ffprobe(Path(tmp.name))

    width: int | None = None
    height: int | None = None
    for stream in ffprobe_json.get("streams", []):
        if stream.get("codec_type") == "video":
            try:
                width = int(stream.get("width")) if stream.get("width") is not None else None
                height = int(stream.get("height")) if stream.get("height") is not None else None
            except (TypeError, ValueError):
                width = None
                height = None
            break

    metadata = {"extractor": "ffprobe", "ffprobe": ffprobe_json}
    duration_ms = _duration_from_ffprobe(ffprobe_json)
    return width, height, duration_ms, metadata
