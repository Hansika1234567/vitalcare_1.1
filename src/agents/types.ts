export type AgentEventType = 
  | "VITALS_UPDATED"
  | "RISK_LEVEL_CRITICAL"
  | "EMERGENCY_TRIGGERED";

export interface AgentEvent<T = any> {
  id: string;
  type: AgentEventType;
  timestamp: string;
  patientId: string;
  data: T;
}

export interface AgentLog {
  id?: string;
  timestamp: string;
  eventType: AgentEventType;
  agentName: string;
  inputSummary: string;
  outputSummary: string;
  status: "success" | "failure";
  error?: string;
}

export interface Agent {
  name: string;
  supportedEvents: AgentEventType[];
  handleEvent(event: AgentEvent, orchestrator: AgentManagerInterface): Promise<void>;
}

export interface AgentManagerInterface {
  registerAgent(agent: Agent): void;
  dispatchEvent(event: Omit<AgentEvent, "id" | "timestamp">): Promise<void>;
  logInvocation(log: Omit<AgentLog, "id">): Promise<void>;
}
