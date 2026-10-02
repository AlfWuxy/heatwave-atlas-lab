#!/usr/bin/env python3
"""从已校验原始响应生成只含真实点位序列的公开教学数据包。"""
import hashlib
import json
from pathlib import Path
from fetch_europe_mechanism import ROOT, DIRECTORY, SITES, VARIABLES, START, END, validate, write_json, url_for

OUTPUT = ROOT/'public/data/europe2019-mechanism.json'

def build():
    manifest = json.loads((DIRECTORY/'manifest.json').read_text())
    if manifest.get('status') != 'complete':
        raise ValueError('取数未完整完成')
    sites, reports = [], []
    for site in SITES:
        name = f"raw/{site['id']}_{START}_{END}.json"
        entry = next(x for x in manifest['requests'] if x['path'] == name and x['purpose'] == 'full-period')
        raw = (DIRECTORY/name).read_bytes()
        if hashlib.sha256(raw).hexdigest() != entry['sha256'] or entry['url'] != url_for(site, START, END):
            raise ValueError('原始响应哈希或请求不匹配')
        value = json.loads(raw)
        checks = validate(value, START, END)
        hourly = value['hourly']
        sites.append(dict(**site, gridLatitude=value['latitude'], gridLongitude=value['longitude'], gridElevationM=value['elevation'],
                          time=[t+':00Z' for t in hourly['time']],
                          **{front:hourly[api] for api,front,*_ in VARIABLES},
                          provenance=dict(requestUrl=entry['url'], retrievedAtUtc=entry['retrievedAtUtc'], rawSha256=entry['sha256'], rawPath='data/mechanisms/europe2019/'+name)))
        reports.append(dict(siteId=site['id'], **checks))
    result = dict(
        schemaVersion=1, id='europe2019-mechanism', title='欧洲2019 · 两个月的地表记忆',
        period=dict(start=START+'T00:00:00Z', end=END+'T23:00:00Z', timeBasis='UTC', intervalHours=1),
        source=dict(name='ERA5 via Open-Meteo', url='https://open-meteo.com/',
                    retrievedAt=max(s['provenance']['retrievedAtUtc'] for s in sites),
                    requestUrls=[s['provenance']['requestUrl'] for s in sites], validationPassed=True,
                    documentationUrl='https://open-meteo.com/en/docs/historical-weather-api',
                    licenseUrl='https://creativecommons.org/licenses/by/4.0/',
                    attributionUrl='https://open-meteo.com/en/licence', termsUrl='https://open-meteo.com/en/terms',
                    datasetUrl='https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview',
                    model='ERA5', provider='Open-Meteo（第三方数据 API）', originalProducer='ECMWF / Copernicus Climate Change Service',
                    resolutionDegrees=0.25, elevationDownscaling=False, cellSelection='nearest',
                    attribution='Contains modified Copernicus Climate Change Service information (2019). Weather data by Open-Meteo.com, CC BY 4.0.',
                    processing='请求 ERA5 最近格点，禁用高程降尺度；仅字段重命名并显式添加 UTC 时区，未改动数值。'),
        units={front:unit for _,front,unit,*_ in VARIABLES},
        variableNotes=dict(temperatureC='2米气温，瞬时格点再分析；不是气象站纪录。',
                           soilMoisture='0–7cm土层体积含水率；不是干旱指数或相对饱和百分比。',
                           soilMoistureDeep='7–28cm土层体积含水率；不是完整根区水分。',
                           precipitationMm='时间戳结束的前一小时总降水（水当量），不是未来一小时。',
                           shortwaveWm2='时间戳结束的前一小时平均向下短波；不是净辐射或热量总收支。',
                           windSpeedMs='10米风速，瞬时格点再分析。', windDirectionDeg='10米风的来向，正北为0°，顺时针。',
                           cloudCoverPct='总云量，瞬时格点再分析。'),
        scope='4个请求坐标对应的ERA5格点，61天逐小时；不是欧洲区域均值、连续空间场、或论文复现。',
        limitations=['土壤、降水、短波和气温的同步变化不能单独证明因果或量化贡献。',
                     '尚无本包对应的气候基准，所有值为原值，不显示距平或干旱百分位。',
                     '未取得真实感热、潜热、净长波、高空气压层或反事实模拟。',
                     '逐小时记录应按各变量的瞬时/前一小时含义解释，前端动画插值不增加观测频率。'],
        sites=sites)
    write_json(OUTPUT, result)
    write_json(DIRECTORY/'validation.json', dict(passed=True, sites=reports, totalSiteHours=sum(r['hours'] for r in reports),
                                               totalValues=sum(r['hours']*len(VARIABLES) for r in reports),
                                               publicArtifact=dict(path=str(OUTPUT.relative_to(ROOT)),sha256=hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),bytes=OUTPUT.stat().st_size)))
    print('生成', OUTPUT.relative_to(ROOT), OUTPUT.stat().st_size, 'bytes')

if __name__ == '__main__':
    build()
