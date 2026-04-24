import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Colors } from '../constants/colors';

const COLORS = [
  { hex: '#FFFFFF', name: 'White' },
  { hex: '#F5F5F5', name: 'Off White' },
  { hex: '#E0E0E0', name: 'Light Grey' },
  { hex: '#9E9E9E', name: 'Grey' },
  { hex: '#424242', name: 'Dark Grey' },
  { hex: '#212121', name: 'Black' },
  { hex: '#FFCDD2', name: 'Light Pink' },
  { hex: '#E91E63', name: 'Pink' },
  { hex: '#F44336', name: 'Red' },
  { hex: '#FF7043', name: 'Orange Red' },
  { hex: '#FF9800', name: 'Orange' },
  { hex: '#FFC107', name: 'Yellow' },
  { hex: '#8BC34A', name: 'Light Green' },
  { hex: '#4CAF50', name: 'Green' },
  { hex: '#009688', name: 'Teal' },
  { hex: '#03A9F4', name: 'Light Blue' },
  { hex: '#2196F3', name: 'Blue' },
  { hex: '#3F51B5', name: 'Navy' },
  { hex: '#9C27B0', name: 'Purple' },
  { hex: '#795548', name: 'Brown' },
  { hex: '#C17B5C', name: 'Terracotta' },
  { hex: '#D2B48C', name: 'Tan' },
  { hex: '#F5DEB3', name: 'Beige' },
  { hex: '#800000', name: 'Burgundy' },
];

interface ColorPickerProps {
  selected: string;
  onSelect: (hex: string, name: string) => void;
}

export default function ColorPicker({ selected, onSelect }: ColorPickerProps) {
  const selectedColor = COLORS.find((c) => c.hex === selected);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        Color{selectedColor ? `: ${selectedColor.name}` : ''}
      </Text>
      <View style={styles.grid}>
        {COLORS.map((color) => (
          <TouchableOpacity
            key={color.hex}
            style={[
              styles.swatch,
              { backgroundColor: color.hex },
              color.hex === '#FFFFFF' && styles.swatchBorder,
              selected === color.hex && styles.swatchSelected,
            ]}
            onPress={() => onSelect(color.hex, color.name)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  swatchBorder: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: Colors.primary,
  },
});
