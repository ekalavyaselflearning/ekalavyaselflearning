import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  getDoc, getDocs, doc, collection,
  updateDoc, arrayUnion, query, where,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";
import "./ConflictResolution.css";
import useOgTags from "../useOgTags.jsx";

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

const STATUS_META = {
  open:        { label: "Open",        icon: "fa-circle-dot",   cls: "open"     },
  in_progress: { label: "In Progress", icon: "fa-rotate",       cls: "in_progress" },
  resolved:    { label: "Resolved",    icon: "fa-circle-check", cls: "resolved" },
};
const SOURCE_META = {
  student:  { label: "Student",  icon: "fa-user-graduate", color: "#7c3aed" },
  mentor:   { label: "Mentor",   icon: "fa-chalkboard-user", color: "#0d7377" },
  external: { label: "External", icon: "fa-user",           color: "#b45309" },
};

// ── Sub-components ────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`cr-toast cr-toast--${toast.type}`}>
      <i className={`fa fa-solid ${toast.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}`} />
      {toast.msg}
    </div>
  );
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div className="cr-stat-card" style={{ borderLeft: `4px solid ${accent}` }}>
      <div className="cr-stat-icon" style={{ background: accent + "18", color: accent }}>
        <i className={`fa fa-solid ${icon}`} />
      </div>
      <div>
        <div className="cr-stat-value">{value}</div>
        <div className="cr-stat-label">{label}</div>
      </div>
    </div>
  );
}

// ── Ticket Modal ──────────────────────────────────────────────────────────────
function TicketModal({ ticket, academyId, crEmail, onClose, onUpdated, showToast }) {
  useOgTags({
    title: "Conflict Resolution | Ekalavya",
    description: "Ekalavya",
    image:'vite.svg'
  });
  const [status, setStatus]       = useState(ticket.status);
  const [noteText, setNoteText]   = useState("");
  const [saving, setSaving]       = useState(false);
  const [addingNote, setAddingNote] = useState(false);

  const ticketRef = doc(db, "academies", academyId, "tickets", ticket.id);

  async function saveStatus() {
    if (status === ticket.status) { onClose(); return; }
    setSaving(true);
    try {
      await updateDoc(ticketRef, {
        status,
        updatedAt: new Date().toISOString(),
      });
      onUpdated({ ...ticket, status, updatedAt: new Date().toISOString() });
      showToast("success", "Ticket status updated.");
      onClose();
    } catch (e) {
      showToast("error", "Failed to update status.");
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      const note = {
        text: noteText.trim(),
        addedBy: crEmail,
        addedAt: new Date().toISOString(),
      };
      await updateDoc(ticketRef, {
        notes: arrayUnion(note),
        updatedAt: new Date().toISOString(),
      });
      onUpdated({
        ...ticket,
        notes: [...(ticket.notes || []), note],
        updatedAt: new Date().toISOString(),
      });
      setNoteText("");
      showToast("success", "Note added.");
    } catch (e) {
      showToast("error", "Failed to add note.");
    } finally {
      setAddingNote(false);
    }
  }

  const sm = STATUS_META[ticket.status];
  const src = SOURCE_META[ticket.source] || SOURCE_META.external;

  return (
    <div
      className="cr-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cr-modal">
        {/* ── Header ── */}
        <div className="cr-modal-header">
          <div className="cr-modal-header-top">
            <div className="cr-modal-subject">{ticket.subject}</div>
            <button className="cr-modal-close" onClick={onClose}>
              <i className="fa fa-solid fa-xmark" />
            </button>
          </div>
          <div className="cr-modal-chips">
            <span className={`cr-status-chip cr-status-chip--${ticket.status}`}>
              <i className={`fa fa-solid ${sm.icon}`} /> {sm.label}
            </span>
            <span className={`cr-source-chip cr-source-chip--${ticket.source}`}>
              <i className={`fa fa-solid ${src.icon}`} style={{ color: src.color }} /> {src.label}
            </span>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="cr-modal-body">

          {/* Detail grid */}
          <div className="cr-detail-grid">
            <div className="cr-detail-item">
              <div className="cr-detail-label">Submitted by</div>
              <div className="cr-detail-value">{ticket.submitterEmail || "—"}</div>
            </div>
            <div className="cr-detail-item">
              <div className="cr-detail-label">Submitted on</div>
              <div className="cr-detail-value">{formatDate(ticket.createdAt)}</div>
            </div>
            <div className="cr-detail-item">
              <div className="cr-detail-label">Last updated</div>
              <div className="cr-detail-value">{formatDate(ticket.updatedAt)}</div>
            </div>
            <div className="cr-detail-item">
              <div className="cr-detail-label">Ticket ID</div>
              <div className="cr-detail-value" style={{ fontSize: "0.75rem", color: "var(--cr-slate-light)", fontFamily: "monospace" }}>
                {ticket.id}
              </div>
            </div>

            {/* Parties involved */}
            <div className="cr-detail-item cr-detail-item--full">
              <div className="cr-detail-label">Parties involved</div>
              {ticket.parties?.length > 0 ? (
                <div className="cr-parties-list">
                  {ticket.parties.map((p, i) => (
                    <span key={i} className="cr-party-chip">{p}</span>
                  ))}
                </div>
              ) : (
                <div className="cr-detail-value cr-detail-value--muted">Not specified</div>
              )}
            </div>

            {/* Description */}
            <div className="cr-detail-item cr-detail-item--full">
              <div className="cr-detail-label">Description</div>
              <div className="cr-detail-value" style={{ whiteSpace: "pre-wrap" }}>
                {ticket.description || <span className="cr-detail-value--muted">No description provided.</span>}
              </div>
            </div>

            {/* Preferred resolution */}
            <div className="cr-detail-item cr-detail-item--full">
              <div className="cr-detail-label">Preferred resolution</div>
              <div className="cr-detail-value" style={{ whiteSpace: "pre-wrap" }}>
                {ticket.preferredResolution
                  ? ticket.preferredResolution
                  : <span className="cr-detail-value--muted">Not specified</span>}
              </div>
            </div>
          </div>

          <div className="cr-section-divider" />

          {/* ── Status changer ── */}
          <div className="cr-status-changer">
            <div className="cr-status-changer-label">Update Status</div>
            <div className="cr-status-options">
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <button
                  key={key}
                  className={`cr-status-option ${status === key ? `selected-${meta.cls}` : ""}`}
                  onClick={() => setStatus(key)}
                >
                  <i className={`fa fa-solid ${meta.icon}`} /> {meta.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cr-section-divider" />

          {/* ── Internal notes ── */}
          <div className="cr-notes-section">
            <div className="cr-notes-label">
              <i className="fa fa-solid fa-lock" style={{ marginRight: 5 }} />
              Internal Notes (not visible to submitter)
            </div>

            {ticket.notes?.length > 0 ? (
              <div className="cr-note-list">
                {[...ticket.notes].reverse().map((n, i) => (
                  <div key={i} className="cr-note-item">
                    <div className="cr-note-text">{n.text}</div>
                    <div className="cr-note-meta">
                      <i className="fa fa-solid fa-user" />
                      {n.addedBy}
                      <span>·</span>
                      {formatDateTime(n.addedAt)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "0.82rem", color: "var(--cr-slate-light)", marginBottom: "0.75rem", fontStyle: "italic" }}>
                No notes yet.
              </div>
            )}

            <div className="cr-note-add">
              <textarea
                className="cr-note-textarea"
                placeholder="Add an internal note…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <button
                className="cr-add-note-btn"
                onClick={addNote}
                disabled={addingNote || !noteText.trim()}
              >
                {addingNote
                  ? <i className="fa fa-solid fa-spinner fa-spin" />
                  : <><i className="fa fa-solid fa-plus" /> Add Note</>}
              </button>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="cr-modal-actions">
          <button className="cr-cancel-btn" onClick={onClose}>Close</button>
          <button className="cr-save-btn" onClick={saveStatus} disabled={saving}>
            {saving
              ? <><i className="fa fa-solid fa-spinner fa-spin" /> Saving…</>
              : <><i className="fa fa-solid fa-check" /> Save Status</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ConflictDashboard() {
  const [crUser, setCrUser]         = useState(null);
  const [academyId, setAcademyId]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState("overview");
  const [tickets, setTickets]       = useState([]);
  const [toast, setToast]           = useState(null);
  const [activeTicket, setActiveTicket] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter]   = useState("all");
  const [sourceFilter, setSourceFilter]   = useState("all");
  const [searchQuery, setSearchQuery]     = useState("");

  function showToast(type, msg) { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); }

  // ── Auth & data load ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      // if (!user) { window.location.href = "/"; return; }

      const email = user.email;

      // Find which academy this CR belongs to
      const academiesSnap = await getDocs(collection(db, "academies"));
      let foundAcademyId = null;

      for (const academyDoc of academiesSnap.docs) {
        const empSnap = await getDoc(
          doc(db, "academies", academyDoc.id, "employees", email)
        );
        if (empSnap.exists() && empSnap.data().role === "conflict_resolution") {
          // Guard: check not marked for deletion
          if (empSnap.data().markedForDeletion) {
            await signOut(auth);
            window.location.href = "/";
            return;
          }
          foundAcademyId = academyDoc.id;
          break;
        }
      }
      console.log("Found academy ID for CR:", foundAcademyId);
      // if (!foundAcademyId) { window.location.href = "/dashboard"; return; }

      setCrUser(user);
      setAcademyId(foundAcademyId);
      await loadTickets(foundAcademyId);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function loadTickets(aId) {
    const snap = await getDocs(collection(db, "academies", aId, "tickets"));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Sort newest first
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setTickets(list);
  }

  function handleTicketUpdated(updated) {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    if (activeTicket?.id === updated.id) setActiveTicket(updated);
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const openTickets     = tickets.filter((t) => t.status === "open");
  const progressTickets = tickets.filter((t) => t.status === "in_progress");
  const resolvedTickets = tickets.filter((t) => t.status === "resolved");

  // Resolved this calendar month
  const now = new Date();
  const resolvedThisMonth = resolvedTickets.filter((t) => {
    const d = new Date(t.updatedAt || t.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const studentCount  = tickets.filter((t) => t.source === "student").length;
  const mentorCount   = tickets.filter((t) => t.source === "mentor").length;
  const externalCount = tickets.filter((t) => t.source === "external").length;

  // ── Filtered ticket list ──────────────────────────────────────────────────
  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (sourceFilter !== "all" && t.source !== sourceFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inSubject = t.subject?.toLowerCase().includes(q);
      const inParties = t.parties?.some((p) => p.toLowerCase().includes(q));
      if (!inSubject && !inParties) return false;
    }
    return true;
  });

  // ── Open ticket from overview ─────────────────────────────────────────────
  function openTicket(ticket) {
    setActiveTicket(ticket);
    // If we're on the overview tab, switch to inbox so modal feels in-context
    if (tab === "overview") setTab("inbox");
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="cr-loading">
        <div className="cr-loading-inner">
          <div className="cr-spinner" />
          <div className="cr-loading-text">Loading your workspace…</div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="cr-root">

      {/* ── Sidebar ── */}
      <aside className="cr-sidebar">
        <div className="cr-sidebar-brand">
          <div className="cr-brand-eyebrow">Ekalavya Portal</div>
          <div className="cr-brand-name">Ekalavya</div>
          <span className="cr-brand-role">
            <i className="fa fa-solid fa-handshake" style={{ marginRight: 5 }} />
            Conflict Resolution
          </span>
        </div>

        <nav className="cr-nav">
          <div className="cr-nav-label">Dashboard</div>
          {[
            { key: "overview", icon: "fa-gauge",  label: "Overview" },
            { key: "inbox",    icon: "fa-inbox",  label: "Ticket Inbox" },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              className={`cr-nav-btn ${tab === key ? "active" : ""}`}
              onClick={() => setTab(key)}
            >
              <span className="cr-nav-icon"><i className={`fa fa-solid ${icon}`} /></span>
              {label}
              {key === "inbox" && openTickets.length > 0 && (
                <span className="cr-nav-badge">{openTickets.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="cr-sidebar-footer">
          <div className="cr-footer-label">Signed in as</div>
          <div className="cr-footer-email">{crUser?.email}</div>
          <button
            className="cr-signout-btn"
            onClick={() => signOut(auth).then(() => (window.location.href = "/"))}
          >
            <i className="fa fa-solid fa-arrow-right-from-bracket" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="cr-main">

        {/* ══ OVERVIEW ══════════════════════════════════════════════════════ */}
        {tab === "overview" && (
          <>
            <div className="cr-page-header">
              <div className="cr-page-title">
                Conflict <span>Resolution</span>
              </div>
              <div className="cr-page-sub">
                {tickets.length} total ticket{tickets.length !== 1 ? "s" : ""} across all sources
              </div>
            </div>

            {/* Stat cards */}
            <div className="cr-stats-row">
              <StatCard icon="fa-circle-dot"   label="Open"              value={openTickets.length}       accent="#b45309" />
              <StatCard icon="fa-rotate"       label="In Progress"       value={progressTickets.length}   accent="#0369a1" />
              <StatCard icon="fa-circle-check" label="Resolved (month)"  value={resolvedThisMonth.length} accent="#15803d" />
              <StatCard icon="fa-inbox"        label="Total Tickets"     value={tickets.length}           accent="#3067cd" />
            </div>

            {/* Source breakdown */}
            <div className="cr-source-row">
              <div className="cr-source-pill cr-source-pill--student">
                <i className="fa fa-solid fa-user-graduate" /> {studentCount} from Students
              </div>
              <div className="cr-source-pill cr-source-pill--mentor">
                <i className="fa fa-solid fa-chalkboard-user" /> {mentorCount} from Mentors
              </div>
              <div className="cr-source-pill cr-source-pill--external">
                <i className="fa fa-solid fa-user" /> {externalCount} External
              </div>
            </div>

            {/* Recent open tickets */}
            <div className="cr-card">
              <div className="cr-card-header-row">
                <div className="cr-card-title" style={{ marginBottom: 0 }}>
                  <i className="fa fa-solid fa-circle-dot" /> Open Tickets
                </div>
                <button
                  className="cr-filter-btn"
                  onClick={() => { setStatusFilter("open"); setTab("inbox"); }}
                >
                  View all →
                </button>
              </div>

              {openTickets.length === 0 ? (
                <div className="cr-empty" style={{ padding: "2rem 1rem" }}>
                  <i className="fa fa-solid fa-circle-check" />
                  <p>No open tickets</p>
                  <div className="cr-empty-sub">All caught up.</div>
                </div>
              ) : (
                <div className="cr-recent-list">
                  {openTickets.slice(0, 5).map((t) => {
                    const src = SOURCE_META[t.source] || SOURCE_META.external;
                    return (
                      <div key={t.id} className="cr-recent-item" onClick={() => openTicket(t)}>
                        <i
                          className={`fa fa-solid ${src.icon}`}
                          style={{ color: src.color, fontSize: "0.85rem", flexShrink: 0 }}
                        />
                        <span className="cr-recent-subject">{t.subject}</span>
                        <span className="cr-recent-meta">{formatDate(t.createdAt)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent in-progress tickets */}
            {progressTickets.length > 0 && (
              <div className="cr-card">
                <div className="cr-card-title">
                  <i className="fa fa-solid fa-rotate" /> In Progress
                </div>
                <div className="cr-recent-list">
                  {progressTickets.slice(0, 5).map((t) => {
                    const src = SOURCE_META[t.source] || SOURCE_META.external;
                    return (
                      <div key={t.id} className="cr-recent-item" onClick={() => openTicket(t)}>
                        <i
                          className={`fa fa-solid ${src.icon}`}
                          style={{ color: src.color, fontSize: "0.85rem", flexShrink: 0 }}
                        />
                        <span className="cr-recent-subject">{t.subject}</span>
                        <span className="cr-recent-meta">{formatDate(t.updatedAt || t.createdAt)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══ INBOX ═════════════════════════════════════════════════════════ */}
        {tab === "inbox" && (
          <>
            <div className="cr-page-header">
              <div className="cr-page-title">Ticket <span>Inbox</span></div>
              <div className="cr-page-sub">
                {filteredTickets.length} ticket{filteredTickets.length !== 1 ? "s" : ""} shown
                {(statusFilter !== "all" || sourceFilter !== "all" || searchQuery) && " · filters active"}
              </div>
            </div>

            {/* Toolbar */}
            <div className="cr-toolbar">
              {/* Search */}
              <div className="cr-search-wrap">
                <i className="fa fa-solid fa-magnifying-glass" />
                <input
                  className="cr-search-input"
                  placeholder="Search by subject or party name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Status filters */}
              <div className="cr-filter-group">
                {[
                  { key: "all",         label: "All",         activeClass: "active-all"      },
                  { key: "open",        label: "Open",        activeClass: "active-open"     },
                  { key: "in_progress", label: "In Progress", activeClass: "active-progress" },
                  { key: "resolved",    label: "Resolved",    activeClass: "active-resolved" },
                ].map(({ key, label, activeClass }) => (
                  <button
                    key={key}
                    className={`cr-filter-btn ${statusFilter === key ? activeClass : ""}`}
                    onClick={() => setStatusFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="cr-filter-divider" />

              {/* Source filters */}
              <div className="cr-filter-group">
                {[
                  { key: "all",      label: "All sources", activeClass: "active-all"      },
                  { key: "student",  label: "Student",     activeClass: "active-student"  },
                  { key: "mentor",   label: "Mentor",      activeClass: "active-mentor"   },
                  { key: "external", label: "External",    activeClass: "active-external" },
                ].map(({ key, label, activeClass }) => (
                  <button
                    key={key}
                    className={`cr-filter-btn ${sourceFilter === key ? activeClass : ""}`}
                    onClick={() => setSourceFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Result count */}
            <div className="cr-result-count">
              Showing {filteredTickets.length} of {tickets.length} tickets
            </div>

            {/* Ticket list */}
            {filteredTickets.length === 0 ? (
              <div className="cr-card">
                <div className="cr-empty">
                  <i className="fa fa-solid fa-inbox" />
                  <p>No tickets match your filters</p>
                  <div className="cr-empty-sub">Try adjusting the status or source filter.</div>
                </div>
              </div>
            ) : (
              <div className="cr-ticket-list">
                {filteredTickets.map((t) => {
                  const sm  = STATUS_META[t.status]  || STATUS_META.open;
                  const src = SOURCE_META[t.source]  || SOURCE_META.external;
                  return (
                    <div
                      key={t.id}
                      className="cr-ticket-row"
                      onClick={() => setActiveTicket(t)}
                    >
                      {/* Left accent bar */}
                      <div className={`cr-ticket-accent cr-ticket-accent--${t.status}`} />

                      {/* Body */}
                      <div className="cr-ticket-body">
                        <div className="cr-ticket-subject">{t.subject}</div>
                        <div className="cr-ticket-meta">
                          <span>
                            <i className={`fa fa-solid ${src.icon}`} style={{ color: src.color }} />
                            {src.label}
                          </span>
                          {t.submitterEmail && (
                            <span>
                              <i className="fa fa-solid fa-at" />
                              {t.submitterEmail}
                            </span>
                          )}
                          {t.parties?.length > 0 && (
                            <span>
                              <i className="fa fa-solid fa-users" />
                              {t.parties.slice(0, 2).join(", ")}
                              {t.parties.length > 2 && ` +${t.parties.length - 2}`}
                            </span>
                          )}
                          {t.notes?.length > 0 && (
                            <span>
                              <i className="fa fa-solid fa-note-sticky" />
                              {t.notes.length} note{t.notes.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right */}
                      <div className="cr-ticket-right">
                        <span className={`cr-status-chip cr-status-chip--${t.status}`}>
                          <i className={`fa fa-solid ${sm.icon}`} /> {sm.label}
                        </span>
                        <span className="cr-ticket-date">{formatDate(t.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Ticket Modal ── */}
      {activeTicket && (
        <TicketModal
          ticket={activeTicket}
          academyId={academyId}
          crEmail={crUser.email}
          onClose={() => setActiveTicket(null)}
          onUpdated={handleTicketUpdated}
          showToast={showToast}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}