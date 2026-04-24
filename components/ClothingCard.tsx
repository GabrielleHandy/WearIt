import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ClothingItem, deleteItem } from '../utils/storage';
import { Colors } from '../constants/colors';
import { CATEGORIES } from '../constants/categories';

interface ClothingCardProps {
  item: ClothingItem;
  onDelete: () => void;
}

export default function ClothingCard({ item, onDelete }: ClothingCardProps) {
  const category = CATEGORIES.find((c) => c.id === item.category);

  const handleDelete = () => {
    Alert.alert('Remove item', 'Remove this item from your closet?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteItem(item.id);
          onDelete();
        },
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <Image source={{ uri: item.imageUri }} style={styles.image} />
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <Ionicons name="close-circle" size={22} color={Colors.textMuted} />
      </TouchableOpacity>
      <View style={styles.info}>
        <View style={[styles.colorDot, { backgroundColor: item.color }]} />
        <Text style={styles.category} numberOfLines={1}>
          {category?.label ?? item.category}
        </Text>
      </View>
      {item.notes ? (
        <Text style={styles.notes} numberOfLines={1}>{item.notes}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.primaryLight,
  },
  deleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  category: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
    flex: 1,
  },
  notes: {
    fontSize: 11,
    color: Colors.textMuted,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
});
