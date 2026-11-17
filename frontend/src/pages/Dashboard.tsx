import React, { useState, useEffect } from 'react';
import { FileText, Clock, AlertCircle, CheckCircle, Eye, X } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

interface Document {
  id: number;
  title: string;
  filename: string;
  file_type: string;
  file_size: number;
  created_at: string;
  status: string;
  owner_id: number;
}

interface StorageStats {
  total_used: number;
  total_limit: number;
  documents_size: number;
  images_size: number;
  others_size: number;
}

interface DashboardStats {
  total_documents: number;
  pending_approvals: number;
  expiring_soon: number;
  processed_today: number;
  storage_usage: StorageStats;
}

export function Dashboard() {
  const [recentDocs, setRecentDocs] = useState<Document[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const { token } = useAuth();
  
  // OCR Modal State
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrContent, setOcrContent] = useState<string>('');
  const [ocrLoading, setOcrLoading] = useState(false);

  // File Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileType, setPreviewFileType] = useState<string>('');
  const [previewTitle, setPreviewTitle] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [docsRes, statsRes] = await Promise.all([
            axios.get('http://localhost:8000/documents?limit=5', {
                headers: { Authorization: `Bearer ${token}` }
            }),
            axios.get('http://localhost:8000/dashboard/stats', {
                headers: { Authorization: `Bearer ${token}` }
            })
        ]);
        
        setRecentDocs(docsRes.data);
        setStats(statsRes.data);
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      }
    };
    
    if (token) {
        fetchData();
    }
  }, [token]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 GB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const statCards = [
    { label: 'Total Documents', value: stats?.total_documents.toLocaleString() || '0', icon: FileText, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Pending Approvals', value: stats?.pending_approvals.toLocaleString() || '0', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { label: 'Expiring Soon', value: stats?.expiring_soon.toLocaleString() || '0', icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-400/10' },
    { label: 'Processed Today', value: stats?.processed_today.toLocaleString() || '0', icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  ];

  const storagePercentage = stats ? (stats.storage_usage.total_used / stats.storage_usage.total_limit) * 100 : 0;

  const handleDocumentClick = async (docId: number, filename: string, title: string) => {
      try {
          const response = await axios.get(`http://localhost:8000/documents/${docId}/download`, {
              headers: { Authorization: `Bearer ${token}` },
              responseType: 'blob',
          });
          
          const blob = new Blob([response.data], { type: response.headers['content-type'] });
          const url = window.URL.createObjectURL(blob);
          
          setPreviewUrl(url);
          setPreviewFileType(response.headers['content-type']);
          setPreviewTitle(title);
          setShowPreviewModal(true);
      } catch (error) {
          console.error("Failed to open file", error);
          alert("Failed to open file.");
      }
  };

  const closePreviewModal = () => {
      setShowPreviewModal(false);
      if (previewUrl) {
          window.URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
      }
      setPreviewFileType('');
      setPreviewTitle('');
  };

  const handleViewOcr = async (e: React.MouseEvent, docId: number) => {
      e.stopPropagation(); // Prevent triggering row click
      setOcrLoading(true);
      setOcrContent('');
      setShowOcrModal(true);
      
      try {
          const response = await axios.get(`http://localhost:8000/documents/${docId}/ocr`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          setOcrContent(response.data.text || "No OCR text extracted for this document.");
      } catch (error) {
          console.error("Failed to fetch OCR text", error);
          setOcrContent("Failed to load OCR text.");
      } finally {
          setOcrLoading(false);
      }
  };

  return (
    <div className="space-y-8 relative">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Dashboard</h2>
        <p className="text-muted">Welcome back, here's what's happening today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="p-6 rounded-2xl bg-surface/50 backdrop-blur-sm border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted text-sm font-medium">{stat.label}</p>
                <h3 className="text-2xl font-bold text-white mt-1">{stat.value}</h3>
              </div>
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-surface/50 backdrop-blur-sm border border-white/5">
          <h3 className="text-lg font-bold text-white mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {recentDocs.length === 0 ? (
                <div className="text-center text-muted py-4">
                    No recent activity.
                </div>
            ) : (
                recentDocs.map((doc) => (
                  <div 
                    key={doc.id} 
                    onClick={() => handleDocumentClick(doc.id, doc.filename, doc.title)}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">{doc.title}</h4>
                      <p className="text-xs text-muted">Uploaded • {format(new Date(doc.created_at), 'MMM d, h:mm a')}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => handleViewOcr(e, doc.id)}
                            className="p-2 rounded-lg hover:bg-white/10 text-muted hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
                            title="View OCR Content"
                        >
                            <Eye className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-medium px-2 py-1 rounded-md bg-emerald-400/10 text-emerald-400 capitalize whitespace-nowrap">
                          {doc.status}
                        </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-surface/50 backdrop-blur-sm border border-white/5">
          <h3 className="text-lg font-bold text-white mb-4">Storage Usage</h3>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Total Used</span>
                <span className="text-white font-medium">
                    {stats ? formatSize(stats.storage_usage.total_used) : '0 GB'} / {stats ? formatSize(stats.storage_usage.total_limit) : '2 TB'}
                </span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-accent rounded-full shadow-[0_0_10px_#38bdf8] transition-all duration-1000" 
                    style={{ width: `${storagePercentage}%` }}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/5">
                <p className="text-xs text-muted mb-1">Documents</p>
                <p className="text-lg font-bold text-white">
                    {stats ? formatSize(stats.storage_usage.documents_size) : '0 GB'}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white/5">
                <p className="text-xs text-muted mb-1">Images</p>
                <p className="text-lg font-bold text-white">
                    {stats ? formatSize(stats.storage_usage.images_size) : '0 GB'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OCR Content Modal */}
      {showOcrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowOcrModal(false)}>
              <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          <Eye className="w-5 h-5 text-accent" />
                          Extracted Text Content
                      </h3>
                      <button onClick={() => setShowOcrModal(false)} className="text-muted hover:text-white transition-colors">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  <div className="p-6 overflow-y-auto custom-scrollbar bg-[#0f172a]">
                      {ocrLoading ? (
                          <div className="flex flex-col items-center justify-center py-12 text-muted">
                              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
                              <p>Extracting text content...</p>
                          </div>
                      ) : (
                          <div className="prose prose-invert max-w-none">
                              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300 bg-black/20 p-4 rounded-xl border border-white/5">
                                  {ocrContent}
                              </pre>
                          </div>
                      )}
                  </div>
                  <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end">
                      <button 
                          onClick={() => setShowOcrModal(false)}
                          className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors text-sm font-medium"
                      >
                          Close
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* File Preview Modal */}
      {showPreviewModal && previewUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closePreviewModal}>
              <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-5xl h-[85vh] shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2 truncate max-w-xl">
                          <FileText className="w-5 h-5 text-accent" />
                          {previewTitle}
                      </h3>
                      <button onClick={closePreviewModal} className="text-muted hover:text-white transition-colors">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  <div className="flex-1 bg-black/20 relative overflow-hidden">
                      {previewFileType.includes('pdf') ? (
                          <iframe 
                              src={previewUrl} 
                              className="w-full h-full border-0"
                              title="PDF Preview"
                          />
                      ) : previewFileType.includes('image') ? (
                          <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                              <img 
                                  src={previewUrl} 
                                  alt="Preview" 
                                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                              />
                          </div>
                      ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-muted p-8 text-center">
                              <FileText className="w-16 h-16 mb-4 opacity-50" />
                              <p className="text-lg font-medium text-white mb-2">Preview not available</p>
                              <p className="mb-6 max-w-md">This file type cannot be previewed directly in the browser.</p>
                              <a 
                                  href={previewUrl} 
                                  download 
                                  className="px-4 py-2 rounded-xl bg-accent text-primary font-bold hover:bg-accent/90 transition-colors"
                              >
                                  Download File
                              </a>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
