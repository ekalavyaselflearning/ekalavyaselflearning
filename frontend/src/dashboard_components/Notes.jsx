import React, { useState, useEffect, useRef, useCallback } from 'react';
import { setDoc, doc, getDoc, collection, addDoc, onSnapshot, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase.js';

// ─── Firestore helpers ────────────────────────────────────────────────────────

/**
 * Save or update a note.
 *
 * Private notes:  learners/{email}/notes/{noteId}
 * Public notes:   learners/{email}/notes/{noteId}  +  Notes/{noteId}  (global collection)
 *
 * Files (images/PDFs) are stored as base64 data-URIs inside the note document.
 * For production you'd swap these out for Firebase Storage URLs, but this keeps
 * the component self-contained.
 */
async function saveNote({ noteId, title, notesText, tags, uploadedFiles, isPublic, email }) {
  const timestamp = serverTimestamp();

  const payload = {
    title: title.trim(),
    notes: notesText,
    tags,
    // Store only metadata + preview data-URI to avoid very large docs.
    // In production replace with Firebase Storage upload + download URLs.
    files: uploadedFiles.map(f => ({ name: f.file.name, type: f.type, preview: f.preview })),
    public: isPublic,
    author: email,
    updatedAt: timestamp,
  };

  // Destination: a sub-collection on the learner's document
  const userNotesCol = collection(db, 'learners', email, 'notes');

  let savedId = noteId;
  if (noteId) {
    // Update existing note
    await setDoc(doc(userNotesCol, noteId), { ...payload, createdAt: undefined }, { merge: true });
  } else {
    // Create new note
    const ref = await addDoc(userNotesCol, { ...payload, createdAt: timestamp });
    savedId = ref.id;
  }

  // Mirror to global Notes collection when public
  if (isPublic) {
    await setDoc(doc(db, 'Notes', savedId), { ...payload, createdAt: timestamp });
  } else if (noteId) {
    // If previously public and now set to private, remove from global collection
    try {
      const globalSnap = await getDoc(doc(db, 'Notes', noteId));
      if (globalSnap.exists() && globalSnap.data().author === email) {
        await deleteDoc(doc(db, 'Notes', noteId));
      }
    } catch (_) { /* best-effort */ }
  }

  return savedId;
}

// ─── NoteCard ─────────────────────────────────────────────────────────────────

function NoteCard({ note, onEdit, onDelete }) {
  return (
    <div className="note-card">
      <div className="note-card-header">
        <span className="note-card-title">{note.title}</span>
        <span className={`note-badge ${note.public ? 'badge-public' : 'badge-private'}`}>
          <i className={`fa fa-solid ${note.public ? 'fa-globe' : 'fa-lock'}`}></i>
          {note.public ? ' Public' : ' Private'}
        </span>
      </div>
      <p className="note-card-body">{note.notes}</p>
      {note.tags && note.tags.length > 0 && (
        <div className="note-card-tags">
          {note.tags.map((t, i) => <span key={i} className="note-tag-chip">{t}</span>)}
        </div>
      )}
      <div className="note-card-actions">
        <button className="nc-btn nc-edit" onClick={() => onEdit(note)} title="Edit">
          <i className="fa fa-solid fa-pencil"></i>
        </button>
        <button className="nc-btn nc-delete" onClick={() => onDelete(note.id)} title="Delete">
          <i className="fa fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  );
}

// ─── Main Notes component ─────────────────────────────────────────────────────

export default function Notes({ user }) {
  const email = user || auth.currentUser?.email;

  // ── view state: 'list' | 'form'
  const [view, setView] = useState('list');

  // ── existing notes
  const [notesList, setNotesList] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(true);

  // ── form state
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [notesText, setNotesText] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewMode, setPreviewMode] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [isFocused, setIsFocused] = useState(false);

  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Real-time listener for the user's notes sub-collection
  useEffect(() => {
    if (!email) return;
    const unsub = onSnapshot(
      collection(db, 'learners', email, 'notes'),
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort newest first (createdAt may be null briefly due to serverTimestamp pending)
        docs.sort((a, b) => {
          const ta = a.updatedAt?.seconds ?? 0;
          const tb = b.updatedAt?.seconds ?? 0;
          return tb - ta;
        });
        setNotesList(docs);
        setLoadingNotes(false);
      },
      (err) => {
        console.error('Notes listener error', err);
        setLoadingNotes(false);
      }
    );
    return () => unsub();
  }, [email]);

  // ── Speech recognition setup
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    let pending = '';
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          pending += e.results[i][0].transcript + ' ';
        }
      }
      if (pending) {
        setNotesText(prev => prev + pending);
        pending = '';
      }
    };
    rec.onerror = () => setIsRecording(false);
    rec.onend = () => setIsRecording(false);
    recognitionRef.current = rec;
    return () => { try { rec.stop(); } catch (_) {} };
  }, []);

  // ── Helpers
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setNotesText('');
    setIsPublic(true);
    setTags([]);
    setTagInput('');
    setUploadedFiles([]);
    setPreviewMode(true);
  };

  const openNew = () => { resetForm(); setView('form'); };

  const openEdit = (note) => {
    setEditingId(note.id);
    setTitle(note.title || '');
    setNotesText(note.notes || '');
    setIsPublic(!!note.public);
    setTags(note.tags || []);
    setTagInput('');
    // files stored as metadata only; can't restore File objects from Firestore
    setUploadedFiles((note.files || []).map(f => ({ file: { name: f.name }, type: f.type, preview: f.preview })));
    setView('form');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await deleteDoc(doc(db, 'learners', email, 'notes', id));
      // Also remove from global collection if it was public
      try { await deleteDoc(doc(db, 'Notes', id)); } catch (_) {}
      showToast('Note deleted.');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete note.', 'error');
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { showToast('Please enter a title.', 'error'); return; }
    if (!notesText.trim()) { showToast('Please write some notes.', 'error'); return; }
    setSaving(true);
    try {
      await saveNote({ noteId: editingId, title, notesText, tags, uploadedFiles, isPublic, email });
      showToast(editingId ? 'Note updated!' : 'Note saved!');
      resetForm();
      setView('list');
    } catch (err) {
      console.error(err);
      showToast('Failed to save note.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Voice
  const toggleRecording = async () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported. Use Chrome, Edge, or Safari.');
      return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        recognitionRef.current.start();
        setIsRecording(true);
      } catch {
        alert('Microphone access is required for voice-to-text.');
      }
    }
  };

  // ── Tags
  const addTag = (t) => {
    const trimmed = t.trim();
    if (trimmed && !tags.includes(trimmed)) setTags(prev => [...prev, trimmed]);
  };
  const removeTag = (t) => setTags(tags.filter(x => x !== t));
  const handleTagInput = (e) => {
    const v = e.target.value;
    if (v.includes(',')) {
      const parts = v.split(',');
      addTag(parts[0]);
      setTagInput(parts.slice(1).join(','));
    } else {
      setTagInput(v);
    }
  };
  const handleTagKeyDown = (e) => {
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) setTags(tags.slice(0, -1));
    if (e.key === 'Enter') { e.preventDefault(); if (tagInput.trim()) { addTag(tagInput); setTagInput(''); } }
  };

  // ── Files
  const addFiles = useCallback((files) => {
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedFiles(prev => [...prev, { file, preview: e.target.result, type: file.type }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);
  const handleFileChange = (e) => {
    addFiles(Array.from(e.target.files).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf'));
  };
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf'));
  };
  const removeFile = (i) => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i));

  // ── URL preview
  const convertUrlsToLinks = (text) =>
    text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="notes-root">
      {/* Toast */}
      {toast && (
        <div className={`notes-toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          <i className={`fa fa-solid ${toast.type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check'}`}></i>
          {toast.msg}
        </div>
      )}

      {view === 'list' ? (
        // ── LIST VIEW
        <div className="notes-list-view">
          <div className="notes-list-header">
            <div>
              <h2 className="notes-heading">My Notes</h2>
              <p className="notes-sub">{notesList.length} note{notesList.length !== 1 ? 's' : ''}</p>
            </div>
            <button className="btn-add-note" onClick={openNew}>
              <i className="fa fa-solid fa-plus"></i> New Note
            </button>
          </div>

          {loadingNotes ? (
            <div className="notes-loading">
              <i className="fa fa-solid fa-spinner fa-spin"></i> Loading notes…
            </div>
          ) : notesList.length === 0 ? (
            <div className="notes-empty">
              <i className="fa fa-solid fa-book-open notes-empty-icon"></i>
              <p>No notes yet. Create your first one!</p>
              <button className="btn-add-note" onClick={openNew}>
                <i className="fa fa-solid fa-plus"></i> Add Note
              </button>
            </div>
          ) : (
            <div className="notes-grid">
              {notesList.map(note => (
                <NoteCard key={note.id} note={note} onEdit={openEdit} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      ) : (
        // ── FORM VIEW
        <div className="notes-form-view">
          <div className="form-topbar">
            <button className="btn-back" onClick={() => { resetForm(); setView('list'); }}>
              <i className="fa fa-solid fa-arrow-left"></i> Back
            </button>
            <h2 className="form-heading">{editingId ? 'Edit Note' : 'New Note'}</h2>
          </div>

          {/* Title */}
          <div className="field-group">
            <label className="field-label">Title</label>
            <input
              className="field-input"
              type="text"
              placeholder="Note title…"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Notes textarea + preview */}
          <div className="field-group">
            <div className="field-label-row">
              <label className="field-label">Notes</label>
              <div className="toolbar-btns">
                <button
                  className={`toolbar-btn ${previewMode ? 'active' : ''}`}
                  title="Toggle link preview"
                  onClick={() => setPreviewMode(p => !p)}
                >
                  <i className={`fa fa-solid ${previewMode ? 'fa-link' : 'fa-edit'}`}></i>
                </button>
                <button
                  className={`toolbar-btn ${isRecording ? 'recording' : ''}`}
                  title={isRecording ? 'Stop recording' : 'Voice to text'}
                  onClick={toggleRecording}
                >
                  <i className={`fa fa-solid ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
                  {isRecording && <span className="rec-dot"></span>}
                </button>
              </div>
            </div>
            <div className="textarea-wrap">
              <textarea
                className="field-textarea"
                placeholder="Write your notes here… (voice typing supported)"
                value={notesText}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onChange={e => setNotesText(e.target.value)}
                style={!isFocused ? { color: 'transparent', caretColor: '#334155' } : {}}
              />
              {!isFocused && (
                <div
                  className="textarea-preview"
                  dangerouslySetInnerHTML={{ __html: convertUrlsToLinks(notesText) || '<span class="preview-placeholder">Write your notes here…</span>' }}
                />
              )}
            </div>
          </div>

          {/* File upload */}
          <div className="field-group">
            <label className="field-label">Attachments <span className="field-hint">(images & PDFs)</span></label>
            <div
              className={`drop-zone ${isDragging ? 'dragging' : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input type="file" ref={fileInputRef} id="fileInput" accept="image/*,application/pdf" multiple onChange={handleFileChange} style={{ display: 'none' }} />
              <label htmlFor="fileInput" className="drop-label">
                <i className="fa fa-solid fa-upload"></i> Choose files
              </label>
              <span className="drop-hint">or drag & drop here</span>
            </div>
            {uploadedFiles.length > 0 && (
              <div className="file-previews">
                {uploadedFiles.map((f, i) => (
                  <div key={i} className="file-thumb">
                    {f.type.startsWith('image/') ? (
                      <img src={f.preview} alt={f.file.name} />
                    ) : (
                      <div className="pdf-thumb"><i className="fa fa-solid fa-file-pdf"></i><span>{f.file.name}</span></div>
                    )}
                    <button className="thumb-remove" onClick={() => removeFile(i)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="field-group">
            <label className="field-label">Tags <span className="field-hint">(comma or Enter to add)</span></label>
            <div className="tags-box">
              {tags.map((t, i) => (
                <span key={i} className="tag-chip">
                  {t} <span className="tag-x" onClick={() => removeTag(t)}>×</span>
                </span>
              ))}
              <input
                className="tag-input"
                placeholder={tags.length === 0 ? 'Add tags…' : ''}
                value={tagInput}
                onChange={handleTagInput}
                onKeyDown={handleTagKeyDown}
              />
            </div>
          </div>

          {/* Visibility */}
          <div className="field-group">
            <label className="field-label">Visibility</label>
            <div className="visibility-toggle">
              <button
                className={`vis-btn ${isPublic ? 'active' : ''}`}
                onClick={() => setIsPublic(true)}
              >
                <i className="fa fa-solid fa-globe"></i> Public
              </button>
              <button
                className={`vis-btn ${!isPublic ? 'active' : ''}`}
                onClick={() => setIsPublic(false)}
              >
                <i className="fa fa-solid fa-lock"></i> Private
              </button>
            </div>
            <p className="visibility-hint">
              {isPublic
                ? 'This note will also appear in the public Notes collection with your email as author.'
                : 'Only you can see this note.'}
            </p>
          </div>

          {/* Submit */}
          <div className="form-footer">
            <button className="btn-cancel" onClick={() => { resetForm(); setView('list'); }}>
              Cancel
            </button>
            <button className="btn-submit" onClick={handleSubmit} disabled={saving}>
              {saving
                ? <><i className="fa fa-solid fa-spinner fa-spin"></i> Saving…</>
                : <><i className="fa fa-solid fa-check"></i> {editingId ? 'Update Note' : 'Save Note'}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};