import React, { useState, useEffect, useRef } from 'react';
import { Users as UsersIcon, Plus, MoreVertical, Shield, X, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, Edit, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { clsx } from 'clsx';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface Group {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeActionMenu, setActiveActionMenu] = useState<number | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Form State
  const [formData, setFormData] = useState({
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      password: '',
      confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [passwordsMatch, setPasswordsMatch] = useState<boolean | null>(null);
  const [passwordValid, setPasswordValid] = useState<boolean | null>(null);

  const { token, user: currentUser } = useAuth();

  // Helper to format role name for display
  const formatRole = (role?: string) => {
      if (role === 'SuperAdmin') return 'Super Admin';
      if (role === 'DocumentManager') return 'Document Manager';
      return role;
  };

  const getRoleDescription = (role: string) => {
      if (role === 'DocumentManager') {
          return "Operational: Upload docs, download/OCR all docs. Can only delete own docs. Can access cabinets.";
      }
      return "";
  };

  const fetchData = async () => {
      try {
        const [usersRes, groupsRes] = await Promise.all([
            axios.get('http://localhost:8000/users', {
                headers: { Authorization: `Bearer ${token}` }
            }),
            axios.get('http://localhost:8000/groups', {
                headers: { Authorization: `Bearer ${token}` }
            })
        ]);
        
        setUsers(usersRes.data);
        setGroups(groupsRes.data);

      } catch (error) {
        console.error("Failed to fetch data", error);
      }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Close action menu when clicking outside
  useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
          if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
              setActiveActionMenu(null);
          }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
          document.removeEventListener("mousedown", handleClickOutside);
      };
  }, [actionMenuRef]);

  // Check passwords match whenever they change
  useEffect(() => {
      if (formData.password && formData.confirmPassword) {
          setPasswordsMatch(formData.password === formData.confirmPassword);
      } else {
          setPasswordsMatch(null);
      }
  }, [formData.password, formData.confirmPassword]);

  // Check password strength
  useEffect(() => {
      if (formData.password) {
          // At least 8 chars, 1 number, 1 uppercase, 1 special char
          const strongRegex = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,})");
          setPasswordValid(strongRegex.test(formData.password));
      } else {
          setPasswordValid(null);
      }
  }, [formData.password]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData({
          ...formData,
          [e.target.name]: e.target.value
      });
  };

  const resetForm = () => {
      setFormData({
          firstName: '',
          lastName: '',
          email: '',
          username: '',
          password: '',
          confirmPassword: ''
      });
      setError('');
      setPasswordsMatch(null);
      setPasswordValid(null);
  };

  const handleAddUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      
      if (!passwordValid) {
          setError("Password must be at least 8 characters, include a number, an uppercase letter, and a special character (!@#$%^&*)");
          return;
      }

      if (formData.password !== formData.confirmPassword) {
          setError("Passwords do not match");
          return;
      }

      setLoading(true);

      try {
          await axios.post('http://localhost:8000/users', {
              username: formData.username,
              email: formData.email,
              first_name: formData.firstName,
              last_name: formData.lastName,
              password: formData.password,
              role: "Viewer" // Default role
          }, {
              headers: { Authorization: `Bearer ${token}` }
          });

          setShowAddUserModal(false);
          resetForm();
          fetchData(); 
      } catch (err: any) {
          setError(err.response?.data?.detail || "Failed to create user");
      } finally {
          setLoading(false);
      }
  };

  const handleEditUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingUser) return;
      setError('');

      // Password validation only if password is provided
      if (formData.password) {
          if (!passwordValid) {
             setError("Password must be at least 8 characters, include a number, an uppercase letter, and a special character (!@#$%^&*)");
             return;
          }
          if (formData.password !== formData.confirmPassword) {
              setError("Passwords do not match");
              return;
          }
      }

      setLoading(true);

      try {
          const payload: any = {
              username: formData.username,
              email: formData.email,
              first_name: formData.firstName,
              last_name: formData.lastName,
          };
          
          if (formData.password) {
              payload.password = formData.password;
          }

          await axios.put(`http://localhost:8000/users/${editingUser.id}`, payload, {
              headers: { Authorization: `Bearer ${token}` }
          });

          setShowEditUserModal(false);
          setEditingUser(null);
          resetForm();
          fetchData();
      } catch (err: any) {
          setError(err.response?.data?.detail || "Failed to update user");
      } finally {
          setLoading(false);
      }
  };

  const openEditModal = (user: User) => {
      setEditingUser(user);
      setFormData({
          firstName: user.first_name || '',
          lastName: user.last_name || '',
          email: user.email,
          username: user.username,
          password: '', // Don't populate password
          confirmPassword: ''
      });
      setShowEditUserModal(true);
      setActiveActionMenu(null);
  };

  const handleDeleteUser = async (userId: number) => {
      if (!window.confirm("Are you sure you want to delete this user?")) return;
      
      try {
          await axios.delete(`http://localhost:8000/users/${userId}`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          fetchData();
          setActiveActionMenu(null);
      } catch (err: any) {
          alert(err.response?.data?.detail || "Failed to delete user");
      }
  };

  const canManageUsers = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';

  return (
    <div className="space-y-6 relative h-full flex flex-col">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">User & Groups</h2>
          <p className="text-muted">Manage system access and permissions.</p>
        </div>
        {canManageUsers && (
            <button 
                onClick={() => { resetForm(); setShowAddUserModal(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-primary font-bold hover:bg-accent/90 transition-colors"
            >
            <Plus className="w-5 h-5" />
            <span>Add {activeTab === 'users' ? 'User' : 'Group'}</span>
            </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-white/10 flex-shrink-0">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'users' ? 'text-accent' : 'text-muted hover:text-white'
          }`}
        >
          Users
          {activeTab === 'users' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent shadow-[0_0_10px_#38bdf8]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'groups' ? 'text-accent' : 'text-muted hover:text-white'
          }`}
        >
          Groups
          {activeTab === 'groups' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent shadow-[0_0_10px_#38bdf8]" />
          )}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-surface/50 backdrop-blur-sm border border-white/5 overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-auto">
            <table className="w-full">
            <thead className="sticky top-0 bg-[#0f172a] z-10">
                <tr className="border-b border-white/5">
                <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    {activeTab === 'users' ? 'User' : 'Group Name'}
                </th>
                {activeTab === 'users' && (
                    <>
                        <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">Email</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">First Name</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">Last Name</th>
                    </>
                )}
                <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    {activeTab === 'users' ? 'Role' : 'Description'}
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">Created At</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-muted uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
                {activeTab === 'users' ? (
                users.map((user) => (
                    <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                            <UsersIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">{user.username}</p>
                        </div>
                        </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                        {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                        {user.first_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                        {user.last_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/10 text-purple-400 text-xs font-medium" title={getRoleDescription(user.role)}>
                        <Shield className="w-3 h-3" />
                        {formatRole(user.role)}
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                        {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy HH:mm:ss') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right relative">
                        {canManageUsers && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setActiveActionMenu(activeActionMenu === user.id ? null : user.id); }}
                                className="p-2 rounded-lg hover:bg-white/10 text-muted hover:text-white transition-colors"
                            >
                            <MoreVertical className="w-4 h-4" />
                            </button>
                        )}
                        
                        {/* Action Menu */}
                        {activeActionMenu === user.id && canManageUsers && (
                            <div 
                                ref={actionMenuRef}
                                className="absolute right-8 top-8 z-50 w-32 bg-[#0f172a] border border-white/10 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                            >
                                <button 
                                    onClick={() => openEditModal(user)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-white hover:bg-white/5 transition-colors text-left"
                                >
                                    <Edit className="w-3 h-3" />
                                    Edit
                                </button>
                                <button 
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    Delete
                                </button>
                            </div>
                        )}
                    </td>
                    </tr>
                ))
                ) : (
                groups.length === 0 ? (
                    <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-muted">
                        No groups found.
                    </td>
                    </tr>
                ) : (
                    groups.map((group) => (
                        <tr key={group.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                            {group.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                            {group.description || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                            {group.created_at ? format(new Date(group.created_at), 'MMM d, yyyy HH:mm:ss') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                            {canManageUsers && (
                                <button className="p-2 rounded-lg hover:bg-white/10 text-muted hover:text-white transition-colors">
                                <MoreVertical className="w-4 h-4" />
                                </button>
                            )}
                        </td>
                        </tr>
                    ))
                )
                )}
            </tbody>
            </table>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {(showAddUserModal || showEditUserModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <h3 className="text-xl font-bold text-white">{showEditUserModal ? 'Edit User' : 'Add New User'}</h3>
                    <button onClick={() => { setShowAddUserModal(false); setShowEditUserModal(false); resetForm(); }} className="text-muted hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <form onSubmit={showEditUserModal ? handleEditUser : handleAddUser} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted">First Name</label>
                            <input 
                                type="text" 
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleInputChange}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white placeholder-muted/50 focus:outline-none focus:border-accent/50"
                                required 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted">Last Name</label>
                            <input 
                                type="text" 
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleInputChange}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white placeholder-muted/50 focus:outline-none focus:border-accent/50"
                                required 
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted">Email</label>
                        <input 
                            type="email" 
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white placeholder-muted/50 focus:outline-none focus:border-accent/50"
                            required 
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted">Username</label>
                        <input 
                            type="text" 
                            name="username"
                            value={formData.username}
                            onChange={handleInputChange}
                            // Username usually shouldn't be changed, but user asked for it.
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white placeholder-muted/50 focus:outline-none focus:border-accent/50"
                            required 
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted">
                            Password {showEditUserModal && <span className="text-xs text-muted font-normal">(Leave blank to keep current)</span>}
                        </label>
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                className={clsx(
                                    "w-full bg-white/5 border rounded-xl py-2 px-4 text-white placeholder-muted/50 focus:outline-none focus:ring-1 transition-all",
                                    // Validation only if password entered
                                    (formData.password && passwordValid === false) 
                                        ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20" 
                                        : "border-white/10 focus:border-accent/50 focus:ring-accent/50"
                                )}
                                required={!showEditUserModal} // Not required in edit mode
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {formData.password && (
                            <div className="text-xs space-y-1 mt-1">
                                <p className={clsx(formData.password.length >= 8 ? "text-green-400" : "text-muted")}>
                                    • At least 8 characters
                                </p>
                                <p className={clsx(/[A-Z]/.test(formData.password) ? "text-green-400" : "text-muted")}>
                                    • At least one uppercase letter
                                </p>
                                <p className={clsx(/[0-9]/.test(formData.password) ? "text-green-400" : "text-muted")}>
                                    • At least one number
                                </p>
                                <p className={clsx(/[!@#\$%\^&\*]/.test(formData.password) ? "text-green-400" : "text-muted")}>
                                    • At least one special character (!@#$%^&*)
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <label className="text-sm font-medium text-muted">Confirm Password</label>
                            {passwordsMatch !== null && (
                                <span className={clsx("text-xs flex items-center gap-1", passwordsMatch ? "text-green-400" : "text-red-400")}>
                                    {passwordsMatch ? (
                                        <>
                                            <CheckCircle2 className="w-3 h-3" /> Match
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle className="w-3 h-3" /> Mismatch
                                        </>
                                    )}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <input 
                                type={showConfirmPassword ? "text" : "password"} 
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleInputChange}
                                className={clsx(
                                    "w-full bg-white/5 border rounded-xl py-2 px-4 text-white placeholder-muted/50 focus:outline-none focus:ring-1 transition-all",
                                    passwordsMatch === false 
                                        ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20" 
                                        : passwordsMatch === true
                                            ? "border-green-500/50 focus:border-green-500 focus:ring-green-500/20"
                                            : "border-white/10 focus:border-accent/50 focus:ring-accent/50"
                                )}
                                required={!showEditUserModal && !!formData.password} // Required if creating, or if editing and password filled
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                            >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={
                            loading || 
                            (formData.password && (passwordsMatch === false || passwordValid === false))
                        }
                        className={clsx(
                            "w-full bg-accent text-primary font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-accent/90 focus:ring-4 focus:ring-accent/20 transition-all mt-6",
                            (loading || (formData.password && (passwordsMatch === false || passwordValid === false))) && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (showEditUserModal ? "Update User" : "Create User")}
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}
