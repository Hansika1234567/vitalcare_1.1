import { AgentManager } from "./AgentManager";
import { HealthMonitoringAgent } from "./HealthMonitoringAgent";
import { EmergencyResponseAgent } from "./EmergencyResponseAgent";

export * from "./types";
export { AgentManager } from "./AgentManager";
export { HealthMonitoringAgent } from "./HealthMonitoringAgent";
export { EmergencyResponseAgent } from "./EmergencyResponseAgent";

// Singleton orchestrator instance
export const agentManager = AgentManager.getInstance();

// Instantiate agents
const healthMonitoringAgent = new HealthMonitoringAgent();
const emergencyResponseAgent = new EmergencyResponseAgent();

// Register them with orchestrator
agentManager.registerAgent(healthMonitoringAgent);
agentManager.registerAgent(emergencyResponseAgent);
