import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { getWardrobe, ClothingItem } from '../../utils/storage';
import ClothingCard from '../../components/ClothingCard';
import AddItemModal from '../../components/AddItemModal';

export default function WardrobeScreen() {
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    const items = await getWardrobe();
    setWardrobe(items);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Closet</Text>
          <Text style={styles.subtitle}>{wardrobe.length} item{wardrobe.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {wardrobe.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="shirt-outline" size={64} color={Colors.primaryLight} />
          <Text style={styles.emptyTitle}>Your closet is empty</Text>
          <Text style={styles.emptyText}>Tap + to add your first item and start building your wardrobe!</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowModal(true)}>
            <Text style={styles.emptyBtnText}>Add first item</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={wardrobe}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <ClothingCard item={item} onDelete={load} />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      <AddItemModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSaved={() => { setShowModal(false); load(); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  addBtn: {
    backgroundColor: Colors.primary, width: 42, height: 42,
    borderRadius: 21, alignItems: 'center', justifyContent: 'center',
  },
  grid: { padding: 16 },
  row: { justifyContent: 'space-between' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: Colors.text, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.textLight, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 24, backgroundColor: Colors.primary,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24,
  },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
