import { db, collection, getDocs, query, where, addDoc, doc, updateDoc, handleFirestoreError, OperationType } from "../firebase";
import { Agent, AgentEvent, AgentManagerInterface } from "./types";
import { Hospital } from "../types";

// Helper for calculating haversine distance
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

// Simple generator for nearby local hospitals centered on coordinate (fallback/local list)
const generateLocalHospitals = (lat: number, lng: number, state?: string): Hospital[] => {
  let cityArea = state || "Local Area";
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

export class EmergencyResponseAgent implements Agent {
  public name = "Emergency Response Agent";
  public supportedEvents = ["RISK_LEVEL_CRITICAL" as const, "EMERGENCY_TRIGGERED" as const];

  // Configurable escalation window (in milliseconds)
  // Default to 15 seconds for rapid testing of the escalation loop!
  private escalationWindowMs = 15000;

  constructor(escalationWindowMs?: number) {
    if (escalationWindowMs !== undefined) {
      this.escalationWindowMs = escalationWindowMs;
    }
  }

  public async handleEvent(event: AgentEvent, orchestrator: AgentManagerInterface): Promise<void> {
    const patientId = event.patientId;
    const { patientName, triggerReason, patientCoords, state } = event.data;

    console.log(`[EmergencyResponseAgent] Emergency triggered for ${patientName} (${patientId}). Reason: ${triggerReason}`);

    // 1. Fetch patient's assigned doctor and linked caretakers from Firestore
    let caretakersSnapshot;
    try {
      caretakersSnapshot = await getDocs(
        query(collection(db, "patient_caretaker"), where("patient_id", "==", patientId))
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, "patient_caretaker");
    }

    let doctorsSnapshot;
    try {
      doctorsSnapshot = await getDocs(
        query(collection(db, "patient_doctor"), where("patient_id", "==", patientId))
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, "patient_doctor");
    }

    const caretakers = caretakersSnapshot.docs
      .filter(doc => doc.data().status === "accepted")
      .map(doc => ({
        id: doc.data().caretaker_id,
        name: doc.data().caretaker_name,
        email: doc.data().caretaker_email,
        role: "caretaker"
      }));

    const doctors = doctorsSnapshot.docs.map(doc => ({
      id: doc.data().doctor_id,
      name: doc.data().doctor_name,
      role: "doctor"
    }));

    const notifiedParties = [...caretakers, ...doctors];

    // 2. Query nearby suitable hospitals using the patient's current coords
    const lat = patientCoords?.lat ?? 17.3850;
    const lng = patientCoords?.lng ?? 78.4867;

    // Fetch database hospitals and sort them
    let dbHospitalsSnap;
    try {
      dbHospitalsSnap = await getDocs(collection(db, "hospitals"));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, "hospitals");
    }
    const dbHospitals = dbHospitalsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Hospital[];

    // Calculate distances
    const calculatedDb = dbHospitals.map(h => {
      const distance = h.lat !== undefined && h.lng !== undefined
        ? getHaversineDistance(lat, lng, h.lat, h.lng)
        : Infinity;
      return { ...h, distance };
    });

    const locals = generateLocalHospitals(lat, lng, state);
    const calculatedLocals = locals.map(h => {
      const distance = getHaversineDistance(lat, lng, h.lat!, h.lng!);
      return { ...h, distance };
    });

    // Merge & sort: we filter for hospitals with "Emergency" or "Heart Care" as suitable
    const combinedHospitals = [...calculatedLocals, ...calculatedDb.filter(h => h.distance < 100)];
    const suitableHospitals = combinedHospitals
      .filter(h => h.specializations.includes("Emergency") || h.specializations.includes("Heart Care"))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3); // top 3 closest suitable hospitals

    // 3. Trigger persistent alert in existing notifications system
    const alertMsg = `⚠️ EMERGENCY ALARM triggered for ${patientName}: ${triggerReason}. Immediate action required!`;
    let alertRef;
    try {
      alertRef = await addDoc(collection(db, "alerts"), {
        patient_id: patientId,
        patient_name: patientName,
        type: "emergency_trigger",
        severity: "critical",
        message: alertMsg,
        timestamp: new Date().toISOString(),
        resolved: false
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "alerts");
    }

    // 4. Log the full emergency event to 'emergency_events' collection
    const emergencyEvent = {
      patient_id: patientId,
      patient_name: patientName,
      trigger_reason: triggerReason,
      notified_parties: notifiedParties,
      timestamp: new Date().toISOString(),
      status: "unresolved",
      alert_id: alertRef.id,
      recommended_hospitals: suitableHospitals.map(h => ({
        name: h.name,
        distance: h.distance ? Number(h.distance.toFixed(2)) : null,
        contact: h.contact,
        specializations: h.specializations
      }))
    };

    let emergencyDocRef;
    try {
      emergencyDocRef = await addDoc(collection(db, "emergency_events"), emergencyEvent);
      console.log(`[EmergencyResponseAgent] Logged emergency event ${emergencyDocRef.id} for patient ${patientId}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "emergency_events");
    }

    // 5. If stayed unresolved after escalation window, escalate by re-notifying
    setTimeout(async () => {
      try {
        // Query to check if the emergency alert has been resolved
        let alertCheckSnap;
        try {
          alertCheckSnap = await getDocs(
            query(collection(db, "alerts"), where("patient_id", "==", patientId))
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, "alerts");
        }

        const activeAlerts = alertCheckSnap.docs.filter(doc => doc.data().resolved === false);
        const stillUnresolved = activeAlerts.some(doc => doc.id === alertRef.id);

        if (stillUnresolved) {
          console.log(`[EmergencyResponseAgent] Emergency remains UNRESOLVED after ${this.escalationWindowMs / 1000}s. Escalating...`);
          
          // Escalation alert
          const escalatedMsg = `🚨 ESCALATED CRARM: ${patientName} still needs help! (Triggered ${this.escalationWindowMs / 1000}s ago).`;
          try {
            await addDoc(collection(db, "alerts"), {
              patient_id: patientId,
              patient_name: patientName,
              type: "emergency_trigger",
              severity: "critical",
              message: escalatedMsg,
              timestamp: new Date().toISOString(),
              resolved: false,
              is_escalated: true
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, "alerts");
          }

          // Update the status of the emergency event
          try {
            await updateDoc(doc(db, "emergency_events", emergencyDocRef.id), {
              escalated: true,
              escalated_at: new Date().toISOString(),
              status: "escalated_unresolved"
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `emergency_events/${emergencyDocRef.id}`);
          }

          // Log invocation of the escalation
          await orchestrator.logInvocation({
            timestamp: new Date().toISOString(),
            eventType: "EMERGENCY_TRIGGERED",
            agentName: this.name,
            inputSummary: `Check resolution for event ${emergencyDocRef.id}`,
            outputSummary: `Escalated emergency. Added escalated alert and updated event status to escalated_unresolved.`,
            status: "success"
          });
        } else {
          console.log(`[EmergencyResponseAgent] Emergency event resolved. No escalation needed.`);
        }
      } catch (err) {
        console.error(`[EmergencyResponseAgent] Error during escalation check:`, err);
      }
    }, this.escalationWindowMs);

    // 6. Emit the EMERGENCY_TRIGGERED event for Hospital Recommendations & notifications to process
    if (event.type !== "EMERGENCY_TRIGGERED") {
      await orchestrator.dispatchEvent({
        type: "EMERGENCY_TRIGGERED",
        patientId,
        data: {
          patientName,
          triggerReason,
          recommendedHospitals: suitableHospitals,
          emergencyEventId: emergencyDocRef.id
        }
      });
    }
  }
}
