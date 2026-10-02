#!/usr/bin/env python3
"""获取欧洲2019有限点位真实资料，先小样、后完整窗口，保留字节与请求。"""
import hashlib
import json
import math
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / 'data/mechanisms/europe2019'
BASE_URL = 'https://archive-api.open-meteo.com/v1/archive'
START, END = '2019-06-01', '2019-07-31'
SITES = [
    dict(id='paris', name='巴黎', latitude=48.86, longitude=2.35, timezone='Europe/Paris'),
    dict(id='toulouse', name='图卢兹', latitude=43.6, longitude=1.45, timezone='Europe/Paris'),
    dict(id='brussels', name='布鲁塞尔', latitude=50.85, longitude=4.35, timezone='Europe/Brussels'),
    dict(id='frankfurt', name='法兰克福', latitude=50.11, longitude=8.68, timezone='Europe/Berlin'),
]
# 字段名、前端字段、单位、宽松物理范围；范围通过不等于来源精度被证明。
VARIABLES = [
    ('temperature_2m', 'temperatureC', '°C', -80, 60),
    ('soil_moisture_0_to_7cm', 'soilMoisture', 'm³/m³', 0, 1),
    ('soil_moisture_7_to_28cm', 'soilMoistureDeep', 'm³/m³', 0, 1),
    ('precipitation', 'precipitationMm', 'mm', 0, 500),
    ('shortwave_radiation', 'shortwaveWm2', 'W/m²', 0, 1600),
    ('wind_speed_10m', 'windSpeedMs', 'm/s', 0, 150),
    ('wind_direction_10m', 'windDirectionDeg', '°', 0, 360),
    ('cloud_cover', 'cloudCoverPct', '%', 0, 100),
]

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf8')

def expected_times(start, end):
    first, last = datetime.fromisoformat(start), datetime.fromisoformat(end) + timedelta(days=1)
    return [(first + timedelta(hours=i)).strftime('%Y-%m-%dT%H:%M') for i in range(int((last-first).total_seconds()/3600))]

def validate(value, start, end):
    hourly = value['hourly']
    if value.get('utc_offset_seconds') != 0 or value.get('timezone') not in ['GMT', 'UTC']:
        raise ValueError('响应时区不是 UTC')
    if hourly['time'] != expected_times(start, end):
        raise ValueError('时间轴缺失、重复或不连续')
    result = {'hours': len(hourly['time']), 'variables': {}}
    for api, _, unit, low, high in VARIABLES:
        values = hourly[api]
        if value['hourly_units'][api] != unit or len(values) != result['hours']:
            raise ValueError(f'{api}: 单位或长度异常')
        if any(isinstance(v, bool) or not isinstance(v, (float, int)) or not math.isfinite(v) or not low <= v <= high for v in values):
            raise ValueError(f'{api}: 缺测、非有限值或超出宽松范围；不填补')
        result['variables'][api] = {'missing': 0, 'minimum': min(values), 'maximum': max(values), 'unit': unit}
    return result

def url_for(site, start, end):
    parameters = dict(latitude=site['latitude'], longitude=site['longitude'], start_date=start, end_date=end,
                      models='era5', elevation='nan', cell_selection='nearest', timezone='UTC', wind_speed_unit='ms',
                      hourly=','.join(v[0] for v in VARIABLES))
    return BASE_URL + '?' + urllib.parse.urlencode(parameters)

def fetch(site, start, end, purpose, manifest):
    relative = f"raw/{site['id']}_{start}_{end}.json"
    path = DIRECTORY / relative
    url = url_for(site, start, end)
    prior = next((x for x in manifest['requests'] if x['path'] == relative), None)
    if prior:
        if prior['url'] != url or not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != prior['sha256']:
            raise ValueError('登记请求与缓存不一致；停止而不覆盖原始资料')
        value = json.loads(path.read_bytes())
        validate(value, start, end)
        print('复用', relative, flush=True)
        return value
    if path.exists():
        raise ValueError('未登记来源的同名文件已存在')
    timestamp = datetime.now(timezone.utc).isoformat(timespec='seconds')
    req = urllib.request.Request(url, headers={'User-Agent': 'HeatAtlas/1.0 educational non-commercial research'})
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            payload = response.read()
            content_type = response.headers.get('Content-Type')
        value = json.loads(payload)
        if value.get('error'):
            raise ValueError(value.get('reason', 'API error'))
        checks = validate(value, start, end)
    except Exception as error:
        manifest['errors'].append(dict(url=url, retrievedAtUtc=timestamp, message=str(error)))
        write_json(DIRECTORY/'manifest.json', manifest)
        raise
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    manifest['requests'].append(dict(path=relative, url=url, retrievedAtUtc=timestamp, sha256=hashlib.sha256(payload).hexdigest(),
                                     bytes=len(payload), contentType=content_type, siteId=site['id'], purpose=purpose,
                                     requestedLocation={k: site[k] for k in ['latitude','longitude']},
                                     returnedLocation={k: value[k] for k in ['latitude','longitude','elevation']}, validation=checks))
    write_json(DIRECTORY/'manifest.json', manifest)
    print('下载', relative, len(payload), 'bytes', checks['hours'], '小时', flush=True)
    return value

def main():
    manifest_path = DIRECTORY/'manifest.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else dict(schemaVersion=1, source='ERA5 via Open-Meteo', requests=[], errors=[])
    # 两个季节内小样均通过才扩大；复跑直接验证字节缓存，不重复请求。
    for site, start, end in [(SITES[0], '2019-06-24', '2019-06-25'), (SITES[1], '2019-07-24', '2019-07-25')]:
        fetch(site, start, end, 'smoke', manifest)
    for site in SITES:
        fetch(site, START, END, 'full-period', manifest)
    manifest['status'] = 'complete'
    write_json(manifest_path, manifest)

if __name__ == '__main__':
    main()
