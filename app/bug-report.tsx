import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import * as MailComposer from 'expo-mail-composer'
import { buildLogReport, clearBugLog } from '@/utils/bugLogger'
import { type Theme, Spacing, Radius, Typography } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

const BUG_REPORT_EMAIL = 'gehandy123+wearItBugs@gmail.com'

export default function BugReportScreen() {
  const { theme } = useTheme()
  const styles = makeStyles(theme)

  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!description.trim()) {
      Alert.alert('Add a few details first', 'Tell us what happened before sending.')
      return
    }

    setSending(true)
    try {
      const available = await MailComposer.isAvailableAsync()
      if (!available) {
        Alert.alert(
          'No mail app found',
          `Email ${BUG_REPORT_EMAIL} directly with what went wrong.`
        )
        return
      }

      const body = `${description.trim()}\n\n${buildLogReport()}`

      const result = await MailComposer.composeAsync({
        recipients: [BUG_REPORT_EMAIL],
        subject: 'WearIt Bug Report',
        body,
      })

      if (result.status === MailComposer.MailComposerStatus.SENT) {
        clearBugLog()
        setDescription('')
        Alert.alert('Thanks!', 'Bug report sent.')
      }
    } catch (err) {
      Alert.alert('Something went wrong sending the report', String(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Report a Bug</Text>
      <Text style={styles.subheading}>
        Tell us what happened. Recent app logs and device info get attached automatically —
        you don't need to copy/paste any of that yourself.
      </Text>

      <Text style={styles.fieldLabel}>What went wrong?</Text>
      <TextInput
        style={styles.textArea}
        value={description}
        onChangeText={setDescription}
        placeholder="What were you doing when it broke?"
        placeholderTextColor={theme.textPlaceholder}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
        onPress={handleSend}
        disabled={sending}
      >
        {sending ? (
          <ActivityIndicator color={theme.textOnAccent} />
        ) : (
          <Text style={styles.sendBtnText}>Send Report</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.footnote}>
        Opens your mail app with the report prefilled — you'll still need to tap Send there.
      </Text>
    </ScrollView>
  )
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    padding: Spacing.screen,
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
  fieldLabel: {
    ...Typography.styles.bodySmall,
    fontFamily: Typography.bodyMedium,
    color: theme.textPrimary,
    marginBottom: 6,
  },
  textArea: {
    backgroundColor: theme.surface,
    borderRadius: Radius.md,
    padding: Spacing.base,
    minHeight: 140,
    fontSize: Typography.sm,
    fontFamily: Typography.body,
    color: theme.textPrimary,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sendBtn: {
    backgroundColor: theme.accent,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  sendBtnText: {
    ...Typography.styles.btnLabel,
    color: theme.textOnAccent,
  },
  footnote: {
    ...Typography.styles.caption,
    color: theme.textSecondary,
    textAlign: 'center',
  },
})
