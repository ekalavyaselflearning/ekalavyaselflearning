import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged, signOut, getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getDoc, setDoc, doc, collection, getDocs, updateDoc } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { auth, db } from "../firebase.js";
import "./FounderDashboard.css";

// ── Secondary app (used only for creating new employee Auth accounts) ─────────
let secondaryApp = null;
function getSecondaryAuth() {
  if (!secondaryApp) secondaryApp = initializeApp(auth.app.options, "secondary-founder");
  return getAuth(secondaryApp);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function slugify(str) { return str.toLowerCase().trim().replace(/[^a-z0-9]/g, ""); }
function dobToPassword(dob) { const [yyyy, mm, dd] = dob.split("-"); return `${mm}_${dd}_${yyyy}`; }
function deriveAge(dob) {
  const today = new Date(), birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const ROLE_PREFIX = { mentor: "m", content_management: "cm", conflict_resolution: "cr" };
const ROLE_OPTIONS = [
  { value: "mentor",              label: "Mentor",        icon: "fa-chalkboard-user", color: "#0d7377" },
  { value: "content_management",  label: "Content Mgmt",  icon: "fa-pen-nib",         color: "#5c35a0" },
  { value: "conflict_resolution", label: "Conflict Res.", icon: "fa-handshake",       color: "#b45309" },
];

async function generateEmployeeId(firstName, role, academyId) {
  const prefix = ROLE_PREFIX[role];
  const name   = slugify(firstName).slice(0, 10) || "emp";
  const snap   = await getDocs(collection(db, "academies", academyId, "employees"));
  let count = 0;
  snap.forEach((d) => { if (d.id.startsWith(`${prefix}_`)) count++; });
  return `${prefix}_${name}${String(count + 1).padStart(3, "0")}@ekalavya.edu.in`;
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, accent }) {
  return (
    <div className="fd-stat-card" style={{ borderLeft: `4px solid ${accent}` }}>
      <div className="fd-stat-icon" style={{ background: accent + "18", color: accent }}>
        <i className={`fa fa-solid ${icon}`} />
      </div>
      <div>
        <div className="fd-stat-value">{value}</div>
        <div className="fd-stat-label">{label}</div>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`fd-toast fd-toast--${toast.type}`}>
      <i className={`fa fa-solid ${toast.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}`} />
      {toast.msg}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FounderDashboard() {
  const [founder, setFounder]             = useState(null);
  const [academyId, setAcademyId]         = useState(null);
  const [academy, setAcademy]             = useState(null);
  // employees includes both active and markedForDeletion ones so the table
  // can visually distinguish them — we filter display by tab need
  const [employees, setEmployees]         = useState([]);
  const [students, setStudents]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [tab, setTab]                     = useState("overview");
  const [toast, setToast]                 = useState(null);

  // Academy edit
  const [editForm, setEditForm]           = useState({});
  const [editSaving, setEditSaving]       = useState(false);

  // Signature canvas
  const sigCanvasRef                      = useRef(null);
  const drawingRef                        = useRef(false);
  const [sigMode, setSigMode]             = useState("draw");

  // Add employee modal
  const [empModal, setEmpModal]           = useState(null); // null | { data: {} }
  const [empSaving, setEmpSaving]         = useState(false);

  // Delete confirm: { [empId]: "confirm" | "deleting" } | null
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ── Auth & load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.href = "/"; return; }
      const email = user.email;
      const snap  = await getDoc(doc(db, "academies", email));
      if (!snap.exists()) { window.location.href = "/dashboard"; return; }
      setFounder(user);
      setAcademyId(email);
      const data = snap.data();
      setAcademy(data);
      setEditForm({
        name: data.name || "", founder: data.founder || "",
        yearEstablished: data.yearEstablished || "",
        address: data.address || "", googleBusiness: data.googleBusiness || "",
      });
      await loadEmployees(email);
      await loadStudents(data.joinCode);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function loadEmployees(aId) {
    const snap = await getDocs(collection(db, "academies", aId, "employees"));
    setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  async function loadStudents(joinCode) {
    if (!joinCode) return;
    const snap = await getDocs(collection(db, "learners"));
    setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.joinCode === joinCode));
  }

  function showToast(type, msg) { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); }

  // ── Signature canvas ──────────────────────────────────────────────────────────
  function canvasDown(e) {
    drawingRef.current = true;
    const ctx = sigCanvasRef.current.getContext("2d");
    const r   = sigCanvasRef.current.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(
      (e.clientX - r.left) * (sigCanvasRef.current.width  / r.width),
      (e.clientY - r.top)  * (sigCanvasRef.current.height / r.height)
    );
  }
  function canvasMove(e) {
    if (!drawingRef.current) return;
    const ctx = sigCanvasRef.current.getContext("2d");
    const r   = sigCanvasRef.current.getBoundingClientRect();
    ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#1e3a5f";
    ctx.lineTo(
      (e.clientX - r.left) * (sigCanvasRef.current.width  / r.width),
      (e.clientY - r.top)  * (sigCanvasRef.current.height / r.height)
    );
    ctx.stroke();
  }
  function canvasUp() {
    drawingRef.current = false;
    setEditForm((f) => ({ ...f, founderSignature: sigCanvasRef.current.toDataURL() }));
  }
  function clearSig() {
    sigCanvasRef.current.getContext("2d").clearRect(0, 0, sigCanvasRef.current.width, sigCanvasRef.current.height);
    setEditForm((f) => ({ ...f, founderSignature: null }));
    setSigMode("draw");
  }

  // ── Save academy info ─────────────────────────────────────────────────────────
  async function saveAcademy() {
    if (!editForm.name || !editForm.founder || !editForm.yearEstablished || !editForm.address) {
      showToast("error", "Please fill all required fields."); return;
    }
    setEditSaving(true);
    try {
      const update = {
        name: editForm.name, founder: editForm.founder,
        yearEstablished: editForm.yearEstablished, address: editForm.address,
        googleBusiness: editForm.googleBusiness || null,
      };
      if (editForm.founderSignature) update.founderSignature = editForm.founderSignature;
      await updateDoc(doc(db, "academies", academyId), update);
      setAcademy((a) => ({ ...a, ...update }));
      showToast("success", "Academy details updated.");
    } catch (e) { showToast("error", e.message || "Failed to save."); }
    finally { setEditSaving(false); }
  }

  // ── Add employee ──────────────────────────────────────────────────────────────
  // No edit allowed. Add creates the Auth account + Firestore doc.
  function openAddEmployee() {
    setEmpModal({ data: { name: "", dob: "", gender: "", role: "mentor" } });
  }

  async function saveEmployee() {
    const { data } = empModal;
    if (!data.name || !data.dob || !data.gender || !data.role) {
      showToast("error", "Fill all employee fields."); return;
    }
    // Singleton role guards — exclude pending-deletion records from the count
    const activeEmployees = employees.filter((e) => !e.markedForDeletion);
    if (data.role === "content_management"  && activeEmployees.filter((e) => e.role === "content_management").length  >= 1) {
      showToast("error", "Only one Content Manager allowed."); return;
    }
    if (data.role === "conflict_resolution" && activeEmployees.filter((e) => e.role === "conflict_resolution").length >= 1) {
      showToast("error", "Only one Conflict Resolution person allowed."); return;
    }
    setEmpSaving(true);
    try {
      const sa    = getSecondaryAuth();
      const empId = await generateEmployeeId(data.name, data.role, academyId);
      await createUserWithEmailAndPassword(sa, empId, dobToPassword(data.dob));
      await signOut(sa);
      await setDoc(doc(db, "academies", academyId, "employees", empId), {
        name: data.name, dob: data.dob, age: deriveAge(data.dob),
        gender: data.gender, role: data.role, loginId: empId,
        firstLogin: true, createdAt: new Date().toISOString(),
        linkedGAcc: null, markedForDeletion: false,
      });
      showToast("success", `Employee added. Login: ${empId}`);
      await loadEmployees(academyId);
      setEmpModal(null);
    } catch (e) { showToast("error", e.message || "Failed to add employee."); }
    finally { setEmpSaving(false); }
  }

  // ── Deferred deletion ─────────────────────────────────────────────────────────
  // Marks the employee with markedForDeletion: true and deletedAt timestamp.
  // Login.jsx detects this flag on their next login attempt, deletes the
  // Firestore doc and blocks access. Each role dashboard also checks on mount.
  // The optional Cloud Function (cleanupDeletedEmployees) handles any stragglers
  // who never log in again.
  async function markEmployeeForDeletion(empId) {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;

    // Role constraint checks against ACTIVE employees only
    const activeEmployees = employees.filter((e) => !e.markedForDeletion && e.id !== empId);
    if (emp.role === "mentor" && activeEmployees.filter((e) => e.role === "mentor").length < 1) {
      showToast("error", "At least one active Mentor must remain."); return;
    }
    if (
      (emp.role === "content_management" || emp.role === "conflict_resolution") &&
      activeEmployees.filter((e) => e.role === emp.role).length < 1
    ) {
      showToast("error", `Exactly one active ${emp.role.replace(/_/g, " ")} is required.`); return;
    }

    setDeleteConfirm((prev) => ({ ...prev, [empId]: "deleting" }));
    try {
      await updateDoc(doc(db, "academies", academyId, "employees", empId), {
        markedForDeletion: true,
        deletedAt: new Date().toISOString(),
        deletedBy: founder.email,
      });
      // Update local state so the row immediately shows the pending badge
      setEmployees((prev) =>
        prev.map((e) => e.id === empId
          ? { ...e, markedForDeletion: true, deletedAt: new Date().toISOString() }
          : e
        )
      );
      showToast("success", `${emp.name} marked for removal. Access denied on next login.`);
    } catch (e) {
      showToast("error", e.message || "Failed to mark employee for deletion.");
    } finally {
      setDeleteConfirm(null);
    }
  }

  // ── Undo deletion mark ────────────────────────────────────────────────────────
  // Lets the founder reverse a pending deletion before the employee logs in.
  async function undoDeletion(empId) {
    try {
      await updateDoc(doc(db, "academies", academyId, "employees", empId), {
        markedForDeletion: false,
        deletedAt: null,
        deletedBy: null,
      });
      setEmployees((prev) =>
        prev.map((e) => e.id === empId
          ? { ...e, markedForDeletion: false, deletedAt: null }
          : e
        )
      );
      showToast("success", "Removal cancelled — employee access restored.");
    } catch (e) {
      showToast("error", "Failed to undo removal.");
    }
  }

  // ── Derived counts (active only — exclude pending-deletion) ──────────────────
  const activeEmployees = employees.filter((e) => !e.markedForDeletion);
  const pendingEmployees = employees.filter((e) => e.markedForDeletion);
  const roleInfo    = (role) => ROLE_OPTIONS.find((r) => r.value === role) || { label: role, icon: "fa-user", color: "#64748b" };
  const mentorCount = activeEmployees.filter((e) => e.role === "mentor").length;
  const cmCount     = activeEmployees.filter((e) => e.role === "content_management").length;
  const crCount     = activeEmployees.filter((e) => e.role === "conflict_resolution").length;

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fd-loading">
        <div className="fd-loading-inner">
          <div className="fd-spinner" />
          <div className="fd-loading-text">Loading your academy…</div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="fd-root">

      {/* ── Sidebar ── */}
      <aside className="fd-sidebar">
        <div className="fd-sidebar-brand">
          <div className="fd-brand-eyebrow">Ekalavya Portal</div>
          <div className="fd-brand-name">{academy?.name || "Academy"}</div>
          <span className="fd-brand-role">Founder</span>
        </div>

        <nav className="fd-nav">
          <div className="fd-nav-label">Dashboard</div>
          {[
            { key: "overview",  icon: "fa-gauge",    label: "Overview"     },
            { key: "academy",   icon: "fa-building", label: "Academy Info" },
            { key: "employees", icon: "fa-users",    label: "Employees"    },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              className={`fd-nav-btn ${tab === key ? "active" : ""}`}
              onClick={() => setTab(key)}
            >
              <span className="nav-icon"><i className={`fa fa-solid ${icon}`} /></span>
              {label}
              {/* Badge for pending deletions on the Employees tab */}
              {key === "employees" && pendingEmployees.length > 0 && (
                <span className="fd-nav-badge">{pendingEmployees.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="fd-sidebar-footer">
          <div className="fd-footer-email">{founder?.email}</div>
          <button
            className="fd-signout-btn"
            onClick={() => signOut(auth).then(() => (window.location.href = "/"))}
          >
            <i className="fa fa-solid fa-arrow-right-from-bracket" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="fd-main">

        {/* ══ OVERVIEW ══════════════════════════════════════════════════════ */}
        {tab === "overview" && (
          <>
            <div className="fd-page-header">
              <div className="fd-page-title">
                Good day, <span>{academy?.founder}</span>
              </div>
              <div className="fd-page-sub">Here's a snapshot of your academy.</div>
            </div>

            {/* Join code banner */}
            <div className="fd-joincode-card">
              <div>
                <div className="fd-joincode-label">Student Join Code</div>
                <div className="fd-joincode-val">{academy?.joinCode || "—"}</div>
              </div>
              <button
                className="fd-copy-btn"
                onClick={() => { navigator.clipboard.writeText(academy?.joinCode || ""); showToast("success", "Join code copied!"); }}
              >
                <i className="fa fa-solid fa-copy" /> Copy Code
              </button>
            </div>

            {/* Stats */}
            <div className="fd-stats-row">
              <StatCard icon="fa-user-graduate"   label="Students"      value={students.length} accent="#1e3a5f" />
              <StatCard icon="fa-chalkboard-user" label="Mentors"       value={mentorCount}     accent="#0d7377" />
              <StatCard icon="fa-pen-nib"         label="Content Mgmt"  value={cmCount}         accent="#5c35a0" />
              <StatCard icon="fa-handshake"       label="Conflict Res." value={crCount}         accent="#b45309" />
            </div>

            {/* Academy quick info */}
            <div className="fd-card">
              <div className="fd-card-title"><i className="fa fa-solid fa-building" /> Academy Details</div>
              <div className="fd-info-grid">
                {[
                  { label: "Founded",  value: academy?.yearEstablished },
                  { label: "Founder",  value: academy?.founder         },
                  { label: "Address",  value: academy?.address         },
                  { label: "Login ID", value: academyId                },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="fd-info-item-label">{label}</div>
                    <div className="fd-info-item-val">{value || "—"}</div>
                  </div>
                ))}
                {academy?.googleBusiness && (
                  <div>
                    <div className="fd-info-item-label">Google Business</div>
                    <a href={academy.googleBusiness} target="_blank" rel="noreferrer" className="fd-info-link">
                      View Profile →
                    </a>
                  </div>
                )}
              </div>
              {academy?.founderSignature && (
                <div className="fd-sig-preview-wrap">
                  <div className="fd-info-item-label">Founder Signature</div>
                  <img src={academy.founderSignature} alt="Signature" className="fd-sig-preview" />
                </div>
              )}
            </div>

            {/* Staff preview */}
            <div className="fd-card">
              <div className="fd-card-header-row">
                <div className="fd-card-title fd-card-title--no-margin">
                  <i className="fa fa-solid fa-users" /> Staff
                </div>
                <button className="fd-action-btn" onClick={() => setTab("employees")}>Manage →</button>
              </div>
              {activeEmployees.length === 0 ? (
                <div className="fd-empty"><i className="fa fa-solid fa-users" /><p>No active employees yet.</p></div>
              ) : (
                <table className="fd-emp-table">
                  <thead><tr><th>Name</th><th>Role</th><th>Login ID</th></tr></thead>
                  <tbody>
                    {activeEmployees.slice(0, 5).map((emp) => {
                      const ri = roleInfo(emp.role);
                      return (
                        <tr key={emp.id}>
                          <td className="fd-emp-name">{emp.name}</td>
                          <td>
                            <span className="fd-role-chip" style={{ background: ri.color + "18", color: ri.color }}>
                              <i className={`fa fa-solid ${ri.icon}`} /> {ri.label}
                            </span>
                          </td>
                          <td><span className="fd-id-chip">{emp.id}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ══ ACADEMY INFO ══════════════════════════════════════════════════ */}
        {tab === "academy" && (
          <>
            <div className="fd-page-header">
              <div className="fd-page-title">Academy <span>Information</span></div>
              <div className="fd-page-sub">Update your academy's public and operational details.</div>
            </div>

            <div className="fd-card">
              <div className="fd-card-title"><i className="fa fa-solid fa-building" /> Core Details</div>
              <div className="fd-grid-2">
                <div className="fd-field">
                  <label className="fd-label">Academy Name <span className="req">*</span></label>
                  <input className="fd-input" value={editForm.name || ""} placeholder="e.g. Greenwood Academy"
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="fd-field">
                  <label className="fd-label">Founder Name <span className="req">*</span></label>
                  <input className="fd-input" value={editForm.founder || ""} placeholder="e.g. Dr. Ramesh Kumar"
                    onChange={(e) => setEditForm((f) => ({ ...f, founder: e.target.value }))} />
                </div>
                <div className="fd-field">
                  <label className="fd-label">Year Established <span className="req">*</span></label>
                  <input className="fd-input" type="number" value={editForm.yearEstablished || ""}
                    placeholder="e.g. 2010" min="1900" max={new Date().getFullYear()}
                    onChange={(e) => setEditForm((f) => ({ ...f, yearEstablished: e.target.value }))} />
                </div>
                <div className="fd-field">
                  <label className="fd-label">Google Business Profile</label>
                  <input className="fd-input" value={editForm.googleBusiness || ""}
                    placeholder="https://business.google.com/…"
                    onChange={(e) => setEditForm((f) => ({ ...f, googleBusiness: e.target.value }))} />
                </div>
                <div className="fd-field full">
                  <label className="fd-label">Physical Address <span className="req">*</span></label>
                  <textarea className="fd-textarea" value={editForm.address || ""}
                    placeholder="Full address of the academy…"
                    onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="fd-card">
              <div className="fd-card-title"><i className="fa fa-solid fa-signature" /> Founder Signature</div>
              <canvas
                ref={sigCanvasRef} width={600} height={120}
                className="fd-sig-canvas"
                style={{ cursor: sigMode === "draw" ? "crosshair" : "not-allowed" }}
                onMouseDown={sigMode === "draw" ? canvasDown : undefined}
                onMouseMove={sigMode === "draw" ? canvasMove : undefined}
                onMouseUp={sigMode === "draw" ? canvasUp : undefined}
                onMouseLeave={sigMode === "draw" ? canvasUp : undefined}
              />
              <div className="fd-sig-actions">
                <button className="fd-sig-clear" onClick={clearSig}>
                  <i className="fa fa-solid fa-rotate-left" /> Clear
                </button>
                <label htmlFor="sig-upload-edit" className="fd-upload-label">
                  <i className="fa fa-solid fa-upload" /> Upload Image
                </label>
                <input id="sig-upload-edit" type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files[0]; if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const img = new Image();
                      img.onload = () => {
                        const ctx = sigCanvasRef.current.getContext("2d");
                        ctx.clearRect(0, 0, sigCanvasRef.current.width, sigCanvasRef.current.height);
                        ctx.drawImage(img, 0, 0, sigCanvasRef.current.width, sigCanvasRef.current.height);
                        setEditForm((f) => ({ ...f, founderSignature: sigCanvasRef.current.toDataURL() }));
                        setSigMode("uploaded");
                      };
                      img.src = ev.target.result;
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                {academy?.founderSignature && (
                  <span className="fd-sig-hint">Current signature stored — draw or upload to replace</span>
                )}
              </div>
            </div>

            <div className="fd-save-row">
              <button className="fd-save-btn" onClick={saveAcademy} disabled={editSaving}>
                {editSaving
                  ? <><i className="fa fa-solid fa-spinner fa-spin" /> Saving…</>
                  : <><i className="fa fa-solid fa-check" /> Save Changes</>}
              </button>
            </div>
          </>
        )}

        {/* ══ EMPLOYEES ═════════════════════════════════════════════════════ */}
        {tab === "employees" && (
          <>
            <div className="fd-page-header--row">
              <div>
                <div className="fd-page-title">Staff <span>Management</span></div>
                <div className="fd-page-sub">
                  {activeEmployees.length} active · {pendingEmployees.length} pending removal ·
                  Requires 1+ Mentors, exactly 1 CM, exactly 1 CR
                </div>
              </div>
              <button className="fd-add-emp-btn" onClick={openAddEmployee}>
                <i className="fa fa-solid fa-plus" /> Add Employee
              </button>
            </div>

            {/* Role constraint indicators — based on active employees only */}
            <div className="fd-role-constraints">
                <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                    <div className="fd-role-desc-card" style={{ borderTop: `3px solid #0d7377` }}>
                        <div className="fd-role-desc-icon" style={{ background: "#0d737718", color: "#0d7377" }}>
                        <i className="fa fa-solid fa-chalkboard-user" />
                        </div>
                        <div className="fd-role-desc-title" style={{ color: "#0d7377" }}>Mentor</div>
                        <ul className="fd-role-desc-list">
                        <li>Upload videos, test series, assignments and solved PYQs</li>
                        <li>Set content visibility — public or academy-only per upload</li>
                        <li>Conduct one-to-one mentoring sessions on request basis</li>
                        <li>Accept or decline student session requests and share meeting links</li>
                        </ul>
                    </div>

                    <div className="fd-role-desc-card" style={{ borderTop: `3px solid #5c35a0` }}>
                        <div className="fd-role-desc-icon" style={{ background: "#5c35a018", color: "#5c35a0" }}>
                        <i className="fa fa-solid fa-pen-nib" />
                        </div>
                        <div className="fd-role-desc-title" style={{ color: "#5c35a0" }}>Content Management</div>
                        <ul className="fd-role-desc-list">
                        <li>Review all live content and remove material that does not meet standards</li>
                        <li>Push announcements to students for exams, assignments and assessments</li>
                        <li>Guide mentors on structuring and improving their content</li>
                        <li>Coordinate with mentors to ensure timely and relevant uploads</li>
                        </ul>
                    </div>

                    <div className="fd-role-desc-card" style={{ borderTop: `3px solid #b45309` }}>
                        <div className="fd-role-desc-icon" style={{ background: "#b4530918", color: "#b45309" }}>
                        <i className="fa fa-solid fa-handshake" />
                        </div>
                        <div className="fd-role-desc-title" style={{ color: "#b45309" }}>Conflict Resolution</div>
                        <ul className="fd-role-desc-list">
                        <li>Receive and manage dispute tickets from students, mentors and external users</li>
                        <li>Track ticket status from open through in-progress to resolved</li>
                        <li>Add investigation notes and communicate outcomes to involved parties</li>
                        <li>Escalate unresolved or serious disputes to the founder</li>
                        </ul>
                    </div>
                    </div>
              {ROLE_OPTIONS.map((r) => {
                const count = activeEmployees.filter((e) => e.role === r.value).length;
                const ok    = r.value === "mentor" ? count >= 1 : count === 1;
                return (
                  <div key={r.value} className="fd-constraint-pill"
                    style={{
                      background: ok ? r.color + "12" : "#fef2f2",
                      border: `1.5px solid ${ok ? r.color + "30" : "#fecaca"}`,
                      color: ok ? r.color : "#dc2626",
                    }}>
                    <i className={`fa fa-solid ${ok ? "fa-circle-check" : "fa-circle-xmark"}`} />
                    {count} {r.label}
                  </div>
                );
              })}
            </div>

            {/* ── Active employees ── */}
            <div className="fd-card fd-card--flush">
              <div className="fd-emp-section-label">
                <i className="fa fa-solid fa-circle-check" style={{ color: "#0d7377" }} /> Active Staff
              </div>
              {activeEmployees.length === 0 ? (
                <div className="fd-empty">
                  <i className="fa fa-solid fa-users" />
                  <p>No active employees. Add your first team member.</p>
                </div>
              ) : (
                <table className="fd-emp-table">
                  <thead>
                    <tr>
                      <th>Name</th><th>Role</th><th>Login ID</th>
                      <th>Default Password</th><th>Age</th><th>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEmployees.map((emp) => {
                      const ri = roleInfo(emp.role);
                      return (
                        <>
                          <tr key={emp.id}>
                            <td className="fd-emp-name">{emp.name}</td>
                            <td>
                              <span className="fd-role-chip" style={{ background: ri.color + "18", color: ri.color }}>
                                <i className={`fa fa-solid ${ri.icon}`} /> {ri.label}
                              </span>
                            </td>
                            <td><span className="fd-id-chip">{emp.id}</span></td>
                            <td><span className="fd-id-chip">{dobToPassword(emp.dob)}</span></td>
                            <td>{emp.age || deriveAge(emp.dob)}</td>
                            <td>
                              <button
                                className="fd-action-btn danger"
                                disabled={deleteConfirm?.[emp.id] === "deleting"}
                                onClick={() => setDeleteConfirm((prev) =>
                                  prev?.[emp.id] === "confirm" ? null : { [emp.id]: "confirm" }
                                )}
                              >
                                {deleteConfirm?.[emp.id] === "deleting"
                                  ? <i className="fa fa-solid fa-spinner fa-spin" />
                                  : <i className="fa fa-solid fa-user-xmark" />}
                              </button>
                            </td>
                          </tr>

                          {/* Inline confirmation row */}
                          {deleteConfirm?.[emp.id] === "confirm" && (
                            <tr key={emp.id + "-del"}>
                              <td colSpan={6} className="fd-delete-cell">
                                <div className="fd-delete-box">
                                  <div>
                                    <p className="fd-delete-title">
                                      <i className="fa fa-solid fa-triangle-exclamation" />
                                      Remove <strong>{emp.name}</strong>?
                                    </p>
                                    <p className="fd-delete-sub">
                                      Access will be denied immediately. Their account and data will be
                                      wiped the next time they attempt to log in.
                                      You can undo this before they log in.
                                    </p>
                                  </div>
                                  <div className="fd-delete-actions">
                                    <button className="fd-cancel-btn" onClick={() => setDeleteConfirm(null)}>
                                      Cancel
                                    </button>
                                    <button
                                      className="fd-confirm-del-btn"
                                      onClick={() => markEmployeeForDeletion(emp.id)}
                                    >
                                      <i className="fa fa-solid fa-user-xmark" /> Yes, Remove
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Pending deletion employees ── */}
            {pendingEmployees.length > 0 && (
              <div className="fd-card fd-card--flush">
                <div className="fd-emp-section-label fd-emp-section-label--pending">
                  <i className="fa fa-solid fa-clock" style={{ color: "#b45309" }} /> Pending Removal
                  <span className="fd-pending-note">
                    These employees are blocked from logging in. Their accounts will be
                    fully deleted on their next login attempt.
                  </span>
                </div>
                <table className="fd-emp-table">
                  <thead>
                    <tr><th>Name</th><th>Role</th><th>Login ID</th><th>Marked At</th><th>Undo</th></tr>
                  </thead>
                  <tbody>
                    {pendingEmployees.map((emp) => {
                      const ri = roleInfo(emp.role);
                      return (
                        <tr key={emp.id} className="fd-emp-row--pending">
                          <td className="fd-emp-name fd-emp-name--muted">
                            {emp.name}
                            <span className="fd-pending-chip">Pending Removal</span>
                          </td>
                          <td>
                            <span className="fd-role-chip" style={{ background: ri.color + "0d", color: ri.color + "99" }}>
                              <i className={`fa fa-solid ${ri.icon}`} /> {ri.label}
                            </span>
                          </td>
                          <td><span className="fd-id-chip fd-id-chip--muted">{emp.id}</span></td>
                          <td className="fd-muted-text">
                            {emp.deletedAt ? new Date(emp.deletedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                          </td>
                          <td>
                            <button className="fd-undo-btn" onClick={() => undoDeletion(emp.id)}>
                              <i className="fa fa-solid fa-rotate-left" /> Undo
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Add Employee Modal ── */}
      {empModal && (
        <div className="fd-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEmpModal(null); }}>
          <div className="fd-modal">
            <div className="fd-modal-title">
              <i className="fa fa-solid fa-user-plus" /> Add Employee
            </div>
            <div className="fd-grid-2">
              <div className="fd-field full">
                <label className="fd-label">Full Name <span className="req">*</span></label>
                <input className="fd-input" value={empModal.data.name} placeholder="e.g. Arjun Sharma"
                  onChange={(e) => setEmpModal((m) => ({ ...m, data: { ...m.data, name: e.target.value } }))} />
              </div>
              <div className="fd-field">
                <label className="fd-label">Date of Birth <span className="req">*</span></label>
                <input className="fd-input" type="date" value={empModal.data.dob}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setEmpModal((m) => ({ ...m, data: { ...m.data, dob: e.target.value } }))} />
                {empModal.data.dob && (
                  <div className="fd-hint">
                    Age: {deriveAge(empModal.data.dob)} · Password: <code>{dobToPassword(empModal.data.dob)}</code>
                  </div>
                )}
              </div>
              <div className="fd-field">
                <label className="fd-label">Gender <span className="req">*</span></label>
                <select className="fd-select" value={empModal.data.gender}
                  onChange={(e) => setEmpModal((m) => ({ ...m, data: { ...m.data, gender: e.target.value } }))}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not">Prefer not to say</option>
                </select>
              </div>
              <div className="fd-field full">
                <label className="fd-label">Role <span className="req">*</span></label>
                <select className="fd-select" value={empModal.data.role}
                  onChange={(e) => setEmpModal((m) => ({ ...m, data: { ...m.data, role: e.target.value } }))}>
                  {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div className="fd-modal-actions">
              <button className="fd-cancel-btn" onClick={() => setEmpModal(null)}>Cancel</button>
              <button className="fd-save-btn fd-save-btn--no-margin" onClick={saveEmployee} disabled={empSaving}>
                {empSaving
                  ? <><i className="fa fa-solid fa-spinner fa-spin" /> Adding…</>
                  : <><i className="fa fa-solid fa-user-plus" /> Add Employee</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
