/**
 * A one-way window between the Circuit Lab and the assistant.
 *
 * The assistant lives at app level and the board's state lives inside CircuitBoard, so they need a
 * meeting point. This is deliberately a small module singleton rather than a React context: the
 * assistant only reads the circuit when a tool fires, so nothing here needs to drive a re-render.
 *
 * It also holds a pending slot. If the reader asks for a circuit while on a lesson page, there is
 * no board mounted to receive it — so it is parked here and the board collects it on mount.
 */

import type { Circuit } from '../lib/quantum/circuit'

let current: Circuit | undefined
let loader: ((circuit: Circuit) => void) | undefined
let pending: Circuit | undefined

/** Called by CircuitBoard whenever its circuit changes. */
export function publishCircuit(circuit: Circuit, load: (circuit: Circuit) => void): void {
  current = circuit
  loader = load
}

/** Called when CircuitBoard unmounts, so a stale circuit is never reported as live. */
export function unpublishCircuit(): void {
  current = undefined
  loader = undefined
}

/** The circuit on the board right now, if a board is mounted. */
export const getCurrentCircuit = (): Circuit | undefined => current

export const isBoardMounted = (): boolean => loader !== undefined

/**
 * Ask for a circuit to be put on the board. Loads immediately when the board is mounted,
 * otherwise parks it for the board to collect.
 */
export function requestLoad(circuit: Circuit): 'loaded' | 'queued' {
  if (loader) {
    loader(circuit)
    return 'loaded'
  }
  pending = circuit
  return 'queued'
}

/** Collected by CircuitBoard on mount; clears the slot so a reload does not reapply it. */
export function takePendingCircuit(): Circuit | undefined {
  const circuit = pending
  pending = undefined
  return circuit
}
