/**
 * BigInt-safe GEN <-> wei helpers.
 *
 * GEN has 18 decimals, same as ETH. Every conversion here is pure string
 * arithmetic — a GEN decimal string is NEVER routed through
 * `parseFloat`/`Number` before becoming a `BigInt`, per spec §9.
 */

export const GEN_DECIMALS = 18;

export class InvalidGenAmountError extends Error {
  constructor(input: string, reason: string) {
    super(`Invalid GEN amount "${input}": ${reason}`);
    this.name = "InvalidGenAmountError";
  }
}

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

/**
 * Parse a user-typed decimal GEN string (e.g. "1.5") into wei as a bigint.
 * Never uses floating point. Throws `InvalidGenAmountError` on anything
 * that isn't a plain non-negative decimal, on more than 18 fractional
 * digits, or on a zero amount (stakes must be positive).
 */
export function parseGenToWei(input: string): bigint {
  const trimmed = input.trim();
  if (!DECIMAL_PATTERN.test(trimmed)) {
    throw new InvalidGenAmountError(input, "must be a plain non-negative decimal number");
  }

  const [wholePartRaw = "", fractionPartRaw = ""] = trimmed.split(".");
  const wholePart = wholePartRaw.replace(/^0+(?=\d)/, "");

  if (fractionPartRaw.length > GEN_DECIMALS) {
    throw new InvalidGenAmountError(
      input,
      `at most ${GEN_DECIMALS} fractional digits are supported`,
    );
  }

  const fractionPadded = fractionPartRaw.padEnd(GEN_DECIMALS, "0");
  const weiString = `${wholePart === "" ? "0" : wholePart}${fractionPadded}`;
  const wei = BigInt(weiString);

  if (wei <= 0n) {
    throw new InvalidGenAmountError(input, "amount must be greater than zero");
  }

  return wei;
}

/** Same as {@link parseGenToWei} but allows a zero amount. */
export function parseGenToWeiAllowZero(input: string): bigint {
  const trimmed = input.trim();
  if (!DECIMAL_PATTERN.test(trimmed)) {
    throw new InvalidGenAmountError(input, "must be a plain non-negative decimal number");
  }
  const [wholePartRaw = "", fractionPartRaw = ""] = trimmed.split(".");
  if (fractionPartRaw.length > GEN_DECIMALS) {
    throw new InvalidGenAmountError(
      input,
      `at most ${GEN_DECIMALS} fractional digits are supported`,
    );
  }
  const wholePart = wholePartRaw.replace(/^0+(?=\d)/, "");
  const fractionPadded = fractionPartRaw.padEnd(GEN_DECIMALS, "0");
  return BigInt(`${wholePart === "" ? "0" : wholePart}${fractionPadded}`);
}

/**
 * Format a wei bigint as a trimmed decimal GEN string for display, e.g.
 * `1500000000000000000n` -> `"1.5"`. Pure string/bigint arithmetic.
 */
export function formatWeiToGen(wei: bigint): string {
  if (wei < 0n) {
    throw new RangeError("GEN amount cannot be negative");
  }
  const asString = wei.toString().padStart(GEN_DECIMALS + 1, "0");
  const whole = asString.slice(0, -GEN_DECIMALS);
  const fraction = asString.slice(-GEN_DECIMALS).replace(/0+$/, "");
  return fraction.length > 0 ? `${whole}.${fraction}` : whole;
}

/** Double the stake, e.g. for the pot a duel winner receives. */
export function doubleWei(wei: bigint): bigint {
  return wei * 2n;
}
