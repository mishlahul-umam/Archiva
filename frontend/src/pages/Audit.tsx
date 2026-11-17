import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface AuditLog {
    id: number;
    username: string;
    action: string;
    details: string;
    timestamp: string;
}

export function Audit() {
  const { token, user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      const fetchLogs = async () => {
          try {
              const res = await axios.get('http://localhost:8000/audit-logs', {
                  headers: { Authorization: `Bearer ${token}` }
              });
              setLogs(res.data);
          } catch (err) {
              console.error("Failed to fetch audit logs", err);
          } finally {
              setLoading(false);
          }
      };
      if (user?.role === 'SuperAdmin') {
          fetchLogs();
      } else {
          setLoading(false);
      }
  }, [token, user]);

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
          <h2 className="text-3xl font-bold text-white mb-2">Audit Trail</h2>
          <p className="text-muted">Track all system activities and security events.</p>
        </div>

        <div className="rounded-2xl bg-surface/50 border border-white/5 overflow-hidden">
            {loading ? (
                <div className="p-8 flex justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-accent" />
                </div>
            ) : logs.length === 0 ? (
                <div className="p-8 text-center text-muted">
                    No audit logs found.
                </div>
            ) : (
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/5">
                            <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">User</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">Action</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">Details</th>
                            <th className="px-6 py-4 text-right text-xs font-medium text-muted uppercase tracking-wider">Timestamp</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                                    {log.username}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium">
                                        {log.action}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-muted max-w-md truncate">
                                    {log.details || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-muted">
                                    {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    </div>
  );
}
