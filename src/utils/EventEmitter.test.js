import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from './EventEmitter';

describe('EventEmitter', () => {
    let emitter;

    beforeEach(() => {
        emitter = new EventEmitter();
    });

    it('should register and emit events', () => {
        const callback = vi.fn();
        emitter.on('test', callback);
        emitter.emit('test', 'arg1');
        expect(callback).toHaveBeenCalledWith('arg1');
    });

    it('should handle multiple listeners', () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();
        emitter.on('test', callback1);
        emitter.on('test', callback2);
        emitter.emit('test');
        expect(callback1).toHaveBeenCalled();
        expect(callback2).toHaveBeenCalled();
    });

    it('should unsubscribe correctly', () => {
        const callback = vi.fn();
        const unsubscribe = emitter.on('test', callback);
        unsubscribe();
        emitter.emit('test');
        expect(callback).not.toHaveBeenCalled();
    });

    it('should handle once listeners', () => {
        const callback = vi.fn();
        emitter.once('test', callback);
        emitter.emit('test');
        emitter.emit('test');
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should remove all listeners', () => {
        const callback = vi.fn();
        emitter.on('test', callback);
        emitter.removeAllListeners('test');
        emitter.emit('test');
        expect(callback).not.toHaveBeenCalled();
    });

    it('should return listener count', () => {
        emitter.on('test', () => { });
        emitter.on('test', () => { });
        expect(emitter.listenerCount('test')).toBe(2);
    });

    it('should return event names', () => {
        emitter.on('test1', () => { });
        emitter.on('test2', () => { });
        expect(emitter.eventNames()).toContain('test1');
        expect(emitter.eventNames()).toContain('test2');
    });
});
