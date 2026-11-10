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
  /** Re-resolve the user's companies (e.g. after creating one). */
  refresh(): Promise<void>;
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

  // Resolve the user's companies (names + the active choice). Shared by the
  // auth-state listener and refresh(); `keepActive` preserves the current
  // selection when it is still valid (used after creating a company).
  async function loadCompaniesFor(email: string, keepActive: string | null): Promise<void> {
    const membership = await services.getMembership(email);
    if (membership === null) {
      setCompanies([]);
      setActiveCompanyId(null);
      setName(undefined);
      return;
    }
    setName(membership.name);
    const refs = await Promise.all(membership.companyIds.map((id) => services.getCompany(id)));
    setCompanies(refs);
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(activeKey(email));
    } catch {
      stored = null;
    }
    const prefer = keepActive !== null && membership.companyIds.includes(keepActive) ? keepActive : null;
    setActiveCompanyId(prefer ?? (stored !== null && membership.companyIds.includes(stored) ? stored : refs[0]?.id ?? null));
  }

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
      void loadCompaniesFor(email, null).finally(() => {
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

  async function refresh(): Promise<void> {
    const email = user?.email;
    if (email === undefined || email === null) return;
    await loadCompaniesFor(email, activeCompanyId);
  }

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
      refresh,
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
