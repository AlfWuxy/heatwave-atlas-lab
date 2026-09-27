# 区域风温数据存档

通过 Open-Meteo Historical Weather API 获取 `models=era5` 的有限区域历史数据。API 说明：<https://open-meteo.com/en/docs/historical-weather-api>。底层数据集：<https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels>。

每例 `manifest.json` 记录实际请求 URL、UTC 获取时间、响应原始字节数与 SHA-256、请求/返回坐标、逐批验证及最终产物哈希。`raw/batch-*.json` 是未经重写的 HTTP 响应。只有所有批次通过验证，脚本才生成 `public/data/regional-案例ID.json`；`status: incomplete` 不能视为交付成功。

## 复现

```sh
python3 scripts/fetch_regional_data.py --case chongqing2022
python3 scripts/fetch_regional_data.py --case paris2019
python3 scripts/fetch_regional_data.py --case portland2021
node --test tests/regional-data.test.mjs
```

默认仅下载重庆；`--case all` 按重庆、巴黎、波特兰串行进行。缓存要求请求 URL 和原始响应哈希同时匹配。首批 2 点预检，之后每批至多 25 点，每次响应结束后至少等待 8 秒；收到 429 立即退出，仅 5xx 可重试一次。不使用并行请求或备用入口绕过限流。

## 字段和限制

- 经度、纬度均按 0.25° 升序；公开帧数组 `index=j*nx+i`，第 0 行位于最南侧。每一位置必须与 API 返回坐标完全一致，且不重复。
- 所有小时使用 UTC，起止日均包含全天。温度是 2 m 气温，单位 °C；风是 10 m 水平风，单位 m/s。
- `elevation=nan` 为每个请求点分别设置，关闭海拔订正；`cell_selection=nearest`、`models=era5` 固定。所有响应须单位正确、时间连续、有限且无缺失，否则停止，不补零。
- API 提供风速和表示来向的气象风向。公开数据据此计算 `u=-speed*sin(direction)`、`v=-speed*cos(direction)`，其中 u 向东、v 向北，三角函数使用弧度。输出保留六位小数；这不提高 API 原始风速、风向的精度，也不等于直接取得 ERA5 原生 u/v。
- 温度保留 API 原精度。下载和整理阶段未作空间或时间插值；网站可为视觉连续性插值，但应说明插值性质。
- 这些是再分析网格场，不能表达街道、小区、城市街谷或人体受热。将 10 m 风用于示踪粒子是流向展示，不能解释为真实热量轨迹、空气分子轨迹或温度形成原因的完整归因。
- Open-Meteo 数据采用 CC BY 4.0；展示时保留 Open-Meteo 与 Copernicus/ECMWF ERA5 来源署名。地图底图许可由地图组件单独处理。
