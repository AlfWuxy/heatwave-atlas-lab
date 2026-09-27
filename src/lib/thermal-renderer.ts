/** 温度与速度由独立求解器给出；本模块只搬运、着色和显示示踪粒子。 */
export type ThermalFrame = {
  nx: number
  ny: number
  temperature: Float32Array
  velocityX: Float32Array
  velocityY: Float32Array
}

export type ParticleQuality = 'low' | 'medium' | 'high'

export interface ThermalRenderer {
  readonly kind: 'webgl2' | 'canvas2d'
  readonly count: number
  setQuality(q: ParticleQuality): void
  reset(seed: number): void
  resize(width: number, height: number, dpr: number): void
  draw(frame: ThermalFrame, dt: number, showField: boolean): void
  destroy(): void
}

const GPU_COUNTS: Record<ParticleQuality, number> = { low: 16_384, medium: 65_536, high: 262_144 }
const CPU_COUNTS: Record<ParticleQuality, number> = { low: 2_048, medium: 4_096, high: 8_192 }
const DOMAIN_WIDTH = 1.6
const TRAIL_DECAY = 3.2

function randomSource(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function initialParticles(count: number, seed: number) {
  const random = randomSource(seed)
  const states = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    const index = i * 4
    states[index] = random()
    states[index + 1] = random()
    const token = random()
    states[index + 2] = random() * (6 + token * 10)
    states[index + 3] = token
  }
  return states
}

function validFrame(frame: ThermalFrame) {
  const size = frame.nx * frame.ny
  if (frame.nx < 2 || frame.ny < 2 || !Number.isInteger(frame.nx) || !Number.isInteger(frame.ny)
    || frame.temperature.length !== size || frame.velocityX.length !== size || frame.velocityY.length !== size) {
    throw new Error('粒子渲染器收到不完整的温度或速度格点。')
  }
}

// 两种渲染路径共用同一固定温标；温度为相对参考态的无量纲量。
function temperatureColor(value: number): [number, number, number] {
  const amount = Math.min(1, Math.abs(value)) ** 0.6
  const endpoint = value >= 0 ? [255, 77, 63] : [55, 157, 255]
  const neutral = [23, 29, 36]
  return endpoint.map((channel, i) => Math.round(neutral[i] + (channel - neutral[i]) * amount)) as [number, number, number]
}

const FIELD_GLSL = `
uniform sampler2D u_field;
vec3 sampleField(vec2 uv) {
  // 输入是中心格点，行由下至上；手动插值不要求浮点线性过滤扩展。
  ivec2 size = textureSize(u_field, 0);
  vec2 grid = clamp(uv * vec2(size) - 0.5, vec2(0.0), vec2(size - 1));
  ivec2 cell = ivec2(floor(grid));
  ivec2 nextCell = min(cell + 1, size - 1);
  vec2 f = fract(grid);
  vec3 lower = mix(texelFetch(u_field, cell, 0).rgb,
    texelFetch(u_field, ivec2(nextCell.x, cell.y), 0).rgb, f.x);
  vec3 upper = mix(texelFetch(u_field, ivec2(cell.x, nextCell.y), 0).rgb,
    texelFetch(u_field, nextCell, 0).rgb, f.x);
  return mix(lower, upper, f.y);
}
vec3 temperatureColor(float value) {
  vec3 endpoint = value >= 0.0 ? vec3(1.0, 77.0 / 255.0, 63.0 / 255.0)
    : vec3(55.0 / 255.0, 157.0 / 255.0, 1.0);
  return mix(vec3(23.0, 29.0, 36.0) / 255.0, endpoint, pow(min(1.0, abs(value)), 0.6));
}
`

const UPDATE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec4 a_state;
uniform float u_dt;
out vec4 v_newState;
${FIELD_GLSL}
float randomValue(float token, uint salt) {
  // 整数混合避免三角函数哈希在低精度设备上使重生位置聚成少数条带。
  uint value = floatBitsToUint(token) ^ salt;
  value ^= value >> 16;
  value *= 0x7feb352du;
  value ^= value >> 15;
  value *= 0x846ca68bu;
  value ^= value >> 16;
  return float(value) / 4294967296.0;
}
void main() {
  vec2 position = a_state.xy;
  // 中点法在同一时刻速度场内搬运示踪点；物理区域宽 1.6、高 1。
  vec2 speed = sampleField(position).xy / vec2(1.6, 1.0);
  vec2 midpoint = position + 0.5 * u_dt * speed;
  position += u_dt * sampleField(midpoint).xy / vec2(1.6, 1.0);
  float age = a_state.z + u_dt;
  float token = a_state.w;
  if (age > 6.0 + token * 10.0 || any(lessThan(position, vec2(0.0))) || any(greaterThan(position, vec2(1.0)))) {
    token = randomValue(token, 0x9e3779b9u);
    position = vec2(randomValue(token, 0x85ebca6bu), randomValue(token, 0xc2b2ae35u));
    age = 0.0;
  }
  v_newState = vec4(position, age, token);
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}
`

const EMPTY_FRAGMENT = `#version 300 es
precision highp float;
out vec4 color;
void main() { color = vec4(0.0); }
`

const LINE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec4 a_previous;
layout(location = 1) in vec4 a_current;
uniform vec2 u_resolution;
uniform float u_radius;
uniform bool u_stationary;
out vec2 v_local;
out float v_halfLength;
out vec3 v_color;
${FIELD_GLSL}
void main() {
  vec2 current = a_current.xy * u_resolution;
  vec2 previous = a_previous.xy * u_resolution;
  // 连续两步重生时两端年龄都为零，不能只用严格小于判断。
  // 重生代号改变或年龄不递增，都表示两端不属于一段连续轨迹。
  if (u_stationary || a_current.w != a_previous.w || a_current.z <= a_previous.z) previous = current;
  vec2 delta = current - previous;
  float distance = length(delta);
  vec2 direction = distance > 0.001 ? delta / distance : vec2(1.0, 0.0);
  vec2 normal = vec2(-direction.y, direction.x);
  vec2 corner = vec2((gl_VertexID == 0 || gl_VertexID == 2) ? -1.0 : 1.0,
    gl_VertexID < 2 ? -1.0 : 1.0);
  v_halfLength = distance * 0.5;
  v_local = corner * vec2(v_halfLength + u_radius, u_radius);
  vec2 pixel = (current + previous) * 0.5 + direction * v_local.x + normal * v_local.y;
  gl_Position = vec4(pixel / u_resolution * 2.0 - 1.0, 0.0, 1.0);
  v_color = temperatureColor(sampleField(a_current.xy).z);
}
`

const LINE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_local;
in float v_halfLength;
in vec3 v_color;
uniform float u_radius;
uniform float u_opacity;
out vec4 color;
void main() {
  vec2 capsule = vec2(max(abs(v_local.x) - v_halfLength, 0.0), v_local.y);
  float radius = length(capsule) / u_radius;
  if (radius > 1.0) discard;
  float intensity = exp(-3.0 * radius * radius) * u_opacity;
  color = vec4(v_color * intensity, 1.0);
}
`

const SCREEN_VERTEX = `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
  // 一个覆盖屏幕的三角形，避免共享边缘的接缝。
  vec2 position = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  v_uv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const DECAY_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_trail;
uniform float u_decay;
out vec4 color;
void main() {
  // 半个量化阶的减量防止 RGBA8 中极暗像素永久残留。
  color = vec4(max(texture(u_trail, v_uv).rgb * u_decay - vec3(0.5 / 255.0), vec3(0.0)), 1.0);
}
`

const PRESENT_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_trail;
uniform bool u_showField;
out vec4 color;
${FIELD_GLSL}
void main() {
  vec3 background = vec3(0.025, 0.033, 0.048);
  float temperature = sampleField(v_uv).z;
  if (u_showField) background += temperatureColor(temperature) * pow(min(abs(temperature), 1.0), 0.7) * 0.15;
  vec2 grid = abs(fract(v_uv * vec2(16.0, 10.0) - 0.5) - 0.5) / fwidth(v_uv * vec2(16.0, 10.0));
  float gridLine = 1.0 - min(min(grid.x, grid.y), 1.0);
  background += vec3(0.012, 0.016, 0.022) * gridLine;
  vec3 trail = texture(u_trail, v_uv).rgb;
  color = vec4(background + (vec3(1.0) - exp(-trail * 1.9)) * 0.9, 1.0);
}
`

type ProgramInfo = { program: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> }
type TrailTarget = { texture: WebGLTexture; framebuffer: WebGLFramebuffer }

class WebGLThermalRenderer implements ThermalRenderer {
  readonly kind = 'webgl2' as const
  private quality: ParticleQuality
  private seed: number
  private programs: ProgramInfo[] = []
  private buffers: WebGLBuffer[] = []
  private updateArrays: WebGLVertexArrayObject[] = []
  private lineArrays: WebGLVertexArrayObject[] = []
  private screenArray: WebGLVertexArrayObject | null = null
  private transform: WebGLTransformFeedback | null = null
  private fieldTexture: WebGLTexture | null = null
  private fieldPixels = new Float32Array(0)
  private fieldWidth = 0
  private fieldHeight = 0
  private trails: TrailTarget[] = []
  private current = 0
  private trailCurrent = 0
  private fresh = true
  private disposed = false
  private ratio = 1

  constructor(private canvas: HTMLCanvasElement, private gl: WebGL2RenderingContext, quality: ParticleQuality, seed: number) {
    this.quality = quality
    this.seed = seed
    try {
      this.programs.push(this.program(UPDATE_VERTEX, EMPTY_FRAGMENT, ['u_field', 'u_dt'], ['v_newState']))
      this.programs.push(this.program(LINE_VERTEX, LINE_FRAGMENT, ['u_field', 'u_resolution', 'u_radius', 'u_stationary', 'u_opacity']))
      this.programs.push(this.program(SCREEN_VERTEX, DECAY_FRAGMENT, ['u_trail', 'u_decay']))
      this.programs.push(this.program(SCREEN_VERTEX, PRESENT_FRAGMENT, ['u_trail', 'u_field', 'u_showField']))
      this.fieldTexture = this.texture()
      this.transform = gl.createTransformFeedback()
      this.screenArray = gl.createVertexArray()
      for (let i = 0; i < 2; i++) {
        const buffer = gl.createBuffer()
        const updateArray = gl.createVertexArray()
        const lineArray = gl.createVertexArray()
        if (!buffer || !updateArray || !lineArray) throw new Error('无法分配粒子图形资源。')
        this.buffers.push(buffer)
        this.updateArrays.push(updateArray)
        this.lineArrays.push(lineArray)
      }
      for (let i = 0; i < 2; i++) {
        gl.bindVertexArray(this.updateArrays[i])
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[i])
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0)
        gl.bindVertexArray(this.lineArrays[i])
        for (let location = 0; location < 2; location++) {
          gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[location === 0 ? 1 - i : i])
          gl.enableVertexAttribArray(location)
          gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 16, 0)
          gl.vertexAttribDivisor(location, 1)
        }
      }
      gl.bindVertexArray(null)
      gl.disable(gl.DEPTH_TEST)
      gl.disable(gl.CULL_FACE)
      this.reset(seed)
      this.resize(canvas.clientWidth || 960, canvas.clientHeight || 600, 1)
    } catch (error) {
      this.destroy()
      throw error
    }
  }

  get count() { return GPU_COUNTS[this.quality] }

  private program(vertex: string, fragment: string, uniformNames: string[], varyings?: string[]): ProgramInfo {
    const gl = this.gl
    const program = gl.createProgram()
    if (!program) throw new Error('无法创建粒子着色程序。')
    const shaders: WebGLShader[] = []
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
        const shader = gl.createShader(type)
        if (!shader) throw new Error('无法创建粒子着色器。')
        shaders.push(shader)
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`粒子着色器编译失败：${gl.getShaderInfoLog(shader)}`)
        gl.attachShader(program, shader)
      }
      if (varyings) gl.transformFeedbackVaryings(program, varyings, gl.INTERLEAVED_ATTRIBS)
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`粒子图形程序连接失败：${gl.getProgramInfoLog(program)}`)
      return { program, uniforms: Object.fromEntries(uniformNames.map(name => [name, gl.getUniformLocation(program, name)])) }
    } catch (error) {
      gl.deleteProgram(program)
      throw error
    } finally {
      for (const shader of shaders) gl.deleteShader(shader)
    }
  }

  private texture() {
    const gl = this.gl
    const texture = gl.createTexture()
    if (!texture) throw new Error('无法分配粒子纹理。')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
  }

  private bindTexture(texture: WebGLTexture | null, unit: number) {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit)
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
  }

  setQuality(quality: ParticleQuality) {
    if (this.disposed || quality === this.quality) return
    this.quality = quality
    this.reset(this.seed)
  }

  reset(seed: number) {
    if (this.disposed) return
    this.seed = seed
    const gl = this.gl
    const states = initialParticles(this.count, seed)
    for (const buffer of this.buffers) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, states, gl.DYNAMIC_COPY)
    }
    this.current = 0
    this.clearTrails()
  }

  private clearTrails() {
    const gl = this.gl
    for (const target of this.trails) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.trailCurrent = 0
    this.fresh = true
  }

  resize(width: number, height: number, dpr: number) {
    if (this.disposed) return
    this.ratio = Math.min(2, Math.max(1, dpr || 1))
    const pixelWidth = Math.max(1, Math.round(width * this.ratio))
    const pixelHeight = Math.max(1, Math.round(height * this.ratio))
    if (pixelWidth === this.canvas.width && pixelHeight === this.canvas.height && this.trails.length) return
    const gl = this.gl
    this.canvas.width = pixelWidth
    this.canvas.height = pixelHeight
    for (const target of this.trails) {
      gl.deleteTexture(target.texture)
      gl.deleteFramebuffer(target.framebuffer)
    }
    this.trails = []
    for (let i = 0; i < 2; i++) {
      const texture = this.texture()
      const framebuffer = gl.createFramebuffer()
      if (!framebuffer) {
        gl.deleteTexture(texture)
        throw new Error('无法分配粒子拖尾缓冲区。')
      }
      this.trails.push({ texture, framebuffer })
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, pixelWidth, pixelHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('当前设备无法创建粒子拖尾画布。')
    }
    gl.viewport(0, 0, pixelWidth, pixelHeight)
    this.clearTrails()
  }

  private upload(frame: ThermalFrame) {
    const gl = this.gl
    const length = frame.nx * frame.ny
    let temperatureChanged = this.fieldWidth !== frame.nx || this.fieldHeight !== frame.ny
    if (this.fieldPixels.length !== length * 4) this.fieldPixels = new Float32Array(length * 4)
    for (let i = 0; i < length; i++) {
      if (this.fieldPixels[i * 4 + 2] !== frame.temperature[i]) temperatureChanged = true
      this.fieldPixels[i * 4] = frame.velocityX[i]
      this.fieldPixels[i * 4 + 1] = frame.velocityY[i]
      this.fieldPixels[i * 4 + 2] = frame.temperature[i]
    }
    this.bindTexture(this.fieldTexture, 0)
    if (this.fieldWidth !== frame.nx || this.fieldHeight !== frame.ny) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, frame.nx, frame.ny, 0, gl.RGBA, gl.FLOAT, this.fieldPixels)
      this.fieldWidth = frame.nx
      this.fieldHeight = frame.ny
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, frame.nx, frame.ny, gl.RGBA, gl.FLOAT, this.fieldPixels)
    }
    return temperatureChanged
  }

  draw(frame: ThermalFrame, dt: number, showField: boolean) {
    if (this.disposed) return
    const gl = this.gl
    if (gl.isContextLost()) throw new Error('图形上下文已丢失，请切换兼容模式。')
    validFrame(frame)
    const temperatureChanged = this.upload(frame)
    const step = Number.isFinite(dt) ? Math.max(0, dt) : 0
    // 暂停时的新热输入也必须立即显色，但不改变位置、年龄或模拟时间。
    // 比较实际格点内容，可兼容复用数组的调用者；相同场反复绘制不会抹掉拖尾。
    if (step === 0 && temperatureChanged && !this.fresh) this.clearTrails()
    if (step > 0) {
      const update = this.programs[0]
      gl.useProgram(update.program)
      gl.uniform1i(update.uniforms.u_field, 0)
      gl.uniform1f(update.uniforms.u_dt, step)
      gl.bindVertexArray(this.updateArrays[this.current])
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.transform)
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.buffers[1 - this.current])
      gl.enable(gl.RASTERIZER_DISCARD)
      gl.beginTransformFeedback(gl.POINTS)
      gl.drawArrays(gl.POINTS, 0, this.count)
      gl.endTransformFeedback()
      gl.disable(gl.RASTERIZER_DISCARD)
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null)
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null)
      this.current = 1 - this.current
    }
    // 暂停时只合成现有画面，不让粒子寿命、位置或拖尾继续改变。
    if (step > 0 || this.fresh) {
      const nextTrail = 1 - this.trailCurrent
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.trails[nextTrail].framebuffer)
      gl.viewport(0, 0, this.canvas.width, this.canvas.height)
      gl.disable(gl.BLEND)
      const decay = this.programs[2]
      gl.useProgram(decay.program)
      this.bindTexture(this.trails[this.trailCurrent].texture, 1)
      gl.uniform1i(decay.uniforms.u_trail, 1)
      gl.uniform1f(decay.uniforms.u_decay, Math.exp(-TRAIL_DECAY * step))
      gl.bindVertexArray(this.screenArray)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      const line = this.programs[1]
      gl.useProgram(line.program)
      gl.uniform1i(line.uniforms.u_field, 0)
      gl.uniform2f(line.uniforms.u_resolution, this.canvas.width, this.canvas.height)
      gl.uniform1f(line.uniforms.u_radius, 0.9 * this.ratio)
      // 静止画面没有多帧轨迹累积，补偿亮度以保留暂停实验的可读性。
      gl.uniform1f(line.uniforms.u_opacity, this.fresh ? Math.min(0.9, 300 / Math.sqrt(this.count)) : Math.min(0.3, 38 / Math.sqrt(this.count)))
      gl.uniform1i(line.uniforms.u_stationary, this.fresh || step === 0 ? 1 : 0)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE)
      gl.bindVertexArray(this.lineArrays[this.current])
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count)
      gl.disable(gl.BLEND)
      this.trailCurrent = nextTrail
      this.fresh = false
    }
    const present = this.programs[3]
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.useProgram(present.program)
    gl.uniform1i(present.uniforms.u_field, 0)
    gl.uniform1i(present.uniforms.u_trail, 1)
    gl.uniform1i(present.uniforms.u_showField, showField ? 1 : 0)
    this.bindTexture(this.trails[this.trailCurrent].texture, 1)
    gl.bindVertexArray(this.screenArray)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindVertexArray(null)
  }

  destroy() {
    if (this.disposed) return
    this.disposed = true
    const gl = this.gl
    gl.bindVertexArray(null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null)
    for (const program of this.programs) gl.deleteProgram(program.program)
    for (const array of [...this.updateArrays, ...this.lineArrays]) gl.deleteVertexArray(array)
    for (const buffer of this.buffers) gl.deleteBuffer(buffer)
    for (const target of this.trails) {
      gl.deleteTexture(target.texture)
      gl.deleteFramebuffer(target.framebuffer)
    }
    gl.deleteTexture(this.fieldTexture)
    gl.deleteVertexArray(this.screenArray)
    gl.deleteTransformFeedback(this.transform)
    this.programs = []
    this.buffers = []
    this.trails = []
    this.fieldPixels = new Float32Array(0)
  }
}

function sample(values: Float32Array, nx: number, ny: number, x: number, y: number) {
  const gx = Math.max(0, Math.min(nx - 1, x * nx - 0.5))
  const gy = Math.max(0, Math.min(ny - 1, y * ny - 0.5))
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const x1 = Math.min(nx - 1, x0 + 1)
  const y1 = Math.min(ny - 1, y0 + 1)
  const fx = gx - x0
  const fy = gy - y0
  return (values[x0 + y0 * nx] * (1 - fx) + values[x1 + y0 * nx] * fx) * (1 - fy)
    + (values[x0 + y1 * nx] * (1 - fx) + values[x1 + y1 * nx] * fx) * fy
}

class CanvasThermalRenderer implements ThermalRenderer {
  readonly kind = 'canvas2d' as const
  private quality: ParticleQuality
  private seed: number
  private particles = new Float32Array(0)
  private random = randomSource(0)
  private trailCanvas: HTMLCanvasElement
  private trail: CanvasRenderingContext2D
  private fieldCanvas: HTMLCanvasElement
  private fieldContext: CanvasRenderingContext2D
  private fieldImage: ImageData | null = null
  private previousTemperature = new Float32Array(0)
  private fresh = true
  private disposed = false
  private ratio = 1

  constructor(private canvas: HTMLCanvasElement, private context: CanvasRenderingContext2D, quality: ParticleQuality, seed: number) {
    this.quality = quality
    this.seed = seed
    this.trailCanvas = document.createElement('canvas')
    this.fieldCanvas = document.createElement('canvas')
    const trail = this.trailCanvas.getContext('2d')
    const field = this.fieldCanvas.getContext('2d')
    if (!trail || !field) throw new Error('浏览器无法创建兼容模式画布。')
    this.trail = trail
    this.fieldContext = field
    this.reset(seed)
    this.resize(canvas.clientWidth || 960, canvas.clientHeight || 600, 1)
  }

  get count() { return CPU_COUNTS[this.quality] }

  setQuality(quality: ParticleQuality) {
    if (this.disposed || quality === this.quality) return
    this.quality = quality
    this.reset(this.seed)
  }

  reset(seed: number) {
    if (this.disposed) return
    this.seed = seed
    this.random = randomSource(seed ^ 0x9e3779b9)
    this.particles = initialParticles(this.count, seed)
    this.trail.clearRect(0, 0, this.trailCanvas.width, this.trailCanvas.height)
    this.fresh = true
  }

  resize(width: number, height: number, dpr: number) {
    if (this.disposed) return
    this.ratio = Math.min(2, Math.max(1, dpr || 1))
    const w = Math.max(1, Math.round(width * this.ratio))
    const h = Math.max(1, Math.round(height * this.ratio))
    if (this.canvas.width === w && this.canvas.height === h && this.trailCanvas.width === w && this.trailCanvas.height === h) return
    this.canvas.width = this.trailCanvas.width = w
    this.canvas.height = this.trailCanvas.height = h
    this.fresh = true
  }

  draw(frame: ThermalFrame, dt: number, showField: boolean) {
    if (this.disposed) return
    validFrame(frame)
    const { nx, ny, temperature, velocityX, velocityY } = frame
    const step = Number.isFinite(dt) ? Math.max(0, dt) : 0
    const width = this.canvas.width
    const height = this.canvas.height
    let temperatureChanged = this.previousTemperature.length !== temperature.length
    if (temperatureChanged) this.previousTemperature = new Float32Array(temperature.length)
    for (let i = 0; i < temperature.length; i++) {
      if (this.previousTemperature[i] !== temperature[i]) temperatureChanged = true
      this.previousTemperature[i] = temperature[i]
    }
    if (step === 0 && temperatureChanged && !this.fresh) {
      this.trail.clearRect(0, 0, width, height)
      this.fresh = true
    }
    if (step > 0 || this.fresh) {
      this.trail.globalCompositeOperation = 'destination-out'
      this.trail.fillStyle = `rgba(0,0,0,${1 - Math.exp(-TRAIL_DECAY * step)})`
      this.trail.fillRect(0, 0, width, height)
      this.trail.globalCompositeOperation = 'lighter'
      this.trail.lineWidth = 0.9 * this.ratio
      this.trail.lineCap = 'round'
      const paths = Array.from({ length: 33 }, () => new Path2D())
      for (let i = 0; i < this.count; i++) {
        const offset = i * 4
        let x = this.particles[offset]
        let y = this.particles[offset + 1]
        let previousX = x
        let previousY = y
        if (step > 0) {
          const midpointX = x + sample(velocityX, nx, ny, x, y) * step / (2 * DOMAIN_WIDTH)
          const midpointY = y + sample(velocityY, nx, ny, x, y) * step / 2
          x += sample(velocityX, nx, ny, midpointX, midpointY) * step / DOMAIN_WIDTH
          y += sample(velocityY, nx, ny, midpointX, midpointY) * step
          this.particles[offset + 2] += step
          if (x < 0 || x > 1 || y < 0 || y > 1 || this.particles[offset + 2] > 6 + this.particles[offset + 3] * 10) {
            x = previousX = this.random()
            y = previousY = this.random()
            this.particles[offset + 2] = 0
            this.particles[offset + 3] = this.random()
          }
          this.particles[offset] = x
          this.particles[offset + 1] = y
        }
        if (this.fresh) { previousX = x; previousY = y }
        const value = Math.max(-1, Math.min(1, sample(temperature, nx, ny, x, y)))
        const bin = Math.round(value * 16 + 16)
        // Canvas 原点在左上，因此只在显示阶段翻转 y 坐标。
        paths[bin].moveTo(previousX * width, (1 - previousY) * height)
        paths[bin].lineTo(x * width + 0.01, (1 - y) * height + 0.01)
      }
      for (let bin = 0; bin < paths.length; bin++) {
        const color = temperatureColor((bin - 16) / 16)
        this.trail.strokeStyle = `rgba(${color.join(',')},${this.fresh ? 0.9 : 0.48})`
        this.trail.stroke(paths[bin])
      }
      this.trail.globalCompositeOperation = 'source-over'
      this.fresh = false
    }
    this.context.fillStyle = '#06080c'
    this.context.fillRect(0, 0, width, height)
    if (showField) {
      if (!this.fieldImage || this.fieldImage.width !== nx || this.fieldImage.height !== ny) {
        this.fieldCanvas.width = nx
        this.fieldCanvas.height = ny
        this.fieldImage = this.fieldContext.createImageData(nx, ny)
      }
      const pixels = this.fieldImage.data
      for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++) {
          const value = temperature[x + y * nx]
          const color = temperatureColor(value)
          const offset = (x + (ny - 1 - y) * nx) * 4
          const alpha = Math.min(1, Math.abs(value)) ** 0.7 * 0.15
          pixels[offset] = color[0]
          pixels[offset + 1] = color[1]
          pixels[offset + 2] = color[2]
          pixels[offset + 3] = Math.round(alpha * 255)
        }
      }
      this.fieldContext.putImageData(this.fieldImage, 0, 0)
      this.context.imageSmoothingEnabled = true
      this.context.drawImage(this.fieldCanvas, 0, 0, width, height)
    }
    this.context.strokeStyle = 'rgba(130,160,190,0.045)'
    this.context.lineWidth = this.ratio * 0.5
    this.context.beginPath()
    for (let x = 1; x < 16; x++) { this.context.moveTo(x * width / 16, 0); this.context.lineTo(x * width / 16, height) }
    for (let y = 1; y < 10; y++) { this.context.moveTo(0, y * height / 10); this.context.lineTo(width, y * height / 10) }
    this.context.stroke()
    this.context.drawImage(this.trailCanvas, 0, 0)
  }

  destroy() {
    if (this.disposed) return
    this.disposed = true
    this.particles = new Float32Array(0)
    this.fieldImage = null
    this.previousTemperature = new Float32Array(0)
    this.trailCanvas.width = this.trailCanvas.height = 1
    this.fieldCanvas.width = this.fieldCanvas.height = 1
  }
}

export function createThermalRenderer(canvas: HTMLCanvasElement, quality: ParticleQuality, seed: number, preferCanvas = false): ThermalRenderer {
  if (!preferCanvas) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false })
    if (gl) return new WebGLThermalRenderer(canvas, gl, quality, seed)
  }
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('浏览器不支持此粒子画布，请使用更新的浏览器重试。')
  return new CanvasThermalRenderer(canvas, context, quality, seed)
}
