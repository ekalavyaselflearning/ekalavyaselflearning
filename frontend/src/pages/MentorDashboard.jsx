import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  doc, collection, query, orderBy, where,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";
import "./MentorDashboard.css";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}
function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function initials(name = "") {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "M";
}

const CONTENT_TYPES = [
  "Video", "Test Series", "Assignment", "Solved PYQ", "Study Material", "Mock Test", "Other",
];

const SESSION_STATUS_META = {
  requested: { label: "Requested", icon: "fa-clock"        },
  accepted:  { label: "Accepted",  icon: "fa-circle-check" },
  declined:  { label: "Declined",  icon: "fa-circle-xmark" },
  completed: { label: "Completed", icon: "fa-flag-checkered"},
};

const ANN_TYPE_META = {
  assignment: { label: "Assignment", icon: "fa-pen-to-square" },
  assessment: { label: "Assessment", icon: "fa-chart-simple"  },
  general:    { label: "General",    icon: "fa-bullhorn"      },
};

// ── Sub-components ────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`m-toast m-toast--${toast.type}`}>
      <i className={`fa fa-solid ${toast.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}`} />
      {toast.msg}
    </div>
  );
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div className="m-stat-card" style={{ borderLeft: `4px solid ${accent}` }}>
      <div className="m-stat-icon" style={{ background: accent + "18", color: accent }}>
        <i className={`fa fa-solid ${icon}`} />
      </div>
      <div>
        <div className="m-stat-value">{value}</div>
        <div className="m-stat-label">{label}</div>
      </div>
    </div>
  );
}

// ── Upload Content Modal ──────────────────────────────────────────────────────
function UploadModal({ academyId, mentorEmail, mentorName, onClose, onUploaded, showToast }) {
  const [title, setTitle]       = useState("");
  const [type, setType]         = useState("Video");
  const [visibility, setVis]    = useState("academy");
  const [url, setUrl]           = useState("");
  const [description, setDesc]  = useState("");
  const [saving, setSaving]     = useState(false);

  async function handleUpload() {
    if (!title.trim()) { showToast("error", "Title is required."); return; }
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "academies", academyId, "content"), {
        title: title.trim(),
        type,
        visibility,
        url: url.trim() || null,
        description: description.trim() || null,
        uploadedBy: mentorEmail,
        uploadedByName: mentorName,
        status: "live",
        featured: false,
        createdAt: new Date().toISOString(),
      });
      onUploaded({
        id: ref.id, title: title.trim(), type, visibility,
        url: url.trim() || null, description: description.trim() || null,
        uploadedBy: mentorEmail, uploadedByName: mentorName,
        status: "live", featured: false, createdAt: new Date().toISOString(),
      });
      showToast("success", "Content uploaded successfully.");
      onClose();
    } catch (e) {
      showToast("error", "Failed to upload content.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="m-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="m-modal">
        <div className="m-modal-header">
          <div>
            <div className="m-modal-title">
              <i className="fa fa-solid fa-upload" /> Upload Content
            </div>
          </div>
          <button className="m-modal-close" onClick={onClose}>
            <i className="fa fa-solid fa-xmark" />
          </button>
        </div>

        <div className="m-modal-body">
          <div className="m-field">
            <label className="m-label">Title <span className="req">*</span></label>
            <input className="m-input" placeholder="e.g. UPSC Polity — Fundamental Rights" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="m-field">
            <label className="m-label">Type <span className="req">*</span></label>
            <select className="m-select" value={type} onChange={(e) => setType(e.target.value)}>
              {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="m-field">
            <label className="m-label">Visibility <span className="req">*</span></label>
            <div className="m-vis-toggle">
              <button
                className={`m-vis-opt ${visibility === "public" ? "active-public" : ""}`}
                onClick={() => setVis("public")}
              >
                <i className="fa fa-solid fa-globe" /> Public
              </button>
              <button
                className={`m-vis-opt ${visibility === "academy" ? "active-academy" : ""}`}
                onClick={() => setVis("academy")}
              >
                <i className="fa fa-solid fa-lock" /> Academy Only
              </button>
            </div>
            <div className="m-hint">
              {visibility === "public"
                ? "Visible to all students on the platform."
                : "Visible only to students in your academy."}
            </div>
          </div>

          <div className="m-field">
            <label className="m-label">URL / Link</label>
            <input className="m-input" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>

          <div className="m-field">
            <label className="m-label">Description</label>
            <textarea className="m-textarea" placeholder="Brief description of the content…" value={description} onChange={(e) => setDesc(e.target.value)} />
          </div>
        </div>

        <div className="m-modal-actions">
          <button className="m-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="m-save-btn m-save-btn--no-margin" onClick={handleUpload} disabled={saving}>
            {saving
              ? <><i className="fa fa-solid fa-spinner fa-spin" /> Uploading…</>
              : <><i className="fa fa-solid fa-upload" /> Upload</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Content Modal ────────────────────────────────────────────────────────
function EditContentModal({ item, academyId, mentorEmail, onClose, onUpdated, showToast }) {
  const [title, setTitle]      = useState(item.title || "");
  const [description, setDesc] = useState(item.description || "");
  const [saving, setSaving]    = useState(false);

  async function handleSave() {
    if (!title.trim()) { showToast("error", "Title is required."); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, "academies", academyId, "content", item.id), {
        title: title.trim(),
        description: description.trim() || null,
        editedAt: new Date().toISOString(),
        editedBy: mentorEmail,
      });
      onUpdated({ ...item, title: title.trim(), description: description.trim() || null });
      showToast("success", "Content updated.");
      onClose();
    } catch (e) {
      showToast("error", "Failed to update content.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="m-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="m-modal">
        <div className="m-modal-header">
          <div className="m-modal-title"><i className="fa fa-solid fa-pencil" /> Edit Content</div>
          <button className="m-modal-close" onClick={onClose}><i className="fa fa-solid fa-xmark" /></button>
        </div>
        <div className="m-modal-body">
          <div className="m-field">
            <label className="m-label">Title <span className="req">*</span></label>
            <input className="m-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="m-field">
            <label className="m-label">Description</label>
            <textarea className="m-textarea" value={description} onChange={(e) => setDesc(e.target.value)} />
          </div>
        </div>
        <div className="m-modal-actions">
          <button className="m-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="m-save-btn m-save-btn--no-margin" onClick={handleSave} disabled={saving}>
            {saving ? <><i className="fa fa-solid fa-spinner fa-spin" /> Saving…</> : <><i className="fa fa-solid fa-check" /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Session Action Modal ──────────────────────────────────────────────────────
function SessionModal({ session, academyId, mentorEmail, onClose, onUpdated, showToast }) {
  const [meetLink, setMeetLink]   = useState(session.meetingLink || "");
  const [dateTime, setDateTime]   = useState(session.dateTime || "");
  const [saving, setSaving]       = useState(false);
  const [action, setAction]       = useState(null); // "accept" | "decline" | "complete"

  const sessionRef = doc(db, "academies", academyId, "sessions", session.id);

  async function handleAction() {
    if (action === "accept" && !meetLink.trim()) {
      showToast("error", "Please provide a meeting link."); return;
    }
    if (action === "accept" && !dateTime) {
      showToast("error", "Please set the confirmed date and time."); return;
    }
    setSaving(true);
    try {
      const updates =
        action === "accept"
          ? { status: "accepted", meetingLink: meetLink.trim(), dateTime, acceptedAt: new Date().toISOString() }
          : action === "decline"
          ? { status: "declined", declinedAt: new Date().toISOString() }
          : { status: "completed", completedAt: new Date().toISOString() };

      await updateDoc(sessionRef, updates);
      onUpdated({ ...session, ...updates });
      showToast("success",
        action === "accept" ? "Session accepted." :
        action === "decline" ? "Session declined." : "Session marked as completed."
      );
      onClose();
    } catch (e) {
      showToast("error", "Failed to update session.");
    } finally {
      setSaving(false);
    }
  }

  const sm = SESSION_STATUS_META[session.status] || SESSION_STATUS_META.requested;

  return (
    <div className="m-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="m-modal m-modal--wide">
        <div className="m-modal-header">
          <div>
            <div className="m-modal-title">
              <i className="fa fa-solid fa-calendar-check" /> Session Request
            </div>
            <div className="m-modal-chips">
              <span className={`m-status-chip m-status-chip--${session.status}`}>
                <i className={`fa fa-solid ${sm.icon}`} /> {sm.label}
              </span>
            </div>
          </div>
          <button className="m-modal-close" onClick={onClose}><i className="fa fa-solid fa-xmark" /></button>
        </div>

        <div className="m-modal-body">
          {/* Session details */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem 1.5rem", marginBottom: "1.5rem" }}>
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--m-slate-light)", marginBottom: 4 }}>Student</div>
              <div style={{ fontSize: "0.9rem", color: "var(--m-text)" }}>{session.studentEmail}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--m-slate-light)", marginBottom: 4 }}>Requested on</div>
              <div style={{ fontSize: "0.9rem", color: "var(--m-text)" }}>{formatDate(session.createdAt)}</div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--m-slate-light)", marginBottom: 4 }}>Topic</div>
              <div style={{ fontSize: "0.9rem", color: "var(--m-text)", fontWeight: 600 }}>{session.topic}</div>
            </div>
            {session.preferredDateTime && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--m-slate-light)", marginBottom: 4 }}>Student's preferred time</div>
                <div style={{ fontSize: "0.9rem", color: "var(--m-text)" }}>{formatDateTime(session.preferredDateTime)}</div>
              </div>
            )}
            {session.message && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--m-slate-light)", marginBottom: 4 }}>Message from student</div>
                <div style={{ fontSize: "0.88rem", color: "var(--m-text-mid)", lineHeight: 1.6 }}>{session.message}</div>
              </div>
            )}
            {session.meetingLink && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--m-slate-light)", marginBottom: 4 }}>Meeting link</div>
                <a href={session.meetingLink} target="_blank" rel="noreferrer" style={{ fontSize: "0.88rem", color: "var(--m-blue-acc)" }}>{session.meetingLink}</a>
              </div>
            )}
            {session.dateTime && (
              <div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--m-slate-light)", marginBottom: 4 }}>Confirmed time</div>
                <div style={{ fontSize: "0.9rem", color: "var(--m-text)" }}>{formatDateTime(session.dateTime)}</div>
              </div>
            )}
          </div>

          {/* Actions for requested sessions */}
          {session.status === "requested" && (
            <>
              <div style={{ height: 1, background: "var(--m-border)", margin: "1.25rem 0" }} />
              {action === "accept" && (
                <>
                  <div className="m-field">
                    <label className="m-label">Confirmed Date & Time <span className="req">*</span></label>
                    <input className="m-input" type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
                  </div>
                  <div className="m-field">
                    <label className="m-label">Meeting Link <span className="req">*</span></label>
                    <input className="m-input" placeholder="https://meet.google.com/…" value={meetLink} onChange={(e) => setMeetLink(e.target.value)} />
                  </div>
                </>
              )}
              {action === "decline" && (
                <div className="m-confirm-box" style={{ marginBottom: "1rem" }}>
                  <div className="m-confirm-title"><i className="fa fa-solid fa-triangle-exclamation" /> Decline this session?</div>
                  <div className="m-confirm-sub">The student will be notified that their request was declined.</div>
                </div>
              )}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {action !== "accept" && (
                  <button className="m-primary-btn" onClick={() => setAction("accept")}>
                    <i className="fa fa-solid fa-circle-check" /> Accept & Set Link
                  </button>
                )}
                {action !== "decline" && (
                  <button className="m-action-btn danger" style={{ padding: "0.6rem 1rem", fontSize: "0.86rem" }} onClick={() => setAction("decline")}>
                    <i className="fa fa-solid fa-circle-xmark" /> Decline
                  </button>
                )}
                {action && (
                  <button className="m-cancel-btn" onClick={() => setAction(null)}>Cancel</button>
                )}
              </div>
            </>
          )}

          {/* Mark complete for accepted sessions */}
          {session.status === "accepted" && (
            <>
              <div style={{ height: 1, background: "var(--m-border)", margin: "1.25rem 0" }} />
              {action === "complete" ? (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="m-primary-btn" onClick={handleAction} disabled={saving}>
                    {saving ? <><i className="fa fa-solid fa-spinner fa-spin" /> Saving…</> : <><i className="fa fa-solid fa-flag-checkered" /> Confirm Complete</>}
                  </button>
                  <button className="m-cancel-btn" onClick={() => setAction(null)}>Cancel</button>
                </div>
              ) : (
                <button className="m-action-btn" style={{ padding: "0.6rem 1rem", fontSize: "0.86rem" }} onClick={() => setAction("complete")}>
                  <i className="fa fa-solid fa-flag-checkered" /> Mark as Completed
                </button>
              )}
            </>
          )}
        </div>

        <div className="m-modal-actions">
          <button className="m-cancel-btn" onClick={onClose}>Close</button>
          {action && session.status === "requested" && (
            <button className="m-save-btn m-save-btn--no-margin" onClick={handleAction} disabled={saving}>
              {saving
                ? <><i className="fa fa-solid fa-spinner fa-spin" /> Saving…</>
                : <><i className="fa fa-solid fa-check" /> Confirm</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MentorDashboard() {
  const [mentorUser, setMentorUser]   = useState(null);
  const [mentorData, setMentorData]   = useState({});
  const [academyId, setAcademyId]     = useState(null);
  const [academyData, setAcademyData] = useState({});
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState("overview");

  const [myContent, setMyContent]         = useState([]);
  const [sessions, setSessions]           = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [toast, setToast]                 = useState(null);

  // Modals
  const [showUpload, setShowUpload]         = useState(false);
  const [editContent, setEditContent]       = useState(null);
  const [activeSession, setActiveSession]   = useState(null);
  const [deletingContent, setDeletingContent] = useState(null);

  // Sessions filter
  const [sessionFilter, setSessionFilter] = useState("all");

  function showToast(type, msg) { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); }

  // ── Auth & load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.href = "/"; return; }

      const email = user.email;
      const academiesSnap = await getDocs(collection(db, "academies"));
      let foundId = null;
      let foundEmpData = {};

      for (const aDoc of academiesSnap.docs) {
        const empSnap = await getDoc(doc(db, "academies", aDoc.id, "employees", email));
        if (empSnap.exists() && empSnap.data().role === "mentor") {
          if (empSnap.data().markedForDeletion) {
            await signOut(auth); window.location.href = "/"; return;
          }
          foundId = aDoc.id;
          foundEmpData = empSnap.data();
          setAcademyData(aDoc.data());
          break;
        }
      }

      if (!foundId) { window.location.href = "/dashboard"; return; }

      setMentorUser(user);
      setMentorData(foundEmpData);
      setAcademyId(foundId);

      await Promise.all([
        loadContent(foundId, email),
        loadSessions(foundId, email),
        loadAnnouncements(foundId),
      ]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function loadContent(aId, email) {
    const snap = await getDocs(
      query(collection(db, "academies", aId, "content"),
        where("uploadedBy", "==", email),
        orderBy("createdAt", "desc"))
    );
    setMyContent(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  async function loadSessions(aId, email) {
    const snap = await getDocs(
      query(collection(db, "academies", aId, "sessions"),
        where("mentorId", "==", email),
        orderBy("createdAt", "desc"))
    );
    setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  async function loadAnnouncements(aId) {
    const snap = await getDocs(
      query(collection(db, "academies", aId, "announcements"), orderBy("createdAt", "desc"))
    );
    setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  async function deleteContent(contentId) {
    try {
      await deleteDoc(doc(db, "academies", academyId, "content", contentId));
      setMyContent((prev) => prev.filter((c) => c.id !== contentId));
      setDeletingContent(null);
      showToast("success", "Content deleted.");
    } catch (e) {
      showToast("error", "Failed to delete content.");
    }
  }

  // ── Derived stats ───────────────────────────────────────────────────────────
  const liveContent       = myContent.filter((c) => c.status === "live");
  const pendingSessions   = sessions.filter((s) => s.status === "requested");
  const acceptedSessions  = sessions.filter((s) => s.status === "accepted");
  const completedSessions = sessions.filter((s) => s.status === "completed");

  const filteredSessions =
    sessionFilter === "all"
      ? sessions
      : sessions.filter((s) => s.status === sessionFilter);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="m-loading">
        <div className="m-loading-inner">
          <div className="m-spinner" />
          <div className="m-loading-text">Loading your workspace…</div>
        </div>
      </div>
    );
  }

  const mentorName = mentorData.name || mentorUser?.email || "Mentor";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="m-root">

      {/* ── Sidebar ── */}
      <aside className="m-sidebar">
        <div className="m-sidebar-brand">
          <div className="m-brand-eyebrow">Ekalavya Portal</div>
          <div className="m-brand-name">Ekalavya</div>
          <span className="m-brand-role">
            <i className="fa fa-solid fa-chalkboard-user" style={{ marginRight: 5 }} />
            Mentor
          </span>
        </div>

        <nav className="m-nav">
          <div className="m-nav-label">Dashboard</div>
          {[
            { key: "overview",      icon: "fa-gauge",          label: "Overview"       },
            { key: "content",       icon: "fa-folder-open",    label: "My Content"     },
            { key: "sessions",      icon: "fa-calendar-check", label: "Sessions"       },
            { key: "announcements", icon: "fa-bullhorn",       label: "Announcements"  },
            { key: "profile",       icon: "fa-user",           label: "My Profile"     },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              className={`m-nav-btn ${tab === key ? "active" : ""}`}
              onClick={() => setTab(key)}
            >
              <span className="nav-icon"><i className={`fa fa-solid ${icon}`} /></span>
              {label}
              {key === "sessions" && pendingSessions.length > 0 && (
                <span className="m-nav-badge">{pendingSessions.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="m-sidebar-footer">
          <div className="m-footer-label">Signed in as</div>
          <div className="m-footer-email">{mentorUser?.email}</div>
          <button className="m-signout-btn" onClick={() => signOut(auth).then(() => (window.location.href = "/"))}>
            <i className="fa fa-solid fa-arrow-right-from-bracket" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="m-main">

        {/* ══ OVERVIEW ══════════════════════════════════════════════════════ */}
        {tab === "overview" && (
          <>
            <div className="m-page-header">
              <div className="m-page-title">
                Welcome, <span>{mentorName.split(" ")[0]}</span>
              </div>
              <div className="m-page-sub">{academyData.name || "Your Academy"}</div>
            </div>

            <div className="m-stats-row">
              <StatCard icon="fa-folder-open"    label="My Content"   value={myContent.length}        accent="#1e3a5f" />
              <StatCard icon="fa-circle-dot"     label="Live"         value={liveContent.length}       accent="#15803d" />
              <StatCard icon="fa-clock"          label="Pending"      value={pendingSessions.length}   accent="#0369a1" />
              <StatCard icon="fa-calendar-check" label="Upcoming"     value={acceptedSessions.length}  accent="#5c35a0" />
              <StatCard icon="fa-flag-checkered" label="Completed"    value={completedSessions.length} accent="#64748b" />
            </div>

            {/* Pending session requests */}
            {pendingSessions.length > 0 && (
              <div className="m-card">
                <div className="m-card-header-row">
                  <div className="m-card-title m-card-title--no-margin">
                    <i className="fa fa-solid fa-clock" /> Pending Session Requests
                  </div>
                  <button className="m-action-btn" onClick={() => setTab("sessions")}>View all →</button>
                </div>
                <div className="m-recent-list">
                  {pendingSessions.slice(0, 4).map((s) => (
                    <div key={s.id} className="m-recent-item" onClick={() => { setActiveSession(s); setTab("sessions"); }}>
                      <i className="fa fa-solid fa-user-graduate" style={{ color: "#0369a1", fontSize: "0.85rem", flexShrink: 0 }} />
                      <span className="m-recent-subject">{s.topic}</span>
                      <span className="m-recent-meta">{s.studentEmail} · {formatDate(s.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent content */}
            <div className="m-card">
              <div className="m-card-header-row">
                <div className="m-card-title m-card-title--no-margin">
                  <i className="fa fa-solid fa-clock-rotate-left" /> Recently Uploaded
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="m-primary-btn" onClick={() => setShowUpload(true)}>
                    <i className="fa fa-solid fa-plus" /> Upload
                  </button>
                  <button className="m-action-btn" onClick={() => setTab("content")}>View all →</button>
                </div>
              </div>
              {myContent.length === 0 ? (
                <div className="m-empty" style={{ padding: "2rem 1rem" }}>
                  <i className="fa fa-solid fa-folder-open" />
                  <p>No content yet</p>
                  <div className="m-empty-sub">Upload your first resource.</div>
                </div>
              ) : (
                <div className="m-recent-list">
                  {myContent.slice(0, 5).map((c) => (
                    <div key={c.id} className="m-recent-item" onClick={() => setTab("content")}>
                      <i className="fa fa-solid fa-file-lines" style={{ color: "#1e3a5f", fontSize: "0.85rem", flexShrink: 0 }} />
                      <span className="m-recent-subject">{c.title}</span>
                      <span className="m-recent-meta">{c.type} · {formatDate(c.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Announcements preview */}
            {announcements.length > 0 && (
              <div className="m-card">
                <div className="m-card-header-row">
                  <div className="m-card-title m-card-title--no-margin">
                    <i className="fa fa-solid fa-bullhorn" /> Latest Announcements
                  </div>
                  <button className="m-action-btn" onClick={() => setTab("announcements")}>View all →</button>
                </div>
                <div className="m-recent-list">
                  {announcements.slice(0, 3).map((a) => {
                    const meta = ANN_TYPE_META[a.type] || ANN_TYPE_META.general;
                    return (
                      <div key={a.id} className="m-recent-item" onClick={() => setTab("announcements")}>
                        <i className={`fa fa-solid ${meta.icon}`} style={{ color: "#5c35a0", fontSize: "0.85rem", flexShrink: 0 }} />
                        <span className="m-recent-subject">{a.title}</span>
                        <span className="m-recent-meta">{formatDate(a.createdAt)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══ MY CONTENT ════════════════════════════════════════════════════ */}
        {tab === "content" && (
          <>
            <div className="m-page-header--row">
              <div>
                <div className="m-page-title">My <span>Content</span></div>
                <div className="m-page-sub">{myContent.length} item{myContent.length !== 1 ? "s" : ""} uploaded</div>
              </div>
              <button className="m-primary-btn" onClick={() => setShowUpload(true)}>
                <i className="fa fa-solid fa-plus" /> Upload Content
              </button>
            </div>

            {myContent.length === 0 ? (
              <div className="m-card">
                <div className="m-empty">
                  <i className="fa fa-solid fa-folder-open" />
                  <p>No content yet</p>
                  <div className="m-empty-sub">Click "Upload Content" to add your first resource.</div>
                </div>
              </div>
            ) : (
              <div className="m-content-list">
                {myContent.map((c) => (
                  <div key={c.id}>
                    <div className="m-content-row" onClick={() => {}}>
                      <div className={`m-content-accent m-content-accent--${c.status}`} />
                      <div className="m-content-body">
                        <div className="m-content-title">{c.title}</div>
                        <div className="m-content-meta">
                          {c.type && <span><i className="fa fa-solid fa-tag" />{c.type}</span>}
                          {c.url && <span><i className="fa fa-solid fa-link" />Link attached</span>}
                          {c.status === "removed" && (
                            <span style={{ color: "var(--m-danger)" }}>
                              <i className="fa fa-solid fa-triangle-exclamation" /> Removed by CM
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="m-content-right">
                        <span className={`m-status-chip m-status-chip--${c.status}`}>
                          {c.status === "live" ? "Live" : "Removed"}
                        </span>
                        <span className={`m-vis-chip m-vis-chip--${c.visibility}`}>
                          <i className={`fa fa-solid ${c.visibility === "public" ? "fa-globe" : "fa-lock"}`} />
                          {c.visibility === "public" ? "Public" : "Academy"}
                        </span>
                        <span className="m-content-date">{formatDate(c.createdAt)}</span>
                        <div className="m-action-row" onClick={(e) => e.stopPropagation()}>
                          <button className="m-action-btn" onClick={() => setEditContent(c)}>
                            <i className="fa fa-solid fa-pencil" />
                          </button>
                          <button className="m-action-btn danger" onClick={() => setDeletingContent(c.id)}>
                            <i className="fa fa-solid fa-trash" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Inline delete confirm */}
                    {deletingContent === c.id && (
                      <div style={{ margin: "-0.4rem 0 0.6rem", padding: "0 0.25rem" }}>
                        <div className="m-confirm-box">
                          <div className="m-confirm-title">
                            <i className="fa fa-solid fa-triangle-exclamation" /> Delete this content?
                          </div>
                          <div className="m-confirm-sub">This cannot be undone.</div>
                          <div className="m-confirm-actions">
                            <button className="m-confirm-btn" onClick={() => deleteContent(c.id)}>
                              <i className="fa fa-solid fa-trash" /> Yes, Delete
                            </button>
                            <button className="m-cancel-btn" onClick={() => setDeletingContent(null)}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ SESSIONS ══════════════════════════════════════════════════════ */}
        {tab === "sessions" && (
          <>
            <div className="m-page-header">
              <div className="m-page-title">Session <span>Requests</span></div>
              <div className="m-page-sub">
                {filteredSessions.length} session{filteredSessions.length !== 1 ? "s" : ""} shown
              </div>
            </div>

            {/* Filter buttons */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
              {[
                { key: "all",       label: "All"       },
                { key: "requested", label: "Pending"   },
                { key: "accepted",  label: "Accepted"  },
                { key: "completed", label: "Completed" },
                { key: "declined",  label: "Declined"  },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  className="m-action-btn"
                  style={sessionFilter === key ? { background: "var(--m-navy)", color: "#fff", borderColor: "var(--m-navy)" } : {}}
                  onClick={() => setSessionFilter(key)}
                >
                  {label}
                  {key === "requested" && pendingSessions.length > 0 && (
                    <span className="m-nav-badge" style={{ marginLeft: 4, background: "#b45309" }}>
                      {pendingSessions.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {filteredSessions.length === 0 ? (
              <div className="m-card">
                <div className="m-empty">
                  <i className="fa fa-solid fa-calendar-check" />
                  <p>No sessions here</p>
                </div>
              </div>
            ) : (
              <div className="m-session-list">
                {filteredSessions.map((s) => {
                  const sm = SESSION_STATUS_META[s.status] || SESSION_STATUS_META.requested;
                  return (
                    <div
                      key={s.id}
                      className="m-session-row"
                      style={{ cursor: "pointer" }}
                      onClick={() => setActiveSession(s)}
                    >
                      <div className={`m-session-accent m-session-accent--${s.status}`} />
                      <div className="m-session-body">
                        <div className="m-session-topic">{s.topic}</div>
                        <div className="m-session-meta">
                          <span><i className="fa fa-solid fa-user-graduate" />{s.studentEmail}</span>
                          {s.dateTime && (
                            <span><i className="fa fa-solid fa-calendar" />{formatDateTime(s.dateTime)}</span>
                          )}
                          {s.meetingLink && (
                            <span
                              onClick={(e) => { e.stopPropagation(); window.open(s.meetingLink, "_blank"); }}
                              style={{ color: "var(--m-blue-acc)", cursor: "pointer" }}
                            >
                              <i className="fa fa-solid fa-video" /> Join
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="m-session-right">
                        <span className={`m-status-chip m-status-chip--${s.status}`}>
                          <i className={`fa fa-solid ${sm.icon}`} /> {sm.label}
                        </span>
                        <span className="m-session-date">{formatDate(s.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══ ANNOUNCEMENTS ═════════════════════════════════════════════════ */}
        {tab === "announcements" && (
          <>
            <div className="m-page-header">
              <div className="m-page-title"><span>Announcements</span></div>
              <div className="m-page-sub">From your Content Management officer</div>
            </div>

            {announcements.length === 0 ? (
              <div className="m-card">
                <div className="m-empty">
                  <i className="fa fa-solid fa-bullhorn" />
                  <p>No announcements yet</p>
                </div>
              </div>
            ) : (
              <div className="m-ann-list">
                {announcements.map((a) => {
                  const meta = ANN_TYPE_META[a.type] || ANN_TYPE_META.general;
                  return (
                    <div key={a.id} className="m-ann-row">
                      <div className={`m-ann-accent m-ann-accent--${a.type}`} />
                      <div className="m-ann-header">
                        <div className="m-ann-title">{a.title}</div>
                        <span className={`m-ann-chip m-ann-chip--${a.type}`}>
                          <i className={`fa fa-solid ${meta.icon}`} /> {meta.label}
                        </span>
                      </div>
                      <div className="m-ann-body-text">{a.body}</div>
                      <div className="m-ann-footer">
                        <span className="m-ann-date">
                          <i className="fa fa-solid fa-clock" style={{ marginRight: 4 }} />
                          {formatDate(a.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══ MY PROFILE ════════════════════════════════════════════════════ */}
        {tab === "profile" && (
          <>
            <div className="m-page-header">
              <div className="m-page-title">My <span>Profile</span></div>
            </div>

            <div className="m-profile-hero">
              <div className="m-avatar">{initials(mentorName)}</div>
              <div>
                <div className="m-profile-name">{mentorName}</div>
                <div className="m-profile-email">{mentorUser?.email}</div>
                <span className="m-profile-role">
                  <i className="fa fa-solid fa-chalkboard-user" style={{ marginRight: 5 }} />
                  Mentor
                </span>
              </div>
            </div>

            <div className="m-card">
              <div className="m-card-title"><i className="fa fa-solid fa-circle-info" /> Personal Details</div>
              <div className="m-info-grid">
                <div>
                  <div className="m-info-label">Full Name</div>
                  <div className="m-info-val">{mentorData.name || "—"}</div>
                </div>
                <div>
                  <div className="m-info-label">Gender</div>
                  <div className="m-info-val" style={{ textTransform: "capitalize" }}>{mentorData.gender || "—"}</div>
                </div>
                <div>
                  <div className="m-info-label">Age</div>
                  <div className="m-info-val">{mentorData.age || "—"}</div>
                </div>
                <div>
                  <div className="m-info-label">Login ID</div>
                  <div className="m-info-val" style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>{mentorData.loginId || mentorUser?.email}</div>
                </div>
                <div>
                  <div className="m-info-label">Member since</div>
                  <div className="m-info-val">{formatDate(mentorData.createdAt)}</div>
                </div>
              </div>
            </div>

            <div className="m-card">
              <div className="m-card-title"><i className="fa fa-solid fa-building-columns" /> Academy</div>
              <div className="m-info-grid">
                <div>
                  <div className="m-info-label">Academy Name</div>
                  <div className="m-info-val">{academyData.name || "—"}</div>
                </div>
                <div>
                  <div className="m-info-label">Founded by</div>
                  <div className="m-info-val">{academyData.founder || "—"}</div>
                </div>
                <div>
                  <div className="m-info-label">Established</div>
                  <div className="m-info-val">{academyData.yearEstablished || "—"}</div>
                </div>
                <div>
                  <div className="m-info-label">Address</div>
                  <div className="m-info-val">{academyData.address || "—"}</div>
                </div>
              </div>
            </div>

            <div className="m-card">
              <div className="m-card-title"><i className="fa fa-solid fa-chart-simple" /> My Activity</div>
              <div className="m-info-grid">
                <div>
                  <div className="m-info-label">Total Uploads</div>
                  <div className="m-info-val">{myContent.length}</div>
                </div>
                <div>
                  <div className="m-info-label">Live Content</div>
                  <div className="m-info-val">{liveContent.length}</div>
                </div>
                <div>
                  <div className="m-info-label">Sessions Completed</div>
                  <div className="m-info-val">{completedSessions.length}</div>
                </div>
                <div>
                  <div className="m-info-label">Pending Requests</div>
                  <div className="m-info-val">{pendingSessions.length}</div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── Modals ── */}
      {showUpload && (
        <UploadModal
          academyId={academyId}
          mentorEmail={mentorUser.email}
          mentorName={mentorData.name || mentorUser.email}
          onClose={() => setShowUpload(false)}
          onUploaded={(item) => setMyContent((prev) => [item, ...prev])}
          showToast={showToast}
        />
      )}

      {editContent && (
        <EditContentModal
          item={editContent}
          academyId={academyId}
          mentorEmail={mentorUser.email}
          onClose={() => setEditContent(null)}
          onUpdated={(updated) => setMyContent((prev) => prev.map((c) => c.id === updated.id ? updated : c))}
          showToast={showToast}
        />
      )}

      {activeSession && (
        <SessionModal
          session={activeSession}
          academyId={academyId}
          mentorEmail={mentorUser.email}
          onClose={() => setActiveSession(null)}
          onUpdated={(updated) => {
            setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s));
            setActiveSession(updated);
          }}
          showToast={showToast}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}