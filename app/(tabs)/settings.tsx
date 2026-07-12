import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert, Switch, Linking,
} from 'react-native'
import { useRouter } from 'expo-router'
import { ModelConfig } from '@/constants/types'
import { saveModelConfig, loadModelConfig, clearModelConfig } from '@/utils/storage'
import { testModelConnection } from '@/utils/modelAdapter'
import { generateTheme } from '@/utils/claude'
import { getDeviceId, backupWardrobe, restoreWardrobe } from '@/utils/backup'
import { type Theme, Spacing, Radius, Typography } from '@/constants/theme'
import { useTheme, THEMES, type ThemeKey } from '@/contexts/ThemeContext'
import { useAI } from '@/contexts/AIContext'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const PRESETS = [
  { label: 'Ollama (local)', url: 'http://localhost:11434/v1/chat/completions', model: 'llama3.2' },
  { label: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1/chat/completions', model: 'mistralai/mistral-7b-instruct' },
  { label: 'OpenAI', url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
]

const KEY_CONSOLE_URLS: { label: string; url: string }[] = [
  { label: 'Claude', url: 'https://console.anthropic.com/settings/keys' },
  { label: 'Groq', url: 'https://console.groq.com/keys' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/keys' },
  { label: 'OpenAI', url: 'https://platform.openai.com/api-keys' },
]

const THEME_LABELS: Partial<Record<ThemeKey, string>> = {
  default: '🌿 Default',
  darkAcademia: '📚 Dark Academia',
  // y2k: '💿 Y2K',
  // cleanGirl: '🤍 Clean Girl',
  // disneyChannel: '🌟 Disney Channel',
}

export default function SettingsScreen() {
  const { theme, themeKey, customThemeName, setThemeKey, applyCustomTheme } = useTheme()
  const { aiEnabled, setAIEnabled } = useAI()
  const { top } = useSafeAreaInsets()
  const router = useRouter()
  const styles = useMemo(() => makeStyles(theme, top), [theme, top])

  // AI theme generation state
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

  // ── Backup & Restore ──────────────────────────────────
  const [deviceId, setDeviceId] = useState('')
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [backupStatus, setBackupStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [restoreId, setRestoreId] = useState('')

  useEffect(() => {
    getDeviceId().then(setDeviceId)
  }, [])

  const handleBackup = async () => {
    setBackingUp(true)
    setBackupStatus(null)
    const result = await backupWardrobe()
    setBackupStatus(
      result.ok
        ? { ok: true, message: 'Backed up just now.' }
        : { ok: false, message: result.error }
    )
    setBackingUp(false)
  }

  const handleRestore = () => {
    const targetId = restoreId.trim() || deviceId
    Alert.alert(
      'Restore wardrobe',
      targetId === deviceId
        ? 'This replaces everything currently on this phone with the last backup for this device. Continue?'
        : `This replaces everything currently on this phone with the backup for device ID "${targetId}". Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore', style: 'destructive', onPress: async () => {
            setRestoring(true)
            setBackupStatus(null)
            const result = await restoreWardrobe(restoreId.trim() || undefined)
            if (result.ok) {
              const freshId = await getDeviceId()
              setDeviceId(freshId)
              setRestoreId('')
              setBackupStatus({ ok: true, message: 'Restored. Reopen the Wardrobe and Outfits tabs to see it.' })
            } else {
              setBackupStatus({ ok: false, message: result.error })
            }
            setRestoring(false)
          }
        },
      ]
    )
  }

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
            setUrl('')
            setModelName('')
            setApiKey('')
            setLabel('')
            setTestStatus(null)
          }
        },
      ]
    )
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* ── AI Features Toggle ───────────────────────────── */}
      <Text style={styles.heading}>AI Features</Text>
      <View style={styles.toggleCard}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleLabel}>Use AI features</Text>
          <Text style={styles.toggleDesc}>
            {aiEnabled
              ? 'Auto-tagging and outfit suggestions are on.'
              : 'All AI features off. Add items manually and use the randomizer.'}
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

      {/* ── Theme Picker ─────────────────────────────────── */}
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

      {/* ── AI Theme Generator ───────────────────────── */}
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

      {/* Preview */}
      {previewTheme && (
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Preview — {previewName}</Text>

          {/* Color swatches */}
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

          {/* Mini UI preview */}
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

      {/* Current status */}
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Current fallback</Text>
        <Text style={styles.statusValue}>
          {currentConfig ? `${currentConfig.label || currentConfig.model}` : 'None configured'}
        </Text>
        {currentConfig && (
          <Text style={styles.statusUrl} numberOfLines={1}>{currentConfig.url}</Text>
        )}
      </View>

      {/* Presets */}
      <Text style={styles.sectionLabel}>Quick presets</Text>
      <View style={styles.presets}>
        {PRESETS.map(preset => (
          <TouchableOpacity
            key={preset.label}
            style={styles.presetBtn}
            onPress={() => handlePreset(preset)}
          >
            <Text style={styles.presetText}>{preset.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Form */}
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
      <View style={styles.keyLinksRow}>
        <Text style={styles.keyLinksLabel}>Need a key?</Text>
        {KEY_CONSOLE_URLS.map(({ label: lbl, url: consoleUrl }) => (
          <TouchableOpacity key={lbl} onPress={() => Linking.openURL(consoleUrl)}>
            <Text style={styles.keyLink}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Display name <Text style={styles.optional}>(optional)</Text></Text>
      <TextInput
        style={styles.input}
        value={label}
        onChangeText={setLabel}
        placeholder="e.g. My Ollama, Groq Llama"
        placeholderTextColor={theme.textPlaceholder}
      />

      {/* Test */}
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

      {/* Save */}
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>{saved ? 'Saved ✓' : 'Save'}</Text>
      </TouchableOpacity>

      {currentConfig && (
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearBtnText}>Remove fallback model</Text>
        </TouchableOpacity>
      )}

      <View style={styles.divider} />

      {/* ── Backup & Restore ─────────────────────────────── */}
      <Text style={styles.heading}>Backup & Restore</Text>
      <Text style={styles.subheading}>
        Reinstalling or updating the app can wipe everything stored on this phone. Back up to
        save your wardrobe, wishlist, and outfits to the cloud — restore to bring them back on
        this or any other phone.
      </Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>This device's ID</Text>
        <Text style={styles.statusValue} selectable numberOfLines={1}>{deviceId || '…'}</Text>
        <Text style={styles.statusUrl}>
          Write this down — you'll need it to restore onto a different phone.
        </Text>
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleBackup} disabled={backingUp}>
        {backingUp
          ? <ActivityIndicator color={theme.textOnAccent} />
          : <Text style={styles.saveBtnText}>Back up wardrobe now</Text>
        }
      </TouchableOpacity>

      <Text style={styles.fieldLabel}>
        Restore from device ID <Text style={styles.optional}>(leave blank to restore this device's own backup)</Text>
      </Text>
      <TextInput
        style={styles.input}
        value={restoreId}
        onChangeText={setRestoreId}
        placeholder={deviceId}
        placeholderTextColor={theme.textPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity style={styles.testBtn} onPress={handleRestore} disabled={restoring}>
        {restoring
          ? <ActivityIndicator color={theme.accent} />
          : <Text style={styles.testBtnText}>Restore wardrobe</Text>
        }
      </TouchableOpacity>

      {backupStatus && (
        <View style={[styles.testResult, backupStatus.ok ? styles.testOk : styles.testFail]}>
          <Text style={[styles.testResultText, backupStatus.ok ? styles.testOkText : styles.testFailText]}>
            {backupStatus.message}
          </Text>
        </View>
      )}

      <View style={styles.divider} />

      {/* ── Support ──────────────────────────────────────── */}
      <Text style={styles.heading}>Support</Text>
      <TouchableOpacity style={styles.testBtn} onPress={() => router.push('/bug-report')}>
        <Text style={styles.testBtnText}>Report a Bug</Text>
      </TouchableOpacity>

    </ScrollView>
  )
}

const makeStyles = (theme: Theme, topInset: number) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    padding: Spacing.screen,
    paddingTop: topInset + 8,
    paddingBottom: Spacing['12'],
  },
  heading: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 30,
    color: theme.textPrimary,
    marginBottom: Spacing.sm,
  },
  subheading: {
    ...Typography.styles.bodySmall,
    color: theme.textSecondary,
    marginBottom: Spacing.xl,
  },
  statusCard: {
    backgroundColor: theme.surface,
    borderRadius: Radius.md,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: theme.border,
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
  sectionLabel: {
    ...Typography.styles.sectionLabel,
    color: theme.sectionLabel,
    marginBottom: 10,
    marginTop: Spacing.xs,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  presetBtn: {
    backgroundColor: theme.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
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
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: Radius.md,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: theme.border,
    gap: Spacing.base,
    marginBottom: Spacing.xl,
  },
  toggleInfo: {
    flex: 1,
    gap: 4,
  },
  toggleLabel: {
    ...Typography.styles.body,
    color: theme.textPrimary,
  },
  toggleDesc: {
    ...Typography.styles.caption,
    color: theme.textSecondary,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: Spacing.xl,
  },
  fieldLabel: {
    ...Typography.styles.bodySmall,
    fontFamily: Typography.bodyMedium,
    color: theme.textPrimary,
    marginBottom: 6,
  },
  optional: {
    fontWeight: '400',
    fontFamily: Typography.body,
    color: theme.textSecondary,
  },
  input: {
    backgroundColor: theme.surface,
    borderRadius: Radius.md,
    padding: Spacing.base,
    fontSize: Typography.sm,
    fontFamily: Typography.body,
    color: theme.textPrimary,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: theme.border,
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
  },
  testBtnText: {
    ...Typography.styles.btnLabelSm,
    color: theme.accent,
  },
  testResult: {
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  testOk: {
    backgroundColor: 'rgba(86,163,92,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(86,163,92,0.3)',
  },
  testFail: {
    backgroundColor: theme.surfaceTint,
    borderWidth: 1,
    borderColor: theme.border,
  },
  testResultText: {
    fontSize: Typography.sm,
    fontFamily: Typography.bodyMedium,
  },
  testOkText: { color: '#3a7a3e' },
  testFailText: { color: theme.accentDanger },
  saveBtn: {
    backgroundColor: theme.accent,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  saveBtnText: {
    ...Typography.styles.btnLabel,
    color: theme.textOnAccent,
  },
  clearBtn: {
    padding: Spacing.base,
    alignItems: 'center',
  },
  clearBtnText: {
    ...Typography.styles.bodySmall,
    color: theme.textSecondary,
  },
  keyLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.base,
  },
  keyLinksLabel: {
    ...Typography.styles.caption,
    color: theme.textSecondary,
  },
  keyLink: {
    ...Typography.styles.caption,
    fontFamily: Typography.bodyMedium,
    color: theme.accent,
    textDecorationLine: 'underline',
  },
  generateRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  generateInput: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    fontSize: Typography.sm,
    fontFamily: Typography.body,
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
  generateBtnDisabled: {
    opacity: 0.45,
  },
  generateBtnText: {
    ...Typography.styles.btnLabelSm,
    color: theme.textOnAccent,
  },
  generatingHint: {
    ...Typography.styles.caption,
    color: theme.textSecondary,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
  },
  previewCard: {
    backgroundColor: theme.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  previewLabel: {
    ...Typography.styles.body,
    color: theme.textPrimary,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  swatchItem: {
    alignItems: 'center',
    gap: 4,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  swatchLabel: {
    ...Typography.styles.caption,
    color: theme.textSecondary,
  },
  miniPreview: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    overflow: 'hidden',
  },
  miniCard: {
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    gap: 6,
  },
  miniTitle: {
    fontSize: Typography.sm,
    fontFamily: Typography.displayBold,
  },
  miniSub: {
    fontSize: 9,
    fontFamily: Typography.bodyMedium,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  miniBtn: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  miniBtnText: {
    ...Typography.styles.caption,
    fontFamily: Typography.bodyMedium,
  },
  applyBtn: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  applyBtnText: {
    ...Typography.styles.btnLabelSm,
    color: theme.textOnAccent,
  },
  discardBtn: {
    padding: Spacing.sm,
    alignItems: 'center',
  },
  discardBtnText: {
    ...Typography.styles.bodySmall,
    color: theme.textSecondary,
  },
})
