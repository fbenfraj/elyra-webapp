import "server-only";

import { CIRCUIT_BREAKER_CONFIG } from "@/config/providers";

type CircuitState = "closed" | "open" | "half-open";

type CircuitData = {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  openedAt: number | null;
};

// In-memory state — resets on server restart (fail-open, safe default)
const circuits = new Map<string, CircuitData>();

function getCircuit(providerKey: string): CircuitData {
  if (!circuits.has(providerKey)) {
    circuits.set(providerKey, {
      state: "closed",
      failureCount: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      openedAt: null,
    });
  }
  return circuits.get(providerKey)!;
}

export function recordSuccess(providerKey: string): void {
  const circuit = getCircuit(providerKey);
  const previousState = circuit.state;
  circuit.failureCount = 0;
  circuit.lastSuccessTime = Date.now();
  circuit.state = "closed";
  circuit.openedAt = null;

  if (previousState !== "closed") {
    console.warn(JSON.stringify({
      event: "circuit_breaker_state_change",
      provider: providerKey,
      fromState: previousState,
      toState: "closed",
      failureCount: 0,
    }));
  }
}

export function recordFailure(providerKey: string): void {
  const circuit = getCircuit(providerKey);
  circuit.failureCount++;
  circuit.lastFailureTime = Date.now();

  if (circuit.failureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
    const previousState = circuit.state;
    circuit.state = "open";
    circuit.openedAt = Date.now();

    if (previousState !== "open") {
      console.warn(JSON.stringify({
        event: "circuit_breaker_state_change",
        provider: providerKey,
        fromState: previousState,
        toState: "open",
        failureCount: circuit.failureCount,
      }));
    }
  }
}

export function canExecute(providerKey: string): boolean {
  const circuit = getCircuit(providerKey);

  if (circuit.state === "closed") return true;

  if (circuit.state === "open") {
    // Check cooldown
    if (circuit.openedAt && Date.now() - circuit.openedAt >= CIRCUIT_BREAKER_CONFIG.cooldownMs) {
      circuit.state = "half-open";
      console.warn(JSON.stringify({
        event: "circuit_breaker_state_change",
        provider: providerKey,
        fromState: "open",
        toState: "half-open",
        failureCount: circuit.failureCount,
      }));
      return true; // Allow one test request
    }
    return false;
  }

  // half-open: allow the test request
  return true;
}

export function getState(providerKey: string): CircuitData {
  return { ...getCircuit(providerKey) };
}

export function getAllStates(): Record<string, CircuitData> {
  const result: Record<string, CircuitData> = {};
  for (const [key, data] of circuits) {
    result[key] = { ...data };
  }
  return result;
}

/** Reset all circuits — only for testing */
export function _resetAll(): void {
  circuits.clear();
}
