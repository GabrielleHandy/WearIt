import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { getWardrobe } from '../../utils/storage';
import { getOutfitSuggestion } from '../../utils/anthropic';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTIONS = [
  'What can I wear to a casual dinner?',
  'Give me a work outfit',
  'What goes with my navy top?',
  'Help me pick something comfy',
];

export default function OutfitsScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const wardrobe = await getWardrobe();
      const reply = await getOutfitSuggestion(text.trim(), wardrobe);
      const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', text: reply };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', text: 'Sorry, something went wrong. Please try again!' };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Ask Your Stylist</Text>
        <Text style={styles.subtitle}>Powered by Claude AI</Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && (
            <View style={styles.welcome}>
              <Ionicons name="sparkles" size={40} color={Colors.primary} />
              <Text style={styles.welcomeTitle}>Hi! I'm your AI stylist</Text>
              <Text style={styles.welcomeText}>I know your wardrobe and I'm here to help. Ask me anything!</Text>
              <View style={styles.chips}>
                {SUGGESTIONS.map((s) => (
                  <TouchableOpacity key={s} style={styles.chip} onPress={() => send(s)}>
                    <Text style={styles.chipText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {messages.map((msg) => (
            <View key={msg.id} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
              <Text style={[styles.bubbleText, msg.role === 'user' ? styles.userText : styles.assistantText]}>
                {msg.text}
              </Text>
            </View>
          ))}

          {loading && (
            <View style={styles.assistantBubble}>
              <Text style={styles.thinking}>Your stylist is thinking... ✨</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask your stylist..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={300}
            returnKeyType="send"
            onSubmitEditing={() => send(input)}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 12 },
  welcome: { alignItems: 'center', paddingVertical: 24 },
  welcomeTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: 12 },
  welcomeText: { fontSize: 14, color: Colors.textLight, textAlign: 'center', marginTop: 6, marginBottom: 20 },
  chips: { gap: 8, width: '100%' },
  chip: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
  },
  chipText: { fontSize: 14, color: Colors.text },
  bubble: { maxWidth: '85%', borderRadius: 18, padding: 14 },
  userBubble: { backgroundColor: Colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: Colors.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.border },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#fff' },
  assistantText: { color: Colors.text },
  thinking: { fontSize: 14, color: Colors.textLight, fontStyle: 'italic' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface,
  },
  input: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15,
    color: Colors.text, backgroundColor: Colors.background, maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: Colors.primary, width: 42, height: 42,
    borderRadius: 21, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
});
