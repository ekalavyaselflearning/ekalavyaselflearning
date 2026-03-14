import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  getDoc,
  setDoc,
  doc,
  collection,
  getDocs,
} from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { initializeApp } from "firebase/app";
import { auth, db } from "../firebase.js";
import "./admindashboard.css";
import useOgTags from "../useOgTags.jsx";

// ── Secondary Firebase app ────────────────────────────────────────────────────
let secondaryApp = null;
function getSecondaryAuth() {
  if (!secondaryApp) {
    secondaryApp = initializeApp(auth.app.options, "secondary");
  }
  return getAuth(secondaryApp);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

function dobToPassword(dob) {
  const [yyyy, mm, dd] = dob.split("-");
  return `${mm}_${dd}_${yyyy}`;
}

function deriveAge(dob) {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const ROLE_PREFIX = {
  mentor: "m",
  content_management: "cm",
  conflict_resolution: "cr",
};

const ROLE_OPTIONS = [
  { value: "mentor", label: "Mentor" },
  { value: "content_management", label: "Content Management" },
  { value: "conflict_resolution", label: "Conflict Resolution" },
];

async function generateAcademyId(name) {
  const slug = slugify(name).slice(0, 15) || "academy";
  const snap = await getDocs(collection(db, "academies"));
  let count = 0;
  snap.forEach((d) => { if (d.id.startsWith(slug + "-")) count++; });
  const num = String(count + 1).padStart(4, "0");
  const candidate = `${slug}-${num}@ekalavya.edu.in`;
  const exists = await getDoc(doc(db, "academies", candidate));
  if (exists.exists()) {
    return `${slug}-${String(count + 2).padStart(4, "0")}@ekalavya.edu.in`;
  }
  return candidate;
}

async function generateEmployeeId(firstName, role, academyId) {
  const prefix = ROLE_PREFIX[role];
  const name = slugify(firstName).slice(0, 10) || "emp";
  const empSnap = await getDocs(collection(db, "academies", academyId, "employees"));
  let count = 0;
  empSnap.forEach((d) => { if (d.id.startsWith(`${prefix}_`)) count++; });
  const num = String(count + 1).padStart(3, "0");
  return `${prefix}_${name}${num}@ekalavya.edu.in`;
}

const emptyEmployee = () => ({ name: "", dob: "", gender: "", role: "mentor" });
const emptyForm = () => ({
  academyName: "",
  founder: "",
  yearEstablished: "",
  address: "",
  googleBusiness: "",
  founderSignature: null,
  employees: [
    { name: "", dob: "", gender: "", role: "mentor" },
    { name: "", dob: "", gender: "", role: "content_management" },
    { name: "", dob: "", gender: "", role: "conflict_resolution" },
  ],
});

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  useOgTags({
    title: "Admins | Ekalavya",
    description: "Ekalavya",
    image:'vite.svg'
  });
  const [adminUser, setAdminUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(null);
  const [tab, setTab] = useState("register");
  const [form, setForm] = useState(emptyForm());
  const [academies, setAcademies] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const sigCanvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [sigMode, setSigMode] = useState("draw"); 
  const [createdCredentials, setCreatedCredentials] = useState(null);

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setIsAdmin(false); return; }
      setAdminUser(user);
      const snap = await getDoc(doc(db, "admins", user.email));
      console.log(user.uid)
      setIsAdmin(snap.exists());
    });
    return () => unsub();
  }, []);

  // ── Load academies ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAdmin && tab === "list") loadAcademies();
  }, [isAdmin, tab]);

  async function loadAcademies() {
    const snap = await getDocs(collection(db, "academies"));
    const list = [];
    for (const d of snap.docs) {
      const empSnap = await getDocs(collection(db, "academies", d.id, "employees"));
      list.push({
        id: d.id,
        ...d.data(),
        employees: empSnap.docs.map((e) => ({ id: e.id, ...e.data() })),
      });
    }
    setAcademies(list);
  }

  // ── Signature canvas ────────────────────────────────────────────────────────
  function canvasPointerDown(e) {
    drawingRef.current = true;
    const ctx = sigCanvasRef.current.getContext("2d");
    const r = sigCanvasRef.current.getBoundingClientRect();
    const scaleX = sigCanvasRef.current.width / r.width;
    const scaleY = sigCanvasRef.current.height / r.height;
    ctx.beginPath();
    ctx.moveTo((e.clientX - r.left) * scaleX, (e.clientY - r.top) * scaleY);
  }
  function canvasPointerMove(e) {
    if (!drawingRef.current) return;
    const ctx = sigCanvasRef.current.getContext("2d");
    const r = sigCanvasRef.current.getBoundingClientRect();
    const scaleX = sigCanvasRef.current.width / r.width;
    const scaleY = sigCanvasRef.current.height / r.height;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#c9a84c";
    ctx.lineTo((e.clientX - r.left) * scaleX, (e.clientY - r.top) * scaleY);
    ctx.stroke();
  }
  function canvasPointerUp() {
    drawingRef.current = false;
    setForm((f) => ({ ...f, founderSignature: sigCanvasRef.current.toDataURL() }));
  }
  function clearSignature() {
    const ctx = sigCanvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, sigCanvasRef.current.width, sigCanvasRef.current.height);
    setForm((f) => ({ ...f, founderSignature: null }));
  }

  // ── Employee handlers ───────────────────────────────────────────────────────
  function updateEmployee(idx, key, val) {
    if (key === "role") {
    const currentRole = form.employees[idx].role;
    const newRole = val;

    // Prevent changing away from a singleton role if it would leave zero
    const singletonRoles = ["content_management", "conflict_resolution"];
    if (singletonRoles.includes(currentRole) && currentRole !== newRole) {
      const roleCount = form.employees.filter(e => e.role === currentRole).length;
      if (roleCount <= 1) {
        showToast("error", `Exactly one ${ROLE_OPTIONS.find(r => r.value === currentRole)?.label} is required.`);
        return;
      }
    }
    // Prevent adding a second content manager or conflict resolution
    if (singletonRoles.includes(newRole)) {
      const roleCount = form.employees.filter(e => e.role === newRole).length;
      if (roleCount >= 1) {
        showToast("error", `Exactly one ${ROLE_OPTIONS.find(r => r.value === newRole)?.label} is allowed.`);
        return;
      }
    }
  }

  setForm((f) => {
    const emps = [...f.employees];
    emps[idx] = { ...emps[idx], [key]: val };
    return { ...f, employees: emps };
  });
  }
  function addEmployee() {
    setForm((f) => ({ ...f, employees: [...f.employees, emptyEmployee()] }));
  }
  function removeEmployee(idx) {
    const emp = form.employees[idx];
    const roleCount = form.employees.filter(e => e.role === emp.role).length;

    if (emp.role === "mentor" && roleCount <= 1) {
      showToast("error", "At least one Mentor must remain."); return;
    }
    if (emp.role === "content_management" && roleCount <= 1) {
      showToast("error", "Exactly one Content Manager is required."); return;
    }
    if (emp.role === "conflict_resolution" && roleCount <= 1) {
      showToast("error", "Exactly one Conflict Resolution person is required."); return;
    }
    setForm((f) => ({ ...f, employees: f.employees.filter((_, i) => i !== idx) }));
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const { academyName, founder, yearEstablished, address, employees } = form;
    if (!academyName || !founder || !yearEstablished || !address) {
      showToast("error", "Fill all required academy fields.");
      return;
    }
    for (const e of employees) {
      if (!e.name || !e.dob || !e.gender) {
        showToast("error", "Fill all required employee fields.");
        return;
      }
    }
    const mentors = employees.filter(e => e.role === "mentor");
    const cms = employees.filter(e => e.role === "content_management");
    const crs = employees.filter(e => e.role === "conflict_resolution");

    if (mentors.length < 1) {
      showToast("error", "At least one Mentor is required."); return;
    }
    if (cms.length !== 1) {
      showToast("error", "Exactly one Content Manager is required."); return;
    }
    if (crs.length !== 1) {
      showToast("error", "Exactly one Conflict Resolution person is required."); return;
    }
    setSubmitting(true);
    const credentials = [];
    try {
      const secondaryAuth = getSecondaryAuth();
      const academyId = await generateAcademyId(academyName);
      const academyPassword = `Ekalavya@${yearEstablished}`;
      const joinCode = await generateJoinCode();
      /*Use after getting to cludinary*/
      // const signatureURL = form.founderSignature
      //   ? await uploadSignatureToCloudinary(form.founderSignature)
      //   : null;
      const signatureURL = form.founderSignature ?? null;

      await createUserWithEmailAndPassword(secondaryAuth, academyId, academyPassword);
      await signOut(secondaryAuth);

      await setDoc(doc(db, "academies", academyId), {
        name: academyName,
        founder,
        yearEstablished,
        address,
        googleBusiness: form.googleBusiness || null,
        founderSignature: signatureURL,
        createdAt: new Date().toISOString(),
        createdBy: adminUser.email,
        joinCode:joinCode,
        loginId: academyId,
        linkedGAcc: null,        // ← add this
      });
      credentials.push({
        label: "Academy Login",
        name: academyName,
        username: academyId,
        password: academyPassword,
        joinCode:joinCode
      });

      for (const emp of employees) {
        const empId = await generateEmployeeId(emp.name, emp.role, academyId);
        const empPassword = dobToPassword(emp.dob);
        const age = deriveAge(emp.dob);

        await createUserWithEmailAndPassword(secondaryAuth, empId, empPassword);
        await signOut(secondaryAuth);

        await setDoc(doc(db, "academies", academyId, "employees", empId), {
          name: emp.name,
          dob: emp.dob,
          age,
          gender: emp.gender,
          role: emp.role,
          loginId: empId,
          firstLogin: true,
          createdAt: new Date().toISOString(),
          linkedGAcc: null,        // ← add this
        });
        credentials.push({
          label: ROLE_OPTIONS.find(r => r.value === emp.role)?.label,
          name: emp.name,
          username: empId,
          password: dobToPassword(emp.dob),
        });
      }

      setCreatedCredentials(credentials);
      setForm(emptyForm());
      clearSignature();
      setForm(emptyForm());
      clearSignature();
    } catch (err) {
      console.error(err);
      showToast("error", err.message || "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function generateJoinCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0,O,1,I to avoid confusion
    const generate = () => Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    
    let code = generate();
    // Collision check against existing academies
    const snap = await getDocs(collection(db, "academies"));
    const existingCodes = new Set(snap.docs.map(d => d.data().joinCode));
    while (existingCodes.has(code)) code = generate();
    return code;
  }
  async function uploadSignatureToCloudinary(dataUrl) {
    const formData = new FormData();
    formData.append("file", dataUrl);
    formData.append("upload_preset", "ekalavya_signatures"); // your preset name
    formData.append("folder", "signatures");

    const res = await fetch(
      "https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/image/upload", // replace YOUR_CLOUD_NAME
      { method: "POST", body: formData }
    );
    const data = await res.json();
    return data.secure_url;
  }
  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4500);
  }

  // ── Gate screens ────────────────────────────────────────────────────────────
  if (isAdmin === null) {
    return (
      <div className="admin-gate">
        <div className="admin-gate-icon">
          <i className="fa fa-solid fa-spinner fa-spin" style={{ color: "#c9a84c" }} />
        </div>
        <h2>Verifying Access</h2>
        <p>Checking admin credentials…</p>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="admin-gate">
        <div className="admin-gate-icon">
          <i className="fa fa-solid fa-lock" style={{ color: "#e05252" }} />
        </div>
        <h2>Access Denied</h2>
        <p>You do not have administrator privileges.</p>
      </div>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────
  return (
    <div className="admin-root">

      {/* ── Sidebar ── */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <div className="brand-eyebrow">Admin Console</div>
          <div className="brand-name">Ekalavya</div>
          <div className="brand-tag">System Online</div>
        </div>

        <div className="admin-nav-section">
          <div className="admin-nav-label">Management</div>
          <button
            className={`admin-nav-btn ${tab === "register" ? "active" : ""}`}
            onClick={() => setTab("register")}
          >
            <span className="nav-icon"><i className="fa fa-solid fa-building-columns" /></span>
            Register Academy
          </button>
          <button
            className={`admin-nav-btn ${tab === "list" ? "active" : ""}`}
            onClick={() => setTab("list")}
          >
            <span className="nav-icon"><i className="fa fa-solid fa-list-ul" /></span>
            All Academies
          </button>
        </div>

        <div className="admin-sidebar-footer">
          <div className="footer-label">Signed in as</div>
          <div className="footer-email">{adminUser?.email}</div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="admin-main">

        {/* ══ Register Tab ══════════════════════════════════════════════════ */}
        {tab === "register" && (
          <>
            <div className="admin-page-header">
              <div>
                <div className="admin-page-title">
                  Register <span>Academy</span>
                </div>
                <div className="admin-page-sub">
                  Fields marked <span className="req-star">*</span> are required.
                  Optional fields carry no marker.
                </div>
              </div>
            </div>

            {/* Academy Details */}
            <div className="admin-card">
              <div className="admin-card-title">
                <i className="fa fa-solid fa-building" />
                Academy Details
              </div>
              <div className="admin-grid-2">
                <div className="admin-field">
                  <label className="admin-label">
                    Academy Name <span className="req">*</span>
                  </label>
                  <input
                    className="admin-input"
                    placeholder="e.g. Greenwood Academy"
                    value={form.academyName}
                    onChange={(e) => setForm((f) => ({ ...f, academyName: e.target.value }))}
                  />
                </div>
                <div className="admin-field">
                  <label className="admin-label">
                    Founder Name <span className="req">*</span>
                  </label>
                  <input
                    className="admin-input"
                    placeholder="e.g. Dr. Ramesh Kumar"
                    value={form.founder}
                    onChange={(e) => setForm((f) => ({ ...f, founder: e.target.value }))}
                  />
                </div>
                <div className="admin-field">
                  <label className="admin-label">
                    Year of Establishment <span className="req">*</span>
                  </label>
                  <input
                    className="admin-input"
                    type="number"
                    placeholder="e.g. 2010"
                    min="1900"
                    max={new Date().getFullYear()}
                    value={form.yearEstablished}
                    onChange={(e) => setForm((f) => ({ ...f, yearEstablished: e.target.value }))}
                  />
                </div>
                <div className="admin-field">
                  <label className="admin-label">
                    Google Business Profile
                  </label>
                  <input
                    className="admin-input"
                    placeholder="https://business.google.com/…"
                    value={form.googleBusiness}
                    onChange={(e) => setForm((f) => ({ ...f, googleBusiness: e.target.value }))}
                  />
                </div>
                <div className="admin-field full">
                  <label className="admin-label">
                    Physical Address <span className="req">*</span>
                  </label>
                  <textarea
                    className="admin-textarea"
                    placeholder="Full address of the academy…"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Founder Signature */}
            <div className="admin-card">
              <div className="admin-card-title">
                <i className="fa fa-solid fa-signature" />
                Founder Signature <span className="req" style={{ marginLeft: 4 }}>*</span>
              </div>
              <div className="admin-sig-wrap">
                <canvas
                  ref={sigCanvasRef}
                  width={600}
                  height={150}
                  className="admin-sig-canvas"
                  onMouseDown={sigMode === "draw" ? canvasPointerDown : undefined}
                  onMouseMove={sigMode === "draw" ? canvasPointerMove : undefined}
                  onMouseUp={sigMode === "draw" ? canvasPointerUp : undefined}
                  onMouseLeave={sigMode === "draw" ? canvasPointerUp : undefined}
                  style={{ cursor: sigMode === "draw" ? "crosshair" : "not-allowed" }}
                />
                <button className="admin-sig-clear" onClick={()=>{clearSignature();setSigMode("draw");}}>
                  <i className="fa fa-solid fa-rotate-left" style={{ marginRight: 6 }} />
                  Clear Signature
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.5rem" }}>
                  <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>or</span>
                  <label htmlFor="sig-upload" className="admin-sig-upload-label">
                    <i className="fa fa-solid fa-upload" style={{ marginRight: 6 }} />
                    Upload Signature Image
                  </label>
                  <input
                    id="sig-upload"
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const img = new Image();
                        img.onload = () => {
                          const ctx = sigCanvasRef.current.getContext("2d");
                          ctx.clearRect(0, 0, sigCanvasRef.current.width, sigCanvasRef.current.height);
                          ctx.drawImage(img, 0, 0, sigCanvasRef.current.width, sigCanvasRef.current.height);
                          setForm((f) => ({ ...f, founderSignature: sigCanvasRef.current.toDataURL() }));
                          setSigMode("uploaded");
                        };
                        img.src = ev.target.result;
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Employees */}
            <div className="admin-card">
              <div className="admin-card-title">
                <i className="fa fa-solid fa-users" />
                Management Employees
              </div>

              {form.employees.map((emp, idx) => (
                <div key={idx} className="admin-emp-card">
                  {form.employees.length > 1 && (
                    <button className="admin-remove-btn" onClick={() => removeEmployee(idx)}>
                      <i className="fa fa-solid fa-xmark" style={{ marginRight: 4 }} />
                      Remove
                    </button>
                  )}
                  <div className="admin-emp-number">Employee #{idx + 1}</div>
                  <div className="admin-grid-2">
                    <div className="admin-field">
                      <label className="admin-label">
                        Full Name <span className="req">*</span>
                      </label>
                      <input
                        className="admin-input"
                        placeholder="e.g. Arjun Sharma"
                        value={emp.name}
                        data-id='name'
                        onChange={(e) => updateEmployee(idx, "name", e.target.value)}
                      />
                    </div>
                    <div className="admin-field">
                      <label className="admin-label">
                        Date of Birth <span className="req">*</span>
                      </label>
                      <input
                        className="admin-input"
                        type="date"
                        value={emp.dob}
                        max={new Date().toISOString().split("T")[0]}
                        onChange={(e) => updateEmployee(idx, "dob", e.target.value)}
                      />
                      {emp.dob && (
                        <span className="admin-input-hint">
                          Age: {deriveAge(emp.dob)} · Default password: <code>{dobToPassword(emp.dob)}</code>
                        </span>
                      )}
                    </div>
                    <div className="admin-field">
                      <label className="admin-label">
                        Gender <span className="req">*</span>
                      </label>
                      <select
                        className="admin-select"
                        value={emp.gender}
                        onChange={(e) => updateEmployee(idx, "gender", e.target.value)}
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer_not">Prefer not to say</option>
                      </select>
                    </div>
                    <div className="admin-field">
                      <label className="admin-label">
                        Role <span className="req">*</span>
                      </label>
                      <select
                        className="admin-select"
                        value={emp.role}
                        onChange={(e) => updateEmployee(idx, "role", e.target.value)}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <button className="admin-add-emp-btn" onClick={addEmployee}>
                <i className="fa fa-solid fa-plus" />
                Add Another Employee
              </button>
            </div>

            <div className="admin-submit-row">
              <button
                className="admin-submit-btn"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? <><i className="fa fa-solid fa-spinner fa-spin" /> Registering…</>
                  : <><i className="fa fa-solid fa-check" /> Register Academy</>
                }
              </button>
            </div>
          </>
        )}

        {/* ══ List Tab ══════════════════════════════════════════════════════ */}
        {tab === "list" && (
          <>
            <div className="admin-page-header">
              <div>
                <div className="admin-page-title">All <span>Academies</span></div>
                <div className="admin-page-sub">Click a row to expand employee details.</div>
              </div>
            </div>

            <div className="admin-card">
              {academies.length === 0 ? (
                <div className="admin-empty">
                  <i className="fa fa-solid fa-building-columns" />
                  <p>No academies registered yet.</p>
                </div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Academy</th>
                      <th>Login ID</th>
                      <th>Founder</th>
                      <th>Est.</th>
                      <th>Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academies.map((a) => (
                      <>
                        <tr key={a.id} onClick={() => setExpanded(expanded === a.id ? null : a.id)}>
                          <td>
                            <div className="academy-name">{a.name}</div>
                            {a.googleBusiness && (
                              <a
                                href={a.googleBusiness}
                                target="_blank"
                                rel="noreferrer"
                                className="google-link"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <i className="fa fa-brands fa-google" />
                                Business Profile
                              </a>
                            )}
                          </td>
                          <td><span className="admin-id-chip">{a.id}</span></td>
                          <td>{a.founder}</td>
                          <td>{a.yearEstablished}</td>
                          <td>
                            <span className="admin-badge staff">{a.employees.length} staff</span>
                          </td>
                        </tr>

                        {expanded === a.id && (
                          <tr key={a.id + "-sub"} className="admin-emp-subtable-row">
                            <td colSpan={5}>
                              <div className="admin-emp-subtable">

                                {/* ── Academy Details ── */}
                                <div className="admin-emp-subtable-header">
                                  <i className="fa fa-solid fa-building-columns" />
                                  {a.name} — Full Details
                                </div>
                                <div style={{ padding: "1rem 1.25rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem 2rem", borderBottom: "1px solid #dbeafe" }}>
                                  {[
                                    { label: "Founder",       value: a.founder },
                                    { label: "Established",   value: a.yearEstablished },
                                    { label: "Address",       value: a.address },
                                    { label: "Login ID",      value: a.id },
                                    { label: "Join Code",     value: a.joinCode },
                                    { label: "Linked Google", value: a.linkedGAcc || "Not linked yet" },
                                  ].map(({ label, value }) => (
                                    <div key={label} style={{ fontSize: "0.83rem", padding: "0.3rem 0" }}>
                                      <span style={{ fontWeight: 700, color: "#64748b", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", display: "block" }}>{label}</span>
                                      <span style={{ color: "#1e293b" }}>{value}</span>
                                    </div>
                                  ))}
                                  {a.googleBusiness && (
                                    <div style={{ fontSize: "0.83rem", padding: "0.3rem 0" }}>
                                      <span style={{ fontWeight: 700, color: "#64748b", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", display: "block" }}>Google Business</span>
                                      <a href={a.googleBusiness} target="_blank" rel="noreferrer" className="google-link">{a.googleBusiness}</a>
                                    </div>
                                  )}
                                  {a.founderSignature && (
                                    <div style={{ fontSize: "0.83rem", padding: "0.3rem 0", gridColumn: "1 / -1" }}>
                                      <span style={{ fontWeight: 700, color: "#64748b", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Founder Signature</span>
                                      <img src={a.founderSignature} alt="Founder Signature" style={{ height: 60, border: "1px solid #dbeafe", borderRadius: 8, background: "#f8faff", padding: 4 }} />
                                    </div>
                                  )}
                                </div>

                                {/* ── Employees ── */}
                                <div className="admin-emp-subtable-header" style={{ borderTop: "none" }}>
                                  <i className="fa fa-solid fa-users" />
                                  Employees & Credentials
                                </div>
                                <table className="admin-table">
                                  <thead>
                                    <tr>
                                      <th>Name</th>
                                      <th>Login ID</th>
                                      <th>Password</th>
                                      <th>Role</th>
                                      <th>Age</th>
                                      <th>Gender</th>
                                      <th>Google</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {a.employees.map((emp) => (
                                      <tr key={emp.id} onClick={(e) => e.stopPropagation()}>
                                        <td style={{ fontWeight: 600, color: "#1e293b" }}>{emp.name}</td>
                                        <td><span className="admin-id-chip">{emp.id}</span></td>
                                        <td><span className="admin-id-chip">{dobToPassword(emp.dob)}</span></td>
                                        <td>
                                          <span className={`admin-badge ${emp.role}`}>
                                            {ROLE_OPTIONS.find(r => r.value === emp.role)?.label || emp.role}
                                          </span>
                                        </td>
                                        <td>{emp.age}</td>
                                        <td style={{ textTransform: "capitalize" }}>{emp.gender}</td>
                                        <td style={{ fontSize: "0.75rem", color: emp.linkedGAcc ? "#059669" : "#94a3b8" }}>
                                          {emp.linkedGAcc || "Not linked"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>

                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
      {createdCredentials && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 9998
        }}>
          <div className="admin-card" style={{
            width: 580, maxHeight: "82vh",
            overflowY: "auto", margin: 0,
            boxShadow: "0 24px 64px rgba(0,0,0,0.2)"
          }}>
            <div className="admin-card-title">
              <i className="fa fa-solid fa-key" />
              Registration Complete — Note Down Credentials
            </div>

            <p style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: "1.25rem", lineHeight: 1.6 }}>
              These credentials will <strong>not</strong> be shown again.
              Note them down and hand them to the respective person securely.
              Users may link their Google account on first login — until then,
              <code style={{ background: "rgba(48,103,205,0.08)", color: "#3067cd", padding: "1px 6px", borderRadius: 4, marginLeft: 4 }}>linkedGAcc</code> remains empty.
            </p>

            {createdCredentials.map((c, i) => (
              <div key={i} style={{
                background: "#f8faff",
                border: "1px solid #dbeafe",
                borderRadius: 10,
                padding: "1rem 1.25rem",
                marginBottom: "0.75rem"
              }}>
                <div style={{
                  fontSize: "0.68rem", fontWeight: 700,
                  color: "#3067cd", textTransform: "uppercase",
                  letterSpacing: "0.1em", marginBottom: "0.65rem",
                  display: "flex", alignItems: "center", gap: 6
                }}>
                  <i className={`fa fa-solid ${c.label === "Academy Login"
                    ? "fa-building-columns"
                    : c.label === "Mentor"
                    ? "fa-chalkboard-user"
                    : c.label === "Content Management"
                    ? "fa-pen-nib"
                    : "fa-handshake"}`}
                  />
                  {c.label} — {c.name}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: "0.83rem", color: "#374151", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, minWidth: 80 }}>Username</span>
                    <code style={{
                      background: "rgba(48,103,205,0.08)", color: "#3067cd",
                      padding: "3px 10px", borderRadius: 6, fontSize: "0.78rem",
                      fontFamily: "'Courier New', monospace"
                    }}>{c.username}</code>
                  </div>
                  <div style={{ fontSize: "0.83rem", color: "#374151", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, minWidth: 80 }}>Password</span>
                    <code style={{
                      background: "rgba(48,103,205,0.08)", color: "#3067cd",
                      padding: "3px 10px", borderRadius: 6, fontSize: "0.78rem",
                      fontFamily: "'Courier New', monospace"
                    }}>{c.password}</code>
                  </div>
                  
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                    <i className="fa fa-brands fa-google" />
                    Google account will be linked by the user on first login
                  </div>

                  {c.joinCode && (
                    <div style={{ fontSize: "0.83rem", color: "#374151", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, minWidth: 80 }}>Join Code</span>
                      <code style={{
                        background: "rgba(48,103,205,0.08)", color: "#3067cd",
                        padding: "3px 10px", borderRadius: 6, fontSize: "0.78rem",
                        fontFamily: "'Courier New', monospace", letterSpacing: "0.15em"
                      }}>{c.joinCode}</code>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem" }}>
              <button
                className="admin-submit-btn"
                onClick={() => setCreatedCredentials(null)}
              >
                <i className="fa fa-solid fa-check" /> Done, Credentials Noted
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          <i className={`fa fa-solid ${toast.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}`} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}