import { db, collection, addDoc, handleFirestoreError, OperationType } from "../firebase";
import { Agent, AgentEvent, AgentEventType, AgentLog, AgentManagerInterface } from "./types";

export class AgentManager implements AgentManagerInterface {
  private static instance: AgentManager | null = null;
  private agents: Agent[] = [];
  private eventListeners: Map<AgentEventType, ((event: AgentEvent) => void)[]> = new Map();

  private constructor() {}

  public static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  public registerAgent(agent: Agent): void {
    if (!this.agents.some(a => a.name === agent.name)) {
      this.agents.push(agent);
      console.log(`[AgentManager] Registered agent: ${agent.name}`);
    }
  }

  // Allow UI or other parts to listen to events
  public addEventListener(type: AgentEventType, callback: (event: AgentEvent) => void): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(callback);

    // Return unsubscribe function
    return () => {
      const list = this.eventListeners.get(type);
      if (list) {
        this.eventListeners.set(type, list.filter(cb => cb !== callback));
      }
    };
  }

  public async dispatchEvent(eventData: Omit<AgentEvent, "id" | "timestamp">): Promise<void> {
    const event: AgentEvent = {
      ...eventData,
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString()
    };

    console.log(`[AgentManager] Dispatching event: ${event.type} for patient ${event.patientId}`, event.data);

    // Trigger local event listeners (e.g. UI reactivity)
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (err) {
          console.error(`[AgentManager] Error in event listener for ${event.type}:`, err);
        }
      });
    }

    // Find and execute matched agents in parallel but catch errors
    const matchedAgents = this.agents.filter(agent => agent.supportedEvents.includes(event.type));
    
    await Promise.all(matchedAgents.map(async (agent) => {
      let status: "success" | "failure" = "success";
      let errorSummary: string | undefined;
      let outputSummary = "Event handled successfully.";

      try {
        // Execute agent
        // We pass the orchestrator context 'this' so that the agent can dispatch new events if needed
        await agent.handleEvent(event, this);
      } catch (err: any) {
        status = "failure";
        errorSummary = err?.message || String(err);
        outputSummary = `Failed: ${errorSummary}`;
        console.error(`[AgentManager] Agent ${agent.name} failed handling event ${event.type}:`, err);
      } finally {
        // Log to Firebase & console
        try {
          const inputSummary = JSON.stringify(event.data || {}).substring(0, 1000);
          await this.logInvocation({
            timestamp: new Date().toISOString(),
            eventType: event.type,
            agentName: agent.name,
            inputSummary,
            outputSummary: outputSummary.substring(0, 1000),
            status,
            error: errorSummary
          });
        } catch (logErr) {
          console.error(`[AgentManager] Failed to log agent invocation to firestore:`, logErr);
        }
      }
    }));
  }

  public async logInvocation(log: Omit<AgentLog, "id">): Promise<void> {
    console.log(`[AgentManager Log] Agent: ${log.agentName} | Event: ${log.eventType} | Status: ${log.status}`);
    try {
      const cleanLog: any = { ...log };
      if (cleanLog.error === undefined) {
        delete cleanLog.error;
      }
      await addDoc(collection(db, "agent_logs"), cleanLog);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "agent_logs");
    }
  }
}
