import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function EditScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Clothing</Text>
      <Link href="/" dismissTo style={styles.link}>
        <Text style={styles.linkText}>Go to back</Text>
      </Link>
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 16,
    color: '#0a7ea4',
  },
});
