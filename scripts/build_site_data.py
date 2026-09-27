#!/usr/bin/env python3
"""从经过来源校验的原始响应构建公众网站数据；仅使用标准库。"""
import csv
import hashlib
import json
import math
import statistics
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/data"
STUDY_START, STUDY_END = "2006-01-01", "2025-12-31"
CITIES = [
    ("portland", "波特兰", "Portland", "美国", "America/Los_Angeles"),
    ("paris", "巴黎", "Paris", "法国", "Europe/Paris"),
    ("chongqing", "重庆", "Chongqing", "中国", "Asia/Shanghai"),
    ("new_delhi", "新德里", "New Delhi", "印度", "Asia/Kolkata"),
    ("sao_paulo", "圣保罗", "São Paulo", "巴西", "America/Sao_Paulo"),
    ("sydney", "悉尼", "Sydney", "澳大利亚", "Australia/Sydney"),
]
CASE_IDS = {"portland": "portland2021", "paris": "paris2019", "chongqing": "chongqing2022"}
SOURCE = {
    "id": "open_meteo_era5", "label": "ERA5 再分析 · 通过 Open-Meteo 获取",
    "provider": "Open-Meteo（第三方 API）", "originalDataset": "ECMWF / Copernicus ERA5",
    "datasetUrl": "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview",
    "documentationUrl": "https://open-meteo.com/en/docs/historical-weather-api",
    "attributionUrl": "https://open-meteo.com/en/licence",
    "licence": "CC BY 4.0（Open-Meteo API 数据）；保留原始 ERA5 数据来源",
    "licenceUrl": "https://creativecommons.org/licenses/by/4.0/",
    "model": "era5", "elevationDownscaling": False, "cellSelection": "nearest",
    "timeBasis": "UTC；逐日极值按 UTC 日聚合",
}
SCOPE = "六个坐标附近网格的 2006—2025 年温度记录；三个逐小时案例窗口。不是全球覆盖或全球趋势，也不是官方站点纪录。"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save_json(name, value):
    path = OUT / name
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
    return path


def save_csv(name, rows, fields=None):
    path = OUT / name
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields or list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    return path


def dates_between(start, end):
    start, end = date.fromisoformat(start), date.fromisoformat(end)
    return [(start + timedelta(days=i)).isoformat() for i in range((end-start).days+1)]


def read_inputs():
    original = json.loads((ROOT / "data/manifest.json").read_text())
    records = original["requests"][:]
    reference = ROOT / "data/site_reference/manifest.json"
    if reference.exists():
        records.extend(json.loads(reference.read_text())["requests"])
    selected = []
    for record in records:
        if record.get("kind") not in ("daily", "hourly") or record.get("source") != "open_meteo_era5":
            continue
        path = ROOT / record["path"]
        assert path.exists(), f"缺少原始输入 {path}"
        assert sha(path) == record["sha256"], f"原始输入哈希变化 {path}"
        value = json.loads(path.read_text())
        assert value["utc_offset_seconds"] == 0
        expected_units = {"time": "iso8601", "temperature_2m_max": "°C", "temperature_2m_min": "°C"}
        if record["kind"] == "daily":
            assert value["daily_units"] == expected_units
        series = value[record["kind"]]
        assert len(set(series["time"])) == len(series["time"])
        assert all(len(array) == len(series["time"]) for array in series.values())
        assert all(isinstance(v, (int, float)) and math.isfinite(v) for key, values in series.items() if key != "time" for v in values)
        selected.append((record, value))
    return selected


def quantile(values, fraction):
    # 线性插值分位数（常用 Type 7）；保留定义供复算。
    values = sorted(values)
    position = (len(values)-1)*fraction
    left = math.floor(position)
    return values[left] + (values[math.ceil(position)]-values[left])*(position-left)


def climatology(daily):
    reference = {t: v for t, v in daily.items() if "1991-01-01" <= t <= "2020-12-31"}
    if sorted(reference) != dates_between("1991-01-01", "2020-12-31"):
        return None
    # 使用无闰年的 365 日历索引，2 月 29 日不进入抽样池。
    calendar = [(date(2001, 1, 1)+timedelta(days=i)).strftime("%m-%d") for i in range(365)]
    grouped = defaultdict(list)
    for stamp, values in reference.items():
        if stamp[5:] != "02-29":
            grouped[stamp[5:]].append(values)
    result = {}
    for index, month_day in enumerate(calendar):
        pool = [row for offset in range(-15, 16) for row in grouped[calendar[(index+offset) % 365]]]
        assert len(pool) == 930
        result[month_day] = {"meanTmax": statistics.mean(row[0] for row in pool), "meanTmin": statistics.mean(row[1] for row in pool), "p90Tmax": quantile([row[0] for row in pool], .9), "sampleDays": len(pool)}
    result["02-29"] = {key: (result["02-28"][key]+result["03-01"][key])/2 for key in ("meanTmax", "meanTmin", "p90Tmax")}
    result["02-29"]["sampleDays"] = None
    return result


def detect_events(rows, warm_months):
    # 自定义点位过程；阈值比较保持原精度，未把案例展示窗口当作事件边界。
    runs, current = [], []
    for row in rows:
        eligible = int(row["time"][5:7]) in warm_months
        if eligible and row["tmax"] > row["p90Tmax"]:
            current.append(row)
        else:
            if len(current) >= 3:
                runs.append(current)
            current = []
    if len(current) >= 3:
        runs.append(current)
    events = []
    for run in runs:
        peak = max(run, key=lambda row: row["tmax"])
        events.append({
            "start": run[0]["time"], "end": run[-1]["time"], "days": len(run),
            "peakTmax": peak["tmax"], "peakDate": peak["time"],
            "meanTmaxAnomaly": round(statistics.mean(row["tmaxAnomaly"] for row in run), 3),
            "touchesStudyBoundary": run[0]["time"] == STUDY_START or run[-1]["time"] == STUDY_END,
            "definition": "custom_point_p90_3day_warm_season",
        })
        for row in run:
            row["isHotSpellDay"] = True
    assert all(event["days"] >= 3 for event in events)
    assert sum(event["days"] for event in events) == sum(row["isHotSpellDay"] for row in rows)
    return events


def validate_exports(inputs, cities, cases):
    # 独立重新读取公开文件，与原始响应逐值比对，避免只检查内存中间对象。
    for city in cities:
        city_id = city["id"]
        original = {}
        for record, value in inputs:
            if record["city_id"] == city_id and record["kind"] == "daily":
                data = value["daily"]
                original.update({stamp: (hi, lo) for stamp, hi, lo in zip(data["time"], data["temperature_2m_max"], data["temperature_2m_min"])})
        rows = json.loads((OUT / f"daily-{city_id}.json").read_text())["rows"]
        csv_rows = list(csv.DictReader((OUT / f"daily-{city_id}.csv").open()))
        assert len(rows) == len(csv_rows) == 7305
        for row, csv_row in zip(rows, csv_rows):
            assert (row["tmax"], row["tmin"]) == original[row["time"]]
            assert csv_row["time"] == row["time"]
            assert (float(csv_row["tmax"]), float(csv_row["tmin"])) == original[row["time"]]
        if city["baseline"]["status"] == "available":
            reference = json.loads((OUT / f"climatology-{city_id}.json").read_text())["rows"]
            for target in ("01-15", "07-15", "12-31"):
                index = date.fromisoformat("2001-"+target).timetuple().tm_yday
                pool = []
                for stamp, values in original.items():
                    if not "1991-01-01" <= stamp <= "2020-12-31" or stamp[5:] == "02-29":
                        continue
                    distance = abs(date.fromisoformat("2001-"+stamp[5:]).timetuple().tm_yday-index)
                    if min(distance, 365-distance) <= 15:
                        pool.append(values[0])
                expected = statistics.quantiles(pool, n=10, method="inclusive")[-1]
                actual = next(row["p90Tmax"] for row in reference if row["monthDay"] == target)
                assert len(pool) == 930 and abs(expected-actual) < 1e-10
    for case in cases:
        raw = next(value["hourly"] for record, value in inputs if record["kind"] == "hourly" and record["city_id"] == case["cityId"])
        rows = json.loads((OUT / f"case-{case['id']}.json").read_text())["rows"]
        assert len(rows) == len(raw["time"])
        for index, row in enumerate(rows):
            assert row["time"] == raw["time"][index]+":00Z"
            assert all(row[key] == values[index] for key, values in raw.items() if key != "time")
    # 特别验证严格阈值、两日不构成过程、非暖季不计入三个容易误用的边界。
    fixture = [{"time": f"2020-05-{i+1:02d}", "tmax": value, "p90Tmax": 30, "tmaxAnomaly": value-25, "isHotSpellDay": False} for i, value in enumerate([30, 31, 32, 33, 30, 31, 32, 29])]
    detected = detect_events(fixture, [5])
    assert len(detected) == 1 and detected[0]["days"] == 3 and detected[0]["start"] == "2020-05-02"
    assert detect_events([dict(row, isHotSpellDay=False) for row in fixture], [6]) == []


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    generated = datetime.now(timezone.utc).isoformat(timespec="seconds")
    inputs = read_inputs()
    cities, case_list, source_rows, download_rows, annual_csv, validation = [], [], [], [], [], []
    for record, value in inputs:
        source_rows.append({"city_id": record["city_id"], "kind": record["kind"], "raw_file": record["path"], "retrieved_at_utc": record["retrieved_at_utc"], "sha256": record["sha256"], "request_url": record["url"], "requested_latitude": record["requested_location"]["latitude"], "requested_longitude": record["requested_location"]["longitude"], "grid_latitude": value["latitude"], "grid_longitude": value["longitude"], "grid_elevation_m": value["elevation"], "time_basis": "UTC"})
    for city_id, name, name_en, country, timezone_name in CITIES:
        city_inputs = [(record, value) for record, value in inputs if record["city_id"] == city_id]
        daily = {}
        locations = set()
        for record, value in city_inputs:
            locations.add((value["latitude"], value["longitude"], value["elevation"]))
            if record["kind"] != "daily":
                continue
            series = value["daily"]
            assert series["time"] == dates_between(series["time"][0], series["time"][-1])
            for stamp, tmax, tmin in zip(series["time"], series["temperature_2m_max"], series["temperature_2m_min"]):
                assert stamp not in daily, f"重复日期 {city_id} {stamp}"
                assert tmax >= tmin
                daily[stamp] = (tmax, tmin)
        assert len(locations) == 1, f"网格位置不一致 {city_id} {locations}"
        stamps = [stamp for stamp in sorted(daily) if STUDY_START <= stamp <= STUDY_END]
        assert stamps == dates_between(STUDY_START, STUDY_END)
        location = city_inputs[0][0]["requested_location"]
        latitude, longitude, elevation = next(iter(locations))
        grid = {"latitude": latitude, "longitude": longitude, "elevation": elevation}
        baseline = climatology(daily)
        warm_months = [5, 6, 7, 8, 9] if latitude >= 0 else [11, 12, 1, 2, 3]
        rows = []
        for stamp in stamps:
            tmax, tmin = daily[stamp]
            ref = baseline[stamp[5:]] if baseline else None
            rows.append({"time": stamp, "tmax": tmax, "tmin": tmin, "baselineTmax": ref["meanTmax"] if ref else None, "baselineTmin": ref["meanTmin"] if ref else None, "p90Tmax": ref["p90Tmax"] if ref else None, "tmaxAnomaly": tmax-ref["meanTmax"] if ref else None, "isHotSpellDay": False if ref else None})
        events = detect_events(rows, warm_months) if baseline else []
        annual = []
        for year in range(2006, 2026):
            group = [row for row in rows if row["time"].startswith(str(year))]
            peak = max(group, key=lambda row: row["tmax"])
            summary = {"year": year, "days": len(group), "maxTmax": peak["tmax"], "maxTmaxDate": peak["time"], "minTmin": min(row["tmin"] for row in group), "meanTmax": round(statistics.mean(row["tmax"] for row in group), 3), "meanTmin": round(statistics.mean(row["tmin"] for row in group), 3), "meanTmaxAnomaly": round(statistics.mean(row["tmaxAnomaly"] for row in group), 3) if baseline else None, "hotSpellDays": sum(row["isHotSpellDay"] for row in group) if baseline else None, "hotSpellCount": sum(event["start"].startswith(str(year)) for event in events) if baseline else None}
            annual.append(summary)
            annual_csv.append({"city_id": city_id, **summary})
        for row in rows:
            for key in ("baselineTmax", "baselineTmin", "p90Tmax", "tmaxAnomaly"):
                if row[key] is not None:
                    row[key] = round(row[key], 6)
        baseline_meta = {"status": "available" if baseline else "unavailable", "period": "1991–2020", "dailyWindow": "日历日 ±15 日（31 日）；跨年循环", "sampleDaysPerCalendarDay": 930 if baseline else None, "quantile": "Type 7 线性插值 P90；严格大于阈值", "leapDay": "基准池不包含 2 月 29 日；当天阈值与均值取 2 月 28 日和 3 月 1 日平均", "warmSeasonMonths": warm_months, "eventDefinition": "暖季日最高气温连续至少 3 个 UTC 日大于日历日 P90；未合并间隔日", "caveat": "公众探索的自定义点位指标，不是 WMO 统一定义、官方预警或正式区域论文事件。参考期与部分研究年份重叠，未做标准指数的样本内百分位自举校正。"}
        city = {"id": city_id, "name": name, "nameEn": name_en, "country": country, "timezone": timezone_name, "requestedLocation": location, "gridLocation": grid, "timeBasis": "UTC", "period": {"start": STUDY_START, "end": STUDY_END}, "annual": annual, "baseline": baseline_meta, "events": events, "dailyUrl": f"/data/daily-{city_id}.json", "csvUrl": f"/data/daily-{city_id}.csv", "baselineCsvUrl": f"/data/baseline-{city_id}-1991-2020.csv" if baseline else None, "source": SOURCE, "retrievedAt": sorted(set(record["retrieved_at_utc"] for record, _ in city_inputs))}
        cities.append(city)
        save_json(f"daily-{city_id}.json", {"schemaVersion": 1, "cityId": city_id, "requestedLocation": location, "gridLocation": grid, "timeBasis": "UTC", "units": {"tmax": "°C", "tmin": "°C", "baselineTmax": "°C", "baselineTmin": "°C", "p90Tmax": "°C", "tmaxAnomaly": "°C"}, "baseline": baseline_meta, "rows": rows})
        save_csv(f"daily-{city_id}.csv", rows)
        if baseline:
            save_json(f"climatology-{city_id}.json", {"cityId": city_id, "baseline": baseline_meta, "gridLocation": grid, "units": "°C", "rows": [{"monthDay": day, **values} for day, values in sorted(baseline.items())]})
            save_csv(f"baseline-{city_id}-1991-2020.csv", [{"time": stamp, "tmax": daily[stamp][0], "tmin": daily[stamp][1]} for stamp in sorted(daily) if "1991-01-01" <= stamp <= "2020-12-31"])
        validation.append({"cityId": city_id, "studyDays": len(rows), "referenceDays": sum("1991-01-01" <= stamp <= "2020-12-31" for stamp in daily), "baselineComplete": baseline is not None, "events": len(events), "sourceHashesVerified": True, "uniqueDates": True, "contiguousDates": True})
        for record, value in city_inputs:
            if record["kind"] != "hourly":
                continue
            series = value["hourly"]
            hourly = [dict(zip(series, values)) for values in zip(*series.values())]
            for row in hourly:
                row["time"] += ":00Z"
            times = [datetime.fromisoformat(row["time"].replace("Z", "+00:00")) for row in hourly]
            assert all(b-a == timedelta(hours=1) for a, b in zip(times, times[1:]))
            peak = max(hourly, key=lambda row: row["temperature_2m"])
            case_id = CASE_IDS[city_id]
            case = {"id": case_id, "cityId": city_id, "title": f"{name} · {series['time'][0][:4]}", "start": series["time"][0][:10], "end": series["time"][-1][:10], "hours": len(hourly), "peakTemperature": peak["temperature_2m"], "peakTime": peak["time"], "timeBasis": "UTC", "timezone": timezone_name, "dataUrl": f"/data/case-{case_id}.json", "csvUrl": f"/data/case-{case_id}.csv", "requestedLocation": location, "gridLocation": grid, "source": SOURCE, "retrievedAt": record["retrieved_at_utc"], "rawSha256": record["sha256"], "requestUrl": record["url"], "windowType": "curated_replay_window", "caveat": "人工选择的案例观察窗口，不是阈值算法识别的热浪边界。各变量共同变化不能用于计算因果贡献。"}
            case_list.append(case)
            save_json(f"case-{case_id}.json", {"schemaVersion": 1, **case, "units": value["hourly_units"], "rows": hourly})
            save_csv(f"case-{case_id}.csv", hourly)
    save_json("atlas.json", {"schemaVersion": 1, "generatedAt": generated, "scope": SCOPE, "source": SOURCE, "cities": cities})
    save_json("cases.json", {"schemaVersion": 1, "scope": SCOPE, "cases": case_list})
    save_csv("sources.csv", source_rows)
    save_csv("annual-summary.csv", annual_csv)
    save_json("sources.json", {"schemaVersion": 1, "sources": source_rows, "source": SOURCE})
    # 另存官方站点样本，保持观测日口径，不与 UTC 日气温配对计算误差。
    noaa_path = ROOT / "data/raw/noaa_USW00024229_daily_2021-06-25_2021-06-30.json"
    noaa_manifest = json.loads((ROOT / "data/manifest.json").read_text())
    noaa_record = next(record for record in noaa_manifest["requests"] if record["path"] == str(noaa_path.relative_to(ROOT)))
    assert sha(noaa_path) == noaa_record["sha256"]
    noaa = json.loads(noaa_path.read_text())
    save_csv("noaa-portland-airport-2021.csv", noaa)
    save_json("noaa-portland-airport-2021.json", {"stationId": "USW00024229", "timeBasis": "站点观测日；不是 UTC 日", "temperatureUnit": "°C", "sourceUrl": noaa_record["url"], "retrievedAt": noaa_record["retrieved_at_utc"], "sha256": noaa_record["sha256"], "caveat": "此样本不含完整质量标记与观测时刻，不与 ERA5 UTC 日直接计算误差或认证城市纪录。", "rows": noaa})
    validate_exports(inputs, cities, case_list)
    validation_report = {"generatedAt": generated, "passed": True, "checks": validation, "totalStudyDays": sum(item["studyDays"] for item in validation), "totalHourlyRows": sum(case["hours"] for case in case_list), "inputFilesHashVerified": len(inputs)+1, "allStudyDailyValuesMatchRawInputs": True, "caseRowsMatchRawInputs": True, "exportFilesRereadAndVerified": True, "calendarQuantileIndependentlyChecked": True, "strictThresholdAndMinimumDurationTests": True, "eventRule": "strict Tmax > calendar P90, warm months, contiguous >=3 days", "note": "这些检查验证数据转换与连续性；不等于独立气象验证或机制归因。"}
    assert validation_report["totalStudyDays"] == 43830
    assert validation_report["totalHourlyRows"] == 1152
    save_json("validation.json", validation_report)
    for path in sorted(OUT.glob("*")):
        if path.name in ("download-manifest.json", "download-manifest.csv") or not path.is_file():
            continue
        download_rows.append({"file": path.name, "url": "/data/"+path.name, "bytes": path.stat().st_size, "sha256": sha(path)})
    save_json("download-manifest.json", {"schemaVersion": 1, "generatedAt": generated, "files": download_rows})
    save_csv("download-manifest.csv", download_rows)
    print(json.dumps(validation_report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
