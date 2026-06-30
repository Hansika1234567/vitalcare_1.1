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
  orderBy
} from "../firebase";
import { UserProfile, PatientCaretaker, VitalsRecord, HealthAlert } from "../types";
import { translations, Language } from "../translations";
import { 
  LowRiskIllustration, 
  MediumRiskIllustration, 
  HighRiskIllustration 
} from "./NanoBananaIllustrations";
import { Activity, Bell, Heart, Check, X, ShieldAlert, LogOut, Phone } from "lucide-react";

interface CaretakerDashboardProps {
  profile: UserProfile;
  onLogout: () => void;
}

export default function CaretakerDashboard({ profile, onLogout }: CaretakerDashboardProps) {
  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];

  // States
  const [invitations, setInvitations] = useState<PatientCaretaker[]>([]);
  const [linkedPatients, setLinkedPatients] = useState<UserProfile[]>([]);
  const [patientVitals, setPatientVitals] = useState<{ [patientId: string]: VitalsRecord[] }>({});
  const [patientAlerts, setPatientAlerts] = useState<{ [patientId: string]: HealthAlert[] }>({});
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Loading indicator states
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile.uid) return;

    // Listen to invitations (pending or accepted) where this caretaker is the caretaker_id
    const invitesQ = query(
      collection(db, "patient_caretaker"),
      where("caretaker_id", "==", profile.uid)
    );

    const unsubInvites = onSnapshot(invitesQ, async (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PatientCaretaker[];
      setInvitations(records);

      // Extract patients where status is 'accepted'
      const acceptedPatientIds = records
        .filter(r => r.status === "accepted")
        .map(r => r.patient_id);

      if (acceptedPatientIds.length > 0) {
        // Fetch matching patient user profiles
        try {
          const patientsList: UserProfile[] = [];
          for (const pid of acceptedPatientIds) {
            const pDoc = await getDocs(query(collection(db, "users"), where("uid", "==", pid)));
            if (!pDoc.empty) {
              patientsList.push(pDoc.docs[0].data() as UserProfile);
            }
          }
          setLinkedPatients(patientsList);
          if (patientsList.length > 0 && !selectedPatientId) {
            setSelectedPatientId(patientsList[0].uid);
          }
        } catch (err) {
          console.error("Error loading patient profiles", err);
        }
      } else {
        setLinkedPatients([]);
        setSelectedPatientId(null);
      }
      setLoading(false);
    }, (err) => {
      console.warn("Invites subscription failed:", err);
    });

    return () => unsubInvites();
  }, [profile.uid]);

  // Listen to vitals and alerts of linked patients
  useEffect(() => {
    if (linkedPatients.length === 0) return;

    const unsubsVitals: (() => void)[] = [];
    const unsubsAlerts: (() => void)[] = [];

    linkedPatients.forEach(patient => {
      // Listen to vitals
      const vQ = query(
        collection(db, "vitals"),
        where("patient_id", "==", patient.uid)
      );
      const unsubV = onSnapshot(vQ, (snap) => {
        const records = snap.docs.map(d => ({ id: d.id, ...d.data() })) as VitalsRecord[];
        records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setPatientVitals(prev => ({ ...prev, [patient.uid]: records }));
      }, (err) => {
        console.warn(`Vitals subscription failed for patient ${patient.uid}:`, err);
      });
      unsubsVitals.push(unsubV);

      // Listen to active unresolved alerts
      const aQ = query(
        collection(db, "alerts"),
        where("patient_id", "==", patient.uid)
      );
      const unsubA = onSnapshot(aQ, (snap) => {
        const records = snap.docs.map(d => ({ id: d.id, ...d.data() })) as HealthAlert[];
        const unresolved = records.filter(r => !r.resolved);
        setPatientAlerts(prev => ({ ...prev, [patient.uid]: unresolved }));
      }, (err) => {
        console.warn(`Alerts subscription failed for patient ${patient.uid}:`, err);
      });
      unsubsAlerts.push(unsubA);
    });

    return () => {
      unsubsVitals.forEach(unsub => unsub());
      unsubsAlerts.forEach(unsub => unsub());
    };
  }, [linkedPatients]);

  // Handle Invitation Acceptance / Rejection
  const handleInviteAction = async (inviteId: string, status: "accepted" | "rejected") => {
    try {
      await updateDoc(doc(db, "patient_caretaker", inviteId), { status });
    } catch (e) {
      console.error(e);
    }
  };

  // Resolve Alert helper
  const handleResolveAlert = async (alertId: string) => {
    try {
      await updateDoc(doc(db, "alerts", alertId), {
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: profile.fullName
      });
    } catch (e) {
      console.error(e);
    }
  };

  const selectedPatient = linkedPatients.find(p => p.uid === selectedPatientId);
  const selectedVitals = selectedPatientId ? (patientVitals[selectedPatientId] || []) : [];
  const selectedAlerts = selectedPatientId ? (patientAlerts[selectedPatientId] || []) : [];
  const latestVitals = selectedVitals[0];
  const patientRisk = latestVitals ? latestVitals.risk_level : "low";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500 text-white p-2 rounded-xl">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">VitalCare</h1>
            <p className="text-xs text-emerald-600 font-bold">{t.caretakerDashboard}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            {(["en", "hi", "te"] as Language[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2 py-1 text-xs font-black rounded-lg transition-colors uppercase ${lang === l ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                {l}
              </button>
            ))}
          </div>

          <button
            onClick={onLogout}
            className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-6">
        
        {/* Dynamic Caretaker Welcome Card */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <span className="text-xs uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full font-extrabold text-emerald-100">
              👵 Family Caretaker
            </span>
            <h2 className="text-2xl font-black mt-2">{profile.fullName}</h2>
            <p className="text-xs mt-1 text-emerald-100 font-semibold">
              Keeping a loving eye on family health and emergency vitals.
            </p>
          </div>
        </div>

        {/* Incoming Invitations List */}
        {invitations.filter(i => i.status === "pending").length > 0 && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 shadow-md">
            <h3 className="text-sm font-black text-amber-950 flex items-center gap-1.5 mb-3">
              👵 NEW REQUESTS TO BE CARETAKER
            </h3>
            <div className="space-y-3">
              {invitations.filter(i => i.status === "pending").map((inv) => (
                <div key={inv.id} className="p-3 bg-white border border-amber-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800">{inv.patient_name}</span>
                    <span className="block text-[10px] text-slate-500 font-semibold">wants you as: {inv.relationship}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleInviteAction(inv.id, "accepted")}
                      className="bg-emerald-500 text-white p-2 rounded-xl hover:bg-emerald-600 shadow-sm"
                      title="Accept Invite"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleInviteAction(inv.id, "rejected")}
                      className="bg-rose-500 text-white p-2 rounded-xl hover:bg-rose-600 shadow-sm"
                      title="Decline Invite"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connected Family Members Selector */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-md">
          <h3 className="text-sm font-black text-slate-900 mb-3">
            👵 Your Linked Family Members
          </h3>

          {loading ? (
            <div className="py-6 text-center text-xs text-slate-500 font-semibold">
              Checking linked family profiles...
            </div>
          ) : linkedPatients.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 font-semibold leading-relaxed">
              No linked patients yet. When your family member invites you by email, the request will appear above!
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {linkedPatients.map((p) => {
                const pAlertsCount = patientAlerts[p.uid]?.length || 0;
                return (
                  <button
                    key={p.uid}
                    onClick={() => setSelectedPatientId(p.uid)}
                    className={`py-2 px-4 rounded-full font-black text-xs transition-all flex items-center gap-1.5 shrink-0 border-2 ${
                      selectedPatientId === p.uid 
                        ? "bg-emerald-500 text-white border-emerald-600 shadow-md" 
                        : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                    }`}
                  >
                    <span>👵 {p.fullName}</span>
                    {pAlertsCount > 0 && (
                      <span className="bg-rose-500 text-white font-bold px-1.5 py-0.5 rounded-full text-[9px] animate-bounce">
                        {pAlertsCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedPatient && (
          <div className="space-y-6">
            
            {/* Active Emergency Alerts */}
            {selectedAlerts.length > 0 && (
              <div className="bg-rose-100 border-2 border-rose-300 rounded-3xl p-5 shadow-lg animate-pulse">
                <h3 className="text-sm font-black text-rose-950 flex items-center gap-1.5 mb-3">
                  <ShieldAlert className="h-5 w-5 text-rose-600" /> ACTIVE EMERGENCY WARNING
                </h3>
                <div className="space-y-3">
                  {selectedAlerts.map((alt) => (
                    <div key={alt.id} className="p-3.5 bg-white border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-rose-950">{alt.message}</p>
                        <p className="text-[9px] text-slate-400 mt-1">Logged {new Date(alt.timestamp).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <a href={`tel:${selectedPatient.phoneNumber}`} className="bg-sky-50 text-sky-600 p-2 rounded-xl text-xs font-black hover:bg-sky-100 flex items-center gap-1">
                          📞 Call
                        </a>
                        <button
                          onClick={() => handleResolveAlert(alt.id!)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-sm"
                        >
                          Resolve Alarm
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Picture-First Risk & Health Status */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md text-center">
              <h3 className="text-base font-black text-slate-900 mb-2">
                📊 {selectedPatient.fullName}'s {t.healthStatus}
              </h3>

              <div className="my-4">
                {patientRisk === "low" && <LowRiskIllustration />}
                {patientRisk === "medium" && <MediumRiskIllustration />}
                {patientRisk === "high" && <HighRiskIllustration />}
              </div>

              <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-black border-2 shadow-sm ${
                patientRisk === "low" 
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700" 
                  : patientRisk === "medium" 
                    ? "bg-amber-50 border-amber-300 text-amber-700" 
                    : "bg-rose-50 border-rose-300 text-rose-700"
              }`}>
                <span>{patientRisk === "low" ? "😊" : patientRisk === "medium" ? "😟" : "🚨"}</span>
                <span>
                  {patientRisk === "low" ? t.lowRisk : patientRisk === "medium" ? t.mediumRisk : t.highRisk}
                </span>
              </div>
            </div>

            {/* Recent Vitals list */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-md">
              <h3 className="text-sm font-black text-slate-900 mb-3">
                📈 Latest Registered Vitals Info
              </h3>

              {selectedVitals.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                  No readings logged yet by {selectedPatient.fullName}.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedVitals.slice(0, 5).map((v, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                        v.risk_level === "low" 
                          ? "bg-emerald-50/50 border-emerald-100 text-emerald-950" 
                          : v.risk_level === "medium" 
                            ? "bg-amber-50/50 border-amber-100 text-amber-950" 
                            : "bg-rose-50/50 border-rose-100 text-rose-950"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-black">
                          <span>{v.risk_level === "low" ? "😊" : v.risk_level === "medium" ? "😟" : "🚨"}</span>
                          <span>{new Date(v.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] font-bold text-slate-600 mt-1">
                          <div>💓 HR: {v.readings.heartRate} bpm</div>
                          <div>🩸 BP: {v.readings.systolic}/{v.readings.diastolic}</div>
                          <div>🫧 O2: {v.readings.oxygenLevel}%</div>
                          <div>🌡️ Temp: {v.readings.temperature}°C</div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        v.risk_level === "low" ? "bg-emerald-100 text-emerald-800" : v.risk_level === "medium" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                      }`}>
                        {v.risk_level}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Emergency Contact detail card */}
            <div className="bg-slate-100 border border-slate-200 rounded-3xl p-5">
              <h4 className="text-xs font-black text-slate-700 uppercase mb-2">Emergency Backup Information</h4>
              <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                <div>
                  <span className="block text-[10px] text-slate-500 font-bold">Patient's Phone</span>
                  <a href={`tel:${selectedPatient.phoneNumber}`} className="text-rose-600 font-bold underline">
                    {selectedPatient.phoneNumber || "None"}
                  </a>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 font-bold">Secondary Emergency Contact</span>
                  <div className="font-bold">{selectedPatient.emergencyName}</div>
                  <a href={`tel:${selectedPatient.emergencyPhone}`} className="text-rose-600 font-bold underline text-[10px]">
                    {selectedPatient.emergencyPhone}
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
