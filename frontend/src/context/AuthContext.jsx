import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe, loginUser } from '../api/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    const raw = localStorage.getItem('token');
    return raw && raw !== 'undefined' && raw !== 'null' ? raw : '';
  });

  const [user, setUser] = useState(() => {
    const rawToken = localStorage.getItem('token');
    if (!rawToken || rawToken === 'undefined' || rawToken === 'null') {
      return null;
    }
    const saved = localStorage.getItem('user');
    if (!saved || saved === 'undefined' || saved === 'null') {
      return null;
    }
    try {
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const rawToken = localStorage.getItem('token');
      const storedToken = rawToken && rawToken !== 'undefined' && rawToken !== 'null' ? rawToken : '';
      if (storedToken) {
        try {
          const profile = await getMe();
          if (!profile || typeof profile !== 'object' || !profile.role) {
            logout();
          } else {
            setUser(profile);
            localStorage.setItem('user', JSON.stringify(profile));
          }
        } catch (err) {
          // Call logout() ONLY on a 401 or an invalid profile, never on network errors or 5xx
          if (err?.response?.status === 401) {
            logout();
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    initAuth();
  }, [logout]);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [logout]);

  const login = async (email, password) => {
    const data = await loginUser({ email, password });
    if (!data?.access_token || !data?.user || typeof data.user !== 'object' || !data.user.role) {
      throw new Error('Invalid login response: missing access token or user profile.');
    }
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const setManualAuth = (newToken, newUser) => {
    if (!newToken || !newUser || typeof newUser !== 'object' || !newUser.role) {
      return;
    }
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        setManualAuth,
        isAdmin: user?.role === 'admin',
        isMember: user?.role === 'member',
        isInvestigator: user?.role === 'investigator' && Boolean(user?.is_verified),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
