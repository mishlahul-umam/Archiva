import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { 
  LayoutDashboard, 
  Files, 
  GitBranch, 
  Settings, 
  Users, 
  Shield, 
  Search,
  Activity,
  LogOut,
  User,
  KeyRound,
  ShieldCheck,
  Library
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';

export function Sidebar() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleUserDetails = () => {
    navigate('/profile');
  };

  // Notification States
  const [hasNewAudit, setHasNewAudit] = useState(false);
  const [pendingWorkflowCount, setPendingWorkflowCount] = useState(0);
  
  // Refs for tracking last seen counts/timestamps
  const lastAuditIdRef = useRef<number>(parseInt(localStorage.getItem('lastSeenAuditId') || '0'));
  
  useEffect(() => {
      const fetchNotifications = async () => {
          if (!user) return;

          // 1. Check Workflow Pending Count
          if (['SuperAdmin', 'Admin', 'Reviewer'].includes(user.role)) {
              try {
                  const token = localStorage.getItem('token');
                  if (!token) return;
                  
                  const res = await axios.get('http://localhost:8000/documents', {
                      headers: { Authorization: `Bearer ${token}` }
                  });
                  // Filter for pending documents. 
                  const pending = res.data.filter((d: any) => d.status === 'pending').length;
                  setPendingWorkflowCount(pending);
              } catch (e) {
                  // console.error("Failed to check workflow", e);
              }
          }

          // 2. Check Audit Trail (only for SuperAdmin)
          if (user.role === 'SuperAdmin') {
              try {
                  const token = localStorage.getItem('token');
                  if (!token) return;

                  const res = await axios.get('http://localhost:8000/audit-logs?limit=1', {
                      headers: { Authorization: `Bearer ${token}` }
                  });
                  if (res.data && res.data.length > 0) {
                      const latestId = res.data[0].id;
                      if (latestId > lastAuditIdRef.current) {
                          setHasNewAudit(true);
                      }
                  }
              } catch (e) {
                  // console.error("Failed to check audit", e);
              }
          }
      };

      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000); // Poll every 10s
      return () => clearInterval(interval);
  }, [user]);

  // Handler when clicking Audit Trail
  useEffect(() => {
      if (location.pathname === '/audit' && hasNewAudit) {
          setHasNewAudit(false);
          // Update last seen
           const updateLastSeen = async () => {
              try {
                  const token = localStorage.getItem('token');
                  if (!token) return;

                  const res = await axios.get('http://localhost:8000/audit-logs?limit=1', {
                      headers: { Authorization: `Bearer ${token}` }
                  });
                  if (res.data && res.data.length > 0) {
                      const latestId = res.data[0].id;
                      lastAuditIdRef.current = latestId;
                      localStorage.setItem('lastSeenAuditId', latestId.toString());
                  }
              } catch(e) {}
           };
           updateLastSeen();
      }
  }, [location.pathname, hasNewAudit]);

  // Helper to format role name for display
  const formatRole = (role?: string) => {
      if (role === 'SuperAdmin') return 'Super Admin';
      if (role === 'DocumentManager') return 'Document Manager';
      return role;
  };

  // Define nav items with role requirements
  const allNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['SuperAdmin', 'Admin', 'DocumentManager', 'Reviewer', 'Viewer'] },
    { icon: Files, label: 'Documents', path: '/documents', roles: ['SuperAdmin', 'Admin', 'DocumentManager', 'Reviewer', 'Viewer'] },
    { icon: Search, label: 'Search', path: '/search', roles: ['SuperAdmin', 'Admin', 'DocumentManager', 'Reviewer', 'Viewer'] },
    { icon: Library, label: 'Cabinets', path: '/cabinets', roles: ['SuperAdmin', 'Admin', 'DocumentManager', 'Reviewer', 'Viewer'] },
    { icon: GitBranch, label: 'Workflow', path: '/workflow', roles: ['SuperAdmin', 'Admin', 'Reviewer'] },
    { icon: Activity, label: 'Audit Trail', path: '/audit', roles: ['SuperAdmin'] },
    { icon: ShieldCheck, label: 'Compliance', path: '/compliance', roles: ['SuperAdmin'] },
    { icon: Users, label: 'Users & Groups', path: '/users', roles: ['SuperAdmin', 'Admin'] },
    { icon: Shield, label: 'Permissions', path: '/permissions', roles: ['SuperAdmin', 'Admin'] },
    { icon: Settings, label: 'Settings', path: '/settings', roles: ['SuperAdmin'] },
  ];

  // Filter items based on user role
  const filteredNavItems = allNavItems.filter(item => {
      if (!user) return false;
      return item.roles.includes(user.role);
  });

  return (
    <aside className="w-64 h-screen bg-surface/50 backdrop-blur-xl border-r border-white/10 flex flex-col fixed left-0 top-0 z-50">
      <Link to="/" className="p-6 flex items-center gap-3 hover:opacity-80 transition-opacity">
        <Logo className="w-10 h-10" />
        <h1 className="text-xl font-bold tracking-wider text-white">ARCHIVA</h1>
      </Link>

      <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative",
                isActive
                  ? "bg-accent/10 text-accent border border-accent/20 shadow-[0_0_15px_rgba(56,189,248,0.1)]"
                  : "text-muted hover:text-white hover:bg-white/5"
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
            
            {/* Workflow Notification Dot */}
            {item.path === '/workflow' && pendingWorkflowCount > 0 && (
                <span className="absolute right-4 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse" />
            )}

            {/* Audit Notification Dot */}
            {item.path === '/audit' && hasNewAudit && (
                <span className="absolute right-4 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse" />
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-2 relative">
        <div 
            onClick={handleUserDetails}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-purple-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
                {user?.username || 'Guest'}
            </p>
            <p className="text-xs text-muted truncate">
                {formatRole(user?.role) || 'Viewer'}
            </p>
          </div>
        </div>

        <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
        >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
