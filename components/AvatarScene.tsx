import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useLoader } from '@react-three/fiber/native'
import { ClothingItem } from '@/constants/types'
import { AvatarSlot, Outfit, SLOT_BOXES } from '@/utils/avatarSlots'

// How far the garment sheet curves around the body, in radians.
const WRAP_ANGLE = 1.0
const SKIN = '#E3BFA6'
const MANNEQUIN = '#D9CFC8'

// ─── Mannequin ────────────────────────────────────────────────────────────────
// Built from primitives so the app needs no model file. To use a real rigged
// model instead, replace this component with a `useGLTF`-style loader; the
// garment slots in utils/avatarSlots.ts are the only thing it has to line up with.

function Limb({ position, radius, length, color = MANNEQUIN, tilt = 0 }: {
  position: [number, number, number]; radius: number; length: number; color?: string; tilt?: number
}) {
  return (
    <mesh position={position} rotation={[0, 0, tilt]}>
      <cylinderGeometry args={[radius, radius * 0.85, length, 16]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  )
}

function Mannequin() {
  return (
    <group>
      {/* head + neck */}
      <mesh position={[0, 1.64, 0]}>
        <sphereGeometry args={[0.11, 24, 24]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      <Limb position={[0, 1.5, 0]} radius={0.045} length={0.12} color={SKIN} />
      {/* torso + hips (flattened front-to-back) */}
      <mesh position={[0, 1.2, 0]} scale={[1, 1, 0.6]}>
        <cylinderGeometry args={[0.2, 0.16, 0.6, 24]} />
        <meshStandardMaterial color={MANNEQUIN} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.9, 0]} scale={[1, 1, 0.65]}>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshStandardMaterial color={MANNEQUIN} roughness={0.8} />
      </mesh>
      {/* arms */}
      <Limb position={[-0.27, 1.22, 0]} radius={0.05} length={0.62} tilt={0.08} color={SKIN} />
      <Limb position={[0.27, 1.22, 0]} radius={0.05} length={0.62} tilt={-0.08} color={SKIN} />
      {/* legs */}
      <Limb position={[-0.09, 0.47, 0]} radius={0.075} length={0.86} />
      <Limb position={[0.09, 0.47, 0]} radius={0.075} length={0.86} />
      {/* feet */}
      <mesh position={[-0.09, 0.035, 0.04]}>
        <boxGeometry args={[0.09, 0.07, 0.22]} />
        <meshStandardMaterial color={MANNEQUIN} roughness={0.8} />
      </mesh>
      <mesh position={[0.09, 0.035, 0.04]}>
        <boxGeometry args={[0.09, 0.07, 0.22]} />
        <meshStandardMaterial color={MANNEQUIN} roughness={0.8} />
      </mesh>
    </group>
  )
}

// ─── Garments ─────────────────────────────────────────────────────────────────

function fabricColor(item: ClothingItem): THREE.Color {
  try {
    return new THREE.Color(item.color ?? '#9a8f99')
  } catch {
    return new THREE.Color('#9a8f99')
  }
}

/**
 * A photo (or flat colour) bent into a shallow arc, sized to fit its slot.
 * `flip` turns it to face the back of the avatar.
 */
function Sheet({ slot, texture, item, flip }: {
  slot: AvatarSlot; texture: THREE.Texture | null; item: ClothingItem; flip?: boolean
}) {
  const box = SLOT_BOXES[slot]

  const { width, height } = useMemo(() => {
    const img = texture?.image as { width?: number; height?: number } | undefined
    const aspect = img?.width && img?.height ? img.width / img.height : box.width / box.height
    // "contain": largest size with the photo's aspect that fits the slot
    let w = box.width
    let h = w / aspect
    if (h > box.height) { h = box.height; w = h * aspect }
    return { width: w, height: h }
  }, [texture, box])

  const radius = width / WRAP_ANGLE
  const geometry = useMemo(
    () => new THREE.CylinderGeometry(radius, radius, height, 24, 1, true, -WRAP_ANGLE / 2, WRAP_ANGLE),
    [radius, height],
  )

  const color = useMemo(() => fabricColor(item), [item])
  const z = flip ? -box.z : box.z

  return (
    <mesh
      geometry={geometry}
      position={[box.x, box.y, z - (flip ? -radius : radius)]}
      rotation={[0, flip ? Math.PI : 0, 0]}
      renderOrder={slot === 'outerwear' ? 2 : 1}
    >
      <meshStandardMaterial
        map={texture ?? undefined}
        color={texture ? '#ffffff' : color}
        transparent
        alphaTest={0.4}
        side={THREE.FrontSide}
        roughness={0.9}
      />
    </mesh>
  )
}

function TexturedSheet({ uri, ...rest }: {
  uri: string; slot: AvatarSlot; item: ClothingItem; flip?: boolean
}) {
  const texture = useLoader(THREE.TextureLoader, uri)
  return <Sheet texture={texture} {...rest} />
}

function Garment({ slot, item }: { slot: AvatarSlot; item: ClothingItem }) {
  const front = item.photoUri
  const back = item.backPhotoUri ?? item.photoUri
  return (
    <>
      {front
        ? <TexturedSheet uri={front} slot={slot} item={item} />
        : <Sheet texture={null} slot={slot} item={item} />}
      {back
        ? <TexturedSheet uri={back} slot={slot} item={item} flip />
        : <Sheet texture={null} slot={slot} item={item} flip />}
    </>
  )
}

// ─── Scene ────────────────────────────────────────────────────────────────────

function Stage({ outfit, rotationRef }: { outfit: Outfit; rotationRef: { current: number } }) {
  const group = useRef<THREE.Group>(null)

  // Ease toward the target yaw so drags feel smooth rather than steppy.
  useFrame(() => {
    if (!group.current) return
    group.current.rotation.y += (rotationRef.current - group.current.rotation.y) * 0.25
  })

  return (
    <group ref={group} position={[0, -0.9, 0]}>
      <Mannequin />
      {(Object.keys(outfit) as AvatarSlot[]).map(slot => {
        const item = outfit[slot]
        if (!item) return null
        // Suspense per garment so one slow texture doesn't blank the whole avatar
        return (
          <Suspense key={`${slot}-${item.id}`} fallback={null}>
            <Garment slot={slot} item={item} />
          </Suspense>
        )
      })}
    </group>
  )
}

export default function AvatarScene({ outfit, rotationRef }: {
  outfit: Outfit
  rotationRef: { current: number }
}) {
  return (
    <Canvas camera={{ position: [0, 0.2, 3.4], fov: 35 }}>
      <ambientLight intensity={1.1} />
      <directionalLight position={[2, 3, 4]} intensity={1.4} />
      <directionalLight position={[-2, 1, -3]} intensity={0.5} />
      <Stage outfit={outfit} rotationRef={rotationRef} />
    </Canvas>
  )
}
