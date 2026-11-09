import { DeploymentStatus } from '@prisma/client';

export type DeploymentEventAction =
  | 'DISPATCH_CI'
  | 'IMAGE_PUSHED'
  | 'APPLY_K8S'
  | 'PODS_SCHEDULED'
  | 'ROLLOUT_PASSED'
  | 'ROLLOUT_FAILED'
  | 'MANUAL_ROLLBACK'
  | 'FAIL';

export class InvalidTransitionError extends Error {
  status = 400;
  code = 'INVALID_TRANSITION';

  constructor(public current: DeploymentStatus, public action: DeploymentEventAction) {
    super(`Cannot execute transition '${action}' from current deployment status '${current}'.`);
    this.name = 'InvalidTransitionError';
  }
}

export const TERMINAL_STATES: ReadonlySet<DeploymentStatus> = new Set<DeploymentStatus>([
  'succeeded',
  'failed',
  'rolled_back',
]);

/**
 * Pure function: transition(current, action) -> next | throws InvalidTransitionError
 * Unit-testable, deterministic state machine core.
 */
export function transition(current: DeploymentStatus, action: DeploymentEventAction): DeploymentStatus {
  // Terminal state protection: No transitions allowed out of terminal states
  // Exception: 'succeeded' can trigger 'MANUAL_ROLLBACK'
  if (TERMINAL_STATES.has(current)) {
    if (current === 'succeeded' && action === 'MANUAL_ROLLBACK') {
      return 'rolled_back';
    }
    throw new InvalidTransitionError(current, action);
  }

  // Any non-terminal state can transition to 'failed' on failure action
  if (action === 'FAIL') {
    return 'failed';
  }

  switch (current) {
    case 'requested':
      if (action === 'DISPATCH_CI') return 'building';
      if (action === 'APPLY_K8S') return 'applying';
      if (action === 'IMAGE_PUSHED') return 'pushed';
      break;

    case 'building':
      if (action === 'IMAGE_PUSHED') return 'pushed';
      break;

    case 'pushed':
      if (action === 'APPLY_K8S') return 'applying';
      break;

    case 'applying':
      if (action === 'PODS_SCHEDULED') return 'rolling_out';
      break;

    case 'rolling_out':
      if (action === 'ROLLOUT_PASSED') return 'succeeded';
      if (action === 'ROLLOUT_FAILED' || action === 'MANUAL_ROLLBACK') return 'rolled_back';
      break;
  }

  throw new InvalidTransitionError(current, action);
}
