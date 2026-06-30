import { db, collection, doc, setDoc, handleFirestoreError, OperationType } from "../firebase";
import { Agent, AgentEvent, AgentManagerInterface } from "./types";

export class HealthMonitoringAgent implements Agent {
  public name = "Health Monitoring Agent";
  public supportedEvents = ["VITALS_UPDATED" as const];

  private evaluateRisk(hr: number, sys: number, o2: number, temp: number): "low" | "medium" | "high" {
    if (o2 < 90 || hr < 45 || hr > 130 || sys > 160 || sys < 80 || temp > 39.5) return "high";
    if (o2 < 95 || hr < 55 || hr > 105 || sys > 135 || sys < 90 || temp > 38.0) return "medium";
    return "low";
  }

  private getFallbackInsight(readings: { hr: number; bp: string; oxygen: number; temp: number }, risk: string, lang: string = "en"): string {
    const { hr, bp, oxygen, temp } = readings;
    const isHi = lang === "hi";
    const isTe = lang === "te";

    if (oxygen < 92) {
      if (isHi) return `ऑक्सीजन का स्तर (${oxygen}%) थोड़ा कम है। कृपया आराम से बैठें, गहरी सांसें लें और खुली हवा में रहें।`;
      if (isTe) return `ఆక్సిజన్ స్థాయి (${oxygen}%) తక్కువగా ఉంది. దయచేసి నిటారుగా కూర్చుని, లోతైన శ్వాస తీసుకోండి.`;
      return `Your oxygen level is slightly low (${oxygen}%). Please sit upright in a well-ventilated space, take deep breaths, and rest.`;
    }
    if (hr > 110) {
      if (isHi) return `आपकी हृदय गति (${hr} bpm) तेज है। कृपया शांत होकर बैठें, पानी पिएं और विश्राम करें।`;
      if (isTe) return `మీ గుండె వేగం (${hr} bpm) ఎక్కువగా ఉంది. దయచేసి ప్రశాంతంగా కూర్చోండి, నీరు త్రాగండి.`;
      return `Your heart rate is elevated (${hr} bpm). Please sit quietly, drink some water, and rest.`;
    }
    if (risk === "high") {
      if (isHi) return `आपके स्वास्थ्य संकेत सामान्य सीमा से बाहर हैं। कृपया आराम करें और अपने चिकित्सक से तुरंत संपर्क करें।`;
      if (isTe) return `మీ ఆరోగ్య సంకేతాలు ప్రమాదకరంగా ఉన్నాయి. దయచేసి విశ్రాంతి తీసుకోండి మరియు మీ వైద్యుడిని సంప్రదించండి.`;
      return `Your vitals are outside safe ranges. Please rest immediately and contact your doctor for advice.`;
    }

    if (isHi) return "आपके स्वास्थ्य संकेत सामान्य हैं! प्रतिदिन जाँच करें और समय पर अपनी दवाइयाँ लें।";
    if (isTe) return "మీ ఆరోగ్య సంకేతాలు నిలకడగా ఉన్నాయి! ప్రతిరోజూ పర్యవేక్షించండి మరియు మందులు తీసుకోండి.";
    return "Your vitals look steady! Keep monitoring them daily and make sure to take any prescribed medicines on time.";
  }

  public async handleEvent(event: AgentEvent, orchestrator: AgentManagerInterface): Promise<void> {
    const { heartRate, systolic, diastolic, oxygenLevel, temperature, patientName, language } = event.data;
    const patientId = event.patientId;

    const risk = this.evaluateRisk(heartRate, systolic, oxygenLevel, temperature);
    
    // 1. Emit RISK_LEVEL_CRITICAL if risk is high
    if (risk === "high") {
      console.log(`[HealthMonitoringAgent] Detected high risk vitals for patient ${patientId}. Dispatching RISK_LEVEL_CRITICAL.`);
      await orchestrator.dispatchEvent({
        type: "RISK_LEVEL_CRITICAL",
        patientId,
        data: {
          patientName,
          heartRate,
          systolic,
          diastolic,
          oxygenLevel,
          temperature,
          triggerReason: `Critical vitals detected: HR ${heartRate}, BP ${systolic}/${diastolic}, SpO2 ${oxygenLevel}%, Temp ${temperature}°C`
        }
      });
    }

    // 2. Fetch plain-language insights from Gemini with a retry strategy
    const readings = {
      hr: heartRate,
      bp: `${systolic}/${diastolic}`,
      oxygen: oxygenLevel,
      temp: temperature
    };

    let insightText = "";
    let attempts = 2; // Try up to 2 times (initial + 1 retry)
    let lastError: any = null;

    while (attempts > 0) {
      try {
        console.log(`[HealthMonitoringAgent] Requesting Gemini insights... (Attempts remaining: ${attempts})`);
        const res = await fetch("/api/gemini/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vitals: [{
              time: new Date().toISOString(),
              hr: heartRate,
              bp: `${systolic}/${diastolic}`,
              oxygen: oxygenLevel,
              temp: temperature,
              risk
            }],
            language: language || "en"
          })
        });

        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }

        const result = await res.json();
        if (result && result.text) {
          insightText = result.text;
          break; // success!
        } else {
          throw new Error("Invalid or empty response structure from insight service.");
        }
      } catch (err: any) {
        lastError = err;
        attempts--;
        if (attempts > 0) {
          console.warn(`[HealthMonitoringAgent] Insight request failed, retrying once...`, err);
          await new Promise(resolve => setTimeout(resolve, 1000)); // brief wait before retry
        }
      }
    }

    // Fallback if both attempts fail
    if (!insightText) {
      console.warn(`[HealthMonitoringAgent] All Gemini attempts failed. Using cached fallback.`, lastError);
      insightText = this.getFallbackInsight(readings, risk, language);
    }

    // 3. Save the insight permanently in the database so the UI can stream it
    const insightDocRef = doc(db, "ai_insights", patientId);
    try {
      await setDoc(insightDocRef, {
        patient_id: patientId,
        insight: insightText,
        timestamp: new Date().toISOString(),
        vitals_snapshot: readings
      });
      console.log(`[HealthMonitoringAgent] Saved generated health insights to Firestore for patient ${patientId}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `ai_insights/${patientId}`);
    }
  }
}
