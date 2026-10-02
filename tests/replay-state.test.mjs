import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReplayState, serializeReplayState, snapReplayPoint } from '../src/lib/replay-state.ts';
const times = ['2021-06-25T00:00:00Z', '2021-06-25T01:00:00Z', '2021-06-25T02:00:00Z'];
const parse = hash => parseReplayState(hash, 'portland2021', times, times[2], { lon: -122, lat: 45 });
test('分享时间往返保留同点A/B、图层、时钟，不依赖数组索引', () => {
  const state = { ...parse(''), position: 0, a: 0, b: 1, compare: true, side: 'A', localTime: true, temperature: false, point: { lon: -123, lat: 46 } };
  assert.deepEqual(parse(serializeReplayState('portland2021', times, state)), state);
  assert.equal(parse('#replay?at=2021-06-25T00%3A00Z').position, 0);
});
test('重复参数、案例不匹配、过期版本和过长URL整体回退', () => {
  for (const hash of ['#replay?at=x&at=y', '#replay?v=7', '#replay?case=paris2019', '#replay?' + 'x'.repeat(2049)]) {
    const result = parse(hash); assert.equal(result.position, 2); assert.ok(result.warnings.length);
  }
});
test('非UTC、半小时、越界时刻与非法数字显示提示，未知字段不参与状态', () => {
  for (const at of ['2021-06-25T00:30:00Z', '2021-06-25T01:00:00+01:00', '2020-01-01T00:00:00Z', 'NaN']) assert.ok(parse('#replay?at=' + encodeURIComponent(at)).warnings.length);
  for (const point of ['lon=&lat=', 'lon=NaN&lat=44', 'lon=2&lat=Infinity', 'lon=200&lat=34', 'lon=2']) assert.ok(parse('#replay?' + point).warnings.length);
  assert.ok(parse('#replay?cmp=true&wind=2&side=C&clock=bad').warnings.length === 4);
  assert.deepEqual(parse('#replay?autoplay=1&url=https://evil.invalid'), parse(''));
});
test('原始格点吸附支持边界，域外不夹紧制造数据', () => {
  assert.deepEqual(snapReplayPoint({ lon: 1.1, lat: 2.3 }, [1, 1.25, 1.5], [2, 2.25, 2.5]), { lon: 1, lat: 2.25 });
  assert.equal(snapReplayPoint({ lon: 0, lat: 2 }, [1, 2], [2, 3]), null);
  assert.equal(snapReplayPoint({ lon: NaN, lat: 2 }, [1, 2], [2, 3]), null);
});
test('非法索引不能序列化成误导链接', () => {
  for (const index of [-1, 0.5, 3, Infinity]) assert.throws(() => serializeReplayState('portland2021', times, { ...parse(''), a: index }));
});

test('A=B允许零差值；当前UTC与A/B侧矛盾时明确提示', () => {
  const state = parse('#replay?cmp=1&a=2021-06-25T00:00:00Z&b=2021-06-25T00:00:00Z&at=2021-06-25T02:00:00Z');
  assert.equal(state.a, state.b); assert.equal(state.position, state.b); assert.ok(state.warnings.some(message => message.includes('不一致')));
});

test('十个新增案例分享与原始时刻均可往返，无任意路径白名单放宽', () => {
  for (const id of ['london2022','phoenix2023','melbourne2009','tokyo2018','dhaka2023','karachi2015','moscow2010','madrid2022','buenosaires2023','agadir2023']) {
    const state = parseReplayState(`#replay?case=${id}&at=2021-06-25T00:00:00Z`, id, times, times[2], { lon: 0, lat: 0 });
    assert.equal(state.position, 0); assert.deepEqual(state.warnings, []);
    assert.deepEqual(parseReplayState(serializeReplayState(id, times, state), id, times, times[2], { lon: 0, lat: 0 }), state);
  }
  assert.throws(() => serializeReplayState('../secret', times, parse('')));
});
