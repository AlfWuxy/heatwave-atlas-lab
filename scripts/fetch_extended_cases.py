#!/usr/bin/env python3
"""串行获取十个事件的 ERA5 逐小时资料；缺测与限流立即停止，不制造完整状态。"""
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
DATA = ROOT / 'data/extended-cases'
BASE = 'https://archive-api.open-meteo.com/v1/archive'
VARIABLES = {
    'temperature_2m': ('°C', -90, 65),
    'relative_humidity_2m': ('%', 0, 100),
    'pressure_msl': ('hPa', 850, 1100),
    'cloud_cover': ('%', 0, 100),
    'shortwave_radiation': ('W/m²', 0, 1600),
    'wind_speed_10m': ('m/s', 0, 150),
    'wind_direction_10m': ('°', 0, 360),
    'soil_moisture_0_to_7cm': ('m³/m³', 0, 1),
    'soil_moisture_7_to_28cm': ('m³/m³', 0, 1),
    'precipitation': ('mm', 0, 500),
}
REGIONAL = ['temperature_2m', 'wind_speed_10m', 'wind_direction_10m']


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def sha(payload):
    return hashlib.sha256(payload).hexdigest()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    temp.replace(path)


def times_for(start, end):
    first = datetime.fromisoformat(start)
    hours = int(((datetime.fromisoformat(end) + timedelta(days=1)) - first).total_seconds() / 3600)
    return [(first + timedelta(hours=i)).strftime('%Y-%m-%dT%H:%M') for i in range(hours)]


def grid_for(case):
    location = {'longitude': case['longitude'], 'latitude': case['latitude']}
    lon = round(location['longitude'] * 4) / 4
    lat = round(location['latitude'] * 4) / 4
    lons = [lon + (i-2)/4 for i in range(5)]
    lats = [lat + (i-2)/4 for i in range(5)]
    return lons, lats


def url_for(points, start, end, variables):
    params = dict(latitude=','.join(str(lat) for lon, lat in points), longitude=','.join(str(lon) for lon, lat in points),
                  start_date=start, end_date=end, hourly=','.join(variables), models='era5',
                  elevation=','.join('nan' for _ in points), cell_selection='nearest', timezone='UTC', wind_speed_unit='ms')
    return BASE + '?' + urllib.parse.urlencode(params)


def validate(payload, points, start, end, variables):
    rows = json.loads(payload)
    if isinstance(rows, dict):
        if rows.get('error'):
            raise ValueError(str(rows))
        rows = [rows]
    if len(rows) != len(points):
        raise ValueError('返回格点数量错误')
    wanted_times = times_for(start, end)
    expected_units = {'time': 'iso8601', **{v: VARIABLES[v][0] for v in variables}}
    checks = []
    for row, (lon, lat) in zip(rows, points):
        if (row.get('longitude'), row.get('latitude')) != (lon, lat):
            raise ValueError(f'原格点不匹配：请求{lon, lat}；返回{row.get("longitude"), row.get("latitude")}')
        if row.get('utc_offset_seconds') != 0 or row.get('timezone') not in ('GMT', 'UTC'):
            raise ValueError('不是 UTC 时间')
        if row.get('hourly_units') != expected_units or row['hourly']['time'] != wanted_times:
            raise ValueError('单位或完整时间轴错误')
        ranges = {}
        for variable in variables:
            unit, low, high = VARIABLES[variable]
            values = row['hourly'][variable]
            if len(values) != len(wanted_times):
                raise ValueError(f'{variable}长度错误')
            missing = sum(v is None for v in values)
            # −0.005 仅为此次小负值的工程审核边界，不是物理有效下界。
            review_low = -0.005 if variable.startswith('soil_moisture_') else low
            if any(isinstance(v, bool) or not isinstance(v, (float, int)) or not math.isfinite(v) or not review_low <= v <= high for v in values):
                raise ValueError(f'{variable}有{missing}缺测，或有非有限值/超宽松物理范围；不填补')
            flags = [dict(index=i, time=wanted_times[i]+':00Z', value=v) for i, v in enumerate(values) if not low <= v <= high]
            ranges[variable] = dict(unit=unit, minimum=min(values), maximum=max(values), missing=missing,
                                   physicalRange=[low, high], outsidePhysicalRange=flags,
                                   qualityStatus='flagged' if flags else 'clean', engineeringReviewLowerBound=review_low)
        checks.append(dict(longitude=lon, latitude=lat, hours=len(wanted_times), variables=ranges))
    if len({(r['longitude'], r['latitude']) for r in rows}) != len(points):
        raise ValueError('重复格点')
    return rows, checks


class Downloader:
    def __init__(self, interval=10):
        self.interval = max(8, interval)
        self.last = None

    def fetch(self, case, name, points, start, end, variables, manifest):
        folder = DATA / case['id']
        manifest_path = folder / 'manifest.json'
        path = folder / 'raw' / (name + '.json')
        relative = str(path.relative_to(ROOT))
        url = url_for(points, start, end, variables)
        prior = next((r for r in manifest['requests'] if r['path'] == relative), None)
        if prior:
            if prior['url'] != url or not path.exists() or sha(path.read_bytes()) != prior['sha256']:
                raise ValueError('缓存 URL/原始字节不符，停止')
            rows, checks = validate(path.read_bytes(), points, start, end, variables)
            prior['returnedGrid'] = [{k: r[k] for k in ('longitude', 'latitude', 'elevation')} for r in rows]
            prior['validation'] = dict(passed=True, points=len(rows), hoursPerPoint=len(times_for(start, end)),
                                       exactCoordinates=True, uniqueCoordinates=True, utcContiguous=True, ranges=checks)
            save(manifest_path, manifest)
            print('CACHE', case['id'], name, flush=True)
            return rows
        if path.exists():
            raise ValueError('未登记原始资料，不覆盖')
        if self.last is not None:
            time.sleep(max(0, self.interval - (time.monotonic() - self.last)))
        stamp = now()
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'HeatAtlas/1.0 educational non-commercial research'})
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = response.read()
                content_type, status = response.headers.get('Content-Type'), response.status
            self.last = time.monotonic()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(payload)
            entry = dict(path=relative, url=url, retrievedAt=stamp, sha256=sha(payload), bytes=len(payload),
                         httpStatus=status, contentType=content_type, purpose=name, variables=variables,
                         start=start, end=end, requestedGrid=[dict(longitude=lon, latitude=lat) for lon, lat in points],
                         validation={'passed': False})
            manifest['requests'].append(entry)
            save(manifest_path, manifest)
            rows, checks = validate(payload, points, start, end, variables)
            entry['returnedGrid'] = [{k: r[k] for k in ('longitude', 'latitude', 'elevation')} for r in rows]
            entry['validation'] = dict(passed=True, points=len(rows), hoursPerPoint=len(times_for(start, end)),
                                       exactCoordinates=True, uniqueCoordinates=True, utcContiguous=True, ranges=checks)
            save(manifest_path, manifest)
            print('FETCH', case['id'], name, len(payload), 'bytes', flush=True)
            return rows
        except Exception as error:
            self.last = time.monotonic()
            manifest['status'] = 'incomplete'
            manifest['errors'].append(dict(at=stamp, url=url, httpStatus=getattr(error, 'code', None), message=str(error)))
            save(manifest_path, manifest)
            # 包括 HTTP 429 在内的所有失败均停止，由人核实后决定是否续取。
            raise


def run(case, downloader):
    folder = DATA / case['id']
    path = folder / 'manifest.json'
    manifest = json.loads(path.read_text()) if path.exists() else dict(
        schemaVersion=1, caseId=case['id'], createdAt=now(), status='incomplete',
        catalogSha256=sha((DATA/'catalog.json').read_bytes()), requests=[], errors=[],
        requestPolicy=dict(serial=True, minimumSecondsAfterResponse=downloader.interval,
                           stopImmediatelyOn429=True, retryCount=0, cacheRequiresExactUrlAndSha256=True))
    lons, lats = grid_for(case)
    points = [(lon, lat) for lat in lats for lon in lons]
    center = [points[12]]
    # 每地先取两格点的一日小样；坐标验证通过才扩大窗口。
    downloader.fetch(case, 'smoke', points[:2], case['start'], case['start'], REGIONAL, manifest)
    downloader.fetch(case, 'point', center, case['start'], case['end'], list(VARIABLES), manifest)
    downloader.fetch(case, 'regional', points, case['start'], case['end'], REGIONAL, manifest)
    manifest['status'] = 'downloaded'
    save(path, manifest)
    from build_extended_cases import build_case, build_index
    build_case(case)
    build_index()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--case', default='all')
    parser.add_argument('--interval', type=float, default=10)
    args = parser.parse_args()
    catalog = json.loads((DATA/'catalog.json').read_text())['cases']
    chosen = catalog if args.case == 'all' else [c for c in catalog if c['id'] == args.case]
    if not chosen:
        raise ValueError('未知案例')
    downloader = Downloader(args.interval)
    for case in chosen:
        run(case, downloader)

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('STOP:', error, file=sys.stderr, flush=True)
        sys.exit(1)
