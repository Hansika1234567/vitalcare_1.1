import React, { useState, useEffect } from "react";
import { 
  db, 
  collection, 
  getDocs, 
  query, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  updateDoc 
} from "../firebase";
import { UserProfile, Appointment, HealthAlert, PatientDoctor, PatientCaretaker } from "../types";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Cell,
  PieChart,
  Pie
} from "recharts";
import { Shield, Users, Activity, Calendar, AlertTriangle, Cpu, LogOut, Trash2 } from "lucide-react";

interface AdminDashboardProps {
  profile: UserProfile;
  onLogout: () => void;
}

export default function AdminDashboard({ profile, onLogout }: AdminDashboardProps) {
  // Collection Lists
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [doctorsRelations, setDoctorsRelations] = useState<PatientDoctor[]>([]);
  const [caretakersRelations, setCaretakersRelations] = useState<PatientCaretaker[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real-time listener for users
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map(d => d.data() as UserProfile));
    }, (err) => {
      console.warn("Users subscription failed:", err);
    });

    // Real-time listener for appointments
    const unsubAppts = onSnapshot(collection(db, "appointments"), (snap) => {
      setAppointments(snap.docs.map(d => d.data() as Appointment));
    }, (err) => {
      console.warn("Appointments subscription failed:", err);
    });

    // Real-time listener for alerts
    const unsubAlerts = onSnapshot(collection(db, "alerts"), (snap) => {
      setAlerts(snap.docs.map(d => d.data() as HealthAlert));
    }, (err) => {
      console.warn("Alerts subscription failed:", err);
    });

    // Listen to relations
    const unsubDocRels = onSnapshot(collection(db, "patient_doctor"), (snap) => {
      setDoctorsRelations(snap.docs.map(d => d.data() as PatientDoctor));
    }, (err) => {
      console.warn("Patient-Doctor relations subscription failed:", err);
    });

    const unsubCarRels = onSnapshot(collection(db, "patient_caretaker"), (snap) => {
      setCaretakersRelations(snap.docs.map(d => d.data() as PatientCaretaker));
    }, (err) => {
      console.warn("Patient-Caretaker relations subscription failed:", err);
    });

    setLoading(false);

    return () => {
      unsubUsers();
      unsubAppts();
      unsubAlerts();
      unsubDocRels();
      unsubCarRels();
    };
  }, []);

  // Delete User Action
  const handleDeleteUser = async (uid: string) => {
    if (uid === profile.uid) {
      alert("❌ You cannot delete your own admin profile!");
      return;
    }
    if (confirm("⚠️ Are you sure you want to delete this user profile? This cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "users", uid));
        alert("✅ User profile deleted successfully.");
      } catch (err) {
        console.error(err);
        alert("❌ Firestore rules or network issue prevented deletion.");
      }
    }
  };

  // Roles calculation
  const totalUsers = users.length;
  const patientsCount = users.filter(u => u.role === "patient").length;
  const caretakersCount = users.filter(u => u.role === "caretaker").length;
  const doctorsCount = users.filter(u => u.role === "doctor").length;
  const adminsCount = users.filter(u => u.role === "admin").length;

  // Appointment states
  const pendingAppts = appointments.filter(a => a.status === "pending").length;
  const acceptedAppts = appointments.filter(a => a.status === "accepted" || a.status === "completed").length;
  const rejectedAppts = appointments.filter(a => a.status === "rejected").length;

  // Alert states
  const activeAlarmsCount = alerts.filter(a => !a.resolved).length;
  const resolvedAlarmsCount = alerts.filter(a => a.resolved).length;
  const criticalAlarmsCount = alerts.filter(a => a.severity === "critical" && !a.resolved).length;

  // Chart data formatting
  const roleChartData = [
    { name: "Patients", value: patientsCount, color: "#EC4899" },
    { name: "Caretakers", value: caretakersCount, color: "#10B981" },
    { name: "Doctors", value: doctorsCount, color: "#3B82F6" },
    { name: "Admins", value: adminsCount, color: "#F59E0B" }
  ];

  const appointmentChartData = [
    { name: "Pending", count: pendingAppts, color: "#F59E0B" },
    { name: "Approved", count: acceptedAppts, color: "#10B981" },
    { name: "Declined", count: rejectedAppts, color: "#EF4444" }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-12">
      {/* Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-10 px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <div className="bg-rose-500 text-white p-2 rounded-xl">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">VitalCare</h1>
            <p className="text-xs text-rose-400 font-bold">System Administrator Center</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs bg-slate-800 text-rose-400 font-black px-3 py-1 rounded-full border border-slate-700">Root Access</span>
          <button
            onClick={onLogout}
            className="p-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-rose-600 hover:text-white transition-colors"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-6xl mx-auto w-full space-y-6">

        {/* System Health and General Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-500 rounded-2xl">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <span className="block text-[10px] font-black text-slate-400 uppercase">Registered Users</span>
              <span className="text-2xl font-black text-slate-900">{totalUsers}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <span className="block text-[10px] font-black text-slate-400 uppercase">Consults Booked</span>
              <span className="text-2xl font-black text-slate-900">{appointments.length}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl animate-pulse">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <span className="block text-[10px] font-black text-slate-400 uppercase">Active Alarms</span>
              <span className="text-2xl font-black text-rose-600">{activeAlarmsCount}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-sky-50 text-sky-500 rounded-2xl">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <span className="block text-[10px] font-black text-slate-400 uppercase">System Telemetry</span>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-md uppercase">Healthy</span>
            </div>
          </div>
        </div>

        {/* Grid of charts and metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* User Role Analytics (PieChart) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md">
            <h3 className="text-sm font-black text-slate-950 mb-4 uppercase">User Analytics & Roles</h3>
            <div className="h-56 flex flex-col sm:flex-row items-center justify-around gap-4">
              <div className="w-full h-44 sm:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roleChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {roleChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 text-xs font-semibold text-slate-600 w-full sm:w-1/2">
                {roleChartData.map((rc, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b pb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: rc.color }}></span>
                      {rc.name}
                    </span>
                    <strong className="text-slate-900">{rc.value} ({totalUsers ? Math.round((rc.value/totalUsers)*100) : 0}%)</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Appointment and Alarm analytics (BarChart) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md">
            <h3 className="text-sm font-black text-slate-950 mb-4 uppercase">Appointment Status Analytics</h3>
            <div className="h-56 flex flex-col sm:flex-row items-center justify-around gap-4">
              <div className="w-full h-44 sm:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={appointmentChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {appointmentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 text-xs font-semibold text-slate-600 w-full sm:w-1/2">
                <div className="flex items-center justify-between border-b pb-1">
                  <span>🚨 Critical Active Alarms</span>
                  <strong className="text-rose-600">{criticalAlarmsCount}</strong>
                </div>
                <div className="flex items-center justify-between border-b pb-1">
                  <span>✅ Resolved Alarms</span>
                  <strong className="text-emerald-600">{resolvedAlarmsCount}</strong>
                </div>
                <div className="flex items-center justify-between border-b pb-1">
                  <span>🤝 Caretaker Relations</span>
                  <strong className="text-slate-900">{caretakersRelations.length}</strong>
                </div>
                <div className="flex items-center justify-between border-b pb-1">
                  <span>👨‍⚕️ Patient-Doctor Links</span>
                  <strong className="text-slate-900">{doctorsRelations.length}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Account Registry Database Table */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-black text-slate-900 uppercase">User Profile Account Registry</h3>
            <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-bold">Total: {totalUsers}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold text-left uppercase text-[10px] tracking-wider">
                  <th className="px-4 py-3">Full Name</th>
                  <th className="px-4 py-3">Email Address</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Created At</th>
                  <th className="px-4 py-3 text-right">Admin actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {users.map((usr) => (
                  <tr key={usr.uid} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-950 font-black">{usr.fullName}</td>
                    <td className="px-4 py-3">{usr.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full uppercase text-[9px] font-black border ${
                        usr.role === "patient" 
                          ? "bg-pink-100 border-pink-300 text-pink-800" 
                          : usr.role === "caretaker" 
                            ? "bg-emerald-100 border-emerald-300 text-emerald-800" 
                            : usr.role === "doctor" 
                              ? "bg-blue-100 border-blue-300 text-blue-800" 
                              : "bg-amber-100 border-amber-300 text-amber-800"
                      }`}>
                        {usr.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">{usr.phoneNumber || "N/A"}</td>
                    <td className="px-4 py-3">{usr.createdAt ? new Date(usr.createdAt).toLocaleDateString() : "N/A"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteUser(usr.uid)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors inline-block"
                        title="Delete User"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
