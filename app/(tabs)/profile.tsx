import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert, Switch,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ModelConfig } from '@/constants/types'
import { saveModelConfig, loadModelConfig, clearModelConfig } from '@/utils/storage'
import { testModelConnection } from '@/utils/modelAdapter'
import { generateTheme } from '@/utils/claude'
import { type Theme, Spacing, Radius, Typography, Colors } from '@/constants/theme'
import { useTheme, THEMES, type ThemeKey } from '@/contexts/ThemeContext'
import { useAI } from '@/contexts/AIContext'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const PRESETS = [
  { label: 'Ollama (local)', url: 'http://localhost:11434/v1/chat/completions', model: 'llama3.2' },
  { label: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1/chat/completions', model: 'mistralai/mistral-7b-instruct' },
  { label: 'OpenAI', url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
]

const THEME_LABELS: Partial<Record<ThemeKey, string>> = {
  default: '🌿 Default',
  darkAcademia: '📚 Dark Academia',
}

export default function ProfileScreen() {
  const { theme, themeKey, customThemeName, setThemeKey, applyCustomTheme } = useTheme()
  const { aiEnabled, setAIEnabled } = useAI()
  const { top } = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(theme, top), [theme, top])

  // AI theme generation
  const [aestheticPrompt, setAestheticPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [previewTheme, setPreviewTheme] = useState<Theme | null>(null)
  const [previewName, setPreviewName] = useState('')

  const handleGenerateTheme = async () => {
    if (!aestheticPrompt.trim()) return
    setGenerating(true)
    setPreviewTheme(null)
    try {
      const generated = await generateTheme(aestheticPrompt.trim())
      if (generated) {
        setPreviewTheme(generated)
        setPreviewName(aestheticPrompt.trim())
      } else {
        Alert.alert('Generation failed', 'Could not generate a theme. Make sure your Claude API key is configured.')
      }
    } catch {
      Alert.alert('Error', 'Something went wrong generating the theme.')
    } finally {
      setGenerating(false)
    }
  }

  const handleApplyTheme = async () => {
    if (!previewTheme) return
    await applyCustomTheme(previewTheme, previewName)
    setPreviewTheme(null)
    setAestheticPrompt('')
  }

  // Fallback model config
  const [url, setUrl] = useState('')
  const [modelName, setModelName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [label, setLabel] = useState('')
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testStatus, setTestStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [currentConfig, setCurrentConfig] = useState<ModelConfig | null>(null)

  useEffect(() => {
    loadModelConfig().then(config => {
      if (config) {
        setCurrentConfig(config)
        setUrl(config.url)
        setModelName(config.model)
        setApiKey(config.apiKey || '')
        setLabel(config.label || '')
      }
    })
  }, [])

  const handlePreset = (preset: typeof PRESETS[0]) => {
    setUrl(preset.url)
    setModelName(preset.model)
    setLabel(preset.label)
    setTestStatus(null)
    setSaved(false)
  }

  const handleTest = async () => {
    if (!url || !modelName) {
      Alert.alert('Missing fields', 'Enter an endpoint URL and model name first.')
      return
    }
    setTesting(true)
    setTestStatus(null)
    const result = await testModelConnection({ url, model: modelName, apiKey: apiKey || undefined, label })
    setTestStatus(result)
    setTesting(false)
  }

  const handleSave = async () => {
    if (!url || !modelName) {
      Alert.alert('Missing fields', 'Endpoint URL and model name are required.')
      return
    }
    const config: ModelConfig = {
      url,
      model: modelName,
      apiKey: apiKey || undefined,
      label: label || modelName,
    }
    await saveModelConfig(config)
    setCurrentConfig(config)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClear = () => {
    Alert.alert(
      'Remove fallback model',
      'WearIt will fall back to a degradation message when Claude credits run out. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            await clearModelConfig()
            setCurrentConfig(null)
            setUrl(''); setModelName(''); setApiKey(''); setLabel('')
            setTestStatus(null)
          }
        },
      ]
    )
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* ── Profile Header ───────────────────────────────── */}
      <View style={styles.profileHeader}>
        {/* Avatar placeholder — will become try-on surface in WearIt A4 */}
        <View style={styles.avatar}>
          <Ionicons name="person-outline" size={36} color={theme.accent} />
        </View>
        <Text style={styles.profileTitle}>Style Profile</Text>
        <Text style={styles.profileSubtitle}>Customize your WearIt experience</Text>
      </View>

      <View style={styles.divider} />

      {/* ── AI Features Toggle ───────────────────────────── */}
      <View style={styles.toggleCard}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleLabel}>Use AI features</Text>
          <Text style={styles.toggleDesc}>
            {aiEnabled
              ? 'Auto-tagging and outfit suggestions on.'
              : 'AI off — add items manually, use the randomizer.'}
          </Text>
        </View>
        <Switch
          value={aiEnabled}
          onValueChange={setAIEnabled}
          trackColor={{ false: theme.border, true: theme.accent }}
          thumbColor={theme.surface}
        />
      </View>

      <View style={styles.divider} />

      {/* ── Appearance ───────────────────────────────────── */}
      <Text style={styles.heading}>Appearance</Text>
      <Text style={styles.subheading}>
        Choose your WearIt aesthetic. More themes coming soon.
      </Text>

      <Text style={styles.sectionLabel}>Theme</Text>
      <View style={styles.presets}>
        {(Object.keys(THEMES) as ThemeKey[]).map(key => (
          <TouchableOpacity
            key={key}
            style={[styles.presetBtn, themeKey === key && styles.presetBtnActive]}
            onPress={() => setThemeKey(key)}
          >
            <Text style={[styles.presetText, themeKey === key && styles.presetTextActive]}>
              {THEME_LABELS[key] ?? key}
            </Text>
          </TouchableOpacity>
        ))}
        {customThemeName && (
          <TouchableOpacity
            style={[styles.presetBtn, themeKey === 'custom' && styles.presetBtnActive]}
            onPress={() => setThemeKey('custom')}
          >
            <Text style={[styles.presetText, themeKey === 'custom' && styles.presetTextActive]}>
              ✨ {customThemeName}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── AI Theme Generator ───────────────────────────── */}
      <Text style={styles.sectionLabel}>Generate a Theme</Text>
      <Text style={styles.subheading}>
        Describe an aesthetic and Claude will design a theme for it.
      </Text>

      <View style={styles.generateRow}>
        <TextInput
          style={styles.generateInput}
          value={aestheticPrompt}
          onChangeText={setAestheticPrompt}
          placeholder="Dark Academia, Y2K, Coastal Grandmother..."
          placeholderTextColor={theme.textPlaceholder}
          autoCapitalize="words"
          autoCorrect={false}
          onSubmitEditing={handleGenerateTheme}
          returnKeyType="go"
        />
        <TouchableOpacity
          style={[styles.generateBtn, (!aestheticPrompt.trim() || generating) && styles.generateBtnDisabled]}
          onPress={handleGenerateTheme}
          disabled={!aestheticPrompt.trim() || generating}
        >
          {generating
            ? <ActivityIndicator color={theme.textOnAccent} size="small" />
            : <Text style={styles.generateBtnText}>Generate</Text>
          }
        </TouchableOpacity>
      </View>

      {generating && (
        <Text style={styles.generatingHint}>Claude is designing your theme...</Text>
      )}

      {previewTheme && (
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Preview — {previewName}</Text>
          <View style={styles.swatchRow}>
            {[
              { color: previewTheme.background, label: 'BG' },
              { color: previewTheme.surface, label: 'Surface' },
              { color: previewTheme.accent, label: 'Accent' },
              { color: previewTheme.textPrimary, label: 'Text' },
              { color: previewTheme.accentDanger, label: 'Danger' },
            ].map(({ color, label }) => (
              <View key={label} style={styles.swatchItem}>
                <View style={[styles.swatch, { backgroundColor: color, borderColor: theme.border }]} />
                <Text style={styles.swatchLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.miniPreview, { backgroundColor: previewTheme.background }]}>
            <View style={[styles.miniCard, { backgroundColor: previewTheme.surface, borderColor: previewTheme.border }]}>
              <Text style={[styles.miniTitle, { color: previewTheme.textPrimary }]}>My Wardrobe</Text>
              <Text style={[styles.miniSub, { color: previewTheme.sectionLabel }]}>TOPS</Text>
              <View style={[styles.miniBtn, { backgroundColor: previewTheme.accent }]}>
                <Text style={[styles.miniBtnText, { color: previewTheme.textOnAccent }]}>+ Add</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={[styles.applyBtn, { backgroundColor: previewTheme.accent }]} onPress={handleApplyTheme}>
            <Text style={[styles.applyBtnText, { color: previewTheme.textOnAccent }]}>Apply Theme</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.discardBtn} onPress={() => setPreviewTheme(null)}>
            <Text style={styles.discardBtnText}>Discard</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.divider} />

      {/* ── AI Model Settings ────────────────────────────── */}
      <Text style={styles.heading}>AI Model Settings</Text>
      <Text style={styles.subheading}>
        WearIt uses Claude for outfit suggestions. When your monthly credits run out,
        it falls back to any model you configure here — Ollama, Groq, OpenRouter, or anything
        that speaks the OpenAI API format.
      </Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Current fallback</Text>
        <Text style={styles.statusValue}>
          {currentConfig ? `${currentConfig.label || currentConfig.model}` : 'None configured'}
        </Text>
        {currentConfig && (
          <Text style={styles.statusUrl} numberOfLines={1}>{currentConfig.url}</Text>
        )}
      </View>

      <Text style={styles.sectionLabel}>Quick presets</Text>
      <View style={styles.presets}>
        {PRESETS.map(preset => (
          <TouchableOpacity key={preset.label} style={styles.presetBtn} onPress={() => handlePreset(preset)}>
            <Text style={styles.presetText}>{preset.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Endpoint</Text>

      <Text style={styles.fieldLabel}>URL</Text>
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={t => { setUrl(t); setTestStatus(null); setSaved(false) }}
        placeholder="https://api.groq.com/openai/v1/chat/completions"
        placeholderTextColor={theme.textPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <Text style={styles.fieldLabel}>Model name</Text>
      <TextInput
        style={styles.input}
        value={modelName}
        onChangeText={t => { setModelName(t); setTestStatus(null); setSaved(false) }}
        placeholder="llama3.2, mistral, gpt-4o-mini…"
        placeholderTextColor={theme.textPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.fieldLabel}>API key <Text style={styles.optional}>(optional)</Text></Text>
      <TextInput
        style={styles.input}
        value={apiKey}
        onChangeText={t => { setApiKey(t); setSaved(false) }}
        placeholder="Leave blank for local models like Ollama"
        placeholderTextColor={theme.textPlaceholder}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.fieldLabel}>Display name <Text style={styles.optional}>(optional)</Text></Text>
      <TextInput
        style={styles.input}
        value={label}
        onChangeText={setLabel}
        placeholder="e.g. My Ollama, Groq Llama"
        placeholderTextColor={theme.textPlaceholder}
      />

      <TouchableOpacity style={styles.testBtn} onPress={handleTest} disabled={testing}>
        {testing
          ? <ActivityIndicator color={theme.accent} />
          : <Text style={styles.testBtnText}>Test connection</Text>
        }
      </TouchableOpacity>

      {testStatus && (
        <View style={[styles.testResult, testStatus.ok ? styles.testOk : styles.testFail]}>
          <Text style={[styles.testResultText, testStatus.ok ? styles.testOkText : styles.testFailText]}>
            {testStatus.message}
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>{saved ? 'Saved ✓' : 'Save'}</Text>
      </TouchableOpacity>

      {currentConfig && (
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearBtnText}>Remove fallback model</Text>
        </TouchableOpacity>
      )}

    </ScrollView>
  )
}

const makeStyles = (theme: Theme, topInset: number) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    paddingBottom: Spacing['12'],
  },

  // ── Profile header ──────────────────────────────────────
  profileHeader: {
    alignItems: 'center',
    paddingTop: topInset + 8,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.screen,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.border,
    marginBottom: Spacing.base,
  },
  profileTitle: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 30,
    color: theme.textPrimary,
    marginBottom: 4,
  },
  profileSubtitle: {
    ...Typography.styles.bodySmall,
    color: theme.textSecondary,
  },

  // ── Section structure ───────────────────────────────────
  heading: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 30,
    color: theme.textPrimary,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.screen,
    marginTop: Spacing.xl,
  },
  subheading: {
    ...Typography.styles.bodySmall,
    color: theme.textSecondary,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.screen,
  },
  sectionLabel: {
    ...Typography.styles.sectionLabel,
    color: theme.sectionLabel,
    marginBottom: 10,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.screen,
  },
  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: Spacing.lg,
    marginHorizontal: Spacing.screen,
  },

  // ── AI toggle ───────────────────────────────────────────
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.base,
    gap: Spacing.base,
  },
  toggleInfo: { flex: 1, gap: 4 },
  toggleLabel: { ...Typography.styles.body, color: theme.textPrimary },
  toggleDesc: { ...Typography.styles.caption, color: theme.textSecondary, lineHeight: 16 },

  // ── Theme picker ────────────────────────────────────────
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.screen,
  },
  presetBtn: {
    backgroundColor: theme.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: theme.accentMuted,
  },
  presetBtnActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  presetText: {
    ...Typography.styles.bodySmall,
    color: theme.accent,
  },
  presetTextActive: {
    fontFamily: Typography.bodyMedium,
    color: theme.textOnAccent,
  },

  // ── AI theme generator ──────────────────────────────────
  generateRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.screen,
  },
  generateInput: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    ...Typography.styles.body,
    color: theme.textPrimary,
    borderWidth: 1,
    borderColor: theme.border,
  },
  generateBtn: {
    backgroundColor: theme.accent,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  generateBtnDisabled: { opacity: 0.45 },
  generateBtnText: {
    ...Typography.styles.btnLabelSm,
    color: theme.textOnAccent,
  },
  generatingHint: {
    ...Typography.styles.caption,
    color: theme.textSecondary,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.screen,
  },

  // ── Theme preview card ──────────────────────────────────
  previewCard: {
    backgroundColor: theme.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: Spacing.xl,
    marginHorizontal: Spacing.screen,
    gap: Spacing.md,
  },
  previewLabel: {
    ...Typography.styles.body,
    color: theme.textPrimary,
  },
  swatchRow: { flexDirection: 'row', gap: Spacing.sm },
  swatchItem: { alignItems: 'center', gap: 4 },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  swatchLabel: { ...Typography.styles.caption, color: theme.textSecondary },
  miniPreview: { borderRadius: Radius.md, padding: Spacing.md, overflow: 'hidden' },
  miniCard: { borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, gap: 6 },
  miniTitle: { fontSize: 13, fontFamily: Typography.displayBold },
  miniSub: { fontSize: 9, fontFamily: Typography.bodyMedium, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  miniBtn: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  miniBtnText: { ...Typography.styles.caption, fontFamily: Typography.bodyMedium },
  applyBtn: { borderRadius: Radius.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, alignItems: 'center' },
  applyBtnText: { ...Typography.styles.btnLabel },
  discardBtn: { padding: Spacing.sm, alignItems: 'center' },
  discardBtnText: { ...Typography.styles.bodySmall, color: theme.textSecondary },

  // ── AI model settings ───────────────────────────────────
  statusCard: {
    backgroundColor: theme.surface,
    borderRadius: Radius.md,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: theme.border,
    marginHorizontal: Spacing.screen,
  },
  statusLabel: {
    ...Typography.styles.sectionLabel,
    color: theme.sectionLabel,
    marginBottom: Spacing.xs,
  },
  statusValue: {
    ...Typography.styles.body,
    color: theme.textPrimary,
  },
  statusUrl: {
    ...Typography.styles.caption,
    color: theme.textSecondary,
    marginTop: 2,
  },
  fieldLabel: {
    ...Typography.styles.bodySmall,
    fontFamily: Typography.bodyMedium,
    color: theme.textPrimary,
    marginBottom: 6,
    paddingHorizontal: Spacing.screen,
  },
  optional: { fontFamily: Typography.body, color: theme.textSecondary },
  input: {
    backgroundColor: theme.surface,
    borderRadius: Radius.md,
    padding: Spacing.base,
    ...Typography.styles.body,
    color: theme.textPrimary,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: theme.border,
    marginHorizontal: Spacing.screen,
  },
  testBtn: {
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: Radius.md,
    padding: Spacing.base,
    alignItems: 'center',
    marginBottom: Spacing.md,
    minHeight: 48,
    justifyContent: 'center',
    marginHorizontal: Spacing.screen,
  },
  testBtnText: { ...Typography.styles.btnLabelSm, color: theme.accent },
  testResult: {
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    marginHorizontal: Spacing.screen,
  },
  testOk: { backgroundColor: 'rgba(86,163,92,0.12)', borderWidth: 1, borderColor: 'rgba(86,163,92,0.3)' },
  testFail: { backgroundColor: theme.surfaceTint, borderWidth: 1, borderColor: theme.border },
  testResultText: { ...Typography.styles.bodySmall },
  testOkText: { color: '#3a7a3e' },
  testFailText: { color: theme.accentDanger },
  saveBtn: {
    backgroundColor: theme.accent,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginHorizontal: Spacing.screen,
  },
  saveBtnText: { ...Typography.styles.btnLabel, color: theme.textOnAccent },
  clearBtn: { padding: 14, alignItems: 'center' },
  clearBtnText: { ...Typography.styles.bodySmall, color: theme.textSecondary },
})
