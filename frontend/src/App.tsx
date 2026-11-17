import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Documents } from './pages/Documents';
import { Users } from './pages/Users';
import { Search } from './pages/Search';
import { Cabinets } from './pages/Cabinets';
import { Workflow } from './pages/Workflow';
import { Audit } from './pages/Audit';
import { Compliance } from './pages/Compliance';
import { Permissions } from './pages/Permissions';
import { Settings } from './pages/Settings';
import { Profile } from './pages/Profile';
import { AuthProvider, useAuth } from './context/AuthContext';
import axios from 'axios';

// Component to handle axios interceptors for 401
function AxiosInterceptor({ children }: { children: React.ReactNode }) {
    const { logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response && error.response.status === 401) {
                    console.warn("Session expired (401), logging out...");
                    logout();
                    navigate('/login');
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, [logout, navigate]);

    return <>{children}</>;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? (
      <AxiosInterceptor>
          <Layout>{children}</Layout>
      </AxiosInterceptor>
  ) : <Navigate to="/login" />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/documents" element={<PrivateRoute><Documents /></PrivateRoute>} />
          <Route path="/search" element={<PrivateRoute><Search /></PrivateRoute>} />
          <Route path="/cabinets" element={<PrivateRoute><Cabinets /></PrivateRoute>} />
          <Route path="/workflow" element={<PrivateRoute><Workflow /></PrivateRoute>} />
          <Route path="/audit" element={<PrivateRoute><Audit /></PrivateRoute>} />
          <Route path="/compliance" element={<PrivateRoute><Compliance /></PrivateRoute>} />
          <Route path="/users" element={<PrivateRoute><Users /></PrivateRoute>} />
          <Route path="/permissions" element={<PrivateRoute><Permissions /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          
          <Route path="*" element={
            <PrivateRoute>
              <div className="flex flex-col items-center justify-center h-[50vh] text-muted">
                <h1 className="text-4xl font-bold mb-4">404</h1>
                <p>Page not found</p>
              </div>
            </PrivateRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
