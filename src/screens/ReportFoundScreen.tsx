import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, Platform } from 'react-native';
import { push, ref, serverTimestamp } from 'firebase/database';
import { useAuth } from '../context/AuthContext';
import { realtimeDb, auth } from '../lib/firebase';
import { uploadMedia } from '../lib/upload';
import { pickMedia, MediaSource } from '../lib/mediaPicker';
import { InlineVideo } from '../components/InlineVideo';

export default function ReportFoundScreen({ navigation }: any) {
  const { email } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [contact, setContact] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (mediaUploading) {
      Alert.alert('Please wait', 'Media is still uploading.');
      return;
    }

    if (!title.trim() || !location.trim() || !contact.trim()) {
      Alert.alert('Missing info', 'Title, location and contact are required.');
      return;
    }

    if (!mediaUrl) {
      Alert.alert('Add media', 'Upload an image or video before submitting.');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in again to continue.');
      return;
    }

    setSubmitting(true);
    try {
      await push(ref(realtimeDb, 'lostfound'), {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        contact: contact.trim(),
        mediaUrl,
        mediaType,
        status: 'Active',
        date: new Date().toISOString(),
        reportedByEmail: email || user.email,
        reportedByUid: user.uid,
        createdAt: serverTimestamp(),
      });
      navigation.goBack();
    } catch (error: any) {
      console.error('Failed to submit lost item', error);
      Alert.alert('Submission failed', error?.message || 'Could not save your report.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMediaSelection(source: MediaSource) {
    setMediaUploading(true);
    try {
      const asset = await pickMedia(source);
      if (!asset) return;
      const uploadRes = await uploadMedia({
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
        mediaType: asset.type,
      });
      setMediaUrl(uploadRes.url);
      setMediaType(asset.type);
    } catch (e: any) {
      console.error('pickMedia error', e);
      Alert.alert('Upload failed', e?.message || 'Could not upload media.');
    } finally {
      setMediaUploading(false);
    }
  }

  function chooseMediaSource() {
    if (Platform.OS === 'web') {
      handleMediaSelection('library');
      return;
    }

    Alert.alert('Add media', 'Choose a source', [
      { text: 'Gallery', onPress: () => handleMediaSelection('library') },
      { text: 'Camera', onPress: () => handleMediaSelection('camera') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Report Found Item</Text>
      <TouchableOpacity style={styles.imageBox} onPress={chooseMediaSource} disabled={mediaUploading}>
        {mediaUrl ? (
          mediaType === 'video' ? (
            <InlineVideo uri={mediaUrl} style={{ width: 140, height: 120, borderRadius: 10 }} />
          ) : (
            <Image source={{ uri: mediaUrl }} style={{ width: 100, height: 100, borderRadius: 10 }} />
          )
        ) : (
          <Text style={{ color: '#8da2c0' }}>{mediaUploading ? 'Uploading...' : 'Tap to add image or video'}</Text>
        )}
      </TouchableOpacity>
      <TextInput placeholder="Title (e.g. Black Wallet)" value={title} onChangeText={setTitle} style={styles.input} />
      <TextInput placeholder="Description" value={description} onChangeText={setDescription} style={[styles.input, { height: 100 }]} multiline />
      <TextInput placeholder="Location (where it was found)" value={location} onChangeText={setLocation} style={styles.input} />
      <TextInput placeholder="Contact (phone or email)" value={contact} onChangeText={setContact} style={styles.input} />
      <View style={styles.row}>
        <TouchableOpacity style={styles.cancel} onPress={() => navigation.goBack()} disabled={submitting}>
          <Text style={{ color: '#3b5bfd', opacity: submitting ? 0.6 : 1 }}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.submit, submitting && { opacity: 0.7 }]} onPress={submit} disabled={submitting}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{submitting ? 'Submitting...' : 'Submit'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f8ff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  imageBox: { height: 120, borderRadius: 14, backgroundColor: '#eef3ff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  input: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e5e9f2' },
  row: { flexDirection: 'row', gap: 12 },
  cancel: { flex: 1, backgroundColor: '#eaf0ff', borderRadius: 12, alignItems: 'center', paddingVertical: 12 },
  submit: { flex: 1, backgroundColor: '#3b5bfd', borderRadius: 12, alignItems: 'center', paddingVertical: 12 },
});


