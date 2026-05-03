import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";

/* Ã¢ÂÂÃ¢ÂÂ constants Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */

const INSTALL_CHECKLIST = [
  ["frame_installed",       "Frame"],
  ["shutter_installed",     "Shutter"],
  ["architraves_installed", "Architraves"],
  ["hinges_installed",      "Hinges"],
  ["lock_handle_installed", "Lock & handle"],
  ["stopper_installed",     "Door stopper"],
];

function applicableInstallChecklist(room) {
  if (NO_STOPPER_ROOMS.test(room || "")) {
    return INSTALL_CHECKLIST.filter(([k]) => k !== "stopper_installed");
  }
  return INSTALL_CHECKLIST;
}

// Per-door items checked individually on delivery (frame + shutter only now)
const DEL_ITEMS = [
  ["del_frame",   "Frame"],
  ["del_shutter", "Shutter"],
];

// Hardware items distributed in bulk (architraves moved here + split stoppers)
const HW_KEYS = [
  "del_architraves","del_hinges","del_lock",
  "del_cylinder","del_knob","del_handle",
  "del_bowl_stopper","del_cyl_stopper",
];

// Room -> hardware type mapping
const CYLINDER_ROOMS = /bedroom|store|storage|laundry|iron|toilet|maid/i;
const KNOB_ROOMS     = /bathroom|bath|powder/i;
const NO_STOPPER_ROOMS = /laundry/i;

function roomHwType(room) {
  if (!room) return "cylinder";
  if (KNOB_ROOMS.test(room)) return "knob";
  return "cylinder";
}

// Get the HW keys that actually apply to a specific door (based on room type)
function applicableHwKeys(room) {
  const type = roomHwType(room);
  const keys = [
    "del_architraves", "del_hinges", "del_lock",
    type === "knob" ? "del_knob" : "del_cylinder",
    "del_handle",
  ];
  if (!NO_STOPPER_ROOMS.test(room || "")) {
    keys.push(type === "knob" ? "del_cyl_stopper" : "del_bowl_stopper");
  }
  return keys;
}

// Total delivery items per door = 2 (frame, shutter) + applicable HW keys
function deliveryTotal(room) { return 2 + applicableHwKeys(room).length; }

function deriveStatus(d) {
  if (d.status === "SNAGGED") return "SNAGGED";
  const checklist = applicableInstallChecklist(d.room);
  const done = checklist.filter(([k]) => d[k]).length;
  if (done === checklist.length) return "INSTALLED";
  if (done > 0)   return "IN_PROGRESS";
  if (d.delivered_at) return "DELIVERED";
  return "PENDING";
}

/* Ã¢ÂÂÃ¢ÂÂ Supabase URL for storage Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */

/* ââ FR DOOR constants ââââââââââââââââââââââââââââââââââââ */
const FR_DEL_ALL = [
  ["del_frame","Frame"],["del_shutter","Shutter"],["del_architraves","Architraves"],
  ["del_hinges","Hinges"],["del_mortise_lock","Mortise Lock"],["del_cylinder","Cylinder"],
  ["del_roller_latch","Roller Latch"],["del_lever_handle","Lever Handle"],
  ["del_fhc_lock","FHC Lock"],["del_concealed_closer","Concealed Closer"],
  ["del_door_closer","Door Closer"],["del_push_plate","Push Plate"],
  ["del_pull_handle","Pull Handle"],["del_eye_viewer","Eye Viewer"],
  ["del_door_stopper","Door Stopper"],["del_flush_bolt","Flush Bolt"],
  ["del_dead_lock","Dead Lock"],
];
/* Updated frApplicableDel based on Excel table - exact hardware per door type */
function frApplicableDel(d) {
  var t = (d.door_type||"").trim();
  var base = ["del_frame","del_shutter","del_architraves","del_hinges"];
  if (t==="D1 - L" || t==="D1 - R") return base.concat(["del_mortise_lock","del_cylinder","del_lever_handle","del_concealed_closer","del_eye_viewer","del_door_stopper"]);
  if (t==="D4 - L" || t==="D4 - R") return base.concat(["del_roller_latch","del_door_closer","del_push_plate","del_pull_handle"]);
  if (t==="D5 - L") return base.concat(["del_door_closer","del_push_plate","del_pull_handle","del_dead_lock"]);
  if (t==="D5 - R") return base.concat(["del_mortise_lock","del_cylinder","del_lever_handle","del_door_closer","del_push_plate","del_pull_handle","del_dead_lock"]);
  if (t==="D7" || t==="D8") return base.concat(["del_fhc_lock","del_door_closer","del_flush_bolt"]);
  if (t==="D9") return base.concat(["del_mortise_lock","del_cylinder","del_lever_handle","del_door_closer"]);
  if (t==="D10 - L") return base.concat(["del_fhc_lock"]);
  return base;
}
const FR_INSTALL_CHECKLIST = [
  ["frame_installed","Frame"],["shutter_installed","Shutter"],
  ["architraves_installed","Architraves"],["hinges_installed","Hinges"],
  ["lock_handle_installed","Lock & Handle"],["hardware_installed","Hardware"],
];
function frDeriveStatus(d) {
  var checks = FR_INSTALL_CHECKLIST;
  var done = checks.filter(([k])=>d[k]).length;
  if (done===checks.length) return "INSTALLED";
  if (done>0) return "IN_PROGRESS";
  var delKeys = frApplicableDel(d);
  var delDone = delKeys.filter(k=>d[k]).length;
  if (delDone===delKeys.length) return "DELIVERED";
  if (delDone>0) return "PARTIAL_DEL";
  return "PENDING";
}

const SUPABASE_URL = "https://kwwgkjrcafbzjxpmyykd.supabase.co";

/* Ã¢ÂÂÃ¢ÂÂ App shell Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [mode, setMode] = useState("regular");
  const [doors, setDoors] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [woodDeliveryKey, setWoodDeliveryKey] = useState(0);

  const load = useCallback(async () => {
    if (mode === "fr") { setLoading(true); setErr(null); try { const r = await supabase.from("fr_doors").select("*").order("sr_no").limit(2500); if (r.error) throw r.error; setDoors((r.data||[]).map(d=>({...d, status: frDeriveStatus(d)}))); setTypes([]); } catch(e){ setErr(e.message||String(e)); } finally { setLoading(false); } return; }
    setLoading(true); setErr(null);
    try {
      const [dRes, tRes] = await Promise.all([
        supabase.from("doors").select("*").order("floor").order("apt_no").order("door_type").limit(2500),
        supabase.from("door_types").select("*").order("code"),
      ]);
      if (dRes.error) throw dRes.error;
      if (tRes.error) throw tRes.error;
      setDoors((dRes.data || []).map(d => ({ ...d, status: deriveStatus(d) })));
      setTypes(tRes.data || []);
    } catch (e) { setErr(e.message || String(e)); }
    finally { setLoading(false); }
  }, [mode]);

  useEffect(() => { load(); }, [load]);

  const updateDoor = async (id, patch) => {
    setDoors(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
    const merged = { ...doors.find(d => d.id === id), ...patch };
    const newStatus = mode==="fr" ? frDeriveStatus(merged) : deriveStatus(merged);
    const fullPatch = { ...patch, status: newStatus, updated_at: new Date().toISOString() };
    if (mode!=="fr" && newStatus === "INSTALLED" && !merged.installed_at) fullPatch.installed_at = new Date().toISOString();
    if (mode!=="fr" && newStatus !== "INSTALLED") fullPatch.installed_at = null;
    const delKeys = mode==="fr" ? frApplicableDel(merged) : [...DEL_ITEMS.map(([k])=>k), ...HW_KEYS];
    const anyDel = delKeys.some(k => merged[k]);
    if (mode!=="fr" && anyDel && !merged.delivered_at) fullPatch.delivered_at = new Date().toISOString();
    if (mode!=="fr" && !anyDel && merged.delivered_at && !patch.delivered_at) fullPatch.delivered_at = null;
    const { error } = await supabase.from(mode==="fr"?"fr_doors":"doors").update(fullPatch).eq("id", id);
    if (error) { alert(error.message); load(); return; }
    setDoors(prev => prev.map(d => d.id === id? { ...d, ...fullPatch } : d));
  };

  const bulkUpdate = async (updates) => {
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
      await supabase.from(mode==="fr"?"fr_doors":"doors").update(fp).eq("id", id);
    }
    load();
  };

  return (
    <div className="container">
      <div className="row" style={{justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:18,fontWeight:800}}>Helvetia Doors</div>
          <div className="small">Delivery & installation tracking {"\u00b7"} v4.0.0</div>
        </div>
        <button className="btn" onClick={load}>{loading ? "LoadingÃ¢ÂÂ¦" : "Refresh"}</button>
      </div>

      
      <div style={{display:"flex",alignItems:"center",gap:8,margin:"10px 0"}}>
        <button className={"btn"+(mode==="regular"?" active":"")} style={{fontSize:13,padding:"4px 12px",background:mode==="regular"?"#1a73e8":"#e8e8e8",color:mode==="regular"?"#fff":"#333",border:"none",borderRadius:6}} onClick={()=>{setMode("regular");setTab("dashboard")}}>Regular</button>
        <button className={"btn"+(mode==="fr"?" active":"")} style={{fontSize:13,padding:"4px 12px",background:mode==="fr"?"#d32f2f":"#e8e8e8",color:mode==="fr"?"#fff":"#333",border:"none",borderRadius:6}} onClick={()=>{setMode("fr");setTab("dashboard")}}>Fire Rated</button>
      </div>

      {err && <div className="card" style={{marginTop:12}}><div style={{color:"#fecaca",fontWeight:700}}>Error</div><div className="small">{err}</div></div>}

      <div className="tabs" style={{marginTop:14}}>
        <button className={`tab ${tab==="dashboard"?"active":""}`} onClick={()=>setTab("dashboard")}>Dashboard</button>
        <button className={`tab ${tab==="delivery"?"active":""}`}  onClick={()=>setTab("delivery")}>Delivery</button>
        <button className={`tab ${tab==="install"?"active":""}`}   onClick={()=>setTab("install")}>Installation</button>
      </div>

      {mode==="regular" && tab === "dashboard" && <Dashboard doors={doors} />}
      {mode==="regular" && tab === "delivery"  && <DeliveryTab doors={doors} types={types} onUpdate={updateDoor} onBulk={bulkUpdate} onRefresh={load} woodKey={woodDeliveryKey} bumpWoodKey={()=>setWoodDeliveryKey(k=>k+1)} />}
      {mode==="regular" && tab === "install"   && <InstallTab doors={doors} types={types} onUpdate={updateDoor} onRefresh={load} />}
      {mode==="fr" && tab === "dashboard" && <FRDashboard doors={doors} />}
      {mode==="fr" && tab === "delivery"  && <FRDeliveryTab doors={doors} onUpdate={updateDoor} onBulk={bulkUpdate} onRefresh={load} />}
      {mode==="fr" && tab === "install"   && <FRInstallTab doors={doors} onUpdate={updateDoor} onRefresh={load} />}
    </div>
  );
}

/* Ã¢ÂÂÃ¢ÂÂ Dashboard Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */

function Dashboard({ doors }) {
  const stats = useMemo(() => {
    const s = { total:0, PENDING:0, DELIVERED:0, IN_PROGRESS:0, INSTALLED:0, SNAGGED:0 };
    const delItems = {
      frames:0, shutters:0, architraves:0,
      hinges:0, locks:0, cylinders:0, knobs:0,
      handles:0, bowlStoppers:0, cylStoppers:0,
    };
    let cylinderRooms = 0, knobRooms = 0, fullDoorDelivered = 0, cylStopperRooms = 0;
    // Room-type installation counters
    let cylInstalled = 0, knobInstalled = 0;
    let delInstalled = 0, delInProgress = 0, delSnagged = 0, delNotStarted = 0;
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
      if (d.del_bowl_stopper) delItems.bowlStoppers++;
      if (d.del_cyl_stopper) delItems.cylStoppers++;
      // Count room types
      const hwt = roomHwType(d.room);
      if (hwt === "cylinder") { cylinderRooms++; if (!NO_STOPPER_ROOMS.test(d.room || "")) cylStopperRooms++; if (d.status === "INSTALLED") cylInstalled++; }
      else { knobRooms++; if (d.status === "INSTALLED") knobInstalled++; }
      // Door is "delivered" when frame + shutter + architraves all delivered
      if (d.del_frame && d.del_shutter) {
        fullDoorDelivered++;
        if (d.status === "INSTALLED") delInstalled++;
        else if (d.status === "IN_PROGRESS") delInProgress++;
        else if (d.status === "SNAGGED") delSnagged++;
        else delNotStarted++;
      }
    });
    return { ...s, delItems, cylinderRooms, knobRooms, cylStopperRooms, fullDoorDelivered, cylInstalled, knobInstalled, delInstalled, delInProgress, delSnagged, delNotStarted };
  }, [doors]);

  const byFloor = useMemo(() => {
    const m = new Map();
    doors.forEach(d => {
      if (!m.has(d.floor)) m.set(d.floor, { label: d.floor_label, total:0, installed:0, in_progress:0, delivered_only:0, snagged:0, not_delivered:0 });
      const r = m.get(d.floor);
      r.total++;
      if (d.del_frame && d.del_shutter) {
        if (d.status === "INSTALLED") r.installed++;
        else if (d.status === "IN_PROGRESS") r.in_progress++;
        else if (d.status === "SNAGGED") r.snagged++;
        else r.delivered_only++;
      } else {
        r.not_delivered++;
      }
    });
    return Array.from(m.entries()).sort((a,b)=>a[0]-b[0]).map(([k,v])=>({floor:k,...v}));
  }, [doors]);

  const total = doors.length || 1;
  const di = stats.delItems;
  return (
    <>
      <div className="row" style={{marginBottom:12}}>
        <div className="stat"><div className="l">Total</div><div className="n">{stats.total}</div></div>
        <div className="stat"><div className="l">Delivered</div><div className="n" style={{color:"#86efac"}}>{stats.fullDoorDelivered}</div><div className="small" style={{opacity:.5}}>{Math.round((stats.fullDoorDelivered/stats.total)*100)}%</div></div>
        <div className="stat"><div className="l">Pending delivery</div><div className="n" style={{color:"#fca5a5"}}>{stats.total - stats.fullDoorDelivered}</div><div className="small" style={{opacity:.5}}>{Math.round(((stats.total - stats.fullDoorDelivered)/stats.total)*100)}%</div></div>
        <div className="stat"><div className="l">Installed</div><div className="n" style={{color:"#4ade80"}}>{stats.delInstalled}</div><div className="small" style={{opacity:.5}}>{stats.fullDoorDelivered ? Math.round((stats.delInstalled/stats.fullDoorDelivered)*100) : 0}% of delivered</div></div>
        <div className="stat"><div className="l">In progress</div><div className="n" style={{color:"#fbbf24"}}>{stats.delInProgress}</div><div className="small" style={{opacity:.5}}>{stats.fullDoorDelivered ? Math.round((stats.delInProgress/stats.fullDoorDelivered)*100) : 0}% of delivered</div></div>
        <div className="stat"><div className="l">Delivered not started</div><div className="n" style={{color:"#60a5fa"}}>{stats.delNotStarted}</div><div className="small" style={{opacity:.5}}>{stats.fullDoorDelivered ? Math.round((stats.delNotStarted/stats.fullDoorDelivered)*100) : 0}% of delivered</div></div>
        <div className="stat"><div className="l">Snagged</div><div className="n" style={{color:"#f87171"}}>{stats.delSnagged}</div><div className="small" style={{opacity:.5}}>{stats.fullDoorDelivered ? Math.round((stats.delSnagged/stats.fullDoorDelivered)*100) : 0}% of delivered</div></div>
      </div>

      <div className="card">
        <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
          <div style={{flex:"1 1 280px"}}>
            <div style={{fontWeight:700,marginBottom:10}}>Delivery summary</div>
            <div className="small" style={{marginBottom:8,opacity:.7}}>Doors delivered (frame + shutter): <b style={{color:"#86efac"}}>{stats.fullDoorDelivered}</b> / {total} &mdash; Pending: <b style={{color:"#fca5a5"}}>{total - stats.fullDoorDelivered}</b></div>
            <div style={{display:"grid",gridTemplateColumns:"auto auto auto",gap:"4px 12px",alignItems:"center"}}>
              <div className="small" style={{fontWeight:700,opacity:.6}}>Item</div><div className="small" style={{fontWeight:700,opacity:.6}}>Delivered</div><div className="small" style={{fontWeight:700,opacity:.6}}>Remaining</div>
              <div className="small">Frames</div><div>{di.frames}/{total}</div><div style={{color:"#fca5a5"}}>{total-di.frames}</div>
              <div className="small">Shutters</div><div>{di.shutters}/{total}</div><div style={{color:"#fca5a5"}}>{total-di.shutters}</div>
              <div className="small">Architraves</div><div>{di.architraves}/{total}</div><div style={{color:"#fca5a5"}}>{total-di.architraves}</div>
              <div className="small">Hinges</div><div>{di.hinges}/{total}</div><div style={{color:"#fca5a5"}}>{total-di.hinges}</div>
              <div className="small">Locks</div><div>{di.locks}/{total}</div><div style={{color:"#fca5a5"}}>{total-di.locks}</div>
              <div className="small">Cylinders</div><div>{di.cylinders}/{stats.cylinderRooms}</div><div style={{color:"#fca5a5"}}>{stats.cylinderRooms-di.cylinders}</div>
              <div className="small">Knobs</div><div>{di.knobs}/{stats.knobRooms}</div><div style={{color:"#fca5a5"}}>{stats.knobRooms-di.knobs}</div>
              <div className="small">Handle sets</div><div>{di.handles}/{total}</div><div style={{color:"#fca5a5"}}>{total-di.handles}</div>
              <div className="small">Bowl stoppers</div><div>{di.bowlStoppers}/{stats.cylStopperRooms}</div><div style={{color:"#fca5a5"}}>{stats.cylStopperRooms-di.bowlStoppers}</div>
              <div className="small">Cyl. stoppers</div><div>{di.cylStoppers}/{stats.knobRooms}</div><div style={{color:"#fca5a5"}}>{stats.knobRooms-di.cylStoppers}</div>
            </div>
          </div>
          <div style={{flex:"0 0 auto",minWidth:200}}>
            <div style={{fontWeight:700,marginBottom:10}}>By room type</div>
            <div className="card" style={{padding:"10px 14px",marginBottom:8}}>
              <div className="small" style={{fontWeight:700,marginBottom:4}}>Cylinder rooms</div>
              <div className="small" style={{opacity:.6,marginBottom:6}}>Bedrooms, storage, laundry, maid, iron, toilet</div>
              <div style={{fontSize:18,fontWeight:700}}>{stats.cylInstalled} <span style={{fontWeight:400,fontSize:14,opacity:.6}}>/ {stats.cylinderRooms} installed</span></div>
              <div className="bar" style={{marginTop:6}}><span style={{width:`${(stats.cylInstalled/(stats.cylinderRooms||1))*100}%`}}/></div>
            </div>
            <div className="card" style={{padding:"10px 14px"}}>
              <div className="small" style={{fontWeight:700,marginBottom:4}}>Knob rooms</div>
              <div className="small" style={{opacity:.6,marginBottom:6}}>Bathrooms, powder rooms</div>
              <div style={{fontSize:18,fontWeight:700}}>{stats.knobInstalled} <span style={{fontWeight:400,fontSize:14,opacity:.6}}>/ {stats.knobRooms} installed</span></div>
              <div className="bar" style={{marginTop:6}}><span style={{width:`${(stats.knobInstalled/(stats.knobRooms||1))*100}%`}}/></div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{fontWeight:700,marginBottom:10}}>Overall progress</div>
        <div style={{display:"flex",height:22,borderRadius:6,overflow:"hidden",background:"rgba(255,255,255,0.06)",marginBottom:4}}>
          {stats.delInstalled > 0 && <div style={{width:`${(stats.delInstalled/total)*100}%`,background:"#4ade80",transition:"width .3s"}} title={`Installed: ${stats.delInstalled}`}/>}
          {stats.delInProgress > 0 && <div style={{width:`${(stats.delInProgress/total)*100}%`,background:"#fbbf24",transition:"width .3s"}} title={`In progress: ${stats.delInProgress}`}/>}
          {stats.delNotStarted > 0 && <div style={{width:`${(stats.delNotStarted/total)*100}%`,background:"#60a5fa",transition:"width .3s"}} title={`Not started: ${stats.delNotStarted}`}/>}
          {stats.delSnagged > 0 && <div style={{width:`${(stats.delSnagged/total)*100}%`,background:"#f87171",transition:"width .3s"}} title={`Snagged: ${stats.delSnagged}`}/>}
          {(stats.total - stats.fullDoorDelivered) > 0 && <div style={{width:`${((stats.total - stats.fullDoorDelivered)/total)*100}%`,background:"#6b7280",transition:"width .3s"}} title={`Not delivered: ${stats.total - stats.fullDoorDelivered}`}/>}
        </div>
        <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:6}}>
          <div className="small"><span style={{display:"inline-block",width:10,height:10,borderRadius:2,background:"#4ade80",marginRight:4,verticalAlign:"middle"}}/>Installed {stats.delInstalled} ({Math.round((stats.delInstalled/total)*100)}%)</div>
          <div className="small"><span style={{display:"inline-block",width:10,height:10,borderRadius:2,background:"#fbbf24",marginRight:4,verticalAlign:"middle"}}/>In progress {stats.delInProgress} ({Math.round((stats.delInProgress/total)*100)}%)</div>
          <div className="small"><span style={{display:"inline-block",width:10,height:10,borderRadius:2,background:"#60a5fa",marginRight:4,verticalAlign:"middle"}}/>Not started {stats.delNotStarted} ({Math.round((stats.delNotStarted/total)*100)}%)</div>
          <div className="small"><span style={{display:"inline-block",width:10,height:10,borderRadius:2,background:"#f87171",marginRight:4,verticalAlign:"middle"}}/>Snagged {stats.delSnagged} ({Math.round((stats.delSnagged/total)*100)}%)</div>
          <div className="small"><span style={{display:"inline-block",width:10,height:10,borderRadius:2,background:"#6b7280",marginRight:4,verticalAlign:"middle"}}/>Not delivered {stats.total - stats.fullDoorDelivered} ({Math.round(((stats.total - stats.fullDoorDelivered)/total)*100)}%)</div>
        </div>
        <hr/>
        <div style={{fontWeight:700,marginBottom:10}}>By floor</div>
        {byFloor.map(f => (
          <div key={f.floor} style={{marginBottom:10}}>
            <div className="row" style={{justifyContent:"space-between",marginBottom:4}}>
              <div className="small" style={{fontWeight:700,opacity:1}}>{f.label}</div>
              <div className="small">{f.installed}/{f.total} installed</div>
            </div>
            <div style={{display:"flex",height:14,borderRadius:4,overflow:"hidden",background:"rgba(255,255,255,0.06)"}}>
              {f.installed > 0 && <div style={{width:`${(f.installed/f.total)*100}%`,background:"#4ade80"}}/>}
              {f.in_progress > 0 && <div style={{width:`${(f.in_progress/f.total)*100}%`,background:"#fbbf24"}}/>}
              {f.delivered_only > 0 && <div style={{width:`${(f.delivered_only/f.total)*100}%`,background:"#60a5fa"}}/>}
              {f.snagged > 0 && <div style={{width:`${(f.snagged/f.total)*100}%`,background:"#f87171"}}/>}
              {f.not_delivered > 0 && <div style={{width:`${(f.not_delivered/f.total)*100}%`,background:"#6b7280"}}/>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* -- Wood Elements Delivery --------------------------------- */

function WoodDelivery({ doors, onBulk, onRefresh, onDone }) {
  const [mode, setMode] = useState("frame"); // "frame" | "shutter" | "full_set"
  const [selFloor, setSelFloor] = useState("");
  const [selApt, setSelApt] = useState("");
  const [selected, setSelected] = useState(new Set()); // door IDs
  const [counted, setCounted] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [result, setResult] = useState(null);

  const modeLabels = { frame: "Frames only", shutter: "Shutters only", full_set: "Full door set (frame + shutter + architraves)" };

  const floors = useMemo(() => {
    const m = new Map();
    doors.forEach(d => m.set(d.floor, d.floor_label));
    return Array.from(m.entries()).sort((a,b) => a[0] - b[0]);
  }, [doors]);

  const apts = useMemo(() => {
    if (selFloor === "") return [];
    const s = new Set();
    doors.filter(d => String(d.floor) === selFloor).forEach(d => s.add(d.apt_no));
    return Array.from(s).sort();
  }, [doors, selFloor]);

  const floorDoors = useMemo(() => {
    if (selFloor === "") return [];
    return doors.filter(d => String(d.floor) === selFloor);
  }, [doors, selFloor]);

  const aptDoors = useMemo(() => {
    if (selApt === "") return [];
    return floorDoors.filter(d => d.apt_no === selApt);
  }, [floorDoors, selApt]);

  const modeKeys = mode === "frame" ? ["del_frame"]
    : mode === "shutter" ? ["del_shutter"]
    : ["del_frame", "del_shutter", "del_architraves"];

  const doorAlreadyDone = (d) => modeKeys.every(k => d[k]);

  const toggleDoor = (id) => {
    setCounted(false); setResult(null);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllInApt = (aptNo) => {
    setCounted(false); setResult(null);
    const aptD = floorDoors.filter(d => d.apt_no === aptNo && !doorAlreadyDone(d));
    const allSel = aptD.every(d => selected.has(d.id));
    setSelected(prev => {
      const next = new Set(prev);
      aptD.forEach(d => { if (allSel) next.delete(d.id); else next.add(d.id); });
      return next;
    });
  };

  const selectAllOnFloor = () => {
    setCounted(false); setResult(null);
    const eligible = floorDoors.filter(d => !doorAlreadyDone(d));
    const allSel = eligible.every(d => selected.has(d.id));
    setSelected(prev => {
      const next = new Set(prev);
      eligible.forEach(d => { if (allSel) next.delete(d.id); else next.add(d.id); });
      return next;
    });
  };

  const countSummary = useMemo(() => {
    const sel = doors.filter(d => selected.has(d.id));
    if (mode === "full_set") return { frames: sel.length, shutters: sel.length, architraves: sel.length, total: sel.length + " doors (full set)" };
    if (mode === "frame") return { frames: sel.length, total: sel.length + " frames" };
    return { shutters: sel.length, total: sel.length + " shutters" };
  }, [selected, doors, mode]);

  const handleCount = () => setCounted(true);

  const handleDistribute = async () => {
    if (selected.size === 0) return;
    setDistributing(true);
    const updates = [];
    for (const id of selected) {
      const patch = {};
      modeKeys.forEach(k => { patch[k] = true; });
      updates.push({ id, patch });
    }
    await onBulk(updates);
    const msg = mode === "full_set"
      ? `Distributed full door set to ${selected.size} doors (frames + shutters + architraves)`
      : `Distributed ${selected.size} ${mode === "frame" ? "frames" : "shutters"}`;
    setResult(msg);
    setSelected(new Set());
    setCounted(false);
    setDistributing(false);
  };

  const clearAll = () => {
    setSelected(new Set()); setCounted(false); setResult(null);
  };

  return (
    <div className="card" style={{marginBottom:12}}>
      <div style={{fontWeight:700,marginBottom:6,fontSize:15}}>Wood elements delivery</div>
      <div className="small" style={{marginBottom:10,opacity:.7}}>
        Select delivery type, pick a floor, then click doors to mark as received. Count and confirm before distributing.
      </div>

      {/* Mode selector */}
      <div className="row" style={{marginBottom:10,flexWrap:"wrap",gap:6}}>
        {["frame","shutter","full_set"].map(m => (
          <button key={m} className={`tab ${mode===m?"active":""}`}
            onClick={() => { setMode(m); clearAll(); }}
            style={{padding:"8px 14px"}}>
            {m === "frame" ? "Frames" : m === "shutter" ? "Shutters" : "Full door set"}
          </button>
        ))}
      </div>

      {/* Floor selector */}
      <div className="row" style={{marginBottom:10,gap:8}}>
        <div style={{minWidth:160}}>
          <div className="small" style={{marginBottom:4}}>Floor</div>
          <select className="input" value={selFloor}
            onChange={e => { setSelFloor(e.target.value); setSelApt(""); clearAll(); }}
            style={{width:"100%"}}>
            <option value="">â Select floor â</option>
            {floors.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        {selFloor !== "" && (
          <div style={{alignSelf:"flex-end"}}>
            <button className="btn" onClick={selectAllOnFloor} style={{whiteSpace:"nowrap"}}>
              {floorDoors.filter(d => !doorAlreadyDone(d)).every(d => selected.has(d.id)) && floorDoors.filter(d => !doorAlreadyDone(d)).length > 0
                ? "Deselect all" : "Select all on floor"}
            </button>
          </div>
        )}
      </div>

      {/* Apartments grid */}
      {selFloor !== "" && (
        <div style={{marginBottom:10}}>
          <div className="small" style={{marginBottom:6,fontWeight:700}}>Apartments on {floors.find(([k])=>String(k)===selFloor)?.[1] || selFloor}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {apts.map(aptNo => {
              const aptD = floorDoors.filter(d => d.apt_no === aptNo);
              const selectedCount = aptD.filter(d => selected.has(d.id)).length;
              const doneCount = aptD.filter(d => doorAlreadyDone(d)).length;
              const allDone = doneCount === aptD.length;
              return (
                <button key={aptNo}
                  className={`btn ${selApt === aptNo ? "primary" : ""}`}
                  onClick={() => setSelApt(selApt === aptNo ? "" : aptNo)}
                  style={{minWidth:70, opacity: allDone ? 0.4 : 1,
                    borderColor: selectedCount > 0 ? "rgba(134,239,172,.6)" : undefined}}>
                  <div>{aptNo}</div>
                  <div className="small" style={{fontSize:10}}>
                    {allDone ? "done" : selectedCount > 0 ? `${selectedCount}/${aptD.length}` : `${aptD.length} doors`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Doors within selected apartment */}
      {selApt !== "" && (
        <div style={{marginBottom:10,background:"rgba(0,0,0,.2)",borderRadius:8,padding:10}}>
          <div className="row" style={{justifyContent:"space-between",marginBottom:8}}>
            <div className="small" style={{fontWeight:700}}>Apt {selApt} â click doors to select</div>
            <button className="btn" onClick={() => selectAllInApt(selApt)} style={{padding:"4px 10px",fontSize:12}}>
              {aptDoors.filter(d => !doorAlreadyDone(d)).every(d => selected.has(d.id)) && aptDoors.filter(d => !doorAlreadyDone(d)).length > 0
                ? "Deselect all" : "Select all"}
            </button>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {aptDoors.map(d => {
              const done = doorAlreadyDone(d);
              const isSel = selected.has(d.id);
              return (
                <button key={d.id} disabled={done} onClick={() => toggleDoor(d.id)}
                  style={{padding:"8px 12px", borderRadius:6, cursor: done ? "default" : "pointer",
                    border: isSel ? "2px solid #86efac" : "1px solid rgba(255,255,255,.15)",
                    background: done ? "rgba(134,239,172,.12)" : isSel ? "rgba(134,239,172,.2)" : "rgba(255,255,255,.05)",
                    color: done ? "#86efac" : isSel ? "#fff" : "rgba(255,255,255,.7)",
                    opacity: done ? 0.5 : 1, textAlign:"left", minWidth:120}}>
                  <div style={{fontSize:12,fontWeight:600}}>{d.room || d.door_type}</div>
                  <div style={{fontSize:10,opacity:.6}}>{d.door_type}{done ? " \u2713" : ""}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected count & action buttons */}
      {selected.size > 0 && (
        <div style={{marginTop:8}}>
          <div className="row" style={{gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{flex:1}}>
              <span style={{fontWeight:700,color:"#86efac"}}>{selected.size}</span>
              <span className="small" style={{marginLeft:6}}>door{selected.size !== 1 ? "s" : ""} selected</span>
            </div>
            {!counted && (
              <button className="btn primary" onClick={handleCount}>Count delivery</button>
            )}
            {counted && (
              <button className="btn primary" disabled={distributing} onClick={handleDistribute}
                style={{background:"#16a34a",borderColor:"#16a34a"}}>
                {distributing ? "Distributing\u2026" : "Distribute"}
              </button>
            )}
            <button className="btn" onClick={clearAll} style={{borderColor:"rgba(239,68,68,.4)",color:"#fca5a5"}}>Clear</button>
          </div>

          {counted && (
            <div className="card" style={{marginTop:8,padding:"10px 14px",background:"rgba(134,239,172,.08)",border:"1px solid rgba(134,239,172,.3)"}}>
              <div style={{fontWeight:700,marginBottom:4,color:"#86efac"}}>Delivery count preview</div>
              {mode === "full_set" ? (
                <div className="small">
                  <div>Frames: <b>{countSummary.frames}</b></div>
                  <div>Shutters: <b>{countSummary.shutters}</b></div>
                  <div>Architraves: <b>{countSummary.architraves}</b> (full requirement per door)</div>
                </div>
              ) : (
                <div className="small">{mode === "frame" ? "Frames" : "Shutters"}: <b>{selected.size}</b></div>
              )}
              <div className="small" style={{marginTop:4,opacity:.7}}>
                Confirm the total matches your delivery order, then click <b>Distribute</b>.
              </div>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="small" style={{marginTop:8,color:"#86efac",fontWeight:600}}>{result}</div>
      )}
    </div>
  );
}

/* Ã¢ÂÂÃ¢ÂÂ Delivery Tab Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */

function DeliveryTab({ doors, types, onUpdate, onBulk, onRefresh, woodKey, bumpWoodKey }) {
  const [floor, setFloor] = useState("");
  const [apt, setApt] = useState("");
  const [openId, setOpenId] = useState(null);

  // Bulk distribute state
  const [hwType, setHwType] = useState("del_architraves");
  const [hwQty, setHwQty] = useState("");
  const [distributing, setDistributing] = useState(false);
  const [distResult, setDistResult] = useState(null);
  // Track last distribution for undo
  const [lastDist, setLastDist] = useState(null); // { hwType, doorIds, label }
  const [reversing, setReversing] = useState(false);
  const [dPage, setDPage] = useState(0);
  const [pdFloor, setPdFloor] = useState("");
  const [pdApt, setPdApt] = useState("");
  const DPAGE_SIZE = 100;

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

  const filtered = useMemo(() => doors.filter(d => (!pdFloor || String(d.floor) === pdFloor) && (!pdApt || d.apt_no === pdApt)), [doors, pdFloor, pdApt]);
  const pdApts = useMemo(() => [...new Set(doors.filter(d => !pdFloor || String(d.floor) === pdFloor).map(d => d.apt_no))].sort(), [doors, pdFloor]);
  useEffect(() => { setDPage(0); setPdApt(""); }, [pdFloor]);
  useEffect(() => { setDPage(0); }, [pdApt]);

  // Hardware summary
  const hwSummary = useMemo(() => {
    const s = {};
    HW_KEYS.forEach(k => { s[k] = doors.filter(d => d[k]).length; });
    return s;
  }, [doors]);

  // Correct totals per hardware type (not all doors need every item)
  const hwTotals = useMemo(() => {
    const cylCount = doors.filter(d => roomHwType(d.room) === "cylinder").length;
    const knobCount = doors.filter(d => roomHwType(d.room) === "knob").length;
    const all = doors.length;
    return {
      del_architraves: all, del_hinges: all, del_lock: all,
      del_cylinder: cylCount, del_knob: knobCount,
      del_handle: all,
      del_bowl_stopper: doors.filter(d => roomHwType(d.room) === "cylinder" && !NO_STOPPER_ROOMS.test(d.room || "")).length, del_cyl_stopper: knobCount,
    };
  }, [doors]);

  const hwLabels = {
    del_architraves: "Architraves",
    del_hinges: "Hinges",
    del_lock: "Lock",
    del_cylinder: "Cylinder",
    del_knob: "Knob",
    del_handle: "Handle set",
    del_bowl_stopper: "Bowl stopper",
    del_cyl_stopper: "Cyl. stopper",
  };

  const distribute = async () => {
    const qty = parseInt(hwQty, 10);
    if (!qty || qty <= 0) return;
    setDistributing(true);
    setDistResult(null);

    const sorted = [...doors].sort((a,b) => a.floor - b.floor || a.apt_no.localeCompare(b.apt_no));

    let eligible;
    let doorsToFill;
    let unitLabel = "";

    if (hwType === "del_architraves") {
      // Architraves: 5 pieces per door -> floor to full doors only
      eligible = sorted.filter(d => !d.del_architraves);
      doorsToFill = Math.floor(qty / 5);
      unitLabel = `${qty} architraves -> ${Math.min(doorsToFill, eligible.length)} doors (5 per door)`;
    } else if (hwType === "del_hinges") {
      // Hinges: 3 pieces per door
      eligible = sorted.filter(d => !d.del_hinges);
      doorsToFill = Math.floor(qty / 3);
      unitLabel = `${qty} hinges -> ${Math.min(doorsToFill, eligible.length)} doors (3 per door)`;
    } else if (hwType === "del_cylinder") {
      eligible = sorted.filter(d => !d.del_cylinder && roomHwType(d.room) === "cylinder");
      doorsToFill = qty;
      unitLabel = `${qty} cylinders -> cylinder-type rooms only`;
    } else if (hwType === "del_knob") {
      eligible = sorted.filter(d => !d.del_knob && roomHwType(d.room) === "knob");
      doorsToFill = qty;
      unitLabel = `${qty} knobs -> knob-type rooms only`;
    } else if (hwType === "del_bowl_stopper") {
      // Bowl stoppers go to cylinder rooms (bedrooms, storage, etc.)
      eligible = sorted.filter(d => !d.del_bowl_stopper && roomHwType(d.room) === "cylinder" && !NO_STOPPER_ROOMS.test(d.room || ""));
      doorsToFill = qty;
      unitLabel = `${qty} bowl stoppers -> cylinder rooms (bedrooms/storage/etc.)`;
    } else if (hwType === "del_cyl_stopper") {
      // Cylinder stoppers go to knob rooms (bathrooms, powder)
      eligible = sorted.filter(d => !d.del_cyl_stopper && roomHwType(d.room) === "knob");
      doorsToFill = qty;
      unitLabel = `${qty} cyl. stoppers -> knob rooms (bathrooms/powder)`;
    } else {
      eligible = sorted.filter(d => !d[hwType]);
      doorsToFill = qty;
      unitLabel = `Assigned to ${Math.min(doorsToFill, eligible.length)} doors`;
    }

    const toAssign = eligible.slice(0, doorsToFill);
    const updates = toAssign.map(d => ({ id: d.id, patch: { [hwType]: true } }));

    if (updates.length > 0) {
      // Save for undo before applying
      setLastDist({ hwType, doorIds: toAssign.map(d => d.id), label: hwLabels[hwType] || hwType });
      await onBulk(updates);
    }

    const msg = `${unitLabel}, ${eligible.length - updates.length} doors remaining`;
    setDistResult(msg);
    setHwQty("");
    setDistributing(false);
  };

  const reverseLastDist = async () => {
    if (!lastDist) return;
    if (!confirm(`Reverse last distribution?\nThis will uncheck "${lastDist.label}" on ${lastDist.doorIds.length} doors.`)) return;
    setReversing(true);
    const updates = lastDist.doorIds.map(id => ({ id, patch: { [lastDist.hwType]: false } }));
    await onBulk(updates);
    setDistResult(`Reversed: un-assigned ${lastDist.label} from ${lastDist.doorIds.length} doors`);
    setLastDist(null);
    setReversing(false);
  };

  return (
    <>
      {/* Wood elements delivery */}
      <WoodDelivery key={woodKey} doors={doors} onBulk={onBulk} onRefresh={onRefresh} onDone={bumpWoodKey} />

      {/* Bulk hardware distribution */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{fontWeight:700,marginBottom:10}}>Bulk hardware distribution</div>
        <div className="small" style={{marginBottom:8,opacity:.7}}>
          Enter quantity received (pieces) -> auto-assigns to doors in ascending floor order.
          Architraves: 5 per door. Hinges: 3 per door. Bowl stoppers -> cylinder rooms. Cyl. stoppers -> knob rooms.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"auto auto auto",gap:"4px 12px",marginBottom:12,alignItems:"center"}}>
          <div className="small" style={{fontWeight:700,opacity:.6}}>Item</div><div className="small" style={{fontWeight:700,opacity:.6}}>Assigned</div><div className="small" style={{fontWeight:700,opacity:.6}}>Remaining</div>
          {Object.entries(hwLabels).map(([k,label]) => (
            <React.Fragment key={k}>
              <div className="small">{label}</div>
              <div>{hwSummary[k]} / {hwTotals[k]}</div>
              <div style={{color:"#fca5a5"}}>{hwTotals[k] - hwSummary[k]}</div>
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
            <div className="small" style={{marginBottom:4}}>Quantity (pcs)</div>
            <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="e.g. 200"
                   value={hwQty} onChange={e => { const v = e.target.value; if (v === "" || /^\d+$/.test(v)) setHwQty(v); }}
                   style={{width:"100%",minWidth:0}}/>
          </div>
          <button className="btn primary" disabled={distributing || reversing || !hwQty} onClick={distribute}>
            {distributing ? "DistributingÃ¢ÂÂ¦" : "Distribute"}
          </button>
          {lastDist && (
            <button className="btn" disabled={reversing || distributing} onClick={reverseLastDist}
                    style={{borderColor:"rgba(239,68,68,.5)",color:"#fca5a5"}}>
              {reversing ? "ReversingÃ¢ÂÂ¦" : "Undo last"}
            </button>
          )}
        </div>
        {lastDist && !distResult?.startsWith("Reversed") && (
          <div className="small" style={{marginTop:4,color:"#fde68a"}}>
            Last: {lastDist.label} assigned to {lastDist.doorIds.length} doors (can undo)
          </div>
        )}
        {distResult && <div className="small" style={{marginTop:4,color: distResult.startsWith("Reversed") ? "#fca5a5" : "#86efac"}}>{distResult}</div>}
      </div>

      {/* Per-door delivery (frame, shutter only) */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{fontWeight:700,marginBottom:8}}>Per-door delivery items</div>
        <div className="row">
          <select className="input" value={pdFloor} onChange={e=>{setPdFloor(e.target.value); setApt("");}} style={{minWidth:140}}>
            <option value="">All floors</option>
            {floors.map(([k,label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <select className="input" value={pdApt} onChange={e=>setPdApt(e.target.value)} style={{minWidth:140}}>
            <option value="">All apts</option>
            {pdApts.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {/* Floor wood delivery summary */}
        <div style={{marginTop:12,marginBottom:12,overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{borderBottom:"1px solid #334155",textAlign:"left"}}>
                <th style={{padding:"6px 8px",fontWeight:600}}>Floor</th>
                <th style={{padding:"6px 8px",fontWeight:600}}>Frames</th>
                <th style={{padding:"6px 8px",fontWeight:600}}>Shutters</th>
                <th style={{padding:"6px 8px",fontWeight:600}}>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const fm = {};
                doors.forEach(d => {
                  const fl = d.floor_label || "Unknown";
                  if (!fm[fl]) fm[fl] = {fr:0,frT:0,sh:0,shT:0,ord:d.floor||0};
                  fm[fl].frT++; fm[fl].shT++;
                  if (d.del_frame) fm[fl].fr++;
                  if (d.del_shutter) fm[fl].sh++;
                });
                return Object.entries(fm)
                  .sort((a,b) => a[1].ord - b[1].ord)
                  .map(([fl, s]) => {
                    const remFr = s.frT - s.fr;
                    const remSh = s.shT - s.sh;
                    const total = remFr + remSh;
                    const allDone = total === 0;
                    return (
                      <tr key={fl} style={{borderBottom:"1px solid #1e293b",opacity:allDone?0.5:1}}>
                        <td style={{padding:"5px 8px",fontWeight:500}}>{fl}</td>
                        <td style={{padding:"5px 8px"}}>
                          <span style={{color:remFr===0?"#22c55e":"#f59e0b"}}>{s.fr}/{s.frT}</span>
                        </td>
                        <td style={{padding:"5px 8px"}}>
                          <span style={{color:remSh===0?"#22c55e":"#f59e0b"}}>{s.sh}/{s.shT}</span>
                        </td>
                        <td style={{padding:"5px 8px"}}>
                          {allDone ? <span style={{color:"#22c55e"}}>All delivered</span>
                            : <span style={{color:"#ef4444"}}>{total} remaining ({remFr} frames, {remSh} shutters)</span>}
                        </td>
                      </tr>
                    );
                  });
              })()}
            </tbody>
          </table>
        </div>
        <div className="small" style={{marginTop:8}}>Page {dPage + 1} of {Math.ceil(filtered.length / DPAGE_SIZE) || 1} â {filtered.length} doors</div>
        <div style={{display:"flex",gap:8,marginTop:4,marginBottom:4}}>
          <button onClick={() => setDPage(p => Math.max(0, p-1))} disabled={dPage === 0} style={{padding:"4px 12px",borderRadius:4,border:"1px solid #475569",background:dPage===0?"#1e293b":"#334155",color:"#e2e8f0",cursor:dPage===0?"not-allowed":"pointer"}}>Prev</button>
          <button onClick={() => setDPage(p => Math.min(Math.ceil(filtered.length/DPAGE_SIZE)-1, p+1))} disabled={(dPage+1)*DPAGE_SIZE >= filtered.length} style={{padding:"4px 12px",borderRadius:4,border:"1px solid #475569",background:(dPage+1)*DPAGE_SIZE>=filtered.length?"#1e293b":"#334155",color:"#e2e8f0",cursor:(dPage+1)*DPAGE_SIZE>=filtered.length?"not-allowed":"pointer"}}>Next</button>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead><tr><th>Floor</th><th>Apt</th><th>Room</th><th>Type</th><th style={{padding:"4px 6px",textAlign:"center"}}>Elements</th>
              <th style={{padding:"4px 6px",textAlign:"center"}}>Frame</th>
              <th style={{padding:"4px 6px",textAlign:"center"}}>Shutter</th></tr></thead>
          <tbody>
            {filtered.slice(dPage * DPAGE_SIZE, (dPage + 1) * DPAGE_SIZE).map(d => {
              const delDone = DEL_ITEMS.filter(([k]) => d[k]).length;
              const hwApplicable = applicableHwKeys(d.room);
              const hwDone = hwApplicable.filter(k => d[k]).length;
              const totalDone = delDone + hwDone;
              return (
                <React.Fragment key={d.id}>
                  <tr>
                    <td>{d.floor_label}</td>
                    <td>{d.apt_no}</td>
                    <td className="small">{d.room || ""}</td>
                    <td>{d.door_type}</td>
                    <td>
                      <span className={`pill ${totalDone===deliveryTotal(d.room)?"INSTALLED":totalDone>0?"IN_PROGRESS":"PENDING"}`}>
                        {totalDone}/{deliveryTotal(d.room)}
                      </span>
                    </td>
                    <td style={{padding:"4px 6px",textAlign:"center"}}>
                  {d.del_frame ? <span style={{color:"#22c55e"}}>Y</span> : <span style={{color:"#ef4444"}}>N</span>}
                </td>
                <td style={{padding:"4px 6px",textAlign:"center"}}>
                  {d.del_shutter ? <span style={{color:"#22c55e"}}>Y</span> : <span style={{color:"#ef4444"}}>N</span>}
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
        {filtered.length > 300 && <div className="small" style={{marginTop:10}}>(Showing first 300 Ã¢ÂÂ narrow filters to see more)</div>}
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
        <div className="small">Floor / Apt</div><div>{door.floor_label} Â· {door.apt_no}</div>
        <div className="small">Room</div><div>{door.room || "Ã¢ÂÂ"}</div>
        <div className="small">Type</div><div>{door.door_type}</div>
        <div className="small">Hardware type</div><div>{hwType === "knob" ? "Knob + Cyl. stopper" : NO_STOPPER_ROOMS.test(door.room || "") ? "Cylinder (no stopper)" : "Cylinder + Bowl stopper"}</div>
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
        {[
          ["del_architraves","Architraves"],
          ["del_hinges","Hinges"],
          ["del_lock","Lock"],
          ...(hwType==="knob" ? [["del_knob","Knob"]] : [["del_cylinder","Cylinder"]]),
          ["del_handle","Handle set"],
          ...(hwType==="knob" ? [["del_cyl_stopper","Cyl. stopper"]] : NO_STOPPER_ROOMS.test(door.room || "") ? [] : [["del_bowl_stopper","Bowl stopper"]]),
        ].map(([key, label]) => (
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

/* Ã¢ÂÂÃ¢ÂÂ Installation Tab Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */

function InstallTab({ doors, types, onUpdate, onRefresh }) {
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
          <input className="input" placeholder="Search qr / apt / roomÃ¢ÂÂ¦" value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1}}/>
          <button className={`tab ${missingOnly?"active":""}`} onClick={()=>setMissingOnly(v=>!v)} style={{padding:"10px 12px"}}>Missing dims</button>
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
                  <td>{d.door_type}{(!d.final_width_mm||!d.final_height_mm||!d.final_thickness_mm) && <span title="Missing dimensions" style={{marginLeft:6,color:"#fca5a5"}}>!</span>}</td>
                  <td><span className={`pill ${d.status}`}>{d.status.replace("_"," ")}</span></td>
                  <td style={{textAlign:"right"}}>
                    <button className="btn" onClick={()=>setOpenId(openId===d.id?null:d.id)}>
                      {openId===d.id ? "Close" : "Open"}
                    </button>
                  </td>
                </tr>
                {openId === d.id && (
                  <tr><td colSpan={6} style={{background:"#0b1220"}}>
                    <InstallDetail door={d} onUpdate={onUpdate} onRefresh={onRefresh} />
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {filtered.length > 300 && <div className="small" style={{marginTop:10}}>(Showing first 300 Ã¢ÂÂ narrow filters to see more)</div>}
      </div>
    </>
  );
}

function InstallDetail({ door, onUpdate, onRefresh }) {
  const toggle = (key) => onUpdate(door.id, { [key]: !door[key] });
  const doneCount = applicableInstallChecklist(door.room).filter(([k]) => door[k]).length;
  const hwType = roomHwType(door.room);

  const setSnagged = () => {
    if (door.status === "SNAGGED") {
      onUpdate(door.id, { status: "PENDING" });
    } else {
      onUpdate(door.id, { status: "SNAGGED" });
    }
  };

  return (
    <div style={{padding:"10px 4px"}}>
      <div className="kv">
        <div className="small">QR code</div><div className="small"><code>{door.qr_code}</code></div>
        <div className="small">Floor / Apt</div><div>{door.floor_label} Â· {door.apt_no}</div>
        <div className="small">Room</div><div>{door.room || "Ã¢ÂÂ"}</div>
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
        <div className="small" style={{color:"#93c5fd"}}>{hwType === "knob" ? "Knob + Cyl. stopper" : NO_STOPPER_ROOMS.test(door.room || "") ? "Cylinder (no stopper)" : "Cylinder + Bowl stopper"}</div>
      </div>
      <div className="checks" style={{marginTop:8}}>
        {[
          ["del_architraves","Architraves"],
          ["del_hinges","Hinges"],
          ["del_lock","Lock"],
          ...(hwType==="knob" ? [["del_knob","Knob"]] : [["del_cylinder","Cylinder"]]),
          ["del_handle","Handle"],
          ...(hwType==="knob" ? [["del_cyl_stopper","Cyl. stopper"]] : NO_STOPPER_ROOMS.test(door.room || "") ? [] : [["del_bowl_stopper","Bowl stopper"]]),
        ].map(([key, label]) => (
          <label key={key} className={`check ${door[key]?"done":""}`}>
            <input type="checkbox" checked={!!door[key]} onChange={()=>toggle(key)} />
            <span>{label} {door[key] ? "\u2713" : "\u2717"}</span>
          </label>
        ))}
      </div>

      <hr/>
      <div className="row" style={{justifyContent:"space-between"}}>
        <div style={{fontWeight:700}}>Installation checklist</div>
        <div className="small">{doneCount}/6 done</div>
      </div>
      <div className="checks" style={{marginTop:8}}>
        {applicableInstallChecklist(door.room).map(([key,label]) => (
          <label key={key} className={`check ${door[key]?"done":""}`}>
            <input type="checkbox" checked={!!door[key]} onChange={()=>toggle(key)} />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <hr/>
      <div className="row" style={{justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontWeight:700}}>Snagging</div>
        <button className="btn" onClick={setSnagged} style={{borderColor: door.status==="SNAGGED" ? "rgba(239,68,68,.6)" : "rgba(239,68,68,.3)"}}>
          {door.status === "SNAGGED" ? "Clear snag" : "Mark snagged"}
        </button>
      </div>

      {/* Snag photo section - always visible when snagged, or if photos exist */}
      {(door.status === "SNAGGED" || (door.snag_photos && door.snag_photos.length > 0)) && (
        <SnagPhotos door={door} onUpdate={onUpdate} onRefresh={onRefresh} />
      )}

      {door.installed_at && <div className="small" style={{marginTop:10,color:"#86efac"}}>Installed {new Date(door.installed_at).toLocaleString()}</div>}
    </div>
  );
}

/* Ã¢ÂÂÃ¢ÂÂ Snag Photos Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */

function SnagPhotos({ door, onUpdate, onRefresh }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const photos = door.snag_photos || [];

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    setUploadMsg(null);

    const newPhotos = [...photos];
    let uploaded = 0;

    for (const file of files) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `door-${door.id}/${Date.now()}-${Math.random().toString(36).slice(2,6)}.${ext}`;

      const { error } = await supabase.storage.from("snag-photos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) {
        console.error("Upload error:", error);
        continue;
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/snag-photos/${path}`;
      newPhotos.push(publicUrl);
      uploaded++;
    }

    if (uploaded > 0) {
      const { error: dbErr } = await supabase.from("doors").update({
        snag_photos: newPhotos,
        updated_at: new Date().toISOString(),
      }).eq("id", door.id);

      if (dbErr) {
        setUploadMsg(`DB error: ${dbErr.message}`);
      } else {
        setUploadMsg(`${uploaded} photo(s) uploaded`);
        onRefresh();
      }
    } else {
      setUploadMsg("Upload failed Ã¢ÂÂ check console");
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removePhoto = async (url) => {
    const newPhotos = photos.filter(p => p !== url);
    // Extract storage path from URL
    const pathMatch = url.split("/snag-photos/")[1];
    if (pathMatch) {
      await supabase.storage.from("snag-photos").remove([pathMatch]);
    }
    await supabase.from("doors").update({
      snag_photos: newPhotos,
      updated_at: new Date().toISOString(),
    }).eq("id", door.id);
    onRefresh();
  };

  return (
    <div style={{marginTop:10}}>
      <div className="row" style={{justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontWeight:600,fontSize:13}}>Snag photos ({photos.length})</div>
        <label className="btn primary" style={{cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}}>
          {uploading ? "UploadingÃ¢ÂÂ¦" : "Attach photo"}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={handleFiles}
            style={{display:"none"}}
            disabled={uploading}
          />
        </label>
      </div>
      {uploadMsg && <div className="small" style={{marginBottom:6,color: uploadMsg.includes("error") || uploadMsg.includes("failed") ? "#fca5a5" : "#86efac"}}>{uploadMsg}</div>}
      {photos.length > 0 && (
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {photos.map((url, i) => (
            <div key={i} style={{position:"relative",width:100,height:100,borderRadius:6,overflow:"hidden",border:"1px solid rgba(255,255,255,.1)"}}>
              <img
                src={url}
                alt={`Snag ${i+1}`}
                style={{width:"100%",height:"100%",objectFit:"cover",cursor:"pointer"}}
                onClick={() => window.open(url, "_blank")}
              />
              <button
                onClick={(e) => { e.stopPropagation(); removePhoto(url); }}
                style={{
                  position:"absolute",top:2,right:2,
                  background:"rgba(0,0,0,.7)",color:"#fff",
                  border:"none",borderRadius:"50%",
                  width:20,height:20,fontSize:12,
                  cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                }}
              >&times;</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Ã¢ÂÂÃ¢ÂÂ Shared: DimEditor Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */

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
          <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Ã¢ÂÂ"
                 value={w} onChange={dimChange(setW)} style={{width:"100%",minWidth:0}}/>
        </div>
        <div style={{flex:1,minWidth:90}}>
          <div className="small" style={{marginBottom:4}}>Height</div>
          <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Ã¢ÂÂ"
                 value={h} onChange={dimChange(setH)} style={{width:"100%",minWidth:0}}/>
        </div>
        <div style={{flex:1,minWidth:90}}>
          <div className="small" style={{marginBottom:4}}>Thickness</div>
          <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Ã¢ÂÂ"
                 value={t} onChange={dimChange(setT)} style={{width:"100%",minWidth:0}}/>
        </div>
        <button className={`btn ${dirty?"primary":""}`} disabled={!dirty||saving} onClick={save}>
          {saving ? "SavingÃ¢ÂÂ¦" : dirty ? "Save" : "Saved"}
        </button>
      </div>
    </div>
  );
}


/* ââ FR Dashboard ââââââââââââââââââââââââââââââââââââ */

/* ââ FR Dashboard ââââââââââââââââââââââââââ */
function FRDashboard({ doors }) {
  const total = doors.length;
  const installed = doors.filter(d => d.status === "INSTALLED").length;
  const inProgress = doors.filter(d => d.status === "IN_PROGRESS").length;
  const delivered = doors.filter(d => d.status === "DELIVERED").length;
  const partialDel = doors.filter(d => d.status === "PARTIAL_DEL").length;
  const pending = doors.filter(d => d.status === "PENDING").length;

  /* delivery summary per item */
  const delSummary = FR_DEL_ALL.map(([key, label]) => {
    const applicable = doors.filter(d => frApplicableDel(d).includes(key)).length;
    const done = doors.filter(d => frApplicableDel(d).includes(key) && d[key]).length;
    return { label, done, applicable, remaining: applicable - done };
  });

  /* install summary per item */
  const instSummary = FR_INSTALL_CHECKLIST.map(([key, label]) => {
    const done = doors.filter(d => d[key]).length;
    return { label, done, total, remaining: total - done };
  });

  /* by-floor breakdown */
  const floors = [...new Set(doors.map(d => d.floor))].sort();
  const byFloor = floors.map(f => {
    const fd = doors.filter(d => d.floor === f);
    const inst = fd.filter(d => d.status === "INSTALLED").length;
    const inp = fd.filter(d => d.status === "IN_PROGRESS").length;
    const del = fd.filter(d => d.status === "DELIVERED").length;
    const pdel = fd.filter(d => d.status === "PARTIAL_DEL").length;
    const pend = fd.filter(d => d.status === "PENDING").length;
    return { floor: f, total: fd.length, inst, inp, del, pdel, pend };
  });

  const pctI = total ? Math.round(installed / total * 100) : 0;
  const pctP = total ? Math.round(inProgress / total * 100) : 0;
  const pctD = total ? Math.round(delivered / total * 100) : 0;
  const pctPD = total ? Math.round(partialDel / total * 100) : 0;
  const pctPe = total ? Math.round(pending / total * 100) : 0;

  return (
    <div>
      {/* Summary cards */}
      <div className="summary-row" style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:12}}>
        <div className="card"><div className="label">TOTAL</div><div className="big">{total}</div></div>
        <div className="card"><div className="label">DELIVERED</div><div className="big green">{delivered}</div><div className="small">{total ? Math.round(delivered/total*100) : 0}%</div></div>
        <div className="card"><div className="label">PENDING DELIVERY</div><div className="big red">{pending + partialDel}</div><div className="small">{total ? Math.round((pending+partialDel)/total*100) : 0}%</div></div>
        <div className="card"><div className="label">INSTALLED</div><div className="big green">{installed}</div><div className="small">{pctI}% of delivered</div></div>
        <div className="card"><div className="label">IN PROGRESS</div><div className="big yellow">{inProgress}</div><div className="small">{total ? Math.round(inProgress/total*100) : 0}%</div></div>
      </div>

      {/* Delivery summary */}
      <div className="card" style={{marginTop:18}}>
        <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:340}}>
            <h3>Delivery summary</h3>
            <table className="tbl" style={{width:"100%"}}>
              <thead><tr><th>Item</th><th>Delivered</th><th>Remaining</th></tr></thead>
              <tbody>
                {delSummary.map(s => (
                  <tr key={s.label}>
                    <td>{s.label}</td>
                    <td>{s.done}/{s.applicable}</td>
                    <td className={s.remaining > 0 ? "red" : "green"}>{s.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{flex:1,minWidth:340,marginLeft:24}}>
            <h3>Installation summary</h3>
            <table className="tbl" style={{width:"100%"}}>
              <thead><tr><th>Item</th><th>Done</th><th>Remaining</th></tr></thead>
              <tbody>
                {instSummary.map(s => (
                  <tr key={s.label}>
                    <td>{s.label}</td>
                    <td>{s.done}/{s.total}</td>
                    <td className={s.remaining > 0 ? "red" : "green"}>{s.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="card" style={{marginTop:18}}>
        <h3>Overall progress</h3>
        <div style={{height:28,display:"flex",borderRadius:6,overflow:"hidden",background:"#555"}}>
          {pctI > 0 && <div style={{width:pctI+"%",background:"#4caf50"}} />}
          {pctP > 0 && <div style={{width:pctP+"%",background:"#ff9800"}} />}
          {pctD > 0 && <div style={{width:pctD+"%",background:"#2196f3"}} />}
          {pctPD > 0 && <div style={{width:pctPD+"%",background:"#9c27b0"}} />}
          {pctPe > 0 && <div style={{width:pctPe+"%",background:"#777"}} />}
        </div>
        <div className="small" style={{marginTop:6,display:"flex",gap:16,flexWrap:"wrap"}}>
          <span><span style={{display:"inline-block",width:12,height:12,background:"#4caf50",borderRadius:2,marginRight:4}} />Installed {installed} ({pctI}%)</span>
          <span><span style={{display:"inline-block",width:12,height:12,background:"#ff9800",borderRadius:2,marginRight:4}} />In progress {inProgress} ({pctP}%)</span>
          <span><span style={{display:"inline-block",width:12,height:12,background:"#2196f3",borderRadius:2,marginRight:4}} />Delivered {delivered} ({pctD}%)</span>
          <span><span style={{display:"inline-block",width:12,height:12,background:"#9c27b0",borderRadius:2,marginRight:4}} />Partial {partialDel} ({pctPD}%)</span>
          <span><span style={{display:"inline-block",width:12,height:12,background:"#777",borderRadius:2,marginRight:4}} />Pending {pending} ({pctPe}%)</span>
        </div>
      </div>

      {/* By floor */}
      <div className="card" style={{marginTop:18}}>
        <h3>By floor</h3>
        {byFloor.map(f => {
          const pi = f.total ? Math.round(f.inst/f.total*100) : 0;
          const pp = f.total ? Math.round(f.inp/f.total*100) : 0;
          const pd = f.total ? Math.round(f.del/f.total*100) : 0;
          const ppd = f.total ? Math.round(f.pdel/f.total*100) : 0;
          return (
            <div key={f.floor} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <strong>{f.floor}</strong>
                <span className="small">{f.inst}/{f.total} installed</span>
              </div>
              <div style={{height:14,display:"flex",borderRadius:4,overflow:"hidden",background:"#555"}}>
                {pi > 0 && <div style={{width:pi+"%",background:"#4caf50"}} />}
                {pp > 0 && <div style={{width:pp+"%",background:"#ff9800"}} />}
                {pd > 0 && <div style={{width:pd+"%",background:"#2196f3"}} />}
                {ppd > 0 && <div style={{width:ppd+"%",background:"#9c27b0"}} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/* ââ FR Wood Elements Delivery ââââââââââââ */
function FRWoodDelivery({ doors, onBulk, onRefresh }) {
  const [woodType, setWoodType] = useState("frames");
  const [selFloor, setSelFloor] = useState("");
  const [marking, setMarking] = useState(false);

  const floors = useMemo(() => [...new Set(doors.map(d => d.floor))].sort(), [doors]);
  const floorDoors = useMemo(() => selFloor ? doors.filter(d => d.floor === selFloor) : [], [doors, selFloor]);
  const delKey = woodType === "frames" ? "del_frame" : "del_shutter";
  const delivered = floorDoors.filter(d => woodType === "full" ? (d.del_frame && d.del_shutter) : !!d[delKey]).length;
  const total = floorDoors.length;

  const markAll = async (val) => {
    setMarking(true);
    if (woodType === "full") {
      const ups = floorDoors.filter(d => val ? (!d.del_frame || !d.del_shutter) : (d.del_frame || d.del_shutter))
        .map(d => ({ id: d.id, patch: { del_frame: val, del_shutter: val } }));
      if (ups.length > 0) await onBulk(ups);
    } else {
      const ups = floorDoors.filter(d => !!d[delKey] !== val).map(d => ({ id: d.id, patch: { [delKey]: val } }));
      if (ups.length > 0) await onBulk(ups);
    }
    await onRefresh();
    setMarking(false);
  };

  return (
    <div className="card" style={{marginBottom:12}}>
      <div style={{fontWeight:700,marginBottom:10}}>Wood elements delivery</div>
      <div className="small" style={{marginBottom:8,opacity:.7}}>
        Select delivery type, pick a floor, then click doors to mark as received. Count and confirm before distributing.
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {["frames","shutters","full"].map(t => (
          <button key={t} className={"btn" + (woodType === t ? " active" : "")}
            style={woodType === t ? {background:"#2563eb",color:"#fff"} : {}}
            onClick={() => setWoodType(t)}>
            {t === "full" ? "Full door set" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div style={{marginBottom:12}}>
        <label className="small" style={{marginRight:8}}>Floor</label>
        <select className="sel" value={selFloor} onChange={e => setSelFloor(e.target.value)}>
          <option value="">{"â Select floor â"}</option>
          {floors.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      {selFloor && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span className="small">{delivered}/{total} {woodType === "full" ? "full sets" : woodType} delivered on {selFloor}</span>
            <div style={{display:"flex",gap:8}}>
              <button className="btn small" disabled={marking} onClick={() => markAll(true)}>{marking ? "..." : "Mark all"}</button>
              <button className="btn small" disabled={marking} onClick={() => markAll(false)}>{marking ? "..." : "Unmark all"}</button>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:6}}>
            {floorDoors.map(d => {
              const done = woodType === "full" ? (d.del_frame && d.del_shutter) : !!d[delKey];
              return (
                <button key={d.id} className={"btn small" + (done ? " done" : "")}
                  style={{background: done ? "#166534" : "#1e293b", border:"1px solid #334", textAlign:"center", padding:"6px 4px"}}
                  onClick={async () => {
                    if (woodType === "full") {
                      await onBulk([{id: d.id, patch: { del_frame: !done, del_shutter: !done }}]);
                    } else {
                      await onBulk([{id: d.id, patch: { [delKey]: !done }}]);
                    }
                    await onRefresh();
                  }}>
                  <div style={{fontSize:12}}>{d.apt_no}</div>
                  <div style={{fontSize:10,opacity:.7}}>{d.door_type}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
 => s.applicable > 0);
  }, [doors]);

  const distribute = async () => {
    const qty = parseInt(hwQty, 10);
    if (!qty || qty <= 0) return;
    setDistributing(true); setDistResult(null);
    const sorted = [...doors].sort((a,b) => (a.floor||"").localeCompare(b.floor||"") || (a.apt_no||"").localeCompare(b.apt_no||""));
    const eligible = sorted.filter(d => frApplicableDel(d).includes(hwType) && !d[hwType]);
    const hwLabel = FR_DEL_ALL.find(([k]) => k === hwType)?.[1] || hwType;
    let toAssign = [];
    /* Items with per-door quantities */
    if (hwType === "del_hinges") {
      let rem = qty;
      for (const d of eligible) { const per = d.qty_hinges || 4; if (rem >= per) { toAssign.push(d); rem -= per; } else break; }
    } else if (hwType === "del_door_closer") {
      let rem = qty;
      for (const d of eligible) { const per = d.qty_door_closer || 1; if (rem >= per) { toAssign.push(d); rem -= per; } else break; }
    } else if (hwType === "del_fhc_lock") {
      let rem = qty;
      for (const d of eligible) { const per = d.qty_fhc_lock || 1; if (rem >= per) { toAssign.push(d); rem -= per; } else break; }
    } else if (hwType === "del_flush_bolt") {
      let rem = qty;
      for (const d of eligible) { const per = d.qty_flush_bolt || 1; if (rem >= per) { toAssign.push(d); rem -= per; } else break; }
    } else {
      toAssign = eligible.slice(0, qty);
    }
    const updates = toAssign.map(d => ({ id: d.id, patch: { [hwType]: true } }));
    if (updates.length > 0) {
      setLastDist({ hwType, doorIds: toAssign.map(d => d.id), label: hwLabel });
      await onBulk(updates);
    }
    setDistResult(qty + " " + hwLabel + " -> " + updates.length + " doors, " + (eligible.length - updates.length) + " remaining");
    setHwQty(""); setDistributing(false);
  };

  const reverseLastDist = async () => {
    if (!lastDist || !confirm("Reverse last distribution?\\nThis will uncheck \\\"" + lastDist.label + "\\\" on " + lastDist.doorIds.length + " doors.")) return;
    setReversing(true);
    await onBulk(lastDist.doorIds.map(id => ({ id, patch: { [lastDist.hwType]: false } })));
    setDistResult("Reversed: un-assigned " + lastDist.label + " from " + lastDist.doorIds.length + " doors");
    setLastDist(null); setReversing(false);
  };

  const floorSummary = useMemo(() => floors.map(f => {
    const fd = doors.filter(d => d.floor === f);
    const fullyDel = fd.filter(d => frApplicableDel(d).every(k => d[k])).length;
    return { floor: f, total: fd.length, fullyDel, remaining: fd.length - fullyDel };
  }), [doors, floors]);

  return (
    <div>
      <FRWoodDelivery doors={doors} onBulk={onBulk} onRefresh={onRefresh} />

      <div className="card" style={{marginBottom:12}}>
        <div style={{fontWeight:700,marginBottom:10}}>Bulk hardware distribution</div>
        <div className="small" style={{marginBottom:8,opacity:.7}}>
          Enter quantity received (pieces) {"->"}  auto-assigns to doors in ascending floor order. Hinges: qty per door varies. Door Closer/FHC Lock/Flush Bolt: qty per door varies.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"auto auto auto",gap:"4px 12px",marginBottom:12,alignItems:"center"}}>
          <div className="small" style={{fontWeight:700,opacity:.6}}>Item</div>
          <div className="small" style={{fontWeight:700,opacity:.6}}>Assigned</div>
          <div className="small" style={{fontWeight:700,opacity:.6}}>Remaining</div>
          {hwSummary.map(s => (
            <React.Fragment key={s.key}>
              <div className="small">{s.label}</div>
              <div>{s.done}/{s.applicable}</div>
              <div style={{color: s.remaining > 0 ? "#fca5a5" : "#4ade80"}}>{s.remaining}</div>
            </React.Fragment>
          ))}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <label className="small">Item type</label>
          <select className="sel" value={hwType} onChange={e => setHwType(e.target.value)}>
            {hwSummary.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <label className="small">Quantity (pcs)</label>
          <input type="number" className="inp" placeholder="e.g. 200" value={hwQty}
            onChange={e => setHwQty(e.target.value)} style={{width:100}} />
          <button className="btn" style={{background:"#dc2626"}} disabled={distributing}
            onClick={distribute}>{distributing ? "..." : "Distribute"}</button>
          {lastDist && <button className="btn" disabled={reversing} onClick={reverseLastDist}>{reversing ? "..." : "Undo last"}</button>}
        </div>
        {distResult && <div className="small" style={{marginTop:8,color:"#4ade80"}}>{distResult}</div>}
      </div>

      <div className="card" style={{marginBottom:12}}>
        <h3>Delivery summary by floor</h3>
        <table className="tbl" style={{width:"100%"}}>
          <thead><tr><th>Floor</th><th>Fully Delivered</th><th>Total</th><th>Remaining</th></tr></thead>
          <tbody>
            {floorSummary.map(s => (
              <tr key={s.floor}>
                <td><strong>{s.floor}</strong></td>
                <td className={s.fullyDel === s.total ? "green" : ""}>{s.fullyDel}/{s.total}</td>
                <td>{s.total}</td>
                <td className={s.remaining > 0 ? "red" : "green"}>{s.remaining > 0 ? s.remaining + " remaining" : "All delivered"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Per-door delivery items</h3>
        <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap"}}>
          <select className="sel" value={selFloor} onChange={e => { setSelFloor(e.target.value); setSelApt("all"); setPage(0); }}>
            <option value="all">All floors</option>
            {floors.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select className="sel" value={selApt} onChange={e => { setSelApt(e.target.value); setPage(0); }}>
            <option value="all">All apts</option>
            {apts.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="small" style={{marginBottom:8}}>Showing {filtered.length} of {doors.length} doors</div>
        <table className="tbl" style={{width:"100%"}}>
          <thead><tr><th>Floor</th><th>Apt</th><th>Door Type</th><th>Location</th><th>Delivered</th><th></th></tr></thead>
          <tbody>
            {paged.map(d => {
              const appKeys = frApplicableDel(d);
              const done = appKeys.filter(k => d[k]).length;
              const isOpen = openId === d.id;
              return (
                <React.Fragment key={d.id}>
                  <tr style={{cursor:"pointer"}} onClick={() => setOpenId(isOpen ? null : d.id)}>
                    <td>{d.floor}</td>
                    <td><strong>{d.apt_no}</strong></td>
                    <td>{d.door_type}</td>
                    <td className="small">{d.door_location}</td>
                    <td><span className={"badge " + (done === appKeys.length ? "green" : done > 0 ? "yellow" : "red")}>{done}/{appKeys.length}</span></td>
                    <td><button className="btn small">{isOpen ? "Close" : "Open"}</button></td>
                  </tr>
                  {isOpen && <tr><td colSpan={6} style={{padding:0}}><FRDeliveryDetail door={d} onUpdate={onUpdate} /></td></tr>}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{marginTop:12,display:"flex",gap:8,alignItems:"center"}}>
            <span className="small">Page {page + 1} of {totalPages} {" â "} {filtered.length} doors</span>
            <button className="btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
            <button className="btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}


/* ââ FR Delivery Detail (inline) âââââââââ */
function FRDeliveryDetail({ door, onUpdate }) {
  const appKeys = frApplicableDel(door);
  const appItems = FR_DEL_ALL.filter(([k]) => appKeys.includes(k));

  return (
    <div className="card" style={{margin:8,background:"#1a2332"}}>
      <div className="small" style={{marginBottom:8}}>
        SR#{door.sr_no} Â· {door.door_type} Â· {door.floor} / {door.apt_no} / {door.door_location}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <strong>Delivered hardware</strong>
        <span className="small">{appKeys.filter(k => door[k]).length}/{appKeys.length} items</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        {appItems.map(([key, label]) => {
          const checked = !!door[key];
          return (
            <label key={key} className={"chk-card" + (checked ? " done" : "")} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:6,border:"1px solid #334",cursor:"pointer"}}>
              <input type="checkbox" checked={checked} onChange={() => onUpdate(door.id, { [key]: !checked })} />
              <span>{label} {checked ? "â" : ""}</span>
            </label>
          );
        })}
      </div>
      {/* Show quantity and color info */}
      {(door.qty_hinges > 0 || door.qty_fhc_lock > 0 || door.qty_door_closer > 0 || door.qty_flush_bolt > 0) && (
        <div className="small" style={{marginTop:8,color:"#aaa"}}>
          {door.qty_hinges > 0 && <span>Hinges: {door.qty_hinges}x Â· </span>}
          {door.qty_fhc_lock > 0 && <span>FHC Lock: {door.qty_fhc_lock}x Â· </span>}
          {door.qty_door_closer > 0 && <span>Door Closer: {door.qty_door_closer}x Â· </span>}
          {door.qty_flush_bolt > 0 && <span>Flush Bolt: {door.qty_flush_bolt}x</span>}
        </div>
      )}
      {(door.hw_lock_color || door.hw_cylinder_color || door.hw_handle_color || door.hw_stopper_color) && (
        <div className="small" style={{marginTop:4,color:"#aaa"}}>
          Colors:
          {door.hw_lock_color && <span> Lock: {door.hw_lock_color}</span>}
          {door.hw_cylinder_color && <span> Â· Cyl: {door.hw_cylinder_color}</span>}
          {door.hw_handle_color && <span> Â· Handle: {door.hw_handle_color}</span>}
          {door.hw_stopper_color && <span> Â· Stopper: {door.hw_stopper_color}</span>}
        </div>
      )}
    </div>
  );
}

/* ââ FR Installation Tab ââââââââââââââââââ */
function FRInstallTab({ doors, onUpdate, onRefresh }) {
  const [selFloor, setSelFloor] = useState("all");
  const [selApt, setSelApt] = useState("all");
  const [selStatus, setSelStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  const floors = [...new Set(doors.map(d => d.floor))].sort();
  let filtered = doors;
  if (selFloor !== "all") filtered = filtered.filter(d => d.floor === selFloor);
  const apts = [...new Set(filtered.map(d => d.apt_no))].sort();
  if (selApt !== "all") filtered = filtered.filter(d => d.apt_no === selApt);
  if (selStatus !== "all") filtered = filtered.filter(d => d.status === selStatus);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(d =>
      (d.apt_no || "").toLowerCase().includes(q) ||
      (d.door_location || "").toLowerCase().includes(q) ||
      (d.door_type || "").toLowerCase().includes(q) ||
      String(d.sr_no).includes(q)
    );
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const statusColors = { INSTALLED: "#4caf50", IN_PROGRESS: "#ff9800", DELIVERED: "#2196f3", PARTIAL_DEL: "#9c27b0", PENDING: "#777" };

  return (
    <div>
      <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <select className="sel" value={selFloor} onChange={e => { setSelFloor(e.target.value); setSelApt("all"); setPage(0); }}>
          <option value="all">All floors</option>
          {floors.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select className="sel" value={selApt} onChange={e => { setSelApt(e.target.value); setPage(0); }}>
          <option value="all">All apts</option>
          {apts.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="sel" value={selStatus} onChange={e => { setSelStatus(e.target.value); setPage(0); }}>
          <option value="all">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PARTIAL_DEL">Partial Delivery</option>
          <option value="DELIVERED">Delivered</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="INSTALLED">Installed</option>
        </select>
        <input className="sel" placeholder="Search sr / apt / roomâ¦" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} style={{minWidth:180}} />
      </div>

      <div className="small" style={{marginBottom:8}}>Showing {filtered.length} of {doors.length}</div>

      <table className="tbl" style={{width:"100%"}}>
        <thead>
          <tr><th>Floor</th><th>Apt</th><th>Door Type</th><th>Location</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {paged.map(d => {
            const isOpen = openId === d.id;
            return (
              <React.Fragment key={d.id}>
                <tr>
                  <td>{d.floor}</td>
                  <td><strong>{d.apt_no}</strong></td>
                  <td>{d.door_type}</td>
                  <td className="small">{d.door_location}</td>
                  <td><span className="badge" style={{background:statusColors[d.status] || "#777"}}>{d.status}</span></td>
                  <td><button className="btn" onClick={() => setOpenId(isOpen ? null : d.id)}>{isOpen ? "Close" : "Open"}</button></td>
                </tr>
                {isOpen && (
                  <tr><td colSpan={6} style={{padding:0}}>
                    <FRInstallDetail door={d} onUpdate={onUpdate} onRefresh={onRefresh} />
                  </td></tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={{marginTop:12,display:"flex",gap:8,alignItems:"center"}}>
          <span className="small">Page {page + 1} of {totalPages} â {filtered.length} doors</span>
          <button className="btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
          <button className="btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

/* ââ FR Installation Detail (inline) âââââ */
function FRInstallDetail({ door, onUpdate, onRefresh }) {
  const [notes, setNotes] = useState(door.notes || "");
  const [saving, setSaving] = useState(false);

  const appKeys = frApplicableDel(door);
  const appItems = FR_DEL_ALL.filter(([k]) => appKeys.includes(k));
  const delDone = appKeys.filter(k => door[k]).length;

  const statusColors = { INSTALLED: "#4caf50", IN_PROGRESS: "#ff9800", DELIVERED: "#2196f3", PARTIAL_DEL: "#9c27b0", PENDING: "#777" };

  const saveNotes = async () => {
    setSaving(true);
    await onUpdate(door.id, { notes });
    setSaving(false);
  };

  return (
    <div className="card" style={{margin:8,background:"#1a2332"}}>
      {/* Door info */}
      <table className="tbl" style={{width:"auto",marginBottom:16}}>
        <tbody>
          <tr><td className="small">SR#</td><td><strong>{door.sr_no}</strong></td></tr>
          <tr><td className="small">Floor / Apt</td><td>{door.floor} Â· {door.apt_no}</td></tr>
          <tr><td className="small">Door Type</td><td>{door.door_type}</td></tr>
          <tr><td className="small">Location</td><td>{door.door_location}</td></tr>
          <tr><td className="small">Status</td><td><span className="badge" style={{background:statusColors[door.status] || "#777"}}>{door.status}</span></td></tr>
        </tbody>
      </table>

      {/* Dimensions */}
      <div style={{marginBottom:16}}>
        <strong>Dimensions (mm)</strong>
        <div className="small" style={{marginTop:4}}>
          Width: {door.width} Â· Height: {door.height} Â· Thickness: {door.thickness} Â· Opening: {door.opening_direction} Â· Architraves: {door.architraves}
        </div>
      </div>

      {/* Hardware info */}
      {(door.qty_hinges > 0 || door.qty_fhc_lock > 0 || door.qty_door_closer > 0 || door.qty_flush_bolt > 0) && (
        <div style={{marginBottom:16}}>
          <strong>Hardware quantities</strong>
          <div className="small" style={{marginTop:4}}>
            {door.qty_hinges > 0 && <span>Hinges: {door.qty_hinges}x Â· </span>}
            {door.qty_fhc_lock > 0 && <span>FHC Lock: {door.qty_fhc_lock}x Â· </span>}
            {door.qty_door_closer > 0 && <span>Door Closer: {door.qty_door_closer}x Â· </span>}
            {door.qty_flush_bolt > 0 && <span>Flush Bolt: {door.qty_flush_bolt}x</span>}
          </div>
        </div>
      )}
      {(door.hw_lock_color || door.hw_cylinder_color || door.hw_handle_color || door.hw_stopper_color) && (
        <div style={{marginBottom:16}}>
          <strong>Hardware colors</strong>
          <div className="small" style={{marginTop:4}}>
            {door.hw_lock_color && <span>Lock: {door.hw_lock_color} Â· </span>}
            {door.hw_cylinder_color && <span>Cylinder: {door.hw_cylinder_color} Â· </span>}
            {door.hw_handle_color && <span>Handle: {door.hw_handle_color} Â· </span>}
            {door.hw_stopper_color && <span>Stopper: {door.hw_stopper_color}</span>}
          </div>
        </div>
      )}

      {/* Delivered hardware */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <strong>Delivered hardware</strong>
        <span className="small">{delDone}/{appKeys.length} delivered</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:16}}>
        {appItems.map(([key, label]) => {
          const checked = !!door[key];
          return (
            <label key={key} className={"chk-card" + (checked ? " done" : "")} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:6,border:"1px solid #334",cursor:"pointer"}}>
              <input type="checkbox" checked={checked} onChange={() => onUpdate(door.id, { [key]: !checked })} />
              <span>{label} {checked ? "â" : ""}</span>
            </label>
          );
        })}
      </div>

      {/* Installation checklist */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <strong>Installation checklist</strong>
        <span className="small">{FR_INSTALL_CHECKLIST.filter(([k]) => door[k]).length}/{FR_INSTALL_CHECKLIST.length} done</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:16}}>
        {FR_INSTALL_CHECKLIST.map(([key, label]) => {
          const checked = !!door[key];
          return (
            <label key={key} className={"chk-card" + (checked ? " done" : "")} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:6,border:"1px solid #334",cursor:"pointer"}}>
              <input type="checkbox" checked={checked} onChange={() => onUpdate(door.id, { [key]: !checked })} />
              <span>{label} {checked ? "â" : ""}</span>
            </label>
          );
        })}
      </div>

      {/* Notes */}
      <div style={{marginBottom:8}}>
        <strong>Notes</strong>
        <div style={{display:"flex",gap:8,marginTop:6}}>
          <textarea style={{flex:1,minHeight:60,padding:8,borderRadius:6,border:"1px solid #334",background:"#0d1117",color:"#e6e6e6",fontFamily:"inherit",fontSize:13}} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..." />
          <button className="btn" onClick={saveNotes} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
