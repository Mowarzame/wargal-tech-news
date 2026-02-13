"use client";

import * as React from "react";
import { clearToken, getToken, setToken } from "@/app/lib/auth";
import { fetchMe, loginGoogle, type AuthUser } from "@/app/lib/api";

type GoogleProfile = { name: string; email: string; picture?: string | null };

type AuthState = {
  isReady: boolean;
  isAuthed: boolean;
  user: AuthUser | null;
  loginWithGoogleProfile: (profile: GoogleProfile) => Promise<void>;
  logout: () => void;
};

const AuthContext = React.createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = React.useState(false);
  const [user, setUser] = React.useState<AuthUser | null>(null);

  const hydrate = React.useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setIsReady(true);
      return;
    }
    const me = await fetchMe();
    setUser(me);
    setIsReady(true);
  }, []);

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  const loginWithGoogleProfile = React.useCallback(async (profile: GoogleProfile) => {
    const res = await loginGoogle({
      name: profile.name,
      email: profile.email,
      profilePictureUrl: profile.picture ?? null,
    });
    setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = React.useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value: AuthState = React.useMemo(
    () => ({
      isReady,
      isAuthed: !!user,
      user,
      loginWithGoogleProfile,
      logout,
    }),
    [isReady, user, loginWithGoogleProfile, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
