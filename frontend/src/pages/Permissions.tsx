import React, { useState, useEffect } from 'react';
import { Shield, Loader2, Save, User, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

interface UserData {
    id: number;
    username: string;
    email: string;
    role: string;
}

const ROLES = [
    { value: 'SuperAdmin', label: 'Super Admin', description: 'Full access: User management, all documents, cabinets, system settings, and audit logs.' },
    { value: 'Admin', label: 'Admin', description: 'Administrative access: User management, documents, and cabinets. No access to system settings or audit logs.' },
    { value: 'DocumentManager', label: 'Document Manager', description: 'Operational: Upload docs, download/OCR all docs. Can only delete own docs. Can access cabinets.' },
    { value: 'Reviewer', label: 'Reviewer', description: 'Workflow focus: Download/OCR docs, Workflow approval. No upload/delete.' },
    { value: 'Viewer', label: 'Viewer', description: 'Read-only: Download/OCR docs. No upload/delete.' },
];

export function Permissions() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchUsers = async () => {
      try {
          const res = await axios.get('http://localhost:8000/users', {
              headers: { Authorization: `Bearer ${token}` }
          });
          setUsers(res.data);
      } catch (err) {
          console.error("Failed to fetch users", err);
          setMessage({ type: 'error', text: "Failed to load users" });
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      fetchUsers();
  }, [token]);

  const handleRoleChange = async (userId: number, newRole: string) => {
      setSaving(userId);
      setMessage(null);
      try {
          await axios.put(`http://localhost:8000/users/${userId}`, 
              { role: newRole },
              { headers: { Authorization: `Bearer ${token}` } }
          );
          
          // Update local state
          setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
          setMessage({ type: 'success', text: "Role updated successfully" });
          
          // Clear success message after 3 seconds
          setTimeout(() => setMessage(null), 3000);
      } catch (err: any) {
          console.error("Failed to update role", err);
          setMessage({ type: 'error', text: err.response?.data?.detail || "Failed to update role" });
      } finally {
          setSaving(null);
      }
  };

  if (loading) {
      return (
          <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
      );
  }

  // RBAC Check for View
  if (currentUser?.role !== 'SuperAdmin' && currentUser?.role !== 'Admin') {
      return (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6">
              <Shield className="w-12 h-12 text-red-400 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Access Denied</h3>
              <p className="text-muted">You do not have permission to view this page.</p>
          </div>
      );
  }

  return (
    <div className="space-y-6">
       <div>
          <h2 className="text-3xl font-bold text-white mb-2">Permissions</h2>
          <p className="text-muted">Manage user roles and access controls.</p>
        </div>

        {message && (
            <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                message.type === 'success' 
                    ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
                {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                {message.text}
            </div>
        )}

        <div className="rounded-2xl bg-surface/50 border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/5">
                            <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">User</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">Email</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">Current Role</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {users.map((u) => (
                            <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-purple-500 flex items-center justify-center text-xs font-bold text-white">
                                            {u.username.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-sm font-medium text-white">{u.username}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                                    {u.email}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                                        u.role === 'SuperAdmin' ? 'bg-purple-500/10 text-purple-400' :
                                        u.role === 'Admin' ? 'bg-blue-500/10 text-blue-400' :
                                        u.role === 'DocumentManager' ? 'bg-emerald-500/10 text-emerald-400' :
                                        'bg-white/10 text-muted'
                                    }`}>
                                        {/* Display Label Mapping */}
                                        {ROLES.find(r => r.value === u.role)?.label || u.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="relative inline-block w-48">
                                        <select
                                            value={u.role}
                                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                            disabled={saving === u.id || (currentUser?.role === 'Admin' && u.role === 'SuperAdmin')}
                                            className="w-full appearance-none bg-black/20 border border-white/10 text-white text-sm rounded-lg pl-3 pr-10 py-2 focus:outline-none focus:border-accent/50 disabled:opacity-50"
                                        >
                                            {ROLES.map((role) => (
                                                <option key={role.value} value={role.value} className="bg-[#0f172a]">
                                                    {role.label}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted">
                                            {saving === u.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Shield className="w-4 h-4" />
                                            )}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ROLES.map((role) => (
                <div key={role.value} className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <h4 className="font-bold text-white mb-1">{role.label}</h4>
                    <p className="text-sm text-muted">{role.description}</p>
                </div>
            ))}
        </div>
    </div>
  );
}
