import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authService from '../services/auth.service.js';

const AuthContext = createContext(null);

const TOKEN_KEY = 'bbdu_auth_token';
const USER_KEY = 'bbdu_auth_user';

export const getDashboardPathForRole = (role) => {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin/dashboard';
    case 'AUTHORITY':
      return '/authority/dashboard';
    case 'WARDEN':
      return '/warden/dashboard';
    case 'HOSTEL_STAFF':
      return '/staff/dashboard';
    case 'STUDENT':
    default:
      return '/student/dashboard';
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem(USER_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  // Re-verify session with /api/auth/me on initial app load if token exists
  useEffect(() => {
    let active = true;

    const initAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        if (active) setLoading(false);
        return;
      }

      try {
        const response = await authService.getMe();
        if (active && response.success && response.data?.user) {
          setUser(response.data.user);
          localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
        }
      } catch (err) {
        console.warn('[auth] Session verification failed:', err.message);
        // Only wipe local session if server explicitly rejected token with 401 Unauthorized
        if (active && (err?.response?.status === 401 || err?.userMessage?.includes('unauthorized') || err?.message?.includes('401'))) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setUser(null);
          setToken(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    initAuth();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const response = await authService.login({ email, password });
    if (response.success && response.data) {
      const { user: loggedInUser, token: receivedToken } = response.data;
      localStorage.setItem(TOKEN_KEY, receivedToken);
      localStorage.setItem(USER_KEY, JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      setToken(receivedToken);
      return loggedInUser;
    }
    throw new Error(response.message || 'Login failed');
  }, []);

  const register = useCallback(async (userData) => {
    const response = await authService.register(userData);
    if (response.success && response.data) {
      const { user: registeredUser, token: receivedToken } = response.data;
      localStorage.setItem(TOKEN_KEY, receivedToken);
      localStorage.setItem(USER_KEY, JSON.stringify(registeredUser));
      setUser(registeredUser);
      setToken(receivedToken);
      return registeredUser;
    }
    throw new Error(response.message || 'Registration failed');
  }, []);

  // Changing the password revokes the old token on the server, so adopt the fresh one
  const changePassword = useCallback(async ({ currentPassword, newPassword }) => {
    const response = await authService.changePassword({ currentPassword, newPassword });
    if (response.success && response.data) {
      const { user: updatedUser, token: receivedToken } = response.data;
      localStorage.setItem(TOKEN_KEY, receivedToken);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      setUser(updatedUser);
      setToken(receivedToken);
      return updatedUser;
    }
    throw new Error(response.message || 'Password change failed');
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setUser(null);
      setToken(null);
    }
  }, []);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    changePassword,
    logout,
    getDashboardPath: () => getDashboardPathForRole(user?.role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
