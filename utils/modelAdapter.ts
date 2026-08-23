import { ClothingItem, ModelConfig, WearItSuggestion } from '@/constants/types'
import { getTrainingExamples, loadModelConfig } from './storage'

/**
 * Universal adapter for any OpenAI-compatible endpoint.
 * Works with Ollama, Groq, OpenRouter, LM Studio, OpenAI, Mistral, etc.
 * Returns null if no model is configured — caller handles graceful degradation.
 */
export async function askModelAdapter(
  items: ClothingItem[],
  context?: string
): Promise<WearItSuggestion | null> {
  const config = await loadModelConfig()
  if (!config?.url || !config?.model) return null

  const wardrobeList = items
    .map((item, i) => {
      let line = `${i}. ${item.name} (${item.category})`
      if (item.color) line += `, color: ${item.color}`
      if (item.worn && item.worn > 0) line += `, worn ${item.worn} times`
      return line
    })
    .join('\n')

  const examples = await getTrainingExamples()
  const fewShotBlock = examples.length > 0
    ? `\nExamples of good suggestions:\n` +
      examples.slice(-3).map(e =>
        `${e.wardrobeList}\nContext: ${e.context}\nSuggestion: ${e.suggestion}\nReason: ${e.reason}`
      ).join('\n\n') + '\n'
    : ''

  // Hardened prompt — format constraint comes first, escape hatch gives the
  // model a valid JSON fallback so it never breaks format to hedge or explain.
  const prompt = `Return ONLY a valid JSON object. No markdown, no code fences, no text before or after the JSON.

Required format:
{"suggestion": "...", "reason": "...", "items": [0, 1, 2]}

where "items" is an array containing ONLY 0-based integer index numbers of the selected pieces from the numbered wardrobe list.
If you cannot follow this format, return:
{"suggestion": "No suggestion available.", "reason": "", "isFallback": true}

You are WearIt, an expert fashion stylist and wardrobe curator.
Styling Rules:
1. FORMULA: Pick 1 Top + 1 Bottom (or 1 Dress), plus 1 pair of Shoes. Optionally layer 1 Outerwear/Accessory.
2. Only select items from the numbered wardrobe list below — never hallucinate pieces not in the list.
3. Suggestion (2-3 sentences): Name the specific pieces and describe how to style them (tucking, cuffing, layering).
4. Reason (2-3 sentences): Explain the color harmony, texture balance, and occasion/weather appropriateness.
5. Do not mention internal category tags like (Tops) or (Bottoms) in your text.
${fewShotBlock}
Wardrobe:
${wardrobeList}

${context ? `Occasion & Context: ${context}` : 'Occasion & Context: casual everyday'}`

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`
    }

    const response = await fetch(config.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.5,
      }),
    })

    if (!response.ok) {
      console.warn(`Model adapter error: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()
    const raw = data?.choices?.[0]?.message?.content || null
    if (!raw) return null

    return parseAdapterResponse(raw, config.label || config.model)
  } catch (error) {
    console.warn('Model adapter request failed:', error)
    return null
  }
}

/**
 * Test whether a model config is reachable.
 * Fires a minimal request and returns a status string.
 */
export async function testModelConnection(config: ModelConfig): Promise<{
  ok: boolean
  message: string
}> {
  if (!config.url || !config.model) {
    return { ok: false, message: 'Missing endpoint URL or model name.' }
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`

    const response = await fetch(config.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Reply with exactly: {"ok":true}' }],
        max_tokens: 20,
      }),
    })

    if (!response.ok) {
      return { ok: false, message: `Server returned ${response.status}. Check your URL and API key.` }
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) return { ok: false, message: 'Connected but got no response from model.' }

    return { ok: true, message: `Connected to ${config.model} ✓` }
  } catch {
    return { ok: false, message: 'Could not reach endpoint. Is the server running?' }
  }
}

function parseAdapterResponse(raw: string, modelLabel: string): WearItSuggestion {
  const fallback: WearItSuggestion = {
    suggestion: 'Could not generate a suggestion right now.',
    reason: '',
    isFallback: true,
  }

  try {
    // Strip think tags (DeepSeek, QwQ, etc.)
    const stripped = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

    // Strip markdown code fences
    const cleaned = stripped
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/[\u0000-\u001F]/g, ' ')  // strip control characters
      .replace(/,\s*}/g, '}')            // trailing commas
      .trim()

    const parsed = JSON.parse(cleaned)
    return {
      suggestion: (parsed?.suggestion || '').replace(/\*\*/g, '').trim(),
      reason: (parsed?.reason || `Suggested by ${modelLabel}`).replace(/\*\*/g, '').trim(),
      isFallback: !!parsed?.isFallback,
      itemIndices: Array.isArray(parsed?.items) ? parsed.items.filter((i: unknown): i is number => typeof i === 'number') : undefined,
    }
  } catch {
    // JSON failed — strip punctuation and use raw text
    const cleaned = raw
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/[{}"]/g, '')
      .replace(/suggestion:|reason:/gi, '')
      .trim()
    return cleaned
      ? { suggestion: cleaned, reason: '' }
      : fallback
  }
}
