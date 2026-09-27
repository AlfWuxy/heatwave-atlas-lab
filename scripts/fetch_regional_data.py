#!/usr/bin/env python3
"""有限区域 ERA5 风温格点下载：保留原始响应、来源和逐项验证。仅用标准库。"""

import argparse
import hashlib
import json
import math
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "regional"
PUBLIC = ROOT / "public" / "data"
BASE_URL = "https://archive-api.open-meteo.com/v1/archive"
VARIABLES = ("temperature_2m", "wind_speed_10m", "wind_direction_10m")
EXPECTED_UNITS = {"time": "iso8601", "temperature_2m": "°C", "wind_speed_10m": "m/s", "wind_direction_10m": "°"}
CASES = {
    "chongqing2022": {"title": "2022 重庆—四川热浪", "west": 103, "east": 109, "south": 28, "north": 32, "start": "2022-08-10", "end": "2022-08-28"},
    "paris2019": {"title": "2019 西欧热浪", "west": -1, "east": 5, "south": 46, "north": 51, "start": "2019-07-18", "end": "2019-07-30"},
    "portland2021": {"title": "2021 北美西北热浪", "west": -125, "east": -119, "south": 43, "north": 48, "start": "2021-06-20", "end": "2021-07-05"},
}


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def digest(payload):
    return hashlib.sha256(payload).hexdigest()


def write_json(path, value, compact=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(value, ensure_ascii=False, allow_nan=False, indent=None if compact else 2,
                         separators=(",", ":") if compact else None) + "\n"
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(payload, encoding="utf-8")
    temporary.replace(path)


def axis(low, high):
    return [index / 4 for index in range(int(low * 4), int(high * 4) + 1)]


def hourly_times(start, end):
    first = datetime.fromisoformat(start)
    end = datetime.fromisoformat(end) + timedelta(days=1)
    return [(first + timedelta(hours=hour)).strftime("%Y-%m-%dT%H:%M")
            for hour in range(int((end - first).total_seconds() / 3600))]


def request_url(points, case):
    params = {
        "latitude": ",".join(f"{lat:g}" for lon, lat in points),
        "longitude": ",".join(f"{lon:g}" for lon, lat in points),
        "start_date": case["start"], "end_date": case["end"],
        "hourly": ",".join(VARIABLES), "models": "era5",
        # 多点请求要求每个坐标分别指定 nan，不进行海拔订正。
        "elevation": ",".join("nan" for _ in points),
        "cell_selection": "nearest", "timezone": "UTC", "wind_speed_unit": "ms",
    }
    return BASE_URL + "?" + urllib.parse.urlencode(params)


def validate_batch(payload, points, expected_times):
    rows = json.loads(payload)
    if isinstance(rows, dict):
        if rows.get("error"):
            raise ValueError("API 返回错误：" + str(rows))
        rows = [rows]
    if len(rows) != len(points):
        raise ValueError("API 返回位置数量与请求不一致")
    returned = []
    for row, (lon, lat) in zip(rows, points):
        actual = (row.get("longitude"), row.get("latitude"))
        if actual != (lon, lat):
            raise ValueError(f"返回坐标并非请求原格点：请求 {(lon, lat)}，返回 {actual}")
        if row.get("utc_offset_seconds") != 0 or row.get("timezone") not in ("GMT", "UTC"):
            raise ValueError("返回时区不是 UTC")
        if row.get("hourly_units") != EXPECTED_UNITS:
            raise ValueError(f"字段单位不匹配：{row.get('hourly_units')}")
        series = row.get("hourly", {})
        if series.get("time") != expected_times:
            raise ValueError("返回时间未覆盖精确的逐小时时间窗口")
        for variable in VARIABLES:
            values = series.get(variable, [])
            if len(values) != len(expected_times):
                raise ValueError(f"{variable} 数组长度不一致")
            if any(isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) for value in values):
                raise ValueError(f"{variable} 含缺失或非有限数值；不填充缺失")
        if any(speed < 0 for speed in series["wind_speed_10m"]):
            raise ValueError("风速为负")
        if any(direction < 0 or direction > 360 for direction in series["wind_direction_10m"]):
            raise ValueError("风向不在 0—360 度")
        returned.append({"longitude": actual[0], "latitude": actual[1], "elevation": row.get("elevation")})
    if len({(item["longitude"], item["latitude"]) for item in returned}) != len(points):
        raise ValueError("返回重复格点")
    return rows, returned


class Downloader:
    def __init__(self, interval):
        self.interval = max(8.0, interval)
        self.last_request_completed = None

    def fetch(self, url, path, points, expected_times, manifest, manifest_path):
        relative = str(path.relative_to(ROOT))
        previous = next((item for item in manifest["requests"] if item["path"] == relative), None)
        if previous:
            if previous["url"] != url:
                raise ValueError(f"缓存请求 URL 已变化，拒绝覆盖：{relative}")
            if path.exists():
                payload = path.read_bytes()
                if digest(payload) != previous["sha256"]:
                    raise ValueError(f"缓存 SHA-256 不符：{relative}")
                rows, returned = validate_batch(payload, points, expected_times)
                if returned != previous["returnedGrid"]:
                    raise ValueError(f"缓存返回坐标与清单不符：{relative}")
                print(f"CACHE {path.name}: {len(rows)} points", flush=True)
                return rows
        elif path.exists():
            raise ValueError(f"文件存在但未登记来源，拒绝复用：{relative}")

        for attempt in range(2):
            if self.last_request_completed is not None:
                delay = self.interval - (time.monotonic() - self.last_request_completed)
                if delay > 0:
                    time.sleep(delay)
            timestamp = utc_now()
            try:
                request = urllib.request.Request(url, headers={"User-Agent": "HeatFormationResearch/1.0 (non-commercial research)"})
                with urllib.request.urlopen(request, timeout=90) as response:
                    payload = response.read()
                    content_type = response.headers.get("Content-Type")
                    status = response.status
                self.last_request_completed = time.monotonic()
                # 先原样存档，再验证；验证失败的数据不会成为公开成品。
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(payload)
                entry = {"path": relative, "url": url, "retrievedAt": timestamp, "sha256": digest(payload),
                         "bytes": len(payload), "httpStatus": status, "contentType": content_type,
                         "requestedGrid": [{"longitude": lon, "latitude": lat} for lon, lat in points],
                         "validation": {"passed": False}}
                if previous:
                    manifest["requests"][manifest["requests"].index(previous)] = entry
                else:
                    manifest["requests"].append(entry)
                write_json(manifest_path, manifest)
                rows, returned = validate_batch(payload, points, expected_times)
                entry["returnedGrid"] = returned
                entry["validation"] = {"passed": True, "points": len(points), "hoursPerPoint": len(expected_times),
                                       "exactRequestedCoordinates": True, "noDuplicateCoordinates": True,
                                       "completeHourlyUtc": True, "unitsMatch": True, "noMissingValues": True,
                                       "finiteValues": True, "nonnegativeWindSpeed": True, "validWindDirection": True}
                write_json(manifest_path, manifest)
                print(f"FETCH {path.name}: {len(rows)} points, {len(payload):,} bytes, validation passed", flush=True)
                return rows
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
                self.last_request_completed = time.monotonic()
                status = getattr(error, "code", None)
                body = error.read().decode("utf-8", errors="replace") if isinstance(error, urllib.error.HTTPError) else ""
                manifest["errors"].append({"url": url, "attempt": attempt + 1, "at": timestamp,
                                           "httpStatus": status, "error": str(error), "body": body})
                write_json(manifest_path, manifest)
                # 429 立即停止；仅明确的 5xx 服务错误重试一次。
                if attempt == 0 and status is not None and 500 <= status < 600:
                    print(f"RETRY ONCE HTTP {status}", flush=True)
                    continue
                raise


def run_case(case_id, downloader):
    case = CASES[case_id]
    directory = DATA / case_id
    manifest_path = directory / "manifest.json"
    directory.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {
        "schemaVersion": "1", "caseId": case_id, "createdAt": utc_now(), "status": "incomplete",
        "requestPolicy": {"maxPointsPerBatch": 25, "minimumSecondsAfterResponse": downloader.interval,
                          "limitCountingUnit": "requested locations", "stopImmediatelyOn429": True,
                          "maximum5xxRetries": 1, "cacheRequiresExactUrlAndSha256": True},
        "dataset": "ERA5 via Open-Meteo Historical Weather API", "requests": [], "errors": [],
    }
    lons, lats = axis(case["west"], case["east"]), axis(case["south"], case["north"])
    points = [(lon, lat) for lat in lats for lon in lons]
    times = hourly_times(case["start"], case["end"])
    all_rows = []
    # 首批只有两点，先验证 ERA5 坐标、单位和完整时间轴再扩大读取。
    batches = [points[:2]] + [points[index:index + 25] for index in range(2, len(points), 25)]
    for index, batch in enumerate(batches):
        url = request_url(batch, case)
        path = directory / "raw" / f"batch-{index:03d}.json"
        rows = downloader.fetch(url, path, batch, times, manifest, manifest_path)
        all_rows.extend(rows)
    if len(all_rows) != len(points):
        raise ValueError("总格点未下载完整，不能发布")
    returned_coordinates = [(row["longitude"], row["latitude"]) for row in all_rows]
    if returned_coordinates != points or len(set(returned_coordinates)) != len(points):
        raise ValueError("合并后网格不规则或坐标重复，不能发布")

    temperature, east_wind, north_wind = [], [], []
    for hour in range(len(times)):
        t_frame, u_frame, v_frame = [], [], []
        for row in all_rows:
            series = row["hourly"]
            t_frame.append(series["temperature_2m"][hour])
            speed = series["wind_speed_10m"][hour]
            angle = math.radians(series["wind_direction_10m"][hour])
            # 气象风向表示来向；u 向东为正，v 向北为正。
            u_frame.append(round(-speed * math.sin(angle), 6))
            v_frame.append(round(-speed * math.cos(angle), 6))
        temperature.append(t_frame)
        east_wind.append(u_frame)
        north_wind.append(v_frame)
    validation = {"passed": True, "pointCount": len(points), "frameCount": len(times),
                  "completeRegularGrid": True, "exactRequestedCoordinates": True, "uniqueCoordinates": True,
                  "hourlyUtcContiguous": True, "allArrayLengthsMatch": True, "noMissingValues": True,
                  "allValuesFinite": True, "unitsMatch": True, "resolutionDegrees": 0.25,
                  "temperatureMin": min(min(frame) for frame in temperature),
                  "temperatureMax": max(max(frame) for frame in temperature),
                  "windConversion": "u=-speed*sin(direction*pi/180); v=-speed*cos(direction*pi/180)",
                  "windPrecisionDecimals": 6, "interpolationApplied": False}
    output = {"schemaVersion": "1", "caseId": case_id, "title": case["title"],
              "source": {"label": "ERA5 · Open-Meteo Historical Weather API",
                         "documentationUrl": "https://open-meteo.com/en/docs/historical-weather-api",
                         "datasetUrl": "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels",
                         "attribution": "Weather data by Open-Meteo.com (CC BY 4.0), based on Copernicus Climate Change Service ERA5 reanalysis (ECMWF)."},
              "retrievedAt": max(item["retrievedAt"] for item in manifest["requests"]),
              "grid": {"nx": len(lons), "ny": len(lats), "lons": lons, "lats": lats, "spacing": 0.25,
                       "crs": "EPSG:4326", "order": "south-to-north, west-to-east"},
              "times": [timestamp + ":00Z" for timestamp in times],
              "temperature": temperature, "u": east_wind, "v": north_wind,
              "units": {"temperature": "°C", "wind": "m/s"}, "validation": validation,
              "rawManifestUrl": f"/data/regional-{case_id}-manifest.json"}
    output_path = PUBLIC / f"regional-{case_id}.json"
    write_json(output_path, output, compact=True)
    manifest["status"] = "complete"
    manifest["completedAt"] = utc_now()
    manifest["validation"] = validation
    manifest["artifact"] = {"path": str(output_path.relative_to(ROOT)), "sha256": digest(output_path.read_bytes()),
                            "bytes": output_path.stat().st_size}
    write_json(manifest_path, manifest)
    write_json(PUBLIC / f"regional-{case_id}-manifest.json", manifest)
    print(f"COMPLETE {case_id}: {len(lons)}×{len(lats)} grid, {len(times)} hours, {output_path.stat().st_size:,} bytes", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", choices=[*CASES, "all"], default="chongqing2022")
    parser.add_argument("--interval", type=float, default=8.0, help="响应结束后至少等待秒数，不能低于 8")
    args = parser.parse_args()
    downloader = Downloader(args.interval)
    try:
        for case_id in CASES if args.case == "all" else [args.case]:
            run_case(case_id, downloader)
    except (OSError, ValueError, KeyError) as error:
        print(f"STOP: {error}", file=sys.stderr, flush=True)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
