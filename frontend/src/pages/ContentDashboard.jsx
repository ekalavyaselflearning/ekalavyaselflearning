import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  doc, collection, query, orderBy,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";
import "./ContentDashboard.css";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

const CONTENT_TYPES = [
  "Video", "Test Series", "Assignment", "Solved PYQ",
  "Study Material", "Mock Test", "Other",
];

const ANN_TYPES = ["general", "assignment", "assessment"];

const ANN_TYPE_META = {
  assignment: { label: "Assignment", icon: "fa-pen-to-square" },
  assessment: { label: "Assessment", icon: "fa-chart-simple"  },
  general:    { label: "General",    icon: "fa-bullhorn"      },
};

const STATUS_META = {
  live:    { label: "Live",    icon: "fa-circle-dot"   },
  removed: { label: "Removed", icon: "fa-ban"          },
};

// ── Small shared components ───────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`cm-toast cm-toast--${toast.type}`}>
      <i className={`fa fa-solid ${toast.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}`} />
      {toast.msg}
    </div>
  );
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div className="cm-stat-card" style={{ borderLeft: `4px solid ${accent}` }}>
      <div className="cm-stat-icon" style={{ background: accent + "18", color: accent }}>
        <i className={`fa fa-solid ${icon}`} />
      </div>
      <div>
        <div className="cm-stat-value">{value}</div>
        <div className="cm-stat-label">{label}</div>
      </div>
    </div>
  );
}

// ── Content Detail Modal ──────────────────────────────────────────────────────
function ContentModal({ item, academyId, cmEmail, onClose, onUpdated, showToast }) {
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [editing, setEditing]       = useState(false);
  const [editTitle, setEditTitle]   = useState(item.title || "");
  const [editDesc, setEditDesc]     = useState(item.description || "");
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingFeature, setSavingFeature] = useState(false);

  const isLive     = item.status === "live";
  const isFeatured = !!item.featured;
  const itemRef    = doc(db, "academies", academyId, "content", item.id);

  async function toggleStatus() {
    setSaving(true);
    const newStatus = isLive ? "removed" : "live";
    try {
      await updateDoc(itemRef, {
        status: newStatus,
        [`${newStatus}At`]: new Date().toISOString(),
        [`${newStatus}By`]: cmEmail,
      });
      onUpdated({ ...item, status: newStatus });
      showToast("success", isLive ? "Content removed." : "Content restored.");
      setConfirming(false);
      onClose();
    } catch (e) {
      showToast("error", "Failed to update content.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editTitle.trim()) { showToast("error", "Title cannot be empty."); return; }
    setSavingEdit(true);
    try {
      await updateDoc(itemRef, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        editedAt: new Date().toISOString(),
        editedBy: cmEmail,
      });
      onUpdated({ ...item, title: editTitle.trim(), description: editDesc.trim() });
      showToast("success", "Content updated.");
      setEditing(false);
    } catch (e) {
      showToast("error", "Failed to save changes.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleFeature() {
    setSavingFeature(true);
    try {
      await updateDoc(itemRef, {
        featured: !isFeatured,
        featuredAt: !isFeatured ? new Date().toISOString() : null,
        featuredBy: !isFeatured ? cmEmail : null,
      });
      onUpdated({ ...item, featured: !isFeatured });
      showToast("success", isFeatured ? "Removed from featured." : "Content featured!");
    } catch (e) {
      showToast("error", "Failed to update featured status.");
    } finally {
      setSavingFeature(false);
    }
  }

  return (
    <div
      className="cm-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cm-modal">
        {/* Header */}
        <div className="cm-modal-header">
          <div className="cm-modal-title">
            <i className="fa fa-solid fa-file-lines" />
            Content Details
          </div>
          <button className="cm-modal-close" onClick={onClose}>
            <i className="fa fa-solid fa-xmark" />
          </button>
        </div>

        {/* Body */}
        <div className="cm-modal-body">
          {editing ? (
            /* ── Edit form ── */
            <>
              <div className="cm-field">
                <label className="cm-label">Title <span className="req">*</span></label>
                <input
                  className="cm-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>
              <div className="cm-field">
                <label className="cm-label">Description</label>
                <textarea
                  className="cm-textarea"
                  placeholder="Optional description…"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>
              <div className="cm-action-row" style={{ marginTop: "1rem" }}>
                <button className="cm-save-btn cm-save-btn--no-margin" onClick={saveEdit} disabled={savingEdit}>
                  {savingEdit
                    ? <><i className="fa fa-solid fa-spinner fa-spin" /> Saving…</>
                    : <><i className="fa fa-solid fa-check" /> Save Changes</>}
                </button>
                <button className="cm-cancel-btn" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </>
          ) : (
            /* ── Detail view ── */
            <>
              <div className="cm-detail-grid">
                <div className="cm-detail-item cm-detail-item--full">
                  <div className="cm-detail-label">Title</div>
                  <div className="cm-detail-value" style={{ fontWeight: 700, fontSize: "1rem" }}>
                    {item.title}
                    {isFeatured && (
                      <span className="cm-featured-badge" style={{ marginLeft: 8 }}>
                        <i className="fa fa-solid fa-star" /> Featured
                      </span>
                    )}
                  </div>
                </div>

                {item.description && (
                  <div className="cm-detail-item cm-detail-item--full">
                    <div className="cm-detail-label">Description</div>
                    <div className="cm-detail-value">{item.description}</div>
                  </div>
                )}

                <div className="cm-detail-item">
                  <div className="cm-detail-label">Type</div>
                  <div className="cm-detail-value">
                    <span className="cm-type-chip">{item.type || "—"}</span>
                  </div>
                </div>

                <div className="cm-detail-item">
                  <div className="cm-detail-label">Visibility</div>
                  <div className="cm-detail-value">
                    <span className={`cm-vis-chip cm-vis-chip--${item.visibility}`}>
                      <i className={`fa fa-solid ${item.visibility === "public" ? "fa-globe" : "fa-lock"}`} />
                      {item.visibility === "public" ? "Public" : "Academy Only"}
                    </span>
                  </div>
                </div>

                <div className="cm-detail-item">
                  <div className="cm-detail-label">Status</div>
                  <div className="cm-detail-value">
                    <span className={`cm-status-chip cm-status-chip--${item.status}`}>
                      <i className={`fa fa-solid ${STATUS_META[item.status]?.icon}`} />
                      {STATUS_META[item.status]?.label}
                    </span>
                  </div>
                </div>

                <div className="cm-detail-item">
                  <div className="cm-detail-label">Uploaded by</div>
                  <div className="cm-detail-value">{item.uploadedBy || "—"}</div>
                </div>

                <div className="cm-detail-item">
                  <div className="cm-detail-label">Upload date</div>
                  <div className="cm-detail-value">{formatDate(item.createdAt)}</div>
                </div>

                {item.url && (
                  <div className="cm-detail-item cm-detail-item--full">
                    <div className="cm-detail-label">URL</div>
                    <a className="cm-content-url" href={item.url} target="_blank" rel="noreferrer">
                      <i className="fa fa-solid fa-arrow-up-right-from-square" />
                      {item.url}
                    </a>
                  </div>
                )}
              </div>

              <div className="cm-section-divider" />

              {/* Actions */}
              <div className="cm-action-row" style={{ flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                <button className="cm-action-btn" onClick={() => setEditing(true)}>
                  <i className="fa fa-solid fa-pencil" /> Edit
                </button>
                <button
                  className={`cm-feature-btn ${isFeatured ? "active" : ""}`}
                  onClick={toggleFeature}
                  disabled={savingFeature}
                >
                  {savingFeature
                    ? <i className="fa fa-solid fa-spinner fa-spin" />
                    : <><i className="fa fa-solid fa-star" /> {isFeatured ? "Unfeature" : "Feature"}</>}
                </button>
              </div>

              {confirming ? (
                <div className={`cm-confirm-box ${!isLive ? "cm-confirm-box--restore" : ""}`}>
                  <div className={`cm-confirm-title ${!isLive ? "cm-confirm-title--restore" : ""}`}>
                    <i className={`fa fa-solid ${isLive ? "fa-triangle-exclamation" : "fa-rotate-left"}`} />
                    {isLive ? "Remove this content?" : "Restore this content?"}
                  </div>
                  <div className={`cm-confirm-sub ${!isLive ? "cm-confirm-sub--restore" : ""}`}>
                    {isLive
                      ? "This content will be marked as removed and hidden from students. You can restore it later."
                      : "This will restore the content and make it visible again based on its visibility setting."}
                  </div>
                  <div className="cm-confirm-actions">
                    <button
                      className={`cm-confirm-btn ${!isLive ? "cm-confirm-btn--restore" : ""}`}
                      onClick={toggleStatus}
                      disabled={saving}
                    >
                      {saving
                        ? <i className="fa fa-solid fa-spinner fa-spin" />
                        : <><i className={`fa fa-solid ${isLive ? "fa-ban" : "fa-rotate-left"}`} />
                            {isLive ? "Yes, Remove" : "Yes, Restore"}
                          </>}
                    </button>
                    <button className="cm-cancel-btn" onClick={() => setConfirming(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  className={`cm-action-btn ${isLive ? "danger" : ""}`}
                  onClick={() => setConfirming(true)}
                  style={{ fontSize: "0.86rem", padding: "0.55rem 1.1rem" }}
                >
                  <i className={`fa fa-solid ${isLive ? "fa-ban" : "fa-rotate-left"}`} />
                  {isLive ? "Remove Content" : "Restore Content"}
                </button>
              )}
            </>
          )}
        </div>

        <div className="cm-modal-actions">
          <button className="cm-cancel-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Announcement Modal ────────────────────────────────────────────────────────
function AnnouncementModal({ ann, academyId, cmEmail, onClose, onSaved, showToast }) {
  const isEdit = !!ann;
  const [title, setTitle]   = useState(ann?.title || "");
  const [body, setBody]     = useState(ann?.body || "");
  const [type, setType]     = useState(ann?.type || "general");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim() || !body.trim()) {
      showToast("error", "Title and body are required."); return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateDoc(doc(db, "academies", academyId, "announcements", ann.id), {
          title: title.trim(),
          body: body.trim(),
          type,
          updatedAt: new Date().toISOString(),
        });
        onSaved({ ...ann, title: title.trim(), body: body.trim(), type });
        showToast("success", "Announcement updated.");
      } else {
        const ref = await addDoc(collection(db, "academies", academyId, "announcements"), {
          title: title.trim(),
          body: body.trim(),
          type,
          createdAt: new Date().toISOString(),
          createdBy: cmEmail,
        });
        onSaved({ id: ref.id, title: title.trim(), body: body.trim(), type, createdAt: new Date().toISOString(), createdBy: cmEmail });
        showToast("success", "Announcement created.");
      }
      onClose();
    } catch (e) {
      showToast("error", "Failed to save announcement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="cm-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cm-modal">
        <div className="cm-modal-header">
          <div className="cm-modal-title">
            <i className="fa fa-solid fa-bullhorn" />
            {isEdit ? "Edit Announcement" : "New Announcement"}
          </div>
          <button className="cm-modal-close" onClick={onClose}>
            <i className="fa fa-solid fa-xmark" />
          </button>
        </div>

        <div className="cm-modal-body">
          {/* Type selector */}
          <div className="cm-field">
            <div className="cm-label">Type <span className="req">*</span></div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {ANN_TYPES.map((t) => {
                const meta = ANN_TYPE_META[t];
                const selected = type === t;
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`cm-filter-btn ${selected ? `active-${t === "exam" ? "removed" : t === "assignment" ? "public" : t === "assessment" ? "academy" : "live"}` : ""}`}
                    style={selected ? {} : {}}
                  >
                    <i className={`fa fa-solid ${meta.icon}`} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="cm-field">
            <label className="cm-label">Title <span className="req">*</span></label>
            <input
              className="cm-input"
              placeholder="e.g. Unit Test 3 — Mathematics"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="cm-field">
            <label className="cm-label">Body <span className="req">*</span></label>
            <textarea
              className="cm-textarea"
              placeholder="Write the announcement details here…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{ minHeight: 120 }}
            />
          </div>
        </div>

        <div className="cm-modal-actions">
          <button className="cm-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="cm-save-btn cm-save-btn--no-margin"
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? <><i className="fa fa-solid fa-spinner fa-spin" /> Saving…</>
              : <><i className="fa fa-solid fa-check" /> {isEdit ? "Save Changes" : "Publish"}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ContentDashboard() {
  const [cmUser, setCmUser]       = useState(null);
  const [academyId, setAcademyId] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState("overview");

  const [content, setContent]           = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [toast, setToast]               = useState(null);

  // Content modal
  const [activeContent, setActiveContent] = useState(null);

  // Announcement modal
  const [annModal, setAnnModal]   = useState(null); // null | "new" | {existing ann}
  const [deletingAnn, setDeletingAnn] = useState(null); // ann id being deleted

  // Content filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [visFilter, setVisFilter]       = useState("all");
  const [typeFilter, setTypeFilter]     = useState("all");
  const [searchQuery, setSearchQuery]   = useState("");

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Auth & load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.href = "/"; return; }

      const email = user.email;
      const academiesSnap = await getDocs(collection(db, "academies"));
      let foundId = null;

      for (const aDoc of academiesSnap.docs) {
        const empSnap = await getDoc(
          doc(db, "academies", aDoc.id, "employees", email)
        );
        if (empSnap.exists() && empSnap.data().role === "content_management") {
          if (empSnap.data().markedForDeletion) {
            await signOut(auth);
            window.location.href = "/";
            return;
          }
          foundId = aDoc.id;
          break;
        }
      }

      if (!foundId) { window.location.href = "/dashboard"; return; }

      setCmUser(user);
      setAcademyId(foundId);
      await Promise.all([loadContent(foundId), loadAnnouncements(foundId)]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function loadContent(aId) {
    const snap = await getDocs(
      query(collection(db, "academies", aId, "content"), orderBy("createdAt", "desc"))
    );
    setContent(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  async function loadAnnouncements(aId) {
    const snap = await getDocs(
      query(collection(db, "academies", aId, "announcements"), orderBy("createdAt", "desc"))
    );
    setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  function handleContentUpdated(updated) {
    setContent((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  function handleAnnSaved(saved) {
    setAnnouncements((prev) => {
      const exists = prev.find((a) => a.id === saved.id);
      if (exists) return prev.map((a) => (a.id === saved.id ? saved : a));
      return [saved, ...prev];
    });
  }

  async function deleteAnnouncement(annId) {
    try {
      await deleteDoc(doc(db, "academies", academyId, "announcements", annId));
      setAnnouncements((prev) => prev.filter((a) => a.id !== annId));
      setDeletingAnn(null);
      showToast("success", "Announcement deleted.");
    } catch (e) {
      showToast("error", "Failed to delete announcement.");
    }
  }

  // ── Derived stats ───────────────────────────────────────────────────────────
  const liveContent    = content.filter((c) => c.status === "live");
  const removedContent = content.filter((c) => c.status === "removed");
  const publicContent  = content.filter((c) => c.visibility === "public");

  // ── Filtered content ────────────────────────────────────────────────────────
  const filteredContent = content.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (visFilter    !== "all" && c.visibility !== visFilter) return false;
    if (typeFilter   !== "all" && c.type !== typeFilter)      return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!c.title?.toLowerCase().includes(q) && !c.uploadedBy?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Unique content types for type filter dropdown
  const uniqueTypes = [...new Set(content.map((c) => c.type).filter(Boolean))];

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="cm-loading">
        <div className="cm-loading-inner">
          <div className="cm-spinner" />
          <div className="cm-loading-text">Loading your workspace…</div>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="cm-root">

      {/* ── Sidebar ── */}
      <aside className="cm-sidebar">
        <div className="cm-sidebar-brand">
          <div className="cm-brand-eyebrow">Ekalavya Portal</div>
          <div className="cm-brand-name">Ekalavya</div>
          <span className="cm-brand-role">
            <i className="fa fa-solid fa-pen-nib" style={{ marginRight: 5 }} />
            Content Management
          </span>
        </div>

        <nav className="cm-nav">
          <div className="cm-nav-label">Dashboard</div>
          {[
            { key: "overview",      icon: "fa-gauge",    label: "Overview"         },
            { key: "content",       icon: "fa-folder-open", label: "Content Library" },
            { key: "announcements", icon: "fa-bullhorn", label: "Announcements"    },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              className={`cm-nav-btn ${tab === key ? "active" : ""}`}
              onClick={() => setTab(key)}
            >
              <span className="nav-icon"><i className={`fa fa-solid ${icon}`} /></span>
              {label}
              {key === "content" && removedContent.length > 0 && (
                <span className="cm-nav-badge">{removedContent.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="cm-sidebar-footer">
          <div className="cm-footer-label">Signed in as</div>
          <div className="cm-footer-email">{cmUser?.email}</div>
          <button
            className="cm-signout-btn"
            onClick={() => signOut(auth).then(() => (window.location.href = "/"))}
          >
            <i className="fa fa-solid fa-arrow-right-from-bracket" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="cm-main">

        {/* ══ OVERVIEW ══════════════════════════════════════════════════════ */}
        {tab === "overview" && (
          <>
            <div className="cm-page-header">
              <div className="cm-page-title">Content <span>Overview</span></div>
              <div className="cm-page-sub">
                {content.length} total item{content.length !== 1 ? "s" : ""} across all mentors
              </div>
            </div>

            <div className="cm-stats-row">
              <StatCard icon="fa-folder-open"   label="Total Content"  value={content.length}           accent="#1e3a5f" />
              <StatCard icon="fa-circle-dot"    label="Live"           value={liveContent.length}       accent="#15803d" />
              <StatCard icon="fa-ban"           label="Removed"        value={removedContent.length}    accent="#dc2626" />
              <StatCard icon="fa-globe"         label="Public"         value={publicContent.length}     accent="#0369a1" />
              <StatCard icon="fa-bullhorn"      label="Announcements"  value={announcements.length}     accent="#5c35a0" />
            </div>

            {/* Recent content */}
            <div className="cm-card">
              <div className="cm-card-header-row">
                <div className="cm-card-title cm-card-title--no-margin">
                  <i className="fa fa-solid fa-clock-rotate-left" /> Recently Added
                </div>
                <button className="cm-action-btn" onClick={() => setTab("content")}>
                  View all →
                </button>
              </div>
              {liveContent.length === 0 ? (
                <div className="cm-empty" style={{ padding: "2rem 1rem" }}>
                  <i className="fa fa-solid fa-folder-open" />
                  <p>No content yet</p>
                </div>
              ) : (
                <div className="cm-recent-list">
                  {liveContent.slice(0, 5).map((c) => (
                    <div
                      key={c.id}
                      className="cm-recent-item"
                      onClick={() => { setActiveContent(c); setTab("content"); }}
                    >
                      <i className="fa fa-solid fa-file-lines" style={{ color: "#1e3a5f", fontSize: "0.85rem", flexShrink: 0 }} />
                      <span className="cm-recent-subject">{c.title}</span>
                      <span className="cm-recent-meta">{c.uploadedBy} · {formatDate(c.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent announcements */}
            <div className="cm-card">
              <div className="cm-card-header-row">
                <div className="cm-card-title cm-card-title--no-margin">
                  <i className="fa fa-solid fa-bullhorn" /> Recent Announcements
                </div>
                <button className="cm-action-btn" onClick={() => setTab("announcements")}>
                  View all →
                </button>
              </div>
              {announcements.length === 0 ? (
                <div className="cm-empty" style={{ padding: "2rem 1rem" }}>
                  <i className="fa fa-solid fa-bullhorn" />
                  <p>No announcements yet</p>
                </div>
              ) : (
                <div className="cm-recent-list">
                  {announcements.slice(0, 3).map((a) => {
                    const meta = ANN_TYPE_META[a.type] || ANN_TYPE_META.general;
                    return (
                      <div
                        key={a.id}
                        className="cm-recent-item"
                        onClick={() => setTab("announcements")}
                      >
                        <i className={`fa fa-solid ${meta.icon}`} style={{ color: "#5c35a0", fontSize: "0.85rem", flexShrink: 0 }} />
                        <span className="cm-recent-subject">{a.title}</span>
                        <span className="cm-recent-meta">{formatDate(a.createdAt)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ CONTENT LIBRARY ═══════════════════════════════════════════════ */}
        {tab === "content" && (
          <>
            <div className="cm-page-header">
              <div className="cm-page-title">Content <span>Library</span></div>
              <div className="cm-page-sub">
                {filteredContent.length} item{filteredContent.length !== 1 ? "s" : ""} shown
                {(statusFilter !== "all" || visFilter !== "all" || typeFilter !== "all" || searchQuery) && " · filters active"}
              </div>
            </div>

            {/* Toolbar */}
            <div className="cm-toolbar">
              <div className="cm-search-wrap">
                <i className="fa fa-solid fa-magnifying-glass" />
                <input
                  className="cm-search-input"
                  placeholder="Search by title or mentor name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Status filter */}
              <div className="cm-filter-group">
                {[
                  { key: "all",     label: "All",     cls: "active-all"     },
                  { key: "live",    label: "Live",    cls: "active-live"    },
                  { key: "removed", label: "Removed", cls: "active-removed" },
                ].map(({ key, label, cls }) => (
                  <button
                    key={key}
                    className={`cm-filter-btn ${statusFilter === key ? cls : ""}`}
                    onClick={() => setStatusFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="cm-filter-divider" />

              {/* Visibility filter */}
              <div className="cm-filter-group">
                {[
                  { key: "all",     label: "All visibility", cls: "active-all"    },
                  { key: "public",  label: "Public",         cls: "active-public" },
                  { key: "academy", label: "Academy Only",   cls: "active-academy" },
                ].map(({ key, label, cls }) => (
                  <button
                    key={key}
                    className={`cm-filter-btn ${visFilter === key ? cls : ""}`}
                    onClick={() => setVisFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Type filter — only show if there are multiple types */}
              {uniqueTypes.length > 1 && (
                <>
                  <div className="cm-filter-divider" />
                  <div className="cm-filter-group">
                    <button
                      className={`cm-filter-btn ${typeFilter === "all" ? "active-all" : ""}`}
                      onClick={() => setTypeFilter("all")}
                    >
                      All types
                    </button>
                    {uniqueTypes.map((t) => (
                      <button
                        key={t}
                        className={`cm-filter-btn ${typeFilter === t ? "active-all" : ""}`}
                        onClick={() => setTypeFilter(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="cm-result-count">
              Showing {filteredContent.length} of {content.length} items
            </div>

            {filteredContent.length === 0 ? (
              <div className="cm-card">
                <div className="cm-empty">
                  <i className="fa fa-solid fa-folder-open" />
                  <p>No content matches your filters</p>
                  <div className="cm-empty-sub">Try adjusting the status or visibility filter.</div>
                </div>
              </div>
            ) : (
              <div className="cm-content-list">
                {filteredContent.map((c) => (
                    
                  <div
                    key={c.id}
                    className={`cm-content-row ${c.status === "removed" ? "cm-content-row--removed" : ""}`}
                    onClick={() => setActiveContent(c)}
                  >
                    <div className={`cm-content-accent cm-content-accent--${c.status}`} />
                    <div className="cm-content-body">
                      <div className="cm-content-title">{c.title}</div>
                      <div className="cm-content-meta">
                        {c.type && (
                          <span>
                            <i className="fa fa-solid fa-tag" />
                            {c.type}
                          </span>
                        )}
                        {c.uploadedBy && (
                          <span>
                            <i className="fa fa-solid fa-chalkboard-user" />
                            {c.uploadedBy}
                          </span>
                        )}
                        {c.url && (
                          <span>
                            <i className="fa fa-solid fa-link" />
                            Link attached
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="cm-content-right">
                        {c.featured && (
                        <span className="cm-featured-badge">
                            <i className="fa fa-solid fa-star" /> Featured
                        </span>
                        )}
                      <span className={`cm-status-chip cm-status-chip--${c.status}`}>
                        <i className={`fa fa-solid ${STATUS_META[c.status]?.icon}`} />
                        {STATUS_META[c.status]?.label}
                      </span>
                      <span className={`cm-vis-chip cm-vis-chip--${c.visibility}`}>
                        <i className={`fa fa-solid ${c.visibility === "public" ? "fa-globe" : "fa-lock"}`} />
                        {c.visibility === "public" ? "Public" : "Academy"}
                      </span>
                      <span className="cm-content-date">{formatDate(c.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ ANNOUNCEMENTS ═════════════════════════════════════════════════ */}
        {tab === "announcements" && (
          <>
            <div className="cm-page-header--row">
              <div>
                <div className="cm-page-title">
                  <span>Announcements</span>
                </div>
                <div className="cm-page-sub">
                  {announcements.length} announcement{announcements.length !== 1 ? "s" : ""}
                </div>
              </div>
              <button className="cm-primary-btn" onClick={() => setAnnModal("new")}>
                <i className="fa fa-solid fa-plus" /> New Announcement
              </button>
            </div>

            {announcements.length === 0 ? (
              <div className="cm-card">
                <div className="cm-empty">
                  <i className="fa fa-solid fa-bullhorn" />
                  <p>No announcements yet</p>
                  <div className="cm-empty-sub">Create one to notify your academy.</div>
                </div>
              </div>
            ) : (
              <div className="cm-ann-list">
                {announcements.map((a) => {
                  const meta = ANN_TYPE_META[a.type] || ANN_TYPE_META.general;
                  return (
                    <div key={a.id} className="cm-ann-row">
                      <div className={`cm-ann-accent cm-ann-accent--${a.type}`} />
                      <div className="cm-ann-body">
                        <div className="cm-ann-title">{a.title}</div>
                        <div className="cm-ann-preview">{a.body}</div>
                      </div>
                      <div className="cm-ann-right">
                        <span className={`cm-ann-chip cm-ann-chip--${a.type}`}>
                          <i className={`fa fa-solid ${meta.icon}`} />
                          {meta.label}
                        </span>
                        <span className="cm-ann-date">{formatDate(a.createdAt)}</span>
                        <div className="cm-action-row">
                          <button
                            className="cm-action-btn"
                            onClick={(e) => { e.stopPropagation(); setAnnModal(a); }}
                          >
                            <i className="fa fa-solid fa-pencil" />
                          </button>
                          <button
                            className="cm-action-btn danger"
                            onClick={(e) => { e.stopPropagation(); setDeletingAnn(a.id); }}
                          >
                            <i className="fa fa-solid fa-trash" />
                          </button>
                        </div>
                      </div>

                      {/* Inline delete confirm */}
                      {deletingAnn === a.id && (
                        <div
                          style={{ gridColumn: "1 / -1", paddingLeft: "0.25rem" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="cm-confirm-box">
                            <div className="cm-confirm-title">
                              <i className="fa fa-solid fa-triangle-exclamation" />
                              Delete this announcement?
                            </div>
                            <div className="cm-confirm-sub">
                              This action cannot be undone.
                            </div>
                            <div className="cm-confirm-actions">
                              <button
                                className="cm-confirm-btn"
                                onClick={() => deleteAnnouncement(a.id)}
                              >
                                <i className="fa fa-solid fa-trash" /> Yes, Delete
                              </button>
                              <button
                                className="cm-cancel-btn"
                                onClick={() => setDeletingAnn(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Content Modal ── */}
      {activeContent && (
        <ContentModal
          item={activeContent}
          academyId={academyId}
          cmEmail={cmUser.email}
          onClose={() => setActiveContent(null)}
          onUpdated={(updated) => {
            handleContentUpdated(updated);
            setActiveContent(updated);
          }}
          showToast={showToast}
        />
      )}

      {/* ── Announcement Modal ── */}
      {annModal && (
        <AnnouncementModal
          ann={annModal === "new" ? null : annModal}
          academyId={academyId}
          cmEmail={cmUser.email}
          onClose={() => setAnnModal(null)}
          onSaved={handleAnnSaved}
          showToast={showToast}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}