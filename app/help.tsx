import { useState, useMemo, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { type Theme, Spacing, Radius, Typography, Shadow } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { FAQS, askHelpAssistant, type HelpFAQ } from '@/utils/helpAssistant'

type Message = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

const QUICK_CHIPS = [
  'How do I add clothes?',
  'How do I backup my closet?',
  'How do I restore on a new phone?',
  'How do outfits get styled?',
]

export default function HelpScreen() {
  const { theme } = useTheme()
  const router = useRouter()
  const { top, bottom } = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(theme, top, bottom), [theme, top, bottom])
  const scrollViewRef = useRef<ScrollView>(null)

  // Accordion state
  const [expandedFaq, setExpandedFaq] = useState<string | null>('add-clothes')

  // Chat State
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hi! I'm your WearIt Guide. Ask me anything about adding clothes, generating outfits, backing up your closet, or customizing your style!"
    }
  ])

  const handleAsk = async (textToAsk?: string) => {
    const question = (textToAsk || query).trim()
    if (!question || loading) return

    setQuery('')
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: question }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true })
    }, 100)

    try {
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, text: m.text }))

      const answer = await askHelpAssistant(question, history)
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: answer
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: "I couldn't process that right now. Check the guides below for instant instructions!"
        }
      ])
    } finally {
      setLoading(false)
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true })
      }, 150)
    }
  }

  const toggleFaq = (id: string) => {
    setExpandedFaq(prev => (prev === id ? null : id))
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Help & Guide</Text>
          <Text style={styles.subtitle}>
            Ask our AI assistant or browse quick step-by-step guides.
          </Text>
        </View>

        {/* ── AI Assistant Section ────────────────────────────── */}
        <View style={styles.chatCard}>
          <View style={styles.chatHeader}>
            <View style={styles.chatAvatar}>
              <Ionicons name="sparkles" size={16} color={theme.accent} />
            </View>
            <View>
              <Text style={styles.chatTitle}>Ask WearIt Assistant</Text>
              <Text style={styles.chatSubtitle}>Instant answers on all app features</Text>
            </View>
          </View>

          {/* Messages Stream */}
          <View style={styles.messagesContainer}>
            {messages.map(m => (
              <View
                key={m.id}
                style={[
                  styles.messageBubble,
                  m.role === 'user' ? styles.userBubble : styles.assistantBubble
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    m.role === 'user' ? styles.userText : styles.assistantText
                  ]}
                >
                  {m.text}
                </Text>
              </View>
            ))}

            {loading && (
              <View style={[styles.messageBubble, styles.assistantBubble, styles.loadingBubble]}>
                <ActivityIndicator size="small" color={theme.accent} />
                <Text style={[styles.assistantText, { marginLeft: 8, fontStyle: 'italic' }]}>
                  Thinking…
                </Text>
              </View>
            )}
          </View>

          {/* Quick Prompt Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {QUICK_CHIPS.map(chip => (
              <TouchableOpacity
                key={chip}
                style={styles.chip}
                onPress={() => handleAsk(chip)}
                disabled={loading}
              >
                <Text style={styles.chipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Input Row */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Ask a question (e.g. How to backup?)"
              placeholderTextColor={theme.textPlaceholder}
              returnKeyType="send"
              onSubmitEditing={() => handleAsk()}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !query.trim() && styles.sendBtnDisabled]}
              onPress={() => handleAsk()}
              disabled={!query.trim() || loading}
            >
              <Ionicons name="arrow-up" size={20} color={theme.textOnAccent} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Step-by-Step Guides (Accordion) ────────────────── */}
        <Text style={styles.sectionHeading}>Step-by-Step Guides</Text>

        <View style={styles.faqList}>
          {FAQS.map(faq => {
            const isExpanded = expandedFaq === faq.id
            return (
              <View key={faq.id} style={styles.faqCard}>
                <TouchableOpacity
                  style={styles.faqHeader}
                  onPress={() => toggleFaq(faq.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.faqIconContainer}>
                    <Ionicons name={faq.icon as any} size={18} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.faqCategory}>{faq.category}</Text>
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.faqBody}>
                    <Text style={styles.faqSummary}>{faq.summary}</Text>
                    
                    <View style={styles.stepsContainer}>
                      {faq.steps.map((step, idx) => (
                        <View key={idx} style={styles.stepRow}>
                          <View style={styles.stepBadge}>
                            <Text style={styles.stepNumber}>{idx + 1}</Text>
                          </View>
                          <Text style={styles.stepText}>{step}</Text>
                        </View>
                      ))}
                    </View>

                    {faq.tips && (
                      <View style={styles.tipBox}>
                        <Ionicons name="bulb-outline" size={16} color={theme.accent} />
                        <Text style={styles.tipText}>{faq.tips}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )
          })}
        </View>

        {/* ── Action Buttons (Replay Tutorial & Report Bug) ──── */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.secondaryActionBtn}
            onPress={() => router.push('/onboarding')}
          >
            <Ionicons name="play-circle-outline" size={20} color={theme.accent} />
            <Text style={styles.secondaryActionText}>Replay App Tutorial</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryActionBtn}
            onPress={() => router.push('/bug-report')}
          >
            <Ionicons name="bug-outline" size={20} color={theme.textSecondary} />
            <Text style={[styles.secondaryActionText, { color: theme.textSecondary }]}>
              Report an Issue
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (theme: Theme, top: number, bottom: number) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      padding: Spacing.screen,
      paddingTop: Spacing.base,
      paddingBottom: bottom + Spacing['12'],
    },
    header: {
      marginBottom: Spacing.lg,
    },
    title: {
      fontFamily: 'CormorantGaramond_600SemiBold',
      fontSize: 32,
      color: theme.textPrimary,
      marginBottom: 4,
    },
    subtitle: {
      ...Typography.styles.bodySmall,
      color: theme.textSecondary,
    },
    // Chat card
    chatCard: {
      backgroundColor: theme.surface,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.base,
      marginBottom: Spacing.xl,
      ...Shadow.sm,
    },
    chatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderSubtle,
    },
    chatAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surfaceTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chatTitle: {
      fontFamily: Typography.bodyMedium,
      fontSize: Typography.sm,
      color: theme.textPrimary,
    },
    chatSubtitle: {
      ...Typography.styles.caption,
      color: theme.textSecondary,
    },
    messagesContainer: {
      gap: Spacing.sm,
      marginBottom: Spacing.md,
      maxHeight: 320,
    },
    messageBubble: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.md,
      maxWidth: '88%',
    },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: theme.accent,
      borderBottomRightRadius: 4,
    },
    assistantBubble: {
      alignSelf: 'flex-start',
      backgroundColor: theme.surfaceTint,
      borderBottomLeftRadius: 4,
    },
    loadingBubble: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    messageText: {
      ...Typography.styles.bodySmall,
      lineHeight: 20,
    },
    userText: {
      color: theme.textOnAccent,
    },
    assistantText: {
      color: theme.textPrimary,
    },
    chipsRow: {
      gap: Spacing.xs,
      paddingBottom: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    chip: {
      backgroundColor: theme.surfaceTint,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
    },
    chipText: {
      ...Typography.styles.caption,
      color: theme.textPrimary,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    input: {
      flex: 1,
      backgroundColor: theme.background,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.base,
      paddingVertical: 10,
      fontSize: Typography.sm,
      fontFamily: Typography.body,
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: {
      opacity: 0.4,
    },
    // FAQ Accordion
    sectionHeading: {
      fontFamily: 'CormorantGaramond_600SemiBold',
      fontSize: 22,
      color: theme.textPrimary,
      marginBottom: Spacing.md,
    },
    faqList: {
      gap: Spacing.md,
      marginBottom: Spacing.xl,
    },
    faqCard: {
      backgroundColor: theme.surface,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    faqHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.base,
      gap: Spacing.sm,
    },
    faqIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surfaceTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    faqCategory: {
      ...Typography.styles.caption,
      color: theme.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      fontSize: 10,
    },
    faqQuestion: {
      fontFamily: Typography.bodyMedium,
      fontSize: Typography.sm,
      color: theme.textPrimary,
    },
    faqBody: {
      paddingHorizontal: Spacing.base,
      paddingBottom: Spacing.base,
      borderTopWidth: 1,
      borderTopColor: theme.borderSubtle,
      paddingTop: Spacing.sm,
    },
    faqSummary: {
      ...Typography.styles.bodySmall,
      color: theme.textSecondary,
      marginBottom: Spacing.md,
    },
    stepsContainer: {
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    stepBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    stepNumber: {
      color: theme.textOnAccent,
      fontSize: 11,
      fontFamily: Typography.bodyMedium,
    },
    stepText: {
      flex: 1,
      ...Typography.styles.bodySmall,
      color: theme.textPrimary,
      lineHeight: 18,
    },
    tipBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: theme.surfaceTint,
      padding: Spacing.sm,
      borderRadius: Radius.sm,
    },
    tipText: {
      flex: 1,
      ...Typography.styles.caption,
      color: theme.textPrimary,
      fontStyle: 'italic',
    },
    // Actions
    actionSection: {
      gap: Spacing.sm,
    },
    secondaryActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: theme.surface,
      borderRadius: Radius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    secondaryActionText: {
      fontFamily: Typography.bodyMedium,
      fontSize: Typography.sm,
      color: theme.accent,
    },
  })
