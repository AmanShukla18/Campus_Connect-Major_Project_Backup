import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api/client';
import { Ionicons } from '@expo/vector-icons';

type Message = {
  sender: string;
  content?: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  createdAt: string;
};

type Group = {
  _id: string;
  name: string;
  subject?: string;
  members?: string[];
  createdByEmail?: string;
  createdByDesignation?: string;
  school?: string;
  status?: string;
  approvedBy?: string;
  messages?: Message[];
};

export default function StudyGroupsScreen() {
  const { email, userProfile } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [pendingGroups, setPendingGroups] = useState<Group[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const isTeacher = userProfile?.designation === 'Teacher';

  useEffect(() => {
    fetchGroups();
  }, [userProfile]);

  // Polling for active group messages
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (detailVisible && activeGroup) {
      fetchGroupDetails(activeGroup._id); // Initial fetch
      interval = setInterval(() => {
        fetchGroupDetails(activeGroup._id);
      }, 3000); // Poll every 3 seconds
    }
    return () => clearInterval(interval);
  }, [detailVisible, activeGroup?._id]);

  async function fetchGroupDetails(groupId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/groups/${groupId}`);
      if (response.ok) {
        const data = await response.json();
        // Only update if messages changed to avoid re-renders/scroll jumps if possible, 
        // but for now simple state update is fine.
        setActiveGroup(prev => {
          if (!prev) return data;
          // simple check to avoid unnecessary updates if nothing changed
          if (JSON.stringify(prev.messages) !== JSON.stringify(data.messages)) {
            return data;
          }
          return prev;
        });
      }
    } catch (e) {
      console.error('Failed to fetch group details', e);
    }
  }

  async function fetchGroups() {
    try {
      // Fetch approved groups filtered by school
      const schoolQuery = userProfile?.school ? `&school=${encodeURIComponent(userProfile.school)}` : '';
      const response = await fetch(`${API_BASE_URL}/api/groups?status=Approved${schoolQuery}`);
      let approvedData: Group[] = [];
      if (response.ok) {
        approvedData = await response.json();
      }

      let pendingData: Group[] = [];

      // If teacher, also fetch pending groups from their school
      if (isTeacher && userProfile?.school) {
        const pendingResponse = await fetch(`${API_BASE_URL}/api/groups?status=Pending&school=${encodeURIComponent(userProfile.school)}`);
        if (pendingResponse.ok) {
          const teacherPendingData = await pendingResponse.json();
          setPendingGroups(teacherPendingData);
        }
      } else if (!isTeacher && email) {
        // If student, fetch their own pending requests
        const myPendingResponse = await fetch(`${API_BASE_URL}/api/groups?status=Pending&createdByEmail=${encodeURIComponent(email)}`);
        if (myPendingResponse.ok) {
          pendingData = await myPendingResponse.json();
        }
      }

      setGroups([...pendingData, ...approvedData]);
    } catch (e) {
      console.error('Failed to fetch groups', e);
    }
  }

  async function create() {
    if (!name || !subject) {
      return Alert.alert('Missing Fields', 'Please provide group name and subject');
    }
    if (!userProfile) {
      return Alert.alert('Error', 'User profile not loaded');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          subject,
          createdByEmail: email,
          createdByDesignation: userProfile.designation,
          school: userProfile.school,
        }),
      });

      if (response.ok) {
        const created = await response.json();
        if (created.status === 'Pending') {
          Alert.alert('Request Submitted', 'Your study group request has been submitted for teacher approval.');
        } else {
          Alert.alert('Success', 'Study group created successfully!');
        }
        setName('');
        setSubject('');
        setModalVisible(false);
        fetchGroups();
      } else {
        Alert.alert('Error', 'Failed to create group');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to create group');
    }
  }

  async function approveGroup(groupId: string, action: 'approve' | 'reject') {
    try {
      const response = await fetch(`${API_BASE_URL}/api/groups/${groupId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approverEmail: email,
          approverDesignation: userProfile?.designation,
          action,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', `Group ${action}d successfully`);
        fetchGroups();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'Failed to update group');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to update group');
    }
  }

  async function join(id: string) {
    if (!email) return Alert.alert('Sign in required', 'You need to be logged in to join groups.');
    try {
      const response = await fetch(`${API_BASE_URL}/api/groups/${id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Joined group successfully!');
        fetchGroups();
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to join group');
    }
  }

  async function leave(id: string) {
    if (!email) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/groups/${id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Left group successfully');
        setDetailVisible(false);
        fetchGroups();
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to leave group');
    }
  }

  async function removeGroup(id: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/groups/${id}?requester=${email}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        Alert.alert('Success', 'Group deleted successfully');
        setDetailVisible(false);
        fetchGroups();
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to delete group');
    }
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
      setSelectedFile(null); // Clear file if image is selected
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile({
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/pdf',
        });
        setSelectedImage(null); // Clear image if file is selected
      }
    } catch (e) {
      console.error('Document picker error', e);
    }
  };

  async function uploadFile(uri: string, fileName: string, fileType: string): Promise<string | null> {
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: fileName,
      type: fileType,
    } as any);

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (response.ok) {
        const data = await response.json();
        return data.url;
      }
    } catch (e) {
      console.error('Upload failed', e);
    }
    return null;
  }

  async function sendMessage() {
    if (!activeGroup || (!messageText.trim() && !selectedImage && !selectedFile) || !email) return;

    setUploading(true);
    let imageUrl = '';
    let fileUrl = '';
    let fileName = '';
    let fileType = '';

    if (selectedImage) {
      const url = await uploadFile(selectedImage, 'photo.jpg', 'image/jpeg');
      if (url) imageUrl = url;
    }

    if (selectedFile) {
      const url = await uploadFile(selectedFile.uri, selectedFile.name, selectedFile.type);
      if (url) {
        fileUrl = url;
        fileName = selectedFile.name;
        fileType = selectedFile.type;
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/groups/${activeGroup._id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: email,
          content: messageText.trim(),
          imageUrl,
          fileUrl,
          fileName,
          fileType,
        }),
      });

      if (response.ok) {
        const updatedGroup = await response.json();
        setActiveGroup(updatedGroup);
        setMessageText('');
        setSelectedImage(null);
        setSelectedFile(null);
        // Optionally refresh the main list too
        fetchGroups();
      }
    } catch (e) {
      console.error('Failed to send message', e);
    } finally {
      setUploading(false);
    }
  }

  const isMember = (group: Group) => group.members?.includes(email || '');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Study Groups</Text>
      <TouchableOpacity style={styles.createBtn} onPress={() => setModalVisible(true)}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>
          {isTeacher ? 'Create Group' : 'Request Study Group'}
        </Text>
      </TouchableOpacity>

      {/* Pending Approvals Section (Teachers Only) */}
      {isTeacher && pendingGroups.length > 0 && (
        <View style={styles.pendingSection}>
          <Text style={styles.sectionTitle}>Pending Approvals</Text>
          {pendingGroups.map((group) => (
            <View key={group._id} style={styles.pendingCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{group.name}</Text>
                <Text style={{ color: '#6b7280', fontSize: 12 }}>
                  {group.subject} • Requested by {group.createdByEmail}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={() => approveGroup(group._id, 'approve')}
                >
                  <Text style={{ color: '#10b981', fontWeight: '700' }}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => approveGroup(group._id, 'reject')}
                >
                  <Text style={{ color: '#ef4444', fontWeight: '700' }}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Modal for group creation */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>
              {isTeacher ? 'Create Study Group' : 'Request Study Group'}
            </Text>
            {!isTeacher && (
              <Text style={{ color: '#6b7280', fontSize: 12, marginBottom: 12 }}>
                Your request will be sent to teachers for approval
              </Text>
            )}
            <TextInput placeholder="Group name" value={name} onChangeText={setName} style={styles.input} />
            <TextInput placeholder="Subject" value={subject} onChangeText={setSubject} style={styles.input} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={{ color: '#3b5bfd' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={create}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {isTeacher ? 'Create' : 'Submit Request'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <FlatList
        data={groups}
        keyExtractor={(g) => g._id}
        renderItem={({ item }) => {
          const member = isMember(item);
          return (
            <TouchableOpacity onPress={() => {
              if (member || item.status === 'Pending') {
                setActiveGroup(item);
                setDetailVisible(true);
              } else {
                Alert.alert('Join Group', 'Please join the group to view details.');
              }
            }}>
              <View style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={{ color: '#6b7280', fontSize: 14, marginBottom: 4 }}>{item.subject}</Text>
                    {item.school && <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '500' }}>{item.school}</Text>}
                  </View>
                  {item.status === 'Pending' && (
                    <View style={{ backgroundColor: '#fff8e1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#ffeeba' }}>
                      <Text style={{ color: '#b45309', fontSize: 11, fontWeight: '700' }}>Pending</Text>
                    </View>
                  )}
                </View>

                <View style={styles.avatarRow}>
                  {item.members?.slice(0, 5).map((m, i) => (
                    <View key={i} style={styles.avatarBubble}>
                      <Text style={styles.avatarText}>{m.charAt(0).toUpperCase()}</Text>
                    </View>
                  ))}
                  {(item.members?.length || 0) > 5 && (
                    <View style={[styles.avatarBubble, styles.moreBubble]}>
                      <Text style={[styles.avatarText, styles.moreText]}>+{item.members!.length - 5}</Text>
                    </View>
                  )}
                </View>

                {item.status !== 'Pending' && (
                  <TouchableOpacity
                    style={[styles.joinBtn, member && styles.viewBtn]}
                    onPress={() => {
                      if (member) {
                        setActiveGroup(item);
                        setDetailVisible(true);
                      } else {
                        join(item._id);
                      }
                    }}
                  >
                    <Text style={{ color: member ? '#fff' : '#3b5bfd', fontWeight: '700' }}>
                      {member ? 'Open Chat' : 'Join Group'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 16 }}>No groups yet.</Text>}
      />

      {/* Chat / Detail modal */}
      <Modal visible={detailVisible} transparent animationType="fade">
        {activeGroup && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.chatModalContent}>
              <View style={styles.chatHeader}>
                <View>
                  <Text style={styles.chatTitle}>{activeGroup.name}</Text>
                  <Text style={styles.chatSubtitle}>{activeGroup.members?.length} members</Text>
                </View>
                <TouchableOpacity onPress={() => setDetailVisible(false)}>
                  <Text style={{ color: '#6b7280', fontSize: 20 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                ref={flatListRef}
                data={activeGroup.messages || []}
                keyExtractor={(_, index) => index.toString()}
                style={styles.messageList}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                renderItem={({ item }) => {
                  const isMe = item.sender === email;
                  return (
                    <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}>
                      <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
                        {!isMe && <Text style={styles.messageSender}>{item.sender}</Text>}
                        {item.imageUrl ? (
                          <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />
                        ) : null}
                        {item.fileUrl ? (
                          <TouchableOpacity onPress={() => Linking.openURL(item.fileUrl!)} style={styles.fileAttachment}>
                            <Ionicons name="document-text" size={20} color={isMe ? '#fff' : '#3b5bfd'} />
                            <Text style={[styles.fileName, isMe ? styles.fileNameMe : styles.fileNameOther]}>{item.fileName || 'Document'}</Text>
                          </TouchableOpacity>
                        ) : null}
                        {item.content ? (
                          <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextOther]}>{item.content}</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#9ca3af', marginTop: 20 }}>No messages yet. Say hello!</Text>}
              />

              {selectedImage && (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.removePreview} onPress={() => setSelectedImage(null)}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              {selectedFile && (
                <View style={styles.previewContainer}>
                  <View style={styles.filePreview}>
                    <Ionicons name="document-text" size={24} color="#3b5bfd" />
                    <Text style={styles.filePreviewName}>{selectedFile.name}</Text>
                  </View>
                  <TouchableOpacity style={styles.removePreview} onPress={() => setSelectedFile(null)}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.inputRow}>
                <TouchableOpacity onPress={pickImage} style={styles.iconBtn}>
                  <Ionicons name="image-outline" size={24} color="#6b7280" />
                </TouchableOpacity>
                <TouchableOpacity onPress={pickDocument} style={styles.iconBtn}>
                  <Ionicons name="document-attach-outline" size={24} color="#6b7280" />
                </TouchableOpacity>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Type a message..."
                  value={messageText}
                  onChangeText={setMessageText}
                />
                <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={uploading}>
                  {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text>}
                </TouchableOpacity>
              </View>

              <View style={styles.chatFooter}>
                <TouchableOpacity onPress={() => leave(activeGroup._id)}><Text style={{ color: '#ef4444' }}>Leave Group</Text></TouchableOpacity>
                {activeGroup.createdByEmail === email && (
                  <TouchableOpacity onPress={() => removeGroup(activeGroup._id)}><Text style={{ color: '#ef4444' }}>Delete Group</Text></TouchableOpacity>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f8ff' },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 16, color: '#1f2937' },
  createBtn: {
    backgroundColor: '#3b5bfd',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#3b5bfd',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e6e9f3',
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
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 4 },
  joinBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#eaf0ff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
  },
  viewBtn: { backgroundColor: '#3b5bfd' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '90%', maxHeight: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  chatModalContent: { backgroundColor: '#fff', borderRadius: 24, width: '95%', height: '90%', overflow: 'hidden' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
  chatTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  chatSubtitle: { color: '#6b7280', fontSize: 13 },
  messageList: { flex: 1, padding: 16, backgroundColor: '#f9fafb' },
  messageRow: { marginBottom: 16, flexDirection: 'row' },
  messageRowMe: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  messageBubble: { maxWidth: '80%', padding: 14, borderRadius: 20 },
  messageBubbleMe: { backgroundColor: '#3b5bfd', borderBottomRightRadius: 4 },
  messageBubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#e6e9f3' },
  messageSender: { fontSize: 11, color: '#9ca3af', marginBottom: 4, fontWeight: '600' },
  messageText: { fontSize: 15, lineHeight: 22 },
  messageTextMe: { color: '#fff' },
  messageTextOther: { color: '#374151' },
  messageImage: { width: 220, height: 160, borderRadius: 12, marginBottom: 6 },
  inputRow: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', alignItems: 'center', backgroundColor: '#fff' },
  chatInput: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, marginRight: 10, borderWidth: 1, borderColor: '#e5e7eb', fontSize: 15 },
  sendBtn: { backgroundColor: '#3b5bfd', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24 },
  chatFooter: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#fff' },
  cancelBtn: { flex: 1, backgroundColor: '#eaf0ff', borderRadius: 16, alignItems: 'center', paddingVertical: 14 },
  submitBtn: { flex: 1, backgroundColor: '#3b5bfd', borderRadius: 16, alignItems: 'center', paddingVertical: 14 },
  pendingSection: { backgroundColor: '#fff8e1', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#ffeeba' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#b45309' },
  pendingCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  approveBtn: { backgroundColor: '#d1fae5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  rejectBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  iconBtn: { padding: 8, marginRight: 4 },
  previewContainer: { padding: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6', flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb' },
  previewImage: { width: 60, height: 60, borderRadius: 8, marginRight: 12 },
  removePreview: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 8, left: 64 },
  fileAttachment: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, marginBottom: 6 },
  fileName: { marginLeft: 8, fontSize: 14, fontWeight: '500' },
  fileNameMe: { color: '#fff' },
  fileNameOther: { color: '#3b5bfd' },
  filePreview: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e6e9f3' },
  filePreviewName: { marginLeft: 10, fontSize: 14, color: '#1f2937', flex: 1, fontWeight: '500' },
  avatarRow: { flexDirection: 'row', marginTop: 12, marginBottom: 4 },
  avatarBubble: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center', marginRight: -8, borderWidth: 2, borderColor: '#fff' },
  avatarText: { fontSize: 10, color: '#3b5bfd', fontWeight: '700' },
  moreBubble: { backgroundColor: '#f3f4f6' },
  moreText: { color: '#6b7280' },
});
