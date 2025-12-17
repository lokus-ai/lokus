/**
 * Disposable - Resource cleanup helper
 */
export class Disposable {
    constructor(callOnDispose) {
        this._callOnDispose = callOnDispose;
    }

    dispose() {
        if (this._callOnDispose) {
            this._callOnDispose();
            this._callOnDispose = undefined;
        }
    }

    static from(...disposables) {
        return new Disposable(() => {
            disposables.forEach(d => {
                if (d && typeof d.dispose === 'function') {
                    d.dispose();
                }
            });
        });
    }
}
