/**
 * WaveFunction.js
 *
 * Quantum wave function representation and operations.
 * Handles probability amplitudes and quantum state evolution.
 */

import { ComplexNumber } from '../math/ComplexNumber.js';

export class WaveFunction {
  constructor(dimensions = 768) {
    this.dimensions = dimensions;
    this.amplitudes = new Array(dimensions);
    this.phase = 0;
    this.normalizationConstant = 1;

    // Initialize with random amplitudes
    this.initialize();
  }

  /**
   * Initialize wave function with random quantum state
   */
  initialize() {
    let sumSquared = 0;

    // Generate random complex amplitudes
    for (let i = 0; i < this.dimensions; i++) {
      const real = Math.random() - 0.5;
      const imaginary = Math.random() - 0.5;
      this.amplitudes[i] = new ComplexNumber(real, imaginary);
      sumSquared += this.amplitudes[i].magnitudeSquared();
    }

    // Normalize to ensure total probability = 1
    this.normalize(Math.sqrt(sumSquared));
  }

  /**
   * Normalize the wave function
   */
  normalize(factor = null) {
    if (factor === null) {
      factor = this.calculateNorm();
    }

    if (factor === 0) return;

    for (let i = 0; i < this.dimensions; i++) {
      this.amplitudes[i] = this.amplitudes[i].divide(factor);
    }

    this.normalizationConstant = 1 / factor;
  }

  /**
   * Calculate the norm of the wave function
   */
  calculateNorm() {
    let sumSquared = 0;
    for (let i = 0; i < this.dimensions; i++) {
      sumSquared += this.amplitudes[i].magnitudeSquared();
    }
    return Math.sqrt(sumSquared);
  }

  /**
   * Encode text into quantum wave function
   */
  async encode(text) {
    // Simple encoding: hash text to generate deterministic amplitudes
    const hash = await this.hashText(text);
    const waveFunction = new WaveFunction(this.dimensions);

    // Generate amplitudes from hash
    for (let i = 0; i < this.dimensions; i++) {
      const seed = hash.charCodeAt(i % hash.length);
      const real = Math.sin(seed * (i + 1)) * 0.5;
      const imaginary = Math.cos(seed * (i + 1)) * 0.5;
      waveFunction.amplitudes[i] = new ComplexNumber(real, imaginary);
    }

    waveFunction.normalize();
    waveFunction.phase = this.calculatePhaseFromText(text);

    return waveFunction;
  }

  /**
   * Calculate inner product ⟨ψ|φ⟩ with another wave function
   */
  innerProduct(other) {
    let result = new ComplexNumber(0, 0);

    for (let i = 0; i < this.dimensions; i++) {
      // ⟨ψ|φ⟩ = Σ ψᵢ* φᵢ
      const conjugated = this.amplitudes[i].conjugate();
      const product = conjugated.multiply(other.amplitudes[i]);
      result = result.add(product);
    }

    return result;
  }

  /**
   * Calculate overlap (fidelity) with another wave function
   */
  overlap(other) {
    const inner = this.innerProduct(other);
    return inner.magnitudeSquared();
  }

  /**
   * Apply quantum gate/operator
   */
  applyOperator(operator) {
    const result = new WaveFunction(this.dimensions);

    // Matrix multiplication: |ψ'⟩ = O|ψ⟩
    for (let i = 0; i < this.dimensions; i++) {
      result.amplitudes[i] = new ComplexNumber(0, 0);
      for (let j = 0; j < this.dimensions; j++) {
        if (operator[i] && operator[i][j]) {
          const product = operator[i][j].multiply(this.amplitudes[j]);
          result.amplitudes[i] = result.amplitudes[i].add(product);
        }
      }
    }

    result.normalize();
    return result;
  }

  /**
   * Time evolution using Schrödinger equation
   */
  evolve(hamiltonian, timeStep = 0.01) {
    // Simplified time evolution: |ψ(t)⟩ = e^(-iHt)|ψ(0)⟩
    // Using first-order approximation: |ψ(t+dt)⟩ ≈ (1 - iHdt)|ψ(t)⟩

    const evolved = new WaveFunction(this.dimensions);

    for (let i = 0; i < this.dimensions; i++) {
      evolved.amplitudes[i] = this.amplitudes[i];

      // Apply Hamiltonian
      for (let j = 0; j < this.dimensions; j++) {
        if (hamiltonian[i] && hamiltonian[i][j]) {
          const term = hamiltonian[i][j]
            .multiply(this.amplitudes[j])
            .multiply(new ComplexNumber(0, -timeStep));
          evolved.amplitudes[i] = evolved.amplitudes[i].add(term);
        }
      }
    }

    evolved.normalize();
    return evolved;
  }

  /**
   * Measure the wave function (collapse)
   */
  measure() {
    const probabilities = [];
    let cumulative = 0;

    // Calculate probability distribution
    for (let i = 0; i < this.dimensions; i++) {
      const probability = this.amplitudes[i].magnitudeSquared();
      cumulative += probability;
      probabilities.push(cumulative);
    }

    // Sample from probability distribution
    const random = Math.random();
    for (let i = 0; i < this.dimensions; i++) {
      if (random <= probabilities[i]) {
        // Collapse to measured state
        const collapsed = new WaveFunction(this.dimensions);
        for (let j = 0; j < this.dimensions; j++) {
          collapsed.amplitudes[j] = new ComplexNumber(i === j ? 1 : 0, 0);
        }
        return { index: i, collapsed };
      }
    }

    return { index: 0, collapsed: this };
  }

  /**
   * Create superposition of multiple wave functions
   */
  static superposition(waveFunctions, coefficients = null) {
    if (waveFunctions.length === 0) return null;

    const dimensions = waveFunctions[0].dimensions;
    const result = new WaveFunction(dimensions);

    // Default to equal superposition
    if (!coefficients) {
      coefficients = new Array(waveFunctions.length).fill(
        1 / Math.sqrt(waveFunctions.length)
      );
    }

    // Combine wave functions: |ψ⟩ = Σ cᵢ|ψᵢ⟩
    for (let i = 0; i < dimensions; i++) {
      result.amplitudes[i] = new ComplexNumber(0, 0);

      for (let j = 0; j < waveFunctions.length; j++) {
        const term = waveFunctions[j].amplitudes[i].multiply(coefficients[j]);
        result.amplitudes[i] = result.amplitudes[i].add(term);
      }
    }

    result.normalize();
    return result;
  }

  /**
   * Create entangled state between two wave functions
   */
  static entangle(wf1, wf2, entanglementStrength = 0.5) {
    // Create Bell-like entangled state: |Ψ⟩ = α|ψ₁⟩|ψ₂⟩ + β|ψ₂⟩|ψ₁⟩
    const alpha = Math.sqrt(entanglementStrength);
    const beta = Math.sqrt(1 - entanglementStrength);

    const dimensions = wf1.dimensions * wf2.dimensions;
    const entangled = new WaveFunction(dimensions);

    // Tensor product with entanglement
    let index = 0;
    for (let i = 0; i < wf1.dimensions; i++) {
      for (let j = 0; j < wf2.dimensions; j++) {
        const term1 = wf1.amplitudes[i].multiply(wf2.amplitudes[j]).multiply(alpha);
        const term2 = wf2.amplitudes[j].multiply(wf1.amplitudes[i]).multiply(beta);
        entangled.amplitudes[index] = term1.add(term2);
        index++;
      }
    }

    entangled.normalize();
    return entangled;
  }

  /**
   * Calculate Von Neumann entropy (measure of entanglement)
   */
  entropy() {
    let entropy = 0;

    for (let i = 0; i < this.dimensions; i++) {
      const probability = this.amplitudes[i].magnitudeSquared();
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    }

    return entropy;
  }

  /**
   * Helper: Hash text to create deterministic encoding
   */
  async hashText(text) {
    // Simple hash function for demonstration
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Helper: Calculate phase from text
   */
  calculatePhaseFromText(text) {
    let phase = 0;
    for (let i = 0; i < text.length; i++) {
      phase += text.charCodeAt(i) * 0.01;
    }
    return phase % (2 * Math.PI);
  }

  /**
   * Get probability distribution
   */
  getProbabilityDistribution() {
    return this.amplitudes.map(amp => amp.magnitudeSquared());
  }

  /**
   * Clone the wave function
   */
  clone() {
    const cloned = new WaveFunction(this.dimensions);
    for (let i = 0; i < this.dimensions; i++) {
      cloned.amplitudes[i] = new ComplexNumber(
        this.amplitudes[i].real,
        this.amplitudes[i].imaginary
      );
    }
    cloned.phase = this.phase;
    cloned.normalizationConstant = this.normalizationConstant;
    return cloned;
  }

  /**
   * String representation for debugging
   */
  toString() {
    const maxShow = 5;
    const shown = this.amplitudes.slice(0, maxShow).map(amp => amp.toString());
    const more = this.dimensions > maxShow ? `, ... (${this.dimensions - maxShow} more)` : '';
    return `WaveFunction[${shown.join(', ')}${more}]`;
  }
}

export default WaveFunction;