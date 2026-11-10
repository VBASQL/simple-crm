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

/** A company the signed-in user can act in. */
export interface CompanyRef {
  readonly id: string;
  readonly name?: string;
}

interface AuthValue {
  readonly user: User | null;
  /** The profile scoped to the ACTIVE company (companyId is the active one). */
  readonly profile: UserProfile | null;
  readonly loading: boolean;
  /** True when signed in but the email is on no company's allow-list. */
  readonly denied: boolean;
  /** Every company this user may switch between. */
  readonly companies: readonly CompanyRef[];
  readonly activeCompanyId: string | null;
  setActiveCompany(companyId: string): void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const activeKey = (email: string): string => `activeCompany:${email}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const services = useServices();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState<string | undefined>(undefined);
  const [companies, setCompanies] = useState<readonly CompanyRef[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next);
      const email = next?.email ?? null;
      if (email === null) {
        setCompanies([]);
        setActiveCompanyId(null);
        setName(undefined);
        setLoading(false);
        return;
      }
      setLoading(true);
      void services
        .getMembership(email)
        .then(async (membership) => {
          if (membership === null) {
            if (!cancelled) {
              setCompanies([]);
              setActiveCompanyId(null);
            }
            return;
          }
          setName(membership.name);
          // Resolve each company's display name for the switcher.
          const refs = await Promise.all(membership.companyIds.map((id) => services.getCompany(id)));
          if (cancelled) return;
          setCompanies(refs);
          // Keep the last-used company when it is still accessible; otherwise
          // fall back to the first one the user belongs to.
          let stored: string | null = null;
          try {
            stored = localStorage.getItem(activeKey(email));
          } catch {
            stored = null;
          }
          const active = stored !== null && membership.companyIds.includes(stored) ? stored : (refs[0]?.id ?? null);
          setActiveCompanyId(active);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
      unsub();
    };
    // services is stable (module singleton); re-subscribing per change is wrong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setActiveCompany(companyId: string) {
    setActiveCompanyId(companyId);
    const email = user?.email;
    if (email !== undefined && email !== null) {
      try {
        localStorage.setItem(activeKey(email), companyId);
      } catch {
        // Per-viewer convenience only; ignore storage failures.
      }
    }
  }

  const value = useMemo<AuthValue>(() => {
    const email = user?.email ?? null;
    const profile: UserProfile | null =
      email !== null && activeCompanyId !== null
        ? { email, companyId: activeCompanyId, ...(name !== undefined ? { name } : {}) }
        : null;
    return {
      user,
      profile,
      loading,
      denied: user !== null && activeCompanyId === null && !loading,
      companies,
      activeCompanyId,
      setActiveCompany,
      signIn: async () => {
        await signInWithPopup(auth, googleProvider);
      },
      signOut: async () => {
        await fbSignOut(auth);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, name, companies, activeCompanyId, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
