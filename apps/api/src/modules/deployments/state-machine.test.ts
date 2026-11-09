import { transition, InvalidTransitionError } from './state-machine.js';
import { DeploymentStatus } from '@prisma/client';

describe('Deployment State Machine Core (Unit Test Every Transition)', () => {
  it('transitions requested -> building on DISPATCH_CI', () => {
    expect(transition('requested', 'DISPATCH_CI')).toBe('building');
  });

  it('transitions requested -> applying on APPLY_K8S (direct or pre-built apply)', () => {
    expect(transition('requested', 'APPLY_K8S')).toBe('applying');
  });

  it('transitions requested -> pushed on IMAGE_PUSHED', () => {
    expect(transition('requested', 'IMAGE_PUSHED')).toBe('pushed');
  });

  it('transitions building -> pushed on IMAGE_PUSHED', () => {
    expect(transition('building', 'IMAGE_PUSHED')).toBe('pushed');
  });

  it('transitions pushed -> applying on APPLY_K8S', () => {
    expect(transition('pushed', 'APPLY_K8S')).toBe('applying');
  });

  it('transitions applying -> rolling_out on PODS_SCHEDULED', () => {
    expect(transition('applying', 'PODS_SCHEDULED')).toBe('rolling_out');
  });

  it('transitions rolling_out -> succeeded on ROLLOUT_PASSED', () => {
    expect(transition('rolling_out', 'ROLLOUT_PASSED')).toBe('succeeded');
  });

  it('transitions rolling_out -> rolled_back on ROLLOUT_FAILED (auto-rollback)', () => {
    expect(transition('rolling_out', 'ROLLOUT_FAILED')).toBe('rolled_back');
  });

  it('transitions rolling_out -> rolled_back on MANUAL_ROLLBACK', () => {
    expect(transition('rolling_out', 'MANUAL_ROLLBACK')).toBe('rolled_back');
  });

  it('transitions succeeded -> rolled_back on MANUAL_ROLLBACK', () => {
    expect(transition('succeeded', 'MANUAL_ROLLBACK')).toBe('rolled_back');
  });

  describe('Failure Transitions from any non-terminal state', () => {
    const nonTerminalStates: DeploymentStatus[] = ['requested', 'building', 'pushed', 'applying', 'rolling_out'];

    nonTerminalStates.forEach((state) => {
      it(`transitions ${state} -> failed on FAIL`, () => {
        expect(transition(state, 'FAIL')).toBe('failed');
      });
    });
  });

  describe('Terminal States Protection (No illegal transitions out)', () => {
    it('throws InvalidTransitionError for transitions out of failed', () => {
      expect(() => transition('failed', 'DISPATCH_CI')).toThrow(InvalidTransitionError);
      expect(() => transition('failed', 'ROLLOUT_PASSED')).toThrow(InvalidTransitionError);
    });

    it('throws InvalidTransitionError for transitions out of rolled_back', () => {
      expect(() => transition('rolled_back', 'APPLY_K8S')).toThrow(InvalidTransitionError);
    });

    it('throws InvalidTransitionError for non-rollback transitions out of succeeded', () => {
      expect(() => transition('succeeded', 'DISPATCH_CI')).toThrow(InvalidTransitionError);
      expect(() => transition('succeeded', 'ROLLOUT_PASSED')).toThrow(InvalidTransitionError);
    });

    it('throws InvalidTransitionError for illegal forward skip (requested -> succeeded)', () => {
      expect(() => transition('requested', 'ROLLOUT_PASSED')).toThrow(InvalidTransitionError);
    });
  });
});
