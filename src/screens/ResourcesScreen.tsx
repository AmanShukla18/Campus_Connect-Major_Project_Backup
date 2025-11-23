import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity, Linking } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api/client';
import { Ionicons } from '@expo/vector-icons';

type Resource = {
  _id: string;
  title: string;
  subject?: string;
  year?: string;
  url?: string;
  department?: string;
};

export default function ResourcesScreen() {
  const { userProfile } = useAuth();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Resource[]>([]);
  const navigation = useNavigation() as any;

  const isTeacher = userProfile?.designation === 'Teacher';

  useFocusEffect(
    React.useCallback(() => {
      fetchResources();
    }, [userProfile?.school])
  );

  async function fetchResources() {
    try {
      const schoolQuery = userProfile?.school ? `?school=${encodeURIComponent(userProfile.school)}` : '';
      const response = await fetch(`${API_BASE_URL}/api/resources${schoolQuery}`);
      if (response.ok) {
        const data = await response.json();
        setItems(data);
      }
    } catch (e) {
      console.error('Failed to fetch resources', e);
    }
  }

  const filteredResources = useMemo(() => {
    if (!q) return items;
    const needle = q.toLowerCase();
    return items.filter((item) =>
      [item.title, item.subject, item.year]
        .filter(Boolean)
        .some((field) => (field || '').toLowerCase().includes(needle))
    );
  }, [items, q]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Resources</Text>
      <TextInput placeholder="Search by title, subject, year..." value={q} onChangeText={setQ} style={styles.input} />

      {/* Only show upload button to teachers */}


      <FlatList
        data={filteredResources}
        keyExtractor={(n) => n._id}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Ionicons name="document-text-outline" size={24} color="#3b5bfd" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={{ color: '#6b7280', fontSize: 14 }}>
                {[item.subject, item.year, item.department].filter(Boolean).join(' • ')}
              </Text>
              {item.url && (
                <TouchableOpacity onPress={() => Linking.openURL(item.url!)} style={styles.previewBtn}>
                  <Text style={{ color: '#3b5bfd', fontWeight: '700' }}>Preview</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No resources yet.</Text>}
      />

      {isTeacher && (
        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('UploadResource' as any)}>
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f8ff' },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 16, color: '#1f2937' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e6e9f3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  row: { gap: 8, marginBottom: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e6e9f3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4, color: '#1f2937' },
  empty: { textAlign: 'center', color: '#6b7280', marginTop: 40, fontSize: 16 },
  upload: { backgroundColor: '#3b5bfd', borderRadius: 12, alignItems: 'center', paddingVertical: 12 },
  previewBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#eaf0ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    backgroundColor: '#3b5bfd',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#3b5bfd',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
});
