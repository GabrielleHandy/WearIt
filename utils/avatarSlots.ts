import { ClothingItem } from '@/constants/types'

/**
 * Where each wardrobe category sits on the avatar. Units are metres on a
 * ~1.8m tall mannequin standing on y = 0, facing +z.
 *
 * Clothing photos are flat cutouts, so a garment is rendered as a gently
 * curved sheet (see AvatarScene) fitted into this box in front of the body.
 */
export type AvatarSlot = 'top' | 'outerwear' | 'dress' | 'bottom' | 'shoes' | 'accessory'

export type SlotBox = {
  width: number
  height: number
  x: number
  y: number      // vertical centre
  z: number      // depth of the front surface
}

export const SLOT_BOXES: Record<AvatarSlot, SlotBox> = {
  top:       { width: 0.64, height: 0.62, x: 0,    y: 1.2,  z: 0.14 },
  outerwear: { width: 0.76, height: 0.78, x: 0,    y: 1.16, z: 0.17 },
  dress:     { width: 0.58, height: 1.15, x: 0,    y: 0.98, z: 0.15 },
  bottom:    { width: 0.46, height: 0.95, x: 0,    y: 0.5,  z: 0.12 },
  shoes:     { width: 0.34, height: 0.16, x: 0,    y: 0.08, z: 0.13 },
  accessory: { width: 0.24, height: 0.24, x: 0.32, y: 0.95, z: 0.1  },
}

export function slotForCategory(category: ClothingItem['category']): AvatarSlot | null {
  switch (category) {
    case 'Tops': return 'top'
    case 'Outerwear': return 'outerwear'
    case 'Dresses': return 'dress'
    case 'Bottoms': return 'bottom'
    case 'Shoes': return 'shoes'
    case 'Accessories': return 'accessory'
    default: return null // 'Other' has no sensible place on the body
  }
}

export type Outfit = Partial<Record<AvatarSlot, ClothingItem>>

/**
 * Put an item on (or take it off if it is already worn). A dress replaces
 * the top and bottom, and putting a top or bottom on replaces the dress.
 */
export function toggleWorn(outfit: Outfit, item: ClothingItem): Outfit {
  const slot = slotForCategory(item.category)
  if (!slot) return outfit

  const next: Outfit = { ...outfit }
  if (next[slot]?.id === item.id) {
    delete next[slot]
    return next
  }

  next[slot] = item
  if (slot === 'dress') {
    delete next.top
    delete next.bottom
  } else if (slot === 'top' || slot === 'bottom') {
    delete next.dress
  }
  return next
}

export function wornItems(outfit: Outfit): ClothingItem[] {
  return Object.values(outfit).filter((i): i is ClothingItem => !!i)
}
