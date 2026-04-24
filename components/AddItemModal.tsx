import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  TextInput, ScrollView, Image, Platform, KeyboardAvoidingView, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { CATEGORIES } from '../constants/categories';
import ColorPicker from './ColorPicker';
import { saveItem, generateId, ClothingItem } from '../utils/storage';

interface AddItemModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddItemModal({ visible, onClose, onSaved }: AddItemModalProps) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [category, setCategory] = useState('tops');
  const [color, setColor] = useState('#FFFFFF');
  const [colorName, setColorName] = useState('White');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setImageUri(null);
    setCategory('tops');
    setColor('#FFFFFF');
    setColorName('White');
    setNotes('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!imageUri) {
      Alert.alert('Add a photo', 'Please add a photo of the item first.');
      return;
    }
    const item: ClothingItem = {
      id: generateId(),
      imageUri,
      category,
      color,
      colorName,
      notes,
      createdAt: Date.now(),
    };
    await saveItem(item);
    reset();
    onSaved();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Add to Closet</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.photoArea} onPress={pickFromGallery} activeOpacity={0.8}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="image-outline" size={44} color={Colors.primaryLight} />
                <Text style={styles.photoHint}>Tap to choose a photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.photoActions}>
            <TouchableOpacity style={styles.photoBtn} onPress={pickFromGallery}>
              <Ionicons name="images-outline" size={17} color={Colors.primary} />
              <Text style={styles.photoBtnText}>Gallery</Text>
            </TouchableOpacity>
            <View style={styles.photoDivider} />
            <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={17} color={Colors.primary} />
              <Text style={styles.photoBtnText}>Camera</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, category === cat.id && styles.chipSelected]}
                onPress={() => setCategory(cat.id)}
              >
                <Text style={[styles.chipText, category === cat.id && styles.chipTextSelected]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ColorPicker selected={color} onSelect={(hex, name) => { setColor(hex); setColorName(name); }} />

          <Text style={styles.sectionLabel}>Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. flowy, vintage, work-only…"
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={120}
          />
          <View style={styles.spacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface,
  },
  title: { fontSize: 17, fontWeight: '600', color: Colors.text },
  saveBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  body: { flex: 1 },
  bodyContent: { padding: 20 },
  photoArea: {
    borderRadius: 16, overflow: 'hidden', backgroundColor: Colors.primaryLight,
    marginBottom: 12, aspectRatio: 1, maxHeight: 260, alignSelf: 'center', width: '70%',
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoHint: { color: Colors.textLight, fontSize: 13 },
  photoActions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 8 },
  photoBtnText: { color: Colors.primary, fontSize: 14, fontWeight: '500' },
  photoDivider: { width: 1, height: 18, backgroundColor: Colors.border },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  chipText: { fontSize: 14, color: Colors.textLight, fontWeight: '500' },
  chipTextSelected: { color: Colors.primary, fontWeight: '600' },
  notesInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 14,
    fontSize: 15, color: Colors.text, backgroundColor: Colors.surface, minHeight: 80, textAlignVertical: 'top',
  },
  spacer: { height: 40 },
});
