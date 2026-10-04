'use client'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * Interactive PC-6 model exported from the Blender build (hardware/blender). Node extras carry the part metadata:
 * pc_title, pc_desc, pc_spec, pc_group and pc_explode (Blender world offset in mm, Z-up).
 */
import { GROUP_LABEL } from './labels'
export { GROUP_LABEL }

interface Hover { title: string; desc: string; spec: string; group: string; x: number; y: number }

export default function DeviceViewer({ className = '', initialExplode = 0, controls = true, autoRotate = false, background = 'transparent' }: {
  className?: string; initialExplode?: number; controls?: boolean; autoRotate?: boolean; background?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<{ setExplode: (f: number) => void; setDoor: (a: number) => void; setFocus: (g: string | null) => void } | null>(null)
  const [explode, setExplode] = useState(initialExplode)
  const [door, setDoor] = useState(0)
  const [focus, setFocus] = useState<string | null>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const [loaded, setLoaded] = useState(0)
  const [ready, setReady] = useState(0)

  useEffect(() => {
    const el = host.current!
    let disposed = false
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.AgXToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50)
    camera.position.set(1.25, 0.85, 1.75)
    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.target.set(0, 0.25, 0)
    orbit.enableDamping = true
    orbit.minDistance = 0.5
    orbit.maxDistance = 5
    orbit.maxPolarAngle = Math.PI * 0.55
    orbit.autoRotate = autoRotate
    orbit.autoRotateSpeed = 0.6
    orbit.enabled = controls
    const sun = new THREE.DirectionalLight(0xffffff, 1.6)
    sun.position.set(-1.5, 3, 1.8)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -1.2; sun.shadow.camera.right = 1.2; sun.shadow.camera.top = 1.2; sun.shadow.camera.bottom = -1.2
    sun.shadow.radius = 6
    scene.add(sun)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.18 }))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    type Part = { obj: THREE.Object3D; home: THREE.Vector3; off: THREE.Vector3; group: string }
    const parts: Part[] = []
    const meshes: THREE.Mesh[] = []
    let pivot: THREE.Object3D | null = null
    let root: THREE.Object3D | null = null
    let lift = 0

    const draco = new DRACOLoader().setDecoderPath('/draco/')
    new GLTFLoader().setDRACOLoader(draco).load('/models/petricor.glb', (gltf) => {
      if (disposed) return
      root = gltf.scene
      root.traverse((o) => {
        const ud = o.userData as Record<string, unknown>
        if (o.name === 'Door_pivot') pivot = o
        if ((o as THREE.Mesh).isMesh) {
          const m = o as THREE.Mesh
          m.castShadow = true
          m.receiveShadow = true
          meshes.push(m)
          const mats = Array.isArray(m.material) ? m.material : [m.material]
          m.material = mats.map((mt) => {
            const c = (mt as THREE.MeshStandardMaterial).clone()
            c.userData.baseOpacity = c.opacity
            c.userData.baseTransparent = c.transparent
            const phys = c as THREE.MeshPhysicalMaterial
            if (phys.transmission > 0) { phys.transmission = 0; phys.transparent = true; phys.opacity = 0.28; phys.userData.baseOpacity = 0.28; phys.userData.baseTransparent = true; phys.depthWrite = false }
            return c
          }) as unknown as THREE.Material
          if (!Array.isArray(mats) || mats.length === 1) m.material = (m.material as unknown as THREE.Material[])[0]
        }
        // glTF exports custom props as extras on the node; meshes may be children of the named node
        const src = ud.pc_group ? o : null
        if (src && Array.isArray(ud.pc_explode)) {
          const e = ud.pc_explode as number[]
          parts.push({ obj: o, home: o.position.clone(), off: new THREE.Vector3(e[0], e[2], -e[1]).multiplyScalar(0.001), group: String(ud.pc_group) })
        }
      })
      scene.add(root)
      root.updateMatrixWorld(true)
      // convert world offsets into each part's parent space
      for (const p of parts) {
        const q = new THREE.Quaternion()
        p.obj.parent?.getWorldQuaternion(q)
        p.off.applyQuaternion(q.invert())
      }
      setLoaded(1)
      setReady((r) => r + 1)
    }, (e) => !disposed && setLoaded(e.total ? Math.min(0.99, e.loaded / e.total) : 0.5))

    const setExplodeF = (f: number) => {
      lift = 0.5 * f
      for (const p of parts) p.obj.position.copy(p.home).addScaledVector(p.off, f)
      if (root) root.position.y = lift * 0.9
      orbit.target.y = 0.25 + lift * 0.75
    }
    const setDoorF = (deg: number) => { if (pivot) (pivot as THREE.Object3D).rotation.x = (-deg * Math.PI) / 180 }
    const setFocusF = (g: string | null) => {
      for (const m of meshes) {
        let grp: string | null = null
        let o: THREE.Object3D | null = m
        while (o && !grp) { grp = (o.userData as { pc_group?: string }).pc_group ?? null; o = o.parent }
        const on = !g || grp === g
        m.castShadow = on
        const mats = Array.isArray(m.material) ? m.material : [m.material]
        for (const mt of mats) {
          mt.transparent = on ? mt.userData.baseTransparent : true
          mt.opacity = on ? mt.userData.baseOpacity : 0.06
          mt.depthWrite = on ? !mt.userData.baseTransparent : false
          mt.needsUpdate = true
        }
      }
    }
    api.current = { setExplode: setExplodeF, setDoor: setDoorF, setFocus: setFocusF }

    const ray = new THREE.Raycaster()
    const ptr = new THREE.Vector2()
    const onMove = (ev: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect()
      ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ptr, camera)
      const hit = ray.intersectObjects(meshes, false).find((h) => {
        const mt = (Array.isArray((h.object as THREE.Mesh).material) ? ((h.object as THREE.Mesh).material as THREE.Material[])[0] : (h.object as THREE.Mesh).material) as THREE.Material
        return mt.opacity > 0.2
      })
      if (!hit) { setHover(null); return }
      let o: THREE.Object3D | null = hit.object
      while (o && !(o.userData as { pc_title?: string }).pc_title) o = o.parent
      if (!o) { setHover(null); return }
      const ud = o.userData as { pc_title: string; pc_desc: string; pc_spec?: string; pc_group: string }
      setHover({ title: ud.pc_title, desc: ud.pc_desc, spec: ud.pc_spec ?? '', group: ud.pc_group, x: ev.clientX - r.left, y: ev.clientY - r.top })
    }
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerleave', () => setHover(null))

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    ro.observe(el)
    let raf = 0
    const loop = () => { orbit.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop) }
    loop()
    return () => {
      disposed = true
      cancelAnimationFrame(raf); ro.disconnect(); orbit.dispose(); renderer.dispose(); pmrem.dispose(); draco.dispose()
      el.removeChild(renderer.domElement)
    }
  }, [autoRotate, controls])

  useEffect(() => { api.current?.setExplode(explode) }, [explode, ready])
  useEffect(() => { api.current?.setDoor(door) }, [door, ready])
  useEffect(() => { api.current?.setFocus(focus) }, [focus, ready])

  return (
    <div className={`relative ${className}`} style={{ background }}>
      <div ref={host} className="absolute inset-0" />
      {loaded < 1 && <div className="absolute inset-0 grid place-items-center font-mono text-[12px] text-muted">Loading model {Math.round(loaded * 100)}%</div>}
      {hover && (
        <div className="pointer-events-none absolute z-10 w-72 rounded-xl bg-ink/92 p-3 text-white shadow-2xl backdrop-blur" style={{ left: Math.min(hover.x + 16, 9999), top: hover.y + 16 }}>
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-white/50">{GROUP_LABEL[hover.group] ?? hover.group}</div>
          <div className="mt-0.5 text-[14px] font-semibold">{hover.title}</div>
          {hover.desc && <div className="mt-1 text-[12.5px] leading-snug text-white/75">{hover.desc}</div>}
          {hover.spec && <div className="mt-2 font-mono text-[11px] text-[#aab0ff]">{hover.spec}</div>}
        </div>
      )}
      {controls && (
        <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-end gap-3 sm:inset-x-5 sm:bottom-5">
          <div className="flex-1 rounded-xl bg-white/85 px-4 py-3 shadow-sm ring-1 ring-black/5 backdrop-blur sm:max-w-[420px]">
            <label className="flex items-center gap-3 text-[12px]"><span className="w-14 font-mono uppercase tracking-wider text-muted">Explode</span>
              <input type="range" min={0} max={1} step={0.001} value={explode} onChange={(e) => setExplode(+e.target.value)} className="flex-1 accent-[#3a44ff]" /></label>
            <label className="mt-1.5 flex items-center gap-3 text-[12px]"><span className="w-14 font-mono uppercase tracking-wider text-muted">Door</span>
              <input type="range" min={0} max={80} step={0.5} value={door} onChange={(e) => setDoor(+e.target.value)} className="flex-1 accent-[#3a44ff]" /></label>
          </div>
          <div className="flex max-w-full flex-wrap gap-1.5">
            {['Imaging', 'Carousel', 'Climate', 'Humidity', 'Chamber', 'Printer', 'Electronics'].map((g) => (
              <button key={g} onClick={() => setFocus(focus === g ? null : g)} className={`rounded-full px-3 py-1.5 font-mono text-[11.5px] ring-1 backdrop-blur ${focus === g ? 'bg-blue text-white ring-blue' : 'bg-white/85 text-ink ring-black/10 hover:bg-white'}`}>{GROUP_LABEL[g]}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
