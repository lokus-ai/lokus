import { describe, it, expect } from 'vitest';
import { CapabilityGate, METHOD_CAPABILITY } from '../gate.js';

describe('CapabilityGate', () => {
  it('denies methods whose capability is not granted', () => {
    const gate = new CapabilityGate('dog', []);
    const d = gate.check('notes.read');
    expect(d.allowed).toBe(false);
    expect(d.capability).toBe('notes.read');
    expect(d.reason).toBe('not-granted');
  });

  it('allows methods whose capability is granted', () => {
    const gate = new CapabilityGate('dog', ['ui', 'notes.read']);
    expect(gate.check('ui.notify').allowed).toBe(true);
    expect(gate.check('notes.read').allowed).toBe(true);
    expect(gate.check('notes.write').allowed).toBe(false);
  });

  it('always allows workspace.info', () => {
    const gate = new CapabilityGate('dog', []);
    expect(gate.check('workspace.info').allowed).toBe(true);
  });

  it('rejects unknown methods', () => {
    const gate = new CapabilityGate('dog', Object.keys(METHOD_CAPABILITY));
    const d = gate.check('steal.everything');
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('unknown-method');
  });

  it('honors grant revocation immediately', () => {
    const gate = new CapabilityGate('dog', ['network']);
    expect(gate.check('network.fetch').allowed).toBe(true);
    gate.setGrants([]);
    expect(gate.check('network.fetch').allowed).toBe(false);
  });

  it('records an audit trail and caps it', () => {
    const gate = new CapabilityGate('dog', []);
    for (let i = 0; i < 250; i += 1) gate.check('notes.read');
    expect(gate.audit.length).toBe(200);
    expect(gate.audit[gate.audit.length - 1].method).toBe('notes.read');
  });

  it('calls the decision callback', () => {
    const decisions = [];
    const gate = new CapabilityGate('dog', ['ui'], (d) => decisions.push(d));
    gate.check('ui.notify');
    gate.check('notes.write');
    expect(decisions).toHaveLength(2);
    expect(decisions[0].allowed).toBe(true);
    expect(decisions[1].allowed).toBe(false);
  });

  it('covers every rpc method with a mapping', () => {
    for (const method of Object.keys(METHOD_CAPABILITY)) {
      const cap = METHOD_CAPABILITY[method];
      expect(cap === null || typeof cap === 'string').toBe(true);
    }
  });
});
