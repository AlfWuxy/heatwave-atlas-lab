import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (path) => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'))
const data = read('public/data/europe2019-mechanism.json')
const manifest = read('data/mechanisms/europe2019/manifest.json')
const mapping = {
  temperatureC: 'temperature_2m', soilMoisture: 'soil_moisture_0_to_7cm',
  soilMoistureDeep: 'soil_moisture_7_to_28cm', precipitationMm: 'precipitation',
  shortwaveWm2: 'shortwave_radiation', windSpeedMs: 'wind_speed_10m',
  windDirectionDeg: 'wind_direction_10m', cloudCoverPct: 'cloud_cover',
}

test('Europe mechanism public values retain original bytes provenance and complete UTC axes', () => {
  assert.equal(data.schemaVersion, 1)
  assert.equal(data.sites.length, 4)
  assert.equal(manifest.status, 'complete')
  assert.equal(data.source.model, 'ERA5')
  assert.equal(data.source.elevationDownscaling, false)
  const expected = Array.from({ length: 1464 }, (_, i) => new Date(Date.UTC(2019, 5, 1) + i * 3600000).toISOString().replace('.000Z', 'Z'))
  for (const site of data.sites) {
    const entry = manifest.requests.find(r => r.siteId === site.id && r.purpose === 'full-period')
    assert.ok(entry)
    const rawBytes = readFileSync(new URL('../' + site.provenance.rawPath, import.meta.url))
    assert.equal(createHash('sha256').update(rawBytes).digest('hex'), site.provenance.rawSha256)
    assert.equal(entry.sha256, site.provenance.rawSha256)
    const request = new URL(entry.url)
    assert.equal(request.searchParams.get('models'), 'era5')
    assert.equal(request.searchParams.get('elevation'), 'nan')
    assert.equal(request.searchParams.get('timezone'), 'UTC')
    const raw = JSON.parse(rawBytes)
    assert.deepEqual(site.time, expected)
    assert.equal(site.gridLatitude, raw.latitude)
    assert.equal(site.gridLongitude, raw.longitude)
    for (const [front, api] of Object.entries(mapping)) {
      assert.deepEqual(site[front], raw.hourly[api])
      assert.equal(data.units[front], raw.hourly_units[api])
      assert.equal(site[front].length, expected.length)
      assert.ok(site[front].every(Number.isFinite))
    }
  }
})

test('48-hour pilot values agree with full-period independent requests', () => {
  for (const pilot of manifest.requests.filter(r => r.purpose === 'smoke')) {
    const raw = read('data/mechanisms/europe2019/' + pilot.path)
    const site = data.sites.find(s => s.id === pilot.siteId)
    for (let i = 0; i < raw.hourly.time.length; i++) {
      const j = site.time.indexOf(raw.hourly.time[i] + ':00Z')
      assert.ok(j >= 0)
      for (const [front, api] of Object.entries(mapping)) assert.equal(site[front][j], raw.hourly[api][i])
    }
  }
})

test('data validator rejects missing values, duplicate times and unit errors', () => {
  const result = spawnSync('python3', ['-c', `
import copy,json,sys
sys.path.insert(0,'scripts')
from fetch_europe_mechanism import validate
x=json.load(open('data/mechanisms/europe2019/raw/paris_2019-06-24_2019-06-25.json'))
for kind in ['missing','time','unit']:
 y=copy.deepcopy(x)
 if kind=='missing': y['hourly']['soil_moisture_0_to_7cm'][0]=None
 if kind=='time': y['hourly']['time'][1]=y['hourly']['time'][0]
 if kind=='unit': y['hourly_units']['shortwave_radiation']='J/m²'
 try: validate(y,'2019-06-24','2019-06-25')
 except ValueError: continue
 raise AssertionError(kind+' accepted')
`], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
})
