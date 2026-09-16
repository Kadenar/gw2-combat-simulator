/**
 * Seeded random source for one run.
 *
 * The reference seeds a process-wide `std::mt19937` from `std::random_device`,
 * so no two C++ runs share draws. The port keeps the same draw sites and ranges
 * (including the inclusive 0..100 integer roll used for critical strikes) but
 * draws from an explicit per-run seed so TypeScript runs are reproducible and
 * isolated. Individual samples are not expected to match the C++ stream; only
 * the distribution each draw site samples from is part of the contract.
 */

const N = 624;
const M = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;

export interface RandomSource {
  /** Uniform integer in [minimum, maximum], matching `std::uniform_int_distribution` bounds. */
  integer(minimum: number, maximum: number): number;
  /** Uniform real in [minimum, maximum), matching `std::uniform_real_distribution` bounds. */
  real(minimum: number, maximum: number): number;
}

/** MT19937 core so the generator family matches the reference even though seeds differ. */
class MersenneTwister {
  private readonly state = new Uint32Array(N);
  private index = N;

  constructor(seed: number) {
    this.state[0] = seed >>> 0;
    for (let i = 1; i < N; i += 1) {
      const previous = this.state[i - 1] ^ (this.state[i - 1] >>> 30);
      this.state[i] = (Math.imul(1812433253, previous) + i) >>> 0;
    }
  }

  next(): number {
    if (this.index >= N) this.twist();
    let value = this.state[this.index];
    this.index += 1;
    value ^= value >>> 11;
    value ^= (value << 7) & 0x9d2c5680;
    value ^= (value << 15) & 0xefc60000;
    value ^= value >>> 18;
    return value >>> 0;
  }

  private twist(): void {
    for (let i = 0; i < N; i += 1) {
      const mixed = (this.state[i] & UPPER_MASK) | (this.state[(i + 1) % N] & LOWER_MASK);
      let value = this.state[(i + M) % N] ^ (mixed >>> 1);
      if (mixed & 1) value ^= MATRIX_A;
      this.state[i] = value >>> 0;
    }

    this.index = 0;
  }
}

/** Creates the run-local random source; each run owns its generator so batches never share draws. */
export function createRandomSource(seed: number): RandomSource {
  const generator = new MersenneTwister(seed);

  return {
    integer(minimum, maximum) {
      // Rejection sampling keeps the inclusive range unbiased like the standard distribution.
      const span = maximum - minimum + 1;
      const limit = Math.floor(0x100000000 / span) * span;
      let draw = generator.next();
      while (draw >= limit) draw = generator.next();
      return minimum + (draw % span);
    },
    real(minimum, maximum) {
      // 53-bit resolution from two 32-bit draws, the same construction libstdc++ uses.
      const high = generator.next() >>> 5;
      const low = generator.next() >>> 6;
      const unit = (high * 67108864 + low) / 9007199254740992;
      return minimum + unit * (maximum - minimum);
    }
  };
}
