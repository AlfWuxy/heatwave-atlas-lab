#!/usr/bin/env python3
"""为公众网站补充 1991—2005 年点位基准；不修改原样本。"""
import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data/site_reference"
MANIFEST = BASE / "manifest.json"
CITIES = [
    ("portland", 45.52, -122.68), ("paris", 48.86, 2.35),
    ("chongqing", 29.56, 106.55), ("new_delhi", 28.61, 77.21),
    ("sao_paulo", -23.55, -46.63), ("sydney", -33.87, 151.21),
]


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def save(manifest):
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


def run():
    BASE.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {
        "schema_version": 1, "created_at_utc": now(), "requests": [], "errors": [],
        "purpose": "1991—2005 年日气温；与已有 2006—2020 年拼接构成 1991—2020 年点位基准。",
        "provider": "Open-Meteo 第三方 API；原始模式 ERA5；UTC 日；无海拔降尺度。",
    }
    for city_id, latitude, longitude in CITIES:
        for year in range(1991, 2006):
            params = {
                "latitude": latitude, "longitude": longitude,
                "start_date": f"{year}-01-01", "end_date": f"{year}-12-31",
                "models": "era5", "elevation": "nan", "timezone": "UTC",
                "cell_selection": "nearest", "wind_speed_unit": "ms",
                "daily": "temperature_2m_max,temperature_2m_min",
            }
            url = "https://archive-api.open-meteo.com/v1/archive?" + urllib.parse.urlencode(params)
            path = BASE / f"{city_id}_daily_{year}.json"
            relative = str(path.relative_to(ROOT))
            existing = next((r for r in manifest["requests"] if r["path"] == relative), None)
            if path.exists():
                if not existing or existing["url"] != url or existing["sha256"] != hashlib.sha256(path.read_bytes()).hexdigest():
                    raise ValueError(f"缓存请求或 SHA-256 不一致：{relative}")
                continue
            timestamp = now()
            try:
                request = urllib.request.Request(url, headers={"User-Agent": "HeatwaveAnatomyResearch/1.0 (non-commercial education)"})
                with urllib.request.urlopen(request, timeout=60) as response:
                    payload = response.read()
                data = json.loads(payload)
                series = data["daily"]
                expected = [(date(year, 1, 1) + timedelta(days=i)).isoformat() for i in range((date(year+1, 1, 1)-date(year, 1, 1)).days)]
                assert series["time"] == expected
                assert data["utc_offset_seconds"] == 0
                assert data["daily_units"] == {"time": "iso8601", "temperature_2m_max": "°C", "temperature_2m_min": "°C"}
                assert all(len(values) == len(expected) for values in series.values())
                assert all(isinstance(v, (float, int)) for key, values in series.items() if key != "time" for v in values)
                assert all(hi >= lo for hi, lo in zip(series["temperature_2m_max"], series["temperature_2m_min"]))
                path.write_bytes(payload)
                entry = {
                    "path": relative, "url": url, "retrieved_at_utc": timestamp,
                    "sha256": hashlib.sha256(payload).hexdigest(), "bytes": len(payload),
                    "source": "open_meteo_era5", "kind": "daily", "city_id": city_id,
                    "requested_location": {"latitude": latitude, "longitude": longitude},
                    "returned_location": {key: data[key] for key in ("latitude", "longitude", "elevation", "timezone", "utc_offset_seconds")},
                    "units": {"daily_units": data["daily_units"]}, "rows": len(expected),
                }
                if existing:
                    manifest["requests"][manifest["requests"].index(existing)] = entry
                else:
                    manifest["requests"].append(entry)
                save(manifest)
                print(f"下载完成 {city_id} {year} {len(expected)} 日", flush=True)
                # 串行限速；HTTP 429 立即退出，不变更身份或端点规避限流。
                time.sleep(1.3)
            except Exception as error:
                manifest["errors"].append({"url": url, "time": timestamp, "error": str(error)})
                save(manifest)
                raise
    manifest["completed_at_utc"] = now()
    save(manifest)
    print("全部六点 1991—2005 补充完成", flush=True)


if __name__ == "__main__":
    run()
