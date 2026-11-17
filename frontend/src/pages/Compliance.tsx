import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, PieChart, Loader2, FileText, X } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { DocumentActions } from '../components/DocumentActions';

interface ComplianceStats {
    totalPolicies: number;
    activeViolations: number;
    compliantDocs: number;
    auditScore: number;
    classificationStats: {
        type: string;
        count: number;
        percentage: number;
        color: string;
    }[];
    recentViolations: {
        policy: string;
        doc: string;
        doc_id: number;
        severity: string;
        time: string;
    }[];
}

interface Document {
    id: number;
    title: string;
    filename: string;
    file_type: string;
    file_size: number;
    created_at: string;
    status: string;
    owner_id: number;
    cabinet_id?: number;
    ocr_content?: string;
    ai_metadata?: any;
}

export function Compliance() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Drill-down state
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [typeDocuments, setTypeDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  
  // Doc details modal
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [showCabinetModal, setShowCabinetModal] = useState(false);
  const [cabinets, setCabinets] = useState<any[]>([]);
  const [selectedCabinetId, setSelectedCabinetId] = useState<string>("");

  useEffect(() => {
      const fetchStats = async () => {
          try {
              const res = await axios.get('http://localhost:8000/compliance/stats', {
                  headers: { Authorization: `Bearer ${token}` }
              });
              setStats(res.data);
          } catch (err) {
              console.error("Failed to fetch compliance stats", err);
          } finally {
              setLoading(false);
          }
      };
      if (user?.role === 'SuperAdmin') {
          fetchStats();
      } else {
          setLoading(false);
      }
  }, [token, user]);

  const fetchDocumentsByType = async (type: string) => {
      setLoadingDocs(true);
      setSelectedType(type);
      try {
          const res = await axios.get('http://localhost:8000/documents', {
              headers: { Authorization: `Bearer ${token}` }
          });
          
          const filtered = res.data.filter((doc: Document) => {
              const docType = doc.ai_metadata?.document_type || "Unknown";
              return docType === type;
          });
          
          setTypeDocuments(filtered);
      } catch (err) {
          console.error("Failed to fetch documents", err);
      } finally {
          setLoadingDocs(false);
      }
  };
  
  const fetchCabinets = async () => {
      try {
          const response = await axios.get('http://localhost:8000/cabinets/', {
              headers: { Authorization: `Bearer ${token}` }
          });
          
           // Flatten helper
          const flatten = (nodes: any[], level = 0): any[] => {
              let flat: any[] = [];
              for (const node of nodes) {
                  flat.push({ ...node, level });
                  if (node.children && node.children.length > 0) {
                      flat = flat.concat(flatten(node.children, level + 1));
                  }
              }
              return flat;
          };
          setCabinets(flatten(response.data));
      } catch (error) {
          console.error("Failed to fetch cabinets", error);
      }
  };

  // Action handlers
  const handleViewOcr = async (e: React.MouseEvent, doc: Document) => {
      e.stopPropagation();
      try {
           const response = await axios.get(`http://localhost:8000/documents/${doc.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setSelectedDoc(response.data);
      } catch(err) {
          console.error("Failed to fetch doc details", err);
      }
  }

  const handleDownload = async (e: React.MouseEvent, docId: number, filename: string) => {
      e.stopPropagation();
      try {
          const response = await axios.get(`http://localhost:8000/documents/${docId}/download`, {
              headers: { Authorization: `Bearer ${token}` },
              responseType: 'blob',
          });
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();
          link.remove();
      } catch (error) {
          console.error("Failed to download", error);
      }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm("Delete document?")) return;
      try {
          await axios.delete(`http://localhost:8000/documents/${id}`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          // Refresh list
          if (selectedType) fetchDocumentsByType(selectedType);
          // Also refresh stats?
          window.location.reload(); 
      } catch (error) {
          console.error("Failed to delete", error);
      }
  };

  const handleAddToCabinet = (e: React.MouseEvent, doc: Document) => {
      e.stopPropagation();
      fetchCabinets();
      setSelectedDoc(doc);
      setSelectedCabinetId(doc.cabinet_id ? doc.cabinet_id.toString() : "");
      setShowCabinetModal(true);
  };

  const confirmCabinetAction = async () => {
      if (!selectedDoc || !selectedCabinetId) return;
      try {
          await axios.post(`http://localhost:8000/cabinets/${selectedCabinetId}/documents/${selectedDoc.id}`, {}, {
              headers: { Authorization: `Bearer ${token}` }
          });
          alert("Cabinet updated successfully");
          setShowCabinetModal(false);
          if (selectedType) fetchDocumentsByType(selectedType);
      } catch (err) {
          console.error("Failed to update cabinet", err);
          alert("Failed to update cabinet");
      }
  };

  if (user?.role !== 'SuperAdmin') {
      return (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6">
              <Shield className="w-12 h-12 text-red-400 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Access Denied</h3>
              <p className="text-muted">You do not have permission to view this page.</p>
          </div>
      );
  }

  if (loading) {
      return (
          <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
      );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Compliance Dashboard</h2>
        <p className="text-muted">Monitor policy adherence and regulatory status.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 rounded-2xl bg-surface/50 border border-white/5">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm text-muted">Active Violations</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{stats.activeViolations}</h3>
                </div>
                <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                    <AlertTriangle className="w-5 h-5" />
                </div>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1.5">
                <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${stats.activeViolations > 0 ? '25' : '0'}%` }}></div>
            </div>
        </div>

        <div className="p-6 rounded-2xl bg-surface/50 border border-white/5">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm text-muted">Compliant Documents</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{stats.compliantDocs}</h3>
                </div>
                <div className="p-2 rounded-lg bg-green-500/10 text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                </div>
            </div>
             <div className="w-full bg-white/5 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '92%' }}></div>
            </div>
        </div>

        <div className="p-6 rounded-2xl bg-surface/50 border border-white/5">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm text-muted">Active Policies</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{stats.totalPolicies}</h3>
                </div>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                    <ShieldCheck className="w-5 h-5" />
                </div>
            </div>
             <div className="w-full bg-white/5 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
            </div>
        </div>

         <div className="p-6 rounded-2xl bg-surface/50 border border-white/5">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm text-muted">Audit Score</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{stats.auditScore}%</h3>
                </div>
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                    <PieChart className="w-5 h-5" />
                </div>
            </div>
             <div className="w-full bg-white/5 rounded-full h-1.5">
                <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${stats.auditScore}%` }}></div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Violations */}
        <div className="p-6 rounded-2xl bg-surface/50 border border-white/5">
            <h3 className="text-lg font-bold text-white mb-4">Recent Policy Violations</h3>
            <div className="space-y-4">
                {stats.recentViolations.length === 0 ? (
                    <p className="text-muted text-sm text-center py-4">No recent violations found.</p>
                ) : (
                    stats.recentViolations.map((violation, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${
                                    violation.severity === 'High' ? 'bg-red-500' : 
                                    violation.severity === 'Medium' ? 'bg-amber-500' : 'bg-blue-500'
                                }`} />
                                <div>
                                    <p className="text-sm font-medium text-white">{violation.policy}</p>
                                    <p className="text-xs text-muted">{violation.doc}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                 <span className={`text-xs px-2 py-1 rounded-md ${
                                    violation.severity === 'High' ? 'bg-red-500/10 text-red-400' : 
                                    violation.severity === 'Medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                                }`}>
                                    {violation.severity}
                                </span>
                                <p className="text-xs text-muted mt-1">{violation.time}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* AI Classification Stats */}
        <div className="p-6 rounded-2xl bg-surface/50 border border-white/5">
            <h3 className="text-lg font-bold text-white mb-4">AI Document Classification</h3>
            <div className="space-y-4">
                 {stats.classificationStats.length === 0 ? (
                     <p className="text-muted text-sm text-center py-4">No classification data available.</p>
                 ) : (
                    stats.classificationStats.map((item, i) => (
                        <div key={i} className="space-y-1 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => fetchDocumentsByType(item.type)}>
                            <div className="flex justify-between text-sm">
                                <span className="text-white font-medium hover:underline decoration-accent">{item.type}</span>
                                <span className="text-muted">{item.count} docs ({item.percentage}%)</span>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-2">
                                <div className={`${item.color} h-2 rounded-full`} style={{ width: `${item.percentage}%` }}></div>
                            </div>
                        </div>
                    ))
                 )}
            </div>
        </div>
      </div>

      {/* Drill Down Modal */}
      {selectedType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedType(null)}>
              <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between p-6 border-b border-white/10">
                      <h3 className="text-xl font-bold text-white">Documents: {selectedType}</h3>
                      <button onClick={() => setSelectedType(null)} className="text-muted hover:text-white">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  <div className="p-0 overflow-y-auto flex-1">
                      {loadingDocs ? (
                          <div className="flex justify-center p-8"><Loader2 className="animate-spin text-accent" /></div>
                      ) : typeDocuments.length === 0 ? (
                          <div className="p-8 text-center text-muted">No documents found for this category.</div>
                      ) : (
                          <table className="w-full">
                              <thead className="bg-white/5">
                                  <tr>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Name</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">Date</th>
                                      <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase">Actions</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                  {typeDocuments.map(doc => (
                                      <tr key={doc.id} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => {
                                          setSelectedDoc(doc);
                                      }}>
                                          <td className="px-6 py-4">
                                              <div className="flex items-center gap-3">
                                                  <FileText className="w-4 h-4 text-accent" />
                                                  <span className="text-sm text-white">{doc.title}</span>
                                              </div>
                                          </td>
                                          <td className="px-6 py-4 text-sm text-muted">
                                              {new Date(doc.created_at).toLocaleDateString()}
                                          </td>
                                          <td className="px-6 py-4 text-right">
                                              <div className="flex justify-end" onClick={e => e.stopPropagation()}>
                                                <DocumentActions 
                                                    doc={doc}
                                                    onViewOcr={handleViewOcr}
                                                    onDownload={(e, d) => handleDownload(e, d.id, d.filename)}
                                                    onDelete={(e, d) => handleDelete(d.id, e)}
                                                    canDelete={true} // SuperAdmin
                                                    onAddToCabinet={handleAddToCabinet}
                                                    onViewCabinet={(e, d) => navigate(`/cabinets?id=${d.cabinet_id}`)}
                                                />
                                              </div>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* OCR/Details Modal */}
      {selectedDoc && !showCabinetModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedDoc(null)}>
            <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <h3 className="text-xl font-bold text-white">OCR Content</h3>
                    <button onClick={() => setSelectedDoc(null)} className="text-muted hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                     <div className="space-y-6">
                        {/* Header Info */}
                        <div>
                            <p className="text-sm text-muted mb-1">Document Title</p>
                            <p className="text-white font-medium text-lg">{selectedDoc.title}</p>
                        </div>

                        {/* AI Metadata Section */}
                        {selectedDoc.ai_metadata && (
                            <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-accent font-bold flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                        AI Analysis
                                    </h4>
                                    <span className="px-2 py-1 rounded bg-accent/20 text-accent text-xs font-bold uppercase tracking-wider">
                                        {selectedDoc.ai_metadata.document_type || "Unknown Type"}
                                    </span>
                                </div>
                                
                                <div>
                                    <p className="text-xs text-muted uppercase tracking-wider mb-1">Summary</p>
                                    <p className="text-sm text-gray-300 italic">"{selectedDoc.ai_metadata.summary}"</p>
                                </div>

                                {(selectedDoc.ai_metadata.tags?.length > 0 || selectedDoc.ai_metadata.entities?.length > 0) && (
                                    <div className="flex flex-wrap gap-4">
                                        {selectedDoc.ai_metadata.tags?.length > 0 && (
                                            <div>
                                                <p className="text-xs text-muted uppercase tracking-wider mb-2">Tags</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedDoc.ai_metadata.tags.map((tag: string, i: number) => (
                                                        <span key={i} className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs">
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {selectedDoc.ai_metadata.entities?.length > 0 && (
                                            <div>
                                                <p className="text-xs text-muted uppercase tracking-wider mb-2">Extracted Entities</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedDoc.ai_metadata.entities.map((entity: string, i: number) => (
                                                        <span key={i} className="px-2 py-1 rounded bg-white/10 text-gray-300 text-xs border border-white/10">
                                                            {entity}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* OCR Content */}
                         <div>
                            <p className="text-sm text-muted mb-2 flex items-center justify-between">
                                <span>Extracted Text (OCR)</span>
                                <span className="text-xs bg-white/10 px-2 py-0.5 rounded">Raw Content</span>
                            </p>
                            <div className="p-4 rounded-xl bg-black/40 border border-white/10 text-sm text-gray-400 whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto">
                                {selectedDoc.ocr_content || "No OCR content available yet. Processing..."}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Cabinet Selection Modal */}
      {showCabinetModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-4">
                    {selectedDoc?.cabinet_id ? "Move to Cabinet" : "Add to Cabinet"}
                </h3>
                <p className="text-muted mb-4">
                    Select a cabinet for "{selectedDoc?.title}"
                </p>
                
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Cabinet</label>
                    <select
                        value={selectedCabinetId}
                        onChange={(e) => setSelectedCabinetId(e.target.value)}
                        className="w-full bg-surface/50 border border-white/10 rounded-xl py-2 px-4 text-white focus:outline-none focus:border-accent"
                    >
                        <option value="">-- Select Cabinet --</option>
                        {cabinets.map((cab: any) => (
                            <option key={cab.id} value={cab.id}>
                                {'\u00A0\u00A0'.repeat(cab.level)}{cab.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex justify-end gap-2">
                    <button 
                        onClick={() => {
                            setShowCabinetModal(false);
                            setSelectedDoc(null);
                        }}
                        className="px-4 py-2 rounded-lg hover:bg-white/5 text-gray-300"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmCabinetAction}
                        disabled={!selectedCabinetId}
                        className="px-4 py-2 rounded-lg bg-accent text-primary font-bold hover:bg-accent/90 disabled:opacity-50"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
