import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api/client';

type Notice = {
  _id: string;
  id?: string;
  title: string;
  department?: string;
  year?: string;
  type?: string;
  content?: string;
  createdAt?: string;
};

export default function NoticesScreen() {
  const { email, userProfile } = useAuth();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Notice[]>([]);
  const [modal, setModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  // New State for Dropdowns
  const [targetAudience, setTargetAudience] = useState('All');
  const [targetYear, setTargetYear] = useState('All Years');
  const [noticeType, setNoticeType] = useState('General');

  useFocusEffect(
    React.useCallback(() => {
      fetchNotices();
    }, [])
  );

  async function fetchNotices() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notices`);
      if (response.ok) {
        const data = await response.json();
        setItems(data);
      }
    } catch (e) {
      console.error('Failed to fetch notices', e);
    }
  }

  async function createNotice() {
    if (!newTitle) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/notices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          department: targetAudience === 'All' ? 'All' : targetAudience,
          type: noticeType,
          year: targetYear,
          createdByEmail: email,
        }),
      });

      if (response.ok) {
        setModal(false);
        setNewTitle('');
        setNewContent('');
        // Reset defaults
        setTargetAudience('All');
        setTargetYear('All Years');
        setNoticeType('General');
        fetchNotices();
      }
    } catch (e) {
      console.error('Failed to create notice', e);
    }
  }

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const needle = search.toLowerCase();
    return items.filter((notice) =>
      [notice.title, notice.content, notice.department, notice.type]
        .filter(Boolean)
        .some((field) => (field || '').toLowerCase().includes(needle))
    );
  }, [items, search]);

  // Custom Dropdown Component
  const Dropdown = ({ label, value, options, onSelect }: { label: string, value: string, options: string[], onSelect: (val: string) => void }) => {
    const [visible, setVisible] = useState(false);
    return (
      <View style={{ marginBottom: 16, zIndex: visible ? 1000 : 1 }}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity style={styles.dropdownBtn} onPress={() => setVisible(!visible)}>
          <Text style={styles.dropdownBtnText}>{value}</Text>
          <Text style={{ color: '#3b5bfd' }}>▼</Text>
        </TouchableOpacity>
        {visible && (
          <View style={styles.dropdownList}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={styles.dropdownItem}
                onPress={() => {
                  onSelect(opt);
                  setVisible(false);
                }}
              >
                <Text style={[styles.dropdownItemText, value === opt && { color: '#3b5bfd', fontWeight: '700' }]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notices</Text>
      <TextInput
        placeholder="Search notices, keywords, department..."
        value={search}
        onChangeText={setSearch}
        style={styles.input}
      />
      <FlatList
        data={filteredItems}
        keyExtractor={(n) => n._id || n.id || Math.random().toString()}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Text style={{ fontSize: 20 }}>📢</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {!!item.content && <Text style={styles.cardBody}>{item.content}</Text>}
              <Text style={styles.cardMeta}>
                {[item.department, item.type, item.year].filter(Boolean).join(' • ')}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No notices yet.</Text>}
      />

      {/* Only show Add button for Teachers */}
      {userProfile?.designation === 'Teacher' && (
        <TouchableOpacity style={styles.fab} onPress={() => setModal(true)}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Add</Text>
        </TouchableOpacity>
      )}

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>Create Notice</Text>

            <TextInput placeholder="Title" value={newTitle} onChangeText={setNewTitle} style={styles.input} />

            <Dropdown
              label="Target Audience"
              value={targetAudience}
              options={['All', ...(userProfile?.school ? [userProfile.school] : [])]}
              onSelect={setTargetAudience}
            />

            <Dropdown
              label="Year"
              value={targetYear}
              options={['All Years', '1st Year', '2nd Year', '3rd Year', '4th Year']}
              onSelect={setTargetYear}
            />

            <Dropdown
              label="Type"
              value={noticeType}
              options={['General', 'Event', 'Placement', 'Academic']}
              onSelect={setNoticeType}
            />

            <TextInput
              placeholder="Description"
              value={newContent}
              onChangeText={setNewContent}
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              multiline
            />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <TouchableOpacity style={[styles.fab, { position: 'relative', backgroundColor: '#eaf0ff', flex: 1, right: 0, bottom: 0 }]} onPress={() => setModal(false)}>
                <Text style={{ color: '#3b5bfd', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fab, { position: 'relative', flex: 1, right: 0, bottom: 0 }]}
                onPress={createNotice}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    alignItems: 'flex-start',
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: '#1f2937' },
  cardBody: { color: '#4b5563', lineHeight: 22, fontSize: 15 },
  cardMeta: { fontSize: 12, color: '#9ca3af', marginTop: 8, fontWeight: '600' },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eaf0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  empty: { textAlign: 'center', color: '#6b7280', marginTop: 40, fontSize: 16 },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    backgroundColor: '#3b5bfd',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#3b5bfd',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10, maxHeight: '80%' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  dropdownBtn: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownBtnText: { fontSize: 15, color: '#1f2937' },
  dropdownList: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    marginTop: 4,
    padding: 4,
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  dropdownItemText: { fontSize: 14, color: '#4b5563' },
});
