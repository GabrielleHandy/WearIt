import * as WebBrowser from 'expo-web-browser'
import { Platform } from 'react-native'

export type StoreOption = {
  id: string
  name: string
  tagline: string
  badge: string
  badgeBg: string
  icon: string
  color: string
  getUrl: (query: string) => string
}

export const SHOPPING_STORES: StoreOption[] = [
  {
    id: 'google',
    name: 'Google Shopping',
    tagline: 'Compare prices across all web stores & brands',
    badge: 'ALL STORES',
    badgeBg: '#4285F4',
    icon: 'search-outline',
    color: '#4285F4',
    getUrl: (q: string) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}`,
  },
  {
    id: 'shein',
    name: 'SHEIN',
    tagline: 'Trendy affordable dupes & viral looks',
    badge: 'FAST FASHION',
    badgeBg: '#222222',
    icon: 'pricetag-outline',
    color: '#000000',
    getUrl: (q: string) => `https://us.shein.com/pdsearch/${encodeURIComponent(q)}/`,
  },
  {
    id: 'temu',
    name: 'Temu',
    tagline: 'Ultra budget apparel & accessories',
    badge: 'BUDGET',
    badgeBg: '#FB7701',
    icon: 'flash-outline',
    color: '#FB7701',
    getUrl: (q: string) => `https://www.temu.com/search_result.html?search_key=${encodeURIComponent(q)}`,
  },
  {
    id: 'amazon',
    name: 'Amazon Fashion',
    tagline: 'Customer reviews, prime delivery & staples',
    badge: 'FAST SHIPPING',
    badgeBg: '#FF9900',
    icon: 'cart-outline',
    color: '#FF9900',
    getUrl: (q: string) => `https://www.amazon.com/s?k=${encodeURIComponent(q + ' clothing')}&i=fashion`,
  },
  {
    id: 'zara',
    name: 'Zara',
    tagline: 'Chic European tailoring & seasonal edits',
    badge: 'CONTEMPORARY',
    badgeBg: '#1A1A1A',
    icon: 'sparkles-outline',
    color: '#1A1A1A',
    getUrl: (q: string) => `https://www.zara.com/us/en/search?searchTerm=${encodeURIComponent(q)}`,
  },
  {
    id: 'pinterest',
    name: 'Pinterest Inspo',
    tagline: 'Visual outfit moodboards & styling ideas',
    badge: 'IDEAS & OOTD',
    badgeBg: '#E60023',
    icon: 'logo-pinterest',
    color: '#E60023',
    getUrl: (q: string) => `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q + ' outfit aesthetic')}`,
  },
]

export function buildSearchQuery(name: string, category?: string, color?: string): string {
  const parts: string[] = []
  if (color && !name.toLowerCase().includes(color.toLowerCase())) {
    parts.push(color)
  }
  parts.push(name)
  if (category && !name.toLowerCase().includes(category.toLowerCase())) {
    parts.push(category)
  }
  return parts.join(' ').trim()
}

export async function openStoreSearch(store: StoreOption, query: string): Promise<void> {
  const url = store.getUrl(query)
  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      toolbarColor: '#2C1F1A',
      controlsColor: '#FAF7F2',
    })
  } catch (err) {
    console.warn('Could not open in-app browser:', err)
  }
}
