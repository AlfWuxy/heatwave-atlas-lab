# 许可、来源与第三方声明

本仓库采用分项许可。根目录的 [MIT License](LICENSE) 适用于 Heat Atlas 原创的 `src/`、`scripts/`、`tests/` 代码及项目配置；**不改变第三方软件、数据、地图、论文或报告的许可**。不能把整个仓库的所有内容统一解释为 MIT。

## 内容与数据

| 内容 | 许可与署名 |
| --- | --- |
| 本站原创代码、测试与配置 | MIT；Copyright (c) 2026 AlfWuxy and Heat Atlas contributors。 |
| 本站原创方法说明与解释文字 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，署名“Heat Atlas / 热浪解剖室”；第三方引文、数据和报告仍保留原权利。 |
| Open-Meteo API 气象数据、原始响应及本站整理的数据 | [Open-Meteo 数据许可](https://open-meteo.com/en/licence)所列的 CC BY 4.0；保留 Open-Meteo、Copernicus Climate Change Service / ECMWF ERA5 来源及修改说明。 |
| NOAA NCEI GHCN-Daily 站点样本 | 保留 [NOAA 数据集来源](https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-daily)和原提供方使用说明；本站不另行授予其 MIT 许可。 |
| 世界概览的 Natural Earth 地理数据 | [Natural Earth 公有领域](https://www.naturalearthdata.com/about/terms-of-use/)；`world-atlas` 整理代码本身采用 ISC，其许可证另行保留。 |
| 区域地图的 OpenStreetMap 背景 | © OpenStreetMap contributors，数据适用 [ODbL 与 OSM 版权说明](https://www.openstreetmap.org/copyright)；在线瓦片同时遵守 [OSM 瓦片使用政策](https://operations.osmfoundation.org/policies/tiles/)。瓦片不作为离线资产随本仓库或源码包分发。 |
| `public/images/landscape.png` | 为本项目生成的 AI 通用地形示意，不是历史事件影像或观测资料。在项目方拥有且可许可的权利范围内按 CC BY 4.0 提供，使用时标示“Heat Atlas / 热浪解剖室，AI 生成示意”。 |
| 外部论文、报告、网站和参考仓库 | 原作者或提供方保留权利；本站提供原文链接及简要释义，没有把论文或报告全文重新许可。开源参考与实际安装的软件依赖须分别看待。 |

建议的数据署名：

> Weather data by Open-Meteo.com (CC BY 4.0), based on Copernicus Climate Change Service ERA5 reanalysis (ECMWF). Processed and visualized by Heat Atlas.

本站处理包括格式整理、基准和阈值计算、由风速与风向重建风分量，以及显示时插值。具体修改、原始获取时间、请求 URL、哈希及科学边界见各数据 manifest、[网站数据口径](docs/网站数据口径.md)和[区域风温回放方法](docs/区域风温回放方法.md)。这项署名不代表数据提供方认可本站的分析或结论。

## 软件依赖的许可证全文

[public/third-party-notices.txt](public/third-party-notices.txt) 保留锁文件中全部生产依赖的实际许可证和版权声明，包括 MapLibre 中原有的 Mapbox 部分、Lucide 中的 Feather 声明及双许可包的原文。生产依赖清单可能包括最终被构建工具移除的代码或类型定义；完整保留这组声明不表示它们都会在浏览器执行。

文件由锁定版本对应的已安装 npm 包生成，不从许可证名称猜测版权人或用通用模板替代原文。当前 `murmurhash-js` 没有单独的 LICENSE 文件；其完整 MIT 声明实际位于包内 `README.md` 的 License 段落，生成器保留该段并标明来源。若未来包缺少可取得的许可原文，生成器会停止并报告路径。

在干净 checkout 中复现：

```sh
npm ci
python3 scripts/build_third_party_notices.py
python3 scripts/build_third_party_notices.py --check
```

生成过程不联网；它校验包的已安装版本与 `package-lock.json` 一致，按固定顺序输出包名、版本、锁文件许可标识、npm 原包地址、原许可文件路径和 SHA-256。输出不包含本机绝对路径、账户或时间戳。修改依赖后应重新生成，并将 notices 随网站构建产物和源码包一起分发。
