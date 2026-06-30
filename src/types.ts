export type UserRole = "patient" | "caretaker" | "doctor" | "admin";

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
  phoneNumber?: string;
  // Patient fields
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelationship?: string;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  medicalHistory?: string;
  state?: string;
  // Doctor fields
  specialization?: string;
  qualification?: string;
  experience?: number;
  hospital_id?: string;
  hospitalName?: string;
  consultationFee?: number;
  languages?: string[];
  availableDays?: string[];
  availableTime?: string;
  rating?: number;
  bio?: string;
  createdAt: string;
}

export interface PatientCaretaker {
  id: string; // patientId_caretakerId or random
  patient_id: string;
  patient_name: string;
  patient_email: string;
  caretaker_id: string;
  caretaker_name: string;
  caretaker_email: string;
  relationship: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}

export interface PatientDoctor {
  id: string; // patientId_doctorId or random
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  status: "pending" | "active" | "inactive";
  assigned_date: string;
}

export interface VitalReading {
  heartRate: number;
  systolic: number; // Blood pressure systolic
  diastolic: number; // Blood pressure diastolic
  oxygenLevel: number; // SpO2 percentage
  temperature: number; // in Celsius or Fahrenheit
  loggedBy?: "patient" | "caretaker";
}

export interface VitalsRecord {
  id?: string;
  patient_id: string;
  timestamp: string;
  readings: VitalReading;
  risk_level: "low" | "medium" | "high";
}

export interface Appointment {
  id?: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  doctor_specialization?: string;
  datetime: string;
  status: "pending" | "accepted" | "rejected" | "completed";
  notes: string;
}

export interface HealthAlert {
  id?: string;
  patient_id: string;
  patient_name: string;
  type: "heart_rate" | "blood_pressure" | "oxygen" | "temperature" | "emergency_trigger";
  severity: "low" | "medium" | "critical";
  message: string;
  timestamp: string;
  resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
}

export interface Hospital {
  id?: string;
  name: string;
  location: string;
  specializations: string[];
  contact: string;
  lat?: number;
  lng?: number;
}

export interface GovernmentScheme {
  id?: string;
  name: string;
  description: string;
  benefits: string;
  official_link: string;
  min_age: number | null;
  max_age: number | null;
  income_limit: number | null; // annual, in INR, null if not income-based
  applicable_states: string[]; // e.g. ["Andhra Pradesh", "Telangana"] or ["all"]
  gender: "male" | "female" | "any";
  category: "senior_citizen" | "maternity" | "disability" | "general" | "BPL";
  eligibility_summary: string;
}

export interface BloodDonation {
  id?: string;
  type: "donor" | "request";
  name: string;
  bloodGroup: string;
  units: number;
  location: string;
  contact: string;
  status: "active" | "fulfilled";
  timestamp: string;
}
