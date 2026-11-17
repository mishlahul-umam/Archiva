import React, { useCallback, useState, useEffect } from 'react';
  import { useDropzone } from 'react-dropzone';
  import { FileText, Upload, Download, Eye, X, Trash2, Send } from 'lucide-react';
  import { format } from 'date-fns';
  import axios from 'axios';
  import { useAuth } from '../context/AuthContext';
  import { DocumentActions } from '../components/DocumentActions';
  import { useNavigate } from 'react-router-dom'; // Import useNavigate

  interface Document {
    id: number;
    title: string;
    filename: string;
    file_type: string;
    file_size: number;
    created_at: string;
    status: string;
    owner_id: number;
    cabinet_id?: number; // Added cabinet_id
    ocr_content?: string;
    page_count?: number; // New field for pages
    ai_metadata?: {
        document_type: string;
        tags: string[];
        entities: string[];
        summary: string;
    };
  }

  export function Documents() {
    const navigate = useNavigate(); // Hook for navigation
    const [documents, setDocuments] = useState<Document[]>([]);
  const [cabinets, setCabinets] = useState<{id: number, name: string}[]>([]); // Cabinets state
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const { token, user } = useAuth();

  // Cabinet Selection Modal State
  const [showCabinetModal, setShowCabinetModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedCabinetId, setSelectedCabinetId] = useState<string>(""); // "" means no cabinet

  // File Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileType, setPreviewFileType] = useState<string>('');
  const [previewTitle, setPreviewTitle] = useState<string>('');

  const fetchDocuments = async () => {
    try {
      const response = await axios.get('http://localhost:8000/documents', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(response.data);
    } catch (error) {
      console.error("Failed to fetch documents", error);
    }
  };

  const fetchCabinets = async () => {
      try {
          // We can use the flatten list or tree. Let's assume we just want a flat list for selection or just root?
          // The current /cabinets/ endpoint returns a tree.
          // Let's assume for now we just show top level or maybe we need a flat list endpoint?
          // Or we can just process the tree to a flat list if needed.
          // For simplicity, let's just fetch the tree and maybe flatten it or just show roots?
          // Actually, let's just fetch and see. If it's a tree, we might need to flatten it for a simple dropdown.
          // But wait, the previous turn implementation of GET /cabinets/ returns a tree.
          // Let's stick to the tree but flatten it for the select options for simplicity.
          
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

  useEffect(() => {
    fetchDocuments();
    fetchCabinets();
  }, [token]);

  const processUpload = async (file: File, cabinetId?: number) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name);

    try {
      // 1. Upload Document
      const res = await axios.post('http://localhost:8000/documents', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const newDocId = res.data.id;

      // 2. Link to Cabinet if selected
      if (cabinetId) {
          await axios.post(`http://localhost:8000/cabinets/${cabinetId}/documents/${newDocId}`, {}, {
              headers: { Authorization: `Bearer ${token}` }
          });
      }

      fetchDocuments();
    } catch (error) {
      console.error("Upload failed", error);
      alert("Upload failed. You may not have permission.");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (cabinets.length > 0) {
        setPendingFile(file);
        setSelectedCabinetId(""); // Reset selection
        setShowCabinetModal(true);
    } else {
        // Direct upload if no cabinets exist
        processUpload(file);
    }
  }, [token, cabinets]);

  const confirmUploadWithCabinet = async () => {
      // 1. Upload new file
      if (pendingFile) {
          const cabId = selectedCabinetId ? parseInt(selectedCabinetId) : undefined;
          await processUpload(pendingFile, cabId);
          setShowCabinetModal(false);
          setPendingFile(null);
      } 
      // 2. Add existing doc to cabinet
      else if (selectedDoc) {
          if (!selectedCabinetId) {
             // If no cabinet selected for existing doc, just do nothing or maybe allow "move to root"?
             // For now, let's assume this action is "Add to Cabinet" so we need a cabinet.
             // But if "No Cabinet" is selected, we might want to just close or maybe "Remove from Cabinet" (future)
             // Let's just return if no cabinet selected
             setShowCabinetModal(false);
             setSelectedDoc(null);
             return;
          }

          try {
              const cabId = parseInt(selectedCabinetId);
              await axios.post(`http://localhost:8000/cabinets/${cabId}/documents/${selectedDoc.id}`, {}, {
                  headers: { Authorization: `Bearer ${token}` }
              });
              alert("Document added to cabinet successfully");
              setShowCabinetModal(false);
              setSelectedDoc(null);
          } catch(err: any) {
              console.error("Failed to add to cabinet", err);
              alert(err.response?.data?.detail || "Failed to add to cabinet");
          }
      }
  };


  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this document?")) return;

    try {
      await axios.delete(`http://localhost:8000/documents/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDocuments(); // Refresh list
    } catch (error) {
      console.error("Failed to delete document", error);
      alert("Failed to delete document. You may not have permission.");
    }
  };

  const handleSubmitForApproval = async (id: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm("Submit this document for approval?")) return;
      
      try {
          await axios.post(`http://localhost:8000/workflow/${id}/submit`, {}, {
              headers: { Authorization: `Bearer ${token}` }
          });
          fetchDocuments();
          alert("Document submitted for approval");
      } catch (err: any) {
          console.error("Failed to submit", err);
          alert(err.response?.data?.detail || "Failed to submit document");
      }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
      onDrop,
      disabled: user?.role === 'Viewer' || user?.role === 'Reviewer'
  });

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
          console.error("Failed to download file", error);
          alert("Failed to download file.");
      }
  };

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

  const canUpload = user?.role === 'SuperAdmin' || user?.role === 'Admin' || user?.role === 'DocumentManager';
  const canDelete = (doc: Document) => {
      if (user?.role === 'SuperAdmin' || user?.role === 'Admin') return true;
      if (user?.role === 'DocumentManager' && doc.owner_id === user.id) return true;
      return false;
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Documents</h2>
          <p className="text-muted">Manage and organize your files.</p>
        </div>
        <div className="flex gap-4">
           {/* Placeholder for future features */}
        </div>
      </div>

      {/* Upload Area */}
      {canUpload && (
          <div 
            {...getRootProps()} 
            className={`p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
              isDragActive 
                ? 'border-accent bg-accent/10' 
                : 'border-white/10 bg-surface/50 hover:border-white/20'
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mb-4">
                <Upload className="w-6 h-6 text-accent" />
              </div>
              <p className="text-lg font-medium text-white mb-1">
                {isDragActive ? "Drop the files here..." : "Drag & drop files here, or click to select"}
              </p>
              <p className="text-sm text-muted">Supports PDF, DOCX, XLSX, Images</p>
              {uploading && <p className="text-accent mt-2">Uploading...</p>}
            </div>
          </div>
      )}

      {/* Documents List */}
      <div className="rounded-2xl bg-surface/50 backdrop-blur-sm border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">Size</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted">
                    No documents found. Upload one to get started.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr 
                    key={doc.id} 
                    className="hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => handleDocumentClick(doc.id, doc.filename, doc.title)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{doc.title}</p>
                          <p className="text-xs text-muted">{doc.filename}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {formatSize(doc.file_size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {doc.file_type.split('/')[1] || 'unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {format(new Date(doc.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium capitalize ${
                          doc.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                          doc.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                          doc.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-white/10 text-muted'
                      }`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                        <DocumentActions 
                            doc={doc}
                            onViewOcr={handleViewOcr}
                            onDownload={(e, d) => handleDownload(e, d.id, d.filename)}
                            onDelete={(e, d) => handleDelete(d.id, e)}
                            canDelete={canDelete(doc)}
                            onSubmitForApproval={(e, d) => handleSubmitForApproval(d.id, e)}
                            canSubmit={canUpload}
                            onAddToCabinet={cabinets.length > 0 ? (e, d) => {
                                e.stopPropagation();
                                setSelectedDoc(d);
                                setSelectedCabinetId(d.cabinet_id ? d.cabinet_id.toString() : "");
                                setShowCabinetModal(true);
                            } : undefined}
                            onViewCabinet={(e, d) => {
                                e.stopPropagation();
                                if (d.cabinet_id) {
                                    // Navigate to cabinets page with query param or state
                                    // Assuming Cabinets page can read query param id
                                    // For now, let's pass state or just use query param
                                    navigate(`/cabinets?id=${d.cabinet_id}`);
                                }
                            }}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OCR Modal */}
      {selectedDoc && (
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
                                                    {selectedDoc.ai_metadata.tags.map((tag, i) => (
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
                                                    {selectedDoc.ai_metadata.entities.map((entity, i) => (
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

      {/* File Preview Modal */}
      {showPreviewModal && previewUrl && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closePreviewModal}>
              <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-5xl h-[85vh] shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2 truncate max-w-xl">
                          <FileText className="w-5 h-5 text-accent" />
                          {previewTitle}
                      </h3>
                      <button onClick={closePreviewModal} className="text-muted hover:text-white transition-colors text-sm font-medium">
                          Close
                      </button>
                  </div>
                  <div className="flex-1 bg-black/20 relative overflow-hidden">
                      {(previewFileType || '').includes('pdf') ? (
                          <iframe 
                              src={previewUrl} 
                              className="w-full h-full border-0"
                              title="PDF Preview"
                          />
                      ) : (previewFileType || '').includes('image') ? (
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-4">
                    {pendingFile 
                        ? "Select Cabinet for Upload" 
                        : (selectedDoc?.cabinet_id ? "Move to Cabinet" : "Add to Cabinet")
                    }
                </h3>
                <p className="text-muted mb-4">
                    {pendingFile 
                        ? "Choose a cabinet to organize this document, or skip to keep it unorganized."
                        : (selectedDoc?.cabinet_id 
                            ? "Choose a new cabinet for this document."
                            : "Choose a cabinet to add this document to."
                          )
                    }
                </p>
                
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Cabinet</label>
                    <select
                        value={selectedCabinetId}
                        onChange={(e) => setSelectedCabinetId(e.target.value)}
                        className="w-full bg-surface/50 border border-white/10 rounded-xl py-2 px-4 text-white focus:outline-none focus:border-accent"
                    >
                        <option value="">-- No Cabinet --</option>
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
                            setPendingFile(null);
                            if (!pendingFile) setSelectedDoc(null);
                        }}
                        className="px-4 py-2 rounded-lg hover:bg-white/5 text-gray-300"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmUploadWithCabinet}
                        disabled={!pendingFile && !selectedCabinetId}
                        className="px-4 py-2 rounded-lg bg-accent text-primary font-bold hover:bg-accent/90 disabled:opacity-50"
                    >
                        {pendingFile ? "Upload" : (selectedDoc?.cabinet_id ? "Move" : "Add")}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
