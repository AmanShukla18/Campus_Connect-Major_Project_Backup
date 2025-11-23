import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, ScrollView, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api/client';

const DESIGNATIONS = ['Student', 'Teacher'];
const SCHOOLS = [
    'SOET',
    'SOMC',
    'SMAS',
    'SLAS',
    'SOAD'
];

export default function ProfileEditScreen({ navigation }: any) {
    const { userProfile, email, refreshProfile } = useAuth();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [designation, setDesignation] = useState('');
    const [school, setSchool] = useState('');
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (userProfile) {
            setName(userProfile.name || '');
            setPhone(userProfile.phone || '');
            setDesignation(userProfile.designation || '');
            setSchool(userProfile.school || '');
            setPhotoUri(userProfile.photoUrl || null);
        }
    }, [userProfile]);

    async function pickImage() {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
            Alert.alert('Permission Required', 'Please grant permission to access your photos');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled && result.assets[0]) {
            setPhotoUri(result.assets[0].uri);
        }
    }

    async function uploadPhoto(uri: string): Promise<string | null> {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();

            const formData = new FormData();
            formData.append('file', blob as any, 'profile.jpg');

            const uploadResponse = await fetch(`${API_BASE_URL}/api/upload`, {
                method: 'POST',
                body: formData,
            });

            if (uploadResponse.ok) {
                const data = await uploadResponse.json();
                return data.url;
            }
            return null;
        } catch (error) {
            console.error('Photo upload failed', error);
            return null;
        }
    }

    async function saveProfile() {
        if (!name || !phone || !designation || !school) {
            return Alert.alert('Missing Fields', 'Please fill in all required fields');
        }

        setSaving(true);
        try {
            let photoUrl = userProfile?.photoUrl;

            // Upload new photo if changed
            if (photoUri && photoUri !== userProfile?.photoUrl) {
                const uploadedUrl = await uploadPhoto(photoUri);
                if (uploadedUrl) photoUrl = uploadedUrl;
            }

            const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    name,
                    phone,
                    designation,
                    school,
                    photoUrl,
                }),
            });

            if (response.ok) {
                await refreshProfile();
                Alert.alert('Success', 'Profile updated successfully');
                navigation.goBack();
            } else {
                Alert.alert('Error', 'Failed to update profile');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
            <Text style={styles.title}>Edit Profile</Text>

            {/* Photo Upload */}
            <TouchableOpacity style={styles.photoContainer} onPress={pickImage}>
                {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                ) : (
                    <View style={styles.photoPlaceholder}>
                        <Text style={styles.photoText}>Tap to change photo</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TextInput
                placeholder="Full Name *"
                placeholderTextColor="#666"
                value={name}
                onChangeText={setName}
                style={styles.input}
            />
            <TextInput
                placeholder="Phone Number *"
                placeholderTextColor="#666"
                value={phone}
                onChangeText={setPhone}
                style={styles.input}
                keyboardType="phone-pad"
            />

            {/* Designation Dropdown */}
            <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>Designation *</Text>
                <View style={styles.pickerWrapper}>
                    <Picker
                        selectedValue={designation}
                        onValueChange={(itemValue: string) => setDesignation(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="Select Designation" value="" />
                        {DESIGNATIONS.map((des) => (
                            <Picker.Item key={des} label={des} value={des} />
                        ))}
                    </Picker>
                </View>
            </View>

            {/* School/Department Dropdown */}
            <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>School/Department *</Text>
                <View style={styles.pickerWrapper}>
                    <Picker
                        selectedValue={school}
                        onValueChange={(itemValue: string) => setSchool(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="Select School/Department" value="" />
                        {SCHOOLS.map((sch) => (
                            <Picker.Item key={sch} label={sch} value={sch} />
                        ))}
                    </Picker>
                </View>
            </View>

            <TouchableOpacity
                style={[styles.btn, saving && styles.btnDisabled]}
                onPress={saveProfile}
                disabled={saving}
            >
                {saving ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Save Changes</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
                <Text style={styles.linkText}>Cancel</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#0b1220' },
    title: { fontSize: 24, fontWeight: '700', marginBottom: 16, color: '#fff' },
    photoContainer: { alignSelf: 'center', marginBottom: 16 },
    photoPreview: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#3b5bfd' },
    photoPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#0f1b2f',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#3b5bfd',
        borderStyle: 'dashed',
    },
    photoText: { color: '#3b5bfd', fontWeight: '600', textAlign: 'center', paddingHorizontal: 10 },
    input: {
        backgroundColor: '#111a2e',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#1e2a47',
        color: '#fff',
    },
    pickerContainer: {
        marginBottom: 12,
    },
    pickerLabel: {
        fontSize: 12,
        color: '#9fb0d9',
        marginBottom: 4,
        marginLeft: 4,
        fontWeight: '600',
    },
    pickerWrapper: {
        backgroundColor: '#111a2e',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1e2a47',
        overflow: 'hidden',
    },
    picker: {
        height: 50,
        color: '#fff',
    },
    btn: {
        backgroundColor: '#3b5bfd',
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    btnDisabled: {
        opacity: 0.6,
    },
    linkText: {
        color: '#9fb0d9',
        textAlign: 'center',
        fontWeight: '600',
    },
});
