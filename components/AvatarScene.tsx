import { useEffect, useRef } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl'
import { Asset } from 'expo-asset'
import * as THREE from 'three'
import { ClothingItem } from '@/constants/types'
import { AvatarSlot, Outfit, SLOT_BOXES } from '@/utils/avatarSlots'

// Plain three + expo-gl (no react-three-fiber): fewer moving parts, and we
// control every call that touches the GL context.

// How far the garment sheet curves around the body, in radians.
const WRAP_ANGLE = 1.0
const SKIN = '#E3BFA6'
const MANNEQUIN = '#D9CFC8'
const FALLBACK_FABRIC = '#9a8f99'

// ─── Mannequin ────────────────────────────────────────────────────────────────
// Built from primitives so the app needs no model file. To use a real rigged
// model instead, swap this function for a GLB loader; the garment slots in
// utils/avatarSlots.ts are the only thing it has to line up with.

function part(geometry: THREE.BufferGeometry, color: string, x: number, y: number, z = 0) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }))
  mesh.position.set(x, y, z)
  return mesh
}

function buildMannequin(): THREE.Group {
  const g = new THREE.Group()
  g.add(part(new THREE.SphereGeometry(0.11, 24, 24), SKIN, 0, 1.64))
  g.add(part(new THREE.CylinderGeometry(0.045, 0.04, 0.12, 16), SKIN, 0, 1.5))

  const torso = part(new THREE.CylinderGeometry(0.2, 0.16, 0.6, 24), MANNEQUIN, 0, 1.2)
  torso.scale.set(1, 1, 0.6)
  g.add(torso)
  const hips = part(new THREE.SphereGeometry(0.18, 24, 24), MANNEQUIN, 0, 0.9)
  hips.scale.set(1, 1, 0.65)
  g.add(hips)

  const armGeo = new THREE.CylinderGeometry(0.05, 0.043, 0.62, 16)
  for (const side of [-1, 1]) {
    const arm = part(armGeo, SKIN, side * 0.27, 1.22)
    arm.rotation.z = -side * 0.08
    g.add(arm)
  }
  const legGeo = new THREE.CylinderGeometry(0.075, 0.064, 0.86, 16)
  const footGeo = new THREE.BoxGeometry(0.09, 0.07, 0.22)
  for (const side of [-1, 1]) {
    g.add(part(legGeo, MANNEQUIN, side * 0.09, 0.47))
    g.add(part(footGeo, MANNEQUIN, side * 0.09, 0.035, 0.04))
  }
  return g
}

// ─── Garments ─────────────────────────────────────────────────────────────────

function fabricColor(item: ClothingItem): THREE.Color {
  try {
    return new THREE.Color(item.color ?? FALLBACK_FABRIC)
  } catch {
    return new THREE.Color(FALLBACK_FABRIC)
  }
}

/**
 * Turn a local photo into a texture without any DOM Image: expo-gl can upload
 * an Asset straight from its file, so we hand it over as a DataTexture.
 */
async function loadTexture(uri: string): Promise<THREE.Texture | null> {
  try {
    const [asset, size] = await Promise.all([
      Asset.fromURI(uri).downloadAsync(),
      new Promise<{ width: number; height: number }>((resolve, reject) =>
        Image.getSize(uri, (width, height) => resolve({ width, height }), reject)),
    ])
    const texture = new THREE.DataTexture(asset as any, size.width, size.height, THREE.RGBAFormat)
    texture.flipY = true
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.generateMipmaps = false
    texture.needsUpdate = true
    return texture
  } catch {
    return null // fall back to a flat fabric colour
  }
}

/** A photo (or flat colour) bent into a shallow arc, sized to fit its slot. */
function buildSheet(
  slot: AvatarSlot, item: ClothingItem, texture: THREE.Texture | null,
  aspectHint: number | null, flip: boolean,
): THREE.Mesh {
  const box = SLOT_BOXES[slot]
  const aspect = aspectHint ?? box.width / box.height
  // "contain": largest size with the photo's aspect that fits the slot
  let width = box.width
  let height = width / aspect
  if (height > box.height) { height = box.height; width = height * aspect }

  const radius = width / WRAP_ANGLE
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 24, 1, true, -WRAP_ANGLE / 2, WRAP_ANGLE)
  const material = new THREE.MeshStandardMaterial({
    map: texture ?? undefined,
    color: texture ? '#ffffff' : fabricColor(item),
    transparent: true,
    alphaTest: 0.4,
    roughness: 0.9,
  })
  const mesh = new THREE.Mesh(geometry, material)
  const z = flip ? -box.z : box.z
  mesh.position.set(box.x, box.y, z - (flip ? -radius : radius))
  mesh.rotation.y = flip ? Math.PI : 0
  mesh.renderOrder = slot === 'outerwear' ? 2 : 1
  return mesh
}

async function buildGarment(slot: AvatarSlot, item: ClothingItem): Promise<THREE.Group> {
  const group = new THREE.Group()
  const front = item.photoUri ? await loadTexture(item.photoUri) : null
  const back = item.backPhotoUri ? await loadTexture(item.backPhotoUri) : front
  const aspectOf = (t: THREE.Texture | null) => {
    const img = t?.image as { width?: number; height?: number } | undefined
    return img?.width && img?.height ? img.width / img.height : null
  }
  group.add(buildSheet(slot, item, front, aspectOf(front), false))
  group.add(buildSheet(slot, item, back, aspectOf(back), true))
  return group
}

function disposeGroup(group: THREE.Object3D) {
  group.traverse(obj => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    const mat = mesh.material as THREE.MeshStandardMaterial
    mat.map?.dispose()
    mat.dispose()
  })
}

// ─── Scene ────────────────────────────────────────────────────────────────────

type SceneState = {
  garments: THREE.Group
  slots: Map<AvatarSlot, { id: string; group: THREE.Group }>
  syncing: boolean
  pending: Outfit | null
}

export default function AvatarScene({ outfit, rotationRef }: {
  outfit: Outfit
  rotationRef: { current: number }
}) {
  const state = useRef<SceneState | null>(null)
  const latestOutfit = useRef(outfit)
  latestOutfit.current = outfit
  const frame = useRef<number | null>(null)
  const alive = useRef(true)

  // Bring the garments in the scene in line with the outfit. Photos load
  // asynchronously, so only one sync runs at a time and the newest outfit wins.
  const sync = async (target: Outfit) => {
    const s = state.current
    if (!s) return
    if (s.syncing) { s.pending = target; return }
    s.syncing = true
    try {
      for (const [slot, entry] of [...s.slots]) {
        if (target[slot]?.id !== entry.id) {
          s.garments.remove(entry.group)
          disposeGroup(entry.group)
          s.slots.delete(slot)
        }
      }
      for (const slot of Object.keys(target) as AvatarSlot[]) {
        const item = target[slot]
        if (!item || s.slots.has(slot)) continue
        const group = await buildGarment(slot, item)
        if (!alive.current) { disposeGroup(group); return }
        s.garments.add(group)
        s.slots.set(slot, { id: item.id, group })
      }
    } finally {
      s.syncing = false
    }
    if (s.pending) {
      const next = s.pending
      s.pending = null
      sync(next)
    }
  }

  useEffect(() => { sync(outfit) }, [outfit]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (frame.current != null) cancelAnimationFrame(frame.current)
    }
  }, [])

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    const width = gl.drawingBufferWidth
    const height = gl.drawingBufferHeight

    // three expects a DOM canvas; give it just enough of one.
    const canvas = {
      width, height, clientWidth: width, clientHeight: height,
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      getContext: () => gl,
    } as unknown as HTMLCanvasElement

    const renderer = new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGLRenderingContext, antialias: true })
    renderer.setPixelRatio(1)
    renderer.setSize(width, height, false)
    renderer.setClearColor(0x000000, 0)

    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0xffffff, 1.6))
    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(2, 3, 4)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xffffff, 0.8)
    rim.position.set(-2, 1, -3)
    scene.add(rim)

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 50)
    camera.position.set(0, 0.2, 3.4)
    camera.lookAt(0, 0, 0)

    const stage = new THREE.Group()
    stage.position.y = -0.9
    stage.add(buildMannequin())
    const garments = new THREE.Group()
    stage.add(garments)
    scene.add(stage)

    state.current = { garments, slots: new Map(), syncing: false, pending: null }
    sync(latestOutfit.current)

    const render = () => {
      if (!alive.current) return
      // Ease toward the target yaw so drags feel smooth rather than steppy.
      stage.rotation.y += (rotationRef.current - stage.rotation.y) * 0.25
      renderer.render(scene, camera)
      gl.endFrameEXP()
      frame.current = requestAnimationFrame(render)
    }
    render()
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
    </View>
  )
}
