import React, { useState, useEffect, useRef } from "react";
import { 
  db, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  signOut,
  auth,
  setDoc,
  doc,
  deleteDoc,
  limit,
  handleFirestoreError,
  OperationType,
  updateDoc
} from "../firebase";
import { 
  UserProfile, 
  VitalsRecord, 
  PatientCaretaker, 
  PatientDoctor, 
  Appointment, 
  HealthAlert, 
  GovernmentScheme, 
  Hospital, 
  BloodDonation 
} from "../types";
import { agentManager, AgentLog } from "../agents";
import { translations, Language } from "../translations";
import { 
  LowRiskIllustration, 
  MediumRiskIllustration, 
  HighRiskIllustration, 
  LogVitalsIllustration, 
  AskAIIllustration, 
  InviteCaretakerIllustration, 
  HospitalIllustration 
} from "./NanoBananaIllustrations";
import { 
  Heart, 
  Activity, 
  Phone, 
  Plus, 
  User, 
  Sparkles, 
  Award, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Droplet, 
  MapPin, 
  Send, 
  Paperclip,
  Mic,
  MicOff,
  Image,
  X, 
  BookOpen, 
  LogOut, 
  Check, 
  MessageSquare, 
  Eye, 
  Search, 
  ChevronRight,
  Navigation,
  Map,
  Hospital as HospitalIcon,
  Bell,
  CheckCheck,
  Calendar,
  UserCheck
} from "lucide-react";

function evaluateSchemeEligibility(scheme: GovernmentScheme, profile: UserProfile): {
  isMatch: boolean;
  isPossible: boolean;
  reasons: string[];
  incomeCheckRequired: boolean;
} {
  const reasons: string[] = [];
  let isMatch = true;
  let isPossible = false;
  let incomeCheckRequired = scheme.income_limit !== null;

  // 1. Gender check
  if (scheme.gender !== "any") {
    if (!profile.gender) {
      isMatch = false;
      isPossible = true;
      reasons.push("Gender details not set in profile (requires " + scheme.gender + ")");
    } else if (profile.gender.toLowerCase() !== scheme.gender.toLowerCase()) {
      isMatch = false;
    }
  }

  // 2. Age check
  if (scheme.min_age !== null || scheme.max_age !== null) {
    if (profile.age === undefined || profile.age === null || isNaN(profile.age)) {
      isMatch = false;
      isPossible = true;
      reasons.push("Age details not set in profile (requires " + 
        (scheme.min_age ? "min age: " + scheme.min_age : "") + " " + 
        (scheme.max_age ? "max age: " + scheme.max_age : "") + ")");
    } else {
      if (scheme.min_age !== null && profile.age < scheme.min_age) {
        isMatch = false;
      }
      if (scheme.max_age !== null && profile.age > scheme.max_age) {
        isMatch = false;
      }
    }
  }

  // 3. State check
  const isNational = scheme.applicable_states.includes("all") || scheme.applicable_states.includes("National") || scheme.applicable_states.length === 0;
  if (!isNational) {
    if (!profile.state) {
      isMatch = false;
      isPossible = true;
      reasons.push("State details not set in profile (scheme only for: " + scheme.applicable_states.join(", ") + ")");
    } else {
      const matchState = scheme.applicable_states.some(s => s.toLowerCase() === profile.state?.toLowerCase());
      if (!matchState) {
        isMatch = false;
      }
    }
  }

  // 4. Category checks
  if (scheme.category === "senior_citizen") {
    if (profile.age !== undefined && profile.age !== null && !isNaN(profile.age)) {
      if (profile.age < 60) {
        isMatch = false;
      }
    } else {
      isMatch = false;
      isPossible = true;
      reasons.push("Requires age verification (>= 60 years) for Senior Citizen schemes");
    }
  } else if (scheme.category === "maternity") {
    if (profile.gender !== undefined && profile.gender !== null && profile.gender !== "") {
      if (profile.gender.toLowerCase() !== "female") {
        isMatch = false;
      }
    } else {
      isMatch = false;
      isPossible = true;
      reasons.push("Requires gender verification (female) for Maternity schemes");
    }
  } else if (scheme.category === "disability") {
    if (isMatch) {
      isMatch = false;
      isPossible = true;
      reasons.push("Requires medical disability certification / documentation");
    }
  }

  if (!isMatch && !isPossible) {
    return { isMatch: false, isPossible: false, reasons, incomeCheckRequired };
  }

  return { isMatch, isPossible, reasons, incomeCheckRequired };
}

const STATE_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "Andhra Pradesh": { lat: 16.5062, lng: 80.6480 },
  "Arunachal Pradesh": { lat: 27.1020, lng: 93.6920 },
  "Assam": { lat: 26.1445, lng: 91.7362 },
  "Bihar": { lat: 25.5941, lng: 85.1376 },
  "Chhattisgarh": { lat: 21.2514, lng: 81.6296 },
  "Goa": { lat: 15.4909, lng: 73.8278 },
  "Gujarat": { lat: 23.2156, lng: 72.6369 },
  "Haryana": { lat: 30.7333, lng: 76.7794 },
  "Himachal Pradesh": { lat: 31.1048, lng: 77.1734 },
  "Jharkhand": { lat: 23.3441, lng: 85.3096 },
  "Karnataka": { lat: 12.9716, lng: 77.5946 },
  "Kerala": { lat: 8.5241, lng: 76.9366 },
  "Madhya Pradesh": { lat: 23.2599, lng: 77.4126 },
  "Maharashtra": { lat: 19.0760, lng: 72.8777 },
  "Manipur": { lat: 24.8170, lng: 93.9368 },
  "Meghalaya": { lat: 25.5788, lng: 91.8831 },
  "Mizoram": { lat: 23.7271, lng: 92.7176 },
  "Nagaland": { lat: 25.6751, lng: 94.1086 },
  "Odisha": { lat: 20.2961, lng: 85.8245 },
  "Punjab": { lat: 30.7333, lng: 76.7794 },
  "Rajasthan": { lat: 26.9124, lng: 75.7873 },
  "Sikkim": { lat: 27.3314, lng: 88.6138 },
  "Tamil Nadu": { lat: 13.0827, lng: 80.2707 },
  "Telangana": { lat: 17.3850, lng: 78.4867 },
  "Tripura": { lat: 23.8315, lng: 91.2868 },
  "Uttar Pradesh": { lat: 26.8467, lng: 80.9462 },
  "Uttarakhand": { lat: 30.3165, lng: 78.0322 },
  "West Bengal": { lat: 22.5726, lng: 88.3639 },
  "Andaman and Nicobar Islands": { lat: 11.6234, lng: 92.7265 },
  "Chandigarh": { lat: 30.7333, lng: 76.7794 },
  "Dadra and Nagar Haveli and Daman and Diu": { lat: 20.4283, lng: 72.8397 },
  "Delhi": { lat: 28.6139, lng: 77.2090 },
  "Jammu and Kashmir": { lat: 34.0837, lng: 74.7973 },
  "Ladakh": { lat: 34.1526, lng: 77.5771 },
  "Lakshadweep": { lat: 10.5667, lng: 72.6417 },
  "Puducherry": { lat: 11.9416, lng: 79.8083 }
};

const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const generateLocalHospitals = (lat: number, lng: number, state?: string): Hospital[] => {
  let cityArea = "Local Area";
  if (state) {
    if (state.toLowerCase().includes("telangana") || state.toLowerCase().includes("andhra")) cityArea = "Hyderabad";
    else if (state.toLowerCase().includes("karnataka")) cityArea = "Bengaluru";
    else if (state.toLowerCase().includes("maharashtra")) cityArea = "Mumbai";
    else if (state.toLowerCase().includes("delhi")) cityArea = "New Delhi";
    else if (state.toLowerCase().includes("tamil nadu")) cityArea = "Chennai";
    else cityArea = state;
  }

  return [
    {
      id: "local-1",
      name: "Apollo Clinic & Emergency Center",
      location: `Near Bypass Sector, ${cityArea}`,
      specializations: ["Heart Care", "Emergency", "General Care"],
      contact: "040-23607777",
      lat: lat + 0.005,
      lng: lng + 0.006
    },
    {
      id: "local-2",
      name: "St. Mary Multi-Specialty Health Institute",
      location: `East Bypass Road, ${cityArea}`,
      specializations: ["Pediatrics", "Cancer Care"],
      contact: "080-66214444",
      lat: lat - 0.008,
      lng: lng + 0.005
    },
    {
      id: "local-3",
      name: "Metro Trauma & Emergency Care",
      location: `North Wing Complex, ${cityArea}`,
      specializations: ["Brain Care", "Emergency", "Orthopedics"],
      contact: "011-26588500",
      lat: lat + 0.012,
      lng: lng - 0.009
    },
    {
      id: "local-4",
      name: "Sunrise Cardiac & General Clinic",
      location: `Westside Boulevard, ${cityArea}`,
      specializations: ["Heart Care", "Brain Care", "Emergency"],
      contact: "040-61656565",
      lat: lat - 0.004,
      lng: lng - 0.011
    },
    {
      id: "local-5",
      name: "Valley Cancer and Research Foundation",
      location: `Southern Biotech Park, ${cityArea}`,
      specializations: ["Orthopedics", "Cancer Care", "Emergency"],
      contact: "040-68334455",
      lat: lat + 0.018,
      lng: lng + 0.014
    }
  ];
};

interface PatientDashboardProps {
  profile: UserProfile;
  onLogout: () => void;
}

export default function PatientDashboard({ profile, onLogout }: PatientDashboardProps) {
  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];

  const tabNames: Record<Language, { vitals: string; doctors: string; family: string; ai: string; schemes: string; hospitals: string; blood: string }> = {
    en: {
      vitals: "Vitals",
      doctors: "Doctors",
      family: "Family",
      ai: "AI Chat",
      schemes: "Schemes",
      hospitals: "Hospitals",
      blood: "Blood"
    },
    hi: {
      vitals: "वाइटल्स",
      doctors: "डॉक्टर",
      family: "परिवार",
      ai: "एआई चैट",
      schemes: "योजनाएं",
      hospitals: "अस्पताल",
      blood: "रक्त"
    },
    te: {
      vitals: "వైటల్స్",
      doctors: "వైద్యులు",
      family: "కుటుంబం",
      ai: "AI చాట్",
      schemes: "పథకాలు",
      hospitals: "ఆసుపత్రులు",
      blood: "రక్తం"
    }
  };

  // Selected bottom tab: "vitals", "doctors", "caretakers", "ai", "schemes", "hospitals", "blood"
  const [activeTab, setActiveTab] = useState<string>("vitals");

  // Load patient coordinates from Geolocation API or fallback
  useEffect(() => {
    const useFallbackLocation = () => {
      const userState = profile.state;
      if (userState && STATE_COORDINATES[userState]) {
        setPatientCoords(STATE_COORDINATES[userState]);
        setLocationSource("registered");
      } else {
        // Default fallback to Hyderabad
        setPatientCoords({ lat: 17.3850, lng: 78.4867 });
        setLocationSource("default");
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPatientCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLocationSource("gps");
          setLocationErrorMessage(null);
        },
        (error) => {
          console.warn("Geolocation API error:", error);
          let errMsg = "Location access was denied or is unavailable.";
          if (error.code === error.PERMISSION_DENIED) {
            errMsg = "Permission denied. Please enable location access for real-time distance sorting.";
          }
          setLocationErrorMessage(errMsg);
          useFallbackLocation();
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setLocationErrorMessage("Geolocation is not supported by this browser.");
      useFallbackLocation();
    }
  }, [profile.state]);

  // Real-time states
  const [vitals, setVitals] = useState<VitalsRecord[]>([]);
  
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
  const [caretakers, setCaretakers] = useState<PatientCaretaker[]>([]);
  const [doctors, setDoctors] = useState<PatientDoctor[]>([]);
  const [allDoctorsList, setAllDoctorsList] = useState<UserProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [schemes, setSchemes] = useState<GovernmentScheme[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [patientCoords, setPatientCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationSource, setLocationSource] = useState<"gps" | "registered" | "default" | null>(null);
  const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(null);
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>("");
  const [hoveredHospitalId, setHoveredHospitalId] = useState<string | null>(null);
  const [bloodRecords, setBloodRecords] = useState<BloodDonation[]>([]);

  // Modals & form fields
  const [showLogModal, setShowLogModal] = useState(false);
  const [heartRate, setHeartRate] = useState<number>(72);
  const [systolic, setSystolic] = useState<number>(120);
  const [diastolic, setDiastolic] = useState<number>(80);
  const [oxygenLevel, setOxygenLevel] = useState<number>(98);
  const [temperature, setTemperature] = useState<number>(37);

  // Caretaker invite field
  const [caretakerEmail, setCaretakerEmail] = useState("");
  const [inviteRelationship, setInviteRelationship] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteStatus, setInviteStatus] = useState("");

  // Booking fields
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedDoctorName, setSelectedDoctorName] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentNotes, setAppointmentNotes] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingStatus, setBookingStatus] = useState("");

  // Doctor browsing/filter/detail states
  const [doctorFilterSpecialization, setDoctorFilterSpecialization] = useState("");
  const [doctorSortBy, setDoctorSortBy] = useState("rating"); // default sort by rating
  const [doctorSearchQuery, setDoctorSearchQuery] = useState("");
  const [selectedDoctorForDetail, setSelectedDoctorForDetail] = useState<UserProfile | null>(null);

  // Blood fields
  const [bloodType, setBloodType] = useState<"donor" | "request">("request");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [bloodUnits, setBloodUnits] = useState(1);
  const [bloodLocation, setBloodLocation] = useState("");
  const [bloodContact, setBloodContact] = useState("");
  const [bloodLoading, setBloodLoading] = useState(false);

  // AI assistant chat state
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ 
    role: string; 
    content: string; 
    attachment?: { name: string; mimeType: string; data: string } 
  }[]>([
    { role: "assistant", content: "Hello! I am your VitalCare AI companion. How can I help you today? Ask me any questions about healthy eating, drinking water, or exercising." }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  // Chat attachment and voice recording states
  const [chatAttachment, setChatAttachment] = useState<{ name: string; mimeType: string; data: string } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gemini automatic health insights state
  const [aiInsights, setAiInsights] = useState("");
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);

  // Details dialog state for low-literacy "learn more"
  const [detailModalContent, setDetailModalContent] = useState<{ title: string; body: string } | null>(null);

  // Fetch / subscribe real-time data
  useEffect(() => {
    if (!profile.uid) return;

    // 1. Subscribe to patient vitals
    const vitalsQ = query(
      collection(db, "vitals"),
      where("patient_id", "==", profile.uid)
    );
    const unsubVitals = onSnapshot(vitalsQ, (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as VitalsRecord[];
      records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setVitals(records);
    }, (err) => {
      console.warn("Vitals subscription failed:", err);
    });

    // 2. Subscribe to caretaker relations
    const caretakersQ = query(
      collection(db, "patient_caretaker"),
      where("patient_id", "==", profile.uid)
    );
    const unsubCaretakers = onSnapshot(caretakersQ, (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PatientCaretaker[];
      setCaretakers(records);
    }, (err) => {
      console.warn("Caretakers subscription failed:", err);
    });

    // 3. Subscribe to doctor assignments
    const doctorsQ = query(
      collection(db, "patient_doctor"),
      where("patient_id", "==", profile.uid)
    );
    const unsubDoctors = onSnapshot(doctorsQ, (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PatientDoctor[];
      setDoctors(records);
    }, (err) => {
      console.warn("Doctors subscription failed:", err);
    });

    // 4. Subscribe to appointments
    const appointmentsQ = query(
      collection(db, "appointments"),
      where("patient_id", "==", profile.uid)
    );
    const unsubAppointments = onSnapshot(appointmentsQ, (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Appointment[];
      records.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
      setAppointments(records);
    }, (err) => {
      console.warn("Appointments subscription failed:", err);
    });

    // 5. Subscribe to alerts
    const alertsQ = query(
      collection(db, "alerts"),
      where("patient_id", "==", profile.uid)
    );
    const unsubAlerts = onSnapshot(alertsQ, (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as HealthAlert[];
      records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAlerts(records);
    }, (err) => {
      console.warn("Alerts subscription failed:", err);
    });

    // 6. Subscribe to blood requests/donors
    const bloodQ = query(
      collection(db, "blood_donation")
    );
    const unsubBlood = onSnapshot(bloodQ, (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BloodDonation[];
      records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setBloodRecords(records);
    }, (err) => {
      console.warn("Blood donation subscription failed:", err);
    });

    // 7. Subscribe to AI health insights from our agent
    const unsubInsights = onSnapshot(doc(db, "ai_insights", profile.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAiInsights(data.insight || "");
      }
    }, (err) => {
      console.warn("AI insights subscription failed:", err);
    });

    // 8. Subscribe to AI agent manager logs
    const logsQ = query(
      collection(db, "agent_logs"),
      orderBy("timestamp", "desc"),
      limit(25)
    );
    const unsubLogs = onSnapshot(logsQ, (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AgentLog[];
      setAgentLogs(records);
    }, (err) => {
      console.warn("Agent logs subscription failed:", err);
    });

    // 9. Subscribe to real-time notifications
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

    // Load static modules
    loadDoctors();
    loadSchemes();
    loadHospitals();

    return () => {
      unsubVitals();
      unsubCaretakers();
      unsubDoctors();
      unsubAppointments();
      unsubAlerts();
      unsubBlood();
      unsubInsights();
      unsubLogs();
      unsubNotifications();
    };
  }, [profile.uid]);

  // Auto-prompt logging of vitals on login / first load of the session
  useEffect(() => {
    if (!profile.uid) return;
    const sessionKey = `vitals_prompted_${profile.uid}`;
    const hasPrompted = sessionStorage.getItem(sessionKey);
    if (!hasPrompted) {
      setShowLogModal(true);
      sessionStorage.setItem(sessionKey, "true");
    }
  }, [profile.uid]);

  // Load static resources
  const loadDoctors = async () => {
    try {
      // First, get the current list of hospitals in the database
      const hospSnap = await getDocs(collection(db, "hospitals"));
      const dbHospitals = hospSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Hospital[];

      const seedDoctorsList = [
        {
          uid: "seed_doc_arvind",
          fullName: "Arvind Kumar",
          email: "arvind.kumar@vitalcare.com",
          role: "doctor",
          phoneNumber: "+91 98765 43210",
          specialization: "Heart Care",
          qualification: "MBBS, MD, DM (Cardiology)",
          experience: 16,
          hospitalName: "Apollo General & Cardiac Center",
          consultationFee: 800,
          languages: ["English", "Hindi", "Telugu"],
          availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
          availableTime: "09:00 AM - 01:00 PM",
          rating: 4.9,
          bio: "Dr. Arvind Kumar is a renowned cardiologist with over 16 years of experience. He is dedicated to providing comprehensive cardiovascular care, including preventive cardiology and advanced interventional procedures.",
          createdAt: new Date().toISOString()
        },
        {
          uid: "seed_doc_sarah",
          fullName: "Sarah D'Souza",
          email: "sarah.dsouza@vitalcare.com",
          role: "doctor",
          phoneNumber: "+91 98123 45678",
          specialization: "Pediatrics",
          qualification: "MBBS, MD (Pediatrics), DCH",
          experience: 12,
          hospitalName: "NIMS Government Medical Institute",
          consultationFee: 400,
          languages: ["English", "Hindi", "Konkani"],
          availableDays: ["Mon", "Wed", "Fri"],
          availableTime: "10:00 AM - 04:00 PM",
          rating: 4.8,
          bio: "Dr. Sarah D'Souza has over 12 years of experience caring for children of all ages. She focuses on early child development, immunization programs, and pediatric emergency management.",
          createdAt: new Date().toISOString()
        },
        {
          uid: "seed_doc_amit",
          fullName: "Amit Patel",
          email: "amit.patel@vitalcare.com",
          role: "doctor",
          phoneNumber: "+91 91234 56789",
          specialization: "Brain Care",
          qualification: "MBBS, MCh (Neurosurgery)",
          experience: 18,
          hospitalName: "Medicover Multi-Specialty Hospital",
          consultationFee: 1000,
          languages: ["English", "Hindi", "Gujarati"],
          availableDays: ["Tue", "Thu", "Sat"],
          availableTime: "11:00 AM - 05:00 PM",
          rating: 4.95,
          bio: "Dr. Amit Patel is a senior neurosurgeon with 18+ years of expertise. He is recognized for his clinical excellence in brain tumor surgeries, spinal disorders, and neuro-critical care.",
          createdAt: new Date().toISOString()
        },
        {
          uid: "seed_doc_priya",
          fullName: "Priya Sharma",
          email: "priya.sharma@vitalcare.com",
          role: "doctor",
          phoneNumber: "+91 99887 76655",
          specialization: "General Care",
          qualification: "MBBS, MD (General Medicine)",
          experience: 10,
          hospitalName: "Care Hospitals",
          consultationFee: 500,
          languages: ["English", "Hindi", "Punjabi"],
          availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
          availableTime: "08:00 AM - 02:00 PM",
          rating: 4.7,
          bio: "Dr. Priya Sharma is a compassionate general physician specializing in chronic disease management, diabetes control, and comprehensive family health checks.",
          createdAt: new Date().toISOString()
        },
        {
          uid: "seed_doc_rajesh",
          fullName: "Rajesh Gupta",
          email: "rajesh.gupta@vitalcare.com",
          role: "doctor",
          phoneNumber: "+91 94433 22110",
          specialization: "Orthopedics",
          qualification: "MBBS, MS (Orthopedics)",
          experience: 14,
          hospitalName: "Continental Hospitals",
          consultationFee: 700,
          languages: ["English", "Hindi", "Telugu"],
          availableDays: ["Mon", "Tue", "Thu", "Fri"],
          availableTime: "02:00 PM - 06:00 PM",
          rating: 4.85,
          bio: "Dr. Rajesh Gupta is a veteran orthopedic surgeon specializing in joint replacements, sports injuries, and complex trauma management.",
          createdAt: new Date().toISOString()
        }
      ];

      // Write or merge seeded doctors with matching hospital links
      for (const d of seedDoctorsList) {
        const matchedHosp = dbHospitals.find(h => h.name.toLowerCase() === d.hospitalName.toLowerCase());
        const hospital_id = matchedHosp ? matchedHosp.id : "";

        await setDoc(doc(db, "users", d.uid), {
          ...d,
          hospital_id: hospital_id || ""
        }, { merge: true });
      }

      // Query all doctors in the system
      const snap = await getDocs(query(collection(db, "users"), where("role", "==", "doctor")));
      const docs = snap.docs.map(d => d.data() as UserProfile);
      setAllDoctorsList(docs);
    } catch (e) {
      console.error("Error loading doctors", e);
    }
  };

  const loadSchemes = async () => {
    try {
      const snap = await getDocs(collection(db, "government_schemes"));
      const existing = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      const needsSeed = existing.length === 0 || existing.some(s => !s.name);

      if (needsSeed) {
        // Clear old format schemes first
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }

        const initialSchemes: GovernmentScheme[] = [
          {
            name: "Ayushman Bharat PM-JAY",
            description: "Provides health cover up to ₹5 Lakh per family per year for secondary and tertiary hospitalization to over 12 crore poor and vulnerable families.",
            benefits: "Cashless health coverage up to ₹5,00,000 per family per year at all empaneled public and private hospitals.",
            official_link: "https://pmjay.gov.in",
            min_age: null,
            max_age: null,
            income_limit: null,
            applicable_states: ["all"],
            gender: "any",
            category: "BPL",
            eligibility_summary: "Families listed in the SECC-2011 database, occupational criteria (rural/urban), and active BPL card holders."
          },
          {
            name: "Pradhan Mantri Matru Vandana Yojana (PMMVY)",
            description: "A maternity benefit program providing monetary incentives for pregnant and lactating mothers for maternal health and nutrition.",
            benefits: "Direct Benefit Transfer (DBT) cash incentive of ₹5,000 in installments for maternal nutrition and healthcare visits.",
            official_link: "https://wcd.nic.in",
            min_age: 19,
            max_age: null,
            income_limit: null,
            applicable_states: ["all"],
            gender: "female",
            category: "maternity",
            eligibility_summary: "Pregnant women and lactating mothers aged 19 or older for their first child."
          },
          {
            name: "YSR Aarogyasri Health Scheme",
            description: "State-specific health insurance scheme in Andhra Pradesh offering high-end medical care to low-income families.",
            benefits: "Free treatment and surgical coverage up to ₹5,00,000 per family per year for identified therapies.",
            official_link: "https://www.ysraarogyasri.ap.gov.in",
            min_age: null,
            max_age: null,
            income_limit: 500000,
            applicable_states: ["Andhra Pradesh"],
            gender: "any",
            category: "general",
            eligibility_summary: "Families residing in Andhra Pradesh holding white ration cards or with annual income below ₹5 Lakhs."
          },
          {
            name: "Telangana Aarogyasri Scheme",
            description: "A flagship health initiative by Telangana government to provide quality healthcare for catastrophic illnesses.",
            benefits: "Cashless secondary and tertiary hospitalization treatment up to ₹10,000,000 for listed critical illnesses.",
            official_link: "https://aarogyasri.telangana.gov.in",
            min_age: null,
            max_age: null,
            income_limit: 200000,
            applicable_states: ["Telangana"],
            gender: "any",
            category: "general",
            eligibility_summary: "Resident families of Telangana holding food security card (ration card) or low income criteria."
          },
          {
            name: "Rashtriya Swasthya Bima Yojana (RSBY)",
            description: "Government-run health insurance scheme for the unorganized sector workers and BPL category.",
            benefits: "Health coverage of ₹30,000 per year for a family of up to five members on a family floater basis.",
            official_link: "http://www.rsby.gov.in",
            min_age: null,
            max_age: null,
            income_limit: null,
            applicable_states: ["all"],
            gender: "any",
            category: "BPL",
            eligibility_summary: "Unorganized sector workers belonging to BPL category and their families."
          },
          {
            name: "CGHS Senior Citizen Welfare",
            description: "Special medical consultation and treatment program for retired central government employees.",
            benefits: "Comprehensive OPD treatments, free medicines, and indoor treatment at government and empaneled private hospitals.",
            official_link: "https://cghs.nic.in",
            min_age: 60,
            max_age: null,
            income_limit: null,
            applicable_states: ["all"],
            gender: "any",
            category: "senior_citizen",
            eligibility_summary: "Retired central government pension holders aged 60 or above."
          },
          {
            name: "Pradhan Mantri Surakshit Matritva Abhiyan (PMSMA)",
            description: "An initiative of the Ministry of Health and Family Welfare (MoHFW) to provide quality antenatal care.",
            benefits: "Free healthcare checkups, diagnostic services, and medical counseling on the 9th day of every month.",
            official_link: "https://pmsma.nhp.gov.in",
            min_age: 15,
            max_age: 49,
            income_limit: null,
            applicable_states: ["all"],
            gender: "female",
            category: "maternity",
            eligibility_summary: "Pregnant women in their second or third trimester (typically aged 15-49)."
          }
        ];

        for (const scheme of initialSchemes) {
          await addDoc(collection(db, "government_schemes"), scheme);
        }
        setSchemes(initialSchemes);
      } else {
        const mapped = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || data.title || "Unknown Scheme",
            description: data.description || "",
            benefits: data.benefits || "Verify details on official portal",
            official_link: data.official_link || data.link || "https://pmjay.gov.in",
            min_age: data.min_age !== undefined ? data.min_age : null,
            max_age: data.max_age !== undefined ? data.max_age : null,
            income_limit: data.income_limit !== undefined ? data.income_limit : null,
            applicable_states: data.applicable_states || ["all"],
            gender: data.gender || "any",
            category: data.category || "general",
            eligibility_summary: data.eligibility_summary || data.eligibility || "Confirm on official website"
          } as GovernmentScheme;
        });
        setSchemes(mapped);
      }
    } catch (e) {
      console.error("Error loading schemes", e);
    }
  };

  const loadHospitals = async () => {
    try {
      const snap = await getDocs(collection(db, "hospitals"));
      const initialHospitals: Hospital[] = [
        {
          name: "Apollo General & Cardiac Center",
          location: "Jubilee Hills, Hyderabad",
          specializations: ["Heart Care", "Emergency", "General Care"],
          contact: "040-23607777",
          lat: 17.4168,
          lng: 78.4124
        },
        {
          name: "NIMS Government Medical Institute",
          location: "Punjagutta, Hyderabad",
          specializations: ["Pediatrics", "Cancer Care", "Free Schemes Clinic"],
          contact: "040-23489000",
          lat: 17.4226,
          lng: 78.4529
        },
        {
          name: "Medicover Multi-Specialty Hospital",
          location: "Hitec City, Hyderabad",
          specializations: ["Brain Care", "Emergency", "Orthopedics"],
          contact: "040-68334455",
          lat: 17.4475,
          lng: 78.3762
        },
        {
          name: "Care Hospitals",
          location: "Banjara Hills, Hyderabad",
          specializations: ["Heart Care", "Brain Care", "Emergency"],
          contact: "040-61656565",
          lat: 17.4107,
          lng: 78.4485
        },
        {
          name: "Continental Hospitals",
          location: "Gachibowli, Hyderabad",
          specializations: ["Orthopedics", "Cancer Care", "Gastroenterology", "Emergency"],
          contact: "040-67000000",
          lat: 17.4138,
          lng: 78.3444
        },
        {
          name: "AIIMS Delhi (All India Institute of Medical Sciences)",
          location: "Ansari Nagar, New Delhi",
          specializations: ["Cancer Care", "Brain Care", "Pediatrics", "General Care"],
          contact: "011-26588500",
          lat: 28.5672,
          lng: 77.2100
        },
        {
          name: "Fortis Hospital",
          location: "Bannerghatta Road, Bengaluru",
          specializations: ["Heart Care", "Orthopedics", "Emergency"],
          contact: "080-66214444",
          lat: 12.8950,
          lng: 77.5992
        },
        {
          name: "Tata Memorial Hospital",
          location: "Parel, Mumbai",
          specializations: ["Cancer Care", "Oncology", "Pediatrics"],
          contact: "022-24177000",
          lat: 19.0028,
          lng: 72.8422
        },
        {
          name: "Kokilaben Dhirubhai Ambani Hospital",
          location: "Andheri West, Mumbai",
          specializations: ["Brain Care", "Heart Care", "Emergency", "Orthopedics"],
          contact: "022-30999999",
          lat: 19.1313,
          lng: 72.8252
        },
        {
          name: "Fortis Malar Hospital",
          location: "Adyar, Chennai",
          specializations: ["Heart Care", "Brain Care", "Emergency", "Pediatrics"],
          contact: "044-42424242",
          lat: 13.0125,
          lng: 80.2562
        }
      ];

      const needsReSeed = snap.empty || snap.docs.some(doc => {
        const d = doc.data();
        return d.lat === undefined || d.lng === undefined;
      });

      if (needsReSeed) {
        // Delete old ones
        for (const doc of snap.docs) {
          await deleteDoc(doc.ref);
        }
        // Write new ones
        for (const hosp of initialHospitals) {
          await addDoc(collection(db, "hospitals"), hosp);
        }
        setHospitals(initialHospitals);
      } else {
        setHospitals(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Hospital[]);
      }
    } catch (e) {
      console.error("Error loading hospitals", e);
    }
  };

  // Automatically trigger AI insights when new vitals are logged
  useEffect(() => {
    if (vitals.length > 0) {
      generateAiTrendInsights();
    }
  }, [vitals.length, lang]);

  const generateAiTrendInsights = async () => {
    setInsightsLoading(true);
    try {
      // Send last 3 vitals to summarize
      const recentVitals = vitals.slice(0, 3).map(v => ({
        time: v.timestamp,
        hr: v.readings.heartRate,
        bp: `${v.readings.systolic}/${v.readings.diastolic}`,
        oxygen: v.readings.oxygenLevel,
        temp: v.readings.temperature,
        risk: v.risk_level
      }));

      const res = await fetch("/api/gemini/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vitals: recentVitals, language: lang })
      });
      const data = await res.json();
      setAiInsights(data.text);
    } catch (e) {
      console.warn("AI Insights (handled):", e);
      setAiInsights(t.lowRisk);
    } finally {
      setInsightsLoading(false);
    }
  };

  // Evaluate risk level from vitals inputs
  const evaluateRisk = (hr: number, sys: number, o2: number, temp: number): "low" | "medium" | "high" => {
    if (o2 < 90 || hr < 45 || hr > 130 || sys > 160 || sys < 80 || temp > 39.5) return "high";
    if (o2 < 95 || hr < 55 || hr > 105 || sys > 135 || sys < 90 || temp > 38.0) return "medium";
    return "low";
  };

  // Submit new logged vitals
  const handleLogVitals = async () => {
    try {
      const risk = evaluateRisk(heartRate, systolic, oxygenLevel, temperature);
      const newRecord: VitalsRecord = {
        patient_id: profile.uid,
        timestamp: new Date().toISOString(),
        readings: {
          heartRate,
          systolic,
          diastolic,
          oxygenLevel,
          temperature,
          loggedBy: "patient"
        },
        risk_level: risk
      };

      await addDoc(collection(db, "vitals"), newRecord);
      setShowLogModal(false);

      // Trigger real-time notifications to all linked accepted caretakers
      try {
        const caretakersQuery = query(
          collection(db, "patient_caretaker"),
          where("patient_id", "==", profile.uid),
          where("status", "==", "accepted")
        );
        const caretakersSnap = await getDocs(caretakersQuery);
        for (const ctDoc of caretakersSnap.docs) {
          const ct = ctDoc.data();
          await addDoc(collection(db, "notifications"), {
            recipient_id: ct.caretaker_id,
            recipient_role: "caretaker",
            type: "vitals_log",
            message: `📊 Patient ${profile.fullName} logged new vitals (Risk: ${risk.toUpperCase()}). HR: ${heartRate} bpm, BP: ${systolic}/${diastolic}, O2: ${oxygenLevel}%, Temp: ${temperature}°C`,
            related_id: profile.uid,
            read: false,
            created_at: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error("Error creating caretaker vitals logged notification:", err);
      }

      // Trigger the AI Agents Layer!
      await agentManager.dispatchEvent({
        type: "VITALS_UPDATED",
        patientId: profile.uid,
        data: {
          heartRate,
          systolic,
          diastolic,
          oxygenLevel,
          temperature,
          patientName: profile.fullName,
          language: lang,
          patientCoords,
          state: profile.state
        }
      });

      // Create a persistent alert if risk is medium
      // If it's high, HealthMonitoringAgent will trigger RISK_LEVEL_CRITICAL and EmergencyResponseAgent will log/alert
      if (risk === "medium") {
        const message = `Alert: Vitals are outside normal parameters. Please check-in and rest.`;
        const alertRef = await addDoc(collection(db, "alerts"), {
          patient_id: profile.uid,
          patient_name: profile.fullName,
          type: oxygenLevel < 92 ? "oxygen" : systolic > 135 ? "blood_pressure" : "heart_rate",
          severity: "medium",
          message,
          timestamp: new Date().toISOString(),
          resolved: false
        });

        // Notify patient of their alert
        await addDoc(collection(db, "notifications"), {
          recipient_id: profile.uid,
          recipient_role: "patient",
          type: "alert",
          message: `⚠️ Vitals Alert: ${message}`,
          related_id: alertRef.id,
          read: false,
          created_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error("Error logging vitals", e);
    }
  };

  // Big Red Emergency Trigger
  const handleEmergencyPanic = async () => {
    try {
      // Trigger the AI Agents Layer!
      await agentManager.dispatchEvent({
        type: "EMERGENCY_TRIGGERED",
        patientId: profile.uid,
        data: {
          patientName: profile.fullName,
          triggerReason: "PATIENT PRESSED CRITICAL EMERGENCY ALARM! Needs immediate assistance!",
          patientCoords,
          state: profile.state
        }
      });
      alert("⚠️ Emergency Help Signal Sent! Your caretakers and doctors have been notified.");
    } catch (e) {
      console.error("Error triggering emergency panic", e);
    }
  };

  // Send caretaker invitation
  const handleInviteCaretaker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caretakerEmail.trim() || !inviteRelationship.trim()) return;
    setInviteLoading(true);
    setInviteStatus("");

    try {
      // Find user with that email who has role "caretaker"
      const userQ = query(
        collection(db, "users"),
        where("email", "==", caretakerEmail.trim().toLowerCase())
      );
      const userSnap = await getDocs(userQ);

      if (userSnap.empty) {
        setInviteStatus("❌ No Caretaker found with this email in VitalCare.");
        setInviteLoading(false);
        return;
      }

      const caretakerDoc = userSnap.docs[0];
      const caretakerData = caretakerDoc.data() as UserProfile;

      if (caretakerData.role !== "caretaker") {
        setInviteStatus("❌ This user is registered as a " + caretakerData.role + ", not a caretaker.");
        setInviteLoading(false);
        return;
      }

      // Check if already invited
      const relationId = `${profile.uid}_${caretakerDoc.id}`;
      await setDoc(doc(db, "patient_caretaker", relationId), {
        id: relationId,
        patient_id: profile.uid,
        patient_name: profile.fullName,
        patient_email: profile.email,
        caretaker_id: caretakerDoc.id,
        caretaker_name: caretakerData.fullName,
        caretaker_email: caretakerData.email,
        relationship: inviteRelationship,
        status: "pending",
        created_at: new Date().toISOString()
      });

      setInviteStatus("✅ Invitation sent to " + caretakerData.fullName + " successfully!");
      setCaretakerEmail("");
      setInviteRelationship("");
    } catch (err) {
      console.error(err);
      setInviteStatus("❌ Something went wrong sending invitation.");
    } finally {
      setInviteLoading(false);
    }
  };

  // Book Appointment
  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !appointmentDate) return;
    setBookingLoading(true);
    setBookingStatus("");

    try {
      const docData = allDoctorsList.find(d => d.uid === selectedDoctorId);
      const doctorName = docData ? docData.fullName : "Doctor";
      const specialization = docData ? docData.specialization : "General";

      const appt: Appointment = {
        patient_id: profile.uid,
        patient_name: profile.fullName,
        doctor_id: selectedDoctorId,
        doctor_name: doctorName,
        doctor_specialization: specialization,
        datetime: appointmentDate,
        status: "pending",
        notes: appointmentNotes
      };

      await addDoc(collection(db, "appointments"), appt);

      // Create / update patient-doctor assignment state as pending or active
      const relationId = `${profile.uid}_${selectedDoctorId}`;
      await setDoc(doc(db, "patient_doctor", relationId), {
        id: relationId,
        patient_id: profile.uid,
        patient_name: profile.fullName,
        doctor_id: selectedDoctorId,
        doctor_name: doctorName,
        status: "pending",
        assigned_date: new Date().toISOString()
      });

      setBookingStatus("✅ Appointment requested successfully!");
      setAppointmentDate("");
      setAppointmentNotes("");
    } catch (err) {
      console.error(err);
      setBookingStatus("❌ Something went wrong requesting appointment.");
    } finally {
      setBookingLoading(false);
    }
  };

  // Request Direct Doctor Link
  const handleRequestDoctorLink = async (doctor: UserProfile) => {
    try {
      const relationId = `${profile.uid}_${doctor.uid}`;
      await setDoc(doc(db, "patient_doctor", relationId), {
        id: relationId,
        patient_id: profile.uid,
        patient_name: profile.fullName,
        doctor_id: doctor.uid,
        doctor_name: doctor.fullName,
        status: "pending",
        assigned_date: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error requesting doctor link:", err);
    }
  };

  // Remove/Cancel Doctor Link
  const handleRemoveDoctorLink = async (doctorId: string) => {
    try {
      const relationId = `${profile.uid}_${doctorId}`;
      await updateDoc(doc(db, "patient_doctor", relationId), {
        status: "inactive"
      });
    } catch (err) {
      console.error("Error removing doctor link:", err);
    }
  };

  // Submit Blood request or donation
  const handleBloodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bloodLocation.trim() || !bloodContact.trim()) return;
    setBloodLoading(true);

    try {
      await addDoc(collection(db, "blood_donation"), {
        type: bloodType,
        name: profile.fullName,
        bloodGroup,
        units: bloodUnits,
        location: bloodLocation,
        contact: bloodContact,
        status: "active",
        timestamp: new Date().toISOString()
      });

      setBloodLocation("");
      setBloodContact("");
      alert("✅ Registered blood request/donation successfully!");
    } catch (e) {
      console.error(e);
    } finally {
      setBloodLoading(false);
    }
  };

  // File upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(",")[1];
      setChatAttachment({
        name: file.name,
        mimeType: file.type,
        data: base64Data,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Real-time voice transcription (Voice Dictation)
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError("Speech recognition is not supported in this browser. Please try Chrome, Edge, or Safari.");
      setTimeout(() => setSpeechError(null), 8000);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang === "hi" ? "hi-IN" : lang === "te" ? "te-IN" : "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setSpeechError(null);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setChatInput(prev => prev ? `${prev} ${transcript}` : transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event);
      let errorMsg = "Speech recognition error. Please check your microphone connection.";
      if (event.error === "not-allowed") {
        errorMsg = "Microphone access is blocked. Please allow microphone permission in your browser.";
      } else if (event.error === "no-speech") {
        errorMsg = "No speech detected. Please speak clearly into your microphone.";
      } else if (event.error === "service-not-allowed") {
        errorMsg = "Speech recognition service is blocked or not allowed by your OS/Browser.";
      }
      setSpeechError(errorMsg);
      setIsListening(false);
      setTimeout(() => setSpeechError(null), 8000);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e: any) {
      console.error("Failed to start speech recognition:", e);
      setSpeechError("Failed to start speech recognition. Please make sure no other app is using your microphone.");
      setIsListening(false);
      setTimeout(() => setSpeechError(null), 8000);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Audio voice note recorder (recording voice file)
  const startRecordingAudio = async () => {
    try {
      setSpeechError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          const base64Data = (reader.result as string).split(",")[1];
          setChatAttachment({
            name: `voice_note_${Date.now()}.webm`,
            mimeType: "audio/webm",
            data: base64Data,
          });
        };
        reader.readAsDataURL(audioBlob);
        
        // Stop microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecordingAudio(true);
    } catch (err: any) {
      console.error("Failed to start recording audio:", err);
      let errorMsg = "Could not access microphone. Please check your browser permissions.";
      if (err.name === "NotAllowedError" || err.message?.includes("Permission denied")) {
        errorMsg = "Microphone access is blocked. Please allow microphone permission in your browser settings.";
      }
      setSpeechError(errorMsg);
      setTimeout(() => setSpeechError(null), 8000);
    }
  };

  const stopRecordingAudio = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
    }
  };

  // Ask Gemini Assistant Chat
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() && !chatAttachment) return;

    const userMsg = chatInput.trim();
    const currentAttachment = chatAttachment;

    // Clear form inputs immediately
    setChatInput("");
    setChatAttachment(null);

    // Build user message with optional attachment
    const newUserMsg = {
      role: "user",
      content: userMsg || (currentAttachment ? `Sent a file: ${currentAttachment.name}` : ""),
      ...(currentAttachment ? { attachment: currentAttachment } : {})
    };

    setChatMessages(prev => [...prev, newUserMsg]);
    setChatLoading(true);

    try {
      // Proxy chat request to Express API
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: [...chatMessages, newUserMsg] 
        })
      });

      const data = await res.json();
      setChatMessages(prev => [...prev, { role: "assistant", content: data.text }]);
    } catch (err) {
      console.warn("Gemini Chat (handled):", err);
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: "I'm having trouble connecting right now! Make sure you stay calm, rest well, and tell your doctor if you feel very unwell." 
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Get current risk level for display
  const latestVital = vitals[0];
  const currentRisk = latestVital ? latestVital.risk_level : "low";

  // Math and filtering for hospitals
  const sortedAndFilteredHospitals = (() => {
    if (!patientCoords) return [];

    // Calculate distance for all database hospitals
    const calculatedDatabase = hospitals.map((h) => {
      const distance = h.lat !== undefined && h.lng !== undefined
        ? getHaversineDistance(patientCoords.lat, patientCoords.lng, h.lat, h.lng)
        : Infinity;
      return { ...h, distance };
    });

    // Always generate dynamic local hospitals centered exactly around their active coordinates (GPS or fallback)
    const locals = generateLocalHospitals(patientCoords.lat, patientCoords.lng, profile.state);
    const calculatedLocals = locals.map((h) => {
      const distance = h.lat !== undefined && h.lng !== undefined
        ? getHaversineDistance(patientCoords.lat, patientCoords.lng, h.lat, h.lng)
        : Infinity;
      return { ...h, distance };
    });

    // Merge: always include the nearby locals, plus any database hospitals that are close by (within 100 km)
    const closeDatabase = calculatedDatabase.filter(h => h.distance < 100);
    const baseHospitals = [...calculatedLocals, ...closeDatabase];

    // Filter by specialization if selected
    const filtered = selectedSpecialization
      ? baseHospitals.filter((h) => h.specializations.includes(selectedSpecialization))
      : baseHospitals;

    // Identify hospitals where the patient has active/linked doctors
    const activeDocHospitalLinks = doctors
      .filter(d => d.status === "active")
      .map(d => {
        const docItem = allDoctorsList.find(adm => adm.uid === d.doctor_id);
        if (!docItem) return null;
        return {
          hospitalId: docItem.hospital_id,
          hospitalName: docItem.hospitalName,
          docName: docItem.fullName
        };
      })
      .filter((item): item is { hospitalId?: string; hospitalName?: string; docName: string } => !!item);

    // Map hospitals to add active doctors information
    const hospitalsWithDoctors = filtered.map(h => {
      const matchedDocs = activeDocHospitalLinks.filter(
        dh => (dh.hospitalId && h.id && dh.hospitalId === h.id) || 
              (dh.hospitalName && h.name && dh.hospitalName.toLowerCase() === h.name.toLowerCase())
      );
      return {
        ...h,
        activeDoctors: matchedDocs.map(dh => dh.docName)
      };
    });

    // Sort: hospitals with active doctors go FIRST, and within each group sort by distance ascending
    const sorted = [...hospitalsWithDoctors].sort((a, b) => {
      const aHasDoc = a.activeDoctors && a.activeDoctors.length > 0;
      const bHasDoc = b.activeDoctors && b.activeDoctors.length > 0;
      if (aHasDoc && !bHasDoc) return -1;
      if (!aHasDoc && bHasDoc) return 1;
      return a.distance - b.distance;
    });

    // Return closest 5
    return sorted.slice(0, 5);
  })();

  const availableSpecializations = Array.from(
    new Set((() => {
      if (!patientCoords) return [];
      const locals = generateLocalHospitals(patientCoords.lat, patientCoords.lng, profile.state);
      const combined = [...locals, ...hospitals];
      return combined.flatMap((h) => h.specializations || []);
    })())
  ).sort();

  const filteredAndSortedDoctors = (() => {
    let filtered = [...allDoctorsList];

    // Filter by Search Query (name, hospital, specialization or bio)
    if (doctorSearchQuery.trim()) {
      const q = doctorSearchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.fullName.toLowerCase().includes(q) || 
        (d.specialization && d.specialization.toLowerCase().includes(q)) || 
        (d.hospitalName && d.hospitalName.toLowerCase().includes(q)) ||
        (d.bio && d.bio.toLowerCase().includes(q))
      );
    }

    // Filter by Specialization dropdown
    if (doctorFilterSpecialization) {
      filtered = filtered.filter(d => d.specialization === doctorFilterSpecialization);
    }

    // Sort by selected parameter
    if (doctorSortBy === "experience") {
      filtered.sort((a, b) => (b.experience || 0) - (a.experience || 0));
    } else if (doctorSortBy === "rating") {
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (doctorSortBy === "fee") {
      filtered.sort((a, b) => (a.consultationFee || 0) - (b.consultationFee || 0));
    }

    return filtered;
  })();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row pb-24 lg:pb-0">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-slate-900 text-white shrink-0 sticky top-0 h-screen z-20">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="bg-rose-500 text-white p-2 rounded-xl">
              <Heart className="h-6 w-6 fill-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">VitalCare</h1>
              <p className="text-xs text-rose-400 font-bold">{t.patientDashboard}</p>
            </div>
          </div>
        </div>

        {/* User profile brief in sidebar */}
        <div className="p-4 mx-4 my-4 bg-slate-800/60 rounded-2xl border border-slate-800">
          <div className="text-xs font-bold text-slate-400">LOGGED IN AS</div>
          <div className="text-sm font-black text-white truncate">{profile.fullName}</div>
          <div className="text-[10px] text-slate-400 truncate mt-0.5">{profile.email}</div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          <button
            onClick={() => setActiveTab("vitals")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black text-xs transition-colors ${
              activeTab === "vitals" ? "bg-rose-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Activity className="h-4.5 w-4.5" />
            <span>{tabNames[lang].vitals}</span>
          </button>

          <button
            onClick={() => setActiveTab("doctors")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black text-xs transition-colors ${
              activeTab === "doctors" ? "bg-rose-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <User className="h-4.5 w-4.5" />
            <span>{tabNames[lang].doctors}</span>
          </button>

          <button
            onClick={() => setActiveTab("caretakers")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black text-xs transition-colors ${
              activeTab === "caretakers" ? "bg-rose-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Award className="h-4.5 w-4.5" />
            <span>{tabNames[lang].family}</span>
          </button>

          <button
            onClick={() => setActiveTab("schemes")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black text-xs transition-colors ${
              activeTab === "schemes" ? "bg-rose-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <BookOpen className="h-4.5 w-4.5" />
            <span>{tabNames[lang].schemes}</span>
          </button>

          <button
            onClick={() => setActiveTab("hospitals")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black text-xs transition-colors ${
              activeTab === "hospitals" ? "bg-rose-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <HospitalIcon className="h-4.5 w-4.5" />
            <span>{tabNames[lang].hospitals}</span>
          </button>

          <button
            onClick={() => setActiveTab("blood")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black text-xs transition-colors ${
              activeTab === "blood" ? "bg-rose-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Droplet className="h-4.5 w-4.5" />
            <span>{tabNames[lang].blood}</span>
          </button>

          <button
            onClick={() => setActiveTab("ai")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black text-xs transition-colors ${
              activeTab === "ai" ? "bg-rose-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <MessageSquare className="h-4.5 w-4.5" />
            <span>{tabNames[lang].ai}</span>
          </button>
        </nav>

        {/* Language Selector in Sidebar */}
        <div className="px-4 py-3 border-t border-slate-800 flex justify-between items-center bg-slate-950/40">
          <span className="text-[10px] font-bold text-slate-500">LANGUAGE</span>
          <div className="flex bg-slate-800 p-0.5 rounded-lg gap-0.5">
            {(["en", "hi", "te"] as Language[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-1.5 py-0.5 text-[9px] font-black rounded transition-colors uppercase ${lang === l ? "bg-white text-slate-950 shadow" : "text-slate-400 hover:text-slate-200"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Footer Logout */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors"
          >
            <LogOut className="h-4.5 w-4.5" />
            <span>{t.logout}</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Universal Top Header */}
        <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-rose-500 text-white p-2 rounded-xl lg:hidden">
              <Heart className="h-5 w-5 fill-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight lg:hidden">VitalCare</h1>
              <p className="text-xs text-rose-600 font-bold lg:hidden">{t.patientDashboard}</p>
              <span className="hidden lg:inline text-xs font-black text-slate-400 tracking-wider uppercase">Patient Dashboard</span>
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
                  <span className="absolute top-1 right-1 h-4 w-4 bg-rose-500 text-white font-black text-[9px] rounded-full flex items-center justify-center animate-bounce">
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
                        className="text-[10px] font-black text-rose-600 hover:text-rose-700 transition-colors flex items-center gap-1 cursor-pointer"
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
                            !notif.read ? "bg-rose-50/20" : ""
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
                            <span className="h-2 w-2 bg-rose-500 rounded-full mt-2 flex-shrink-0" />
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

        {/* Main Dashboard Panel - fluid and wide on desktop */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6">

        {/* Dynamic Patient Welcome Card */}
        <div className="bg-gradient-to-r from-rose-500 to-rose-600 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <span className="text-xs uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full font-extrabold text-rose-100">
              👋 {t.welcome}
            </span>
            <h2 className="text-2xl font-black mt-2">{profile.fullName}</h2>
            <p className="text-sm mt-1 text-rose-100 font-medium">
              📱 {t.emergencyContact}: <span className="font-extrabold underline">{profile.emergencyPhone}</span> ({profile.emergencyRelationship})
            </p>
          </div>
          {/* Background decoration */}
          <div className="absolute -right-8 -bottom-8 opacity-10 bg-white rounded-full w-40 h-40"></div>
        </div>

        {/* Quick Emergency Help Action */}
        <div className="bg-rose-100 border-2 border-rose-300 rounded-3xl p-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-4xl animate-bounce">🚨</span>
            <div>
              <h4 className="font-black text-rose-950 text-base">EMERGENCY ASSISTANCE</h4>
              <p className="text-xs text-rose-800 font-semibold">Tap to notify your Caretaker instantly</p>
            </div>
          </div>
          <button
            onClick={handleEmergencyPanic}
            className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black px-4 py-2.5 rounded-2xl shadow-lg border-2 border-rose-400 transition-all text-sm uppercase tracking-wide"
          >
            PANIC HELP
          </button>
        </div>

        {/* TAB 1: HOME (VITALS & RISK) */}
        {activeTab === "vitals" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-6">
              {/* Low Literacy Risk Score Display */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md text-center">
                <h3 className="text-lg font-black text-slate-900 mb-2 flex items-center justify-center gap-2">
                  📊 {t.riskScore}
                </h3>
                
                {/* Image-First Risk State */}
                <div className="my-4">
                  {currentRisk === "low" && <LowRiskIllustration />}
                  {currentRisk === "medium" && <MediumRiskIllustration />}
                  {currentRisk === "high" && <HighRiskIllustration />}
                </div>

                {/* High-Contrast Label with color background */}
                <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-base font-black border-2 shadow-sm ${
                  currentRisk === "low" 
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700" 
                    : currentRisk === "medium" 
                      ? "bg-amber-50 border-amber-300 text-amber-700" 
                      : "bg-rose-50 border-rose-300 text-rose-700 animate-pulse"
                }`}>
                  <span className="text-2xl">
                    {currentRisk === "low" ? t.riskFaceLow : currentRisk === "medium" ? t.riskFaceMedium : t.riskFaceHigh}
                  </span>
                  <span>
                    {currentRisk === "low" ? t.lowRisk : currentRisk === "medium" ? t.mediumRisk : t.highRisk}
                  </span>
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => setDetailModalContent({
                      title: t.riskScore,
                      body: "The Risk Score checks your recent oxygen level, heart rate, and blood pressure to make sure you are healthy and safe. Green 😊 means you are great! Yellow 😟 means take things slow. Red 🚨 means tell someone immediately."
                    })}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 underline block mx-auto"
                  >
                    ℹ️ {t.learnMore}
                  </button>
                </div>
              </div>

              {/* Quick Action Button Grid */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setShowLogModal(true)}
                  className="bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-200 p-5 rounded-3xl text-center active:scale-95 transition-all shadow-sm"
                >
                  <LogVitalsIllustration />
                  <span className="block text-emerald-900 font-black text-sm mt-3">{t.addVitals}</span>
                  <span className="block text-emerald-600 text-[10px] font-bold mt-1">📝 Heart, BP, O2</span>
                </button>

                <button
                  onClick={() => setActiveTab("ai")}
                  className="bg-sky-50 hover:bg-sky-100 border-2 border-sky-200 p-5 rounded-3xl text-center active:scale-95 transition-all shadow-sm"
                >
                  <AskAIIllustration />
                  <span className="block text-sky-900 font-black text-sm mt-3">{t.askAI}</span>
                  <span className="block text-sky-600 text-[10px] font-bold mt-1">🤖 Gemini Companion</span>
                </button>
              </div>

              {/* AI Generated Insights Section */}
              <div className="bg-sky-50 border border-sky-200 rounded-3xl p-5 shadow-sm">
                <h3 className="text-sm font-black text-sky-950 flex items-center gap-1.5 mb-2">
                  <Sparkles className="h-4 w-4 text-sky-600 fill-sky-600" /> AI HEALTH TREND INSIGHTS
                </h3>
                {insightsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-sky-700 font-semibold py-2">
                    <span className="animate-spin rounded-full h-3 w-3 border-2 border-sky-700 border-t-transparent"></span>
                    Reading health history...
                  </div>
                ) : (
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    {aiInsights || "No health history logged yet. Log your vitals using the button below to receive AI-powered health trends."}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {/* Latest Vitals List */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-md">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-rose-500" /> {t.healthTimeline}
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500">History ({vitals.length})</span>
                </div>

                {vitals.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                    No readings logged. Log your vitals to start tracking.
                  </div>
                ) : (
                  <div className="space-y-3.5 max-h-96 overflow-y-auto pr-1">
                    {vitals.map((v, idx) => (
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
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-black">
                            <span className="text-base">
                              {v.risk_level === "low" ? "😊" : v.risk_level === "medium" ? "😟" : "🚨"}
                            </span>
                            <span>
                              {new Date(v.timestamp).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] font-bold text-slate-600">
                            <div>💓 {v.readings.heartRate} bpm</div>
                            <div>🩸 {v.readings.systolic}/{v.readings.diastolic} BP</div>
                            <div>🫧 O2: {v.readings.oxygenLevel}%</div>
                            <div>🌡️ {v.readings.temperature}°C</div>
                          </div>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase border ${
                          v.risk_level === "low" 
                            ? "bg-emerald-100 border-emerald-300 text-emerald-800" 
                            : v.risk_level === "medium" 
                              ? "bg-amber-100 border-amber-300 text-amber-800" 
                              : "bg-rose-100 border-rose-300 text-rose-800"
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
        )}

        {/* TAB 2: DOCTORS & APPOINTMENTS */}
        {activeTab === "doctors" && (
          <div className="space-y-6">
            {/* Find a Doctor Panel */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md animate-fade-in space-y-6">
              <div className="space-y-1.5">
                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  🔍 Find a Doctor
                </h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Search, filter, and compare top-rated medical specialists affiliated with our nearby healthcare partners.
                </p>
              </div>

              {/* Filters and Sorting Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={doctorSearchQuery}
                    onChange={(e) => setDoctorSearchQuery(e.target.value)}
                    placeholder="Search doctor, hospital, or bio..."
                    className="pl-10 pr-4 py-2.5 w-full bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
                  />
                  {doctorSearchQuery && (
                    <button
                      onClick={() => setDoctorSearchQuery("")}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Specialization filter */}
                <div>
                  <select
                    value={doctorFilterSpecialization}
                    onChange={(e) => setDoctorFilterSpecialization(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                  >
                    <option value="">⚡ All Specializations</option>
                    <option value="General Care">🩺 General Care</option>
                    <option value="Heart Care">❤️ Heart Care</option>
                    <option value="Pediatrics">👶 Pediatrics</option>
                    <option value="Brain Care">🧠 Brain Care</option>
                    <option value="Orthopedics">🦴 Orthopedics</option>
                  </select>
                </div>

                {/* Sort dropdown */}
                <div>
                  <select
                    value={doctorSortBy}
                    onChange={(e) => setDoctorSortBy(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                  >
                    <option value="rating">⭐ Sort by: Rating</option>
                    <option value="experience">💼 Sort by: Experience</option>
                    <option value="fee">🪙 Sort by: consultation fee (Low to High)</option>
                  </select>
                </div>
              </div>

              {/* Grid of Doctor Cards */}
              {filteredAndSortedDoctors.length === 0 ? (
                <div className="p-8 border border-dashed rounded-3xl bg-slate-50/60 text-center space-y-2">
                  <p className="text-sm font-bold text-slate-400">No doctors match your filters.</p>
                  <button
                    onClick={() => {
                      setDoctorSearchQuery("");
                      setDoctorFilterSpecialization("");
                      setDoctorSortBy("rating");
                    }}
                    className="text-xs font-black text-rose-500 hover:underline"
                  >
                    Reset all filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAndSortedDoctors.map((docItem) => {
                    // Match doctor specialization style
                    const specStyles = (() => {
                      switch (docItem.specialization) {
                        case "Heart Care":
                          return { icon: "❤️", theme: "bg-rose-50 text-rose-700 border-rose-100" };
                        case "Pediatrics":
                          return { icon: "👶", theme: "bg-sky-50 text-sky-700 border-sky-100" };
                        case "Brain Care":
                          return { icon: "🧠", theme: "bg-purple-50 text-purple-700 border-purple-100" };
                        case "General Care":
                          return { icon: "🩺", theme: "bg-emerald-50 text-emerald-700 border-emerald-100" };
                        case "Orthopedics":
                          return { icon: "🦴", theme: "bg-amber-50 text-amber-700 border-amber-100" };
                        default:
                          return { icon: "🩺", theme: "bg-slate-50 text-slate-700 border-slate-100" };
                      }
                    })();

                    // Find patient relation status
                    const rel = doctors.find(rd => rd.doctor_id === docItem.uid);
                    const isLinked = rel && rel.status === "active";
                    const isPending = rel && rel.status === "pending";

                    // Formulate initials for the placeholder avatar
                    const initials = docItem.fullName
                      ? docItem.fullName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()
                      : "DR";

                    return (
                      <div
                        key={docItem.uid}
                        className="bg-white border border-slate-150 rounded-2xl p-4 flex flex-col justify-between hover:shadow-lg hover:border-slate-300 transition-all text-xs relative overflow-hidden"
                      >
                        <div className="space-y-3">
                          {/* Top row with specialization and rating */}
                          <div className="flex justify-between items-center">
                            <span className={`px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${specStyles.theme}`}>
                              <span>{specStyles.icon}</span>
                              <span>{docItem.specialization || "General Physician"}</span>
                            </span>
                            <span className="bg-amber-50 border border-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded text-[9px] flex items-center gap-0.5">
                              ⭐ {docItem.rating || 4.8}
                            </span>
                          </div>

                          {/* Profile Details Header */}
                          <div className="flex gap-3">
                            {/* Initials circle photo placeholder */}
                            <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-black text-sm flex items-center justify-center tracking-wide shadow-sm flex-shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-extrabold text-slate-900 text-sm truncate">Dr. {docItem.fullName}</h4>
                              <p className="text-[10px] text-slate-400 font-bold">{docItem.qualification || "MBBS, MD"}</p>
                              <p className="text-[10px] text-slate-500 font-semibold">{docItem.experience || 10} years experience</p>
                            </div>
                          </div>

                          {/* Hospital & Fee brief */}
                          <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[10px]">
                            <div className="font-bold text-slate-600 truncate flex items-center gap-1">
                              🏥 {docItem.hospitalName || "Partner Hospital"}
                            </div>
                            <div className="font-semibold text-slate-500 flex justify-between items-center">
                              <span>Fee: ₹{docItem.consultationFee || 500}</span>
                              <span className="text-emerald-600 font-extrabold">Active Slots ✅</span>
                            </div>
                          </div>
                        </div>

                        {/* Action triggers */}
                        <div className="mt-4 pt-3 border-t flex items-center justify-between gap-2">
                          <div>
                            {isLinked ? (
                              <span className="text-[9px] font-black uppercase bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-md">
                                Connected ✅
                              </span>
                            ) : isPending ? (
                              <span className="text-[9px] font-black uppercase bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-md animate-pulse">
                                Pending ⏳
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-slate-400">Available</span>
                            )}
                          </div>

                          <button
                            onClick={() => {
                              setSelectedDoctorForDetail(docItem);
                              setSelectedDoctorId(docItem.uid);
                              setSelectedDoctorName(docItem.fullName);
                              setBookingStatus("");
                            }}
                            className="bg-rose-500 hover:bg-rose-600 text-white font-black px-3.5 py-1.5 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 text-[10px] cursor-pointer"
                          >
                            View Profile & Book
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* My Doctors Assignments */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-md">
              <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-1.5">
                👨‍⚕️ {t.myDoctors}
              </h3>
              {doctors.length === 0 ? (
                <div className="text-slate-400 text-xs font-semibold py-4 text-center">
                  You are not currently linked with any doctor. Request an appointment above.
                </div>
              ) : (
                <div className="space-y-3">
                  {doctors.map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-2xl bg-slate-50">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">👨‍⚕️</span>
                        <div>
                          <div className="font-bold text-xs text-slate-900">{d.doctor_name}</div>
                          <div className="text-[10px] text-slate-500 font-medium">Linked since {new Date(d.assigned_date).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        d.status === "active" ? "bg-emerald-100 border-emerald-300 text-emerald-800" : "bg-slate-100 border-slate-300 text-slate-700"
                      }`}>
                        {d.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Appointments Status */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-md">
              <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-1.5">
                📅 Scheduled Visits
              </h3>
              {appointments.length === 0 ? (
                <div className="text-slate-400 text-xs font-semibold py-4 text-center">
                  No upcoming appointments.
                </div>
              ) : (
                <div className="space-y-3">
                  {appointments.map((a, i) => (
                    <div key={i} className="p-3 border rounded-2xl bg-slate-50 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="text-xs font-black text-slate-900">👨‍⚕️ {a.doctor_name}</div>
                        <div className="text-[10px] text-slate-500 font-semibold">
                          🕒 {new Date(a.datetime).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </div>
                        {a.notes && <div className="text-[10px] italic text-slate-600">"{a.notes}"</div>}
                      </div>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        a.status === "accepted" 
                          ? "bg-emerald-100 border-emerald-300 text-emerald-800" 
                          : a.status === "pending" 
                            ? "bg-amber-100 border-amber-300 text-amber-800 animate-pulse" 
                            : "bg-slate-100 border-slate-300 text-slate-700"
                      }`}>
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CARETAKERS */}
        {activeTab === "caretakers" && (
          <div className="space-y-6">
            {/* Invite Caretaker Form */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-md">
              <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
                <InviteCaretakerIllustration />
                {t.inviteCaretaker}
              </h3>

              <form onSubmit={handleInviteCaretaker} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Caretaker's Account Email</label>
                  <input
                    type="email"
                    required
                    value={caretakerEmail}
                    onChange={(e) => setCaretakerEmail(e.target.value)}
                    placeholder="caretaker@email.com"
                    className="block w-full border border-slate-300 rounded-2xl py-2.5 px-3 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Your Relationship to Them</label>
                  <input
                    type="text"
                    required
                    value={inviteRelationship}
                    onChange={(e) => setInviteRelationship(e.target.value)}
                    placeholder="e.g. Son, Daughter, Brother, Friend"
                    className="block w-full border border-slate-300 rounded-2xl py-2.5 px-3 text-sm text-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="w-full bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-black py-3 rounded-2xl text-sm transition-all"
                >
                  {inviteLoading ? "Sending invite..." : "Invite Caretaker"}
                </button>

                {inviteStatus && (
                  <div className="p-3 text-xs font-black text-center rounded-xl bg-slate-100 text-slate-800 border">
                    {inviteStatus}
                  </div>
                )}
              </form>
            </div>

            {/* My Connected Caretakers */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-md">
              <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-1.5">
                👨‍👩‍👧 {t.myCaretakers}
              </h3>
              {caretakers.length === 0 ? (
                <div className="text-slate-400 text-xs font-semibold py-4 text-center">
                  No caretakers connected. Invite your family member using the form above.
                </div>
              ) : (
                <div className="space-y-3">
                  {caretakers.map((c, i) => (
                    <div key={i} className="p-3.5 border rounded-2xl bg-slate-50 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-black text-slate-900">👵 {c.caretaker_name}</div>
                        <div className="text-[10px] text-slate-500 font-semibold">{c.relationship}</div>
                        <div className="text-[9px] text-slate-400">{c.caretaker_email}</div>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                        c.status === "accepted" 
                          ? "bg-emerald-100 border-emerald-300 text-emerald-800" 
                          : c.status === "pending" 
                            ? "bg-amber-100 border-amber-300 text-amber-800 animate-pulse" 
                            : "bg-rose-100 border-rose-300 text-rose-800"
                      }`}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: AI COMPANION */}
        {activeTab === "ai" && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-md flex flex-col h-[520px]">
              <div className="flex items-center gap-2 pb-3 border-b">
                <AskAIIllustration />
                <div>
                  <h3 className="text-sm font-black text-slate-900">{t.askAI}</h3>
                  <p className="text-[10px] text-sky-600 font-extrabold">Powered by Gemini 2.5 Flash</p>
                </div>
              </div>

              {/* Chat disclaimer */}
              <div className="bg-amber-50 border border-amber-100 p-2.5 rounded-xl my-3 text-[10px] text-amber-800 font-medium">
                ⚠️ {t.aiDisclaimer}
              </div>

              {/* Messages scroll box */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                      msg.role === "user" 
                        ? "bg-rose-500 text-white font-semibold rounded-tr-none" 
                        : "bg-slate-100 text-slate-900 rounded-tl-none border"
                    }`}>
                      {msg.attachment && (
                        <div className="mb-2">
                          {msg.attachment.mimeType.startsWith("image/") ? (
                            <img 
                              src={`data:${msg.attachment.mimeType};base64,${msg.attachment.data}`} 
                              alt="attached image" 
                              className="max-w-full max-h-48 rounded-lg border border-slate-200 object-cover"
                            />
                          ) : msg.attachment.mimeType.startsWith("audio/") ? (
                            <div className={`flex flex-col gap-1 p-2 rounded-xl ${
                              msg.role === "user" 
                                ? "bg-rose-600/50 text-white" 
                                : "bg-slate-200 text-slate-800"
                            }`}>
                              <span className="text-[10px] font-black flex items-center gap-1">
                                <Mic className="h-3 w-3 shrink-0" />
                                Voice Note
                              </span>
                              <audio 
                                src={`data:${msg.attachment.mimeType};base64,${msg.attachment.data}`} 
                                controls 
                                className="w-full max-w-[200px] h-8 mt-0.5 scale-90 origin-left" 
                              />
                            </div>
                          ) : (
                            <div className={`flex items-center gap-2 p-2 rounded-xl text-[11px] font-black border ${
                              msg.role === "user" 
                                ? "bg-rose-600/50 border-rose-400 text-white" 
                                : "bg-slate-200 border-slate-300 text-slate-700"
                            }`}>
                              <FileText className="h-4 w-4 shrink-0" />
                              <span className="truncate max-w-[150px]">{msg.attachment.name}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div>{msg.content}</div>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 text-slate-600 p-3 rounded-2xl rounded-tl-none border flex items-center gap-2">
                      <span className="animate-bounce">●</span>
                      <span className="animate-bounce delay-100">●</span>
                      <span className="animate-bounce delay-200">●</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Speech Error Banner */}
              {speechError && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 px-3 rounded-2xl mb-2 text-[11px] font-bold flex items-center justify-between text-left animate-pulse">
                  <span>{speechError}</span>
                  <button 
                    type="button" 
                    onClick={() => setSpeechError(null)} 
                    className="text-amber-500 hover:text-amber-700 p-1 rounded-full hover:bg-amber-100 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Attachment Preview (above input box) */}
              {chatAttachment && (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded-2xl mb-2 text-xs">
                  <div className="flex items-center gap-2.5">
                    {chatAttachment.mimeType.startsWith("image/") ? (
                      <img 
                        src={`data:${chatAttachment.mimeType};base64,${chatAttachment.data}`} 
                        alt="Preview" 
                        className="h-10 w-10 object-cover rounded-xl border border-slate-200 shadow-sm"
                      />
                    ) : chatAttachment.mimeType.startsWith("audio/") ? (
                      <div className="bg-rose-100 text-rose-600 p-2 rounded-full animate-pulse">
                        <Mic className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="bg-slate-100 text-slate-500 p-2 rounded-full">
                        <FileText className="h-4 w-4" />
                      </div>
                    )}
                    <div className="flex flex-col text-left">
                      <span className="font-bold text-[11px] text-slate-800 max-w-[180px] truncate">{chatAttachment.name}</span>
                      <span className="text-[9px] text-slate-400 uppercase font-black">
                        {chatAttachment.mimeType.split("/")[1] || "file"} • {(chatAttachment.data.length * 0.75 / 1024).toFixed(0)} KB
                      </span>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setChatAttachment(null)}
                    className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-200 rounded-full transition-all active:scale-90 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Chat Input Form */}
              <form onSubmit={handleSendChatMessage} className="flex flex-col gap-2 pt-3 border-t">
                {/* Hidden File Input */}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleFileChange}
                />

                <div className="flex items-center gap-2">
                  {/* File attach button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={chatLoading}
                    title="Upload health files, reports, or images"
                    className="bg-slate-100 text-slate-600 p-3 rounded-2xl active:scale-95 transition-all shadow-sm hover:bg-slate-200 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>

                  {/* Speech Dictation typing button */}
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={chatLoading || isRecordingAudio}
                    title={isListening ? "Listening... click to stop" : "Type with Voice"}
                    className={`p-3 rounded-2xl active:scale-95 transition-all shadow-sm disabled:opacity-50 cursor-pointer shrink-0 ${
                      isListening 
                        ? "bg-rose-500 text-white animate-bounce" 
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>

                  {/* Audio note voice recorder button */}
                  <button
                    type="button"
                    onClick={isRecordingAudio ? stopRecordingAudio : startRecordingAudio}
                    disabled={chatLoading || isListening}
                    title={isRecordingAudio ? "Recording... Click to save note" : "Record voice note"}
                    className={`p-3 rounded-2xl active:scale-95 transition-all shadow-sm disabled:opacity-50 cursor-pointer shrink-0 ${
                      isRecordingAudio 
                        ? "bg-emerald-500 text-white animate-pulse" 
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-center relative">
                      {isRecordingAudio && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                      )}
                      <Activity className="h-4 w-4" />
                    </div>
                  </button>

                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={
                      isRecordingAudio 
                        ? "Recording audio..." 
                        : isListening 
                          ? "Listening..." 
                          : "Ask wellness or report questions..."
                    }
                    disabled={chatLoading || isRecordingAudio}
                    className="flex-1 border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                  />

                  <button
                    type="submit"
                    disabled={chatLoading || (!chatInput.trim() && !chatAttachment)}
                    className="bg-rose-500 text-white p-3 rounded-2xl active:scale-95 transition-all shadow-md hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </div>

            {/* AI Orchestrator Logs Panel */}
            <div className="bg-slate-900 text-slate-100 rounded-3xl p-5 shadow-xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-white">🤖 AI Agent Orchestrator</h3>
                    <p className="text-[10px] text-emerald-400 font-mono tracking-tight font-bold">LIVE ACTIVITY NETWORK STATUS: ACTIVE</p>
                  </div>
                </div>
                <div className="text-[10px] bg-slate-800 border border-slate-700 px-3 py-1 rounded-xl font-mono text-slate-400">
                  {agentLogs.length} events logged
                </div>
              </div>

              {agentLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs font-mono">
                  No orchestrator events recorded yet. Vitals logs or emergency triggers will populate this feed.
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {agentLogs.map((log) => (
                    <div key={log.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md ${
                          log.eventType === "RISK_LEVEL_CRITICAL" 
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                            : log.eventType === "EMERGENCY_TRIGGERED"
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                        }`}>
                          ⚡ {log.eventType}
                        </span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                          log.status === "success" 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}>
                          {log.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-bold text-slate-300">🕵️ Agent: <span className="text-white font-black">{log.agentName}</span></span>
                        <span className="text-[9px] text-slate-500 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-[10px] font-mono bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/40 space-y-1">
                        <div>
                          <span className="text-slate-500 font-bold block">Input Summary:</span> 
                          <span className="text-slate-300 block break-words max-h-16 overflow-y-auto whitespace-pre-wrap">{log.inputSummary}</span>
                        </div>
                        <div className="pt-2 border-t border-slate-800/40">
                          <span className="text-slate-500 font-bold block">Output Summary:</span> 
                          <span className="text-emerald-300 block break-words max-h-24 overflow-y-auto whitespace-pre-wrap">{log.outputSummary}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: BLOOD DONATION */}
        {activeTab === "blood" && (
          /* Blood Donation Section */
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-md">
              <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2 text-rose-600">
                <Droplet className="h-6 w-6 fill-rose-500 text-rose-500" />
                {t.bloodDonation}
              </h3>

              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl mb-4">
                <button
                  type="button"
                  onClick={() => setBloodType("request")}
                  className={`py-2 text-xs font-bold rounded-xl transition-colors ${bloodType === "request" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
                >
                  Need Blood
                </button>
                <button
                  type="button"
                  onClick={() => setBloodType("donor")}
                  className={`py-2 text-xs font-bold rounded-xl transition-colors ${bloodType === "donor" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
                >
                  Register Donor
                </button>
              </div>

              <form onSubmit={handleBloodSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Blood Group</label>
                    <select
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="block w-full border border-slate-300 rounded-xl py-2 px-2.5 text-xs text-slate-900"
                    >
                      {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Units (ml/bottles)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={bloodUnits}
                      onChange={(e) => setBloodUnits(parseInt(e.target.value))}
                      className="block w-full border border-slate-300 rounded-xl py-2 px-2.5 text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Location / Hospital</label>
                  <input
                    type="text"
                    required
                    value={bloodLocation}
                    onChange={(e) => setBloodLocation(e.target.value)}
                    placeholder="e.g. Apollo Hospital / City center"
                    className="block w-full border border-slate-300 rounded-xl py-2 px-2.5 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Contact Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={bloodContact}
                    onChange={(e) => setBloodContact(e.target.value)}
                    placeholder="Your contact number"
                    className="block w-full border border-slate-300 rounded-xl py-2 px-2.5 text-xs text-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={bloodLoading}
                  className="w-full bg-rose-500 text-white font-black py-2.5 rounded-xl text-xs active:scale-95 transition-all shadow-sm"
                >
                  {bloodLoading ? "Submitting..." : bloodType === "request" ? "Submit Request" : "Register as Donor"}
                </button>
              </form>

              {/* Blood List */}
              <div className="mt-4 border-t pt-4 space-y-2 max-h-40 overflow-y-auto">
                <h4 className="text-[11px] font-black text-slate-700 uppercase">Recent Requests & Donors</h4>
                {bloodRecords.length === 0 ? (
                  <div className="text-[10px] text-slate-400">No requests listed.</div>
                ) : (
                  bloodRecords.slice(0, 5).map((b, i) => (
                    <div key={i} className="flex justify-between items-center p-2 border rounded-xl bg-slate-50 text-[11px]">
                      <div>
                        <span className={`font-black uppercase px-1.5 py-0.5 rounded mr-1.5 text-[9px] ${b.type === 'request' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {b.type}
                        </span>
                        <span className="font-bold">{b.bloodGroup}</span> ({b.units} Units)
                        <div className="text-[9px] text-slate-400">📍 {b.location}</div>
                      </div>
                      <a href={`tel:${b.contact}`} className="bg-rose-50 text-rose-600 p-1.5 rounded-lg font-black text-[10px] hover:bg-rose-100">
                        📞 Call
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        {/* TAB 6: GOVERNMENT SCHEMES */}
        {activeTab === "schemes" && (
          /* Government Healthcare Schemes Module */
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-md">
              <h3 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-indigo-500" />
                {t.govSchemes}
              </h3>
              
              <div className="space-y-4">
                {/* 1. CONFIDENT MATCHES */}
                <div>
                  <h4 className="text-xs font-black text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    🎉 Confident Matches (You may be eligible)
                  </h4>
                  {schemes.filter(s => evaluateSchemeEligibility(s, profile).isMatch).length === 0 ? (
                    <div className="text-slate-400 text-[11px] bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center">
                      No exact matches found based on your current profile. Try completing your profile details (Age, Gender, State)!
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {schemes
                        .filter(s => evaluateSchemeEligibility(s, profile).isMatch)
                        .map((s, idx) => {
                          const evalRes = evaluateSchemeEligibility(s, profile);
                          return (
                            <div key={idx} className="p-3.5 border-2 border-emerald-500 rounded-2xl bg-emerald-50/40 text-xs shadow-sm">
                              <div className="flex justify-between items-start gap-2 flex-wrap mb-1.5">
                                <h5 className="font-extrabold text-emerald-950 text-sm leading-tight">{s.name}</h5>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200">
                                  🛡️ You may be eligible
                                </span>
                              </div>
                              <p className="text-[10px] text-emerald-800 font-extrabold mb-1 bg-emerald-100/40 px-2 py-1 rounded-lg">
                                🎯 Criteria: {s.eligibility_summary}
                              </p>
                              {evalRes.incomeCheckRequired && (
                                <p className="text-[10px] text-amber-700 font-extrabold mb-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                                  💰 Income criteria: Confirm annual household income is below ₹{s.income_limit?.toLocaleString()}
                                </p>
                              )}
                              <p className="text-[11px] text-slate-700 font-semibold mb-2">{s.description}</p>
                              <div className="flex justify-between items-center flex-wrap gap-2 pt-1 border-t border-slate-200/50">
                                <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-100/30 px-2 py-0.5 rounded-md">🎁 Benefits: {s.benefits}</span>
                                <a
                                  href={s.official_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-700 px-3 py-1 rounded-xl text-[10px] font-black hover:bg-slate-100 shadow-sm transition-colors"
                                >
                                  Official Link <ChevronRight className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* 2. POSSIBLY RELEVANT */}
                <div className="border-t border-slate-100 pt-3">
                  <h4 className="text-xs font-black text-amber-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    🔍 Possibly Relevant (Check Eligibility)
                  </h4>
                  {schemes.filter(s => evaluateSchemeEligibility(s, profile).isPossible).length === 0 ? (
                    <div className="text-slate-400 text-[11px] bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center">
                      No unverified relevant schemes.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {schemes
                        .filter(s => evaluateSchemeEligibility(s, profile).isPossible)
                        .map((s, idx) => {
                          const evalRes = evaluateSchemeEligibility(s, profile);
                          return (
                            <div key={idx} className="p-3.5 border border-amber-300 rounded-2xl bg-amber-50/20 text-xs">
                              <div className="flex justify-between items-start gap-2 flex-wrap mb-1.5">
                                <h5 className="font-extrabold text-amber-950 text-sm leading-tight">{s.name}</h5>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-200">
                                  ❓ Possibly Relevant
                                </span>
                              </div>
                              <p className="text-[10px] text-amber-800 font-extrabold mb-1 bg-amber-100/30 px-2 py-1 rounded-lg">
                                📝 Requirements: {s.eligibility_summary}
                              </p>
                              {evalRes.reasons.length > 0 && (
                                <p className="text-[9px] text-slate-500 font-bold mb-1.5 bg-slate-100/50 px-2 py-0.5 rounded">
                                  ⚠️ Status: {evalRes.reasons.join(", ")}
                                </p>
                              )}
                              <p className="text-[11px] text-slate-600 font-semibold mb-2">{s.description}</p>
                              <div className="flex justify-between items-center flex-wrap gap-2 pt-1 border-t border-slate-200/50">
                                <span className="text-[10px] text-amber-700 font-extrabold bg-amber-100/20 px-2 py-0.5 rounded-md">🎁 Benefits: {s.benefits}</span>
                                <a
                                  href={s.official_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-700 px-3 py-1 rounded-xl text-[10px] font-black hover:bg-slate-100 shadow-sm transition-colors"
                                >
                                  Official Link <ChevronRight className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* 3. ALL SCHEMES BROWSABLE */}
                <div className="border-t border-slate-100 pt-3">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    🌐 General Healthcare Schemes List
                  </h4>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {schemes.map((s, idx) => (
                      <div key={idx} className="p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-[11px] hover:bg-slate-100 transition-colors">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-extrabold text-slate-800">{s.name}</span>
                          <span className="text-[8px] uppercase font-black bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                            {s.category}
                          </span>
                        </div>
                        <p className="text-slate-500 font-medium line-clamp-2 mb-1">{s.description}</p>
                        <div className="flex justify-between items-center text-[9px] mt-1.5">
                          <span className="text-indigo-600 font-bold">📍 Coverage: {s.applicable_states.join(", ")}</span>
                          <a
                            href={s.official_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 font-black hover:underline"
                          >
                            Official Link →
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* TAB 7: HOSPITAL RECOMMENDATIONS */}
        {activeTab === "hospitals" && (
          /* Hospital Recommendations Module */
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-md">
              <h3 className="text-base font-black text-slate-900 mb-2 flex items-center gap-2">
                <HospitalIllustration />
                {t.hospitals}
              </h3>
              
              <p className="text-[11px] text-slate-500 font-medium mb-4 leading-relaxed">
                We analyze coordinates from your device to find and rank the closest emergency, cardiac, or oncology centers in real time.
              </p>

              {/* Geolocation Status Indicator */}
              <div className="mb-4">
                {locationSource === "gps" && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-[10px] rounded-xl text-emerald-800 flex items-center justify-between font-extrabold">
                    <span className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      📍 GPS Location Active
                    </span>
                    <span className="text-emerald-600 font-bold">
                      Sorting closest medical centers ({patientCoords?.lat?.toFixed(4)}, {patientCoords?.lng?.toFixed(4)})
                    </span>
                  </div>
                )}

                {(locationSource === "registered" || locationSource === "default") && (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-[10px] text-amber-800 space-y-1">
                    <div className="flex justify-between items-center font-extrabold">
                      <span className="flex items-center gap-1.5 text-amber-900">
                        ⚠️ Registered Location Fallback
                      </span>
                      <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-black text-[9px] uppercase tracking-wider">
                        {profile.state || "Default"}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-amber-700/90 leading-relaxed">
                      {locationErrorMessage || "Browser location access is denied or unavailable."} showing results based on your registered location. Enable browser location for precise live sorting.
                    </p>
                  </div>
                )}
              </div>

              {/* Specialization Filter Dropdown */}
              <div className="mb-4">
                <label className="block text-[10px] uppercase font-extrabold text-slate-500 mb-1 tracking-wider">
                  Filter by Care Specialization:
                </label>
                <select
                  value={selectedSpecialization}
                  onChange={(e) => setSelectedSpecialization(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
                >
                  <option value="">All Hospital Specializations</option>
                  {availableSpecializations.map((spec, i) => (
                    <option key={i} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>

              {/* Interactive SVG Radar Map */}
              {sortedAndFilteredHospitals.length > 0 && patientCoords && (
                <div className="mb-4 bg-slate-900 rounded-2xl p-4 border border-slate-800 relative overflow-hidden">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                      <Map className="h-3.5 w-3.5 text-emerald-400" />
                      Dynamic Radar Compass
                    </span>
                    <span className="text-[9px] text-slate-500 font-bold">
                      Plotting {sortedAndFilteredHospitals.length} closest facilities
                    </span>
                  </div>

                  <div className="relative w-full h-[180px] bg-slate-950 rounded-xl flex items-center justify-center border border-slate-800">
                    {/* Concentric Radar Rings */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 240 180">
                      <circle cx="120" cy="90" r="80" fill="none" stroke="#10b981" strokeWidth="0.5" strokeOpacity="0.1" />
                      <circle cx="120" cy="90" r="55" fill="none" stroke="#10b981" strokeWidth="0.5" strokeOpacity="0.15" strokeDasharray="2 2" />
                      <circle cx="120" cy="90" r="30" fill="none" stroke="#10b981" strokeWidth="0.5" strokeOpacity="0.2" />
                      
                      {/* Axis Lines */}
                      <line x1="120" y1="10" x2="120" y2="170" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1="30" y1="90" x2="210" y2="90" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                      
                      {/* Connecting Lines from Patient to Hospitals */}
                      {(() => {
                        const maxLatDiff = Math.max(...sortedAndFilteredHospitals.map(h => Math.abs((h.lat || 0) - patientCoords.lat)), 0.0001);
                        const maxLngDiff = Math.max(...sortedAndFilteredHospitals.map(h => Math.abs((h.lng || 0) - patientCoords.lng)), 0.0001);
                        const maxDiff = Math.max(maxLatDiff, maxLngDiff);
                        const scale = 70 / maxDiff;

                        return sortedAndFilteredHospitals.map((h, i) => {
                          if (h.lat === undefined || h.lng === undefined) return null;
                          const dx = (h.lng - patientCoords.lng) * scale;
                          const dy = (h.lat - patientCoords.lat) * scale;
                          const tx = 120 + dx;
                          const ty = 90 - dy;
                          const isHighlighted = hoveredHospitalId === h.id || hoveredHospitalId === `index-${i}`;

                          return (
                            <line
                              key={i}
                              x1="120"
                              y1="90"
                              x2={tx}
                              y2={ty}
                              stroke={isHighlighted ? "#10b981" : "#475569"}
                              strokeWidth={isHighlighted ? "1.5" : "0.5"}
                              strokeDasharray={isHighlighted ? "none" : "2 2"}
                              strokeOpacity={isHighlighted ? "0.8" : "0.4"}
                            />
                          );
                        });
                      })()}

                      {/* Patient Core Center Dot */}
                      <circle cx="120" cy="90" r="7" className="animate-ping" fill="#10b981" fillOpacity="0.25" />
                      <circle cx="120" cy="90" r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                    </svg>

                    {/* Interactive Hospital Pins Layer */}
                    <div className="absolute inset-0">
                      {(() => {
                        const maxLatDiff = Math.max(...sortedAndFilteredHospitals.map(h => Math.abs((h.lat || 0) - patientCoords.lat)), 0.0001);
                        const maxLngDiff = Math.max(...sortedAndFilteredHospitals.map(h => Math.abs((h.lng || 0) - patientCoords.lng)), 0.0001);
                        const maxDiff = Math.max(maxLatDiff, maxLngDiff);
                        const scale = 70 / maxDiff;

                        return sortedAndFilteredHospitals.map((h, i) => {
                          if (h.lat === undefined || h.lng === undefined) return null;
                          const dx = (h.lng - patientCoords.lng) * scale;
                          const dy = (h.lat - patientCoords.lat) * scale;
                          const tx = 120 + dx;
                          const ty = 90 - dy;
                          const isHighlighted = hoveredHospitalId === h.id || hoveredHospitalId === `index-${i}`;

                          return (
                            <div
                              key={i}
                              className="absolute transition-all duration-300"
                              style={{
                                left: `${tx}px`,
                                top: `${ty}px`,
                                transform: 'translate(-50%, -50%)',
                              }}
                              onMouseEnter={() => setHoveredHospitalId(h.id || `index-${i}`)}
                              onMouseLeave={() => setHoveredHospitalId(null)}
                            >
                              <div className={`relative group cursor-pointer flex items-center justify-center rounded-full transition-transform ${isHighlighted ? 'scale-125 z-20' : 'scale-100 z-10'}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[9px] border transition-colors shadow-lg ${
                                  isHighlighted 
                                    ? 'bg-emerald-500 text-white border-white' 
                                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                                }`}>
                                  {i + 1}
                                </div>
                                <div className="absolute bottom-7 left-1/2 -translate-x-1/2 bg-slate-950 text-white text-[9px] py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-2xl border border-slate-800">
                                  <div className="font-extrabold">{h.name}</div>
                                  <div className="text-emerald-400 text-[8px] font-bold">{h.distance.toFixed(1)} km away</div>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    
                    <span className="absolute bottom-2 left-2.5 bg-slate-900/80 backdrop-blur-sm text-[8px] text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-black">
                      ◉ Patient Center
                    </span>
                  </div>
                </div>
              )}

              {/* Nearest Hospitals List */}
              <div className="space-y-6">
                {sortedAndFilteredHospitals.length === 0 ? (
                  <div className="p-6 border border-dashed rounded-2xl bg-slate-50 text-center text-xs font-bold text-slate-400">
                    No hospitals found matching "{selectedSpecialization}"
                  </div>
                ) : (
                  <>
                    {/* Part 1: Primary Recommendations (Where your doctor practices) */}
                    {sortedAndFilteredHospitals.some(h => (h as any).activeDoctors && (h as any).activeDoctors.length > 0) && (
                      <div className="space-y-3">
                        <div className="text-[11px] font-black text-rose-600 tracking-wider uppercase bg-rose-50 border border-rose-100 px-3.5 py-1.5 rounded-2xl flex items-center gap-1.5 shadow-sm">
                          🩺 RECOMMENDED: YOUR DOCTOR PRACTICES HERE
                        </div>
                        {sortedAndFilteredHospitals
                          .filter(h => (h as any).activeDoctors && (h as any).activeDoctors.length > 0)
                          .map((h, idx) => {
                            const isHighlighted = hoveredHospitalId === h.id || hoveredHospitalId === `index-recommended-${idx}`;
                            return (
                              <div
                                key={`recommended-${idx}`}
                                className={`p-4 border rounded-3xl transition-all flex justify-between items-start text-xs border-rose-200 bg-rose-50/20 shadow-sm hover:shadow-md hover:bg-rose-50/40 relative overflow-hidden`}
                                onMouseEnter={() => setHoveredHospitalId(h.id || `index-recommended-${idx}`)}
                                onMouseLeave={() => setHoveredHospitalId(null)}
                              >
                                {/* Special background decorative badge */}
                                <div className="absolute right-0 top-0 bg-rose-500 text-white text-[8px] font-black tracking-widest uppercase px-3 py-1 rounded-bl-xl shadow-sm">
                                  Your Doctor
                                </div>
                                <div className="space-y-1.5 flex-1 min-w-0 pr-3">
                                  <div className="flex items-center gap-2">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-600 text-white font-black text-[10px] flex items-center justify-center">
                                      ★
                                    </span>
                                    <h4 className="font-black text-slate-900 text-sm truncate">{h.name}</h4>
                                  </div>

                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                    <span>📍 {h.location}</span>
                                    {h.distance !== undefined && h.distance !== Infinity && (
                                      <span className="bg-rose-100 text-rose-900 px-1.5 py-0.5 rounded font-black text-[9px]">
                                        {h.distance.toFixed(1)} km away
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-[10px] font-bold text-slate-700 bg-white border border-slate-200 py-1.5 px-3 rounded-xl inline-flex items-center gap-1 mt-1.5">
                                    🩺 <span className="text-slate-900 font-extrabold">{(h as any).activeDoctors.join(", ")}</span> is based at this hospital.
                                  </div>

                                  <div className="flex gap-1 flex-wrap mt-1">
                                    {h.specializations.map((spec, i) => (
                                      <span
                                        key={i}
                                        className="text-[9px] bg-slate-100 text-slate-800 font-extrabold px-2 py-0.5 rounded-full border border-slate-200"
                                      >
                                        {spec}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div className="flex gap-2">
                                  <a
                                    href={`tel:${h.contact}`}
                                    className="bg-white border border-slate-200 text-slate-600 p-2 rounded-xl hover:bg-slate-50 shadow-sm transition-colors flex items-center justify-center h-9 w-9"
                                    title={`Call ${h.name}`}
                                  >
                                    <Phone className="h-4 w-4 text-slate-500" />
                                  </a>

                                  {patientCoords && h.lat !== undefined && h.lng !== undefined && (
                                    <a
                                      href={`https://www.google.com/maps/dir/?api=1&origin=${patientCoords.lat},${patientCoords.lng}&destination=${h.lat},${h.lng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-rose-600 text-white p-2 rounded-xl hover:bg-rose-700 shadow-sm transition-colors flex items-center justify-center h-9 w-9"
                                      title="Get Directions"
                                    >
                                      <Navigation className="h-4 w-4" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* Part 2: General / Other Closest Facilities */}
                    <div className="space-y-3">
                      {sortedAndFilteredHospitals.some(h => (h as any).activeDoctors && (h as any).activeDoctors.length > 0) && (
                        <div className="text-[11px] font-black text-slate-500 tracking-wider uppercase pt-2 flex items-center gap-1.5">
                          📍 GENERAL NEARBY HOSPITALS & CLINICS
                        </div>
                      )}
                      {sortedAndFilteredHospitals
                        .filter(h => !((h as any).activeDoctors && (h as any).activeDoctors.length > 0))
                        .map((h, idx) => {
                          const isHighlighted = hoveredHospitalId === h.id || hoveredHospitalId === `index-${idx}`;
                          return (
                            <div
                              key={idx}
                              className={`p-4 border rounded-3xl transition-all flex justify-between items-start text-xs ${
                                isHighlighted
                                  ? "border-emerald-500 bg-emerald-50/70 shadow-md ring-1 ring-emerald-500/20"
                                  : "border-slate-100 bg-emerald-50/30 hover:bg-emerald-50/50"
                              }`}
                              onMouseEnter={() => setHoveredHospitalId(h.id || `index-${idx}`)}
                              onMouseLeave={() => setHoveredHospitalId(null)}
                            >
                              <div className="space-y-1.5 flex-1 min-w-0 pr-3">
                                <div className="flex items-center gap-2">
                                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center">
                                    {idx + 1}
                                  </span>
                                  <h4 className="font-black text-emerald-950 text-sm truncate">{h.name}</h4>
                                </div>

                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                  <span>📍 {h.location}</span>
                                  {h.distance !== undefined && h.distance !== Infinity && (
                                    <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded font-black text-[9px]">
                                      {h.distance.toFixed(1)} km away
                                    </span>
                                  )}
                                </div>

                                <div className="flex gap-1 flex-wrap mt-1">
                                  {h.specializations.map((spec, i) => (
                                    <span
                                      key={i}
                                      className="text-[9px] bg-emerald-100/70 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full"
                                    >
                                      {spec}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <a
                                  href={`tel:${h.contact}`}
                                  className="bg-white border border-slate-200 text-slate-600 p-2 rounded-xl hover:bg-slate-50 shadow-sm transition-colors flex items-center justify-center h-9 w-9"
                                  title={`Call ${h.name}`}
                                >
                                  <Phone className="h-4 w-4 text-slate-500" />
                                </a>

                                {patientCoords && h.lat !== undefined && h.lng !== undefined && (
                                  <a
                                    href={`https://www.google.com/maps/dir/?api=1&origin=${patientCoords.lat},${patientCoords.lng}&destination=${h.lat},${h.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-emerald-600 text-white p-2 rounded-xl hover:bg-emerald-700 shadow-sm transition-colors flex items-center justify-center h-9 w-9"
                                    title="Get Directions"
                                  >
                                    <Navigation className="h-4 w-4" />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
      </main>

      {/* Detailed Doctor Profile & Booking Modal */}
      {selectedDoctorForDetail && (() => {
        const docHospital = hospitals.find(h => 
          h.id === selectedDoctorForDetail.hospital_id || 
          h.name.toLowerCase() === selectedDoctorForDetail.hospitalName?.toLowerCase()
        );
        const distance = docHospital && docHospital.lat !== undefined && docHospital.lng !== undefined && patientCoords
          ? getHaversineDistance(patientCoords.lat, patientCoords.lng, docHospital.lat, docHospital.lng)
          : null;

        // Initials placeholder avatar
        const initials = selectedDoctorForDetail.fullName
          ? selectedDoctorForDetail.fullName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()
          : "DR";

        return (
          <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-250 flex flex-col gap-5 text-xs relative">
              
              {/* Close button */}
              <button
                onClick={() => setSelectedDoctorForDetail(null)}
                className="absolute right-4 top-4 p-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-full text-slate-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Profile Header */}
              <div className="flex gap-4 items-start pr-8">
                <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-black text-lg flex items-center justify-center tracking-wider shadow-sm flex-shrink-0">
                  {initials}
                </div>
                <div className="space-y-1">
                  <span className="bg-rose-50 text-rose-700 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {selectedDoctorForDetail.specialization || "Specialist"}
                  </span>
                  <h3 className="text-lg font-black text-slate-900">Dr. {selectedDoctorForDetail.fullName}</h3>
                  <p className="font-extrabold text-slate-600">{selectedDoctorForDetail.qualification}</p>
                  <p className="font-semibold text-slate-400">⭐ {selectedDoctorForDetail.rating || "4.8"} ({selectedDoctorForDetail.experience || 10} Years Experience)</p>
                </div>
              </div>

              {/* Bio block */}
              {selectedDoctorForDetail.bio && (
                <div className="space-y-1.5 border-t pt-4">
                  <h4 className="font-black text-slate-800 text-[11px] uppercase tracking-wider">About Doctor</h4>
                  <p className="text-slate-500 font-medium leading-relaxed">{selectedDoctorForDetail.bio}</p>
                </div>
              )}

              {/* Static Info fields */}
              <div className="grid grid-cols-2 gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Consultation Fee</span>
                  <div className="font-extrabold text-slate-900 text-sm">₹{selectedDoctorForDetail.consultationFee || 500}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Languages Spoken</span>
                  <div className="font-extrabold text-slate-800 truncate">
                    {Array.isArray(selectedDoctorForDetail.languages) 
                      ? selectedDoctorForDetail.languages.join(", ") 
                      : selectedDoctorForDetail.languages || "English"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Available Days</span>
                  <div className="font-extrabold text-slate-800">
                    {Array.isArray(selectedDoctorForDetail.availableDays) 
                      ? selectedDoctorForDetail.availableDays.join(", ") 
                      : selectedDoctorForDetail.availableDays || "Mon - Fri"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Time Slots</span>
                  <div className="font-extrabold text-slate-800">{selectedDoctorForDetail.availableTime || "09:00 AM - 05:00 PM"}</div>
                </div>
              </div>

              {/* Hospital Distance & Affiliation (GPS logic integration) */}
              <div className="border-t pt-4 space-y-2">
                <h4 className="font-black text-slate-800 text-[11px] uppercase tracking-wider">Hospital Affiliation & Proximity</h4>
                <div className="bg-rose-50/50 border border-rose-100 p-3.5 rounded-2xl space-y-2">
                  <div className="flex items-start gap-2.5">
                    <span className="text-lg mt-0.5">🏥</span>
                    <div>
                      <div className="font-black text-slate-900">{selectedDoctorForDetail.hospitalName || "Partner Medical Facility"}</div>
                      <div className="text-[10px] text-slate-400 font-bold">📍 {docHospital ? docHospital.location : "Location not listed"}</div>
                    </div>
                  </div>

                  {/* Geolocation feedback */}
                  <div className="flex items-center justify-between border-t border-rose-100 pt-2 text-[10px] font-bold">
                    <span className="text-slate-500">Distance from you:</span>
                    {distance !== null ? (
                      <span className="text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-md flex items-center gap-1">
                        🚀 <strong className="font-black">{distance.toFixed(1)} km</strong> (Reachable ✅)
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Calculating distance...</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Booking inputs form inside modal */}
              <div className="border-t pt-4 space-y-3.5">
                <h4 className="font-black text-slate-800 text-[11px] uppercase tracking-wider">Book Scheduled Visit</h4>
                <form 
                  onSubmit={async (e) => {
                    await handleBookAppointment(e);
                  }} 
                  className="space-y-3.5"
                >
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Preferred Date and Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={appointmentDate}
                      onChange={(e) => setAppointmentDate(e.target.value)}
                      className="block w-full border border-slate-200 bg-slate-50 rounded-xl py-2 px-3 text-xs text-slate-800 font-bold focus:bg-white focus:ring-1 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Reason for Visit / Symptoms</label>
                    <textarea
                      rows={2}
                      value={appointmentNotes}
                      onChange={(e) => setAppointmentNotes(e.target.value)}
                      placeholder="Specify your symptoms or notes for the doctor..."
                      className="block w-full border border-slate-200 bg-slate-50 rounded-xl py-2 px-3 text-xs text-slate-800 font-medium placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
                    />
                  </div>

                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedDoctorForDetail(null)}
                      className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-3 rounded-xl tracking-wide transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={bookingLoading}
                      className="w-2/3 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-black py-3 rounded-xl tracking-wide transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
                    >
                      {bookingLoading ? "Booking appointment..." : "Confirm Booking"}
                    </button>
                  </div>

                  {bookingStatus && (
                    <div className="p-3 text-center rounded-xl font-bold bg-slate-50 border border-slate-150 text-slate-700 shadow-sm animate-pulse">
                      {bookingStatus}
                    </div>
                  )}
                </form>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Slide-Up Vitals Logging Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center pb-3 border-b mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📝</span>
                <h3 className="text-lg font-black text-slate-900">{t.addVitals}</h3>
              </div>
              <button
                onClick={() => setShowLogModal(false)}
                className="p-1.5 bg-slate-100 text-slate-500 rounded-full hover:bg-rose-50 hover:text-rose-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Heart Rate Slider */}
              <div className="space-y-1">
                <div className="flex justify-between font-black text-xs text-slate-800">
                  <span>💓 {t.vitalsHeartRate}</span>
                  <span className="text-rose-600 text-sm">{heartRate} bpm</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="160"
                  value={heartRate}
                  onChange={(e) => setHeartRate(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                  <span>Too Low (&lt;55)</span>
                  <span className="text-emerald-500">Normal (60-100)</span>
                  <span>Too High (&gt;110)</span>
                </div>
              </div>

              {/* Systolic Blood Pressure */}
              <div className="space-y-1">
                <div className="flex justify-between font-black text-xs text-slate-800">
                  <span>🩸 Blood Pressure (Systolic)</span>
                  <span className="text-rose-600 text-sm">{systolic} mmHg</span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="190"
                  value={systolic}
                  onChange={(e) => setSystolic(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                  <span>Low (&lt;90)</span>
                  <span className="text-emerald-500">Normal (90-120)</span>
                  <span>High (&gt;140)</span>
                </div>
              </div>

              {/* Oxygen Level SpO2 */}
              <div className="space-y-1">
                <div className="flex justify-between font-black text-xs text-slate-800">
                  <span>🫧 {t.vitalsOxygen}</span>
                  <span className="text-rose-600 text-sm">{oxygenLevel}% SpO2</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="100"
                  value={oxygenLevel}
                  onChange={(e) => setOxygenLevel(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                  <span className="text-rose-500">Critical (&lt;90)</span>
                  <span>Careful (90-94)</span>
                  <span className="text-emerald-500">Safe (95-100)</span>
                </div>
              </div>

              {/* Temperature */}
              <div className="space-y-1">
                <div className="flex justify-between font-black text-xs text-slate-800">
                  <span>🌡️ {t.vitalsTemp}</span>
                  <span className="text-rose-600 text-sm">{temperature} °C</span>
                </div>
                <input
                  type="range"
                  min="35"
                  max="41"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                  <span>Cold (&lt;36)</span>
                  <span className="text-emerald-500">Normal (36.5-37.5)</span>
                  <span>Fever (&gt;38)</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <button
                  onClick={handleLogVitals}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black py-3 rounded-2xl text-sm transition-all shadow-md cursor-pointer text-center"
                >
                  💾 Save Vitals Info
                </button>
                <button
                  onClick={() => setShowLogModal(false)}
                  className="w-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 font-bold py-2.5 rounded-2xl text-xs transition-all cursor-pointer text-center"
                >
                  ➡️ {t.skipVitals}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details/Learn More Modal - slide up on mobile, centered on desktop */}
      {detailModalContent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6 shadow-2xl relative animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            <button
              onClick={() => setDetailModalContent(null)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 text-slate-500 rounded-full hover:bg-rose-50 hover:text-rose-600"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-base font-black text-slate-900 mb-3">{detailModalContent.title}</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">{detailModalContent.body}</p>
            <button
              onClick={() => setDetailModalContent(null)}
              className="mt-5 w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-2.5 rounded-2xl text-xs transition-colors"
            >
              Got It!
            </button>
          </div>
        </div>
      )}

      {/* Bottom Navigation Rail (Icon + Label) - hidden on desktop (lg:) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-2.5 px-1.5 sm:px-3 flex justify-around items-center z-40 shadow-xl max-w-lg mx-auto rounded-t-3xl">
        <button
          onClick={() => setActiveTab("vitals")}
          className={`flex flex-col items-center gap-0.5 transition-all flex-1 min-w-0 ${activeTab === "vitals" ? "text-rose-500 scale-105" : "text-slate-400 hover:text-slate-600"}`}
        >
          <Activity className="h-4.5 w-4.5" />
          <span className="text-[8px] sm:text-[10px] font-black truncate w-full text-center">{tabNames[lang].vitals}</span>
        </button>

        <button
          onClick={() => setActiveTab("doctors")}
          className={`flex flex-col items-center gap-0.5 transition-all flex-1 min-w-0 ${activeTab === "doctors" ? "text-rose-500 scale-105" : "text-slate-400 hover:text-slate-600"}`}
        >
          <User className="h-4.5 w-4.5" />
          <span className="text-[8px] sm:text-[10px] font-black truncate w-full text-center">{tabNames[lang].doctors}</span>
        </button>

        <button
          onClick={() => setActiveTab("caretakers")}
          className={`flex flex-col items-center gap-0.5 transition-all flex-1 min-w-0 ${activeTab === "caretakers" ? "text-rose-500 scale-105" : "text-slate-400 hover:text-slate-600"}`}
        >
          <Award className="h-4.5 w-4.5" />
          <span className="text-[8px] sm:text-[10px] font-black truncate w-full text-center">{tabNames[lang].family}</span>
        </button>

        <button
          onClick={() => setActiveTab("schemes")}
          className={`flex flex-col items-center gap-0.5 transition-all flex-1 min-w-0 ${activeTab === "schemes" ? "text-rose-500 scale-105" : "text-slate-400 hover:text-slate-600"}`}
        >
          <BookOpen className="h-4.5 w-4.5" />
          <span className="text-[8px] sm:text-[10px] font-black truncate w-full text-center">{tabNames[lang].schemes}</span>
        </button>

        <button
          onClick={() => setActiveTab("hospitals")}
          className={`flex flex-col items-center gap-0.5 transition-all flex-1 min-w-0 ${activeTab === "hospitals" ? "text-rose-500 scale-105" : "text-slate-400 hover:text-slate-600"}`}
        >
          <HospitalIcon className="h-4.5 w-4.5" />
          <span className="text-[8px] sm:text-[10px] font-black truncate w-full text-center">{tabNames[lang].hospitals}</span>
        </button>

        <button
          onClick={() => setActiveTab("blood")}
          className={`flex flex-col items-center gap-0.5 transition-all flex-1 min-w-0 ${activeTab === "blood" ? "text-rose-500 scale-105" : "text-slate-400 hover:text-slate-600"}`}
        >
          <Droplet className="h-4.5 w-4.5" />
          <span className="text-[8px] sm:text-[10px] font-black truncate w-full text-center">{tabNames[lang].blood}</span>
        </button>

        <button
          onClick={() => setActiveTab("ai")}
          className={`flex flex-col items-center gap-0.5 transition-all flex-1 min-w-0 ${activeTab === "ai" ? "text-rose-500 scale-105" : "text-slate-400 hover:text-slate-600"}`}
        >
          <MessageSquare className="h-4.5 w-4.5" />
          <span className="text-[8px] sm:text-[10px] font-black truncate w-full text-center">{tabNames[lang].ai}</span>
        </button>
      </nav>

      {/* Floating Real-Time Notification Toasts */}
      <div id="toasts-container" className="fixed bottom-24 right-6 z-50 flex flex-col gap-3 max-w-sm w-full">
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

      </div> {/* Closing Main Workspace Frame */}
    </div>
  );
}
