import { createContext, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMe, login as loginRequest, logout as logoutRequest, type LoginInput } from './auth-api';
import { tokenStorage } from './api-client';
import type { User } from '../types/domain';

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<User>;
  logout: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // Tracks whether we should even attempt to hydrate the session — flips
  // false immediately on logout so a stale query doesn't refire.
  const [hasToken, setHasToken] = useState(() => tokenStorage.getAccess() !== null);

  const {
    data: user,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    enabled: hasToken,
    retry: false,
    staleTime: Infinity,
  });

  async function login(input: LoginInput): Promise<User> {
    await loginRequest(input);
    setHasToken(true);
    // fetchQuery (not the raw fetchMe helper) so this shares/dedupes with the
    // useQuery above's own fetch, which also fires the instant `enabled`
    // flips true — otherwise both fire and we'd hit /me/ twice per login.
    return queryClient.fetchQuery({ queryKey: ['auth', 'me'], queryFn: fetchMe });
  }

  async function logout(): Promise<void> {
    // logoutRequest blacklists the refresh token server-side, then clears
    // local storage — start it, but clear UI state immediately rather than
    // waiting on the network round-trip.
    const pending = logoutRequest();
    setHasToken(false);
    queryClient.setQueryData(['auth', 'me'], null);
    queryClient.removeQueries({ queryKey: ['auth', 'me'] });
    await pending;
  }

  const value: AuthContextValue = {
    user: user ?? null,
    isLoading: hasToken && (isLoading || isFetching) && user === undefined,
    isAuthenticated: Boolean(user),
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
