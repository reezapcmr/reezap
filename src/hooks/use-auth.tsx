import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  whatsapp: string | null;
  town_id: string | null;
  neighborhood_id: string | null;
  language: string;
  is_vendor: boolean;
  is_verified: boolean;
  is_premium: boolean;
  premium_until: string | null;
  username_changed_at: string | null;
  notify_follows: boolean;
  notify_likes: boolean;
  notify_moderation: boolean;
};

const PROFILE_SELECT =
  "id,username,display_name,avatar_url,bio,town_id,neighborhood_id,language,is_vendor,is_verified,is_premium,premium_until,username_changed_at,notify_follows,notify_likes,notify_moderation";


type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  isAdmin: false,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const [{ data: p }, { data: roles }, { data: whatsapp }] = await Promise.all([
      supabase.from("profiles").select(PROFILE_SELECT).eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      // The phone column is not directly readable; owners fetch it via this RPC.
      supabase.rpc("get_vendor_whatsapp", { p_user_id: userId }),
    ]);
    setProfile(p ? ({ ...p, whatsapp: whatsapp ?? null } as Profile) : null);
    setIsAdmin(!!roles?.some((r) => r.role === "admin"));
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) {
        setTimeout(() => void loadProfile(next.user.id), 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    profile,
    isAdmin,
    loading,
    refreshProfile: async () => {
      if (session?.user) await loadProfile(session.user.id);
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
      setIsAdmin(false);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
