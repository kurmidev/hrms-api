// Pure, unit-testable payroll calculation engine.
// NO Nest/Prisma imports here — keep this module framework-agnostic.

// ─── Constants ────────────────────────────────────────────────────────────────

// TODO(client-confirm): PF is currently modeled as a flat Rs. 1800 employee
// contribution whenever (Gross - LOP) >= PF_GROSS_THRESHOLD, per gap-analysis
// §4/§8 client sample data. This does NOT implement the statutory 12% slab
// calculation — confirm with client whether the flat-1800 rule is intentional
// or a simplification of the real PF formula before going live.
export const PF_FLAT_AMOUNT = 1800;
export const PF_GROSS_THRESHOLD = 15000;
export const ESI_RATE = 0.0075;
export const ESI_GROSS_CEILING = 21001;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SalaryComponents {
  basic: number;
  hra: number;
  specialAllowance: number;
  educationAllowance: number;
  travelAllowance: number;
  otherAllowances: number;
  incentive?: number;
  cumulativeIncentive?: number;
  overtime?: number;
  bonus?: number;
  greenThanks?: number;
}

export interface GrossBreakdown {
  basic: number;
  hra: number;
  specialAllowance: number;
  educationAllowance: number;
  travelAllowance: number;
  otherAllowances: number;
  incentive: number;
  cumulativeIncentive: number;
  overtime: number;
  bonus: number;
  greenThanks: number;
  gross: number;
}

export interface NetSalaryInput {
  gross: number;
  pf: number;
  esi: number;
  lop: number;
  tds: number;
  loanDeduction: number;
  advanceDeduction: number;
  otherDeductions: number;
}

// ─── Calculation functions ───────────────────────────────────────────────────

/**
 * Gross = Basic + HRA + SpecialAllowance + Incentive + Overtime + TravelAllowance
 *         + Bonus + CumulativeIncentive + GreenThanks + EducationAllowance
 * (Incentive/Bonus/GreenThanks/CumulativeIncentive default 0 this pass — M10/M11/M12)
 */
export function computeGross(components: SalaryComponents): GrossBreakdown {
  const incentive = components.incentive ?? 0;
  const cumulativeIncentive = components.cumulativeIncentive ?? 0;
  const overtime = components.overtime ?? 0;
  const bonus = components.bonus ?? 0;
  const greenThanks = components.greenThanks ?? 0;

  const gross =
    components.basic +
    components.hra +
    components.specialAllowance +
    incentive +
    overtime +
    components.travelAllowance +
    bonus +
    cumulativeIncentive +
    greenThanks +
    components.educationAllowance +
    components.otherAllowances;

  return {
    basic: components.basic,
    hra: components.hra,
    specialAllowance: components.specialAllowance,
    educationAllowance: components.educationAllowance,
    travelAllowance: components.travelAllowance,
    otherAllowances: components.otherAllowances,
    incentive,
    cumulativeIncentive,
    overtime,
    bonus,
    greenThanks,
    gross,
  };
}

/** LOP = (TotalMonthlySalary / TotalDaysInMonth) * LeaveDaysDeducted */
export function computeLop(
  totalMonthlySalary: number,
  totalDaysInMonth: number,
  leaveDaysDeducted: number,
): number {
  if (totalDaysInMonth <= 0) return 0;
  return (totalMonthlySalary / totalDaysInMonth) * leaveDaysDeducted;
}

/** PF = (Gross - LOP) >= 15000 ? 1800 : 0 */
export function computePf(grossMinusLop: number): number {
  return grossMinusLop >= PF_GROSS_THRESHOLD ? PF_FLAT_AMOUNT : 0;
}

/** ESI = (Gross - LOP) < 21001 ? ceil((Gross - LOP) * 0.0075) : 0 */
export function computeEsi(grossMinusLop: number): number {
  return grossMinusLop < ESI_GROSS_CEILING ? Math.ceil(grossMinusLop * ESI_RATE) : 0;
}

/** Net = Gross - PF - ESI - LOP - TDS - LoanDeduction - AdvanceDeduction - OtherDeductions */
export function computeNet(input: NetSalaryInput): number {
  return (
    input.gross -
    input.pf -
    input.esi -
    input.lop -
    input.tds -
    input.loanDeduction -
    input.advanceDeduction -
    input.otherDeductions
  );
}
