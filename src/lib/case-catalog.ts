import { EXPANSION_REPLAY_CASES } from './expansion-case-catalog.ts';

export const REPLAY_CONTINENTS = ['亚洲', '欧洲', '北美洲', '南美洲', '非洲', '大洋洲'] as const;

// 路由、分享与选择器共用冻结名单，资料下载状态另由公开索引决定。
export const REPLAY_CASES = [
  { id: 'portland2021', title: '北美西北 · 2021', city: '波特兰', country: '美国', continent: '北美洲', collection: 'original', original: true },
  { id: 'paris2019', title: '西欧 · 2019', city: '巴黎', country: '法国', continent: '欧洲', collection: 'original', original: true },
  { id: 'chongqing2022', title: '长江流域 · 2022', city: '重庆', country: '中国', continent: '亚洲', collection: 'original', original: true },
  { id: 'london2022', title: '伦敦 · 2022', city: '伦敦', country: '英国', continent: '欧洲', collection: 'extended', original: false },
  { id: 'phoenix2023', title: '凤凰城 · 2023', city: '凤凰城', country: '美国', continent: '北美洲', collection: 'extended', original: false },
  { id: 'melbourne2009', title: '墨尔本 · 2009', city: '墨尔本', country: '澳大利亚', continent: '大洋洲', collection: 'extended', original: false },
  { id: 'tokyo2018', title: '东京 · 2018', city: '东京', country: '日本', continent: '亚洲', collection: 'extended', original: false },
  { id: 'dhaka2023', title: '达卡 · 2023', city: '达卡', country: '孟加拉国', continent: '亚洲', collection: 'extended', original: false },
  { id: 'karachi2015', title: '卡拉奇 · 2015', city: '卡拉奇', country: '巴基斯坦', continent: '亚洲', collection: 'extended', original: false },
  { id: 'moscow2010', title: '莫斯科 · 2010', city: '莫斯科', country: '俄罗斯', continent: '欧洲', collection: 'extended', original: false },
  { id: 'madrid2022', title: '马德里 · 2022', city: '马德里', country: '西班牙', continent: '欧洲', collection: 'extended', original: false },
  { id: 'buenosaires2023', title: '布宜诺斯艾利斯 · 2023', city: '布宜诺斯艾利斯', country: '阿根廷', continent: '南美洲', collection: 'extended', original: false },
  { id: 'agadir2023', title: '阿加迪尔 · 2023', city: '阿加迪尔', country: '摩洛哥', continent: '非洲', collection: 'extended', original: false },
  ...EXPANSION_REPLAY_CASES,
] as const;
export type ReplayCaseId = typeof REPLAY_CASES[number]['id'];
export function isReplayCaseId(value: unknown): value is ReplayCaseId {
  return typeof value === 'string' && REPLAY_CASES.some(item => item.id === value);
}
// 只接受当前名单，按固定顺序合并。重复项保留先出现的版本，避免扩展索引覆盖原始案例。
export function mergeReplayCases<T extends { id: string }>(...indexes: (readonly T[] | undefined)[]): T[] {
  const byId = new Map<string, T>();
  for (const item of indexes.flatMap(index => index ?? [])) if (isReplayCaseId(item.id) && !byId.has(item.id)) byId.set(item.id, item);
  return REPLAY_CASES.flatMap(item => { const found = byId.get(item.id); return found ? [found] : []; });
}
