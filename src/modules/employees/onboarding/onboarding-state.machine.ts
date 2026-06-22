import { BadRequestException } from '@nestjs/common';
import { OnboardingStatus } from '@prisma/client';

export const VALID_TRANSITIONS: Record<OnboardingStatus, OnboardingStatus[]> = {
  [OnboardingStatus.PENDING]:            [OnboardingStatus.IN_PROGRESS, OnboardingStatus.EXPIRED],
  [OnboardingStatus.IN_PROGRESS]:        [OnboardingStatus.SUBMITTED, OnboardingStatus.EXPIRED],
  [OnboardingStatus.SUBMITTED]:          [OnboardingStatus.UNDER_REVIEW],
  [OnboardingStatus.UNDER_REVIEW]:       [OnboardingStatus.CHANGES_REQUESTED, OnboardingStatus.ACTIVATED, OnboardingStatus.REJECTED],
  [OnboardingStatus.CHANGES_REQUESTED]:  [OnboardingStatus.IN_PROGRESS],
  [OnboardingStatus.ACTIVATED]:          [],
  [OnboardingStatus.REJECTED]:           [],
  [OnboardingStatus.EXPIRED]:            [],
};

export function assertValidTransition(from: OnboardingStatus, to: OnboardingStatus): void {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new BadRequestException(
      `Transition from ${from} to ${to} is not permitted`,
    );
  }
}
