/**
 * WebGL post-processing pipeline.
 *
 * The 2D scene is rendered to an offscreen canvas, uploaded as a texture, and
 * run through: bright-pass → separable Gaussian bloom (ping-pong, half-res) →
 * composite with chromatic aberration, vignette and film grain. This is the
 * bulk of the "high-end" look. Init returns false if WebGL is unavailable, so
 * the caller can fall back to plain 2D.
 */

const VERT = `
attribute vec2 a;
varying vec2 v;
void main() {
  v = a * 0.5 + 0.5;
  gl_Position = vec4(a, 0.0, 1.0);
}`;

const BRIGHT = `
precision highp float;
varying vec2 v;
uniform sampler2D scene;
uniform float threshold;
void main() {
  vec3 c = texture2D(scene, v).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float k = max(0.0, l - threshold) / max(l, 1e-4);
  gl_FragColor = vec4(c * k * 1.5, 1.0);
}`;

const BLUR = `
precision highp float;
varying vec2 v;
uniform sampler2D tex;
uniform vec2 dir;
void main() {
  vec3 s = texture2D(tex, v).rgb * 0.227027;
  s += texture2D(tex, v + dir * 1.3846).rgb * 0.316216;
  s += texture2D(tex, v - dir * 1.3846).rgb * 0.316216;
  s += texture2D(tex, v + dir * 3.2307).rgb * 0.070270;
  s += texture2D(tex, v - dir * 3.2307).rgb * 0.070270;
  gl_FragColor = vec4(s, 1.0);
}`;

const COMPOSITE = `
precision highp float;
varying vec2 v;
uniform sampler2D scene;
uniform sampler2D bloom;
uniform vec2 res;
uniform float time;
uniform float bloomStrength;
uniform float caAmt;
uniform float vig;
uniform float motion;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 uv = v;
  vec2 dir = uv - 0.5;
  float d = dot(dir, dir);
  vec2 off = dir * caAmt * (0.3 + d);
  vec3 col;
  col.r = texture2D(scene, uv + off).r;
  col.g = texture2D(scene, uv).g;
  col.b = texture2D(scene, uv - off).b;
  col += texture2D(bloom, uv).rgb * bloomStrength;
  float vg = smoothstep(1.15, 0.25, d * 2.4);
  col *= mix(1.0, vg, vig);
  float g = hash(uv * res + fract(time)) * 2.0 - 1.0;
  col += g * 0.015 * motion;
  gl_FragColor = vec4(col, 1.0);
}`;

interface Target {
  fb: WebGLFramebuffer;
  tex: WebGLTexture;
}

export class PostFX {
  private gl: WebGLRenderingContext | null = null;
  private quad: WebGLBuffer | null = null;
  private sceneTex: WebGLTexture | null = null;
  private bright!: WebGLProgram;
  private blur!: WebGLProgram;
  private composite!: WebGLProgram;
  private a!: Target;
  private b!: Target;
  private w = 2;
  private h = 2;
  private bw = 1;
  private bh = 1;

  init(canvas: HTMLCanvasElement): boolean {
    const gl =
      (canvas.getContext('webgl', {
        premultipliedAlpha: false,
        antialias: false,
      }) as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return false;
    this.gl = gl;
    try {
      this.bright = this.program(VERT, BRIGHT);
      this.blur = this.program(VERT, BLUR);
      this.composite = this.program(VERT, COMPOSITE);
    } catch {
      this.gl = null;
      return false;
    }
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.sceneTex = this.makeTex();
    return true;
  }

  resize(deviceW: number, deviceH: number): void {
    const gl = this.gl;
    if (!gl) return;
    this.w = Math.max(2, deviceW);
    this.h = Math.max(2, deviceH);
    this.bw = Math.max(1, Math.floor(this.w / 2));
    this.bh = Math.max(1, Math.floor(this.h / 2));
    this.a = this.target(this.bw, this.bh, this.a);
    this.b = this.target(this.bw, this.bh, this.b);
  }

  render(scene: HTMLCanvasElement, timeSec: number, motion = 1): void {
    const gl = this.gl;
    if (!gl || !this.sceneTex) return;

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    // bright pass → a (half res)
    gl.viewport(0, 0, this.bw, this.bh);
    this.bindTarget(this.a);
    gl.useProgram(this.bright);
    this.bindQuad(this.bright);
    this.tex(this.bright, 'scene', this.sceneTex, 0);
    gl.uniform1f(gl.getUniformLocation(this.bright, 'threshold'), 0.42);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // separable blur, 2 iterations
    for (let i = 0; i < 2; i++) {
      this.doBlur(this.a, this.b, 1 / this.bw, 0);
      this.doBlur(this.b, this.a, 0, 1 / this.bh);
    }

    // composite → screen
    gl.viewport(0, 0, this.w, this.h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this.composite);
    this.bindQuad(this.composite);
    this.tex(this.composite, 'scene', this.sceneTex, 0);
    this.tex(this.composite, 'bloom', this.a.tex, 1);
    gl.uniform2f(gl.getUniformLocation(this.composite, 'res'), this.w, this.h);
    gl.uniform1f(gl.getUniformLocation(this.composite, 'time'), timeSec);
    gl.uniform1f(gl.getUniformLocation(this.composite, 'bloomStrength'), 1.7);
    gl.uniform1f(gl.getUniformLocation(this.composite, 'caAmt'), 0.004);
    gl.uniform1f(gl.getUniformLocation(this.composite, 'vig'), 0.55);
    gl.uniform1f(gl.getUniformLocation(this.composite, 'motion'), motion);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---- internals ----------------------------------------------------------

  private doBlur(from: Target, to: Target, dx: number, dy: number): void {
    const gl = this.gl!;
    this.bindTarget(to);
    gl.useProgram(this.blur);
    this.bindQuad(this.blur);
    this.tex(this.blur, 'tex', from.tex, 0);
    gl.uniform2f(gl.getUniformLocation(this.blur, 'dir'), dx, dy);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private bindTarget(t: Target): void {
    const gl = this.gl!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
  }

  private bindQuad(prog: WebGLProgram): void {
    const gl = this.gl!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  private tex(prog: WebGLProgram, name: string, tex: WebGLTexture, unit: number): void {
    const gl = this.gl!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
  }

  private makeTex(): WebGLTexture {
    const gl = this.gl!;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }

  private target(w: number, h: number, old?: Target): Target {
    const gl = this.gl!;
    if (old) {
      gl.deleteFramebuffer(old.fb);
      gl.deleteTexture(old.tex);
    }
    const tex = this.makeTex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fb, tex };
  }

  private program(vs: string, fs: string): WebGLProgram {
    const gl = this.gl!;
    const p = gl.createProgram()!;
    gl.attachShader(p, this.shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, this.shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('link failed: ' + gl.getProgramInfoLog(p));
    }
    return p;
  }

  private shader(type: number, src: string): WebGLShader {
    const gl = this.gl!;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('compile failed: ' + gl.getShaderInfoLog(s));
    }
    return s;
  }
}
