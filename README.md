# VitalCare — An Accessible AI Healthcare Ecosystem

> Connecting patients, caretakers, doctors, and AI agents to catch health emergencies before they become crises — built for everyone, including those who can't read.

## The Problem

In India, millions of patients managing chronic conditions or recovering from illness rely on family caretakers who aren't medically trained, and on healthcare apps that assume a level of literacy and digital fluency many users simply don't have. Critical warning signs get missed. Government healthcare schemes that people are legally entitled to go unclaimed because no one told them they qualified. And when a real emergency happens, there's often a dangerous delay between "something is wrong" and "the right person knows about it."

VitalCare was built to close that gap.

## What VitalCare Does

VitalCare is a role-based healthcare platform connecting four types of users — **Patients**, **Caretakers**, **Doctors**, and **Admins** — through a shared system of vitals monitoring, relationships, and an autonomous AI agent layer that watches for danger and acts on it without anyone needing to refresh a page.

### Core capabilities

- **Picture-first Patient Dashboard** — designed specifically for low-literacy users. Every status and action is paired with an icon, not just text. Risk levels are shown as expressive face icons (calm green → concerned red), key summaries have a "listen" (text-to-speech) option, and navigation uses large, obviously-tappable icons instead of dense menus.
- **Patient ↔ Caretaker linking** — patients invite caretakers by email; caretakers only ever see data for patients who accepted them, enforced at the database level, not just hidden in the UI.
- **Patient ↔ Doctor relationships** — patients browse real doctor profiles (specialization, experience, affiliation, fees, languages) and book appointments; once accepted, doctors gain access to that patient's vitals and history — and only that patient's.
- **AI Agent Layer** — a `/agents` module orchestrated by a central **AgentManager**, where independent agents communicate only through events, not direct calls to each other:
  - **Health Monitoring Agent** — watches incoming vitals, calculates risk level, flags critical readings.
  - **Emergency Response Agent** — on a critical flag, automatically notifies the linked caretaker and assigned doctor, pulls nearby hospital recommendations, logs the full event, and escalates if it goes unresolved.
  - Every agent action is logged to an auditable `agent_logs` collection — this is not a black box.
- **Real-time notifications** — a notification bell and live toast pop-ups for both patients and caretakers, so a critical alert is seen the moment it happens, not on next login.
- **Geolocation-based hospital recommendations** — uses the patient's live location (with a graceful fallback to registered location if permission is denied) and a deterministic haversine distance calculation to recommend the nearest suitable hospitals, prioritizing ones where the patient's own doctor practices.
- **Government healthcare scheme matching** — structured eligibility data (age, state, gender, category) is matched against the patient's profile using deterministic rule-based logic, not AI guesswork, so patients are told what they may actually qualify for, with a clear "possibly relevant — confirm eligibility" category for anything that can't be fully verified.
- **Blood donation matching**, **multilingual support** (English, Hindi, Telugu), and **AI Health Insights** for plain-language trend summaries.

## Why the Architecture Choices Matter

A few deliberate decisions worth calling out to anyone reviewing this:

- **Deterministic logic stays deterministic.** Risk thresholds, scheme eligibility, and distance calculations are all plain rule-based code — not Gemini calls — because these are decisions that need to be accurate and explainable every time, not generated. Gemini is used only where it belongs: summarization, plain-language explanation, and natural language generation.
- **Permissions are enforced at the data layer.** Caretakers and doctors can't see patients they aren't linked to — not because the UI hides it, but because Firestore security rules block it outright.
- **Agents are loosely coupled.** No agent calls another agent directly; everything flows through the AgentManager's event system, so each agent can be tested, replaced, or extended independently. This also makes the system auditable: every agent decision is logged with what triggered it and what it did.

## Tech Stack

- **Frontend:** React, Tailwind CSS — fully responsive across mobile, tablet, and desktop
- **Auth & Database:** Firebase Authentication, Firebase Firestore
- **AI:** Gemini API (chat, insights, summarization, agent reasoning)
- **Agent orchestration:** Custom AgentManager — event-driven, in `/agents`

## Data Model (high level)

`users`, `patient_caretaker`, `patient_doctor`, `vitals`, `appointments`, `alerts`, `notifications`, `hospitals`, `government_schemes`, `blood_donation`, `agent_logs`

## Demo Flow

The clearest way to see the system work end to end:

1. A patient logs a critical vital reading.
2. The **Health Monitoring Agent** detects it and flags the risk level.
3. The **Emergency Response Agent** fires automatically — notifying the linked caretaker and assigned doctor in real time (visible as a live toast + bell notification), and surfacing the nearest suitable hospital, prioritizing one where the patient's doctor practices.
4. The entire chain — what triggered it, who was notified, when — is visible in the AgentManager's activity log.

## Known Limitations (and what we'd do next)

- Demo hospital coordinates are seeded/approximate rather than pulled from a live verified location API — production would integrate Google Places or a verified hospital registry.
- Tier 2/3 agents (Medical Report Analysis, Communication/translation, Appointment & Medication reminders, Health Analytics) are designed into the architecture's event system but not all implemented yet — the AgentManager is built to support them without further restructuring.
- Government scheme data is seeded with real, well-known Indian schemes but should be kept in sync with an official source for production use.


## Built With

Google AI Studio, Firebase, Gemini API
