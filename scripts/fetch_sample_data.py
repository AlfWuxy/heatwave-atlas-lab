#!/usr/bin/env python3
"""下载有限的真实样本，并保留可复核来源；仅使用 Python 标准库。"""

import csv
import hashlib
import json
import math
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = DATA / "raw"
CSV_DIR = DATA / "csv"
BASE_URL = "https://archive-api.open-meteo.com/v1/archive"
HOURLY_VARIABLES = [
    "temperature_2m", "relative_humidity_2m", "pressure_msl", "cloud_cover",
    "shortwave_radiation", "wind_speed_10m", "wind_direction_10m",
    "soil_moisture_0_to_7cm", "precipitation",
]
CITIES = [
    ("portland", "波特兰", 45.52, -122.68),
    ("paris", "巴黎", 48.86, 2.35),
    ("chongqing", "重庆", 29.56, 106.55),
    ("new_delhi", "新德里", 28.61, 77.21),
    ("sao_paulo", "圣保罗", -23.55, -46.63),
    ("sydney", "悉尼", -33.87, 151.21),
]
WINDOWS = {
    "portland": ("2021-06-20", "2021-07-05"),
    "paris": ("2019-07-18", "2019-07-30"),
    "chongqing": ("2022-08-10", "2022-08-28"),
}
NOAA_URL = (
    "https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries"
    "&stations=USW00024229&startDate=2021-06-25&endDate=2021-06-30"
    "&dataTypes=TMAX,TMIN&units=metric&format=json"
)


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def save_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def artifact(path, **extra):
    return {"path": str(path.relative_to(ROOT)), "bytes": path.stat().st_size, "sha256": sha256(path), **extra}


def make_url(city, start, end, kind):
    params = {
        "latitude": city[2], "longitude": city[3], "start_date": start,
        "end_date": end, "models": "era5", "elevation": "nan",
        "timezone": "UTC", "cell_selection": "nearest", "wind_speed_unit": "ms",
    }
    if kind in ("daily", "smoke"):
        params["daily"] = "temperature_2m_max,temperature_2m_min"
    if kind in ("hourly", "smoke"):
        params["hourly"] = ",".join(HOURLY_VARIABLES)
    return BASE_URL + "?" + urllib.parse.urlencode(params)


def fetch(url, relative_name, metadata):
    path = RAW / relative_name
    previous = next((item for item in manifest["requests"] if item["path"] == str(path.relative_to(ROOT))), None)
    # 请求、路径与内容同时匹配才复用；更换参数应另取文件名，保护原始溯源。
    if previous:
        if previous.get("url") != url:
            raise ValueError(f"同名缓存的请求已变化，请使用新文件名：{relative_name}")
        if path.exists():
            if sha256(path) != previous["sha256"]:
                raise ValueError(f"缓存校验值不符，请检查原文件或使用新文件名：{relative_name}")
            print("复用", relative_name, flush=True)
            return json.loads(path.read_text(encoding="utf-8"))
    elif path.exists():
        raise ValueError(f"同名文件未登记来源，请使用新文件名：{relative_name}")
    for attempt in range(2):
        timestamp = utc_now()
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "HeatFormationResearchSample/1.0 (non-commercial research)"})
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = response.read()
                content_type = response.headers.get("Content-Type")
            value = json.loads(payload)
            if isinstance(value, dict) and value.get("error"):
                raise ValueError(str(value))
            path.write_bytes(payload)
            entry = artifact(path, url=url, retrieved_at_utc=timestamp, content_type=content_type, **metadata)
            if isinstance(value, dict):
                entry["returned_location"] = {key: value.get(key) for key in ("latitude", "longitude", "elevation", "timezone", "utc_offset_seconds")}
                entry["units"] = {key: value[key] for key in ("daily_units", "hourly_units") if key in value}
            if previous:
                manifest["requests"][manifest["requests"].index(previous)] = entry
            else:
                manifest["requests"].append(entry)
            save_json(DATA / "manifest.json", manifest)
            print("下载", relative_name, len(payload), "bytes", flush=True)
            return value
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError) as error:
            code = getattr(error, "code", None)
            failure = {"url": url, "retrieved_at_utc": timestamp, "attempt": attempt + 1, "error": str(error), "http_status": code}
            manifest["errors"].append(failure)
            save_json(DATA / "manifest.json", manifest)
            # 限流及参数错误立即停止；临时服务错误最多重试一次。
            retry = attempt == 0 and (code is None or code >= 500)
            print("请求失败", failure, flush=True)
            if not retry:
                raise
            time.sleep(3)


def expected_times(start, end, hourly=False):
    first = datetime.fromisoformat(start)
    last = datetime.fromisoformat(end) + timedelta(days=1)
    step = timedelta(hours=1) if hourly else timedelta(days=1)
    result = []
    while first < last:
        result.append(first.strftime("%Y-%m-%dT%H:%M" if hourly else "%Y-%m-%d"))
        first += step
    return result


def validate_series(series, units, start, end, kind):
    hourly = kind == "hourly"
    times = series["time"]
    expected_units = ({
        "time": "iso8601", "temperature_2m": "°C", "relative_humidity_2m": "%",
        "pressure_msl": "hPa", "cloud_cover": "%", "shortwave_radiation": "W/m²",
        "wind_speed_10m": "m/s", "wind_direction_10m": "°",
        "soil_moisture_0_to_7cm": "m³/m³", "precipitation": "mm",
    } if hourly else {"time": "iso8601", "temperature_2m_max": "°C", "temperature_2m_min": "°C"})
    missing = {key: sum(value is None for value in values) for key, values in series.items() if key != "time"}
    non_finite = {key: sum(value is not None and (not isinstance(value, (float, int)) or not math.isfinite(value)) for value in values) for key, values in series.items() if key != "time"}
    checks = {
        "time_complete_contiguous_exact": times == expected_times(start, end, hourly),
        "time_unique": len(set(times)) == len(times),
        "array_lengths_equal": all(len(values) == len(times) for values in series.values()),
        "no_missing_values": not any(missing.values()),
        "all_numeric_values_finite": not any(non_finite.values()),
        "units_match_expected": units == expected_units,
    }
    def within(key, lower, upper=None):
        return all(value is None or (value >= lower and (upper is None or value <= upper)) for value in series[key])
    if hourly:
        checks.update({
            "relative_humidity_between_0_and_100": within("relative_humidity_2m", 0, 100),
            "cloud_cover_between_0_and_100": within("cloud_cover", 0, 100),
            "wind_speed_nonnegative": within("wind_speed_10m", 0),
            "wind_direction_between_0_and_360": within("wind_direction_10m", 0, 360),
            "shortwave_radiation_nonnegative": within("shortwave_radiation", 0),
            "soil_moisture_between_0_and_1": within("soil_moisture_0_to_7cm", 0, 1),
            "precipitation_nonnegative": within("precipitation", 0),
            "pressure_positive": all(v is None or v > 0 for v in series["pressure_msl"]),
        })
    else:
        checks["tmax_greater_equal_tmin"] = all(hi is None or lo is None or hi >= lo for hi, lo in zip(series["temperature_2m_max"], series["temperature_2m_min"]))
    return {
        "passed": all(checks.values()), "checks": checks, "rows": len(times),
        "missing_counts": missing, "non_finite_counts": non_finite, "units": units,
        "min_max": {key: {"min": min(v for v in values if v is not None), "max": max(v for v in values if v is not None)} for key, values in series.items() if key != "time"},
    }


def write_csv(path, series):
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(series.keys())
        writer.writerows(zip(*series.values()))
    manifest["derived_artifacts"].append(artifact(path, rows=len(series["time"])))


def check_timezone(value):
    if value.get("utc_offset_seconds") != 0 or value.get("timezone") not in ("GMT", "UTC"):
        raise ValueError("API 返回的时区不是 UTC")


def run():
    smoke_start, smoke_end = "2021-06-27", "2021-06-28"
    smoke = fetch(make_url(CITIES[0], smoke_start, smoke_end, "smoke"), "smoke_portland_2021-06-27_2021-06-28.json", {
        "source": "open_meteo_era5", "purpose": "单请求短窗口可用性与字段验证", "requested_location": {"latitude": CITIES[0][2], "longitude": CITIES[0][3]},
    })
    check_timezone(smoke)
    report["smoke"] = {kind: validate_series(smoke[kind], smoke[kind + "_units"], smoke_start, smoke_end, kind) for kind in ("daily", "hourly")}
    if not all(item["passed"] for item in report["smoke"].values()):
        raise ValueError("短窗口验证未全部通过，停止批量下载")
    save_json(DATA / "validation_report.json", report)
    for city in CITIES:
        city_id, name, latitude, longitude = city
        daily = {"time": [], "temperature_2m_max": [], "temperature_2m_min": []}
        units = None
        locations = []
        for year in (2006, 2011, 2016, 2021):
            start, end = f"{year}-01-01", f"{year + 4}-12-31"
            value = fetch(make_url(city, start, end, "daily"), f"{city_id}_daily_{start}_{end}.json", {
                "source": "open_meteo_era5", "kind": "daily", "city_id": city_id,
                "requested_location": {"latitude": latitude, "longitude": longitude},
            })
            check_timezone(value)
            this_units = value["daily_units"]
            if units is not None and units != this_units:
                raise ValueError("跨批次单位不一致")
            units = this_units
            locations.append([value["latitude"], value["longitude"]])
            for key in daily:
                daily[key].extend(value["daily"][key])
            time.sleep(0.25)
        validation = validate_series(daily, units, "2006-01-01", "2025-12-31", "daily")
        validation["returned_grid_location_stable"] = all(location == locations[0] for location in locations)
        validation["passed"] = validation["passed"] and validation["returned_grid_location_stable"]
        report["daily"][city_id] = validation
        write_csv(CSV_DIR / f"{city_id}_daily_2006_2025.csv", daily)
        yearly = []
        for year in range(2006, 2026):
            indices = [index for index, day in enumerate(daily["time"]) if day.startswith(str(year))]
            yearly.append({"year": year, "max_tmax": max(daily["temperature_2m_max"][i] for i in indices), "min_tmin": min(daily["temperature_2m_min"][i] for i in indices), "days": len(indices)})
        preview["daily"].append({
            "id": city_id, "name": name, "latitude": latitude, "longitude": longitude,
            "returned_grid_latitude": locations[0][0], "returned_grid_longitude": locations[0][1],
            "yearly": yearly, "time_basis": "UTC calendar day", "units": units,
            "max_tmax": max(daily["temperature_2m_max"]),
            "max_tmax_dates": [day for day, high in zip(daily["time"], daily["temperature_2m_max"]) if high == max(daily["temperature_2m_max"])],
        })
        save_json(DATA / "validation_report.json", report)
        print("完成日数据", name, validation["rows"], "行", "检查通过:", validation["passed"], flush=True)
        if not validation["passed"]:
            raise ValueError(f"{name} 日数据验证失败")
    for city in CITIES:
        city_id, name, latitude, longitude = city
        if city_id not in WINDOWS:
            continue
        start, end = WINDOWS[city_id]
        value = fetch(make_url(city, start, end, "hourly"), f"{city_id}_hourly_{start}_{end}.json", {
            "source": "open_meteo_era5", "kind": "hourly", "city_id": city_id,
            "requested_location": {"latitude": latitude, "longitude": longitude},
            "window_note": "研究示例窗口，不是经阈值检定的热浪边界",
        })
        check_timezone(value)
        report["hourly"][city_id] = validate_series(value["hourly"], value["hourly_units"], start, end, "hourly")
        write_csv(CSV_DIR / f"{city_id}_hourly_{start}_{end}.csv", value["hourly"])
        preview["hourly"].append({
            "id": city_id, "name": name, "latitude": latitude, "longitude": longitude,
            "returned_grid_latitude": value["latitude"], "returned_grid_longitude": value["longitude"],
            "time_basis": "UTC", "units": value["hourly_units"], **value["hourly"],
        })
        save_json(DATA / "validation_report.json", report)
        if not report["hourly"][city_id]["passed"]:
            raise ValueError(f"{name} 小时数据验证失败")
    noaa = fetch(NOAA_URL, "noaa_USW00024229_daily_2021-06-25_2021-06-30.json", {
        "source": "noaa_ncei_ghcn_daily", "station_id": "USW00024229", "station_name": "PORTLAND INTERNATIONAL AIRPORT, OR US",
        "time_basis": "站点观测日；不可直接与 ERA5 UTC 日配对", "units": {"TMAX": "°C", "TMIN": "°C"},
        "requested_location": None,
    })
    noaa_series = {"time": [row["DATE"] for row in noaa], "TMAX": [float(row["TMAX"]) for row in noaa], "TMIN": [float(row["TMIN"]) for row in noaa]}
    noaa_checks = {
        "time_complete_contiguous_exact": noaa_series["time"] == expected_times("2021-06-25", "2021-06-30"),
        "station_id_correct": all(row["STATION"] == "USW00024229" for row in noaa),
        "tmax_greater_equal_tmin": all(hi >= lo for hi, lo in zip(noaa_series["TMAX"], noaa_series["TMIN"])),
        "values_finite": all(math.isfinite(v) for key in ("TMAX", "TMIN") for v in noaa_series[key]),
    }
    report["official_station"] = {"checks": noaa_checks, "passed": all(noaa_checks.values()), "rows": len(noaa), "units": {"TMAX": "°C", "TMIN": "°C"}, "time_basis": "站点观测日；不是 UTC 日", "missing_counts": {"TMAX": 0, "TMIN": 0}}
    write_csv(CSV_DIR / "noaa_USW00024229_daily_2021-06-25_2021-06-30.csv", noaa_series)
    preview["official_station"] = {"source": "NOAA NCEI GHCN-Daily", "station_id": "USW00024229", "name": "波特兰国际机场", "time_basis": "站点观测日；不是 UTC 日", "units": {"TMAX": "°C", "TMIN": "°C"}, **noaa_series}
    report["passed"] = all(item["passed"] for item in report["smoke"].values()) and all(item["passed"] for item in report["daily"].values()) and all(item["passed"] for item in report["hourly"].values()) and report["official_station"]["passed"]
    save_json(DATA / "preview.json", preview)
    manifest["derived_artifacts"].append(artifact(DATA / "preview.json"))
    manifest["status"] = "complete" if report["passed"] else "validation_failed"
    manifest["completed_at_utc"] = utc_now()
    report["completed_at_utc"] = manifest["completed_at_utc"]
    report["total_daily_rows"] = sum(item["rows"] for item in report["daily"].values())
    report["total_hourly_rows"] = sum(item["rows"] for item in report["hourly"].values())
    save_json(DATA / "validation_report.json", report)
    manifest["derived_artifacts"].append(artifact(DATA / "validation_report.json"))
    save_json(DATA / "manifest.json", manifest)


if __name__ == "__main__":
    RAW.mkdir(parents=True, exist_ok=True)
    CSV_DIR.mkdir(parents=True, exist_ok=True)
    manifest_path = DATA / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {
        "schema_version": 1,
        "created_at_utc": utc_now(),
        "scope": "6 个坐标 2006—2025 年逐日日最高/最低气温；3 个短窗口逐小时；1 个官方站点 6 日样本。不是全球全量，不是完整热浪事件库。",
        "sources": {
            "open_meteo_era5": {
                "original_dataset": "ERA5: ECMWF reanalysis, Copernicus Climate Change Service",
                "original_dataset_url": "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview",
                "provider": "Open-Meteo，第三方数据代理及 API；不是 ECMWF 官方下载端点",
                "documentation_url": "https://open-meteo.com/en/docs/historical-weather-api",
                "terms_url": "https://open-meteo.com/en/terms",
                "attribution_url": "https://open-meteo.com/en/licence",
                "api_data_licence_url": "https://creativecommons.org/licenses/by/4.0/",
                "model": "ERA5", "model_request": "models=era5", "elevation_downscaling": "disabled: elevation=nan",
                "grid_cell_selection": "nearest", "time_basis": "UTC；日极值按 UTC 日聚合，不是城市当地日",
                "interpretation": "网格再分析值，不是城市官方气象站纪录；2 米气温不等于热量或地表温度。",
            },
            "noaa_ncei_ghcn_daily": {
                "original_dataset": "NOAA NCEI Global Historical Climatology Network Daily (GHCN-Daily)",
                "provider": "NOAA NCEI 官方直接下载服务",
                "documentation_url": "https://www.ncei.noaa.gov/support/access-data-service-api-user-documentation",
                "original_dataset_url": "https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-daily",
                "licence_attribution_url": "https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=gov.noaa.ncdc:C00861",
                "station_id": "USW00024229", "time_basis": "站点观测日；不直接与 ERA5 UTC 日配对",
            },
        },
        "requests": [], "errors": [],
    }
    manifest["status"] = "running"
    manifest["derived_artifacts"] = []
    report = {"status": "running", "started_at_utc": utc_now(), "daily": {}, "hourly": {}, "note": "完整性及物理范围检查只能发现基础数据问题，不能验证气象成因或证明极值是站点纪录。"}
    preview = {"daily": [], "hourly": [], "metadata": {"source": "ERA5 via Open-Meteo", "timezone": "UTC", "scope": "六坐标样本，不是全球全量", "daily_years": [2006, 2025], "window_note": "逐小时示例窗口不是已检定热浪边界"}}
    try:
        run()
        report["status"] = manifest["status"]
        save_json(DATA / "validation_report.json", report)
        # 最终报告状态变化后更新 manifest 中对应的哈希。
        manifest["derived_artifacts"] = [artifact(DATA / "validation_report.json") if item["path"] == "data/validation_report.json" else item for item in manifest["derived_artifacts"]]
        save_json(manifest_path, manifest)
        print(json.dumps({"status": manifest["status"], "daily_rows": report["total_daily_rows"], "hourly_rows": report["total_hourly_rows"], "official_station_rows": report["official_station"]["rows"]}, ensure_ascii=False), flush=True)
    except Exception as error:
        manifest["status"] = "stopped_on_error"
        manifest["stopped_at_utc"] = utc_now()
        manifest["stop_reason"] = str(error)
        report["status"] = "stopped_on_error"
        report["stop_reason"] = str(error)
        save_json(manifest_path, manifest)
        save_json(DATA / "validation_report.json", report)
        print("下载停止：", error, file=sys.stderr)
        sys.exit(1)
