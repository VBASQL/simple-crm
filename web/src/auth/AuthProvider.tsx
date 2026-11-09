import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase/client.js';
import { useServices } from '../services/ServicesContext.js';
import type { UserProfile } from '../types.js';

interface AuthValue {
  readonly user: User | null;
  readonly profile: UserProfile | null;
  readonly loading: boolean;
  /** True when signed in but the email is not on the allow-list. */
  readonly denied: boolean;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const services = useServices();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      const email = next?.email ?? null;
      if (email === null) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      void services
        .getProfileByEmail(email)
        .then(setProfile)
        .finally(() => setLoading(false));
    });
  }, [services]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      profile,
      loading,
      denied: user !== null && profile === null && !loading,
      signIn: async () => {
        await signInWithPopup(auth, googleProvider);
      },
      signOut: async () => {
        await fbSignOut(auth);
      },
    }),
    [user, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
