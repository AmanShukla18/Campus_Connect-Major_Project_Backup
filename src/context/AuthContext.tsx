import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { API_BASE_URL } from '../api/client';

type UserProfile = {
  email: string;
  name?: string;
  phone?: string;
  designation?: string;
  school?: string;
  photoUrl?: string;
};

type AuthValue = {
  email: string | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  signOut: () => void;
  signup: (email: string, password: string, profileData: { name: string; phone: string; designation: string; school: string; photoUrl?: string }) => Promise<boolean>;
  signInWithCredentials: (email: string, password: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  async function fetchUserProfile(userEmail: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/profile?email=${encodeURIComponent(userEmail)}`);
      if (response.ok) {
        const profile = await response.json();
        setUserProfile(profile);
      }
    } catch (e) {
      console.error('Failed to fetch user profile', e);
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setEmail(user?.email ?? null);
      if (user?.email) {
        await fetchUserProfile(user.email);
      } else {
        setUserProfile(null);
      }
      setIsLoading(false);
    });
    return unsub;
  }, []);

  async function signup(emailArg: string, password: string, profileData: { name: string; phone: string; designation: string; school: string; photoUrl?: string }) {
    try {
      // First create the account in our backend
      const response = await fetch(`${API_BASE_URL}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailArg, password, ...profileData }),
      });

      if (!response.ok) return false;

      // Then create Firebase auth account
      await createUserWithEmailAndPassword(auth, emailArg, password);
      return true;
    } catch (e) {
      console.error('Signup error', e);
      return false;
    }
  }

  async function signInWithCredentials(emailArg: string, password: string) {
    try {
      await signInWithEmailAndPassword(auth, emailArg, password);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function refreshProfile() {
    if (email) {
      await fetchUserProfile(email);
    }
  }

  const value = useMemo<AuthValue>(() => ({
    email,
    userProfile,
    isLoading,
    signOut: () => {
      firebaseSignOut(auth).catch(() => { });
    },
    signup,
    signInWithCredentials,
    refreshProfile,
  }), [email, userProfile, isLoading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}
