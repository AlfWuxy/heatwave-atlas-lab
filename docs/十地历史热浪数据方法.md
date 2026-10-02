# 十地历史热浪：事件依据、数据规格与解释边界

目录冻结与来源核对：2026-10-02。机器可读清单位于 `data/extended-cases/catalog.json`。

这里的“十个完整数据模型”指十套具备统一字段、时间轴、区域风温场与来源记录的历史案例包。它们共享 ERA5 再分析资料及本站渲染逻辑，不是十个独立建立、校准和验证的气候预测模型，也不是全球所有热浪的完整样本。

## 事件与窗口

日期范围均包含起止两日，内部以UTC为准，显示可转换当地 IANA 时区。窗口为人工选定的教学回放窗，不能用它的首末日冒充统一统计定义下的热浪边界。事件证据来自各国气象机构、WMO或原始研究者，数值资料另由ERA5提供，二者角色独立。

| id / 地点 | 回放窗 | 天数 | 请求纬度、经度 | 当地时区 | 事件依据 |
|---|---|---:|---|---|---|
| london2022 伦敦 | 2022-07-10—07-25 | 16 | 51.51, -0.13 | Europe/London | [Met Office](https://www.metoffice.gov.uk/about-us/news-and-media/media-centre/weather-and-climate-news/2022/july-heat-review)记录7月18—19日英国极端高温和伦敦地区暖夜。 |
| phoenix2023 凤凰城 | 2023-07-01—07-31 | 31 | 33.45, -112.07 | America/Phoenix | [NOAA NCEI](https://www.ncei.noaa.gov/news/national-climate-202307)记录7月持续高温。窗口不含6月末的前期。 |
| melbourne2009 墨尔本 | 2009-01-20—02-10 | 22 | -37.81, 144.96 | Australia/Melbourne | [BoM季报](https://www.bom.gov.au/climate/current/season/vic/archive/200902.summary.shtml)记录1月末与2月初两轮显著热过程。 |
| tokyo2018 东京 | 2018-07-10—07-31 | 22 | 35.68, 139.76 | Asia/Tokyo | [JMA原报告](https://ds.data.jma.go.jp/tcc/tcc/news/press_20180822.pdf)分析7月中旬后日本热浪。高压/高空机制引用文献，不由本地序列重新证明。 |
| dhaka2023 达卡 | 2023-04-10—04-25 | 16 | 23.81, 90.41 | Asia/Dhaka | [WWA原研究](https://www.worldweatherattribution.org/extreme-humid-heat-in-south-asia-in-april-2023-largely-driven-by-climate-change-detrimental-to-vulnerable-and-disadvantaged-communities/)报告达卡高温并研究南亚湿热；不能把区域热指数当本站单点气温。 |
| karachi2015 卡拉奇 | 2015-06-12—06-30 | 19 | 24.86, 67.01 | Asia/Karachi | [PMD年报](https://ndmc.pmd.gov.pk/report2015.pdf)第8页记录6月严重热浪与19—23日过程。 |
| moscow2010 莫斯科 | 2010-07-20—08-19 | 31 | 55.75, 37.62 | Europe/Moscow | [Otto等原论文](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2011GL050422)记载7月起始、7月末极端与8月19日终止；本站只取后半段。 |
| madrid2022 马德里 | 2022-07-05—07-29 | 25 | 40.42, -3.70 | Europe/Madrid | [AEMET年报](https://www.aemet.es/documentos/es/conocermas/recursos_en_linea/publicaciones_y_estudios/publicaciones/Informes_estado_clima/IECLI_2022_baja_res.pdf)记录7月9—26日热浪及马德里多站高日温/暖夜。 |
| buenosaires2023 布宜诺斯艾利斯 | 2023-03-01—03-22 | 22 | -34.60, -58.38 | America/Argentina/Buenos_Aires | [SMN专报第10号](https://repositorio.smn.gob.ar/bitstream/handle/20.500.12160/2407/0015CL2023.pdf?isAllowed=y&sequence=1)记录3月8—19日过程，首表列Buenos Aires Obs.站。 |
| agadir2023 阿加迪尔 | 2023-08-05—08-20 | 16 | 30.43, -9.60 | Africa/Casablanca | [WMO通报](https://wmo.int/media/news/extreme-weather-new-norm)记录8月11日阿加迪尔高温。不得强行调整再分析值以匹配站点纪录。 |

以上来源均核对相应正文；AEMET文件在web读取器报错后，从其官方URL下载并提取相关段落成功。SMN另一个新闻页访问报错后改用可读的官方专报。检索未使用中文网站。全文图表、附录和分析未逐一复算；“正文可读”不表示已复现研究。

## 统一数据规格

取数产品固定为 ERA5 via Open-Meteo，使用UTC小时、最近原格点、禁用高程降尺度。不用 `best_match` 混合版本。原产品约0.25°，它的分辨率不等于城市场景可分辨到街道。[官方API文档](https://open-meteo.com/en/docs/historical-weather-api)

**单点每小时十个字段：** `temperature_2m`、`relative_humidity_2m`、`pressure_msl`、`cloud_cover`、`shortwave_radiation`、`wind_speed_10m`、`wind_direction_10m`、`soil_moisture_0_to_7cm`、`soil_moisture_7_to_28cm`、`precipitation`。原有回放已有其中九项；本轮补充7—28cm土层。完成情况与缺测数以各案例manifest及验证记录为准。

气温为°C、RH/云量为%、海平面气压hPa、短波W/m²、风速m/s、风向°、两层土壤m³/m³、总降水mm。气压是海平面气压，不是地表气压，不可用于地下压力层遮罩。总降水包括降水水当量，不仅液态雨。

**区域包：** 每例中心附近5×5个原生格点、间隔0.25°，跨度1°×1°。请求2米T、10米风速/来向，转换 `u=-s sin(d)`、`v=-s cos(d)`，角度换弧度；u东向、v北向。区域只含这三种结果，不把城市点位的湿度/土壤/降水复制成整片空间场。沿海格点可以含海面，但土壤示意只能使用核查后的陆地点位。

**本次实际数据规模（2026-10-02）：** 十窗合计220天；5280单点小时、52800个单点字段数值；250个空间点位分布于十案例，132000格点小时、396000个T/u/v数值。以上不计先导请求；10例均已下载并构建，30份原始API响应留档，小时字段无缺测，25格坐标逐例准确返回。唯一物理范围质量标记为下节记录的凤凰城11个浅层土壤小负值。22项扩展数据测试通过，逐值核对点位、风分量、CSV、时轴、哈希以及陈旧目录拒绝。

## 质量标记与原始值

凤凰城的正式代表格点响应中，0—7cm土壤体积含水率有11小时为−0.001 m³/m³，超出物理下限。本项目保留原始字节及数值，不截断、不补零、不换点隐藏；`qualityStatus: flagged`、`qualityWarnings`及逐小时的时间/索引/原值记录一起公开，回放曲线和目录显示质量提示。它们不是可解释的真实负含水量；目前没有证据将其归因于某个具体处理环节。

管线接受最低至−0.005的土壤值以便保存并标记小负值；这只是本次工程审核边界，不是物理有效区间。所有负值都标记，更低数值仍停止构建。无缺测、哈希匹配、数值与来源相等，和物理合理性是不同检查。其他地点如果出现异常，同样保留在各自清单，不能以“构建通过”表示没有问题。

下载时的catalog哈希保留原值；构建另外写入`builtCatalogSha256`和`caseSpecification`快照。生成器要求当前目录的日期、变量与格点完全匹配原始请求，防止旧数据被贴上修改后的窗口标签。

## 下载和发布约定

- 先取短窗验证单位、字段、时间顺序与返格点，再取正式窗口；保留原始字节、精确请求、获取UTC、SHA-256及缺测报告。
- [免费服务条款](https://open-meteo.com/en/terms)限非商业使用。[计量说明](https://open-meteo.com/en/pricing)确认超过两周、多变量、多点可能计成多次调用。不能把一个多点HTTP请求当作一条配额；分批限速、429立即停止、不绕过限制。
- 本次建议每批少量坐标并至少间隔8秒，缓存复用。没有必要因这250点样本安装全球环境或修改网络。
- 公开资料必须保留Open-Meteo及Copernicus来源、CC BY 4.0链接和处理说明。[数据许可](https://open-meteo.com/en/licence)。事件原报告只提供链接和简要转述，数据许可不自动覆盖报告中的第三方图片。
- 本文与catalog锁定研究范围；下载完成状态由实际manifest、验证报告和发布检查确认，不在取数前宣称成功。

## 交互解释边界

1. 案例回放按真实时间步播放，风粒子是流场可视化示踪，不是经验证的空气团历史轨迹。
2. 土壤含水率可切换两层，但不是饱和百分比、干旱等级或完整根区水量。
3. 短波是时间戳结束的前一小时平均；降水为前一小时累计。若没有次日00时，不能拼出前一日完整UTC日积分。时间动画插值不增加实际资料频率。
4. 统一色标有助比较绝对温度；没有各地点一致的历史基准，就不展示“全球谁异常更严重”的排名。不同季节/纬度/地形的原值不是直接可比的异常强度。
5. 场景太阳、雨滴与土层填色可受点位数据驱动，但必须标为示意，不声称重新模拟热量形成。缺少真实H/LE、净长波和高空场时，不生成冒充观测的能量箭头或垂直轨迹。
6. 本包不构成官方预警、健康阈值、街区微气候评估或反事实干预效果。科普问题可以聚焦“哪些变量同时变化”“夜间是否持续偏热”“不同测量/时间窗口有什么区别”。
