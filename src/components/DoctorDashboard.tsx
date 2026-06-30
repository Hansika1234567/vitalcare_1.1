import React, { useState, useEffect } from "react";
import { 
  db, 
  collection, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc,
  orderBy,
  addDoc
} from "../firebase";
import { UserProfile, Appointment, PatientDoctor, VitalsRecord, HealthAlert } from "../types";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from "recharts";
import { Activity, Calendar, User, Check, X, Bell, TrendingUp, ChevronRight, LogOut, UserPlus } from "lucide-react";

interface DoctorDashboardProps {
  profile: UserProfile;
  onLogout: () => void;
}

export default function DoctorDashboard({ profile, onLogout }: DoctorDashboardProps) {
  // Real-time states
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [assignedRelations, setAssignedRelations] = useState<PatientDoctor[]>([]);
  const [assignedPatients, setAssignedPatients] = useState<UserProfile[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Vitals & alerts for the active patient
  const [activeVitals, setActiveVitals] = useState<VitalsRecord[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<HealthAlert[]>([]);

  const [loading, setLoading] = useState(true);

  // States for sending doctor updates
  const [doctorNote, setDoctorNote] = useState("");
  const [sendingNote, setSendingNote] = useState(false);
  const [noteStatus, setNoteStatus] = useState("");

  const handleSendDoctorNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorNote.trim() || !selectedPatientId) return;
    setSendingNote(true);
    setNoteStatus("");
    try {
      await addDoc(collection(db, "notifications"), {
        recipient_id: selectedPatientId,
        recipient_role: "patient",
        type: "doctor_update",
        message: `🩺 Dr. ${profile.fullName} sent you an update: "${doctorNote.trim()}"`,
        related_id: profile.uid,
        read: false,
        created_at: new Date().toISOString()
      });
      setDoctorNote("");
      setNoteStatus("Update sent to patient successfully!");
      setTimeout(() => setNoteStatus(""), 4000);
    } catch (err) {
      console.error("Error sending doctor note:", err);
      setNoteStatus("Failed to send update.");
    } finally {
      setSendingNote(false);
    }
  };

  useEffect(() => {
    if (!profile.uid) return;

    // 1. Listen to appointments for this doctor
    const apptsQ = query(
      collection(db, "appointments"),
      where("doctor_id", "==", profile.uid)
    );
    const unsubAppts = onSnapshot(apptsQ, (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Appointment[];
      setAppointments(records);
    }, (err) => {
      console.warn("Appointments subscription failed:", err);
    });

    // 2. Listen to active doctor-patient relationships
    const relsQ = query(
      collection(db, "patient_doctor"),
      where("doctor_id", "==", profile.uid)
    );
    const unsubRels = onSnapshot(relsQ, async (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PatientDoctor[];
      setAssignedRelations(records);

      // Fetch patient profiles
      const activePatientIds = records
        .filter(r => r.status === "active")
        .map(r => r.patient_id);

      if (activePatientIds.length > 0) {
        try {
          const profilesList: UserProfile[] = [];
          for (const pid of activePatientIds) {
            const pSnap = await getDocs(query(collection(db, "users"), where("uid", "==", pid)));
            if (!pSnap.empty) {
              profilesList.push(pSnap.docs[0].data() as UserProfile);
            }
          }
          setAssignedPatients(profilesList);
          if (profilesList.length > 0 && !selectedPatientId) {
            setSelectedPatientId(profilesList[0].uid);
          }
        } catch (err) {
          console.error("Error loading patient profiles", err);
        }
      } else {
        setAssignedPatients([]);
        setSelectedPatientId(null);
      }
      setLoading(false);
    }, (err) => {
      console.warn("Patient relations subscription failed:", err);
    });

    return () => {
      unsubAppts();
      unsubRels();
    };
  }, [profile.uid]);

  // Subscribe to vitals and alerts for selected patient
  useEffect(() => {
    if (!selectedPatientId) {
      setActiveVitals([]);
      setActiveAlerts([]);
      return;
    }

    // Subscribe to selected patient's vitals
    const vitalsQ = query(
      collection(db, "vitals"),
      where("patient_id", "==", selectedPatientId)
    );
    const unsubV = onSnapshot(vitalsQ, (snap) => {
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() })) as VitalsRecord[];
      records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()); // asc for charting progression
      setActiveVitals(records);
    }, (err) => {
      console.warn(`Vitals subscription failed for patient ${selectedPatientId}:`, err);
    });

    // Subscribe to selected patient's active alerts
    const alertsQ = query(
      collection(db, "alerts"),
      where("patient_id", "==", selectedPatientId)
    );
    const unsubA = onSnapshot(alertsQ, (snap) => {
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() })) as HealthAlert[];
      setActiveAlerts(records);
    }, (err) => {
      console.warn(`Alerts subscription failed for patient ${selectedPatientId}:`, err);
    });

    return () => {
      unsubV();
      unsubA();
    };
  }, [selectedPatientId]);

  // Handle Appointment Decision
  const handleAppointmentDecision = async (appointment: Appointment, action: "accepted" | "rejected") => {
    try {
      // 1. Update appointment status
      await updateDoc(doc(db, "appointments", appointment.id!), { status: action });

      // 2. Set doctor-patient relationship to active or inactive
      const relId = `${appointment.patient_id}_${profile.uid}`;
      await setDoc(doc(db, "patient_doctor", relId), {
        id: relId,
        patient_id: appointment.patient_id,
        patient_name: appointment.patient_name,
        doctor_id: profile.uid,
        doctor_name: profile.fullName,
        status: action === "accepted" ? "active" : "inactive",
        assigned_date: new Date().toISOString()
      });

      // 3. Write a notification if accepted
      if (action === "accepted") {
        await addDoc(collection(db, "notifications"), {
          recipient_id: appointment.patient_id,
          recipient_role: "patient",
          type: "appointment",
          message: `📅 Your appointment with Dr. ${profile.fullName} is accepted for ${new Date(appointment.datetime).toLocaleString()}`,
          related_id: appointment.id,
          read: false,
          created_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLinkDecision = async (relation: PatientDoctor, status: "active" | "inactive") => {
    try {
      await updateDoc(doc(db, "patient_doctor", relation.id!), { status });
    } catch (e) {
      console.error("Error updating link decision:", e);
    }
  };

  // Prepare chart data
  const chartData = activeVitals.map(v => ({
    time: new Date(v.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    HeartRate: v.readings.heartRate,
    Oxygen: v.readings.oxygenLevel,
    BP_Systolic: v.readings.systolic,
    BP_Diastolic: v.readings.diastolic
  }));

  const selectedPatientData = assignedPatients.find(p => p.uid === selectedPatientId);
  const latestVital = activeVitals[activeVitals.length - 1]; // latest is at end of asc array
  const activeRisk = latestVital ? latestVital.risk_level : "low";

  const pendingLinks = assignedRelations.filter(r => r.status === "pending");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-12">
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-rose-500 text-white p-2 rounded-xl">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">VitalCare</h1>
            <p className="text-xs text-rose-600 font-bold">{profile.specialization || "Physician"} Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-slate-700">Dr. {profile.fullName}</span>
          <button
            onClick={onLogout}
            className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Active patients list & Appointments */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Pending Appointment Requests */}
          {appointments.filter(a => a.status === "pending").length > 0 && (
            <div className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-5 shadow-md">
              <h3 className="text-xs font-black text-rose-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> Pending Consult Requests
              </h3>
              <div className="space-y-3">
                {appointments.filter(a => a.status === "pending").map((appt) => (
                  <div key={appt.id} className="p-3 bg-white border border-rose-100 rounded-2xl">
                    <div className="text-xs font-bold text-slate-950">{appt.patient_name}</div>
                    <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                      🕒 {new Date(appt.datetime).toLocaleString()}
                    </div>
                    {appt.notes && (
                      <div className="text-[10px] text-slate-600 italic bg-slate-50 p-2 rounded-lg mt-1.5">
                        "{appt.notes}"
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleAppointmentDecision(appt, "accepted")}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm min-h-[44px]"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleAppointmentDecision(appt, "rejected")}
                        className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 rounded-xl text-xs min-h-[44px]"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Patient Linking Requests */}
          {pendingLinks.length > 0 && (
            <div className="bg-sky-50 border border-sky-200 rounded-3xl p-5 shadow-sm">
              <h3 className="text-xs font-black text-sky-950 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <UserPlus className="h-4 w-4 text-sky-600" /> Pending Patient Links
              </h3>
              <div className="space-y-3">
                {pendingLinks.map((rel) => (
                  <div key={rel.id} className="p-3 bg-white border border-sky-100 rounded-2xl">
                    <div className="text-xs font-bold text-slate-950">{rel.patient_name}</div>
                    <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                      Requested: {rel.assigned_date ? new Date(rel.assigned_date).toLocaleDateString() : "Recently"}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleLinkDecision(rel, "active")}
                        className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm transition-colors min-h-[44px]"
                      >
                        Accept Link
                      </button>
                      <button
                        onClick={() => handleLinkDecision(rel, "inactive")}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-xs transition-colors min-h-[44px]"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assigned Patients Selector */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-md">
            <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-1.5">
              <User className="h-4 w-4 text-rose-500" /> Assigned Patients ({assignedPatients.length})
            </h3>

            {loading ? (
              <div className="text-center py-6 text-xs text-slate-400 font-bold">Loading profiles...</div>
            ) : assignedPatients.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 font-semibold leading-relaxed">
                No active patients assigned. Acceptance of booking requests will assign them here.
              </div>
            ) : (
              <div className="space-y-2">
                {assignedPatients.map((patient) => {
                  const pAlertsCount = activeAlerts.filter(a => a.patient_id === patient.uid && !a.resolved).length;
                  return (
                    <button
                      key={patient.uid}
                      onClick={() => setSelectedPatientId(patient.uid)}
                      className={`w-full text-left p-3.5 rounded-2xl flex items-center justify-between transition-all border-2 ${
                        selectedPatientId === patient.uid
                          ? "bg-rose-50/60 border-rose-400 shadow-sm"
                          : "bg-slate-50 border-transparent hover:bg-slate-100"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-black text-slate-900">{patient.fullName}</div>
                        <div className="text-[10px] font-bold text-slate-400">Age: {patient.age || "N/A"} | Group: {patient.bloodGroup || "N/A"}</div>
                      </div>
                      
                      {pAlertsCount > 0 && (
                        <span className="bg-rose-500 text-white font-black px-2 py-0.5 rounded-full text-[9px] animate-pulse">
                          {pAlertsCount} ALERTS
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Detailed records for active patient */}
        <div className="lg:col-span-2 space-y-6">
          {selectedPatientData ? (
            <div className="space-y-6">
              
              {/* Patient Cover Summary */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b pb-5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">Active Case</span>
                    <h2 className="text-xl font-black text-slate-950 mt-1">{selectedPatientData.fullName}</h2>
                    <p className="text-xs text-slate-500 font-semibold">Email: {selectedPatientData.email} | Phone: {selectedPatientData.phoneNumber}</p>
                  </div>
                  <div className={`self-start sm:self-center px-4 py-2 rounded-2xl text-xs font-black border flex items-center gap-2 ${
                    activeRisk === "low" 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                      : activeRisk === "medium" 
                        ? "bg-amber-50 border-amber-200 text-amber-800" 
                        : "bg-rose-50 border-rose-200 text-rose-800 animate-pulse"
                  }`}>
                    <span className="text-lg">{activeRisk === "low" ? "😊" : activeRisk === "medium" ? "😟" : "🚨"}</span>
                    <span>{activeRisk.toUpperCase()} RISK STATUS</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 text-xs text-slate-700">
                  <div className="space-y-1.5">
                    <p><strong className="text-slate-900">Emergency Contact:</strong> {selectedPatientData.emergencyName} ({selectedPatientData.emergencyRelationship})</p>
                    <p><strong className="text-slate-900">Emergency Phone:</strong> <a href={`tel:${selectedPatientData.emergencyPhone}`} className="text-rose-600 underline font-bold">{selectedPatientData.emergencyPhone}</a></p>
                  </div>
                  <div className="space-y-1.5">
                    <p><strong className="text-slate-900">Clinical History:</strong> {selectedPatientData.medicalHistory || "No previous history recorded."}</p>
                  </div>
                </div>

                {/* Send Health Update / Medical Note */}
                <form onSubmit={handleSendDoctorNote} className="mt-5 border-t pt-4 space-y-3">
                  <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                    🩺 Send Medical Update / Clinical Note
                  </h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={doctorNote}
                      onChange={(e) => setDoctorNote(e.target.value)}
                      placeholder="Type clinical advice, prescriptions, or a quick health update for the patient..."
                      className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:ring-1 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={sendingNote || !doctorNote.trim()}
                      className="bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-black px-4 py-2.5 rounded-2xl transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                      {sendingNote ? "Sending..." : "Send Note"}
                    </button>
                  </div>
                  {noteStatus && (
                    <p className="text-[10px] font-bold text-emerald-600 animate-pulse">{noteStatus}</p>
                  )}
                </form>
              </div>

              {/* Patient Health Analytics (Recharts graph) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md">
                <h3 className="text-sm font-black text-slate-950 flex items-center gap-1.5 mb-4">
                  <TrendingUp className="h-4 w-4 text-rose-500" /> Patient Vitals Progression (Health Analytics)
                </h3>

                {chartData.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 font-bold">
                    No vitals records logged by this patient yet to chart.
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="time" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 9 }} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line type="monotone" dataKey="HeartRate" stroke="#EF4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Heart Rate (bpm)" />
                        <Line type="monotone" dataKey="BP_Systolic" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} name="BP Systolic" />
                        <Line type="monotone" dataKey="BP_Diastolic" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} name="BP Diastolic" />
                        <Line type="monotone" dataKey="Oxygen" stroke="#06B6D4" strokeWidth={3} dot={{ r: 4 }} name="Oxygen (% SpO2)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* History Timeline of Vitals */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-md">
                <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-1.5">
                  📁 Complete Vitals Log History
                </h3>
                {activeVitals.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400">No logs.</div>
                ) : (
                  <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1">
                    {[...activeVitals].reverse().map((v, i) => (
                      <div key={i} className="p-3 border rounded-xl bg-slate-50 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-slate-900">{new Date(v.timestamp).toLocaleString()}</span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 mt-1.5 text-[11px] text-slate-600 font-semibold">
                            <div>💓 HR: {v.readings.heartRate} bpm</div>
                            <div>🩸 BP: {v.readings.systolic}/{v.readings.diastolic}</div>
                            <div>🫧 O2: {v.readings.oxygenLevel}%</div>
                            <div>🌡️ Temp: {v.readings.temperature}°C</div>
                          </div>
                        </div>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          v.risk_level === "low" ? "bg-emerald-100 text-emerald-800" : v.risk_level === "medium" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                        }`}>
                          {v.risk_level}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-md">
              <span className="text-5xl block mb-4">🩺</span>
              <h3 className="text-sm font-black text-slate-800">No Patient Selected</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Select an assigned patient from the list on the left to view their comprehensive clinical records, analytics, and vitals timeline.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
