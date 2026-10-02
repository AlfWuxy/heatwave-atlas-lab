import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => JSON.parse(readFileSync(root + name));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const catalog = read('data/expansion-30/catalog.json');
const expectedIds = catalog.cases.map(c => c.id);
const variables = {
  temperature_2m: ['°C', -90, 65], relative_humidity_2m: ['%',0,100], pressure_msl: ['hPa',850,1100],
  cloud_cover: ['%',0,100], shortwave_radiation: ['W/m²',0,1600], wind_speed_10m: ['m/s',0,150],
  wind_direction_10m: ['°',0,360], soil_moisture_0_to_7cm: ['m³/m³',0,1],
  soil_moisture_7_to_28cm: ['m³/m³',0,1], precipitation: ['mm',0,500],
};

// 不按文件是否存在筛选；任何未交付案例必须直接失败。
test('三十个新增事件均完成并进入独立索引', () => {
  assert.equal(catalog.cases.length, 30);
  assert.equal(new Set(expectedIds).size, 30);
  const originalIds = [...read('public/data/cases.json').cases, ...read('public/data/extended-cases.json').cases].map(c => c.id);
  assert.ok(expectedIds.every(id => !originalIds.includes(id)));
  const index = read('public/data/expansion-cases.json');
  assert.equal(index.schemaVersion, 1);
  assert.equal(index.status, 'complete');
  assert.deepEqual(index.cases.map(c => c.id), expectedIds);
  assert.equal(index.expectedCases, 30);
  const expectedHours = catalog.cases.reduce((sum,c) => sum+(Date.parse(c.end)-Date.parse(c.start))/3600000+24, 0);
  assert.equal(index.cases.reduce((sum,c)=>sum+c.hours,0), expectedHours);
  for (const meta of index.cases) {
    const artifact = read(`public/data/case-${meta.id}.json`);
    for (const key of Object.keys(meta)) assert.deepEqual(meta[key], artifact[key]);
  }
});

for (const c of catalog.cases) {
  test(`${c.id}：原始响应、完整UTC时间轴、单位与宽松范围逐值验证`, () => {
    const manifest = read(`data/expansion-30/${c.id}/manifest.json`);
    assert.equal(manifest.status, 'complete');
    assert.equal(manifest.catalogSha256,hash(readFileSync(root+'data/expansion-30/catalog.json')));
    assert.equal(manifest.builtCatalogSha256,hash(readFileSync(root+'data/expansion-30/catalog.json')));
    assert.deepEqual(manifest.caseSpecification,c);
    assert.equal(manifest.requests.length, 3);
    assert.equal(manifest.requestPolicy.serial, true);
    assert.equal(manifest.requestPolicy.stopImmediatelyOn429, true);
    assert.ok(manifest.requestPolicy.minimumSecondsAfterResponse >= 10);
    assert.deepEqual(read(`public/data/regional-${c.id}-manifest.json`), manifest);
    for (const entry of manifest.requests) {
      const rawBytes = readFileSync(root + entry.path);
      assert.equal(hash(rawBytes), entry.sha256);
      assert.equal(rawBytes.length, entry.bytes);
      assert.equal(entry.validation.passed, true);
      assert.ok(Number.isFinite(Date.parse(entry.retrievedAt)));
      const url = new URL(entry.url);
      assert.equal(url.origin, 'https://archive-api.open-meteo.com');
      for (const [key,value] of Object.entries({models:'era5',timezone:'UTC',cell_selection:'nearest',wind_speed_unit:'ms'})) {
        assert.equal(url.searchParams.get(key), value);
      }
      assert.deepEqual(url.searchParams.get('elevation').split(','), entry.requestedGrid.map(()=>'nan'));
      assert.deepEqual(url.searchParams.get('latitude').split(',').map(Number), entry.requestedGrid.map(p=>p.latitude));
      assert.deepEqual(url.searchParams.get('longitude').split(',').map(Number), entry.requestedGrid.map(p=>p.longitude));
      assert.equal(url.searchParams.get('start_date'), entry.start);
      assert.equal(url.searchParams.get('end_date'), entry.end);
      assert.equal(entry.start, c.start);
      assert.equal(entry.end, entry.purpose === 'smoke' ? c.start : c.end);
      assert.deepEqual(url.searchParams.get('hourly').split(','), entry.variables);
      let raw = JSON.parse(rawBytes);
      if (!Array.isArray(raw)) raw = [raw];
      assert.equal(raw.length, entry.requestedGrid.length);
      assert.equal(new Set(raw.map(p=>`${p.latitude},${p.longitude}`)).size, raw.length);
      const expectedHours = (Date.parse(entry.end)-Date.parse(entry.start))/3600000+24;
      for (let k=0;k<raw.length;k++) {
        const p=raw[k];
        assert.equal(p.longitude, entry.requestedGrid[k].longitude);
        assert.equal(p.latitude, entry.requestedGrid[k].latitude);
        assert.equal(p.utc_offset_seconds, 0);
        assert.ok(['GMT','UTC'].includes(p.timezone));
        assert.deepEqual(p.hourly_units, {time:'iso8601', ...Object.fromEntries(entry.variables.map(v=>[v,variables[v][0]]))});
        assert.equal(p.hourly.time.length, expectedHours);
        for (let t=0;t<expectedHours;t++) {
          assert.equal(Date.parse(`${p.hourly.time[t]}:00Z`), Date.parse(entry.start)+t*3600000);
        }
        for (const v of entry.variables) {
          assert.equal(p.hourly[v].length, expectedHours);
          for (const value of p.hourly[v]) {
            assert.ok(Number.isFinite(value));
            const lower=v.startsWith('soil_moisture_') ? -.005 : variables[v][1];
            assert.ok(value >= lower && value <= variables[v][2]);
          }
          const stats=entry.validation.ranges[k].variables[v];
          assert.equal(stats.missing, 0);
          assert.equal(stats.minimum, Math.min(...p.hourly[v]));
          assert.equal(stats.maximum, Math.max(...p.hourly[v]));
          const flags=p.hourly[v].flatMap((value,index)=>value<variables[v][1]||value>variables[v][2] ? [{index,time:`${p.hourly.time[index]}:00Z`,value}] : []);
          assert.deepEqual(stats.outsidePhysicalRange,flags);
          assert.equal(stats.qualityStatus,flags.length?'flagged':'clean');
        }
      }
    }
    for (const a of manifest.artifacts) {
      const bytes=readFileSync(root+a.path);
      assert.equal(hash(bytes), a.sha256);
      assert.equal(bytes.length, a.bytes);
    }
  });

  test(`${c.id}：单点CSV/JSON、25原格点和风分量均匹配原始资料`, () => {
    const manifest=read(`data/expansion-30/${c.id}/manifest.json`);
    const pointEntry=manifest.requests.find(r=>r.purpose==='point');
    let point=read(pointEntry.path); if (Array.isArray(point)) point=point[0];
    const original=read(manifest.requests.find(r=>r.purpose==='regional').path);
    const data=read(`public/data/case-${c.id}.json`);
    const regional=read(`public/data/regional-${c.id}.json`);
    assert.equal(data.schemaVersion,1);
    assert.equal(data.id,c.id);
    for (const key of ['name','country','continent','year']) assert.equal(data[key],c[key]);
    assert.equal(data.timezone,c.timezone);
    assert.deepEqual(data.requestedLocation,{latitude:c.latitude,longitude:c.longitude});
    assert.deepEqual(data.gridLocation,{latitude:point.latitude,longitude:point.longitude,elevation:point.elevation});
    assert.equal(data.rawSha256,pointEntry.sha256);
    assert.equal(data.requestUrl,pointEntry.url);
    assert.deepEqual(data.eventEvidence,c.sourceUrls);
    assert.equal(data.summary,c.summary);
    assert.deepEqual(data.units,point.hourly_units);
    const flags=Object.keys(variables).filter(v=>point.hourly[v].some(n=>n<variables[v][1]||n>variables[v][2]));
    assert.equal(data.qualityStatus,flags.length?'flagged':'clean');
    assert.deepEqual(data.qualityWarnings.map(w=>w.variable),flags);
    assert.deepEqual(data.qualityWarnings,manifest.qualityWarnings);
    for(const warning of data.qualityWarnings) {
      const bad=point.hourly[warning.variable].filter(n=>n<variables[warning.variable][1]||n>variables[warning.variable][2]);
      assert.equal(warning.count,bad.length);
      assert.equal(warning.min,Math.min(...bad));
      assert.equal(warning.max,Math.max(...bad));
    }
    const csv=readFileSync(root+`public/data/case-${c.id}.csv`,'utf8').trim().split(/\r?\n/).map(l=>l.split(','));
    assert.deepEqual(csv[0],['time',...Object.keys(variables)]);
    assert.equal(csv.length,data.rows.length+1);
    assert.equal(regional.schemaVersion,'1');
    assert.equal(regional.caseId,c.id);
    assert.deepEqual(regional.units,{temperature:'°C',wind:'m/s'});
    assert.equal(regional.grid.nx,5); assert.equal(regional.grid.ny,5);
    assert.equal(regional.grid.order,'south-to-north, west-to-east');
    assert.equal(regional.grid.crs,'EPSG:4326');
    assert.ok(Math.abs(regional.grid.lons[2]-c.longitude)<=.125);
    assert.ok(Math.abs(regional.grid.lats[2]-c.latitude)<=.125);
    assert.equal(regional.grid.lons[2],point.longitude);
    assert.equal(regional.grid.lats[2],point.latitude);
    for (const axis of [regional.grid.lons,regional.grid.lats]) {
      assert.equal(axis.length,5);
      for(let i=1;i<5;i++) assert.equal(axis[i]-axis[i-1],.25);
    }
    assert.equal(original.length,25);
    assert.equal(regional.times.length,data.hours);
    assert.equal(data.hours,data.rows.length);
    assert.equal(regional.validation.interpolationApplied,false);
    assert.equal(regional.validation.pointCount,25);
    for(const field of ['temperature','u','v']) assert.equal(regional[field].length,data.hours);
    assert.equal(data.peakTemperature,Math.max(...data.rows.map(r=>r.temperature_2m)));
    assert.equal(data.peakTime,data.rows.find(r=>r.temperature_2m===data.peakTemperature).time);
    for(let t=0;t<data.hours;t++) {
      assert.equal(data.rows[t].time,`${point.hourly.time[t]}:00Z`);
      assert.equal(regional.times[t],data.rows[t].time);
      assert.equal(csv[t+1][0],data.rows[t].time);
      for(const [j,v] of Object.keys(variables).entries()) {
        assert.equal(data.rows[t][v],point.hourly[v][t]);
        assert.equal(Number(csv[t+1][j+1]),point.hourly[v][t]);
      }
      for(const field of ['temperature','u','v']) assert.equal(regional[field][t].length,25);
      for(let k=0;k<25;k++) {
        const raw=original[k];
        assert.equal(raw.longitude,regional.grid.lons[k%5]);
        assert.equal(raw.latitude,regional.grid.lats[Math.floor(k/5)]);
        assert.equal(`${raw.hourly.time[t]}:00Z`,regional.times[t]);
        assert.equal(regional.temperature[t][k],raw.hourly.temperature_2m[t]);
        const angle=raw.hourly.wind_direction_10m[t]*Math.PI/180;
        const speed=raw.hourly.wind_speed_10m[t];
        assert.ok(Math.abs(regional.u[t][k]+speed*Math.sin(angle))<=.00000051);
        assert.ok(Math.abs(regional.v[t][k]+speed*Math.cos(angle))<=.00000051);
      }
      assert.equal(regional.temperature[t][12],data.rows[t].temperature_2m);
      assert.ok(Math.abs(Math.hypot(regional.u[t][12],regional.v[t][12])-data.rows[t].wind_speed_10m)<.000001);
    }
  });
}

// 在写入发生前拒绝陈旧窗或地理元数据，原始输入与已发布产物均保持不变。
test('构建器拒绝与已取数据不符的新窗口和坐标', () => {
  const id=catalog.cases[0].id;
  const files=[`public/data/case-${id}.json`,`public/data/case-${id}.csv`,`public/data/regional-${id}.json`,`data/expansion-30/${id}/manifest.json`];
  const before=files.map(p=>hash(readFileSync(root+p)));
  execFileSync('python3', ['-c', `
import sys, json
sys.path.insert(0,'scripts')
from build_extended_cases import build_case
from fetch_extended_cases import EXPANSION_CONFIG
from datetime import date, timedelta
case=json.load(open('data/expansion-30/catalog.json'))['cases'][0]
for field, value in [('start',str(date.fromisoformat(case['start'])+timedelta(days=1))),('end',str(date.fromisoformat(case['end'])-timedelta(days=1))),('latitude',case['latitude']+1),('longitude',case['longitude']+1)]:
    changed=dict(case)
    changed[field]=value
    try:
        build_case(changed, EXPANSION_CONFIG)
    except ValueError:
        pass
    else:
        raise AssertionError('应拒绝陈旧元数据: '+field)
`], {cwd:root});
  assert.deepEqual(files.map(p=>hash(readFileSync(root+p))),before);
});

// 工程容忍只用于保留原值并警示，不把负含水率升级成物理有效数值。
test('三十地管线拒绝大幅异常、缺测和错误单位，并保留小负值标记', () => {
  execFileSync('python3', ['-c', `
import sys,json,copy
sys.path.insert(0,'scripts')
from fetch_extended_cases import validate, EXPANSION_CONFIG, Downloader
catalog=json.load(open('data/expansion-30/catalog.json'))
id=catalog['cases'][0]['id']
m=json.load(open('data/expansion-30/'+id+'/manifest.json'))
e=next(r for r in m['requests'] if r['purpose']=='point')
x=json.load(open(e['path']))
if isinstance(x,list): x=x[0]
points=[(p['longitude'],p['latitude']) for p in e['requestedGrid']]
assert Downloader(0,EXPANSION_CONFIG).interval >= 10
for kind in ['large_negative','missing','unit','duplicate_time']:
 y=copy.deepcopy(x)
 if kind=='large_negative': y['hourly']['soil_moisture_0_to_7cm'][0]=-.006
 if kind=='missing': y['hourly']['temperature_2m'][0]=None
 if kind=='unit': y['hourly_units']['shortwave_radiation']='J/m²'
 if kind=='duplicate_time': y['hourly']['time'][1]=y['hourly']['time'][0]
 try: validate(json.dumps(y),points,e['start'],e['end'],e['variables'])
 except ValueError: continue
 raise AssertionError(kind+' was not rejected')
y=copy.deepcopy(x)
y['hourly']['soil_moisture_0_to_7cm'][0]=-.001
rows,checks=validate(json.dumps(y),points,e['start'],e['end'],e['variables'])
assert rows[0]['hourly']['soil_moisture_0_to_7cm'][0]==-.001
stats=checks[0]['variables']['soil_moisture_0_to_7cm']
assert stats['physicalRange']==[0,1] and stats['qualityStatus']=='flagged'
assert stats['outsidePhysicalRange'][0]['index']==0
`], {cwd:root});
});

// 汇总数来自全部清单，不将有质量标记的真实值改写成无异常。
test('三十地总体验证报告与实际请求、异常和恢复记录一致', () => {
  const report=read('data/expansion-30/validation.json');
  assert.deepEqual(read('public/data/expansion-validation.json'),report);
  assert.equal(report.status,'complete');
  const manifests=catalog.cases.map(c=>read(`data/expansion-30/${c.id}/manifest.json`));
  assert.equal(report.passed,true);
  assert.equal(report.actualCases,30);
  assert.equal(report.rawResponses,90);
  assert.equal(report.singlePointHours,11952);
  assert.equal(report.singlePointVariableValues,119520);
  assert.equal(report.regionalGridHours,298800);
  assert.equal(report.regionalVariableValues,896400);
  assert.equal(report.missingValues,0);
  assert.equal(report.catalogSha256,hash(readFileSync(root+'data/expansion-30/catalog.json')));
  assert.equal(report.flaggedValues,manifests.flatMap(m=>m.qualityWarnings).reduce((s,w)=>s+w.count,0));
  assert.equal(report.failureRecords,manifests.reduce((s,m)=>s+m.errors.length,0));
  assert.equal(report.recoveredFailureRecords,report.failureRecords);
  assert.equal(report.allRawSha256Verified,true);
  assert.equal(report.allDerivedSha256Verified,true);
  assert.equal(report.allPublicManifestsMatch,true);
  assert.ok(Number.isFinite(Date.parse(report.validatedAt)));
});
