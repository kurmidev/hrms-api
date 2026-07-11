/**
 * Pure, framework-agnostic loan amortization engine.
 *
 * NO Nest/Prisma imports here — this module must be independently unit
 * testable and reusable outside the Nest DI graph.
 *
 * Ground truth (see docs/modules/loans.md "Amortization ground truth"):
 *   r    = annualInterestRate / 12 / 100        (monthly rate)
 *   EMI  = r === 0 ? principal / n
 *                  : P*r*(1+r)^n / ((1+r)^n - 1)   rounded to 2dp
 *   per installment:
 *     interest    = round(outstanding * r, 2)
 *     principalPd = round(EMI - interest, 2)
 *     outstanding = round(outstanding - principalPd, 2)
 *   last installment: principalPd = remaining outstanding;
 *     EMI = principalPd + interest; outstanding = 0
 *   sum(principal over all installments) === amountApproved exactly
 */

/** Rounding precision (decimal places) for all monetary amounts. */
const MONEY_DECIMALS = 2;

const MONTHS_PER_YEAR = 12;
const PERCENT_DIVISOR = 100;
const FIRST_MONTH = 1;
const LAST_MONTH = 12;

export interface ComputeEmiScheduleInput {
  /** Principal amount to be amortized (i.e. the approved loan amount). */
  principal: number;
  /** Annual interest rate as a percentage (e.g. 12 for 12% p.a.). */
  annualInterestRate: number;
  /** Number of monthly installments. */
  tenureMonths: number;
  /** Calendar month (1-12) of loan approval — the first EMI falls the month after this. */
  startMonth: number;
  /** Calendar year of loan approval. */
  startYear: number;
}

export interface EmiInstallment {
  installmentNo: number;
  emiMonth: number;
  emiYear: number;
  emiAmount: number;
  principal: number;
  interest: number;
  outstandingBalance: number;
  dueDate: Date;
}

/** Round a number to MONEY_DECIMALS decimal places using standard rounding. */
export function roundMoney(value: number): number {
  const factor = Math.pow(10, MONEY_DECIMALS);
  return Math.round(value * factor) / factor;
}

/** Roll a (month, year) pair forward by one month, wrapping Dec -> Jan of the next year. */
function nextMonth(month: number, year: number): { month: number; year: number } {
  if (month >= LAST_MONTH) {
    return { month: FIRST_MONTH, year: year + 1 };
  }
  return { month: month + 1, year };
}

/** Last calendar day of the given (month, year) as a Date. */
function lastDayOfMonth(month: number, year: number): Date {
  return new Date(year, month, 0);
}

/** Compute the level EMI amount for a reducing-balance loan (rounded to 2dp). */
function computeLevelEmi(principal: number, monthlyRate: number, tenureMonths: number): number {
  if (monthlyRate === 0) {
    return roundMoney(principal / tenureMonths);
  }
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const emi = (principal * monthlyRate * factor) / (factor - 1);
  return roundMoney(emi);
}

/**
 * Compute the full EMI amortization schedule for a loan using the
 * reducing-balance method. The last installment absorbs rounding drift so
 * that the principal column sums exactly to `principal` and the final
 * outstanding balance is exactly 0.
 */
export function computeEmiSchedule(input: ComputeEmiScheduleInput): EmiInstallment[] {
  const { principal, annualInterestRate, tenureMonths, startMonth, startYear } = input;
  const monthlyRate = annualInterestRate / MONTHS_PER_YEAR / PERCENT_DIVISOR;
  const emi = computeLevelEmi(principal, monthlyRate, tenureMonths);

  const installments: EmiInstallment[] = [];
  let outstanding = principal;
  let cursor = { month: startMonth, year: startYear };

  for (let installmentNo = 1; installmentNo <= tenureMonths; installmentNo += 1) {
    cursor = nextMonth(cursor.month, cursor.year);

    const isLastInstallment = installmentNo === tenureMonths;
    const interest = roundMoney(outstanding * monthlyRate);

    let installmentPrincipal: number;
    let emiAmount: number;
    let newOutstanding: number;

    if (isLastInstallment) {
      installmentPrincipal = outstanding;
      emiAmount = roundMoney(installmentPrincipal + interest);
      newOutstanding = 0;
    } else {
      installmentPrincipal = roundMoney(emi - interest);
      emiAmount = emi;
      newOutstanding = roundMoney(outstanding - installmentPrincipal);
    }

    installments.push({
      installmentNo,
      emiMonth: cursor.month,
      emiYear: cursor.year,
      emiAmount,
      principal: installmentPrincipal,
      interest,
      outstandingBalance: newOutstanding,
      dueDate: lastDayOfMonth(cursor.month, cursor.year),
    });

    outstanding = newOutstanding;
  }

  return installments;
}
