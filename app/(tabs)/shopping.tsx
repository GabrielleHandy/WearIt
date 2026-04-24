import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Image, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { getWardrobe } from '../../utils/storage';
import { checkDuplicate } from '../../utils/anthropic';

export default function ShoppingScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async (fromCamera: boolean) => {
    const permFn = fromCamera
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;
    const { status } = await permFn();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to continue.');
      return;
    }
    const launchFn = fromCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;
    const res = await launchFn({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!res.canceled) {
      setImageUri(res.assets[0].uri);
      setResult(null);
    }
  };

  const analyze = async () => {
    if (!imageUri) return;
    setLoading(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });
      const wardrobe = await getWardrobe();
      const reply = await checkDuplicate(base64, wardrobe);
      setResult(reply);
    } catch {
      setResult('Something went wrong. Please try again!');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setImageUri(null); setResult(null); };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Shopping Check</Text>
        <Text style={styles.subtitle}>Do I already own this?</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!imageUri ? (
          <View style={styles.placeholder}>
            <Ionicons name="bag-outline" size={64} color={Colors.primaryLight} />
            <Text style={styles.placeholderTitle}>Snap something you're considering</Text>
            <Text style={styles.placeholderText}>I'll check if you already own something similar and if it works with your wardrobe.</Text>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.pickBtn} onPress={() => pickImage(false)}>
                <Ionicons name="images-outline" size={20} color={Colors.primary} />
                <Text style={styles.pickBtnText}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickBtn} onPress={() => pickImage(true)}>
                <Ionicons name="camera-outline" size={20} color={Colors.primary} />
                <Text style={styles.pickBtnText}>Camera</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.analyzeArea}>
            <Image source={{ uri: imageUri }} style={styles.preview} />
            {result ? (
              <View style={styles.resultCard}>
                <Ionicons name="sparkles" size={20} color={Colors.primary} style={{ marginBottom: 8 }} />
                <Text style={styles.resultText}>{result}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.analyzeBtn, loading && styles.analyzeBtnDisabled]}
                onPress={analyze}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.analyzeBtnText}>Checking your wardrobe...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="sparkles-outline" size={18} color="#fff" />
                    <Text style={styles.analyzeBtnText}>Check my wardrobe</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.resetBtn} onPress={reset}>
              <Text style={styles.resetBtnText}>Try a different item</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  content: { padding: 24, alignItems: 'center' },
  placeholder: { alignItems: 'center', paddingVertical: 32 },
  placeholderTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: 16, marginBottom: 8, textAlign: 'center' },
  placeholderText: { fontSize: 14, color: Colors.textLight, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  btnRow: { flexDirection: 'row', gap: 12 },
  pickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 24,
    paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.surface,
  },
  pickBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '500' },
  analyzeArea: { width: '100%', alignItems: 'center', gap: 16 },
  preview: { width: 240, height: 240, borderRadius: 20, backgroundColor: Colors.primaryLight },
  analyzeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 28, width: '100%', justifyContent: 'center',
  },
  analyzeBtnDisabled: { opacity: 0.7 },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resultCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, padding: 20, width: '100%', alignItems: 'flex-start',
  },
  resultText: { fontSize: 15, color: Colors.text, lineHeight: 24 },
  resetBtn: { paddingVertical: 8 },
  resetBtnText: { color: Colors.textLight, fontSize: 14, textDecorationLine: 'underline' },
});
