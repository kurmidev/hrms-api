import { computeEmiSchedule, roundMoney } from './loan-amortization';

describe('computeEmiSchedule', () => {
  it('splits a 0% interest loan into equal principal installments with no interest', () => {
    // Arrange
    const input = {
      principal: 12000,
      annualInterestRate: 0,
      tenureMonths: 12,
      startMonth: 6,
      startYear: 2026,
    };

    // Act
    const schedule = computeEmiSchedule(input);

    // Assert
    expect(schedule).toHaveLength(12);
    schedule.forEach((installment) => {
      expect(installment.interest).toBe(0);
      expect(installment.principal).toBe(1000);
      expect(installment.emiAmount).toBe(1000);
    });
    expect(schedule[schedule.length - 1].outstandingBalance).toBe(0);

    const totalPrincipal = schedule.reduce((sum, installment) => sum + installment.principal, 0);
    expect(roundMoney(totalPrincipal)).toBe(12000);
  });

  it('computes a reducing-balance EMI schedule matching the standard formula', () => {
    // Arrange
    const principal = 100000;
    const annualInterestRate = 12;
    const tenureMonths = 12;
    const monthlyRate = annualInterestRate / 12 / 100;
    const factor = Math.pow(1 + monthlyRate, tenureMonths);
    const expectedEmi = roundMoney((principal * monthlyRate * factor) / (factor - 1));

    // Act
    const schedule = computeEmiSchedule({
      principal,
      annualInterestRate,
      tenureMonths,
      startMonth: 1,
      startYear: 2026,
    });

    // Assert
    expect(schedule).toHaveLength(tenureMonths);

    // First installment: interest computed on full principal
    const firstExpectedInterest = roundMoney(principal * monthlyRate);
    expect(schedule[0].interest).toBe(firstExpectedInterest);
    expect(schedule[0].emiAmount).toBe(expectedEmi);
    expect(schedule[0].principal).toBe(roundMoney(expectedEmi - firstExpectedInterest));

    // Outstanding balance decreases monotonically and reaches exactly 0 at the end
    for (let i = 1; i < schedule.length; i += 1) {
      expect(schedule[i].outstandingBalance).toBeLessThanOrEqual(
        schedule[i - 1].outstandingBalance,
      );
    }
    expect(schedule[schedule.length - 1].outstandingBalance).toBe(0);

    // Principal column sums exactly to the approved amount (last row absorbs rounding)
    const totalPrincipal = schedule.reduce((sum, installment) => sum + installment.principal, 0);
    expect(roundMoney(totalPrincipal)).toBe(principal);
  });

  it('rolls emiMonth/emiYear forward starting the month after approval, wrapping Dec to Jan', () => {
    // Arrange
    const input = {
      principal: 6000,
      annualInterestRate: 10,
      tenureMonths: 3,
      startMonth: 12,
      startYear: 2025,
    };

    // Act
    const schedule = computeEmiSchedule(input);

    // Assert
    expect(schedule[0].emiMonth).toBe(1);
    expect(schedule[0].emiYear).toBe(2026);
    expect(schedule[1].emiMonth).toBe(2);
    expect(schedule[1].emiYear).toBe(2026);
    expect(schedule[2].emiMonth).toBe(3);
    expect(schedule[2].emiYear).toBe(2026);
  });

  it('assigns installmentNo sequentially starting at 1', () => {
    // Arrange
    const input = {
      principal: 5000,
      annualInterestRate: 8,
      tenureMonths: 5,
      startMonth: 3,
      startYear: 2026,
    };

    // Act
    const schedule = computeEmiSchedule(input);

    // Assert
    expect(schedule.map((installment) => installment.installmentNo)).toEqual([1, 2, 3, 4, 5]);
  });

  it('sets dueDate to the last calendar day of the emiMonth/emiYear', () => {
    // Arrange
    const input = {
      principal: 2400,
      annualInterestRate: 6,
      tenureMonths: 2,
      startMonth: 1,
      startYear: 2026,
    };

    // Act
    const schedule = computeEmiSchedule(input);

    // Assert: Feb 2026 is not a leap year -> 28 days
    expect(schedule[0].dueDate.getFullYear()).toBe(2026);
    expect(schedule[0].dueDate.getMonth()).toBe(1); // 0-indexed: February
    expect(schedule[0].dueDate.getDate()).toBe(28);
  });
});
