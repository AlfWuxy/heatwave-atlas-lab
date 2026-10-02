# 三十地扩展：事件依据、数据规格与解释边界

方法编写日期：2026-10-02。最终取数清单位于 `data/expansion-30/catalog.json`；三份区域研究目录保留在同一目录，用于追溯筛选过程。事件材料来自非中文官方气象/公共机构、原始研究，以及一个热行动计划参与机构的原始工作记录；证据类别和用途逐项区分。

本轮在原有13个回放地点之外再增加30个地点，现共43个城市附近的历史回放案例。所谓“完整数据模型”指字段、时间轴、局地风温格网及来源记录齐全的案例包；它们共享ERA5再分析与渲染代码，不是43个独立建立和验证的天气模型，也不是全球热浪普查。原有六个城市的2006—2025年温度背景序列属于另一项资料，不会因增加事件窗口而自动扩展到43地。

## 事件、窗口与地点

所有日期包含起止两日，从起日00:00 UTC到末日23:00 UTC，界面可转换为IANA当地时区。日期为人工教学观察窗，通常包含报告所述热事件前后；窗内每一天都不能被称为达到统一热浪阈值。某些窗口包含多次相邻过程，或仅截取长时间湿热的一段，以下逐地注明。

城市坐标是选点位置；管线以最近0.25°格点为中心构造局地网格。请求城市位置、实际请求网格和API返还网格分别记录，不能将它们视为同一个站点。事件报告只提供事件背景，报告中的站点极值不会混入或替换ERA5数值。

<!-- CASE_TABLE_START -->
冻结目录核对日期：2026-10-02。SHA-256：`6f4c93a930f15a6635a50cae5170bbb3f3bee4f3b272f4e84d1e1ac580cbd3fd`。

| id / 地点（国家） | UTC观察窗 | 小时 | 城市纬度、经度 | IANA时区 | 来源与核验依据 | 解释边界 |
|---|---|---:|---|---|---|---|
| seattle2021 / 西雅图（美国） | 2021-06-20—2021-07-05 | 384 | 47.61, -122.33 | America/Los_Angeles | [NOAA PMEL / Atmosphere, Overland (2021)](https://repository.library.noaa.gov/view/noaa/40148)：论文摘要明确记载2021年6月底太平洋西北地区热浪及西雅图极端高温，并讨论大尺度阻塞、下沉增温与太阳辐射；此处不复现归因。 | 人工UTC观察窗，不是统一算法识别的事件边界；再分析格点不等于机场观测。与温哥华及原有波特兰案例属于同一大尺度热浪，不能作为相互独立的事件样本。 |
| vancouver2021 / 温哥华（加拿大） | 2021-06-20—2021-07-05 | 384 | 49.28, -123.12 | America/Vancouver | [Environment and Climate Change Canada](https://www.canada.ca/en/environment-climate-change/services/top-ten-weather-stories/2021.html)：Record heat under the dome段说明6月底高压脊持续；Second heat wave段单独记载温哥华6月底连续高温及6月29日站点纪录。未采用该页伤亡表述。 | 人工UTC观察窗，非统一阈值事件边界；城市附近格点并非机场站点实测。与西雅图及原有波特兰属于同一大尺度热浪。 |
| lasvegas2024 / 拉斯维加斯（美国） | 2024-07-01—2024-07-16 | 384 | 36.17, -115.14 | America/Los_Angeles | [NOAA National Centers for Environmental Information](https://www.ncei.noaa.gov/news/national-climate-202407)：Other Notable Events明确称7月初美国西部热浪，并列出拉斯维加斯7月7日站点高温纪录。既有事件描述，也有具体城市日期。 | 人工UTC观察窗，只覆盖7月初一段过程，不代表整个夏季或7月全部热事件；ERA5网格高温不应被校准成站点纪录。 |
| sacramento2022 / 萨克拉门托（美国） | 2022-08-28—2022-09-12 | 384 | 38.58, -121.49 | America/Los_Angeles | [NOAA National Weather Service San Diego](https://www.weather.gov/media/sgx/climate/Yearly/2022.pdf)：September章节描述8月底至9月上旬加州长时间热浪，并在文字和极值表中列出萨克拉门托9月6日纪录；南加州Kay降温叙述不直接移植为本市因果。 | 人工UTC观察窗，非统一阈值事件边界；再分析格点不等于城市观测站，附近小格网不覆盖整场美国西部热浪。 |
| chicago2023 / 芝加哥（美国） | 2023-08-16—2023-08-31 | 384 | 41.88, -87.63 | America/Chicago | [NOAA National Weather Service Chicago](https://www.weather.gov/lot/2023_08_23-24_Heat)：Overview区分8月20日短暂湿热与23—24日主高峰，明确芝加哥O’Hare观测。报告提醒部分热指数极值来自小时内观测，不能与旧逐小时纪录直接同等比较。 | 人工UTC观察窗覆盖主高峰及相邻过程；热浪称谓采用NWS事件报告，并非本站统一连续天数算法。市中心附近格点与O’Hare机场位置不同。 |
| miami2023 / 迈阿密（美国） | 2023-07-09—2023-07-24 | 384 | 25.76, -80.19 | America/New_York | [NOAA National Weather Service Miami](https://www.weather.gov/media/mfl/news/2023Summary.pdf)：2023 Temperatures段描述夏季持续高温与高露点、迈阿密地区7月12日观测及国际机场7月23日年内最高温；本文取其中7月片段，不以全年排名单独定义热浪。<br>[Miami-Dade County](https://www.miamidade.gov/global/release.page?Mduid_release=rel1689973055328322)：7月21日公告记录当时持续酷热及周末可能的高温警报情境，补足具体时段；不把公告中的预期警报当成已验证的警报发布记录。 | 人工UTC窗口截取持续湿热季的一段，非独立算法定义的完整热浪边界；沿海格网可能含海陆差异，不代表建筑室内或人体暴露。 |
| mexicocity2024 / 墨西哥城（墨西哥） | 2024-05-01—2024-05-16 | 384 | 19.43, -99.13 | America/Mexico_City | [World Meteorological Organization](https://public.wmo.int/media/news/global-temperature-record-streak-continues-climate-change-makes-heatwaves-more-extreme)：2024年5月15日文章的Extreme heat章节描述墨西哥5月热浪，并明确Tacubaya/Mexico City站5月9日观测；全国其他城市温度没有当成墨西哥城温度。 | 人工UTC观察窗，非统一阈值热浪边界；覆盖5月前半段，不涵盖当月全部热浪。城市附近再分析格点不是Tacubaya站点观测。 |
| riodejaneiro2023 / 里约热内卢（巴西） | 2023-11-08—2023-11-23 | 384 | -22.91, -43.17 | America/Sao_Paulo | [Universidade Federal do Rio de Janeiro / Anuário do Instituto de Geociências](https://revistas.ufrj.br/index.php/aigeo/article/view/66182)：原始研究摘要明确研究2023年11月17—18日里约高温，指出高峰位于持续八天热浪末段及锋前形势；只采用事件时序背景，不复制其归因或健康结论。 | 人工UTC观察窗，非本站统一热浪检测；原文站点、热指数和现场情境与ERA5网格值分开使用，不把城市平均场当成活动现场实测。 |
| santiago2017 / 圣地亚哥（智利） | 2017-01-19—2017-02-03 | 384 | -33.45, -70.67 | America/Santiago | [Dirección Meteorológica de Chile](https://climatologia.meteochile.gob.cl/application/historico/olaDeCalorEstacion/330020)：官方Quinta Normal日间热浪表列出2017年1月24—27日事件，峰值日期25日；另列17—21日及29—31日过程，因此观察窗包含相邻热浪，不能全部连称一个连续事件。 | 人工UTC观察窗围绕1月24—27日事件，并覆盖前一轮后段与下一轮；采用官方日间热浪记录，未与其他城市统一阈值。再分析格点不等于Quinta Normal站点。 |
| montevideo2022 / 蒙得维的亚（乌拉圭） | 2022-01-04—2022-01-19 | 384 | -34.9, -56.16 | America/Montevideo | [Instituto Uruguayo de Meteorología (INUMET)](https://www.inumet.gub.uy/sites/default/files/2022-01/POSEVENTO_OLA%20DE%20CALOR_12al16ene.pdf)：PDF第2页说明1月12—16日暖干气团在阻塞背景下持续，列出Prado与Carrasco观测；第3页保留这些站点的持续性分析。未据截图推断站点图标等级；报告注明数值为初步资料。 | 人工UTC观察窗，非统一阈值事件边界；官方初步站点资料只用于事件背景，不混入ERA5序列。未覆盖1月20日开始的后一轮过程。 |
| athens2023 / 雅典（希腊） | 2023-07-10—2023-07-29 | 480 | 37.98, 23.73 | Europe/Athens | [National Observatory of Athens / Meteo.gr](https://w2.meteo.gr/article_view.cfm?entryID=2857)：2023年7月28日复盘正文与图注确认全国热浪为7月12—26日，分12—15、18—23、23—26日三阶段。来源是全国站网回顾，不把全国最高值当作雅典实测。 | 人工选定的UTC完整日观察窗，非统一阈值识别的热浪起止；城市附近格点再分析不等于站点实测极值，也不代表整场热浪全域。 |
| rome2023 / 罗马（意大利） | 2023-07-10—2023-07-29 | 480 | 41.9, 12.5 | Europe/Rome | [ISPRA / DEP Lazio / Italian Ministry of Health](https://indicatoriambientali.isprambiente.it/en/climate/heatwaves-and-mortality)：State assessment明确7月10—25日的中南部热浪；Figure 3b列罗马的日最大体感温度过程。该报告热浪定义为HHWW风险2/3级连续至少3日，与本回放窗定义不同。 | 人工选定的UTC完整日观察窗，非统一阈值识别的热浪起止；城市附近格点再分析不等于站点实测极值，也不代表整场热浪全域。 |
| lisbon2018 / 里斯本（葡萄牙） | 2018-07-28—2018-08-12 | 384 | 38.72, -9.14 | Europe/Lisbon | [IPMA](https://www.ipma.pt/resources.www/docs/im.publicacoes/edicoes.online/20180924/QyzZvZwgxxBnLFiHkSkX/cli_20180801_20180831_pcl_mm_co_pt.pdf)：PDF页2摘要与页3天气形势确认8月1—6日高温过程；页9正文点名Lisboa/G.C.、Lisboa/Tapada和Lisboa/Geofísico的连续极端高温，并说明严格热浪范围排除部分沿海。 | 人工选定的UTC完整日观察窗，非统一阈值识别的热浪起止；城市附近格点再分析不等于站点实测极值，也不代表整场热浪全域。里斯本称为区域热浪中的高温过程，不宣称满足IPMA的每一项站点热浪判据。 |
| seville2022 / 塞维利亚（西班牙） | 2022-07-07—2022-07-26 | 480 | 37.39, -5.98 | Europe/Madrid | [AEMET](https://aemetblog.es/2022/08/11/avance-climatico-nacional-de-julio-de-2022/)：温度章节明确7月热浪，并点名Sevilla/aeropuerto在7月13日的最高温；正文也描述反气旋和暖空气输送。此为AEMET官方博客的一手月度复盘。 | 人工选定的UTC完整日观察窗，非统一阈值识别的热浪起止；城市附近格点再分析不等于站点实测极值，也不代表整场热浪全域。观察窗可能截取长事件的一部分。 |
| berlin2019 / 柏林（德国） | 2019-06-22—2019-07-07 | 384 | 52.52, 13.41 | Europe/Berlin | [Deutscher Wetterdienst](https://www.dwd.de/DE/leistungen/besondereereignisse/temperatur/20190703_bericht_juni2019.pdf?__blob=publicationFile&v=2)：2019-07-03报告第1—2页描述6月最后十天的高温及Berlin/Brandenburg背景；第6页Table 1列Berlin-Tegel、Berlin-Schönefeld在6月30日的观测。未引用后来修订的Lingen七月纪录。 | 人工选定的UTC完整日观察窗，非统一阈值识别的热浪起止；城市附近格点再分析不等于站点实测极值，也不代表整场热浪全域。 |
| amsterdam2019 / 阿姆斯特丹（荷兰） | 2019-07-18—2019-08-02 | 384 | 52.37, 4.9 | Europe/Amsterdam | [KNMI](https://cdn.knmi.nl/knmi/map/page/klimatologie/gegevens/mow/mow_201907.pdf)：PDF第2页描述7月22日起增暖、24—26日极热及27—28日缓解；第9页Schiphol行将月最高温日期列为26日。全国热浪判据取De Bilt，不能移作阿姆斯特丹自己的事件边界。 | 人工选定的UTC完整日观察窗，非统一阈值识别的热浪起止；城市附近格点再分析不等于站点实测极值，也不代表整场热浪全域。 |
| zurich2015 / 苏黎世（瑞士） | 2015-06-26—2015-07-11 | 384 | 47.38, 8.54 | Europe/Zurich | [MeteoSwiss](https://www.meteoschweiz.admin.ch/dam/jcr%3A9200bd1a-2f3e-411c-bae9-22d4fd98a882/hitzesommer_2015_v5_final_CD.pdf)：报告印刷页9明确第一轮为7月1—7日，Figure 4含Zürich-Kloten；Table 1也列该站7月1—7日预警评估。 | 人工选定的UTC完整日观察窗，非统一阈值识别的热浪起止；城市附近格点再分析不等于站点实测极值，也不代表整场热浪全域。 |
| stockholm2018 / 斯德哥尔摩（瑞典） | 2018-07-10—2018-07-29 | 480 | 59.33, 18.07 | Europe/Stockholm | [SMHI](https://www.smhi.se/klimat/klimatet-da-och-nu/manadens-vader-och-vatten-i-sverige/manadens-vader-och-vatten-i-sverige/2018-07-31-juli-2018---langvarig-hetta-och-svara-skogsbrander)：逐段天气回顾明确7月14—15日Stockholm高温、18日Stockholm群岛Skarpö暖夜，以及25—27日再增强；未把森林火灾归因为本地格网变量。 | 人工选定的UTC完整日观察窗，非统一阈值识别的热浪起止；城市附近格点再分析不等于站点实测极值，也不代表整场热浪全域。这是2018年漫长炎热夏季的片段，不覆盖整个持续期。 |
| helsinki2018 / 赫尔辛基（芬兰） | 2018-07-18—2018-08-02 | 384 | 60.17, 24.94 | Europe/Helsinki | [Finnish Meteorological Institute](https://www.ilmatieteenlaitos.fi/helletilastot)：连续热期表2018行明确12.7.—5.8.共25天，列Vantaa Helsinki-Vantaan lentoasema、Helsinki Kumpula、Porvoo Harabacka；这是城市站点事件证据，不仅是全年纪录。 | 人工选定的UTC完整日观察窗，非统一阈值识别的热浪起止；城市附近格点再分析不等于站点实测极值，也不代表整场热浪全域。窗口位于7月12日—8月5日官方连续热期内部，未覆盖其起止和全部前后背景。 |
| bucharest2024 / 布加勒斯特（罗马尼亚） | 2024-07-07—2024-07-22 | 384 | 44.43, 26.1 | Europe/Bucharest | [Administrația Națională de Meteorologie](https://www.meteoromania.ro/clim/caracterizare-lunara/cc_2024_07.html)：月温章节及Figure 4—5点名București-Filaret；Table 1显示多数强热日期为7月15—17日；后文明确使用val de căldură并讨论罗马尼亚平原热日和暖夜。窗口为月中全国热阶段，不是官方布加勒斯特起止判定。 | 人工选定的UTC完整日观察窗，非统一阈值识别的热浪起止；城市附近格点再分析不等于站点实测极值，也不代表整场热浪全域。该窗口依据报告中的月中热阶段人工选定，未获得统一算法下的城市热浪边界。 |
| bangkok2024 / 曼谷（泰国） | 2024-04-18—2024-05-03 | 384 | 13.75, 100.5 | Asia/Bangkok | [Thai Meteorological Department](https://www.tmd.go.th/media/climate/climate-monthly/april_2024_rev1-0.pdf)：第1–2页描述4月反复高温且月底特别炎热；第6页列曼谷市区4月21日与廊曼4月30日站点纪录，第9页有曼谷站点月均温与降水。原文第2页小标题误写21–31 April，本目录未沿用错误日期。 | 人工UTC观察窗，非统一阈值识别。曼谷格点不等于廊曼、港口或市区站点；站点纪录只作事件证据，不作为再分析必须重现的值。该标题保留高温观察窗口径。 |
| singapore2023 / 新加坡（新加坡） | 2023-05-05—2023-05-20 | 384 | 1.35, 103.82 | Asia/Singapore | [Meteorological Service Singapore](https://www.weather.gov.sg/wp-content/uploads/2024/04/ACAR_2023.pdf)：印刷页10描述5月上半月多日高温，第二周微风、少云条件和5月13日多个站点的极值；页10–11还讨论暖海温与MJO背景。并非只用单日纪录认定热浪。 | 人工UTC观察窗；本目录未依当地热浪阈值重新判定连续天数，故保留持续高温观察窗标题。海陆混合格点可能平滑城市站点极值，5×5格网也会覆盖周边海域和邻国。 |
| manila2024 / 马尼拉（菲律宾） | 2024-04-15—2024-05-02 | 432 | 14.6, 120.98 | Asia/Manila | [World Weather Attribution](https://www.worldweatherattribution.org/climate-change-made-the-deadly-heatwaves-that-hit-millions-of-highly-vulnerable-people-across-asia-more-frequent-and-extreme/)：正文与图1将菲律宾研究事件定义为2024年4月15–29日区域平均日最高温的15日过程；该研究不是马尼拉单站阈值判定。<br>[DOST-PAGASA](https://www.pagasa.dost.gov.ph/press-release/155)：2024年4月12日声明区分气温与热指数，说明既有热预警系统及面向学校等部门的决策局限；不提供马尼拉站点极值。 | 人工UTC窗覆盖研究的区域热过程及随后数日；区域热浪背景下的城市观察窗，不宣称马尼拉单站已按同一阈值确认热浪。原始来源未核验马尼拉单站逐日极值，不能在网页补写该类纪录。 |
| seoul2018 / 首尔（韩国） | 2018-07-24—2018-08-08 | 384 | 37.57, 126.98 | Asia/Seoul | [Korea Meteorological Administration — Metropolitan Office](https://testweather.kma.go.kr/metropolitan/html/news/notice_view.jsp?articleno=9785&boardId=press2&pageNo=34)：2018年8月1日通报正文指出首都圈热浪警报正在生效、首尔当日极端高温及热浪持续；解释高空高压、强日照和东风地形效应，并提及夜间难以降温。 | 人工UTC观察窗，只截取长热过程的一段；城市周边再分析格点不等于首尔官方观测站，也不能解析街区城市热岛。 |
| ahmedabad2016 / 艾哈迈达巴德（印度） | 2016-05-12—2016-05-27 | 384 | 23.03, 72.58 | Asia/Kolkata | [Natural Resources Defense Council — Ahmedabad Heat Action Plan partner](https://www.nrdc.org/bio/anjali-jaiswal/tale-three-cities-heat-action-plans-across-india)：2016年5月23日文章的 Ahmedabad Highlights 记述当月连续三日极端高温红色警报及现场宣传；开头给出城市高温背景。这里仅采用参与方对警报行动的直接记述，不把其转引媒体的极值当作独立站点数据，也不采纳文中健康行为建议。 | 人工UTC观察窗，来源对警报持续的记述不等于统一算法识别的站点热浪起止。尚未取得该事件单站逐小时观测，站点纪录与健康成效均不作为本数据包的已验证结论。 |
| jacobabad2018 / 雅各布阿巴德（巴基斯坦） | 2018-04-22—2018-05-07 | 384 | 28.28, 68.44 | Asia/Karachi | [World Meteorological Organization](https://public.wmo.int/media/news/april-high-co2-low-sea-ice-and-extreme-weather)：Pakistan heatwave 小节：引述PMD说明持续热背景、4月中旬再次出现异常热过程并于29–30日在信德达到峰值；同段明确列出Jacobabad在4月30日的站点高温。WMO同时声明其极端纪录档案不验证月纪录。 | 人工UTC窗围绕4月29–30日区域高峰，不覆盖从3月开始的全部前期过程。站点极值不要求ERA5格点重现；本项目不验证或新增世界、国家、月度纪录。 |
| perth2024 / 珀斯（澳大利亚） | 2024-02-11—2024-02-26 | 384 | -31.95, 115.86 | Australia/Perth | [Australian Bureau of Meteorology](https://www.bom.gov.au/climate/current/month/wa/archive/202402.perth.shtml)：Temperature 段明确珀斯及周边2月17–21日达到 severe intensity 热浪；Perth Metro段与逐日表给出18日最高温和19日暖夜，24–26日出现降雨。 | 人工UTC观察窗围绕2月17–21日过程；官方BoM严重程度分类仅用于事件说明，本站未重算该等级。区域含近海格点，不等于陆地城市站点网。 |
| adelaide2019 / 阿德莱德（澳大利亚） | 2019-01-17—2019-02-01 | 384 | -34.93, 138.6 | Australia/Adelaide | [Australian Bureau of Meteorology](https://www.bom.gov.au/climate/current/month/sa/archive/201901.adelaide.shtml)：月报描述一月高温少雨、24日各站极端高温和暖夜，明确将当时过程连接到 Widespread heatwaves during December 2018 and January 2019 专项报告。 | 人工UTC窗只取12月至1月更广泛热浪中的城市片段；BoM每日站点统计采用其观测日规则，不能与UTC格点小时极值直接视为同口径。 |
| bamako2024 / 巴马科（马里） | 2024-03-25—2024-04-09 | 384 | 12.65, -8.0 | Africa/Bamako | [World Weather Attribution](https://www.worldweatherattribution.org/extreme-sahel-heatwave-that-hit-highly-vulnerable-population-at-the-end-of-ramadan-would-not-have-occurred-without-climate-change/)：正文定义3月底4月初事件；图1给马里南部/布基纳法索3月31日至4月4日五日窗，并明确讨论Bamako和暖夜。本站不采用网页转引的医院死亡数量作为可归因热死亡。 | 人工UTC窗，城市格点不是原研究的国家区域平均；研究的气候归因结论不能直接转化为本城市格点的归因系数。与瓦加杜古同属一次区域事件，不是独立气候样本。 |
| ouagadougou2024 / 瓦加杜古（布基纳法索） | 2024-03-25—2024-04-09 | 384 | 12.37, -1.52 | Africa/Ouagadougou | [World Weather Attribution](https://www.worldweatherattribution.org/extreme-sahel-heatwave-that-hit-highly-vulnerable-population-at-the-end-of-ramadan-would-not-have-occurred-without-climate-change/)：图1明确马里南部/布基纳法索3月31日至4月4日五日过程，正文讨论布基纳法索的暖夜；Main Findings点名Ouagadougou城市背景。此来源支持区域事件，未提供该城市逐小时单站序列。 | 人工UTC城市观察窗，源研究为区域热浪分析，未确认本城市单站统一阈值起止。与巴马科并非独立事件；不能将城市数量当作相互独立热浪的样本量。 |

冻结窗口计划合计 **11,952单点小时**，对应119,520个单点字段数值和298,800格点小时（896,400个区域T/u/v数值）；实际取得结果与计划一致，详见下方完成记录。

**证据类别特例：** 艾哈迈达巴德使用NRDC热行动计划参与者2016年5月23日的原始项目记录，只支持当时高温、警报与现场行动情境；它不是官方气象观测报告或独立效果研究。文中转引极值、干预成效与健康行为建议不作为本数据包已核验结论。其他案例也须依目录区分站点实测、区域事件研究、预期警报及事后复盘。

**访问与核验限制：** 目录逐来源保留 `accessMethod` 与 `evidenceNote`。部分PDF在网页读取器失败后由官方下载并提取相关文字；这不等于逐页图像审查。INUMET报告文字可读，截图接口返回验证页，未依未见图标判定Prado或Carrasco的热浪等级。马尼拉、瓦加杜古等案例采用区域事件背景，未取得该城市按统一阈值的单站热浪边界。
<!-- CASE_TABLE_END -->

## 案例间的关系

43是地点案例数，不是43场统计独立的热浪。例如西雅图、温哥华和原有波特兰都受到2021年6月底同一大尺度热浪影响；多个欧洲城市也可能来自同一区域事件，巴马科和瓦加杜古也同属2024年萨赫勒区域热浪。跨城市比较可以展示空间差异，不能把同一环流下的不同城市当作独立重复实验，或用地点个数作为因果研究的有效样本量。

官方热浪定义也有差别：有的使用日间最高温，有的同时检查最低温及持续天数，有的报告描述湿热或高温警报情境。本站未将这些定义重新统一计算。不同季节、纬度、海拔的绝对温度适合描述当时状态；没有统一历史基准与检测规则，就不进行“哪一地异常最严重”的排名。

## 统一数据规格

数值通过Open-Meteo历史API取得，固定 `models=era5`、`timezone=UTC`、`cell_selection=nearest`、`elevation=nan` 和 `wind_speed_unit=ms`。不使用自动混合资料的 `best_match`，不做海拔降尺度；选择0.25°、逐小时的ERA5产品。API是第三方数据获取接口，原始再分析生产方为ECMWF/Copernicus。[历史API文档](https://open-meteo.com/en/docs/historical-weather-api)

| 单点变量 | API字段 | 单位与含义 |
|---|---|---|
| 2米气温 | `temperature_2m` | °C |
| 2米相对湿度 | `relative_humidity_2m` | % |
| 海平面气压 | `pressure_msl` | hPa；不是地表气压 |
| 总云量 | `cloud_cover` | % |
| 向下短波辐射 | `shortwave_radiation` | W/m²；时间戳前一小时平均，不是净辐射 |
| 10米风速 | `wind_speed_10m` | m/s |
| 10米风向 | `wind_direction_10m` | °；气象学来向 |
| 0—7厘米土壤含水量 | `soil_moisture_0_to_7cm` | m³/m³；体积含水率 |
| 7—28厘米土壤含水量 | `soil_moisture_7_to_28cm` | m³/m³；体积含水率 |
| 总降水 | `precipitation` | mm；前一小时累计的水当量 |

每地单点提供十个字段；区域另取5×5个互异原生格点，间隔0.25°、坐标跨度1°×1°。区域仅提供2米气温及10米水平风场，不将中心点的湿度、土壤或降水复制成整片空间资料。纬向经度距离会随纬度变化，因此1°跨度不代表每地相同面积。网格分辨率也不足以解释街道、建筑遮阴和室内热环境。

风分量转换为 `u = -s × sin(d)`、`v = -s × cos(d)`，其中d由角度转弧度，u向东、v向北为正。零风速时风向不用于推断可靠输送方向。风粒子是所选流场的可视化示踪，显示速度可经视觉缩放，不是已验证的历史空气团轨迹或输热通量。

## 数据规模与完成状态

<!-- ACTUAL_DATA_STATUS_START -->
**2026-10-02实际完成：30/30地点。** 正式序列包含11,952单点小时、119,520个单点字段数值；750个空间点位分布于30案例，合计298,800格点小时、896,400个区域T/u/v数值。90份原始API响应（每地小样、点位、区域各一份）全部保留；小样另有1,440格点小时，不重复计入正式序列。

逐字段缺测为0，本轮物理范围质量标记为0。原始响应共10,950,333字节，正式派生点位JSON/CSV与区域JSON共11,559,106字节；逐文件SHA-256、连续UTC时轴、单位、25个互异原格点、代表点与区域中心温风均已核对。`validation.json`记录具体UTC验证时刻；[公开完整性报告](https://heatwave-atlas-lab.yilaoweather.org/data/expansion-validation.json)与数据目录中的报告内容相同。上述完整性通过不证明再分析与实测完全一致，也不构成热量收支或成因归因模型验证。

获取期间迈阿密小样发生一次TLS连接超时；原接口同参数恢复后成功，失败记录保留在清单。无HTTP 429，未更换接口、身份或并行绕过限制。原有凤凰城11个浅层土壤负值标记仍保留，不计入本轮30地的0标记。
<!-- ACTUAL_DATA_STATUS_END -->

## 获取、冻结与可复核记录

1. 先冻结完整30例目录，再串行取数。每地先用两格点的一日小样核对字段、单位、UTC轴和坐标，再取代表格点十变量与正式25格区域风温资料。
2. 每次响应结束后至少间隔10秒才发起下一次请求；同一下载器串行执行。收到HTTP 429立即停止，其他失败也保留不完整状态，不自动换地址、换身份或并行绕过限制。再次取数应先核实限制与原因。
3. 每份响应保留原始字节、精确URL、UTC获取时刻、HTTP状态、字节数、SHA-256、请求/返回坐标及校验结果。缓存仅在URL与SHA-256均相符时复用。多地点、较长时间窗或多变量会影响API调用计量，一个HTTP请求不一定只算一次配额。[计量说明](https://open-meteo.com/en/pricing)
4. 冻结目录的SHA-256写入manifest。日期、地点或目录内容改变后，旧响应不能静默套用新标签；生成器检查请求规格、`caseSpecification`和`builtCatalogSha256`。目录与数据不匹配即停止。
5. 每个时间轴必须连续、严格逐小时、为UTC并覆盖完整窗口；数值数组长度一致、单位正确、数值有限。25个返回坐标必须唯一且与请求一致；缺测或失败不能通过填零、插补或重复坐标伪装成完整格网。
6. 构建输出点位JSON/CSV、区域JSON、区域manifest和案例索引；原始资料与逐例manifest仍保留。索引完整状态只在冻结30例均通过后成立，不能用总文件数替代逐例校验。

复跑入口为 `scripts/fetch_expansion_cases.py` 与 `scripts/build_expansion_cases.py`。取数指令需使用冻结目录和现有缓存，避免无意义的重复请求；构建步骤只加工已有原始响应。

```bash
python3 scripts/fetch_expansion_cases.py --case all --interval 10
python3 scripts/build_expansion_cases.py
```

以上是复跑方法，不是执行成功的声明。实际结果应以对应manifest、验证报告及本文件“数据规模与完成状态”更新为准。

## 原值、缺测和质量标记

原始值不因希望画面平滑而更改。土壤体积含水率的物理下界为0；若出现小负值，保留原始字节、时间、索引和值，并输出 `qualityStatus: flagged` 与 `qualityWarnings`，在公开回放中提示。不得截断、补零或换格点来隐藏异常，也不能把负含水率解释为真实土壤状态。

现有管线为保存可审查的小负值，允许土壤字段最低到−0.005 m³/m³，并标记所有小于0的值；这是工程审核界限，不是新的物理有效区间。更低数值、其他超范围值、缺测、非有限值或坐标不符会停止。上一批凤凰城出现过浅层土壤小负值，但不能据此预先假设本批异常种类或数量，也没有证据将这种异常归因于特定处理环节。

SHA-256匹配表示保存字节一致；逐值相等表示加工忠实；无缺测表示序列齐全。这些检查均不等同于观测真值、物理完全正确或机制归因已被证实。部分官方事件报告也可能标为初步资料，其地位须按事件来源说明保留。

## 交互、统计和机制边界

- A/B比较必须保持相同地点、相同变量定义与色标，并显示两个实际UTC时刻。差值是两个时刻或点位的资料差，不是某项机制的因果贡献。
- “夜间”是界面定义的当地18:00—次日05:59观察段，统计其中12个连续原始小时采样；整小时时区对应18:00—05:00，印度和阿德莱德等半小时时区对应18:30—05:30，不插值到当地整点。降幅另要求12小时后的晨间端点，标签按实际时刻显示18:00→06:00或18:30→06:30。夏令时造成重复或缺失小时的夜段不强算完整夜间。它不是逐地太阳落山至日出的天文夜长。
- 短波为上一小时平均，总降水为上一小时累计；窗口首小时可能包含窗口之前的量。若无次日00时，不能得到前一日完整UTC日积分。动画插值或播放加速不会增加数据频率。
- 土壤含水率不是饱和百分比、土壤干旱等级或完整根区水量；两层曲线可用于观察时序，不能据此确定蒸散或感热通量。沿海网格还需注意海陆混合与代表性。
- 气温、湿度与风的同步变化提供待解释线索。缺少高空垂直场、净长波、感热和潜热通量时，不能声称已完成能量收支闭合、高压动力诊断、输热来源追踪或土壤贡献定量归因。
- 数据驱动的太阳、雨滴、土层填色和粒子是教学示意；人体热感、热指数、湿球温度和气温不是同一个量。本站不据回放直接发布健康阈值、个人风险或官方预警。

## 许可与公开材料

公开数据保留Open-Meteo、ECMWF/Copernicus署名、处理说明和CC BY 4.0链接。[数据许可](https://open-meteo.com/en/licence) 免费API服务另有非商业使用与调用限制，资料许可不替代服务条款。[服务条款](https://open-meteo.com/en/terms)

事件报告仅保留链接与本项目简要转述，不将报告全文、PDF图表或第三方照片转载进公开仓库；取数API许可也不会自动授权转载这些材料。来源正文已核对不代表已复现全部论文、图表和附录。
