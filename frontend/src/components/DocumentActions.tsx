import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Eye, Download, Trash2, Send, Folder, FolderOpen, FolderInput } from 'lucide-react';
import { createPortal } from 'react-dom';

interface Document {
  id: number;
  title: string;
  filename: string;
  status: string;
  owner_id: number;
  cabinet_id?: number;
  [key: string]: any;
}

interface DocumentActionsProps {
  doc: Document;
  onViewOcr: (e: React.MouseEvent, doc: any) => void;
  onDownload: (e: React.MouseEvent, doc: any) => void;
  onDelete?: (e: React.MouseEvent, doc: any) => void;
  canDelete: boolean;
  onSubmitForApproval?: (e: React.MouseEvent, doc: any) => void;
  canSubmit?: boolean;
  onAddToCabinet?: (e: React.MouseEvent, doc: any) => void;
  onViewCabinet?: (e: React.MouseEvent, doc: any) => void;
}

export const DocumentActions: React.FC<DocumentActionsProps> = ({ 
  doc, 
  onViewOcr, 
  onDownload, 
  onDelete, 
  canDelete,
  onSubmitForApproval,
  canSubmit = false,
  onAddToCabinet,
  onViewCabinet
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    if (!isOpen && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setMenuPosition({
            top: rect.bottom + window.scrollY + 5,
            left: rect.right + window.scrollX - 192
        });
    }
    setIsOpen(!isOpen);
  };

  // Close menu when clicking outside or scrolling
  useEffect(() => {
    const handleInteraction = (event: Event) => {
       if (
           buttonRef.current && 
           !buttonRef.current.contains(event.target as Node) &&
           !(event.target as Element).closest('[data-portal-menu="true"]')
       ) {
          setIsOpen(false);
       }
    };

    if (isOpen) {
        document.addEventListener('mousedown', handleInteraction);
        window.addEventListener('scroll', () => setIsOpen(false), true);
        window.addEventListener('resize', () => setIsOpen(false));
    }
    
    return () => {
      document.removeEventListener('mousedown', handleInteraction);
      window.removeEventListener('scroll', () => setIsOpen(false), true);
      window.removeEventListener('resize', () => setIsOpen(false));
    };
  }, [isOpen]);

  const menuContent = (
    <div 
        data-portal-menu="true"
        className="fixed z-[9999] w-48 bg-[#0f172a] border border-white/10 rounded-xl shadow-xl overflow-hidden ring-1 ring-black ring-opacity-5"
        style={{ top: menuPosition.top, left: menuPosition.left }}
        onClick={(e) => e.stopPropagation()}
    >
      <div className="py-1">
         {onSubmitForApproval && canSubmit && doc.status === 'draft' && (
            <button
                onClick={(e) => { 
                    e.stopPropagation();
                    setIsOpen(false); 
                    onSubmitForApproval(e, doc); 
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-accent flex items-center gap-3 transition-colors cursor-pointer"
            >
                <Send className="w-4 h-4" />
                Submit for Approval
            </button>
        )}
        
        <button
          onClick={(e) => { 
              e.stopPropagation(); 
              setIsOpen(false); 
              onViewOcr(e, doc); 
          }}
          className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-3 transition-colors cursor-pointer"
        >
          <Eye className="w-4 h-4" />
          View OCR
        </button>
        
        <button
          onClick={(e) => { 
              e.stopPropagation(); 
              setIsOpen(false); 
              onDownload(e, doc); 
          }}
          className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-3 transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Download
        </button>

        {onAddToCabinet && (
            <button
              onClick={(e) => { 
                  e.stopPropagation(); 
                  setIsOpen(false); 
                  onAddToCabinet(e, doc); 
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-3 transition-colors cursor-pointer"
            >
              {doc.cabinet_id ? <FolderInput className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
              {doc.cabinet_id ? "Move Cabinet" : "Add to Cabinet"}
            </button>
        )}

        {/* Hide "View Cabinet" if we are already in the Cabinets page context (implied by missing onViewCabinet prop or custom logic, but user requested View Cabinet only if file has cabinet) */}
        {doc.cabinet_id && onViewCabinet && (
            <button
              onClick={(e) => { 
                  e.stopPropagation(); 
                  setIsOpen(false); 
                  onViewCabinet(e, doc); 
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-3 transition-colors cursor-pointer"
            >
              <FolderOpen className="w-4 h-4" />
              View Cabinet
            </button>
        )}

        {canDelete && onDelete && (
          <button
            onClick={(e) => { 
                e.stopPropagation(); 
                setIsOpen(false); 
                onDelete(e, doc); 
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-3 transition-colors border-t border-white/5 mt-1 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button 
        ref={buttonRef}
        onClick={toggleMenu}
        className={`p-2 rounded-lg hover:bg-white/10 text-muted hover:text-white transition-colors focus:outline-none ${isOpen ? 'bg-white/10 text-white' : ''}`}
        title="Actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && createPortal(menuContent, document.body)}
    </>
  );
};
