import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { onValue, ref, remove as removeEntry, update } from 'firebase/database';
import { useAuth } from '../context/AuthContext';
import { realtimeDb, auth } from '../lib/firebase';
import { InlineVideo } from '../components/InlineVideo';

type Item = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  contact?: string;
  status?: string;
  date?: string;
  reportedByEmail?: string;
  reportedByUid?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
};

export default function LostFoundScreen({ navigation }: any) {
  const { email } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<'All' | 'Active' | 'Claimed'>('All');
  useEffect(() => {
    const dbRef = ref(realtimeDb, 'lostfound');
    const unsubscribe = onValue(dbRef, (snapshot) => {
      const data = snapshot.val() || {};
      const nextItems: Item[] = Object.keys(data).map((key) => {
        const entry = data[key] as any;
        const mediaUrl = entry.mediaUrl || entry.imageUrl;
        const mediaType = entry.mediaType || (mediaUrl ? 'image' : undefined);
        return { id: key, ...entry, mediaUrl, mediaType };
      });
      nextItems.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setItems(nextItems);
    });
    return () => unsubscribe();
  }, []);

  async function claim(id: string) {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to mark an item as claimed.');
      return;
    }

    try {
      await update(ref(realtimeDb, `lostfound/${id}`), { status: 'Claimed', claimedByUid: user.uid, claimedAt: new Date().toISOString() });
    } catch (error: any) {
      console.error('Failed to mark item claimed', error);
      Alert.alert('Error', error?.message || 'Unable to update item.');
    }
  }

  async function remove(item: Item) {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to delete your items.');
      return;
    }

    const ownsByUid = item.reportedByUid && item.reportedByUid === user.uid;
    const ownsByEmail = !item.reportedByUid && item.reportedByEmail && item.reportedByEmail === (user.email || email);
    if (!ownsByUid && !ownsByEmail) {
      Alert.alert('Permission denied', 'You can only delete items you posted.');
      return;
    }

    try {
      await removeEntry(ref(realtimeDb, `lostfound/${item.id}`));
    } catch (error: any) {
      console.error('Failed to delete item', error);
      Alert.alert('Error', error?.message || 'Unable to delete item.');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lost & Found</Text>
      <Text style={{ color: '#6b7280', marginBottom: 12 }}>Find or report items — instant updates</Text>
      <Text style={styles.section}>Look for lost object</Text>
      <View style={styles.filters}>
        {(['All', 'Active', 'Claimed'] as const).map((f) => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.chip, filter === f && styles.chipActive]}>
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={items.filter(i => filter === 'All' ? true : i.status === filter)}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.mediaUrl && (
              item.mediaType === 'video' ? (
                <InlineVideo uri={item.mediaUrl} style={styles.cardVideo} />
              ) : (
                <Image source={{ uri: item.mediaUrl }} style={styles.cardImage} />
              )
            )}
            {!!item.description && <Text style={styles.cardBody}>{item.description}</Text>}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
              <View>
                <Text style={{ color: '#6b7280' }}>Location: {item.location}</Text>
                <Text style={{ color: '#6b7280' }}>Contact: {item.contact}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {item.status !== 'Claimed' && (
                  <TouchableOpacity onPress={() => claim(item.id)}>
                    <Text style={{ color: '#3b5bfd', fontWeight: '600' }}>Mark Claimed</Text>
                  </TouchableOpacity>
                )}
                {email && item.reportedByEmail === email && (
                  <TouchableOpacity onPress={() => remove(item)}>
                    <Text style={{ color: '#ef4444', fontWeight: '700' }}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No items yet.</Text>}
      />
      <View style={styles.reportCard}>
        <Text style={{ fontWeight: '700', marginBottom: 6 }}>Post a found object</Text>
        <Text style={{ color: '#6b7280', marginBottom: 12 }}>Help someone get their item back — report what you found.</Text>
        <TouchableOpacity style={styles.reportBtn} onPress={() => navigation.navigate('ReportFound')}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Report</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f8ff' },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8, color: '#1f2937' },
  section: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#374151' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e6e9f3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: '#1f2937' },
  cardImage: { width: '100%', height: 200, borderRadius: 16, marginBottom: 12, backgroundColor: '#dbe5ff' },
  cardVideo: { width: '100%', height: 240, borderRadius: 16, marginBottom: 12, backgroundColor: '#000' },
  cardBody: { color: '#4b5563', fontSize: 15, lineHeight: 22, marginBottom: 12 },
  empty: { textAlign: 'center', color: '#6b7280', marginTop: 40, fontSize: 16 },
  filters: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e6e9f3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chipActive: { backgroundColor: '#3b5bfd', borderColor: '#3b5bfd' },
  chipText: { color: '#4b5563', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e6e9f3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 10,
  },
  reportBtn: {
    backgroundColor: '#3b5bfd',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#3b5bfd',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});


