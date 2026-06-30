import React, { useState, useEffect } from "react";
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
  OperationType
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
  Hospital as HospitalIcon
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

  // Blood fields
  const [bloodType, setBloodType] = useState<"donor" | "request">("request");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [bloodUnits, setBloodUnits] = useState(1);
  const [bloodLocation, setBloodLocation] = useState("");
  const [bloodContact, setBloodContact] = useState("");
  const [bloodLoading, setBloodLoading] = useState(false);

  // AI assistant chat state
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: "Hello! I am your VitalCare AI companion. How can I help you today? Ask me any questions about healthy eating, drinking water, or exercising." }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

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
    };
  }, [profile.uid]);

  // Load static resources
  const loadDoctors = async () => {
    try {
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
      console.error("AI Insights Error", e);
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
        await addDoc(collection(db, "alerts"), {
          patient_id: profile.uid,
          patient_name: profile.fullName,
          type: oxygenLevel < 92 ? "oxygen" : systolic > 135 ? "blood_pressure" : "heart_rate",
          severity: "medium",
          message,
          timestamp: new Date().toISOString(),
          resolved: false
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

  // Ask Gemini Assistant Chat
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);

    try {
      // Proxy chat request to Express API
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: [...chatMessages, { role: "user", content: userMsg }] 
        })
      });

      const data = await res.json();
      setChatMessages(prev => [...prev, { role: "assistant", content: data.text }]);
    } catch (err) {
      console.error(err);
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

    // Sort by distance ascending
    const sorted = [...filtered].sort((a, b) => a.distance - b.distance);

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-24">
      {/* Top Banner */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-rose-500 text-white p-2 rounded-xl">
            <Heart className="h-6 w-6 fill-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">VitalCare</h1>
            <p className="text-xs text-rose-600 font-bold">{t.patientDashboard}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Language Selector */}
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
            title={t.logout}
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Dashboard Panel */}
      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-6">

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
                <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1">
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
        )}

        {/* TAB 2: DOCTORS & APPOINTMENTS */}
        {activeTab === "doctors" && (
          <div className="space-y-6">
            {/* Book Appointment Section */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-md">
              <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
                📅 {t.bookAppointment}
              </h3>

              <form onSubmit={handleBookAppointment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Doctor</label>
                  <select
                    required
                    value={selectedDoctorId}
                    onChange={(e) => {
                      setSelectedDoctorId(e.target.value);
                      const selected = allDoctorsList.find(d => d.uid === e.target.value);
                      setSelectedDoctorName(selected ? selected.fullName : "");
                    }}
                    className="block w-full border border-slate-300 rounded-2xl py-2.5 px-3 text-sm text-slate-900"
                  >
                    <option value="">-- Choose Doctor --</option>
                    {allDoctorsList.map((d) => (
                      <option key={d.uid} value={d.uid}>
                        👨‍⚕️ {d.fullName} ({d.specialization || "General Physician"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date and Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="block w-full border border-slate-300 rounded-2xl py-2.5 px-3 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Simple Notes for Doctor</label>
                  <textarea
                    rows={2}
                    value={appointmentNotes}
                    onChange={(e) => setAppointmentNotes(e.target.value)}
                    placeholder="Briefly say what is bothering you..."
                    className="block w-full border border-slate-300 rounded-2xl py-2 px-3 text-sm text-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="w-full bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-black py-3 rounded-2xl text-sm transition-all"
                >
                  {bookingLoading ? "Submitting request..." : "Book Now"}
                </button>

                {bookingStatus && (
                  <div className="p-3 text-xs font-black text-center rounded-xl bg-slate-100 text-slate-800 border">
                    {bookingStatus}
                  </div>
                )}
              </form>
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
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-md flex flex-col h-[450px]">
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
                      {msg.content}
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

              {/* Chat Input */}
              <form onSubmit={handleSendChatMessage} className="flex gap-2 pt-3 border-t">
                <input
                  type="text"
                  required
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a general health question..."
                  className="flex-1 border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-900"
                />
                <button
                  type="submit"
                  disabled={chatLoading}
                  className="bg-rose-500 text-white p-3 rounded-2xl active:scale-95 transition-all shadow-md hover:bg-rose-600 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
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
              <div className="space-y-3">
                {sortedAndFilteredHospitals.length === 0 ? (
                  <div className="p-6 border border-dashed rounded-2xl bg-slate-50 text-center text-xs font-bold text-slate-400">
                    No hospitals found matching "{selectedSpecialization}"
                  </div>
                ) : (
                  sortedAndFilteredHospitals.map((h, idx) => {
                    const isHighlighted = hoveredHospitalId === h.id || hoveredHospitalId === `index-${idx}`;
                    return (
                      <div
                        key={idx}
                        className={`p-4 border rounded-2xl transition-all flex justify-between items-start text-xs ${
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
                  })
                )}
              </div>
            </div>
          )}
      </main>

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

              <button
                onClick={handleLogVitals}
                className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black py-3 rounded-2xl text-sm transition-all shadow-md mt-4"
              >
                💾 Save Vitals Info
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details/Learn More Modal */}
      {detailModalContent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
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

      {/* Bottom Navigation Rail (Icon + Label) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-2.5 px-1.5 sm:px-3 flex justify-around items-center z-40 shadow-xl max-w-lg mx-auto rounded-t-3xl">
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
    </div>
  );
}
