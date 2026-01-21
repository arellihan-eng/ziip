import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

const AuthContext = createContext(null);

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function AuthProviderWithGoogle({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('ziip_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);

  // Google OAuth login - only called when inside GoogleOAuthProvider
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
        });
        const userInfo = await userInfoResponse.json();

        const userData = {
          id: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          avatar: userInfo.picture,
          provider: 'google',
          accessToken: tokenResponse.access_token
        };

        setUser(userData);
        localStorage.setItem('ziip_user', JSON.stringify(userData));
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      } finally {
        setLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google login failed:', error);
      setLoading(false);
    }
  });

  const signIn = useCallback(async (provider) => {
    setLoading(true);
    if (provider === 'google') {
      googleLogin();
      return null;
    }
    throw new Error(`Unknown provider: ${provider}`);
  }, [googleLogin]);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem('ziip_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

function AuthProviderDemo({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('ziip_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);

  const signIn = useCallback(async (provider) => {
    setLoading(true);
    console.warn('No Google Client ID configured, using demo mode');
    const demoUser = {
      id: 'demo_' + Date.now(),
      email: 'demo@ziip.community',
      name: 'Demo User',
      avatar: null,
      provider: 'demo'
    };
    await new Promise(resolve => setTimeout(resolve, 300));
    setUser(demoUser);
    localStorage.setItem('ziip_user', JSON.stringify(demoUser));
    setLoading(false);
    return demoUser;
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem('ziip_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }) {
  if (!GOOGLE_CLIENT_ID) {
    return <AuthProviderDemo>{children}</AuthProviderDemo>;
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProviderWithGoogle>{children}</AuthProviderWithGoogle>
    </GoogleOAuthProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default useAuth;
