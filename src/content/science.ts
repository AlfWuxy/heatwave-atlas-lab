// 科普文案与证据索引：日期为核验日期，来源阅读范围见 scope。
export type SourceKind = 'official' | 'paper' | 'dataset';

export interface ScienceSource {
  id: string;
  title: string;
  organisation: string;
  url: string;
  kind: SourceKind;
  checkedAt: string;
  scope: string;
  limitation: string;
}

export interface Mechanism {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  steps: string[];
  caution: string;
  sourceIds: string[];
}

export interface GlobalEvent {
  id: string;
  name: string;
  region: string;
  year: number;
  period: string;
  // 仅为地图导航代表点，经度在前；不是事件边界、质心或精确观测站坐标。
  coordinates: [number, number];
  summary: string;
  mechanismIds: string[];
  sourceIds: string[];
  dataCaseId?: 'portland2021' | 'paris2019' | 'chongqing2022';
}

export interface TeachingModel {
  id: string;
  title: string;
  formula: string;
  summary: string;
  assumptions: string[];
  output: string;
  caution: string;
  sourceIds: string[];
}

export const sources: ScienceSource[] = [
  {
    id: 'c3s-heatwaves',
    title: 'Heatwaves — a brief introduction',
    organisation: 'Copernicus Climate Change Service / ECMWF',
    url: 'https://climate.copernicus.eu/heatwaves-brief-introduction',
    kind: 'official', checkedAt: '2026-09-27',
    scope: '核对热浪定义、持续高压、下沉、暖空气输送与局地地表因素章节。',
    limitation: '热浪没有全球统一阈值；通用解释不等于具体事件的定量归因。',
  },
  {
    id: 'nasa-energy',
    title: 'Climate and Earth’s Energy Budget',
    organisation: 'NASA Earth Observatory',
    url: 'https://science.nasa.gov/earth/earth-observatory/climate-and-earths-energy-budget/',
    kind: 'official', checkedAt: '2026-09-27',
    scope: '核对地表短波吸收、热红外辐射、蒸发与对流的能量交换说明。',
    limitation: '文中全球平均收支比例不用于本网站任何单次热浪的贡献计算。',
  },
  {
    id: 'metoffice-dome',
    title: 'What are heat domes? And are they getting worse?',
    organisation: 'Met Office',
    url: 'https://www.metoffice.gov.uk/blog/2026/what-are-heat-domes-and-are-they-getting-worse',
    kind: 'official', checkedAt: '2026-09-27',
    scope: '核对高压持续、空气下沉压缩、晴空和地表干燥的机制说明。',
    limitation: '“热穹顶”是描述性称呼，不能解释所有地区的全部热浪。',
  },
  {
    id: 'epa-islands',
    title: 'What Are Heat Islands?',
    organisation: 'United States Environmental Protection Agency',
    url: 'https://www.epa.gov/heatislands/what-are-heat-islands',
    kind: 'official', checkedAt: '2026-09-27',
    scope: '核对城市材料、植被和昼夜热岛的说明。',
    limitation: '城市热岛是局地过程；不能由一个城市代表点推断整座城市的街区差异。',
  },
  {
    id: 'white-2023',
    title: 'The unprecedented Pacific Northwest heatwave of June 2021',
    organisation: 'White et al. / Nature Communications (2023)',
    url: 'https://www.nature.com/articles/s41467-023-36289-3',
    kind: 'paper', checkedAt: '2026-09-27',
    scope: '核对气团轨迹、上游非绝热加热、下沉、地形及方法部分的位温公式（式2）。',
    limitation: '特定轨迹样本的贡献比例不可推广到整个事件；本网站未重跑该研究的轨迹分析。',
  },
  {
    id: 'fao-energy',
    title: 'FAO-56, Chapter 1: Introduction to evapotranspiration',
    organisation: 'Food and Agriculture Organization of the United Nations',
    url: 'https://www.fao.org/4/X0490E/x0490e04.htm',
    kind: 'official', checkedAt: '2026-09-27',
    scope: '核对能量平衡式1、通量正方向及忽略水平平流等适用条件。',
    limitation: '均匀植被表面的简化收支不能直接预测城市气温，也不能自动给出真实蒸发通量。',
  },
  {
    id: 'bom-2009',
    title: 'Special Climate Statement 17: The exceptional January–February 2009 heatwave in south-eastern Australia',
    organisation: 'Australian Bureau of Meteorology',
    url: 'https://www.bom.gov.au/climate/current/statements/scs17d.pdf',
    kind: 'official', checkedAt: '2026-09-27',
    scope: 'PDF第2页概述：两轮高峰、塔斯曼海高压及向南输送热空气；正文昼夜温度说明。',
    limitation: '采用报告的两轮高峰口径；没有逐项复核所有站点纪录。',
  },
  {
    id: 'metoffice-russia-2010',
    title: 'The Russian heatwave of summer 2010',
    organisation: 'Met Office',
    url: 'https://weather.metoffice.gov.uk/learn-about/weather/case-studies/russian-heatwave',
    kind: 'official', checkedAt: '2026-09-27',
    scope: '核对持续阻塞、7月至8月上半月严重阶段及热旱共现描述。',
    limitation: '通俗事件总结；本网站不复述其中伤亡估计，也不将热旱共现当成反馈强度测量。',
  },
  {
    id: 'india-2015-paper',
    title: 'The role of local heating in the 2015 Indian Heat Wave',
    organisation: 'Ghatak et al. / Scientific Reports (2017)',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5550505/',
    kind: 'paper', checkedAt: '2026-09-27',
    scope: '核对摘要、两个高峰的局地加热分析与结论；5月和6月的土壤与感热响应不同。',
    limitation: '研究采用自身区域和周平均定义，不等于印度所有站点共享同一热浪起止。',
  },
  {
    id: 'jma-2018',
    title: 'Primary factors behind the Heavy Rain Event of July 2018 and the subsequent heatwave in Japan',
    organisation: 'Japan Meteorological Agency',
    url: 'https://www.data.jma.go.jp/tcc/data/news/press_20180822.pdf',
    kind: 'official', checkedAt: '2026-09-27',
    scope: 'PDF第12—14页，§2.1—2.2：7月中旬起的高温、北太平洋副热带高压与青藏高压、晴空和下沉。',
    limitation: '报告统计更新至8月9日；这一天不是统一确认的热浪终止日。',
  },
  {
    id: 'c3s-july-2019',
    title: 'State of the European climate: July 2019',
    organisation: 'Copernicus / KNMI',
    url: 'https://surfobs.climate.copernicus.eu/stateoftheclimate/july2019.php',
    kind: 'official', checkedAt: '2026-09-27',
    scope: '核对官方检索正文中的7月24—26日、阻塞配置和暖空气输送；直接页面后续请求超时。',
    limitation: '不引用初报中的国家纪录数字；7月事件与同年6月事件分开。',
  },
  {
    id: 'wmo-pnw-2021',
    title: 'June ends with exceptional heat',
    organisation: 'World Meteorological Organization',
    url: 'https://wmo.int/media/news/june-ends-exceptional-heat',
    kind: 'official', checkedAt: '2026-09-27',
    scope: '核对2021年6月末北美西北高温的官方事件报道。',
    limitation: '报道中的日期覆盖不同地点；地图代表点不是整场事件的统一范围。',
  },
  {
    id: 'ecmwf-july-2022',
    title: '202207 — Heatwave — W Europe',
    organisation: 'European Centre for Medium-Range Weather Forecasts',
    url: 'https://confluence.ecmwf.int/spaces/FCST/pages/283553901/202207%2B-%2BHeatwave%2B-%2BW%2BEurope',
    kind: 'official', checkedAt: '2026-09-27',
    scope: '核对官方检索正文：北非暖空气输送、葡萄牙外海切断低压及7月17—20日分析窗口。',
    limitation: '页面也包含预报验证图；分析窗口不是各国共同的完整事件起止。直接页面后续请求超时。',
  },
  {
    id: 'wmo-china-2022',
    title: 'Extreme weather in China highlights climate change impacts and need for early warnings',
    organisation: 'World Meteorological Organization',
    url: 'https://wmo.int/media/news/extreme-weather-china-highlights-climate-change-impacts-and-need-early-warnings',
    kind: 'official', checkedAt: '2026-09-27',
    scope: '核对2022年8月24日报道中中国南方自6月13日开始的区域高温和干旱描述。',
    limitation: '报道时仍持续，文中预报缓解日期不是已观测的终止日；该范围不等于重庆单点窗口。',
  },
  {
    id: 'liu-yangtze-2024',
    title: 'Thermodynamic characteristics of extreme heat waves over the middle and lower reaches of the Yangtze River Basin',
    organisation: 'Liu et al. / Climate Dynamics (2024)',
    url: 'https://link.springer.com/article/10.1007/s00382-024-07104-6',
    kind: 'paper', checkedAt: '2026-09-27',
    scope: '核对摘要与引言中的反气旋、压缩加热、平流、地表辐射，以及2022年8月持续阶段解释。',
    limitation: '该文使用JRA-55开展区域热收支；本网站的重庆ERA5单点回放不是论文复现或完整机制预算。',
  },
  {
    id: 'wmo-events-2023',
    title: 'State of the Global Climate 2023: Significant weather and climate events supplement',
    organisation: 'World Meteorological Organization',
    url: 'https://wmo.int/sites/default/files/2024-03/Supplement_2023%20-%20Layout_v1.pdf',
    kind: 'official', checkedAt: '2026-09-27',
    scope: 'PDF第8—9页南美章节，核对9月下旬至10月初安第斯山以东热带地区的高温报道。',
    limitation: '该报告确认重要事件，未为本网站提供逐过程成因预算。',
  },
  {
    id: 'wwa-south-america-2023',
    title: 'Strong influence of climate change in uncharacteristic early spring heat in South America',
    organisation: 'World Weather Attribution',
    url: 'https://www.worldweatherattribution.org/strong-influence-of-climate-change-in-uncharacteristic-early-spring-heat-in-south-america/',
    kind: 'paper', checkedAt: '2026-09-26',
    scope: '上轮已读研究团队公开摘要，登记9月17—26日研究窗口；本轮重新展开页面超时。',
    limitation: '快速归因研究摘要，非本项目独立归因；完整研究报告尚未复核，不展示概率或贡献数字。',
  },
  {
    id: 'wmo-africa-2024',
    title: 'State of the Climate in Africa 2024',
    organisation: 'World Meteorological Organization',
    url: 'https://wmo.int/sites/default/files/2025-05/Africa_2024final1.pdf',
    kind: 'official', checkedAt: '2026-09-27',
    scope: 'PDF第13页西非章节，核对3—4月萨赫勒热浪。',
    limitation: '区域年度报告；不能据此为所有城市确定一致的五日事件窗口。',
  },
  {
    id: 'wwa-sahel-2024',
    title: 'Extreme Sahel heatwave at the end of Ramadan: rapid attribution study',
    organisation: 'World Weather Attribution',
    url: 'https://www.worldweatherattribution.org/extreme-sahel-heatwave-that-hit-highly-vulnerable-population-at-the-end-of-ramadan-would-not-have-occurred-without-climate-change/',
    kind: 'paper', checkedAt: '2026-09-27',
    scope: '核对研究团队公开摘要中的3月末—4月初、两个区域的不同五日窗口和夜间最低温分析。',
    limitation: '快速归因研究摘要；本网站仅用于时段与昼夜特征，不复述其伤亡或概率估计。',
  },
  {
    id: 'wmo-asia-2024',
    title: 'State of the Climate in Asia 2024',
    organisation: 'World Meteorological Organization',
    url: 'https://public.wmo.int/sites/default/files/2025-06/State%20of%20the%20Climate%20in%20Asia_2024%20Final.pdf',
    kind: 'official', checkedAt: '2026-09-27',
    scope: 'PDF第19页HEATWAVES，核对泰国东北部4月27日—5月2日重点时段。',
    limitation: '该段确认事件时段和高温，不足以确定当地高压、下沉或土壤反馈贡献。',
  },
  {
    id: 'c3s-june-2025',
    title: 'Heatwaves contribute to the warmest June on record in western Europe',
    organisation: 'Copernicus Climate Change Service / ECMWF',
    url: 'https://climate.copernicus.eu/heatwaves-contribute-warmest-june-record-western-europe',
    kind: 'official', checkedAt: '2026-09-27',
    scope: '核对6月17—22日和6月30日—7月2日两轮高峰、持续高压和晴热的说明。',
    limitation: '文中区域平均与单站最高温不是同一统计量；这里不把两轮合成一场无间断事件。',
  },
  {
    id: 'era5',
    title: 'ERA5 hourly data on single levels from 1940 to present',
    organisation: 'Copernicus Climate Change Service / ECMWF',
    url: 'https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview',
    kind: 'dataset', checkedAt: '2026-09-27',
    scope: '核对ERA5再分析的性质、时间覆盖和规则网格产品说明。',
    limitation: '观测与模式融合的再分析不等于街道实测；本网站已取样数据通过Open-Meteo接口获得。',
  },
  {
    id: 'open-meteo',
    title: 'Historical Weather API documentation',
    organisation: 'Open-Meteo',
    url: 'https://open-meteo.com/en/docs/historical-weather-api',
    kind: 'dataset', checkedAt: '2026-09-27',
    scope: '核对历史再分析接口、ERA5选项及气象字段说明。',
    limitation: '第三方数据接口，不是ECMWF官方分发端；选点、日界与变量定义见本网站数据说明。',
  },
];

export const mechanisms: Mechanism[] = [
  {
    id: 'circulation', title: '环流与下沉', subtitle: '空气下降时，也可以变暖',
    summary: '持续的高压形势常伴随下沉。空气移向更高气压处时受到压缩，温度可以升高；少云天气还会改变地表得到的太阳能。',
    steps: ['大尺度环流使某种天气形势维持。', '下沉空气在更高压力下压缩，发生绝热增温。', '云量、降水与近地层条件也随环流改变。'],
    caution: '高压不是实体锅盖。绝热增温不需要外部加热；实际气团还会混合、辐射和发生水相变化。',
    sourceIds: ['c3s-heatwaves', 'metoffice-dome', 'white-2023'],
  },
  {
    id: 'advection', title: '暖空气输送', subtitle: '热空气可以从别处到来',
    summary: '风把不同温度的空气带进一个地区。判断暖平流，需要同时查看风向和周围温度分布；仅有一支风向箭头还不够。',
    steps: ['先看上风方向的空气是否更暖。', '再看风是否持续把这些空气带入。', '结合不同高度与地形，检查输送怎样随时间变化。'],
    caution: '随时间变化的风场箭头不是单个气团的真实轨迹，也不能直接给出暖平流对地面升温的贡献。',
    sourceIds: ['c3s-heatwaves', 'c3s-july-2019', 'ecmwf-july-2022', 'white-2023'],
  },
  {
    id: 'radiation', title: '地表辐射与交换', subtitle: '阳光到达地面以后，能量去了哪里',
    summary: '地表吸收辐射，也向外发射长波辐射。剩余能量可以用于蒸发、加热空气或进入地面储存；晴天的太阳辐射只是收支的一部分。',
    steps: ['净辐射要同时计算短波和长波的进出。', '地表通过感热与附近空气交换能量。', '蒸发和地表储热也参与分配。'],
    caution: '短波辐射不等于净辐射；地表温度不等于2米空气温度。地表收支本身不足以直接预测某天的气温。',
    sourceIds: ['nasa-energy', 'fao-energy'],
  },
  {
    id: 'evaporation', title: '水分与蒸发', subtitle: '同样的能量，不一定产生同样的升温',
    summary: '当水分成为限制条件时，蒸发所消耗的能量可能减少，更多可用能量转向感热。这个反馈的强弱还取决于植被、辐射和空气条件。',
    steps: ['蒸发液态水需要能量。', '土壤变干可能限制蒸发和植物蒸腾。', '在其他条件相近时，感热所占比例可能上升。'],
    caution: '干土可以是热浪的前置条件，也可以是热浪发展的结果；一条土壤曲线无法单独证明因果。',
    sourceIds: ['fao-energy', 'metoffice-dome', 'india-2015-paper'],
  },
  {
    id: 'urban-night', title: '夜间与城市局地', subtitle: '最高温之外，还要看降温过程',
    summary: '城市材料和植被会改变局地能量交换。白天储存的能量可以在夜间释放；热浪也可能出现持续偏高的夜间气温，值得与白天分开观察。',
    steps: ['建筑和道路的吸收、储热与散热不同于自然地表。', '植被、水分和建筑布局影响周围的能量交换。', '同时检查白天高温与夜间降温幅度。'],
    caution: '热夜不必由城市热岛造成；城市热岛也不等于区域热浪。本网站的粗网格数据无法辨认街区温差。',
    sourceIds: ['epa-islands', 'nasa-energy', 'wwa-sahel-2024'],
  },
];

export const globalEvents: GlobalEvent[] = [
  {
    id: 'australia-2009', name: '澳大利亚东南部', region: '大洋洲', year: 2009,
    period: '报告高峰：1月28—31日、2月6—8日', coordinates: [144.96, -37.81],
    summary: '两轮高峰之间，部分内陆地区仍很热。BoM描述了塔斯曼海缓慢移动的高压与其他环流系统共同将热空气送向南部。',
    mechanismIds: ['circulation', 'advection'], sourceIds: ['bom-2009'],
  },
  {
    id: 'russia-2010', name: '俄罗斯西部', region: '欧洲', year: 2010,
    period: '报道严重阶段：7月至8月上半月', coordinates: [37.62, 55.75],
    summary: '持续的阻塞形势维持炎热天气，并与干旱共现。这个案例适合观察天气形势长时间停留的结果。',
    mechanismIds: ['circulation'], sourceIds: ['metoffice-russia-2010'],
  },
  {
    id: 'india-2015', name: '印度双峰热浪', region: '亚洲', year: 2015,
    period: '研究识别的两个高峰：5月下旬、6月上旬', coordinates: [83.0, 22.0],
    summary: '原始研究发现两个高峰的地表条件不同：5月的辐射变化与6月更明显的干土、感热变化值得分开解释。',
    mechanismIds: ['radiation', 'evaporation'], sourceIds: ['india-2015-paper'],
  },
  {
    id: 'japan-2018', name: '日本持续高温', region: '亚洲', year: 2018,
    period: '报道期：7月中旬起；统计更新至8月9日', coordinates: [139.39, 36.15],
    summary: 'JMA将这次高温与向日本伸展并持续的两层高压、晴空和下沉联系起来。高空与地面需要一起观察。',
    mechanismIds: ['circulation', 'radiation'], sourceIds: ['jma-2018'],
  },
  {
    id: 'europe-2019', name: '西欧七月热浪', region: '欧洲', year: 2019,
    period: '报告核心期：7月24—26日', coordinates: [2.35, 48.86],
    summary: '阻塞配置与偏南气流把暖空气输送到西欧。这里讲的是7月事件，不能与同年6月的另一次热浪混合。',
    mechanismIds: ['circulation', 'advection'], sourceIds: ['c3s-july-2019'], dataCaseId: 'paris2019',
  },
  {
    id: 'pnw-2021', name: '北美西北部', region: '北美洲', year: 2021,
    period: '代表性高温核心期：6月26—29日', coordinates: [-122.68, 45.52],
    summary: '论文讨论了上游非绝热加热、下沉、暖空气输送和地形的共同作用。当地高压图只是理解这场热浪的一个入口。',
    mechanismIds: ['circulation', 'advection'], sourceIds: ['wmo-pnw-2021', 'white-2023'], dataCaseId: 'portland2021',
  },
  {
    id: 'europe-2022', name: '西欧七月极端高温', region: '欧洲', year: 2022,
    period: 'ECMWF分析窗口：7月17—20日；英国高峰18—19日', coordinates: [-0.13, 51.51],
    summary: 'ECMWF的事件分析强调来自北非的暖空气输送，以及葡萄牙外海低压的位置。要理解升温，也要看邻近天气系统。',
    mechanismIds: ['advection'], sourceIds: ['ecmwf-july-2022'],
  },
  {
    id: 'china-2022', name: '长江流域与中国南方', region: '亚洲', year: 2022,
    period: 'WMO报道：6月13日起，截至8月24日仍持续', coordinates: [106.55, 29.56],
    summary: '官方报道记录持续高温与干旱。针对长江中下游8月的论文研究了反气旋、压缩加热和地表能量交换；重庆回放只呈现其中一个地点的资料。',
    mechanismIds: ['circulation', 'radiation'], sourceIds: ['wmo-china-2022', 'liu-yangtze-2024'], dataCaseId: 'chongqing2022',
  },
  {
    id: 'south-america-2023', name: '南美初春高温', region: '南美洲', year: 2023,
    period: 'WMO报道期：9月下旬—10月初；WWA研究窗口：9月17—26日', coordinates: [-55.0, -15.0],
    summary: 'WMO记录了安第斯山以东广泛地区的高温。不同报告采用的区域与窗口不同；目前保留事件记录，具体天气过程仍需补充分析。',
    mechanismIds: [], sourceIds: ['wmo-events-2023', 'wwa-south-america-2023'],
  },
  {
    id: 'sahel-2024', name: '西非与萨赫勒', region: '非洲', year: 2024,
    period: '报道期：3月末—4月初；研究按区域采用不同五日窗口', coordinates: [-1.52, 12.37],
    summary: '研究分别查看白天最高温和夜间最低温，提醒我们热事件不只有一个下午的峰值。这里不把夜间高温归因于某一种城市过程。',
    mechanismIds: [], sourceIds: ['wmo-africa-2024', 'wwa-sahel-2024'],
  },
  {
    id: 'thailand-2024', name: '泰国东北部', region: '亚洲', year: 2024,
    period: 'WMO报告重点时段：4月27日—5月2日', coordinates: [102.84, 16.44],
    summary: '亚洲气候报告记录了泰国东北部这段高温。现有核验材料足以确认事件，尚不足以把它套入一个统一的“热穹顶”解释。',
    mechanismIds: [], sourceIds: ['wmo-asia-2024'],
  },
  {
    id: 'europe-2025', name: '西欧与南欧两轮高温', region: '欧洲', year: 2025,
    period: '报告高峰：6月17—22日、6月30日—7月2日', coordinates: [-3.70, 40.42],
    summary: 'Copernicus分别描述了两轮高峰，并将其与持续高压、晴朗炎热天气联系起来。一个夏季可以包含多次不同的事件。',
    mechanismIds: ['circulation', 'radiation'], sourceIds: ['c3s-june-2025'],
  },
];

export const teachingModels: TeachingModel[] = [
  {
    id: 'adiabatic-parcel', title: '压缩一团空气',
    formula: 'T₂ = T₁ × (p₂ / p₁)^(Rᵈ / cₚ)',
    summary: '让一团空气移向更高气压处，观察理想化绝热压缩带来的温度变化。计算采用开尔文温标，再换回摄氏度展示。',
    assumptions: ['干空气近似为理想气体，过程可逆、绝热。', '不发生凝结，不与周围空气混合，忽略辐射交换。', 'Rᵈ/cₚ取约0.286；p₁与p₂使用相同压力单位。'],
    output: '输出该假设下同一气团的温度变化。',
    caution: '这里改变的是气团移动前后的压力，不是把某地海平面气压调高后预测当地气温；结果不是某次热浪的归因。',
    sourceIds: ['white-2023', 'metoffice-dome'],
  },
  {
    id: 'surface-energy', title: '分配地表得到的能量',
    formula: 'Rₙ = H + LE + 其余项',
    summary: '固定净辐射和进入地面储存等其余项，改变分配给蒸发的份额，查看剩余感热如何变化。全部通量使用W/m²。',
    assumptions: ['教学演示限定白天净辐射为正的情形。', '在FAO的均匀表面简化中，其余项为土壤热通量G；更一般情形还需考虑储热、平流等。', 'H与LE取离开地表为正；蒸发份额是直接指定的假设参数。'],
    output: '输出假设收支中的感热与潜热通量，不输出空气温度预测。',
    caution: '土壤含水量与蒸发份额没有通用线性对应关系。不能用这个滑块声称补水或增绿一定降低多少摄氏度。',
    sourceIds: ['fao-energy', 'nasa-energy'],
  },
];

export const projectAbout = '热浪解剖室希望把一次炎热天气拆解成可以观察和追问的物理过程：空气从哪里来、怎样变化，地表的能量又去了哪里。这里结合历史资料回放、经过核对的文献解释与理想化实验，并为每一部分保留来源和适用范围。';

export const atlasNote = '这里收录12个跨地区代表性案例，覆盖2009—2025年的部分事件。它们是经来源核对的精选目录，不是全球全部热浪；日期沿用各来源的报道期、核心期或研究窗口，未经统一算法重新检测。地图点位仅用于导航，不表示事件边界。';
