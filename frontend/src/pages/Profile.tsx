import React, { useState, useEffect } from 'react';
import { User, Save, Loader2, KeyRound, Edit2, X } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export function Profile() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      password: '',
      confirmPassword: ''
  });

  const fetchProfile = async () => {
      try {
          const res = await axios.get('http://localhost:8000/users/me', {
              headers: { Authorization: `Bearer ${token}` }
          });
          setFormData(prev => ({
              ...prev,
              firstName: res.data.first_name || '',
              lastName: res.data.last_name || '',
              email: res.data.email || '',
              username: res.data.username || '',
              password: '',
              confirmPassword: ''
          }));
      } catch (err) {
          console.error("Failed to fetch profile", err);
      }
  };

  useEffect(() => {
      if (token) fetchProfile();
  }, [token]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData({
          ...formData,
          [e.target.name]: e.target.value
      });
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError('');
      setSuccessMessage('');

      if (formData.password && formData.password !== formData.confirmPassword) {
          setError("Passwords do not match");
          setLoading(false);
          return;
      }

      try {
          const meRes = await axios.get('http://localhost:8000/users/me', {
               headers: { Authorization: `Bearer ${token}` }
          });
          const userId = meRes.data.id;

          const payload: any = {
              first_name: formData.firstName,
              last_name: formData.lastName,
              email: formData.email,
              username: formData.username
          };

          if (formData.password) {
              payload.password = formData.password;
          }

          await axios.put(`http://localhost:8000/users/${userId}`, payload, {
              headers: { Authorization: `Bearer ${token}` }
          });

          setSuccessMessage("Profile updated successfully");
          setIsEditing(false);
          // Refresh profile data to ensure we have the latest
          fetchProfile();
      } catch (err: any) {
          setError(err.response?.data?.detail || "Failed to update profile");
      } finally {
          setLoading(false);
      }
  };

  const toggleEdit = () => {
      if (isEditing) {
          // Cancel edit: revert to original data
          fetchProfile();
          setIsEditing(false);
          setError('');
          setSuccessMessage('');
      } else {
          setIsEditing(true);
          setSuccessMessage('');
          setError('');
      }
  };

  return (
    <div className="space-y-6">
       <div>
          <h2 className="text-3xl font-bold text-white mb-2">User Details</h2>
          <p className="text-muted">Manage your personal profile and security.</p>
        </div>

        <div className="max-w-2xl">
            <div className="p-6 rounded-2xl bg-surface/50 border border-white/5 space-y-6 relative">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <User className="w-5 h-5 text-accent" />
                            Personal Information
                        </h3>
                        <p className="text-sm text-muted mt-1">
                            {isEditing ? "Update your personal details." : "View your personal details."}
                        </p>
                    </div>
                    {!isEditing && (
                        <button 
                            onClick={toggleEdit}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-colors text-sm font-medium"
                        >
                            <Edit2 className="w-4 h-4" />
                            Edit Profile
                        </button>
                    )}
                </div>

                {successMessage && (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-sm">
                        {successMessage}
                    </div>
                )}
                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleUpdateProfile} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted">First Name</label>
                            {isEditing ? (
                                <input 
                                    type="text" 
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleInputChange}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white placeholder-muted/50 focus:outline-none focus:border-accent/50 transition-colors"
                                />
                            ) : (
                                <div className="w-full py-2 px-4 text-white border border-transparent">
                                    {formData.firstName || '-'}
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted">Last Name</label>
                            {isEditing ? (
                                <input 
                                    type="text" 
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleInputChange}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white placeholder-muted/50 focus:outline-none focus:border-accent/50 transition-colors"
                                />
                            ) : (
                                <div className="w-full py-2 px-4 text-white border border-transparent">
                                    {formData.lastName || '-'}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted">Email</label>
                        {isEditing ? (
                            <input 
                                type="email" 
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white placeholder-muted/50 focus:outline-none focus:border-accent/50 transition-colors"
                            />
                        ) : (
                            <div className="w-full py-2 px-4 text-white border border-transparent">
                                {formData.email}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted">Username</label>
                        {isEditing ? (
                            <input 
                                type="text" 
                                name="username"
                                value={formData.username}
                                onChange={handleInputChange}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white placeholder-muted/50 focus:outline-none focus:border-accent/50 transition-colors"
                            />
                        ) : (
                            <div className="w-full py-2 px-4 text-white border border-transparent">
                                {formData.username}
                            </div>
                        )}
                    </div>

                    {isEditing && (
                        <div className="pt-4 border-t border-white/10 space-y-4">
                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                <KeyRound className="w-4 h-4 text-accent" />
                                Change Password
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted">New Password</label>
                                    <input 
                                        type="password" 
                                        name="password"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        placeholder="Leave blank to keep current"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white placeholder-muted/50 focus:outline-none focus:border-accent/50 transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted">Confirm Password</label>
                                    <input 
                                        type="password" 
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleInputChange}
                                        placeholder="Confirm new password"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white placeholder-muted/50 focus:outline-none focus:border-accent/50 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {isEditing && (
                        <div className="flex gap-3 pt-2">
                            <button 
                                type="submit" 
                                disabled={loading}
                                className="bg-accent text-primary font-bold px-6 py-2.5 rounded-xl hover:bg-accent/90 focus:ring-4 focus:ring-accent/20 transition-all flex items-center gap-2"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save Changes
                            </button>
                            <button 
                                type="button"
                                onClick={toggleEdit}
                                className="px-6 py-2.5 rounded-xl hover:bg-white/5 text-muted hover:text-white transition-colors flex items-center gap-2"
                            >
                                <X className="w-4 h-4" />
                                Cancel
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    </div>
  );
}
