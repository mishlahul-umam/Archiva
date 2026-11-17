import React, { useState, useEffect } from 'react';
import { GitBranch, CheckCircle2, XCircle, Clock, ArrowRight, Loader2, FileText } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

interface Document {
    id: number;
    title: string;
    filename: string;
    created_at: string;
    status: string;
    owner_id: number;
}

interface WorkflowStats {
    pending_review: number;
    approved_today: number;
    rejected_total: number;
}

export function Workflow() {
  const { token, user } = useAuth();
  const [pendingDocs, setPendingDocs] = useState<Document[]>([]);
  const [stats, setStats] = useState<WorkflowStats>({ pending_review: 0, approved_today: 0, rejected_total: 0 });
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchData = async () => {
      try {
          const [pendingRes, statsRes] = await Promise.all([
              axios.get('http://localhost:8000/workflow/pending', {
                  headers: { Authorization: `Bearer ${token}` }
              }),
              axios.get('http://localhost:8000/workflow/stats', {
                  headers: { Authorization: `Bearer ${token}` }
              })
          ]);
          setPendingDocs(pendingRes.data);
          setStats(statsRes.data);
      } catch (err) {
          console.error("Failed to fetch workflow data", err);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      fetchData();
  }, [token]);

  const handleApprove = async (docId: number) => {
      setProcessingId(docId);
      try {
          await axios.post(`http://localhost:8000/workflow/${docId}/approve`, {}, {
              headers: { Authorization: `Bearer ${token}` }
          });
          // Refresh data to update list and stats
          fetchData();
      } catch (err) {
          console.error("Failed to approve", err);
          alert("Failed to approve document");
      } finally {
          setProcessingId(null);
      }
  };

  const handleReject = async (docId: number) => {
      if (!window.confirm("Are you sure you want to reject this document?")) return;
      setProcessingId(docId);
      try {
          await axios.post(`http://localhost:8000/workflow/${docId}/reject`, {}, {
              headers: { Authorization: `Bearer ${token}` }
          });
          // Refresh data to update list and stats
          fetchData();
      } catch (err) {
          console.error("Failed to reject", err);
          alert("Failed to reject document");
      } finally {
          setProcessingId(null);
      }
  };

  if (loading) {
      return (
          <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
      );
  }

  return (
    <div className="space-y-6">
       <div>
          <h2 className="text-3xl font-bold text-white mb-2">Workflows</h2>
          <p className="text-muted">Manage document approval processes.</p>
        </div>

        {/* Status Cards (Real Data) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-surface/50 border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                        <Clock className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Pending Review</h3>
                </div>
                <p className="text-3xl font-bold text-white">{stats.pending_review}</p>
                <p className="text-sm text-muted mt-1">Documents awaiting approval</p>
            </div>
             <div className="p-6 rounded-2xl bg-surface/50 border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Approved Today</h3>
                </div>
                <p className="text-3xl font-bold text-white">{stats.approved_today}</p>
                <p className="text-sm text-muted mt-1">Processed successfully</p>
            </div>
             <div className="p-6 rounded-2xl bg-surface/50 border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                        <XCircle className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Rejected</h3>
                </div>
                <p className="text-3xl font-bold text-white">{stats.rejected_total}</p>
                <p className="text-sm text-muted mt-1">Total documents returned</p>
            </div>
        </div>

        {/* Pending Approval List */}
        <div className="rounded-2xl bg-surface/50 border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5">
                <h3 className="text-lg font-bold text-white">Pending Approvals</h3>
            </div>
            
            {pendingDocs.length === 0 ? (
                <div className="p-8 text-center text-muted">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No documents pending approval.</p>
                </div>
            ) : (
                <div className="divide-y divide-white/5">
                    {pendingDocs.map((doc) => (
                        <div key={doc.id} className="p-6 flex items-center justify-between hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white">{doc.title}</h4>
                                    <div className="flex items-center gap-2 text-sm text-muted mt-1">
                                        <span>{doc.filename}</span>
                                        <span>•</span>
                                        <span>{format(new Date(doc.created_at), 'MMM d, yyyy HH:mm')}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => handleReject(doc.id)}
                                    disabled={processingId === doc.id}
                                    className="px-4 py-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
                                >
                                    {processingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                    Reject
                                </button>
                                <button 
                                    onClick={() => handleApprove(doc.id)}
                                    disabled={processingId === doc.id}
                                    className="px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
                                >
                                    {processingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    Approve
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
}
