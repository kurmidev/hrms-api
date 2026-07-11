import {
  computeGross,
  computeLop,
  computePf,
  computeEsi,
  computeNet,
  PF_FLAT_AMOUNT,
  PF_GROSS_THRESHOLD,
  ESI_RATE,
  ESI_GROSS_CEILING,
  SalaryComponents,
  NetSalaryInput,
} from './payroll-calculation';

describe('computeGross', () => {
  it('sums all required components when only mandatory fields are provided', () => {
    // Arrange
    const components: SalaryComponents = {
      basic: 10000,
      hra: 4000,
      specialAllowance: 1000,
      educationAllowance: 500,
      travelAllowance: 800,
      otherAllowances: 200,
    };

    // Act
    const result = computeGross(components);

    // Assert
    expect(result.gross).toBe(16500);
  });

  it('defaults incentive, cumulativeIncentive, overtime, bonus, and greenThanks to 0 when omitted', () => {
    // Arrange
    const components: SalaryComponents = {
      basic: 10000,
      hra: 4000,
      specialAllowance: 1000,
      educationAllowance: 500,
      travelAllowance: 800,
      otherAllowances: 200,
    };

    // Act
    const result = computeGross(components);

    // Assert
    expect(result.incentive).toBe(0);
    expect(result.cumulativeIncentive).toBe(0);
    expect(result.overtime).toBe(0);
    expect(result.bonus).toBe(0);
    expect(result.greenThanks).toBe(0);
  });

  it('includes incentive, overtime, bonus, cumulativeIncentive, and greenThanks in the gross total when provided', () => {
    // Arrange
    const components: SalaryComponents = {
      basic: 10000,
      hra: 4000,
      specialAllowance: 1000,
      educationAllowance: 500,
      travelAllowance: 800,
      otherAllowances: 200,
      incentive: 300,
      overtime: 150,
      bonus: 1000,
      cumulativeIncentive: 250,
      greenThanks: 100,
    };

    // Act
    const result = computeGross(components);

    // Assert
    // 10000 + 4000 + 1000 + 300 + 150 + 800 + 1000 + 250 + 100 + 500 + 200
    expect(result.gross).toBe(18300);
  });

  it('returns a breakdown that echoes back each individual component value', () => {
    // Arrange
    const components: SalaryComponents = {
      basic: 25000,
      hra: 10000,
      specialAllowance: 2000,
      educationAllowance: 750,
      travelAllowance: 1200,
      otherAllowances: 300,
      incentive: 500,
      overtime: 200,
      bonus: 2000,
      cumulativeIncentive: 400,
      greenThanks: 150,
    };

    // Act
    const result = computeGross(components);

    // Assert
    expect(result.basic).toBe(25000);
    expect(result.hra).toBe(10000);
    expect(result.specialAllowance).toBe(2000);
    expect(result.educationAllowance).toBe(750);
    expect(result.travelAllowance).toBe(1200);
    expect(result.otherAllowances).toBe(300);
    expect(result.incentive).toBe(500);
    expect(result.overtime).toBe(200);
    expect(result.bonus).toBe(2000);
    expect(result.cumulativeIncentive).toBe(400);
    expect(result.greenThanks).toBe(150);
  });

  it('handles all-zero components and returns a zero gross', () => {
    // Arrange
    const components: SalaryComponents = {
      basic: 0,
      hra: 0,
      specialAllowance: 0,
      educationAllowance: 0,
      travelAllowance: 0,
      otherAllowances: 0,
    };

    // Act
    const result = computeGross(components);

    // Assert
    expect(result.gross).toBe(0);
  });
});

describe('computeLop', () => {
  it('returns 0 when leaveDaysDeducted is 0', () => {
    // Arrange
    const totalMonthlySalary = 31000;
    const totalDaysInMonth = 31;
    const leaveDaysDeducted = 0;

    // Act
    const lop = computeLop(totalMonthlySalary, totalDaysInMonth, leaveDaysDeducted);

    // Assert
    expect(lop).toBe(0);
  });

  it('is proportionally smaller per-day in a 31-day month than in a 28-day month for the same salary and leave days', () => {
    // Arrange
    const totalMonthlySalary = 28000;
    const leaveDaysDeducted = 1;

    // Act
    const lopIn31DayMonth = computeLop(totalMonthlySalary, 31, leaveDaysDeducted);
    const lopIn28DayMonth = computeLop(totalMonthlySalary, 28, leaveDaysDeducted);

    // Assert
    expect(lopIn28DayMonth).toBeGreaterThan(lopIn31DayMonth);
    expect(lopIn31DayMonth).toBeCloseTo(903.2258, 4);
    expect(lopIn28DayMonth).toBe(1000);
  });

  it('deducts the full monthly salary when leaveDaysDeducted equals totalDaysInMonth', () => {
    // Arrange
    const totalMonthlySalary = 30000;
    const totalDaysInMonth = 30;
    const leaveDaysDeducted = 30;

    // Act
    const lop = computeLop(totalMonthlySalary, totalDaysInMonth, leaveDaysDeducted);

    // Assert
    expect(lop).toBe(30000);
  });

  it('returns 0 when totalDaysInMonth is 0 to guard against division by zero', () => {
    // Arrange
    const totalMonthlySalary = 30000;
    const totalDaysInMonth = 0;
    const leaveDaysDeducted = 5;

    // Act
    const lop = computeLop(totalMonthlySalary, totalDaysInMonth, leaveDaysDeducted);

    // Assert
    expect(lop).toBe(0);
  });

  it('returns 0 when totalDaysInMonth is negative to guard against invalid input', () => {
    // Arrange
    const totalMonthlySalary = 30000;
    const totalDaysInMonth = -1;
    const leaveDaysDeducted = 5;

    // Act
    const lop = computeLop(totalMonthlySalary, totalDaysInMonth, leaveDaysDeducted);

    // Assert
    expect(lop).toBe(0);
  });

  it('computes a proportional partial-month LOP correctly', () => {
    // Arrange
    const totalMonthlySalary = 30000;
    const totalDaysInMonth = 30;
    const leaveDaysDeducted = 3;

    // Act
    const lop = computeLop(totalMonthlySalary, totalDaysInMonth, leaveDaysDeducted);

    // Assert
    expect(lop).toBe(3000);
  });
});

describe('computePf', () => {
  it('charges the flat PF amount when gross-minus-lop is exactly the threshold (15000)', () => {
    // Arrange
    const grossMinusLop = PF_GROSS_THRESHOLD;

    // Act
    const pf = computePf(grossMinusLop);

    // Assert
    expect(pf).toBe(PF_FLAT_AMOUNT);
  });

  it('charges 0 PF when gross-minus-lop is just below the threshold (14999.99)', () => {
    // Arrange
    const grossMinusLop = 14999.99;

    // Act
    const pf = computePf(grossMinusLop);

    // Assert
    expect(pf).toBe(0);
  });

  it('charges the flat PF amount when gross-minus-lop is well above the threshold', () => {
    // Arrange
    const grossMinusLop = 50000;

    // Act
    const pf = computePf(grossMinusLop);

    // Assert
    expect(pf).toBe(PF_FLAT_AMOUNT);
  });

  it('charges 0 PF when gross-minus-lop is 0', () => {
    // Arrange
    const grossMinusLop = 0;

    // Act
    const pf = computePf(grossMinusLop);

    // Assert
    expect(pf).toBe(0);
  });
});

describe('computeEsi', () => {
  it('charges ceil(21000 * 0.0075) = 158 when gross-minus-lop is exactly 21000 (chargeable)', () => {
    // Arrange
    const grossMinusLop = 21000;

    // Act
    const esi = computeEsi(grossMinusLop);

    // Assert
    expect(esi).toBe(158);
  });

  it('charges 0 when gross-minus-lop is exactly the ceiling (21001, not chargeable)', () => {
    // Arrange
    const grossMinusLop = ESI_GROSS_CEILING;

    // Act
    const esi = computeEsi(grossMinusLop);

    // Assert
    expect(esi).toBe(0);
  });

  it('charges 0 when gross-minus-lop is above the ceiling', () => {
    // Arrange
    const grossMinusLop = 30000;

    // Act
    const esi = computeEsi(grossMinusLop);

    // Assert
    expect(esi).toBe(0);
  });

  it('charges the exact ceil(20000 * 0.0075) = 150 with no rounding needed', () => {
    // Arrange
    const grossMinusLop = 20000;

    // Act
    const esi = computeEsi(grossMinusLop);

    // Assert
    expect(esi).toBe(Math.ceil(20000 * ESI_RATE));
    expect(esi).toBe(150);
  });

  it('rounds up a fractional ESI value instead of truncating (e.g. 20001 -> 150.0075 -> 151)', () => {
    // Arrange
    const grossMinusLop = 20001;

    // Act
    const esi = computeEsi(grossMinusLop);

    // Assert
    expect(esi).toBe(151);
  });

  it('charges 0 ESI when gross-minus-lop is 0', () => {
    // Arrange
    const grossMinusLop = 0;

    // Act
    const esi = computeEsi(grossMinusLop);

    // Assert
    expect(esi).toBe(0);
  });
});

describe('computeNet', () => {
  it('computes net salary end-to-end for a realistic payslip with all deduction types applied', () => {
    // Arrange
    const input: NetSalaryInput = {
      gross: 25000,
      pf: 1800,
      esi: 0,
      lop: 1000,
      tds: 500,
      loanDeduction: 2000,
      advanceDeduction: 300,
      otherDeductions: 150,
    };

    // Act
    const net = computeNet(input);

    // Assert
    // 25000 - 1800 - 0 - 1000 - 500 - 2000 - 300 - 150
    expect(net).toBe(19250);
  });

  it('returns the gross unchanged when every deduction is 0', () => {
    // Arrange
    const input: NetSalaryInput = {
      gross: 18000,
      pf: 0,
      esi: 0,
      lop: 0,
      tds: 0,
      loanDeduction: 0,
      advanceDeduction: 0,
      otherDeductions: 0,
    };

    // Act
    const net = computeNet(input);

    // Assert
    expect(net).toBe(18000);
  });

  it('composes correctly with the outputs of computeGross, computeLop, computePf, and computeEsi', () => {
    // Arrange
    const components: SalaryComponents = {
      basic: 15000,
      hra: 6000,
      specialAllowance: 2000,
      educationAllowance: 500,
      travelAllowance: 1000,
      otherAllowances: 0,
      overtime: 500,
    };
    const grossBreakdown = computeGross(components);
    const totalDaysInMonth = 30;
    const leaveDaysDeducted = 2;
    const lop = computeLop(grossBreakdown.gross, totalDaysInMonth, leaveDaysDeducted);
    const grossMinusLop = grossBreakdown.gross - lop;
    const pf = computePf(grossMinusLop);
    const esi = computeEsi(grossMinusLop);

    // Act
    const net = computeNet({
      gross: grossBreakdown.gross,
      pf,
      esi,
      lop,
      tds: 0,
      loanDeduction: 0,
      advanceDeduction: 0,
      otherDeductions: 0,
    });

    // Assert
    expect(grossBreakdown.gross).toBe(25000);
    expect(lop).toBeCloseTo((25000 / 30) * 2, 6);
    expect(pf).toBe(PF_FLAT_AMOUNT);
    expect(esi).toBe(0);
    expect(net).toBeCloseTo(25000 - lop - PF_FLAT_AMOUNT, 6);
  });

  it('can produce a negative net salary when deductions exceed gross', () => {
    // Arrange
    const input: NetSalaryInput = {
      gross: 5000,
      pf: 0,
      esi: 38,
      lop: 0,
      tds: 0,
      loanDeduction: 6000,
      advanceDeduction: 0,
      otherDeductions: 0,
    };

    // Act
    const net = computeNet(input);

    // Assert
    expect(net).toBeLessThan(0);
    expect(net).toBe(5000 - 38 - 6000);
  });
});
