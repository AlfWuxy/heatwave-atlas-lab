# 数据样本说明

这是一份可重复下载的小规模可用性验证，**不是全球全量数据，也不是已识别的全球热浪事件库**。没有建立异常基线、计算归因百分比或运行天气预报模型。

## 文件

- `raw/`：下载时的原始响应字节。包括六个坐标的 24 个五年批次、三个逐小时窗口、一个短窗口验证，以及 NOAA 官方站点样本。
- `csv/`：逐日与逐小时数据表，保留全部下载字段。单位见 `manifest.json` 和 `validation_report.json`。
- `preview.json`：给网页使用的年度汇总与逐小时序列；年度 `max_tmax` 是该年日最高气温序列中的最大值，**不是年平均温度**。
- `manifest.json`：精确请求 URL、UTC 抓取时间、原始与导出文件 SHA-256、请求坐标、返回网格坐标、单位和来源链接。
- `validation_report.json`：逐日/逐小时连续性、数量、缺失、单位、数值范围检查及实际结果。
- `../scripts/fetch_sample_data.py`：仅使用 Python 标准库的下载与检查脚本。

## ERA5 样本

六个请求坐标为波特兰 (45.52, -122.68)、巴黎 (48.86, 2.35)、重庆 (29.56, 106.55)、新德里 (28.61, 77.21)、圣保罗 (-23.55, -46.63)、悉尼 (-33.87, 151.21)。每个坐标下载 2006-01-01 至 2025-12-31 的逐日 2 米日最高/最低气温，共 7,305 日。

原始气候数据是 ECMWF/Copernicus 的 ERA5 再分析；本次通过 **Open-Meteo 第三方 API** 获取，未从 CDS 官方接口直接获取。参数固定 `models=era5`、`cell_selection=nearest`、`elevation=nan`、`timezone=UTC`。关闭了 API 海拔降尺度，返回坐标可与请求的城市坐标不同。数据是网格再分析值，不能称作城市官方气象站纪录。

逐小时字段为 2 米气温、2 米相对湿度、海平面气压、总云量、地表向下短波辐射、10 米风速/风向、0–7 cm 土壤含水量、降水。**它们不构成完整的地表能量收支**：尚无全部长短波净辐射、感热通量、潜热通量、地表/地下热储存和三维大气平流等字段。土壤含水量是体积含水量，不是蒸散量。

逐小时窗口分别是波特兰 2021-06-20 至 07-05（384 小时）、巴黎 2019-07-18 至 07-30（312 小时）、重庆 2022-08-10 至 08-28（456 小时）。这些日期是研究示例窗口，**不是依据阈值检定出的热浪边界**。两日短窗口只验证服务和字段，不计入主数据行数。

所有 ERA5 时间统一为 UTC；日最高/最低值按 **UTC 日**聚合。网页若转换成城市当地时间，应转换时间标签；若需要当地日最高/最低值，则应重新取得当地日聚合数据或从完整逐小时序列重新计算，不能只改日期标签。

## NOAA 站点样本

另有 NOAA NCEI GHCN-Daily 官方直接服务的波特兰国际机场站 USW00024229，2021-06-25 至 2021-06-30 的六日最高/最低气温。此样本单独保存，未混入 ERA5 数组。温度单位来自 API 请求 `units=metric`。站点数据按站点观测日记录，不应直接和 ERA5 UTC 日极值配对来计算误差。

## 复现与来源

在项目根目录运行 `python3 scripts/fetch_sample_data.py`。脚本先做两日短窗口验证，再串行按五年下载。现有原始文件仅在请求URL、路径和 SHA-256 与 manifest 一致时复用；同名不同请求或内容不符会停止，避免覆盖溯源。HTTP 429 等限流/参数错误会停止，不绕过限额；临时服务错误最多额外尝试一次。

NOAA样本响应未包含完整质量标记和观测时刻，本轮基础检查不代表逐项完成NOAA质量控制或极值纪录认证。

- [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api)
- [Open-Meteo 使用条款](https://open-meteo.com/en/terms)
- [Open-Meteo 数据归属说明](https://open-meteo.com/en/licence)
- [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- [ERA5 官方数据集及许可入口](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview)
- [NOAA NCEI Data Service API 文档](https://www.ncei.noaa.gov/support/access-data-service-api-user-documentation)
- [NOAA GHCN-Daily 官方数据集](https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-daily)

基础质量检查通过只说明本次样本没有发现所检问题，不能单独证明某次高温的成因。再分析和站点产品也可能后续修订；这里保留的是 manifest 所列抓取时刻的响应。
