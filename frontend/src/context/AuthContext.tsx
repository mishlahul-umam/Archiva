import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

interface User {
    id: number;
    username: string;
    role: string;
    // Add other fields from token if needed
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      try {
          const decoded: any = jwtDecode(token);
          
          // Check for token expiration
          const currentTime = Date.now() / 1000;
          if (decoded.exp && decoded.exp < currentTime) {
              console.warn("Token expired");
              logout(); // Auto logout if expired
              return;
          }

          setUser({
              id: decoded.id,
              username: decoded.sub,
              role: decoded.role
          });
      } catch (e) {
          console.error("Invalid token", e);
          setUser(null);
          localStorage.removeItem('token'); // Clear invalid token
      }
    } else {
      localStorage.removeItem('token');
      setUser(null);
    }
  }, [token]);

  const login = (newToken: string) => {
    setToken(newToken);
  };

  const logout = () => {
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
