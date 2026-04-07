import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

/* ── constants ─────────────────────────────────────────────── */

const INSTALL_CHECKLIST = [
  ["frame_installed",       "Frame"],
  ["shutter_installed",     "Shutter"],
  ["architraves_installed", "Architraves"],
  ["hinges_installed",      "Hinges"],
  ["lock_handle_installed", "Lock & handle"],
  ["stopper_installed",     "Door stopper"],
];

// Per-door items checked individually on delivery
const DEL_ITEMS = [
  ["del_frame",       "Frame"],
  ["del_shutter",     "Shutter"],
  ["del_architraves", "Architraves"],
];

// Hardware items distributed in bulk
const HW_KEYS = ["del_hinges","del_lock","del_cylinder","del_knob","del_handle","del_stopper"];

// Room → hardware type mapping
// Bedrooms, laundry, storage, ironing, toilet → cylinder + bowl stopper
// Bathrooms, powder rooms → knob + cylinder stopper
const CYLINDER_ROOMS = /bedroom|store|storage|laundry|iron|toilet|maid/i;
const KNOB_ROOMS     = /bathroom|bath|powder/i;

function roomHwType(room) {
  if (!room) return "cylinder"; // default
  if (KNOB_ROOMS.test(room)) return "knob";
  return "cylinder";
}

function deriveStatus(d) {
  if (d.status === "SNAGGED") return "SNAGGED";
  const done = INSTALL_CHECKLIST.filter(([k]) => d[k]).length;
  if (done === 6) return "INSTALLED";
  if (done > 0)   return "IN_PROGRESS";
  if (d.delivered_at) return "DELIVERED";
  return "PENDING";
}

/* ── App shell ─────────────────────────────────────────────── */

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [doors, setDoors] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const [dRes, tRes] = await Promise.all([
        supabase.from("doors").select("*").order("floor").order("apt_no").order("door_type").limit(2500),
        supabase.from("door_types").select("*").order("code"),
      ]);
      if (dRes.error) throw dRes.error;
      if (tRes.error) throw tRes.error;
      setDoors(dRes.data || []);
      setTypes(tRes.data || []);
    } catch (e) { setErr(e.message || String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateDoor = async (id, patch) => {
    setDoors(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
    const merged = { ...doors.find(d => d.id === id), ...patch };
    const newStatus = deriveStatus(merged);
    const fullPatch = { ...patch, status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "INSTALLED" && !merged.installed_at) fullPatch.installed_at = new Date().toISOString();
    if (newStatus !== "INSTALLED") fullPatch.installed_at = null;
    const delKeys = [...DEL_ITEMS.map(([k])=>k), ...HW_KEYS];
    const anyDel = delKeys.some(k => merged[k]);
    if (anyDel && !merged.delivered_at) fullPatch.delivered_at = new Date().toISOString();
    if (!anyDel && merged.delivered_at && !patch.delivered_at) fullPatch.delivered_at = null;
    const { error } = await supabase.from("doors").update(fullPatch).eq("id", id);
    if (error) { alert(error.message); load(); return; }
    setDoors(prev => prev.map(d => d.id === id ? { ...d, ...fullPatch } : d));
  };

  const bulkUpdate = async (updates) => {
    // updates = [{id, patch}, ...]
    setDoors(prev => {
      const map = new Map(updates.map(u => [u.id, u.patch]));
      return prev.map(d => map.has(d.id) ? { ...d, ...map.get(d.id) } : d);
    });
    for (const { id, patch } of updates) {
      const merged = { ...doors.find(d => d.id === id), ...patch };
      const delKeys = [...DEL_ITEMS.map(([k])=>k), ...HW_KEYS];
      const anyDel = delKeys.some(k => merged[k]);
      const fp = { ...patch, updated_at: new Date().toISOString() };
      if (anyDel && !merged.delivered_at) fp.delivered_at = new Date().toISOString();
      await supabase.from("doors").update(fp).eq("id", id);
    }
    load();
  };

  return (
    <div className="container">
      <div className="row" style={{justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:18,fontWeight:800}}>Helvetia Doors</div>
          <div className="small">Delivery & installation tracking · v2.9.0</div>
        </div>
        <button className="btn" onClick={load}>{loading ? "Loading…" : "Refresh"}</button>
      </div>

      {err && <div className="card" style={{marginTop:12}}><div style={{color:"#fecaca",fontWeight:700}}>Error</div><div className="small">{err}</div></div>}

      <div className="tabs" style={{marginTop:14}}>
        <button className={`tab ${tab==="dashboard"?"active":""}`} onClick={()=>setTab("dashboard")}>Dashboard</button>
        <button className={`tab ${tab==="delivery"?"active":""}`}  onClick={()=>setTab("delivery")}>Delivery</button>
        <button className={`tab ${tab==="install"?"active":""}`}   onClick={()=>setTab("install")}>Installation</button>
      </div>

      {tab === "dashboard" && <Dashboard doors={doors} />}
      {tab === "delivery"  && <DeliveryTab doors={doors} types={types} onUpdate={updateDoor} onBulk={bulkUpdate} />}
      {tab === "install"   && <InstallTab doors={doors} types={types} onUpdate={updateDoor} />}
    </div>
  );
}

/* ── Dashboard ─────────────────────────────────────────────── */

function Dashboard({ doors }) {
  const stats = useMemo(() => {
    const s = { total:0, PENDING:0, DELIVERED:0, IN_PROGRESS:0, INSTALLED:0, SNAGGED:0 };
    const delItems = { frames:0, shutters:0, architraves:0, hinges:0, locks:0, cylinders:0, knobs:0, handles:0, stoppers:0 };
    s.total = doors.length;
    doors.forEach(d => {
      s[d.status] = (s[d.status]||0)+1;
      if (d.del_frame) delItems.frames++;
      if (d.del_shutter) delItems.shutters++;
      if (d.del_architraves) delItems.architraves++;
      if (d.del_hinges) delItems.hinges++;
      if (d.del_lock) delItems.locks++;
      if (d.del_cylinder) delItems.cylinders++;
      if (d.del_knob) delItems.knobs++;
      if (d.del_handle) delItems.handles++;
      if (d.del_stopper) delItems.stoppers++;
    });
    return { ...s, delItems };
  }, [doors]);

  const byFloor = useMemo(() => {
    const m = new Map();
    doors.forEach(d => {
      if (!m.has(d.floor)) m.set(d.floor, { label: d.floor_label, total:0, installed:0, delivered:0 });
      const r = m.get(d.floor);
      r.total++;
      if (d.status === "INSTALLED") r.installed++;
      if (d.delivered_at) r.delivered++;
    });
    return Array.from(m.entries()).sort((a,b)=>a[0]-b[0]).map(([k,v])=>({floor:k,...v}));
  }, [doors]);

  const total = doors.length || 1;
  const di = stats.delItems;
  return (
    <>
      <div className="row" style={{marginBottom:12}}>
        <div className="stat"><div className="l">Total</div><div className="n">{stats.total}</div></div>
        <div className="stat"><div className="l">Pending</div><div className="n">{stats.PENDING}</div></div>
        <div className="stat"><div className="l">Delivered</div><div className="n">{stats.DELIVERED}</div></div>
        <div className="stat"><div className="l">In progress</div><div className="n">{stats.IN_PROGRESS}</div></div>
        <div className="stat"><div className="l">Installed</div><div className="n">{stats.INSTALLED}</div></div>
        <div className="stat"><div className="l">Snagged</div><div className="n">{stats.SNAGGED}</div></div>
      </div>

      <div className="card">
        <div style={{fontWeight:700,marginBottom:10}}>Delivery summary</div>
        <div className="kv" style={{gap:"6px 16px"}}>
          <div className="small">Frames</div><div>{di.frames}/{total}</div>
          <div className="small">Shutters</div><div>{di.shutters}/{total}</div>
          <div className="small">Architraves</div><div>{di.architraves}/{total}</div>
          <div className="small">Hinges</div><div>{di.hinges}/{total}</div>
          <div className="small">Locks</div><div>{di.locks}/{total}</div>
          <div className="small">Cylinders</div><div>{di.cylinders}/{total}</div>
          <div className="small">Knobs</div><div>{di.knobs}/{total}</div>
          <div className="small">Handle sets</div><div>{di.handles}/{total}</div>
          <div className="small">Door stoppers</div><div>{di.stoppers}/{total}</div>
        </div>
      </div>

      <div className="card">
        <div style={{fontWeight:700,marginBottom:10}}>Overall installation</div>
        <div className="bar"><span style={{width:`${(stats.INSTALLED/total)*100}%`}}/></div>
        <div className="small" style={{marginTop:6}}>{stats.INSTALLED} of {total} doors installed ({Math.round((stats.INSTALLED/total)*100)}%)</div>
        <hr/>
        <div style={{fontWeight:700,marginBottom:10}}>By floor</div>
        {byFloor.map(f => (
          <div key={f.floor} style={{marginBottom:10}}>
            <div className="row" style={{justifyContent:"space-between",marginBottom:4}}>
              <div className="small" style={{fontWeight:700,opacity:1}}>{f.label}</div>
              <div className="small">{f.installed}/{f.total} installed · {f.delivered}/{f.total} delivered</div>
            </div>
            <div className="bar"><span style={{width:`${(f.installed/f.total)*100}%`}}/></div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Delivery Tab ──────────────────────────────────────────── */

function DeliveryTab({ doors, types, onUpdate, onBulk }) {
  const [floor, setFloor] = useState("");
  const [apt, setApt] = useState("");
  const [openId, setOpenId] = useState(null);

  // Bulk distribute state
  const [hwType, setHwType] = useState("del_hinges");
  const [hwQty, setHwQty] = useState("");
  const [distributing, setDistributing] = useState(false);
  const [distResult, setDistResult] = useState(null);

  const floors = useMemo(() => {
    const m = new Map();
    doors.forEach(d => m.set(d.floor, d.floor_label));
    return Array.from(m.entries()).sort((a,b)=>a[0]-b[0]);
  }, [doors]);

  const apts = useMemo(() => {
    const s = new Set();
    doors.filter(d => floor === "" || String(d.floor) === floor).forEach(d => s.add(d.apt_no));
    return Array.from(s).sort();
  }, [doors, floor]);

  const filtered = useMemo(() => {
    return doors.filter(d => {
      if (floor !== "" && String(d.floor) !== floor) return false;
      if (apt   !== "" && d.apt_no !== apt) return false;
      return true;
    });
  }, [doors, floor, apt]);

  // Hardware summary
  const hwSummary = useMemo(() => {
    const s = {};
    HW_KEYS.forEach(k => { s[k] = doors.filter(d => d[k]).length; });
    return s;
  }, [doors]);

  const hwLabels = {
    del_hinges: "Hinges",
    del_lock: "Lock",
    del_cylinder: "Cylinder",
    del_knob: "Knob",
    del_handle: "Handle set",
    del_stopper: "Door stopper",
  };

  const distribute = async () => {
    const qty = parseInt(hwQty, 10);
    if (!qty || qty <= 0) return;
    setDistributing(true);
    setDistResult(null);

    // Sort doors ascending by floor, then apt_no
    const sorted = [...doors].sort((a,b) => a.floor - b.floor || a.apt_no.localeCompare(b.apt_no));

    // Filter eligible doors (don't already have this item + room-type filtering)
    let eligible;
    if (hwType === "del_cylinder") {
      // Cylinders only go to cylinder rooms (bedrooms, storage, laundry, ironing, toilet, maid)
      eligible = sorted.filter(d => !d.del_cylinder && roomHwType(d.room) === "cylinder");
    } else if (hwType === "del_knob") {
      // Knobs only go to knob rooms (bathrooms, powder rooms)
      eligible = sorted.filter(d => !d.del_knob && roomHwType(d.room) === "knob");
    } else {
      eligible = sorted.filter(d => !d[hwType]);
    }

    // Hinges: entered as pieces, 3 per door
    const doorsToFill = hwType === "del_hinges" ? Math.floor(qty / 3) : qty;
    const toAssign = eligible.slice(0, doorsToFill);
    const updates = toAssign.map(d => ({ id: d.id, patch: { [hwType]: true } }));

    if (updates.length > 0) {
      await onBulk(updates);
    }

    const msg = hwType === "del_hinges"
      ? `${qty} hinges → ${updates.length} doors (3 per door), ${eligible.length - updates.length} doors remaining`
      : `Assigned ${updates.length} of ${qty} requested (${eligible.length - updates.length} remaining eligible)`;
    setDistResult(msg);
    setHwQty("");
    setDistributing(false);
  };

  return (
    <>
      {/* Bulk hardware distribution */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{fontWeight:700,marginBottom:10}}>Bulk hardware distribution</div>
        <div className="small" style={{marginBottom:8,opacity:.7}}>
          Enter quantity received (pieces) → auto-assigns to doors in ascending floor order.
          Hinges: 3 per door. Cylinders → bedrooms/storage/laundry/ironing/toilet. Knobs → bathrooms/powder rooms.
        </div>
        <div className="kv" style={{gap:"4px 16px",marginBottom:12}}>
          {Object.entries(hwLabels).map(([k,label]) => (
            <React.Fragment key={k}>
              <div className="small">{label}</div>
              <div>{hwSummary[k]} / {doors.length} assigned</div>
            </React.Fragment>
          ))}
        </div>
        <div className="row" style={{alignItems:"flex-end"}}>
          <div style={{flex:1,minWidth:140}}>
            <div className="small" style={{marginBottom:4}}>Item type</div>
            <select className="input" value={hwType} onChange={e=>setHwType(e.target.value)} style={{width:"100%"}}>
              {Object.entries(hwLabels).map(([k,l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div style={{minWidth:100}}>
            <div className="small" style={{marginBottom:4}}>Quantity</div>
            <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="e.g. 200"
                   value={hwQty} onChange={e => { const v = e.target.value; if (v === "" || /^\d+$/.test(v)) setHwQty(v); }}
                   style={{width:"100%",minWidth:0}}/>
          </div>
          <button className="btn primary" disabled={distributing || !hwQty} onClick={distribute}>
            {distributing ? "Distributing…" : "Distribute"}
          </button>
        </div>
        {distResult && <div className="small" style={{marginTop:8,color:"#86efac"}}>{distResult}</div>}
      </div>

      {/* Per-door delivery (frame, shutter, architraves) */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{fontWeight:700,marginBottom:8}}>Per-door delivery items</div>
        <div className="row">
          <select className="input" value={floor} onChange={e=>{setFloor(e.target.value); setApt("");}} style={{minWidth:140}}>
            <option value="">All floors</option>
            {floors.map(([k,label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <select className="input" value={apt} onChange={e=>setApt(e.target.value)} style={{minWidth:140}}>
            <option value="">All apts</option>
            {apts.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="small" style={{marginTop:8}}>Showing {filtered.length} of {doors.length}</div>
      </div>

      <div className="card">
        <table className="table">
          <thead><tr><th>Floor</th><th>Apt</th><th>Room</th><th>Type</th><th>Delivery</th><th></th></tr></thead>
          <tbody>
            {filtered.slice(0, 300).map(d => {
              const delDone = DEL_ITEMS.filter(([k]) => d[k]).length;
              const hwDone = HW_KEYS.filter(k => d[k]).length;
              return (
                <React.Fragment key={d.id}>
                  <tr>
                    <td>{d.floor_label}</td>
                    <td>{d.apt_no}</td>
                    <td className="small">{d.room || ""}</td>
                    <td>{d.door_type}</td>
                    <td>
                      <span className={`pill ${delDone+hwDone===9?"INSTALLED":delDone+hwDone>0?"IN_PROGRESS":"PENDING"}`}>
                        {delDone+hwDone}/9
                      </span>
                    </td>
                    <td style={{textAlign:"right"}}>
                      <button className="btn" onClick={()=>setOpenId(openId===d.id?null:d.id)}>
                        {openId===d.id ? "Close" : "Open"}
                      </button>
                    </td>
                  </tr>
                  {openId === d.id && (
                    <tr><td colSpan={6} style={{background:"#0b1220"}}>
                      <DeliveryDetail door={d} onUpdate={onUpdate} />
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 300 && <div className="small" style={{marginTop:10}}>(Showing first 300 — narrow filters to see more)</div>}
      </div>
    </>
  );
}

function DeliveryDetail({ door, onUpdate }) {
  const toggle = (key) => onUpdate(door.id, { [key]: !door[key] });
  const hwType = roomHwType(door.room);

  return (
    <div style={{padding:"10px 4px"}}>
      <div className="kv">
        <div className="small">QR code</div><div className="small"><code>{door.qr_code}</code></div>
        <div className="small">Floor / Apt</div><div>{door.floor_label} · {door.apt_no}</div>
        <div className="small">Room</div><div>{door.room || "—"}</div>
        <div className="small">Type</div><div>{door.door_type}</div>
        <div className="small">Hardware type</div><div>{hwType === "knob" ? "Knob + Cylinder stopper" : "Cylinder + Bowl stopper"}</div>
      </div>
      <hr/>
      <div style={{fontWeight:700,marginBottom:8}}>Door items (check on delivery)</div>
      <div className="checks">
        {DEL_ITEMS.map(([key, label]) => (
          <label key={key} className={`check ${door[key]?"done":""}`}>
            <input type="checkbox" checked={!!door[key]} onChange={()=>toggle(key)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <hr/>
      <div style={{fontWeight:700,marginBottom:8}}>Hardware (bulk distributed)</div>
      <div className="checks">
        {[["del_hinges","Hinges"],["del_lock","Lock"],
          ...(hwType==="knob" ? [["del_knob","Knob"]] : [["del_cylinder","Cylinder"]]),
          ["del_handle","Handle set"],["del_stopper", hwType==="knob"?"Cylinder stopper":"Bowl stopper"]].map(([key, label]) => (
          <label key={key} className={`check ${door[key]?"done":""}`} style={{opacity: door[key]?1:0.5}}>
            <input type="checkbox" checked={!!door[key]} onChange={()=>toggle(key)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {door.delivered_at && <div className="small" style={{marginTop:10,color:"#93c5fd"}}>Delivered {new Date(door.delivered_at).toLocaleDateString()}</div>}
    </div>
  );
}

/* ── Installation Tab ──────────────────────────────────────── */

function InstallTab({ doors, types, onUpdate }) {
  const [floor, setFloor] = useState("");
  const [apt, setApt] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [openId, setOpenId] = useState(null);

  const floors = useMemo(() => {
    const m = new Map();
    doors.forEach(d => m.set(d.floor, d.floor_label));
    return Array.from(m.entries()).sort((a,b)=>a[0]-b[0]);
  }, [doors]);

  const apts = useMemo(() => {
    const s = new Set();
    doors.filter(d => floor === "" || String(d.floor) === floor).forEach(d => s.add(d.apt_no));
    return Array.from(s).sort();
  }, [doors, floor]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return doors.filter(d => {
      if (floor  !== "" && String(d.floor) !== floor) return false;
      if (apt    !== "" && d.apt_no !== apt) return false;
      if (status !== "" && d.status !== status) return false;
      if (q && !(`${d.qr_code} ${d.apt_no} ${d.room||""} ${d.door_type}`.toLowerCase().includes(q))) return false;
      if (missingOnly && d.final_width_mm && d.final_height_mm && d.final_thickness_mm) return false;
      return true;
    });
  }, [doors, floor, apt, status, search, missingOnly]);

  return (
    <>
      <div className="card" style={{marginBottom:12}}>
        <div className="row">
          <select className="input" value={floor} onChange={e=>{setFloor(e.target.value); setApt("");}} style={{minWidth:140}}>
            <option value="">All floors</option>
            {floors.map(([k,label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <select className="input" value={apt} onChange={e=>setApt(e.target.value)} style={{minWidth:140}}>
            <option value="">All apts</option>
            {apts.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="input" value={status} onChange={e=>setStatus(e.target.value)} style={{minWidth:140}}>
            <option value="">All statuses</option>
            {["PENDING","DELIVERED","IN_PROGRESS","INSTALLED","SNAGGED"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="input" placeholder="Search qr / apt / room…" value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1}}/>
          <button className={`tab ${missingOnly?"active":""}`} onClick={()=>setMissingOnly(v=>!v)} style={{padding:"10px 12px"}}>⚠ Missing dims</button>
        </div>
        <div className="small" style={{marginTop:8}}>Showing {filtered.length} of {doors.length}</div>
      </div>

      <div className="card">
        <table className="table">
          <thead><tr><th>Floor</th><th>Apt</th><th>Room</th><th>Type</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.slice(0, 300).map(d => (
              <React.Fragment key={d.id}>
                <tr>
                  <td>{d.floor_label}</td>
                  <td>{d.apt_no}</td>
                  <td className="small">{d.room || ""}</td>
                  <td>{d.door_type}{(!d.final_width_mm||!d.final_height_mm||!d.final_thickness_mm) && <span title="Missing dimensions" style={{marginLeft:6,color:"#fca5a5"}}>⚠</span>}</td>
                  <td><span className={`pill ${d.status}`}>{d.status.replace("_"," ")}</span></td>
                  <td style={{textAlign:"right"}}>
                    <button className="btn" onClick={()=>setOpenId(openId===d.id?null:d.id)}>
                      {openId===d.id ? "Close" : "Open"}
                    </button>
                  </td>
                </tr>
                {openId === d.id && (
                  <tr><td colSpan={6} style={{background:"#0b1220"}}>
                    <InstallDetail door={d} onUpdate={onUpdate} />
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {filtered.length > 300 && <div className="small" style={{marginTop:10}}>(Showing first 300 — narrow filters to see more)</div>}
      </div>
    </>
  );
}

function InstallDetail({ door, onUpdate }) {
  const toggle = (key) => onUpdate(door.id, { [key]: !door[key] });
  const setSnagged = () => onUpdate(door.id, { status: door.status === "SNAGGED" ? "PENDING" : "SNAGGED" });
  const doneCount = INSTALL_CHECKLIST.filter(([k]) => door[k]).length;
  const hwType = roomHwType(door.room);

  return (
    <div style={{padding:"10px 4px"}}>
      <div className="kv">
        <div className="small">QR code</div><div className="small"><code>{door.qr_code}</code></div>
        <div className="small">Floor / Apt</div><div>{door.floor_label} · {door.apt_no}</div>
        <div className="small">Room</div><div>{door.room || "—"}</div>
        <div className="small">Type</div><div>{door.door_type}</div>
        <div className="small">Status</div><div><span className={`pill ${door.status}`}>{door.status.replace("_"," ")}</span></div>
      </div>

      <hr/>
      <div className="row" style={{justifyContent:"space-between"}}>
        <div style={{fontWeight:700}}>Dimensions (mm)</div>
        {(!door.final_width_mm || !door.final_height_mm || !door.final_thickness_mm) &&
          <span className="pill SNAGGED">missing</span>}
      </div>
      <DimEditor door={door} onUpdate={onUpdate} />

      <hr/>
      <div className="row" style={{justifyContent:"space-between"}}>
        <div style={{fontWeight:700}}>Delivered hardware</div>
        <div className="small" style={{color:"#93c5fd"}}>{hwType === "knob" ? "Knob + Cyl. stopper" : "Cylinder + Bowl stopper"}</div>
      </div>
      <div className="checks" style={{marginTop:8}}>
        {[["del_hinges","Hinges"],["del_lock","Lock"],
          ...(hwType==="knob" ? [["del_knob","Knob"]] : [["del_cylinder","Cylinder"]]),
          ["del_handle","Handle"],["del_stopper", hwType==="knob"?"Cyl. stopper":"Bowl stopper"]].map(([key, label]) => (
          <label key={key} className={`check ${door[key]?"done":""}`} style={{pointerEvents:"none"}}>
            <input type="checkbox" checked={!!door[key]} readOnly />
            <span>{label} {door[key] ? "✓" : "✗"}</span>
          </label>
        ))}
      </div>

      <hr/>
      <div className="row" style={{justifyContent:"space-between"}}>
        <div style={{fontWeight:700}}>Installation checklist</div>
        <div className="small">{doneCount}/6 done</div>
      </div>
      <div className="checks" style={{marginTop:8}}>
        {INSTALL_CHECKLIST.map(([key,label]) => (
          <label key={key} className={`check ${door[key]?"done":""}`}>
            <input type="checkbox" checked={!!door[key]} onChange={()=>toggle(key)} />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="row" style={{marginTop:8}}>
        <button className="btn" onClick={setSnagged} style={{borderColor:"rgba(239,68,68,.4)"}}>
          {door.status === "SNAGGED" ? "Clear snag" : "Mark snagged"}
        </button>
      </div>
      {door.installed_at && <div className="small" style={{marginTop:10,color:"#86efac"}}>✓ Installed {new Date(door.installed_at).toLocaleString()}</div>}
    </div>
  );
}

/* ── Shared: DimEditor ─────────────────────────────────────── */

function DimEditor({ door, onUpdate }) {
  const [w, setW] = useState(door.final_width_mm ?? "");
  const [h, setH] = useState(door.final_height_mm ?? "");
  const [t, setT] = useState(door.final_thickness_mm ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setW(door.final_width_mm ?? "");
    setH(door.final_height_mm ?? "");
    setT(door.final_thickness_mm ?? "");
  }, [door.id, door.final_width_mm, door.final_height_mm, door.final_thickness_mm]);

  const dirty =
    String(w) !== String(door.final_width_mm ?? "") ||
    String(h) !== String(door.final_height_mm ?? "") ||
    String(t) !== String(door.final_thickness_mm ?? "");

  const save = async () => {
    setSaving(true);
    await onUpdate(door.id, {
      final_width_mm:     w === "" ? null : parseInt(w, 10),
      final_height_mm:    h === "" ? null : parseInt(h, 10),
      final_thickness_mm: t === "" ? null : parseInt(t, 10),
    });
    setSaving(false);
  };

  const dimChange = (setter) => (e) => {
    const v = e.target.value;
    if (v === "" || /^\d+$/.test(v)) setter(v);
  };

  return (
    <div style={{marginTop:8}}>
      <div className="row" style={{alignItems:"flex-end"}}>
        <div style={{flex:1,minWidth:90}}>
          <div className="small" style={{marginBottom:4}}>Width</div>
          <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="—"
                 value={w} onChange={dimChange(setW)} style={{width:"100%",minWidth:0}}/>
        </div>
        <div style={{flex:1,minWidth:90}}>
          <div className="small" style={{marginBottom:4}}>Height</div>
          <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="—"
                 value={h} onChange={dimChange(setH)} style={{width:"100%",minWidth:0}}/>
        </div>
        <div style={{flex:1,minWidth:90}}>
          <div className="small" style={{marginBottom:4}}>Thickness</div>
          <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="—"
                 value={t} onChange={dimChange(setT)} style={{width:"100%",minWidth:0}}/>
        </div>
        <button className={`btn ${dirty?"primary":""}`} disabled={!dirty||saving} onClick={save}>
          {saving ? "Saving…" : dirty ? "Save" : "Saved"}
        </button>
      </div>
    </div>
  );
}
