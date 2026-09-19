import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import type { AssetCard } from '../../model/types'
import { extOf } from '../../model/assetKind'
import { useAssetUrl } from '../useAssetUrl'
import { useWorkspace } from '../../store/workspace'
import { Loading } from './Loading'

async function loadModel(url: string, ext: string): Promise<THREE.Object3D> {
  switch (ext) {
    case 'glb':
    case 'gltf': {
      const gltf = await new GLTFLoader().loadAsync(url)
      return gltf.scene
    }
    case 'obj':
      return new OBJLoader().loadAsync(url)
    case 'fbx':
      return new FBXLoader().loadAsync(url)
    case 'stl': {
      const geo = await new STLLoader().loadAsync(url)
      geo.computeVertexNormals()
      return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8ac47e, roughness: 0.6 }))
    }
    default:
      throw new Error(`unsupported 3D format .${ext}`)
  }
}

export default function ModelPreview({ card, boardId, readOnly }: { card: AssetCard; boardId: string; readOnly: boolean }) {
  const { url, error } = useAssetUrl(card.path, card.mime)
  const updateCard = useWorkspace((s) => s.updateCard)
  const host = useRef<HTMLDivElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const [stats, setStats] = useState<string | null>(null)
  // read the saved view once per mount; later orbiting writes back without re-running the effect
  const savedView = useRef(card.view)
  const resetRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const el = host.current
    if (!url || !el) return
    let alive = true
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)
    renderer.domElement.setAttribute('data-nodrag', '')
    renderer.domElement.style.display = 'block'
    // setSize(..., false) leaves CSS size alone; pin it so the 2x backing store isn't shown at 2x
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    const stopWheel = (e: WheelEvent) => e.stopPropagation()
    const stopPointer = (e: PointerEvent) => e.stopPropagation()
    renderer.domElement.addEventListener('wheel', stopWheel, { passive: false })
    renderer.domElement.addEventListener('pointerdown', stopPointer)
    renderer.domElement.addEventListener('dblclick', (e) => e.stopPropagation())

    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334433, 1.6))
    const dir = new THREE.DirectionalLight(0xffffff, 1.8)
    dir.position.set(3, 5, 4)
    scene.add(dir)
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    // persist the view angle on the card when the user stops orbiting
    let saveTimer: ReturnType<typeof setTimeout> | undefined
    controls.addEventListener('end', () => {
      if (readOnly) return
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        const p = camera.position
        const t = controls.target
        const r = (n: number) => Math.round(n * 1000) / 1000
        updateCard(boardId, card.id, { view: { pos: [r(p.x), r(p.y), r(p.z)], target: [r(t.x), r(t.y), r(t.z)] } })
      }, 250)
    })

    let raf = 0
    let mixer: THREE.AnimationMixer | null = null
    const clock = new THREE.Clock()
    const render = () => renderer.render(scene, camera)
    const loop = () => {
      if (!alive) return
      const dt = clock.getDelta()
      if (mixer) mixer.update(dt)
      controls.update()
      render()
      raf = requestAnimationFrame(loop)
    }

    const resize = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      render()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    loadModel(url, extOf(card.path))
      .then((obj) => {
        if (!alive) return
        // fit to view: wrap in a pivot and shift so the bounding-box center sits at the origin
        obj.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(obj, true)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const pivot = new THREE.Group()
        pivot.add(obj)
        obj.position.sub(center)
        const radius = Math.max(size.x, size.y, size.z) || 1
        scene.add(pivot)
        const grid = new THREE.GridHelper(radius * 2, 10, 0x5d9b4c, 0x2a3a2c)
        grid.position.y = -size.y / 2
        scene.add(grid)
        const defaultView = () => {
          camera.position.set(radius * 1.2, radius * 0.9, radius * 1.6)
          controls.target.set(0, 0, 0)
          controls.update()
        }
        camera.near = radius / 100
        camera.far = radius * 100
        camera.updateProjectionMatrix()
        const v = savedView.current
        if (v) {
          camera.position.set(...v.pos)
          controls.target.set(...v.target)
          controls.update()
        } else {
          defaultView()
        }
        resetRef.current = () => {
          defaultView()
          if (!readOnly) updateCard(boardId, card.id, { view: undefined })
        }
        let tris = 0
        obj.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.isMesh && m.geometry) {
            const g = m.geometry as THREE.BufferGeometry
            tris += (g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3
            // previews shouldn't look hollow because of reversed winding in an export
            for (const mat of Array.isArray(m.material) ? m.material : [m.material]) if (mat) mat.side = THREE.DoubleSide
          }
        })
        const anims = (obj as THREE.Object3D & { animations?: THREE.AnimationClip[] }).animations
        if (anims?.length) {
          mixer = new THREE.AnimationMixer(obj)
          mixer.clipAction(anims[0]).play()
        }
        setStats(`${Math.round(tris).toLocaleString()} tris${anims?.length ? ` · ${anims.length} anim` : ''}`)
        resize()
        loop()
      })
      .catch((e) => alive && setErr((e as Error).message || String(e)))

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      clearTimeout(saveTimer)
      resetRef.current = null
      controls.dispose()
      renderer.domElement.removeEventListener('wheel', stopWheel)
      renderer.domElement.removeEventListener('pointerdown', stopPointer)
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) {
          m.geometry?.dispose()
          const mats = Array.isArray(m.material) ? m.material : [m.material]
          mats.forEach((mat) => mat?.dispose())
        }
      })
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [url, card.name, boardId, card.id, readOnly, updateCard])

  if (error || err) return <Loading error={error || err} />
  return (
    <div className="relative h-full w-full">
      <div ref={host} className="h-full w-full cursor-grab active:cursor-grabbing" />
      {!url && (
        <div className="absolute inset-0">
          <Loading />
        </div>
      )}
      {stats && <div className="pointer-events-none absolute left-1 top-1 rounded bg-black/50 px-1 text-[10px] text-frog-100">{stats}</div>}
      {stats && !readOnly && (
        <button
          data-nodrag
          title="Reset view"
          onClick={() => resetRef.current?.()}
          className="absolute right-1 top-1 rounded bg-black/50 px-1.5 text-[11px] text-frog-100 hover:bg-frog-700"
        >
          ⟲
        </button>
      )}
    </div>
  )
}
