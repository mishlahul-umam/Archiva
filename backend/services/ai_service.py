import json
import re
import os
import math
from collections import Counter

# --- Local AI Implementation (Dependency-Free) ---

class LocalAI:
    def __init__(self):
        self.stopwords = {
            "the", "is", "at", "which", "on", "and", "a", "an", "in", "to", "of", "for", "it", "with", "as", "by", 
            "that", "this", "from", "be", "or", "are", "was", "were", "but", "not", "have", "has", "had", "can", 
            "could", "would", "should", "will", "may", "might", "must", "do", "does", "did", "i", "you", "he", 
            "she", "we", "they", "me", "him", "her", "us", "them", "my", "your", "his", "its", "our", "their",
            "yang", "di", "dan", "itu", "dengan", "untuk", "tidak", "ini", "dari", "dalam", "akan", "pada", "juga",
            "saya", "anda", "dia", "mereka", "kita", "kami", "bisa", "ada", "adalah", "yaitu", "ke", "karena"
        }
        
        self.doc_types = {
            "Invoice": ["invoice", "bill to", "due date", "amount due", "payment", "subtotal", "tax", "faktur", "tagihan"],
            "Contract": ["agreement", "contract", "between", "parties", "witnesseth", "signed", "perjanjian", "kontrak", "pihak"],
            "Resume": ["resume", "curriculum vitae", "experience", "education", "skills", "summary", "profile", "pengalaman", "pendidikan"],
            "Report": ["report", "summary", "conclusion", "analysis", "introduction", "results", "laporan", "analisis", "kesimpulan"],
            "Letter": ["dear", "sincerely", "regards", "letter", "memo", "kepada", "hormat", "salam"]
        }

    def clean_text(self, text):
        return re.sub(r'[^\w\s]', '', text.lower())

    def get_sentences(self, text):
        # Simple sentence splitter
        return re.split(r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?)\s', text)

    def summarize(self, text, num_sentences=3):
        sentences = self.get_sentences(text)
        if len(sentences) <= num_sentences:
            return text
            
        # Word frequency map
        words = self.clean_text(text).split()
        word_freq = Counter([w for w in words if w not in self.stopwords])
        
        max_freq = max(word_freq.values()) if word_freq else 1
        for w in word_freq:
            word_freq[w] /= max_freq
            
        # Score sentences
        sent_scores = {}
        for sent in sentences:
            for word in self.clean_text(sent).split():
                if word in word_freq:
                    if sent not in sent_scores:
                        sent_scores[sent] = 0
                    sent_scores[sent] += word_freq[word]
        
        # Get top sentences
        summary_sentences = sorted(sent_scores, key=sent_scores.get, reverse=True)[:num_sentences]
        # Sort back by appearance order
        summary_sentences.sort(key=lambda x: sentences.index(x))
        
        return " ".join(summary_sentences)

    def classify(self, text):
        text_lower = text.lower()
        scores = {dtype: 0 for dtype in self.doc_types}
        
        for dtype, keywords in self.doc_types.items():
            for keyword in keywords:
                if keyword in text_lower:
                    scores[dtype] += 1
                    
        # Get max score
        best_type = max(scores, key=scores.get)
        return best_type if scores[best_type] > 0 else "Unknown"

    def extract_entities(self, text):
        entities = []
        
        # 1. Emails
        emails = re.findall(r'[\w.+-]+@[\w-]+\.[\w.-]+', text)
        entities.extend(emails)
        
        # 2. Dates (YYYY-MM-DD, DD/MM/YYYY, etc)
        dates = re.findall(r'\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}/\d{1,2}/\d{2,4}\b', text)
        entities.extend(dates)
        
        # 3. Money / Amounts
        money = re.findall(r'[\$€£Rp]\s?[\d,.]+', text)
        entities.extend(money[:3])
        
        # 4. Potential Names (Capitalized Words) - Heuristic
        # Look for 2-3 capitalized words in a row that aren't at start of sentence
        names = re.findall(r'(?<!^)(?<!\.\s)\b[A-Z][a-z]+\s[A-Z][a-z]+\b', text)
        # Filter out common false positives if needed
        entities.extend(names[:5])
        
        return list(set(entities)) # Unique

    def generate_tags(self, text):
        # TF-IDF style keyword extraction (simplified)
        words = self.clean_text(text).split()
        word_freq = Counter([w for w in words if w not in self.stopwords and len(w) > 3])
        return [pair[0] for pair in word_freq.most_common(5)]

# Initialize global instance
local_ai = LocalAI()

async def extract_metadata(text: str) -> dict:
    """
    Extract metadata using purely local Python logic (No external API).
    """
    if not text:
        return {
            "document_type": "Unknown",
            "tags": [],
            "entities": [],
            "summary": ""
        }
        
    # Run analysis
    doc_type = local_ai.classify(text)
    summary = local_ai.summarize(text)
    entities = local_ai.extract_entities(text)
    tags = local_ai.generate_tags(text)
    
    # Add document type specific tags
    if doc_type != "Unknown":
        tags.insert(0, doc_type.lower())

    return {
        "document_type": doc_type,
        "summary": summary,
        "tags": tags,
        "entities": entities
    }

