import React from 'react';
import { Settings as SettingsIcon, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Settings() {
  const { user } = useAuth();

  if (user?.role !== 'SuperAdmin') {
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
          <h2 className="text-3xl font-bold text-white mb-2">Settings</h2>
          <p className="text-muted">Manage system preferences.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-surface/50 border border-white/5">
                <h3 className="text-lg font-bold text-white mb-4">General</h3>
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-muted">System Name</span>
                        <span className="text-white">Archiva EDMS</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted">Language</span>
                        <span className="text-white">English (US)</span>
                    </div>
                </div>
            </div>
            <div className="p-6 rounded-2xl bg-surface/50 border border-white/5">
                <h3 className="text-lg font-bold text-white mb-4">Storage</h3>
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-muted">Backend</span>
                        <span className="text-white">Local / Object Storage</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted">Compression</span>
                        <span className="text-white">Enabled</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
