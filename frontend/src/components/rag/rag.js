import React, { useState, useRef, useEffect, useCallback } from 'react';
import './rag.css';
import { rag as ragAPI } from '../../api';

const SUPPORTED_TYPES = ['.pdf', '.txt', '.md', '.csv', '.docx'];
const MAX_FILE_MB = 10;

function FiletypeIcon({ ext }) {
  const colors = { pdf: '#FF6B6B', txt: '#74C0FC', md: '#00FF66', csv: '#FFD166', docx: '#0984E3' };
  const labels = { pdf: 'PDF', txt: 'TXT', md: 'MD', csv: 'CSV', docx: 'DOC' };
  const c = colors[ext] || '#888';
  return (
    <div className="rag__file-icon" style={{ background: c + '18', color: c }}>
      {labels[ext] || ext.toUpperCase()}
    </div>
  );
}

function StatusBadge({ ready }) {
  return (
    <span className={`rag__status-badge ${ready ? 'rag__status-badge--ready' : 'rag__status-badge--not-ready'}`}>
      {ready ? '✓ READY' : '✗ NOT READY'}
    </span>
  );
}

// ✅ 개발자용 에러 로그를 사용자 친화적인 영어 메시지로 변환하는 헬퍼 함수
function getFriendlyErrorMessage(rawMsg) {
  if (!rawMsg) return "Oops! Something went wrong on our end. Please try again.";
  const msg = rawMsg.toLowerCase();

  // 1. 네트워크 문제
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to connect') || msg.includes('offline')) {
    return "We're having trouble connecting to the server. Please check your internet connection.";
  }
  // 2. 시간 초과
  if (msg.includes('timeout') || msg.includes('time out')) {
    return "The request took too long. If you're uploading a large file, try a smaller one or try again later.";
  }
  // 3. 로컬 엔진(Ollama) 연결 실패
  if (msg.includes('ollama') || msg.includes('connection refused') || msg.includes('not running')) {
    return "Our document processing engine appears to be offline. If you're hosting locally, please ensure Ollama is running.";
  }
  // 4. 인증 오류
  if (msg.includes('unauthorized') || msg.includes('token') || msg.includes('login')) {
    return "Your session might have expired. Please log in again.";
  }

  // 알 수 없는 기타 에러는 콘솔에만 남김
  console.error("[Dev Log] RAG Error:", rawMsg);
  return "Oops! An unexpected error occurred. Please try again later.";
}

export default function RAG({ user, navigate, enabledTools }) {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [embedStatus, setEmbedStatus] = useState(null);
  const [queryInput, setQueryInput] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [querying, setQuerying] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const userId = user?.id || user?.email || 'guest';

  // ── Load docs and embed status ────────────────────────────────────
  useEffect(() => {
    loadDocuments();
    checkStatus();
  }, [userId]);

  const loadDocuments = async () => {
    try {
      const res = await ragAPI.list(userId);
      setDocuments(res.documents || []);
    } catch { /* Offline or background error, fail silently */ }
  };

  const checkStatus = async () => {
    try {
      const s = await ragAPI.status();
      setEmbedStatus(s);
    } catch { setEmbedStatus({ embed_ready: false }); }
  };

  // ── File upload ───────────────────────────────────────────────────
  const uploadFile = async (file) => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!SUPPORTED_TYPES.includes(ext)) {
      setError(`We don't support ${ext} files yet. Please use: ${SUPPORTED_TYPES.join(', ')}.`);
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`This file is a bit too large. Please keep it under ${MAX_FILE_MB} MB.`);
      return;
    }
    if (!user) { 
      setError('Please log in to upload documents to your knowledge base.'); 
      return; 
    }

    setUploading(true); setError('');
    setUploadProgress(`Preparing to upload "${file.name}"...`);

    try {
      setUploadProgress(`Analyzing and organizing "${file.name}"... This might take a minute.`);
      const result = await ragAPI.upload(file, userId);
      setUploadProgress(`✓ Success! Processed ${result.chunks} pieces of information from "${file.name}".`);
      await loadDocuments();
      setTimeout(() => setUploadProgress(''), 3000);
    } catch (err) {
      setError(getFriendlyErrorMessage(err.message));
      setUploadProgress('');
    } finally { setUploading(false); }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(uploadFile);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  };

  const deleteDoc = async (docId) => {
    if (!window.confirm('Are you sure you want to remove this document from your knowledge base?')) return;
    try {
      await ragAPI.delete(docId, userId);
      setDocuments(prev => prev.filter(d => d.doc_id !== docId));
      setSelectedDocs(prev => { const n = new Set(prev); n.delete(docId); return n; });
    } catch (err) { 
      setError(getFriendlyErrorMessage(err.message)); 
    }
  };

  // ── Query / test retrieval ────────────────────────────────────────
  const runQuery = async () => {
    if (!queryInput.trim()) return;
    setQuerying(true); setError('');
    try {
      const docIds = selectedDocs.size > 0 ? [...selectedDocs] : undefined;
      const result = await ragAPI.query({ query: queryInput.trim(), userId, docIds, topK: 5 });
      setQueryResult(result);
    } catch (err) { 
      setError(getFriendlyErrorMessage(err.message)); 
    } finally { 
      setQuerying(false); 
    }
  };

  const toggleDocSelect = (docId) => {
    setSelectedDocs(prev => { const n = new Set(prev); if (n.has(docId)) n.delete(docId); else n.add(docId); return n; });
  };

  const totalChunks = documents.reduce((sum, d) => sum + (d.chunk_count || 0), 0);

  return (
    <div className="rag">
      {/* Header */}
      <div className="rag__header">
        <div>
          <span className="rag__eyebrow">KNOWLEDGE BASE</span>
          <h1 className="rag__title">RAG DOCUMENTS</h1>
          <p className="rag__subtitle">
            Upload documents to your knowledge base. AI agents will automatically retrieve relevant context during chat sessions.
          </p>
        </div>
        <div className="rag__header-stats">
          <div className="rag__stat"><span>{documents.length}</span><span>DOCUMENTS</span></div>
          <div className="rag__stat-div" />
          <div className="rag__stat"><span>{totalChunks}</span><span>CHUNKS</span></div>
          <div className="rag__stat-div" />
          <div className="rag__stat" style={{ cursor: 'pointer' }} onClick={checkStatus}>
            <StatusBadge ready={embedStatus?.embed_ready} />
            <span>EMBED MODEL</span>
          </div>
        </div>
      </div>

      {/* Embed status warning */}
      {embedStatus && !embedStatus.embed_ready && (
        <div className="rag__warning">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="M7 4v4M7 9.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          <span>
            <strong>Document processing is currently offline.</strong> If you are hosting locally, please ensure Ollama is running: <code>ollama pull {embedStatus.embed_model || 'nomic-embed-text'}</code>
          </span>
        </div>
      )}

      {error && <div className="rag__error" onClick={() => setError('')}>{error} <span>✕</span></div>}

      <div className="rag__layout">
        {/* ── Left: Upload + Documents ── */}
        <div className="rag__left">
          {/* Drop zone */}
          <div
            className={`rag__dropzone ${dragOver ? 'rag__dropzone--active' : ''} ${uploading ? 'rag__dropzone--uploading' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" multiple accept={SUPPORTED_TYPES.join(',')} onChange={handleFileSelect} style={{ display: 'none' }} />
            {uploading ? (
              <div className="rag__upload-progress">
                <div className="rag__upload-spinner" />
                <p>{uploadProgress}</p>
              </div>
            ) : (
              <>
                <div className="rag__dropzone-icon">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 4v16M6 12l8-8 8 8M4 22h20" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <p className="rag__dropzone-title">DROP FILES HERE OR CLICK TO UPLOAD</p>
                <p className="rag__dropzone-hint">Supports: {SUPPORTED_TYPES.join(', ')} · Max {MAX_FILE_MB} MB each</p>
              </>
            )}
          </div>

          {/* Document list */}
          <div className="rag__doc-list-header">
            <span className="rag__doc-list-title">UPLOADED DOCUMENTS</span>
            <span className="rag__doc-list-hint">Click to select for query filtering</span>
          </div>

          {documents.length === 0 ? (
            <div className="rag__doc-empty">
              <p>No documents uploaded yet.</p>
              <span>Upload a file above to get started.</span>
            </div>
          ) : (
            <div className="rag__doc-list">
              {documents.map(doc => {
                const ext = doc.filename.split('.').pop().toLowerCase();
                const isSelected = selectedDocs.has(doc.doc_id);
                return (
                  <div key={doc.doc_id}
                    className={`rag__doc-item ${isSelected ? 'rag__doc-item--selected' : ''}`}
                    onClick={() => toggleDocSelect(doc.doc_id)}>
                    <FiletypeIcon ext={ext} />
                    <div className="rag__doc-info">
                      <span className="rag__doc-name">{doc.filename}</span>
                      <div className="rag__doc-meta">
                        <span>{doc.chunk_count} chunks</span>
                        <span>·</span>
                        <span>{(doc.size_bytes / 1024).toFixed(1)} KB</span>
                        {doc.created_at && <><span>·</span><span>{new Date(doc.created_at).toLocaleDateString()}</span></>}
                      </div>
                    </div>
                    {isSelected && <span className="rag__doc-selected-badge">SELECTED</span>}
                    <button className="rag__doc-delete" onClick={e => { e.stopPropagation(); deleteDoc(doc.doc_id); }} title="Delete">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M5 3V2h2v1M4 3v7h4V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: Query tester ── */}
        <div className="rag__right">
          <div className="rag__query-section">
            <h3 className="rag__query-title">TEST RETRIEVAL</h3>
            <p className="rag__query-desc">
              Enter a query to test what context will be retrieved for your agents.
              {selectedDocs.size > 0 && <span className="rag__query-filter-note"> Filtering to {selectedDocs.size} selected document{selectedDocs.size > 1 ? 's' : ''}.</span>}
            </p>
            <div className="rag__query-input-row">
              <input className="rag__query-input" value={queryInput}
                onChange={e => setQueryInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !querying && runQuery()}
                placeholder="e.g. What are the key risks identified?" />
              <button className="rag__query-btn" onClick={runQuery} disabled={!queryInput.trim() || querying}>
                {querying ? '⟳' : '→'}
              </button>
            </div>

            {queryResult && (
              <div className="rag__query-results">
                <div className="rag__query-results-header">
                  <span>TOP {queryResult.results?.length || 0} RESULTS</span>
                  <span className="rag__query-searched">{queryResult.chunks_searched} chunks searched</span>
                </div>
                {(queryResult.results || []).length === 0 ? (
                  <p className="rag__query-empty">No relevant chunks found. Try a different query or check your documents.</p>
                ) : (
                  queryResult.results.map((r, i) => (
                    <div key={i} className="rag__result-item">
                      <div className="rag__result-header">
                        <span className="rag__result-source">{r.filename}</span>
                        <span className="rag__result-score" style={{ color: r.score > 0.7 ? 'var(--green-dark)' : r.score > 0.4 ? 'var(--gray-600)' : 'var(--gray-400)' }}>
                          {(r.score * 100).toFixed(0)}% match
                        </span>
                        <span className="rag__result-chunk">chunk {r.chunk_index + 1}</span>
                      </div>
                      <p className="rag__result-text">{r.text.slice(0, 300)}{r.text.length > 300 ? '...' : ''}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="rag__how-it-works">
            <h4>HOW RAG WORKS IN SECREAI</h4>
            <div className="rag__steps">
              {[
                { n: '1', title: 'UPLOAD', desc: 'Upload documents (PDF, TXT, MD, CSV). They are chunked into ~400-word segments.' },
                { n: '2', title: 'EMBED', desc: 'Each chunk is embedded using Ollama\'s nomic-embed-text model into a vector.' },
                { n: '3', title: 'RETRIEVE', desc: 'When you chat, relevant chunks are retrieved via cosine similarity search.' },
                { n: '4', title: 'INJECT', desc: 'Top chunks are injected into agent system prompts as context before the AI responds.' },
              ].map(s => (
                <div key={s.n} className="rag__step">
                  <span className="rag__step-num">{s.n}</span>
                  <div><strong>{s.title}</strong><p>{s.desc}</p></div>
                </div>
              ))}
            </div>
            <div className="rag__setup-note">
              <p>Enable RAG in <button onClick={() => navigate('tools')} className="rag__setup-link">Tools & Permissions</button> to use it in chat.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}