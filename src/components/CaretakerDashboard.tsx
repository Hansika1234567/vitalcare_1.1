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
  orderBy,
  addDoc,
  limit
} from "../firebase";
import { UserProfile, PatientCaretaker, VitalsRecord, HealthAlert } from "../types";
import { translations, Language } from "../translations";
import { 
  LowRiskIllustration, 
  MediumRiskIllustration, 
  HighRiskIllustration 
} from "./NanoBananaIllustrations";
import { 
  Activity, 
  Bell, 
  Heart, 
  Check, 
  X, 
  ShieldAlert, 
  LogOut, 
  Phone,
  AlertTriangle,
  Calendar,
  UserCheck,
  FileText,
  CheckCheck
} from "lucide-react";

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

  // Real-time notifications states
  const [notifications, setNotifications] = useState<any[]>([]);
  const [toasts, setToasts] = useState<any[]>([]);
  const [showBellDropdown, setShowBellDropdown] = useState(false);

  // Audio tone generator
  const playNotificationSound = (isEmergency = false) => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (isEmergency) {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.frequency.linearRampToValueAtTime(1100, ctx.currentTime + 0.15);
        osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.stop(ctx.currentTime + 0.5);
      } else {
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (err) {
      console.warn("Audio playback blocked or failed:", err);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      for (const n of unread) {
        await updateDoc(doc(db, "notifications", n.id), { read: true });
      }
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "emergency":
        return <AlertTriangle className="h-4 w-4 text-rose-600 animate-pulse" />;
      case "appointment":
        return <Calendar className="h-4 w-4 text-emerald-600" />;
      case "caretaker_invite":
        return <UserCheck className="h-4 w-4 text-indigo-600" />;
      case "vitals_log":
        return <Heart className="h-4 w-4 text-sky-600 animate-pulse" />;
      case "alert":
        return <Bell className="h-4 w-4 text-amber-500" />;
      case "doctor_update":
        return <FileText className="h-4 w-4 text-rose-500" />;
      default:
        return <Bell className="h-4 w-4 text-slate-500" />;
    }
  };

  useEffect(() => {
    const routineToasts = toasts.filter(t => !t.is_emergency);
    if (routineToasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts(prev => {
        const oldestRoutine = prev.find(t => !t.is_emergency);
        if (oldestRoutine) {
          return prev.filter(t => t.id !== oldestRoutine.id);
        }
        return prev;
      });
    }, 6000);
    return () => clearTimeout(timer);
  }, [toasts]);

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

    // Subscribe to caretaker notifications
    const notificationsQ = query(
      collection(db, "notifications"),
      where("recipient_id", "==", profile.uid),
      orderBy("created_at", "desc"),
      limit(50)
    );
    let isInitialLoad = true;
    const unsubNotifications = onSnapshot(notificationsQ, (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setNotifications(records);

      if (!isInitialLoad) {
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            if (!data.read) {
              const isEmergency = data.type === "emergency";
              setToasts(prev => [
                ...prev,
                {
                  id: change.doc.id,
                  type: data.type,
                  message: data.message,
                  created_at: data.created_at,
                  is_emergency: isEmergency
                }
              ]);
              playNotificationSound(isEmergency);
            }
          }
        });
      }
      isInitialLoad = false;
    }, (err) => {
      console.warn("Notifications subscription failed:", err);
    });

    return () => {
      unsubInvites();
      unsubNotifications();
    };
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
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500 text-white p-2 rounded-xl">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">VitalCare</h1>
            <p className="text-xs text-emerald-600 font-bold">{t.caretakerDashboard}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Real-Time Notification Bell */}
          <div className="relative">
            <button
              id="notification-bell-btn"
              onClick={() => setShowBellDropdown(!showBellDropdown)}
              className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors relative cursor-pointer flex items-center justify-center min-h-[44px] min-w-[44px]"
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 bg-emerald-500 text-white font-black text-[9px] rounded-full flex items-center justify-center animate-bounce">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>

            {/* Bell Dropdown */}
            {showBellDropdown && (
              <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-100 shadow-2xl rounded-3xl z-40 overflow-hidden py-2 animate-fade-in max-h-[480px] flex flex-col">
                <div className="px-4 py-2 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                  <span className="text-xs font-black text-slate-900">Notifications</span>
                  {notifications.filter(n => !n.read).length > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto max-h-[360px] divide-y divide-slate-50">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs font-bold text-slate-400">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          handleMarkAsRead(notif.id);
                        }}
                        className={`p-3.5 flex gap-3 hover:bg-slate-50 transition-colors cursor-pointer text-left ${
                          !notif.read ? "bg-emerald-50/20" : ""
                        }`}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {getNotificationIcon(notif.type)}
                        </div>
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <p className={`text-xs leading-normal break-words ${
                            !notif.read ? "font-bold text-slate-900" : "font-semibold text-slate-600"
                          }`}>
                            {notif.message}
                          </p>
                          <span className="text-[9px] text-slate-400 font-bold block">
                            {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(notif.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        {!notif.read && (
                          <span className="h-2 w-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Language Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            {(["en", "hi", "te"] as Language[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2 py-1 text-xs font-black rounded-lg transition-colors uppercase cursor-pointer ${lang === l ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                {l}
              </button>
            ))}
          </div>

          <button
            onClick={onLogout}
            className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            title={t.logout}
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-6xl mx-auto w-full space-y-6">
        
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-6">
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

              <div className="space-y-6">
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
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Real-Time Notification Toasts */}
      <div id="toasts-container" className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            id={`toast-${toast.id}`}
            className={`p-4 rounded-2xl shadow-xl border flex flex-col gap-2 transition-all duration-300 animate-slide-in ${
              toast.is_emergency
                ? "bg-rose-50 border-rose-300 shadow-rose-100 ring-4 ring-rose-500/10"
                : "bg-white border-slate-200 shadow-slate-100"
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                {getNotificationIcon(toast.type)}
                <span className={`text-xs font-black uppercase tracking-wider ${
                  toast.is_emergency ? "text-rose-600 animate-pulse" : "text-slate-500"
                }`}>
                  {toast.is_emergency ? "🚨 Critical Emergency" : "Notification"}
                </span>
              </div>
              <button
                onClick={() => {
                  setToasts(prev => prev.filter(t => t.id !== toast.id));
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <p className={`text-xs font-bold leading-relaxed ${toast.is_emergency ? "text-rose-950" : "text-slate-800"}`}>
              {toast.message}
            </p>

            {toast.is_emergency ? (
              <button
                onClick={() => {
                  setToasts(prev => prev.filter(t => t.id !== toast.id));
                  handleMarkAsRead(toast.id);
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white font-black py-2 rounded-xl text-xs transition-all shadow-sm active:scale-95 cursor-pointer mt-1 text-center"
              >
                Acknowledge & Dismiss
              </button>
            ) : null}
          </div>
        ))}
      </div>

    </div>
  );
}
