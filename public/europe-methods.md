# 欧洲2019：有限点位机制观察数据

核验日期：2026-10-02（Asia/Taipei）。本包实际取得四个请求位置附近的 ERA5 格点资料，用于观察两次高温之间环境状态如何变化。它是描述性教学资料，不是 Sousa 等论文的复现、归因实验或欧洲全域统计。

## 已取得什么

2019-06-01 00:00 至 2019-07-31 23:00 UTC，61天，每点1464小时；四点共5856个点时、8变量共46848个数值。正式窗口缺测为0；两次48小时先导请求另存，不计入该总数。先导窗口与完整窗口重合部分逐值一致。

| 名称标签 | 请求经纬度 | API返回格点经纬度 | 返回格点高程 |
|---|---|---|---|
| 巴黎 | 48.86°N, 2.35°E | 48.75°N, 2.25°E | 104m |
| 图卢兹 | 43.60°N, 1.45°E | 43.50°N, 1.50°E | 208m |
| 布鲁塞尔 | 50.85°N, 4.35°E | 50.75°N, 4.25°E | 66m |
| 法兰克福 | 50.11°N, 8.68°E | 50.00°N, 8.75°E | 161m |

城市名只是定位标签，不代表市中心实测、全市均值或全市气象站纪录。四点在取数前按地理分布选定，没有按结果挑选。对这些点不作面积平均或全欧洲外推。

## 来源与许可

原始产品为 ECMWF / Copernicus Climate Change Service ERA5，经第三方 Open-Meteo 历史 API 提供。[API文档](https://open-meteo.com/en/docs/historical-weather-api)、[ERA5单层目录](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview)。请求固定 `models=era5`、`elevation=nan`、`cell_selection=nearest`、`timezone=UTC`，不用默认混合模型，不作地形统计降尺度。

[Open-Meteo许可](https://open-meteo.com/en/licence)对 API 数据指定 CC BY 4.0，并要求显示位置旁放来源链接；[服务条款](https://open-meteo.com/en/terms)区分免费非商业服务和商业服务。本轮用于非商业科普，离线取得后静态发布，无每位访客重复调用。网站数据旁应链接 `https://open-meteo.com/`，保留 CC BY 4.0 链接及修改说明；不能把来源署名解释成官方认可本站。

建议署名：Contains modified Copernicus Climate Change Service information (2019). Weather data by Open-Meteo.com, CC BY 4.0. 本包仅重命名字段和显式标注 UTC，数值未修改。

## 字段含义

| 前端字段 | 原API字段 | 单位 | 时间含义 |
|---|---|---|---|
| temperatureC | temperature_2m | °C | 对应整点的2米气温 |
| soilMoisture | soil_moisture_0_to_7cm | m³/m³ | 对应整点的0–7cm土层体积含水率 |
| soilMoistureDeep | soil_moisture_7_to_28cm | m³/m³ | 对应整点的7–28cm土层体积含水率 |
| precipitationMm | precipitation | mm | 该整点结束的前一小时总降水水当量 |
| shortwaveWm2 | shortwave_radiation | W/m² | 该整点结束的前一小时平均向下短波 |
| windSpeedMs | wind_speed_10m | m/s | 对应整点的10米风速 |
| windDirectionDeg | wind_direction_10m | ° | 风的来向，正北0°顺时针 |
| cloudCoverPct | cloud_cover | % | 对应整点总云量 |

0.20m³/m³表示土壤总体积中水的体积占比0.20，不等于“已达20%饱和”，也不等于“干旱程度20%”。不同土壤孔隙度与植被状态没有在此恢复，不能把任意统一阈值叫干旱阈值。深层字段只到28cm，不是完整根区。

短波不是净辐射，更不是显热/潜热总收支。本包没有 H、LE、净长波、压力层或反事实。不能用土壤含水率反推一个看似实测的潜热箭头，也不能将短波与温度的共变解释成独立贡献。

API直接提供小时量，本包不对相邻小时作差。若日后计算严格UTC日累计降水或短波能量，应按覆盖区间而非标签日期分组：某日00:00–24:00需要结束时刻01:00至次日00:00的24个小时。本包结束于7月31日23:00，**不能在没有8月1日00:00记录时显示7月31日完整UTC日累计**。当前交付只含小时原值，没有日聚合。短波W/m²换成该小时MJ/m²需乘0.0036。

## 前端契约与画面含义

`public/data/europe2019-mechanism.json`：`schemaVersion:1`；含 `id,title,period,source,units,variableNotes,scope,limitations,sites`。每个 site 有请求/返回经纬度、当地 IANA 时区、1464个带Z的UTC时间戳以及同长度数值数组。各点时间轴一致。`source.validationPassed`仅表示本包基础数据检查通过，不表示成因经过验证。

城市切换、表层/深层切换、时间播放、固定两时刻比较、同步探针、小时原值下载可以直接使用这些数据。画面的雨滴、土层填色和太阳亮度如由点位变量驱动，应标为“点位数据驱动示意”；它们不是区域真实降雨场、微观含水分布或热传导数值解。风粒子要遵守来向/去向换算，不能说是历史空气团轨迹。界面可以显示当地时刻，但内部索引与分享时刻保留UTC。

[欧洲2019原论文](https://www.nature.com/articles/s43247-020-00048-9)提供机制背景；当前序列支持访客提出问题、发现共同变化与差异，不足以证明“六月单独造成七月”或“干燥导致额外X°C”。尚无本包气候基准，不做距平或干旱百分位。演示应允许任何时刻停留，不为配合故事隐藏反例。

## 复现与文件

```sh
python3 scripts/fetch_europe_mechanism.py
python3 scripts/build_europe_mechanism.py
node --test tests/europe-mechanism-data.test.mjs
```

- `data/mechanisms/europe2019/raw/`：2份先导、4份正式原始JSON，字节原样保存。
- `data/mechanisms/europe2019/manifest.json`：每次请求URL、取数UTC、字节数、SHA-256、实际坐标、单位和变量范围。
- `data/mechanisms/europe2019/validation.json`：正式窗口检查和公开包SHA-256。
- 构建脚本再次检查哈希、请求参数、时间轴、缺测、范围与单位；不填补缺测，不覆盖来源不一致的缓存。
- 自动测试核对全部前端数组与原响应逐值一致、48小时先导与正式窗口重合值一致，并用缺测/重复时刻/错误单位验证拒绝路径。

已核对 [ARCO ERA5官方仓库](https://github.com/google-research/arco-era5) 的匿名读取方案，但其展示的标准数据按单小时整全球分块，不适合本轮四点两个月的轻量请求，因此未进行大型下载。环境未发现 `.cdsapirc` 或 CDSAPI_URL/CDSAPI_KEY/ECMWF_API_KEY 变量；没有读取秘密或改全局配置。若后续要取得原始通量、压力层和区域统计，需另选适合空间子集的公开入口或现有CDS授权。**本次未下载 ERA5 压力层或 ECOSTRESS 像元。**
