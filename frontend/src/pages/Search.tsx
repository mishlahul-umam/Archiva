import React, { useState } from 'react';
import { Search as SearchIcon, Filter, FileText, Loader2, Download, Eye, Calendar, User as UserIcon, X, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { DocumentActions } from '../components/DocumentActions';
import { useNavigate } from 'react-router-dom';

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

export function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { token, user } = useAuth();
  const navigate = useNavigate();
  
  // File Preview Modal State
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileType, setPreviewFileType] = useState<string>('');
  const [previewTitle, setPreviewTitle] = useState<string>('');
  
  // Cabinet Modal
  const [showCabinetModal, setShowCabinetModal] = useState(false);
  const [cabinets, setCabinets] = useState<any[]>([]);
  const [selectedCabinetId, setSelectedCabinetId] = useState<string>("");

  const closePreviewModal = () => {
      setShowPreviewModal(false);
      if (previewUrl) {
          window.URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
      }
      setPreviewFileType('');
      setPreviewTitle('');
  };

  const handleSearch = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!query.trim()) {
          setResults([]);
          setHasSearched(false);
          return;
      }

      setLoading(true);
      setHasSearched(true);
      try {
          const res = await axios.get('http://localhost:8000/documents', {
              params: { search: query },
              headers: { Authorization: `Bearer ${token}` }
          });
          setResults(res.data);
      } catch (err) {
          console.error("Search failed", err);
      } finally {
          setLoading(false);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          handleSearch();
      }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async (e: React.MouseEvent, doc: Document) => {
      e.stopPropagation();
      try {
          const response = await axios.get(`http://localhost:8000/documents/${doc.id}/download`, {
              headers: { Authorization: `Bearer ${token}` },
              responseType: 'blob',
          });
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', doc.filename);
          document.body.appendChild(link);
          link.click();
          link.remove();
      } catch (error) {
          console.error("Download failed", error);
      }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm(`Are you sure you want to delete document?`)) return;
      
      try {
          await axios.delete(`http://localhost:8000/documents/${id}`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          setResults(results.filter(d => d.id !== id));
      } catch (error) {
          console.error("Delete failed", error);
          alert("Failed to delete document");
      }
  };

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

  const canDelete = (doc: Document) => {
      if (!user || !user.role) return false;
      const role = String(user.role).toLowerCase();
      if (['superadmin', 'admin'].includes(role)) return true;
      if (role === 'document_manager' && user.id === doc.owner_id) return true;
      return false;
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
          // Refresh search results to update cabinet status
          handleSearch();
      } catch (err) {
          console.error("Failed to update cabinet", err);
          alert("Failed to update cabinet");
      }
  };

  const handleDocumentClick = async (docId: number, filename: string, title: string) => {
      try {
          const response = await axios.get(`http://localhost:8000/documents/${docId}/download`, {
              headers: { Authorization: `Bearer ${token}` },
              responseType: 'blob',
          });
          
          const contentType = response.headers['content-type'] || response.headers['Content-Type'] || '';
          const blob = new Blob([response.data], { type: contentType });
          const url = window.URL.createObjectURL(blob);
          
          setPreviewUrl(url);
          setPreviewFileType(contentType);
          setPreviewTitle(title);
          setShowPreviewModal(true);
      } catch (error) {
          console.error("Failed to open file", error);
          alert("Failed to open file.");
      }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Search</h2>
          <p className="text-muted">Find documents using metadata or full-text OCR.</p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
            <SearchIcon className="absolute left-4 top-3.5 w-5 h-5 text-muted" />
            <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search by keywords (min 3 chars)..." 
                className="w-full bg-surface/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all"
            />
        </div>
        <button 
            onClick={() => handleSearch()}
            className="px-6 py-3 rounded-xl bg-accent text-primary font-bold hover:bg-accent/90 transition-colors"
        >
            Search
        </button>
      </div>

      <div className="min-h-[300px]">
          {loading ? (
              <div className="flex flex-col items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-accent mb-4" />
                  <p className="text-muted">Searching documents...</p>
              </div>
          ) : hasSearched && results.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 border border-white/5 rounded-2xl bg-surface/30">
                  <SearchIcon className="w-12 h-12 text-muted/20 mb-4" />
                  <p className="text-muted">No results found for "{query}"</p>
              </div>
          ) : !hasSearched ? (
              <div className="flex flex-col items-center justify-center h-64 border border-white/5 rounded-2xl bg-surface/30">
                  <p className="text-muted">Enter a search term to see results.</p>
              </div>
          ) : (
              <div className="space-y-4">
                  <p className="text-sm text-muted">Found {results.length} results</p>
                  <div className="grid gap-4">
                      {results.map((doc) => (
                          <div 
                            key={doc.id} 
                            className="p-4 rounded-xl bg-surface/50 border border-white/5 hover:border-accent/30 transition-all group cursor-pointer"
                            onClick={() => handleDocumentClick(doc.id, doc.filename, doc.title)}
                          >
                              <div className="flex justify-between items-start">
                                  <div className="flex items-start gap-4">
                                      <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
                                          <FileText className="w-6 h-6" />
                                      </div>
                                      <div>
                                          <h3 className="font-bold text-white text-lg group-hover:text-accent transition-colors">
                                              {doc.title}
                                          </h3>
                                          <div className="flex items-center gap-4 text-sm text-muted mt-2">
                                              <span className="flex items-center gap-1.5">
                                                  <Calendar className="w-3.5 h-3.5" />
                                                  {format(new Date(doc.created_at), 'MMM d, yyyy')}
                                              </span>
                                              <span className="w-1 h-1 rounded-full bg-white/20" />
                                              <span>{formatSize(doc.file_size)}</span>
                                              <span className="w-1 h-1 rounded-full bg-white/20" />
                                              <span className="uppercase">{doc.file_type.split('/')[1] || 'FILE'}</span>
                                          </div>
                                      </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                      <span className={`px-2 py-1 rounded-md text-xs font-medium capitalize ${
                                          doc.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                                          doc.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                                          'bg-white/10 text-muted'
                                      }`}>
                                          {doc.status}
                                      </span>
                                      
                                      <div onClick={(e) => e.stopPropagation()}>
                                          <DocumentActions 
                                              doc={doc}
                                              onViewOcr={handleViewOcr}
                                              onDownload={(e, d) => handleDownload(e, d.id, d.filename)}
                                              onDelete={(e, d) => handleDelete(d.id, e)}
                                              canDelete={canDelete(doc)}
                                              onAddToCabinet={handleAddToCabinet}
                                              onViewCabinet={(e, d) => navigate(`/cabinets?id=${d.cabinet_id}`)}
                                          />
                                      </div>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
      </div>

      {/* OCR Modal */}
      {selectedDoc && !showCabinetModal && !showPreviewModal && (
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
                                                    {selectedDoc.ai_metadata.tags.map((tag: any, i: number) => (
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
                                                    {selectedDoc.ai_metadata.entities.map((entity: any, i: number) => (
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
                                {typeof selectedDoc.ocr_content === 'string' ? selectedDoc.ocr_content : JSON.stringify(selectedDoc.ocr_content) || "No OCR content available yet. Processing..."}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* File Preview Modal */}
      {showPreviewModal && previewUrl && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closePreviewModal}>
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
                      {(previewFileType || '').includes('pdf') ? (
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
