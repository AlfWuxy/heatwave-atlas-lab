# 热浪解剖室 · Heat Atlas

A public climate education website: explore historical heat events, regional wind and temperature, and idealized thermal processes. 界面主要使用中文，面向公众展示真实资料与可操作的物理机制。

Live website: [heatwave-atlas-lab.yilaoweather.org](https://heatwave-atlas-lab.yilaoweather.org/).

## What is included

- Regional replay: Chongqing–Sichuan 2022, Paris area 2019, Portland area 2021; 0.25° ERA5 grids, 1,475 spatial nodes and 559,200 grid-hours.
- Ten additional local replays: London 2022, Phoenix 2023, Melbourne 2009, Tokyo 2018, Dhaka 2023, Karachi 2015, Moscow 2010, Madrid 2022, Buenos Aires 2023 and Agadir 2023. Each includes ten hourly point variables and a 5×5, 0.25° regional wind/temperature grid, within an explicitly curated event window.
- A map with temperature colors, wind-driven particles, hourly controls, original-grid probes and downloadable provenance. Same-point A/B comparison, local-night statistics and shareable UTC states are included.
- Europe 2019 surface-memory explorer: four ERA5 grid points over June–July, 5,856 point-hours and eight variables. Linked charts, soil-depth selection, data-driven schematic animation and point CSV export.
- Daily maximum/minimum 2 m temperature for six locations over 2006–2025, with a 1991–2020 seasonal reference period.
- An idealized thermal particle box, dry adiabatic compression and surface energy partition experiments.
- Twelve selected historical cases, source links and transparent methods.

Reanalysis is accessed through Open-Meteo. This is not a station-record archive, a complete global heatwave catalog, an operational warning service, or a validated attribution model. The regional map combines 10 m wind and 2 m temperature for visualization; particles are not historical heat parcels. The independent thermal box uses dimensionless variables.

## Run locally

Requires Node.js 24+ and Python 3. No API key is needed to view the bundled historical data.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

`npm test` checks physical-model behavior, geographical interpolation, wind direction, source hashes and all regional data values. `npm run build` regenerates method downloads, third-party notices and the public source archive, then produces `dist/`.

## Reproduce the data

Original API responses and URL/time/SHA-256 manifests are included under `data/`. The included public JSON/CSV files are sufficient for normal development; builds do not call the weather API.

```sh
python3 scripts/build_site_data.py
python3 scripts/fetch_regional_data.py --case all
python3 scripts/fetch_europe_mechanism.py
python3 scripts/build_europe_mechanism.py
python3 scripts/build_extended_cases.py
```

`python3 scripts/build_extended_cases.py` rebuilds all ten cases from the bundled raw responses without network access. To refresh them, use `python3 scripts/fetch_extended_cases.py --help` and follow its serial, cached retrieval workflow. Physical-range anomalies are retained and flagged; soil warnings are visible in the replay and included in the manifests.

The second command may use the network when a verified cache is absent. It stops on HTTP 429 and respects serial batching. Read the applicable provider terms before refreshing data or using the service commercially.

- [Data methods](docs/网站数据口径.md)
- [Regional wind and temperature](docs/区域风温回放方法.md)
- [Ten-location event windows, quality flags and data methods](docs/十地历史热浪数据方法.md)
- [Europe 2019 data and visual interpretation](docs/欧洲2019机制数据方法.md)
- [Idealized thermal model](docs/粒子热场方法.md)
- [Regional download procedure](data/regional/README.md)

## Deployment

The app uses Cloudflare Workers Static Assets. `wrangler.jsonc` targets this project's own Worker and subdomain. For your fork, choose your own Worker name and remove or replace the custom-domain route before deploying.

```sh
npx wrangler login
npm run build
npm run deploy
```

Only `dist/` is deployed. GitHub Actions runs tests and a production build; deployment is a separate, explicit command and does not require publishing credentials in this repository. The optional release verification script checks published assets against a local build.

The regional base map uses OpenStreetMap's public standard tiles on demand, with attribution. No bulk/offline tile downloader is provided. For substantial public traffic, configure an appropriate tile provider in `public/map-style.json` and update `public/_headers` accordingly.

## License and acknowledgements

Original software: [MIT](LICENSE). Dependencies, weather data, map data, reports and generated illustrations have distinct terms; see [third-party notices](THIRD_PARTY_NOTICES.md) and [complete dependency licenses](public/third-party-notices.txt).

This repository contains the public application, methods, data and reproducibility scripts. It does not include private research planning, personal application material, credentials or deployment-server information.
