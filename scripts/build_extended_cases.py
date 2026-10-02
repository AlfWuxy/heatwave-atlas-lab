#!/usr/bin/env python3
"""从带 SHA-256 的扩展案例原始响应构建点位曲线、区域帧及独立索引。"""
import csv
import json
import math
from pathlib import Path
from fetch_extended_cases import ROOT, DATA, VARIABLES, REGIONAL, grid_for, now, save, sha, validate, url_for, times_for

PUBLIC = ROOT / 'public/data'
SOURCE = dict(label='ERA5 再分析 · 通过 Open-Meteo 获取', provider='Open-Meteo（第三方 API）',
              datasetUrl='https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels',
              documentationUrl='https://open-meteo.com/en/docs/historical-weather-api',
              attribution='Weather data by Open-Meteo.com (CC BY 4.0), based on Copernicus Climate Change Service ERA5 reanalysis (ECMWF).',
              licence='CC BY 4.0', model='era5', elevationDownscaling=False, cellSelection='nearest')
CAVEAT = '人工选择的事件前后观察窗口，不是阈值算法识别的热浪边界。资料为 ERA5 再分析网格，不是城市站点纪录；变量共同变化不能确定因果贡献。'


def compact(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')


def read_request(manifest, purpose):
    entry = next(r for r in manifest['requests'] if r['purpose'] == purpose)
    payload = (ROOT/entry['path']).read_bytes()
    if sha(payload) != entry['sha256']:
        raise ValueError('原始字节 SHA-256 变化')
    points = [(p['longitude'], p['latitude']) for p in entry['requestedGrid']]
    rows, _ = validate(payload, points, entry['start'], entry['end'], entry['variables'])
    return rows, entry


def build_case(case):
    cid = case['id']
    path = DATA/cid/'manifest.json'
    manifest = json.loads(path.read_text())
    lons, lats = grid_for(case)
    points = [(lon, lat) for lat in lats for lon in lons]
    specifications = {
        'smoke': (points[:2], case['start'], REGIONAL),
        'point': ([points[12]], case['end'], list(VARIABLES)),
        'regional': (points, case['end'], REGIONAL),
    }
    # 构建时重新锁定当前目录的坐标、窗口与变量，防止旧缓存被贴上新事件元数据。
    for purpose, (requested, end, variables) in specifications.items():
        entries = [r for r in manifest['requests'] if r['purpose'] == purpose]
        if len(entries) != 1:
            raise ValueError('请求缺失或重复')
        entry = entries[0]
        if entry['url'] != url_for(requested, case['start'], end, variables):
            raise ValueError('原始请求与当前冻结目录不一致')
        if (entry['start'], entry['end'], entry['variables'], entry['requestedGrid']) != (
            case['start'], end, variables, [dict(longitude=lon, latitude=lat) for lon, lat in requested]):
            raise ValueError('请求清单窗口、格点或变量与当前目录不一致')
    point_rows, point_entry = read_request(manifest, 'point')
    regional_rows, _ = read_request(manifest, 'regional')
    read_request(manifest, 'smoke')
    point = point_rows[0]
    lons, lats = grid_for(case)
    wanted = [(lon, lat) for lat in lats for lon in lons]
    if [(p['longitude'], p['latitude']) for p in regional_rows] != wanted:
        raise ValueError('区域格点排序或覆盖不完整')
    if (point['longitude'], point['latitude']) != wanted[12]:
        raise ValueError('代表格点不是区域中心')
    if point['hourly']['time'] != times_for(case['start'], case['end']):
        raise ValueError('代表格点时间轴与当前事件窗口不一致')
    times = [t+':00Z' for t in point['hourly']['time']]
    rows = [dict(time=stamp, **{v: point['hourly'][v][i] for v in VARIABLES}) for i, stamp in enumerate(times)]
    for v in REGIONAL:
        if point['hourly'][v] != regional_rows[12]['hourly'][v]:
            raise ValueError('代表格点与区域中心数据不一致')
    peak = max(rows, key=lambda r: r['temperature_2m'])
    evidence = case.get('eventEvidence', case.get('sourceUrls', []))
    quality_warnings = []
    for variable, (_, low, high) in VARIABLES.items():
        flagged = [v for v in point['hourly'][variable] if not low <= v <= high]
        if flagged:
            quality_warnings.append(dict(variable=variable, count=len(flagged), min=min(flagged), max=max(flagged),
                message='原始再分析含水量出现轻微负值；已保留并标记，不能解释为物理上的负含水量。'))
    quality_status = 'flagged' if quality_warnings else 'clean'
    meta = dict(id=cid, cityId=case['cityId'], title=case['title'], start=case['start'], end=case['end'],
                hours=len(rows), peakTemperature=peak['temperature_2m'], peakTime=peak['time'],
                timeBasis='UTC', timezone=case['timezone'], dataUrl=f'/data/case-{cid}.json', csvUrl=f'/data/case-{cid}.csv',
                requestedLocation={k: case[k] for k in ('latitude', 'longitude')}, gridLocation={k: point[k] for k in ('latitude','longitude','elevation')},
                source=SOURCE, retrievedAt=point_entry['retrievedAt'], rawSha256=point_entry['sha256'], requestUrl=point_entry['url'],
                summary=case.get('summary', ''), eventEvidence=evidence, scopeNote=case.get('scopeNote', ''),
                windowType='curated_replay_window', caveat=CAVEAT, qualityStatus=quality_status, qualityWarnings=quality_warnings)
    compact(PUBLIC/f'case-{cid}.json', dict(schemaVersion=1, **meta, units=point['hourly_units'], rows=rows))
    with (PUBLIC/f'case-{cid}.csv').open('w', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=['time', *VARIABLES])
        writer.writeheader()
        writer.writerows(rows)
    fields = dict(temperature=[], u=[], v=[])
    for t in range(len(times)):
        temperatures, u, v = [], [], []
        for row in regional_rows:
            series = row['hourly']
            temperatures.append(series['temperature_2m'][t])
            angle = math.radians(series['wind_direction_10m'][t])
            speed = series['wind_speed_10m'][t]
            # 气象风向是来向，正 u 向东、正 v 向北。
            u.append(round(-speed*math.sin(angle), 6))
            v.append(round(-speed*math.cos(angle), 6))
        fields['temperature'].append(temperatures)
        fields['u'].append(u)
        fields['v'].append(v)
    checks = dict(passed=True, pointCount=25, frameCount=len(times), completeRegularGrid=True,
                  exactRequestedCoordinates=True, uniqueCoordinates=True, hourlyUtcContiguous=True,
                  allArrayLengthsMatch=True, noMissingValues=True, allValuesFinite=True, unitsMatch=True,
                  resolutionDegrees=.25, interpolationApplied=False,
                  temperatureMin=min(map(min, fields['temperature'])), temperatureMax=max(map(max, fields['temperature'])),
                  windConversion='u=-speed*sin(direction*pi/180); v=-speed*cos(direction*pi/180)', windPrecisionDecimals=6)
    regional = dict(schemaVersion='1', caseId=cid, title=case['title'], source=SOURCE,
                    retrievedAt=max(r['retrievedAt'] for r in manifest['requests']),
                    grid=dict(nx=5, ny=5, lons=lons, lats=lats, spacing=.25, crs='EPSG:4326', order='south-to-north, west-to-east'),
                    times=times, **fields, units=dict(temperature='°C', wind='m/s'), validation=checks,
                    rawManifestUrl=f'/data/regional-{cid}-manifest.json')
    regional_path = PUBLIC/f'regional-{cid}.json'
    compact(regional_path, regional)
    manifest.update(status='complete', completedAt=now(), validation=checks, qualityStatus=quality_status, qualityWarnings=quality_warnings,
                    builtCatalogSha256=sha((DATA/'catalog.json').read_bytes()), caseSpecification=case)
    manifest['artifacts'] = [{ 'path': str(p.relative_to(ROOT)), 'sha256': sha(p.read_bytes()), 'bytes': p.stat().st_size}
                             for p in [PUBLIC/f'case-{cid}.json', PUBLIC/f'case-{cid}.csv', regional_path]]
    manifest['artifact'] = manifest['artifacts'][-1]
    save(path, manifest)
    save(PUBLIC/f'regional-{cid}-manifest.json', manifest)
    print('COMPLETE', cid, len(times), 'hours, 25 cells', flush=True)
    return meta


def build_index():
    catalog = json.loads((DATA/'catalog.json').read_text())['cases']
    complete = []
    for case in catalog:
        manifest_path = DATA/case['id']/'manifest.json'
        if not manifest_path.exists() or json.loads(manifest_path.read_text())['status'] != 'complete':
            continue
        artifact = json.loads((PUBLIC/f"case-{case['id']}.json").read_text())
        complete.append({k:v for k,v in artifact.items() if k not in ('rows','units','schemaVersion')})
    save(PUBLIC/'extended-cases.json', dict(schemaVersion=1, generatedAt=now(), cases=complete,
         status='complete' if len(complete)==len(catalog)==10 else 'partial', expectedCases=10,
         scope='十处独立热浪事件的有限区域与代表格点；不是全球连续覆盖，也不是新增十个20年城市序列。'))


if __name__ == '__main__':
    for case in json.loads((DATA/'catalog.json').read_text())['cases']:
        build_case(case)
    build_index()
