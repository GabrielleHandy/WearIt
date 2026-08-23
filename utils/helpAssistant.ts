import { loadModelConfig } from './storage'
import { AiModelEndpoints } from '@/constants/types'

export type HelpFAQ = {
  id: string
  category: string
  question: string
  icon: string
  summary: string
  steps: string[]
  tips?: string
}

export const FAQS: HelpFAQ[] = [
  {
    id: 'add-clothes',
    category: 'Wardrobe',
    icon: 'shirt-outline',
    question: 'How do I add clothes and auto-tag them?',
    summary: 'You can photograph any piece of clothing and let AI auto-tag its name, category, and color.',
    steps: [
      'Go to the "Wardrobe" tab.',
      'Tap the "+" button in the top right corner.',
      'Choose "Take Photo" or "Choose from Library".',
      'Take a clear photo of the garment (flat or on a hanger).',
      'WearIt will remove the background, crop the item, and automatically detect its category, name, and color.',
      'Tap "Save" to add it to your closet.'
    ],
    tips: 'Good lighting and a plain background produce the cleanest auto-crops!'
  },
  {
    id: 'create-outfits',
    category: 'Styling',
    icon: 'sparkles-outline',
    question: 'How do I generate and save outfits?',
    summary: 'WearIt builds complete outfits from your real clothes based on the occasion and current weather.',
    steps: [
      'Go to the "Outfits" tab.',
      'Type in your occasion (e.g. "dinner date", "job interview", "rainy Sunday").',
      'Tap "Ask WearIt" to generate an outfit.',
      'Review the suggested pieces and AI styling rationale.',
      'Tap "Save Outfit" to keep this look in your saved collection.'
    ],
    tips: 'Make sure you have at least one Top, one Bottom, and one pair of Shoes in your closet for full outfit suggestions.'
  },
  {
    id: 'backup-restore',
    category: 'Backup & Cloud',
    icon: 'cloud-upload-outline',
    question: 'How do I backup or restore my wardrobe?',
    summary: 'Cloud backup saves all your clothes, wishlist, saved outfits, and photos so you never lose them.',
    steps: [
      'Go to the "Settings" tab.',
      'Scroll down to the "Backup & Restore" section.',
      'Note your unique "This device\'s ID" (save this ID if switching phones).',
      'Tap "Back up wardrobe now" to upload your closet to the cloud.',
      'To restore on a new phone: enter that same Device ID into "Restore from device ID" and tap "Restore wardrobe".'
    ],
    tips: 'Always tap "Back up wardrobe now" before updating or reinstalling the app.'
  },
  {
    id: 'wishlist-gap',
    category: 'Shopping',
    icon: 'bag-handle-outline',
    question: 'How does Wishlist and Gap Analysis work?',
    summary: 'Track clothes you want to buy and see how well they match pieces you already own.',
    steps: [
      'Go to the "Shopping" / "Wishlist" tab.',
      'Add items you are considering buying (with photo and price).',
      'Open a wishlist item to run "Gap Analysis".',
      'The AI will tell you which clothes in your closet pair with it and whether it fills a gap in your style!'
    ]
  },
  {
    id: 'themes-models',
    category: 'Personalization',
    icon: 'color-palette-outline',
    question: 'How do I customize the theme or AI model?',
    summary: 'Change your color palette or connect your own local/cloud AI (like Groq, Ollama, OpenAI).',
    steps: [
      'Go to the "Settings" tab.',
      'Choose a theme preset (Default, Dark Academia, etc.) or type an aesthetic (e.g., "Minimalist Terracotta") and tap "Generate Theme".',
      'Under "AI Model", you can connect free models like Groq or local models like Ollama with your own endpoint.'
    ]
  }
]

const SYSTEM_KNOWLEDGE = `You are the WearIt In-App Help & Support Assistant.
WearIt is an AI wardrobe assistant app built in React Native.
Your role is to answer the user's questions about how to use the WearIt app accurately, concisely, and warmly.

Key features of WearIt:
1. WARDROBE TAB:
   - Add clothes by tapping '+' in the top right.
   - Camera or Gallery photo -> Background removal -> AI vision auto-tags Category (Tops, Bottoms, Shoes, Dresses, Outerwear, Accessories, Other), Name, and Color.
   - Filter closet by category chips, search by text query.
   - Tap an item to view, edit details, log wear count, or delete.

2. OUTFITS TAB:
   - Type an occasion ("brunch", "work meeting", "gym") -> AI factors in local weather and closet items -> returns complete outfit with explanation.
   - Save looks to collection.
   - Tap "Tag Outfit" to upload an OOTD photo and pin wardrobe items you wore.

3. SETTINGS TAB & BACKUP:
   - "Backup & Restore" section:
     - Shows "This device's ID" (unique random ID for this phone).
     - Tap "Back up wardrobe now" to upload closet + photos to AWS cloud.
     - Enter Device ID in "Restore from device ID" and tap "Restore wardrobe" to pull all clothes onto any new phone.
   - AI Model Config: support for Claude default, or bring-your-own model (Groq, Ollama, OpenAI, OpenRouter).
   - Theme Generator: prompt an aesthetic to generate a custom color palette.

4. WISHLIST / SHOPPING:
   - Add items you want to buy.
   - Run Gap Analysis to check how it pairs with existing wardrobe items.

Rules:
- Keep answers friendly, short (2 to 4 bullet points or sentences), and actionable.
- Tell the user exactly which tab to click and which button to press.
`

export function getOfflineInstantAnswer(query: string): string {
  const q = query.toLowerCase()

  if (q.includes('backup') || q.includes('save') || q.includes('cloud') || q.includes('lost') || q.includes('new phone') || q.includes('transfer') || q.includes('restore') || q.includes('device id')) {
    return `☁️ **Backing Up & Restoring Your Wardrobe:**\n\n1. Go to the **Settings** tab.\n2. Scroll to the **Backup & Restore** section.\n3. Note your **Device ID** (you will need this if moving to a new phone).\n4. Tap **"Back up wardrobe now"**.\n\nTo restore on a new phone: enter your saved Device ID in **"Restore from device ID"** and tap **"Restore wardrobe"**!`
  }

  if (q.includes('add') || q.includes('photo') || q.includes('camera') || q.includes('shirt') || q.includes('pants') || q.includes('shoes') || q.includes('dress') || q.includes('upload') || q.includes('tag')) {
    return `📸 **Adding Clothes to Your Closet:**\n\n1. Go to the **Wardrobe** tab.\n2. Tap the **"+" (Add)** button in the top right corner.\n3. Choose **Take Photo** or **Choose from Library**.\n4. Take a picture of your garment.\n5. The AI automatically removes the background and tags the name, category, and color!`
  }

  if (q.includes('outfit') || q.includes('suggest') || q.includes('wear') || q.includes('weather') || q.includes('occasion') || q.includes('style')) {
    return `✨ **Generating Outfits:**\n\n1. Go to the **Outfits** tab.\n2. Type in your occasion (e.g. *"Coffee meeting"*, *"Casual Friday"*, *"Dinner party"*).\n3. Tap **"Ask WearIt"**.\n4. The AI will style an outfit using items in your closet adjusted for today's weather!\n5. Tap **"Save Outfit"** to keep it in your saved collection.`
  }

  if (q.includes('wishlist') || q.includes('buy') || q.includes('shopping') || q.includes('gap')) {
    return `🛍️ **Wishlist & Gap Analysis:**\n\n1. Go to the **Shopping** tab.\n2. Tap **"+"** to save items you want to buy.\n3. Tap an item and select **"Gap Analysis"** to see which pieces in your current closet match it and whether it fills a missing gap in your wardrobe!`
  }

  if (q.includes('theme') || q.includes('color') || q.includes('dark mode') || q.includes('aesthetic')) {
    return `🎨 **Customizing Themes:**\n\n1. Go to the **Settings** tab.\n2. Choose a preset theme or scroll to **"AI Theme Generator"**.\n3. Type any vibe (e.g. *"Dark Academia"*, *"Warm Terracotta"*) and tap **"Generate Theme"** to preview and apply!`
  }

  return `Here is how to get the most out of WearIt:\n\n• **Add Clothes:** Go to **Wardrobe** → tap **"+"** to snap and auto-tag garments.\n• **Get Outfits:** Go to **Outfits** → type an occasion and tap **"Ask WearIt"**.\n• **Cloud Backup:** Go to **Settings** → tap **"Back up wardrobe now"** to keep your data safe.\n\nFeel free to ask a specific question like *"How do I restore clothes?"* or *"How do I tag my outfit?"*!`
}

export async function askHelpAssistant(
  question: string,
  history: Array<{ role: 'user' | 'assistant'; text: string }> = []
): Promise<string> {
  const trimmed = question.trim()
  if (!trimmed) return ''

  try {
    const config = await loadModelConfig()
    const AI_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_KEY
    const PROXY_URL = process.env.EXPO_PUBLIC_PROXY_URL
    const PROXY_KEY = process.env.EXPO_PUBLIC_PROXY_KEY

    // If user configured a custom model (Groq, Ollama, OpenAI)
    if (config?.url && config?.model) {
      const messages = [
        { role: 'system', content: SYSTEM_KNOWLEDGE },
        ...history.map(h => ({ role: h.role, content: h.text })),
        { role: 'user', content: trimmed }
      ]

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`

      const res = await fetch(config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.5,
          max_tokens: 400
        })
      })

      if (res.ok) {
        const json = await res.json()
        const text = json?.choices?.[0]?.message?.content?.trim()
        if (text) return text
      }
    }

    // Default to Claude / Proxy
    let requestUrl = ''
    const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' }

    if (PROXY_URL) {
      requestUrl = PROXY_URL
      requestHeaders['x-wearit-key'] = PROXY_KEY ?? ''
    } else if (AI_KEY) {
      requestUrl = AiModelEndpoints.Anthropic
      requestHeaders['x-api-key'] = AI_KEY
      requestHeaders['anthropic-version'] = '2023-06-01'
      requestHeaders['anthropic-dangerous-direct-browser-access'] = 'true'
    }

    if (requestUrl) {
      const messages = [
        ...history.map(h => ({ role: h.role, content: h.text })),
        { role: 'user', content: trimmed }
      ]

      const res = await fetch(requestUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 400,
          system: SYSTEM_KNOWLEDGE,
          messages
        })
      })

      if (res.ok) {
        const json = await res.json()
        const text = json?.content?.[0]?.text?.trim()
        if (text) return text
      }
    }
  } catch (err) {
    console.warn('Help assistant AI request fallback:', err)
  }

  // Guaranteed fallback
  return getOfflineInstantAnswer(trimmed)
}
