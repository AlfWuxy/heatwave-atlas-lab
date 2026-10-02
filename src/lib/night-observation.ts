export type NightSample = { time: string; temperature: number };
export type NightWindow = { date: string; samples: NightSample[]; minimum: number; mean: number; cooling: number | null; endTime: string | null };
// 固定当地钟表窗口；夏令时转换夜不强行当成十二小时完整窗口。
export function collectNights(samples: NightSample[], timezone: string): NightWindow[] {
  const format = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const parts = samples.map(sample => {
    const p = Object.fromEntries(format.formatToParts(new Date(sample.time)).map(part => [part.type, part.value]));
    return { sample, date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
  });
  const output: NightWindow[] = [];
  for (let index = 0; index < parts.length; index++) {
    const first = parts[index];
    if (first.hour !== 18 || first.minute !== 0) continue;
    const window = parts.slice(index, index + 12);
    const nextDate = new Date(Date.parse(`${first.date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    if (window.length !== 12 || window.some((p, i) => p.hour !== (18 + i) % 24 || p.minute !== 0 || p.date !== (i < 6 ? first.date : nextDate) || !Number.isFinite(p.sample.temperature) || Date.parse(p.sample.time) !== Date.parse(first.sample.time) + i * 3600000)) continue;
    const end = parts[index + 12];
    const completeEnd = end && end.hour === 6 && end.minute === 0 && end.date === nextDate && Date.parse(end.sample.time) === Date.parse(first.sample.time) + 12 * 3600000 && Number.isFinite(end.sample.temperature);
    const values = window.map(p => p.sample.temperature);
    output.push({ date: first.date, samples: window.map(p => p.sample), minimum: Math.min(...values), mean: values.reduce((a, b) => a + b, 0) / 12, cooling: completeEnd ? first.sample.temperature - end.sample.temperature : null, endTime: completeEnd ? end.sample.time : null });
  }
  return output;
}
