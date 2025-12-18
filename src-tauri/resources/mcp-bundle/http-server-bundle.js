#!/usr/bin/env node
var Uf=Object.create;var Vo=Object.defineProperty;var zf=Object.getOwnPropertyDescriptor;var Hf=Object.getOwnPropertyNames;var Vf=Object.getPrototypeOf,Gf=Object.prototype.hasOwnProperty;var q=(t,e)=>()=>(t&&(e=t(t=0)),e);var Go=(t,e)=>()=>(e||t((e={exports:{}}).exports,e),e.exports),Pe=(t,e)=>{for(var r in e)Vo(t,r,{get:e[r],enumerable:!0})},Jf=(t,e,r,a)=>{if(e&&typeof e=="object"||typeof e=="function")for(let o of Hf(e))!Gf.call(t,o)&&o!==r&&Vo(t,o,{get:()=>e[o],enumerable:!(a=zf(e,o))||a.enumerable});return t};var Be=(t,e,r)=>(r=t!=null?Uf(Vf(t)):{},Jf(e||!t||!t.__esModule?Vo(r,"default",{value:t,enumerable:!0}):r,t));function Qh(t){if(!/^data:/i.test(t))throw new TypeError('`uri` does not appear to be a Data URI (must begin with "data:")');t=t.replace(/\r?\n/g,"");let e=t.indexOf(",");if(e===-1||e<=4)throw new TypeError("malformed data: URI");let r=t.substring(5,e).split(";"),a="",o=!1,i=r[0]||"text/plain",c=i;for(let g=1;g<r.length;g++)r[g]==="base64"?o=!0:r[g]&&(c+=`;${r[g]}`,r[g].indexOf("charset=")===0&&(a=r[g].substring(8)));!r[0]&&!a.length&&(c+=";charset=US-ASCII",a="US-ASCII");let u=o?"base64":"ascii",f=unescape(t.substring(e+1)),d=Buffer.from(f,u);return d.type=i,d.typeFull=c,d.charset=a,d}var zc,Hc=q(()=>{zc=Qh});var Gc=Go((Da,Vc)=>{(function(t,e){typeof Da=="object"&&typeof Vc<"u"?e(Da):typeof define=="function"&&define.amd?define(["exports"],e):(t=typeof globalThis<"u"?globalThis:t||self,e(t.WebStreamsPolyfill={}))})(Da,(function(t){"use strict";function e(){}function r(n){return typeof n=="object"&&n!==null||typeof n=="function"}let a=e;function o(n,s){try{Object.defineProperty(n,"name",{value:s,configurable:!0})}catch{}}let i=Promise,c=Promise.prototype.then,u=Promise.reject.bind(i);function f(n){return new i(n)}function d(n){return f(s=>s(n))}function g(n){return u(n)}function k(n,s,l){return c.call(n,s,l)}function C(n,s,l){k(k(n,s,l),void 0,a)}function D(n,s){C(n,s)}function x(n,s){C(n,void 0,s)}function z(n,s,l){return k(n,s,l)}function B(n){k(n,void 0,a)}let W=n=>{if(typeof queueMicrotask=="function")W=queueMicrotask;else{let s=d(void 0);W=l=>k(s,l)}return W(n)};function Y(n,s,l){if(typeof n!="function")throw new TypeError("Argument is not a function");return Function.prototype.apply.call(n,s,l)}function re(n,s,l){try{return d(Y(n,s,l))}catch(p){return g(p)}}let U=16384;class H{constructor(){this._cursor=0,this._size=0,this._front={_elements:[],_next:void 0},this._back=this._front,this._cursor=0,this._size=0}get length(){return this._size}push(s){let l=this._back,p=l;l._elements.length===U-1&&(p={_elements:[],_next:void 0}),l._elements.push(s),p!==l&&(this._back=p,l._next=p),++this._size}shift(){let s=this._front,l=s,p=this._cursor,m=p+1,b=s._elements,w=b[p];return m===U&&(l=s._next,m=0),--this._size,this._cursor=m,s!==l&&(this._front=l),b[p]=void 0,w}forEach(s){let l=this._cursor,p=this._front,m=p._elements;for(;(l!==m.length||p._next!==void 0)&&!(l===m.length&&(p=p._next,m=p._elements,l=0,m.length===0));)s(m[l]),++l}peek(){let s=this._front,l=this._cursor;return s._elements[l]}}let Q=Symbol("[[AbortSteps]]"),Tt=Symbol("[[ErrorSteps]]"),sn=Symbol("[[CancelSteps]]"),oo=Symbol("[[PullSteps]]"),so=Symbol("[[ReleaseSteps]]");function ai(n,s){n._ownerReadableStream=s,s._reader=n,s._state==="readable"?co(n):s._state==="closed"?Ku(n):oi(n,s._storedError)}function io(n,s){let l=n._ownerReadableStream;return Fe(l,s)}function it(n){let s=n._ownerReadableStream;s._state==="readable"?lo(n,new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")):Xu(n,new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")),s._readableStreamController[so](),s._reader=void 0,n._ownerReadableStream=void 0}function Gn(n){return new TypeError("Cannot "+n+" a stream using a released reader")}function co(n){n._closedPromise=f((s,l)=>{n._closedPromise_resolve=s,n._closedPromise_reject=l})}function oi(n,s){co(n),lo(n,s)}function Ku(n){co(n),si(n)}function lo(n,s){n._closedPromise_reject!==void 0&&(B(n._closedPromise),n._closedPromise_reject(s),n._closedPromise_resolve=void 0,n._closedPromise_reject=void 0)}function Xu(n,s){oi(n,s)}function si(n){n._closedPromise_resolve!==void 0&&(n._closedPromise_resolve(void 0),n._closedPromise_resolve=void 0,n._closedPromise_reject=void 0)}let ii=Number.isFinite||function(n){return typeof n=="number"&&isFinite(n)},ed=Math.trunc||function(n){return n<0?Math.ceil(n):Math.floor(n)};function td(n){return typeof n=="object"||typeof n=="function"}function Ye(n,s){if(n!==void 0&&!td(n))throw new TypeError(`${s} is not an object.`)}function Ee(n,s){if(typeof n!="function")throw new TypeError(`${s} is not a function.`)}function rd(n){return typeof n=="object"&&n!==null||typeof n=="function"}function ci(n,s){if(!rd(n))throw new TypeError(`${s} is not an object.`)}function ct(n,s,l){if(n===void 0)throw new TypeError(`Parameter ${s} is required in '${l}'.`)}function uo(n,s,l){if(n===void 0)throw new TypeError(`${s} is required in '${l}'.`)}function fo(n){return Number(n)}function li(n){return n===0?0:n}function nd(n){return li(ed(n))}function po(n,s){let p=Number.MAX_SAFE_INTEGER,m=Number(n);if(m=li(m),!ii(m))throw new TypeError(`${s} is not a finite number`);if(m=nd(m),m<0||m>p)throw new TypeError(`${s} is outside the accepted range of 0 to ${p}, inclusive`);return!ii(m)||m===0?0:m}function ho(n,s){if(!It(n))throw new TypeError(`${s} is not a ReadableStream.`)}function Ir(n){return new Ct(n)}function ui(n,s){n._reader._readRequests.push(s)}function mo(n,s,l){let m=n._reader._readRequests.shift();l?m._closeSteps():m._chunkSteps(s)}function Jn(n){return n._reader._readRequests.length}function di(n){let s=n._reader;return!(s===void 0||!Rt(s))}class Ct{constructor(s){if(ct(s,1,"ReadableStreamDefaultReader"),ho(s,"First parameter"),Ot(s))throw new TypeError("This stream has already been locked for exclusive reading by another reader");ai(this,s),this._readRequests=new H}get closed(){return Rt(this)?this._closedPromise:g(Zn("closed"))}cancel(s=void 0){return Rt(this)?this._ownerReadableStream===void 0?g(Gn("cancel")):io(this,s):g(Zn("cancel"))}read(){if(!Rt(this))return g(Zn("read"));if(this._ownerReadableStream===void 0)return g(Gn("read from"));let s,l,p=f((b,w)=>{s=b,l=w});return cn(this,{_chunkSteps:b=>s({value:b,done:!1}),_closeSteps:()=>s({value:void 0,done:!0}),_errorSteps:b=>l(b)}),p}releaseLock(){if(!Rt(this))throw Zn("releaseLock");this._ownerReadableStream!==void 0&&ad(this)}}Object.defineProperties(Ct.prototype,{cancel:{enumerable:!0},read:{enumerable:!0},releaseLock:{enumerable:!0},closed:{enumerable:!0}}),o(Ct.prototype.cancel,"cancel"),o(Ct.prototype.read,"read"),o(Ct.prototype.releaseLock,"releaseLock"),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(Ct.prototype,Symbol.toStringTag,{value:"ReadableStreamDefaultReader",configurable:!0});function Rt(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_readRequests")?!1:n instanceof Ct}function cn(n,s){let l=n._ownerReadableStream;l._disturbed=!0,l._state==="closed"?s._closeSteps():l._state==="errored"?s._errorSteps(l._storedError):l._readableStreamController[oo](s)}function ad(n){it(n);let s=new TypeError("Reader was released");fi(n,s)}function fi(n,s){let l=n._readRequests;n._readRequests=new H,l.forEach(p=>{p._errorSteps(s)})}function Zn(n){return new TypeError(`ReadableStreamDefaultReader.prototype.${n} can only be used on a ReadableStreamDefaultReader`)}let od=Object.getPrototypeOf(Object.getPrototypeOf(async function*(){}).prototype);class pi{constructor(s,l){this._ongoingPromise=void 0,this._isFinished=!1,this._reader=s,this._preventCancel=l}next(){let s=()=>this._nextSteps();return this._ongoingPromise=this._ongoingPromise?z(this._ongoingPromise,s,s):s(),this._ongoingPromise}return(s){let l=()=>this._returnSteps(s);return this._ongoingPromise?z(this._ongoingPromise,l,l):l()}_nextSteps(){if(this._isFinished)return Promise.resolve({value:void 0,done:!0});let s=this._reader,l,p,m=f((w,v)=>{l=w,p=v});return cn(s,{_chunkSteps:w=>{this._ongoingPromise=void 0,W(()=>l({value:w,done:!1}))},_closeSteps:()=>{this._ongoingPromise=void 0,this._isFinished=!0,it(s),l({value:void 0,done:!0})},_errorSteps:w=>{this._ongoingPromise=void 0,this._isFinished=!0,it(s),p(w)}}),m}_returnSteps(s){if(this._isFinished)return Promise.resolve({value:s,done:!0});this._isFinished=!0;let l=this._reader;if(!this._preventCancel){let p=io(l,s);return it(l),z(p,()=>({value:s,done:!0}))}return it(l),d({value:s,done:!0})}}let hi={next(){return mi(this)?this._asyncIteratorImpl.next():g(gi("next"))},return(n){return mi(this)?this._asyncIteratorImpl.return(n):g(gi("return"))}};Object.setPrototypeOf(hi,od);function sd(n,s){let l=Ir(n),p=new pi(l,s),m=Object.create(hi);return m._asyncIteratorImpl=p,m}function mi(n){if(!r(n)||!Object.prototype.hasOwnProperty.call(n,"_asyncIteratorImpl"))return!1;try{return n._asyncIteratorImpl instanceof pi}catch{return!1}}function gi(n){return new TypeError(`ReadableStreamAsyncIterator.${n} can only be used on a ReadableSteamAsyncIterator`)}let yi=Number.isNaN||function(n){return n!==n};var go,yo,bo;function ln(n){return n.slice()}function bi(n,s,l,p,m){new Uint8Array(n).set(new Uint8Array(l,p,m),s)}let lt=n=>(typeof n.transfer=="function"?lt=s=>s.transfer():typeof structuredClone=="function"?lt=s=>structuredClone(s,{transfer:[s]}):lt=s=>s,lt(n)),Et=n=>(typeof n.detached=="boolean"?Et=s=>s.detached:Et=s=>s.byteLength===0,Et(n));function wi(n,s,l){if(n.slice)return n.slice(s,l);let p=l-s,m=new ArrayBuffer(p);return bi(m,0,n,s,p),m}function Yn(n,s){let l=n[s];if(l!=null){if(typeof l!="function")throw new TypeError(`${String(s)} is not a function`);return l}}function id(n){let s={[Symbol.iterator]:()=>n.iterator},l=(async function*(){return yield*s})(),p=l.next;return{iterator:l,nextMethod:p,done:!1}}let wo=(bo=(go=Symbol.asyncIterator)!==null&&go!==void 0?go:(yo=Symbol.for)===null||yo===void 0?void 0:yo.call(Symbol,"Symbol.asyncIterator"))!==null&&bo!==void 0?bo:"@@asyncIterator";function _i(n,s="sync",l){if(l===void 0)if(s==="async"){if(l=Yn(n,wo),l===void 0){let b=Yn(n,Symbol.iterator),w=_i(n,"sync",b);return id(w)}}else l=Yn(n,Symbol.iterator);if(l===void 0)throw new TypeError("The object is not iterable");let p=Y(l,n,[]);if(!r(p))throw new TypeError("The iterator method must return an object");let m=p.next;return{iterator:p,nextMethod:m,done:!1}}function cd(n){let s=Y(n.nextMethod,n.iterator,[]);if(!r(s))throw new TypeError("The iterator.next() method must return an object");return s}function ld(n){return!!n.done}function ud(n){return n.value}function dd(n){return!(typeof n!="number"||yi(n)||n<0)}function Si(n){let s=wi(n.buffer,n.byteOffset,n.byteOffset+n.byteLength);return new Uint8Array(s)}function _o(n){let s=n._queue.shift();return n._queueTotalSize-=s.size,n._queueTotalSize<0&&(n._queueTotalSize=0),s.value}function So(n,s,l){if(!dd(l)||l===1/0)throw new RangeError("Size must be a finite, non-NaN, non-negative number.");n._queue.push({value:s,size:l}),n._queueTotalSize+=l}function fd(n){return n._queue.peek().value}function At(n){n._queue=new H,n._queueTotalSize=0}function ki(n){return n===DataView}function pd(n){return ki(n.constructor)}function hd(n){return ki(n)?1:n.BYTES_PER_ELEMENT}class Vt{constructor(){throw new TypeError("Illegal constructor")}get view(){if(!ko(this))throw Ro("view");return this._view}respond(s){if(!ko(this))throw Ro("respond");if(ct(s,1,"respond"),s=po(s,"First parameter"),this._associatedReadableByteStreamController===void 0)throw new TypeError("This BYOB request has been invalidated");if(Et(this._view.buffer))throw new TypeError("The BYOB request's buffer has been detached and so cannot be used as a response");ea(this._associatedReadableByteStreamController,s)}respondWithNewView(s){if(!ko(this))throw Ro("respondWithNewView");if(ct(s,1,"respondWithNewView"),!ArrayBuffer.isView(s))throw new TypeError("You can only respond with array buffer views");if(this._associatedReadableByteStreamController===void 0)throw new TypeError("This BYOB request has been invalidated");if(Et(s.buffer))throw new TypeError("The given view's buffer has been detached and so cannot be used as a response");ta(this._associatedReadableByteStreamController,s)}}Object.defineProperties(Vt.prototype,{respond:{enumerable:!0},respondWithNewView:{enumerable:!0},view:{enumerable:!0}}),o(Vt.prototype.respond,"respond"),o(Vt.prototype.respondWithNewView,"respondWithNewView"),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(Vt.prototype,Symbol.toStringTag,{value:"ReadableStreamBYOBRequest",configurable:!0});class ut{constructor(){throw new TypeError("Illegal constructor")}get byobRequest(){if(!Gt(this))throw dn("byobRequest");return Co(this)}get desiredSize(){if(!Gt(this))throw dn("desiredSize");return Ii(this)}close(){if(!Gt(this))throw dn("close");if(this._closeRequested)throw new TypeError("The stream has already been closed; do not close it again!");let s=this._controlledReadableByteStream._state;if(s!=="readable")throw new TypeError(`The stream (in ${s} state) is not in the readable state and cannot be closed`);un(this)}enqueue(s){if(!Gt(this))throw dn("enqueue");if(ct(s,1,"enqueue"),!ArrayBuffer.isView(s))throw new TypeError("chunk must be an array buffer view");if(s.byteLength===0)throw new TypeError("chunk must have non-zero byteLength");if(s.buffer.byteLength===0)throw new TypeError("chunk's buffer must have non-zero byteLength");if(this._closeRequested)throw new TypeError("stream is closed or draining");let l=this._controlledReadableByteStream._state;if(l!=="readable")throw new TypeError(`The stream (in ${l} state) is not in the readable state and cannot be enqueued to`);Xn(this,s)}error(s=void 0){if(!Gt(this))throw dn("error");Ae(this,s)}[sn](s){xi(this),At(this);let l=this._cancelAlgorithm(s);return Kn(this),l}[oo](s){let l=this._controlledReadableByteStream;if(this._queueTotalSize>0){Pi(this,s);return}let p=this._autoAllocateChunkSize;if(p!==void 0){let m;try{m=new ArrayBuffer(p)}catch(w){s._errorSteps(w);return}let b={buffer:m,bufferByteLength:p,byteOffset:0,byteLength:p,bytesFilled:0,minimumFill:1,elementSize:1,viewConstructor:Uint8Array,readerType:"default"};this._pendingPullIntos.push(b)}ui(l,s),Jt(this)}[so](){if(this._pendingPullIntos.length>0){let s=this._pendingPullIntos.peek();s.readerType="none",this._pendingPullIntos=new H,this._pendingPullIntos.push(s)}}}Object.defineProperties(ut.prototype,{close:{enumerable:!0},enqueue:{enumerable:!0},error:{enumerable:!0},byobRequest:{enumerable:!0},desiredSize:{enumerable:!0}}),o(ut.prototype.close,"close"),o(ut.prototype.enqueue,"enqueue"),o(ut.prototype.error,"error"),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(ut.prototype,Symbol.toStringTag,{value:"ReadableByteStreamController",configurable:!0});function Gt(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_controlledReadableByteStream")?!1:n instanceof ut}function ko(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_associatedReadableByteStreamController")?!1:n instanceof Vt}function Jt(n){if(!wd(n))return;if(n._pulling){n._pullAgain=!0;return}n._pulling=!0;let l=n._pullAlgorithm();C(l,()=>(n._pulling=!1,n._pullAgain&&(n._pullAgain=!1,Jt(n)),null),p=>(Ae(n,p),null))}function xi(n){vo(n),n._pendingPullIntos=new H}function xo(n,s){let l=!1;n._state==="closed"&&(l=!0);let p=vi(s);s.readerType==="default"?mo(n,p,l):Td(n,p,l)}function vi(n){let s=n.bytesFilled,l=n.elementSize;return new n.viewConstructor(n.buffer,n.byteOffset,s/l)}function Qn(n,s,l,p){n._queue.push({buffer:s,byteOffset:l,byteLength:p}),n._queueTotalSize+=p}function Ti(n,s,l,p){let m;try{m=wi(s,l,l+p)}catch(b){throw Ae(n,b),b}Qn(n,m,0,p)}function Ci(n,s){s.bytesFilled>0&&Ti(n,s.buffer,s.byteOffset,s.bytesFilled),Or(n)}function Ri(n,s){let l=Math.min(n._queueTotalSize,s.byteLength-s.bytesFilled),p=s.bytesFilled+l,m=l,b=!1,w=p%s.elementSize,v=p-w;v>=s.minimumFill&&(m=v-s.bytesFilled,b=!0);let I=n._queue;for(;m>0;){let E=I.peek(),O=Math.min(m,E.byteLength),M=s.byteOffset+s.bytesFilled;bi(s.buffer,M,E.buffer,E.byteOffset,O),E.byteLength===O?I.shift():(E.byteOffset+=O,E.byteLength-=O),n._queueTotalSize-=O,Ei(n,O,s),m-=O}return b}function Ei(n,s,l){l.bytesFilled+=s}function Ai(n){n._queueTotalSize===0&&n._closeRequested?(Kn(n),yn(n._controlledReadableByteStream)):Jt(n)}function vo(n){n._byobRequest!==null&&(n._byobRequest._associatedReadableByteStreamController=void 0,n._byobRequest._view=null,n._byobRequest=null)}function To(n){for(;n._pendingPullIntos.length>0;){if(n._queueTotalSize===0)return;let s=n._pendingPullIntos.peek();Ri(n,s)&&(Or(n),xo(n._controlledReadableByteStream,s))}}function md(n){let s=n._controlledReadableByteStream._reader;for(;s._readRequests.length>0;){if(n._queueTotalSize===0)return;let l=s._readRequests.shift();Pi(n,l)}}function gd(n,s,l,p){let m=n._controlledReadableByteStream,b=s.constructor,w=hd(b),{byteOffset:v,byteLength:I}=s,E=l*w,O;try{O=lt(s.buffer)}catch(G){p._errorSteps(G);return}let M={buffer:O,bufferByteLength:O.byteLength,byteOffset:v,byteLength:I,bytesFilled:0,minimumFill:E,elementSize:w,viewConstructor:b,readerType:"byob"};if(n._pendingPullIntos.length>0){n._pendingPullIntos.push(M),Li(m,p);return}if(m._state==="closed"){let G=new b(M.buffer,M.byteOffset,0);p._closeSteps(G);return}if(n._queueTotalSize>0){if(Ri(n,M)){let G=vi(M);Ai(n),p._chunkSteps(G);return}if(n._closeRequested){let G=new TypeError("Insufficient bytes to fill elements in the given buffer");Ae(n,G),p._errorSteps(G);return}}n._pendingPullIntos.push(M),Li(m,p),Jt(n)}function yd(n,s){s.readerType==="none"&&Or(n);let l=n._controlledReadableByteStream;if(Eo(l))for(;Ni(l)>0;){let p=Or(n);xo(l,p)}}function bd(n,s,l){if(Ei(n,s,l),l.readerType==="none"){Ci(n,l),To(n);return}if(l.bytesFilled<l.minimumFill)return;Or(n);let p=l.bytesFilled%l.elementSize;if(p>0){let m=l.byteOffset+l.bytesFilled;Ti(n,l.buffer,m-p,p)}l.bytesFilled-=p,xo(n._controlledReadableByteStream,l),To(n)}function $i(n,s){let l=n._pendingPullIntos.peek();vo(n),n._controlledReadableByteStream._state==="closed"?yd(n,l):bd(n,s,l),Jt(n)}function Or(n){return n._pendingPullIntos.shift()}function wd(n){let s=n._controlledReadableByteStream;return s._state!=="readable"||n._closeRequested||!n._started?!1:!!(di(s)&&Jn(s)>0||Eo(s)&&Ni(s)>0||Ii(n)>0)}function Kn(n){n._pullAlgorithm=void 0,n._cancelAlgorithm=void 0}function un(n){let s=n._controlledReadableByteStream;if(!(n._closeRequested||s._state!=="readable")){if(n._queueTotalSize>0){n._closeRequested=!0;return}if(n._pendingPullIntos.length>0){let l=n._pendingPullIntos.peek();if(l.bytesFilled%l.elementSize!==0){let p=new TypeError("Insufficient bytes to fill elements in the given buffer");throw Ae(n,p),p}}Kn(n),yn(s)}}function Xn(n,s){let l=n._controlledReadableByteStream;if(n._closeRequested||l._state!=="readable")return;let{buffer:p,byteOffset:m,byteLength:b}=s;if(Et(p))throw new TypeError("chunk's buffer is detached and so cannot be enqueued");let w=lt(p);if(n._pendingPullIntos.length>0){let v=n._pendingPullIntos.peek();if(Et(v.buffer))throw new TypeError("The BYOB request's buffer has been detached and so cannot be filled with an enqueued chunk");vo(n),v.buffer=lt(v.buffer),v.readerType==="none"&&Ci(n,v)}if(di(l))if(md(n),Jn(l)===0)Qn(n,w,m,b);else{n._pendingPullIntos.length>0&&Or(n);let v=new Uint8Array(w,m,b);mo(l,v,!1)}else Eo(l)?(Qn(n,w,m,b),To(n)):Qn(n,w,m,b);Jt(n)}function Ae(n,s){let l=n._controlledReadableByteStream;l._state==="readable"&&(xi(n),At(n),Kn(n),sc(l,s))}function Pi(n,s){let l=n._queue.shift();n._queueTotalSize-=l.byteLength,Ai(n);let p=new Uint8Array(l.buffer,l.byteOffset,l.byteLength);s._chunkSteps(p)}function Co(n){if(n._byobRequest===null&&n._pendingPullIntos.length>0){let s=n._pendingPullIntos.peek(),l=new Uint8Array(s.buffer,s.byteOffset+s.bytesFilled,s.byteLength-s.bytesFilled),p=Object.create(Vt.prototype);Sd(p,n,l),n._byobRequest=p}return n._byobRequest}function Ii(n){let s=n._controlledReadableByteStream._state;return s==="errored"?null:s==="closed"?0:n._strategyHWM-n._queueTotalSize}function ea(n,s){let l=n._pendingPullIntos.peek();if(n._controlledReadableByteStream._state==="closed"){if(s!==0)throw new TypeError("bytesWritten must be 0 when calling respond() on a closed stream")}else{if(s===0)throw new TypeError("bytesWritten must be greater than 0 when calling respond() on a readable stream");if(l.bytesFilled+s>l.byteLength)throw new RangeError("bytesWritten out of range")}l.buffer=lt(l.buffer),$i(n,s)}function ta(n,s){let l=n._pendingPullIntos.peek();if(n._controlledReadableByteStream._state==="closed"){if(s.byteLength!==0)throw new TypeError("The view's length must be 0 when calling respondWithNewView() on a closed stream")}else if(s.byteLength===0)throw new TypeError("The view's length must be greater than 0 when calling respondWithNewView() on a readable stream");if(l.byteOffset+l.bytesFilled!==s.byteOffset)throw new RangeError("The region specified by view does not match byobRequest");if(l.bufferByteLength!==s.buffer.byteLength)throw new RangeError("The buffer of view has different capacity than byobRequest");if(l.bytesFilled+s.byteLength>l.byteLength)throw new RangeError("The region specified by view is larger than byobRequest");let m=s.byteLength;l.buffer=lt(s.buffer),$i(n,m)}function Oi(n,s,l,p,m,b,w){s._controlledReadableByteStream=n,s._pullAgain=!1,s._pulling=!1,s._byobRequest=null,s._queue=s._queueTotalSize=void 0,At(s),s._closeRequested=!1,s._started=!1,s._strategyHWM=b,s._pullAlgorithm=p,s._cancelAlgorithm=m,s._autoAllocateChunkSize=w,s._pendingPullIntos=new H,n._readableStreamController=s;let v=l();C(d(v),()=>(s._started=!0,Jt(s),null),I=>(Ae(s,I),null))}function _d(n,s,l){let p=Object.create(ut.prototype),m,b,w;s.start!==void 0?m=()=>s.start(p):m=()=>{},s.pull!==void 0?b=()=>s.pull(p):b=()=>d(void 0),s.cancel!==void 0?w=I=>s.cancel(I):w=()=>d(void 0);let v=s.autoAllocateChunkSize;if(v===0)throw new TypeError("autoAllocateChunkSize must be greater than 0");Oi(n,p,m,b,w,l,v)}function Sd(n,s,l){n._associatedReadableByteStreamController=s,n._view=l}function Ro(n){return new TypeError(`ReadableStreamBYOBRequest.prototype.${n} can only be used on a ReadableStreamBYOBRequest`)}function dn(n){return new TypeError(`ReadableByteStreamController.prototype.${n} can only be used on a ReadableByteStreamController`)}function kd(n,s){Ye(n,s);let l=n?.mode;return{mode:l===void 0?void 0:xd(l,`${s} has member 'mode' that`)}}function xd(n,s){if(n=`${n}`,n!=="byob")throw new TypeError(`${s} '${n}' is not a valid enumeration value for ReadableStreamReaderMode`);return n}function vd(n,s){var l;Ye(n,s);let p=(l=n?.min)!==null&&l!==void 0?l:1;return{min:po(p,`${s} has member 'min' that`)}}function Di(n){return new $t(n)}function Li(n,s){n._reader._readIntoRequests.push(s)}function Td(n,s,l){let m=n._reader._readIntoRequests.shift();l?m._closeSteps(s):m._chunkSteps(s)}function Ni(n){return n._reader._readIntoRequests.length}function Eo(n){let s=n._reader;return!(s===void 0||!Zt(s))}class $t{constructor(s){if(ct(s,1,"ReadableStreamBYOBReader"),ho(s,"First parameter"),Ot(s))throw new TypeError("This stream has already been locked for exclusive reading by another reader");if(!Gt(s._readableStreamController))throw new TypeError("Cannot construct a ReadableStreamBYOBReader for a stream not constructed with a byte source");ai(this,s),this._readIntoRequests=new H}get closed(){return Zt(this)?this._closedPromise:g(ra("closed"))}cancel(s=void 0){return Zt(this)?this._ownerReadableStream===void 0?g(Gn("cancel")):io(this,s):g(ra("cancel"))}read(s,l={}){if(!Zt(this))return g(ra("read"));if(!ArrayBuffer.isView(s))return g(new TypeError("view must be an array buffer view"));if(s.byteLength===0)return g(new TypeError("view must have non-zero byteLength"));if(s.buffer.byteLength===0)return g(new TypeError("view's buffer must have non-zero byteLength"));if(Et(s.buffer))return g(new TypeError("view's buffer has been detached"));let p;try{p=vd(l,"options")}catch(E){return g(E)}let m=p.min;if(m===0)return g(new TypeError("options.min must be greater than 0"));if(pd(s)){if(m>s.byteLength)return g(new RangeError("options.min must be less than or equal to view's byteLength"))}else if(m>s.length)return g(new RangeError("options.min must be less than or equal to view's length"));if(this._ownerReadableStream===void 0)return g(Gn("read from"));let b,w,v=f((E,O)=>{b=E,w=O});return Mi(this,s,m,{_chunkSteps:E=>b({value:E,done:!1}),_closeSteps:E=>b({value:E,done:!0}),_errorSteps:E=>w(E)}),v}releaseLock(){if(!Zt(this))throw ra("releaseLock");this._ownerReadableStream!==void 0&&Cd(this)}}Object.defineProperties($t.prototype,{cancel:{enumerable:!0},read:{enumerable:!0},releaseLock:{enumerable:!0},closed:{enumerable:!0}}),o($t.prototype.cancel,"cancel"),o($t.prototype.read,"read"),o($t.prototype.releaseLock,"releaseLock"),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty($t.prototype,Symbol.toStringTag,{value:"ReadableStreamBYOBReader",configurable:!0});function Zt(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_readIntoRequests")?!1:n instanceof $t}function Mi(n,s,l,p){let m=n._ownerReadableStream;m._disturbed=!0,m._state==="errored"?p._errorSteps(m._storedError):gd(m._readableStreamController,s,l,p)}function Cd(n){it(n);let s=new TypeError("Reader was released");ji(n,s)}function ji(n,s){let l=n._readIntoRequests;n._readIntoRequests=new H,l.forEach(p=>{p._errorSteps(s)})}function ra(n){return new TypeError(`ReadableStreamBYOBReader.prototype.${n} can only be used on a ReadableStreamBYOBReader`)}function fn(n,s){let{highWaterMark:l}=n;if(l===void 0)return s;if(yi(l)||l<0)throw new RangeError("Invalid highWaterMark");return l}function na(n){let{size:s}=n;return s||(()=>1)}function aa(n,s){Ye(n,s);let l=n?.highWaterMark,p=n?.size;return{highWaterMark:l===void 0?void 0:fo(l),size:p===void 0?void 0:Rd(p,`${s} has member 'size' that`)}}function Rd(n,s){return Ee(n,s),l=>fo(n(l))}function Ed(n,s){Ye(n,s);let l=n?.abort,p=n?.close,m=n?.start,b=n?.type,w=n?.write;return{abort:l===void 0?void 0:Ad(l,n,`${s} has member 'abort' that`),close:p===void 0?void 0:$d(p,n,`${s} has member 'close' that`),start:m===void 0?void 0:Pd(m,n,`${s} has member 'start' that`),write:w===void 0?void 0:Id(w,n,`${s} has member 'write' that`),type:b}}function Ad(n,s,l){return Ee(n,l),p=>re(n,s,[p])}function $d(n,s,l){return Ee(n,l),()=>re(n,s,[])}function Pd(n,s,l){return Ee(n,l),p=>Y(n,s,[p])}function Id(n,s,l){return Ee(n,l),(p,m)=>re(n,s,[p,m])}function Fi(n,s){if(!Dr(n))throw new TypeError(`${s} is not a WritableStream.`)}function Od(n){if(typeof n!="object"||n===null)return!1;try{return typeof n.aborted=="boolean"}catch{return!1}}let Dd=typeof AbortController=="function";function Ld(){if(Dd)return new AbortController}class Pt{constructor(s={},l={}){s===void 0?s=null:ci(s,"First parameter");let p=aa(l,"Second parameter"),m=Ed(s,"First parameter");if(Bi(this),m.type!==void 0)throw new RangeError("Invalid type is specified");let w=na(p),v=fn(p,1);Zd(this,m,v,w)}get locked(){if(!Dr(this))throw la("locked");return Lr(this)}abort(s=void 0){return Dr(this)?Lr(this)?g(new TypeError("Cannot abort a stream that already has a writer")):oa(this,s):g(la("abort"))}close(){return Dr(this)?Lr(this)?g(new TypeError("Cannot close a stream that already has a writer")):Qe(this)?g(new TypeError("Cannot close an already-closing stream")):qi(this):g(la("close"))}getWriter(){if(!Dr(this))throw la("getWriter");return Wi(this)}}Object.defineProperties(Pt.prototype,{abort:{enumerable:!0},close:{enumerable:!0},getWriter:{enumerable:!0},locked:{enumerable:!0}}),o(Pt.prototype.abort,"abort"),o(Pt.prototype.close,"close"),o(Pt.prototype.getWriter,"getWriter"),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(Pt.prototype,Symbol.toStringTag,{value:"WritableStream",configurable:!0});function Wi(n){return new dt(n)}function Nd(n,s,l,p,m=1,b=()=>1){let w=Object.create(Pt.prototype);Bi(w);let v=Object.create(Nr.prototype);return Ji(w,v,n,s,l,p,m,b),w}function Bi(n){n._state="writable",n._storedError=void 0,n._writer=void 0,n._writableStreamController=void 0,n._writeRequests=new H,n._inFlightWriteRequest=void 0,n._closeRequest=void 0,n._inFlightCloseRequest=void 0,n._pendingAbortRequest=void 0,n._backpressure=!1}function Dr(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_writableStreamController")?!1:n instanceof Pt}function Lr(n){return n._writer!==void 0}function oa(n,s){var l;if(n._state==="closed"||n._state==="errored")return d(void 0);n._writableStreamController._abortReason=s,(l=n._writableStreamController._abortController)===null||l===void 0||l.abort(s);let p=n._state;if(p==="closed"||p==="errored")return d(void 0);if(n._pendingAbortRequest!==void 0)return n._pendingAbortRequest._promise;let m=!1;p==="erroring"&&(m=!0,s=void 0);let b=f((w,v)=>{n._pendingAbortRequest={_promise:void 0,_resolve:w,_reject:v,_reason:s,_wasAlreadyErroring:m}});return n._pendingAbortRequest._promise=b,m||$o(n,s),b}function qi(n){let s=n._state;if(s==="closed"||s==="errored")return g(new TypeError(`The stream (in ${s} state) is not in the writable state and cannot be closed`));let l=f((m,b)=>{let w={_resolve:m,_reject:b};n._closeRequest=w}),p=n._writer;return p!==void 0&&n._backpressure&&s==="writable"&&jo(p),Yd(n._writableStreamController),l}function Md(n){return f((l,p)=>{let m={_resolve:l,_reject:p};n._writeRequests.push(m)})}function Ao(n,s){if(n._state==="writable"){$o(n,s);return}Po(n)}function $o(n,s){let l=n._writableStreamController;n._state="erroring",n._storedError=s;let p=n._writer;p!==void 0&&zi(p,s),!qd(n)&&l._started&&Po(n)}function Po(n){n._state="errored",n._writableStreamController[Tt]();let s=n._storedError;if(n._writeRequests.forEach(m=>{m._reject(s)}),n._writeRequests=new H,n._pendingAbortRequest===void 0){sa(n);return}let l=n._pendingAbortRequest;if(n._pendingAbortRequest=void 0,l._wasAlreadyErroring){l._reject(s),sa(n);return}let p=n._writableStreamController[Q](l._reason);C(p,()=>(l._resolve(),sa(n),null),m=>(l._reject(m),sa(n),null))}function jd(n){n._inFlightWriteRequest._resolve(void 0),n._inFlightWriteRequest=void 0}function Fd(n,s){n._inFlightWriteRequest._reject(s),n._inFlightWriteRequest=void 0,Ao(n,s)}function Wd(n){n._inFlightCloseRequest._resolve(void 0),n._inFlightCloseRequest=void 0,n._state==="erroring"&&(n._storedError=void 0,n._pendingAbortRequest!==void 0&&(n._pendingAbortRequest._resolve(),n._pendingAbortRequest=void 0)),n._state="closed";let l=n._writer;l!==void 0&&Ki(l)}function Bd(n,s){n._inFlightCloseRequest._reject(s),n._inFlightCloseRequest=void 0,n._pendingAbortRequest!==void 0&&(n._pendingAbortRequest._reject(s),n._pendingAbortRequest=void 0),Ao(n,s)}function Qe(n){return!(n._closeRequest===void 0&&n._inFlightCloseRequest===void 0)}function qd(n){return!(n._inFlightWriteRequest===void 0&&n._inFlightCloseRequest===void 0)}function Ud(n){n._inFlightCloseRequest=n._closeRequest,n._closeRequest=void 0}function zd(n){n._inFlightWriteRequest=n._writeRequests.shift()}function sa(n){n._closeRequest!==void 0&&(n._closeRequest._reject(n._storedError),n._closeRequest=void 0);let s=n._writer;s!==void 0&&No(s,n._storedError)}function Io(n,s){let l=n._writer;l!==void 0&&s!==n._backpressure&&(s?nf(l):jo(l)),n._backpressure=s}class dt{constructor(s){if(ct(s,1,"WritableStreamDefaultWriter"),Fi(s,"First parameter"),Lr(s))throw new TypeError("This stream has already been locked for exclusive writing by another writer");this._ownerWritableStream=s,s._writer=this;let l=s._state;if(l==="writable")!Qe(s)&&s._backpressure?da(this):Xi(this),ua(this);else if(l==="erroring")Mo(this,s._storedError),ua(this);else if(l==="closed")Xi(this),tf(this);else{let p=s._storedError;Mo(this,p),Qi(this,p)}}get closed(){return Yt(this)?this._closedPromise:g(Qt("closed"))}get desiredSize(){if(!Yt(this))throw Qt("desiredSize");if(this._ownerWritableStream===void 0)throw hn("desiredSize");return Jd(this)}get ready(){return Yt(this)?this._readyPromise:g(Qt("ready"))}abort(s=void 0){return Yt(this)?this._ownerWritableStream===void 0?g(hn("abort")):Hd(this,s):g(Qt("abort"))}close(){if(!Yt(this))return g(Qt("close"));let s=this._ownerWritableStream;return s===void 0?g(hn("close")):Qe(s)?g(new TypeError("Cannot close an already-closing stream")):Ui(this)}releaseLock(){if(!Yt(this))throw Qt("releaseLock");this._ownerWritableStream!==void 0&&Hi(this)}write(s=void 0){return Yt(this)?this._ownerWritableStream===void 0?g(hn("write to")):Vi(this,s):g(Qt("write"))}}Object.defineProperties(dt.prototype,{abort:{enumerable:!0},close:{enumerable:!0},releaseLock:{enumerable:!0},write:{enumerable:!0},closed:{enumerable:!0},desiredSize:{enumerable:!0},ready:{enumerable:!0}}),o(dt.prototype.abort,"abort"),o(dt.prototype.close,"close"),o(dt.prototype.releaseLock,"releaseLock"),o(dt.prototype.write,"write"),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(dt.prototype,Symbol.toStringTag,{value:"WritableStreamDefaultWriter",configurable:!0});function Yt(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_ownerWritableStream")?!1:n instanceof dt}function Hd(n,s){let l=n._ownerWritableStream;return oa(l,s)}function Ui(n){let s=n._ownerWritableStream;return qi(s)}function Vd(n){let s=n._ownerWritableStream,l=s._state;return Qe(s)||l==="closed"?d(void 0):l==="errored"?g(s._storedError):Ui(n)}function Gd(n,s){n._closedPromiseState==="pending"?No(n,s):rf(n,s)}function zi(n,s){n._readyPromiseState==="pending"?ec(n,s):af(n,s)}function Jd(n){let s=n._ownerWritableStream,l=s._state;return l==="errored"||l==="erroring"?null:l==="closed"?0:Zi(s._writableStreamController)}function Hi(n){let s=n._ownerWritableStream,l=new TypeError("Writer was released and can no longer be used to monitor the stream's closedness");zi(n,l),Gd(n,l),s._writer=void 0,n._ownerWritableStream=void 0}function Vi(n,s){let l=n._ownerWritableStream,p=l._writableStreamController,m=Qd(p,s);if(l!==n._ownerWritableStream)return g(hn("write to"));let b=l._state;if(b==="errored")return g(l._storedError);if(Qe(l)||b==="closed")return g(new TypeError("The stream is closing or closed and cannot be written to"));if(b==="erroring")return g(l._storedError);let w=Md(l);return Kd(p,s,m),w}let Gi={};class Nr{constructor(){throw new TypeError("Illegal constructor")}get abortReason(){if(!Oo(this))throw Lo("abortReason");return this._abortReason}get signal(){if(!Oo(this))throw Lo("signal");if(this._abortController===void 0)throw new TypeError("WritableStreamDefaultController.prototype.signal is not supported");return this._abortController.signal}error(s=void 0){if(!Oo(this))throw Lo("error");this._controlledWritableStream._state==="writable"&&Yi(this,s)}[Q](s){let l=this._abortAlgorithm(s);return ia(this),l}[Tt](){At(this)}}Object.defineProperties(Nr.prototype,{abortReason:{enumerable:!0},signal:{enumerable:!0},error:{enumerable:!0}}),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(Nr.prototype,Symbol.toStringTag,{value:"WritableStreamDefaultController",configurable:!0});function Oo(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_controlledWritableStream")?!1:n instanceof Nr}function Ji(n,s,l,p,m,b,w,v){s._controlledWritableStream=n,n._writableStreamController=s,s._queue=void 0,s._queueTotalSize=void 0,At(s),s._abortReason=void 0,s._abortController=Ld(),s._started=!1,s._strategySizeAlgorithm=v,s._strategyHWM=w,s._writeAlgorithm=p,s._closeAlgorithm=m,s._abortAlgorithm=b;let I=Do(s);Io(n,I);let E=l(),O=d(E);C(O,()=>(s._started=!0,ca(s),null),M=>(s._started=!0,Ao(n,M),null))}function Zd(n,s,l,p){let m=Object.create(Nr.prototype),b,w,v,I;s.start!==void 0?b=()=>s.start(m):b=()=>{},s.write!==void 0?w=E=>s.write(E,m):w=()=>d(void 0),s.close!==void 0?v=()=>s.close():v=()=>d(void 0),s.abort!==void 0?I=E=>s.abort(E):I=()=>d(void 0),Ji(n,m,b,w,v,I,l,p)}function ia(n){n._writeAlgorithm=void 0,n._closeAlgorithm=void 0,n._abortAlgorithm=void 0,n._strategySizeAlgorithm=void 0}function Yd(n){So(n,Gi,0),ca(n)}function Qd(n,s){try{return n._strategySizeAlgorithm(s)}catch(l){return pn(n,l),1}}function Zi(n){return n._strategyHWM-n._queueTotalSize}function Kd(n,s,l){try{So(n,s,l)}catch(m){pn(n,m);return}let p=n._controlledWritableStream;if(!Qe(p)&&p._state==="writable"){let m=Do(n);Io(p,m)}ca(n)}function ca(n){let s=n._controlledWritableStream;if(!n._started||s._inFlightWriteRequest!==void 0)return;if(s._state==="erroring"){Po(s);return}if(n._queue.length===0)return;let p=fd(n);p===Gi?Xd(n):ef(n,p)}function pn(n,s){n._controlledWritableStream._state==="writable"&&Yi(n,s)}function Xd(n){let s=n._controlledWritableStream;Ud(s),_o(n);let l=n._closeAlgorithm();ia(n),C(l,()=>(Wd(s),null),p=>(Bd(s,p),null))}function ef(n,s){let l=n._controlledWritableStream;zd(l);let p=n._writeAlgorithm(s);C(p,()=>{jd(l);let m=l._state;if(_o(n),!Qe(l)&&m==="writable"){let b=Do(n);Io(l,b)}return ca(n),null},m=>(l._state==="writable"&&ia(n),Fd(l,m),null))}function Do(n){return Zi(n)<=0}function Yi(n,s){let l=n._controlledWritableStream;ia(n),$o(l,s)}function la(n){return new TypeError(`WritableStream.prototype.${n} can only be used on a WritableStream`)}function Lo(n){return new TypeError(`WritableStreamDefaultController.prototype.${n} can only be used on a WritableStreamDefaultController`)}function Qt(n){return new TypeError(`WritableStreamDefaultWriter.prototype.${n} can only be used on a WritableStreamDefaultWriter`)}function hn(n){return new TypeError("Cannot "+n+" a stream using a released writer")}function ua(n){n._closedPromise=f((s,l)=>{n._closedPromise_resolve=s,n._closedPromise_reject=l,n._closedPromiseState="pending"})}function Qi(n,s){ua(n),No(n,s)}function tf(n){ua(n),Ki(n)}function No(n,s){n._closedPromise_reject!==void 0&&(B(n._closedPromise),n._closedPromise_reject(s),n._closedPromise_resolve=void 0,n._closedPromise_reject=void 0,n._closedPromiseState="rejected")}function rf(n,s){Qi(n,s)}function Ki(n){n._closedPromise_resolve!==void 0&&(n._closedPromise_resolve(void 0),n._closedPromise_resolve=void 0,n._closedPromise_reject=void 0,n._closedPromiseState="resolved")}function da(n){n._readyPromise=f((s,l)=>{n._readyPromise_resolve=s,n._readyPromise_reject=l}),n._readyPromiseState="pending"}function Mo(n,s){da(n),ec(n,s)}function Xi(n){da(n),jo(n)}function ec(n,s){n._readyPromise_reject!==void 0&&(B(n._readyPromise),n._readyPromise_reject(s),n._readyPromise_resolve=void 0,n._readyPromise_reject=void 0,n._readyPromiseState="rejected")}function nf(n){da(n)}function af(n,s){Mo(n,s)}function jo(n){n._readyPromise_resolve!==void 0&&(n._readyPromise_resolve(void 0),n._readyPromise_resolve=void 0,n._readyPromise_reject=void 0,n._readyPromiseState="fulfilled")}function of(){if(typeof globalThis<"u")return globalThis;if(typeof self<"u")return self;if(typeof global<"u")return global}let Fo=of();function sf(n){if(!(typeof n=="function"||typeof n=="object")||n.name!=="DOMException")return!1;try{return new n,!0}catch{return!1}}function cf(){let n=Fo?.DOMException;return sf(n)?n:void 0}function lf(){let n=function(l,p){this.message=l||"",this.name=p||"Error",Error.captureStackTrace&&Error.captureStackTrace(this,this.constructor)};return o(n,"DOMException"),n.prototype=Object.create(Error.prototype),Object.defineProperty(n.prototype,"constructor",{value:n,writable:!0,configurable:!0}),n}let uf=cf()||lf();function tc(n,s,l,p,m,b){let w=Ir(n),v=Wi(s);n._disturbed=!0;let I=!1,E=d(void 0);return f((O,M)=>{let G;if(b!==void 0){if(G=()=>{let A=b.reason!==void 0?b.reason:new uf("Aborted","AbortError"),F=[];p||F.push(()=>s._state==="writable"?oa(s,A):d(void 0)),m||F.push(()=>n._state==="readable"?Fe(n,A):d(void 0)),he(()=>Promise.all(F.map(J=>J())),!0,A)},b.aborted){G();return}b.addEventListener("abort",G)}function We(){return f((A,F)=>{function J(_e){_e?A():k(Wr(),J,F)}J(!1)})}function Wr(){return I?d(!0):k(v._readyPromise,()=>f((A,F)=>{cn(w,{_chunkSteps:J=>{E=k(Vi(v,J),void 0,e),A(!1)},_closeSteps:()=>A(!0),_errorSteps:F})}))}if(pt(n,w._closedPromise,A=>(p?$e(!0,A):he(()=>oa(s,A),!0,A),null)),pt(s,v._closedPromise,A=>(m?$e(!0,A):he(()=>Fe(n,A),!0,A),null)),ue(n,w._closedPromise,()=>(l?$e():he(()=>Vd(v)),null)),Qe(s)||s._state==="closed"){let A=new TypeError("the destination writable stream closed before all data could be piped to it");m?$e(!0,A):he(()=>Fe(n,A),!0,A)}B(We());function Lt(){let A=E;return k(E,()=>A!==E?Lt():void 0)}function pt(A,F,J){A._state==="errored"?J(A._storedError):x(F,J)}function ue(A,F,J){A._state==="closed"?J():D(F,J)}function he(A,F,J){if(I)return;I=!0,s._state==="writable"&&!Qe(s)?D(Lt(),_e):_e();function _e(){return C(A(),()=>ht(F,J),Br=>ht(!0,Br)),null}}function $e(A,F){I||(I=!0,s._state==="writable"&&!Qe(s)?D(Lt(),()=>ht(A,F)):ht(A,F))}function ht(A,F){return Hi(v),it(w),b!==void 0&&b.removeEventListener("abort",G),A?M(F):O(void 0),null}})}class ft{constructor(){throw new TypeError("Illegal constructor")}get desiredSize(){if(!fa(this))throw ha("desiredSize");return Wo(this)}close(){if(!fa(this))throw ha("close");if(!jr(this))throw new TypeError("The stream is not in a state that permits close");Kt(this)}enqueue(s=void 0){if(!fa(this))throw ha("enqueue");if(!jr(this))throw new TypeError("The stream is not in a state that permits enqueue");return Mr(this,s)}error(s=void 0){if(!fa(this))throw ha("error");je(this,s)}[sn](s){At(this);let l=this._cancelAlgorithm(s);return pa(this),l}[oo](s){let l=this._controlledReadableStream;if(this._queue.length>0){let p=_o(this);this._closeRequested&&this._queue.length===0?(pa(this),yn(l)):mn(this),s._chunkSteps(p)}else ui(l,s),mn(this)}[so](){}}Object.defineProperties(ft.prototype,{close:{enumerable:!0},enqueue:{enumerable:!0},error:{enumerable:!0},desiredSize:{enumerable:!0}}),o(ft.prototype.close,"close"),o(ft.prototype.enqueue,"enqueue"),o(ft.prototype.error,"error"),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(ft.prototype,Symbol.toStringTag,{value:"ReadableStreamDefaultController",configurable:!0});function fa(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_controlledReadableStream")?!1:n instanceof ft}function mn(n){if(!rc(n))return;if(n._pulling){n._pullAgain=!0;return}n._pulling=!0;let l=n._pullAlgorithm();C(l,()=>(n._pulling=!1,n._pullAgain&&(n._pullAgain=!1,mn(n)),null),p=>(je(n,p),null))}function rc(n){let s=n._controlledReadableStream;return!jr(n)||!n._started?!1:!!(Ot(s)&&Jn(s)>0||Wo(n)>0)}function pa(n){n._pullAlgorithm=void 0,n._cancelAlgorithm=void 0,n._strategySizeAlgorithm=void 0}function Kt(n){if(!jr(n))return;let s=n._controlledReadableStream;n._closeRequested=!0,n._queue.length===0&&(pa(n),yn(s))}function Mr(n,s){if(!jr(n))return;let l=n._controlledReadableStream;if(Ot(l)&&Jn(l)>0)mo(l,s,!1);else{let p;try{p=n._strategySizeAlgorithm(s)}catch(m){throw je(n,m),m}try{So(n,s,p)}catch(m){throw je(n,m),m}}mn(n)}function je(n,s){let l=n._controlledReadableStream;l._state==="readable"&&(At(n),pa(n),sc(l,s))}function Wo(n){let s=n._controlledReadableStream._state;return s==="errored"?null:s==="closed"?0:n._strategyHWM-n._queueTotalSize}function df(n){return!rc(n)}function jr(n){let s=n._controlledReadableStream._state;return!n._closeRequested&&s==="readable"}function nc(n,s,l,p,m,b,w){s._controlledReadableStream=n,s._queue=void 0,s._queueTotalSize=void 0,At(s),s._started=!1,s._closeRequested=!1,s._pullAgain=!1,s._pulling=!1,s._strategySizeAlgorithm=w,s._strategyHWM=b,s._pullAlgorithm=p,s._cancelAlgorithm=m,n._readableStreamController=s;let v=l();C(d(v),()=>(s._started=!0,mn(s),null),I=>(je(s,I),null))}function ff(n,s,l,p){let m=Object.create(ft.prototype),b,w,v;s.start!==void 0?b=()=>s.start(m):b=()=>{},s.pull!==void 0?w=()=>s.pull(m):w=()=>d(void 0),s.cancel!==void 0?v=I=>s.cancel(I):v=()=>d(void 0),nc(n,m,b,w,v,l,p)}function ha(n){return new TypeError(`ReadableStreamDefaultController.prototype.${n} can only be used on a ReadableStreamDefaultController`)}function pf(n,s){return Gt(n._readableStreamController)?mf(n):hf(n)}function hf(n,s){let l=Ir(n),p=!1,m=!1,b=!1,w=!1,v,I,E,O,M,G=f(ue=>{M=ue});function We(){return p?(m=!0,d(void 0)):(p=!0,cn(l,{_chunkSteps:he=>{W(()=>{m=!1;let $e=he,ht=he;b||Mr(E._readableStreamController,$e),w||Mr(O._readableStreamController,ht),p=!1,m&&We()})},_closeSteps:()=>{p=!1,b||Kt(E._readableStreamController),w||Kt(O._readableStreamController),(!b||!w)&&M(void 0)},_errorSteps:()=>{p=!1}}),d(void 0))}function Wr(ue){if(b=!0,v=ue,w){let he=ln([v,I]),$e=Fe(n,he);M($e)}return G}function Lt(ue){if(w=!0,I=ue,b){let he=ln([v,I]),$e=Fe(n,he);M($e)}return G}function pt(){}return E=gn(pt,We,Wr),O=gn(pt,We,Lt),x(l._closedPromise,ue=>(je(E._readableStreamController,ue),je(O._readableStreamController,ue),(!b||!w)&&M(void 0),null)),[E,O]}function mf(n){let s=Ir(n),l=!1,p=!1,m=!1,b=!1,w=!1,v,I,E,O,M,G=f(A=>{M=A});function We(A){x(A._closedPromise,F=>(A!==s||(Ae(E._readableStreamController,F),Ae(O._readableStreamController,F),(!b||!w)&&M(void 0)),null))}function Wr(){Zt(s)&&(it(s),s=Ir(n),We(s)),cn(s,{_chunkSteps:F=>{W(()=>{p=!1,m=!1;let J=F,_e=F;if(!b&&!w)try{_e=Si(F)}catch(Br){Ae(E._readableStreamController,Br),Ae(O._readableStreamController,Br),M(Fe(n,Br));return}b||Xn(E._readableStreamController,J),w||Xn(O._readableStreamController,_e),l=!1,p?pt():m&&ue()})},_closeSteps:()=>{l=!1,b||un(E._readableStreamController),w||un(O._readableStreamController),E._readableStreamController._pendingPullIntos.length>0&&ea(E._readableStreamController,0),O._readableStreamController._pendingPullIntos.length>0&&ea(O._readableStreamController,0),(!b||!w)&&M(void 0)},_errorSteps:()=>{l=!1}})}function Lt(A,F){Rt(s)&&(it(s),s=Di(n),We(s));let J=F?O:E,_e=F?E:O;Mi(s,A,1,{_chunkSteps:qr=>{W(()=>{p=!1,m=!1;let Ur=F?w:b;if(F?b:w)Ur||ta(J._readableStreamController,qr);else{let wc;try{wc=Si(qr)}catch(Ho){Ae(J._readableStreamController,Ho),Ae(_e._readableStreamController,Ho),M(Fe(n,Ho));return}Ur||ta(J._readableStreamController,qr),Xn(_e._readableStreamController,wc)}l=!1,p?pt():m&&ue()})},_closeSteps:qr=>{l=!1;let Ur=F?w:b,ka=F?b:w;Ur||un(J._readableStreamController),ka||un(_e._readableStreamController),qr!==void 0&&(Ur||ta(J._readableStreamController,qr),!ka&&_e._readableStreamController._pendingPullIntos.length>0&&ea(_e._readableStreamController,0)),(!Ur||!ka)&&M(void 0)},_errorSteps:()=>{l=!1}})}function pt(){if(l)return p=!0,d(void 0);l=!0;let A=Co(E._readableStreamController);return A===null?Wr():Lt(A._view,!1),d(void 0)}function ue(){if(l)return m=!0,d(void 0);l=!0;let A=Co(O._readableStreamController);return A===null?Wr():Lt(A._view,!0),d(void 0)}function he(A){if(b=!0,v=A,w){let F=ln([v,I]),J=Fe(n,F);M(J)}return G}function $e(A){if(w=!0,I=A,b){let F=ln([v,I]),J=Fe(n,F);M(J)}return G}function ht(){}return E=oc(ht,pt,he),O=oc(ht,ue,$e),We(s),[E,O]}function gf(n){return r(n)&&typeof n.getReader<"u"}function yf(n){return gf(n)?wf(n.getReader()):bf(n)}function bf(n){let s,l=_i(n,"async"),p=e;function m(){let w;try{w=cd(l)}catch(I){return g(I)}let v=d(w);return z(v,I=>{if(!r(I))throw new TypeError("The promise returned by the iterator.next() method must fulfill with an object");if(ld(I))Kt(s._readableStreamController);else{let O=ud(I);Mr(s._readableStreamController,O)}})}function b(w){let v=l.iterator,I;try{I=Yn(v,"return")}catch(M){return g(M)}if(I===void 0)return d(void 0);let E;try{E=Y(I,v,[w])}catch(M){return g(M)}let O=d(E);return z(O,M=>{if(!r(M))throw new TypeError("The promise returned by the iterator.return() method must fulfill with an object")})}return s=gn(p,m,b,0),s}function wf(n){let s,l=e;function p(){let b;try{b=n.read()}catch(w){return g(w)}return z(b,w=>{if(!r(w))throw new TypeError("The promise returned by the reader.read() method must fulfill with an object");if(w.done)Kt(s._readableStreamController);else{let v=w.value;Mr(s._readableStreamController,v)}})}function m(b){try{return d(n.cancel(b))}catch(w){return g(w)}}return s=gn(l,p,m,0),s}function _f(n,s){Ye(n,s);let l=n,p=l?.autoAllocateChunkSize,m=l?.cancel,b=l?.pull,w=l?.start,v=l?.type;return{autoAllocateChunkSize:p===void 0?void 0:po(p,`${s} has member 'autoAllocateChunkSize' that`),cancel:m===void 0?void 0:Sf(m,l,`${s} has member 'cancel' that`),pull:b===void 0?void 0:kf(b,l,`${s} has member 'pull' that`),start:w===void 0?void 0:xf(w,l,`${s} has member 'start' that`),type:v===void 0?void 0:vf(v,`${s} has member 'type' that`)}}function Sf(n,s,l){return Ee(n,l),p=>re(n,s,[p])}function kf(n,s,l){return Ee(n,l),p=>re(n,s,[p])}function xf(n,s,l){return Ee(n,l),p=>Y(n,s,[p])}function vf(n,s){if(n=`${n}`,n!=="bytes")throw new TypeError(`${s} '${n}' is not a valid enumeration value for ReadableStreamType`);return n}function Tf(n,s){return Ye(n,s),{preventCancel:!!n?.preventCancel}}function ac(n,s){Ye(n,s);let l=n?.preventAbort,p=n?.preventCancel,m=n?.preventClose,b=n?.signal;return b!==void 0&&Cf(b,`${s} has member 'signal' that`),{preventAbort:!!l,preventCancel:!!p,preventClose:!!m,signal:b}}function Cf(n,s){if(!Od(n))throw new TypeError(`${s} is not an AbortSignal.`)}function Rf(n,s){Ye(n,s);let l=n?.readable;uo(l,"readable","ReadableWritablePair"),ho(l,`${s} has member 'readable' that`);let p=n?.writable;return uo(p,"writable","ReadableWritablePair"),Fi(p,`${s} has member 'writable' that`),{readable:l,writable:p}}class oe{constructor(s={},l={}){s===void 0?s=null:ci(s,"First parameter");let p=aa(l,"Second parameter"),m=_f(s,"First parameter");if(Bo(this),m.type==="bytes"){if(p.size!==void 0)throw new RangeError("The strategy for a byte stream cannot have a size function");let b=fn(p,0);_d(this,m,b)}else{let b=na(p),w=fn(p,1);ff(this,m,w,b)}}get locked(){if(!It(this))throw Xt("locked");return Ot(this)}cancel(s=void 0){return It(this)?Ot(this)?g(new TypeError("Cannot cancel a stream that already has a reader")):Fe(this,s):g(Xt("cancel"))}getReader(s=void 0){if(!It(this))throw Xt("getReader");return kd(s,"First parameter").mode===void 0?Ir(this):Di(this)}pipeThrough(s,l={}){if(!It(this))throw Xt("pipeThrough");ct(s,1,"pipeThrough");let p=Rf(s,"First parameter"),m=ac(l,"Second parameter");if(Ot(this))throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked ReadableStream");if(Lr(p.writable))throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked WritableStream");let b=tc(this,p.writable,m.preventClose,m.preventAbort,m.preventCancel,m.signal);return B(b),p.readable}pipeTo(s,l={}){if(!It(this))return g(Xt("pipeTo"));if(s===void 0)return g("Parameter 1 is required in 'pipeTo'.");if(!Dr(s))return g(new TypeError("ReadableStream.prototype.pipeTo's first argument must be a WritableStream"));let p;try{p=ac(l,"Second parameter")}catch(m){return g(m)}return Ot(this)?g(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked ReadableStream")):Lr(s)?g(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked WritableStream")):tc(this,s,p.preventClose,p.preventAbort,p.preventCancel,p.signal)}tee(){if(!It(this))throw Xt("tee");let s=pf(this);return ln(s)}values(s=void 0){if(!It(this))throw Xt("values");let l=Tf(s,"First parameter");return sd(this,l.preventCancel)}[wo](s){return this.values(s)}static from(s){return yf(s)}}Object.defineProperties(oe,{from:{enumerable:!0}}),Object.defineProperties(oe.prototype,{cancel:{enumerable:!0},getReader:{enumerable:!0},pipeThrough:{enumerable:!0},pipeTo:{enumerable:!0},tee:{enumerable:!0},values:{enumerable:!0},locked:{enumerable:!0}}),o(oe.from,"from"),o(oe.prototype.cancel,"cancel"),o(oe.prototype.getReader,"getReader"),o(oe.prototype.pipeThrough,"pipeThrough"),o(oe.prototype.pipeTo,"pipeTo"),o(oe.prototype.tee,"tee"),o(oe.prototype.values,"values"),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(oe.prototype,Symbol.toStringTag,{value:"ReadableStream",configurable:!0}),Object.defineProperty(oe.prototype,wo,{value:oe.prototype.values,writable:!0,configurable:!0});function gn(n,s,l,p=1,m=()=>1){let b=Object.create(oe.prototype);Bo(b);let w=Object.create(ft.prototype);return nc(b,w,n,s,l,p,m),b}function oc(n,s,l){let p=Object.create(oe.prototype);Bo(p);let m=Object.create(ut.prototype);return Oi(p,m,n,s,l,0,void 0),p}function Bo(n){n._state="readable",n._reader=void 0,n._storedError=void 0,n._disturbed=!1}function It(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_readableStreamController")?!1:n instanceof oe}function Ot(n){return n._reader!==void 0}function Fe(n,s){if(n._disturbed=!0,n._state==="closed")return d(void 0);if(n._state==="errored")return g(n._storedError);yn(n);let l=n._reader;if(l!==void 0&&Zt(l)){let m=l._readIntoRequests;l._readIntoRequests=new H,m.forEach(b=>{b._closeSteps(void 0)})}let p=n._readableStreamController[sn](s);return z(p,e)}function yn(n){n._state="closed";let s=n._reader;if(s!==void 0&&(si(s),Rt(s))){let l=s._readRequests;s._readRequests=new H,l.forEach(p=>{p._closeSteps()})}}function sc(n,s){n._state="errored",n._storedError=s;let l=n._reader;l!==void 0&&(lo(l,s),Rt(l)?fi(l,s):ji(l,s))}function Xt(n){return new TypeError(`ReadableStream.prototype.${n} can only be used on a ReadableStream`)}function ic(n,s){Ye(n,s);let l=n?.highWaterMark;return uo(l,"highWaterMark","QueuingStrategyInit"),{highWaterMark:fo(l)}}let cc=n=>n.byteLength;o(cc,"size");class ma{constructor(s){ct(s,1,"ByteLengthQueuingStrategy"),s=ic(s,"First parameter"),this._byteLengthQueuingStrategyHighWaterMark=s.highWaterMark}get highWaterMark(){if(!uc(this))throw lc("highWaterMark");return this._byteLengthQueuingStrategyHighWaterMark}get size(){if(!uc(this))throw lc("size");return cc}}Object.defineProperties(ma.prototype,{highWaterMark:{enumerable:!0},size:{enumerable:!0}}),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(ma.prototype,Symbol.toStringTag,{value:"ByteLengthQueuingStrategy",configurable:!0});function lc(n){return new TypeError(`ByteLengthQueuingStrategy.prototype.${n} can only be used on a ByteLengthQueuingStrategy`)}function uc(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_byteLengthQueuingStrategyHighWaterMark")?!1:n instanceof ma}let dc=()=>1;o(dc,"size");class ga{constructor(s){ct(s,1,"CountQueuingStrategy"),s=ic(s,"First parameter"),this._countQueuingStrategyHighWaterMark=s.highWaterMark}get highWaterMark(){if(!pc(this))throw fc("highWaterMark");return this._countQueuingStrategyHighWaterMark}get size(){if(!pc(this))throw fc("size");return dc}}Object.defineProperties(ga.prototype,{highWaterMark:{enumerable:!0},size:{enumerable:!0}}),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(ga.prototype,Symbol.toStringTag,{value:"CountQueuingStrategy",configurable:!0});function fc(n){return new TypeError(`CountQueuingStrategy.prototype.${n} can only be used on a CountQueuingStrategy`)}function pc(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_countQueuingStrategyHighWaterMark")?!1:n instanceof ga}function Ef(n,s){Ye(n,s);let l=n?.cancel,p=n?.flush,m=n?.readableType,b=n?.start,w=n?.transform,v=n?.writableType;return{cancel:l===void 0?void 0:If(l,n,`${s} has member 'cancel' that`),flush:p===void 0?void 0:Af(p,n,`${s} has member 'flush' that`),readableType:m,start:b===void 0?void 0:$f(b,n,`${s} has member 'start' that`),transform:w===void 0?void 0:Pf(w,n,`${s} has member 'transform' that`),writableType:v}}function Af(n,s,l){return Ee(n,l),p=>re(n,s,[p])}function $f(n,s,l){return Ee(n,l),p=>Y(n,s,[p])}function Pf(n,s,l){return Ee(n,l),(p,m)=>re(n,s,[p,m])}function If(n,s,l){return Ee(n,l),p=>re(n,s,[p])}class ya{constructor(s={},l={},p={}){s===void 0&&(s=null);let m=aa(l,"Second parameter"),b=aa(p,"Third parameter"),w=Ef(s,"First parameter");if(w.readableType!==void 0)throw new RangeError("Invalid readableType specified");if(w.writableType!==void 0)throw new RangeError("Invalid writableType specified");let v=fn(b,0),I=na(b),E=fn(m,1),O=na(m),M,G=f(We=>{M=We});Of(this,G,E,O,v,I),Lf(this,w),w.start!==void 0?M(w.start(this._transformStreamController)):M(void 0)}get readable(){if(!hc(this))throw bc("readable");return this._readable}get writable(){if(!hc(this))throw bc("writable");return this._writable}}Object.defineProperties(ya.prototype,{readable:{enumerable:!0},writable:{enumerable:!0}}),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(ya.prototype,Symbol.toStringTag,{value:"TransformStream",configurable:!0});function Of(n,s,l,p,m,b){function w(){return s}function v(G){return jf(n,G)}function I(G){return Ff(n,G)}function E(){return Wf(n)}n._writable=Nd(w,v,E,I,l,p);function O(){return Bf(n)}function M(G){return qf(n,G)}n._readable=gn(w,O,M,m,b),n._backpressure=void 0,n._backpressureChangePromise=void 0,n._backpressureChangePromise_resolve=void 0,ba(n,!0),n._transformStreamController=void 0}function hc(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_transformStreamController")?!1:n instanceof ya}function mc(n,s){je(n._readable._readableStreamController,s),qo(n,s)}function qo(n,s){_a(n._transformStreamController),pn(n._writable._writableStreamController,s),Uo(n)}function Uo(n){n._backpressure&&ba(n,!1)}function ba(n,s){n._backpressureChangePromise!==void 0&&n._backpressureChangePromise_resolve(),n._backpressureChangePromise=f(l=>{n._backpressureChangePromise_resolve=l}),n._backpressure=s}class Dt{constructor(){throw new TypeError("Illegal constructor")}get desiredSize(){if(!wa(this))throw Sa("desiredSize");let s=this._controlledTransformStream._readable._readableStreamController;return Wo(s)}enqueue(s=void 0){if(!wa(this))throw Sa("enqueue");gc(this,s)}error(s=void 0){if(!wa(this))throw Sa("error");Nf(this,s)}terminate(){if(!wa(this))throw Sa("terminate");Mf(this)}}Object.defineProperties(Dt.prototype,{enqueue:{enumerable:!0},error:{enumerable:!0},terminate:{enumerable:!0},desiredSize:{enumerable:!0}}),o(Dt.prototype.enqueue,"enqueue"),o(Dt.prototype.error,"error"),o(Dt.prototype.terminate,"terminate"),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(Dt.prototype,Symbol.toStringTag,{value:"TransformStreamDefaultController",configurable:!0});function wa(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_controlledTransformStream")?!1:n instanceof Dt}function Df(n,s,l,p,m){s._controlledTransformStream=n,n._transformStreamController=s,s._transformAlgorithm=l,s._flushAlgorithm=p,s._cancelAlgorithm=m,s._finishPromise=void 0,s._finishPromise_resolve=void 0,s._finishPromise_reject=void 0}function Lf(n,s){let l=Object.create(Dt.prototype),p,m,b;s.transform!==void 0?p=w=>s.transform(w,l):p=w=>{try{return gc(l,w),d(void 0)}catch(v){return g(v)}},s.flush!==void 0?m=()=>s.flush(l):m=()=>d(void 0),s.cancel!==void 0?b=w=>s.cancel(w):b=()=>d(void 0),Df(n,l,p,m,b)}function _a(n){n._transformAlgorithm=void 0,n._flushAlgorithm=void 0,n._cancelAlgorithm=void 0}function gc(n,s){let l=n._controlledTransformStream,p=l._readable._readableStreamController;if(!jr(p))throw new TypeError("Readable side is not in a state that permits enqueue");try{Mr(p,s)}catch(b){throw qo(l,b),l._readable._storedError}df(p)!==l._backpressure&&ba(l,!0)}function Nf(n,s){mc(n._controlledTransformStream,s)}function yc(n,s){let l=n._transformAlgorithm(s);return z(l,void 0,p=>{throw mc(n._controlledTransformStream,p),p})}function Mf(n){let s=n._controlledTransformStream,l=s._readable._readableStreamController;Kt(l);let p=new TypeError("TransformStream terminated");qo(s,p)}function jf(n,s){let l=n._transformStreamController;if(n._backpressure){let p=n._backpressureChangePromise;return z(p,()=>{let m=n._writable;if(m._state==="erroring")throw m._storedError;return yc(l,s)})}return yc(l,s)}function Ff(n,s){let l=n._transformStreamController;if(l._finishPromise!==void 0)return l._finishPromise;let p=n._readable;l._finishPromise=f((b,w)=>{l._finishPromise_resolve=b,l._finishPromise_reject=w});let m=l._cancelAlgorithm(s);return _a(l),C(m,()=>(p._state==="errored"?Fr(l,p._storedError):(je(p._readableStreamController,s),zo(l)),null),b=>(je(p._readableStreamController,b),Fr(l,b),null)),l._finishPromise}function Wf(n){let s=n._transformStreamController;if(s._finishPromise!==void 0)return s._finishPromise;let l=n._readable;s._finishPromise=f((m,b)=>{s._finishPromise_resolve=m,s._finishPromise_reject=b});let p=s._flushAlgorithm();return _a(s),C(p,()=>(l._state==="errored"?Fr(s,l._storedError):(Kt(l._readableStreamController),zo(s)),null),m=>(je(l._readableStreamController,m),Fr(s,m),null)),s._finishPromise}function Bf(n){return ba(n,!1),n._backpressureChangePromise}function qf(n,s){let l=n._transformStreamController;if(l._finishPromise!==void 0)return l._finishPromise;let p=n._writable;l._finishPromise=f((b,w)=>{l._finishPromise_resolve=b,l._finishPromise_reject=w});let m=l._cancelAlgorithm(s);return _a(l),C(m,()=>(p._state==="errored"?Fr(l,p._storedError):(pn(p._writableStreamController,s),Uo(n),zo(l)),null),b=>(pn(p._writableStreamController,b),Uo(n),Fr(l,b),null)),l._finishPromise}function Sa(n){return new TypeError(`TransformStreamDefaultController.prototype.${n} can only be used on a TransformStreamDefaultController`)}function zo(n){n._finishPromise_resolve!==void 0&&(n._finishPromise_resolve(),n._finishPromise_resolve=void 0,n._finishPromise_reject=void 0)}function Fr(n,s){n._finishPromise_reject!==void 0&&(B(n._finishPromise),n._finishPromise_reject(s),n._finishPromise_resolve=void 0,n._finishPromise_reject=void 0)}function bc(n){return new TypeError(`TransformStream.prototype.${n} can only be used on a TransformStream`)}t.ByteLengthQueuingStrategy=ma,t.CountQueuingStrategy=ga,t.ReadableByteStreamController=ut,t.ReadableStream=oe,t.ReadableStreamBYOBReader=$t,t.ReadableStreamBYOBRequest=Vt,t.ReadableStreamDefaultController=ft,t.ReadableStreamDefaultReader=Ct,t.TransformStream=ya,t.TransformStreamDefaultController=Dt,t.WritableStream=Pt,t.WritableStreamDefaultController=Nr,t.WritableStreamDefaultWriter=dt}))});var Jc=Go(()=>{if(!globalThis.ReadableStream)try{let t=require("node:process"),{emitWarning:e}=t;try{t.emitWarning=()=>{},Object.assign(globalThis,require("node:stream/web")),t.emitWarning=e}catch(r){throw t.emitWarning=e,r}}catch{Object.assign(globalThis,Gc())}try{let{Blob:t}=require("buffer");t&&!t.prototype.stream&&(t.prototype.stream=function(r){let a=0,o=this;return new ReadableStream({type:"bytes",async pull(i){let u=await o.slice(a,Math.min(o.size,a+65536)).arrayBuffer();a+=u.byteLength,i.enqueue(new Uint8Array(u)),a===o.size&&i.close()}})})}catch{}});async function*rs(t,e=!0){for(let r of t)if("stream"in r)yield*r.stream();else if(ArrayBuffer.isView(r))if(e){let a=r.byteOffset,o=r.byteOffset+r.byteLength;for(;a!==o;){let i=Math.min(o-a,Zc),c=r.buffer.slice(a,a+i);a+=c.byteLength,yield new Uint8Array(c)}}else yield r;else{let a=0,o=r;for(;a!==o.size;){let c=await o.slice(a,Math.min(o.size,a+Zc)).arrayBuffer();a+=c.byteLength,yield new Uint8Array(c)}}}var Tw,Zc,Yc,Kh,He,kn=q(()=>{Tw=Be(Jc(),1);Zc=65536;Yc=class ns{#e=[];#t="";#r=0;#n="transparent";constructor(e=[],r={}){if(typeof e!="object"||e===null)throw new TypeError("Failed to construct 'Blob': The provided value cannot be converted to a sequence.");if(typeof e[Symbol.iterator]!="function")throw new TypeError("Failed to construct 'Blob': The object must have a callable @@iterator property.");if(typeof r!="object"&&typeof r!="function")throw new TypeError("Failed to construct 'Blob': parameter 2 cannot convert to dictionary.");r===null&&(r={});let a=new TextEncoder;for(let i of e){let c;ArrayBuffer.isView(i)?c=new Uint8Array(i.buffer.slice(i.byteOffset,i.byteOffset+i.byteLength)):i instanceof ArrayBuffer?c=new Uint8Array(i.slice(0)):i instanceof ns?c=i:c=a.encode(`${i}`),this.#r+=ArrayBuffer.isView(c)?c.byteLength:c.size,this.#e.push(c)}this.#n=`${r.endings===void 0?"transparent":r.endings}`;let o=r.type===void 0?"":String(r.type);this.#t=/^[\x20-\x7E]*$/.test(o)?o:""}get size(){return this.#r}get type(){return this.#t}async text(){let e=new TextDecoder,r="";for await(let a of rs(this.#e,!1))r+=e.decode(a,{stream:!0});return r+=e.decode(),r}async arrayBuffer(){let e=new Uint8Array(this.size),r=0;for await(let a of rs(this.#e,!1))e.set(a,r),r+=a.length;return e.buffer}stream(){let e=rs(this.#e,!0);return new globalThis.ReadableStream({type:"bytes",async pull(r){let a=await e.next();a.done?r.close():r.enqueue(a.value)},async cancel(){await e.return()}})}slice(e=0,r=this.size,a=""){let{size:o}=this,i=e<0?Math.max(o+e,0):Math.min(e,o),c=r<0?Math.max(o+r,0):Math.min(r,o),u=Math.max(c-i,0),f=this.#e,d=[],g=0;for(let C of f){if(g>=u)break;let D=ArrayBuffer.isView(C)?C.byteLength:C.size;if(i&&D<=i)i-=D,c-=D;else{let x;ArrayBuffer.isView(C)?(x=C.subarray(i,Math.min(D,c)),g+=x.byteLength):(x=C.slice(i,Math.min(D,c)),g+=x.size),c-=D,d.push(x),i=0}}let k=new ns([],{type:String(a).toLowerCase()});return k.#r=u,k.#e=d,k}get[Symbol.toStringTag](){return"Blob"}static[Symbol.hasInstance](e){return e&&typeof e=="object"&&typeof e.constructor=="function"&&(typeof e.stream=="function"||typeof e.arrayBuffer=="function")&&/^(Blob|File)$/.test(e[Symbol.toStringTag])}};Object.defineProperties(Yc.prototype,{size:{enumerable:!0},type:{enumerable:!0},slice:{enumerable:!0}});Kh=Yc,He=Kh});var Xh,em,Wt,as=q(()=>{kn();Xh=class extends He{#e=0;#t="";constructor(e,r,a={}){if(arguments.length<2)throw new TypeError(`Failed to construct 'File': 2 arguments required, but only ${arguments.length} present.`);super(e,a),a===null&&(a={});let o=a.lastModified===void 0?Date.now():Number(a.lastModified);Number.isNaN(o)||(this.#e=o),this.#t=String(r)}get name(){return this.#t}get lastModified(){return this.#e}get[Symbol.toStringTag](){return"File"}static[Symbol.hasInstance](e){return!!e&&e instanceof He&&/^(File)$/.test(e[Symbol.toStringTag])}},em=Xh,Wt=em});function Xc(t,e=He){var r=`${Qc()}${Qc()}`.replace(/\./g,"").slice(-28).padStart(32,"-"),a=[],o=`--${r}\r
Content-Disposition: form-data; name="`;return t.forEach((i,c)=>typeof i=="string"?a.push(o+os(c)+`"\r
\r
${i.replace(/\r(?!\n)|(?<!\r)\n/g,`\r
`)}\r
`):a.push(o+os(c)+`"; filename="${os(i.name,1)}"\r
Content-Type: ${i.type||"application/octet-stream"}\r
\r
`,i,`\r
`)),a.push(`--${r}--`),new e(a,{type:"multipart/form-data; boundary="+r})}var xn,tm,rm,Qc,nm,Kc,os,gr,Bt,La=q(()=>{kn();as();({toStringTag:xn,iterator:tm,hasInstance:rm}=Symbol),Qc=Math.random,nm="append,set,get,getAll,delete,keys,values,entries,forEach,constructor".split(","),Kc=(t,e,r)=>(t+="",/^(Blob|File)$/.test(e&&e[xn])?[(r=r!==void 0?r+"":e[xn]=="File"?e.name:"blob",t),e.name!==r||e[xn]=="blob"?new Wt([e],r,e):e]:[t,e+""]),os=(t,e)=>(e?t:t.replace(/\r?\n|\r/g,`\r
`)).replace(/\n/g,"%0A").replace(/\r/g,"%0D").replace(/"/g,"%22"),gr=(t,e,r)=>{if(e.length<r)throw new TypeError(`Failed to execute '${t}' on 'FormData': ${r} arguments required, but only ${e.length} present.`)},Bt=class{#e=[];constructor(...e){if(e.length)throw new TypeError("Failed to construct 'FormData': parameter 1 is not of type 'HTMLFormElement'.")}get[xn](){return"FormData"}[tm](){return this.entries()}static[rm](e){return e&&typeof e=="object"&&e[xn]==="FormData"&&!nm.some(r=>typeof e[r]!="function")}append(...e){gr("append",arguments,2),this.#e.push(Kc(...e))}delete(e){gr("delete",arguments,1),e+="",this.#e=this.#e.filter(([r])=>r!==e)}get(e){gr("get",arguments,1),e+="";for(var r=this.#e,a=r.length,o=0;o<a;o++)if(r[o][0]===e)return r[o][1];return null}getAll(e,r){return gr("getAll",arguments,1),r=[],e+="",this.#e.forEach(a=>a[0]===e&&r.push(a[1])),r}has(e){return gr("has",arguments,1),e+="",this.#e.some(r=>r[0]===e)}forEach(e,r){gr("forEach",arguments,1);for(var[a,o]of this)e.call(r,o,a,this)}set(...e){gr("set",arguments,2);var r=[],a=!0;e=Kc(...e),this.#e.forEach(o=>{o[0]===e[0]?a&&(a=!r.push(e)):r.push(o)}),a&&r.push(e),this.#e=r}*entries(){yield*this.#e}*keys(){for(var[e]of this)yield e}*values(){for(var[,e]of this)yield e}}});var wt,Na=q(()=>{wt=class extends Error{constructor(e,r){super(e),Error.captureStackTrace(this,this.constructor),this.type=r}get name(){return this.constructor.name}get[Symbol.toStringTag](){return this.constructor.name}}});var de,ss=q(()=>{Na();de=class extends wt{constructor(e,r,a){super(e,r),a&&(this.code=this.errno=a.code,this.erroredSysCall=a.syscall)}}});var Ma,is,vn,el,tl,rl,ja=q(()=>{Ma=Symbol.toStringTag,is=t=>typeof t=="object"&&typeof t.append=="function"&&typeof t.delete=="function"&&typeof t.get=="function"&&typeof t.getAll=="function"&&typeof t.has=="function"&&typeof t.set=="function"&&typeof t.sort=="function"&&t[Ma]==="URLSearchParams",vn=t=>t&&typeof t=="object"&&typeof t.arrayBuffer=="function"&&typeof t.type=="string"&&typeof t.stream=="function"&&typeof t.constructor=="function"&&/^(Blob|File)$/.test(t[Ma]),el=t=>typeof t=="object"&&(t[Ma]==="AbortSignal"||t[Ma]==="EventTarget"),tl=(t,e)=>{let r=new URL(e).hostname,a=new URL(t).hostname;return r===a||r.endsWith(`.${a}`)},rl=(t,e)=>{let r=new URL(e).protocol,a=new URL(t).protocol;return r===a}});var al=Go((jw,nl)=>{if(!globalThis.DOMException)try{let{MessageChannel:t}=require("worker_threads"),e=new t().port1,r=new ArrayBuffer;e.postMessage(r,[r,r])}catch(t){t.constructor.name==="DOMException"&&(globalThis.DOMException=t.constructor)}nl.exports=globalThis.DOMException});var yr,ol,sl,cs,il,cl,ll,ul,dl,fl,Fa,ls=q(()=>{yr=require("node:fs"),ol=require("node:path"),sl=Be(al(),1);as();kn();({stat:cs}=yr.promises),il=(t,e)=>dl((0,yr.statSync)(t),t,e),cl=(t,e)=>cs(t).then(r=>dl(r,t,e)),ll=(t,e)=>cs(t).then(r=>fl(r,t,e)),ul=(t,e)=>fl((0,yr.statSync)(t),t,e),dl=(t,e,r="")=>new He([new Fa({path:e,size:t.size,lastModified:t.mtimeMs,start:0})],{type:r}),fl=(t,e,r="")=>new Wt([new Fa({path:e,size:t.size,lastModified:t.mtimeMs,start:0})],(0,ol.basename)(e),{type:r,lastModified:t.mtimeMs}),Fa=class t{#e;#t;constructor(e){this.#e=e.path,this.#t=e.start,this.size=e.size,this.lastModified=e.lastModified}slice(e,r){return new t({path:this.#e,lastModified:this.lastModified,size:r-e,start:this.#t+e})}async*stream(){let{mtimeMs:e}=await cs(this.#e);if(e>this.lastModified)throw new sl.default("The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.","NotReadableError");yield*(0,yr.createReadStream)(this.#e,{start:this.#t,end:this.#t+this.size-1})}get[Symbol.toStringTag](){return"Blob"}}});var hl={};Pe(hl,{toFormData:()=>um});function lm(t){let e=t.match(/\bfilename=("(.*?)"|([^()<>@,;:\\"/[\]?={}\s\t]+))($|;\s)/i);if(!e)return;let r=e[2]||e[3]||"",a=r.slice(r.lastIndexOf("\\")+1);return a=a.replace(/%22/g,'"'),a=a.replace(/&#(\d{4});/g,(o,i)=>String.fromCharCode(i)),a}async function um(t,e){if(!/multipart/i.test(e))throw new TypeError("Failed to fetch");let r=e.match(/boundary=(?:"([^"]+)"|([^;]+))/i);if(!r)throw new TypeError("no or bad content-type header, no multipart boundary");let a=new us(r[1]||r[2]),o,i,c,u,f,d,g=[],k=new Bt,C=W=>{c+=B.decode(W,{stream:!0})},D=W=>{g.push(W)},x=()=>{let W=new Wt(g,d,{type:f});k.append(u,W)},z=()=>{k.append(u,c)},B=new TextDecoder("utf-8");B.decode(),a.onPartBegin=function(){a.onPartData=C,a.onPartEnd=z,o="",i="",c="",u="",f="",d=null,g.length=0},a.onHeaderField=function(W){o+=B.decode(W,{stream:!0})},a.onHeaderValue=function(W){i+=B.decode(W,{stream:!0})},a.onHeaderEnd=function(){if(i+=B.decode(),o=o.toLowerCase(),o==="content-disposition"){let W=i.match(/\bname=("([^"]*)"|([^()<>@,;:\\"/[\]?={}\s\t]+))/i);W&&(u=W[2]||W[3]||""),d=lm(i),d&&(a.onPartData=D,a.onPartEnd=x)}else o==="content-type"&&(f=i);i="",o=""};for await(let W of t)a.write(W);return a.end(),k}var rt,Z,pl,qt,Wa,Ba,am,Tn,om,sm,im,cm,br,us,ml=q(()=>{ls();La();rt=0,Z={START_BOUNDARY:rt++,HEADER_FIELD_START:rt++,HEADER_FIELD:rt++,HEADER_VALUE_START:rt++,HEADER_VALUE:rt++,HEADER_VALUE_ALMOST_DONE:rt++,HEADERS_ALMOST_DONE:rt++,PART_DATA_START:rt++,PART_DATA:rt++,END:rt++},pl=1,qt={PART_BOUNDARY:pl,LAST_BOUNDARY:pl*=2},Wa=10,Ba=13,am=32,Tn=45,om=58,sm=97,im=122,cm=t=>t|32,br=()=>{},us=class{constructor(e){this.index=0,this.flags=0,this.onHeaderEnd=br,this.onHeaderField=br,this.onHeadersEnd=br,this.onHeaderValue=br,this.onPartBegin=br,this.onPartData=br,this.onPartEnd=br,this.boundaryChars={},e=`\r
--`+e;let r=new Uint8Array(e.length);for(let a=0;a<e.length;a++)r[a]=e.charCodeAt(a),this.boundaryChars[r[a]]=!0;this.boundary=r,this.lookbehind=new Uint8Array(this.boundary.length+8),this.state=Z.START_BOUNDARY}write(e){let r=0,a=e.length,o=this.index,{lookbehind:i,boundary:c,boundaryChars:u,index:f,state:d,flags:g}=this,k=this.boundary.length,C=k-1,D=e.length,x,z,B=U=>{this[U+"Mark"]=r},W=U=>{delete this[U+"Mark"]},Y=(U,H,Q,Tt)=>{(H===void 0||H!==Q)&&this[U](Tt&&Tt.subarray(H,Q))},re=(U,H)=>{let Q=U+"Mark";Q in this&&(H?(Y(U,this[Q],r,e),delete this[Q]):(Y(U,this[Q],e.length,e),this[Q]=0))};for(r=0;r<a;r++)switch(x=e[r],d){case Z.START_BOUNDARY:if(f===c.length-2){if(x===Tn)g|=qt.LAST_BOUNDARY;else if(x!==Ba)return;f++;break}else if(f-1===c.length-2){if(g&qt.LAST_BOUNDARY&&x===Tn)d=Z.END,g=0;else if(!(g&qt.LAST_BOUNDARY)&&x===Wa)f=0,Y("onPartBegin"),d=Z.HEADER_FIELD_START;else return;break}x!==c[f+2]&&(f=-2),x===c[f+2]&&f++;break;case Z.HEADER_FIELD_START:d=Z.HEADER_FIELD,B("onHeaderField"),f=0;case Z.HEADER_FIELD:if(x===Ba){W("onHeaderField"),d=Z.HEADERS_ALMOST_DONE;break}if(f++,x===Tn)break;if(x===om){if(f===1)return;re("onHeaderField",!0),d=Z.HEADER_VALUE_START;break}if(z=cm(x),z<sm||z>im)return;break;case Z.HEADER_VALUE_START:if(x===am)break;B("onHeaderValue"),d=Z.HEADER_VALUE;case Z.HEADER_VALUE:x===Ba&&(re("onHeaderValue",!0),Y("onHeaderEnd"),d=Z.HEADER_VALUE_ALMOST_DONE);break;case Z.HEADER_VALUE_ALMOST_DONE:if(x!==Wa)return;d=Z.HEADER_FIELD_START;break;case Z.HEADERS_ALMOST_DONE:if(x!==Wa)return;Y("onHeadersEnd"),d=Z.PART_DATA_START;break;case Z.PART_DATA_START:d=Z.PART_DATA,B("onPartData");case Z.PART_DATA:if(o=f,f===0){for(r+=C;r<D&&!(e[r]in u);)r+=k;r-=C,x=e[r]}if(f<c.length)c[f]===x?(f===0&&re("onPartData",!0),f++):f=0;else if(f===c.length)f++,x===Ba?g|=qt.PART_BOUNDARY:x===Tn?g|=qt.LAST_BOUNDARY:f=0;else if(f-1===c.length)if(g&qt.PART_BOUNDARY){if(f=0,x===Wa){g&=~qt.PART_BOUNDARY,Y("onPartEnd"),Y("onPartBegin"),d=Z.HEADER_FIELD_START;break}}else g&qt.LAST_BOUNDARY&&x===Tn?(Y("onPartEnd"),d=Z.END,g=0):f=0;if(f>0)i[f-1]=x;else if(o>0){let U=new Uint8Array(i.buffer,i.byteOffset,i.byteLength);Y("onPartData",0,o,U),o=0,B("onPartData"),r--}break;case Z.END:break;default:throw new Error(`Unexpected state entered: ${d}`)}re("onHeaderField"),re("onHeaderValue"),re("onPartData"),this.index=f,this.state=d,this.flags=g}end(){if(this.state===Z.HEADER_FIELD_START&&this.index===0||this.state===Z.PART_DATA&&this.index===this.boundary.length)this.onPartEnd();else if(this.state!==Z.END)throw new Error("MultipartParser.end(): stream ended unexpectedly")}}});async function ds(t){if(t[ye].disturbed)throw new TypeError(`body used already for: ${t.url}`);if(t[ye].disturbed=!0,t[ye].error)throw t[ye].error;let{body:e}=t;if(e===null)return ke.Buffer.alloc(0);if(!(e instanceof Le.default))return ke.Buffer.alloc(0);let r=[],a=0;try{for await(let o of e){if(t.size>0&&a+o.length>t.size){let i=new de(`content size at ${t.url} over limit: ${t.size}`,"max-size");throw e.destroy(i),i}a+=o.length,r.push(o)}}catch(o){throw o instanceof wt?o:new de(`Invalid response body while trying to fetch ${t.url}: ${o.message}`,"system",o)}if(e.readableEnded===!0||e._readableState.ended===!0)try{return r.every(o=>typeof o=="string")?ke.Buffer.from(r.join("")):ke.Buffer.concat(r,a)}catch(o){throw new de(`Could not create Buffer from response body for ${t.url}: ${o.message}`,"system",o)}else throw new de(`Premature close of server response while trying to fetch ${t.url}`)}var Le,_t,ke,dm,ye,nt,Kr,fm,qa,gl,yl,Ua=q(()=>{Le=Be(require("node:stream"),1),_t=require("node:util"),ke=require("node:buffer");kn();La();ss();Na();ja();dm=(0,_t.promisify)(Le.default.pipeline),ye=Symbol("Body internals"),nt=class{constructor(e,{size:r=0}={}){let a=null;e===null?e=null:is(e)?e=ke.Buffer.from(e.toString()):vn(e)||ke.Buffer.isBuffer(e)||(_t.types.isAnyArrayBuffer(e)?e=ke.Buffer.from(e):ArrayBuffer.isView(e)?e=ke.Buffer.from(e.buffer,e.byteOffset,e.byteLength):e instanceof Le.default||(e instanceof Bt?(e=Xc(e),a=e.type.split("=")[1]):e=ke.Buffer.from(String(e))));let o=e;ke.Buffer.isBuffer(e)?o=Le.default.Readable.from(e):vn(e)&&(o=Le.default.Readable.from(e.stream())),this[ye]={body:e,stream:o,boundary:a,disturbed:!1,error:null},this.size=r,e instanceof Le.default&&e.on("error",i=>{let c=i instanceof wt?i:new de(`Invalid response body while trying to fetch ${this.url}: ${i.message}`,"system",i);this[ye].error=c})}get body(){return this[ye].stream}get bodyUsed(){return this[ye].disturbed}async arrayBuffer(){let{buffer:e,byteOffset:r,byteLength:a}=await ds(this);return e.slice(r,r+a)}async formData(){let e=this.headers.get("content-type");if(e.startsWith("application/x-www-form-urlencoded")){let a=new Bt,o=new URLSearchParams(await this.text());for(let[i,c]of o)a.append(i,c);return a}let{toFormData:r}=await Promise.resolve().then(()=>(ml(),hl));return r(this.body,e)}async blob(){let e=this.headers&&this.headers.get("content-type")||this[ye].body&&this[ye].body.type||"",r=await this.arrayBuffer();return new He([r],{type:e})}async json(){let e=await this.text();return JSON.parse(e)}async text(){let e=await ds(this);return new TextDecoder().decode(e)}buffer(){return ds(this)}};nt.prototype.buffer=(0,_t.deprecate)(nt.prototype.buffer,"Please use 'response.arrayBuffer()' instead of 'response.buffer()'","node-fetch#buffer");Object.defineProperties(nt.prototype,{body:{enumerable:!0},bodyUsed:{enumerable:!0},arrayBuffer:{enumerable:!0},blob:{enumerable:!0},json:{enumerable:!0},text:{enumerable:!0},data:{get:(0,_t.deprecate)(()=>{},"data doesn't exist, use json(), text(), arrayBuffer(), or body instead","https://github.com/node-fetch/node-fetch/issues/1000 (response)")}});Kr=(t,e)=>{let r,a,{body:o}=t[ye];if(t.bodyUsed)throw new Error("cannot clone body after it is used");return o instanceof Le.default&&typeof o.getBoundary!="function"&&(r=new Le.PassThrough({highWaterMark:e}),a=new Le.PassThrough({highWaterMark:e}),o.pipe(r),o.pipe(a),t[ye].stream=r,o=a),o},fm=(0,_t.deprecate)(t=>t.getBoundary(),"form-data doesn't follow the spec and requires special treatment. Use alternative package","https://github.com/node-fetch/node-fetch/issues/1167"),qa=(t,e)=>t===null?null:typeof t=="string"?"text/plain;charset=UTF-8":is(t)?"application/x-www-form-urlencoded;charset=UTF-8":vn(t)?t.type||null:ke.Buffer.isBuffer(t)||_t.types.isAnyArrayBuffer(t)||ArrayBuffer.isView(t)?null:t instanceof Bt?`multipart/form-data; boundary=${e[ye].boundary}`:t&&typeof t.getBoundary=="function"?`multipart/form-data;boundary=${fm(t)}`:t instanceof Le.default?null:"text/plain;charset=UTF-8",gl=t=>{let{body:e}=t[ye];return e===null?0:vn(e)?e.size:ke.Buffer.isBuffer(e)?e.length:e&&typeof e.getLengthSync=="function"&&e.hasKnownLength&&e.hasKnownLength()?e.getLengthSync():null},yl=async(t,{body:e})=>{e===null?t.end():await dm(e,t)}});function bl(t=[]){return new be(t.reduce((e,r,a,o)=>(a%2===0&&e.push(o.slice(a,a+2)),e),[]).filter(([e,r])=>{try{return za(e),ps(e,String(r)),!0}catch{return!1}}))}var fs,Cn,za,ps,be,Ha=q(()=>{fs=require("node:util"),Cn=Be(require("node:http"),1),za=typeof Cn.default.validateHeaderName=="function"?Cn.default.validateHeaderName:t=>{if(!/^[\^`\-\w!#$%&'*+.|~]+$/.test(t)){let e=new TypeError(`Header name must be a valid HTTP token [${t}]`);throw Object.defineProperty(e,"code",{value:"ERR_INVALID_HTTP_TOKEN"}),e}},ps=typeof Cn.default.validateHeaderValue=="function"?Cn.default.validateHeaderValue:(t,e)=>{if(/[^\t\u0020-\u007E\u0080-\u00FF]/.test(e)){let r=new TypeError(`Invalid character in header content ["${t}"]`);throw Object.defineProperty(r,"code",{value:"ERR_INVALID_CHAR"}),r}},be=class t extends URLSearchParams{constructor(e){let r=[];if(e instanceof t){let a=e.raw();for(let[o,i]of Object.entries(a))r.push(...i.map(c=>[o,c]))}else if(e!=null)if(typeof e=="object"&&!fs.types.isBoxedPrimitive(e)){let a=e[Symbol.iterator];if(a==null)r.push(...Object.entries(e));else{if(typeof a!="function")throw new TypeError("Header pairs must be iterable");r=[...e].map(o=>{if(typeof o!="object"||fs.types.isBoxedPrimitive(o))throw new TypeError("Each header pair must be an iterable object");return[...o]}).map(o=>{if(o.length!==2)throw new TypeError("Each header pair must be a name/value tuple");return[...o]})}}else throw new TypeError("Failed to construct 'Headers': The provided value is not of type '(sequence<sequence<ByteString>> or record<ByteString, ByteString>)");return r=r.length>0?r.map(([a,o])=>(za(a),ps(a,String(o)),[String(a).toLowerCase(),String(o)])):void 0,super(r),new Proxy(this,{get(a,o,i){switch(o){case"append":case"set":return(c,u)=>(za(c),ps(c,String(u)),URLSearchParams.prototype[o].call(a,String(c).toLowerCase(),String(u)));case"delete":case"has":case"getAll":return c=>(za(c),URLSearchParams.prototype[o].call(a,String(c).toLowerCase()));case"keys":return()=>(a.sort(),new Set(URLSearchParams.prototype.keys.call(a)).keys());default:return Reflect.get(a,o,i)}}})}get[Symbol.toStringTag](){return this.constructor.name}toString(){return Object.prototype.toString.call(this)}get(e){let r=this.getAll(e);if(r.length===0)return null;let a=r.join(", ");return/^content-encoding$/i.test(e)&&(a=a.toLowerCase()),a}forEach(e,r=void 0){for(let a of this.keys())Reflect.apply(e,r,[this.get(a),a,this])}*values(){for(let e of this.keys())yield this.get(e)}*entries(){for(let e of this.keys())yield[e,this.get(e)]}[Symbol.iterator](){return this.entries()}raw(){return[...this.keys()].reduce((e,r)=>(e[r]=this.getAll(r),e),{})}[Symbol.for("nodejs.util.inspect.custom")](){return[...this.keys()].reduce((e,r)=>{let a=this.getAll(r);return r==="host"?e[r]=a[0]:e[r]=a.length>1?a:a[0],e},{})}};Object.defineProperties(be.prototype,["get","entries","forEach","values"].reduce((t,e)=>(t[e]={enumerable:!0},t),{}))});var pm,Rn,hs=q(()=>{pm=new Set([301,302,303,307,308]),Rn=t=>pm.has(t)});var Ve,xe,wl=q(()=>{Ha();Ua();hs();Ve=Symbol("Response internals"),xe=class t extends nt{constructor(e=null,r={}){super(e,r);let a=r.status!=null?r.status:200,o=new be(r.headers);if(e!==null&&!o.has("Content-Type")){let i=qa(e,this);i&&o.append("Content-Type",i)}this[Ve]={type:"default",url:r.url,status:a,statusText:r.statusText||"",headers:o,counter:r.counter,highWaterMark:r.highWaterMark}}get type(){return this[Ve].type}get url(){return this[Ve].url||""}get status(){return this[Ve].status}get ok(){return this[Ve].status>=200&&this[Ve].status<300}get redirected(){return this[Ve].counter>0}get statusText(){return this[Ve].statusText}get headers(){return this[Ve].headers}get highWaterMark(){return this[Ve].highWaterMark}clone(){return new t(Kr(this,this.highWaterMark),{type:this.type,url:this.url,status:this.status,statusText:this.statusText,headers:this.headers,ok:this.ok,redirected:this.redirected,size:this.size,highWaterMark:this.highWaterMark})}static redirect(e,r=302){if(!Rn(r))throw new RangeError('Failed to execute "redirect" on "response": Invalid status code');return new t(null,{headers:{location:new URL(e).toString()},status:r})}static error(){let e=new t(null,{status:0,statusText:""});return e[Ve].type="error",e}static json(e=void 0,r={}){let a=JSON.stringify(e);if(a===void 0)throw new TypeError("data is not JSON serializable");let o=new be(r&&r.headers);return o.has("content-type")||o.set("content-type","application/json"),new t(a,{...r,headers:o})}get[Symbol.toStringTag](){return"Response"}};Object.defineProperties(xe.prototype,{type:{enumerable:!0},url:{enumerable:!0},status:{enumerable:!0},ok:{enumerable:!0},redirected:{enumerable:!0},statusText:{enumerable:!0},headers:{enumerable:!0},clone:{enumerable:!0}})});var _l,Sl=q(()=>{_l=t=>{if(t.search)return t.search;let e=t.href.length-1,r=t.hash||(t.href[e]==="#"?"#":"");return t.href[e-r.length]==="?"?"?":""}});function kl(t,e=!1){return t==null||(t=new URL(t),/^(about|blob|data):$/.test(t.protocol))?"no-referrer":(t.username="",t.password="",t.hash="",e&&(t.pathname="",t.search=""),t)}function Cl(t){if(!vl.has(t))throw new TypeError(`Invalid referrerPolicy: ${t}`);return t}function hm(t){if(/^(http|ws)s:$/.test(t.protocol))return!0;let e=t.host.replace(/(^\[)|(]$)/g,""),r=(0,xl.isIP)(e);return r===4&&/^127\./.test(e)||r===6&&/^(((0+:){7})|(::(0+:){0,6}))0*1$/.test(e)?!0:t.host==="localhost"||t.host.endsWith(".localhost")?!1:t.protocol==="file:"}function Xr(t){return/^about:(blank|srcdoc)$/.test(t)||t.protocol==="data:"||/^(blob|filesystem):$/.test(t.protocol)?!0:hm(t)}function Rl(t,{referrerURLCallback:e,referrerOriginCallback:r}={}){if(t.referrer==="no-referrer"||t.referrerPolicy==="")return null;let a=t.referrerPolicy;if(t.referrer==="about:client")return"no-referrer";let o=t.referrer,i=kl(o),c=kl(o,!0);i.toString().length>4096&&(i=c),e&&(i=e(i)),r&&(c=r(c));let u=new URL(t.url);switch(a){case"no-referrer":return"no-referrer";case"origin":return c;case"unsafe-url":return i;case"strict-origin":return Xr(i)&&!Xr(u)?"no-referrer":c.toString();case"strict-origin-when-cross-origin":return i.origin===u.origin?i:Xr(i)&&!Xr(u)?"no-referrer":c;case"same-origin":return i.origin===u.origin?i:"no-referrer";case"origin-when-cross-origin":return i.origin===u.origin?i:c;case"no-referrer-when-downgrade":return Xr(i)&&!Xr(u)?"no-referrer":i;default:throw new TypeError(`Invalid referrerPolicy: ${a}`)}}function El(t){let e=(t.get("referrer-policy")||"").split(/[,\s]+/),r="";for(let a of e)a&&vl.has(a)&&(r=a);return r}var xl,vl,Tl,ms=q(()=>{xl=require("node:net");vl=new Set(["","no-referrer","no-referrer-when-downgrade","same-origin","origin","strict-origin","origin-when-cross-origin","strict-origin-when-cross-origin","unsafe-url"]),Tl="strict-origin-when-cross-origin"});var Al,$l,ee,En,mm,Ut,Pl,Il=q(()=>{Al=require("node:url"),$l=require("node:util");Ha();Ua();ja();Sl();ms();ee=Symbol("Request internals"),En=t=>typeof t=="object"&&typeof t[ee]=="object",mm=(0,$l.deprecate)(()=>{},".data is not a valid RequestInit property, use .body instead","https://github.com/node-fetch/node-fetch/issues/1000 (request)"),Ut=class t extends nt{constructor(e,r={}){let a;if(En(e)?a=new URL(e.url):(a=new URL(e),e={}),a.username!==""||a.password!=="")throw new TypeError(`${a} is an url with embedded credentials.`);let o=r.method||e.method||"GET";if(/^(delete|get|head|options|post|put)$/i.test(o)&&(o=o.toUpperCase()),!En(r)&&"data"in r&&mm(),(r.body!=null||En(e)&&e.body!==null)&&(o==="GET"||o==="HEAD"))throw new TypeError("Request with GET/HEAD method cannot have body");let i=r.body?r.body:En(e)&&e.body!==null?Kr(e):null;super(i,{size:r.size||e.size||0});let c=new be(r.headers||e.headers||{});if(i!==null&&!c.has("Content-Type")){let d=qa(i,this);d&&c.set("Content-Type",d)}let u=En(e)?e.signal:null;if("signal"in r&&(u=r.signal),u!=null&&!el(u))throw new TypeError("Expected signal to be an instanceof AbortSignal or EventTarget");let f=r.referrer==null?e.referrer:r.referrer;if(f==="")f="no-referrer";else if(f){let d=new URL(f);f=/^about:(\/\/)?client$/.test(d)?"client":d}else f=void 0;this[ee]={method:o,redirect:r.redirect||e.redirect||"follow",headers:c,parsedURL:a,signal:u,referrer:f},this.follow=r.follow===void 0?e.follow===void 0?20:e.follow:r.follow,this.compress=r.compress===void 0?e.compress===void 0?!0:e.compress:r.compress,this.counter=r.counter||e.counter||0,this.agent=r.agent||e.agent,this.highWaterMark=r.highWaterMark||e.highWaterMark||16384,this.insecureHTTPParser=r.insecureHTTPParser||e.insecureHTTPParser||!1,this.referrerPolicy=r.referrerPolicy||e.referrerPolicy||""}get method(){return this[ee].method}get url(){return(0,Al.format)(this[ee].parsedURL)}get headers(){return this[ee].headers}get redirect(){return this[ee].redirect}get signal(){return this[ee].signal}get referrer(){if(this[ee].referrer==="no-referrer")return"";if(this[ee].referrer==="client")return"about:client";if(this[ee].referrer)return this[ee].referrer.toString()}get referrerPolicy(){return this[ee].referrerPolicy}set referrerPolicy(e){this[ee].referrerPolicy=Cl(e)}clone(){return new t(this)}get[Symbol.toStringTag](){return"Request"}};Object.defineProperties(Ut.prototype,{method:{enumerable:!0},url:{enumerable:!0},headers:{enumerable:!0},redirect:{enumerable:!0},clone:{enumerable:!0},signal:{enumerable:!0},referrer:{enumerable:!0},referrerPolicy:{enumerable:!0}});Pl=t=>{let{parsedURL:e}=t[ee],r=new be(t[ee].headers);r.has("Accept")||r.set("Accept","*/*");let a=null;if(t.body===null&&/^(post|put)$/i.test(t.method)&&(a="0"),t.body!==null){let u=gl(t);typeof u=="number"&&!Number.isNaN(u)&&(a=String(u))}a&&r.set("Content-Length",a),t.referrerPolicy===""&&(t.referrerPolicy=Tl),t.referrer&&t.referrer!=="no-referrer"?t[ee].referrer=Rl(t):t[ee].referrer="no-referrer",t[ee].referrer instanceof URL&&r.set("Referer",t.referrer),r.has("User-Agent")||r.set("User-Agent","node-fetch"),t.compress&&!r.has("Accept-Encoding")&&r.set("Accept-Encoding","gzip, deflate, br");let{agent:o}=t;typeof o=="function"&&(o=o(e));let i=_l(e),c={path:e.pathname+i,method:t.method,headers:r[Symbol.for("nodejs.util.inspect.custom")](),insecureHTTPParser:t.insecureHTTPParser,agent:o};return{parsedURL:e,options:c}}});var An,Ol=q(()=>{Na();An=class extends wt{constructor(e,r="aborted"){super(e,r)}}});var Nl={};Pe(Nl,{AbortError:()=>An,Blob:()=>He,FetchError:()=>de,File:()=>Wt,FormData:()=>Bt,Headers:()=>be,Request:()=>Ut,Response:()=>xe,blobFrom:()=>cl,blobFromSync:()=>il,default:()=>St,fileFrom:()=>ll,fileFromSync:()=>ul,isRedirect:()=>Rn});async function St(t,e){return new Promise((r,a)=>{let o=new Ut(t,e),{parsedURL:i,options:c}=Pl(o);if(!gm.has(i.protocol))throw new TypeError(`node-fetch cannot load ${t}. URL scheme "${i.protocol.replace(/:$/,"")}" is not supported.`);if(i.protocol==="data:"){let x=zc(o.url),z=new xe(x,{headers:{"Content-Type":x.typeFull}});r(z);return}let u=(i.protocol==="https:"?Ll.default:Dl.default).request,{signal:f}=o,d=null,g=()=>{let x=new An("The operation was aborted.");a(x),o.body&&o.body instanceof ve.default.Readable&&o.body.destroy(x),!(!d||!d.body)&&d.body.emit("error",x)};if(f&&f.aborted){g();return}let k=()=>{g(),D()},C=u(i.toString(),c);f&&f.addEventListener("abort",k);let D=()=>{C.abort(),f&&f.removeEventListener("abort",k)};C.on("error",x=>{a(new de(`request to ${o.url} failed, reason: ${x.message}`,"system",x)),D()}),ym(C,x=>{d&&d.body&&d.body.destroy(x)}),process.version<"v14"&&C.on("socket",x=>{let z;x.prependListener("end",()=>{z=x._eventsCount}),x.prependListener("close",B=>{if(d&&z<x._eventsCount&&!B){let W=new Error("Premature close");W.code="ERR_STREAM_PREMATURE_CLOSE",d.body.emit("error",W)}})}),C.on("response",x=>{C.setTimeout(0);let z=bl(x.rawHeaders);if(Rn(x.statusCode)){let U=z.get("Location"),H=null;try{H=U===null?null:new URL(U,o.url)}catch{if(o.redirect!=="manual"){a(new de(`uri requested responds with an invalid redirect URL: ${U}`,"invalid-redirect")),D();return}}switch(o.redirect){case"error":a(new de(`uri requested responds with a redirect, redirect mode is set to error: ${o.url}`,"no-redirect")),D();return;case"manual":break;case"follow":{if(H===null)break;if(o.counter>=o.follow){a(new de(`maximum redirect reached at: ${o.url}`,"max-redirect")),D();return}let Q={headers:new be(o.headers),follow:o.follow,counter:o.counter+1,agent:o.agent,compress:o.compress,method:o.method,body:Kr(o),signal:o.signal,size:o.size,referrer:o.referrer,referrerPolicy:o.referrerPolicy};if(!tl(o.url,H)||!rl(o.url,H))for(let sn of["authorization","www-authenticate","cookie","cookie2"])Q.headers.delete(sn);if(x.statusCode!==303&&o.body&&e.body instanceof ve.default.Readable){a(new de("Cannot follow redirect with body being a readable stream","unsupported-redirect")),D();return}(x.statusCode===303||(x.statusCode===301||x.statusCode===302)&&o.method==="POST")&&(Q.method="GET",Q.body=void 0,Q.headers.delete("content-length"));let Tt=El(z);Tt&&(Q.referrerPolicy=Tt),r(St(new Ut(H,Q))),D();return}default:return a(new TypeError(`Redirect option '${o.redirect}' is not a valid value of RequestRedirect`))}}f&&x.once("end",()=>{f.removeEventListener("abort",k)});let B=(0,ve.pipeline)(x,new ve.PassThrough,U=>{U&&a(U)});process.version<"v12.10"&&x.on("aborted",k);let W={url:o.url,status:x.statusCode,statusText:x.statusMessage,headers:z,size:o.size,counter:o.counter,highWaterMark:o.highWaterMark},Y=z.get("Content-Encoding");if(!o.compress||o.method==="HEAD"||Y===null||x.statusCode===204||x.statusCode===304){d=new xe(B,W),r(d);return}let re={flush:wr.default.Z_SYNC_FLUSH,finishFlush:wr.default.Z_SYNC_FLUSH};if(Y==="gzip"||Y==="x-gzip"){B=(0,ve.pipeline)(B,wr.default.createGunzip(re),U=>{U&&a(U)}),d=new xe(B,W),r(d);return}if(Y==="deflate"||Y==="x-deflate"){let U=(0,ve.pipeline)(x,new ve.PassThrough,H=>{H&&a(H)});U.once("data",H=>{(H[0]&15)===8?B=(0,ve.pipeline)(B,wr.default.createInflate(),Q=>{Q&&a(Q)}):B=(0,ve.pipeline)(B,wr.default.createInflateRaw(),Q=>{Q&&a(Q)}),d=new xe(B,W),r(d)}),U.once("end",()=>{d||(d=new xe(B,W),r(d))});return}if(Y==="br"){B=(0,ve.pipeline)(B,wr.default.createBrotliDecompress(),U=>{U&&a(U)}),d=new xe(B,W),r(d);return}d=new xe(B,W),r(d)}),yl(C,o).catch(a)})}function ym(t,e){let r=$n.Buffer.from(`0\r
\r
`),a=!1,o=!1,i;t.on("response",c=>{let{headers:u}=c;a=u["transfer-encoding"]==="chunked"&&!u["content-length"]}),t.on("socket",c=>{let u=()=>{if(a&&!o){let d=new Error("Premature close");d.code="ERR_STREAM_PREMATURE_CLOSE",e(d)}},f=d=>{o=$n.Buffer.compare(d.slice(-5),r)===0,!o&&i&&(o=$n.Buffer.compare(i.slice(-3),r.slice(0,3))===0&&$n.Buffer.compare(d.slice(-2),r.slice(3))===0),i=d};c.prependListener("close",u),c.on("data",f),t.on("close",()=>{c.removeListener("close",u),c.removeListener("data",f)})})}var Dl,Ll,wr,ve,$n,gm,Va=q(()=>{Dl=Be(require("node:http"),1),Ll=Be(require("node:https"),1),wr=Be(require("node:zlib"),1),ve=Be(require("node:stream"),1),$n=require("node:buffer");Hc();Ua();wl();Ha();Il();ss();Ol();hs();La();ja();ms();ls();gm=new Set(["data:","http:","https:"])});function te(t,e,r,a){if(r==="a"&&!a)throw new TypeError("Private accessor was defined without a getter");if(typeof e=="function"?t!==e||!a:!e.has(t))throw new TypeError("Cannot read private member from an object whose class did not declare it");return r==="m"?a:r==="a"?a.call(t):a?a.value:e.get(t)}function xr(t,e,r,a,o){if(a==="m")throw new TypeError("Private method is not writable");if(a==="a"&&!o)throw new TypeError("Private accessor was defined without a setter");if(typeof e=="function"?t!==e||!o:!e.has(t))throw new TypeError("Cannot write private member to an object whose class did not declare it");return a==="a"?o.call(t,r):o?o.value=r:e.set(t,r),r}var eu=q(()=>{});var As={};Pe(As,{Channel:()=>nn,PluginListener:()=>On,Resource:()=>zt,SERIALIZE_TO_IPC_FN:()=>ce,addPluginListener:()=>Sg,checkPermissions:()=>kg,convertFileSrc:()=>vg,invoke:()=>y,isTauri:()=>Tg,requestPermissions:()=>xg,transformCallback:()=>Ya});function Ya(t,e=!1){return window.__TAURI_INTERNALS__.transformCallback(t,e)}async function Sg(t,e,r){let a=new nn(r);try{return y(`plugin:${t}|register_listener`,{event:e,handler:a}).then(()=>new On(t,e,a.id))}catch{return y(`plugin:${t}|registerListener`,{event:e,handler:a}).then(()=>new On(t,e,a.id))}}async function kg(t){return y(`plugin:${t}|check_permissions`)}async function xg(t){return y(`plugin:${t}|request_permissions`)}async function y(t,e={},r){return window.__TAURI_INTERNALS__.invoke(t,e,r)}function vg(t,e="asset"){return window.__TAURI_INTERNALS__.convertFileSrc(t,e)}function Tg(){return!!(globalThis||window).isTauri}var vr,Me,rn,Ja,Za,ce,nn,On,zt,ot=q(()=>{eu();ce="__TAURI_TO_IPC_KEY__";nn=class{constructor(e){vr.set(this,void 0),Me.set(this,0),rn.set(this,[]),Ja.set(this,void 0),xr(this,vr,e||(()=>{}),"f"),this.id=Ya(r=>{let a=r.index;if("end"in r){a==te(this,Me,"f")?this.cleanupCallback():xr(this,Ja,a,"f");return}let o=r.message;if(a==te(this,Me,"f")){for(te(this,vr,"f").call(this,o),xr(this,Me,te(this,Me,"f")+1,"f");te(this,Me,"f")in te(this,rn,"f");){let i=te(this,rn,"f")[te(this,Me,"f")];te(this,vr,"f").call(this,i),delete te(this,rn,"f")[te(this,Me,"f")],xr(this,Me,te(this,Me,"f")+1,"f")}te(this,Me,"f")===te(this,Ja,"f")&&this.cleanupCallback()}else te(this,rn,"f")[a]=o})}cleanupCallback(){window.__TAURI_INTERNALS__.unregisterCallback(this.id)}set onmessage(e){xr(this,vr,e,"f")}get onmessage(){return te(this,vr,"f")}[(vr=new WeakMap,Me=new WeakMap,rn=new WeakMap,Ja=new WeakMap,ce)](){return`__CHANNEL__:${this.id}`}toJSON(){return this[ce]()}},On=class{constructor(e,r,a){this.plugin=e,this.event=r,this.channelId=a}async unregister(){return y(`plugin:${this.plugin}|remove_listener`,{event:this.event,channelId:this.channelId})}};zt=class{get rid(){return te(this,Za,"f")}constructor(e){Za.set(this,void 0),xr(this,Za,e,"f")}async close(){return y("plugin:resources|close",{rid:this.rid})}};Za=new WeakMap});var ru={};Pe(ru,{TauriEvent:()=>fe,emit:()=>Dn,emitTo:()=>Ps,listen:()=>Qa,once:()=>$s});async function tu(t,e){window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener(t,e),await y("plugin:event|unlisten",{event:t,eventId:e})}async function Qa(t,e,r){var a;let o=typeof r?.target=="string"?{kind:"AnyLabel",label:r.target}:(a=r?.target)!==null&&a!==void 0?a:{kind:"Any"};return y("plugin:event|listen",{event:t,target:o,handler:Ya(e)}).then(i=>async()=>tu(t,i))}async function $s(t,e,r){return Qa(t,a=>{tu(t,a.id),e(a)},r)}async function Dn(t,e){await y("plugin:event|emit",{event:t,payload:e})}async function Ps(t,e,r){await y("plugin:event|emit_to",{target:typeof t=="string"?{kind:"AnyLabel",label:t}:t,event:e,payload:r})}var fe,Ka=q(()=>{ot();(function(t){t.WINDOW_RESIZED="tauri://resize",t.WINDOW_MOVED="tauri://move",t.WINDOW_CLOSE_REQUESTED="tauri://close-requested",t.WINDOW_DESTROYED="tauri://destroyed",t.WINDOW_FOCUS="tauri://focus",t.WINDOW_BLUR="tauri://blur",t.WINDOW_SCALE_FACTOR_CHANGED="tauri://scale-change",t.WINDOW_THEME_CHANGED="tauri://theme-changed",t.WINDOW_CREATED="tauri://window-created",t.WEBVIEW_CREATED="tauri://webview-created",t.DRAG_ENTER="tauri://drag-enter",t.DRAG_OVER="tauri://drag-over",t.DRAG_DROP="tauri://drag-drop",t.DRAG_LEAVE="tauri://drag-leave"})(fe||(fe={}))});var Xa={};Pe(Xa,{BaseDirectory:()=>V,appCacheDir:()=>Ag,appConfigDir:()=>Cg,appDataDir:()=>Rg,appLocalDataDir:()=>Eg,appLogDir:()=>Jg,audioDir:()=>$g,basename:()=>ny,cacheDir:()=>Pg,configDir:()=>Ig,dataDir:()=>Og,delimiter:()=>Qg,desktopDir:()=>Dg,dirname:()=>ty,documentDir:()=>Lg,downloadDir:()=>Ng,executableDir:()=>Mg,extname:()=>ry,fontDir:()=>jg,homeDir:()=>Fg,isAbsolute:()=>ay,join:()=>ey,localDataDir:()=>Wg,normalize:()=>Xg,pictureDir:()=>Bg,publicDir:()=>qg,resolve:()=>Kg,resolveResource:()=>zg,resourceDir:()=>Ug,runtimeDir:()=>Hg,sep:()=>Yg,tempDir:()=>Zg,templateDir:()=>Vg,videoDir:()=>Gg});async function Cg(){return y("plugin:path|resolve_directory",{directory:V.AppConfig})}async function Rg(){return y("plugin:path|resolve_directory",{directory:V.AppData})}async function Eg(){return y("plugin:path|resolve_directory",{directory:V.AppLocalData})}async function Ag(){return y("plugin:path|resolve_directory",{directory:V.AppCache})}async function $g(){return y("plugin:path|resolve_directory",{directory:V.Audio})}async function Pg(){return y("plugin:path|resolve_directory",{directory:V.Cache})}async function Ig(){return y("plugin:path|resolve_directory",{directory:V.Config})}async function Og(){return y("plugin:path|resolve_directory",{directory:V.Data})}async function Dg(){return y("plugin:path|resolve_directory",{directory:V.Desktop})}async function Lg(){return y("plugin:path|resolve_directory",{directory:V.Document})}async function Ng(){return y("plugin:path|resolve_directory",{directory:V.Download})}async function Mg(){return y("plugin:path|resolve_directory",{directory:V.Executable})}async function jg(){return y("plugin:path|resolve_directory",{directory:V.Font})}async function Fg(){return y("plugin:path|resolve_directory",{directory:V.Home})}async function Wg(){return y("plugin:path|resolve_directory",{directory:V.LocalData})}async function Bg(){return y("plugin:path|resolve_directory",{directory:V.Picture})}async function qg(){return y("plugin:path|resolve_directory",{directory:V.Public})}async function Ug(){return y("plugin:path|resolve_directory",{directory:V.Resource})}async function zg(t){return y("plugin:path|resolve_directory",{directory:V.Resource,path:t})}async function Hg(){return y("plugin:path|resolve_directory",{directory:V.Runtime})}async function Vg(){return y("plugin:path|resolve_directory",{directory:V.Template})}async function Gg(){return y("plugin:path|resolve_directory",{directory:V.Video})}async function Jg(){return y("plugin:path|resolve_directory",{directory:V.AppLog})}async function Zg(){return y("plugin:path|resolve_directory",{directory:V.Temp})}function Yg(){return window.__TAURI_INTERNALS__.plugins.path.sep}function Qg(){return window.__TAURI_INTERNALS__.plugins.path.delimiter}async function Kg(...t){return y("plugin:path|resolve",{paths:t})}async function Xg(t){return y("plugin:path|normalize",{path:t})}async function ey(...t){return y("plugin:path|join",{paths:t})}async function ty(t){return y("plugin:path|dirname",{path:t})}async function ry(t){return y("plugin:path|extname",{path:t})}async function ny(t,e){return y("plugin:path|basename",{path:t,ext:e})}async function ay(t){return y("plugin:path|is_absolute",{path:t})}var V,Ln=q(()=>{ot();(function(t){t[t.Audio=1]="Audio",t[t.Cache=2]="Cache",t[t.Config=3]="Config",t[t.Data=4]="Data",t[t.LocalData=5]="LocalData",t[t.Document=6]="Document",t[t.Download=7]="Download",t[t.Picture=8]="Picture",t[t.Public=9]="Public",t[t.Video=10]="Video",t[t.Resource=11]="Resource",t[t.Temp=12]="Temp",t[t.AppConfig=13]="AppConfig",t[t.AppData=14]="AppData",t[t.AppLocalData=15]="AppLocalData",t[t.AppCache=16]="AppCache",t[t.AppLog=17]="AppLog",t[t.Desktop=18]="Desktop",t[t.Executable=19]="Executable",t[t.Font=20]="Font",t[t.Home=21]="Home",t[t.Runtime=22]="Runtime",t[t.Template=23]="Template"})(V||(V={}))});var Ls={};Pe(Ls,{BaseDirectory:()=>V,FileHandle:()=>Nn,SeekMode:()=>Is,copyFile:()=>iy,create:()=>sy,exists:()=>_y,lstat:()=>gy,mkdir:()=>cy,open:()=>nu,readDir:()=>ly,readFile:()=>uy,readTextFile:()=>dy,readTextFileLines:()=>fy,remove:()=>py,rename:()=>hy,size:()=>xy,stat:()=>my,truncate:()=>yy,watch:()=>Sy,watchImmediate:()=>ky,writeFile:()=>by,writeTextFile:()=>wy});function Ds(t){return{isFile:t.isFile,isDirectory:t.isDirectory,isSymlink:t.isSymlink,size:t.size,mtime:t.mtime!==null?new Date(t.mtime):null,atime:t.atime!==null?new Date(t.atime):null,birthtime:t.birthtime!==null?new Date(t.birthtime):null,readonly:t.readonly,fileAttributes:t.fileAttributes,dev:t.dev,ino:t.ino,mode:t.mode,nlink:t.nlink,uid:t.uid,gid:t.gid,rdev:t.rdev,blksize:t.blksize,blocks:t.blocks}}function oy(t){let e=new Uint8ClampedArray(t),r=e.byteLength,a=0;for(let o=0;o<r;o++){let i=e[o];a*=256,a+=i}return a}async function sy(t,e){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");let r=await y("plugin:fs|create",{path:t instanceof URL?t.toString():t,options:e});return new Nn(r)}async function nu(t,e){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");let r=await y("plugin:fs|open",{path:t instanceof URL?t.toString():t,options:e});return new Nn(r)}async function iy(t,e,r){if(t instanceof URL&&t.protocol!=="file:"||e instanceof URL&&e.protocol!=="file:")throw new TypeError("Must be a file URL.");await y("plugin:fs|copy_file",{fromPath:t instanceof URL?t.toString():t,toPath:e instanceof URL?e.toString():e,options:r})}async function cy(t,e){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");await y("plugin:fs|mkdir",{path:t instanceof URL?t.toString():t,options:e})}async function ly(t,e){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");return await y("plugin:fs|read_dir",{path:t instanceof URL?t.toString():t,options:e})}async function uy(t,e){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");let r=await y("plugin:fs|read_file",{path:t instanceof URL?t.toString():t,options:e});return r instanceof ArrayBuffer?new Uint8Array(r):Uint8Array.from(r)}async function dy(t,e){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");let r=await y("plugin:fs|read_text_file",{path:t instanceof URL?t.toString():t,options:e}),a=r instanceof ArrayBuffer?r:Uint8Array.from(r);return new TextDecoder().decode(a)}async function fy(t,e){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");let r=t instanceof URL?t.toString():t;return await Promise.resolve({path:r,rid:null,async next(){this.rid===null&&(this.rid=await y("plugin:fs|read_text_file_lines",{path:r,options:e}));let a=await y("plugin:fs|read_text_file_lines_next",{rid:this.rid}),o=a instanceof ArrayBuffer?new Uint8Array(a):Uint8Array.from(a),i=o[o.byteLength-1]===1;return i?(this.rid=null,{value:null,done:i}):{value:new TextDecoder().decode(o.slice(0,o.byteLength)),done:i}},[Symbol.asyncIterator](){return this}})}async function py(t,e){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");await y("plugin:fs|remove",{path:t instanceof URL?t.toString():t,options:e})}async function hy(t,e,r){if(t instanceof URL&&t.protocol!=="file:"||e instanceof URL&&e.protocol!=="file:")throw new TypeError("Must be a file URL.");await y("plugin:fs|rename",{oldPath:t instanceof URL?t.toString():t,newPath:e instanceof URL?e.toString():e,options:r})}async function my(t,e){let r=await y("plugin:fs|stat",{path:t instanceof URL?t.toString():t,options:e});return Ds(r)}async function gy(t,e){let r=await y("plugin:fs|lstat",{path:t instanceof URL?t.toString():t,options:e});return Ds(r)}async function yy(t,e,r){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");await y("plugin:fs|truncate",{path:t instanceof URL?t.toString():t,len:e,options:r})}async function by(t,e,r){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");if(e instanceof ReadableStream){let a=await nu(t,{read:!1,create:!0,write:!0,...r}),o=e.getReader();try{for(;;){let{done:i,value:c}=await o.read();if(i)break;await a.write(c)}}finally{o.releaseLock(),await a.close()}}else await y("plugin:fs|write_file",e,{headers:{path:encodeURIComponent(t instanceof URL?t.toString():t),options:JSON.stringify(r)}})}async function wy(t,e,r){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");let a=new TextEncoder;await y("plugin:fs|write_text_file",a.encode(e),{headers:{path:encodeURIComponent(t instanceof URL?t.toString():t),options:JSON.stringify(r)}})}async function _y(t,e){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");return await y("plugin:fs|exists",{path:t instanceof URL?t.toString():t,options:e})}async function au(t,e,r){let a=Array.isArray(t)?t:[t];for(let u of a)if(u instanceof URL&&u.protocol!=="file:")throw new TypeError("Must be a file URL.");let o=new nn;o.onmessage=e;let i=await y("plugin:fs|watch",{paths:a.map(u=>u instanceof URL?u.toString():u),options:r,onEvent:o}),c=new Os(i);return()=>{c.close()}}async function Sy(t,e,r){return await au(t,e,{delayMs:2e3,...r})}async function ky(t,e,r){return await au(t,e,{...r,delayMs:void 0})}async function xy(t){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");return await y("plugin:fs|size",{path:t instanceof URL?t.toString():t})}var Is,Nn,Os,Ns=q(()=>{Ln();ot();(function(t){t[t.Start=0]="Start",t[t.Current=1]="Current",t[t.End=2]="End"})(Is||(Is={}));Nn=class extends zt{async read(e){if(e.byteLength===0)return 0;let r=await y("plugin:fs|read",{rid:this.rid,len:e.byteLength}),a=oy(r.slice(-8)),o=r instanceof ArrayBuffer?new Uint8Array(r):r;return e.set(o.slice(0,o.length-8)),a===0?null:a}async seek(e,r){return await y("plugin:fs|seek",{rid:this.rid,offset:e,whence:r})}async stat(){let e=await y("plugin:fs|fstat",{rid:this.rid});return Ds(e)}async truncate(e){await y("plugin:fs|ftruncate",{rid:this.rid,len:e})}async write(e){return await y("plugin:fs|write",{rid:this.rid,data:e})}};Os=class extends zt{}});var hu={};Pe(hu,{fileOperations:()=>Tr,keyboardUtils:()=>jn,uiUtils:()=>Fn,validationUtils:()=>Ht});var Tr,jn,Fn,Ht,Wn=q(()=>{Tr={getExtension:t=>{let e=t.lastIndexOf(".");return e>0?t.slice(e+1).toLowerCase():""},isMarkdown:t=>{let e=Tr.getExtension(t);return["md","markdown","mdown","mkd","mdwn"].includes(e)},isImage:t=>{let e=Tr.getExtension(t);return["jpg","jpeg","png","gif","webp","svg","bmp","ico"].includes(e)},getBasename:t=>{let e=t.lastIndexOf("."),a=Math.max(t.lastIndexOf("/"),t.lastIndexOf("\\"))+1,o=e>a?e:t.length;return t.slice(a,o)}},jn={isModifierPressed:t=>t.ctrlKey||t.metaKey||t.altKey||t.shiftKey,getNormalizedKey:t=>{let e=[];(t.ctrlKey||t.metaKey)&&e.push("Ctrl"),t.altKey&&e.push("Alt"),t.shiftKey&&e.push("Shift");let r=t.key;return r===" "&&(r="Space"),r==="ArrowLeft"&&(r="Left"),r==="ArrowRight"&&(r="Right"),r==="ArrowUp"&&(r="Up"),r==="ArrowDown"&&(r="Down"),r.length===1&&(r=r.toUpperCase()),e.push(r),e.join("+")}},Fn={formatFileSize:t=>{if(t===0)return"0 B";let e=1024,r=["B","KB","MB","GB","TB"],a=Math.floor(Math.log(t)/Math.log(e));return`${parseFloat((t/Math.pow(e,a)).toFixed(2))} ${r[a]}`},formatDate:t=>{let e=new Date(t),a=new Date-e,o=Math.floor(a/(1e3*60*60*24));if(o===0){let i=Math.floor(a/36e5);if(i===0){let c=Math.floor(a/6e4);return c===0?"Just now":`${c} minutes ago`}return`${i} hours ago`}else return o===1?"Yesterday":o<7?`${o} days ago`:e.toLocaleDateString()}},Ht={isValidFilename:t=>!/[<>:"|?*]/.test(t)&&t.trim().length>0,isValidFoldername:t=>Ht.isValidFilename(t)&&!t.startsWith(".")&&t!==".."&&t!=="."}});var Bn,mu=q(()=>{Bn={app:{name:"Lokus",executableName:"lokus.exe",defaultInstallPath:"C:\\Program Files\\Lokus",userDataPath:"%APPDATA%\\Lokus",tempPath:"%TEMP%\\Lokus"},files:{defaultWorkspacePath:"%USERPROFILE%\\Documents\\Lokus",maxPathLength:260,reservedNames:["CON","PRN","AUX","NUL","COM1","COM2","COM3","COM4","COM5","COM6","COM7","COM8","COM9","LPT1","LPT2","LPT3","LPT4","LPT5","LPT6","LPT7","LPT8","LPT9"],invalidChars:'<>:"|?*',associations:{".md":{progId:"Lokus.Markdown",description:"Markdown Document",icon:"markdown.ico"},".markdown":{progId:"Lokus.Markdown",description:"Markdown Document",icon:"markdown.ico"}}},terminal:{preferences:[{name:"Windows Terminal",command:"wt",args:["-d","{path}"],available:null},{name:"PowerShell",command:"powershell",args:["-NoExit","-Command",'cd "{path}"'],available:null},{name:"Command Prompt",command:"cmd",args:["/k",'cd /d "{path}"'],available:!0}]},shortcuts:{global:{newWindow:"Ctrl+Shift+N",closeWindow:"Alt+F4",minimize:"Win+Down",maximize:"Win+Up"},editor:{selectWord:"Ctrl+D",selectLine:"Ctrl+L",deleteLine:"Ctrl+Shift+K",duplicateLine:"Ctrl+Shift+D",moveLineUp:"Alt+Up",moveLineDown:"Alt+Down"}},ui:{borderRadius:"8px",acrylic:{enabled:!0,tint:"rgba(255, 255, 255, 0.05)",blur:"20px"},snapLayouts:{enabled:!0,zones:["half-left","half-right","quarter","three-quarter"]},contextMenu:{style:"windows11",animations:!0,icons:!0}},shell:{contextMenu:{enabled:!0,entries:[{key:"open_with_lokus",title:"Open with Lokus",icon:"%INSTALLDIR%\\lokus.ico",command:'"%INSTALLDIR%\\lokus.exe" "%1"'}]},jumpList:{enabled:!0,maxItems:10,categories:["Recent","Tasks"]}},notifications:{provider:"windows-native",defaultSound:"ms-winsoundevent:Notification.Default",badgeSupport:!0,actionCenter:!0},performance:{directWrite:!0,hardwareAcceleration:!0,gpuRasterization:!0},features:{windowsHello:!1,darkModeSync:!0,taskbarProgress:!0,thumbnailToolbar:!0,aeroSnap:!0}}});var Us={};Pe(Us,{cleanupWindowsFeatures:()=>$y,contextMenu:()=>qs,fileAssociations:()=>gu,initializeWindowsFeatures:()=>Ay,jumpList:()=>yu,notifications:()=>Ry,searchIntegration:()=>Ey,taskbarProgress:()=>bu,themeIntegration:()=>wu});async function Ay(t={}){let e={fileAssociations:!1,contextMenu:!1,darkModeSync:!1};return t.fileAssociations!==!1&&(e.fileAssociations=await gu.register()),t.contextMenu!==!1&&(e.contextMenu=await qs.register()),t.darkModeSync!==!1&&(e.darkModeSync=await wu.syncDarkMode()),e}async function $y(){await qs.unregister(),await yu.clear(),await bu.clear()}var gu,yu,qs,bu,Ry,wu,Ey,_u=q(()=>{ot();mu();gu={async register(){try{return await y("windows_register_file_associations",{associations:Bn.files.associations}),!0}catch(t){return console.error("Failed to register file associations:",t),!1}},async check(){try{return await y("windows_check_file_associations")}catch(t){return console.error("Failed to check file associations:",t),!1}}},yu={async update(t){try{let e=t.map(r=>({type:"task",title:r.name||"Untitled Workspace",description:r.path,program:"lokus.exe",args:`"${r.path}"`,iconPath:r.path,iconIndex:0}));return await y("windows_update_jump_list",{items:e,maxItems:Bn.shell.jumpList.maxItems}),!0}catch(e){return console.error("Failed to update jump list:",e),!1}},async clear(){try{return await y("windows_clear_jump_list"),!0}catch(t){return console.error("Failed to clear jump list:",t),!1}}},qs={async register(){try{return await y("windows_register_context_menu",{entries:Bn.shell.contextMenu.entries}),!0}catch(t){return console.error("Failed to register context menu:",t),!1}},async unregister(){try{return await y("windows_unregister_context_menu"),!0}catch(t){return console.error("Failed to unregister context menu:",t),!1}}},bu={async setProgress(t,e="normal"){try{return await y("windows_set_taskbar_progress",{progress:Math.max(0,Math.min(1,t)),state:e}),!0}catch(r){return console.error("Failed to set taskbar progress:",r),!1}},async clear(){try{return await y("windows_clear_taskbar_progress"),!0}catch(t){return console.error("Failed to clear taskbar progress:",t),!1}}},Ry={async show(t){try{let e={title:t.title,body:t.body,icon:t.icon||"lokus.ico",sound:t.sound!==!1?Bn.notifications.defaultSound:null,actions:t.actions||[],silent:t.silent||!1};return await y("windows_show_notification",e)}catch(e){return console.error("Failed to show notification:",e),null}},async clear(t){try{return await y("windows_clear_notification",{id:t}),!0}catch(e){return console.error("Failed to clear notification:",e),!1}}},wu={async syncDarkMode(){try{return await y("windows_is_dark_mode")}catch{return window.matchMedia("(prefers-color-scheme: dark)").matches}},async onThemeChange(t){try{await y("windows_watch_theme_changes");let{listen:e}=await Promise.resolve().then(()=>(Ka(),ru));return await e("windows-theme-changed",a=>{t(a.payload.isDarkMode)})}catch(e){return console.error("Failed to watch theme changes:",e),null}}},Ey={async indexWorkspace(t){try{return await y("windows_index_workspace",{path:t}),!0}catch(e){return console.error("Failed to index workspace:",e),!1}},async removeFromIndex(t){try{return await y("windows_remove_from_index",{path:t}),!0}catch(e){return console.error("Failed to remove from index:",e),!1}}}});var ku={};Pe(ku,{fileOperations:()=>Tr,keyboardUtils:()=>jn,uiUtils:()=>Fn,validationUtils:()=>Ht,windowsFeatureHelpers:()=>Dy,windowsFeaturesFromModule:()=>Us,windowsPathUtils:()=>qn,windowsShell:()=>Oy,windowsShortcuts:()=>Py,windowsUI:()=>Iy,windowsValidation:()=>Su});var Py,qn,Su,Iy,Oy,Dy,xu=q(()=>{Wn();_u();Py={newFile:"Ctrl+N",newFolder:"Ctrl+Shift+N",save:"Ctrl+S",saveAs:"Ctrl+Shift+S",close:"Ctrl+W",closeAll:"Ctrl+Shift+W",find:"Ctrl+F",findAndReplace:"Ctrl+H",findInFiles:"Ctrl+Shift+F",commandPalette:"Ctrl+K",quickOpen:"Ctrl+P",properties:"Alt+Enter",rename:"F2",refresh:"F5",fullscreen:"F11",cut:"Ctrl+X",copy:"Ctrl+C",paste:"Ctrl+V",selectAll:"Ctrl+A",undo:"Ctrl+Z",redo:"Ctrl+Y",nextTab:"Ctrl+Tab",previousTab:"Ctrl+Shift+Tab",closeTab:"Ctrl+W",reopenTab:"Ctrl+Shift+T",toggleSidebar:"Ctrl+B",togglePreview:"Ctrl+Shift+V",zoomIn:"Ctrl+Plus",zoomOut:"Ctrl+Minus",resetZoom:"Ctrl+0"},qn={toWindowsPath:t=>t&&(t.startsWith("//")?"\\\\"+t.slice(2).replace(/\//g,"\\"):t.replace(/\//g,"\\")),toUnixPath:t=>t&&(t.startsWith("\\\\")?"//"+t.slice(2).replace(/\\/g,"/"):t.replace(/\\/g,"/")),getDriveLetter:t=>{let e=t.match(/^([A-Za-z]):/);return e?e[1].toUpperCase():null},isAbsolutePath:t=>/^[A-Za-z]:/.test(t)||t.startsWith("\\\\"),isUNCPath:t=>t.startsWith("\\\\")||t.startsWith("//"),normalizePath:t=>t&&(t.startsWith("\\\\")?"\\\\"+t.slice(2).replace(/\\+/g,"\\").replace(/\\$/,""):t.replace(/\\+/g,"\\").replace(/\\$/,"")),joinPath:(...t)=>{let e=t.filter(Boolean).join("\\").replace(/\\+/g,"\\");return t[0]&&t[0].startsWith("\\\\")?"\\\\"+e.slice(2):e},getParentDirectory:t=>{if(!t)return t;let r=qn.normalizePath(t).split("\\");return r.length<=1||r.length===2&&r[1]===""?null:(r.pop(),r.join("\\"))},getFilename:t=>{if(!t)return"";let r=qn.normalizePath(t).split("\\");return r[r.length-1]},isPathTooLong:t=>t.length>=260&&!t.startsWith("\\\\?\\"),toLongPath:t=>!t||t.startsWith("\\\\?\\")?t:qn.isUNCPath(t)?"\\\\?\\UNC\\"+t.slice(2):qn.isAbsolutePath(t)&&t.length>=260?"\\\\?\\"+t:t},Su={...Ht,isReservedFilename:t=>{let e=["CON","PRN","AUX","NUL","COM1","COM2","COM3","COM4","COM5","COM6","COM7","COM8","COM9","LPT1","LPT2","LPT3","LPT4","LPT5","LPT6","LPT7","LPT8","LPT9"],r=t.split(".")[0].toUpperCase();return e.includes(r)},isValidFilename:t=>!/[<>:"|?*\x00-\x1f]/.test(t)&&!Su.isReservedFilename(t)&&!t.endsWith(".")&&!t.endsWith(" ")&&t.trim().length>0,isPathLengthValid:t=>t.length<260},Iy={getAccentColor:()=>"#0078D4",isDarkModeEnabled:()=>window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches,getWindowsStyles:()=>({borderRadius:"8px",backdropFilter:"blur(20px)",boxShadow:"0 2px 20px rgba(0, 0, 0, 0.1)"})},Oy={getContextMenuItems:()=>[{id:"open-with-lokus",label:"Open with Lokus",icon:"file-text"},{id:"reveal-in-explorer",label:"Reveal in Explorer",icon:"folder-open"}],getFileAssociations:()=>({".md":{description:"Markdown Document",icon:"markdown-icon",progId:"Lokus.Markdown"},".markdown":{description:"Markdown Document",icon:"markdown-icon",progId:"Lokus.Markdown"}})},Dy={getJumpListItems:t=>t.map(e=>({type:"task",title:e.name,description:e.path,program:"lokus.exe",args:`--workspace "${e.path}"`,iconPath:e.path,iconIndex:0})),getNotificationOptions:()=>({badge:!0,sound:!0,actions:!0,inline:!0,persistent:!1})}});var vu={};Pe(vu,{fileOperations:()=>Tr,finderIntegration:()=>Fy,keyboardUtils:()=>jn,macosFeatures:()=>Wy,macosPathUtils:()=>Ny,macosShortcuts:()=>Ly,macosUI:()=>jy,macosValidation:()=>My,uiUtils:()=>Fn,validationUtils:()=>Ht});var Ly,Ny,My,jy,Fy,Wy,Tu=q(()=>{Wn();Ly={newFile:"Cmd+N",newFolder:"Cmd+Shift+N",save:"Cmd+S",saveAs:"Cmd+Shift+S",close:"Cmd+W",closeAll:"Cmd+Option+W",find:"Cmd+F",findAndReplace:"Cmd+Option+F",findInFiles:"Cmd+Shift+F",commandPalette:"Cmd+K",quickOpen:"Cmd+P",spotlight:"Cmd+Space",quickLook:"Space",getInfo:"Cmd+I",showInFinder:"Cmd+Option+R",cut:"Cmd+X",copy:"Cmd+C",paste:"Cmd+V",selectAll:"Cmd+A",undo:"Cmd+Z",redo:"Cmd+Shift+Z",nextTab:"Cmd+Option+Right",previousTab:"Cmd+Option+Left",closeTab:"Cmd+W",reopenTab:"Cmd+Shift+T",toggleSidebar:"Cmd+B",togglePreview:"Cmd+Shift+V",zoomIn:"Cmd+Plus",zoomOut:"Cmd+Minus",resetZoom:"Cmd+0",minimize:"Cmd+M",hideWindow:"Cmd+H",hideOthers:"Cmd+Option+H",fullscreen:"Cmd+Control+F"},Ny={expandTilde:async t=>{if(t.startsWith("~/"))try{let{homeDir:e}=await Promise.resolve().then(()=>(Ln(),Xa)),r=await e();return t.replace("~/",r.endsWith("/")?r:`${r}/`)}catch(e){return console.error("Failed to expand tilde path:",e),t}return t},isICloudPath:t=>t.includes("/Library/Mobile Documents/com~apple~CloudDocs/"),getICloudRelativePath:t=>{let e="/Library/Mobile Documents/com~apple~CloudDocs/",r=t.indexOf(e);return r!==-1?t.substring(r+e.length):t},isAbsolutePath:t=>t.startsWith("/")||t.startsWith("~")},My={...Ht,isValidFilename:t=>!/[:/]/.test(t)&&!t.startsWith(".")&&t.trim().length>0,isFilenameLengthValid:t=>t.length<=255},jy={getAccentColor:()=>"#007AFF",isDarkModeEnabled:()=>window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches,getMacStyles:()=>({borderRadius:"10px",backdropFilter:"blur(50px)",WebkitBackdropFilter:"blur(50px)",boxShadow:"0 4px 20px rgba(0, 0, 0, 0.2)"}),getTrafficLightInset:()=>({left:"12px",top:"12px"})},Fy={getContextMenuItems:()=>[{id:"open-with-lokus",label:"Open with Lokus",icon:"file-text"},{id:"quick-look",label:"Quick Look",icon:"eye",shortcut:"Space"},{id:"reveal-in-finder",label:"Reveal in Finder",icon:"folder-open",shortcut:"Cmd+R"}],getFinderTags:()=>[{name:"Red",color:"#FF3B30"},{name:"Orange",color:"#FF9500"},{name:"Yellow",color:"#FFCC00"},{name:"Green",color:"#34C759"},{name:"Blue",color:"#007AFF"},{name:"Purple",color:"#5856D6"},{name:"Gray",color:"#8E8E93"}]},Wy={getTouchBarItems:()=>[{type:"button",label:"New Note",icon:"plus",action:"new-file"},{type:"button",label:"Search",icon:"search",action:"search"},{type:"colorPicker",action:"text-highlight"}],getContinuityOptions:()=>({handoff:!0,universalClipboard:!0,airdrop:!0}),getNotificationOptions:()=>({sound:"default",badge:!0,banner:!0,alert:!1})}});var an,Ze,xt,on,pe,Rr,Vs=q(()=>{ot();an=class{constructor(...e){this.type="Logical",e.length===1?"Logical"in e[0]?(this.width=e[0].Logical.width,this.height=e[0].Logical.height):(this.width=e[0].width,this.height=e[0].height):(this.width=e[0],this.height=e[1])}toPhysical(e){return new Ze(this.width*e,this.height*e)}[ce](){return{width:this.width,height:this.height}}toJSON(){return this[ce]()}},Ze=class{constructor(...e){this.type="Physical",e.length===1?"Physical"in e[0]?(this.width=e[0].Physical.width,this.height=e[0].Physical.height):(this.width=e[0].width,this.height=e[0].height):(this.width=e[0],this.height=e[1])}toLogical(e){return new an(this.width/e,this.height/e)}[ce](){return{width:this.width,height:this.height}}toJSON(){return this[ce]()}},xt=class{constructor(e){this.size=e}toLogical(e){return this.size instanceof an?this.size:this.size.toLogical(e)}toPhysical(e){return this.size instanceof Ze?this.size:this.size.toPhysical(e)}[ce](){return{[`${this.size.type}`]:{width:this.size.width,height:this.size.height}}}toJSON(){return this[ce]()}},on=class{constructor(...e){this.type="Logical",e.length===1?"Logical"in e[0]?(this.x=e[0].Logical.x,this.y=e[0].Logical.y):(this.x=e[0].x,this.y=e[0].y):(this.x=e[0],this.y=e[1])}toPhysical(e){return new pe(this.x*e,this.y*e)}[ce](){return{x:this.x,y:this.y}}toJSON(){return this[ce]()}},pe=class{constructor(...e){this.type="Physical",e.length===1?"Physical"in e[0]?(this.x=e[0].Physical.x,this.y=e[0].Physical.y):(this.x=e[0].x,this.y=e[0].y):(this.x=e[0],this.y=e[1])}toLogical(e){return new on(this.x/e,this.y/e)}[ce](){return{x:this.x,y:this.y}}toJSON(){return this[ce]()}},Rr=class{constructor(e){this.position=e}toLogical(e){return this.position instanceof on?this.position:this.position.toLogical(e)}toPhysical(e){return this.position instanceof pe?this.position:this.position.toPhysical(e)}[ce](){return{[`${this.position.type}`]:{x:this.position.x,y:this.position.y}}}toJSON(){return this[ce]()}}});function Un(t){return t==null?null:typeof t=="string"?t:t instanceof Gs?t.rid:t}var Gs,Pu=q(()=>{ot();Gs=class t extends zt{constructor(e){super(e)}static async new(e,r,a){return y("plugin:image|new",{rgba:Un(e),width:r,height:a}).then(o=>new t(o))}static async fromBytes(e){return y("plugin:image|from_bytes",{bytes:Un(e)}).then(r=>new t(r))}static async fromPath(e){return y("plugin:image|from_path",{path:e}).then(r=>new t(r))}async rgba(){return y("plugin:image|rgba",{rid:this.rid}).then(e=>new Uint8Array(e))}async size(){return y("plugin:image|size",{rid:this.rid})}}});var Lu={};Pe(Lu,{CloseRequestedEvent:()=>ro,Effect:()=>Ys,EffectState:()=>Qs,LogicalPosition:()=>on,LogicalSize:()=>an,PhysicalPosition:()=>pe,PhysicalSize:()=>Ze,ProgressBarStatus:()=>Zs,UserAttentionType:()=>to,Window:()=>zn,availableMonitors:()=>Vy,currentMonitor:()=>Uy,cursorPosition:()=>Gy,getAllWindows:()=>eo,getCurrentWindow:()=>Du,monitorFromPoint:()=>Hy,primaryMonitor:()=>zy});function Du(){return new zn(window.__TAURI_INTERNALS__.metadata.currentWindow.label,{skip:!0})}async function eo(){return y("plugin:window|get_all_windows").then(t=>t.map(e=>new zn(e,{skip:!0})))}function no(t){return t===null?null:{name:t.name,scaleFactor:t.scaleFactor,position:new pe(t.position),size:new Ze(t.size),workArea:{position:new pe(t.workArea.position),size:new Ze(t.workArea.size)}}}async function Uy(){return y("plugin:window|current_monitor").then(no)}async function zy(){return y("plugin:window|primary_monitor").then(no)}async function Hy(t,e){return y("plugin:window|monitor_from_point",{x:t,y:e}).then(no)}async function Vy(){return y("plugin:window|available_monitors").then(t=>t.map(no))}async function Gy(){return y("plugin:window|cursor_position").then(t=>new pe(t))}var to,ro,Zs,Js,zn,Iu,Ou,Ys,Qs,Nu=q(()=>{Vs();Vs();Ka();ot();Pu();(function(t){t[t.Critical=1]="Critical",t[t.Informational=2]="Informational"})(to||(to={}));ro=class{constructor(e){this._preventDefault=!1,this.event=e.event,this.id=e.id}preventDefault(){this._preventDefault=!0}isPreventDefault(){return this._preventDefault}};(function(t){t.None="none",t.Normal="normal",t.Indeterminate="indeterminate",t.Paused="paused",t.Error="error"})(Zs||(Zs={}));Js=["tauri://created","tauri://error"],zn=class{constructor(e,r={}){var a;this.label=e,this.listeners=Object.create(null),r?.skip||y("plugin:window|create",{options:{...r,parent:typeof r.parent=="string"?r.parent:(a=r.parent)===null||a===void 0?void 0:a.label,label:e}}).then(async()=>this.emit("tauri://created")).catch(async o=>this.emit("tauri://error",o))}static async getByLabel(e){var r;return(r=(await eo()).find(a=>a.label===e))!==null&&r!==void 0?r:null}static getCurrent(){return Du()}static async getAll(){return eo()}static async getFocusedWindow(){for(let e of await eo())if(await e.isFocused())return e;return null}async listen(e,r){return this._handleTauriEvent(e,r)?()=>{let a=this.listeners[e];a.splice(a.indexOf(r),1)}:Qa(e,r,{target:{kind:"Window",label:this.label}})}async once(e,r){return this._handleTauriEvent(e,r)?()=>{let a=this.listeners[e];a.splice(a.indexOf(r),1)}:$s(e,r,{target:{kind:"Window",label:this.label}})}async emit(e,r){if(Js.includes(e)){for(let a of this.listeners[e]||[])a({event:e,id:-1,payload:r});return}return Dn(e,r)}async emitTo(e,r,a){if(Js.includes(r)){for(let o of this.listeners[r]||[])o({event:r,id:-1,payload:a});return}return Ps(e,r,a)}_handleTauriEvent(e,r){return Js.includes(e)?(e in this.listeners?this.listeners[e].push(r):this.listeners[e]=[r],!0):!1}async scaleFactor(){return y("plugin:window|scale_factor",{label:this.label})}async innerPosition(){return y("plugin:window|inner_position",{label:this.label}).then(e=>new pe(e))}async outerPosition(){return y("plugin:window|outer_position",{label:this.label}).then(e=>new pe(e))}async innerSize(){return y("plugin:window|inner_size",{label:this.label}).then(e=>new Ze(e))}async outerSize(){return y("plugin:window|outer_size",{label:this.label}).then(e=>new Ze(e))}async isFullscreen(){return y("plugin:window|is_fullscreen",{label:this.label})}async isMinimized(){return y("plugin:window|is_minimized",{label:this.label})}async isMaximized(){return y("plugin:window|is_maximized",{label:this.label})}async isFocused(){return y("plugin:window|is_focused",{label:this.label})}async isDecorated(){return y("plugin:window|is_decorated",{label:this.label})}async isResizable(){return y("plugin:window|is_resizable",{label:this.label})}async isMaximizable(){return y("plugin:window|is_maximizable",{label:this.label})}async isMinimizable(){return y("plugin:window|is_minimizable",{label:this.label})}async isClosable(){return y("plugin:window|is_closable",{label:this.label})}async isVisible(){return y("plugin:window|is_visible",{label:this.label})}async title(){return y("plugin:window|title",{label:this.label})}async theme(){return y("plugin:window|theme",{label:this.label})}async isAlwaysOnTop(){return y("plugin:window|is_always_on_top",{label:this.label})}async center(){return y("plugin:window|center",{label:this.label})}async requestUserAttention(e){let r=null;return e&&(e===to.Critical?r={type:"Critical"}:r={type:"Informational"}),y("plugin:window|request_user_attention",{label:this.label,value:r})}async setResizable(e){return y("plugin:window|set_resizable",{label:this.label,value:e})}async setEnabled(e){return y("plugin:window|set_enabled",{label:this.label,value:e})}async isEnabled(){return y("plugin:window|is_enabled",{label:this.label})}async setMaximizable(e){return y("plugin:window|set_maximizable",{label:this.label,value:e})}async setMinimizable(e){return y("plugin:window|set_minimizable",{label:this.label,value:e})}async setClosable(e){return y("plugin:window|set_closable",{label:this.label,value:e})}async setTitle(e){return y("plugin:window|set_title",{label:this.label,value:e})}async maximize(){return y("plugin:window|maximize",{label:this.label})}async unmaximize(){return y("plugin:window|unmaximize",{label:this.label})}async toggleMaximize(){return y("plugin:window|toggle_maximize",{label:this.label})}async minimize(){return y("plugin:window|minimize",{label:this.label})}async unminimize(){return y("plugin:window|unminimize",{label:this.label})}async show(){return y("plugin:window|show",{label:this.label})}async hide(){return y("plugin:window|hide",{label:this.label})}async close(){return y("plugin:window|close",{label:this.label})}async destroy(){return y("plugin:window|destroy",{label:this.label})}async setDecorations(e){return y("plugin:window|set_decorations",{label:this.label,value:e})}async setShadow(e){return y("plugin:window|set_shadow",{label:this.label,value:e})}async setEffects(e){return y("plugin:window|set_effects",{label:this.label,value:e})}async clearEffects(){return y("plugin:window|set_effects",{label:this.label,value:null})}async setAlwaysOnTop(e){return y("plugin:window|set_always_on_top",{label:this.label,value:e})}async setAlwaysOnBottom(e){return y("plugin:window|set_always_on_bottom",{label:this.label,value:e})}async setContentProtected(e){return y("plugin:window|set_content_protected",{label:this.label,value:e})}async setSize(e){return y("plugin:window|set_size",{label:this.label,value:e instanceof xt?e:new xt(e)})}async setMinSize(e){return y("plugin:window|set_min_size",{label:this.label,value:e instanceof xt?e:e?new xt(e):null})}async setMaxSize(e){return y("plugin:window|set_max_size",{label:this.label,value:e instanceof xt?e:e?new xt(e):null})}async setSizeConstraints(e){function r(a){return a?{Logical:a}:null}return y("plugin:window|set_size_constraints",{label:this.label,value:{minWidth:r(e?.minWidth),minHeight:r(e?.minHeight),maxWidth:r(e?.maxWidth),maxHeight:r(e?.maxHeight)}})}async setPosition(e){return y("plugin:window|set_position",{label:this.label,value:e instanceof Rr?e:new Rr(e)})}async setFullscreen(e){return y("plugin:window|set_fullscreen",{label:this.label,value:e})}async setSimpleFullscreen(e){return y("plugin:window|set_simple_fullscreen",{label:this.label,value:e})}async setFocus(){return y("plugin:window|set_focus",{label:this.label})}async setFocusable(e){return y("plugin:window|set_focusable",{label:this.label,value:e})}async setIcon(e){return y("plugin:window|set_icon",{label:this.label,value:Un(e)})}async setSkipTaskbar(e){return y("plugin:window|set_skip_taskbar",{label:this.label,value:e})}async setCursorGrab(e){return y("plugin:window|set_cursor_grab",{label:this.label,value:e})}async setCursorVisible(e){return y("plugin:window|set_cursor_visible",{label:this.label,value:e})}async setCursorIcon(e){return y("plugin:window|set_cursor_icon",{label:this.label,value:e})}async setBackgroundColor(e){return y("plugin:window|set_background_color",{color:e})}async setCursorPosition(e){return y("plugin:window|set_cursor_position",{label:this.label,value:e instanceof Rr?e:new Rr(e)})}async setIgnoreCursorEvents(e){return y("plugin:window|set_ignore_cursor_events",{label:this.label,value:e})}async startDragging(){return y("plugin:window|start_dragging",{label:this.label})}async startResizeDragging(e){return y("plugin:window|start_resize_dragging",{label:this.label,value:e})}async setBadgeCount(e){return y("plugin:window|set_badge_count",{label:this.label,value:e})}async setBadgeLabel(e){return y("plugin:window|set_badge_label",{label:this.label,value:e})}async setOverlayIcon(e){return y("plugin:window|set_overlay_icon",{label:this.label,value:e?Un(e):void 0})}async setProgressBar(e){return y("plugin:window|set_progress_bar",{label:this.label,value:e})}async setVisibleOnAllWorkspaces(e){return y("plugin:window|set_visible_on_all_workspaces",{label:this.label,value:e})}async setTitleBarStyle(e){return y("plugin:window|set_title_bar_style",{label:this.label,value:e})}async setTheme(e){return y("plugin:window|set_theme",{label:this.label,value:e})}async onResized(e){return this.listen(fe.WINDOW_RESIZED,r=>{r.payload=new Ze(r.payload),e(r)})}async onMoved(e){return this.listen(fe.WINDOW_MOVED,r=>{r.payload=new pe(r.payload),e(r)})}async onCloseRequested(e){return this.listen(fe.WINDOW_CLOSE_REQUESTED,async r=>{let a=new ro(r);await e(a),a.isPreventDefault()||await this.destroy()})}async onDragDropEvent(e){let r=await this.listen(fe.DRAG_ENTER,c=>{e({...c,payload:{type:"enter",paths:c.payload.paths,position:new pe(c.payload.position)}})}),a=await this.listen(fe.DRAG_OVER,c=>{e({...c,payload:{type:"over",position:new pe(c.payload.position)}})}),o=await this.listen(fe.DRAG_DROP,c=>{e({...c,payload:{type:"drop",paths:c.payload.paths,position:new pe(c.payload.position)}})}),i=await this.listen(fe.DRAG_LEAVE,c=>{e({...c,payload:{type:"leave"}})});return()=>{r(),o(),a(),i()}}async onFocusChanged(e){let r=await this.listen(fe.WINDOW_FOCUS,o=>{e({...o,payload:!0})}),a=await this.listen(fe.WINDOW_BLUR,o=>{e({...o,payload:!1})});return()=>{r(),a()}}async onScaleChanged(e){return this.listen(fe.WINDOW_SCALE_FACTOR_CHANGED,e)}async onThemeChanged(e){return this.listen(fe.WINDOW_THEME_CHANGED,e)}};(function(t){t.Disabled="disabled",t.Throttle="throttle",t.Suspend="suspend"})(Iu||(Iu={}));(function(t){t.Default="default",t.FluentOverlay="fluentOverlay"})(Ou||(Ou={}));(function(t){t.AppearanceBased="appearanceBased",t.Light="light",t.Dark="dark",t.MediumLight="mediumLight",t.UltraDark="ultraDark",t.Titlebar="titlebar",t.Selection="selection",t.Menu="menu",t.Popover="popover",t.Sidebar="sidebar",t.HeaderView="headerView",t.Sheet="sheet",t.WindowBackground="windowBackground",t.HudWindow="hudWindow",t.FullScreenUI="fullScreenUI",t.Tooltip="tooltip",t.ContentBackground="contentBackground",t.UnderWindowBackground="underWindowBackground",t.UnderPageBackground="underPageBackground",t.Mica="mica",t.Blur="blur",t.Acrylic="acrylic",t.Tabbed="tabbed",t.TabbedDark="tabbedDark",t.TabbedLight="tabbedLight"})(Ys||(Ys={}));(function(t){t.FollowsWindowActiveState="followsWindowActiveState",t.Active="active",t.Inactive="inactive"})(Qs||(Qs={}))});var h={};Pe(h,{BRAND:()=>_p,DIRTY:()=>er,EMPTY_PATH:()=>Kf,INVALID:()=>$,NEVER:()=>ah,OK:()=>se,ParseStatus:()=>ne,Schema:()=>N,ZodAny:()=>jt,ZodArray:()=>bt,ZodBigInt:()=>rr,ZodBoolean:()=>nr,ZodBranded:()=>wn,ZodCatch:()=>hr,ZodDate:()=>ar,ZodDefault:()=>pr,ZodDiscriminatedUnion:()=>Ta,ZodEffects:()=>De,ZodEnum:()=>dr,ZodError:()=>me,ZodFirstPartyTypeKind:()=>P,ZodFunction:()=>Ra,ZodIntersection:()=>cr,ZodIssueCode:()=>_,ZodLazy:()=>lr,ZodLiteral:()=>ur,ZodMap:()=>Zr,ZodNaN:()=>Qr,ZodNativeEnum:()=>fr,ZodNever:()=>qe,ZodNull:()=>sr,ZodNullable:()=>et,ZodNumber:()=>tr,ZodObject:()=>ge,ZodOptional:()=>Ie,ZodParsedType:()=>T,ZodPipeline:()=>_n,ZodPromise:()=>Ft,ZodReadonly:()=>mr,ZodRecord:()=>Ca,ZodSchema:()=>N,ZodSet:()=>Yr,ZodString:()=>Mt,ZodSymbol:()=>Gr,ZodTransformer:()=>De,ZodTuple:()=>Xe,ZodType:()=>N,ZodUndefined:()=>or,ZodUnion:()=>ir,ZodUnknown:()=>yt,ZodVoid:()=>Jr,addIssueToContext:()=>S,any:()=>Ap,array:()=>Op,bigint:()=>vp,boolean:()=>$c,coerce:()=>nh,custom:()=>Rc,date:()=>Tp,datetimeRegex:()=>Tc,defaultErrorMap:()=>mt,discriminatedUnion:()=>Mp,effect:()=>Zp,enum:()=>Vp,function:()=>Up,getErrorMap:()=>zr,getParsedType:()=>Ke,instanceof:()=>kp,intersection:()=>jp,isAborted:()=>xa,isAsync:()=>Hr,isDirty:()=>va,isValid:()=>Nt,late:()=>Sp,lazy:()=>zp,literal:()=>Hp,makeIssue:()=>bn,map:()=>Bp,nan:()=>xp,nativeEnum:()=>Gp,never:()=>Pp,null:()=>Ep,nullable:()=>Qp,number:()=>Ac,object:()=>Dp,objectUtil:()=>Jo,oboolean:()=>rh,onumber:()=>th,optional:()=>Yp,ostring:()=>eh,pipeline:()=>Xp,preprocess:()=>Kp,promise:()=>Jp,quotelessJson:()=>Zf,record:()=>Wp,set:()=>qp,setErrorMap:()=>Qf,strictObject:()=>Lp,string:()=>Ec,symbol:()=>Cp,transformer:()=>Zp,tuple:()=>Fp,undefined:()=>Rp,union:()=>Np,unknown:()=>$p,util:()=>j,void:()=>Ip});var j;(function(t){t.assertEqual=o=>{};function e(o){}t.assertIs=e;function r(o){throw new Error}t.assertNever=r,t.arrayToEnum=o=>{let i={};for(let c of o)i[c]=c;return i},t.getValidEnumValues=o=>{let i=t.objectKeys(o).filter(u=>typeof o[o[u]]!="number"),c={};for(let u of i)c[u]=o[u];return t.objectValues(c)},t.objectValues=o=>t.objectKeys(o).map(function(i){return o[i]}),t.objectKeys=typeof Object.keys=="function"?o=>Object.keys(o):o=>{let i=[];for(let c in o)Object.prototype.hasOwnProperty.call(o,c)&&i.push(c);return i},t.find=(o,i)=>{for(let c of o)if(i(c))return c},t.isInteger=typeof Number.isInteger=="function"?o=>Number.isInteger(o):o=>typeof o=="number"&&Number.isFinite(o)&&Math.floor(o)===o;function a(o,i=" | "){return o.map(c=>typeof c=="string"?`'${c}'`:c).join(i)}t.joinValues=a,t.jsonStringifyReplacer=(o,i)=>typeof i=="bigint"?i.toString():i})(j||(j={}));var Jo;(function(t){t.mergeShapes=(e,r)=>({...e,...r})})(Jo||(Jo={}));var T=j.arrayToEnum(["string","nan","number","integer","float","boolean","date","bigint","symbol","function","undefined","null","array","object","unknown","promise","void","never","map","set"]),Ke=t=>{switch(typeof t){case"undefined":return T.undefined;case"string":return T.string;case"number":return Number.isNaN(t)?T.nan:T.number;case"boolean":return T.boolean;case"function":return T.function;case"bigint":return T.bigint;case"symbol":return T.symbol;case"object":return Array.isArray(t)?T.array:t===null?T.null:t.then&&typeof t.then=="function"&&t.catch&&typeof t.catch=="function"?T.promise:typeof Map<"u"&&t instanceof Map?T.map:typeof Set<"u"&&t instanceof Set?T.set:typeof Date<"u"&&t instanceof Date?T.date:T.object;default:return T.unknown}};var _=j.arrayToEnum(["invalid_type","invalid_literal","custom","invalid_union","invalid_union_discriminator","invalid_enum_value","unrecognized_keys","invalid_arguments","invalid_return_type","invalid_date","invalid_string","too_small","too_big","invalid_intersection_types","not_multiple_of","not_finite"]),Zf=t=>JSON.stringify(t,null,2).replace(/"([^"]+)":/g,"$1:"),me=class t extends Error{get errors(){return this.issues}constructor(e){super(),this.issues=[],this.addIssue=a=>{this.issues=[...this.issues,a]},this.addIssues=(a=[])=>{this.issues=[...this.issues,...a]};let r=new.target.prototype;Object.setPrototypeOf?Object.setPrototypeOf(this,r):this.__proto__=r,this.name="ZodError",this.issues=e}format(e){let r=e||function(i){return i.message},a={_errors:[]},o=i=>{for(let c of i.issues)if(c.code==="invalid_union")c.unionErrors.map(o);else if(c.code==="invalid_return_type")o(c.returnTypeError);else if(c.code==="invalid_arguments")o(c.argumentsError);else if(c.path.length===0)a._errors.push(r(c));else{let u=a,f=0;for(;f<c.path.length;){let d=c.path[f];f===c.path.length-1?(u[d]=u[d]||{_errors:[]},u[d]._errors.push(r(c))):u[d]=u[d]||{_errors:[]},u=u[d],f++}}};return o(this),a}static assert(e){if(!(e instanceof t))throw new Error(`Not a ZodError: ${e}`)}toString(){return this.message}get message(){return JSON.stringify(this.issues,j.jsonStringifyReplacer,2)}get isEmpty(){return this.issues.length===0}flatten(e=r=>r.message){let r={},a=[];for(let o of this.issues)if(o.path.length>0){let i=o.path[0];r[i]=r[i]||[],r[i].push(e(o))}else a.push(e(o));return{formErrors:a,fieldErrors:r}}get formErrors(){return this.flatten()}};me.create=t=>new me(t);var Yf=(t,e)=>{let r;switch(t.code){case _.invalid_type:t.received===T.undefined?r="Required":r=`Expected ${t.expected}, received ${t.received}`;break;case _.invalid_literal:r=`Invalid literal value, expected ${JSON.stringify(t.expected,j.jsonStringifyReplacer)}`;break;case _.unrecognized_keys:r=`Unrecognized key(s) in object: ${j.joinValues(t.keys,", ")}`;break;case _.invalid_union:r="Invalid input";break;case _.invalid_union_discriminator:r=`Invalid discriminator value. Expected ${j.joinValues(t.options)}`;break;case _.invalid_enum_value:r=`Invalid enum value. Expected ${j.joinValues(t.options)}, received '${t.received}'`;break;case _.invalid_arguments:r="Invalid function arguments";break;case _.invalid_return_type:r="Invalid function return type";break;case _.invalid_date:r="Invalid date";break;case _.invalid_string:typeof t.validation=="object"?"includes"in t.validation?(r=`Invalid input: must include "${t.validation.includes}"`,typeof t.validation.position=="number"&&(r=`${r} at one or more positions greater than or equal to ${t.validation.position}`)):"startsWith"in t.validation?r=`Invalid input: must start with "${t.validation.startsWith}"`:"endsWith"in t.validation?r=`Invalid input: must end with "${t.validation.endsWith}"`:j.assertNever(t.validation):t.validation!=="regex"?r=`Invalid ${t.validation}`:r="Invalid";break;case _.too_small:t.type==="array"?r=`Array must contain ${t.exact?"exactly":t.inclusive?"at least":"more than"} ${t.minimum} element(s)`:t.type==="string"?r=`String must contain ${t.exact?"exactly":t.inclusive?"at least":"over"} ${t.minimum} character(s)`:t.type==="number"?r=`Number must be ${t.exact?"exactly equal to ":t.inclusive?"greater than or equal to ":"greater than "}${t.minimum}`:t.type==="bigint"?r=`Number must be ${t.exact?"exactly equal to ":t.inclusive?"greater than or equal to ":"greater than "}${t.minimum}`:t.type==="date"?r=`Date must be ${t.exact?"exactly equal to ":t.inclusive?"greater than or equal to ":"greater than "}${new Date(Number(t.minimum))}`:r="Invalid input";break;case _.too_big:t.type==="array"?r=`Array must contain ${t.exact?"exactly":t.inclusive?"at most":"less than"} ${t.maximum} element(s)`:t.type==="string"?r=`String must contain ${t.exact?"exactly":t.inclusive?"at most":"under"} ${t.maximum} character(s)`:t.type==="number"?r=`Number must be ${t.exact?"exactly":t.inclusive?"less than or equal to":"less than"} ${t.maximum}`:t.type==="bigint"?r=`BigInt must be ${t.exact?"exactly":t.inclusive?"less than or equal to":"less than"} ${t.maximum}`:t.type==="date"?r=`Date must be ${t.exact?"exactly":t.inclusive?"smaller than or equal to":"smaller than"} ${new Date(Number(t.maximum))}`:r="Invalid input";break;case _.custom:r="Invalid input";break;case _.invalid_intersection_types:r="Intersection results could not be merged";break;case _.not_multiple_of:r=`Number must be a multiple of ${t.multipleOf}`;break;case _.not_finite:r="Number must be finite";break;default:r=e.defaultError,j.assertNever(t)}return{message:r}},mt=Yf;var _c=mt;function Qf(t){_c=t}function zr(){return _c}var bn=t=>{let{data:e,path:r,errorMaps:a,issueData:o}=t,i=[...r,...o.path||[]],c={...o,path:i};if(o.message!==void 0)return{...o,path:i,message:o.message};let u="",f=a.filter(d=>!!d).slice().reverse();for(let d of f)u=d(c,{data:e,defaultError:u}).message;return{...o,path:i,message:u}},Kf=[];function S(t,e){let r=zr(),a=bn({issueData:e,data:t.data,path:t.path,errorMaps:[t.common.contextualErrorMap,t.schemaErrorMap,r,r===mt?void 0:mt].filter(o=>!!o)});t.common.issues.push(a)}var ne=class t{constructor(){this.value="valid"}dirty(){this.value==="valid"&&(this.value="dirty")}abort(){this.value!=="aborted"&&(this.value="aborted")}static mergeArray(e,r){let a=[];for(let o of r){if(o.status==="aborted")return $;o.status==="dirty"&&e.dirty(),a.push(o.value)}return{status:e.value,value:a}}static async mergeObjectAsync(e,r){let a=[];for(let o of r){let i=await o.key,c=await o.value;a.push({key:i,value:c})}return t.mergeObjectSync(e,a)}static mergeObjectSync(e,r){let a={};for(let o of r){let{key:i,value:c}=o;if(i.status==="aborted"||c.status==="aborted")return $;i.status==="dirty"&&e.dirty(),c.status==="dirty"&&e.dirty(),i.value!=="__proto__"&&(typeof c.value<"u"||o.alwaysSet)&&(a[i.value]=c.value)}return{status:e.value,value:a}}},$=Object.freeze({status:"aborted"}),er=t=>({status:"dirty",value:t}),se=t=>({status:"valid",value:t}),xa=t=>t.status==="aborted",va=t=>t.status==="dirty",Nt=t=>t.status==="valid",Hr=t=>typeof Promise<"u"&&t instanceof Promise;var R;(function(t){t.errToObj=e=>typeof e=="string"?{message:e}:e||{},t.toString=e=>typeof e=="string"?e:e?.message})(R||(R={}));var Oe=class{constructor(e,r,a,o){this._cachedPath=[],this.parent=e,this.data=r,this._path=a,this._key=o}get path(){return this._cachedPath.length||(Array.isArray(this._key)?this._cachedPath.push(...this._path,...this._key):this._cachedPath.push(...this._path,this._key)),this._cachedPath}},Sc=(t,e)=>{if(Nt(e))return{success:!0,data:e.value};if(!t.common.issues.length)throw new Error("Validation failed but no issues detected.");return{success:!1,get error(){if(this._error)return this._error;let r=new me(t.common.issues);return this._error=r,this._error}}};function L(t){if(!t)return{};let{errorMap:e,invalid_type_error:r,required_error:a,description:o}=t;if(e&&(r||a))throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);return e?{errorMap:e,description:o}:{errorMap:(c,u)=>{let{message:f}=t;return c.code==="invalid_enum_value"?{message:f??u.defaultError}:typeof u.data>"u"?{message:f??a??u.defaultError}:c.code!=="invalid_type"?{message:u.defaultError}:{message:f??r??u.defaultError}},description:o}}var N=class{get description(){return this._def.description}_getType(e){return Ke(e.data)}_getOrReturnCtx(e,r){return r||{common:e.parent.common,data:e.data,parsedType:Ke(e.data),schemaErrorMap:this._def.errorMap,path:e.path,parent:e.parent}}_processInputParams(e){return{status:new ne,ctx:{common:e.parent.common,data:e.data,parsedType:Ke(e.data),schemaErrorMap:this._def.errorMap,path:e.path,parent:e.parent}}}_parseSync(e){let r=this._parse(e);if(Hr(r))throw new Error("Synchronous parse encountered promise.");return r}_parseAsync(e){let r=this._parse(e);return Promise.resolve(r)}parse(e,r){let a=this.safeParse(e,r);if(a.success)return a.data;throw a.error}safeParse(e,r){let a={common:{issues:[],async:r?.async??!1,contextualErrorMap:r?.errorMap},path:r?.path||[],schemaErrorMap:this._def.errorMap,parent:null,data:e,parsedType:Ke(e)},o=this._parseSync({data:e,path:a.path,parent:a});return Sc(a,o)}"~validate"(e){let r={common:{issues:[],async:!!this["~standard"].async},path:[],schemaErrorMap:this._def.errorMap,parent:null,data:e,parsedType:Ke(e)};if(!this["~standard"].async)try{let a=this._parseSync({data:e,path:[],parent:r});return Nt(a)?{value:a.value}:{issues:r.common.issues}}catch(a){a?.message?.toLowerCase()?.includes("encountered")&&(this["~standard"].async=!0),r.common={issues:[],async:!0}}return this._parseAsync({data:e,path:[],parent:r}).then(a=>Nt(a)?{value:a.value}:{issues:r.common.issues})}async parseAsync(e,r){let a=await this.safeParseAsync(e,r);if(a.success)return a.data;throw a.error}async safeParseAsync(e,r){let a={common:{issues:[],contextualErrorMap:r?.errorMap,async:!0},path:r?.path||[],schemaErrorMap:this._def.errorMap,parent:null,data:e,parsedType:Ke(e)},o=this._parse({data:e,path:a.path,parent:a}),i=await(Hr(o)?o:Promise.resolve(o));return Sc(a,i)}refine(e,r){let a=o=>typeof r=="string"||typeof r>"u"?{message:r}:typeof r=="function"?r(o):r;return this._refinement((o,i)=>{let c=e(o),u=()=>i.addIssue({code:_.custom,...a(o)});return typeof Promise<"u"&&c instanceof Promise?c.then(f=>f?!0:(u(),!1)):c?!0:(u(),!1)})}refinement(e,r){return this._refinement((a,o)=>e(a)?!0:(o.addIssue(typeof r=="function"?r(a,o):r),!1))}_refinement(e){return new De({schema:this,typeName:P.ZodEffects,effect:{type:"refinement",refinement:e}})}superRefine(e){return this._refinement(e)}constructor(e){this.spa=this.safeParseAsync,this._def=e,this.parse=this.parse.bind(this),this.safeParse=this.safeParse.bind(this),this.parseAsync=this.parseAsync.bind(this),this.safeParseAsync=this.safeParseAsync.bind(this),this.spa=this.spa.bind(this),this.refine=this.refine.bind(this),this.refinement=this.refinement.bind(this),this.superRefine=this.superRefine.bind(this),this.optional=this.optional.bind(this),this.nullable=this.nullable.bind(this),this.nullish=this.nullish.bind(this),this.array=this.array.bind(this),this.promise=this.promise.bind(this),this.or=this.or.bind(this),this.and=this.and.bind(this),this.transform=this.transform.bind(this),this.brand=this.brand.bind(this),this.default=this.default.bind(this),this.catch=this.catch.bind(this),this.describe=this.describe.bind(this),this.pipe=this.pipe.bind(this),this.readonly=this.readonly.bind(this),this.isNullable=this.isNullable.bind(this),this.isOptional=this.isOptional.bind(this),this["~standard"]={version:1,vendor:"zod",validate:r=>this["~validate"](r)}}optional(){return Ie.create(this,this._def)}nullable(){return et.create(this,this._def)}nullish(){return this.nullable().optional()}array(){return bt.create(this)}promise(){return Ft.create(this,this._def)}or(e){return ir.create([this,e],this._def)}and(e){return cr.create(this,e,this._def)}transform(e){return new De({...L(this._def),schema:this,typeName:P.ZodEffects,effect:{type:"transform",transform:e}})}default(e){let r=typeof e=="function"?e:()=>e;return new pr({...L(this._def),innerType:this,defaultValue:r,typeName:P.ZodDefault})}brand(){return new wn({typeName:P.ZodBranded,type:this,...L(this._def)})}catch(e){let r=typeof e=="function"?e:()=>e;return new hr({...L(this._def),innerType:this,catchValue:r,typeName:P.ZodCatch})}describe(e){let r=this.constructor;return new r({...this._def,description:e})}pipe(e){return _n.create(this,e)}readonly(){return mr.create(this)}isOptional(){return this.safeParse(void 0).success}isNullable(){return this.safeParse(null).success}},Xf=/^c[^\s-]{8,}$/i,ep=/^[0-9a-z]+$/,tp=/^[0-9A-HJKMNP-TV-Z]{26}$/i,rp=/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i,np=/^[a-z0-9_-]{21}$/i,ap=/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,op=/^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/,sp=/^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i,ip="^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$",Zo,cp=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,lp=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,up=/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,dp=/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,fp=/^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,pp=/^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,xc="((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))",hp=new RegExp(`^${xc}$`);function vc(t){let e="[0-5]\\d";t.precision?e=`${e}\\.\\d{${t.precision}}`:t.precision==null&&(e=`${e}(\\.\\d+)?`);let r=t.precision?"+":"?";return`([01]\\d|2[0-3]):[0-5]\\d(:${e})${r}`}function mp(t){return new RegExp(`^${vc(t)}$`)}function Tc(t){let e=`${xc}T${vc(t)}`,r=[];return r.push(t.local?"Z?":"Z"),t.offset&&r.push("([+-]\\d{2}:?\\d{2})"),e=`${e}(${r.join("|")})`,new RegExp(`^${e}$`)}function gp(t,e){return!!((e==="v4"||!e)&&cp.test(t)||(e==="v6"||!e)&&up.test(t))}function yp(t,e){if(!ap.test(t))return!1;try{let[r]=t.split(".");if(!r)return!1;let a=r.replace(/-/g,"+").replace(/_/g,"/").padEnd(r.length+(4-r.length%4)%4,"="),o=JSON.parse(atob(a));return!(typeof o!="object"||o===null||"typ"in o&&o?.typ!=="JWT"||!o.alg||e&&o.alg!==e)}catch{return!1}}function bp(t,e){return!!((e==="v4"||!e)&&lp.test(t)||(e==="v6"||!e)&&dp.test(t))}var Mt=class t extends N{_parse(e){if(this._def.coerce&&(e.data=String(e.data)),this._getType(e)!==T.string){let i=this._getOrReturnCtx(e);return S(i,{code:_.invalid_type,expected:T.string,received:i.parsedType}),$}let a=new ne,o;for(let i of this._def.checks)if(i.kind==="min")e.data.length<i.value&&(o=this._getOrReturnCtx(e,o),S(o,{code:_.too_small,minimum:i.value,type:"string",inclusive:!0,exact:!1,message:i.message}),a.dirty());else if(i.kind==="max")e.data.length>i.value&&(o=this._getOrReturnCtx(e,o),S(o,{code:_.too_big,maximum:i.value,type:"string",inclusive:!0,exact:!1,message:i.message}),a.dirty());else if(i.kind==="length"){let c=e.data.length>i.value,u=e.data.length<i.value;(c||u)&&(o=this._getOrReturnCtx(e,o),c?S(o,{code:_.too_big,maximum:i.value,type:"string",inclusive:!0,exact:!0,message:i.message}):u&&S(o,{code:_.too_small,minimum:i.value,type:"string",inclusive:!0,exact:!0,message:i.message}),a.dirty())}else if(i.kind==="email")sp.test(e.data)||(o=this._getOrReturnCtx(e,o),S(o,{validation:"email",code:_.invalid_string,message:i.message}),a.dirty());else if(i.kind==="emoji")Zo||(Zo=new RegExp(ip,"u")),Zo.test(e.data)||(o=this._getOrReturnCtx(e,o),S(o,{validation:"emoji",code:_.invalid_string,message:i.message}),a.dirty());else if(i.kind==="uuid")rp.test(e.data)||(o=this._getOrReturnCtx(e,o),S(o,{validation:"uuid",code:_.invalid_string,message:i.message}),a.dirty());else if(i.kind==="nanoid")np.test(e.data)||(o=this._getOrReturnCtx(e,o),S(o,{validation:"nanoid",code:_.invalid_string,message:i.message}),a.dirty());else if(i.kind==="cuid")Xf.test(e.data)||(o=this._getOrReturnCtx(e,o),S(o,{validation:"cuid",code:_.invalid_string,message:i.message}),a.dirty());else if(i.kind==="cuid2")ep.test(e.data)||(o=this._getOrReturnCtx(e,o),S(o,{validation:"cuid2",code:_.invalid_string,message:i.message}),a.dirty());else if(i.kind==="ulid")tp.test(e.data)||(o=this._getOrReturnCtx(e,o),S(o,{validation:"ulid",code:_.invalid_string,message:i.message}),a.dirty());else if(i.kind==="url")try{new URL(e.data)}catch{o=this._getOrReturnCtx(e,o),S(o,{validation:"url",code:_.invalid_string,message:i.message}),a.dirty()}else i.kind==="regex"?(i.regex.lastIndex=0,i.regex.test(e.data)||(o=this._getOrReturnCtx(e,o),S(o,{validation:"regex",code:_.invalid_string,message:i.message}),a.dirty())):i.kind==="trim"?e.data=e.data.trim():i.kind==="includes"?e.data.includes(i.value,i.position)||(o=this._getOrReturnCtx(e,o),S(o,{code:_.invalid_string,validation:{includes:i.value,position:i.position},message:i.message}),a.dirty()):i.kind==="toLowerCase"?e.data=e.data.toLowerCase():i.kind==="toUpperCase"?e.data=e.data.toUpperCase():i.kind==="startsWith"?e.data.startsWith(i.value)||(o=this._getOrReturnCtx(e,o),S(o,{code:_.invalid_string,validation:{startsWith:i.value},message:i.message}),a.dirty()):i.kind==="endsWith"?e.data.endsWith(i.value)||(o=this._getOrReturnCtx(e,o),S(o,{code:_.invalid_string,validation:{endsWith:i.value},message:i.message}),a.dirty()):i.kind==="datetime"?Tc(i).test(e.data)||(o=this._getOrReturnCtx(e,o),S(o,{code:_.invalid_string,validation:"datetime",message:i.message}),a.dirty()):i.kind==="date"?hp.test(e.data)||(o=this._getOrReturnCtx(e,o),S(o,{code:_.invalid_string,validation:"date",message:i.message}),a.dirty()):i.kind==="time"?mp(i).test(e.data)||(o=this._getOrReturnCtx(e,o),S(o,{code:_.invalid_string,validation:"time",message:i.message}),a.dirty()):i.kind==="duration"?op.test(e.data)||(o=this._getOrReturnCtx(e,o),S(o,{validation:"duration",code:_.invalid_string,message:i.message}),a.dirty()):i.kind==="ip"?gp(e.data,i.version)||(o=this._getOrReturnCtx(e,o),S(o,{validation:"ip",code:_.invalid_string,message:i.message}),a.dirty()):i.kind==="jwt"?yp(e.data,i.alg)||(o=this._getOrReturnCtx(e,o),S(o,{validation:"jwt",code:_.invalid_string,message:i.message}),a.dirty()):i.kind==="cidr"?bp(e.data,i.version)||(o=this._getOrReturnCtx(e,o),S(o,{validation:"cidr",code:_.invalid_string,message:i.message}),a.dirty()):i.kind==="base64"?fp.test(e.data)||(o=this._getOrReturnCtx(e,o),S(o,{validation:"base64",code:_.invalid_string,message:i.message}),a.dirty()):i.kind==="base64url"?pp.test(e.data)||(o=this._getOrReturnCtx(e,o),S(o,{validation:"base64url",code:_.invalid_string,message:i.message}),a.dirty()):j.assertNever(i);return{status:a.value,value:e.data}}_regex(e,r,a){return this.refinement(o=>e.test(o),{validation:r,code:_.invalid_string,...R.errToObj(a)})}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}email(e){return this._addCheck({kind:"email",...R.errToObj(e)})}url(e){return this._addCheck({kind:"url",...R.errToObj(e)})}emoji(e){return this._addCheck({kind:"emoji",...R.errToObj(e)})}uuid(e){return this._addCheck({kind:"uuid",...R.errToObj(e)})}nanoid(e){return this._addCheck({kind:"nanoid",...R.errToObj(e)})}cuid(e){return this._addCheck({kind:"cuid",...R.errToObj(e)})}cuid2(e){return this._addCheck({kind:"cuid2",...R.errToObj(e)})}ulid(e){return this._addCheck({kind:"ulid",...R.errToObj(e)})}base64(e){return this._addCheck({kind:"base64",...R.errToObj(e)})}base64url(e){return this._addCheck({kind:"base64url",...R.errToObj(e)})}jwt(e){return this._addCheck({kind:"jwt",...R.errToObj(e)})}ip(e){return this._addCheck({kind:"ip",...R.errToObj(e)})}cidr(e){return this._addCheck({kind:"cidr",...R.errToObj(e)})}datetime(e){return typeof e=="string"?this._addCheck({kind:"datetime",precision:null,offset:!1,local:!1,message:e}):this._addCheck({kind:"datetime",precision:typeof e?.precision>"u"?null:e?.precision,offset:e?.offset??!1,local:e?.local??!1,...R.errToObj(e?.message)})}date(e){return this._addCheck({kind:"date",message:e})}time(e){return typeof e=="string"?this._addCheck({kind:"time",precision:null,message:e}):this._addCheck({kind:"time",precision:typeof e?.precision>"u"?null:e?.precision,...R.errToObj(e?.message)})}duration(e){return this._addCheck({kind:"duration",...R.errToObj(e)})}regex(e,r){return this._addCheck({kind:"regex",regex:e,...R.errToObj(r)})}includes(e,r){return this._addCheck({kind:"includes",value:e,position:r?.position,...R.errToObj(r?.message)})}startsWith(e,r){return this._addCheck({kind:"startsWith",value:e,...R.errToObj(r)})}endsWith(e,r){return this._addCheck({kind:"endsWith",value:e,...R.errToObj(r)})}min(e,r){return this._addCheck({kind:"min",value:e,...R.errToObj(r)})}max(e,r){return this._addCheck({kind:"max",value:e,...R.errToObj(r)})}length(e,r){return this._addCheck({kind:"length",value:e,...R.errToObj(r)})}nonempty(e){return this.min(1,R.errToObj(e))}trim(){return new t({...this._def,checks:[...this._def.checks,{kind:"trim"}]})}toLowerCase(){return new t({...this._def,checks:[...this._def.checks,{kind:"toLowerCase"}]})}toUpperCase(){return new t({...this._def,checks:[...this._def.checks,{kind:"toUpperCase"}]})}get isDatetime(){return!!this._def.checks.find(e=>e.kind==="datetime")}get isDate(){return!!this._def.checks.find(e=>e.kind==="date")}get isTime(){return!!this._def.checks.find(e=>e.kind==="time")}get isDuration(){return!!this._def.checks.find(e=>e.kind==="duration")}get isEmail(){return!!this._def.checks.find(e=>e.kind==="email")}get isURL(){return!!this._def.checks.find(e=>e.kind==="url")}get isEmoji(){return!!this._def.checks.find(e=>e.kind==="emoji")}get isUUID(){return!!this._def.checks.find(e=>e.kind==="uuid")}get isNANOID(){return!!this._def.checks.find(e=>e.kind==="nanoid")}get isCUID(){return!!this._def.checks.find(e=>e.kind==="cuid")}get isCUID2(){return!!this._def.checks.find(e=>e.kind==="cuid2")}get isULID(){return!!this._def.checks.find(e=>e.kind==="ulid")}get isIP(){return!!this._def.checks.find(e=>e.kind==="ip")}get isCIDR(){return!!this._def.checks.find(e=>e.kind==="cidr")}get isBase64(){return!!this._def.checks.find(e=>e.kind==="base64")}get isBase64url(){return!!this._def.checks.find(e=>e.kind==="base64url")}get minLength(){let e=null;for(let r of this._def.checks)r.kind==="min"&&(e===null||r.value>e)&&(e=r.value);return e}get maxLength(){let e=null;for(let r of this._def.checks)r.kind==="max"&&(e===null||r.value<e)&&(e=r.value);return e}};Mt.create=t=>new Mt({checks:[],typeName:P.ZodString,coerce:t?.coerce??!1,...L(t)});function wp(t,e){let r=(t.toString().split(".")[1]||"").length,a=(e.toString().split(".")[1]||"").length,o=r>a?r:a,i=Number.parseInt(t.toFixed(o).replace(".","")),c=Number.parseInt(e.toFixed(o).replace(".",""));return i%c/10**o}var tr=class t extends N{constructor(){super(...arguments),this.min=this.gte,this.max=this.lte,this.step=this.multipleOf}_parse(e){if(this._def.coerce&&(e.data=Number(e.data)),this._getType(e)!==T.number){let i=this._getOrReturnCtx(e);return S(i,{code:_.invalid_type,expected:T.number,received:i.parsedType}),$}let a,o=new ne;for(let i of this._def.checks)i.kind==="int"?j.isInteger(e.data)||(a=this._getOrReturnCtx(e,a),S(a,{code:_.invalid_type,expected:"integer",received:"float",message:i.message}),o.dirty()):i.kind==="min"?(i.inclusive?e.data<i.value:e.data<=i.value)&&(a=this._getOrReturnCtx(e,a),S(a,{code:_.too_small,minimum:i.value,type:"number",inclusive:i.inclusive,exact:!1,message:i.message}),o.dirty()):i.kind==="max"?(i.inclusive?e.data>i.value:e.data>=i.value)&&(a=this._getOrReturnCtx(e,a),S(a,{code:_.too_big,maximum:i.value,type:"number",inclusive:i.inclusive,exact:!1,message:i.message}),o.dirty()):i.kind==="multipleOf"?wp(e.data,i.value)!==0&&(a=this._getOrReturnCtx(e,a),S(a,{code:_.not_multiple_of,multipleOf:i.value,message:i.message}),o.dirty()):i.kind==="finite"?Number.isFinite(e.data)||(a=this._getOrReturnCtx(e,a),S(a,{code:_.not_finite,message:i.message}),o.dirty()):j.assertNever(i);return{status:o.value,value:e.data}}gte(e,r){return this.setLimit("min",e,!0,R.toString(r))}gt(e,r){return this.setLimit("min",e,!1,R.toString(r))}lte(e,r){return this.setLimit("max",e,!0,R.toString(r))}lt(e,r){return this.setLimit("max",e,!1,R.toString(r))}setLimit(e,r,a,o){return new t({...this._def,checks:[...this._def.checks,{kind:e,value:r,inclusive:a,message:R.toString(o)}]})}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}int(e){return this._addCheck({kind:"int",message:R.toString(e)})}positive(e){return this._addCheck({kind:"min",value:0,inclusive:!1,message:R.toString(e)})}negative(e){return this._addCheck({kind:"max",value:0,inclusive:!1,message:R.toString(e)})}nonpositive(e){return this._addCheck({kind:"max",value:0,inclusive:!0,message:R.toString(e)})}nonnegative(e){return this._addCheck({kind:"min",value:0,inclusive:!0,message:R.toString(e)})}multipleOf(e,r){return this._addCheck({kind:"multipleOf",value:e,message:R.toString(r)})}finite(e){return this._addCheck({kind:"finite",message:R.toString(e)})}safe(e){return this._addCheck({kind:"min",inclusive:!0,value:Number.MIN_SAFE_INTEGER,message:R.toString(e)})._addCheck({kind:"max",inclusive:!0,value:Number.MAX_SAFE_INTEGER,message:R.toString(e)})}get minValue(){let e=null;for(let r of this._def.checks)r.kind==="min"&&(e===null||r.value>e)&&(e=r.value);return e}get maxValue(){let e=null;for(let r of this._def.checks)r.kind==="max"&&(e===null||r.value<e)&&(e=r.value);return e}get isInt(){return!!this._def.checks.find(e=>e.kind==="int"||e.kind==="multipleOf"&&j.isInteger(e.value))}get isFinite(){let e=null,r=null;for(let a of this._def.checks){if(a.kind==="finite"||a.kind==="int"||a.kind==="multipleOf")return!0;a.kind==="min"?(r===null||a.value>r)&&(r=a.value):a.kind==="max"&&(e===null||a.value<e)&&(e=a.value)}return Number.isFinite(r)&&Number.isFinite(e)}};tr.create=t=>new tr({checks:[],typeName:P.ZodNumber,coerce:t?.coerce||!1,...L(t)});var rr=class t extends N{constructor(){super(...arguments),this.min=this.gte,this.max=this.lte}_parse(e){if(this._def.coerce)try{e.data=BigInt(e.data)}catch{return this._getInvalidInput(e)}if(this._getType(e)!==T.bigint)return this._getInvalidInput(e);let a,o=new ne;for(let i of this._def.checks)i.kind==="min"?(i.inclusive?e.data<i.value:e.data<=i.value)&&(a=this._getOrReturnCtx(e,a),S(a,{code:_.too_small,type:"bigint",minimum:i.value,inclusive:i.inclusive,message:i.message}),o.dirty()):i.kind==="max"?(i.inclusive?e.data>i.value:e.data>=i.value)&&(a=this._getOrReturnCtx(e,a),S(a,{code:_.too_big,type:"bigint",maximum:i.value,inclusive:i.inclusive,message:i.message}),o.dirty()):i.kind==="multipleOf"?e.data%i.value!==BigInt(0)&&(a=this._getOrReturnCtx(e,a),S(a,{code:_.not_multiple_of,multipleOf:i.value,message:i.message}),o.dirty()):j.assertNever(i);return{status:o.value,value:e.data}}_getInvalidInput(e){let r=this._getOrReturnCtx(e);return S(r,{code:_.invalid_type,expected:T.bigint,received:r.parsedType}),$}gte(e,r){return this.setLimit("min",e,!0,R.toString(r))}gt(e,r){return this.setLimit("min",e,!1,R.toString(r))}lte(e,r){return this.setLimit("max",e,!0,R.toString(r))}lt(e,r){return this.setLimit("max",e,!1,R.toString(r))}setLimit(e,r,a,o){return new t({...this._def,checks:[...this._def.checks,{kind:e,value:r,inclusive:a,message:R.toString(o)}]})}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}positive(e){return this._addCheck({kind:"min",value:BigInt(0),inclusive:!1,message:R.toString(e)})}negative(e){return this._addCheck({kind:"max",value:BigInt(0),inclusive:!1,message:R.toString(e)})}nonpositive(e){return this._addCheck({kind:"max",value:BigInt(0),inclusive:!0,message:R.toString(e)})}nonnegative(e){return this._addCheck({kind:"min",value:BigInt(0),inclusive:!0,message:R.toString(e)})}multipleOf(e,r){return this._addCheck({kind:"multipleOf",value:e,message:R.toString(r)})}get minValue(){let e=null;for(let r of this._def.checks)r.kind==="min"&&(e===null||r.value>e)&&(e=r.value);return e}get maxValue(){let e=null;for(let r of this._def.checks)r.kind==="max"&&(e===null||r.value<e)&&(e=r.value);return e}};rr.create=t=>new rr({checks:[],typeName:P.ZodBigInt,coerce:t?.coerce??!1,...L(t)});var nr=class extends N{_parse(e){if(this._def.coerce&&(e.data=!!e.data),this._getType(e)!==T.boolean){let a=this._getOrReturnCtx(e);return S(a,{code:_.invalid_type,expected:T.boolean,received:a.parsedType}),$}return se(e.data)}};nr.create=t=>new nr({typeName:P.ZodBoolean,coerce:t?.coerce||!1,...L(t)});var ar=class t extends N{_parse(e){if(this._def.coerce&&(e.data=new Date(e.data)),this._getType(e)!==T.date){let i=this._getOrReturnCtx(e);return S(i,{code:_.invalid_type,expected:T.date,received:i.parsedType}),$}if(Number.isNaN(e.data.getTime())){let i=this._getOrReturnCtx(e);return S(i,{code:_.invalid_date}),$}let a=new ne,o;for(let i of this._def.checks)i.kind==="min"?e.data.getTime()<i.value&&(o=this._getOrReturnCtx(e,o),S(o,{code:_.too_small,message:i.message,inclusive:!0,exact:!1,minimum:i.value,type:"date"}),a.dirty()):i.kind==="max"?e.data.getTime()>i.value&&(o=this._getOrReturnCtx(e,o),S(o,{code:_.too_big,message:i.message,inclusive:!0,exact:!1,maximum:i.value,type:"date"}),a.dirty()):j.assertNever(i);return{status:a.value,value:new Date(e.data.getTime())}}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}min(e,r){return this._addCheck({kind:"min",value:e.getTime(),message:R.toString(r)})}max(e,r){return this._addCheck({kind:"max",value:e.getTime(),message:R.toString(r)})}get minDate(){let e=null;for(let r of this._def.checks)r.kind==="min"&&(e===null||r.value>e)&&(e=r.value);return e!=null?new Date(e):null}get maxDate(){let e=null;for(let r of this._def.checks)r.kind==="max"&&(e===null||r.value<e)&&(e=r.value);return e!=null?new Date(e):null}};ar.create=t=>new ar({checks:[],coerce:t?.coerce||!1,typeName:P.ZodDate,...L(t)});var Gr=class extends N{_parse(e){if(this._getType(e)!==T.symbol){let a=this._getOrReturnCtx(e);return S(a,{code:_.invalid_type,expected:T.symbol,received:a.parsedType}),$}return se(e.data)}};Gr.create=t=>new Gr({typeName:P.ZodSymbol,...L(t)});var or=class extends N{_parse(e){if(this._getType(e)!==T.undefined){let a=this._getOrReturnCtx(e);return S(a,{code:_.invalid_type,expected:T.undefined,received:a.parsedType}),$}return se(e.data)}};or.create=t=>new or({typeName:P.ZodUndefined,...L(t)});var sr=class extends N{_parse(e){if(this._getType(e)!==T.null){let a=this._getOrReturnCtx(e);return S(a,{code:_.invalid_type,expected:T.null,received:a.parsedType}),$}return se(e.data)}};sr.create=t=>new sr({typeName:P.ZodNull,...L(t)});var jt=class extends N{constructor(){super(...arguments),this._any=!0}_parse(e){return se(e.data)}};jt.create=t=>new jt({typeName:P.ZodAny,...L(t)});var yt=class extends N{constructor(){super(...arguments),this._unknown=!0}_parse(e){return se(e.data)}};yt.create=t=>new yt({typeName:P.ZodUnknown,...L(t)});var qe=class extends N{_parse(e){let r=this._getOrReturnCtx(e);return S(r,{code:_.invalid_type,expected:T.never,received:r.parsedType}),$}};qe.create=t=>new qe({typeName:P.ZodNever,...L(t)});var Jr=class extends N{_parse(e){if(this._getType(e)!==T.undefined){let a=this._getOrReturnCtx(e);return S(a,{code:_.invalid_type,expected:T.void,received:a.parsedType}),$}return se(e.data)}};Jr.create=t=>new Jr({typeName:P.ZodVoid,...L(t)});var bt=class t extends N{_parse(e){let{ctx:r,status:a}=this._processInputParams(e),o=this._def;if(r.parsedType!==T.array)return S(r,{code:_.invalid_type,expected:T.array,received:r.parsedType}),$;if(o.exactLength!==null){let c=r.data.length>o.exactLength.value,u=r.data.length<o.exactLength.value;(c||u)&&(S(r,{code:c?_.too_big:_.too_small,minimum:u?o.exactLength.value:void 0,maximum:c?o.exactLength.value:void 0,type:"array",inclusive:!0,exact:!0,message:o.exactLength.message}),a.dirty())}if(o.minLength!==null&&r.data.length<o.minLength.value&&(S(r,{code:_.too_small,minimum:o.minLength.value,type:"array",inclusive:!0,exact:!1,message:o.minLength.message}),a.dirty()),o.maxLength!==null&&r.data.length>o.maxLength.value&&(S(r,{code:_.too_big,maximum:o.maxLength.value,type:"array",inclusive:!0,exact:!1,message:o.maxLength.message}),a.dirty()),r.common.async)return Promise.all([...r.data].map((c,u)=>o.type._parseAsync(new Oe(r,c,r.path,u)))).then(c=>ne.mergeArray(a,c));let i=[...r.data].map((c,u)=>o.type._parseSync(new Oe(r,c,r.path,u)));return ne.mergeArray(a,i)}get element(){return this._def.type}min(e,r){return new t({...this._def,minLength:{value:e,message:R.toString(r)}})}max(e,r){return new t({...this._def,maxLength:{value:e,message:R.toString(r)}})}length(e,r){return new t({...this._def,exactLength:{value:e,message:R.toString(r)}})}nonempty(e){return this.min(1,e)}};bt.create=(t,e)=>new bt({type:t,minLength:null,maxLength:null,exactLength:null,typeName:P.ZodArray,...L(e)});function Vr(t){if(t instanceof ge){let e={};for(let r in t.shape){let a=t.shape[r];e[r]=Ie.create(Vr(a))}return new ge({...t._def,shape:()=>e})}else return t instanceof bt?new bt({...t._def,type:Vr(t.element)}):t instanceof Ie?Ie.create(Vr(t.unwrap())):t instanceof et?et.create(Vr(t.unwrap())):t instanceof Xe?Xe.create(t.items.map(e=>Vr(e))):t}var ge=class t extends N{constructor(){super(...arguments),this._cached=null,this.nonstrict=this.passthrough,this.augment=this.extend}_getCached(){if(this._cached!==null)return this._cached;let e=this._def.shape(),r=j.objectKeys(e);return this._cached={shape:e,keys:r},this._cached}_parse(e){if(this._getType(e)!==T.object){let d=this._getOrReturnCtx(e);return S(d,{code:_.invalid_type,expected:T.object,received:d.parsedType}),$}let{status:a,ctx:o}=this._processInputParams(e),{shape:i,keys:c}=this._getCached(),u=[];if(!(this._def.catchall instanceof qe&&this._def.unknownKeys==="strip"))for(let d in o.data)c.includes(d)||u.push(d);let f=[];for(let d of c){let g=i[d],k=o.data[d];f.push({key:{status:"valid",value:d},value:g._parse(new Oe(o,k,o.path,d)),alwaysSet:d in o.data})}if(this._def.catchall instanceof qe){let d=this._def.unknownKeys;if(d==="passthrough")for(let g of u)f.push({key:{status:"valid",value:g},value:{status:"valid",value:o.data[g]}});else if(d==="strict")u.length>0&&(S(o,{code:_.unrecognized_keys,keys:u}),a.dirty());else if(d!=="strip")throw new Error("Internal ZodObject error: invalid unknownKeys value.")}else{let d=this._def.catchall;for(let g of u){let k=o.data[g];f.push({key:{status:"valid",value:g},value:d._parse(new Oe(o,k,o.path,g)),alwaysSet:g in o.data})}}return o.common.async?Promise.resolve().then(async()=>{let d=[];for(let g of f){let k=await g.key,C=await g.value;d.push({key:k,value:C,alwaysSet:g.alwaysSet})}return d}).then(d=>ne.mergeObjectSync(a,d)):ne.mergeObjectSync(a,f)}get shape(){return this._def.shape()}strict(e){return R.errToObj,new t({...this._def,unknownKeys:"strict",...e!==void 0?{errorMap:(r,a)=>{let o=this._def.errorMap?.(r,a).message??a.defaultError;return r.code==="unrecognized_keys"?{message:R.errToObj(e).message??o}:{message:o}}}:{}})}strip(){return new t({...this._def,unknownKeys:"strip"})}passthrough(){return new t({...this._def,unknownKeys:"passthrough"})}extend(e){return new t({...this._def,shape:()=>({...this._def.shape(),...e})})}merge(e){return new t({unknownKeys:e._def.unknownKeys,catchall:e._def.catchall,shape:()=>({...this._def.shape(),...e._def.shape()}),typeName:P.ZodObject})}setKey(e,r){return this.augment({[e]:r})}catchall(e){return new t({...this._def,catchall:e})}pick(e){let r={};for(let a of j.objectKeys(e))e[a]&&this.shape[a]&&(r[a]=this.shape[a]);return new t({...this._def,shape:()=>r})}omit(e){let r={};for(let a of j.objectKeys(this.shape))e[a]||(r[a]=this.shape[a]);return new t({...this._def,shape:()=>r})}deepPartial(){return Vr(this)}partial(e){let r={};for(let a of j.objectKeys(this.shape)){let o=this.shape[a];e&&!e[a]?r[a]=o:r[a]=o.optional()}return new t({...this._def,shape:()=>r})}required(e){let r={};for(let a of j.objectKeys(this.shape))if(e&&!e[a])r[a]=this.shape[a];else{let i=this.shape[a];for(;i instanceof Ie;)i=i._def.innerType;r[a]=i}return new t({...this._def,shape:()=>r})}keyof(){return Cc(j.objectKeys(this.shape))}};ge.create=(t,e)=>new ge({shape:()=>t,unknownKeys:"strip",catchall:qe.create(),typeName:P.ZodObject,...L(e)});ge.strictCreate=(t,e)=>new ge({shape:()=>t,unknownKeys:"strict",catchall:qe.create(),typeName:P.ZodObject,...L(e)});ge.lazycreate=(t,e)=>new ge({shape:t,unknownKeys:"strip",catchall:qe.create(),typeName:P.ZodObject,...L(e)});var ir=class extends N{_parse(e){let{ctx:r}=this._processInputParams(e),a=this._def.options;function o(i){for(let u of i)if(u.result.status==="valid")return u.result;for(let u of i)if(u.result.status==="dirty")return r.common.issues.push(...u.ctx.common.issues),u.result;let c=i.map(u=>new me(u.ctx.common.issues));return S(r,{code:_.invalid_union,unionErrors:c}),$}if(r.common.async)return Promise.all(a.map(async i=>{let c={...r,common:{...r.common,issues:[]},parent:null};return{result:await i._parseAsync({data:r.data,path:r.path,parent:c}),ctx:c}})).then(o);{let i,c=[];for(let f of a){let d={...r,common:{...r.common,issues:[]},parent:null},g=f._parseSync({data:r.data,path:r.path,parent:d});if(g.status==="valid")return g;g.status==="dirty"&&!i&&(i={result:g,ctx:d}),d.common.issues.length&&c.push(d.common.issues)}if(i)return r.common.issues.push(...i.ctx.common.issues),i.result;let u=c.map(f=>new me(f));return S(r,{code:_.invalid_union,unionErrors:u}),$}}get options(){return this._def.options}};ir.create=(t,e)=>new ir({options:t,typeName:P.ZodUnion,...L(e)});var gt=t=>t instanceof lr?gt(t.schema):t instanceof De?gt(t.innerType()):t instanceof ur?[t.value]:t instanceof dr?t.options:t instanceof fr?j.objectValues(t.enum):t instanceof pr?gt(t._def.innerType):t instanceof or?[void 0]:t instanceof sr?[null]:t instanceof Ie?[void 0,...gt(t.unwrap())]:t instanceof et?[null,...gt(t.unwrap())]:t instanceof wn||t instanceof mr?gt(t.unwrap()):t instanceof hr?gt(t._def.innerType):[],Ta=class t extends N{_parse(e){let{ctx:r}=this._processInputParams(e);if(r.parsedType!==T.object)return S(r,{code:_.invalid_type,expected:T.object,received:r.parsedType}),$;let a=this.discriminator,o=r.data[a],i=this.optionsMap.get(o);return i?r.common.async?i._parseAsync({data:r.data,path:r.path,parent:r}):i._parseSync({data:r.data,path:r.path,parent:r}):(S(r,{code:_.invalid_union_discriminator,options:Array.from(this.optionsMap.keys()),path:[a]}),$)}get discriminator(){return this._def.discriminator}get options(){return this._def.options}get optionsMap(){return this._def.optionsMap}static create(e,r,a){let o=new Map;for(let i of r){let c=gt(i.shape[e]);if(!c.length)throw new Error(`A discriminator value for key \`${e}\` could not be extracted from all schema options`);for(let u of c){if(o.has(u))throw new Error(`Discriminator property ${String(e)} has duplicate value ${String(u)}`);o.set(u,i)}}return new t({typeName:P.ZodDiscriminatedUnion,discriminator:e,options:r,optionsMap:o,...L(a)})}};function Yo(t,e){let r=Ke(t),a=Ke(e);if(t===e)return{valid:!0,data:t};if(r===T.object&&a===T.object){let o=j.objectKeys(e),i=j.objectKeys(t).filter(u=>o.indexOf(u)!==-1),c={...t,...e};for(let u of i){let f=Yo(t[u],e[u]);if(!f.valid)return{valid:!1};c[u]=f.data}return{valid:!0,data:c}}else if(r===T.array&&a===T.array){if(t.length!==e.length)return{valid:!1};let o=[];for(let i=0;i<t.length;i++){let c=t[i],u=e[i],f=Yo(c,u);if(!f.valid)return{valid:!1};o.push(f.data)}return{valid:!0,data:o}}else return r===T.date&&a===T.date&&+t==+e?{valid:!0,data:t}:{valid:!1}}var cr=class extends N{_parse(e){let{status:r,ctx:a}=this._processInputParams(e),o=(i,c)=>{if(xa(i)||xa(c))return $;let u=Yo(i.value,c.value);return u.valid?((va(i)||va(c))&&r.dirty(),{status:r.value,value:u.data}):(S(a,{code:_.invalid_intersection_types}),$)};return a.common.async?Promise.all([this._def.left._parseAsync({data:a.data,path:a.path,parent:a}),this._def.right._parseAsync({data:a.data,path:a.path,parent:a})]).then(([i,c])=>o(i,c)):o(this._def.left._parseSync({data:a.data,path:a.path,parent:a}),this._def.right._parseSync({data:a.data,path:a.path,parent:a}))}};cr.create=(t,e,r)=>new cr({left:t,right:e,typeName:P.ZodIntersection,...L(r)});var Xe=class t extends N{_parse(e){let{status:r,ctx:a}=this._processInputParams(e);if(a.parsedType!==T.array)return S(a,{code:_.invalid_type,expected:T.array,received:a.parsedType}),$;if(a.data.length<this._def.items.length)return S(a,{code:_.too_small,minimum:this._def.items.length,inclusive:!0,exact:!1,type:"array"}),$;!this._def.rest&&a.data.length>this._def.items.length&&(S(a,{code:_.too_big,maximum:this._def.items.length,inclusive:!0,exact:!1,type:"array"}),r.dirty());let i=[...a.data].map((c,u)=>{let f=this._def.items[u]||this._def.rest;return f?f._parse(new Oe(a,c,a.path,u)):null}).filter(c=>!!c);return a.common.async?Promise.all(i).then(c=>ne.mergeArray(r,c)):ne.mergeArray(r,i)}get items(){return this._def.items}rest(e){return new t({...this._def,rest:e})}};Xe.create=(t,e)=>{if(!Array.isArray(t))throw new Error("You must pass an array of schemas to z.tuple([ ... ])");return new Xe({items:t,typeName:P.ZodTuple,rest:null,...L(e)})};var Ca=class t extends N{get keySchema(){return this._def.keyType}get valueSchema(){return this._def.valueType}_parse(e){let{status:r,ctx:a}=this._processInputParams(e);if(a.parsedType!==T.object)return S(a,{code:_.invalid_type,expected:T.object,received:a.parsedType}),$;let o=[],i=this._def.keyType,c=this._def.valueType;for(let u in a.data)o.push({key:i._parse(new Oe(a,u,a.path,u)),value:c._parse(new Oe(a,a.data[u],a.path,u)),alwaysSet:u in a.data});return a.common.async?ne.mergeObjectAsync(r,o):ne.mergeObjectSync(r,o)}get element(){return this._def.valueType}static create(e,r,a){return r instanceof N?new t({keyType:e,valueType:r,typeName:P.ZodRecord,...L(a)}):new t({keyType:Mt.create(),valueType:e,typeName:P.ZodRecord,...L(r)})}},Zr=class extends N{get keySchema(){return this._def.keyType}get valueSchema(){return this._def.valueType}_parse(e){let{status:r,ctx:a}=this._processInputParams(e);if(a.parsedType!==T.map)return S(a,{code:_.invalid_type,expected:T.map,received:a.parsedType}),$;let o=this._def.keyType,i=this._def.valueType,c=[...a.data.entries()].map(([u,f],d)=>({key:o._parse(new Oe(a,u,a.path,[d,"key"])),value:i._parse(new Oe(a,f,a.path,[d,"value"]))}));if(a.common.async){let u=new Map;return Promise.resolve().then(async()=>{for(let f of c){let d=await f.key,g=await f.value;if(d.status==="aborted"||g.status==="aborted")return $;(d.status==="dirty"||g.status==="dirty")&&r.dirty(),u.set(d.value,g.value)}return{status:r.value,value:u}})}else{let u=new Map;for(let f of c){let d=f.key,g=f.value;if(d.status==="aborted"||g.status==="aborted")return $;(d.status==="dirty"||g.status==="dirty")&&r.dirty(),u.set(d.value,g.value)}return{status:r.value,value:u}}}};Zr.create=(t,e,r)=>new Zr({valueType:e,keyType:t,typeName:P.ZodMap,...L(r)});var Yr=class t extends N{_parse(e){let{status:r,ctx:a}=this._processInputParams(e);if(a.parsedType!==T.set)return S(a,{code:_.invalid_type,expected:T.set,received:a.parsedType}),$;let o=this._def;o.minSize!==null&&a.data.size<o.minSize.value&&(S(a,{code:_.too_small,minimum:o.minSize.value,type:"set",inclusive:!0,exact:!1,message:o.minSize.message}),r.dirty()),o.maxSize!==null&&a.data.size>o.maxSize.value&&(S(a,{code:_.too_big,maximum:o.maxSize.value,type:"set",inclusive:!0,exact:!1,message:o.maxSize.message}),r.dirty());let i=this._def.valueType;function c(f){let d=new Set;for(let g of f){if(g.status==="aborted")return $;g.status==="dirty"&&r.dirty(),d.add(g.value)}return{status:r.value,value:d}}let u=[...a.data.values()].map((f,d)=>i._parse(new Oe(a,f,a.path,d)));return a.common.async?Promise.all(u).then(f=>c(f)):c(u)}min(e,r){return new t({...this._def,minSize:{value:e,message:R.toString(r)}})}max(e,r){return new t({...this._def,maxSize:{value:e,message:R.toString(r)}})}size(e,r){return this.min(e,r).max(e,r)}nonempty(e){return this.min(1,e)}};Yr.create=(t,e)=>new Yr({valueType:t,minSize:null,maxSize:null,typeName:P.ZodSet,...L(e)});var Ra=class t extends N{constructor(){super(...arguments),this.validate=this.implement}_parse(e){let{ctx:r}=this._processInputParams(e);if(r.parsedType!==T.function)return S(r,{code:_.invalid_type,expected:T.function,received:r.parsedType}),$;function a(u,f){return bn({data:u,path:r.path,errorMaps:[r.common.contextualErrorMap,r.schemaErrorMap,zr(),mt].filter(d=>!!d),issueData:{code:_.invalid_arguments,argumentsError:f}})}function o(u,f){return bn({data:u,path:r.path,errorMaps:[r.common.contextualErrorMap,r.schemaErrorMap,zr(),mt].filter(d=>!!d),issueData:{code:_.invalid_return_type,returnTypeError:f}})}let i={errorMap:r.common.contextualErrorMap},c=r.data;if(this._def.returns instanceof Ft){let u=this;return se(async function(...f){let d=new me([]),g=await u._def.args.parseAsync(f,i).catch(D=>{throw d.addIssue(a(f,D)),d}),k=await Reflect.apply(c,this,g);return await u._def.returns._def.type.parseAsync(k,i).catch(D=>{throw d.addIssue(o(k,D)),d})})}else{let u=this;return se(function(...f){let d=u._def.args.safeParse(f,i);if(!d.success)throw new me([a(f,d.error)]);let g=Reflect.apply(c,this,d.data),k=u._def.returns.safeParse(g,i);if(!k.success)throw new me([o(g,k.error)]);return k.data})}}parameters(){return this._def.args}returnType(){return this._def.returns}args(...e){return new t({...this._def,args:Xe.create(e).rest(yt.create())})}returns(e){return new t({...this._def,returns:e})}implement(e){return this.parse(e)}strictImplement(e){return this.parse(e)}static create(e,r,a){return new t({args:e||Xe.create([]).rest(yt.create()),returns:r||yt.create(),typeName:P.ZodFunction,...L(a)})}},lr=class extends N{get schema(){return this._def.getter()}_parse(e){let{ctx:r}=this._processInputParams(e);return this._def.getter()._parse({data:r.data,path:r.path,parent:r})}};lr.create=(t,e)=>new lr({getter:t,typeName:P.ZodLazy,...L(e)});var ur=class extends N{_parse(e){if(e.data!==this._def.value){let r=this._getOrReturnCtx(e);return S(r,{received:r.data,code:_.invalid_literal,expected:this._def.value}),$}return{status:"valid",value:e.data}}get value(){return this._def.value}};ur.create=(t,e)=>new ur({value:t,typeName:P.ZodLiteral,...L(e)});function Cc(t,e){return new dr({values:t,typeName:P.ZodEnum,...L(e)})}var dr=class t extends N{_parse(e){if(typeof e.data!="string"){let r=this._getOrReturnCtx(e),a=this._def.values;return S(r,{expected:j.joinValues(a),received:r.parsedType,code:_.invalid_type}),$}if(this._cache||(this._cache=new Set(this._def.values)),!this._cache.has(e.data)){let r=this._getOrReturnCtx(e),a=this._def.values;return S(r,{received:r.data,code:_.invalid_enum_value,options:a}),$}return se(e.data)}get options(){return this._def.values}get enum(){let e={};for(let r of this._def.values)e[r]=r;return e}get Values(){let e={};for(let r of this._def.values)e[r]=r;return e}get Enum(){let e={};for(let r of this._def.values)e[r]=r;return e}extract(e,r=this._def){return t.create(e,{...this._def,...r})}exclude(e,r=this._def){return t.create(this.options.filter(a=>!e.includes(a)),{...this._def,...r})}};dr.create=Cc;var fr=class extends N{_parse(e){let r=j.getValidEnumValues(this._def.values),a=this._getOrReturnCtx(e);if(a.parsedType!==T.string&&a.parsedType!==T.number){let o=j.objectValues(r);return S(a,{expected:j.joinValues(o),received:a.parsedType,code:_.invalid_type}),$}if(this._cache||(this._cache=new Set(j.getValidEnumValues(this._def.values))),!this._cache.has(e.data)){let o=j.objectValues(r);return S(a,{received:a.data,code:_.invalid_enum_value,options:o}),$}return se(e.data)}get enum(){return this._def.values}};fr.create=(t,e)=>new fr({values:t,typeName:P.ZodNativeEnum,...L(e)});var Ft=class extends N{unwrap(){return this._def.type}_parse(e){let{ctx:r}=this._processInputParams(e);if(r.parsedType!==T.promise&&r.common.async===!1)return S(r,{code:_.invalid_type,expected:T.promise,received:r.parsedType}),$;let a=r.parsedType===T.promise?r.data:Promise.resolve(r.data);return se(a.then(o=>this._def.type.parseAsync(o,{path:r.path,errorMap:r.common.contextualErrorMap})))}};Ft.create=(t,e)=>new Ft({type:t,typeName:P.ZodPromise,...L(e)});var De=class extends N{innerType(){return this._def.schema}sourceType(){return this._def.schema._def.typeName===P.ZodEffects?this._def.schema.sourceType():this._def.schema}_parse(e){let{status:r,ctx:a}=this._processInputParams(e),o=this._def.effect||null,i={addIssue:c=>{S(a,c),c.fatal?r.abort():r.dirty()},get path(){return a.path}};if(i.addIssue=i.addIssue.bind(i),o.type==="preprocess"){let c=o.transform(a.data,i);if(a.common.async)return Promise.resolve(c).then(async u=>{if(r.value==="aborted")return $;let f=await this._def.schema._parseAsync({data:u,path:a.path,parent:a});return f.status==="aborted"?$:f.status==="dirty"?er(f.value):r.value==="dirty"?er(f.value):f});{if(r.value==="aborted")return $;let u=this._def.schema._parseSync({data:c,path:a.path,parent:a});return u.status==="aborted"?$:u.status==="dirty"?er(u.value):r.value==="dirty"?er(u.value):u}}if(o.type==="refinement"){let c=u=>{let f=o.refinement(u,i);if(a.common.async)return Promise.resolve(f);if(f instanceof Promise)throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");return u};if(a.common.async===!1){let u=this._def.schema._parseSync({data:a.data,path:a.path,parent:a});return u.status==="aborted"?$:(u.status==="dirty"&&r.dirty(),c(u.value),{status:r.value,value:u.value})}else return this._def.schema._parseAsync({data:a.data,path:a.path,parent:a}).then(u=>u.status==="aborted"?$:(u.status==="dirty"&&r.dirty(),c(u.value).then(()=>({status:r.value,value:u.value}))))}if(o.type==="transform")if(a.common.async===!1){let c=this._def.schema._parseSync({data:a.data,path:a.path,parent:a});if(!Nt(c))return $;let u=o.transform(c.value,i);if(u instanceof Promise)throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");return{status:r.value,value:u}}else return this._def.schema._parseAsync({data:a.data,path:a.path,parent:a}).then(c=>Nt(c)?Promise.resolve(o.transform(c.value,i)).then(u=>({status:r.value,value:u})):$);j.assertNever(o)}};De.create=(t,e,r)=>new De({schema:t,typeName:P.ZodEffects,effect:e,...L(r)});De.createWithPreprocess=(t,e,r)=>new De({schema:e,effect:{type:"preprocess",transform:t},typeName:P.ZodEffects,...L(r)});var Ie=class extends N{_parse(e){return this._getType(e)===T.undefined?se(void 0):this._def.innerType._parse(e)}unwrap(){return this._def.innerType}};Ie.create=(t,e)=>new Ie({innerType:t,typeName:P.ZodOptional,...L(e)});var et=class extends N{_parse(e){return this._getType(e)===T.null?se(null):this._def.innerType._parse(e)}unwrap(){return this._def.innerType}};et.create=(t,e)=>new et({innerType:t,typeName:P.ZodNullable,...L(e)});var pr=class extends N{_parse(e){let{ctx:r}=this._processInputParams(e),a=r.data;return r.parsedType===T.undefined&&(a=this._def.defaultValue()),this._def.innerType._parse({data:a,path:r.path,parent:r})}removeDefault(){return this._def.innerType}};pr.create=(t,e)=>new pr({innerType:t,typeName:P.ZodDefault,defaultValue:typeof e.default=="function"?e.default:()=>e.default,...L(e)});var hr=class extends N{_parse(e){let{ctx:r}=this._processInputParams(e),a={...r,common:{...r.common,issues:[]}},o=this._def.innerType._parse({data:a.data,path:a.path,parent:{...a}});return Hr(o)?o.then(i=>({status:"valid",value:i.status==="valid"?i.value:this._def.catchValue({get error(){return new me(a.common.issues)},input:a.data})})):{status:"valid",value:o.status==="valid"?o.value:this._def.catchValue({get error(){return new me(a.common.issues)},input:a.data})}}removeCatch(){return this._def.innerType}};hr.create=(t,e)=>new hr({innerType:t,typeName:P.ZodCatch,catchValue:typeof e.catch=="function"?e.catch:()=>e.catch,...L(e)});var Qr=class extends N{_parse(e){if(this._getType(e)!==T.nan){let a=this._getOrReturnCtx(e);return S(a,{code:_.invalid_type,expected:T.nan,received:a.parsedType}),$}return{status:"valid",value:e.data}}};Qr.create=t=>new Qr({typeName:P.ZodNaN,...L(t)});var _p=Symbol("zod_brand"),wn=class extends N{_parse(e){let{ctx:r}=this._processInputParams(e),a=r.data;return this._def.type._parse({data:a,path:r.path,parent:r})}unwrap(){return this._def.type}},_n=class t extends N{_parse(e){let{status:r,ctx:a}=this._processInputParams(e);if(a.common.async)return(async()=>{let i=await this._def.in._parseAsync({data:a.data,path:a.path,parent:a});return i.status==="aborted"?$:i.status==="dirty"?(r.dirty(),er(i.value)):this._def.out._parseAsync({data:i.value,path:a.path,parent:a})})();{let o=this._def.in._parseSync({data:a.data,path:a.path,parent:a});return o.status==="aborted"?$:o.status==="dirty"?(r.dirty(),{status:"dirty",value:o.value}):this._def.out._parseSync({data:o.value,path:a.path,parent:a})}}static create(e,r){return new t({in:e,out:r,typeName:P.ZodPipeline})}},mr=class extends N{_parse(e){let r=this._def.innerType._parse(e),a=o=>(Nt(o)&&(o.value=Object.freeze(o.value)),o);return Hr(r)?r.then(o=>a(o)):a(r)}unwrap(){return this._def.innerType}};mr.create=(t,e)=>new mr({innerType:t,typeName:P.ZodReadonly,...L(e)});function kc(t,e){let r=typeof t=="function"?t(e):typeof t=="string"?{message:t}:t;return typeof r=="string"?{message:r}:r}function Rc(t,e={},r){return t?jt.create().superRefine((a,o)=>{let i=t(a);if(i instanceof Promise)return i.then(c=>{if(!c){let u=kc(e,a),f=u.fatal??r??!0;o.addIssue({code:"custom",...u,fatal:f})}});if(!i){let c=kc(e,a),u=c.fatal??r??!0;o.addIssue({code:"custom",...c,fatal:u})}}):jt.create()}var Sp={object:ge.lazycreate},P;(function(t){t.ZodString="ZodString",t.ZodNumber="ZodNumber",t.ZodNaN="ZodNaN",t.ZodBigInt="ZodBigInt",t.ZodBoolean="ZodBoolean",t.ZodDate="ZodDate",t.ZodSymbol="ZodSymbol",t.ZodUndefined="ZodUndefined",t.ZodNull="ZodNull",t.ZodAny="ZodAny",t.ZodUnknown="ZodUnknown",t.ZodNever="ZodNever",t.ZodVoid="ZodVoid",t.ZodArray="ZodArray",t.ZodObject="ZodObject",t.ZodUnion="ZodUnion",t.ZodDiscriminatedUnion="ZodDiscriminatedUnion",t.ZodIntersection="ZodIntersection",t.ZodTuple="ZodTuple",t.ZodRecord="ZodRecord",t.ZodMap="ZodMap",t.ZodSet="ZodSet",t.ZodFunction="ZodFunction",t.ZodLazy="ZodLazy",t.ZodLiteral="ZodLiteral",t.ZodEnum="ZodEnum",t.ZodEffects="ZodEffects",t.ZodNativeEnum="ZodNativeEnum",t.ZodOptional="ZodOptional",t.ZodNullable="ZodNullable",t.ZodDefault="ZodDefault",t.ZodCatch="ZodCatch",t.ZodPromise="ZodPromise",t.ZodBranded="ZodBranded",t.ZodPipeline="ZodPipeline",t.ZodReadonly="ZodReadonly"})(P||(P={}));var kp=(t,e={message:`Input not instance of ${t.name}`})=>Rc(r=>r instanceof t,e),Ec=Mt.create,Ac=tr.create,xp=Qr.create,vp=rr.create,$c=nr.create,Tp=ar.create,Cp=Gr.create,Rp=or.create,Ep=sr.create,Ap=jt.create,$p=yt.create,Pp=qe.create,Ip=Jr.create,Op=bt.create,Dp=ge.create,Lp=ge.strictCreate,Np=ir.create,Mp=Ta.create,jp=cr.create,Fp=Xe.create,Wp=Ca.create,Bp=Zr.create,qp=Yr.create,Up=Ra.create,zp=lr.create,Hp=ur.create,Vp=dr.create,Gp=fr.create,Jp=Ft.create,Zp=De.create,Yp=Ie.create,Qp=et.create,Kp=De.createWithPreprocess,Xp=_n.create,eh=()=>Ec().optional(),th=()=>Ac().optional(),rh=()=>$c().optional(),nh={string:(t=>Mt.create({...t,coerce:!0})),number:(t=>tr.create({...t,coerce:!0})),boolean:(t=>nr.create({...t,coerce:!0})),bigint:(t=>rr.create({...t,coerce:!0})),date:(t=>ar.create({...t,coerce:!0}))};var ah=$;var Ea="2.0",Pc=h.union([h.string(),h.number().int()]),Ic=h.string(),Ue=h.object({_meta:h.optional(h.object({progressToken:h.optional(Pc)}).passthrough())}).passthrough(),Se=h.object({method:h.string(),params:h.optional(Ue)}),Sn=h.object({_meta:h.optional(h.object({}).passthrough())}).passthrough(),tt=h.object({method:h.string(),params:h.optional(Sn)}),ze=h.object({_meta:h.optional(h.object({}).passthrough())}).passthrough(),Aa=h.union([h.string(),h.number().int()]),oh=h.object({jsonrpc:h.literal(Ea),id:Aa}).merge(Se).strict(),sh=h.object({jsonrpc:h.literal(Ea)}).merge(tt).strict(),ih=h.object({jsonrpc:h.literal(Ea),id:Aa,result:ze}).strict(),Qo;(function(t){t[t.ConnectionClosed=-1]="ConnectionClosed",t[t.ParseError=-32700]="ParseError",t[t.InvalidRequest=-32600]="InvalidRequest",t[t.MethodNotFound=-32601]="MethodNotFound",t[t.InvalidParams=-32602]="InvalidParams",t[t.InternalError=-32603]="InternalError"})(Qo||(Qo={}));var ch=h.object({jsonrpc:h.literal(Ea),id:Aa,error:h.object({code:h.number().int(),message:h.string(),data:h.optional(h.unknown())})}).strict(),aw=h.union([oh,sh,ih,ch]),Ko=ze.strict(),Xo=tt.extend({method:h.literal("notifications/cancelled"),params:Sn.extend({requestId:Aa,reason:h.string().optional()})}),Oc=h.object({name:h.string(),version:h.string()}).passthrough(),lh=h.object({experimental:h.optional(h.object({}).passthrough()),sampling:h.optional(h.object({}).passthrough()),roots:h.optional(h.object({listChanged:h.optional(h.boolean())}).passthrough())}).passthrough(),Dc=Se.extend({method:h.literal("initialize"),params:Ue.extend({protocolVersion:h.string(),capabilities:lh,clientInfo:Oc})}),uh=h.object({experimental:h.optional(h.object({}).passthrough()),logging:h.optional(h.object({}).passthrough()),prompts:h.optional(h.object({listChanged:h.optional(h.boolean())}).passthrough()),resources:h.optional(h.object({subscribe:h.optional(h.boolean()),listChanged:h.optional(h.boolean())}).passthrough()),tools:h.optional(h.object({listChanged:h.optional(h.boolean())}).passthrough())}).passthrough(),dh=ze.extend({protocolVersion:h.string(),capabilities:uh,serverInfo:Oc}),Lc=tt.extend({method:h.literal("notifications/initialized")}),es=Se.extend({method:h.literal("ping")}),fh=h.object({progress:h.number(),total:h.optional(h.number())}).passthrough(),ts=tt.extend({method:h.literal("notifications/progress"),params:Sn.merge(fh).extend({progressToken:Pc})}),$a=Se.extend({params:Ue.extend({cursor:h.optional(Ic)}).optional()}),Pa=ze.extend({nextCursor:h.optional(Ic)}),Nc=h.object({uri:h.string(),mimeType:h.optional(h.string())}).passthrough(),Mc=Nc.extend({text:h.string()}),jc=Nc.extend({blob:h.string().base64()}),ph=h.object({uri:h.string(),name:h.string(),description:h.optional(h.string()),mimeType:h.optional(h.string())}).passthrough(),hh=h.object({uriTemplate:h.string(),name:h.string(),description:h.optional(h.string()),mimeType:h.optional(h.string())}).passthrough(),mh=$a.extend({method:h.literal("resources/list")}),gh=Pa.extend({resources:h.array(ph)}),yh=$a.extend({method:h.literal("resources/templates/list")}),bh=Pa.extend({resourceTemplates:h.array(hh)}),wh=Se.extend({method:h.literal("resources/read"),params:Ue.extend({uri:h.string()})}),_h=ze.extend({contents:h.array(h.union([Mc,jc]))}),Sh=tt.extend({method:h.literal("notifications/resources/list_changed")}),kh=Se.extend({method:h.literal("resources/subscribe"),params:Ue.extend({uri:h.string()})}),xh=Se.extend({method:h.literal("resources/unsubscribe"),params:Ue.extend({uri:h.string()})}),vh=tt.extend({method:h.literal("notifications/resources/updated"),params:Sn.extend({uri:h.string()})}),Th=h.object({name:h.string(),description:h.optional(h.string()),required:h.optional(h.boolean())}).passthrough(),Ch=h.object({name:h.string(),description:h.optional(h.string()),arguments:h.optional(h.array(Th))}).passthrough(),Rh=$a.extend({method:h.literal("prompts/list")}),Eh=Pa.extend({prompts:h.array(Ch)}),Ah=Se.extend({method:h.literal("prompts/get"),params:Ue.extend({name:h.string(),arguments:h.optional(h.record(h.string()))})}),Ia=h.object({type:h.literal("text"),text:h.string()}).passthrough(),Oa=h.object({type:h.literal("image"),data:h.string().base64(),mimeType:h.string()}).passthrough(),Fc=h.object({type:h.literal("resource"),resource:h.union([Mc,jc])}).passthrough(),$h=h.object({role:h.enum(["user","assistant"]),content:h.union([Ia,Oa,Fc])}).passthrough(),Ph=ze.extend({description:h.optional(h.string()),messages:h.array($h)}),Ih=tt.extend({method:h.literal("notifications/prompts/list_changed")}),Oh=h.object({name:h.string(),description:h.optional(h.string()),inputSchema:h.object({type:h.literal("object"),properties:h.optional(h.object({}).passthrough())}).passthrough()}).passthrough(),Dh=$a.extend({method:h.literal("tools/list")}),Lh=Pa.extend({tools:h.array(Oh)}),Wc=ze.extend({content:h.array(h.union([Ia,Oa,Fc])),isError:h.boolean().default(!1).optional()}),ow=Wc.or(ze.extend({toolResult:h.unknown()})),Nh=Se.extend({method:h.literal("tools/call"),params:Ue.extend({name:h.string(),arguments:h.optional(h.record(h.unknown()))})}),Mh=tt.extend({method:h.literal("notifications/tools/list_changed")}),Bc=h.enum(["debug","info","notice","warning","error","critical","alert","emergency"]),jh=Se.extend({method:h.literal("logging/setLevel"),params:Ue.extend({level:Bc})}),Fh=tt.extend({method:h.literal("notifications/message"),params:Sn.extend({level:Bc,logger:h.optional(h.string()),data:h.unknown()})}),Wh=h.object({name:h.string().optional()}).passthrough(),Bh=h.object({hints:h.optional(h.array(Wh)),costPriority:h.optional(h.number().min(0).max(1)),speedPriority:h.optional(h.number().min(0).max(1)),intelligencePriority:h.optional(h.number().min(0).max(1))}).passthrough(),qh=h.object({role:h.enum(["user","assistant"]),content:h.union([Ia,Oa])}).passthrough(),Uh=Se.extend({method:h.literal("sampling/createMessage"),params:Ue.extend({messages:h.array(qh),systemPrompt:h.optional(h.string()),includeContext:h.optional(h.enum(["none","thisServer","allServers"])),temperature:h.optional(h.number()),maxTokens:h.number().int(),stopSequences:h.optional(h.array(h.string())),metadata:h.optional(h.object({}).passthrough()),modelPreferences:h.optional(Bh)})}),qc=ze.extend({model:h.string(),stopReason:h.optional(h.enum(["endTurn","stopSequence","maxTokens"]).or(h.string())),role:h.enum(["user","assistant"]),content:h.discriminatedUnion("type",[Ia,Oa])}),zh=h.object({type:h.literal("ref/resource"),uri:h.string()}).passthrough(),Hh=h.object({type:h.literal("ref/prompt"),name:h.string()}).passthrough(),Vh=Se.extend({method:h.literal("completion/complete"),params:Ue.extend({ref:h.union([Hh,zh]),argument:h.object({name:h.string(),value:h.string()}).passthrough()})}),Gh=ze.extend({completion:h.object({values:h.array(h.string()).max(100),total:h.optional(h.number().int()),hasMore:h.optional(h.boolean())}).passthrough()}),Jh=h.object({uri:h.string().startsWith("file://"),name:h.optional(h.string())}).passthrough(),Zh=Se.extend({method:h.literal("roots/list")}),Uc=ze.extend({roots:h.array(Jh)}),Yh=tt.extend({method:h.literal("notifications/roots/list_changed")}),sw=h.union([es,Dc,Vh,jh,Ah,Rh,mh,yh,wh,kh,xh,Nh,Dh]),iw=h.union([Xo,ts,Lc,Yh]),cw=h.union([Ko,qc,Uc]),lw=h.union([es,Uh,Zh]),uw=h.union([Xo,ts,Fh,vh,Sh,Mh,Ih]),dw=h.union([Ko,dh,Gh,Ph,Eh,gh,bh,_h,Wc,Lh]);var Pr=require("fs/promises"),Vn=require("path"),ao=require("os"),Yu=require("fs"),_S=require("url"),Qu=Be(require("http"),1);var X=require("fs/promises"),K=require("path");var en=require("fs/promises"),ys=require("path"),bs=require("os");Va();function bm(t,e){let r=[];for(let a=0;a<=e.length;a++)r[a]=[a];for(let a=0;a<=t.length;a++)r[0][a]=a;for(let a=1;a<=e.length;a++)for(let o=1;o<=t.length;o++)e.charAt(a-1)===t.charAt(o-1)?r[a][o]=r[a-1][o-1]:r[a][o]=Math.min(r[a-1][o-1]+1,r[a][o-1]+1,r[a-1][o]+1);return r[e.length][t.length]}function Ml(t,e){let r=bm(t.toLowerCase(),e.toLowerCase()),a=Math.max(t.length,e.length);return 1-r/a}function gs(t,e,r=.6){if(!t||!e||e.length===0)return null;let a=t.toLowerCase().trim();for(let c of e)if(c.name.toLowerCase()===a)return{workspace:c,confidence:1,matchType:"exact"};for(let c of e){let u=c.name.toLowerCase();if(u.includes(a)||a.includes(u))return{workspace:c,confidence:.9,matchType:"substring"}}let o=null,i=0;for(let c of e){let u=Ml(a,c.name);u>i&&u>=r&&(i=u,o=c)}return o?{workspace:o,confidence:i,matchType:"fuzzy"}:null}function jl(t,e,r=.5,a=3){if(!t||!e||e.length===0)return[];let o=t.toLowerCase().trim(),i=[];for(let c of e){let u=c.name.toLowerCase(),f=0,d="fuzzy";u===o?(f=1,d="exact"):u.includes(o)||o.includes(u)?(f=.9,d="substring"):(f=Ml(o,c.name),d="fuzzy"),f>=r&&i.push({workspace:c,confidence:f,matchType:d})}return i.sort((c,u)=>u.confidence-c.confidence).slice(0,a)}function Fl(t){let e=[],r=[/(?:in|from|to|at|on)\s+(?:my\s+)?([a-zA-Z0-9\s-]+?)(?:\s+workspace|\s+notes?|\s+folder)/gi,/(?:workspace|notes?|folder)\s+(?:named|called)\s+["']?([a-zA-Z0-9\s-]+?)["']?/gi,/["']([a-zA-Z0-9\s-]+?)["']\s+(?:workspace|notes?|folder)/gi];for(let a of r){let o;for(;(o=a.exec(t))!==null;)e.push(o[1].trim())}return[...new Set(e)]}var Wl=(0,ys.join)((0,bs.homedir)(),".lokus","mcp-context.json"),ws=[{name:"list_all_workspaces",description:"List all available Lokus workspaces. Use this when you need to see what workspaces are available or when the user mentions a workspace name.",inputSchema:{type:"object",properties:{}}},{name:"set_workspace_context",description:"Set the active workspace context for all subsequent operations. This ensures all tools operate on the correct workspace. Always use this before performing workspace-specific operations.",inputSchema:{type:"object",properties:{workspacePath:{type:"string",description:"Full path to the workspace to set as active"}},required:["workspacePath"]}},{name:"get_current_context",description:"Get the currently active workspace context. Use this to verify which workspace you're operating on.",inputSchema:{type:"object",properties:{}}},{name:"match_workspace_by_name",description:"Smart workspace detection from natural language. Use this when the user refers to a workspace by name (e.g., 'my knowledge base', 'work notes'). Returns the best matching workspace.",inputSchema:{type:"object",properties:{query:{type:"string",description:"Natural language workspace reference (e.g., 'knowledge base', 'work notes', 'personal workspace')"},autoSet:{type:"boolean",description:"Automatically set the matched workspace as active context (default: true)"}},required:["query"]}},{name:"clear_workspace_context",description:"Clear the active workspace context. Use this when you need to reset or when switching between different tasks.",inputSchema:{type:"object",properties:{}}},{name:"detect_workspace_from_text",description:"Analyze text to automatically detect workspace references and provide suggestions. Useful when the user's message contains workspace-related context.",inputSchema:{type:"object",properties:{text:{type:"string",description:"Text to analyze for workspace references"}},required:["text"]}}];async function Bl(t,e,r){switch(t){case"list_all_workspaces":return await wm(r);case"set_workspace_context":return await _s(e.workspacePath);case"get_current_context":return await _m();case"match_workspace_by_name":return await Sm(e.query,e.autoSet!==!1,r);case"clear_workspace_context":return await km();case"detect_workspace_from_text":return await xm(e.text,r);default:throw new Error(`Unknown workspace context tool: ${t}`)}}async function wm(t){if(!t)return{content:[{type:"text",text:`\u274C API server not available. Cannot list workspaces.

Please ensure Lokus is running.`}]};try{let e=await St(`${t}/api/workspaces/all`);if(!e.ok)throw new Error(`API request failed: ${e.status}`);let r=await e.json();if(!r.success||!r.data)throw new Error(r.error||"Failed to fetch workspaces");let a=r.data;if(a.length===0)return{content:[{type:"text",text:`\u{1F4C2} No workspaces found.

You may need to open a workspace in Lokus first.`}]};let o=await Pn();return{content:[{type:"text",text:`**Available Workspaces:**

${a.map(c=>{let f=o.currentWorkspace===c.path?"\u{1F449} ":"   ",d=c.note_count!==null?` (${c.note_count} notes)`:"";return`${f}\u{1F4C1} **${c.name}**${d}
      Path: ${c.path}`}).join(`

`)}

${o.currentWorkspace?"\u{1F449} = Currently active workspace":"\u{1F4A1} Use `match_workspace_by_name` or `set_workspace_context` to set active workspace"}`}]}}catch(e){return{content:[{type:"text",text:`\u274C Failed to list workspaces: ${e.message}

Please ensure Lokus is running and the API server is accessible.`}]}}}async function _s(t){try{let e=await Pn();return e.currentWorkspace=t,e.lastUpdated=new Date().toISOString(),await ql(e),{content:[{type:"text",text:`\u2705 Workspace context set to:
\u{1F4C1} **${t}**

All subsequent operations will use this workspace.`}]}}catch(e){return{content:[{type:"text",text:`\u274C Failed to set workspace context: ${e.message}`}]}}}async function _m(){try{let t=await Pn();if(!t.currentWorkspace)return{content:[{type:"text",text:"\u26A0\uFE0F No workspace context is currently set.\n\n\u{1F4A1} Use `list_all_workspaces` to see available workspaces, then use `match_workspace_by_name` or `set_workspace_context` to set one."}]};let e=new Date-new Date(t.lastUpdated),r=Math.floor(e/6e4),a=r<1?"just now":`${r} minute${r!==1?"s":""} ago`;return{content:[{type:"text",text:`**Current Workspace Context:**

\u{1F4C1} ${t.currentWorkspace}
\u23F1\uFE0F Last updated: ${a}

\u2705 All operations will use this workspace.`}]}}catch(t){return{content:[{type:"text",text:`\u274C Failed to get context: ${t.message}`}]}}}async function Sm(t,e,r){if(!r)return{content:[{type:"text",text:"\u274C API server not available. Cannot match workspaces."}]};try{let a=await St(`${r}/api/workspaces/all`);if(!a.ok)throw new Error(`API request failed: ${a.status}`);let o=await a.json();if(!o.success||!o.data)throw new Error(o.error||"Failed to fetch workspaces");let i=o.data;if(i.length===0)return{content:[{type:"text",text:"\u{1F4C2} No workspaces available to match against."}]};let c=gs(t,i,.6);if(!c){let g=jl(t,i,.4,3);if(g.length>0){let k=g.map(C=>`  - ${C.workspace.name} (${Math.round(C.confidence*100)}% match)`).join(`
`);return{content:[{type:"text",text:`\u274C No strong match found for "${t}".

Did you mean:
${k}

\u{1F4A1} Try being more specific or use \`list_all_workspaces\` to see all available workspaces.`}]}}return{content:[{type:"text",text:`\u274C No workspace matches "${t}".

\u{1F4A1} Use \`list_all_workspaces\` to see all available workspaces.`}]}}let u=Math.round(c.confidence*100),d=`${c.matchType==="exact"?"\u{1F3AF}":c.matchType==="substring"?"\u2705":"\u{1F50D}"} **Match Found** (${u}% confidence)

\u{1F4C1} **${c.workspace.name}**
   Path: ${c.workspace.path}
   Match type: ${c.matchType}`;return e?(await _s(c.workspace.path),d+=`

\u2705 Workspace context has been automatically set.
All subsequent operations will use this workspace.`):d+="\n\n\u{1F4A1} Use `set_workspace_context` to activate this workspace.",{content:[{type:"text",text:d}]}}catch(a){return{content:[{type:"text",text:`\u274C Failed to match workspace: ${a.message}`}]}}}async function km(){try{let t=await Pn(),e=t.currentWorkspace;return t.currentWorkspace=null,t.lastUpdated=new Date().toISOString(),await ql(t),{content:[{type:"text",text:e?`\u2705 Workspace context cleared.
Previously: ${e}`:"\u2705 Workspace context cleared (no context was set)."}]}}catch(t){return{content:[{type:"text",text:`\u274C Failed to clear context: ${t.message}`}]}}}async function xm(t,e){if(!e)return{content:[{type:"text",text:"\u274C API server not available."}]};try{let r=Fl(t);if(r.length===0)return{content:[{type:"text",text:`\u{1F50D} No workspace references detected in the text.

\u{1F4A1} Try phrases like 'in my knowledge base' or 'from work notes'.`}]};let a=await St(`${e}/api/workspaces/all`);if(!a.ok)throw new Error(`API request failed: ${a.status}`);let o=await a.json();if(!o.success||!o.data)throw new Error(o.error||"Failed to fetch workspaces");let i=o.data,c=[];for(let d of r){let g=gs(d,i,.5);g&&c.push({reference:d,match:g})}if(c.length===0)return{content:[{type:"text",text:`\u{1F50D} Found potential workspace references but couldn't match them:
${r.map(d=>`  - "${d}"`).join(`
`)}

\u{1F4A1} Use \`list_all_workspaces\` to see available workspaces.`}]};let u=c.map(d=>`  - "${d.reference}" \u2192 **${d.match.workspace.name}** (${Math.round(d.match.confidence*100)}% confidence)`).join(`
`),f=c.sort((d,g)=>g.match.confidence-d.match.confidence)[0];return await _s(f.match.workspace.path),{content:[{type:"text",text:`\u{1F50D} **Workspace References Detected:**

${u}

\u2705 Automatically set context to: **${f.match.workspace.name}**`}]}}catch(r){return{content:[{type:"text",text:`\u274C Failed to detect workspace: ${r.message}`}]}}}async function Pn(){try{let t=await(0,en.readFile)(Wl,"utf-8");return JSON.parse(t)}catch{return{currentWorkspace:null,lastUpdated:null}}}async function ql(t){let e=(0,ys.join)((0,bs.homedir)(),".lokus");try{await(0,en.mkdir)(e,{recursive:!0})}catch{}await(0,en.writeFile)(Wl,JSON.stringify(t,null,2),"utf-8")}async function Ul(){return(await Pn()).currentWorkspace}function zl(t){return t?`\u{1F3AF} **Operating on:** ${t.split("/").pop()} (${t})`:"\u26A0\uFE0F **No workspace context set** - Using default or last workspace"}var Ss=[{name:"list_notes",description:"List all notes in the workspace with metadata",inputSchema:{type:"object",properties:{folder:{type:"string",description:"Folder to list notes from (optional)"},sortBy:{type:"string",enum:["name","modified","created","size"],description:"Sort notes by"},includeContent:{type:"boolean",description:"Include first 200 chars of content"}}}},{name:"read_note",description:"Read the full content of a note",inputSchema:{type:"object",properties:{path:{type:"string",description:"Path to the note file"}},required:["path"]}},{name:"create_note",description:"Create a new note with optional frontmatter",inputSchema:{type:"object",properties:{path:{type:"string",description:"Path for the new note"},content:{type:"string",description:"Note content"},frontmatter:{type:"object",description:"Optional frontmatter metadata"}},required:["path","content"]}},{name:"update_note",description:"Update an existing note's content",inputSchema:{type:"object",properties:{path:{type:"string",description:"Path to the note"},content:{type:"string",description:"New content"},preserveFrontmatter:{type:"boolean",description:"Preserve existing frontmatter"}},required:["path","content"]}},{name:"delete_note",description:"Delete a note",inputSchema:{type:"object",properties:{path:{type:"string",description:"Path to the note to delete"}},required:["path"]}},{name:"search_notes",description:"Search notes by content or metadata",inputSchema:{type:"object",properties:{query:{type:"string",description:"Search query"},searchIn:{type:"string",enum:["content","title","tags","all"],description:"Where to search"},regex:{type:"boolean",description:"Use regex search"}},required:["query"]}},{name:"get_note_links",description:"Get all wiki links in a note",inputSchema:{type:"object",properties:{path:{type:"string",description:"Path to the note"}},required:["path"]}},{name:"get_note_backlinks",description:"Find all notes that link to a specific note",inputSchema:{type:"object",properties:{noteName:{type:"string",description:"Name of the note to find backlinks for"}},required:["noteName"]}},{name:"extract_note_metadata",description:"Extract frontmatter and metadata from a note",inputSchema:{type:"object",properties:{path:{type:"string",description:"Path to the note"}},required:["path"]}},{name:"rename_note",description:"Rename a note and update all references",inputSchema:{type:"object",properties:{oldPath:{type:"string",description:"Current path of the note"},newPath:{type:"string",description:"New path for the note"},updateLinks:{type:"boolean",description:"Update wiki links in other notes"}},required:["oldPath","newPath"]}}];async function Hl(t,e,r,a){let i=await Ul()||r;switch(t){case"list_notes":return await vm(i,e);case"read_note":return await Tm(i,e.path);case"create_note":return await Cm(i,e);case"update_note":return await Rm(i,e);case"delete_note":return await Em(i,e.path);case"search_notes":return await Am(i,e);case"get_note_links":return await $m(i,e.path);case"get_note_backlinks":return await Pm(i,e.noteName);case"extract_note_metadata":return await Im(i,e.path);case"rename_note":return await Om(i,e);default:throw new Error(`Unknown notes tool: ${t}`)}}async function vm(t,e={}){let r=await In(t);if(e.sortBy&&r.sort((a,o)=>{switch(e.sortBy){case"modified":return o.modified-a.modified;case"created":return o.created-a.created;case"size":return o.size-a.size;default:return a.name.localeCompare(o.name)}}),e.includeContent)for(let a of r)try{let o=await(0,X.readFile)(a.path,"utf-8");a.preview=o.substring(0,200).replace(/\n/g," ")}catch{a.preview=null}return{content:[{type:"text",text:`${zl(t)}

Found ${r.length} notes

${r.map(a=>`- ${a.name} (${a.relativePath})${a.preview?`
  `+a.preview+"...":""}`).join(`
`)}`}]}}async function In(t,e=t){let r=[],a=await(0,X.readdir)(t,{withFileTypes:!0});for(let o of a){let i=(0,K.join)(t,o.name);if(!o.name.startsWith(".")){if(o.isDirectory()){let c=await In(i,e);r.push(...c)}else if(o.isFile()&&[".md",".txt"].includes((0,K.extname)(o.name))){let c=await(0,X.stat)(i);r.push({path:i,relativePath:i.replace(e+"/",""),name:(0,K.basename)(o.name,(0,K.extname)(o.name)),size:c.size,created:c.birthtime?.getTime(),modified:c.mtime?.getTime()})}}}return r}async function Tm(t,e){let r=e.startsWith("/")?e:(0,K.join)(t,e);return{content:[{type:"text",text:await(0,X.readFile)(r,"utf-8")}]}}async function Cm(t,{path:e,content:r,frontmatter:a}){let o=(0,K.join)(t,e);await(0,X.mkdir)((0,K.dirname)(o),{recursive:!0});let i=r;return a&&(i=`---
${Object.entries(a).map(([u,f])=>`${u}: ${JSON.stringify(f)}`).join(`
`)}
---

${r}`),await(0,X.writeFile)(o,i),{content:[{type:"text",text:`\u2705 Note created: ${e}`}]}}async function Rm(t,{path:e,content:r,preserveFrontmatter:a}){let o=(0,K.join)(t,e);if(a){let c=(await(0,X.readFile)(o,"utf-8")).match(/^---\n([\s\S]*?)\n---\n/);c&&(r=c[0]+r)}return await(0,X.writeFile)(o,r),{content:[{type:"text",text:`\u2705 Note updated: ${e}`}]}}async function Em(t,e){let r=(0,K.join)(t,e),{unlink:a}=await import("fs/promises");return await a(r),{content:[{type:"text",text:`\u2705 Note deleted: ${e}`}]}}async function Am(t,{query:e,searchIn:r="all",regex:a=!1}){let o=await In(t),i=[],c=a?new RegExp(e,"gi"):e.toLowerCase();for(let u of o)try{let f=await(0,X.readFile)(u.path,"utf-8"),d=!1,g="";if((r==="title"||r==="all")&&(a?c.test(u.name):u.name.toLowerCase().includes(e.toLowerCase()))&&(d=!0,g=`Title match: ${u.name}`),!d&&(r==="content"||r==="all")&&(a?c.test(f):f.toLowerCase().includes(e.toLowerCase()))){d=!0;let k=f.toLowerCase().indexOf(e.toLowerCase()),C=Math.max(0,k-50),D=Math.min(f.length,k+e.length+50);g=f.substring(C,D).replace(/\n/g," ")}d&&i.push({note:u.name,path:u.relativePath,context:g})}catch{}return{content:[{type:"text",text:`Found ${i.length} matches for "${e}":

${i.map(u=>`**${u.note}** (${u.path})
  ${u.context}`).join(`

`)}`}]}}async function $m(t,e){let r=(0,K.join)(t,e),i=((await(0,X.readFile)(r,"utf-8")).match(/\[\[([^\]]+)\]\]/g)||[]).map(c=>c.slice(2,-2));return{content:[{type:"text",text:`Found ${i.length} wiki links in the note:
${i.map(c=>`- [[${c}]]`).join(`
`)}`}]}}async function Pm(t,e){let r=await In(t),a=[];for(let o of r)try{(await(0,X.readFile)(o.path,"utf-8")).includes(`[[${e}]]`)&&a.push({note:o.name,path:o.relativePath})}catch{}return{content:[{type:"text",text:`Found ${a.length} backlinks to "${e}":
${a.map(o=>`- ${o.note} (${o.path})`).join(`
`)}`}]}}async function Im(t,e){let r=(0,K.join)(t,e),a=await(0,X.readFile)(r,"utf-8"),o=a.match(/^---\n([\s\S]*?)\n---/),i={};if(o){let g=o[1].split(`
`);for(let k of g){let[C,...D]=k.split(":");C&&D.length&&(i[C.trim()]=D.join(":").trim())}}let c=await(0,X.stat)(r),u=a.split(/\s+/).length,f=a.split(`
`).length;return{content:[{type:"text",text:JSON.stringify({frontmatter:i,stats:{wordCount:u,lineCount:f,size:c.size,created:c.birthtime,modified:c.mtime}},null,2)}]}}async function Om(t,{oldPath:e,newPath:r,updateLinks:a=!0}){let o=(0,K.join)(t,e),i=(0,K.join)(t,r);await(0,X.mkdir)((0,K.dirname)(i),{recursive:!0});let{rename:c}=await import("fs/promises");if(await c(o,i),a){let u=(0,K.basename)(e,(0,K.extname)(e)),f=(0,K.basename)(r,(0,K.extname)(r)),d=await In(t),g=0;for(let k of d)try{let C=await(0,X.readFile)(k.path,"utf-8");if(C.includes(`[[${u}]]`)){let D=C.replace(new RegExp(`\\[\\[${u}\\]\\]`,"g"),`[[${f}]]`);await(0,X.writeFile)(k.path,D),g++}}catch{}return{content:[{type:"text",text:`\u2705 Note renamed from ${e} to ${r}
${a?`Updated ${g} references`:""}`}]}}return{content:[{type:"text",text:`\u2705 Note renamed from ${e} to ${r}`}]}}var Ne=require("fs/promises"),_r=require("path");Va();var ks=[{name:"get_workspace_info",description:"Get comprehensive information about the current workspace",inputSchema:{type:"object",properties:{}}},{name:"get_workspace_stats",description:"Get statistics about the workspace (note count, size, etc)",inputSchema:{type:"object",properties:{}}},{name:"list_folders",description:"List all folders in the workspace",inputSchema:{type:"object",properties:{maxDepth:{type:"number",description:"Maximum depth to traverse"}}}},{name:"get_workspace_settings",description:"Get workspace-specific settings",inputSchema:{type:"object",properties:{}}},{name:"search_workspace",description:"Global search across all workspace content",inputSchema:{type:"object",properties:{query:{type:"string",description:"Search query"},fileTypes:{type:"array",items:{type:"string"},description:"File types to search (md, txt, json, etc)"},limit:{type:"number",description:"Maximum results to return"}},required:["query"]}},{name:"get_recent_files",description:"Get recently modified files in the workspace",inputSchema:{type:"object",properties:{count:{type:"number",description:"Number of files to return"},fileTypes:{type:"array",items:{type:"string"},description:"Filter by file types"}}}}];async function Vl(t,e,r,a){switch(t){case"get_workspace_info":return await Dm(r,a);case"get_workspace_stats":return await Gl(r);case"list_folders":return await Lm(r,e.maxDepth||3);case"get_workspace_settings":return await Nm(r);case"search_workspace":return await Mm(r,e);case"get_recent_files":return await jm(r,e);default:throw new Error(`Unknown workspace tool: ${t}`)}}async function Dm(t,e){if(e)try{let i=await St(`${e}/api/workspace`);if(i.ok){let c=await i.json();if(c.success&&c.data)return{content:[{type:"text",text:`**Workspace Information**

\u{1F4C1} Path: ${c.data.workspace}
\u{1F4DD} Name: ${c.data.name}
\u{1F4CA} Total Notes: ${c.data.total_notes}
${c.data.has_bases?"\u2705 Bases enabled":"\u274C Bases not configured"}
${c.data.has_canvas?"\u2705 Canvas enabled":"\u274C Canvas not configured"}
${c.data.has_tasks?"\u2705 Tasks enabled":"\u274C Tasks not configured"}`}]}}}catch{}let r=await Gl(t),a=(0,_r.join)(t,".lokus"),o=await Fm(a);return{content:[{type:"text",text:`**Workspace Information**

\u{1F4C1} Path: ${t}
\u{1F4DD} Notes: ${r.noteCount}
\u{1F4C2} Folders: ${r.folderCount}
\u{1F4BE} Total Size: ${Wm(r.totalSize)}
\u{1F527} Lokus Features: ${o?"Configured":"Not configured"}`}]}}async function Gl(t){let e={noteCount:0,folderCount:0,totalSize:0,fileTypes:{}};async function r(a){let o=await(0,Ne.readdir)(a,{withFileTypes:!0});for(let i of o){if(i.name.startsWith("."))continue;let c=(0,_r.join)(a,i.name);if(i.isDirectory())e.folderCount++,await r(c);else if(i.isFile()){let u=await(0,Ne.stat)(c);e.totalSize+=u.size;let f=i.name.split(".").pop();e.fileTypes[f]=(e.fileTypes[f]||0)+1,["md","txt"].includes(f)&&e.noteCount++}}}return await r(t),e}async function Lm(t,e){let r=[];async function a(i,c=0,u=""){if(c>=e)return;let f=await(0,Ne.readdir)(i,{withFileTypes:!0});for(let d of f)if(!d.name.startsWith(".")&&d.isDirectory()){let g=u?`${u}/${d.name}`:d.name;r.push({name:d.name,path:g,depth:c}),await a((0,_r.join)(i,d.name),c+1,g)}}return await a(t),{content:[{type:"text",text:`**Workspace Folders:**

${r.sort((i,c)=>i.path.localeCompare(c.path)).map(i=>"  ".repeat(i.depth)+"\u{1F4C1} "+i.name).join(`
`)}`}]}}async function Nm(t){let e=(0,_r.join)(t,".lokus","settings.json");try{let r=await(0,Ne.readFile)(e,"utf-8"),a=JSON.parse(r);return{content:[{type:"text",text:`**Workspace Settings:**

${JSON.stringify(a,null,2)}`}]}}catch{return{content:[{type:"text",text:"No workspace settings found. This workspace may not be configured for Lokus."}]}}}async function Mm(t,{query:e,fileTypes:r=["md","txt"],limit:a=20}){let o=[];async function i(c){let u=await(0,Ne.readdir)(c,{withFileTypes:!0});for(let f of u){if(f.name.startsWith("."))continue;let d=(0,_r.join)(c,f.name);if(f.isDirectory())await i(d);else if(f.isFile()){let g=f.name.split(".").pop();if(r.includes(g))try{let k=await(0,Ne.readFile)(d,"utf-8");if(k.toLowerCase().includes(e.toLowerCase())){let C=k.toLowerCase().indexOf(e.toLowerCase()),D=Math.max(0,C-50),x=Math.min(k.length,C+e.length+50),z=k.substring(D,x).replace(/\n/g," ");if(o.push({file:d.replace(t+"/",""),context:z}),o.length>=a)return}}catch{}}}}return await i(t),{content:[{type:"text",text:`Found ${o.length} matches for "${e}":

${o.map(c=>`**${c.file}**
  ...${c.context}...`).join(`

`)}`}]}}async function jm(t,{count:e=10,fileTypes:r=null}){let a=[];async function o(c){let u=await(0,Ne.readdir)(c,{withFileTypes:!0});for(let f of u){if(f.name.startsWith("."))continue;let d=(0,_r.join)(c,f.name);if(f.isDirectory())await o(d);else if(f.isFile()){let g=f.name.split(".").pop();if(!r||r.includes(g)){let k=await(0,Ne.stat)(d);a.push({path:d.replace(t+"/",""),name:f.name,modified:k.mtime,size:k.size})}}}}return await o(t),a.sort((c,u)=>u.modified-c.modified),{content:[{type:"text",text:`**Recently Modified Files:**

${a.slice(0,e).map(c=>`- ${c.name} (${c.path})
  Modified: ${c.modified.toISOString()}`).join(`
`)}`}]}}async function Fm(t){try{return await(0,Ne.stat)(t),!0}catch{return!1}}function Wm(t){return t<1024?`${t} B`:t<1024*1024?`${(t/1024).toFixed(2)} KB`:t<1024*1024*1024?`${(t/(1024*1024)).toFixed(2)} MB`:`${(t/(1024*1024*1024)).toFixed(2)} GB`}var ae=require("fs/promises"),Ge=require("path"),xs=[{name:"list_bases",description:"List all bases (databases) in the workspace",inputSchema:{type:"object",properties:{}}},{name:"get_base",description:"Get details of a specific base including schema and records",inputSchema:{type:"object",properties:{baseName:{type:"string",description:"Name of the base"}},required:["baseName"]}},{name:"create_base",description:"Create a new base with specified schema",inputSchema:{type:"object",properties:{name:{type:"string",description:"Name for the new base"},schema:{type:"object",description:"Schema definition for the base",properties:{fields:{type:"array",description:"Field definitions"}}},description:{type:"string",description:"Description of the base"}},required:["name","schema"]}},{name:"add_base_record",description:"Add a new record to a base",inputSchema:{type:"object",properties:{baseName:{type:"string",description:"Name of the base"},record:{type:"object",description:"Record data"}},required:["baseName","record"]}},{name:"query_base",description:"Query records from a base with filters",inputSchema:{type:"object",properties:{baseName:{type:"string",description:"Name of the base"},filter:{type:"object",description:"Filter criteria"},sort:{type:"object",description:"Sort criteria"},limit:{type:"number",description:"Maximum records to return"}},required:["baseName"]}},{name:"update_base_record",description:"Update a record in a base",inputSchema:{type:"object",properties:{baseName:{type:"string",description:"Name of the base"},recordId:{type:"string",description:"ID of the record to update"},updates:{type:"object",description:"Fields to update"}},required:["baseName","recordId","updates"]}},{name:"delete_base_record",description:"Delete a record from a base",inputSchema:{type:"object",properties:{baseName:{type:"string",description:"Name of the base"},recordId:{type:"string",description:"ID of the record to delete"}},required:["baseName","recordId"]}},{name:"get_base_stats",description:"Get statistics about a base",inputSchema:{type:"object",properties:{baseName:{type:"string",description:"Name of the base"}},required:["baseName"]}}];async function Jl(t,e,r,a){switch(t){case"list_bases":return await Bm(r);case"get_base":return await qm(r,e.baseName);case"create_base":return await Um(r,e);case"add_base_record":return await zm(r,e);case"query_base":return await Hm(r,e);case"update_base_record":return await Vm(r,e);case"delete_base_record":return await Gm(r,e);case"get_base_stats":return await Jm(r,e.baseName);default:throw new Error(`Unknown bases tool: ${t}`)}}async function Bm(t){let e=(0,Ge.join)(t,".lokus","bases");try{let r=await(0,ae.readdir)(e,{withFileTypes:!0}),a=[];for(let o of r)if(o.isFile()&&o.name.endsWith(".json")){let i=o.name.replace(".json","");try{let c=await(0,ae.readFile)((0,Ge.join)(e,o.name),"utf-8"),u=JSON.parse(c);a.push({name:i,recordCount:u.records?u.records.length:0,fields:u.schema?.fields?.length||0,description:u.description})}catch{}}return{content:[{type:"text",text:`**Bases in Workspace:**

${a.length>0?a.map(o=>`\u{1F4CA} **${o.name}**
  - Records: ${o.recordCount}
  - Fields: ${o.fields}
  - ${o.description||"No description"}`).join(`

`):"No bases found in this workspace"}`}]}}catch{return{content:[{type:"text",text:"Bases feature not configured in this workspace"}]}}}async function qm(t,e){let r=(0,Ge.join)(t,".lokus","bases",`${e}.json`);try{let a=await(0,ae.readFile)(r,"utf-8"),o=JSON.parse(a);return{content:[{type:"text",text:`**Base: ${e}**

Description: ${o.description||"No description"}
Created: ${o.created||"Unknown"}
Modified: ${o.modified||"Unknown"}

**Schema:**
${o.schema?.fields?.map(i=>`- ${i.name} (${i.type})`).join(`
`)||"No schema defined"}

**Records (${o.records?.length||0}):**
${o.records?.slice(0,5).map(i=>JSON.stringify(i)).join(`
`)||"No records"}
${o.records?.length>5?`
... and ${o.records.length-5} more records`:""}`}]}}catch{return{content:[{type:"text",text:`Base "${e}" not found`}]}}}async function Um(t,{name:e,schema:r,description:a}){let o=(0,Ge.join)(t,".lokus","bases"),i=(0,Ge.join)(o,`${e}.json`);await(0,ae.mkdir)(o,{recursive:!0});let c={name:e,description:a,schema:r,records:[],created:new Date().toISOString(),modified:new Date().toISOString()};return await(0,ae.writeFile)(i,JSON.stringify(c,null,2)),{content:[{type:"text",text:`\u2705 Base "${e}" created successfully with ${r.fields?.length||0} fields`}]}}async function zm(t,{baseName:e,record:r}){let a=(0,Ge.join)(t,".lokus","bases",`${e}.json`);try{let o=await(0,ae.readFile)(a,"utf-8"),i=JSON.parse(o);return r.id||(r.id=Date.now().toString(36)+Math.random().toString(36).substr(2)),r.created=new Date().toISOString(),r.modified=new Date().toISOString(),i.records=i.records||[],i.records.push(r),i.modified=new Date().toISOString(),await(0,ae.writeFile)(a,JSON.stringify(i,null,2)),{content:[{type:"text",text:`\u2705 Record added to base "${e}" with ID: ${r.id}`}]}}catch(o){return{content:[{type:"text",text:`\u274C Failed to add record: ${o.message}`}]}}}async function Hm(t,{baseName:e,filter:r={},sort:a=null,limit:o=100}){let i=(0,Ge.join)(t,".lokus","bases",`${e}.json`);try{let c=await(0,ae.readFile)(i,"utf-8"),f=JSON.parse(c).records||[];if(Object.keys(r).length>0&&(f=f.filter(d=>{for(let[g,k]of Object.entries(r))if(d[g]!==k)return!1;return!0})),a){let d=Object.keys(a)[0],g=a[d];f.sort((k,C)=>g==="asc"?k[d]>C[d]?1:-1:k[d]<C[d]?1:-1)}return f=f.slice(0,o),{content:[{type:"text",text:`**Query Results (${f.length} records):**

${f.map(d=>JSON.stringify(d,null,2)).join(`
---
`)}`}]}}catch(c){return{content:[{type:"text",text:`\u274C Query failed: ${c.message}`}]}}}async function Vm(t,{baseName:e,recordId:r,updates:a}){let o=(0,Ge.join)(t,".lokus","bases",`${e}.json`);try{let i=await(0,ae.readFile)(o,"utf-8"),c=JSON.parse(i),u=c.records?.findIndex(f=>f.id===r);if(u===-1)throw new Error(`Record with ID ${r} not found`);return c.records[u]={...c.records[u],...a,id:r,modified:new Date().toISOString()},c.modified=new Date().toISOString(),await(0,ae.writeFile)(o,JSON.stringify(c,null,2)),{content:[{type:"text",text:`\u2705 Record ${r} updated in base "${e}"`}]}}catch(i){return{content:[{type:"text",text:`\u274C Update failed: ${i.message}`}]}}}async function Gm(t,{baseName:e,recordId:r}){let a=(0,Ge.join)(t,".lokus","bases",`${e}.json`);try{let o=await(0,ae.readFile)(a,"utf-8"),i=JSON.parse(o),c=i.records?.length||0;if(i.records=i.records?.filter(u=>u.id!==r)||[],i.records.length===c)throw new Error(`Record with ID ${r} not found`);return i.modified=new Date().toISOString(),await(0,ae.writeFile)(a,JSON.stringify(i,null,2)),{content:[{type:"text",text:`\u2705 Record ${r} deleted from base "${e}"`}]}}catch(o){return{content:[{type:"text",text:`\u274C Delete failed: ${o.message}`}]}}}async function Jm(t,e){let r=(0,Ge.join)(t,".lokus","bases",`${e}.json`);try{let a=await(0,ae.readFile)(r,"utf-8"),o=JSON.parse(a),i={recordCount:o.records?.length||0,fieldCount:o.schema?.fields?.length||0,created:o.created,modified:o.modified,sizeBytes:Buffer.byteLength(a,"utf8"),fieldTypes:{}};if(o.schema?.fields)for(let c of o.schema.fields)i.fieldTypes[c.type]=(i.fieldTypes[c.type]||0)+1;if(o.records?.length>0){i.fillRates={};for(let c of o.schema?.fields||[]){let u=o.records.filter(f=>f[c.name]!=null).length;i.fillRates[c.name]=`${(u/o.records.length*100).toFixed(1)}%`}}return{content:[{type:"text",text:`**Base Statistics: ${e}**

\u{1F4CA} Records: ${i.recordCount}
\u{1F4CB} Fields: ${i.fieldCount}
\u{1F4C5} Created: ${i.created}
\u{1F504} Modified: ${i.modified}
\u{1F4BE} Size: ${(i.sizeBytes/1024).toFixed(2)} KB

**Field Types:**
${Object.entries(i.fieldTypes).map(([c,u])=>`- ${c}: ${u}`).join(`
`)}

${i.fillRates?`**Field Fill Rates:**
${Object.entries(i.fillRates).map(([c,u])=>`- ${c}: ${u}`).join(`
`)}`:""}`}]}}catch(a){return{content:[{type:"text",text:`\u274C Failed to get stats: ${a.message}`}]}}}var Te=require("fs/promises"),kt=require("path"),vs=[{name:"list_canvases",description:"List all canvases in the workspace",inputSchema:{type:"object",properties:{}}},{name:"get_canvas",description:"Get canvas data including shapes and connections",inputSchema:{type:"object",properties:{canvasId:{type:"string",description:"Canvas ID or name"}},required:["canvasId"]}},{name:"create_canvas",description:"Create a new canvas",inputSchema:{type:"object",properties:{name:{type:"string",description:"Name for the canvas"},description:{type:"string",description:"Canvas description"}},required:["name"]}},{name:"add_canvas_shape",description:"Add a shape to canvas (text, rectangle, arrow, etc)",inputSchema:{type:"object",properties:{canvasId:{type:"string",description:"Canvas ID"},shape:{type:"object",description:"Shape data (type, position, content, style)"}},required:["canvasId","shape"]}},{name:"get_canvas_connections",description:"Get all connections/arrows between shapes",inputSchema:{type:"object",properties:{canvasId:{type:"string",description:"Canvas ID"}},required:["canvasId"]}},{name:"export_canvas",description:"Export canvas as JSON or markdown",inputSchema:{type:"object",properties:{canvasId:{type:"string",description:"Canvas ID"},format:{type:"string",enum:["json","markdown","mermaid"],description:"Export format"}},required:["canvasId"]}}];async function Zl(t,e,r,a){switch(t){case"list_canvases":return await Zm(r);case"get_canvas":return await Ym(r,e.canvasId);case"create_canvas":return await Qm(r,e);case"add_canvas_shape":return await Km(r,e);case"get_canvas_connections":return await Xm(r,e.canvasId);case"export_canvas":return await eg(r,e);default:throw new Error(`Unknown canvas tool: ${t}`)}}async function Zm(t){let e=(0,kt.join)(t,".lokus","canvas");try{let r=await(0,Te.readdir)(e,{withFileTypes:!0}),a=[];for(let o of r)if(o.isFile()&&o.name.endsWith(".json")){let i=o.name.replace(".json","");try{let c=await(0,Te.readFile)((0,kt.join)(e,o.name),"utf-8"),u=JSON.parse(c);a.push({id:i,name:u.name||i,shapeCount:u.shapes?.length||0,created:u.created,modified:u.modified})}catch{}}return{content:[{type:"text",text:`**Canvases in Workspace:**

${a.length>0?a.map(o=>`\u{1F3A8} **${o.name}**
  - ID: ${o.id}
  - Shapes: ${o.shapeCount}
  - Modified: ${o.modified||"Unknown"}`).join(`

`):"No canvases found"}`}]}}catch{return{content:[{type:"text",text:"Canvas feature not configured in this workspace"}]}}}async function Ym(t,e){let r=(0,kt.join)(t,".lokus","canvas",`${e}.json`);try{let a=await(0,Te.readFile)(r,"utf-8"),o=JSON.parse(a),i=o.shapes||[],c=i.filter(f=>f.type==="arrow"||f.type==="line"),u=i.filter(f=>f.type!=="arrow"&&f.type!=="line");return{content:[{type:"text",text:`**Canvas: ${o.name||e}**

\u{1F4CA} Nodes: ${u.length}
\u{1F517} Connections: ${c.length}
\u{1F4C5} Modified: ${o.modified||"Unknown"}

**Shapes:**
${u.slice(0,10).map(f=>`- ${f.type}: ${f.text||f.label||"No text"}`).join(`
`)}
${u.length>10?`... and ${u.length-10} more shapes`:""}

**Connections:**
${c.slice(0,5).map(f=>`- ${f.from||"unknown"} \u2192 ${f.to||"unknown"}`).join(`
`)}
${c.length>5?`... and ${c.length-5} more connections`:""}`}]}}catch{return{content:[{type:"text",text:`Canvas "${e}" not found`}]}}}async function Qm(t,{name:e,description:r}){let a=(0,kt.join)(t,".lokus","canvas");await(0,Te.mkdir)(a,{recursive:!0});let o=e.toLowerCase().replace(/[^a-z0-9]/g,"-"),i=(0,kt.join)(a,`${o}.json`),c={id:o,name:e,description:r,shapes:[],viewport:{x:0,y:0,zoom:1},created:new Date().toISOString(),modified:new Date().toISOString()};return await(0,Te.writeFile)(i,JSON.stringify(c,null,2)),{content:[{type:"text",text:`\u2705 Canvas "${e}" created with ID: ${o}`}]}}async function Km(t,{canvasId:e,shape:r}){let a=(0,kt.join)(t,".lokus","canvas",`${e}.json`);try{let o=await(0,Te.readFile)(a,"utf-8"),i=JSON.parse(o),c={id:r.id||Date.now().toString(36)+Math.random().toString(36).substr(2),type:r.type||"rectangle",x:r.x||100,y:r.y||100,width:r.width||200,height:r.height||100,text:r.text||"",style:r.style||{},...r};return i.shapes=i.shapes||[],i.shapes.push(c),i.modified=new Date().toISOString(),await(0,Te.writeFile)(a,JSON.stringify(i,null,2)),{content:[{type:"text",text:`\u2705 Shape added to canvas "${e}" with ID: ${c.id}`}]}}catch(o){return{content:[{type:"text",text:`\u274C Failed to add shape: ${o.message}`}]}}}async function Xm(t,e){let r=(0,kt.join)(t,".lokus","canvas",`${e}.json`);try{let a=await(0,Te.readFile)(r,"utf-8"),i=(JSON.parse(a).shapes||[]).filter(u=>u.type==="arrow"||u.type==="line"||u.type==="connection"),c={};return i.forEach(u=>{let f=u.from||u.startId||"unknown",d=u.to||u.endId||"unknown";c[f]||(c[f]=[]),c[f].push(d)}),{content:[{type:"text",text:`**Canvas Connections:**

${Object.entries(c).map(([u,f])=>`\u{1F4CD} ${u}
${f.map(d=>`  \u2192 ${d}`).join(`
`)}`).join(`

`)}

Total connections: ${i.length}`}]}}catch(a){return{content:[{type:"text",text:`\u274C Failed to get connections: ${a.message}`}]}}}async function eg(t,{canvasId:e,format:r="markdown"}){let a=(0,kt.join)(t,".lokus","canvas",`${e}.json`);try{let o=await(0,Te.readFile)(a,"utf-8"),i=JSON.parse(o),c="";switch(r){case"markdown":c=`# ${i.name||e}

`,c+=i.description?`${i.description}

`:"",(i.shapes||[]).filter(d=>d.type!=="arrow"&&d.type!=="line").forEach(d=>{c+=`## ${d.text||d.label||"Node"}

`,d.description&&(c+=`${d.description}

`)});break;case"mermaid":c=`graph TD
`,(i.shapes||[]).forEach(d=>{d.type==="arrow"||d.type==="connection"?c+=`  ${d.from||d.startId} --> ${d.to||d.endId}
`:d.text&&(c+=`  ${d.id}["${d.text}"]
`)});break;case"json":default:c=JSON.stringify(i,null,2);break}return{content:[{type:"text",text:c}]}}catch(o){return{content:[{type:"text",text:`\u274C Failed to export canvas: ${o.message}`}]}}}var ie=require("fs/promises"),at=require("path"),Ts=[{name:"list_boards",description:"List all kanban boards in the workspace",inputSchema:{type:"object",properties:{}}},{name:"get_board",description:"Get kanban board with columns and cards",inputSchema:{type:"object",properties:{boardId:{type:"string",description:"Board ID or name"}},required:["boardId"]}},{name:"create_board",description:"Create a new kanban board. Supports automatic date-based column creation.",inputSchema:{type:"object",properties:{name:{type:"string",description:"Board name"},columns:{type:"array",items:{type:"string"},description:"Column names (e.g., ['To Do', 'In Progress', 'Done'])"},dateType:{type:"string",enum:["monthly","quarterly","yearly","custom"],description:"Type of date-based columns to create (optional)"},startDate:{type:"string",description:"Start date for date-based columns (YYYY-MM-DD format, optional)"},endDate:{type:"string",description:"End date for date-based columns (YYYY-MM-DD format, optional)"},additionalColumns:{type:"array",items:{type:"string"},description:"Additional status columns (e.g., ['Applied', 'Accepted', 'Rejected'])"}},required:["name"]}},{name:"add_card",description:"Add a card to a kanban column",inputSchema:{type:"object",properties:{boardId:{type:"string",description:"Board ID"},column:{type:"string",description:"Column name"},card:{type:"object",description:"Card data (title, description, tags, etc)"}},required:["boardId","column","card"]}},{name:"move_card",description:"Move a card between columns",inputSchema:{type:"object",properties:{boardId:{type:"string",description:"Board ID"},cardId:{type:"string",description:"Card ID"},fromColumn:{type:"string",description:"Source column"},toColumn:{type:"string",description:"Target column"}},required:["boardId","cardId","fromColumn","toColumn"]}},{name:"update_card",description:"Update card properties",inputSchema:{type:"object",properties:{boardId:{type:"string",description:"Board ID"},cardId:{type:"string",description:"Card ID"},updates:{type:"object",description:"Fields to update"}},required:["boardId","cardId","updates"]}},{name:"get_board_stats",description:"Get statistics for a kanban board",inputSchema:{type:"object",properties:{boardId:{type:"string",description:"Board ID"}},required:["boardId"]}}];async function Yl(t,e,r,a){switch(t){case"list_boards":return await tg(r);case"get_board":return await rg(r,e.boardId);case"create_board":return await ng(r,e);case"add_card":return await og(r,e);case"move_card":return await sg(r,e);case"update_card":return await ig(r,e);case"get_board_stats":return await cg(r,e.boardId);default:throw new Error(`Unknown kanban tool: ${t}`)}}async function tg(t){let e=(0,at.join)(t,".lokus","kanban");try{let r=await(0,ie.readdir)(e,{withFileTypes:!0}),a=[];for(let o of r)if(o.isFile()&&o.name.endsWith(".json")){let i=o.name.replace(".json","");try{let c=await(0,ie.readFile)((0,at.join)(e,o.name),"utf-8"),u=JSON.parse(c),f=Object.values(u.columns||{}).reduce((d,g)=>d+(g.cards?.length||0),0);a.push({id:i,name:u.name||i,columns:Object.keys(u.columns||{}).length,cards:f,modified:u.modified})}catch{}}return{content:[{type:"text",text:`**Kanban Boards:**

${a.length>0?a.map(o=>`\u{1F4CB} **${o.name}**
  - ID: ${o.id}
  - Columns: ${o.columns}
  - Cards: ${o.cards}
  - Modified: ${o.modified||"Unknown"}`).join(`

`):"No kanban boards found"}`}]}}catch{return{content:[{type:"text",text:"Kanban feature not configured in this workspace"}]}}}async function rg(t,e){let r=(0,at.join)(t,".lokus","kanban",`${e}.json`);try{let a=await(0,ie.readFile)(r,"utf-8"),o=JSON.parse(a),i=`**Kanban Board: ${o.name||e}**

`;for(let[c,u]of Object.entries(o.columns||{})){let f=u.cards||[];i+=`**${c}** (${f.length} cards)
`,f.slice(0,5).forEach(d=>{i+=`  \u2022 ${d.title}`,d.tags?.length&&(i+=` [${d.tags.join(", ")}]`),d.assignee&&(i+=` @${d.assignee}`),i+=`
`}),f.length>5&&(i+=`  ... and ${f.length-5} more cards
`),i+=`
`}return{content:[{type:"text",text:i}]}}catch{return{content:[{type:"text",text:`Board "${e}" not found`}]}}}async function ng(t,{name:e,columns:r,dateType:a,startDate:o,endDate:i,additionalColumns:c=[]}){let u=(0,at.join)(t,".lokus","kanban");await(0,ie.mkdir)(u,{recursive:!0});let f=e.toLowerCase().replace(/[^a-z0-9]/g,"-"),d=(0,at.join)(u,`${f}.json`),g=new Date().toISOString(),k={version:"1.0.0",name:e,columns:{},settings:{card_template:{},automations:[],custom_fields:[]},metadata:{created:g,modified:g,created_with:"Lokus MCP"}},C=r||["To Do","In Progress","Done"];a&&o&&(C=ag(a,o,i),c.length>0&&(C=[...C,...c]));for(let D=0;D<C.length;D++){let x=C[D],z=x.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"");k.columns[z]={name:x,order:D,cards:[]}}return await(0,ie.writeFile)(d,JSON.stringify(k,null,2)),{content:[{type:"text",text:`\u2705 Kanban board "${e}" created with ${Object.keys(k.columns).length} columns:
${C.map(D=>`  - ${D}`).join(`
`)}`}]}}function ag(t,e,r){let a=[],o=new Date(e),i=r?new Date(r):new Date(o.getFullYear()+1,o.getMonth(),1);if(t==="monthly"){let c=new Date(o);for(;c<=i;){let u=c.toLocaleDateString("en-US",{month:"long",year:"numeric"});a.push(`\u{1F4C5} ${u}`),c.setMonth(c.getMonth()+1)}}else if(t==="quarterly"){let c=new Date(o),u=Math.floor(c.getMonth()/3)+1;for(;c<=i;)a.push(`\u{1F4C5} Q${u} ${c.getFullYear()}`),c.setMonth(c.getMonth()+3),u=Math.floor(c.getMonth()/3)+1}else if(t==="yearly"){let c=o.getFullYear(),u=i.getFullYear();for(;c<=u;)a.push(`\u{1F4C5} ${c}`),c++}return a}async function og(t,{boardId:e,column:r,card:a}){let o=(0,at.join)(t,".lokus","kanban",`${e}.json`);try{let i=await(0,ie.readFile)(o,"utf-8"),c=JSON.parse(i);if(!c.columns[r])throw new Error(`Column "${r}" not found`);let u=new Date().toISOString(),f={id:a.id||Date.now().toString(36)+Math.random().toString(36).substr(2),title:a.title||"Untitled",description:a.description||"",tags:a.tags||[],assignee:a.assignee||null,priority:a.priority||"normal",due_date:a.due_date||a.dueDate||null,linked_notes:a.linked_notes||[],checklist:a.checklist||[],created:u,modified:u};return c.columns[r].cards=c.columns[r].cards||[],c.columns[r].cards.push(f),c.metadata.modified=u,await(0,ie.writeFile)(o,JSON.stringify(c,null,2)),{content:[{type:"text",text:`\u2705 Card "${f.title}" added to column "${r}" with ID: ${f.id}`}]}}catch(i){return{content:[{type:"text",text:`\u274C Failed to add card: ${i.message}`}]}}}async function sg(t,{boardId:e,cardId:r,fromColumn:a,toColumn:o}){let i=(0,at.join)(t,".lokus","kanban",`${e}.json`);try{let c=await(0,ie.readFile)(i,"utf-8"),u=JSON.parse(c);if(!u.columns[a]||!u.columns[o])throw new Error("Column not found");let f=u.columns[a].cards?.findIndex(g=>g.id===r);if(f===-1)throw new Error(`Card ${r} not found in column ${a}`);let[d]=u.columns[a].cards.splice(f,1);return d.modified=new Date().toISOString(),u.columns[o].cards=u.columns[o].cards||[],u.columns[o].cards.push(d),u.metadata.modified=new Date().toISOString(),await(0,ie.writeFile)(i,JSON.stringify(u,null,2)),{content:[{type:"text",text:`\u2705 Card "${d.title}" moved from "${a}" to "${o}"`}]}}catch(c){return{content:[{type:"text",text:`\u274C Failed to move card: ${c.message}`}]}}}async function ig(t,{boardId:e,cardId:r,updates:a}){let o=(0,at.join)(t,".lokus","kanban",`${e}.json`);try{let i=await(0,ie.readFile)(o,"utf-8"),c=JSON.parse(i),u=!1;for(let f of Object.values(c.columns||{})){let d=f.cards?.findIndex(g=>g.id===r);if(d!==-1){f.cards[d]={...f.cards[d],...a,id:r,modified:new Date().toISOString()},u=!0;break}}if(!u)throw new Error(`Card ${r} not found`);return c.metadata.modified=new Date().toISOString(),await(0,ie.writeFile)(o,JSON.stringify(c,null,2)),{content:[{type:"text",text:`\u2705 Card ${r} updated successfully`}]}}catch(i){return{content:[{type:"text",text:`\u274C Failed to update card: ${i.message}`}]}}}async function cg(t,e){let r=(0,at.join)(t,".lokus","kanban",`${e}.json`);try{let a=await(0,ie.readFile)(r,"utf-8"),o=JSON.parse(a),i={columnCount:Object.keys(o.columns||{}).length,totalCards:0,cardsByColumn:{},cardsByPriority:{high:0,normal:0,low:0},cardsByAssignee:{},overdueTasks:0},c=new Date;for(let[u,f]of Object.entries(o.columns||{})){let d=f.cards||[];i.totalCards+=d.length,i.cardsByColumn[u]=d.length;for(let g of d)i.cardsByPriority[g.priority||"normal"]++,g.assignee&&(i.cardsByAssignee[g.assignee]=(i.cardsByAssignee[g.assignee]||0)+1),g.dueDate&&new Date(g.dueDate)<c&&i.overdueTasks++}return{content:[{type:"text",text:`**Board Statistics: ${o.name||e}**

\u{1F4CA} Total Cards: ${i.totalCards}
\u{1F4CB} Columns: ${i.columnCount}
\u26A0\uFE0F Overdue Tasks: ${i.overdueTasks}

**Cards by Column:**
${Object.entries(i.cardsByColumn).map(([u,f])=>`  - ${u}: ${f}`).join(`
`)}

**Cards by Priority:**
  - High: ${i.cardsByPriority.high}
  - Normal: ${i.cardsByPriority.normal}
  - Low: ${i.cardsByPriority.low}

**Cards by Assignee:**
${Object.entries(i.cardsByAssignee).map(([u,f])=>`  - @${u}: ${f}`).join(`
`)||"  No assignments"}`}]}}catch(a){return{content:[{type:"text",text:`\u274C Failed to get stats: ${a.message}`}]}}}var Ga=require("fs/promises"),Sr=require("path"),Cs=[{name:"get_graph_overview",description:"Get overview of the knowledge graph",inputSchema:{type:"object",properties:{}}},{name:"get_node_connections",description:"Get all connections for a specific node (note)",inputSchema:{type:"object",properties:{nodeName:{type:"string",description:"Name of the node/note"}},required:["nodeName"]}},{name:"find_path",description:"Find path between two nodes in the graph",inputSchema:{type:"object",properties:{from:{type:"string",description:"Starting node"},to:{type:"string",description:"Target node"}},required:["from","to"]}},{name:"get_orphan_notes",description:"Find notes with no connections (orphans)",inputSchema:{type:"object",properties:{}}},{name:"get_hub_notes",description:"Find most connected notes (hubs)",inputSchema:{type:"object",properties:{limit:{type:"number",description:"Number of top hubs to return"}}}},{name:"get_clusters",description:"Identify clusters of related notes",inputSchema:{type:"object",properties:{}}}];async function Ql(t,e,r,a){switch(t){case"get_graph_overview":return await lg(r);case"get_node_connections":return await ug(r,e.nodeName);case"find_path":return await dg(r,e.from,e.to);case"get_orphan_notes":return await fg(r);case"get_hub_notes":return await pg(r,e.limit||10);case"get_clusters":return await hg(r);default:throw new Error(`Unknown graph tool: ${t}`)}}async function tn(t){let e={nodes:new Set,edges:[],adjacencyList:{}};async function r(a){let o=await(0,Ga.readdir)(a,{withFileTypes:!0});for(let i of o){if(i.name.startsWith("."))continue;let c=(0,Sr.join)(a,i.name);if(i.isDirectory())await r(c);else if(i.isFile()&&[".md",".txt"].includes((0,Sr.extname)(i.name))){let u=(0,Sr.basename)(i.name,(0,Sr.extname)(i.name));e.nodes.add(u);try{let g=((await(0,Ga.readFile)(c,"utf-8")).match(/\[\[([^\]]+)\]\]/g)||[]).map(k=>k.slice(2,-2));e.adjacencyList[u]=g;for(let k of g)e.edges.push({from:u,to:k})}catch{}}}}return await r(t),e}async function lg(t){let e=await tn(t),r={totalNodes:e.nodes.size,totalEdges:e.edges.length,avgConnections:e.edges.length/Math.max(e.nodes.size,1),orphanCount:0,hubCount:0};for(let a of e.nodes){let o=(e.adjacencyList[a]||[]).length,i=e.edges.filter(u=>u.to===a).length,c=o+i;c===0&&r.orphanCount++,c>5&&r.hubCount++}return{content:[{type:"text",text:`**Knowledge Graph Overview**

\u{1F535} Total Notes: ${r.totalNodes}
\u{1F517} Total Connections: ${r.totalEdges}
\u{1F4CA} Avg Connections: ${r.avgConnections.toFixed(2)}
\u{1F3DD}\uFE0F Orphan Notes: ${r.orphanCount}
\u{1F31F} Hub Notes (>5 connections): ${r.hubCount}

The knowledge graph shows how your notes are interconnected through wiki links.`}]}}async function ug(t,e){let r=await tn(t),a=r.adjacencyList[e]||[],o=r.edges.filter(c=>c.to===e).map(c=>c.from),i=new Set([...a,...o]);return{content:[{type:"text",text:`**Connections for "${e}"**

**Outgoing Links (${a.length}):**
${a.map(c=>`  \u2192 ${c}`).join(`
`)||"  None"}

**Incoming Links (${o.length}):**
${o.map(c=>`  \u2190 ${c}`).join(`
`)||"  None"}

**All Related Notes (${i.size}):**
${Array.from(i).map(c=>`  \u2022 ${c}`).join(`
`)||"  None"}`}]}}async function dg(t,e,r){let a=await tn(t),o=[[e]],i=new Set([e]);for(;o.length>0;){let c=o.shift(),u=c[c.length-1];if(u===r)return{content:[{type:"text",text:`**Path from "${e}" to "${r}":**

${c.map((d,g)=>g===0?`\u{1F7E2} ${d}`:g===c.length-1?`\u{1F534} ${d}`:`\u26AA ${d}`).join(" \u2192 ")}

Path length: ${c.length-1} steps`}]};let f=a.adjacencyList[u]||[];for(let d of f)i.has(d)||(i.add(d),o.push([...c,d]))}return{content:[{type:"text",text:`No path found from "${e}" to "${r}". These notes are not connected in the knowledge graph.`}]}}async function fg(t){let e=await tn(t),r=[];for(let a of e.nodes){let o=(e.adjacencyList[a]||[]).length,i=e.edges.filter(c=>c.to===a).length;o===0&&i===0&&r.push(a)}return{content:[{type:"text",text:`**Orphan Notes (${r.length}):**

These notes have no connections to other notes:

${r.map(a=>`  \u2022 ${a}`).join(`
`)||"No orphan notes found!"}

Consider linking these notes to integrate them into your knowledge graph.`}]}}async function pg(t,e){let r=await tn(t),a={};for(let i of r.nodes){let c=(r.adjacencyList[i]||[]).length,u=r.edges.filter(f=>f.to===i).length;a[i]=c+u}let o=Object.entries(a).sort((i,c)=>c[1]-i[1]).slice(0,e);return{content:[{type:"text",text:`**Top ${e} Hub Notes:**

These notes are most connected in your knowledge graph:

${o.map(([i,c],u)=>`${u+1}. **${i}** - ${c} connections`).join(`
`)}

Hub notes are central to your knowledge structure and often represent key concepts.`}]}}async function hg(t){let e=await tn(t),r=new Set,a=[];function o(i,c){if(r.has(i))return;r.add(i),c.add(i);let u=e.adjacencyList[i]||[];for(let d of u)o(d,c);let f=e.edges.filter(d=>d.to===i).map(d=>d.from);for(let d of f)o(d,c)}for(let i of e.nodes)if(!r.has(i)){let c=new Set;o(i,c),c.size>1&&a.push(Array.from(c))}return a.sort((i,c)=>c.length-i.length),{content:[{type:"text",text:`**Knowledge Clusters (${a.length}):**

${a.slice(0,5).map((i,c)=>`**Cluster ${c+1}** (${i.length} notes):
${i.slice(0,10).map(u=>`  \u2022 ${u}`).join(`
`)}${i.length>10?`
  ... and ${i.length-10} more`:""}`).join(`

`)}${a.length>5?`

... and ${a.length-5} more clusters`:""}

Clusters represent groups of related notes that are interconnected.`}]}}var Ce=require("fs/promises"),kr=require("path"),Rs=[{name:"list_templates",description:"List all templates in the workspace",inputSchema:{type:"object",properties:{category:{type:"string",description:"Filter by category (optional)"}}}},{name:"create_template",description:"Create a new template with proper frontmatter. Templates support variables like {{date}}, {{time}}, {{cursor}}, {{title}}, and custom variables.",inputSchema:{type:"object",properties:{id:{type:"string",description:"Unique template ID (lowercase, hyphenated)"},name:{type:"string",description:"Display name for the template"},content:{type:"string",description:"Template content with variables (e.g., {{date}}, {{time}}, {{cursor}})"},category:{type:"string",description:"Category for organization (Personal, Work, Documentation, etc.)",default:"Personal"},tags:{type:"array",items:{type:"string"},description:"Tags for categorization"}},required:["id","name","content"]}},{name:"read_template",description:"Read a template's content and metadata",inputSchema:{type:"object",properties:{id:{type:"string",description:"Template ID"}},required:["id"]}},{name:"update_template",description:"Update an existing template",inputSchema:{type:"object",properties:{id:{type:"string",description:"Template ID"},name:{type:"string",description:"New name (optional)"},content:{type:"string",description:"New content (optional)"},category:{type:"string",description:"New category (optional)"},tags:{type:"array",items:{type:"string"},description:"New tags (optional)"}},required:["id"]}},{name:"delete_template",description:"Delete a template",inputSchema:{type:"object",properties:{id:{type:"string",description:"Template ID to delete"}},required:["id"]}}];async function Kl(t,e,r,a){let o=(0,kr.join)(r,"templates");try{await(0,Ce.mkdir)(o,{recursive:!0})}catch{}switch(t){case"list_templates":return await mg(o,e);case"create_template":return await gg(o,e);case"read_template":return await yg(o,e);case"update_template":return await bg(o,e);case"delete_template":return await wg(o,e);default:throw new Error(`Unknown template tool: ${t}`)}}async function mg(t,e){try{let r=await(0,Ce.readdir)(t),a=[];for(let o of r)if(o.endsWith(".md"))try{let i=(0,kr.join)(t,o),c=await(0,Ce.readFile)(i,"utf-8"),u=Es(c,o);(!e.category||u.category===e.category)&&a.push({id:u.id,name:u.name,category:u.category,tags:u.tags,createdAt:u.createdAt,updatedAt:u.updatedAt})}catch{}return{content:[{type:"text",text:JSON.stringify({templates:a,total:a.length},null,2)}]}}catch(r){return{content:[{type:"text",text:`Error listing templates: ${r.message}`}],isError:!0}}}async function gg(t,e){try{let{id:r,name:a,content:o,category:i="Personal",tags:c=[]}=e;if(!/^[a-z0-9-_]+$/.test(r))throw new Error("Template ID must be lowercase alphanumeric with hyphens/underscores");let u=`${r}.md`,f=(0,kr.join)(t,u),d=new Date().toISOString(),k=`---
${Xl({id:r,name:a,category:i,tags:c,createdAt:d,updatedAt:d})}---

${o}`;return await(0,Ce.writeFile)(f,k,"utf-8"),{content:[{type:"text",text:`Template "${a}" created successfully!

ID: ${r}
File: ${f}

**Important**: The template has been created as a file, but to see it in the UI:
1. Open Template Manager in Lokus
2. Click the "Refresh" button
3. The template will now appear in the list

Alternatively, restart the Lokus app to load the new template.`}]}}catch(r){return{content:[{type:"text",text:`Error creating template: ${r.message}`}],isError:!0}}}async function yg(t,e){try{let{id:r}=e,a=(0,kr.join)(t,`${r}.md`),o=await(0,Ce.readFile)(a,"utf-8"),i=Es(o,`${r}.md`);return{content:[{type:"text",text:JSON.stringify(i,null,2)}]}}catch(r){return{content:[{type:"text",text:`Error reading template: ${r.message}`}],isError:!0}}}async function bg(t,e){try{let{id:r,name:a,content:o,category:i,tags:c}=e,u=(0,kr.join)(t,`${r}.md`),f=await(0,Ce.readFile)(u,"utf-8"),d=Es(f,`${r}.md`),g={id:d.id,name:a||d.name,content:o||d.content,category:i||d.category,tags:c||d.tags,createdAt:d.createdAt,updatedAt:new Date().toISOString()},C=`---
${Xl(g)}---

${g.content}`;return await(0,Ce.writeFile)(u,C,"utf-8"),{content:[{type:"text",text:`Template "${g.name}" updated successfully!

**Remember to refresh the Template Manager** to see the changes.`}]}}catch(r){return{content:[{type:"text",text:`Error updating template: ${r.message}`}],isError:!0}}}async function wg(t,e){try{let{id:r}=e,a=(0,kr.join)(t,`${r}.md`);return await(0,Ce.unlink)(a),{content:[{type:"text",text:`Template "${r}" deleted successfully!

**Remember to refresh the Template Manager** to see the changes.`}]}}catch(r){return{content:[{type:"text",text:`Error deleting template: ${r.message}`}],isError:!0}}}function Xl(t){let e="";return e+=`id: ${t.id}
`,e+=`name: "${t.name}"
`,e+=`category: ${t.category}
`,t.tags&&t.tags.length>0?(e+=`tags:
`,t.tags.forEach(r=>{e+=`  - ${r}
`})):e+=`tags: []
`,e+=`createdAt: ${t.createdAt}
`,e+=`updatedAt: ${t.updatedAt}
`,e}function Es(t,e){let r=/^---\n([\s\S]*?)\n---\n([\s\S]*)$/,a=t.match(r);if(!a){let u=e.replace(".md","");return{id:u,name:u,content:t.trim(),category:"Personal",tags:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}}let o=a[1],i=a[2].trim(),c=_g(o);return{id:c.id||e.replace(".md",""),name:c.name||c.id||e.replace(".md",""),content:i,category:c.category||"Personal",tags:c.tags||[],createdAt:c.createdAt||new Date().toISOString(),updatedAt:c.updatedAt||new Date().toISOString()}}function _g(t){let e=t.split(`
`),r={},a=null,o=[];for(let i of e){let c=i.trim();if(!c)continue;if(c.startsWith("- ")){a&&o.push(c.substring(2).trim());continue}a&&o.length>0&&(r[a]=o,o=[],a=null);let u=c.indexOf(":");if(u>-1){let f=c.substring(0,u).trim(),d=c.substring(u+1).trim();d.startsWith('"')&&d.endsWith('"')&&(d=d.substring(1,d.length-1)),d==="[]"?r[f]=[]:d?r[f]=d:(a=f,o=[])}}return a&&o.length>0&&(r[a]=o),r}Ka();var st=!1;try{let t=typeof window<"u"?window:void 0;st=!!(t&&(t.__TAURI_INTERNALS__&&typeof t.__TAURI_INTERNALS__.invoke=="function"||t.__TAURI_METADATA__||typeof navigator<"u"&&navigator.userAgent&&navigator.userAgent.includes("Tauri")))}catch{}var Ms,js,iu,cu,lu,uu;async function Mn(){if(st&&!Ms)try{({appDataDir:Ms,join:js}=await Promise.resolve().then(()=>(Ln(),Xa))),{readTextFile:iu,writeTextFile:cu,mkdir:lu,exists:uu}=await Promise.resolve().then(()=>(Ns(),Ls))}catch(t){console.error("Failed to load Tauri modules:",t),st=!1}}var ou="Lokus",su="config.json",du="lokus:config";async function Fs(t){await Mn(),st&&(await uu(t)||await lu(t,{recursive:!0}))}async function vy(t){if(await Mn(),!st)try{return JSON.parse(localStorage.getItem(du)||"null")}catch{return null}try{return JSON.parse(await iu(t))}catch{return null}}async function Ty(t,e){if(await Mn(),!st){localStorage.setItem(du,JSON.stringify(e??{}));return}await cu(t,JSON.stringify(e,null,2))}async function Ws(){if(await Mn(),!st)return ou;let t=await js(await Ms(),ou);return await Fs(t),t}async function fu(){return await Mn(),st?await js(await Ws(),su):su}async function Bs(){let t=await fu();if(st){let r=await Ws();await Fs(r)}let e=await vy(t);return e===null&&(e={}),e}async function Cy(t){let e=await fu();if(st){let a=await Ws();await Fs(a)}return await Ty(e,t)}async function pu(t){let r={...await Bs(),...t};return await Cy(r),r}Wn();var Cr=()=>{if(typeof window>"u")return"unknown";let t=window.navigator.platform?.toLowerCase()||"",e=window.navigator.userAgent?.toLowerCase()||"";return t.includes("win")||e.includes("windows")?"windows":t.includes("mac")||e.includes("mac")?"macos":t.includes("linux")||e.includes("linux")?"linux":"unknown"},Je=()=>Cr()==="windows",Re=()=>Cr()==="macos",Cu=()=>Cr()==="linux",Ru=()=>Re()?"Cmd":"Ctrl";var Eu=()=>Je()?"\\":"/";var By={windows:{shellIntegration:!0,jumpList:!0,snapLayouts:!0,contextMenus:!0,registryAccess:!0,windowsNotifications:!0,darkModeSync:!0},macos:{quickLook:!0,touchBar:!0,continuity:!0,spotlight:!0,finderIntegration:!0,darkModeSync:!0},linux:{desktopIntegration:!0,contextMenus:!0,darkModeSync:!1}},Au=t=>{let e=Cr();return By[e]?.[t]||!1},qy=async()=>{switch(Cr()){case"windows":return Promise.resolve().then(()=>(xu(),ku));case"macos":return Promise.resolve().then(()=>(Tu(),vu));default:return Promise.resolve().then(()=>(Wn(),hu))}},zs=null,$u=async()=>(zs||(zs=await qy()),zs);var Hs=class{constructor(){this.platform=Cr(),this.platformModule=null,this.initialized=!1}async initialize(){if(!this.initialized)try{this.platformModule=await $u(),this.initialized=!0}catch(e){console.error("Failed to initialize platform service:",e)}}getPlatform(){return this.platform}isWindows(){return Je()}isMacOS(){return Re()}isLinux(){return Cu()}hasCapability(e){return Au(e)}async getShortcuts(){return await this.initialize(),this.platformModule?Je()?this.platformModule.windowsShortcuts||{}:Re()?this.platformModule.macosShortcuts||{}:this.platformModule.windowsShortcuts||{}:{}}async getShortcut(e){return(await this.getShortcuts())[e]||null}formatShortcut(e){if(!e)return"";let r=e;return Re()&&(r=r.replace(/Cmd/g,"\u2318"),r=r.replace(/Option/g,"\u2325"),r=r.replace(/Shift/g,"\u21E7"),r=r.replace(/Control/g,"\u2303")),r}async getPathUtils(){return await this.initialize(),this.platformModule?Je()?this.platformModule.windowsPathUtils||{}:Re()?this.platformModule.macosPathUtils||{}:this.platformModule||{}:{}}async normalizePath(e){let r=await this.getPathUtils();return Je()&&r.normalizePath?r.normalizePath(e):e}getPathSeparator(){return Eu()}async getValidation(){return await this.initialize(),this.platformModule?Je()?this.platformModule.windowsValidation||{isValidFilename:()=>!0}:Re()?this.platformModule.macosValidation||{isValidFilename:()=>!0}:this.platformModule.validationUtils||{isValidFilename:()=>!0}:{isValidFilename:()=>!0}}async isValidFilename(e){return(await this.getValidation()).isValidFilename(e)}async getUIUtils(){return await this.initialize(),this.platformModule?Je()?this.platformModule.windowsUI||{isDarkModeEnabled:()=>window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches}:Re()?this.platformModule.macosUI||{isDarkModeEnabled:()=>window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches}:{isDarkModeEnabled:()=>window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches}:{isDarkModeEnabled:()=>window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches}}async getPlatformStyles(){let e=await this.getUIUtils();return Je()&&e.getWindowsStyles?e.getWindowsStyles():Re()&&e.getMacStyles?e.getMacStyles():{}}async getShellIntegration(){return await this.initialize(),this.platformModule?Je()?this.platformModule.windowsShell||null:Re()&&this.platformModule.finderIntegration||null:null}async getContextMenuItems(){return(await this.getShellIntegration())?.getContextMenuItems?.()||[]}async getPlatformFeatures(){return await this.initialize(),Je()?this.platformModule.windowsFeatureHelpers||this.platformModule.windowsFeaturesFromModule:Re()?this.platformModule.macosFeatures:{}}getModifierKey(){return Ru()}getModifierSymbol(){return Re()?"\u2318":"Ctrl"}convertShortcut(e){let r=e;return Re()?(r=r.replace(/Ctrl/g,"Cmd"),r=r.replace(/Alt/g,"Option")):(r=r.replace(/Cmd/g,"Ctrl"),r=r.replace(/Option/g,"Alt")),r}matchesShortcut(e,r){if(!this.platformModule)return!1;let a=this.platformModule?.keyboardUtils?.getNormalizedKey?.(e);if(!a)return!1;let o=this.convertShortcut(r);return a===o.replace(/\+/g,"+")}},X_=new Hs;var Jy=["--bg","--text","--panel","--border","--muted","--accent","--accent-fg","--tab-active","--task-todo","--task-progress","--task-urgent","--task-question","--task-completed","--task-cancelled","--task-delegated","--danger","--success","--warning","--info","--editor-placeholder","--app-bg","--app-text","--app-panel","--app-border","--app-muted","--app-accent","--app-accent-fg"],Mu={"--bg":"15 23 42","--text":"241 245 249","--panel":"30 41 59","--border":"51 65 85","--muted":"148 163 184","--accent":"139 92 246","--accent-fg":"255 255 255","--tab-active":"30 41 59","--task-todo":"107 114 128","--task-progress":"59 130 246","--task-urgent":"239 68 68","--task-question":"245 158 11","--task-completed":"16 185 129","--task-cancelled":"107 114 128","--task-delegated":"139 92 246","--danger":"239 68 68","--success":"16 185 129","--warning":"245 158 11","--info":"59 130 246","--editor-placeholder":"148 163 184"},Zy=["dracula","nord","one-dark-pro","minimal-light","neon-dark"],Ks={dracula:'{"name": "Dracula", "tokens": {"--bg": "#282a36", "--text": "#f8f8f2", "--panel": "#21222c", "--border": "#44475a", "--muted": "#6272a4", "--accent": "#bd93f9", "--accent-fg": "#ffffff", "--task-todo": "#6272a4", "--task-progress": "#8be9fd", "--task-urgent": "#ff5555", "--task-question": "#f1fa8c", "--task-completed": "#50fa7b", "--task-cancelled": "#6272a4", "--task-delegated": "#bd93f9", "--danger": "#ff5555", "--success": "#50fa7b", "--warning": "#f1fa8c", "--info": "#8be9fd", "--editor-placeholder": "#6272a4"}}',nord:'{"name": "Nord", "tokens": {"--bg": "#2E3440", "--text": "#ECEFF4", "--panel": "#3B4252", "--border": "#4C566A", "--muted": "#D8DEE9", "--accent": "#88C0D0", "--accent-fg": "#2E3440", "--task-todo": "#4C566A", "--task-progress": "#5E81AC", "--task-urgent": "#BF616A", "--task-question": "#EBCB8B", "--task-completed": "#A3BE8C", "--task-cancelled": "#4C566A", "--task-delegated": "#B48EAD", "--danger": "#BF616A", "--success": "#A3BE8C", "--warning": "#EBCB8B", "--info": "#5E81AC", "--editor-placeholder": "#4C566A"}}',"one-dark-pro":'{"name": "One Dark Pro", "tokens": {"--bg": "#282c34", "--text": "#abb2bf", "--panel": "#21252b", "--border": "#3a3f4b", "--muted": "#5c6370", "--accent": "#61afef", "--accent-fg": "#ffffff", "--task-todo": "#5c6370", "--task-progress": "#61afef", "--task-urgent": "#e06c75", "--task-question": "#d19a66", "--task-completed": "#98c379", "--task-cancelled": "#5c6370", "--task-delegated": "#c678dd", "--danger": "#e06c75", "--success": "#98c379", "--warning": "#d19a66", "--info": "#61afef", "--editor-placeholder": "#5c6370"}}',"minimal-light":'{"name": "Minimal Light", "tokens": {"--bg": "#ffffff", "--text": "#1a1a1a", "--panel": "#f8f9fa", "--border": "#e5e7eb", "--muted": "#6b7280", "--accent": "#3b82f6", "--accent-fg": "#ffffff", "--task-todo": "#9ca3af", "--task-progress": "#3b82f6", "--task-urgent": "#ef4444", "--task-question": "#f59e0b", "--task-completed": "#10b981", "--task-cancelled": "#9ca3af", "--task-delegated": "#8b5cf6", "--danger": "#ef4444", "--success": "#10b981", "--warning": "#f59e0b", "--info": "#3b82f6", "--editor-placeholder": "#9ca3af"}}',"neon-dark":'{"name": "Neon Dark", "tokens": {"--bg": "#0a0a0f", "--text": "#e2e8f0", "--panel": "#1a1a2e", "--border": "#16213e", "--muted": "#64748b", "--accent": "#00d4ff", "--accent-fg": "#0a0a0f", "--task-todo": "#64748b", "--task-progress": "#00d4ff", "--task-urgent": "#ff0080", "--task-question": "#ffea00", "--task-completed": "#00ff88", "--task-cancelled": "#64748b", "--task-delegated": "#8000ff", "--danger": "#ff0080", "--success": "#00ff88", "--warning": "#ffea00", "--info": "#00d4ff", "--editor-placeholder": "#64748b"}}'},we=!1;try{let t=typeof window<"u"?window:void 0;we=!!(t&&(t.__TAURI_INTERNALS__&&typeof t.__TAURI_INTERNALS__.invoke=="function"||t.__TAURI_METADATA__||typeof navigator<"u"&&navigator.userAgent&&navigator.userAgent.includes("Tauri")))}catch{}var Yy,Qy,Ky,Xy,eb,tb,rb,ju=!1;async function Er(){if(ju)return;let t=typeof process<"u"&&process.env.NODE_ENV==="test";if(we||t)try{({join:Yy,appDataDir:tb}=await Promise.resolve().then(()=>(Ln(),Xa))),{exists:Qy,readDir:Ky,readTextFile:Xy,writeTextFile:eb,mkdir:rb}=await Promise.resolve().then(()=>(Ns(),Ls)),ju=!0,t&&(we=!0)}catch{t||(we=!1)}}function nb(t){if(typeof t!="string")return t;if(t=t.trim(),t.startsWith("#")){let e=t.replace("#","");if(!/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(e))return console.warn(`Invalid hex color: ${t}`),t;let r=e.length===3?e.split("").map(o=>o+o).join(""):e,a=parseInt(r,16);return`${a>>16&255} ${a>>8&255} ${a&255}`}return t}async function ab(t){if(!t||typeof t!="object"){console.warn("applyTokens called with invalid tokens:",t);return}let e=document.documentElement,r={};for(let[a,o]of Object.entries(t)){if(a.startsWith("--app-")){let i=a.replace("--app-","--");r[i]=o}r[a]=o}for(let a of Jy){let o=r[a];if(o){let i=nb(o);e.style.setProperty(a,i)}else e.style.removeProperty(a)}if(we)try{let{invoke:a}=await Promise.resolve().then(()=>(ot(),As)),{getCurrentWindow:o}=await Promise.resolve().then(()=>(Nu(),Lu)),i=r["--bg"]||"15 23 42",c=document.documentElement.classList.contains("dark")||window.matchMedia("(prefers-color-scheme: dark)").matches;await a("sync_window_theme",{isDark:c,bgColor:i})}catch(a){console.debug("Window theme sync not available:",a)}}async function ob(t){try{await Dn("theme:apply",t)}catch{try{window.dispatchEvent(new CustomEvent("theme:apply",{detail:t}))}catch{}}}async function Hn(t){if(!t)return null;if(await Er(),Ks[t])try{return JSON.parse(Ks[t])}catch(e){console.error(`Failed to parse built-in theme ${t}:`,e)}if(we)try{return await Ar(),{tokens:await vt("get_theme_tokens",{themeId:t})}}catch(e){console.error(`Failed to load theme ${t} from backend:`,e)}return null}async function Fu(){let t=new Map;for(let e of Zy)try{let r=JSON.parse(Ks[e]);t.set(e,{id:e,name:r.name})}catch{t.set(e,{id:e,name:e})}if(we)try{let e=await sb();for(let r of e){let a=r.name.toLowerCase().replace(/[^a-z0-9_-]/g,"_");t.set(a,{id:a,name:r.name})}}catch(e){console.error("Failed to load custom themes:",e)}return Array.from(t.values())}async function Wu(){return{theme:(await Bs()).theme||null}}async function Bu(t){try{await pu({theme:t})}catch{return}let r=(await Hn(t))?.tokens||Mu;r={...Mu,...r},await ab(r),await ob({tokens:r,visuals:{theme:t}})}var vt;async function Ar(){vt||we&&(vt=(await Promise.resolve().then(()=>(ot(),As))).invoke)}async function qu(t,e=!1){if(await Er(),await Ar(),!we)throw new Error("Theme import only available in desktop app");return await vt("import_theme_file",{filePath:t,overwrite:e})}async function Uu(t){if(await Er(),await Ar(),!we)throw new Error("Theme validation only available in desktop app");return await vt("validate_theme_file",{filePath:t})}async function zu(t,e){if(await Er(),await Ar(),!we)throw new Error("Theme export only available in desktop app");await vt("export_theme",{themeId:t,exportPath:e})}async function Hu(t){if(await Er(),await Ar(),!we)throw new Error("Theme deletion only available in desktop app");await vt("delete_custom_theme",{themeId:t})}async function sb(){return await Er(),await Ar(),we?await vt("list_custom_themes"):[]}async function Xs(t,e){if(await Er(),await Ar(),!we)throw new Error("Theme saving only available in desktop app");await vt("save_theme_tokens",{themeId:t,tokens:e})}var cb={"--bg":"Background color (hex or RGB)","--text":"Primary text color","--panel":"Panel/sidebar background","--border":"Border color","--muted":"Muted/secondary text","--accent":"Accent/highlight color","--accent-fg":"Foreground color for accent (text on accent background)","--tab-active":"Active tab background","--task-todo":"Todo task color","--task-progress":"In-progress task color","--task-urgent":"Urgent task color","--task-question":"Question task color","--task-completed":"Completed task color","--task-cancelled":"Cancelled task color","--task-delegated":"Delegated task color","--danger":"Danger/error color","--success":"Success color","--warning":"Warning color","--info":"Info color","--editor-placeholder":"Editor placeholder text color"};async function lb(){try{let t=await Fu();return{themes:t,count:t.length,builtIn:["dracula","nord","one-dark-pro","minimal-light","neon-dark"]}}catch(t){throw new Error(`Failed to list themes: ${t.message}`)}}async function ub(t){try{let e=await Hn(t);if(!e)throw new Error(`Theme "${t}" not found`);return{id:t,name:e.name||t,tokens:e.tokens,tokenDescriptions:cb}}catch(e){throw new Error(`Failed to get theme: ${e.message}`)}}async function db(t,e){if(!t||typeof t!="string")throw new Error("Theme name is required");if(!e||typeof e!="object")throw new Error("Theme tokens object is required");let a=["--bg","--text","--panel","--border","--muted","--accent","--accent-fg"].filter(i=>!e[i]);if(a.length>0)throw new Error(`Missing required tokens: ${a.join(", ")}`);for(let[i,c]of Object.entries(e)){if(typeof c!="string")throw new Error(`Invalid token value for ${i}: must be a string`);let u=/^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/.test(c.trim()),f=/^\d+\s+\d+\s+\d+$/.test(c.trim());if(!u&&!f)throw new Error(`Invalid color format for ${i}: "${c}". Use hex (#282a36) or RGB (40 42 54)`)}let o=t.toLowerCase().replace(/[^a-z0-9_-]/g,"_");try{return await Xs(o,e),{id:o,name:t,tokens:e,message:`Theme "${t}" created successfully`}}catch(i){throw new Error(`Failed to create theme: ${i.message}`)}}async function fb(t,e){if(!t||typeof t!="string")throw new Error("Theme ID is required");if(!e||typeof e!="object")throw new Error("Theme tokens object is required");let r=await Hn(t);if(!r)throw new Error(`Theme "${t}" not found`);let a={...r.tokens,...e};try{return await Xs(t,a),{id:t,tokens:a,message:`Theme "${t}" updated successfully`}}catch(o){throw new Error(`Failed to update theme: ${o.message}`)}}async function pb(t){if(!t||typeof t!="string")throw new Error("Theme ID is required");if(["dracula","nord","one-dark-pro","minimal-light","neon-dark"].includes(t))throw new Error(`Cannot delete built-in theme "${t}"`);try{return await Hu(t),{id:t,message:`Theme "${t}" deleted successfully`}}catch(r){throw new Error(`Failed to delete theme: ${r.message}`)}}async function hb(t){if(!t||typeof t!="string")throw new Error("Theme ID is required");try{return await Bu(t),{id:t,message:`Theme "${t}" applied successfully`}}catch(e){throw new Error(`Failed to apply theme: ${e.message}`)}}async function mb(t,e){if(!t||typeof t!="string")throw new Error("Theme ID is required");if(!e||typeof e!="string")throw new Error("Export path is required");try{return await zu(t,e),{id:t,path:e,message:`Theme "${t}" exported to ${e}`}}catch(r){throw new Error(`Failed to export theme: ${r.message}`)}}async function gb(t,e=!1){if(!t||typeof t!="string")throw new Error("File path is required");try{let r=await Uu(t);if(!r.valid)throw new Error(`Invalid theme file: ${r.error}`);let a=await qu(t,e);return{id:a,path:t,message:`Theme imported successfully as "${a}"`}}catch(r){throw new Error(`Failed to import theme: ${r.message}`)}}async function yb(){try{let e=(await Wu()).theme;if(!e)return{id:null,message:"No theme currently active"};let r=await Hn(e);return{id:e,name:r?.name||e,tokens:r?.tokens||{}}}catch(t){throw new Error(`Failed to get current theme: ${t.message}`)}}var ei=[{name:"list_themes",description:"List all available themes (built-in and custom)",inputSchema:{type:"object",properties:{},required:[]}},{name:"get_theme",description:"Get details of a specific theme including all token values",inputSchema:{type:"object",properties:{themeId:{type:"string",description:"Theme ID (e.g., 'dracula', 'nord', 'my-custom-theme')"}},required:["themeId"]}},{name:"create_theme",description:"Create a new custom theme with specified colors. Supports hex (#282a36) or RGB (40 42 54) format.",inputSchema:{type:"object",properties:{name:{type:"string",description:"Theme name (will be converted to safe ID)"},tokens:{type:"object",description:"Theme color tokens. Required: --bg, --text, --panel, --border, --muted, --accent, --accent-fg. Optional: --tab-active, --task-*, --danger, --success, --warning, --info, --editor-placeholder",properties:{"--bg":{type:"string",description:"Background color"},"--text":{type:"string",description:"Primary text color"},"--panel":{type:"string",description:"Panel background"},"--border":{type:"string",description:"Border color"},"--muted":{type:"string",description:"Muted text"},"--accent":{type:"string",description:"Accent color"},"--accent-fg":{type:"string",description:"Accent foreground"},"--tab-active":{type:"string",description:"Active tab background"},"--task-todo":{type:"string",description:"Todo task color"},"--task-progress":{type:"string",description:"In-progress task color"},"--task-urgent":{type:"string",description:"Urgent task color"},"--task-question":{type:"string",description:"Question task color"},"--task-completed":{type:"string",description:"Completed task color"},"--task-cancelled":{type:"string",description:"Cancelled task color"},"--task-delegated":{type:"string",description:"Delegated task color"},"--danger":{type:"string",description:"Danger/error color"},"--success":{type:"string",description:"Success color"},"--warning":{type:"string",description:"Warning color"},"--info":{type:"string",description:"Info color"},"--editor-placeholder":{type:"string",description:"Editor placeholder color"}},required:["--bg","--text","--panel","--border","--muted","--accent","--accent-fg"]}},required:["name","tokens"]}},{name:"update_theme",description:"Update an existing theme's tokens (partial updates allowed)",inputSchema:{type:"object",properties:{themeId:{type:"string",description:"Theme ID to update"},tokens:{type:"object",description:"Token values to update (only changed tokens needed)"}},required:["themeId","tokens"]}},{name:"delete_theme",description:"Delete a custom theme (cannot delete built-in themes)",inputSchema:{type:"object",properties:{themeId:{type:"string",description:"Theme ID to delete"}},required:["themeId"]}},{name:"apply_theme",description:"Apply a theme to the application",inputSchema:{type:"object",properties:{themeId:{type:"string",description:"Theme ID to apply"}},required:["themeId"]}},{name:"get_current_theme",description:"Get the currently active theme",inputSchema:{type:"object",properties:{},required:[]}},{name:"export_theme",description:"Export a theme to a JSON file",inputSchema:{type:"object",properties:{themeId:{type:"string",description:"Theme ID to export"},exportPath:{type:"string",description:"Full path where to save the theme file"}},required:["themeId","exportPath"]}},{name:"import_theme",description:"Import a theme from a JSON file",inputSchema:{type:"object",properties:{filePath:{type:"string",description:"Path to theme JSON file"},overwrite:{type:"boolean",description:"Overwrite existing theme if it exists",default:!1}},required:["filePath"]}}];async function Vu(t,e){switch(t){case"list_themes":return await lb();case"get_theme":return await ub(e.themeId);case"create_theme":return await db(e.name,e.tokens);case"update_theme":return await fb(e.themeId,e.tokens);case"delete_theme":return await pb(e.themeId);case"apply_theme":return await hb(e.themeId);case"get_current_theme":return await yb();case"export_theme":return await mb(e.themeId,e.exportPath);case"import_theme":return await gb(e.filePath,e.overwrite);default:throw new Error(`Unknown theme tool: ${t}`)}}var Gu=[{uri:"lokus://markdown-syntax/overview",name:"Lokus Markdown Syntax Overview",description:"Complete guide to all supported markdown syntax in Lokus",mimeType:"text/markdown"},{uri:"lokus://markdown-syntax/callouts",name:"Callout Syntax",description:"How to create callouts/admonitions in Lokus",mimeType:"text/markdown"},{uri:"lokus://markdown-syntax/images",name:"Image Embedding Syntax",description:"How to embed images in Lokus notes",mimeType:"text/markdown"},{uri:"lokus://markdown-syntax/wiki-links",name:"Wiki Link Syntax",description:"How to create wiki-style links and embeds",mimeType:"text/markdown"},{uri:"lokus://markdown-syntax/math",name:"Math Equations (LaTeX/KaTeX)",description:"How to write inline and block math equations using LaTeX syntax",mimeType:"text/markdown"},{uri:"lokus://markdown-syntax/tables",name:"Tables",description:"How to create and format markdown tables",mimeType:"text/markdown"},{uri:"lokus://markdown-syntax/code",name:"Code Blocks",description:"How to add inline code and code blocks with syntax highlighting",mimeType:"text/markdown"},{uri:"lokus://markdown-syntax/lists",name:"Lists and Tasks",description:"How to create ordered lists, unordered lists, and task lists",mimeType:"text/markdown"},{uri:"lokus://markdown-syntax/formatting",name:"Text Formatting",description:"Bold, italic, strikethrough, highlights, superscript, subscript",mimeType:"text/markdown"},{uri:"lokus://markdown-syntax/diagrams",name:"Mermaid Diagrams",description:"How to create flowcharts, sequence diagrams, and more with Mermaid",mimeType:"text/markdown"}];async function Ju(t){switch(t){case"lokus://markdown-syntax/overview":return bb();case"lokus://markdown-syntax/callouts":return wb();case"lokus://markdown-syntax/images":return _b();case"lokus://markdown-syntax/wiki-links":return Sb();case"lokus://markdown-syntax/math":return kb();case"lokus://markdown-syntax/tables":return xb();case"lokus://markdown-syntax/code":return vb();case"lokus://markdown-syntax/lists":return Tb();case"lokus://markdown-syntax/formatting":return Cb();case"lokus://markdown-syntax/diagrams":return Rb();default:throw new Error(`Unknown markdown syntax resource: ${t}`)}}function bb(){return{contents:[{uri:"lokus://markdown-syntax/overview",mimeType:"text/markdown",text:`# Lokus Markdown Syntax Guide

Lokus supports extended markdown with special features for note-taking and knowledge management.

## Basic Markdown

All standard markdown is supported:
- **Bold** with \`**text**\` or \`__text__\`
- *Italic* with \`*text*\` or \`_text_\`
- \`inline code\` with backticks
- Links: \`[text](url)\`
- Images: \`![alt](url)\`
- Headings: \`# H1\`, \`## H2\`, etc.
- Lists (ordered and unordered)
- Tables
- Blockquotes: \`> quote\`
- Code blocks with \`\`\`language\`\`\`

## Extended Features

### 1. Callouts/Admonitions
Create colored, collapsible callouts:
\`\`\`
>[!note] Optional Title
Content goes here

>[!warning] Be Careful
Important warning message

>[!tip]- Collapsed by default
This callout starts collapsed (note the dash)
\`\`\`

**Available types:** note, tip, warning, danger, info, success, question, example

### 2. Wiki Links
Link to other notes:
\`\`\`
[[Note Name]]
[[Note Name|Display Text]]
[[Note Name#Heading]]
[[Note Name^blockid]]
\`\`\`

### 3. Image Embeds
Embed images using wiki-style syntax:
\`\`\`
![[image.png]]
![[folder/image.jpg]]
![[image.png|Custom Alt Text]]
\`\`\`

Also supports standard markdown:
\`\`\`
![alt text](path/to/image.png)
![alt text](https://example.com/image.jpg)
\`\`\`

### 4. Block Embeds
Embed content from other notes:
\`\`\`
![[Note Name^blockid]]
\`\`\`

### 5. Math Equations
Inline: \`$E = mc^2$\`
Block:
\`\`\`
$$
\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$
\`\`\`

### 6. Task Lists
\`\`\`
- [ ] Incomplete task
- [x] Completed task
\`\`\`

### 7. Highlights
\`==highlighted text==\`

### 8. Strikethrough
\`~~strikethrough text~~\`

### 9. Superscript & Subscript
- Superscript: \`H^2^O\` renders as H\xB2O
- Subscript: \`H~2~O\` renders as H\u2082O

### 10. Mermaid Diagrams
\`\`\`mermaid
graph TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\`

## Best Practices

1. **Always use proper syntax** - Don't mix formats
2. **For images**, prefer wiki-style \`![[image.png]]\` for local files
3. **For callouts**, always include the type: \`>[!type]\`
4. **For wiki links**, use \`[[Note Name]]\` not \`[Note Name]\`
5. **For math**, use \`$inline$\` or \`$$block$$\` delimiters

## Common Mistakes

\u274C **Wrong:**
- \`> [!note]\` (space after >)
- \`[[!image.png]]\` (using [[ for images without !)
- \`[!note]\` (missing >)
- Standard link syntax for local files: \`[text](file.md)\`

\u2705 **Correct:**
- \`>[!note]\` (no space)
- \`![[image.png]]\` (! before [[)
- \`>[!note]\` (> before [)
- Wiki link syntax: \`[[Note Name]]\`
`}]}}function wb(){return{contents:[{uri:"lokus://markdown-syntax/callouts",mimeType:"text/markdown",text:`# Callout/Admonition Syntax

## Basic Syntax

\`\`\`
>[!type] Optional Title
Content goes here on the next lines.
Can be multiple paragraphs.
\`\`\`

**IMPORTANT:** No space between \`>\` and \`[!\`

## Available Types

- \`>[!note]\` - Blue, informational (default)
- \`>[!tip]\` - Green, helpful tips
- \`>[!warning]\` - Orange, caution/warnings
- \`>[!danger]\` - Red, critical warnings
- \`>[!info]\` - Cyan, general information
- \`>[!success]\` - Green, success messages
- \`>[!question]\` - Purple, questions/help
- \`>[!example]\` - Gray, examples

## Collapsible Callouts

Add a dash \`-\` after the type to make it collapsible and start collapsed:

\`\`\`
>[!tip]- Click to expand
This content starts hidden
\`\`\`

Without dash, callouts are expanded by default:

\`\`\`
>[!tip] Always visible
This is always shown
\`\`\`

## Custom Titles

\`\`\`
>[!warning] Custom Warning Title
Your content here
\`\`\`

If no title is provided, the type name is used:

\`\`\`
>[!warning]
This will show "Warning" as the title
\`\`\`

## Nested Content

Callouts can contain any markdown:

\`\`\`
>[!note] Advanced Example
This callout contains:

- Bullet points
- **Bold text**
- \`code\`

\`\`\`code
Code blocks
\`\`\`

And even [[Wiki Links]]
\`\`\`

## Common Mistakes

\u274C **Wrong:**
- \`> [!note]\` - Space after >
- \`[!note]\` - Missing >
- \`> [! note]\` - Spaces in tag
- \`>[note]\` - Missing !

\u2705 **Correct:**
- \`>[!note]\` - Proper syntax
`}]}}function _b(){return{contents:[{uri:"lokus://markdown-syntax/images",mimeType:"text/markdown",text:`# Image Embedding Syntax

## Wiki-Style Images (Recommended for Local Files)

\`\`\`
![[image.png]]
![[folder/subfolder/image.jpg]]
![[image.png|Custom Alt Text]]
\`\`\`

**Supported formats:** PNG, JPG, JPEG, GIF, SVG, WebP

## Standard Markdown Images

\`\`\`
![alt text](image.png)
![alt text](folder/image.jpg)
![alt text](https://example.com/image.jpg)
\`\`\`

## Syntax Comparison

| Style | Syntax | Use Case |
|-------|--------|----------|
| Wiki | \`![[image.png]]\` | Local workspace images |
| Wiki with alt | \`![[image.png\\|Alt Text]]\` | Local with custom alt |
| Markdown | \`![alt](image.png)\` | Standard markdown |
| Markdown URL | \`![alt](https://...)\` | External images |

## Path Resolution

Images are resolved relative to:
1. Current note's directory
2. Workspace root
3. Attachments folder (if configured)

## Best Practices

\u2705 **Do:**
- Use \`![[image.png]]\` for local workspace images
- Place images in descriptive folders: \`assets/\`, \`images/\`, etc.
- Use descriptive filenames: \`diagram-architecture.png\`
- Provide alt text for accessibility

\u274C **Don't:**
- Use \`[[!image.png]]\` - Wrong! The \`!\` goes BEFORE \`[[\`
- Use absolute system paths: \`/Users/name/image.png\`
- Use spaces in filenames (use hyphens: \`my-image.png\`)

## Examples

**Basic image:**
\`\`\`
![[screenshot.png]]
\`\`\`

**Image in folder:**
\`\`\`
![[diagrams/architecture.png]]
\`\`\`

**With alt text:**
\`\`\`
![[diagram.png|System Architecture Diagram]]
\`\`\`

**External image:**
\`\`\`
![Logo](https://example.com/logo.png)
\`\`\`

## Common Mistakes

\u274C **Wrong:**
- \`[[!image.png]]\` - ! is in wrong position
- \`[!image.png]\` - Missing one bracket
- \`![[image]]\` - Missing file extension
- \`![[image .png]]\` - Space in filename

\u2705 **Correct:**
- \`![[image.png]]\` - Proper wiki-style
- \`![alt](image.png)\` - Standard markdown
`}]}}function Sb(){return{contents:[{uri:"lokus://markdown-syntax/wiki-links",mimeType:"text/markdown",text:`# Wiki Link Syntax

Wiki-style links connect notes and enable bidirectional linking in your knowledge base.

## Basic Links

Link to another note:

\`\`\`
[[Note Name]]
[[Note Name|Custom Display Text]]
\`\`\`

Examples:
\`\`\`
[[Project Ideas]]
[[Meeting Notes 2024-01-15]]
[[JavaScript Guide|JS Guide]]
\`\`\`

## Heading Links

Link to specific sections within notes using \`#\`:

\`\`\`
[[Note Name#Heading]]
[[Note Name#Heading|Custom Text]]
\`\`\`

Examples:
\`\`\`
[[Documentation#Installation]]
[[API Reference#Authentication|Auth docs]]
[[Project Plan#Phase 2]]
\`\`\`

**How it works:**
- \`#\` links to a heading (# Heading, ## Heading, etc.)
- Case-insensitive heading matching
- Spaces in heading names work automatically

## Block References (Block IDs)

Link to specific blocks/paragraphs within notes using \`^\`:

\`\`\`
[[Note Name^blockid]]
[[Note Name^blockid|Custom Text]]
\`\`\`

### What are Block IDs?

Block IDs let you reference specific paragraphs, list items, or blocks of content. Each block can have a unique identifier.

### Creating Block IDs

Add \`^blockid\` at the END of any block:

\`\`\`
This is a paragraph with a block ID. ^intro-para

- This is a list item ^list-item-1
- Another list item ^list-item-2

> This is a quote block ^important-quote
\`\`\`

**Block ID Rules:**
- Use lowercase letters, numbers, hyphens, underscores
- No spaces allowed
- Must be unique within the note
- Format: \`^block-id-name\`

### Linking to Blocks

Reference the block from another note:

\`\`\`
See the introduction: [[Project Notes^intro-para]]
Check out [[Meeting Notes^action-items]]
Reference [[Research^key-finding-1|this finding]]
\`\`\`

### Examples

**In source note (Research.md):**
\`\`\`
# Research Findings

Our study found significant results. ^key-finding

## Methodology
We used a double-blind approach. ^methodology

- Sample size: 1000 participants ^sample-size
- Duration: 6 months ^duration
\`\`\`

**In another note:**
\`\`\`
According to [[Research^key-finding]], the results were significant.
The [[Research^methodology|study methodology]] was rigorous.
With [[Research^sample-size|1000 participants]], the data is reliable.
\`\`\`

## Block Embeds

Embed actual content from blocks using \`!\`:

\`\`\`
![[Note Name^blockid]]
\`\`\`

**Difference:**
- \`[[Note^block]]\` - Creates a LINK to the block
- \`![[Note^block]]\` - EMBEDS the block content inline

### Embed Examples

**Source note (Quotes.md):**
\`\`\`
> "The only way to do great work is to love what you do." - Steve Jobs ^jobs-quote

The key to success is persistence. ^success-key
\`\`\`

**In another note:**
\`\`\`
# Daily Inspiration

![[Quotes^jobs-quote]]

Remember: ![[Quotes^success-key]]
\`\`\`

Result: The actual content will be displayed inline, not just a link.

## Image Embeds

Embed images from your workspace:

\`\`\`
![[image.png]]
![[folder/subfolder/diagram.jpg]]
![[screenshot.png|Custom Alt Text]]
\`\`\`

**Supported formats:** PNG, JPG, JPEG, GIF, SVG, WebP

Examples:
\`\`\`
![[architecture-diagram.png]]
![[Screenshots/bug-report.png]]
![[logo.svg|Company Logo]]
\`\`\`

## Syntax Summary

| Syntax | Purpose | Example |
|--------|---------|---------|
| \`[[Note]]\` | Link to note | \`[[Meeting Notes]]\` |
| \`[[Note\\|Text]]\` | Link with custom text | \`[[API Docs\\|Documentation]]\` |
| \`[[Note#Heading]]\` | Link to section | \`[[Guide#Installation]]\` |
| \`[[Note^block]]\` | Link to block | \`[[Research^finding-1]]\` |
| \`![[Note^block]]\` | Embed block content | \`![[Quotes^quote-1]]\` |
| \`![[image.png]]\` | Embed image | \`![[diagram.png]]\` |

## Path Resolution

Lokus resolves links intelligently:

1. **By filename** - \`[[Note]]\` finds \`Note.md\`
2. **By path** - \`[[folder/Note]]\` finds specific location
3. **Same folder** - Prefers notes in current folder
4. **Workspace root** - Falls back to workspace search
5. **Case-insensitive** - \`[[note]]\` matches \`Note.md\`

## Best Practices

\u2705 **Do:**
- Use \`[[Note Name]]\` for internal note links
- Use \`|alt text\` for descriptive link text
- Use \`#heading\` to link to specific sections
- Use \`^blockid\` for paragraph-level references
- Use \`![[Note^block]]\` to embed reusable content
- Keep block IDs descriptive: \`^key-finding\` not \`^1\`

\u274C **Don't:**
- Use \`[Note Name]\` - Need TWO brackets
- Use \`[[Note.md]]\` - Omit file extension
- Use spaces in block IDs: \`^my block\` (wrong)
- Use special characters in block IDs: \`^block!@#\` (wrong)
- Mix wiki and markdown link syntax

## Common Use Cases

**Research notes:**
\`\`\`
Key findings: [[Study 2024^results]]
See methodology: [[Study 2024#Methods]]
Full report: [[Study 2024]]
\`\`\`

**Meeting notes:**
\`\`\`
Action items from last meeting: ![[Meeting 2024-01-15^action-items]]
Decision made: [[Meeting 2024-01-15^decision-architecture]]
\`\`\`

**Documentation:**
\`\`\`
Setup guide: [[Installation#Prerequisites]]
API endpoint: [[API Reference#Authentication]]
Example: ![[Examples^basic-usage]]
\`\`\`

**Knowledge base:**
\`\`\`
Related concept: [[Machine Learning]]
See definition: [[Glossary^neural-network]]
Visual diagram: ![[diagrams/architecture.png]]
\`\`\`

## Heading vs Block Reference

**When to use \`#heading\`:**
- Link to entire sections
- Section has a heading
- Content under heading may change
- Example: \`[[Guide#Installation]]\`

**When to use \`^blockid\`:**
- Link to specific paragraph/quote
- Need stable reference to exact content
- Want to embed specific block
- Example: \`[[Research^key-finding]]\`
`}]}}function kb(){return{contents:[{uri:"lokus://markdown-syntax/math",mimeType:"text/markdown",text:`# Math Equations (LaTeX/KaTeX)

Lokus supports LaTeX math equations using KaTeX renderer.

## Inline Math

Use single dollar signs \`$\` for inline equations:

\`\`\`
The equation $E = mc^2$ represents energy-mass equivalence.
The quadratic formula is $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$.
\`\`\`

**IMPORTANT:** No spaces after opening \`$\` or before closing \`$\`

## Block Math

Use double dollar signs \`$$\` for block equations:

\`\`\`
$$
E = mc^2
$$

$$
\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

$$
\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$
\`\`\`

## Common Syntax

### Fractions
\`\`\`
$\\frac{a}{b}$ - Simple fraction
$\\frac{\\partial f}{\\partial x}$ - Partial derivative
\`\`\`

### Superscripts & Subscripts
\`\`\`
$x^2$ - Superscript
$x_i$ - Subscript
$x^{2y}$ - Multiple characters (use braces)
$x_{i,j}$ - Multiple subscript characters
\`\`\`

### Square Roots
\`\`\`
$\\sqrt{x}$ - Square root
$\\sqrt[3]{x}$ - Cube root
$\\sqrt{x^2 + y^2}$ - Complex expression
\`\`\`

### Sums & Products
\`\`\`
$\\sum_{i=1}^{n} x_i$ - Summation
$\\prod_{i=1}^{n} x_i$ - Product
$\\int_{a}^{b} f(x) dx$ - Integral
\`\`\`

### Greek Letters
\`\`\`
$\\alpha, \\beta, \\gamma, \\delta$ - Lowercase
$\\Alpha, \\Beta, \\Gamma, \\Delta$ - Uppercase
$\\pi, \\theta, \\lambda, \\omega$ - Common symbols
\`\`\`

### Matrices
\`\`\`
$$
\\begin{bmatrix}
a & b \\\\
c & d
\\end{bmatrix}
$$

$$
\\begin{pmatrix}
1 & 2 & 3 \\\\
4 & 5 & 6
\\end{pmatrix}
$$
\`\`\`

### Special Symbols
\`\`\`
$\\infty$ - Infinity
$\\pm$ - Plus-minus
$\\times$ - Multiplication
$\\div$ - Division
$\\neq$ - Not equal
$\\leq, \\geq$ - Less/greater than or equal
$\\approx$ - Approximately
$\\in$ - Element of
$\\subset$ - Subset
$\\cup, \\cap$ - Union, intersection
\`\`\`

### Calculus
\`\`\`
$\\frac{d}{dx}$ - Derivative
$\\frac{\\partial}{\\partial x}$ - Partial derivative
$\\int$ - Integral
$\\oint$ - Contour integral
$\\lim_{x \\to \\infty}$ - Limit
\`\`\`

### Logic & Sets
\`\`\`
$\\forall$ - For all
$\\exists$ - There exists
$\\in$ - Element of
$\\emptyset$ - Empty set
$\\mathbb{R}$ - Real numbers
$\\mathbb{N}$ - Natural numbers
$\\mathbb{Z}$ - Integers
\`\`\`

## Common Equations Examples

**Physics:**
\`\`\`
$E = mc^2$
$F = ma$
$v = v_0 + at$
$s = ut + \\frac{1}{2}at^2$
\`\`\`

**Chemistry:**
\`\`\`
$H_2O$
$CO_2$
$C_6H_{12}O_6$
\`\`\`

**Statistics:**
\`\`\`
$\\mu = \\frac{1}{n}\\sum_{i=1}^{n} x_i$ - Mean
$\\sigma = \\sqrt{\\frac{1}{n}\\sum_{i=1}^{n}(x_i - \\mu)^2}$ - Standard deviation
\`\`\`

**Calculus:**
\`\`\`
$$
\\frac{d}{dx}(x^n) = nx^{n-1}
$$

$$
\\int x^n dx = \\frac{x^{n+1}}{n+1} + C
$$
\`\`\`

## Common Mistakes

\u274C **Wrong:**
- \`$ E=mc^2$\` - Space before closing $
- \`$E=mc^2 $\` - Space before closing $
- \`$E = mc^2\` - Missing closing $
- \`E = mc^2$\` - Missing opening $
- \`$$E = mc^2\` - Missing closing $$

\u2705 **Correct:**
- \`$E = mc^2$\` - Proper inline
- \`$$E = mc^2$$\` - Proper block (can be on separate lines)

## Block Math Formatting

Block math can be written on multiple lines:

\`\`\`
$$
\\begin{aligned}
E &= mc^2 \\\\
p &= mv \\\\
F &= ma
\\end{aligned}
$$
\`\`\`

## Best Practices

\u2705 **Do:**
- Use \`$\` for inline math (within text)
- Use \`$$\` for block math (standalone equations)
- Use \`{}\` braces to group multiple characters
- Use \`\\\\\\\\\` for line breaks in aligned equations
- Escape special characters with backslash

\u274C **Don't:**
- Add spaces after \`$\` or before \`$\`
- Forget closing delimiters
- Use \`\` for math (that's for code)
- Mix inline and block delimiters
`}]}}function xb(){return{contents:[{uri:"lokus://markdown-syntax/tables",mimeType:"text/markdown",text:`# Markdown Tables

## Basic Table

\`\`\`
| Header 1 | Header 2 | Header 3 |
| -------- | -------- | -------- |
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
\`\`\`

Renders as:

| Header 1 | Header 2 | Header 3 |
| -------- | -------- | -------- |
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |

## Alignment

Use colons to align columns:

\`\`\`
| Left Aligned | Center Aligned | Right Aligned |
| :----------- | :------------: | ------------: |
| Left         | Center         | Right         |
| Text         | Text           | Text          |
\`\`\`

- \`:---\` Left aligned
- \`:---:\` Center aligned
- \`---:\` Right aligned

## Formatting in Cells

Tables support inline formatting:

\`\`\`
| **Bold** | *Italic* | \`Code\` |
| -------- | -------- | -------- |
| **Text** | *Text*   | \`text\` |
\`\`\`

## Tips

\u2705 **Do:**
- Keep separator row (| --- | --- |)
- Align pipes for readability (optional)
- Use at least 3 hyphens in separator

\u274C **Don't:**
- Forget separator row
- Put spaces inside cells at edges (optional)
- Use newlines inside cells

## Examples

**Simple 2-column table:**
\`\`\`
| Name | Age |
| ---- | --- |
| John | 25  |
| Jane | 30  |
\`\`\`

**With alignment:**
\`\`\`
| Item     | Price   | Quantity |
| :------- | ------: | :------: |
| Apple    | $1.50   | 10       |
| Banana   | $0.75   | 20       |
\`\`\`
`}]}}function vb(){return{contents:[{uri:"lokus://markdown-syntax/code",mimeType:"text/markdown",text:'# Code Syntax\n\n## Inline Code\n\nUse single backticks for inline code:\n\n```\nUse the `console.log()` function to print.\nThe `Array.map()` method is useful.\n```\n\nResult: Use the `console.log()` function to print.\n\n## Code Blocks\n\nUse triple backticks for code blocks:\n\n\\`\\`\\`\nfunction hello() {\n  console.log("Hello World");\n}\n\\`\\`\\`\n\n## Syntax Highlighting\n\nAdd language identifier after opening backticks:\n\n\\`\\`\\`javascript\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}\n\\`\\`\\`\n\n\\`\\`\\`python\ndef greet(name):\n    return f"Hello, {name}!"\n\\`\\`\\`\n\n\\`\\`\\`rust\nfn greet(name: &str) -> String {\n    format!("Hello, {}!", name)\n}\n\\`\\`\\`\n\n## Supported Languages\n\nCommon languages with syntax highlighting:\n- **JavaScript/TypeScript**: `javascript`, `typescript`, `js`, `ts`\n- **Python**: `python`, `py`\n- **Rust**: `rust`, `rs`\n- **Java**: `java`\n- **C/C++**: `c`, `cpp`, `c++`\n- **Go**: `go`\n- **Ruby**: `ruby`, `rb`\n- **PHP**: `php`\n- **Shell**: `bash`, `sh`, `shell`\n- **HTML**: `html`\n- **CSS**: `css`, `scss`, `sass`\n- **SQL**: `sql`\n- **JSON**: `json`\n- **YAML**: `yaml`, `yml`\n- **Markdown**: `markdown`, `md`\n\n## Examples\n\n**JavaScript:**\n\\`\\`\\`javascript\nconst users = [\'Alice\', \'Bob\', \'Charlie\'];\nusers.map(name => `Hello, ${name}!`);\n\\`\\`\\`\n\n**Python:**\n\\`\\`\\`python\nusers = [\'Alice\', \'Bob\', \'Charlie\']\ngreetings = [f"Hello, {name}!" for name in users]\n\\`\\`\\`\n\n**JSON:**\n\\`\\`\\`json\n{\n  "name": "John Doe",\n  "age": 30,\n  "email": "john@example.com"\n}\n\\`\\`\\`\n\n## Tips\n\n\u2705 **Do:**\n- Use specific language identifier for syntax highlighting\n- Keep code properly indented\n- Close code blocks with triple backticks\n\n\u274C **Don\'t:**\n- Forget closing backticks\n- Use 4-space indentation (use triple backticks instead)\n- Nest backticks incorrectly\n'}]}}function Tb(){return{contents:[{uri:"lokus://markdown-syntax/lists",mimeType:"text/markdown",text:`# Lists and Tasks

## Unordered Lists

Use \`-\`, \`*\`, or \`+\` for bullet points:

\`\`\`
- Item 1
- Item 2
- Item 3
\`\`\`

Result:
- Item 1
- Item 2
- Item 3

## Ordered Lists

Use numbers followed by period:

\`\`\`
1. First item
2. Second item
3. Third item
\`\`\`

Result:
1. First item
2. Second item
3. Third item

## Nested Lists

Indent with 2-4 spaces:

\`\`\`
- Main item 1
  - Sub item 1.1
  - Sub item 1.2
    - Sub sub item 1.2.1
- Main item 2
  - Sub item 2.1
\`\`\`

Result:
- Main item 1
  - Sub item 1.1
  - Sub item 1.2
    - Sub sub item 1.2.1
- Main item 2
  - Sub item 2.1

## Task Lists (Checkboxes)

Use \`- [ ]\` for unchecked, \`- [x]\` for checked:

\`\`\`
- [ ] Incomplete task
- [x] Completed task
- [ ] Another incomplete task
- [x] Another completed task
\`\`\`

Result:
- [ ] Incomplete task
- [x] Completed task
- [ ] Another incomplete task
- [x] Another completed task

**IMPORTANT:** Space required after \`-\` and inside brackets!

## Mixed Lists

Combine ordered and unordered:

\`\`\`
1. First step
   - Sub-point A
   - Sub-point B
2. Second step
   - Sub-point A
   - Sub-point B
\`\`\`

## Task Lists with Nesting

\`\`\`
- [x] Project setup
  - [x] Initialize repository
  - [x] Install dependencies
- [ ] Development
  - [x] Create components
  - [ ] Write tests
  - [ ] Documentation
\`\`\`

## Tips

\u2705 **Do:**
- Use consistent markers (\`-\` or \`*\` or \`+\`)
- Add space after marker
- Indent nested items consistently
- For tasks: \`[ ]\` or \`[x]\` only

\u274C **Don't:**
- Mix markers in same list
- Forget space: \`-item\` (wrong), \`- item\` (correct)
- Use \`[X]\` (capital X) - use lowercase \`[x]\`
- Use other characters in brackets

## Examples

**Shopping list:**
\`\`\`
- [ ] Groceries
  - [x] Milk
  - [x] Bread
  - [ ] Eggs
- [ ] Hardware store
  - [ ] Screws
  - [ ] Paint
\`\`\`

**Project tasks:**
\`\`\`
1. [x] Planning phase
2. [x] Design phase
3. [ ] Development phase
   - [x] Backend API
   - [ ] Frontend UI
   - [ ] Testing
4. [ ] Deployment
\`\`\`
`}]}}function Cb(){return{contents:[{uri:"lokus://markdown-syntax/formatting",mimeType:"text/markdown",text:`# Text Formatting

## Bold

Use double asterisks or double underscores:

\`\`\`
**This is bold text**
__This is also bold__
\`\`\`

Result: **This is bold text**

## Italic

Use single asterisk or single underscore:

\`\`\`
*This is italic text*
_This is also italic_
\`\`\`

Result: *This is italic text*

## Bold + Italic

Combine both:

\`\`\`
***Bold and italic***
___Bold and italic___
**_Bold and italic_**
*__Bold and italic__*
\`\`\`

Result: ***Bold and italic***

## Strikethrough

Use double tildes:

\`\`\`
~~This text is crossed out~~
\`\`\`

Result: ~~This text is crossed out~~

## Highlight

Use double equals signs:

\`\`\`
==This text is highlighted==
\`\`\`

Result: ==This text is highlighted==

## Superscript

Use \`^\` with content between them:

\`\`\`
H^2^O
E = mc^2^
x^2^
\`\`\`

Result: H\xB2O, E = mc\xB2, x\xB2

## Subscript

Use \`~\` with content between them:

\`\`\`
H~2~O
CO~2~
x~i~
\`\`\`

Result: H\u2082O, CO\u2082, x\u1D62

## Combining Formats

You can combine multiple formats:

\`\`\`
**Bold with _italic inside_**
*Italic with **bold inside***
~~Strikethrough with **bold**~~
==Highlight with *italic*==
\`\`\`

## Blockquotes

Use \`>\` for quotes:

\`\`\`
> This is a quote
> It can span multiple lines
\`\`\`

Result:
> This is a quote
> It can span multiple lines

**Nested quotes:**
\`\`\`
> Level 1 quote
>> Level 2 quote
>>> Level 3 quote
\`\`\`

## Horizontal Rules

Use three or more hyphens, asterisks, or underscores:

\`\`\`
---
***
___
\`\`\`

Result:

---

## Line Breaks

Two spaces at end of line or backslash:

\`\`\`
Line 1  
Line 2

OR

Line 1\\
Line 2
\`\`\`

## Escape Characters

Use backslash to escape special characters:

\`\`\`
\\* Not a bullet point
\\** Not bold **
\\# Not a heading
\`\`\`

## Common Combinations

**Chemistry formulas:**
\`\`\`
H~2~O (water)
CO~2~ (carbon dioxide)
C~6~H~12~O~6~ (glucose)
\`\`\`

**Math expressions:**
\`\`\`
x^2^ + y^2^ = z^2^
a~n~ = a~1~ + (n-1)d
\`\`\`

**Emphasized text:**
\`\`\`
**Important:** This is ==critical== information!
*Note:* ~~Old info~~ Updated: **New info**
\`\`\`

## Tips

\u2705 **Do:**
- Use \`**bold**\` for strong emphasis
- Use \`*italic*\` for subtle emphasis
- Use \`==highlight==\` for important points
- Use \`~~strikethrough~~\` for deleted/outdated info

\u274C **Don't:**
- Use spaces: \`** bold **\` (wrong)
- Mix markers: \`*bold**\` (wrong)
- Forget closing markers
- Use \`<u>\` for underline (not supported)
`}]}}function Rb(){return{contents:[{uri:"lokus://markdown-syntax/diagrams",mimeType:"text/markdown",text:`# Mermaid Diagrams

Lokus supports Mermaid for creating diagrams using text.

## Flowcharts

\\\`\\\`\\\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
\\\`\\\`\\\`

**Direction options:**
- \`graph TD\` - Top to Down
- \`graph LR\` - Left to Right
- \`graph BT\` - Bottom to Top
- \`graph RL\` - Right to Left

## Sequence Diagrams

\\\`\\\`\\\`mermaid
sequenceDiagram
    participant User
    participant App
    participant Server
    
    User->>App: Click button
    App->>Server: Send request
    Server-->>App: Return data
    App-->>User: Display result
\\\`\\\`\\\`

## Class Diagrams

\\\`\\\`\\\`mermaid
classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }
    class Dog {
        +bark()
    }
    class Cat {
        +meow()
    }
    Animal <|-- Dog
    Animal <|-- Cat
\\\`\\\`\\\`

## State Diagrams

\\\`\\\`\\\`mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Processing
    Processing --> Success
    Processing --> Error
    Success --> [*]
    Error --> Idle
\\\`\\\`\\\`

## Gantt Charts

\\\`\\\`\\\`mermaid
gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    section Planning
    Task 1           :2024-01-01, 30d
    Task 2           :2024-02-01, 20d
    section Development
    Task 3           :2024-02-15, 45d
    Task 4           :2024-03-01, 30d
\\\`\\\`\\\`

## Pie Charts

\\\`\\\`\\\`mermaid
pie
    title Distribution
    "Category A" : 45
    "Category B" : 30
    "Category C" : 25
\\\`\\\`\\\`

## Entity Relationship Diagrams

\\\`\\\`\\\`mermaid
erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : "ordered in"
    
    USER {
        int id
        string name
        string email
    }
    ORDER {
        int id
        date order_date
    }
\\\`\\\`\\\`

## Node Shapes

Different shapes for flowchart nodes:

\\\`\\\`\\\`mermaid
graph LR
    A[Rectangle]
    B(Rounded)
    C([Stadium])
    D[[Subroutine]]
    E[(Database)]
    F((Circle))
    G>Flag]
    H{Diamond}
    I{{Hexagon}}
\\\`\\\`\\\`

## Arrow Types

Different connection styles:

\\\`\\\`\\\`mermaid
graph LR
    A --> B
    C --- D
    E -.-> F
    G ==> H
    I --text--> J
\\\`\\\`\\\`

- \`-->\` Solid arrow
- \`---\` Solid line
- \`-.->

\` Dotted arrow
- \`==>\` Thick arrow
- \`--text-->\` Labeled arrow

## Tips

\u2705 **Do:**
- Use \`\`\`mermaid\`\`\` code block
- Follow Mermaid syntax exactly
- Use meaningful labels
- Keep diagrams simple

\u274C **Don't:**
- Forget closing \`\`\`
- Use invalid Mermaid syntax
- Make diagrams too complex
- Mix diagram types in one block

## Common Use Cases

**Project workflow:**
\\\`\\\`\\\`mermaid
graph TD
    A[Start] --> B[Planning]
    B --> C[Design]
    C --> D[Development]
    D --> E[Testing]
    E --> F{Pass?}
    F -->|Yes| G[Deploy]
    F -->|No| D
    G --> H[End]
\\\`\\\`\\\`

**API interaction:**
\\\`\\\`\\\`mermaid
sequenceDiagram
    Client->>API: POST /login
    API->>Database: Verify credentials
    Database-->>API: User data
    API-->>Client: JWT token
\\\`\\\`\\\`
`}]}}var $r={defaultWorkspace:(0,Vn.join)((0,ao.homedir)(),"Documents","Lokus Workspace"),lokusConfigDir:(0,Vn.join)((0,ao.homedir)(),".lokus"),lastWorkspaceFile:(0,Vn.join)((0,ao.homedir)(),".lokus","last-workspace.json"),apiUrl:"http://127.0.0.1:3333",port:parseInt(process.argv[2])||3456},le={info:(...t)=>console.error("[MCP-HTTP]",...t),error:(...t)=>console.error("[MCP-HTTP ERROR]",...t),warn:(...t)=>console.error("[MCP-HTTP WARN]",...t)},ri=class{constructor(){this.currentWorkspace=null,this.apiAvailable=!1}async getWorkspace(){return this.currentWorkspace?this.currentWorkspace:(this.currentWorkspace=await this.getWorkspaceFromAPI(),this.currentWorkspace?(this.apiAvailable=!0,this.currentWorkspace):(this.currentWorkspace=await this.getLastWorkspace(),this.currentWorkspace?this.currentWorkspace:(this.currentWorkspace=await this.getDefaultWorkspace(),this.currentWorkspace)))}async getWorkspaceFromAPI(){try{let e=(await Promise.resolve().then(()=>(Va(),Nl))).default,r=await e(`${$r.apiUrl}/api/workspace`,{timeout:2e3});if(r.ok){let a=await r.json();if(a.success&&a.data)return a.data.workspace}}catch{}return null}async getLastWorkspace(){try{let e=await(0,Pr.readFile)($r.lastWorkspaceFile,"utf-8"),r=JSON.parse(e);if(r.workspace)return r.workspace}catch{}return null}async getDefaultWorkspace(){let e=$r.defaultWorkspace;try{await(0,Pr.access)(e,Yu.constants.F_OK)}catch{await(0,Pr.mkdir)(e,{recursive:!0}),await(0,Pr.mkdir)((0,Vn.join)(e,".lokus"),{recursive:!0})}return e}},Zu=new ri,ti=Qu.default.createServer(async(t,e)=>{if(e.setHeader("Access-Control-Allow-Origin","*"),e.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS"),e.setHeader("Access-Control-Allow-Headers","Content-Type"),t.method==="OPTIONS"){e.writeHead(200),e.end();return}if(t.method==="GET"&&t.url==="/health"){e.writeHead(200,{"Content-Type":"application/json"}),e.end(JSON.stringify({status:"healthy",service:"lokus-mcp-http"}));return}if(t.method==="GET"&&t.url==="/mcp/info"){e.writeHead(200,{"Content-Type":"application/json"}),e.end(JSON.stringify({name:"lokus-mcp-http",version:"1.0.0",transport:"http",tools:ni().length}));return}if(t.method==="POST"&&(t.url==="/mcp"||t.url==="/")){let r="";t.on("data",a=>{r+=a.toString()}),t.on("end",async()=>{try{let a=JSON.parse(r),o=await Eb(a);e.writeHead(200,{"Content-Type":"application/json"}),e.end(JSON.stringify(o))}catch(a){le.error("Request error:",a),e.writeHead(500,{"Content-Type":"application/json"}),e.end(JSON.stringify({jsonrpc:"2.0",error:{code:-32603,message:a.message},id:null}))}});return}e.writeHead(404,{"Content-Type":"application/json"}),e.end(JSON.stringify({error:"Not found"}))}),ni=()=>[...ws,...Ss,...ks,...xs,...vs,...Ts,...Cs,...Rs,...ei];async function Eb(t){let{method:e,params:r,id:a}=t;try{if(e==="initialize")return{jsonrpc:"2.0",result:{protocolVersion:"2024-11-05",capabilities:{tools:{},resources:{}},serverInfo:{name:"lokus-mcp-http",version:"1.0.0"}},id:a};if(e==="notifications/initialized")return le.info("Client initialized successfully"),{jsonrpc:"2.0",result:{},id:a};if(e==="tools/list")return{jsonrpc:"2.0",result:{tools:ni()},id:a};if(e==="tools/call"){let{name:o,arguments:i}=r,c=await Zu.getWorkspace(),u=Zu.apiAvailable?$r.apiUrl:null;le.info(`Executing tool: ${o}`);let f;if(ws.some(d=>d.name===o))f=await Bl(o,i,u);else if(Ss.some(d=>d.name===o))f=await Hl(o,i,c,u);else if(ks.some(d=>d.name===o))f=await Vl(o,i,c,u);else if(xs.some(d=>d.name===o))f=await Jl(o,i,c,u);else if(vs.some(d=>d.name===o))f=await Zl(o,i,c,u);else if(Ts.some(d=>d.name===o))f=await Yl(o,i,c,u);else if(Cs.some(d=>d.name===o))f=await Ql(o,i,c,u);else if(Rs.some(d=>d.name===o))f=await Kl(o,i,c,u);else if(ei.some(d=>d.name===o)){let d=await Vu(o,i);f={content:[{type:"text",text:JSON.stringify(d,null,2)}]}}else throw new Error(`Unknown tool: ${o}`);return{jsonrpc:"2.0",result:f,id:a}}if(e==="resources/list")return{jsonrpc:"2.0",result:{resources:Gu},id:a};if(e==="resources/read"){let{uri:o}=r;le.info(`Reading resource: ${o}`);try{return{jsonrpc:"2.0",result:await Ju(o),id:a}}catch(i){return{jsonrpc:"2.0",error:{code:-32603,message:i.message},id:a}}}return{jsonrpc:"2.0",error:{code:-32601,message:`Method not found: ${e}`},id:a}}catch(o){return le.error("Request failed:",o),{jsonrpc:"2.0",error:{code:-32603,message:o.message},id:a}}}async function Ab(){try{ti.listen($r.port,"127.0.0.1",()=>{le.info("==========================================="),le.info("Lokus MCP HTTP Server v1.0 started"),le.info(`Port: ${$r.port}`),le.info(`URL: http://127.0.0.1:${$r.port}/mcp`),le.info(`Tools: ${ni().length}`),le.info("===========================================")}),process.on("SIGTERM",()=>{le.info("SIGTERM received, closing server..."),ti.close(()=>{le.info("Server closed"),process.exit(0)})}),process.on("SIGINT",()=>{le.info("SIGINT received, closing server..."),ti.close(()=>{le.info("Server closed"),process.exit(0)})})}catch(t){le.error("Fatal error:",t),process.exit(1)}}Ab();
/*! Bundled license information:

web-streams-polyfill/dist/ponyfill.es2018.js:
  (**
   * @license
   * web-streams-polyfill v3.3.3
   * Copyright 2024 Mattias Buelens, Diwank Singh Tomer and other contributors.
   * This code is released under the MIT license.
   * SPDX-License-Identifier: MIT
   *)

fetch-blob/index.js:
  (*! fetch-blob. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> *)

formdata-polyfill/esm.min.js:
  (*! formdata-polyfill. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> *)

node-domexception/index.js:
  (*! node-domexception. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> *)
*/
