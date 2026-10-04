'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { DEFAULTS_3D, Mycelium3D, SEG_STRIDE, type Hypha3Params } from '@/lib/viz/hyphae3d'

export interface MyceliumStats { done?: boolean; t: number; tips: number; aerial: number; length: number; radius: number; height: number; branches: number; fusions: number; hgu: number; history: Mycelium3D['history']; events: Mycelium3D['events'] }

export type ViewPreset = 'angle' | 'top' | 'side'
/** Camera control for an explore-mode toolbar. Pitch is the camera's elevation above the agar, in degrees. */
export interface ViewApi { respawn(): void; preset(v: ViewPreset): void; zoom(factor: number): void; setPitch(deg: number): void; reset(): void; setAutoRotate(on: boolean): void }

interface Props {
  className?: string
  params?: Hypha3Params
  seed?: number
  /** sim minutes per real second */
  rate?: number
  running?: boolean
  /** regrow from a new spore after the colony settles */
  loop?: boolean
  /** viewer supports explore mode (orbit / pitch / zoom / pan) */
  controls?: boolean
  /** explore mode on: pointer and wheel go to the camera. Off: the page scrolls normally over the canvas. */
  interactive?: boolean
  autoRotate?: boolean
  /** show the colony as it was at this sim minute (null = live) */
  cut?: number | null
  /** grow the whole colony ahead of playback (in small per-frame slices) so any time can be shown; the caller drives `cut` */
  precompute?: boolean
  background?: string
  /** camera framing: 'hero' sits lower and wider; 'lab' looks down more */
  framing?: 'hero' | 'lab'
  onStats?: (s: MyceliumStats) => void
  onDone?: () => void
  onReady?: (api: ViewApi) => void
  onView?: (v: { pitch: number; dist: number }) => void
}

const MAX_SEGS = 600_000
const UM = 1 / 1000 // µm → scene units (1 unit = 1 mm)

const lineVS = /* glsl */ `
  attribute vec3 color; attribute float birth;
  uniform float uTime; uniform float uGlow; uniform float uCut;
  varying vec3 vC; varying float vShow;
  void main() {
    vShow = birth <= uCut ? 1.0 : 0.0;
    float age = max(0.0, uTime - birth);
    vC = color * (0.55 + 2.2 * exp(-age / uGlow));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`
const lineFS = /* glsl */ `
  uniform float uFade; varying vec3 vC; varying float vShow;
  void main() { if (vShow < 0.5) discard; gl_FragColor = vec4(vC, uFade); }`
const tipVS = /* glsl */ `
  uniform float uSize; uniform float uScale;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`
const tipFS = /* glsl */ `
  uniform float uFade; uniform vec3 uColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor * a * a, uFade * a);
  }`
const agarFS = /* glsl */ `
  varying vec2 vUv; uniform float uFade;
  void main() {
    vec2 p = vUv * 2.0 - 1.0; float r = length(p);
    float disc = smoothstep(1.0, 0.985, r);
    float rings = smoothstep(0.012, 0.0, abs(fract(r * 6.0) - 0.5) - 0.488) * 0.35;
    float rim = smoothstep(0.02, 0.0, abs(r - 0.992));
    // linear values: OutputPass encodes to sRGB, so keep these very small
    vec3 base = mix(vec3(0.0035, 0.0055, 0.0085), vec3(0.0012, 0.0016, 0.0026), r);
    vec3 c = base * disc + vec3(0.006, 0.012, 0.022) * rings * disc * (1.0 - r) + vec3(0.03, 0.04, 0.14) * rim;
    gl_FragColor = vec4(c * uFade, max(disc, rim));
  }`
const agarVS = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

export default function Mycelium3DView({ className = '', params = DEFAULTS_3D, seed = 7, rate = 30, running = true, loop = false, controls = false, interactive = false, autoRotate = true, cut = null, precompute = false, background = '#06070a', framing = 'hero', onStats, onDone, onReady, onView }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const live = useRef({ params, rate, running, loop, cut, onStats, onDone, onView })
  const orbitRef = useRef<OrbitControls | null>(null)
  useEffect(() => { live.current = { params, rate, running, loop, cut, onStats, onDone, onView } })
  // explore mode: only then do drag / wheel / touch reach the camera, so the page scrolls normally otherwise
  useEffect(() => {
    const o = orbitRef.current
    if (!o) return
    o.enabled = interactive
    o.enablePan = interactive
    const dom = o.domElement as HTMLElement | null
    if (dom) { dom.style.touchAction = interactive ? 'none' : 'auto'; dom.style.cursor = interactive ? 'grab' : 'default' }
  }, [interactive])

  useEffect(() => {
    const el = host.current!
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.setClearColor(new THREE.Color(background), 1)
    renderer.toneMapping = THREE.ACESFilmicToneMapping // dense cores roll off instead of clipping to white
    renderer.toneMappingExposure = 1.15
    el.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(background)
    const camera = new THREE.PerspectiveCamera(framing === 'hero' ? 32 : 36, 1, 0.01, 50)
    const target = new THREE.Vector3(0, framing === 'hero' ? 0.12 : 0.06, 0)
    const dist = framing === 'hero' ? 3.6 : 4.3
    const elev = framing === 'hero' ? 0.42 : 0.72
    let az = 0.6
    const orbit = controls ? new OrbitControls(camera, renderer.domElement) : null
    if (orbit) {
      orbit.target.copy(target); orbit.enableDamping = true; orbit.minDistance = 1.2; orbit.maxDistance = 8; orbit.maxPolarAngle = Math.PI * 0.495
      orbit.autoRotate = autoRotate && !reduce; orbit.autoRotateSpeed = 0.35
      orbit.enabled = false; orbit.enablePan = false
      renderer.domElement.style.touchAction = 'auto'
      orbitRef.current = orbit
    }
    const place = () => { camera.position.set(target.x + Math.sin(az) * Math.cos(elev) * dist, target.y + Math.sin(elev) * dist, target.z + Math.cos(az) * Math.cos(elev) * dist); camera.lookAt(target) }
    place()
    orbit?.update()

    // camera fly-to (spherical around the orbit target), used by the explore toolbar
    const sph = new THREE.Spherical(), off = new THREE.Vector3()
    let fly: { from: THREE.Spherical; to: THREE.Spherical; t: number } | null = null
    const current = () => { off.copy(camera.position).sub(orbit ? orbit.target : target); return new THREE.Spherical().setFromVector3(off) }
    const flyTo = (to: { theta?: number; phi?: number; radius?: number }) => {
      const from = current()
      const s2 = from.clone()
      if (to.theta !== undefined) {
        // shortest way round
        let d = to.theta - from.theta; d = Math.atan2(Math.sin(d), Math.cos(d)); s2.theta = from.theta + d
      }
      if (to.phi !== undefined) s2.phi = Math.min(Math.PI * 0.495, Math.max(0.02, to.phi))
      if (to.radius !== undefined) s2.radius = Math.min(8, Math.max(1.2, to.radius))
      fly = { from, to: s2, t: 0 }
    }
    const api: ViewApi = {
      respawn: () => { if (phase !== 'fadeout') { phase = 'fadeout'; phaseT = 0 } },
      preset: (v) => flyTo(v === 'top' ? { phi: 0.03, radius: dist * 1.05 } : v === 'side' ? { phi: Math.PI * 0.49, radius: dist } : { theta: 0.6, phi: Math.PI / 2 - elev, radius: dist }),
      zoom: (f) => flyTo({ radius: current().radius / f }),
      setPitch: (deg) => { const c = current(); c.phi = Math.PI / 2 - (deg * Math.PI) / 180; c.phi = Math.min(Math.PI * 0.495, Math.max(0.02, c.phi)); off.setFromSpherical(c); camera.position.copy(orbit ? orbit.target : target).add(off); fly = null },
      reset: () => { orbit?.target.copy(target); flyTo({ theta: 0.6, phi: Math.PI / 2 - elev, radius: dist }) },
      setAutoRotate: (on) => { if (orbit) orbit.autoRotate = on && !reduce },
    }
    onReady?.(api)
    let lastView = ''

    // agar disc
    const agarMat = new THREE.ShaderMaterial({ vertexShader: agarVS, fragmentShader: agarFS, transparent: true, depthWrite: false, uniforms: { uFade: { value: 1 } } })
    const agar = new THREE.Mesh(new THREE.PlaneGeometry(2.56, 2.56), agarMat)
    agar.rotation.x = -Math.PI / 2
    agar.position.y = -0.004
    scene.add(agar)

    // hyphae
    const pos = new Float32Array(MAX_SEGS * 6), col = new Float32Array(MAX_SEGS * 6), birth = new Float32Array(MAX_SEGS * 2)
    const geo = new THREE.BufferGeometry()
    const aPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)
    const aCol = new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage)
    const aBirth = new THREE.BufferAttribute(birth, 1).setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('position', aPos); geo.setAttribute('color', aCol); geo.setAttribute('birth', aBirth)
    geo.setDrawRange(0, 0)
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.2, 0), 2)
    const lineMat = new THREE.ShaderMaterial({ vertexShader: lineVS, fragmentShader: lineFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uGlow: { value: 25 }, uFade: { value: 1 }, uCut: { value: 1e9 } } })
    const lines = new THREE.LineSegments(geo, lineMat)
    lines.frustumCulled = false
    scene.add(lines)

    // tips
    const MAXT = 7000
    const tPos = new Float32Array(MAXT * 3)
    const tGeo = new THREE.BufferGeometry()
    const aT = new THREE.BufferAttribute(tPos, 3).setUsage(THREE.DynamicDrawUsage)
    tGeo.setAttribute('position', aT)
    const tipMat = new THREE.ShaderMaterial({ vertexShader: tipVS, fragmentShader: tipFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uSize: { value: 0.009 }, uScale: { value: 800 }, uFade: { value: 1 }, uColor: { value: new THREE.Color(0.45, 0.7, 0.85) } } })
    const tips = new THREE.Points(tGeo, tipMat)
    tips.frustumCulled = false
    scene.add(tips)

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.48, 0.35, 0.18)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())

    const resize = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1
      renderer.setSize(w, h, false)
      composer.setSize(w, h)
      renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'
      camera.aspect = w / h
      // keep the whole dish in frame on narrow screens
      camera.fov = (framing === 'hero' ? 32 : 36) * Math.max(1, 1.15 / camera.aspect)
      camera.updateProjectionMatrix()
      tipMat.uniforms.uScale.value = h * renderer.getPixelRatio()
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(el)

    // palette: substrate hyphae teal → electric blue by branch order; aerial hyphae pale cyan
    const cSub = new THREE.Color(), cA = new THREE.Color('#3fe0d0'), cB = new THREE.Color('#4b55ff'), cAer = new THREE.Color('#bfeaff')
    let sim = new Mycelium3D(live.current.params, 1200, seed)
    let nSeg = 0
    let spore = seed
    let phase: 'grow' | 'hold' | 'fadeout' | 'fadein' = 'fadein'
    let simDone = false
    let phaseT = 0, fade = 0
    const reset = () => {
      simDone = false
      sim = new Mycelium3D(live.current.params, 1200, spore)
      nSeg = 0
      geo.setDrawRange(0, 0)
    }
    reset()

    const pushSegs = () => {
      const s = sim.segs, n = Math.min(sim.nSegs, MAX_SEGS - nSeg)
      if (n <= 0) return
      for (let k = 0; k < n; k++) {
        const o = k * SEG_STRIDE, v = (nSeg + k) * 6, b = (nSeg + k) * 2
        // sim (x, y, z-up) → scene (x, z, -y)
        pos[v] = s[o] * UM; pos[v + 1] = s[o + 2] * UM; pos[v + 2] = -s[o + 1] * UM
        pos[v + 3] = s[o + 3] * UM; pos[v + 4] = s[o + 5] * UM; pos[v + 5] = -s[o + 4] * UM
        const aer = s[o + 7] > 0.5
        if (aer) { cSub.copy(cAer).multiplyScalar(0.042) } else { cSub.copy(cA).lerp(cB, Math.min(1, s[o + 6] / 9)).multiplyScalar(s[o + 6] === 0 ? 0.4 : 0.17) }
        col[v] = col[v + 3] = cSub.r; col[v + 1] = col[v + 4] = cSub.g; col[v + 2] = col[v + 5] = cSub.b
        birth[b] = birth[b + 1] = sim.t
      }
      aPos.addUpdateRange(nSeg * 6, n * 6); aCol.addUpdateRange(nSeg * 6, n * 6); aBirth.addUpdateRange(nSeg * 2, n * 2)
      aPos.needsUpdate = aCol.needsUpdate = aBirth.needsUpdate = true
      nSeg += n
      geo.setDrawRange(0, nSeg * 2)
    }
    const pushTips = () => {
      let n = 0
      for (const t of sim.tips) {
        if (!t.alive || n >= MAXT) continue
        tPos[n * 3] = t.x * UM; tPos[n * 3 + 1] = t.z * UM; tPos[n * 3 + 2] = -t.y * UM
        n++
      }
      tGeo.setDrawRange(0, n)
      aT.needsUpdate = true
    }

    let visible = true
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { rootMargin: '120px' })
    io.observe(el)
    let pointerX = 0, px = 0
    const onMove = (e: PointerEvent) => { pointerX = (e.clientX / window.innerWidth) * 2 - 1 }
    if (!controls) window.addEventListener('pointermove', onMove)

    const stats = () => live.current.onStats?.({ done: simDone, t: sim.t, tips: sim.tips.reduce((a, t) => a + (t.alive ? 1 : 0), 0), aerial: sim.aerialTips, length: sim.length, radius: sim.radius, height: sim.height, branches: sim.branches, fusions: sim.fusions.length, hgu: sim.hgu, history: sim.history, events: sim.events })

    const STEP = 0.75 // sim minutes per model step
    let acc = 0
    const grow = (budget: number) => {
      let alive = 1
      for (let i = 0; i < budget && alive; i++) {
        alive = sim.step(STEP)
        pushSegs()
        if (nSeg >= MAX_SEGS) alive = 0
      }
      return alive
    }

    if (reduce) {
      // reduced motion: grow a full colony once and show it still
      let alive = 1
      while (alive && sim.t < 900) alive = grow(50)
      lineMat.uniforms.uTime.value = sim.t + 1e4
      pushTips(); stats()
    }

    let raf = 0, frame = 0, last = performance.now()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      if (!visible || document.hidden) return
      if (!reduce && live.current.running && precompute) {
        phaseT += dt
        // grow ahead of the playhead within a frame budget; playback (cut) is driven by the caller
        if (!simDone) {
          const end = performance.now() + 6
          while (!simDone && performance.now() < end) { const alive = grow(1); if (!alive || sim.t > 1100) simDone = true }
          if (simDone) live.current.onDone?.()
        }
        if (phase === 'fadein') { fade = Math.min(1, fade + dt / 0.8); if (fade >= 1) phase = 'grow' }
        else if (phase === 'fadeout') { fade = Math.max(0, fade - dt / 1.2); if (fade <= 0) { spore += 1; reset(); phase = 'fadein' } }
        const at = Math.min(live.current.cut ?? sim.t, sim.t)
        lineMat.uniforms.uCut.value = at
        lineMat.uniforms.uTime.value = at
        if (frame++ % 6 === 0) stats()
      } else if (!reduce && live.current.running) {
        phaseT += dt
        if (phase === 'fadein') { fade = Math.min(1, fade + dt / 0.8); if (fade >= 1) { phase = 'grow'; phaseT = 0 } }
        if (phase === 'grow' || phase === 'fadein') {
          acc = Math.min(acc + dt * live.current.rate, STEP * 4)
          const n = Math.floor(acc / STEP); acc -= n * STEP
          const alive = n ? grow(n) : 1
          if (!alive || sim.t > 1100) { phase = 'hold'; phaseT = 0; live.current.onDone?.() }
        } else if (phase === 'hold' && live.current.loop && live.current.cut == null && phaseT > 6) { phase = 'fadeout'; phaseT = 0 }
        else if (phase === 'fadeout') { fade = Math.max(0, fade - dt / 1.2); if (fade <= 0) { spore += 1; reset(); phase = 'fadein' } }
        const cutAt = live.current.cut
        lineMat.uniforms.uCut.value = cutAt ?? 1e9
        lineMat.uniforms.uTime.value = cutAt ?? sim.t // when scrubbing, the growth front at that minute glows
        pushTips()
        if (frame++ % 8 === 0) stats()
      } else if (reduce) fade = 1
      lineMat.uniforms.uFade.value = fade
      tipMat.uniforms.uFade.value = precompute || live.current.cut != null ? 0 : fade * (phase === 'hold' ? Math.max(0, 1 - phaseT / 2) : 1)
      if (fly) {
        fly.t = Math.min(1, fly.t + dt / 0.7)
        const e = fly.t < 0.5 ? 4 * fly.t ** 3 : 1 - (-2 * fly.t + 2) ** 3 / 2
        sph.set(fly.from.radius + (fly.to.radius - fly.from.radius) * e, fly.from.phi + (fly.to.phi - fly.from.phi) * e, fly.from.theta + (fly.to.theta - fly.from.theta) * e)
        camera.position.copy(orbit ? orbit.target : target).add(off.setFromSpherical(sph))
        camera.lookAt(orbit ? orbit.target : target)
        if (fly.t >= 1) fly = null
      }
      if (orbit) {
        orbit.update()
        const c = current(), v = `${Math.round(90 - (c.phi * 180) / Math.PI)}:${c.radius.toFixed(2)}`
        if (v !== lastView && frame % 4 === 0) { lastView = v; live.current.onView?.({ pitch: 90 - (c.phi * 180) / Math.PI, dist: c.radius }) }
      }
      else {
        if (!reduce && autoRotate) az += dt * 0.06
        px += (pointerX - px) * 0.04
        const keep = az
        az += px * 0.18
        place()
        az = keep
      }
      composer.render()
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect()
      window.removeEventListener('pointermove', onMove)
      orbit?.dispose(); orbitRef.current = null
      geo.dispose(); tGeo.dispose(); lineMat.dispose(); tipMat.dispose(); agarMat.dispose(); agar.geometry.dispose()
      composer.dispose(); renderer.dispose()
      el.removeChild(renderer.domElement)
    }
  }, [seed, controls, framing, background, autoRotate, precompute]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={host} className={className} />
}
