import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Trash2, Edit2, FileText, Download, Eye, MoreVertical, X } from 'lucide-react';
import { format } from 'date-fns';
import { DocumentActions } from '../components/DocumentActions';

interface Cabinet {
    id: number;
    name: string;
    parent_id: number | null;
    children: Cabinet[];
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

// --- Recursive Tree Component (Moved Outside) ---
// Moved outside to prevent re-creation on render
const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

interface CabinetNodeProps {
    cabinet: Cabinet;
    level?: number;
    selectedCabinetId: number | null;
    onSelect: (id: number) => void;
    onAdd: (id: number) => void;
    onEdit: (id: number, name: string) => void;
    onDelete: (id: number) => void;
}

const CabinetNode = ({ cabinet, level = 0, selectedCabinetId, onSelect, onAdd, onEdit, onDelete }: CabinetNodeProps) => {
    const [expanded, setExpanded] = useState(false);
    const isSelected = selectedCabinetId === cabinet.id;

    return (
        <div className="select-none">
            <div 
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-accent/20 text-accent' : 'hover:bg-white/5 text-gray-300'
                }`}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={() => {
                    onSelect(cabinet.id);
                    if (cabinet.children.length > 0) setExpanded(true);
                }}
            >
                <div 
                    onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                    className={`p-0.5 rounded-md hover:bg-white/10 ${cabinet.children.length === 0 ? 'invisible' : ''}`}
                >
                    {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </div>
                
                {expanded || isSelected ? <FolderOpen className="w-4 h-4 text-yellow-500" /> : <Folder className="w-4 h-4 text-yellow-500" />}
                
                <span className="flex-1 truncate text-sm">{cabinet.name}</span>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onAdd(cabinet.id);
                        }}
                        className="p-1 hover:text-accent"
                        title="Add Sub-cabinet"
                    >
                        <Plus className="w-3 h-3" />
                    </button>
                    <button 
                         onClick={(e) => {
                            e.stopPropagation();
                            onEdit(cabinet.id, cabinet.name);
                        }}
                        className="p-1 hover:text-blue-400"
                        title="Rename"
                    >
                        <Edit2 className="w-3 h-3" />
                    </button>
                     <button 
                         onClick={(e) => {
                            e.stopPropagation();
                            onDelete(cabinet.id);
                        }}
                        className="p-1 hover:text-red-400"
                        title="Delete"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
            </div>
            
            {expanded && cabinet.children.map(child => (
                <CabinetNode 
                    key={child.id} 
                    cabinet={child} 
                    level={level + 1}
                    selectedCabinetId={selectedCabinetId}
                    onSelect={onSelect}
                    onAdd={onAdd}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
};

export function Cabinets() {
    const { token, user } = useAuth();
    const [searchParams] = useSearchParams();
    const [cabinets, setCabinets] = useState<Cabinet[]>([]);
    const [selectedCabinetId, setSelectedCabinetId] = useState<number | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Create/Edit Modal
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [cabinetName, setCabinetName] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [parentId, setParentId] = useState<number | null>(null); // For creating child

    // Document Preview State (reused from Search/Documents)
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null); // For OCR
    
    // Move Cabinet Modal
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [allCabinets, setAllCabinets] = useState<any[]>([]);
    const [targetCabinetId, setTargetCabinetId] = useState<string>("");
    const [movingDoc, setMovingDoc] = useState<Document | null>(null);

    useEffect(() => {
        fetchCabinets();
    }, [token]);

    // Handle initial selection from URL
    useEffect(() => {
        const idParam = searchParams.get('id');
        if (idParam) {
            const id = parseInt(idParam);
            if (!isNaN(id)) {
                setSelectedCabinetId(id);
                // Optionally expand tree to show this cabinet? 
                // That would require more complex state management in CabinetNode
            }
        }
    }, [searchParams]);

    useEffect(() => {
        if (selectedCabinetId) {
            fetchDocuments(selectedCabinetId);
        } else {
            setDocuments([]);
        }
    }, [selectedCabinetId, token]);

    const fetchCabinets = async () => {
        try {
            const res = await axios.get('http://localhost:8000/cabinets/', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCabinets(res.data);
            
             // Flatten for dropdown
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
            setAllCabinets(flatten(res.data));

        } catch (err) {
            console.error("Failed to fetch cabinets", err);
        }
    };

    const fetchDocuments = async (id: number) => {
        setLoading(true);
        try {
            const res = await axios.get(`http://localhost:8000/cabinets/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDocuments(res.data.documents);
        } catch (err) {
            console.error("Failed to fetch documents", err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        try {
            console.log("Creating cabinet with:", { name: cabinetName, parent_id: parentId });
            await axios.post('http://localhost:8000/cabinets/', {
                name: cabinetName,
                parent_id: parentId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowModal(false);
            setCabinetName('');
            setParentId(null);
            fetchCabinets();
        } catch (err: any) {
            console.error("Failed to create cabinet", err);
            alert(err.response?.data?.detail || "Failed to create cabinet");
        }
    };

    const handleUpdate = async () => {
        if (!editingId) return;
        try {
            await axios.put(`http://localhost:8000/cabinets/${editingId}`, {
                name: cabinetName
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowModal(false);
            setCabinetName('');
            setEditingId(null);
            fetchCabinets();
        } catch (err: any) {
            console.error("Failed to update cabinet", err);
            alert(err.response?.data?.detail || "Failed to update cabinet");
        }
    };

    const handleDeleteCabinet = async (id: number) => {
        if (!window.confirm("Are you sure? This will fail if the cabinet has sub-cabinets.")) return;
        try {
            await axios.delete(`http://localhost:8000/cabinets/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (selectedCabinetId === id) setSelectedCabinetId(null);
            fetchCabinets();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to delete cabinet");
        }
    };

    const handleDeleteDocument = async (docId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("Permanently delete this document?")) return;
        try {
             await axios.delete(`http://localhost:8000/documents/${docId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (selectedCabinetId) fetchDocuments(selectedCabinetId);
        } catch (err) {
            console.error("Failed to delete document", err);
            alert("Failed to delete document");
        }
    };
    
    // --- Document Action Handlers (Reused) ---
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

    const handleMoveCabinet = (e: React.MouseEvent, doc: Document) => {
        e.stopPropagation();
        setMovingDoc(doc);
        setTargetCabinetId(doc.cabinet_id ? doc.cabinet_id.toString() : "");
        setShowMoveModal(true);
    }

    const confirmMoveAction = async () => {
        if (!movingDoc || !targetCabinetId) return;
        try {
            // Add to new cabinet (API will handle moving if already in one)
            await axios.post(`http://localhost:8000/cabinets/${targetCabinetId}/documents/${movingDoc.id}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Document moved successfully");
            setShowMoveModal(false);
            setMovingDoc(null);
            if (selectedCabinetId) fetchDocuments(selectedCabinetId);
        } catch (err) {
            console.error("Failed to move document", err);
            alert("Failed to move document");
        }
    }

    const canDelete = (doc: Document) => {
      if (!user || !user.role) return false;
      const role = String(user.role).toLowerCase();
      if (['superadmin', 'admin'].includes(role)) return true;
      if (role === 'document_manager' && user.id === doc.owner_id) return true;
      return false;
    };

    return (
        <div className="flex h-[calc(100vh-2rem)] gap-6 relative">
            {/* Left Sidebar: Cabinet Tree */}
            <div className="w-1/3 bg-surface/30 border border-white/10 rounded-2xl flex flex-col overflow-hidden">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-surface/50">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Folder className="w-5 h-5 text-accent" />
                        Cabinets
                    </h3>
                    <button 
                        onClick={() => {
                            setModalMode('create');
                            setParentId(null);
                            setCabinetName('');
                            setShowModal(true);
                        }}
                        className="p-2 rounded-lg bg-accent text-primary hover:bg-accent/90 transition-colors"
                        title="New Root Cabinet"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5 group">
                    {cabinets.map(cabinet => (
                        <CabinetNode 
                            key={cabinet.id} 
                            cabinet={cabinet} 
                            selectedCabinetId={selectedCabinetId}
                            onSelect={(id) => setSelectedCabinetId(id)}
                            onAdd={(id) => {
                                setModalMode('create');
                                setParentId(id);
                                setCabinetName('');
                                setShowModal(true);
                            }}
                            onEdit={(id, name) => {
                                setModalMode('edit');
                                setEditingId(id);
                                setCabinetName(name);
                                setShowModal(true);
                            }}
                            onDelete={(id) => handleDeleteCabinet(id)}
                        />
                    ))}
                    {cabinets.length === 0 && (
                        <div className="text-center p-8 text-muted text-sm">
                            No cabinets yet. Create one!
                        </div>
                    )}
                </div>
            </div>

            {/* Right Main: Document List */}
            <div className="flex-1 bg-surface/30 border border-white/10 rounded-2xl flex flex-col overflow-hidden">
                <div className="p-4 border-b border-white/10 bg-surface/50">
                     <h3 className="font-bold text-white">
                        {selectedCabinetId 
                            ? `Documents in "Cabinet ${selectedCabinetId}"` // Could look up name map
                            : "Select a cabinet to view documents"}
                    </h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                         <div className="text-center p-8 text-muted">Loading...</div>
                    ) : documents.length === 0 ? (
                        <div className="text-center p-8 text-muted">
                            {selectedCabinetId ? "No documents in this cabinet." : "Select a cabinet from the left."}
                        </div>
                    ) : (
                        <div className="space-y-2">
                             {documents.map((doc) => (
                                  <div 
                                    key={doc.id} 
                                    className="flex items-center justify-between p-3 rounded-xl bg-surface/50 border border-white/5 hover:border-accent/30 transition-all group"
                                  >
                                      <div className="flex items-center gap-3 overflow-hidden">
                                          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                                              <FileText className="w-5 h-5" />
                                          </div>
                                          <div className="min-w-0">
                                              <h4 className="font-medium text-white truncate">{doc.title}</h4>
                                              <p className="text-xs text-muted flex items-center gap-2">
                                                  <span>{formatSize(doc.file_size)}</span>
                                                  <span>•</span>
                                                  <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                                              </p>
                                          </div>
                                      </div>
                                      
                                      <div className="flex items-center gap-2 shrink-0">
                                           <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                <DocumentActions 
                                                      doc={doc}
                                                      onViewOcr={handleViewOcr}
                                                      onDownload={handleDownload}
                                                      onDelete={(e, d) => handleDeleteDocument(d.id, e)}
                                                      canDelete={canDelete(doc)}
                                                      onAddToCabinet={handleMoveCabinet} // Reusing "AddToCabinet" prop for "Move Cabinet" label logic in component if needed, or we just pass the handler.
                                                      // Wait, DocumentActions component needs to be smart enough to show "Move" vs "Add".
                                                      // Or we just pass the same handler and let the modal handle it?
                                                      // The user requested "Move Cabinet" specifically.
                                                      // Let's check DocumentActions component later. 
                                                      // Actually I can pass a prop `onMoveCabinet` if I modify DocumentActions.
                                                      // But I can overload `onAddToCabinet` for now since logic is similar (open modal).
                                                  />
                                           </div>
                                      </div>
                                  </div>
                             ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">
                            {modalMode === 'create' ? 'New Cabinet' : 'Rename Cabinet'}
                        </h3>
                        <input
                            type="text"
                            value={cabinetName}
                            onChange={(e) => setCabinetName(e.target.value)}
                            placeholder="Cabinet Name"
                            className="w-full bg-surface/50 border border-white/10 rounded-xl py-2 px-4 text-white mb-4 focus:outline-none focus:border-accent"
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button 
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 rounded-lg hover:bg-white/5 text-gray-300"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={modalMode === 'create' ? handleCreate : handleUpdate}
                                disabled={!cabinetName.trim()}
                                className="px-4 py-2 rounded-lg bg-accent text-primary font-bold hover:bg-accent/90 disabled:opacity-50"
                            >
                                {modalMode === 'create' ? 'Create' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Move Cabinet Modal */}
             {showMoveModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">
                            Move Document to Cabinet
                        </h3>
                        <p className="text-muted mb-4">
                            Select a new cabinet for "{movingDoc?.title}"
                        </p>
                        
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-400 mb-2">Cabinet</label>
                            <select
                                value={targetCabinetId}
                                onChange={(e) => setTargetCabinetId(e.target.value)}
                                className="w-full bg-surface/50 border border-white/10 rounded-xl py-2 px-4 text-white focus:outline-none focus:border-accent"
                            >
                                <option value="">-- Select Cabinet --</option>
                                {allCabinets.map((cab: any) => (
                                    <option key={cab.id} value={cab.id} disabled={cab.id === selectedCabinetId}>
                                        {'\u00A0\u00A0'.repeat(cab.level)}{cab.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button 
                                onClick={() => {
                                    setShowMoveModal(false);
                                    setMovingDoc(null);
                                }}
                                className="px-4 py-2 rounded-lg hover:bg-white/5 text-gray-300"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmMoveAction}
                                disabled={!targetCabinetId}
                                className="px-4 py-2 rounded-lg bg-accent text-primary font-bold hover:bg-accent/90 disabled:opacity-50"
                            >
                                Move
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* OCR Modal */}
            {selectedDoc && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedDoc(null)}>
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-white/10">
                            <h3 className="text-xl font-bold text-white">OCR Content</h3>
                            <button onClick={() => setSelectedDoc(null)} className="text-muted hover:text-white text-sm font-medium">
                                Close
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
        </div>
    );
}
