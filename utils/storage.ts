import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ClothingItem {
  id: string;
  imageUri: string;
  category: string;
  color: string;
  colorName: string;
  notes: string;
  createdAt: number;
}

const WARDROBE_KEY = 'wearit_wardrobe';

export async function getWardrobe(): Promise<ClothingItem[]> {
  try {
    const data = await AsyncStorage.getItem(WARDROBE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveItem(item: ClothingItem): Promise<void> {
  const wardrobe = await getWardrobe();
  wardrobe.unshift(item);
  await AsyncStorage.setItem(WARDROBE_KEY, JSON.stringify(wardrobe));
}

export async function deleteItem(id: string): Promise<void> {
  const wardrobe = await getWardrobe();
  const updated = wardrobe.filter((item) => item.id !== id);
  await AsyncStorage.setItem(WARDROBE_KEY, JSON.stringify(updated));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
