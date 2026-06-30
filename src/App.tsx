/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { auth, db, doc, getDoc, onAuthStateChanged, setDoc } from "./firebase";
import { UserProfile } from "./types";
import AuthPage from "./components/AuthPage";
import PatientDashboard from "./components/PatientDashboard";
import CaretakerDashboard from "./components/CaretakerDashboard";
import DoctorDashboard from "./components/DoctorDashboard";
import AdminDashboard from "./components/AdminDashboard";
import { Heart } from "lucide-react";

export default function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const fetchProfile = async (user: any) => {
    try {
      setConnectionError(null);
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      } else {
        console.error("No profile document found for user uid, self-healing:", user.uid);
        const fallbackProfile: UserProfile = {
          uid: user.uid,
          fullName: user.displayName || user.email?.split("@")[0] || "User",
          email: user.email || "",
          role: "patient",
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, "users", user.uid), fallbackProfile);
        setUserProfile(fallbackProfile);
      }
    } catch (err: any) {
      console.error("Error fetching user profile:", err);
      // Friendly, descriptive error including tips
      const errMsg = err?.message || String(err);
      if (errMsg.includes("offline") || errMsg.includes("network")) {
        setConnectionError("Firestore connection could not be established because the client is offline or network is restricted. Please check your internet connection.");
      } else {
        setConnectionError(errMsg);
      }
      setUserProfile(null);
    }
  };

  useEffect(() => {
    // Listen to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchProfile(user);
      } else {
        setUserProfile(null);
        setConnectionError(null);
      }
      setAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAuthSuccess = (profile: UserProfile) => {
    setUserProfile(profile);
    setConnectionError(null);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setUserProfile(null);
      setConnectionError(null);
    } catch (err) {
      console.error("Logout Error:", err);
    }
  };

  const handleRetry = async () => {
    if (!currentUser) return;
    setRetrying(true);
    await fetchProfile(currentUser);
    setRetrying(false);
  };

  // 1. Loading State
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-rose-500 rounded-3xl text-white shadow-xl animate-bounce">
            <Heart className="h-10 w-10 fill-white" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">VitalCare</h2>
          <div className="flex items-center justify-center gap-2 text-slate-500 font-semibold text-sm">
            <span className="animate-spin rounded-full h-4 w-4 border-2 border-slate-600 border-t-transparent"></span>
            Loading secure connection...
          </div>
        </div>
      </div>
    );
  }

  // 2. Offline / Connection Error boundary
  if (connectionError && currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 text-center">
        <div className="max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-xl space-y-5">
          <div className="inline-flex items-center justify-center p-4 bg-amber-100 rounded-2xl text-amber-600">
            <Heart className="h-10 w-10 text-amber-500 fill-none" />
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Connection Issue</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {connectionError}
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 px-6 rounded-2xl text-xs active:scale-95 transition-all disabled:opacity-50"
            >
              {retrying ? "Connecting..." : "Retry Connection"}
            </button>
            <button
              onClick={handleLogout}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 px-6 rounded-2xl text-xs active:scale-95 transition-all"
            >
              Sign Out & Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Auth Login/Registration state
  if (!userProfile) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  // 3. Render Dashboard matching user's exact role
  switch (userProfile.role) {
    case "patient":
      return <PatientDashboard profile={userProfile} onLogout={handleLogout} />;
    case "caretaker":
      return <CaretakerDashboard profile={userProfile} onLogout={handleLogout} />;
    case "doctor":
      return <DoctorDashboard profile={userProfile} onLogout={handleLogout} />;
    case "admin":
      return <AdminDashboard profile={userProfile} onLogout={handleLogout} />;
    default:
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 text-center">
          <h2 className="text-lg font-black text-slate-900">Invalid Account Role</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            We couldn't resolve a valid role for your account. Please log out and sign in with a registered profile.
          </p>
          <button
            onClick={handleLogout}
            className="mt-4 bg-rose-500 text-white font-bold py-2.5 px-6 rounded-2xl text-xs active:scale-95 transition-all"
          >
            Sign Out
          </button>
        </div>
      );
  }
}

