# WearIt

**An AI wardrobe assistant that suggests outfits from clothes you actually own — built to keep working no matter which AI provider is available.**

React Native · TypeScript · Expo · Anthropic Claude (multimodal) · provider-agnostic fallback

> Photograph your clothes, and WearIt builds a structured wardrobe, suggests complete outfits for any occasion and the current weather, and learns your taste over time. It's also a study in **resilient AI integration**: every AI call degrades gracefully across three tiers, and the suggestion engine works with Claude, any OpenAI-compatible cloud model, or a local on-device model — without changing app code.

---

## Screenshots

<!-- Replace these with real captures before publishing -->
| Wardrobe | Outfit suggestion | AI-generated theme |
|---|---|---|
| _screenshot_ | _screenshot_ | _screenshot_ |

> 📸 _Add screenshots to `assets/screenshots/` and link them here. A 20–30s screen recording of the photograph → auto-tag → outfit-suggestion flow is the single highest-impact asset for this README._

---

## Why this project

I wanted a real product, not a demo — which meant the AI couldn't be a single brittle API call. A wardrobe app is useless the moment the model is down, the monthly budget is spent, or the user is offline. So the core engineering problem became: **how do you build an AI feature that always returns something useful?**

The answer is a layered architecture where the AI provider is an implementation detail, output is always coerced into a known shape, and the app falls back through progressively cheaper options before degrading to a helpful message.

---

## Architecture

### Three-tier AI fallback

```
askWearIt(items, context)
        │
        ▼
  Tier 1 · User-configured model               ← the user's own endpoint + key:
        │   (via OpenAI-compatible adapter)       Groq, OpenRouter, Ollama, LM Studio…
        │  (none configured, or unreachable)      their key, their cost, no cap
        ▼
  Tier 2 · Bundled Claude key (sonnet-4-5)     ← zero-config default, metered to a
        │   metered to a monthly usage cap        monthly cap so it never silently
        │  (cap reached, or request fails)        burns credits
        ▼
  Tier 3 · Graceful degradation                ← actionable CTA, never a crash
        │
        ▼
  Structured result → { suggestion, reason, itemNames[] }
```

The ordering is a deliberate cost-control decision: **if the user brings their own model, we never spend bundled credits on them.** A power user points Settings at their own Groq/OpenRouter/Ollama endpoint and gets uncapped suggestions on their own dime; a first-run user with no setup still gets working AI immediately from the bundled Claude key, metered against a persisted monthly cap that auto-resets per calendar month. The cap only increments on a *confirmed* successful suggestion — errors never cost a credit.

Every tier returns the **same typed shape** (`{ suggestion, reason, itemNames[] }`), so the UI never knows or cares which model answered.

### Provider-agnostic model adapter

`utils/modelAdapter.ts` speaks the OpenAI chat-completions format, so Tier 1 drives a free cloud model (Groq), a hosted router (OpenRouter), or a fully local model (Ollama / LM Studio) — meaning WearIt can run **entirely on-device with no API key at all**. Swapping providers is a Settings change, not a code change. A built-in connection tester fires a minimal request to validate any endpoint before it's saved.

### Self-improving few-shot loop

Every successful Claude suggestion is persisted (last 20, in AsyncStorage). The most recent examples are then injected into the *adapter* prompt — so when a user later configures their own (often weaker or local) model, it inherits the quality of Claude's outputs as few-shot exemplars without any retraining. The user's own history becomes the training signal that lifts a smaller model toward Claude-grade results.

### Hardened cross-model prompting

Smaller models love to hedge, explain, or wrap JSON in markdown. The fallback prompt puts the **format constraint first**, gives an explicit JSON escape hatch so the model never breaks format to express uncertainty, and a shared parser then:

- strips `<think>` reasoning tags (DeepSeek/QwQ-style models),
- removes markdown code fences,
- sanitizes control characters and trailing commas,
- and falls back to raw text if JSON parsing fails entirely.

### Multimodal: vision-based auto-tagging

Adding a garment is a photo, not a form. The image is base64-encoded and sent to Claude's vision endpoint, which returns structured JSON:

```json
{ "name": "Dark Wash Jeans", "category": "Bottoms", "color": "Navy" }
```

### AI as a design tool: generated themes

Beyond suggestions, Claude generates **complete app color palettes** from a one-line aesthetic prompt ("Dark Academia", "Y2K"). It returns a full set of design tokens validated against the app's `Theme` contract; the user previews and saves, and the theme persists. AI output is wired directly into the design system, not just the content.

---

## Engineering trade-offs

Honest notes on what's deliberate and what I'd change for a public production release:

- **Keys are currently client-side.** API keys are injected at build time via `EXPO_PUBLIC_*` env vars, which inlines them into the app bundle. That's fine for development, internal testing, and a bring-your-own-key power user, but a public binary is decompilable — so the bundled-key path needs a thin server-side proxy before a public store launch. The architecture already isolates every key behind `claude.ts` / `modelAdapter.ts`, so this is a contained change, not a rewrite.
- **Few-shot store is local and unbounded by quality.** Examples are kept per-device in AsyncStorage with a simple recency window (last 20). There's no cross-device sync and no scoring of which past suggestions were actually *good* — a thumbs-up/down signal would make the few-shot loop meaningfully smarter.
- **Parsing is defensive, not schema-validated.** The cross-model parser hand-sanitizes JSON (strips `<think>` tags, code fences, control chars, trailing commas) because smaller models break format constantly. A structured-output / tool-calling mode would be cleaner where providers support it; the hand-rolled parser exists precisely so the *fallback* models that don't support it still work.

---

## Tech stack

| Layer | Tech |
|---|---|
| Framework | React Native `0.83` + Expo `55` (file-based routing via Expo Router) |
| Language | TypeScript (typed end to end) |
| UI runtime | React `19`, Reanimated `4` |
| AI — primary | Anthropic Claude API (`claude-sonnet-4-5`), text + vision |
| AI — fallback | Any OpenAI-compatible endpoint (Groq, OpenRouter, Ollama, LM Studio) |
| State / persistence | React Context + AsyncStorage (wardrobe, wishlist, saved outfits, usage cap, few-shot store, model + theme config) |
| Device | `expo-location` (weather context), `expo-image-picker`, `expo-file-system` (base64), `expo-crypto` (UUIDs) |
| Design system | Token-driven theming — zero hardcoded colors; presets + AI-generated custom themes |

---

## Features

- **AI outfit suggestions** — complete looks from your real wardrobe, aware of occasion and current weather.
- **Vision auto-tagging** — photograph an item; Claude fills in name, category, and color.
- **Gap analysis** — compare a wishlist item to your wardrobe: what you already own that works, and what's missing.
- **AI-generated themes** — describe an aesthetic, get a full validated color palette, preview, and save.
- **Three-tier resilient AI** — Claude → any configured model → graceful degradation; works offline with a local model.
- **Self-improving suggestions** — few-shot injection from your own successful outfits.
- **Usage-cap management** — monthly Claude budget with automatic, transparent fallback.
- **AI on/off toggle** — fully usable without any AI (manual wardrobe + outfit builder).
- **Wardrobe + wishlist CRUD** — camera/library capture, search, persistent local storage.

---

## Project structure

```
wearit/
├── app/(tabs)/        # Expo Router screens: wardrobe, outfits, shopping,
│                      #   inspo, profile, settings, item/[id], wishlist/[id]
├── components/        # Shared UI (ClothingCard, …)
├── contexts/          # ThemeContext (presets + custom), AIContext (on/off)
├── constants/         # theme.ts (all design tokens), types.ts
├── hooks/             # useImagePicker, …
└── utils/
    ├── claude.ts          # Claude: outfit suggestions, vision tagging, gap analysis, theme generation
    ├── modelAdapter.ts    # Provider-agnostic OpenAI-compatible fallback + connection tester
    ├── storage.ts         # AsyncStorage CRUD, usage cap, few-shot store
    ├── outfitRandomizer.ts# Local non-AI outfit shuffler
    └── weather.ts         # Location-aware weather context
```

---

## Getting started

```bash
cd wearit
npm install
npx expo start
```

Create `wearit/.env.local`:

```
EXPO_PUBLIC_ANTHROPIC_KEY=your_claude_api_key
EXPO_PUBLIC_GROQ_KEY=your_groq_key        # optional free fallback
EXPO_PUBLIC_WEATHER_KEY=your_weather_key  # optional weather context
```

Run on iOS Simulator, Android Emulator, or scan the QR code with [Expo Go](https://expo.dev/go). No API key? Point Settings at a local Ollama/LM Studio endpoint and the app runs fully on-device.

---

## Roadmap

- [ ] Demo screenshots + screen recording
- [ ] App Store / Play Store listing
- [ ] In-screen AI model switcher on the Outfits tab
- [ ] Shopping tab build-out
- [ ] Outfit history insights

---

*Part of [Cultivate](https://github.com/GabrielleHandy/Cultivate) — a suite exploring technology that helps you see yourself more clearly.*
