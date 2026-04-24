import { ClothingItem } from './storage';

const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
const API_URL = 'https://api.anthropic.com/v1/messages';

function buildWardrobeDescription(wardrobe: ClothingItem[]): string {
  if (wardrobe.length === 0) return 'The wardrobe is currently empty.';
  return wardrobe
    .map((item) => `- ${item.category}: ${item.colorName}${item.notes ? ` (${item.notes})` : ''}`)
    .join('\n');
}

export async function getOutfitSuggestion(
  userRequest: string,
  wardrobe: ClothingItem[]
): Promise<string> {
  const wardrobeDesc = buildWardrobeDescription(wardrobe);

  const prompt = `You are a warm, encouraging personal stylist. The user has the following items in their wardrobe:\n\n${wardrobeDesc}\n\nUser request: "${userRequest}"\n\nSuggest specific outfits using only items from their wardrobe. Be warm, specific, and practical. If the wardrobe is limited, suggest which single item to build around. Keep your response under 150 words.`;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  return data.content?.[0]?.text ?? 'Sorry, I could not generate a suggestion right now.';
}

export async function checkDuplicate(
  imageBase64: string,
  wardrobe: ClothingItem[]
): Promise<string> {
  const wardrobeDesc = buildWardrobeDescription(wardrobe);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
            },
            {
              type: 'text',
              text: `You are a helpful personal stylist. The user is considering buying this item. Their current wardrobe includes:\n\n${wardrobeDesc}\n\nDo they already own something similar? Does this item work well with what they have? Be honest, warm, and concise — under 120 words.`,
            },
          ],
        },
      ],
    }),
  });

  const data = await response.json();
  return data.content?.[0]?.text ?? 'Sorry, I could not analyze this item right now.';
}
