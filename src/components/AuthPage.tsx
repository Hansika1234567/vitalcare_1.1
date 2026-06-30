import React, { useState } from "react";
import { 
  auth, 
  db, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  doc, 
  setDoc,
  getDoc
} from "../firebase";
import { UserRole, UserProfile } from "../types";
import { Heart, Activity, Shield, User, Award, Phone, Mail, Lock, Plus, HeartCrack, ChevronRight } from "lucide-react";

interface AuthPageProps {
  onAuthSuccess: (user: UserProfile) => void;
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<UserRole>("patient");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Common Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Patient Fields
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelationship, setEmergencyRelationship] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [state, setState] = useState("");

  // Doctor Fields
  const [specialization, setSpecialization] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        // Validation Checks matching rules exactly
        if (!email.trim() || !password.trim() || !fullName.trim()) {
          throw new Error("Full Name, Email and Password are required for all users.");
        }

        if (role !== "admin" && !phoneNumber.trim()) {
          throw new Error("Phone Number is required.");
        }

        if (role === "patient") {
          if (!emergencyName.trim() || !emergencyPhone.trim() || !emergencyRelationship.trim()) {
            throw new Error("Patient registration requires all emergency contact details (Name, Phone, and Relationship).");
          }
        }

        if (role === "doctor") {
          if (!specialization.trim()) {
            throw new Error("Doctor registration requires a Specialization.");
          }
        }

        // Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Construct profile
        const profileData: UserProfile = {
          uid: user.uid,
          fullName: fullName.trim(),
          email: email.trim(),
          role,
          createdAt: new Date().toISOString()
        };

        if (role !== "admin") {
          profileData.phoneNumber = phoneNumber.trim();
        }

        if (role === "patient") {
          profileData.emergencyName = emergencyName.trim();
          profileData.emergencyPhone = emergencyPhone.trim();
          profileData.emergencyRelationship = emergencyRelationship.trim();
          if (age) profileData.age = parseInt(age);
          if (gender) profileData.gender = gender;
          if (bloodGroup) profileData.bloodGroup = bloodGroup;
          if (medicalHistory) profileData.medicalHistory = medicalHistory.trim();
          if (state) profileData.state = state;
        }

        if (role === "doctor") {
          profileData.specialization = specialization.trim();
        }

        // Store in Firestore
        await setDoc(doc(db, "users", user.uid), profileData);
        onAuthSuccess(profileData);
      } else {
        // Sign In Flow
        if (!email.trim() || !password.trim()) {
          throw new Error("Email and Password are required.");
        }
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Fetch user document
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          onAuthSuccess(userDoc.data() as UserProfile);
        } else {
          // Auto-create a fallback profile if it is missing
          const fallbackProfile: UserProfile = {
            uid: user.uid,
            fullName: user.displayName || email.split("@")[0],
            email: email,
            role: "patient",
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, "users", user.uid), fallbackProfile);
          onAuthSuccess(fallbackProfile);
        }
      }
    } catch (err: any) {
      console.error(err);
      let friendlyMessage = err.message;
      if (err.code === "auth/email-already-in-use") {
        friendlyMessage = "This email is already registered. Please sign in instead.";
      } else if (err.code === "auth/weak-password") {
        friendlyMessage = "Password should be at least 6 characters long.";
      } else if (err.code === "auth/invalid-email") {
        friendlyMessage = "Please enter a valid email address.";
      } else if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        friendlyMessage = "Incorrect email or password. Please try again.";
      } else if (err.code === "auth/operation-not-allowed" || err.message?.includes("operation-not-allowed")) {
        friendlyMessage = "Firebase Authentication error: Email/Password sign-in provider is disabled in your Firebase console. Please go to the Firebase Console -> Authentication -> Sign-in method, and enable 'Email/Password' to register or sign in.";
      }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center p-3 bg-rose-500 rounded-2xl shadow-lg text-white mb-4 animate-bounce">
          <Heart className="h-10 w-10 fill-white" />
        </div>
        <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 font-sans">
          VitalCare
        </h2>
        <p className="mt-2 text-sm text-slate-600 font-medium">
          {isSignUp 
            ? "Create your secure healthcare profile" 
            : "Sign in to access your dashboard"}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-4 shadow-xl rounded-2xl sm:px-10 border border-slate-100">
          
          {/* Toggle Tab */}
          <div className="flex bg-slate-100 p-1.5 rounded-xl mb-6">
            <button
              onClick={() => { setIsSignUp(false); setError(""); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${!isSignUp ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsSignUp(true); setError(""); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${isSignUp ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-sm rounded-r-lg font-medium flex items-center">
              <span className="mr-2">⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            {isSignUp && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Select Your Account Role
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["patient", "caretaker", "doctor", "admin"] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`py-3 px-2 border text-xs font-bold rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all duration-200 ${
                        role === r 
                          ? "border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-500/20" 
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {r === "patient" && <User className="h-5 w-5" />}
                      {r === "caretaker" && <Activity className="h-5 w-5" />}
                      {r === "doctor" && <Award className="h-5 w-5" />}
                      {r === "admin" && <Shield className="h-5 w-5" />}
                      <span className="capitalize">{r}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* General Fields */}
            {isSignUp && (
              <div>
                <label htmlFor="fullName" className="block text-sm font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="pl-10 block w-full border border-slate-300 rounded-xl py-2.5 px-3 shadow-sm focus:ring-rose-500 focus:border-rose-500 text-slate-900"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="pl-10 block w-full border border-slate-300 rounded-xl py-2.5 px-3 shadow-sm focus:ring-rose-500 focus:border-rose-500 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1">
                Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 block w-full border border-slate-300 rounded-xl py-2.5 px-3 shadow-sm focus:ring-rose-500 focus:border-rose-500 text-slate-900"
                />
              </div>
            </div>

            {isSignUp && role !== "admin" && (
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-1">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter phone number"
                    className="pl-10 block w-full border border-slate-300 rounded-xl py-2.5 px-3 shadow-sm focus:ring-rose-500 focus:border-rose-500 text-slate-900"
                  />
                </div>
              </div>
            )}

            {/* Role-Specific Fields (SignUp only) */}
            {isSignUp && role === "doctor" && (
              <div>
                <label htmlFor="spec" className="block text-sm font-semibold text-slate-700 mb-1">
                  Specialization <span className="text-rose-500">*</span>
                </label>
                <input
                  id="spec"
                  type="text"
                  required
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g. Cardiologist, General Physician"
                  className="block w-full border border-slate-300 rounded-xl py-2.5 px-3 shadow-sm focus:ring-rose-500 focus:border-rose-500 text-slate-900"
                />
              </div>
            )}

            {/* Patient Fields */}
            {isSignUp && role === "patient" && (
              <div className="space-y-4 border-t border-slate-100 pt-4 mt-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1 text-rose-600">
                  <HeartCrack className="h-4 w-4" /> Emergency Contact Details (Required)
                </h3>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="emergName" className="block text-xs font-semibold text-slate-600 mb-1">
                      Contact Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="emergName"
                      type="text"
                      required
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="Emergency contact name"
                      className="block w-full border border-slate-300 rounded-xl py-2 px-3 text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="emergPhone" className="block text-xs font-semibold text-slate-600 mb-1">
                      Contact Phone <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="emergPhone"
                      type="tel"
                      required
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="Emergency phone number"
                      className="block w-full border border-slate-300 rounded-xl py-2 px-3 text-sm text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="emergRel" className="block text-xs font-semibold text-slate-600 mb-1">
                    Relationship to Emergency Contact <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="emergRel"
                    type="text"
                    required
                    value={emergencyRelationship}
                    onChange={(e) => setEmergencyRelationship(e.target.value)}
                    placeholder="e.g. Spouse, Son, Daughter, Friend"
                    className="block w-full border border-slate-300 rounded-xl py-2 px-3 text-sm text-slate-900"
                  />
                </div>

                <h3 className="text-sm font-bold text-slate-900 border-t border-slate-100 pt-4">
                  Optional Health Details
                </h3>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="age" className="block text-xs font-semibold text-slate-600 mb-1">
                      Age
                    </label>
                    <input
                      id="age"
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="Age"
                      className="block w-full border border-slate-300 rounded-xl py-2 px-3 text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="gender" className="block text-xs font-semibold text-slate-600 mb-1">
                      Gender
                    </label>
                    <select
                      id="gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="block w-full border border-slate-300 rounded-xl py-2 px-3 text-sm text-slate-900"
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="bloodGroup" className="block text-xs font-semibold text-slate-600 mb-1">
                      Blood Group
                    </label>
                    <input
                      id="bloodGroup"
                      type="text"
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      placeholder="e.g. O+, A-"
                      className="block w-full border border-slate-300 rounded-xl py-2 px-3 text-sm text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="state" className="block text-xs font-semibold text-slate-600 mb-1">
                    State / Union Territory
                  </label>
                  <select
                    id="state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="block w-full border border-slate-300 rounded-xl py-2 px-3 text-sm text-slate-900"
                  >
                    <option value="">Select State</option>
                    <option value="Andhra Pradesh">Andhra Pradesh</option>
                    <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                    <option value="Assam">Assam</option>
                    <option value="Bihar">Bihar</option>
                    <option value="Chhattisgarh">Chhattisgarh</option>
                    <option value="Goa">Goa</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Haryana">Haryana</option>
                    <option value="Himachal Pradesh">Himachal Pradesh</option>
                    <option value="Jharkhand">Jharkhand</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Kerala">Kerala</option>
                    <option value="Madhya Pradesh">Madhya Pradesh</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Manipur">Manipur</option>
                    <option value="Meghalaya">Meghalaya</option>
                    <option value="Mizoram">Mizoram</option>
                    <option value="Nagaland">Nagaland</option>
                    <option value="Odisha">Odisha</option>
                    <option value="Punjab">Punjab</option>
                    <option value="Rajasthan">Rajasthan</option>
                    <option value="Sikkim">Sikkim</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Telangana">Telangana</option>
                    <option value="Tripura">Tripura</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="Uttarakhand">Uttarakhand</option>
                    <option value="West Bengal">West Bengal</option>
                    <option value="Andaman and Nicobar Islands">Andaman and Nicobar Islands</option>
                    <option value="Chandigarh">Chandigarh</option>
                    <option value="Dadra and Nagar Haveli and Daman and Diu">Dadra and Nagar Haveli and Daman and Diu</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Jammu and Kashmir">Jammu and Kashmir</option>
                    <option value="Ladakh">Ladakh</option>
                    <option value="Lakshadweep">Lakshadweep</option>
                    <option value="Puducherry">Puducherry</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="history" className="block text-xs font-semibold text-slate-600 mb-1">
                    Medical History
                  </label>
                  <textarea
                    id="history"
                    rows={2}
                    value={medicalHistory}
                    onChange={(e) => setMedicalHistory(e.target.value)}
                    placeholder="Past surgeries, allergies, chronic conditions..."
                    className="block w-full border border-slate-300 rounded-xl py-2 px-3 text-sm text-slate-900"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                  Processing...
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  {isSignUp ? "Create Account" : "Sign In to Dashboard"} <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
