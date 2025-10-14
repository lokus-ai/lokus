/**
 * ComplexNumber.js
 *
 * Complex number implementation for quantum amplitude calculations.
 * Represents numbers in the form a + bi where i² = -1.
 */

export class ComplexNumber {
  constructor(real = 0, imaginary = 0) {
    this.real = real;
    this.imaginary = imaginary;
  }

  /**
   * Add two complex numbers
   */
  add(other) {
    return new ComplexNumber(
      this.real + other.real,
      this.imaginary + other.imaginary
    );
  }

  /**
   * Subtract complex numbers
   */
  subtract(other) {
    return new ComplexNumber(
      this.real - other.real,
      this.imaginary - other.imaginary
    );
  }

  /**
   * Multiply complex numbers
   * (a + bi)(c + di) = (ac - bd) + (ad + bc)i
   */
  multiply(other) {
    if (typeof other === 'number') {
      return new ComplexNumber(
        this.real * other,
        this.imaginary * other
      );
    }

    return new ComplexNumber(
      this.real * other.real - this.imaginary * other.imaginary,
      this.real * other.imaginary + this.imaginary * other.real
    );
  }

  /**
   * Divide complex numbers
   */
  divide(other) {
    if (typeof other === 'number') {
      return new ComplexNumber(
        this.real / other,
        this.imaginary / other
      );
    }

    const denominator = other.real * other.real + other.imaginary * other.imaginary;
    return new ComplexNumber(
      (this.real * other.real + this.imaginary * other.imaginary) / denominator,
      (this.imaginary * other.real - this.real * other.imaginary) / denominator
    );
  }

  /**
   * Get the complex conjugate (a + bi)* = a - bi
   */
  conjugate() {
    return new ComplexNumber(this.real, -this.imaginary);
  }

  /**
   * Get the magnitude |z| = sqrt(a² + b²)
   */
  magnitude() {
    return Math.sqrt(this.real * this.real + this.imaginary * this.imaginary);
  }

  /**
   * Get magnitude squared |z|² = a² + b²
   */
  magnitudeSquared() {
    return this.real * this.real + this.imaginary * this.imaginary;
  }

  /**
   * Get the phase/argument angle
   */
  phase() {
    return Math.atan2(this.imaginary, this.real);
  }

  /**
   * Normalize to unit magnitude
   */
  normalize() {
    const mag = this.magnitude();
    if (mag === 0) return new ComplexNumber(0, 0);
    return this.divide(mag);
  }

  /**
   * Exponentiation e^(a+bi) = e^a * (cos(b) + i*sin(b))
   */
  exp() {
    const expReal = Math.exp(this.real);
    return new ComplexNumber(
      expReal * Math.cos(this.imaginary),
      expReal * Math.sin(this.imaginary)
    );
  }

  /**
   * Create from polar coordinates
   */
  static fromPolar(magnitude, phase) {
    return new ComplexNumber(
      magnitude * Math.cos(phase),
      magnitude * Math.sin(phase)
    );
  }

  /**
   * String representation
   */
  toString() {
    if (this.imaginary === 0) return `${this.real}`;
    if (this.real === 0) return `${this.imaginary}i`;
    const sign = this.imaginary > 0 ? '+' : '-';
    return `${this.real} ${sign} ${Math.abs(this.imaginary)}i`;
  }
}

export default ComplexNumber;