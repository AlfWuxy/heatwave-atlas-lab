import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl';
import {
  EARTH_RADIUS_M, REGIONAL_SECONDS_PER_DISPLAY_SECOND, lonLatToMercator, validateRegionalField,
  type RegionalField,
} from './regional-field';

export { REGIONAL_SECONDS_PER_DISPLAY_SECOND } from './regional-field';
export type RegionalLayerOptions = { animate?: boolean; showTemperature?: boolean; showParticles?: boolean };

const GEOGRAPHY = `
const float PI = 3.141592653589793;
vec2 mercator(vec2 lnglat) {
  return vec2((lnglat.x + 180.0) / 360.0,
    (1.0 - log(tan(PI * 0.25 + radians(lnglat.y) * 0.5)) / PI) * 0.5);
}
vec2 longitudeLatitude(vec2 xy) {
  float argument = PI * (1.0 - 2.0 * xy.y);
  return vec2(xy.x * 360.0 - 180.0, degrees(atan((exp(argument) - exp(-argument)) * 0.5)));
}
vec3 temperatureColor(float temperature) {
  vec3 neutral = vec3(212.0, 222.0, 231.0) / 255.0;
  vec3 endpoint = temperature < 27.0 ? vec3(55.0, 157.0, 255.0) / 255.0 : vec3(255.0, 77.0, 63.0) / 255.0;
  return mix(neutral, endpoint, clamp(abs(temperature - 27.0) / 15.0, 0.0, 1.0));
}
`;

const FIELD = `
uniform sampler2D u_field;
uniform sampler2D u_axes;
uniform ivec2 u_size;
uniform vec4 u_bounds;
float axisNode(int index, int axis) {
  vec2 value = texelFetch(u_axes, ivec2(index, 0), 0).rg;
  return axis == 0 ? value.x : value.y;
}
vec2 bracket(float value, int axis) {
  int lower = 0;
  int upper = (axis == 0 ? u_size.x : u_size.y) - 1;
  for (int iteration = 0; iteration < 13; iteration++) {
    if (upper - lower <= 1) break;
    int middle = (lower + upper) / 2;
    if (axisNode(middle, axis) <= value) lower = middle;
    else upper = middle;
  }
  float fraction = (value - axisNode(lower, axis)) / (axisNode(lower + 1, axis) - axisNode(lower, axis));
  return vec2(float(lower), clamp(fraction, 0.0, 1.0));
}
bool inside(vec2 position) {
  return all(greaterThanEqual(position, u_bounds.xy)) && all(lessThanEqual(position, u_bounds.zw));
}
vec3 sampleField(vec2 position) {
  vec2 x = bracket(position.x, 0);
  vec2 y = bracket(position.y, 1);
  ivec2 cell = ivec2(int(x.x), int(y.x));
  vec3 south = mix(texelFetch(u_field, cell, 0).rgb, texelFetch(u_field, cell + ivec2(1, 0), 0).rgb, x.y);
  vec3 north = mix(texelFetch(u_field, cell + ivec2(0, 1), 0).rgb, texelFetch(u_field, cell + ivec2(1, 1), 0).rgb, x.y);
  return mix(south, north, y.y);
}
`;

const UPDATE_VERTEX = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec4 a_state;
layout(location=1) in vec4 a_tail;
out vec4 v_state;
out vec4 v_tail;
uniform float u_dt;
uniform float u_secondsPerSecond;
${GEOGRAPHY}
${FIELD}
float randomValue(float token, uint salt) {
  uint value = floatBitsToUint(token) ^ salt;
  value ^= value >> 16; value *= 0x7feb352du;
  value ^= value >> 15; value *= 0x846ca68bu; value ^= value >> 16;
  return float(value) / 4294967296.0;
}
vec2 rate(vec2 position) {
  vec2 speed = sampleField(position).xy;
  return degrees(speed / (${EARTH_RADIUS_M.toFixed(1)} * vec2(cos(radians(position.y)), 1.0)));
}
void main() {
  vec2 position = a_state.xy;
  float age = a_state.z + u_dt;
  float token = a_state.w;
  float physicalDt = u_dt * u_secondsPerSecond;
  vec2 midpoint = position + 0.5 * physicalDt * rate(position);
  vec2 nextPosition = position + physicalDt * rate(midpoint);
  bool reborn = !inside(midpoint) || !inside(nextPosition) || age > 6.0 + randomValue(token, 7u) * 8.0;
  if (reborn) {
    token = randomValue(token, 19u) + 0.00001;
    vec2 low = mercator(u_bounds.xy);
    vec2 high = mercator(u_bounds.zw);
    nextPosition = longitudeLatitude(mix(low, high, vec2(randomValue(token, 31u), randomValue(token, 47u))));
    age = 0.0;
  }
  // 尾端是过往位置的平滑显示，不给格点温度或速度增加任何扰动。
  vec2 tail = reborn ? nextPosition : mix(a_tail.xy, nextPosition, 1.0 - exp(-u_dt / 0.32));
  v_state = vec4(nextPosition, age, token);
  v_tail = vec4(tail, 0.0, 0.0);
  gl_Position = vec4(0.0);
}
`;
const EMPTY_FRAGMENT = `#version 300 es
precision highp float;
out vec4 color;
void main() { color = vec4(0.0); }
`;

const PARTICLE_VERTEX = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec4 a_state;
layout(location=1) in vec4 a_tail;
uniform mat4 u_matrix;
uniform bool u_points;
uniform float u_pixelRatio;
out vec4 v_color;
${GEOGRAPHY}
${FIELD}
void main() {
  bool head = u_points || gl_VertexID == 1;
  vec2 position = head ? a_state.xy : a_tail.xy;
  float temperature = sampleField(a_state.xy).z;
  float alpha = (u_points ? 0.65 : (head ? 0.64 : 0.10)) * min(1.0, 0.3 + a_state.z * 2.0);
  v_color = vec4(temperatureColor(temperature) * alpha, alpha);
  gl_Position = u_matrix * vec4(mercator(position), 0.0, 1.0);
  gl_PointSize = 1.15 * u_pixelRatio;
}
`;
const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 color;
void main() { color = v_color; }
`;

const TEMPERATURE_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_position;
uniform mat4 u_matrix;
out vec2 v_position;
void main() {
  v_position = a_position;
  gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
}
`;
const TEMPERATURE_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
in vec2 v_position;
out vec4 color;
${GEOGRAPHY}
${FIELD}
void main() {
  // 屏幕中的纬度并非线性；先反算真实纬度，再插值气象节点。
  vec2 position = longitudeLatitude(v_position);
  if (!inside(position)) discard;
  float temperature = sampleField(position).z;
  float alpha = 0.22 + 0.14 * clamp(abs(temperature - 27.0) / 15.0, 0.0, 1.0);
  color = vec4(temperatureColor(temperature) * alpha, alpha);
}
`;

type Program = { program: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> };
function makeProgram(gl: WebGL2RenderingContext, vertex: string, fragment: string, feedback = false): Program {
  const shaders: WebGLShader[] = [];
  const program = gl.createProgram();
  if (!program) throw new Error('无法创建区域风温图层。');
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('无法分配区域风温着色器。');
      shaders.push(shader);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || '区域着色器编译失败。');
      gl.attachShader(program, shader);
    }
    if (feedback) gl.transformFeedbackVaryings(program, ['v_state', 'v_tail'], gl.INTERLEAVED_ATTRIBS);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || '区域着色器连接失败。');
    const uniforms: Program['uniforms'] = {};
    for (const name of ['u_field', 'u_axes', 'u_size', 'u_bounds', 'u_dt', 'u_secondsPerSecond', 'u_matrix', 'u_points', 'u_pixelRatio']) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return { program, uniforms };
  } catch (error) {
    gl.deleteProgram(program); throw error;
  } finally {
    for (const shader of shaders) gl.deleteShader(shader);
  }
}

/** 当前时刻的 10 m 风驱动示踪；时刻切换由调用方 reset，不使用理想热箱方程。 */
export class RegionalFlowLayer implements CustomLayerInterface {
  readonly id: string;
  readonly type = 'custom' as const;
  readonly renderingMode = '2d' as const;
  readonly count: number;
  private options = { animate: true, showTemperature: true, showParticles: true };
  private map: MapLibreMap | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private field: RegionalField | null = null;
  private fieldDirty = true;
  private particlesDirty = true;
  private lastTime = 0;
  private current = 0;
  private updateProgram: Program | null = null;
  private particleProgram: Program | null = null;
  private temperatureProgram: Program | null = null;
  private fieldTexture: WebGLTexture | null = null;
  private axesTexture: WebGLTexture | null = null;
  private transformFeedback: WebGLTransformFeedback | null = null;
  private buffers: WebGLBuffer[] = [];
  private updateArrays: WebGLVertexArrayObject[] = [];
  private drawArrays: WebGLVertexArrayObject[] = [];
  private quadBuffer: WebGLBuffer | null = null;
  private quadArray: WebGLVertexArrayObject | null = null;
  private visibilityChanged = () => {
    this.lastTime = 0;
    if (!document.hidden) this.map?.triggerRepaint();
  };

  constructor(id = 'regional-weather', count = 32_768) {
    if (!Number.isInteger(count) || count < 1 || count > 262_144) throw new RangeError('区域粒子数量必须为 1–262144 的整数。');
    this.id = id; this.count = count;
  }

  setField(field: RegionalField, reset = false): void {
    validateRegionalField(field);
    const previous = this.field;
    const changedBounds = !previous || previous.lons[0] !== field.lons[0] || previous.lons.at(-1) !== field.lons.at(-1)
      || previous.lats[0] !== field.lats[0] || previous.lats.at(-1) !== field.lats.at(-1);
    this.field = field; this.fieldDirty = true;
    this.particlesDirty ||= reset || changedBounds;
    if (reset || changedBounds) this.lastTime = 0;
    this.map?.triggerRepaint();
  }

  setOptions(options: RegionalLayerOptions): void {
    this.options = { ...this.options, ...options };
    this.lastTime = 0;
    this.map?.triggerRepaint();
  }

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext): void {
    this.map = map; this.gl = gl;
    try {
      this.updateProgram = makeProgram(gl, UPDATE_VERTEX, EMPTY_FRAGMENT, true);
      this.particleProgram = makeProgram(gl, PARTICLE_VERTEX, PARTICLE_FRAGMENT);
      this.temperatureProgram = makeProgram(gl, TEMPERATURE_VERTEX, TEMPERATURE_FRAGMENT);
      this.fieldTexture = gl.createTexture(); this.axesTexture = gl.createTexture();
      this.transformFeedback = gl.createTransformFeedback();
      this.quadBuffer = gl.createBuffer(); this.quadArray = gl.createVertexArray();
      if (!this.fieldTexture || !this.axesTexture || !this.transformFeedback || !this.quadBuffer || !this.quadArray) {
        throw new Error('区域图层的 GPU 资源不足。');
      }
      gl.bindVertexArray(this.quadArray); gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      for (let index = 0; index < 2; index++) {
        const buffer = gl.createBuffer();
        const updateArray = gl.createVertexArray(); const drawArray = gl.createVertexArray();
        if (!buffer || !updateArray || !drawArray) {
          if (buffer) gl.deleteBuffer(buffer);
          if (updateArray) gl.deleteVertexArray(updateArray);
          if (drawArray) gl.deleteVertexArray(drawArray);
          throw new Error('区域粒子 GPU 资源不足。');
        }
        this.buffers.push(buffer); this.updateArrays.push(updateArray); this.drawArrays.push(drawArray);
        for (const [array, divisor] of [[updateArray, 0], [drawArray, 1]] as const) {
          gl.bindVertexArray(array); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(0, divisor);
          gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(1, divisor);
        }
      }
      gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
      this.fieldDirty = true; this.particlesDirty = true;
      document.addEventListener('visibilitychange', this.visibilityChanged);
    } catch (error) {
      this.dispose(); throw error;
    }
  }

  private uploadField(): void {
    const gl = this.gl!, field = this.field!;
    const cells = new Float32Array(field.nx * field.ny * 4);
    for (let i = 0; i < field.nx * field.ny; i++) {
      cells[i * 4] = field.u[i]; cells[i * 4 + 1] = field.v[i]; cells[i * 4 + 2] = field.temperature[i]; cells[i * 4 + 3] = 1;
    }
    const width = Math.max(field.nx, field.ny);
    const axes = new Float32Array(width * 2);
    for (let i = 0; i < width; i++) {
      axes[2 * i] = field.lons[Math.min(i, field.nx - 1)]; axes[2 * i + 1] = field.lats[Math.min(i, field.ny - 1)];
    }
    for (const [unit, texture, internalFormat, format, textureWidth, textureHeight, pixels] of [
      [0, this.fieldTexture, gl.RGBA32F, gl.RGBA, field.nx, field.ny, cells],
      [1, this.axesTexture, gl.RG32F, gl.RG, width, 1, axes],
    ] as const) {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, textureWidth, textureHeight, 0, format, gl.FLOAT, pixels);
    }
    const [west, south] = lonLatToMercator(field.lons[0], field.lats[0]);
    const [east, north] = lonLatToMercator(field.lons.at(-1)!, field.lats.at(-1)!);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([west, south, east, south, west, north, west, north, east, south, east, north]), gl.STATIC_DRAW);
    this.fieldDirty = false;
  }

  private seedParticles(): void {
    const gl = this.gl!, field = this.field!;
    const particles = new Float32Array(this.count * 8);
    let state = 42;
    const random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
    const south = lonLatToMercator(field.lons[0], field.lats[0])[1];
    const north = lonLatToMercator(field.lons[0], field.lats.at(-1)!)[1];
    for (let i = 0; i < this.count; i++) {
      const lon = field.lons[0] + random() * (field.lons.at(-1)! - field.lons[0]);
      const y = south + random() * (north - south);
      const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;
      particles.set([lon, lat, random() * 5, random() + 0.00001, lon, lat, 0, 0], i * 8);
    }
    for (const buffer of this.buffers) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, particles, gl.DYNAMIC_COPY);
    }
    this.current = 0; this.particlesDirty = false;
  }

  private bindField(program: Program): void {
    const gl = this.gl!, field = this.field!, uniforms = program.uniforms;
    gl.useProgram(program.program);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fieldTexture);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.axesTexture);
    gl.uniform1i(uniforms.u_field, 0); gl.uniform1i(uniforms.u_axes, 1);
    gl.uniform2i(uniforms.u_size, field.nx, field.ny);
    gl.uniform4f(uniforms.u_bounds, field.lons[0], field.lats[0], field.lons.at(-1)!, field.lats.at(-1)!);
  }

  render(gl: WebGL2RenderingContext, args: CustomRenderMethodInput): void {
    if (!this.gl || !this.field || !this.updateProgram || !this.particleProgram || !this.temperatureProgram || gl.isContextLost()) return;
    if (this.fieldDirty) this.uploadField();
    if (this.particlesDirty) this.seedParticles();
    const now = performance.now();
    const elapsed = this.lastTime > 0 ? (now - this.lastTime) / 1000 : 0;
    // 后台切回或长卡顿后不追赶；显示秒与物理秒的压缩倍率保持固定。
    const dt = this.options.animate && !document.hidden && elapsed < 0.2 ? Math.min(0.05, elapsed) : 0;
    this.lastTime = now;
    if (dt > 0 && this.options.showParticles) {
      this.bindField(this.updateProgram);
      gl.uniform1f(this.updateProgram.uniforms.u_dt, dt);
      gl.uniform1f(this.updateProgram.uniforms.u_secondsPerSecond, REGIONAL_SECONDS_PER_DISPLAY_SECOND);
      gl.bindVertexArray(this.updateArrays[this.current]);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.transformFeedback);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.buffers[1 - this.current]);
      gl.enable(gl.RASTERIZER_DISCARD);
      gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, this.count); gl.endTransformFeedback();
      gl.disable(gl.RASTERIZER_DISCARD);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
      this.current = 1 - this.current;
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    const matrix = args.defaultProjectionData.mainMatrix;
    if (this.options.showTemperature) {
      this.bindField(this.temperatureProgram);
      gl.uniformMatrix4fv(this.temperatureProgram.uniforms.u_matrix, false, matrix);
      gl.bindVertexArray(this.quadArray); gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    if (this.options.showParticles) {
      this.bindField(this.particleProgram);
      gl.uniformMatrix4fv(this.particleProgram.uniforms.u_matrix, false, matrix);
      const canvas = this.map!.getCanvas();
      gl.uniform1f(this.particleProgram.uniforms.u_pixelRatio, canvas.width / Math.max(1, canvas.clientWidth));
      gl.bindVertexArray(this.drawArrays[this.current]);
      gl.uniform1i(this.particleProgram.uniforms.u_points, 0);
      gl.lineWidth(1); gl.drawArraysInstanced(gl.LINES, 0, 2, this.count);
      gl.uniform1i(this.particleProgram.uniforms.u_points, 1);
      gl.drawArraysInstanced(gl.POINTS, 0, 1, this.count);
    }
    gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null); gl.activeTexture(gl.TEXTURE0);
    if (this.options.animate && this.options.showParticles && !document.hidden) this.map?.triggerRepaint();
  }

  onRemove(): void { this.dispose(); }

  dispose(): void {
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    const gl = this.gl;
    if (gl) {
      for (const program of [this.updateProgram, this.particleProgram, this.temperatureProgram]) if (program) gl.deleteProgram(program.program);
      for (const texture of [this.fieldTexture, this.axesTexture]) if (texture) gl.deleteTexture(texture);
      for (const buffer of [...this.buffers, this.quadBuffer]) if (buffer) gl.deleteBuffer(buffer);
      for (const array of [...this.updateArrays, ...this.drawArrays, this.quadArray]) if (array) gl.deleteVertexArray(array);
      if (this.transformFeedback) gl.deleteTransformFeedback(this.transformFeedback);
    }
    this.updateProgram = null; this.particleProgram = null; this.temperatureProgram = null;
    this.fieldTexture = null; this.axesTexture = null; this.transformFeedback = null;
    this.buffers = []; this.updateArrays = []; this.drawArrays = []; this.quadBuffer = null; this.quadArray = null;
    this.gl = null; this.map = null; this.lastTime = 0;
  }
}
