#!/usr/bin/env node
var rp=Object.create;var ao=Object.defineProperty;var np=Object.getOwnPropertyDescriptor;var ap=Object.getOwnPropertyNames;var sp=Object.getPrototypeOf,op=Object.prototype.hasOwnProperty;var B=(t,e)=>()=>(t&&(e=t(t=0)),e);var so=(t,e)=>()=>(e||t((e={exports:{}}).exports,e),e.exports),Pe=(t,e)=>{for(var r in e)ao(t,r,{get:e[r],enumerable:!0})},ip=(t,e,r,a)=>{if(e&&typeof e=="object"||typeof e=="function")for(let s of ap(e))!op.call(t,s)&&s!==r&&ao(t,s,{get:()=>e[s],enumerable:!(a=np(e,s))||a.enumerable});return t};var Be=(t,e,r)=>(r=t!=null?rp(sp(t)):{},ip(e||!t||!t.__esModule?ao(r,"default",{value:t,enumerable:!0}):r,t));function im(t){if(!/^data:/i.test(t))throw new TypeError('`uri` does not appear to be a Data URI (must begin with "data:")');t=t.replace(/\r?\n/g,"");let e=t.indexOf(",");if(e===-1||e<=4)throw new TypeError("malformed data: URI");let r=t.substring(5,e).split(";"),a="",s=!1,i=r[0]||"text/plain",c=i;for(let g=1;g<r.length;g++)r[g]==="base64"?s=!0:r[g]&&(c+=`;${r[g]}`,r[g].indexOf("charset=")===0&&(a=r[g].substring(8)));!r[0]&&!a.length&&(c+=";charset=US-ASCII",a="US-ASCII");let u=s?"base64":"ascii",p=unescape(t.substring(e+1)),d=Buffer.from(p,u);return d.type=i,d.typeFull=c,d.charset=a,d}var il,cl=B(()=>{il=im});var ul=so((Va,ll)=>{(function(t,e){typeof Va=="object"&&typeof ll<"u"?e(Va):typeof define=="function"&&define.amd?define(["exports"],e):(t=typeof globalThis<"u"?globalThis:t||self,e(t.WebStreamsPolyfill={}))})(Va,(function(t){"use strict";function e(){}function r(n){return typeof n=="object"&&n!==null||typeof n=="function"}let a=e;function s(n,o){try{Object.defineProperty(n,"name",{value:o,configurable:!0})}catch{}}let i=Promise,c=Promise.prototype.then,u=Promise.reject.bind(i);function p(n){return new i(n)}function d(n){return p(o=>o(n))}function g(n){return u(n)}function k(n,o,l){return c.call(n,o,l)}function x(n,o,l){k(k(n,o,l),void 0,a)}function P(n,o){x(n,o)}function v(n,o){x(n,void 0,o)}function z(n,o,l){return k(n,o,l)}function q(n){k(n,void 0,a)}let W=n=>{if(typeof queueMicrotask=="function")W=queueMicrotask;else{let o=d(void 0);W=l=>k(o,l)}return W(n)};function Y(n,o,l){if(typeof n!="function")throw new TypeError("Argument is not a function");return Function.prototype.apply.call(n,o,l)}function ne(n,o,l){try{return d(Y(n,o,l))}catch(f){return g(f)}}let U=16384;class H{constructor(){this._cursor=0,this._size=0,this._front={_elements:[],_next:void 0},this._back=this._front,this._cursor=0,this._size=0}get length(){return this._size}push(o){let l=this._back,f=l;l._elements.length===U-1&&(f={_elements:[],_next:void 0}),l._elements.push(o),f!==l&&(this._back=f,l._next=f),++this._size}shift(){let o=this._front,l=o,f=this._cursor,m=f+1,b=o._elements,w=b[f];return m===U&&(l=o._next,m=0),--this._size,this._cursor=m,o!==l&&(this._front=l),b[f]=void 0,w}forEach(o){let l=this._cursor,f=this._front,m=f._elements;for(;(l!==m.length||f._next!==void 0)&&!(l===m.length&&(f=f._next,m=f._elements,l=0,m.length===0));)o(m[l]),++l}peek(){let o=this._front,l=this._cursor;return o._elements[l]}}let Q=Symbol("[[AbortSteps]]"),Ct=Symbol("[[ErrorSteps]]"),ln=Symbol("[[CancelSteps]]"),bs=Symbol("[[PullSteps]]"),ws=Symbol("[[ReleaseSteps]]");function Si(n,o){n._ownerReadableStream=o,o._reader=n,o._state==="readable"?ks(n):o._state==="closed"?dd(n):xi(n,o._storedError)}function _s(n,o){let l=n._ownerReadableStream;return We(l,o)}function ct(n){let o=n._ownerReadableStream;o._state==="readable"?Ss(n,new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")):fd(n,new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")),o._readableStreamController[ws](),o._reader=void 0,n._ownerReadableStream=void 0}function Qn(n){return new TypeError("Cannot "+n+" a stream using a released reader")}function ks(n){n._closedPromise=p((o,l)=>{n._closedPromise_resolve=o,n._closedPromise_reject=l})}function xi(n,o){ks(n),Ss(n,o)}function dd(n){ks(n),vi(n)}function Ss(n,o){n._closedPromise_reject!==void 0&&(q(n._closedPromise),n._closedPromise_reject(o),n._closedPromise_resolve=void 0,n._closedPromise_reject=void 0)}function fd(n,o){xi(n,o)}function vi(n){n._closedPromise_resolve!==void 0&&(n._closedPromise_resolve(void 0),n._closedPromise_resolve=void 0,n._closedPromise_reject=void 0)}let Ti=Number.isFinite||function(n){return typeof n=="number"&&isFinite(n)},pd=Math.trunc||function(n){return n<0?Math.ceil(n):Math.floor(n)};function hd(n){return typeof n=="object"||typeof n=="function"}function Qe(n,o){if(n!==void 0&&!hd(n))throw new TypeError(`${o} is not an object.`)}function Ee(n,o){if(typeof n!="function")throw new TypeError(`${o} is not a function.`)}function md(n){return typeof n=="object"&&n!==null||typeof n=="function"}function Ci(n,o){if(!md(n))throw new TypeError(`${o} is not an object.`)}function lt(n,o,l){if(n===void 0)throw new TypeError(`Parameter ${o} is required in '${l}'.`)}function xs(n,o,l){if(n===void 0)throw new TypeError(`${o} is required in '${l}'.`)}function vs(n){return Number(n)}function Ri(n){return n===0?0:n}function gd(n){return Ri(pd(n))}function Ts(n,o){let f=Number.MAX_SAFE_INTEGER,m=Number(n);if(m=Ri(m),!Ti(m))throw new TypeError(`${o} is not a finite number`);if(m=gd(m),m<0||m>f)throw new TypeError(`${o} is outside the accepted range of 0 to ${f}, inclusive`);return!Ti(m)||m===0?0:m}function Cs(n,o){if(!Ot(n))throw new TypeError(`${o} is not a ReadableStream.`)}function Ir(n){return new Rt(n)}function Ei(n,o){n._reader._readRequests.push(o)}function Rs(n,o,l){let m=n._reader._readRequests.shift();l?m._closeSteps():m._chunkSteps(o)}function Kn(n){return n._reader._readRequests.length}function Ai(n){let o=n._reader;return!(o===void 0||!Et(o))}class Rt{constructor(o){if(lt(o,1,"ReadableStreamDefaultReader"),Cs(o,"First parameter"),Dt(o))throw new TypeError("This stream has already been locked for exclusive reading by another reader");Si(this,o),this._readRequests=new H}get closed(){return Et(this)?this._closedPromise:g(Xn("closed"))}cancel(o=void 0){return Et(this)?this._ownerReadableStream===void 0?g(Qn("cancel")):_s(this,o):g(Xn("cancel"))}read(){if(!Et(this))return g(Xn("read"));if(this._ownerReadableStream===void 0)return g(Qn("read from"));let o,l,f=p((b,w)=>{o=b,l=w});return un(this,{_chunkSteps:b=>o({value:b,done:!1}),_closeSteps:()=>o({value:void 0,done:!0}),_errorSteps:b=>l(b)}),f}releaseLock(){if(!Et(this))throw Xn("releaseLock");this._ownerReadableStream!==void 0&&yd(this)}}Object.defineProperties(Rt.prototype,{cancel:{enumerable:!0},read:{enumerable:!0},releaseLock:{enumerable:!0},closed:{enumerable:!0}}),s(Rt.prototype.cancel,"cancel"),s(Rt.prototype.read,"read"),s(Rt.prototype.releaseLock,"releaseLock"),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(Rt.prototype,Symbol.toStringTag,{value:"ReadableStreamDefaultReader",configurable:!0});function Et(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_readRequests")?!1:n instanceof Rt}function un(n,o){let l=n._ownerReadableStream;l._disturbed=!0,l._state==="closed"?o._closeSteps():l._state==="errored"?o._errorSteps(l._storedError):l._readableStreamController[bs](o)}function yd(n){ct(n);let o=new TypeError("Reader was released");$i(n,o)}function $i(n,o){let l=n._readRequests;n._readRequests=new H,l.forEach(f=>{f._errorSteps(o)})}function Xn(n){return new TypeError(`ReadableStreamDefaultReader.prototype.${n} can only be used on a ReadableStreamDefaultReader`)}let bd=Object.getPrototypeOf(Object.getPrototypeOf(async function*(){}).prototype);class Pi{constructor(o,l){this._ongoingPromise=void 0,this._isFinished=!1,this._reader=o,this._preventCancel=l}next(){let o=()=>this._nextSteps();return this._ongoingPromise=this._ongoingPromise?z(this._ongoingPromise,o,o):o(),this._ongoingPromise}return(o){let l=()=>this._returnSteps(o);return this._ongoingPromise?z(this._ongoingPromise,l,l):l()}_nextSteps(){if(this._isFinished)return Promise.resolve({value:void 0,done:!0});let o=this._reader,l,f,m=p((w,T)=>{l=w,f=T});return un(o,{_chunkSteps:w=>{this._ongoingPromise=void 0,W(()=>l({value:w,done:!1}))},_closeSteps:()=>{this._ongoingPromise=void 0,this._isFinished=!0,ct(o),l({value:void 0,done:!0})},_errorSteps:w=>{this._ongoingPromise=void 0,this._isFinished=!0,ct(o),f(w)}}),m}_returnSteps(o){if(this._isFinished)return Promise.resolve({value:o,done:!0});this._isFinished=!0;let l=this._reader;if(!this._preventCancel){let f=_s(l,o);return ct(l),z(f,()=>({value:o,done:!0}))}return ct(l),d({value:o,done:!0})}}let Ii={next(){return Oi(this)?this._asyncIteratorImpl.next():g(Di("next"))},return(n){return Oi(this)?this._asyncIteratorImpl.return(n):g(Di("return"))}};Object.setPrototypeOf(Ii,bd);function wd(n,o){let l=Ir(n),f=new Pi(l,o),m=Object.create(Ii);return m._asyncIteratorImpl=f,m}function Oi(n){if(!r(n)||!Object.prototype.hasOwnProperty.call(n,"_asyncIteratorImpl"))return!1;try{return n._asyncIteratorImpl instanceof Pi}catch{return!1}}function Di(n){return new TypeError(`ReadableStreamAsyncIterator.${n} can only be used on a ReadableSteamAsyncIterator`)}let Li=Number.isNaN||function(n){return n!==n};var Es,As,$s;function dn(n){return n.slice()}function Ni(n,o,l,f,m){new Uint8Array(n).set(new Uint8Array(l,f,m),o)}let ut=n=>(typeof n.transfer=="function"?ut=o=>o.transfer():typeof structuredClone=="function"?ut=o=>structuredClone(o,{transfer:[o]}):ut=o=>o,ut(n)),At=n=>(typeof n.detached=="boolean"?At=o=>o.detached:At=o=>o.byteLength===0,At(n));function Mi(n,o,l){if(n.slice)return n.slice(o,l);let f=l-o,m=new ArrayBuffer(f);return Ni(m,0,n,o,f),m}function ea(n,o){let l=n[o];if(l!=null){if(typeof l!="function")throw new TypeError(`${String(o)} is not a function`);return l}}function _d(n){let o={[Symbol.iterator]:()=>n.iterator},l=(async function*(){return yield*o})(),f=l.next;return{iterator:l,nextMethod:f,done:!1}}let Ps=($s=(Es=Symbol.asyncIterator)!==null&&Es!==void 0?Es:(As=Symbol.for)===null||As===void 0?void 0:As.call(Symbol,"Symbol.asyncIterator"))!==null&&$s!==void 0?$s:"@@asyncIterator";function Fi(n,o="sync",l){if(l===void 0)if(o==="async"){if(l=ea(n,Ps),l===void 0){let b=ea(n,Symbol.iterator),w=Fi(n,"sync",b);return _d(w)}}else l=ea(n,Symbol.iterator);if(l===void 0)throw new TypeError("The object is not iterable");let f=Y(l,n,[]);if(!r(f))throw new TypeError("The iterator method must return an object");let m=f.next;return{iterator:f,nextMethod:m,done:!1}}function kd(n){let o=Y(n.nextMethod,n.iterator,[]);if(!r(o))throw new TypeError("The iterator.next() method must return an object");return o}function Sd(n){return!!n.done}function xd(n){return n.value}function vd(n){return!(typeof n!="number"||Li(n)||n<0)}function ji(n){let o=Mi(n.buffer,n.byteOffset,n.byteOffset+n.byteLength);return new Uint8Array(o)}function Is(n){let o=n._queue.shift();return n._queueTotalSize-=o.size,n._queueTotalSize<0&&(n._queueTotalSize=0),o.value}function Os(n,o,l){if(!vd(l)||l===1/0)throw new RangeError("Size must be a finite, non-NaN, non-negative number.");n._queue.push({value:o,size:l}),n._queueTotalSize+=l}function Td(n){return n._queue.peek().value}function $t(n){n._queue=new H,n._queueTotalSize=0}function Wi(n){return n===DataView}function Cd(n){return Wi(n.constructor)}function Rd(n){return Wi(n)?1:n.BYTES_PER_ELEMENT}class Gt{constructor(){throw new TypeError("Illegal constructor")}get view(){if(!Ds(this))throw js("view");return this._view}respond(o){if(!Ds(this))throw js("respond");if(lt(o,1,"respond"),o=Ts(o,"First parameter"),this._associatedReadableByteStreamController===void 0)throw new TypeError("This BYOB request has been invalidated");if(At(this._view.buffer))throw new TypeError("The BYOB request's buffer has been detached and so cannot be used as a response");aa(this._associatedReadableByteStreamController,o)}respondWithNewView(o){if(!Ds(this))throw js("respondWithNewView");if(lt(o,1,"respondWithNewView"),!ArrayBuffer.isView(o))throw new TypeError("You can only respond with array buffer views");if(this._associatedReadableByteStreamController===void 0)throw new TypeError("This BYOB request has been invalidated");if(At(o.buffer))throw new TypeError("The given view's buffer has been detached and so cannot be used as a response");sa(this._associatedReadableByteStreamController,o)}}Object.defineProperties(Gt.prototype,{respond:{enumerable:!0},respondWithNewView:{enumerable:!0},view:{enumerable:!0}}),s(Gt.prototype.respond,"respond"),s(Gt.prototype.respondWithNewView,"respondWithNewView"),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(Gt.prototype,Symbol.toStringTag,{value:"ReadableStreamBYOBRequest",configurable:!0});class dt{constructor(){throw new TypeError("Illegal constructor")}get byobRequest(){if(!Jt(this))throw pn("byobRequest");return Fs(this)}get desiredSize(){if(!Jt(this))throw pn("desiredSize");return Yi(this)}close(){if(!Jt(this))throw pn("close");if(this._closeRequested)throw new TypeError("The stream has already been closed; do not close it again!");let o=this._controlledReadableByteStream._state;if(o!=="readable")throw new TypeError(`The stream (in ${o} state) is not in the readable state and cannot be closed`);fn(this)}enqueue(o){if(!Jt(this))throw pn("enqueue");if(lt(o,1,"enqueue"),!ArrayBuffer.isView(o))throw new TypeError("chunk must be an array buffer view");if(o.byteLength===0)throw new TypeError("chunk must have non-zero byteLength");if(o.buffer.byteLength===0)throw new TypeError("chunk's buffer must have non-zero byteLength");if(this._closeRequested)throw new TypeError("stream is closed or draining");let l=this._controlledReadableByteStream._state;if(l!=="readable")throw new TypeError(`The stream (in ${l} state) is not in the readable state and cannot be enqueued to`);na(this,o)}error(o=void 0){if(!Jt(this))throw pn("error");Ae(this,o)}[ln](o){qi(this),$t(this);let l=this._cancelAlgorithm(o);return ra(this),l}[bs](o){let l=this._controlledReadableByteStream;if(this._queueTotalSize>0){Zi(this,o);return}let f=this._autoAllocateChunkSize;if(f!==void 0){let m;try{m=new ArrayBuffer(f)}catch(w){o._errorSteps(w);return}let b={buffer:m,bufferByteLength:f,byteOffset:0,byteLength:f,bytesFilled:0,minimumFill:1,elementSize:1,viewConstructor:Uint8Array,readerType:"default"};this._pendingPullIntos.push(b)}Ei(l,o),Zt(this)}[ws](){if(this._pendingPullIntos.length>0){let o=this._pendingPullIntos.peek();o.readerType="none",this._pendingPullIntos=new H,this._pendingPullIntos.push(o)}}}Object.defineProperties(dt.prototype,{close:{enumerable:!0},enqueue:{enumerable:!0},error:{enumerable:!0},byobRequest:{enumerable:!0},desiredSize:{enumerable:!0}}),s(dt.prototype.close,"close"),s(dt.prototype.enqueue,"enqueue"),s(dt.prototype.error,"error"),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(dt.prototype,Symbol.toStringTag,{value:"ReadableByteStreamController",configurable:!0});function Jt(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_controlledReadableByteStream")?!1:n instanceof dt}function Ds(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_associatedReadableByteStreamController")?!1:n instanceof Gt}function Zt(n){if(!Id(n))return;if(n._pulling){n._pullAgain=!0;return}n._pulling=!0;let l=n._pullAlgorithm();x(l,()=>(n._pulling=!1,n._pullAgain&&(n._pullAgain=!1,Zt(n)),null),f=>(Ae(n,f),null))}function qi(n){Ns(n),n._pendingPullIntos=new H}function Ls(n,o){let l=!1;n._state==="closed"&&(l=!0);let f=Bi(o);o.readerType==="default"?Rs(n,f,l):Fd(n,f,l)}function Bi(n){let o=n.bytesFilled,l=n.elementSize;return new n.viewConstructor(n.buffer,n.byteOffset,o/l)}function ta(n,o,l,f){n._queue.push({buffer:o,byteOffset:l,byteLength:f}),n._queueTotalSize+=f}function Ui(n,o,l,f){let m;try{m=Mi(o,l,l+f)}catch(b){throw Ae(n,b),b}ta(n,m,0,f)}function zi(n,o){o.bytesFilled>0&&Ui(n,o.buffer,o.byteOffset,o.bytesFilled),Or(n)}function Hi(n,o){let l=Math.min(n._queueTotalSize,o.byteLength-o.bytesFilled),f=o.bytesFilled+l,m=l,b=!1,w=f%o.elementSize,T=f-w;T>=o.minimumFill&&(m=T-o.bytesFilled,b=!0);let O=n._queue;for(;m>0;){let E=O.peek(),D=Math.min(m,E.byteLength),M=o.byteOffset+o.bytesFilled;Ni(o.buffer,M,E.buffer,E.byteOffset,D),E.byteLength===D?O.shift():(E.byteOffset+=D,E.byteLength-=D),n._queueTotalSize-=D,Vi(n,D,o),m-=D}return b}function Vi(n,o,l){l.bytesFilled+=o}function Gi(n){n._queueTotalSize===0&&n._closeRequested?(ra(n),wn(n._controlledReadableByteStream)):Zt(n)}function Ns(n){n._byobRequest!==null&&(n._byobRequest._associatedReadableByteStreamController=void 0,n._byobRequest._view=null,n._byobRequest=null)}function Ms(n){for(;n._pendingPullIntos.length>0;){if(n._queueTotalSize===0)return;let o=n._pendingPullIntos.peek();Hi(n,o)&&(Or(n),Ls(n._controlledReadableByteStream,o))}}function Ed(n){let o=n._controlledReadableByteStream._reader;for(;o._readRequests.length>0;){if(n._queueTotalSize===0)return;let l=o._readRequests.shift();Zi(n,l)}}function Ad(n,o,l,f){let m=n._controlledReadableByteStream,b=o.constructor,w=Rd(b),{byteOffset:T,byteLength:O}=o,E=l*w,D;try{D=ut(o.buffer)}catch(G){f._errorSteps(G);return}let M={buffer:D,bufferByteLength:D.byteLength,byteOffset:T,byteLength:O,bytesFilled:0,minimumFill:E,elementSize:w,viewConstructor:b,readerType:"byob"};if(n._pendingPullIntos.length>0){n._pendingPullIntos.push(M),Xi(m,f);return}if(m._state==="closed"){let G=new b(M.buffer,M.byteOffset,0);f._closeSteps(G);return}if(n._queueTotalSize>0){if(Hi(n,M)){let G=Bi(M);Gi(n),f._chunkSteps(G);return}if(n._closeRequested){let G=new TypeError("Insufficient bytes to fill elements in the given buffer");Ae(n,G),f._errorSteps(G);return}}n._pendingPullIntos.push(M),Xi(m,f),Zt(n)}function $d(n,o){o.readerType==="none"&&Or(n);let l=n._controlledReadableByteStream;if(Ws(l))for(;ec(l)>0;){let f=Or(n);Ls(l,f)}}function Pd(n,o,l){if(Vi(n,o,l),l.readerType==="none"){zi(n,l),Ms(n);return}if(l.bytesFilled<l.minimumFill)return;Or(n);let f=l.bytesFilled%l.elementSize;if(f>0){let m=l.byteOffset+l.bytesFilled;Ui(n,l.buffer,m-f,f)}l.bytesFilled-=f,Ls(n._controlledReadableByteStream,l),Ms(n)}function Ji(n,o){let l=n._pendingPullIntos.peek();Ns(n),n._controlledReadableByteStream._state==="closed"?$d(n,l):Pd(n,o,l),Zt(n)}function Or(n){return n._pendingPullIntos.shift()}function Id(n){let o=n._controlledReadableByteStream;return o._state!=="readable"||n._closeRequested||!n._started?!1:!!(Ai(o)&&Kn(o)>0||Ws(o)&&ec(o)>0||Yi(n)>0)}function ra(n){n._pullAlgorithm=void 0,n._cancelAlgorithm=void 0}function fn(n){let o=n._controlledReadableByteStream;if(!(n._closeRequested||o._state!=="readable")){if(n._queueTotalSize>0){n._closeRequested=!0;return}if(n._pendingPullIntos.length>0){let l=n._pendingPullIntos.peek();if(l.bytesFilled%l.elementSize!==0){let f=new TypeError("Insufficient bytes to fill elements in the given buffer");throw Ae(n,f),f}}ra(n),wn(o)}}function na(n,o){let l=n._controlledReadableByteStream;if(n._closeRequested||l._state!=="readable")return;let{buffer:f,byteOffset:m,byteLength:b}=o;if(At(f))throw new TypeError("chunk's buffer is detached and so cannot be enqueued");let w=ut(f);if(n._pendingPullIntos.length>0){let T=n._pendingPullIntos.peek();if(At(T.buffer))throw new TypeError("The BYOB request's buffer has been detached and so cannot be filled with an enqueued chunk");Ns(n),T.buffer=ut(T.buffer),T.readerType==="none"&&zi(n,T)}if(Ai(l))if(Ed(n),Kn(l)===0)ta(n,w,m,b);else{n._pendingPullIntos.length>0&&Or(n);let T=new Uint8Array(w,m,b);Rs(l,T,!1)}else Ws(l)?(ta(n,w,m,b),Ms(n)):ta(n,w,m,b);Zt(n)}function Ae(n,o){let l=n._controlledReadableByteStream;l._state==="readable"&&(qi(n),$t(n),ra(n),vc(l,o))}function Zi(n,o){let l=n._queue.shift();n._queueTotalSize-=l.byteLength,Gi(n);let f=new Uint8Array(l.buffer,l.byteOffset,l.byteLength);o._chunkSteps(f)}function Fs(n){if(n._byobRequest===null&&n._pendingPullIntos.length>0){let o=n._pendingPullIntos.peek(),l=new Uint8Array(o.buffer,o.byteOffset+o.bytesFilled,o.byteLength-o.bytesFilled),f=Object.create(Gt.prototype);Dd(f,n,l),n._byobRequest=f}return n._byobRequest}function Yi(n){let o=n._controlledReadableByteStream._state;return o==="errored"?null:o==="closed"?0:n._strategyHWM-n._queueTotalSize}function aa(n,o){let l=n._pendingPullIntos.peek();if(n._controlledReadableByteStream._state==="closed"){if(o!==0)throw new TypeError("bytesWritten must be 0 when calling respond() on a closed stream")}else{if(o===0)throw new TypeError("bytesWritten must be greater than 0 when calling respond() on a readable stream");if(l.bytesFilled+o>l.byteLength)throw new RangeError("bytesWritten out of range")}l.buffer=ut(l.buffer),Ji(n,o)}function sa(n,o){let l=n._pendingPullIntos.peek();if(n._controlledReadableByteStream._state==="closed"){if(o.byteLength!==0)throw new TypeError("The view's length must be 0 when calling respondWithNewView() on a closed stream")}else if(o.byteLength===0)throw new TypeError("The view's length must be greater than 0 when calling respondWithNewView() on a readable stream");if(l.byteOffset+l.bytesFilled!==o.byteOffset)throw new RangeError("The region specified by view does not match byobRequest");if(l.bufferByteLength!==o.buffer.byteLength)throw new RangeError("The buffer of view has different capacity than byobRequest");if(l.bytesFilled+o.byteLength>l.byteLength)throw new RangeError("The region specified by view is larger than byobRequest");let m=o.byteLength;l.buffer=ut(o.buffer),Ji(n,m)}function Qi(n,o,l,f,m,b,w){o._controlledReadableByteStream=n,o._pullAgain=!1,o._pulling=!1,o._byobRequest=null,o._queue=o._queueTotalSize=void 0,$t(o),o._closeRequested=!1,o._started=!1,o._strategyHWM=b,o._pullAlgorithm=f,o._cancelAlgorithm=m,o._autoAllocateChunkSize=w,o._pendingPullIntos=new H,n._readableStreamController=o;let T=l();x(d(T),()=>(o._started=!0,Zt(o),null),O=>(Ae(o,O),null))}function Od(n,o,l){let f=Object.create(dt.prototype),m,b,w;o.start!==void 0?m=()=>o.start(f):m=()=>{},o.pull!==void 0?b=()=>o.pull(f):b=()=>d(void 0),o.cancel!==void 0?w=O=>o.cancel(O):w=()=>d(void 0);let T=o.autoAllocateChunkSize;if(T===0)throw new TypeError("autoAllocateChunkSize must be greater than 0");Qi(n,f,m,b,w,l,T)}function Dd(n,o,l){n._associatedReadableByteStreamController=o,n._view=l}function js(n){return new TypeError(`ReadableStreamBYOBRequest.prototype.${n} can only be used on a ReadableStreamBYOBRequest`)}function pn(n){return new TypeError(`ReadableByteStreamController.prototype.${n} can only be used on a ReadableByteStreamController`)}function Ld(n,o){Qe(n,o);let l=n?.mode;return{mode:l===void 0?void 0:Nd(l,`${o} has member 'mode' that`)}}function Nd(n,o){if(n=`${n}`,n!=="byob")throw new TypeError(`${o} '${n}' is not a valid enumeration value for ReadableStreamReaderMode`);return n}function Md(n,o){var l;Qe(n,o);let f=(l=n?.min)!==null&&l!==void 0?l:1;return{min:Ts(f,`${o} has member 'min' that`)}}function Ki(n){return new Pt(n)}function Xi(n,o){n._reader._readIntoRequests.push(o)}function Fd(n,o,l){let m=n._reader._readIntoRequests.shift();l?m._closeSteps(o):m._chunkSteps(o)}function ec(n){return n._reader._readIntoRequests.length}function Ws(n){let o=n._reader;return!(o===void 0||!Yt(o))}class Pt{constructor(o){if(lt(o,1,"ReadableStreamBYOBReader"),Cs(o,"First parameter"),Dt(o))throw new TypeError("This stream has already been locked for exclusive reading by another reader");if(!Jt(o._readableStreamController))throw new TypeError("Cannot construct a ReadableStreamBYOBReader for a stream not constructed with a byte source");Si(this,o),this._readIntoRequests=new H}get closed(){return Yt(this)?this._closedPromise:g(oa("closed"))}cancel(o=void 0){return Yt(this)?this._ownerReadableStream===void 0?g(Qn("cancel")):_s(this,o):g(oa("cancel"))}read(o,l={}){if(!Yt(this))return g(oa("read"));if(!ArrayBuffer.isView(o))return g(new TypeError("view must be an array buffer view"));if(o.byteLength===0)return g(new TypeError("view must have non-zero byteLength"));if(o.buffer.byteLength===0)return g(new TypeError("view's buffer must have non-zero byteLength"));if(At(o.buffer))return g(new TypeError("view's buffer has been detached"));let f;try{f=Md(l,"options")}catch(E){return g(E)}let m=f.min;if(m===0)return g(new TypeError("options.min must be greater than 0"));if(Cd(o)){if(m>o.byteLength)return g(new RangeError("options.min must be less than or equal to view's byteLength"))}else if(m>o.length)return g(new RangeError("options.min must be less than or equal to view's length"));if(this._ownerReadableStream===void 0)return g(Qn("read from"));let b,w,T=p((E,D)=>{b=E,w=D});return tc(this,o,m,{_chunkSteps:E=>b({value:E,done:!1}),_closeSteps:E=>b({value:E,done:!0}),_errorSteps:E=>w(E)}),T}releaseLock(){if(!Yt(this))throw oa("releaseLock");this._ownerReadableStream!==void 0&&jd(this)}}Object.defineProperties(Pt.prototype,{cancel:{enumerable:!0},read:{enumerable:!0},releaseLock:{enumerable:!0},closed:{enumerable:!0}}),s(Pt.prototype.cancel,"cancel"),s(Pt.prototype.read,"read"),s(Pt.prototype.releaseLock,"releaseLock"),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(Pt.prototype,Symbol.toStringTag,{value:"ReadableStreamBYOBReader",configurable:!0});function Yt(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_readIntoRequests")?!1:n instanceof Pt}function tc(n,o,l,f){let m=n._ownerReadableStream;m._disturbed=!0,m._state==="errored"?f._errorSteps(m._storedError):Ad(m._readableStreamController,o,l,f)}function jd(n){ct(n);let o=new TypeError("Reader was released");rc(n,o)}function rc(n,o){let l=n._readIntoRequests;n._readIntoRequests=new H,l.forEach(f=>{f._errorSteps(o)})}function oa(n){return new TypeError(`ReadableStreamBYOBReader.prototype.${n} can only be used on a ReadableStreamBYOBReader`)}function hn(n,o){let{highWaterMark:l}=n;if(l===void 0)return o;if(Li(l)||l<0)throw new RangeError("Invalid highWaterMark");return l}function ia(n){let{size:o}=n;return o||(()=>1)}function ca(n,o){Qe(n,o);let l=n?.highWaterMark,f=n?.size;return{highWaterMark:l===void 0?void 0:vs(l),size:f===void 0?void 0:Wd(f,`${o} has member 'size' that`)}}function Wd(n,o){return Ee(n,o),l=>vs(n(l))}function qd(n,o){Qe(n,o);let l=n?.abort,f=n?.close,m=n?.start,b=n?.type,w=n?.write;return{abort:l===void 0?void 0:Bd(l,n,`${o} has member 'abort' that`),close:f===void 0?void 0:Ud(f,n,`${o} has member 'close' that`),start:m===void 0?void 0:zd(m,n,`${o} has member 'start' that`),write:w===void 0?void 0:Hd(w,n,`${o} has member 'write' that`),type:b}}function Bd(n,o,l){return Ee(n,l),f=>ne(n,o,[f])}function Ud(n,o,l){return Ee(n,l),()=>ne(n,o,[])}function zd(n,o,l){return Ee(n,l),f=>Y(n,o,[f])}function Hd(n,o,l){return Ee(n,l),(f,m)=>ne(n,o,[f,m])}function nc(n,o){if(!Dr(n))throw new TypeError(`${o} is not a WritableStream.`)}function Vd(n){if(typeof n!="object"||n===null)return!1;try{return typeof n.aborted=="boolean"}catch{return!1}}let Gd=typeof AbortController=="function";function Jd(){if(Gd)return new AbortController}class It{constructor(o={},l={}){o===void 0?o=null:Ci(o,"First parameter");let f=ca(l,"Second parameter"),m=qd(o,"First parameter");if(sc(this),m.type!==void 0)throw new RangeError("Invalid type is specified");let w=ia(f),T=hn(f,1);lf(this,m,T,w)}get locked(){if(!Dr(this))throw pa("locked");return Lr(this)}abort(o=void 0){return Dr(this)?Lr(this)?g(new TypeError("Cannot abort a stream that already has a writer")):la(this,o):g(pa("abort"))}close(){return Dr(this)?Lr(this)?g(new TypeError("Cannot close a stream that already has a writer")):Ke(this)?g(new TypeError("Cannot close an already-closing stream")):oc(this):g(pa("close"))}getWriter(){if(!Dr(this))throw pa("getWriter");return ac(this)}}Object.defineProperties(It.prototype,{abort:{enumerable:!0},close:{enumerable:!0},getWriter:{enumerable:!0},locked:{enumerable:!0}}),s(It.prototype.abort,"abort"),s(It.prototype.close,"close"),s(It.prototype.getWriter,"getWriter"),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(It.prototype,Symbol.toStringTag,{value:"WritableStream",configurable:!0});function ac(n){return new ft(n)}function Zd(n,o,l,f,m=1,b=()=>1){let w=Object.create(It.prototype);sc(w);let T=Object.create(Nr.prototype);return fc(w,T,n,o,l,f,m,b),w}function sc(n){n._state="writable",n._storedError=void 0,n._writer=void 0,n._writableStreamController=void 0,n._writeRequests=new H,n._inFlightWriteRequest=void 0,n._closeRequest=void 0,n._inFlightCloseRequest=void 0,n._pendingAbortRequest=void 0,n._backpressure=!1}function Dr(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_writableStreamController")?!1:n instanceof It}function Lr(n){return n._writer!==void 0}function la(n,o){var l;if(n._state==="closed"||n._state==="errored")return d(void 0);n._writableStreamController._abortReason=o,(l=n._writableStreamController._abortController)===null||l===void 0||l.abort(o);let f=n._state;if(f==="closed"||f==="errored")return d(void 0);if(n._pendingAbortRequest!==void 0)return n._pendingAbortRequest._promise;let m=!1;f==="erroring"&&(m=!0,o=void 0);let b=p((w,T)=>{n._pendingAbortRequest={_promise:void 0,_resolve:w,_reject:T,_reason:o,_wasAlreadyErroring:m}});return n._pendingAbortRequest._promise=b,m||Bs(n,o),b}function oc(n){let o=n._state;if(o==="closed"||o==="errored")return g(new TypeError(`The stream (in ${o} state) is not in the writable state and cannot be closed`));let l=p((m,b)=>{let w={_resolve:m,_reject:b};n._closeRequest=w}),f=n._writer;return f!==void 0&&n._backpressure&&o==="writable"&&Ys(f),uf(n._writableStreamController),l}function Yd(n){return p((l,f)=>{let m={_resolve:l,_reject:f};n._writeRequests.push(m)})}function qs(n,o){if(n._state==="writable"){Bs(n,o);return}Us(n)}function Bs(n,o){let l=n._writableStreamController;n._state="erroring",n._storedError=o;let f=n._writer;f!==void 0&&cc(f,o),!tf(n)&&l._started&&Us(n)}function Us(n){n._state="errored",n._writableStreamController[Ct]();let o=n._storedError;if(n._writeRequests.forEach(m=>{m._reject(o)}),n._writeRequests=new H,n._pendingAbortRequest===void 0){ua(n);return}let l=n._pendingAbortRequest;if(n._pendingAbortRequest=void 0,l._wasAlreadyErroring){l._reject(o),ua(n);return}let f=n._writableStreamController[Q](l._reason);x(f,()=>(l._resolve(),ua(n),null),m=>(l._reject(m),ua(n),null))}function Qd(n){n._inFlightWriteRequest._resolve(void 0),n._inFlightWriteRequest=void 0}function Kd(n,o){n._inFlightWriteRequest._reject(o),n._inFlightWriteRequest=void 0,qs(n,o)}function Xd(n){n._inFlightCloseRequest._resolve(void 0),n._inFlightCloseRequest=void 0,n._state==="erroring"&&(n._storedError=void 0,n._pendingAbortRequest!==void 0&&(n._pendingAbortRequest._resolve(),n._pendingAbortRequest=void 0)),n._state="closed";let l=n._writer;l!==void 0&&gc(l)}function ef(n,o){n._inFlightCloseRequest._reject(o),n._inFlightCloseRequest=void 0,n._pendingAbortRequest!==void 0&&(n._pendingAbortRequest._reject(o),n._pendingAbortRequest=void 0),qs(n,o)}function Ke(n){return!(n._closeRequest===void 0&&n._inFlightCloseRequest===void 0)}function tf(n){return!(n._inFlightWriteRequest===void 0&&n._inFlightCloseRequest===void 0)}function rf(n){n._inFlightCloseRequest=n._closeRequest,n._closeRequest=void 0}function nf(n){n._inFlightWriteRequest=n._writeRequests.shift()}function ua(n){n._closeRequest!==void 0&&(n._closeRequest._reject(n._storedError),n._closeRequest=void 0);let o=n._writer;o!==void 0&&Js(o,n._storedError)}function zs(n,o){let l=n._writer;l!==void 0&&o!==n._backpressure&&(o?yf(l):Ys(l)),n._backpressure=o}class ft{constructor(o){if(lt(o,1,"WritableStreamDefaultWriter"),nc(o,"First parameter"),Lr(o))throw new TypeError("This stream has already been locked for exclusive writing by another writer");this._ownerWritableStream=o,o._writer=this;let l=o._state;if(l==="writable")!Ke(o)&&o._backpressure?ma(this):yc(this),ha(this);else if(l==="erroring")Zs(this,o._storedError),ha(this);else if(l==="closed")yc(this),mf(this);else{let f=o._storedError;Zs(this,f),mc(this,f)}}get closed(){return Qt(this)?this._closedPromise:g(Kt("closed"))}get desiredSize(){if(!Qt(this))throw Kt("desiredSize");if(this._ownerWritableStream===void 0)throw gn("desiredSize");return cf(this)}get ready(){return Qt(this)?this._readyPromise:g(Kt("ready"))}abort(o=void 0){return Qt(this)?this._ownerWritableStream===void 0?g(gn("abort")):af(this,o):g(Kt("abort"))}close(){if(!Qt(this))return g(Kt("close"));let o=this._ownerWritableStream;return o===void 0?g(gn("close")):Ke(o)?g(new TypeError("Cannot close an already-closing stream")):ic(this)}releaseLock(){if(!Qt(this))throw Kt("releaseLock");this._ownerWritableStream!==void 0&&lc(this)}write(o=void 0){return Qt(this)?this._ownerWritableStream===void 0?g(gn("write to")):uc(this,o):g(Kt("write"))}}Object.defineProperties(ft.prototype,{abort:{enumerable:!0},close:{enumerable:!0},releaseLock:{enumerable:!0},write:{enumerable:!0},closed:{enumerable:!0},desiredSize:{enumerable:!0},ready:{enumerable:!0}}),s(ft.prototype.abort,"abort"),s(ft.prototype.close,"close"),s(ft.prototype.releaseLock,"releaseLock"),s(ft.prototype.write,"write"),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(ft.prototype,Symbol.toStringTag,{value:"WritableStreamDefaultWriter",configurable:!0});function Qt(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_ownerWritableStream")?!1:n instanceof ft}function af(n,o){let l=n._ownerWritableStream;return la(l,o)}function ic(n){let o=n._ownerWritableStream;return oc(o)}function sf(n){let o=n._ownerWritableStream,l=o._state;return Ke(o)||l==="closed"?d(void 0):l==="errored"?g(o._storedError):ic(n)}function of(n,o){n._closedPromiseState==="pending"?Js(n,o):gf(n,o)}function cc(n,o){n._readyPromiseState==="pending"?bc(n,o):bf(n,o)}function cf(n){let o=n._ownerWritableStream,l=o._state;return l==="errored"||l==="erroring"?null:l==="closed"?0:pc(o._writableStreamController)}function lc(n){let o=n._ownerWritableStream,l=new TypeError("Writer was released and can no longer be used to monitor the stream's closedness");cc(n,l),of(n,l),o._writer=void 0,n._ownerWritableStream=void 0}function uc(n,o){let l=n._ownerWritableStream,f=l._writableStreamController,m=df(f,o);if(l!==n._ownerWritableStream)return g(gn("write to"));let b=l._state;if(b==="errored")return g(l._storedError);if(Ke(l)||b==="closed")return g(new TypeError("The stream is closing or closed and cannot be written to"));if(b==="erroring")return g(l._storedError);let w=Yd(l);return ff(f,o,m),w}let dc={};class Nr{constructor(){throw new TypeError("Illegal constructor")}get abortReason(){if(!Hs(this))throw Gs("abortReason");return this._abortReason}get signal(){if(!Hs(this))throw Gs("signal");if(this._abortController===void 0)throw new TypeError("WritableStreamDefaultController.prototype.signal is not supported");return this._abortController.signal}error(o=void 0){if(!Hs(this))throw Gs("error");this._controlledWritableStream._state==="writable"&&hc(this,o)}[Q](o){let l=this._abortAlgorithm(o);return da(this),l}[Ct](){$t(this)}}Object.defineProperties(Nr.prototype,{abortReason:{enumerable:!0},signal:{enumerable:!0},error:{enumerable:!0}}),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(Nr.prototype,Symbol.toStringTag,{value:"WritableStreamDefaultController",configurable:!0});function Hs(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_controlledWritableStream")?!1:n instanceof Nr}function fc(n,o,l,f,m,b,w,T){o._controlledWritableStream=n,n._writableStreamController=o,o._queue=void 0,o._queueTotalSize=void 0,$t(o),o._abortReason=void 0,o._abortController=Jd(),o._started=!1,o._strategySizeAlgorithm=T,o._strategyHWM=w,o._writeAlgorithm=f,o._closeAlgorithm=m,o._abortAlgorithm=b;let O=Vs(o);zs(n,O);let E=l(),D=d(E);x(D,()=>(o._started=!0,fa(o),null),M=>(o._started=!0,qs(n,M),null))}function lf(n,o,l,f){let m=Object.create(Nr.prototype),b,w,T,O;o.start!==void 0?b=()=>o.start(m):b=()=>{},o.write!==void 0?w=E=>o.write(E,m):w=()=>d(void 0),o.close!==void 0?T=()=>o.close():T=()=>d(void 0),o.abort!==void 0?O=E=>o.abort(E):O=()=>d(void 0),fc(n,m,b,w,T,O,l,f)}function da(n){n._writeAlgorithm=void 0,n._closeAlgorithm=void 0,n._abortAlgorithm=void 0,n._strategySizeAlgorithm=void 0}function uf(n){Os(n,dc,0),fa(n)}function df(n,o){try{return n._strategySizeAlgorithm(o)}catch(l){return mn(n,l),1}}function pc(n){return n._strategyHWM-n._queueTotalSize}function ff(n,o,l){try{Os(n,o,l)}catch(m){mn(n,m);return}let f=n._controlledWritableStream;if(!Ke(f)&&f._state==="writable"){let m=Vs(n);zs(f,m)}fa(n)}function fa(n){let o=n._controlledWritableStream;if(!n._started||o._inFlightWriteRequest!==void 0)return;if(o._state==="erroring"){Us(o);return}if(n._queue.length===0)return;let f=Td(n);f===dc?pf(n):hf(n,f)}function mn(n,o){n._controlledWritableStream._state==="writable"&&hc(n,o)}function pf(n){let o=n._controlledWritableStream;rf(o),Is(n);let l=n._closeAlgorithm();da(n),x(l,()=>(Xd(o),null),f=>(ef(o,f),null))}function hf(n,o){let l=n._controlledWritableStream;nf(l);let f=n._writeAlgorithm(o);x(f,()=>{Qd(l);let m=l._state;if(Is(n),!Ke(l)&&m==="writable"){let b=Vs(n);zs(l,b)}return fa(n),null},m=>(l._state==="writable"&&da(n),Kd(l,m),null))}function Vs(n){return pc(n)<=0}function hc(n,o){let l=n._controlledWritableStream;da(n),Bs(l,o)}function pa(n){return new TypeError(`WritableStream.prototype.${n} can only be used on a WritableStream`)}function Gs(n){return new TypeError(`WritableStreamDefaultController.prototype.${n} can only be used on a WritableStreamDefaultController`)}function Kt(n){return new TypeError(`WritableStreamDefaultWriter.prototype.${n} can only be used on a WritableStreamDefaultWriter`)}function gn(n){return new TypeError("Cannot "+n+" a stream using a released writer")}function ha(n){n._closedPromise=p((o,l)=>{n._closedPromise_resolve=o,n._closedPromise_reject=l,n._closedPromiseState="pending"})}function mc(n,o){ha(n),Js(n,o)}function mf(n){ha(n),gc(n)}function Js(n,o){n._closedPromise_reject!==void 0&&(q(n._closedPromise),n._closedPromise_reject(o),n._closedPromise_resolve=void 0,n._closedPromise_reject=void 0,n._closedPromiseState="rejected")}function gf(n,o){mc(n,o)}function gc(n){n._closedPromise_resolve!==void 0&&(n._closedPromise_resolve(void 0),n._closedPromise_resolve=void 0,n._closedPromise_reject=void 0,n._closedPromiseState="resolved")}function ma(n){n._readyPromise=p((o,l)=>{n._readyPromise_resolve=o,n._readyPromise_reject=l}),n._readyPromiseState="pending"}function Zs(n,o){ma(n),bc(n,o)}function yc(n){ma(n),Ys(n)}function bc(n,o){n._readyPromise_reject!==void 0&&(q(n._readyPromise),n._readyPromise_reject(o),n._readyPromise_resolve=void 0,n._readyPromise_reject=void 0,n._readyPromiseState="rejected")}function yf(n){ma(n)}function bf(n,o){Zs(n,o)}function Ys(n){n._readyPromise_resolve!==void 0&&(n._readyPromise_resolve(void 0),n._readyPromise_resolve=void 0,n._readyPromise_reject=void 0,n._readyPromiseState="fulfilled")}function wf(){if(typeof globalThis<"u")return globalThis;if(typeof self<"u")return self;if(typeof global<"u")return global}let Qs=wf();function _f(n){if(!(typeof n=="function"||typeof n=="object")||n.name!=="DOMException")return!1;try{return new n,!0}catch{return!1}}function kf(){let n=Qs?.DOMException;return _f(n)?n:void 0}function Sf(){let n=function(l,f){this.message=l||"",this.name=f||"Error",Error.captureStackTrace&&Error.captureStackTrace(this,this.constructor)};return s(n,"DOMException"),n.prototype=Object.create(Error.prototype),Object.defineProperty(n.prototype,"constructor",{value:n,writable:!0,configurable:!0}),n}let xf=kf()||Sf();function wc(n,o,l,f,m,b){let w=Ir(n),T=ac(o);n._disturbed=!0;let O=!1,E=d(void 0);return p((D,M)=>{let G;if(b!==void 0){if(G=()=>{let A=b.reason!==void 0?b.reason:new xf("Aborted","AbortError"),j=[];f||j.push(()=>o._state==="writable"?la(o,A):d(void 0)),m||j.push(()=>n._state==="readable"?We(n,A):d(void 0)),he(()=>Promise.all(j.map(J=>J())),!0,A)},b.aborted){G();return}b.addEventListener("abort",G)}function qe(){return p((A,j)=>{function J(_e){_e?A():k(Wr(),J,j)}J(!1)})}function Wr(){return O?d(!0):k(T._readyPromise,()=>p((A,j)=>{un(w,{_chunkSteps:J=>{E=k(uc(T,J),void 0,e),A(!1)},_closeSteps:()=>A(!0),_errorSteps:j})}))}if(ht(n,w._closedPromise,A=>(f?$e(!0,A):he(()=>la(o,A),!0,A),null)),ht(o,T._closedPromise,A=>(m?$e(!0,A):he(()=>We(n,A),!0,A),null)),ue(n,w._closedPromise,()=>(l?$e():he(()=>sf(T)),null)),Ke(o)||o._state==="closed"){let A=new TypeError("the destination writable stream closed before all data could be piped to it");m?$e(!0,A):he(()=>We(n,A),!0,A)}q(qe());function Nt(){let A=E;return k(E,()=>A!==E?Nt():void 0)}function ht(A,j,J){A._state==="errored"?J(A._storedError):v(j,J)}function ue(A,j,J){A._state==="closed"?J():P(j,J)}function he(A,j,J){if(O)return;O=!0,o._state==="writable"&&!Ke(o)?P(Nt(),_e):_e();function _e(){return x(A(),()=>mt(j,J),qr=>mt(!0,qr)),null}}function $e(A,j){O||(O=!0,o._state==="writable"&&!Ke(o)?P(Nt(),()=>mt(A,j)):mt(A,j))}function mt(A,j){return lc(T),ct(w),b!==void 0&&b.removeEventListener("abort",G),A?M(j):D(void 0),null}})}class pt{constructor(){throw new TypeError("Illegal constructor")}get desiredSize(){if(!ga(this))throw ba("desiredSize");return Ks(this)}close(){if(!ga(this))throw ba("close");if(!Fr(this))throw new TypeError("The stream is not in a state that permits close");Xt(this)}enqueue(o=void 0){if(!ga(this))throw ba("enqueue");if(!Fr(this))throw new TypeError("The stream is not in a state that permits enqueue");return Mr(this,o)}error(o=void 0){if(!ga(this))throw ba("error");je(this,o)}[ln](o){$t(this);let l=this._cancelAlgorithm(o);return ya(this),l}[bs](o){let l=this._controlledReadableStream;if(this._queue.length>0){let f=Is(this);this._closeRequested&&this._queue.length===0?(ya(this),wn(l)):yn(this),o._chunkSteps(f)}else Ei(l,o),yn(this)}[ws](){}}Object.defineProperties(pt.prototype,{close:{enumerable:!0},enqueue:{enumerable:!0},error:{enumerable:!0},desiredSize:{enumerable:!0}}),s(pt.prototype.close,"close"),s(pt.prototype.enqueue,"enqueue"),s(pt.prototype.error,"error"),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(pt.prototype,Symbol.toStringTag,{value:"ReadableStreamDefaultController",configurable:!0});function ga(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_controlledReadableStream")?!1:n instanceof pt}function yn(n){if(!_c(n))return;if(n._pulling){n._pullAgain=!0;return}n._pulling=!0;let l=n._pullAlgorithm();x(l,()=>(n._pulling=!1,n._pullAgain&&(n._pullAgain=!1,yn(n)),null),f=>(je(n,f),null))}function _c(n){let o=n._controlledReadableStream;return!Fr(n)||!n._started?!1:!!(Dt(o)&&Kn(o)>0||Ks(n)>0)}function ya(n){n._pullAlgorithm=void 0,n._cancelAlgorithm=void 0,n._strategySizeAlgorithm=void 0}function Xt(n){if(!Fr(n))return;let o=n._controlledReadableStream;n._closeRequested=!0,n._queue.length===0&&(ya(n),wn(o))}function Mr(n,o){if(!Fr(n))return;let l=n._controlledReadableStream;if(Dt(l)&&Kn(l)>0)Rs(l,o,!1);else{let f;try{f=n._strategySizeAlgorithm(o)}catch(m){throw je(n,m),m}try{Os(n,o,f)}catch(m){throw je(n,m),m}}yn(n)}function je(n,o){let l=n._controlledReadableStream;l._state==="readable"&&($t(n),ya(n),vc(l,o))}function Ks(n){let o=n._controlledReadableStream._state;return o==="errored"?null:o==="closed"?0:n._strategyHWM-n._queueTotalSize}function vf(n){return!_c(n)}function Fr(n){let o=n._controlledReadableStream._state;return!n._closeRequested&&o==="readable"}function kc(n,o,l,f,m,b,w){o._controlledReadableStream=n,o._queue=void 0,o._queueTotalSize=void 0,$t(o),o._started=!1,o._closeRequested=!1,o._pullAgain=!1,o._pulling=!1,o._strategySizeAlgorithm=w,o._strategyHWM=b,o._pullAlgorithm=f,o._cancelAlgorithm=m,n._readableStreamController=o;let T=l();x(d(T),()=>(o._started=!0,yn(o),null),O=>(je(o,O),null))}function Tf(n,o,l,f){let m=Object.create(pt.prototype),b,w,T;o.start!==void 0?b=()=>o.start(m):b=()=>{},o.pull!==void 0?w=()=>o.pull(m):w=()=>d(void 0),o.cancel!==void 0?T=O=>o.cancel(O):T=()=>d(void 0),kc(n,m,b,w,T,l,f)}function ba(n){return new TypeError(`ReadableStreamDefaultController.prototype.${n} can only be used on a ReadableStreamDefaultController`)}function Cf(n,o){return Jt(n._readableStreamController)?Ef(n):Rf(n)}function Rf(n,o){let l=Ir(n),f=!1,m=!1,b=!1,w=!1,T,O,E,D,M,G=p(ue=>{M=ue});function qe(){return f?(m=!0,d(void 0)):(f=!0,un(l,{_chunkSteps:he=>{W(()=>{m=!1;let $e=he,mt=he;b||Mr(E._readableStreamController,$e),w||Mr(D._readableStreamController,mt),f=!1,m&&qe()})},_closeSteps:()=>{f=!1,b||Xt(E._readableStreamController),w||Xt(D._readableStreamController),(!b||!w)&&M(void 0)},_errorSteps:()=>{f=!1}}),d(void 0))}function Wr(ue){if(b=!0,T=ue,w){let he=dn([T,O]),$e=We(n,he);M($e)}return G}function Nt(ue){if(w=!0,O=ue,b){let he=dn([T,O]),$e=We(n,he);M($e)}return G}function ht(){}return E=bn(ht,qe,Wr),D=bn(ht,qe,Nt),v(l._closedPromise,ue=>(je(E._readableStreamController,ue),je(D._readableStreamController,ue),(!b||!w)&&M(void 0),null)),[E,D]}function Ef(n){let o=Ir(n),l=!1,f=!1,m=!1,b=!1,w=!1,T,O,E,D,M,G=p(A=>{M=A});function qe(A){v(A._closedPromise,j=>(A!==o||(Ae(E._readableStreamController,j),Ae(D._readableStreamController,j),(!b||!w)&&M(void 0)),null))}function Wr(){Yt(o)&&(ct(o),o=Ir(n),qe(o)),un(o,{_chunkSteps:j=>{W(()=>{f=!1,m=!1;let J=j,_e=j;if(!b&&!w)try{_e=ji(j)}catch(qr){Ae(E._readableStreamController,qr),Ae(D._readableStreamController,qr),M(We(n,qr));return}b||na(E._readableStreamController,J),w||na(D._readableStreamController,_e),l=!1,f?ht():m&&ue()})},_closeSteps:()=>{l=!1,b||fn(E._readableStreamController),w||fn(D._readableStreamController),E._readableStreamController._pendingPullIntos.length>0&&aa(E._readableStreamController,0),D._readableStreamController._pendingPullIntos.length>0&&aa(D._readableStreamController,0),(!b||!w)&&M(void 0)},_errorSteps:()=>{l=!1}})}function Nt(A,j){Et(o)&&(ct(o),o=Ki(n),qe(o));let J=j?D:E,_e=j?E:D;tc(o,A,1,{_chunkSteps:Br=>{W(()=>{f=!1,m=!1;let Ur=j?w:b;if(j?b:w)Ur||sa(J._readableStreamController,Br);else{let Mc;try{Mc=ji(Br)}catch(no){Ae(J._readableStreamController,no),Ae(_e._readableStreamController,no),M(We(n,no));return}Ur||sa(J._readableStreamController,Br),na(_e._readableStreamController,Mc)}l=!1,f?ht():m&&ue()})},_closeSteps:Br=>{l=!1;let Ur=j?w:b,Ca=j?b:w;Ur||fn(J._readableStreamController),Ca||fn(_e._readableStreamController),Br!==void 0&&(Ur||sa(J._readableStreamController,Br),!Ca&&_e._readableStreamController._pendingPullIntos.length>0&&aa(_e._readableStreamController,0)),(!Ur||!Ca)&&M(void 0)},_errorSteps:()=>{l=!1}})}function ht(){if(l)return f=!0,d(void 0);l=!0;let A=Fs(E._readableStreamController);return A===null?Wr():Nt(A._view,!1),d(void 0)}function ue(){if(l)return m=!0,d(void 0);l=!0;let A=Fs(D._readableStreamController);return A===null?Wr():Nt(A._view,!0),d(void 0)}function he(A){if(b=!0,T=A,w){let j=dn([T,O]),J=We(n,j);M(J)}return G}function $e(A){if(w=!0,O=A,b){let j=dn([T,O]),J=We(n,j);M(J)}return G}function mt(){}return E=xc(mt,ht,he),D=xc(mt,ue,$e),qe(o),[E,D]}function Af(n){return r(n)&&typeof n.getReader<"u"}function $f(n){return Af(n)?If(n.getReader()):Pf(n)}function Pf(n){let o,l=Fi(n,"async"),f=e;function m(){let w;try{w=kd(l)}catch(O){return g(O)}let T=d(w);return z(T,O=>{if(!r(O))throw new TypeError("The promise returned by the iterator.next() method must fulfill with an object");if(Sd(O))Xt(o._readableStreamController);else{let D=xd(O);Mr(o._readableStreamController,D)}})}function b(w){let T=l.iterator,O;try{O=ea(T,"return")}catch(M){return g(M)}if(O===void 0)return d(void 0);let E;try{E=Y(O,T,[w])}catch(M){return g(M)}let D=d(E);return z(D,M=>{if(!r(M))throw new TypeError("The promise returned by the iterator.return() method must fulfill with an object")})}return o=bn(f,m,b,0),o}function If(n){let o,l=e;function f(){let b;try{b=n.read()}catch(w){return g(w)}return z(b,w=>{if(!r(w))throw new TypeError("The promise returned by the reader.read() method must fulfill with an object");if(w.done)Xt(o._readableStreamController);else{let T=w.value;Mr(o._readableStreamController,T)}})}function m(b){try{return d(n.cancel(b))}catch(w){return g(w)}}return o=bn(l,f,m,0),o}function Of(n,o){Qe(n,o);let l=n,f=l?.autoAllocateChunkSize,m=l?.cancel,b=l?.pull,w=l?.start,T=l?.type;return{autoAllocateChunkSize:f===void 0?void 0:Ts(f,`${o} has member 'autoAllocateChunkSize' that`),cancel:m===void 0?void 0:Df(m,l,`${o} has member 'cancel' that`),pull:b===void 0?void 0:Lf(b,l,`${o} has member 'pull' that`),start:w===void 0?void 0:Nf(w,l,`${o} has member 'start' that`),type:T===void 0?void 0:Mf(T,`${o} has member 'type' that`)}}function Df(n,o,l){return Ee(n,l),f=>ne(n,o,[f])}function Lf(n,o,l){return Ee(n,l),f=>ne(n,o,[f])}function Nf(n,o,l){return Ee(n,l),f=>Y(n,o,[f])}function Mf(n,o){if(n=`${n}`,n!=="bytes")throw new TypeError(`${o} '${n}' is not a valid enumeration value for ReadableStreamType`);return n}function Ff(n,o){return Qe(n,o),{preventCancel:!!n?.preventCancel}}function Sc(n,o){Qe(n,o);let l=n?.preventAbort,f=n?.preventCancel,m=n?.preventClose,b=n?.signal;return b!==void 0&&jf(b,`${o} has member 'signal' that`),{preventAbort:!!l,preventCancel:!!f,preventClose:!!m,signal:b}}function jf(n,o){if(!Vd(n))throw new TypeError(`${o} is not an AbortSignal.`)}function Wf(n,o){Qe(n,o);let l=n?.readable;xs(l,"readable","ReadableWritablePair"),Cs(l,`${o} has member 'readable' that`);let f=n?.writable;return xs(f,"writable","ReadableWritablePair"),nc(f,`${o} has member 'writable' that`),{readable:l,writable:f}}class oe{constructor(o={},l={}){o===void 0?o=null:Ci(o,"First parameter");let f=ca(l,"Second parameter"),m=Of(o,"First parameter");if(Xs(this),m.type==="bytes"){if(f.size!==void 0)throw new RangeError("The strategy for a byte stream cannot have a size function");let b=hn(f,0);Od(this,m,b)}else{let b=ia(f),w=hn(f,1);Tf(this,m,w,b)}}get locked(){if(!Ot(this))throw er("locked");return Dt(this)}cancel(o=void 0){return Ot(this)?Dt(this)?g(new TypeError("Cannot cancel a stream that already has a reader")):We(this,o):g(er("cancel"))}getReader(o=void 0){if(!Ot(this))throw er("getReader");return Ld(o,"First parameter").mode===void 0?Ir(this):Ki(this)}pipeThrough(o,l={}){if(!Ot(this))throw er("pipeThrough");lt(o,1,"pipeThrough");let f=Wf(o,"First parameter"),m=Sc(l,"Second parameter");if(Dt(this))throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked ReadableStream");if(Lr(f.writable))throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked WritableStream");let b=wc(this,f.writable,m.preventClose,m.preventAbort,m.preventCancel,m.signal);return q(b),f.readable}pipeTo(o,l={}){if(!Ot(this))return g(er("pipeTo"));if(o===void 0)return g("Parameter 1 is required in 'pipeTo'.");if(!Dr(o))return g(new TypeError("ReadableStream.prototype.pipeTo's first argument must be a WritableStream"));let f;try{f=Sc(l,"Second parameter")}catch(m){return g(m)}return Dt(this)?g(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked ReadableStream")):Lr(o)?g(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked WritableStream")):wc(this,o,f.preventClose,f.preventAbort,f.preventCancel,f.signal)}tee(){if(!Ot(this))throw er("tee");let o=Cf(this);return dn(o)}values(o=void 0){if(!Ot(this))throw er("values");let l=Ff(o,"First parameter");return wd(this,l.preventCancel)}[Ps](o){return this.values(o)}static from(o){return $f(o)}}Object.defineProperties(oe,{from:{enumerable:!0}}),Object.defineProperties(oe.prototype,{cancel:{enumerable:!0},getReader:{enumerable:!0},pipeThrough:{enumerable:!0},pipeTo:{enumerable:!0},tee:{enumerable:!0},values:{enumerable:!0},locked:{enumerable:!0}}),s(oe.from,"from"),s(oe.prototype.cancel,"cancel"),s(oe.prototype.getReader,"getReader"),s(oe.prototype.pipeThrough,"pipeThrough"),s(oe.prototype.pipeTo,"pipeTo"),s(oe.prototype.tee,"tee"),s(oe.prototype.values,"values"),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(oe.prototype,Symbol.toStringTag,{value:"ReadableStream",configurable:!0}),Object.defineProperty(oe.prototype,Ps,{value:oe.prototype.values,writable:!0,configurable:!0});function bn(n,o,l,f=1,m=()=>1){let b=Object.create(oe.prototype);Xs(b);let w=Object.create(pt.prototype);return kc(b,w,n,o,l,f,m),b}function xc(n,o,l){let f=Object.create(oe.prototype);Xs(f);let m=Object.create(dt.prototype);return Qi(f,m,n,o,l,0,void 0),f}function Xs(n){n._state="readable",n._reader=void 0,n._storedError=void 0,n._disturbed=!1}function Ot(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_readableStreamController")?!1:n instanceof oe}function Dt(n){return n._reader!==void 0}function We(n,o){if(n._disturbed=!0,n._state==="closed")return d(void 0);if(n._state==="errored")return g(n._storedError);wn(n);let l=n._reader;if(l!==void 0&&Yt(l)){let m=l._readIntoRequests;l._readIntoRequests=new H,m.forEach(b=>{b._closeSteps(void 0)})}let f=n._readableStreamController[ln](o);return z(f,e)}function wn(n){n._state="closed";let o=n._reader;if(o!==void 0&&(vi(o),Et(o))){let l=o._readRequests;o._readRequests=new H,l.forEach(f=>{f._closeSteps()})}}function vc(n,o){n._state="errored",n._storedError=o;let l=n._reader;l!==void 0&&(Ss(l,o),Et(l)?$i(l,o):rc(l,o))}function er(n){return new TypeError(`ReadableStream.prototype.${n} can only be used on a ReadableStream`)}function Tc(n,o){Qe(n,o);let l=n?.highWaterMark;return xs(l,"highWaterMark","QueuingStrategyInit"),{highWaterMark:vs(l)}}let Cc=n=>n.byteLength;s(Cc,"size");class wa{constructor(o){lt(o,1,"ByteLengthQueuingStrategy"),o=Tc(o,"First parameter"),this._byteLengthQueuingStrategyHighWaterMark=o.highWaterMark}get highWaterMark(){if(!Ec(this))throw Rc("highWaterMark");return this._byteLengthQueuingStrategyHighWaterMark}get size(){if(!Ec(this))throw Rc("size");return Cc}}Object.defineProperties(wa.prototype,{highWaterMark:{enumerable:!0},size:{enumerable:!0}}),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(wa.prototype,Symbol.toStringTag,{value:"ByteLengthQueuingStrategy",configurable:!0});function Rc(n){return new TypeError(`ByteLengthQueuingStrategy.prototype.${n} can only be used on a ByteLengthQueuingStrategy`)}function Ec(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_byteLengthQueuingStrategyHighWaterMark")?!1:n instanceof wa}let Ac=()=>1;s(Ac,"size");class _a{constructor(o){lt(o,1,"CountQueuingStrategy"),o=Tc(o,"First parameter"),this._countQueuingStrategyHighWaterMark=o.highWaterMark}get highWaterMark(){if(!Pc(this))throw $c("highWaterMark");return this._countQueuingStrategyHighWaterMark}get size(){if(!Pc(this))throw $c("size");return Ac}}Object.defineProperties(_a.prototype,{highWaterMark:{enumerable:!0},size:{enumerable:!0}}),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(_a.prototype,Symbol.toStringTag,{value:"CountQueuingStrategy",configurable:!0});function $c(n){return new TypeError(`CountQueuingStrategy.prototype.${n} can only be used on a CountQueuingStrategy`)}function Pc(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_countQueuingStrategyHighWaterMark")?!1:n instanceof _a}function qf(n,o){Qe(n,o);let l=n?.cancel,f=n?.flush,m=n?.readableType,b=n?.start,w=n?.transform,T=n?.writableType;return{cancel:l===void 0?void 0:Hf(l,n,`${o} has member 'cancel' that`),flush:f===void 0?void 0:Bf(f,n,`${o} has member 'flush' that`),readableType:m,start:b===void 0?void 0:Uf(b,n,`${o} has member 'start' that`),transform:w===void 0?void 0:zf(w,n,`${o} has member 'transform' that`),writableType:T}}function Bf(n,o,l){return Ee(n,l),f=>ne(n,o,[f])}function Uf(n,o,l){return Ee(n,l),f=>Y(n,o,[f])}function zf(n,o,l){return Ee(n,l),(f,m)=>ne(n,o,[f,m])}function Hf(n,o,l){return Ee(n,l),f=>ne(n,o,[f])}class ka{constructor(o={},l={},f={}){o===void 0&&(o=null);let m=ca(l,"Second parameter"),b=ca(f,"Third parameter"),w=qf(o,"First parameter");if(w.readableType!==void 0)throw new RangeError("Invalid readableType specified");if(w.writableType!==void 0)throw new RangeError("Invalid writableType specified");let T=hn(b,0),O=ia(b),E=hn(m,1),D=ia(m),M,G=p(qe=>{M=qe});Vf(this,G,E,D,T,O),Jf(this,w),w.start!==void 0?M(w.start(this._transformStreamController)):M(void 0)}get readable(){if(!Ic(this))throw Nc("readable");return this._readable}get writable(){if(!Ic(this))throw Nc("writable");return this._writable}}Object.defineProperties(ka.prototype,{readable:{enumerable:!0},writable:{enumerable:!0}}),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(ka.prototype,Symbol.toStringTag,{value:"TransformStream",configurable:!0});function Vf(n,o,l,f,m,b){function w(){return o}function T(G){return Qf(n,G)}function O(G){return Kf(n,G)}function E(){return Xf(n)}n._writable=Zd(w,T,E,O,l,f);function D(){return ep(n)}function M(G){return tp(n,G)}n._readable=bn(w,D,M,m,b),n._backpressure=void 0,n._backpressureChangePromise=void 0,n._backpressureChangePromise_resolve=void 0,Sa(n,!0),n._transformStreamController=void 0}function Ic(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_transformStreamController")?!1:n instanceof ka}function Oc(n,o){je(n._readable._readableStreamController,o),eo(n,o)}function eo(n,o){va(n._transformStreamController),mn(n._writable._writableStreamController,o),to(n)}function to(n){n._backpressure&&Sa(n,!1)}function Sa(n,o){n._backpressureChangePromise!==void 0&&n._backpressureChangePromise_resolve(),n._backpressureChangePromise=p(l=>{n._backpressureChangePromise_resolve=l}),n._backpressure=o}class Lt{constructor(){throw new TypeError("Illegal constructor")}get desiredSize(){if(!xa(this))throw Ta("desiredSize");let o=this._controlledTransformStream._readable._readableStreamController;return Ks(o)}enqueue(o=void 0){if(!xa(this))throw Ta("enqueue");Dc(this,o)}error(o=void 0){if(!xa(this))throw Ta("error");Zf(this,o)}terminate(){if(!xa(this))throw Ta("terminate");Yf(this)}}Object.defineProperties(Lt.prototype,{enqueue:{enumerable:!0},error:{enumerable:!0},terminate:{enumerable:!0},desiredSize:{enumerable:!0}}),s(Lt.prototype.enqueue,"enqueue"),s(Lt.prototype.error,"error"),s(Lt.prototype.terminate,"terminate"),typeof Symbol.toStringTag=="symbol"&&Object.defineProperty(Lt.prototype,Symbol.toStringTag,{value:"TransformStreamDefaultController",configurable:!0});function xa(n){return!r(n)||!Object.prototype.hasOwnProperty.call(n,"_controlledTransformStream")?!1:n instanceof Lt}function Gf(n,o,l,f,m){o._controlledTransformStream=n,n._transformStreamController=o,o._transformAlgorithm=l,o._flushAlgorithm=f,o._cancelAlgorithm=m,o._finishPromise=void 0,o._finishPromise_resolve=void 0,o._finishPromise_reject=void 0}function Jf(n,o){let l=Object.create(Lt.prototype),f,m,b;o.transform!==void 0?f=w=>o.transform(w,l):f=w=>{try{return Dc(l,w),d(void 0)}catch(T){return g(T)}},o.flush!==void 0?m=()=>o.flush(l):m=()=>d(void 0),o.cancel!==void 0?b=w=>o.cancel(w):b=()=>d(void 0),Gf(n,l,f,m,b)}function va(n){n._transformAlgorithm=void 0,n._flushAlgorithm=void 0,n._cancelAlgorithm=void 0}function Dc(n,o){let l=n._controlledTransformStream,f=l._readable._readableStreamController;if(!Fr(f))throw new TypeError("Readable side is not in a state that permits enqueue");try{Mr(f,o)}catch(b){throw eo(l,b),l._readable._storedError}vf(f)!==l._backpressure&&Sa(l,!0)}function Zf(n,o){Oc(n._controlledTransformStream,o)}function Lc(n,o){let l=n._transformAlgorithm(o);return z(l,void 0,f=>{throw Oc(n._controlledTransformStream,f),f})}function Yf(n){let o=n._controlledTransformStream,l=o._readable._readableStreamController;Xt(l);let f=new TypeError("TransformStream terminated");eo(o,f)}function Qf(n,o){let l=n._transformStreamController;if(n._backpressure){let f=n._backpressureChangePromise;return z(f,()=>{let m=n._writable;if(m._state==="erroring")throw m._storedError;return Lc(l,o)})}return Lc(l,o)}function Kf(n,o){let l=n._transformStreamController;if(l._finishPromise!==void 0)return l._finishPromise;let f=n._readable;l._finishPromise=p((b,w)=>{l._finishPromise_resolve=b,l._finishPromise_reject=w});let m=l._cancelAlgorithm(o);return va(l),x(m,()=>(f._state==="errored"?jr(l,f._storedError):(je(f._readableStreamController,o),ro(l)),null),b=>(je(f._readableStreamController,b),jr(l,b),null)),l._finishPromise}function Xf(n){let o=n._transformStreamController;if(o._finishPromise!==void 0)return o._finishPromise;let l=n._readable;o._finishPromise=p((m,b)=>{o._finishPromise_resolve=m,o._finishPromise_reject=b});let f=o._flushAlgorithm();return va(o),x(f,()=>(l._state==="errored"?jr(o,l._storedError):(Xt(l._readableStreamController),ro(o)),null),m=>(je(l._readableStreamController,m),jr(o,m),null)),o._finishPromise}function ep(n){return Sa(n,!1),n._backpressureChangePromise}function tp(n,o){let l=n._transformStreamController;if(l._finishPromise!==void 0)return l._finishPromise;let f=n._writable;l._finishPromise=p((b,w)=>{l._finishPromise_resolve=b,l._finishPromise_reject=w});let m=l._cancelAlgorithm(o);return va(l),x(m,()=>(f._state==="errored"?jr(l,f._storedError):(mn(f._writableStreamController,o),to(n),ro(l)),null),b=>(mn(f._writableStreamController,b),to(n),jr(l,b),null)),l._finishPromise}function Ta(n){return new TypeError(`TransformStreamDefaultController.prototype.${n} can only be used on a TransformStreamDefaultController`)}function ro(n){n._finishPromise_resolve!==void 0&&(n._finishPromise_resolve(),n._finishPromise_resolve=void 0,n._finishPromise_reject=void 0)}function jr(n,o){n._finishPromise_reject!==void 0&&(q(n._finishPromise),n._finishPromise_reject(o),n._finishPromise_resolve=void 0,n._finishPromise_reject=void 0)}function Nc(n){return new TypeError(`TransformStream.prototype.${n} can only be used on a TransformStream`)}t.ByteLengthQueuingStrategy=wa,t.CountQueuingStrategy=_a,t.ReadableByteStreamController=dt,t.ReadableStream=oe,t.ReadableStreamBYOBReader=Pt,t.ReadableStreamBYOBRequest=Gt,t.ReadableStreamDefaultController=pt,t.ReadableStreamDefaultReader=Rt,t.TransformStream=ka,t.TransformStreamDefaultController=Lt,t.WritableStream=It,t.WritableStreamDefaultController=Nr,t.WritableStreamDefaultWriter=ft}))});var dl=so(()=>{if(!globalThis.ReadableStream)try{let t=require("node:process"),{emitWarning:e}=t;try{t.emitWarning=()=>{},Object.assign(globalThis,require("node:stream/web")),t.emitWarning=e}catch(r){throw t.emitWarning=e,r}}catch{Object.assign(globalThis,ul())}try{let{Blob:t}=require("buffer");t&&!t.prototype.stream&&(t.prototype.stream=function(r){let a=0,s=this;return new ReadableStream({type:"bytes",async pull(i){let u=await s.slice(a,Math.min(s.size,a+65536)).arrayBuffer();a+=u.byteLength,i.enqueue(new Uint8Array(u)),a===s.size&&i.close()}})})}catch{}});async function*_o(t,e=!0){for(let r of t)if("stream"in r)yield*r.stream();else if(ArrayBuffer.isView(r))if(e){let a=r.byteOffset,s=r.byteOffset+r.byteLength;for(;a!==s;){let i=Math.min(s-a,fl),c=r.buffer.slice(a,a+i);a+=c.byteLength,yield new Uint8Array(c)}}else yield r;else{let a=0,s=r;for(;a!==s.size;){let c=await s.slice(a,Math.min(s.size,a+fl)).arrayBuffer();a+=c.byteLength,yield new Uint8Array(c)}}}var Ow,fl,pl,cm,Ve,Tn=B(()=>{Ow=Be(dl(),1);fl=65536;pl=class ko{#e=[];#t="";#r=0;#n="transparent";constructor(e=[],r={}){if(typeof e!="object"||e===null)throw new TypeError("Failed to construct 'Blob': The provided value cannot be converted to a sequence.");if(typeof e[Symbol.iterator]!="function")throw new TypeError("Failed to construct 'Blob': The object must have a callable @@iterator property.");if(typeof r!="object"&&typeof r!="function")throw new TypeError("Failed to construct 'Blob': parameter 2 cannot convert to dictionary.");r===null&&(r={});let a=new TextEncoder;for(let i of e){let c;ArrayBuffer.isView(i)?c=new Uint8Array(i.buffer.slice(i.byteOffset,i.byteOffset+i.byteLength)):i instanceof ArrayBuffer?c=new Uint8Array(i.slice(0)):i instanceof ko?c=i:c=a.encode(`${i}`),this.#r+=ArrayBuffer.isView(c)?c.byteLength:c.size,this.#e.push(c)}this.#n=`${r.endings===void 0?"transparent":r.endings}`;let s=r.type===void 0?"":String(r.type);this.#t=/^[\x20-\x7E]*$/.test(s)?s:""}get size(){return this.#r}get type(){return this.#t}async text(){let e=new TextDecoder,r="";for await(let a of _o(this.#e,!1))r+=e.decode(a,{stream:!0});return r+=e.decode(),r}async arrayBuffer(){let e=new Uint8Array(this.size),r=0;for await(let a of _o(this.#e,!1))e.set(a,r),r+=a.length;return e.buffer}stream(){let e=_o(this.#e,!0);return new globalThis.ReadableStream({type:"bytes",async pull(r){let a=await e.next();a.done?r.close():r.enqueue(a.value)},async cancel(){await e.return()}})}slice(e=0,r=this.size,a=""){let{size:s}=this,i=e<0?Math.max(s+e,0):Math.min(e,s),c=r<0?Math.max(s+r,0):Math.min(r,s),u=Math.max(c-i,0),p=this.#e,d=[],g=0;for(let x of p){if(g>=u)break;let P=ArrayBuffer.isView(x)?x.byteLength:x.size;if(i&&P<=i)i-=P,c-=P;else{let v;ArrayBuffer.isView(x)?(v=x.subarray(i,Math.min(P,c)),g+=v.byteLength):(v=x.slice(i,Math.min(P,c)),g+=v.size),c-=P,d.push(v),i=0}}let k=new ko([],{type:String(a).toLowerCase()});return k.#r=u,k.#e=d,k}get[Symbol.toStringTag](){return"Blob"}static[Symbol.hasInstance](e){return e&&typeof e=="object"&&typeof e.constructor=="function"&&(typeof e.stream=="function"||typeof e.arrayBuffer=="function")&&/^(Blob|File)$/.test(e[Symbol.toStringTag])}};Object.defineProperties(pl.prototype,{size:{enumerable:!0},type:{enumerable:!0},slice:{enumerable:!0}});cm=pl,Ve=cm});var lm,um,qt,So=B(()=>{Tn();lm=class extends Ve{#e=0;#t="";constructor(e,r,a={}){if(arguments.length<2)throw new TypeError(`Failed to construct 'File': 2 arguments required, but only ${arguments.length} present.`);super(e,a),a===null&&(a={});let s=a.lastModified===void 0?Date.now():Number(a.lastModified);Number.isNaN(s)||(this.#e=s),this.#t=String(r)}get name(){return this.#t}get lastModified(){return this.#e}get[Symbol.toStringTag](){return"File"}static[Symbol.hasInstance](e){return!!e&&e instanceof Ve&&/^(File)$/.test(e[Symbol.toStringTag])}},um=lm,qt=um});function gl(t,e=Ve){var r=`${hl()}${hl()}`.replace(/\./g,"").slice(-28).padStart(32,"-"),a=[],s=`--${r}\r
Content-Disposition: form-data; name="`;return t.forEach((i,c)=>typeof i=="string"?a.push(s+xo(c)+`"\r
\r
${i.replace(/\r(?!\n)|(?<!\r)\n/g,`\r
`)}\r
`):a.push(s+xo(c)+`"; filename="${xo(i.name,1)}"\r
Content-Type: ${i.type||"application/octet-stream"}\r
\r
`,i,`\r
`)),a.push(`--${r}--`),new e(a,{type:"multipart/form-data; boundary="+r})}var Cn,dm,fm,hl,pm,ml,xo,yr,Bt,Ga=B(()=>{Tn();So();({toStringTag:Cn,iterator:dm,hasInstance:fm}=Symbol),hl=Math.random,pm="append,set,get,getAll,delete,keys,values,entries,forEach,constructor".split(","),ml=(t,e,r)=>(t+="",/^(Blob|File)$/.test(e&&e[Cn])?[(r=r!==void 0?r+"":e[Cn]=="File"?e.name:"blob",t),e.name!==r||e[Cn]=="blob"?new qt([e],r,e):e]:[t,e+""]),xo=(t,e)=>(e?t:t.replace(/\r?\n|\r/g,`\r
`)).replace(/\n/g,"%0A").replace(/\r/g,"%0D").replace(/"/g,"%22"),yr=(t,e,r)=>{if(e.length<r)throw new TypeError(`Failed to execute '${t}' on 'FormData': ${r} arguments required, but only ${e.length} present.`)},Bt=class{#e=[];constructor(...e){if(e.length)throw new TypeError("Failed to construct 'FormData': parameter 1 is not of type 'HTMLFormElement'.")}get[Cn](){return"FormData"}[dm](){return this.entries()}static[fm](e){return e&&typeof e=="object"&&e[Cn]==="FormData"&&!pm.some(r=>typeof e[r]!="function")}append(...e){yr("append",arguments,2),this.#e.push(ml(...e))}delete(e){yr("delete",arguments,1),e+="",this.#e=this.#e.filter(([r])=>r!==e)}get(e){yr("get",arguments,1),e+="";for(var r=this.#e,a=r.length,s=0;s<a;s++)if(r[s][0]===e)return r[s][1];return null}getAll(e,r){return yr("getAll",arguments,1),r=[],e+="",this.#e.forEach(a=>a[0]===e&&r.push(a[1])),r}has(e){return yr("has",arguments,1),e+="",this.#e.some(r=>r[0]===e)}forEach(e,r){yr("forEach",arguments,1);for(var[a,s]of this)e.call(r,s,a,this)}set(...e){yr("set",arguments,2);var r=[],a=!0;e=ml(...e),this.#e.forEach(s=>{s[0]===e[0]?a&&(a=!r.push(e)):r.push(s)}),a&&r.push(e),this.#e=r}*entries(){yield*this.#e}*keys(){for(var[e]of this)yield e}*values(){for(var[,e]of this)yield e}}});var _t,Ja=B(()=>{_t=class extends Error{constructor(e,r){super(e),Error.captureStackTrace(this,this.constructor),this.type=r}get name(){return this.constructor.name}get[Symbol.toStringTag](){return this.constructor.name}}});var de,vo=B(()=>{Ja();de=class extends _t{constructor(e,r,a){super(e,r),a&&(this.code=this.errno=a.code,this.erroredSysCall=a.syscall)}}});var Za,To,Rn,yl,bl,wl,Ya=B(()=>{Za=Symbol.toStringTag,To=t=>typeof t=="object"&&typeof t.append=="function"&&typeof t.delete=="function"&&typeof t.get=="function"&&typeof t.getAll=="function"&&typeof t.has=="function"&&typeof t.set=="function"&&typeof t.sort=="function"&&t[Za]==="URLSearchParams",Rn=t=>t&&typeof t=="object"&&typeof t.arrayBuffer=="function"&&typeof t.type=="string"&&typeof t.stream=="function"&&typeof t.constructor=="function"&&/^(Blob|File)$/.test(t[Za]),yl=t=>typeof t=="object"&&(t[Za]==="AbortSignal"||t[Za]==="EventTarget"),bl=(t,e)=>{let r=new URL(e).hostname,a=new URL(t).hostname;return r===a||r.endsWith(`.${a}`)},wl=(t,e)=>{let r=new URL(e).protocol,a=new URL(t).protocol;return r===a}});var kl=so((Vw,_l)=>{if(!globalThis.DOMException)try{let{MessageChannel:t}=require("worker_threads"),e=new t().port1,r=new ArrayBuffer;e.postMessage(r,[r,r])}catch(t){t.constructor.name==="DOMException"&&(globalThis.DOMException=t.constructor)}_l.exports=globalThis.DOMException});var br,Sl,xl,Co,vl,Tl,Cl,Rl,El,Al,Qa,Ro=B(()=>{br=require("node:fs"),Sl=require("node:path"),xl=Be(kl(),1);So();Tn();({stat:Co}=br.promises),vl=(t,e)=>El((0,br.statSync)(t),t,e),Tl=(t,e)=>Co(t).then(r=>El(r,t,e)),Cl=(t,e)=>Co(t).then(r=>Al(r,t,e)),Rl=(t,e)=>Al((0,br.statSync)(t),t,e),El=(t,e,r="")=>new Ve([new Qa({path:e,size:t.size,lastModified:t.mtimeMs,start:0})],{type:r}),Al=(t,e,r="")=>new qt([new Qa({path:e,size:t.size,lastModified:t.mtimeMs,start:0})],(0,Sl.basename)(e),{type:r,lastModified:t.mtimeMs}),Qa=class t{#e;#t;constructor(e){this.#e=e.path,this.#t=e.start,this.size=e.size,this.lastModified=e.lastModified}slice(e,r){return new t({path:this.#e,lastModified:this.lastModified,size:r-e,start:this.#t+e})}async*stream(){let{mtimeMs:e}=await Co(this.#e);if(e>this.lastModified)throw new xl.default("The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.","NotReadableError");yield*(0,br.createReadStream)(this.#e,{start:this.#t,end:this.#t+this.size-1})}get[Symbol.toStringTag](){return"Blob"}}});var Pl={};Pe(Pl,{toFormData:()=>_m});function wm(t){let e=t.match(/\bfilename=("(.*?)"|([^()<>@,;:\\"/[\]?={}\s\t]+))($|;\s)/i);if(!e)return;let r=e[2]||e[3]||"",a=r.slice(r.lastIndexOf("\\")+1);return a=a.replace(/%22/g,'"'),a=a.replace(/&#(\d{4});/g,(s,i)=>String.fromCharCode(i)),a}async function _m(t,e){if(!/multipart/i.test(e))throw new TypeError("Failed to fetch");let r=e.match(/boundary=(?:"([^"]+)"|([^;]+))/i);if(!r)throw new TypeError("no or bad content-type header, no multipart boundary");let a=new Eo(r[1]||r[2]),s,i,c,u,p,d,g=[],k=new Bt,x=W=>{c+=q.decode(W,{stream:!0})},P=W=>{g.push(W)},v=()=>{let W=new qt(g,d,{type:p});k.append(u,W)},z=()=>{k.append(u,c)},q=new TextDecoder("utf-8");q.decode(),a.onPartBegin=function(){a.onPartData=x,a.onPartEnd=z,s="",i="",c="",u="",p="",d=null,g.length=0},a.onHeaderField=function(W){s+=q.decode(W,{stream:!0})},a.onHeaderValue=function(W){i+=q.decode(W,{stream:!0})},a.onHeaderEnd=function(){if(i+=q.decode(),s=s.toLowerCase(),s==="content-disposition"){let W=i.match(/\bname=("([^"]*)"|([^()<>@,;:\\"/[\]?={}\s\t]+))/i);W&&(u=W[2]||W[3]||""),d=wm(i),d&&(a.onPartData=P,a.onPartEnd=v)}else s==="content-type"&&(p=i);i="",s=""};for await(let W of t)a.write(W);return a.end(),k}var nt,Z,$l,Ut,Ka,Xa,hm,En,mm,gm,ym,bm,wr,Eo,Il=B(()=>{Ro();Ga();nt=0,Z={START_BOUNDARY:nt++,HEADER_FIELD_START:nt++,HEADER_FIELD:nt++,HEADER_VALUE_START:nt++,HEADER_VALUE:nt++,HEADER_VALUE_ALMOST_DONE:nt++,HEADERS_ALMOST_DONE:nt++,PART_DATA_START:nt++,PART_DATA:nt++,END:nt++},$l=1,Ut={PART_BOUNDARY:$l,LAST_BOUNDARY:$l*=2},Ka=10,Xa=13,hm=32,En=45,mm=58,gm=97,ym=122,bm=t=>t|32,wr=()=>{},Eo=class{constructor(e){this.index=0,this.flags=0,this.onHeaderEnd=wr,this.onHeaderField=wr,this.onHeadersEnd=wr,this.onHeaderValue=wr,this.onPartBegin=wr,this.onPartData=wr,this.onPartEnd=wr,this.boundaryChars={},e=`\r
--`+e;let r=new Uint8Array(e.length);for(let a=0;a<e.length;a++)r[a]=e.charCodeAt(a),this.boundaryChars[r[a]]=!0;this.boundary=r,this.lookbehind=new Uint8Array(this.boundary.length+8),this.state=Z.START_BOUNDARY}write(e){let r=0,a=e.length,s=this.index,{lookbehind:i,boundary:c,boundaryChars:u,index:p,state:d,flags:g}=this,k=this.boundary.length,x=k-1,P=e.length,v,z,q=U=>{this[U+"Mark"]=r},W=U=>{delete this[U+"Mark"]},Y=(U,H,Q,Ct)=>{(H===void 0||H!==Q)&&this[U](Ct&&Ct.subarray(H,Q))},ne=(U,H)=>{let Q=U+"Mark";Q in this&&(H?(Y(U,this[Q],r,e),delete this[Q]):(Y(U,this[Q],e.length,e),this[Q]=0))};for(r=0;r<a;r++)switch(v=e[r],d){case Z.START_BOUNDARY:if(p===c.length-2){if(v===En)g|=Ut.LAST_BOUNDARY;else if(v!==Xa)return;p++;break}else if(p-1===c.length-2){if(g&Ut.LAST_BOUNDARY&&v===En)d=Z.END,g=0;else if(!(g&Ut.LAST_BOUNDARY)&&v===Ka)p=0,Y("onPartBegin"),d=Z.HEADER_FIELD_START;else return;break}v!==c[p+2]&&(p=-2),v===c[p+2]&&p++;break;case Z.HEADER_FIELD_START:d=Z.HEADER_FIELD,q("onHeaderField"),p=0;case Z.HEADER_FIELD:if(v===Xa){W("onHeaderField"),d=Z.HEADERS_ALMOST_DONE;break}if(p++,v===En)break;if(v===mm){if(p===1)return;ne("onHeaderField",!0),d=Z.HEADER_VALUE_START;break}if(z=bm(v),z<gm||z>ym)return;break;case Z.HEADER_VALUE_START:if(v===hm)break;q("onHeaderValue"),d=Z.HEADER_VALUE;case Z.HEADER_VALUE:v===Xa&&(ne("onHeaderValue",!0),Y("onHeaderEnd"),d=Z.HEADER_VALUE_ALMOST_DONE);break;case Z.HEADER_VALUE_ALMOST_DONE:if(v!==Ka)return;d=Z.HEADER_FIELD_START;break;case Z.HEADERS_ALMOST_DONE:if(v!==Ka)return;Y("onHeadersEnd"),d=Z.PART_DATA_START;break;case Z.PART_DATA_START:d=Z.PART_DATA,q("onPartData");case Z.PART_DATA:if(s=p,p===0){for(r+=x;r<P&&!(e[r]in u);)r+=k;r-=x,v=e[r]}if(p<c.length)c[p]===v?(p===0&&ne("onPartData",!0),p++):p=0;else if(p===c.length)p++,v===Xa?g|=Ut.PART_BOUNDARY:v===En?g|=Ut.LAST_BOUNDARY:p=0;else if(p-1===c.length)if(g&Ut.PART_BOUNDARY){if(p=0,v===Ka){g&=~Ut.PART_BOUNDARY,Y("onPartEnd"),Y("onPartBegin"),d=Z.HEADER_FIELD_START;break}}else g&Ut.LAST_BOUNDARY&&v===En?(Y("onPartEnd"),d=Z.END,g=0):p=0;if(p>0)i[p-1]=v;else if(s>0){let U=new Uint8Array(i.buffer,i.byteOffset,i.byteLength);Y("onPartData",0,s,U),s=0,q("onPartData"),r--}break;case Z.END:break;default:throw new Error(`Unexpected state entered: ${d}`)}ne("onHeaderField"),ne("onHeaderValue"),ne("onPartData"),this.index=p,this.state=d,this.flags=g}end(){if(this.state===Z.HEADER_FIELD_START&&this.index===0||this.state===Z.PART_DATA&&this.index===this.boundary.length)this.onPartEnd();else if(this.state!==Z.END)throw new Error("MultipartParser.end(): stream ended unexpectedly")}}});async function Ao(t){if(t[ye].disturbed)throw new TypeError(`body used already for: ${t.url}`);if(t[ye].disturbed=!0,t[ye].error)throw t[ye].error;let{body:e}=t;if(e===null)return Se.Buffer.alloc(0);if(!(e instanceof Le.default))return Se.Buffer.alloc(0);let r=[],a=0;try{for await(let s of e){if(t.size>0&&a+s.length>t.size){let i=new de(`content size at ${t.url} over limit: ${t.size}`,"max-size");throw e.destroy(i),i}a+=s.length,r.push(s)}}catch(s){throw s instanceof _t?s:new de(`Invalid response body while trying to fetch ${t.url}: ${s.message}`,"system",s)}if(e.readableEnded===!0||e._readableState.ended===!0)try{return r.every(s=>typeof s=="string")?Se.Buffer.from(r.join("")):Se.Buffer.concat(r,a)}catch(s){throw new de(`Could not create Buffer from response body for ${t.url}: ${s.message}`,"system",s)}else throw new de(`Premature close of server response while trying to fetch ${t.url}`)}var Le,kt,Se,km,ye,at,Xr,Sm,es,Ol,Dl,ts=B(()=>{Le=Be(require("node:stream"),1),kt=require("node:util"),Se=require("node:buffer");Tn();Ga();vo();Ja();Ya();km=(0,kt.promisify)(Le.default.pipeline),ye=Symbol("Body internals"),at=class{constructor(e,{size:r=0}={}){let a=null;e===null?e=null:To(e)?e=Se.Buffer.from(e.toString()):Rn(e)||Se.Buffer.isBuffer(e)||(kt.types.isAnyArrayBuffer(e)?e=Se.Buffer.from(e):ArrayBuffer.isView(e)?e=Se.Buffer.from(e.buffer,e.byteOffset,e.byteLength):e instanceof Le.default||(e instanceof Bt?(e=gl(e),a=e.type.split("=")[1]):e=Se.Buffer.from(String(e))));let s=e;Se.Buffer.isBuffer(e)?s=Le.default.Readable.from(e):Rn(e)&&(s=Le.default.Readable.from(e.stream())),this[ye]={body:e,stream:s,boundary:a,disturbed:!1,error:null},this.size=r,e instanceof Le.default&&e.on("error",i=>{let c=i instanceof _t?i:new de(`Invalid response body while trying to fetch ${this.url}: ${i.message}`,"system",i);this[ye].error=c})}get body(){return this[ye].stream}get bodyUsed(){return this[ye].disturbed}async arrayBuffer(){let{buffer:e,byteOffset:r,byteLength:a}=await Ao(this);return e.slice(r,r+a)}async formData(){let e=this.headers.get("content-type");if(e.startsWith("application/x-www-form-urlencoded")){let a=new Bt,s=new URLSearchParams(await this.text());for(let[i,c]of s)a.append(i,c);return a}let{toFormData:r}=await Promise.resolve().then(()=>(Il(),Pl));return r(this.body,e)}async blob(){let e=this.headers&&this.headers.get("content-type")||this[ye].body&&this[ye].body.type||"",r=await this.arrayBuffer();return new Ve([r],{type:e})}async json(){let e=await this.text();return JSON.parse(e)}async text(){let e=await Ao(this);return new TextDecoder().decode(e)}buffer(){return Ao(this)}};at.prototype.buffer=(0,kt.deprecate)(at.prototype.buffer,"Please use 'response.arrayBuffer()' instead of 'response.buffer()'","node-fetch#buffer");Object.defineProperties(at.prototype,{body:{enumerable:!0},bodyUsed:{enumerable:!0},arrayBuffer:{enumerable:!0},blob:{enumerable:!0},json:{enumerable:!0},text:{enumerable:!0},data:{get:(0,kt.deprecate)(()=>{},"data doesn't exist, use json(), text(), arrayBuffer(), or body instead","https://github.com/node-fetch/node-fetch/issues/1000 (response)")}});Xr=(t,e)=>{let r,a,{body:s}=t[ye];if(t.bodyUsed)throw new Error("cannot clone body after it is used");return s instanceof Le.default&&typeof s.getBoundary!="function"&&(r=new Le.PassThrough({highWaterMark:e}),a=new Le.PassThrough({highWaterMark:e}),s.pipe(r),s.pipe(a),t[ye].stream=r,s=a),s},Sm=(0,kt.deprecate)(t=>t.getBoundary(),"form-data doesn't follow the spec and requires special treatment. Use alternative package","https://github.com/node-fetch/node-fetch/issues/1167"),es=(t,e)=>t===null?null:typeof t=="string"?"text/plain;charset=UTF-8":To(t)?"application/x-www-form-urlencoded;charset=UTF-8":Rn(t)?t.type||null:Se.Buffer.isBuffer(t)||kt.types.isAnyArrayBuffer(t)||ArrayBuffer.isView(t)?null:t instanceof Bt?`multipart/form-data; boundary=${e[ye].boundary}`:t&&typeof t.getBoundary=="function"?`multipart/form-data;boundary=${Sm(t)}`:t instanceof Le.default?null:"text/plain;charset=UTF-8",Ol=t=>{let{body:e}=t[ye];return e===null?0:Rn(e)?e.size:Se.Buffer.isBuffer(e)?e.length:e&&typeof e.getLengthSync=="function"&&e.hasKnownLength&&e.hasKnownLength()?e.getLengthSync():null},Dl=async(t,{body:e})=>{e===null?t.end():await km(e,t)}});function Ll(t=[]){return new be(t.reduce((e,r,a,s)=>(a%2===0&&e.push(s.slice(a,a+2)),e),[]).filter(([e,r])=>{try{return rs(e),Po(e,String(r)),!0}catch{return!1}}))}var $o,An,rs,Po,be,ns=B(()=>{$o=require("node:util"),An=Be(require("node:http"),1),rs=typeof An.default.validateHeaderName=="function"?An.default.validateHeaderName:t=>{if(!/^[\^`\-\w!#$%&'*+.|~]+$/.test(t)){let e=new TypeError(`Header name must be a valid HTTP token [${t}]`);throw Object.defineProperty(e,"code",{value:"ERR_INVALID_HTTP_TOKEN"}),e}},Po=typeof An.default.validateHeaderValue=="function"?An.default.validateHeaderValue:(t,e)=>{if(/[^\t\u0020-\u007E\u0080-\u00FF]/.test(e)){let r=new TypeError(`Invalid character in header content ["${t}"]`);throw Object.defineProperty(r,"code",{value:"ERR_INVALID_CHAR"}),r}},be=class t extends URLSearchParams{constructor(e){let r=[];if(e instanceof t){let a=e.raw();for(let[s,i]of Object.entries(a))r.push(...i.map(c=>[s,c]))}else if(e!=null)if(typeof e=="object"&&!$o.types.isBoxedPrimitive(e)){let a=e[Symbol.iterator];if(a==null)r.push(...Object.entries(e));else{if(typeof a!="function")throw new TypeError("Header pairs must be iterable");r=[...e].map(s=>{if(typeof s!="object"||$o.types.isBoxedPrimitive(s))throw new TypeError("Each header pair must be an iterable object");return[...s]}).map(s=>{if(s.length!==2)throw new TypeError("Each header pair must be a name/value tuple");return[...s]})}}else throw new TypeError("Failed to construct 'Headers': The provided value is not of type '(sequence<sequence<ByteString>> or record<ByteString, ByteString>)");return r=r.length>0?r.map(([a,s])=>(rs(a),Po(a,String(s)),[String(a).toLowerCase(),String(s)])):void 0,super(r),new Proxy(this,{get(a,s,i){switch(s){case"append":case"set":return(c,u)=>(rs(c),Po(c,String(u)),URLSearchParams.prototype[s].call(a,String(c).toLowerCase(),String(u)));case"delete":case"has":case"getAll":return c=>(rs(c),URLSearchParams.prototype[s].call(a,String(c).toLowerCase()));case"keys":return()=>(a.sort(),new Set(URLSearchParams.prototype.keys.call(a)).keys());default:return Reflect.get(a,s,i)}}})}get[Symbol.toStringTag](){return this.constructor.name}toString(){return Object.prototype.toString.call(this)}get(e){let r=this.getAll(e);if(r.length===0)return null;let a=r.join(", ");return/^content-encoding$/i.test(e)&&(a=a.toLowerCase()),a}forEach(e,r=void 0){for(let a of this.keys())Reflect.apply(e,r,[this.get(a),a,this])}*values(){for(let e of this.keys())yield this.get(e)}*entries(){for(let e of this.keys())yield[e,this.get(e)]}[Symbol.iterator](){return this.entries()}raw(){return[...this.keys()].reduce((e,r)=>(e[r]=this.getAll(r),e),{})}[Symbol.for("nodejs.util.inspect.custom")](){return[...this.keys()].reduce((e,r)=>{let a=this.getAll(r);return r==="host"?e[r]=a[0]:e[r]=a.length>1?a:a[0],e},{})}};Object.defineProperties(be.prototype,["get","entries","forEach","values"].reduce((t,e)=>(t[e]={enumerable:!0},t),{}))});var xm,$n,Io=B(()=>{xm=new Set([301,302,303,307,308]),$n=t=>xm.has(t)});var Ge,xe,Nl=B(()=>{ns();ts();Io();Ge=Symbol("Response internals"),xe=class t extends at{constructor(e=null,r={}){super(e,r);let a=r.status!=null?r.status:200,s=new be(r.headers);if(e!==null&&!s.has("Content-Type")){let i=es(e,this);i&&s.append("Content-Type",i)}this[Ge]={type:"default",url:r.url,status:a,statusText:r.statusText||"",headers:s,counter:r.counter,highWaterMark:r.highWaterMark}}get type(){return this[Ge].type}get url(){return this[Ge].url||""}get status(){return this[Ge].status}get ok(){return this[Ge].status>=200&&this[Ge].status<300}get redirected(){return this[Ge].counter>0}get statusText(){return this[Ge].statusText}get headers(){return this[Ge].headers}get highWaterMark(){return this[Ge].highWaterMark}clone(){return new t(Xr(this,this.highWaterMark),{type:this.type,url:this.url,status:this.status,statusText:this.statusText,headers:this.headers,ok:this.ok,redirected:this.redirected,size:this.size,highWaterMark:this.highWaterMark})}static redirect(e,r=302){if(!$n(r))throw new RangeError('Failed to execute "redirect" on "response": Invalid status code');return new t(null,{headers:{location:new URL(e).toString()},status:r})}static error(){let e=new t(null,{status:0,statusText:""});return e[Ge].type="error",e}static json(e=void 0,r={}){let a=JSON.stringify(e);if(a===void 0)throw new TypeError("data is not JSON serializable");let s=new be(r&&r.headers);return s.has("content-type")||s.set("content-type","application/json"),new t(a,{...r,headers:s})}get[Symbol.toStringTag](){return"Response"}};Object.defineProperties(xe.prototype,{type:{enumerable:!0},url:{enumerable:!0},status:{enumerable:!0},ok:{enumerable:!0},redirected:{enumerable:!0},statusText:{enumerable:!0},headers:{enumerable:!0},clone:{enumerable:!0}})});var Ml,Fl=B(()=>{Ml=t=>{if(t.search)return t.search;let e=t.href.length-1,r=t.hash||(t.href[e]==="#"?"#":"");return t.href[e-r.length]==="?"?"?":""}});function jl(t,e=!1){return t==null||(t=new URL(t),/^(about|blob|data):$/.test(t.protocol))?"no-referrer":(t.username="",t.password="",t.hash="",e&&(t.pathname="",t.search=""),t)}function Ul(t){if(!ql.has(t))throw new TypeError(`Invalid referrerPolicy: ${t}`);return t}function vm(t){if(/^(http|ws)s:$/.test(t.protocol))return!0;let e=t.host.replace(/(^\[)|(]$)/g,""),r=(0,Wl.isIP)(e);return r===4&&/^127\./.test(e)||r===6&&/^(((0+:){7})|(::(0+:){0,6}))0*1$/.test(e)?!0:t.host==="localhost"||t.host.endsWith(".localhost")?!1:t.protocol==="file:"}function en(t){return/^about:(blank|srcdoc)$/.test(t)||t.protocol==="data:"||/^(blob|filesystem):$/.test(t.protocol)?!0:vm(t)}function zl(t,{referrerURLCallback:e,referrerOriginCallback:r}={}){if(t.referrer==="no-referrer"||t.referrerPolicy==="")return null;let a=t.referrerPolicy;if(t.referrer==="about:client")return"no-referrer";let s=t.referrer,i=jl(s),c=jl(s,!0);i.toString().length>4096&&(i=c),e&&(i=e(i)),r&&(c=r(c));let u=new URL(t.url);switch(a){case"no-referrer":return"no-referrer";case"origin":return c;case"unsafe-url":return i;case"strict-origin":return en(i)&&!en(u)?"no-referrer":c.toString();case"strict-origin-when-cross-origin":return i.origin===u.origin?i:en(i)&&!en(u)?"no-referrer":c;case"same-origin":return i.origin===u.origin?i:"no-referrer";case"origin-when-cross-origin":return i.origin===u.origin?i:c;case"no-referrer-when-downgrade":return en(i)&&!en(u)?"no-referrer":i;default:throw new TypeError(`Invalid referrerPolicy: ${a}`)}}function Hl(t){let e=(t.get("referrer-policy")||"").split(/[,\s]+/),r="";for(let a of e)a&&ql.has(a)&&(r=a);return r}var Wl,ql,Bl,Oo=B(()=>{Wl=require("node:net");ql=new Set(["","no-referrer","no-referrer-when-downgrade","same-origin","origin","strict-origin","origin-when-cross-origin","strict-origin-when-cross-origin","unsafe-url"]),Bl="strict-origin-when-cross-origin"});var Vl,Gl,te,Pn,Tm,zt,Jl,Zl=B(()=>{Vl=require("node:url"),Gl=require("node:util");ns();ts();Ya();Fl();Oo();te=Symbol("Request internals"),Pn=t=>typeof t=="object"&&typeof t[te]=="object",Tm=(0,Gl.deprecate)(()=>{},".data is not a valid RequestInit property, use .body instead","https://github.com/node-fetch/node-fetch/issues/1000 (request)"),zt=class t extends at{constructor(e,r={}){let a;if(Pn(e)?a=new URL(e.url):(a=new URL(e),e={}),a.username!==""||a.password!=="")throw new TypeError(`${a} is an url with embedded credentials.`);let s=r.method||e.method||"GET";if(/^(delete|get|head|options|post|put)$/i.test(s)&&(s=s.toUpperCase()),!Pn(r)&&"data"in r&&Tm(),(r.body!=null||Pn(e)&&e.body!==null)&&(s==="GET"||s==="HEAD"))throw new TypeError("Request with GET/HEAD method cannot have body");let i=r.body?r.body:Pn(e)&&e.body!==null?Xr(e):null;super(i,{size:r.size||e.size||0});let c=new be(r.headers||e.headers||{});if(i!==null&&!c.has("Content-Type")){let d=es(i,this);d&&c.set("Content-Type",d)}let u=Pn(e)?e.signal:null;if("signal"in r&&(u=r.signal),u!=null&&!yl(u))throw new TypeError("Expected signal to be an instanceof AbortSignal or EventTarget");let p=r.referrer==null?e.referrer:r.referrer;if(p==="")p="no-referrer";else if(p){let d=new URL(p);p=/^about:(\/\/)?client$/.test(d)?"client":d}else p=void 0;this[te]={method:s,redirect:r.redirect||e.redirect||"follow",headers:c,parsedURL:a,signal:u,referrer:p},this.follow=r.follow===void 0?e.follow===void 0?20:e.follow:r.follow,this.compress=r.compress===void 0?e.compress===void 0?!0:e.compress:r.compress,this.counter=r.counter||e.counter||0,this.agent=r.agent||e.agent,this.highWaterMark=r.highWaterMark||e.highWaterMark||16384,this.insecureHTTPParser=r.insecureHTTPParser||e.insecureHTTPParser||!1,this.referrerPolicy=r.referrerPolicy||e.referrerPolicy||""}get method(){return this[te].method}get url(){return(0,Vl.format)(this[te].parsedURL)}get headers(){return this[te].headers}get redirect(){return this[te].redirect}get signal(){return this[te].signal}get referrer(){if(this[te].referrer==="no-referrer")return"";if(this[te].referrer==="client")return"about:client";if(this[te].referrer)return this[te].referrer.toString()}get referrerPolicy(){return this[te].referrerPolicy}set referrerPolicy(e){this[te].referrerPolicy=Ul(e)}clone(){return new t(this)}get[Symbol.toStringTag](){return"Request"}};Object.defineProperties(zt.prototype,{method:{enumerable:!0},url:{enumerable:!0},headers:{enumerable:!0},redirect:{enumerable:!0},clone:{enumerable:!0},signal:{enumerable:!0},referrer:{enumerable:!0},referrerPolicy:{enumerable:!0}});Jl=t=>{let{parsedURL:e}=t[te],r=new be(t[te].headers);r.has("Accept")||r.set("Accept","*/*");let a=null;if(t.body===null&&/^(post|put)$/i.test(t.method)&&(a="0"),t.body!==null){let u=Ol(t);typeof u=="number"&&!Number.isNaN(u)&&(a=String(u))}a&&r.set("Content-Length",a),t.referrerPolicy===""&&(t.referrerPolicy=Bl),t.referrer&&t.referrer!=="no-referrer"?t[te].referrer=zl(t):t[te].referrer="no-referrer",t[te].referrer instanceof URL&&r.set("Referer",t.referrer),r.has("User-Agent")||r.set("User-Agent","node-fetch"),t.compress&&!r.has("Accept-Encoding")&&r.set("Accept-Encoding","gzip, deflate, br");let{agent:s}=t;typeof s=="function"&&(s=s(e));let i=Ml(e),c={path:e.pathname+i,method:t.method,headers:r[Symbol.for("nodejs.util.inspect.custom")](),insecureHTTPParser:t.insecureHTTPParser,agent:s};return{parsedURL:e,options:c}}});var In,Yl=B(()=>{Ja();In=class extends _t{constructor(e,r="aborted"){super(e,r)}}});var Do={};Pe(Do,{AbortError:()=>In,Blob:()=>Ve,FetchError:()=>de,File:()=>qt,FormData:()=>Bt,Headers:()=>be,Request:()=>zt,Response:()=>xe,blobFrom:()=>Tl,blobFromSync:()=>vl,default:()=>St,fileFrom:()=>Cl,fileFromSync:()=>Rl,isRedirect:()=>$n});async function St(t,e){return new Promise((r,a)=>{let s=new zt(t,e),{parsedURL:i,options:c}=Jl(s);if(!Cm.has(i.protocol))throw new TypeError(`node-fetch cannot load ${t}. URL scheme "${i.protocol.replace(/:$/,"")}" is not supported.`);if(i.protocol==="data:"){let v=il(s.url),z=new xe(v,{headers:{"Content-Type":v.typeFull}});r(z);return}let u=(i.protocol==="https:"?Kl.default:Ql.default).request,{signal:p}=s,d=null,g=()=>{let v=new In("The operation was aborted.");a(v),s.body&&s.body instanceof ve.default.Readable&&s.body.destroy(v),!(!d||!d.body)&&d.body.emit("error",v)};if(p&&p.aborted){g();return}let k=()=>{g(),P()},x=u(i.toString(),c);p&&p.addEventListener("abort",k);let P=()=>{x.abort(),p&&p.removeEventListener("abort",k)};x.on("error",v=>{a(new de(`request to ${s.url} failed, reason: ${v.message}`,"system",v)),P()}),Rm(x,v=>{d&&d.body&&d.body.destroy(v)}),process.version<"v14"&&x.on("socket",v=>{let z;v.prependListener("end",()=>{z=v._eventsCount}),v.prependListener("close",q=>{if(d&&z<v._eventsCount&&!q){let W=new Error("Premature close");W.code="ERR_STREAM_PREMATURE_CLOSE",d.body.emit("error",W)}})}),x.on("response",v=>{x.setTimeout(0);let z=Ll(v.rawHeaders);if($n(v.statusCode)){let U=z.get("Location"),H=null;try{H=U===null?null:new URL(U,s.url)}catch{if(s.redirect!=="manual"){a(new de(`uri requested responds with an invalid redirect URL: ${U}`,"invalid-redirect")),P();return}}switch(s.redirect){case"error":a(new de(`uri requested responds with a redirect, redirect mode is set to error: ${s.url}`,"no-redirect")),P();return;case"manual":break;case"follow":{if(H===null)break;if(s.counter>=s.follow){a(new de(`maximum redirect reached at: ${s.url}`,"max-redirect")),P();return}let Q={headers:new be(s.headers),follow:s.follow,counter:s.counter+1,agent:s.agent,compress:s.compress,method:s.method,body:Xr(s),signal:s.signal,size:s.size,referrer:s.referrer,referrerPolicy:s.referrerPolicy};if(!bl(s.url,H)||!wl(s.url,H))for(let ln of["authorization","www-authenticate","cookie","cookie2"])Q.headers.delete(ln);if(v.statusCode!==303&&s.body&&e.body instanceof ve.default.Readable){a(new de("Cannot follow redirect with body being a readable stream","unsupported-redirect")),P();return}(v.statusCode===303||(v.statusCode===301||v.statusCode===302)&&s.method==="POST")&&(Q.method="GET",Q.body=void 0,Q.headers.delete("content-length"));let Ct=Hl(z);Ct&&(Q.referrerPolicy=Ct),r(St(new zt(H,Q))),P();return}default:return a(new TypeError(`Redirect option '${s.redirect}' is not a valid value of RequestRedirect`))}}p&&v.once("end",()=>{p.removeEventListener("abort",k)});let q=(0,ve.pipeline)(v,new ve.PassThrough,U=>{U&&a(U)});process.version<"v12.10"&&v.on("aborted",k);let W={url:s.url,status:v.statusCode,statusText:v.statusMessage,headers:z,size:s.size,counter:s.counter,highWaterMark:s.highWaterMark},Y=z.get("Content-Encoding");if(!s.compress||s.method==="HEAD"||Y===null||v.statusCode===204||v.statusCode===304){d=new xe(q,W),r(d);return}let ne={flush:_r.default.Z_SYNC_FLUSH,finishFlush:_r.default.Z_SYNC_FLUSH};if(Y==="gzip"||Y==="x-gzip"){q=(0,ve.pipeline)(q,_r.default.createGunzip(ne),U=>{U&&a(U)}),d=new xe(q,W),r(d);return}if(Y==="deflate"||Y==="x-deflate"){let U=(0,ve.pipeline)(v,new ve.PassThrough,H=>{H&&a(H)});U.once("data",H=>{(H[0]&15)===8?q=(0,ve.pipeline)(q,_r.default.createInflate(),Q=>{Q&&a(Q)}):q=(0,ve.pipeline)(q,_r.default.createInflateRaw(),Q=>{Q&&a(Q)}),d=new xe(q,W),r(d)}),U.once("end",()=>{d||(d=new xe(q,W),r(d))});return}if(Y==="br"){q=(0,ve.pipeline)(q,_r.default.createBrotliDecompress(),U=>{U&&a(U)}),d=new xe(q,W),r(d);return}d=new xe(q,W),r(d)}),Dl(x,s).catch(a)})}function Rm(t,e){let r=On.Buffer.from(`0\r
\r
`),a=!1,s=!1,i;t.on("response",c=>{let{headers:u}=c;a=u["transfer-encoding"]==="chunked"&&!u["content-length"]}),t.on("socket",c=>{let u=()=>{if(a&&!s){let d=new Error("Premature close");d.code="ERR_STREAM_PREMATURE_CLOSE",e(d)}},p=d=>{s=On.Buffer.compare(d.slice(-5),r)===0,!s&&i&&(s=On.Buffer.compare(i.slice(-3),r.slice(0,3))===0&&On.Buffer.compare(d.slice(-2),r.slice(3))===0),i=d};c.prependListener("close",u),c.on("data",p),t.on("close",()=>{c.removeListener("close",u),c.removeListener("data",p)})})}var Ql,Kl,_r,ve,On,Cm,Dn=B(()=>{Ql=Be(require("node:http"),1),Kl=Be(require("node:https"),1),_r=Be(require("node:zlib"),1),ve=Be(require("node:stream"),1),On=require("node:buffer");cl();ts();Nl();ns();Zl();vo();Yl();Io();Ga();Ya();Oo();Ro();Cm=new Set(["data:","http:","https:"])});function re(t,e,r,a){if(r==="a"&&!a)throw new TypeError("Private accessor was defined without a getter");if(typeof e=="function"?t!==e||!a:!e.has(t))throw new TypeError("Cannot read private member from an object whose class did not declare it");return r==="m"?a:r==="a"?a.call(t):a?a.value:e.get(t)}function vr(t,e,r,a,s){if(a==="m")throw new TypeError("Private method is not writable");if(a==="a"&&!s)throw new TypeError("Private accessor was defined without a setter");if(typeof e=="function"?t!==e||!s:!e.has(t))throw new TypeError("Cannot write private member to an object whose class did not declare it");return a==="a"?s.call(t,r):s?s.value=r:e.set(t,r),r}var gu=B(()=>{});var Jo={};Pe(Jo,{Channel:()=>an,PluginListener:()=>Mn,Resource:()=>Ht,SERIALIZE_TO_IPC_FN:()=>le,addPluginListener:()=>Pg,checkPermissions:()=>Ig,convertFileSrc:()=>Dg,invoke:()=>y,isTauri:()=>Lg,requestPermissions:()=>Og,transformCallback:()=>is});function is(t,e=!1){return window.__TAURI_INTERNALS__.transformCallback(t,e)}async function Pg(t,e,r){let a=new an(r);try{return y(`plugin:${t}|register_listener`,{event:e,handler:a}).then(()=>new Mn(t,e,a.id))}catch{return y(`plugin:${t}|registerListener`,{event:e,handler:a}).then(()=>new Mn(t,e,a.id))}}async function Ig(t){return y(`plugin:${t}|check_permissions`)}async function Og(t){return y(`plugin:${t}|request_permissions`)}async function y(t,e={},r){return window.__TAURI_INTERNALS__.invoke(t,e,r)}function Dg(t,e="asset"){return window.__TAURI_INTERNALS__.convertFileSrc(t,e)}function Lg(){return!!(globalThis||window).isTauri}var Tr,Me,nn,ss,os,le,an,Mn,Ht,ot=B(()=>{gu();le="__TAURI_TO_IPC_KEY__";an=class{constructor(e){Tr.set(this,void 0),Me.set(this,0),nn.set(this,[]),ss.set(this,void 0),vr(this,Tr,e||(()=>{}),"f"),this.id=is(r=>{let a=r.index;if("end"in r){a==re(this,Me,"f")?this.cleanupCallback():vr(this,ss,a,"f");return}let s=r.message;if(a==re(this,Me,"f")){for(re(this,Tr,"f").call(this,s),vr(this,Me,re(this,Me,"f")+1,"f");re(this,Me,"f")in re(this,nn,"f");){let i=re(this,nn,"f")[re(this,Me,"f")];re(this,Tr,"f").call(this,i),delete re(this,nn,"f")[re(this,Me,"f")],vr(this,Me,re(this,Me,"f")+1,"f")}re(this,Me,"f")===re(this,ss,"f")&&this.cleanupCallback()}else re(this,nn,"f")[a]=s})}cleanupCallback(){window.__TAURI_INTERNALS__.unregisterCallback(this.id)}set onmessage(e){vr(this,Tr,e,"f")}get onmessage(){return re(this,Tr,"f")}[(Tr=new WeakMap,Me=new WeakMap,nn=new WeakMap,ss=new WeakMap,le)](){return`__CHANNEL__:${this.id}`}toJSON(){return this[le]()}},Mn=class{constructor(e,r,a){this.plugin=e,this.event=r,this.channelId=a}async unregister(){return y(`plugin:${this.plugin}|remove_listener`,{event:this.event,channelId:this.channelId})}};Ht=class{get rid(){return re(this,os,"f")}constructor(e){os.set(this,void 0),vr(this,os,e,"f")}async close(){return y("plugin:resources|close",{rid:this.rid})}};os=new WeakMap});var bu={};Pe(bu,{TauriEvent:()=>fe,emit:()=>Fn,emitTo:()=>Yo,listen:()=>cs,once:()=>Zo});async function yu(t,e){window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener(t,e),await y("plugin:event|unlisten",{event:t,eventId:e})}async function cs(t,e,r){var a;let s=typeof r?.target=="string"?{kind:"AnyLabel",label:r.target}:(a=r?.target)!==null&&a!==void 0?a:{kind:"Any"};return y("plugin:event|listen",{event:t,target:s,handler:is(e)}).then(i=>async()=>yu(t,i))}async function Zo(t,e,r){return cs(t,a=>{yu(t,a.id),e(a)},r)}async function Fn(t,e){await y("plugin:event|emit",{event:t,payload:e})}async function Yo(t,e,r){await y("plugin:event|emit_to",{target:typeof t=="string"?{kind:"AnyLabel",label:t}:t,event:e,payload:r})}var fe,ls=B(()=>{ot();(function(t){t.WINDOW_RESIZED="tauri://resize",t.WINDOW_MOVED="tauri://move",t.WINDOW_CLOSE_REQUESTED="tauri://close-requested",t.WINDOW_DESTROYED="tauri://destroyed",t.WINDOW_FOCUS="tauri://focus",t.WINDOW_BLUR="tauri://blur",t.WINDOW_SCALE_FACTOR_CHANGED="tauri://scale-change",t.WINDOW_THEME_CHANGED="tauri://theme-changed",t.WINDOW_CREATED="tauri://window-created",t.WEBVIEW_CREATED="tauri://webview-created",t.DRAG_ENTER="tauri://drag-enter",t.DRAG_OVER="tauri://drag-over",t.DRAG_DROP="tauri://drag-drop",t.DRAG_LEAVE="tauri://drag-leave"})(fe||(fe={}))});var us={};Pe(us,{BaseDirectory:()=>V,appCacheDir:()=>jg,appConfigDir:()=>Ng,appDataDir:()=>Mg,appLocalDataDir:()=>Fg,appLogDir:()=>ay,audioDir:()=>Wg,basename:()=>py,cacheDir:()=>qg,configDir:()=>Bg,dataDir:()=>Ug,delimiter:()=>iy,desktopDir:()=>zg,dirname:()=>dy,documentDir:()=>Hg,downloadDir:()=>Vg,executableDir:()=>Gg,extname:()=>fy,fontDir:()=>Jg,homeDir:()=>Zg,isAbsolute:()=>hy,join:()=>uy,localDataDir:()=>Yg,normalize:()=>ly,pictureDir:()=>Qg,publicDir:()=>Kg,resolve:()=>cy,resolveResource:()=>ey,resourceDir:()=>Xg,runtimeDir:()=>ty,sep:()=>oy,tempDir:()=>sy,templateDir:()=>ry,videoDir:()=>ny});async function Ng(){return y("plugin:path|resolve_directory",{directory:V.AppConfig})}async function Mg(){return y("plugin:path|resolve_directory",{directory:V.AppData})}async function Fg(){return y("plugin:path|resolve_directory",{directory:V.AppLocalData})}async function jg(){return y("plugin:path|resolve_directory",{directory:V.AppCache})}async function Wg(){return y("plugin:path|resolve_directory",{directory:V.Audio})}async function qg(){return y("plugin:path|resolve_directory",{directory:V.Cache})}async function Bg(){return y("plugin:path|resolve_directory",{directory:V.Config})}async function Ug(){return y("plugin:path|resolve_directory",{directory:V.Data})}async function zg(){return y("plugin:path|resolve_directory",{directory:V.Desktop})}async function Hg(){return y("plugin:path|resolve_directory",{directory:V.Document})}async function Vg(){return y("plugin:path|resolve_directory",{directory:V.Download})}async function Gg(){return y("plugin:path|resolve_directory",{directory:V.Executable})}async function Jg(){return y("plugin:path|resolve_directory",{directory:V.Font})}async function Zg(){return y("plugin:path|resolve_directory",{directory:V.Home})}async function Yg(){return y("plugin:path|resolve_directory",{directory:V.LocalData})}async function Qg(){return y("plugin:path|resolve_directory",{directory:V.Picture})}async function Kg(){return y("plugin:path|resolve_directory",{directory:V.Public})}async function Xg(){return y("plugin:path|resolve_directory",{directory:V.Resource})}async function ey(t){return y("plugin:path|resolve_directory",{directory:V.Resource,path:t})}async function ty(){return y("plugin:path|resolve_directory",{directory:V.Runtime})}async function ry(){return y("plugin:path|resolve_directory",{directory:V.Template})}async function ny(){return y("plugin:path|resolve_directory",{directory:V.Video})}async function ay(){return y("plugin:path|resolve_directory",{directory:V.AppLog})}async function sy(){return y("plugin:path|resolve_directory",{directory:V.Temp})}function oy(){return window.__TAURI_INTERNALS__.plugins.path.sep}function iy(){return window.__TAURI_INTERNALS__.plugins.path.delimiter}async function cy(...t){return y("plugin:path|resolve",{paths:t})}async function ly(t){return y("plugin:path|normalize",{path:t})}async function uy(...t){return y("plugin:path|join",{paths:t})}async function dy(t){return y("plugin:path|dirname",{path:t})}async function fy(t){return y("plugin:path|extname",{path:t})}async function py(t,e){return y("plugin:path|basename",{path:t,ext:e})}async function hy(t){return y("plugin:path|is_absolute",{path:t})}var V,jn=B(()=>{ot();(function(t){t[t.Audio=1]="Audio",t[t.Cache=2]="Cache",t[t.Config=3]="Config",t[t.Data=4]="Data",t[t.LocalData=5]="LocalData",t[t.Document=6]="Document",t[t.Download=7]="Download",t[t.Picture=8]="Picture",t[t.Public=9]="Public",t[t.Video=10]="Video",t[t.Resource=11]="Resource",t[t.Temp=12]="Temp",t[t.AppConfig=13]="AppConfig",t[t.AppData=14]="AppData",t[t.AppLocalData=15]="AppLocalData",t[t.AppCache=16]="AppCache",t[t.AppLog=17]="AppLog",t[t.Desktop=18]="Desktop",t[t.Executable=19]="Executable",t[t.Font=20]="Font",t[t.Home=21]="Home",t[t.Runtime=22]="Runtime",t[t.Template=23]="Template"})(V||(V={}))});var ei={};Pe(ei,{BaseDirectory:()=>V,FileHandle:()=>Wn,SeekMode:()=>Qo,copyFile:()=>yy,create:()=>gy,exists:()=>$y,lstat:()=>Cy,mkdir:()=>by,open:()=>wu,readDir:()=>wy,readFile:()=>_y,readTextFile:()=>ky,readTextFileLines:()=>Sy,remove:()=>xy,rename:()=>vy,size:()=>Oy,stat:()=>Ty,truncate:()=>Ry,watch:()=>Py,watchImmediate:()=>Iy,writeFile:()=>Ey,writeTextFile:()=>Ay});function Xo(t){return{isFile:t.isFile,isDirectory:t.isDirectory,isSymlink:t.isSymlink,size:t.size,mtime:t.mtime!==null?new Date(t.mtime):null,atime:t.atime!==null?new Date(t.atime):null,birthtime:t.birthtime!==null?new Date(t.birthtime):null,readonly:t.readonly,fileAttributes:t.fileAttributes,dev:t.dev,ino:t.ino,mode:t.mode,nlink:t.nlink,uid:t.uid,gid:t.gid,rdev:t.rdev,blksize:t.blksize,blocks:t.blocks}}function my(t){let e=new Uint8ClampedArray(t),r=e.byteLength,a=0;for(let s=0;s<r;s++){let i=e[s];a*=256,a+=i}return a}async function gy(t,e){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");let r=await y("plugin:fs|create",{path:t instanceof URL?t.toString():t,options:e});return new Wn(r)}async function wu(t,e){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");let r=await y("plugin:fs|open",{path:t instanceof URL?t.toString():t,options:e});return new Wn(r)}async function yy(t,e,r){if(t instanceof URL&&t.protocol!=="file:"||e instanceof URL&&e.protocol!=="file:")throw new TypeError("Must be a file URL.");await y("plugin:fs|copy_file",{fromPath:t instanceof URL?t.toString():t,toPath:e instanceof URL?e.toString():e,options:r})}async function by(t,e){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");await y("plugin:fs|mkdir",{path:t instanceof URL?t.toString():t,options:e})}async function wy(t,e){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");return await y("plugin:fs|read_dir",{path:t instanceof URL?t.toString():t,options:e})}async function _y(t,e){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");let r=await y("plugin:fs|read_file",{path:t instanceof URL?t.toString():t,options:e});return r instanceof ArrayBuffer?new Uint8Array(r):Uint8Array.from(r)}async function ky(t,e){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");let r=await y("plugin:fs|read_text_file",{path:t instanceof URL?t.toString():t,options:e}),a=r instanceof ArrayBuffer?r:Uint8Array.from(r);return new TextDecoder().decode(a)}async function Sy(t,e){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");let r=t instanceof URL?t.toString():t;return await Promise.resolve({path:r,rid:null,async next(){this.rid===null&&(this.rid=await y("plugin:fs|read_text_file_lines",{path:r,options:e}));let a=await y("plugin:fs|read_text_file_lines_next",{rid:this.rid}),s=a instanceof ArrayBuffer?new Uint8Array(a):Uint8Array.from(a),i=s[s.byteLength-1]===1;return i?(this.rid=null,{value:null,done:i}):{value:new TextDecoder().decode(s.slice(0,s.byteLength)),done:i}},[Symbol.asyncIterator](){return this}})}async function xy(t,e){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");await y("plugin:fs|remove",{path:t instanceof URL?t.toString():t,options:e})}async function vy(t,e,r){if(t instanceof URL&&t.protocol!=="file:"||e instanceof URL&&e.protocol!=="file:")throw new TypeError("Must be a file URL.");await y("plugin:fs|rename",{oldPath:t instanceof URL?t.toString():t,newPath:e instanceof URL?e.toString():e,options:r})}async function Ty(t,e){let r=await y("plugin:fs|stat",{path:t instanceof URL?t.toString():t,options:e});return Xo(r)}async function Cy(t,e){let r=await y("plugin:fs|lstat",{path:t instanceof URL?t.toString():t,options:e});return Xo(r)}async function Ry(t,e,r){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");await y("plugin:fs|truncate",{path:t instanceof URL?t.toString():t,len:e,options:r})}async function Ey(t,e,r){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");if(e instanceof ReadableStream){let a=await wu(t,{read:!1,create:!0,write:!0,...r}),s=e.getReader();try{for(;;){let{done:i,value:c}=await s.read();if(i)break;await a.write(c)}}finally{s.releaseLock(),await a.close()}}else await y("plugin:fs|write_file",e,{headers:{path:encodeURIComponent(t instanceof URL?t.toString():t),options:JSON.stringify(r)}})}async function Ay(t,e,r){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");let a=new TextEncoder;await y("plugin:fs|write_text_file",a.encode(e),{headers:{path:encodeURIComponent(t instanceof URL?t.toString():t),options:JSON.stringify(r)}})}async function $y(t,e){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");return await y("plugin:fs|exists",{path:t instanceof URL?t.toString():t,options:e})}async function _u(t,e,r){let a=Array.isArray(t)?t:[t];for(let u of a)if(u instanceof URL&&u.protocol!=="file:")throw new TypeError("Must be a file URL.");let s=new an;s.onmessage=e;let i=await y("plugin:fs|watch",{paths:a.map(u=>u instanceof URL?u.toString():u),options:r,onEvent:s}),c=new Ko(i);return()=>{c.close()}}async function Py(t,e,r){return await _u(t,e,{delayMs:2e3,...r})}async function Iy(t,e,r){return await _u(t,e,{...r,delayMs:void 0})}async function Oy(t){if(t instanceof URL&&t.protocol!=="file:")throw new TypeError("Must be a file URL.");return await y("plugin:fs|size",{path:t instanceof URL?t.toString():t})}var Qo,Wn,Ko,ti=B(()=>{jn();ot();(function(t){t[t.Start=0]="Start",t[t.Current=1]="Current",t[t.End=2]="End"})(Qo||(Qo={}));Wn=class extends Ht{async read(e){if(e.byteLength===0)return 0;let r=await y("plugin:fs|read",{rid:this.rid,len:e.byteLength}),a=my(r.slice(-8)),s=r instanceof ArrayBuffer?new Uint8Array(r):r;return e.set(s.slice(0,s.length-8)),a===0?null:a}async seek(e,r){return await y("plugin:fs|seek",{rid:this.rid,offset:e,whence:r})}async stat(){let e=await y("plugin:fs|fstat",{rid:this.rid});return Xo(e)}async truncate(e){await y("plugin:fs|ftruncate",{rid:this.rid,len:e})}async write(e){return await y("plugin:fs|write",{rid:this.rid,data:e})}};Ko=class extends Ht{}});var $u={};Pe($u,{fileOperations:()=>Cr,keyboardUtils:()=>Bn,uiUtils:()=>Un,validationUtils:()=>Vt});var Cr,Bn,Un,Vt,zn=B(()=>{Cr={getExtension:t=>{let e=t.lastIndexOf(".");return e>0?t.slice(e+1).toLowerCase():""},isMarkdown:t=>{let e=Cr.getExtension(t);return["md","markdown","mdown","mkd","mdwn"].includes(e)},isImage:t=>{let e=Cr.getExtension(t);return["jpg","jpeg","png","gif","webp","svg","bmp","ico"].includes(e)},getBasename:t=>{let e=t.lastIndexOf("."),a=Math.max(t.lastIndexOf("/"),t.lastIndexOf("\\"))+1,s=e>a?e:t.length;return t.slice(a,s)}},Bn={isModifierPressed:t=>t.ctrlKey||t.metaKey||t.altKey||t.shiftKey,getNormalizedKey:t=>{let e=[];(t.ctrlKey||t.metaKey)&&e.push("Ctrl"),t.altKey&&e.push("Alt"),t.shiftKey&&e.push("Shift");let r=t.key;return r===" "&&(r="Space"),r==="ArrowLeft"&&(r="Left"),r==="ArrowRight"&&(r="Right"),r==="ArrowUp"&&(r="Up"),r==="ArrowDown"&&(r="Down"),r.length===1&&(r=r.toUpperCase()),e.push(r),e.join("+")}},Un={formatFileSize:t=>{if(t===0)return"0 B";let e=1024,r=["B","KB","MB","GB","TB"],a=Math.floor(Math.log(t)/Math.log(e));return`${parseFloat((t/Math.pow(e,a)).toFixed(2))} ${r[a]}`},formatDate:t=>{let e=new Date(t),a=new Date-e,s=Math.floor(a/(1e3*60*60*24));if(s===0){let i=Math.floor(a/36e5);if(i===0){let c=Math.floor(a/6e4);return c===0?"Just now":`${c} minutes ago`}return`${i} hours ago`}else return s===1?"Yesterday":s<7?`${s} days ago`:e.toLocaleDateString()}},Vt={isValidFilename:t=>!/[<>:"|?*]/.test(t)&&t.trim().length>0,isValidFoldername:t=>Vt.isValidFilename(t)&&!t.startsWith(".")&&t!==".."&&t!=="."}});var Hn,Pu=B(()=>{Hn={app:{name:"Lokus",executableName:"lokus.exe",defaultInstallPath:"C:\\Program Files\\Lokus",userDataPath:"%APPDATA%\\Lokus",tempPath:"%TEMP%\\Lokus"},files:{defaultWorkspacePath:"%USERPROFILE%\\Documents\\Lokus",maxPathLength:260,reservedNames:["CON","PRN","AUX","NUL","COM1","COM2","COM3","COM4","COM5","COM6","COM7","COM8","COM9","LPT1","LPT2","LPT3","LPT4","LPT5","LPT6","LPT7","LPT8","LPT9"],invalidChars:'<>:"|?*',associations:{".md":{progId:"Lokus.Markdown",description:"Markdown Document",icon:"markdown.ico"},".markdown":{progId:"Lokus.Markdown",description:"Markdown Document",icon:"markdown.ico"}}},terminal:{preferences:[{name:"Windows Terminal",command:"wt",args:["-d","{path}"],available:null},{name:"PowerShell",command:"powershell",args:["-NoExit","-Command",'cd "{path}"'],available:null},{name:"Command Prompt",command:"cmd",args:["/k",'cd /d "{path}"'],available:!0}]},shortcuts:{global:{newWindow:"Ctrl+Shift+N",closeWindow:"Alt+F4",minimize:"Win+Down",maximize:"Win+Up"},editor:{selectWord:"Ctrl+D",selectLine:"Ctrl+L",deleteLine:"Ctrl+Shift+K",duplicateLine:"Ctrl+Shift+D",moveLineUp:"Alt+Up",moveLineDown:"Alt+Down"}},ui:{borderRadius:"8px",acrylic:{enabled:!0,tint:"rgba(255, 255, 255, 0.05)",blur:"20px"},snapLayouts:{enabled:!0,zones:["half-left","half-right","quarter","three-quarter"]},contextMenu:{style:"windows11",animations:!0,icons:!0}},shell:{contextMenu:{enabled:!0,entries:[{key:"open_with_lokus",title:"Open with Lokus",icon:"%INSTALLDIR%\\lokus.ico",command:'"%INSTALLDIR%\\lokus.exe" "%1"'}]},jumpList:{enabled:!0,maxItems:10,categories:["Recent","Tasks"]}},notifications:{provider:"windows-native",defaultSound:"ms-winsoundevent:Notification.Default",badgeSupport:!0,actionCenter:!0},performance:{directWrite:!0,hardwareAcceleration:!0,gpuRasterization:!0},features:{windowsHello:!1,darkModeSync:!0,taskbarProgress:!0,thumbnailToolbar:!0,aeroSnap:!0}}});var ci={};Pe(ci,{cleanupWindowsFeatures:()=>Wy,contextMenu:()=>ii,fileAssociations:()=>Iu,initializeWindowsFeatures:()=>jy,jumpList:()=>Ou,notifications:()=>My,searchIntegration:()=>Fy,taskbarProgress:()=>Du,themeIntegration:()=>Lu});async function jy(t={}){let e={fileAssociations:!1,contextMenu:!1,darkModeSync:!1};return t.fileAssociations!==!1&&(e.fileAssociations=await Iu.register()),t.contextMenu!==!1&&(e.contextMenu=await ii.register()),t.darkModeSync!==!1&&(e.darkModeSync=await Lu.syncDarkMode()),e}async function Wy(){await ii.unregister(),await Ou.clear(),await Du.clear()}var Iu,Ou,ii,Du,My,Lu,Fy,Nu=B(()=>{ot();Pu();Iu={async register(){try{return await y("windows_register_file_associations",{associations:Hn.files.associations}),!0}catch(t){return console.error("Failed to register file associations:",t),!1}},async check(){try{return await y("windows_check_file_associations")}catch(t){return console.error("Failed to check file associations:",t),!1}}},Ou={async update(t){try{let e=t.map(r=>({type:"task",title:r.name||"Untitled Workspace",description:r.path,program:"lokus.exe",args:`"${r.path}"`,iconPath:r.path,iconIndex:0}));return await y("windows_update_jump_list",{items:e,maxItems:Hn.shell.jumpList.maxItems}),!0}catch(e){return console.error("Failed to update jump list:",e),!1}},async clear(){try{return await y("windows_clear_jump_list"),!0}catch(t){return console.error("Failed to clear jump list:",t),!1}}},ii={async register(){try{return await y("windows_register_context_menu",{entries:Hn.shell.contextMenu.entries}),!0}catch(t){return console.error("Failed to register context menu:",t),!1}},async unregister(){try{return await y("windows_unregister_context_menu"),!0}catch(t){return console.error("Failed to unregister context menu:",t),!1}}},Du={async setProgress(t,e="normal"){try{return await y("windows_set_taskbar_progress",{progress:Math.max(0,Math.min(1,t)),state:e}),!0}catch(r){return console.error("Failed to set taskbar progress:",r),!1}},async clear(){try{return await y("windows_clear_taskbar_progress"),!0}catch(t){return console.error("Failed to clear taskbar progress:",t),!1}}},My={async show(t){try{let e={title:t.title,body:t.body,icon:t.icon||"lokus.ico",sound:t.sound!==!1?Hn.notifications.defaultSound:null,actions:t.actions||[],silent:t.silent||!1};return await y("windows_show_notification",e)}catch(e){return console.error("Failed to show notification:",e),null}},async clear(t){try{return await y("windows_clear_notification",{id:t}),!0}catch(e){return console.error("Failed to clear notification:",e),!1}}},Lu={async syncDarkMode(){try{return await y("windows_is_dark_mode")}catch{return window.matchMedia("(prefers-color-scheme: dark)").matches}},async onThemeChange(t){try{await y("windows_watch_theme_changes");let{listen:e}=await Promise.resolve().then(()=>(ls(),bu));return await e("windows-theme-changed",a=>{t(a.payload.isDarkMode)})}catch(e){return console.error("Failed to watch theme changes:",e),null}}},Fy={async indexWorkspace(t){try{return await y("windows_index_workspace",{path:t}),!0}catch(e){return console.error("Failed to index workspace:",e),!1}},async removeFromIndex(t){try{return await y("windows_remove_from_index",{path:t}),!0}catch(e){return console.error("Failed to remove from index:",e),!1}}}});var Fu={};Pe(Fu,{fileOperations:()=>Cr,keyboardUtils:()=>Bn,uiUtils:()=>Un,validationUtils:()=>Vt,windowsFeatureHelpers:()=>zy,windowsFeaturesFromModule:()=>ci,windowsPathUtils:()=>Vn,windowsShell:()=>Uy,windowsShortcuts:()=>qy,windowsUI:()=>By,windowsValidation:()=>Mu});var qy,Vn,Mu,By,Uy,zy,ju=B(()=>{zn();Nu();qy={newFile:"Ctrl+N",newFolder:"Ctrl+Shift+N",save:"Ctrl+S",saveAs:"Ctrl+Shift+S",close:"Ctrl+W",closeAll:"Ctrl+Shift+W",find:"Ctrl+F",findAndReplace:"Ctrl+H",findInFiles:"Ctrl+Shift+F",commandPalette:"Ctrl+K",quickOpen:"Ctrl+P",properties:"Alt+Enter",rename:"F2",refresh:"F5",fullscreen:"F11",cut:"Ctrl+X",copy:"Ctrl+C",paste:"Ctrl+V",selectAll:"Ctrl+A",undo:"Ctrl+Z",redo:"Ctrl+Y",nextTab:"Ctrl+Tab",previousTab:"Ctrl+Shift+Tab",closeTab:"Ctrl+W",reopenTab:"Ctrl+Shift+T",toggleSidebar:"Ctrl+B",togglePreview:"Ctrl+Shift+V",zoomIn:"Ctrl+Plus",zoomOut:"Ctrl+Minus",resetZoom:"Ctrl+0"},Vn={toWindowsPath:t=>t&&(t.startsWith("//")?"\\\\"+t.slice(2).replace(/\//g,"\\"):t.replace(/\//g,"\\")),toUnixPath:t=>t&&(t.startsWith("\\\\")?"//"+t.slice(2).replace(/\\/g,"/"):t.replace(/\\/g,"/")),getDriveLetter:t=>{let e=t.match(/^([A-Za-z]):/);return e?e[1].toUpperCase():null},isAbsolutePath:t=>/^[A-Za-z]:/.test(t)||t.startsWith("\\\\"),isUNCPath:t=>t.startsWith("\\\\")||t.startsWith("//"),normalizePath:t=>t&&(t.startsWith("\\\\")?"\\\\"+t.slice(2).replace(/\\+/g,"\\").replace(/\\$/,""):t.replace(/\\+/g,"\\").replace(/\\$/,"")),joinPath:(...t)=>{let e=t.filter(Boolean).join("\\").replace(/\\+/g,"\\");return t[0]&&t[0].startsWith("\\\\")?"\\\\"+e.slice(2):e},getParentDirectory:t=>{if(!t)return t;let r=Vn.normalizePath(t).split("\\");return r.length<=1||r.length===2&&r[1]===""?null:(r.pop(),r.join("\\"))},getFilename:t=>{if(!t)return"";let r=Vn.normalizePath(t).split("\\");return r[r.length-1]},isPathTooLong:t=>t.length>=260&&!t.startsWith("\\\\?\\"),toLongPath:t=>!t||t.startsWith("\\\\?\\")?t:Vn.isUNCPath(t)?"\\\\?\\UNC\\"+t.slice(2):Vn.isAbsolutePath(t)&&t.length>=260?"\\\\?\\"+t:t},Mu={...Vt,isReservedFilename:t=>{let e=["CON","PRN","AUX","NUL","COM1","COM2","COM3","COM4","COM5","COM6","COM7","COM8","COM9","LPT1","LPT2","LPT3","LPT4","LPT5","LPT6","LPT7","LPT8","LPT9"],r=t.split(".")[0].toUpperCase();return e.includes(r)},isValidFilename:t=>!/[<>:"|?*\x00-\x1f]/.test(t)&&!Mu.isReservedFilename(t)&&!t.endsWith(".")&&!t.endsWith(" ")&&t.trim().length>0,isPathLengthValid:t=>t.length<260},By={getAccentColor:()=>"#0078D4",isDarkModeEnabled:()=>window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches,getWindowsStyles:()=>({borderRadius:"8px",backdropFilter:"blur(20px)",boxShadow:"0 2px 20px rgba(0, 0, 0, 0.1)"})},Uy={getContextMenuItems:()=>[{id:"open-with-lokus",label:"Open with Lokus",icon:"file-text"},{id:"reveal-in-explorer",label:"Reveal in Explorer",icon:"folder-open"}],getFileAssociations:()=>({".md":{description:"Markdown Document",icon:"markdown-icon",progId:"Lokus.Markdown"},".markdown":{description:"Markdown Document",icon:"markdown-icon",progId:"Lokus.Markdown"}})},zy={getJumpListItems:t=>t.map(e=>({type:"task",title:e.name,description:e.path,program:"lokus.exe",args:`--workspace "${e.path}"`,iconPath:e.path,iconIndex:0})),getNotificationOptions:()=>({badge:!0,sound:!0,actions:!0,inline:!0,persistent:!1})}});var Wu={};Pe(Wu,{fileOperations:()=>Cr,finderIntegration:()=>Zy,keyboardUtils:()=>Bn,macosFeatures:()=>Yy,macosPathUtils:()=>Vy,macosShortcuts:()=>Hy,macosUI:()=>Jy,macosValidation:()=>Gy,uiUtils:()=>Un,validationUtils:()=>Vt});var Hy,Vy,Gy,Jy,Zy,Yy,qu=B(()=>{zn();Hy={newFile:"Cmd+N",newFolder:"Cmd+Shift+N",save:"Cmd+S",saveAs:"Cmd+Shift+S",close:"Cmd+W",closeAll:"Cmd+Option+W",find:"Cmd+F",findAndReplace:"Cmd+Option+F",findInFiles:"Cmd+Shift+F",commandPalette:"Cmd+K",quickOpen:"Cmd+P",spotlight:"Cmd+Space",quickLook:"Space",getInfo:"Cmd+I",showInFinder:"Cmd+Option+R",cut:"Cmd+X",copy:"Cmd+C",paste:"Cmd+V",selectAll:"Cmd+A",undo:"Cmd+Z",redo:"Cmd+Shift+Z",nextTab:"Cmd+Option+Right",previousTab:"Cmd+Option+Left",closeTab:"Cmd+W",reopenTab:"Cmd+Shift+T",toggleSidebar:"Cmd+B",togglePreview:"Cmd+Shift+V",zoomIn:"Cmd+Plus",zoomOut:"Cmd+Minus",resetZoom:"Cmd+0",minimize:"Cmd+M",hideWindow:"Cmd+H",hideOthers:"Cmd+Option+H",fullscreen:"Cmd+Control+F"},Vy={expandTilde:async t=>{if(t.startsWith("~/"))try{let{homeDir:e}=await Promise.resolve().then(()=>(jn(),us)),r=await e();return t.replace("~/",r.endsWith("/")?r:`${r}/`)}catch(e){return console.error("Failed to expand tilde path:",e),t}return t},isICloudPath:t=>t.includes("/Library/Mobile Documents/com~apple~CloudDocs/"),getICloudRelativePath:t=>{let e="/Library/Mobile Documents/com~apple~CloudDocs/",r=t.indexOf(e);return r!==-1?t.substring(r+e.length):t},isAbsolutePath:t=>t.startsWith("/")||t.startsWith("~")},Gy={...Vt,isValidFilename:t=>!/[:/]/.test(t)&&!t.startsWith(".")&&t.trim().length>0,isFilenameLengthValid:t=>t.length<=255},Jy={getAccentColor:()=>"#007AFF",isDarkModeEnabled:()=>window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches,getMacStyles:()=>({borderRadius:"10px",backdropFilter:"blur(50px)",WebkitBackdropFilter:"blur(50px)",boxShadow:"0 4px 20px rgba(0, 0, 0, 0.2)"}),getTrafficLightInset:()=>({left:"12px",top:"12px"})},Zy={getContextMenuItems:()=>[{id:"open-with-lokus",label:"Open with Lokus",icon:"file-text"},{id:"quick-look",label:"Quick Look",icon:"eye",shortcut:"Space"},{id:"reveal-in-finder",label:"Reveal in Finder",icon:"folder-open",shortcut:"Cmd+R"}],getFinderTags:()=>[{name:"Red",color:"#FF3B30"},{name:"Orange",color:"#FF9500"},{name:"Yellow",color:"#FFCC00"},{name:"Green",color:"#34C759"},{name:"Blue",color:"#007AFF"},{name:"Purple",color:"#5856D6"},{name:"Gray",color:"#8E8E93"}]},Yy={getTouchBarItems:()=>[{type:"button",label:"New Note",icon:"plus",action:"new-file"},{type:"button",label:"Search",icon:"search",action:"search"},{type:"colorPicker",action:"text-highlight"}],getContinuityOptions:()=>({handoff:!0,universalClipboard:!0,airdrop:!0}),getNotificationOptions:()=>({sound:"default",badge:!0,banner:!0,alert:!1})}});var sn,Ye,vt,on,pe,Er,di=B(()=>{ot();sn=class{constructor(...e){this.type="Logical",e.length===1?"Logical"in e[0]?(this.width=e[0].Logical.width,this.height=e[0].Logical.height):(this.width=e[0].width,this.height=e[0].height):(this.width=e[0],this.height=e[1])}toPhysical(e){return new Ye(this.width*e,this.height*e)}[le](){return{width:this.width,height:this.height}}toJSON(){return this[le]()}},Ye=class{constructor(...e){this.type="Physical",e.length===1?"Physical"in e[0]?(this.width=e[0].Physical.width,this.height=e[0].Physical.height):(this.width=e[0].width,this.height=e[0].height):(this.width=e[0],this.height=e[1])}toLogical(e){return new sn(this.width/e,this.height/e)}[le](){return{width:this.width,height:this.height}}toJSON(){return this[le]()}},vt=class{constructor(e){this.size=e}toLogical(e){return this.size instanceof sn?this.size:this.size.toLogical(e)}toPhysical(e){return this.size instanceof Ye?this.size:this.size.toPhysical(e)}[le](){return{[`${this.size.type}`]:{width:this.size.width,height:this.size.height}}}toJSON(){return this[le]()}},on=class{constructor(...e){this.type="Logical",e.length===1?"Logical"in e[0]?(this.x=e[0].Logical.x,this.y=e[0].Logical.y):(this.x=e[0].x,this.y=e[0].y):(this.x=e[0],this.y=e[1])}toPhysical(e){return new pe(this.x*e,this.y*e)}[le](){return{x:this.x,y:this.y}}toJSON(){return this[le]()}},pe=class{constructor(...e){this.type="Physical",e.length===1?"Physical"in e[0]?(this.x=e[0].Physical.x,this.y=e[0].Physical.y):(this.x=e[0].x,this.y=e[0].y):(this.x=e[0],this.y=e[1])}toLogical(e){return new on(this.x/e,this.y/e)}[le](){return{x:this.x,y:this.y}}toJSON(){return this[le]()}},Er=class{constructor(e){this.position=e}toLogical(e){return this.position instanceof on?this.position:this.position.toLogical(e)}toPhysical(e){return this.position instanceof pe?this.position:this.position.toPhysical(e)}[le](){return{[`${this.position.type}`]:{x:this.position.x,y:this.position.y}}}toJSON(){return this[le]()}}});function Gn(t){return t==null?null:typeof t=="string"?t:t instanceof fi?t.rid:t}var fi,Gu=B(()=>{ot();fi=class t extends Ht{constructor(e){super(e)}static async new(e,r,a){return y("plugin:image|new",{rgba:Gn(e),width:r,height:a}).then(s=>new t(s))}static async fromBytes(e){return y("plugin:image|from_bytes",{bytes:Gn(e)}).then(r=>new t(r))}static async fromPath(e){return y("plugin:image|from_path",{path:e}).then(r=>new t(r))}async rgba(){return y("plugin:image|rgba",{rid:this.rid}).then(e=>new Uint8Array(e))}async size(){return y("plugin:image|size",{rid:this.rid})}}});var Qu={};Pe(Qu,{CloseRequestedEvent:()=>ps,Effect:()=>mi,EffectState:()=>gi,LogicalPosition:()=>on,LogicalSize:()=>sn,PhysicalPosition:()=>pe,PhysicalSize:()=>Ye,ProgressBarStatus:()=>hi,UserAttentionType:()=>fs,Window:()=>Jn,availableMonitors:()=>rb,currentMonitor:()=>Xy,cursorPosition:()=>nb,getAllWindows:()=>ds,getCurrentWindow:()=>Yu,monitorFromPoint:()=>tb,primaryMonitor:()=>eb});function Yu(){return new Jn(window.__TAURI_INTERNALS__.metadata.currentWindow.label,{skip:!0})}async function ds(){return y("plugin:window|get_all_windows").then(t=>t.map(e=>new Jn(e,{skip:!0})))}function hs(t){return t===null?null:{name:t.name,scaleFactor:t.scaleFactor,position:new pe(t.position),size:new Ye(t.size),workArea:{position:new pe(t.workArea.position),size:new Ye(t.workArea.size)}}}async function Xy(){return y("plugin:window|current_monitor").then(hs)}async function eb(){return y("plugin:window|primary_monitor").then(hs)}async function tb(t,e){return y("plugin:window|monitor_from_point",{x:t,y:e}).then(hs)}async function rb(){return y("plugin:window|available_monitors").then(t=>t.map(hs))}async function nb(){return y("plugin:window|cursor_position").then(t=>new pe(t))}var fs,ps,hi,pi,Jn,Ju,Zu,mi,gi,Ku=B(()=>{di();di();ls();ot();Gu();(function(t){t[t.Critical=1]="Critical",t[t.Informational=2]="Informational"})(fs||(fs={}));ps=class{constructor(e){this._preventDefault=!1,this.event=e.event,this.id=e.id}preventDefault(){this._preventDefault=!0}isPreventDefault(){return this._preventDefault}};(function(t){t.None="none",t.Normal="normal",t.Indeterminate="indeterminate",t.Paused="paused",t.Error="error"})(hi||(hi={}));pi=["tauri://created","tauri://error"],Jn=class{constructor(e,r={}){var a;this.label=e,this.listeners=Object.create(null),r?.skip||y("plugin:window|create",{options:{...r,parent:typeof r.parent=="string"?r.parent:(a=r.parent)===null||a===void 0?void 0:a.label,label:e}}).then(async()=>this.emit("tauri://created")).catch(async s=>this.emit("tauri://error",s))}static async getByLabel(e){var r;return(r=(await ds()).find(a=>a.label===e))!==null&&r!==void 0?r:null}static getCurrent(){return Yu()}static async getAll(){return ds()}static async getFocusedWindow(){for(let e of await ds())if(await e.isFocused())return e;return null}async listen(e,r){return this._handleTauriEvent(e,r)?()=>{let a=this.listeners[e];a.splice(a.indexOf(r),1)}:cs(e,r,{target:{kind:"Window",label:this.label}})}async once(e,r){return this._handleTauriEvent(e,r)?()=>{let a=this.listeners[e];a.splice(a.indexOf(r),1)}:Zo(e,r,{target:{kind:"Window",label:this.label}})}async emit(e,r){if(pi.includes(e)){for(let a of this.listeners[e]||[])a({event:e,id:-1,payload:r});return}return Fn(e,r)}async emitTo(e,r,a){if(pi.includes(r)){for(let s of this.listeners[r]||[])s({event:r,id:-1,payload:a});return}return Yo(e,r,a)}_handleTauriEvent(e,r){return pi.includes(e)?(e in this.listeners?this.listeners[e].push(r):this.listeners[e]=[r],!0):!1}async scaleFactor(){return y("plugin:window|scale_factor",{label:this.label})}async innerPosition(){return y("plugin:window|inner_position",{label:this.label}).then(e=>new pe(e))}async outerPosition(){return y("plugin:window|outer_position",{label:this.label}).then(e=>new pe(e))}async innerSize(){return y("plugin:window|inner_size",{label:this.label}).then(e=>new Ye(e))}async outerSize(){return y("plugin:window|outer_size",{label:this.label}).then(e=>new Ye(e))}async isFullscreen(){return y("plugin:window|is_fullscreen",{label:this.label})}async isMinimized(){return y("plugin:window|is_minimized",{label:this.label})}async isMaximized(){return y("plugin:window|is_maximized",{label:this.label})}async isFocused(){return y("plugin:window|is_focused",{label:this.label})}async isDecorated(){return y("plugin:window|is_decorated",{label:this.label})}async isResizable(){return y("plugin:window|is_resizable",{label:this.label})}async isMaximizable(){return y("plugin:window|is_maximizable",{label:this.label})}async isMinimizable(){return y("plugin:window|is_minimizable",{label:this.label})}async isClosable(){return y("plugin:window|is_closable",{label:this.label})}async isVisible(){return y("plugin:window|is_visible",{label:this.label})}async title(){return y("plugin:window|title",{label:this.label})}async theme(){return y("plugin:window|theme",{label:this.label})}async isAlwaysOnTop(){return y("plugin:window|is_always_on_top",{label:this.label})}async center(){return y("plugin:window|center",{label:this.label})}async requestUserAttention(e){let r=null;return e&&(e===fs.Critical?r={type:"Critical"}:r={type:"Informational"}),y("plugin:window|request_user_attention",{label:this.label,value:r})}async setResizable(e){return y("plugin:window|set_resizable",{label:this.label,value:e})}async setEnabled(e){return y("plugin:window|set_enabled",{label:this.label,value:e})}async isEnabled(){return y("plugin:window|is_enabled",{label:this.label})}async setMaximizable(e){return y("plugin:window|set_maximizable",{label:this.label,value:e})}async setMinimizable(e){return y("plugin:window|set_minimizable",{label:this.label,value:e})}async setClosable(e){return y("plugin:window|set_closable",{label:this.label,value:e})}async setTitle(e){return y("plugin:window|set_title",{label:this.label,value:e})}async maximize(){return y("plugin:window|maximize",{label:this.label})}async unmaximize(){return y("plugin:window|unmaximize",{label:this.label})}async toggleMaximize(){return y("plugin:window|toggle_maximize",{label:this.label})}async minimize(){return y("plugin:window|minimize",{label:this.label})}async unminimize(){return y("plugin:window|unminimize",{label:this.label})}async show(){return y("plugin:window|show",{label:this.label})}async hide(){return y("plugin:window|hide",{label:this.label})}async close(){return y("plugin:window|close",{label:this.label})}async destroy(){return y("plugin:window|destroy",{label:this.label})}async setDecorations(e){return y("plugin:window|set_decorations",{label:this.label,value:e})}async setShadow(e){return y("plugin:window|set_shadow",{label:this.label,value:e})}async setEffects(e){return y("plugin:window|set_effects",{label:this.label,value:e})}async clearEffects(){return y("plugin:window|set_effects",{label:this.label,value:null})}async setAlwaysOnTop(e){return y("plugin:window|set_always_on_top",{label:this.label,value:e})}async setAlwaysOnBottom(e){return y("plugin:window|set_always_on_bottom",{label:this.label,value:e})}async setContentProtected(e){return y("plugin:window|set_content_protected",{label:this.label,value:e})}async setSize(e){return y("plugin:window|set_size",{label:this.label,value:e instanceof vt?e:new vt(e)})}async setMinSize(e){return y("plugin:window|set_min_size",{label:this.label,value:e instanceof vt?e:e?new vt(e):null})}async setMaxSize(e){return y("plugin:window|set_max_size",{label:this.label,value:e instanceof vt?e:e?new vt(e):null})}async setSizeConstraints(e){function r(a){return a?{Logical:a}:null}return y("plugin:window|set_size_constraints",{label:this.label,value:{minWidth:r(e?.minWidth),minHeight:r(e?.minHeight),maxWidth:r(e?.maxWidth),maxHeight:r(e?.maxHeight)}})}async setPosition(e){return y("plugin:window|set_position",{label:this.label,value:e instanceof Er?e:new Er(e)})}async setFullscreen(e){return y("plugin:window|set_fullscreen",{label:this.label,value:e})}async setSimpleFullscreen(e){return y("plugin:window|set_simple_fullscreen",{label:this.label,value:e})}async setFocus(){return y("plugin:window|set_focus",{label:this.label})}async setFocusable(e){return y("plugin:window|set_focusable",{label:this.label,value:e})}async setIcon(e){return y("plugin:window|set_icon",{label:this.label,value:Gn(e)})}async setSkipTaskbar(e){return y("plugin:window|set_skip_taskbar",{label:this.label,value:e})}async setCursorGrab(e){return y("plugin:window|set_cursor_grab",{label:this.label,value:e})}async setCursorVisible(e){return y("plugin:window|set_cursor_visible",{label:this.label,value:e})}async setCursorIcon(e){return y("plugin:window|set_cursor_icon",{label:this.label,value:e})}async setBackgroundColor(e){return y("plugin:window|set_background_color",{color:e})}async setCursorPosition(e){return y("plugin:window|set_cursor_position",{label:this.label,value:e instanceof Er?e:new Er(e)})}async setIgnoreCursorEvents(e){return y("plugin:window|set_ignore_cursor_events",{label:this.label,value:e})}async startDragging(){return y("plugin:window|start_dragging",{label:this.label})}async startResizeDragging(e){return y("plugin:window|start_resize_dragging",{label:this.label,value:e})}async setBadgeCount(e){return y("plugin:window|set_badge_count",{label:this.label,value:e})}async setBadgeLabel(e){return y("plugin:window|set_badge_label",{label:this.label,value:e})}async setOverlayIcon(e){return y("plugin:window|set_overlay_icon",{label:this.label,value:e?Gn(e):void 0})}async setProgressBar(e){return y("plugin:window|set_progress_bar",{label:this.label,value:e})}async setVisibleOnAllWorkspaces(e){return y("plugin:window|set_visible_on_all_workspaces",{label:this.label,value:e})}async setTitleBarStyle(e){return y("plugin:window|set_title_bar_style",{label:this.label,value:e})}async setTheme(e){return y("plugin:window|set_theme",{label:this.label,value:e})}async onResized(e){return this.listen(fe.WINDOW_RESIZED,r=>{r.payload=new Ye(r.payload),e(r)})}async onMoved(e){return this.listen(fe.WINDOW_MOVED,r=>{r.payload=new pe(r.payload),e(r)})}async onCloseRequested(e){return this.listen(fe.WINDOW_CLOSE_REQUESTED,async r=>{let a=new ps(r);await e(a),a.isPreventDefault()||await this.destroy()})}async onDragDropEvent(e){let r=await this.listen(fe.DRAG_ENTER,c=>{e({...c,payload:{type:"enter",paths:c.payload.paths,position:new pe(c.payload.position)}})}),a=await this.listen(fe.DRAG_OVER,c=>{e({...c,payload:{type:"over",position:new pe(c.payload.position)}})}),s=await this.listen(fe.DRAG_DROP,c=>{e({...c,payload:{type:"drop",paths:c.payload.paths,position:new pe(c.payload.position)}})}),i=await this.listen(fe.DRAG_LEAVE,c=>{e({...c,payload:{type:"leave"}})});return()=>{r(),s(),a(),i()}}async onFocusChanged(e){let r=await this.listen(fe.WINDOW_FOCUS,s=>{e({...s,payload:!0})}),a=await this.listen(fe.WINDOW_BLUR,s=>{e({...s,payload:!1})});return()=>{r(),a()}}async onScaleChanged(e){return this.listen(fe.WINDOW_SCALE_FACTOR_CHANGED,e)}async onThemeChanged(e){return this.listen(fe.WINDOW_THEME_CHANGED,e)}};(function(t){t.Disabled="disabled",t.Throttle="throttle",t.Suspend="suspend"})(Ju||(Ju={}));(function(t){t.Default="default",t.FluentOverlay="fluentOverlay"})(Zu||(Zu={}));(function(t){t.AppearanceBased="appearanceBased",t.Light="light",t.Dark="dark",t.MediumLight="mediumLight",t.UltraDark="ultraDark",t.Titlebar="titlebar",t.Selection="selection",t.Menu="menu",t.Popover="popover",t.Sidebar="sidebar",t.HeaderView="headerView",t.Sheet="sheet",t.WindowBackground="windowBackground",t.HudWindow="hudWindow",t.FullScreenUI="fullScreenUI",t.Tooltip="tooltip",t.ContentBackground="contentBackground",t.UnderWindowBackground="underWindowBackground",t.UnderPageBackground="underPageBackground",t.Mica="mica",t.Blur="blur",t.Acrylic="acrylic",t.Tabbed="tabbed",t.TabbedDark="tabbedDark",t.TabbedLight="tabbedLight"})(mi||(mi={}));(function(t){t.FollowsWindowActiveState="followsWindowActiveState",t.Active="active",t.Inactive="inactive"})(gi||(gi={}))});var h={};Pe(h,{BRAND:()=>Op,DIRTY:()=>tr,EMPTY_PATH:()=>dp,INVALID:()=>$,NEVER:()=>yh,OK:()=>ie,ParseStatus:()=>ae,Schema:()=>N,ZodAny:()=>jt,ZodArray:()=>wt,ZodBigInt:()=>nr,ZodBoolean:()=>ar,ZodBranded:()=>kn,ZodCatch:()=>mr,ZodDate:()=>sr,ZodDefault:()=>hr,ZodDiscriminatedUnion:()=>Aa,ZodEffects:()=>De,ZodEnum:()=>fr,ZodError:()=>me,ZodFirstPartyTypeKind:()=>I,ZodFunction:()=>Pa,ZodIntersection:()=>lr,ZodIssueCode:()=>_,ZodLazy:()=>ur,ZodLiteral:()=>dr,ZodMap:()=>Zr,ZodNaN:()=>Qr,ZodNativeEnum:()=>pr,ZodNever:()=>Ue,ZodNull:()=>ir,ZodNullable:()=>tt,ZodNumber:()=>rr,ZodObject:()=>ge,ZodOptional:()=>Ie,ZodParsedType:()=>C,ZodPipeline:()=>Sn,ZodPromise:()=>Wt,ZodReadonly:()=>gr,ZodRecord:()=>$a,ZodSchema:()=>N,ZodSet:()=>Yr,ZodString:()=>Ft,ZodSymbol:()=>Gr,ZodTransformer:()=>De,ZodTuple:()=>et,ZodType:()=>N,ZodUndefined:()=>or,ZodUnion:()=>cr,ZodUnknown:()=>bt,ZodVoid:()=>Jr,addIssueToContext:()=>S,any:()=>Bp,array:()=>Vp,bigint:()=>Mp,boolean:()=>Jc,coerce:()=>gh,custom:()=>Hc,date:()=>Fp,datetimeRegex:()=>Uc,defaultErrorMap:()=>gt,discriminatedUnion:()=>Yp,effect:()=>ch,enum:()=>sh,function:()=>rh,getErrorMap:()=>zr,getParsedType:()=>Xe,instanceof:()=>Lp,intersection:()=>Qp,isAborted:()=>Ra,isAsync:()=>Hr,isDirty:()=>Ea,isValid:()=>Mt,late:()=>Dp,lazy:()=>nh,literal:()=>ah,makeIssue:()=>_n,map:()=>eh,nan:()=>Np,nativeEnum:()=>oh,never:()=>zp,null:()=>qp,nullable:()=>uh,number:()=>Gc,object:()=>Gp,objectUtil:()=>oo,oboolean:()=>mh,onumber:()=>hh,optional:()=>lh,ostring:()=>ph,pipeline:()=>fh,preprocess:()=>dh,promise:()=>ih,quotelessJson:()=>cp,record:()=>Xp,set:()=>th,setErrorMap:()=>up,strictObject:()=>Jp,string:()=>Vc,symbol:()=>jp,transformer:()=>ch,tuple:()=>Kp,undefined:()=>Wp,union:()=>Zp,unknown:()=>Up,util:()=>F,void:()=>Hp});var F;(function(t){t.assertEqual=s=>{};function e(s){}t.assertIs=e;function r(s){throw new Error}t.assertNever=r,t.arrayToEnum=s=>{let i={};for(let c of s)i[c]=c;return i},t.getValidEnumValues=s=>{let i=t.objectKeys(s).filter(u=>typeof s[s[u]]!="number"),c={};for(let u of i)c[u]=s[u];return t.objectValues(c)},t.objectValues=s=>t.objectKeys(s).map(function(i){return s[i]}),t.objectKeys=typeof Object.keys=="function"?s=>Object.keys(s):s=>{let i=[];for(let c in s)Object.prototype.hasOwnProperty.call(s,c)&&i.push(c);return i},t.find=(s,i)=>{for(let c of s)if(i(c))return c},t.isInteger=typeof Number.isInteger=="function"?s=>Number.isInteger(s):s=>typeof s=="number"&&Number.isFinite(s)&&Math.floor(s)===s;function a(s,i=" | "){return s.map(c=>typeof c=="string"?`'${c}'`:c).join(i)}t.joinValues=a,t.jsonStringifyReplacer=(s,i)=>typeof i=="bigint"?i.toString():i})(F||(F={}));var oo;(function(t){t.mergeShapes=(e,r)=>({...e,...r})})(oo||(oo={}));var C=F.arrayToEnum(["string","nan","number","integer","float","boolean","date","bigint","symbol","function","undefined","null","array","object","unknown","promise","void","never","map","set"]),Xe=t=>{switch(typeof t){case"undefined":return C.undefined;case"string":return C.string;case"number":return Number.isNaN(t)?C.nan:C.number;case"boolean":return C.boolean;case"function":return C.function;case"bigint":return C.bigint;case"symbol":return C.symbol;case"object":return Array.isArray(t)?C.array:t===null?C.null:t.then&&typeof t.then=="function"&&t.catch&&typeof t.catch=="function"?C.promise:typeof Map<"u"&&t instanceof Map?C.map:typeof Set<"u"&&t instanceof Set?C.set:typeof Date<"u"&&t instanceof Date?C.date:C.object;default:return C.unknown}};var _=F.arrayToEnum(["invalid_type","invalid_literal","custom","invalid_union","invalid_union_discriminator","invalid_enum_value","unrecognized_keys","invalid_arguments","invalid_return_type","invalid_date","invalid_string","too_small","too_big","invalid_intersection_types","not_multiple_of","not_finite"]),cp=t=>JSON.stringify(t,null,2).replace(/"([^"]+)":/g,"$1:"),me=class t extends Error{get errors(){return this.issues}constructor(e){super(),this.issues=[],this.addIssue=a=>{this.issues=[...this.issues,a]},this.addIssues=(a=[])=>{this.issues=[...this.issues,...a]};let r=new.target.prototype;Object.setPrototypeOf?Object.setPrototypeOf(this,r):this.__proto__=r,this.name="ZodError",this.issues=e}format(e){let r=e||function(i){return i.message},a={_errors:[]},s=i=>{for(let c of i.issues)if(c.code==="invalid_union")c.unionErrors.map(s);else if(c.code==="invalid_return_type")s(c.returnTypeError);else if(c.code==="invalid_arguments")s(c.argumentsError);else if(c.path.length===0)a._errors.push(r(c));else{let u=a,p=0;for(;p<c.path.length;){let d=c.path[p];p===c.path.length-1?(u[d]=u[d]||{_errors:[]},u[d]._errors.push(r(c))):u[d]=u[d]||{_errors:[]},u=u[d],p++}}};return s(this),a}static assert(e){if(!(e instanceof t))throw new Error(`Not a ZodError: ${e}`)}toString(){return this.message}get message(){return JSON.stringify(this.issues,F.jsonStringifyReplacer,2)}get isEmpty(){return this.issues.length===0}flatten(e=r=>r.message){let r={},a=[];for(let s of this.issues)if(s.path.length>0){let i=s.path[0];r[i]=r[i]||[],r[i].push(e(s))}else a.push(e(s));return{formErrors:a,fieldErrors:r}}get formErrors(){return this.flatten()}};me.create=t=>new me(t);var lp=(t,e)=>{let r;switch(t.code){case _.invalid_type:t.received===C.undefined?r="Required":r=`Expected ${t.expected}, received ${t.received}`;break;case _.invalid_literal:r=`Invalid literal value, expected ${JSON.stringify(t.expected,F.jsonStringifyReplacer)}`;break;case _.unrecognized_keys:r=`Unrecognized key(s) in object: ${F.joinValues(t.keys,", ")}`;break;case _.invalid_union:r="Invalid input";break;case _.invalid_union_discriminator:r=`Invalid discriminator value. Expected ${F.joinValues(t.options)}`;break;case _.invalid_enum_value:r=`Invalid enum value. Expected ${F.joinValues(t.options)}, received '${t.received}'`;break;case _.invalid_arguments:r="Invalid function arguments";break;case _.invalid_return_type:r="Invalid function return type";break;case _.invalid_date:r="Invalid date";break;case _.invalid_string:typeof t.validation=="object"?"includes"in t.validation?(r=`Invalid input: must include "${t.validation.includes}"`,typeof t.validation.position=="number"&&(r=`${r} at one or more positions greater than or equal to ${t.validation.position}`)):"startsWith"in t.validation?r=`Invalid input: must start with "${t.validation.startsWith}"`:"endsWith"in t.validation?r=`Invalid input: must end with "${t.validation.endsWith}"`:F.assertNever(t.validation):t.validation!=="regex"?r=`Invalid ${t.validation}`:r="Invalid";break;case _.too_small:t.type==="array"?r=`Array must contain ${t.exact?"exactly":t.inclusive?"at least":"more than"} ${t.minimum} element(s)`:t.type==="string"?r=`String must contain ${t.exact?"exactly":t.inclusive?"at least":"over"} ${t.minimum} character(s)`:t.type==="number"?r=`Number must be ${t.exact?"exactly equal to ":t.inclusive?"greater than or equal to ":"greater than "}${t.minimum}`:t.type==="bigint"?r=`Number must be ${t.exact?"exactly equal to ":t.inclusive?"greater than or equal to ":"greater than "}${t.minimum}`:t.type==="date"?r=`Date must be ${t.exact?"exactly equal to ":t.inclusive?"greater than or equal to ":"greater than "}${new Date(Number(t.minimum))}`:r="Invalid input";break;case _.too_big:t.type==="array"?r=`Array must contain ${t.exact?"exactly":t.inclusive?"at most":"less than"} ${t.maximum} element(s)`:t.type==="string"?r=`String must contain ${t.exact?"exactly":t.inclusive?"at most":"under"} ${t.maximum} character(s)`:t.type==="number"?r=`Number must be ${t.exact?"exactly":t.inclusive?"less than or equal to":"less than"} ${t.maximum}`:t.type==="bigint"?r=`BigInt must be ${t.exact?"exactly":t.inclusive?"less than or equal to":"less than"} ${t.maximum}`:t.type==="date"?r=`Date must be ${t.exact?"exactly":t.inclusive?"smaller than or equal to":"smaller than"} ${new Date(Number(t.maximum))}`:r="Invalid input";break;case _.custom:r="Invalid input";break;case _.invalid_intersection_types:r="Intersection results could not be merged";break;case _.not_multiple_of:r=`Number must be a multiple of ${t.multipleOf}`;break;case _.not_finite:r="Number must be finite";break;default:r=e.defaultError,F.assertNever(t)}return{message:r}},gt=lp;var Fc=gt;function up(t){Fc=t}function zr(){return Fc}var _n=t=>{let{data:e,path:r,errorMaps:a,issueData:s}=t,i=[...r,...s.path||[]],c={...s,path:i};if(s.message!==void 0)return{...s,path:i,message:s.message};let u="",p=a.filter(d=>!!d).slice().reverse();for(let d of p)u=d(c,{data:e,defaultError:u}).message;return{...s,path:i,message:u}},dp=[];function S(t,e){let r=zr(),a=_n({issueData:e,data:t.data,path:t.path,errorMaps:[t.common.contextualErrorMap,t.schemaErrorMap,r,r===gt?void 0:gt].filter(s=>!!s)});t.common.issues.push(a)}var ae=class t{constructor(){this.value="valid"}dirty(){this.value==="valid"&&(this.value="dirty")}abort(){this.value!=="aborted"&&(this.value="aborted")}static mergeArray(e,r){let a=[];for(let s of r){if(s.status==="aborted")return $;s.status==="dirty"&&e.dirty(),a.push(s.value)}return{status:e.value,value:a}}static async mergeObjectAsync(e,r){let a=[];for(let s of r){let i=await s.key,c=await s.value;a.push({key:i,value:c})}return t.mergeObjectSync(e,a)}static mergeObjectSync(e,r){let a={};for(let s of r){let{key:i,value:c}=s;if(i.status==="aborted"||c.status==="aborted")return $;i.status==="dirty"&&e.dirty(),c.status==="dirty"&&e.dirty(),i.value!=="__proto__"&&(typeof c.value<"u"||s.alwaysSet)&&(a[i.value]=c.value)}return{status:e.value,value:a}}},$=Object.freeze({status:"aborted"}),tr=t=>({status:"dirty",value:t}),ie=t=>({status:"valid",value:t}),Ra=t=>t.status==="aborted",Ea=t=>t.status==="dirty",Mt=t=>t.status==="valid",Hr=t=>typeof Promise<"u"&&t instanceof Promise;var R;(function(t){t.errToObj=e=>typeof e=="string"?{message:e}:e||{},t.toString=e=>typeof e=="string"?e:e?.message})(R||(R={}));var Oe=class{constructor(e,r,a,s){this._cachedPath=[],this.parent=e,this.data=r,this._path=a,this._key=s}get path(){return this._cachedPath.length||(Array.isArray(this._key)?this._cachedPath.push(...this._path,...this._key):this._cachedPath.push(...this._path,this._key)),this._cachedPath}},jc=(t,e)=>{if(Mt(e))return{success:!0,data:e.value};if(!t.common.issues.length)throw new Error("Validation failed but no issues detected.");return{success:!1,get error(){if(this._error)return this._error;let r=new me(t.common.issues);return this._error=r,this._error}}};function L(t){if(!t)return{};let{errorMap:e,invalid_type_error:r,required_error:a,description:s}=t;if(e&&(r||a))throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);return e?{errorMap:e,description:s}:{errorMap:(c,u)=>{let{message:p}=t;return c.code==="invalid_enum_value"?{message:p??u.defaultError}:typeof u.data>"u"?{message:p??a??u.defaultError}:c.code!=="invalid_type"?{message:u.defaultError}:{message:p??r??u.defaultError}},description:s}}var N=class{get description(){return this._def.description}_getType(e){return Xe(e.data)}_getOrReturnCtx(e,r){return r||{common:e.parent.common,data:e.data,parsedType:Xe(e.data),schemaErrorMap:this._def.errorMap,path:e.path,parent:e.parent}}_processInputParams(e){return{status:new ae,ctx:{common:e.parent.common,data:e.data,parsedType:Xe(e.data),schemaErrorMap:this._def.errorMap,path:e.path,parent:e.parent}}}_parseSync(e){let r=this._parse(e);if(Hr(r))throw new Error("Synchronous parse encountered promise.");return r}_parseAsync(e){let r=this._parse(e);return Promise.resolve(r)}parse(e,r){let a=this.safeParse(e,r);if(a.success)return a.data;throw a.error}safeParse(e,r){let a={common:{issues:[],async:r?.async??!1,contextualErrorMap:r?.errorMap},path:r?.path||[],schemaErrorMap:this._def.errorMap,parent:null,data:e,parsedType:Xe(e)},s=this._parseSync({data:e,path:a.path,parent:a});return jc(a,s)}"~validate"(e){let r={common:{issues:[],async:!!this["~standard"].async},path:[],schemaErrorMap:this._def.errorMap,parent:null,data:e,parsedType:Xe(e)};if(!this["~standard"].async)try{let a=this._parseSync({data:e,path:[],parent:r});return Mt(a)?{value:a.value}:{issues:r.common.issues}}catch(a){a?.message?.toLowerCase()?.includes("encountered")&&(this["~standard"].async=!0),r.common={issues:[],async:!0}}return this._parseAsync({data:e,path:[],parent:r}).then(a=>Mt(a)?{value:a.value}:{issues:r.common.issues})}async parseAsync(e,r){let a=await this.safeParseAsync(e,r);if(a.success)return a.data;throw a.error}async safeParseAsync(e,r){let a={common:{issues:[],contextualErrorMap:r?.errorMap,async:!0},path:r?.path||[],schemaErrorMap:this._def.errorMap,parent:null,data:e,parsedType:Xe(e)},s=this._parse({data:e,path:a.path,parent:a}),i=await(Hr(s)?s:Promise.resolve(s));return jc(a,i)}refine(e,r){let a=s=>typeof r=="string"||typeof r>"u"?{message:r}:typeof r=="function"?r(s):r;return this._refinement((s,i)=>{let c=e(s),u=()=>i.addIssue({code:_.custom,...a(s)});return typeof Promise<"u"&&c instanceof Promise?c.then(p=>p?!0:(u(),!1)):c?!0:(u(),!1)})}refinement(e,r){return this._refinement((a,s)=>e(a)?!0:(s.addIssue(typeof r=="function"?r(a,s):r),!1))}_refinement(e){return new De({schema:this,typeName:I.ZodEffects,effect:{type:"refinement",refinement:e}})}superRefine(e){return this._refinement(e)}constructor(e){this.spa=this.safeParseAsync,this._def=e,this.parse=this.parse.bind(this),this.safeParse=this.safeParse.bind(this),this.parseAsync=this.parseAsync.bind(this),this.safeParseAsync=this.safeParseAsync.bind(this),this.spa=this.spa.bind(this),this.refine=this.refine.bind(this),this.refinement=this.refinement.bind(this),this.superRefine=this.superRefine.bind(this),this.optional=this.optional.bind(this),this.nullable=this.nullable.bind(this),this.nullish=this.nullish.bind(this),this.array=this.array.bind(this),this.promise=this.promise.bind(this),this.or=this.or.bind(this),this.and=this.and.bind(this),this.transform=this.transform.bind(this),this.brand=this.brand.bind(this),this.default=this.default.bind(this),this.catch=this.catch.bind(this),this.describe=this.describe.bind(this),this.pipe=this.pipe.bind(this),this.readonly=this.readonly.bind(this),this.isNullable=this.isNullable.bind(this),this.isOptional=this.isOptional.bind(this),this["~standard"]={version:1,vendor:"zod",validate:r=>this["~validate"](r)}}optional(){return Ie.create(this,this._def)}nullable(){return tt.create(this,this._def)}nullish(){return this.nullable().optional()}array(){return wt.create(this)}promise(){return Wt.create(this,this._def)}or(e){return cr.create([this,e],this._def)}and(e){return lr.create(this,e,this._def)}transform(e){return new De({...L(this._def),schema:this,typeName:I.ZodEffects,effect:{type:"transform",transform:e}})}default(e){let r=typeof e=="function"?e:()=>e;return new hr({...L(this._def),innerType:this,defaultValue:r,typeName:I.ZodDefault})}brand(){return new kn({typeName:I.ZodBranded,type:this,...L(this._def)})}catch(e){let r=typeof e=="function"?e:()=>e;return new mr({...L(this._def),innerType:this,catchValue:r,typeName:I.ZodCatch})}describe(e){let r=this.constructor;return new r({...this._def,description:e})}pipe(e){return Sn.create(this,e)}readonly(){return gr.create(this)}isOptional(){return this.safeParse(void 0).success}isNullable(){return this.safeParse(null).success}},fp=/^c[^\s-]{8,}$/i,pp=/^[0-9a-z]+$/,hp=/^[0-9A-HJKMNP-TV-Z]{26}$/i,mp=/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i,gp=/^[a-z0-9_-]{21}$/i,yp=/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,bp=/^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/,wp=/^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i,_p="^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$",io,kp=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,Sp=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,xp=/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,vp=/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,Tp=/^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,Cp=/^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,qc="((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))",Rp=new RegExp(`^${qc}$`);function Bc(t){let e="[0-5]\\d";t.precision?e=`${e}\\.\\d{${t.precision}}`:t.precision==null&&(e=`${e}(\\.\\d+)?`);let r=t.precision?"+":"?";return`([01]\\d|2[0-3]):[0-5]\\d(:${e})${r}`}function Ep(t){return new RegExp(`^${Bc(t)}$`)}function Uc(t){let e=`${qc}T${Bc(t)}`,r=[];return r.push(t.local?"Z?":"Z"),t.offset&&r.push("([+-]\\d{2}:?\\d{2})"),e=`${e}(${r.join("|")})`,new RegExp(`^${e}$`)}function Ap(t,e){return!!((e==="v4"||!e)&&kp.test(t)||(e==="v6"||!e)&&xp.test(t))}function $p(t,e){if(!yp.test(t))return!1;try{let[r]=t.split(".");if(!r)return!1;let a=r.replace(/-/g,"+").replace(/_/g,"/").padEnd(r.length+(4-r.length%4)%4,"="),s=JSON.parse(atob(a));return!(typeof s!="object"||s===null||"typ"in s&&s?.typ!=="JWT"||!s.alg||e&&s.alg!==e)}catch{return!1}}function Pp(t,e){return!!((e==="v4"||!e)&&Sp.test(t)||(e==="v6"||!e)&&vp.test(t))}var Ft=class t extends N{_parse(e){if(this._def.coerce&&(e.data=String(e.data)),this._getType(e)!==C.string){let i=this._getOrReturnCtx(e);return S(i,{code:_.invalid_type,expected:C.string,received:i.parsedType}),$}let a=new ae,s;for(let i of this._def.checks)if(i.kind==="min")e.data.length<i.value&&(s=this._getOrReturnCtx(e,s),S(s,{code:_.too_small,minimum:i.value,type:"string",inclusive:!0,exact:!1,message:i.message}),a.dirty());else if(i.kind==="max")e.data.length>i.value&&(s=this._getOrReturnCtx(e,s),S(s,{code:_.too_big,maximum:i.value,type:"string",inclusive:!0,exact:!1,message:i.message}),a.dirty());else if(i.kind==="length"){let c=e.data.length>i.value,u=e.data.length<i.value;(c||u)&&(s=this._getOrReturnCtx(e,s),c?S(s,{code:_.too_big,maximum:i.value,type:"string",inclusive:!0,exact:!0,message:i.message}):u&&S(s,{code:_.too_small,minimum:i.value,type:"string",inclusive:!0,exact:!0,message:i.message}),a.dirty())}else if(i.kind==="email")wp.test(e.data)||(s=this._getOrReturnCtx(e,s),S(s,{validation:"email",code:_.invalid_string,message:i.message}),a.dirty());else if(i.kind==="emoji")io||(io=new RegExp(_p,"u")),io.test(e.data)||(s=this._getOrReturnCtx(e,s),S(s,{validation:"emoji",code:_.invalid_string,message:i.message}),a.dirty());else if(i.kind==="uuid")mp.test(e.data)||(s=this._getOrReturnCtx(e,s),S(s,{validation:"uuid",code:_.invalid_string,message:i.message}),a.dirty());else if(i.kind==="nanoid")gp.test(e.data)||(s=this._getOrReturnCtx(e,s),S(s,{validation:"nanoid",code:_.invalid_string,message:i.message}),a.dirty());else if(i.kind==="cuid")fp.test(e.data)||(s=this._getOrReturnCtx(e,s),S(s,{validation:"cuid",code:_.invalid_string,message:i.message}),a.dirty());else if(i.kind==="cuid2")pp.test(e.data)||(s=this._getOrReturnCtx(e,s),S(s,{validation:"cuid2",code:_.invalid_string,message:i.message}),a.dirty());else if(i.kind==="ulid")hp.test(e.data)||(s=this._getOrReturnCtx(e,s),S(s,{validation:"ulid",code:_.invalid_string,message:i.message}),a.dirty());else if(i.kind==="url")try{new URL(e.data)}catch{s=this._getOrReturnCtx(e,s),S(s,{validation:"url",code:_.invalid_string,message:i.message}),a.dirty()}else i.kind==="regex"?(i.regex.lastIndex=0,i.regex.test(e.data)||(s=this._getOrReturnCtx(e,s),S(s,{validation:"regex",code:_.invalid_string,message:i.message}),a.dirty())):i.kind==="trim"?e.data=e.data.trim():i.kind==="includes"?e.data.includes(i.value,i.position)||(s=this._getOrReturnCtx(e,s),S(s,{code:_.invalid_string,validation:{includes:i.value,position:i.position},message:i.message}),a.dirty()):i.kind==="toLowerCase"?e.data=e.data.toLowerCase():i.kind==="toUpperCase"?e.data=e.data.toUpperCase():i.kind==="startsWith"?e.data.startsWith(i.value)||(s=this._getOrReturnCtx(e,s),S(s,{code:_.invalid_string,validation:{startsWith:i.value},message:i.message}),a.dirty()):i.kind==="endsWith"?e.data.endsWith(i.value)||(s=this._getOrReturnCtx(e,s),S(s,{code:_.invalid_string,validation:{endsWith:i.value},message:i.message}),a.dirty()):i.kind==="datetime"?Uc(i).test(e.data)||(s=this._getOrReturnCtx(e,s),S(s,{code:_.invalid_string,validation:"datetime",message:i.message}),a.dirty()):i.kind==="date"?Rp.test(e.data)||(s=this._getOrReturnCtx(e,s),S(s,{code:_.invalid_string,validation:"date",message:i.message}),a.dirty()):i.kind==="time"?Ep(i).test(e.data)||(s=this._getOrReturnCtx(e,s),S(s,{code:_.invalid_string,validation:"time",message:i.message}),a.dirty()):i.kind==="duration"?bp.test(e.data)||(s=this._getOrReturnCtx(e,s),S(s,{validation:"duration",code:_.invalid_string,message:i.message}),a.dirty()):i.kind==="ip"?Ap(e.data,i.version)||(s=this._getOrReturnCtx(e,s),S(s,{validation:"ip",code:_.invalid_string,message:i.message}),a.dirty()):i.kind==="jwt"?$p(e.data,i.alg)||(s=this._getOrReturnCtx(e,s),S(s,{validation:"jwt",code:_.invalid_string,message:i.message}),a.dirty()):i.kind==="cidr"?Pp(e.data,i.version)||(s=this._getOrReturnCtx(e,s),S(s,{validation:"cidr",code:_.invalid_string,message:i.message}),a.dirty()):i.kind==="base64"?Tp.test(e.data)||(s=this._getOrReturnCtx(e,s),S(s,{validation:"base64",code:_.invalid_string,message:i.message}),a.dirty()):i.kind==="base64url"?Cp.test(e.data)||(s=this._getOrReturnCtx(e,s),S(s,{validation:"base64url",code:_.invalid_string,message:i.message}),a.dirty()):F.assertNever(i);return{status:a.value,value:e.data}}_regex(e,r,a){return this.refinement(s=>e.test(s),{validation:r,code:_.invalid_string,...R.errToObj(a)})}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}email(e){return this._addCheck({kind:"email",...R.errToObj(e)})}url(e){return this._addCheck({kind:"url",...R.errToObj(e)})}emoji(e){return this._addCheck({kind:"emoji",...R.errToObj(e)})}uuid(e){return this._addCheck({kind:"uuid",...R.errToObj(e)})}nanoid(e){return this._addCheck({kind:"nanoid",...R.errToObj(e)})}cuid(e){return this._addCheck({kind:"cuid",...R.errToObj(e)})}cuid2(e){return this._addCheck({kind:"cuid2",...R.errToObj(e)})}ulid(e){return this._addCheck({kind:"ulid",...R.errToObj(e)})}base64(e){return this._addCheck({kind:"base64",...R.errToObj(e)})}base64url(e){return this._addCheck({kind:"base64url",...R.errToObj(e)})}jwt(e){return this._addCheck({kind:"jwt",...R.errToObj(e)})}ip(e){return this._addCheck({kind:"ip",...R.errToObj(e)})}cidr(e){return this._addCheck({kind:"cidr",...R.errToObj(e)})}datetime(e){return typeof e=="string"?this._addCheck({kind:"datetime",precision:null,offset:!1,local:!1,message:e}):this._addCheck({kind:"datetime",precision:typeof e?.precision>"u"?null:e?.precision,offset:e?.offset??!1,local:e?.local??!1,...R.errToObj(e?.message)})}date(e){return this._addCheck({kind:"date",message:e})}time(e){return typeof e=="string"?this._addCheck({kind:"time",precision:null,message:e}):this._addCheck({kind:"time",precision:typeof e?.precision>"u"?null:e?.precision,...R.errToObj(e?.message)})}duration(e){return this._addCheck({kind:"duration",...R.errToObj(e)})}regex(e,r){return this._addCheck({kind:"regex",regex:e,...R.errToObj(r)})}includes(e,r){return this._addCheck({kind:"includes",value:e,position:r?.position,...R.errToObj(r?.message)})}startsWith(e,r){return this._addCheck({kind:"startsWith",value:e,...R.errToObj(r)})}endsWith(e,r){return this._addCheck({kind:"endsWith",value:e,...R.errToObj(r)})}min(e,r){return this._addCheck({kind:"min",value:e,...R.errToObj(r)})}max(e,r){return this._addCheck({kind:"max",value:e,...R.errToObj(r)})}length(e,r){return this._addCheck({kind:"length",value:e,...R.errToObj(r)})}nonempty(e){return this.min(1,R.errToObj(e))}trim(){return new t({...this._def,checks:[...this._def.checks,{kind:"trim"}]})}toLowerCase(){return new t({...this._def,checks:[...this._def.checks,{kind:"toLowerCase"}]})}toUpperCase(){return new t({...this._def,checks:[...this._def.checks,{kind:"toUpperCase"}]})}get isDatetime(){return!!this._def.checks.find(e=>e.kind==="datetime")}get isDate(){return!!this._def.checks.find(e=>e.kind==="date")}get isTime(){return!!this._def.checks.find(e=>e.kind==="time")}get isDuration(){return!!this._def.checks.find(e=>e.kind==="duration")}get isEmail(){return!!this._def.checks.find(e=>e.kind==="email")}get isURL(){return!!this._def.checks.find(e=>e.kind==="url")}get isEmoji(){return!!this._def.checks.find(e=>e.kind==="emoji")}get isUUID(){return!!this._def.checks.find(e=>e.kind==="uuid")}get isNANOID(){return!!this._def.checks.find(e=>e.kind==="nanoid")}get isCUID(){return!!this._def.checks.find(e=>e.kind==="cuid")}get isCUID2(){return!!this._def.checks.find(e=>e.kind==="cuid2")}get isULID(){return!!this._def.checks.find(e=>e.kind==="ulid")}get isIP(){return!!this._def.checks.find(e=>e.kind==="ip")}get isCIDR(){return!!this._def.checks.find(e=>e.kind==="cidr")}get isBase64(){return!!this._def.checks.find(e=>e.kind==="base64")}get isBase64url(){return!!this._def.checks.find(e=>e.kind==="base64url")}get minLength(){let e=null;for(let r of this._def.checks)r.kind==="min"&&(e===null||r.value>e)&&(e=r.value);return e}get maxLength(){let e=null;for(let r of this._def.checks)r.kind==="max"&&(e===null||r.value<e)&&(e=r.value);return e}};Ft.create=t=>new Ft({checks:[],typeName:I.ZodString,coerce:t?.coerce??!1,...L(t)});function Ip(t,e){let r=(t.toString().split(".")[1]||"").length,a=(e.toString().split(".")[1]||"").length,s=r>a?r:a,i=Number.parseInt(t.toFixed(s).replace(".","")),c=Number.parseInt(e.toFixed(s).replace(".",""));return i%c/10**s}var rr=class t extends N{constructor(){super(...arguments),this.min=this.gte,this.max=this.lte,this.step=this.multipleOf}_parse(e){if(this._def.coerce&&(e.data=Number(e.data)),this._getType(e)!==C.number){let i=this._getOrReturnCtx(e);return S(i,{code:_.invalid_type,expected:C.number,received:i.parsedType}),$}let a,s=new ae;for(let i of this._def.checks)i.kind==="int"?F.isInteger(e.data)||(a=this._getOrReturnCtx(e,a),S(a,{code:_.invalid_type,expected:"integer",received:"float",message:i.message}),s.dirty()):i.kind==="min"?(i.inclusive?e.data<i.value:e.data<=i.value)&&(a=this._getOrReturnCtx(e,a),S(a,{code:_.too_small,minimum:i.value,type:"number",inclusive:i.inclusive,exact:!1,message:i.message}),s.dirty()):i.kind==="max"?(i.inclusive?e.data>i.value:e.data>=i.value)&&(a=this._getOrReturnCtx(e,a),S(a,{code:_.too_big,maximum:i.value,type:"number",inclusive:i.inclusive,exact:!1,message:i.message}),s.dirty()):i.kind==="multipleOf"?Ip(e.data,i.value)!==0&&(a=this._getOrReturnCtx(e,a),S(a,{code:_.not_multiple_of,multipleOf:i.value,message:i.message}),s.dirty()):i.kind==="finite"?Number.isFinite(e.data)||(a=this._getOrReturnCtx(e,a),S(a,{code:_.not_finite,message:i.message}),s.dirty()):F.assertNever(i);return{status:s.value,value:e.data}}gte(e,r){return this.setLimit("min",e,!0,R.toString(r))}gt(e,r){return this.setLimit("min",e,!1,R.toString(r))}lte(e,r){return this.setLimit("max",e,!0,R.toString(r))}lt(e,r){return this.setLimit("max",e,!1,R.toString(r))}setLimit(e,r,a,s){return new t({...this._def,checks:[...this._def.checks,{kind:e,value:r,inclusive:a,message:R.toString(s)}]})}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}int(e){return this._addCheck({kind:"int",message:R.toString(e)})}positive(e){return this._addCheck({kind:"min",value:0,inclusive:!1,message:R.toString(e)})}negative(e){return this._addCheck({kind:"max",value:0,inclusive:!1,message:R.toString(e)})}nonpositive(e){return this._addCheck({kind:"max",value:0,inclusive:!0,message:R.toString(e)})}nonnegative(e){return this._addCheck({kind:"min",value:0,inclusive:!0,message:R.toString(e)})}multipleOf(e,r){return this._addCheck({kind:"multipleOf",value:e,message:R.toString(r)})}finite(e){return this._addCheck({kind:"finite",message:R.toString(e)})}safe(e){return this._addCheck({kind:"min",inclusive:!0,value:Number.MIN_SAFE_INTEGER,message:R.toString(e)})._addCheck({kind:"max",inclusive:!0,value:Number.MAX_SAFE_INTEGER,message:R.toString(e)})}get minValue(){let e=null;for(let r of this._def.checks)r.kind==="min"&&(e===null||r.value>e)&&(e=r.value);return e}get maxValue(){let e=null;for(let r of this._def.checks)r.kind==="max"&&(e===null||r.value<e)&&(e=r.value);return e}get isInt(){return!!this._def.checks.find(e=>e.kind==="int"||e.kind==="multipleOf"&&F.isInteger(e.value))}get isFinite(){let e=null,r=null;for(let a of this._def.checks){if(a.kind==="finite"||a.kind==="int"||a.kind==="multipleOf")return!0;a.kind==="min"?(r===null||a.value>r)&&(r=a.value):a.kind==="max"&&(e===null||a.value<e)&&(e=a.value)}return Number.isFinite(r)&&Number.isFinite(e)}};rr.create=t=>new rr({checks:[],typeName:I.ZodNumber,coerce:t?.coerce||!1,...L(t)});var nr=class t extends N{constructor(){super(...arguments),this.min=this.gte,this.max=this.lte}_parse(e){if(this._def.coerce)try{e.data=BigInt(e.data)}catch{return this._getInvalidInput(e)}if(this._getType(e)!==C.bigint)return this._getInvalidInput(e);let a,s=new ae;for(let i of this._def.checks)i.kind==="min"?(i.inclusive?e.data<i.value:e.data<=i.value)&&(a=this._getOrReturnCtx(e,a),S(a,{code:_.too_small,type:"bigint",minimum:i.value,inclusive:i.inclusive,message:i.message}),s.dirty()):i.kind==="max"?(i.inclusive?e.data>i.value:e.data>=i.value)&&(a=this._getOrReturnCtx(e,a),S(a,{code:_.too_big,type:"bigint",maximum:i.value,inclusive:i.inclusive,message:i.message}),s.dirty()):i.kind==="multipleOf"?e.data%i.value!==BigInt(0)&&(a=this._getOrReturnCtx(e,a),S(a,{code:_.not_multiple_of,multipleOf:i.value,message:i.message}),s.dirty()):F.assertNever(i);return{status:s.value,value:e.data}}_getInvalidInput(e){let r=this._getOrReturnCtx(e);return S(r,{code:_.invalid_type,expected:C.bigint,received:r.parsedType}),$}gte(e,r){return this.setLimit("min",e,!0,R.toString(r))}gt(e,r){return this.setLimit("min",e,!1,R.toString(r))}lte(e,r){return this.setLimit("max",e,!0,R.toString(r))}lt(e,r){return this.setLimit("max",e,!1,R.toString(r))}setLimit(e,r,a,s){return new t({...this._def,checks:[...this._def.checks,{kind:e,value:r,inclusive:a,message:R.toString(s)}]})}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}positive(e){return this._addCheck({kind:"min",value:BigInt(0),inclusive:!1,message:R.toString(e)})}negative(e){return this._addCheck({kind:"max",value:BigInt(0),inclusive:!1,message:R.toString(e)})}nonpositive(e){return this._addCheck({kind:"max",value:BigInt(0),inclusive:!0,message:R.toString(e)})}nonnegative(e){return this._addCheck({kind:"min",value:BigInt(0),inclusive:!0,message:R.toString(e)})}multipleOf(e,r){return this._addCheck({kind:"multipleOf",value:e,message:R.toString(r)})}get minValue(){let e=null;for(let r of this._def.checks)r.kind==="min"&&(e===null||r.value>e)&&(e=r.value);return e}get maxValue(){let e=null;for(let r of this._def.checks)r.kind==="max"&&(e===null||r.value<e)&&(e=r.value);return e}};nr.create=t=>new nr({checks:[],typeName:I.ZodBigInt,coerce:t?.coerce??!1,...L(t)});var ar=class extends N{_parse(e){if(this._def.coerce&&(e.data=!!e.data),this._getType(e)!==C.boolean){let a=this._getOrReturnCtx(e);return S(a,{code:_.invalid_type,expected:C.boolean,received:a.parsedType}),$}return ie(e.data)}};ar.create=t=>new ar({typeName:I.ZodBoolean,coerce:t?.coerce||!1,...L(t)});var sr=class t extends N{_parse(e){if(this._def.coerce&&(e.data=new Date(e.data)),this._getType(e)!==C.date){let i=this._getOrReturnCtx(e);return S(i,{code:_.invalid_type,expected:C.date,received:i.parsedType}),$}if(Number.isNaN(e.data.getTime())){let i=this._getOrReturnCtx(e);return S(i,{code:_.invalid_date}),$}let a=new ae,s;for(let i of this._def.checks)i.kind==="min"?e.data.getTime()<i.value&&(s=this._getOrReturnCtx(e,s),S(s,{code:_.too_small,message:i.message,inclusive:!0,exact:!1,minimum:i.value,type:"date"}),a.dirty()):i.kind==="max"?e.data.getTime()>i.value&&(s=this._getOrReturnCtx(e,s),S(s,{code:_.too_big,message:i.message,inclusive:!0,exact:!1,maximum:i.value,type:"date"}),a.dirty()):F.assertNever(i);return{status:a.value,value:new Date(e.data.getTime())}}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}min(e,r){return this._addCheck({kind:"min",value:e.getTime(),message:R.toString(r)})}max(e,r){return this._addCheck({kind:"max",value:e.getTime(),message:R.toString(r)})}get minDate(){let e=null;for(let r of this._def.checks)r.kind==="min"&&(e===null||r.value>e)&&(e=r.value);return e!=null?new Date(e):null}get maxDate(){let e=null;for(let r of this._def.checks)r.kind==="max"&&(e===null||r.value<e)&&(e=r.value);return e!=null?new Date(e):null}};sr.create=t=>new sr({checks:[],coerce:t?.coerce||!1,typeName:I.ZodDate,...L(t)});var Gr=class extends N{_parse(e){if(this._getType(e)!==C.symbol){let a=this._getOrReturnCtx(e);return S(a,{code:_.invalid_type,expected:C.symbol,received:a.parsedType}),$}return ie(e.data)}};Gr.create=t=>new Gr({typeName:I.ZodSymbol,...L(t)});var or=class extends N{_parse(e){if(this._getType(e)!==C.undefined){let a=this._getOrReturnCtx(e);return S(a,{code:_.invalid_type,expected:C.undefined,received:a.parsedType}),$}return ie(e.data)}};or.create=t=>new or({typeName:I.ZodUndefined,...L(t)});var ir=class extends N{_parse(e){if(this._getType(e)!==C.null){let a=this._getOrReturnCtx(e);return S(a,{code:_.invalid_type,expected:C.null,received:a.parsedType}),$}return ie(e.data)}};ir.create=t=>new ir({typeName:I.ZodNull,...L(t)});var jt=class extends N{constructor(){super(...arguments),this._any=!0}_parse(e){return ie(e.data)}};jt.create=t=>new jt({typeName:I.ZodAny,...L(t)});var bt=class extends N{constructor(){super(...arguments),this._unknown=!0}_parse(e){return ie(e.data)}};bt.create=t=>new bt({typeName:I.ZodUnknown,...L(t)});var Ue=class extends N{_parse(e){let r=this._getOrReturnCtx(e);return S(r,{code:_.invalid_type,expected:C.never,received:r.parsedType}),$}};Ue.create=t=>new Ue({typeName:I.ZodNever,...L(t)});var Jr=class extends N{_parse(e){if(this._getType(e)!==C.undefined){let a=this._getOrReturnCtx(e);return S(a,{code:_.invalid_type,expected:C.void,received:a.parsedType}),$}return ie(e.data)}};Jr.create=t=>new Jr({typeName:I.ZodVoid,...L(t)});var wt=class t extends N{_parse(e){let{ctx:r,status:a}=this._processInputParams(e),s=this._def;if(r.parsedType!==C.array)return S(r,{code:_.invalid_type,expected:C.array,received:r.parsedType}),$;if(s.exactLength!==null){let c=r.data.length>s.exactLength.value,u=r.data.length<s.exactLength.value;(c||u)&&(S(r,{code:c?_.too_big:_.too_small,minimum:u?s.exactLength.value:void 0,maximum:c?s.exactLength.value:void 0,type:"array",inclusive:!0,exact:!0,message:s.exactLength.message}),a.dirty())}if(s.minLength!==null&&r.data.length<s.minLength.value&&(S(r,{code:_.too_small,minimum:s.minLength.value,type:"array",inclusive:!0,exact:!1,message:s.minLength.message}),a.dirty()),s.maxLength!==null&&r.data.length>s.maxLength.value&&(S(r,{code:_.too_big,maximum:s.maxLength.value,type:"array",inclusive:!0,exact:!1,message:s.maxLength.message}),a.dirty()),r.common.async)return Promise.all([...r.data].map((c,u)=>s.type._parseAsync(new Oe(r,c,r.path,u)))).then(c=>ae.mergeArray(a,c));let i=[...r.data].map((c,u)=>s.type._parseSync(new Oe(r,c,r.path,u)));return ae.mergeArray(a,i)}get element(){return this._def.type}min(e,r){return new t({...this._def,minLength:{value:e,message:R.toString(r)}})}max(e,r){return new t({...this._def,maxLength:{value:e,message:R.toString(r)}})}length(e,r){return new t({...this._def,exactLength:{value:e,message:R.toString(r)}})}nonempty(e){return this.min(1,e)}};wt.create=(t,e)=>new wt({type:t,minLength:null,maxLength:null,exactLength:null,typeName:I.ZodArray,...L(e)});function Vr(t){if(t instanceof ge){let e={};for(let r in t.shape){let a=t.shape[r];e[r]=Ie.create(Vr(a))}return new ge({...t._def,shape:()=>e})}else return t instanceof wt?new wt({...t._def,type:Vr(t.element)}):t instanceof Ie?Ie.create(Vr(t.unwrap())):t instanceof tt?tt.create(Vr(t.unwrap())):t instanceof et?et.create(t.items.map(e=>Vr(e))):t}var ge=class t extends N{constructor(){super(...arguments),this._cached=null,this.nonstrict=this.passthrough,this.augment=this.extend}_getCached(){if(this._cached!==null)return this._cached;let e=this._def.shape(),r=F.objectKeys(e);return this._cached={shape:e,keys:r},this._cached}_parse(e){if(this._getType(e)!==C.object){let d=this._getOrReturnCtx(e);return S(d,{code:_.invalid_type,expected:C.object,received:d.parsedType}),$}let{status:a,ctx:s}=this._processInputParams(e),{shape:i,keys:c}=this._getCached(),u=[];if(!(this._def.catchall instanceof Ue&&this._def.unknownKeys==="strip"))for(let d in s.data)c.includes(d)||u.push(d);let p=[];for(let d of c){let g=i[d],k=s.data[d];p.push({key:{status:"valid",value:d},value:g._parse(new Oe(s,k,s.path,d)),alwaysSet:d in s.data})}if(this._def.catchall instanceof Ue){let d=this._def.unknownKeys;if(d==="passthrough")for(let g of u)p.push({key:{status:"valid",value:g},value:{status:"valid",value:s.data[g]}});else if(d==="strict")u.length>0&&(S(s,{code:_.unrecognized_keys,keys:u}),a.dirty());else if(d!=="strip")throw new Error("Internal ZodObject error: invalid unknownKeys value.")}else{let d=this._def.catchall;for(let g of u){let k=s.data[g];p.push({key:{status:"valid",value:g},value:d._parse(new Oe(s,k,s.path,g)),alwaysSet:g in s.data})}}return s.common.async?Promise.resolve().then(async()=>{let d=[];for(let g of p){let k=await g.key,x=await g.value;d.push({key:k,value:x,alwaysSet:g.alwaysSet})}return d}).then(d=>ae.mergeObjectSync(a,d)):ae.mergeObjectSync(a,p)}get shape(){return this._def.shape()}strict(e){return R.errToObj,new t({...this._def,unknownKeys:"strict",...e!==void 0?{errorMap:(r,a)=>{let s=this._def.errorMap?.(r,a).message??a.defaultError;return r.code==="unrecognized_keys"?{message:R.errToObj(e).message??s}:{message:s}}}:{}})}strip(){return new t({...this._def,unknownKeys:"strip"})}passthrough(){return new t({...this._def,unknownKeys:"passthrough"})}extend(e){return new t({...this._def,shape:()=>({...this._def.shape(),...e})})}merge(e){return new t({unknownKeys:e._def.unknownKeys,catchall:e._def.catchall,shape:()=>({...this._def.shape(),...e._def.shape()}),typeName:I.ZodObject})}setKey(e,r){return this.augment({[e]:r})}catchall(e){return new t({...this._def,catchall:e})}pick(e){let r={};for(let a of F.objectKeys(e))e[a]&&this.shape[a]&&(r[a]=this.shape[a]);return new t({...this._def,shape:()=>r})}omit(e){let r={};for(let a of F.objectKeys(this.shape))e[a]||(r[a]=this.shape[a]);return new t({...this._def,shape:()=>r})}deepPartial(){return Vr(this)}partial(e){let r={};for(let a of F.objectKeys(this.shape)){let s=this.shape[a];e&&!e[a]?r[a]=s:r[a]=s.optional()}return new t({...this._def,shape:()=>r})}required(e){let r={};for(let a of F.objectKeys(this.shape))if(e&&!e[a])r[a]=this.shape[a];else{let i=this.shape[a];for(;i instanceof Ie;)i=i._def.innerType;r[a]=i}return new t({...this._def,shape:()=>r})}keyof(){return zc(F.objectKeys(this.shape))}};ge.create=(t,e)=>new ge({shape:()=>t,unknownKeys:"strip",catchall:Ue.create(),typeName:I.ZodObject,...L(e)});ge.strictCreate=(t,e)=>new ge({shape:()=>t,unknownKeys:"strict",catchall:Ue.create(),typeName:I.ZodObject,...L(e)});ge.lazycreate=(t,e)=>new ge({shape:t,unknownKeys:"strip",catchall:Ue.create(),typeName:I.ZodObject,...L(e)});var cr=class extends N{_parse(e){let{ctx:r}=this._processInputParams(e),a=this._def.options;function s(i){for(let u of i)if(u.result.status==="valid")return u.result;for(let u of i)if(u.result.status==="dirty")return r.common.issues.push(...u.ctx.common.issues),u.result;let c=i.map(u=>new me(u.ctx.common.issues));return S(r,{code:_.invalid_union,unionErrors:c}),$}if(r.common.async)return Promise.all(a.map(async i=>{let c={...r,common:{...r.common,issues:[]},parent:null};return{result:await i._parseAsync({data:r.data,path:r.path,parent:c}),ctx:c}})).then(s);{let i,c=[];for(let p of a){let d={...r,common:{...r.common,issues:[]},parent:null},g=p._parseSync({data:r.data,path:r.path,parent:d});if(g.status==="valid")return g;g.status==="dirty"&&!i&&(i={result:g,ctx:d}),d.common.issues.length&&c.push(d.common.issues)}if(i)return r.common.issues.push(...i.ctx.common.issues),i.result;let u=c.map(p=>new me(p));return S(r,{code:_.invalid_union,unionErrors:u}),$}}get options(){return this._def.options}};cr.create=(t,e)=>new cr({options:t,typeName:I.ZodUnion,...L(e)});var yt=t=>t instanceof ur?yt(t.schema):t instanceof De?yt(t.innerType()):t instanceof dr?[t.value]:t instanceof fr?t.options:t instanceof pr?F.objectValues(t.enum):t instanceof hr?yt(t._def.innerType):t instanceof or?[void 0]:t instanceof ir?[null]:t instanceof Ie?[void 0,...yt(t.unwrap())]:t instanceof tt?[null,...yt(t.unwrap())]:t instanceof kn||t instanceof gr?yt(t.unwrap()):t instanceof mr?yt(t._def.innerType):[],Aa=class t extends N{_parse(e){let{ctx:r}=this._processInputParams(e);if(r.parsedType!==C.object)return S(r,{code:_.invalid_type,expected:C.object,received:r.parsedType}),$;let a=this.discriminator,s=r.data[a],i=this.optionsMap.get(s);return i?r.common.async?i._parseAsync({data:r.data,path:r.path,parent:r}):i._parseSync({data:r.data,path:r.path,parent:r}):(S(r,{code:_.invalid_union_discriminator,options:Array.from(this.optionsMap.keys()),path:[a]}),$)}get discriminator(){return this._def.discriminator}get options(){return this._def.options}get optionsMap(){return this._def.optionsMap}static create(e,r,a){let s=new Map;for(let i of r){let c=yt(i.shape[e]);if(!c.length)throw new Error(`A discriminator value for key \`${e}\` could not be extracted from all schema options`);for(let u of c){if(s.has(u))throw new Error(`Discriminator property ${String(e)} has duplicate value ${String(u)}`);s.set(u,i)}}return new t({typeName:I.ZodDiscriminatedUnion,discriminator:e,options:r,optionsMap:s,...L(a)})}};function co(t,e){let r=Xe(t),a=Xe(e);if(t===e)return{valid:!0,data:t};if(r===C.object&&a===C.object){let s=F.objectKeys(e),i=F.objectKeys(t).filter(u=>s.indexOf(u)!==-1),c={...t,...e};for(let u of i){let p=co(t[u],e[u]);if(!p.valid)return{valid:!1};c[u]=p.data}return{valid:!0,data:c}}else if(r===C.array&&a===C.array){if(t.length!==e.length)return{valid:!1};let s=[];for(let i=0;i<t.length;i++){let c=t[i],u=e[i],p=co(c,u);if(!p.valid)return{valid:!1};s.push(p.data)}return{valid:!0,data:s}}else return r===C.date&&a===C.date&&+t==+e?{valid:!0,data:t}:{valid:!1}}var lr=class extends N{_parse(e){let{status:r,ctx:a}=this._processInputParams(e),s=(i,c)=>{if(Ra(i)||Ra(c))return $;let u=co(i.value,c.value);return u.valid?((Ea(i)||Ea(c))&&r.dirty(),{status:r.value,value:u.data}):(S(a,{code:_.invalid_intersection_types}),$)};return a.common.async?Promise.all([this._def.left._parseAsync({data:a.data,path:a.path,parent:a}),this._def.right._parseAsync({data:a.data,path:a.path,parent:a})]).then(([i,c])=>s(i,c)):s(this._def.left._parseSync({data:a.data,path:a.path,parent:a}),this._def.right._parseSync({data:a.data,path:a.path,parent:a}))}};lr.create=(t,e,r)=>new lr({left:t,right:e,typeName:I.ZodIntersection,...L(r)});var et=class t extends N{_parse(e){let{status:r,ctx:a}=this._processInputParams(e);if(a.parsedType!==C.array)return S(a,{code:_.invalid_type,expected:C.array,received:a.parsedType}),$;if(a.data.length<this._def.items.length)return S(a,{code:_.too_small,minimum:this._def.items.length,inclusive:!0,exact:!1,type:"array"}),$;!this._def.rest&&a.data.length>this._def.items.length&&(S(a,{code:_.too_big,maximum:this._def.items.length,inclusive:!0,exact:!1,type:"array"}),r.dirty());let i=[...a.data].map((c,u)=>{let p=this._def.items[u]||this._def.rest;return p?p._parse(new Oe(a,c,a.path,u)):null}).filter(c=>!!c);return a.common.async?Promise.all(i).then(c=>ae.mergeArray(r,c)):ae.mergeArray(r,i)}get items(){return this._def.items}rest(e){return new t({...this._def,rest:e})}};et.create=(t,e)=>{if(!Array.isArray(t))throw new Error("You must pass an array of schemas to z.tuple([ ... ])");return new et({items:t,typeName:I.ZodTuple,rest:null,...L(e)})};var $a=class t extends N{get keySchema(){return this._def.keyType}get valueSchema(){return this._def.valueType}_parse(e){let{status:r,ctx:a}=this._processInputParams(e);if(a.parsedType!==C.object)return S(a,{code:_.invalid_type,expected:C.object,received:a.parsedType}),$;let s=[],i=this._def.keyType,c=this._def.valueType;for(let u in a.data)s.push({key:i._parse(new Oe(a,u,a.path,u)),value:c._parse(new Oe(a,a.data[u],a.path,u)),alwaysSet:u in a.data});return a.common.async?ae.mergeObjectAsync(r,s):ae.mergeObjectSync(r,s)}get element(){return this._def.valueType}static create(e,r,a){return r instanceof N?new t({keyType:e,valueType:r,typeName:I.ZodRecord,...L(a)}):new t({keyType:Ft.create(),valueType:e,typeName:I.ZodRecord,...L(r)})}},Zr=class extends N{get keySchema(){return this._def.keyType}get valueSchema(){return this._def.valueType}_parse(e){let{status:r,ctx:a}=this._processInputParams(e);if(a.parsedType!==C.map)return S(a,{code:_.invalid_type,expected:C.map,received:a.parsedType}),$;let s=this._def.keyType,i=this._def.valueType,c=[...a.data.entries()].map(([u,p],d)=>({key:s._parse(new Oe(a,u,a.path,[d,"key"])),value:i._parse(new Oe(a,p,a.path,[d,"value"]))}));if(a.common.async){let u=new Map;return Promise.resolve().then(async()=>{for(let p of c){let d=await p.key,g=await p.value;if(d.status==="aborted"||g.status==="aborted")return $;(d.status==="dirty"||g.status==="dirty")&&r.dirty(),u.set(d.value,g.value)}return{status:r.value,value:u}})}else{let u=new Map;for(let p of c){let d=p.key,g=p.value;if(d.status==="aborted"||g.status==="aborted")return $;(d.status==="dirty"||g.status==="dirty")&&r.dirty(),u.set(d.value,g.value)}return{status:r.value,value:u}}}};Zr.create=(t,e,r)=>new Zr({valueType:e,keyType:t,typeName:I.ZodMap,...L(r)});var Yr=class t extends N{_parse(e){let{status:r,ctx:a}=this._processInputParams(e);if(a.parsedType!==C.set)return S(a,{code:_.invalid_type,expected:C.set,received:a.parsedType}),$;let s=this._def;s.minSize!==null&&a.data.size<s.minSize.value&&(S(a,{code:_.too_small,minimum:s.minSize.value,type:"set",inclusive:!0,exact:!1,message:s.minSize.message}),r.dirty()),s.maxSize!==null&&a.data.size>s.maxSize.value&&(S(a,{code:_.too_big,maximum:s.maxSize.value,type:"set",inclusive:!0,exact:!1,message:s.maxSize.message}),r.dirty());let i=this._def.valueType;function c(p){let d=new Set;for(let g of p){if(g.status==="aborted")return $;g.status==="dirty"&&r.dirty(),d.add(g.value)}return{status:r.value,value:d}}let u=[...a.data.values()].map((p,d)=>i._parse(new Oe(a,p,a.path,d)));return a.common.async?Promise.all(u).then(p=>c(p)):c(u)}min(e,r){return new t({...this._def,minSize:{value:e,message:R.toString(r)}})}max(e,r){return new t({...this._def,maxSize:{value:e,message:R.toString(r)}})}size(e,r){return this.min(e,r).max(e,r)}nonempty(e){return this.min(1,e)}};Yr.create=(t,e)=>new Yr({valueType:t,minSize:null,maxSize:null,typeName:I.ZodSet,...L(e)});var Pa=class t extends N{constructor(){super(...arguments),this.validate=this.implement}_parse(e){let{ctx:r}=this._processInputParams(e);if(r.parsedType!==C.function)return S(r,{code:_.invalid_type,expected:C.function,received:r.parsedType}),$;function a(u,p){return _n({data:u,path:r.path,errorMaps:[r.common.contextualErrorMap,r.schemaErrorMap,zr(),gt].filter(d=>!!d),issueData:{code:_.invalid_arguments,argumentsError:p}})}function s(u,p){return _n({data:u,path:r.path,errorMaps:[r.common.contextualErrorMap,r.schemaErrorMap,zr(),gt].filter(d=>!!d),issueData:{code:_.invalid_return_type,returnTypeError:p}})}let i={errorMap:r.common.contextualErrorMap},c=r.data;if(this._def.returns instanceof Wt){let u=this;return ie(async function(...p){let d=new me([]),g=await u._def.args.parseAsync(p,i).catch(P=>{throw d.addIssue(a(p,P)),d}),k=await Reflect.apply(c,this,g);return await u._def.returns._def.type.parseAsync(k,i).catch(P=>{throw d.addIssue(s(k,P)),d})})}else{let u=this;return ie(function(...p){let d=u._def.args.safeParse(p,i);if(!d.success)throw new me([a(p,d.error)]);let g=Reflect.apply(c,this,d.data),k=u._def.returns.safeParse(g,i);if(!k.success)throw new me([s(g,k.error)]);return k.data})}}parameters(){return this._def.args}returnType(){return this._def.returns}args(...e){return new t({...this._def,args:et.create(e).rest(bt.create())})}returns(e){return new t({...this._def,returns:e})}implement(e){return this.parse(e)}strictImplement(e){return this.parse(e)}static create(e,r,a){return new t({args:e||et.create([]).rest(bt.create()),returns:r||bt.create(),typeName:I.ZodFunction,...L(a)})}},ur=class extends N{get schema(){return this._def.getter()}_parse(e){let{ctx:r}=this._processInputParams(e);return this._def.getter()._parse({data:r.data,path:r.path,parent:r})}};ur.create=(t,e)=>new ur({getter:t,typeName:I.ZodLazy,...L(e)});var dr=class extends N{_parse(e){if(e.data!==this._def.value){let r=this._getOrReturnCtx(e);return S(r,{received:r.data,code:_.invalid_literal,expected:this._def.value}),$}return{status:"valid",value:e.data}}get value(){return this._def.value}};dr.create=(t,e)=>new dr({value:t,typeName:I.ZodLiteral,...L(e)});function zc(t,e){return new fr({values:t,typeName:I.ZodEnum,...L(e)})}var fr=class t extends N{_parse(e){if(typeof e.data!="string"){let r=this._getOrReturnCtx(e),a=this._def.values;return S(r,{expected:F.joinValues(a),received:r.parsedType,code:_.invalid_type}),$}if(this._cache||(this._cache=new Set(this._def.values)),!this._cache.has(e.data)){let r=this._getOrReturnCtx(e),a=this._def.values;return S(r,{received:r.data,code:_.invalid_enum_value,options:a}),$}return ie(e.data)}get options(){return this._def.values}get enum(){let e={};for(let r of this._def.values)e[r]=r;return e}get Values(){let e={};for(let r of this._def.values)e[r]=r;return e}get Enum(){let e={};for(let r of this._def.values)e[r]=r;return e}extract(e,r=this._def){return t.create(e,{...this._def,...r})}exclude(e,r=this._def){return t.create(this.options.filter(a=>!e.includes(a)),{...this._def,...r})}};fr.create=zc;var pr=class extends N{_parse(e){let r=F.getValidEnumValues(this._def.values),a=this._getOrReturnCtx(e);if(a.parsedType!==C.string&&a.parsedType!==C.number){let s=F.objectValues(r);return S(a,{expected:F.joinValues(s),received:a.parsedType,code:_.invalid_type}),$}if(this._cache||(this._cache=new Set(F.getValidEnumValues(this._def.values))),!this._cache.has(e.data)){let s=F.objectValues(r);return S(a,{received:a.data,code:_.invalid_enum_value,options:s}),$}return ie(e.data)}get enum(){return this._def.values}};pr.create=(t,e)=>new pr({values:t,typeName:I.ZodNativeEnum,...L(e)});var Wt=class extends N{unwrap(){return this._def.type}_parse(e){let{ctx:r}=this._processInputParams(e);if(r.parsedType!==C.promise&&r.common.async===!1)return S(r,{code:_.invalid_type,expected:C.promise,received:r.parsedType}),$;let a=r.parsedType===C.promise?r.data:Promise.resolve(r.data);return ie(a.then(s=>this._def.type.parseAsync(s,{path:r.path,errorMap:r.common.contextualErrorMap})))}};Wt.create=(t,e)=>new Wt({type:t,typeName:I.ZodPromise,...L(e)});var De=class extends N{innerType(){return this._def.schema}sourceType(){return this._def.schema._def.typeName===I.ZodEffects?this._def.schema.sourceType():this._def.schema}_parse(e){let{status:r,ctx:a}=this._processInputParams(e),s=this._def.effect||null,i={addIssue:c=>{S(a,c),c.fatal?r.abort():r.dirty()},get path(){return a.path}};if(i.addIssue=i.addIssue.bind(i),s.type==="preprocess"){let c=s.transform(a.data,i);if(a.common.async)return Promise.resolve(c).then(async u=>{if(r.value==="aborted")return $;let p=await this._def.schema._parseAsync({data:u,path:a.path,parent:a});return p.status==="aborted"?$:p.status==="dirty"?tr(p.value):r.value==="dirty"?tr(p.value):p});{if(r.value==="aborted")return $;let u=this._def.schema._parseSync({data:c,path:a.path,parent:a});return u.status==="aborted"?$:u.status==="dirty"?tr(u.value):r.value==="dirty"?tr(u.value):u}}if(s.type==="refinement"){let c=u=>{let p=s.refinement(u,i);if(a.common.async)return Promise.resolve(p);if(p instanceof Promise)throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");return u};if(a.common.async===!1){let u=this._def.schema._parseSync({data:a.data,path:a.path,parent:a});return u.status==="aborted"?$:(u.status==="dirty"&&r.dirty(),c(u.value),{status:r.value,value:u.value})}else return this._def.schema._parseAsync({data:a.data,path:a.path,parent:a}).then(u=>u.status==="aborted"?$:(u.status==="dirty"&&r.dirty(),c(u.value).then(()=>({status:r.value,value:u.value}))))}if(s.type==="transform")if(a.common.async===!1){let c=this._def.schema._parseSync({data:a.data,path:a.path,parent:a});if(!Mt(c))return $;let u=s.transform(c.value,i);if(u instanceof Promise)throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");return{status:r.value,value:u}}else return this._def.schema._parseAsync({data:a.data,path:a.path,parent:a}).then(c=>Mt(c)?Promise.resolve(s.transform(c.value,i)).then(u=>({status:r.value,value:u})):$);F.assertNever(s)}};De.create=(t,e,r)=>new De({schema:t,typeName:I.ZodEffects,effect:e,...L(r)});De.createWithPreprocess=(t,e,r)=>new De({schema:e,effect:{type:"preprocess",transform:t},typeName:I.ZodEffects,...L(r)});var Ie=class extends N{_parse(e){return this._getType(e)===C.undefined?ie(void 0):this._def.innerType._parse(e)}unwrap(){return this._def.innerType}};Ie.create=(t,e)=>new Ie({innerType:t,typeName:I.ZodOptional,...L(e)});var tt=class extends N{_parse(e){return this._getType(e)===C.null?ie(null):this._def.innerType._parse(e)}unwrap(){return this._def.innerType}};tt.create=(t,e)=>new tt({innerType:t,typeName:I.ZodNullable,...L(e)});var hr=class extends N{_parse(e){let{ctx:r}=this._processInputParams(e),a=r.data;return r.parsedType===C.undefined&&(a=this._def.defaultValue()),this._def.innerType._parse({data:a,path:r.path,parent:r})}removeDefault(){return this._def.innerType}};hr.create=(t,e)=>new hr({innerType:t,typeName:I.ZodDefault,defaultValue:typeof e.default=="function"?e.default:()=>e.default,...L(e)});var mr=class extends N{_parse(e){let{ctx:r}=this._processInputParams(e),a={...r,common:{...r.common,issues:[]}},s=this._def.innerType._parse({data:a.data,path:a.path,parent:{...a}});return Hr(s)?s.then(i=>({status:"valid",value:i.status==="valid"?i.value:this._def.catchValue({get error(){return new me(a.common.issues)},input:a.data})})):{status:"valid",value:s.status==="valid"?s.value:this._def.catchValue({get error(){return new me(a.common.issues)},input:a.data})}}removeCatch(){return this._def.innerType}};mr.create=(t,e)=>new mr({innerType:t,typeName:I.ZodCatch,catchValue:typeof e.catch=="function"?e.catch:()=>e.catch,...L(e)});var Qr=class extends N{_parse(e){if(this._getType(e)!==C.nan){let a=this._getOrReturnCtx(e);return S(a,{code:_.invalid_type,expected:C.nan,received:a.parsedType}),$}return{status:"valid",value:e.data}}};Qr.create=t=>new Qr({typeName:I.ZodNaN,...L(t)});var Op=Symbol("zod_brand"),kn=class extends N{_parse(e){let{ctx:r}=this._processInputParams(e),a=r.data;return this._def.type._parse({data:a,path:r.path,parent:r})}unwrap(){return this._def.type}},Sn=class t extends N{_parse(e){let{status:r,ctx:a}=this._processInputParams(e);if(a.common.async)return(async()=>{let i=await this._def.in._parseAsync({data:a.data,path:a.path,parent:a});return i.status==="aborted"?$:i.status==="dirty"?(r.dirty(),tr(i.value)):this._def.out._parseAsync({data:i.value,path:a.path,parent:a})})();{let s=this._def.in._parseSync({data:a.data,path:a.path,parent:a});return s.status==="aborted"?$:s.status==="dirty"?(r.dirty(),{status:"dirty",value:s.value}):this._def.out._parseSync({data:s.value,path:a.path,parent:a})}}static create(e,r){return new t({in:e,out:r,typeName:I.ZodPipeline})}},gr=class extends N{_parse(e){let r=this._def.innerType._parse(e),a=s=>(Mt(s)&&(s.value=Object.freeze(s.value)),s);return Hr(r)?r.then(s=>a(s)):a(r)}unwrap(){return this._def.innerType}};gr.create=(t,e)=>new gr({innerType:t,typeName:I.ZodReadonly,...L(e)});function Wc(t,e){let r=typeof t=="function"?t(e):typeof t=="string"?{message:t}:t;return typeof r=="string"?{message:r}:r}function Hc(t,e={},r){return t?jt.create().superRefine((a,s)=>{let i=t(a);if(i instanceof Promise)return i.then(c=>{if(!c){let u=Wc(e,a),p=u.fatal??r??!0;s.addIssue({code:"custom",...u,fatal:p})}});if(!i){let c=Wc(e,a),u=c.fatal??r??!0;s.addIssue({code:"custom",...c,fatal:u})}}):jt.create()}var Dp={object:ge.lazycreate},I;(function(t){t.ZodString="ZodString",t.ZodNumber="ZodNumber",t.ZodNaN="ZodNaN",t.ZodBigInt="ZodBigInt",t.ZodBoolean="ZodBoolean",t.ZodDate="ZodDate",t.ZodSymbol="ZodSymbol",t.ZodUndefined="ZodUndefined",t.ZodNull="ZodNull",t.ZodAny="ZodAny",t.ZodUnknown="ZodUnknown",t.ZodNever="ZodNever",t.ZodVoid="ZodVoid",t.ZodArray="ZodArray",t.ZodObject="ZodObject",t.ZodUnion="ZodUnion",t.ZodDiscriminatedUnion="ZodDiscriminatedUnion",t.ZodIntersection="ZodIntersection",t.ZodTuple="ZodTuple",t.ZodRecord="ZodRecord",t.ZodMap="ZodMap",t.ZodSet="ZodSet",t.ZodFunction="ZodFunction",t.ZodLazy="ZodLazy",t.ZodLiteral="ZodLiteral",t.ZodEnum="ZodEnum",t.ZodEffects="ZodEffects",t.ZodNativeEnum="ZodNativeEnum",t.ZodOptional="ZodOptional",t.ZodNullable="ZodNullable",t.ZodDefault="ZodDefault",t.ZodCatch="ZodCatch",t.ZodPromise="ZodPromise",t.ZodBranded="ZodBranded",t.ZodPipeline="ZodPipeline",t.ZodReadonly="ZodReadonly"})(I||(I={}));var Lp=(t,e={message:`Input not instance of ${t.name}`})=>Hc(r=>r instanceof t,e),Vc=Ft.create,Gc=rr.create,Np=Qr.create,Mp=nr.create,Jc=ar.create,Fp=sr.create,jp=Gr.create,Wp=or.create,qp=ir.create,Bp=jt.create,Up=bt.create,zp=Ue.create,Hp=Jr.create,Vp=wt.create,Gp=ge.create,Jp=ge.strictCreate,Zp=cr.create,Yp=Aa.create,Qp=lr.create,Kp=et.create,Xp=$a.create,eh=Zr.create,th=Yr.create,rh=Pa.create,nh=ur.create,ah=dr.create,sh=fr.create,oh=pr.create,ih=Wt.create,ch=De.create,lh=Ie.create,uh=tt.create,dh=De.createWithPreprocess,fh=Sn.create,ph=()=>Vc().optional(),hh=()=>Gc().optional(),mh=()=>Jc().optional(),gh={string:(t=>Ft.create({...t,coerce:!0})),number:(t=>rr.create({...t,coerce:!0})),boolean:(t=>ar.create({...t,coerce:!0})),bigint:(t=>nr.create({...t,coerce:!0})),date:(t=>sr.create({...t,coerce:!0}))};var yh=$;var lo="2024-11-05",Zc=[lo,"2024-10-07"],Ia="2.0",Yc=h.union([h.string(),h.number().int()]),Qc=h.string(),ze=h.object({_meta:h.optional(h.object({progressToken:h.optional(Yc)}).passthrough())}).passthrough(),ke=h.object({method:h.string(),params:h.optional(ze)}),vn=h.object({_meta:h.optional(h.object({}).passthrough())}).passthrough(),rt=h.object({method:h.string(),params:h.optional(vn)}),He=h.object({_meta:h.optional(h.object({}).passthrough())}).passthrough(),Oa=h.union([h.string(),h.number().int()]),bh=h.object({jsonrpc:h.literal(Ia),id:Oa}).merge(ke).strict(),wh=h.object({jsonrpc:h.literal(Ia)}).merge(rt).strict(),_h=h.object({jsonrpc:h.literal(Ia),id:Oa,result:He}).strict(),Kr;(function(t){t[t.ConnectionClosed=-1]="ConnectionClosed",t[t.ParseError=-32700]="ParseError",t[t.InvalidRequest=-32600]="InvalidRequest",t[t.MethodNotFound=-32601]="MethodNotFound",t[t.InvalidParams=-32602]="InvalidParams",t[t.InternalError=-32603]="InternalError"})(Kr||(Kr={}));var kh=h.object({jsonrpc:h.literal(Ia),id:Oa,error:h.object({code:h.number().int(),message:h.string(),data:h.optional(h.unknown())})}).strict(),Kc=h.union([bh,wh,_h,kh]),Da=He.strict(),La=rt.extend({method:h.literal("notifications/cancelled"),params:vn.extend({requestId:Oa,reason:h.string().optional()})}),Xc=h.object({name:h.string(),version:h.string()}).passthrough(),Sh=h.object({experimental:h.optional(h.object({}).passthrough()),sampling:h.optional(h.object({}).passthrough()),roots:h.optional(h.object({listChanged:h.optional(h.boolean())}).passthrough())}).passthrough(),uo=ke.extend({method:h.literal("initialize"),params:ze.extend({protocolVersion:h.string(),capabilities:Sh,clientInfo:Xc})}),xh=h.object({experimental:h.optional(h.object({}).passthrough()),logging:h.optional(h.object({}).passthrough()),prompts:h.optional(h.object({listChanged:h.optional(h.boolean())}).passthrough()),resources:h.optional(h.object({subscribe:h.optional(h.boolean()),listChanged:h.optional(h.boolean())}).passthrough()),tools:h.optional(h.object({listChanged:h.optional(h.boolean())}).passthrough())}).passthrough(),vh=He.extend({protocolVersion:h.string(),capabilities:xh,serverInfo:Xc}),fo=rt.extend({method:h.literal("notifications/initialized")}),Na=ke.extend({method:h.literal("ping")}),Th=h.object({progress:h.number(),total:h.optional(h.number())}).passthrough(),Ma=rt.extend({method:h.literal("notifications/progress"),params:vn.merge(Th).extend({progressToken:Yc})}),Fa=ke.extend({params:ze.extend({cursor:h.optional(Qc)}).optional()}),ja=He.extend({nextCursor:h.optional(Qc)}),el=h.object({uri:h.string(),mimeType:h.optional(h.string())}).passthrough(),tl=el.extend({text:h.string()}),rl=el.extend({blob:h.string().base64()}),Ch=h.object({uri:h.string(),name:h.string(),description:h.optional(h.string()),mimeType:h.optional(h.string())}).passthrough(),Rh=h.object({uriTemplate:h.string(),name:h.string(),description:h.optional(h.string()),mimeType:h.optional(h.string())}).passthrough(),po=Fa.extend({method:h.literal("resources/list")}),Eh=ja.extend({resources:h.array(Ch)}),Ah=Fa.extend({method:h.literal("resources/templates/list")}),$h=ja.extend({resourceTemplates:h.array(Rh)}),ho=ke.extend({method:h.literal("resources/read"),params:ze.extend({uri:h.string()})}),Ph=He.extend({contents:h.array(h.union([tl,rl]))}),Ih=rt.extend({method:h.literal("notifications/resources/list_changed")}),Oh=ke.extend({method:h.literal("resources/subscribe"),params:ze.extend({uri:h.string()})}),Dh=ke.extend({method:h.literal("resources/unsubscribe"),params:ze.extend({uri:h.string()})}),Lh=rt.extend({method:h.literal("notifications/resources/updated"),params:vn.extend({uri:h.string()})}),Nh=h.object({name:h.string(),description:h.optional(h.string()),required:h.optional(h.boolean())}).passthrough(),Mh=h.object({name:h.string(),description:h.optional(h.string()),arguments:h.optional(h.array(Nh))}).passthrough(),Fh=Fa.extend({method:h.literal("prompts/list")}),jh=ja.extend({prompts:h.array(Mh)}),Wh=ke.extend({method:h.literal("prompts/get"),params:ze.extend({name:h.string(),arguments:h.optional(h.record(h.string()))})}),Wa=h.object({type:h.literal("text"),text:h.string()}).passthrough(),qa=h.object({type:h.literal("image"),data:h.string().base64(),mimeType:h.string()}).passthrough(),nl=h.object({type:h.literal("resource"),resource:h.union([tl,rl])}).passthrough(),qh=h.object({role:h.enum(["user","assistant"]),content:h.union([Wa,qa,nl])}).passthrough(),Bh=He.extend({description:h.optional(h.string()),messages:h.array(qh)}),Uh=rt.extend({method:h.literal("notifications/prompts/list_changed")}),zh=h.object({name:h.string(),description:h.optional(h.string()),inputSchema:h.object({type:h.literal("object"),properties:h.optional(h.object({}).passthrough())}).passthrough()}).passthrough(),mo=Fa.extend({method:h.literal("tools/list")}),Hh=ja.extend({tools:h.array(zh)}),al=He.extend({content:h.array(h.union([Wa,qa,nl])),isError:h.boolean().default(!1).optional()}),pw=al.or(He.extend({toolResult:h.unknown()})),go=ke.extend({method:h.literal("tools/call"),params:ze.extend({name:h.string(),arguments:h.optional(h.record(h.unknown()))})}),Vh=rt.extend({method:h.literal("notifications/tools/list_changed")}),sl=h.enum(["debug","info","notice","warning","error","critical","alert","emergency"]),Gh=ke.extend({method:h.literal("logging/setLevel"),params:ze.extend({level:sl})}),Jh=rt.extend({method:h.literal("notifications/message"),params:vn.extend({level:sl,logger:h.optional(h.string()),data:h.unknown()})}),Zh=h.object({name:h.string().optional()}).passthrough(),Yh=h.object({hints:h.optional(h.array(Zh)),costPriority:h.optional(h.number().min(0).max(1)),speedPriority:h.optional(h.number().min(0).max(1)),intelligencePriority:h.optional(h.number().min(0).max(1))}).passthrough(),Qh=h.object({role:h.enum(["user","assistant"]),content:h.union([Wa,qa])}).passthrough(),Kh=ke.extend({method:h.literal("sampling/createMessage"),params:ze.extend({messages:h.array(Qh),systemPrompt:h.optional(h.string()),includeContext:h.optional(h.enum(["none","thisServer","allServers"])),temperature:h.optional(h.number()),maxTokens:h.number().int(),stopSequences:h.optional(h.array(h.string())),metadata:h.optional(h.object({}).passthrough()),modelPreferences:h.optional(Yh)})}),yo=He.extend({model:h.string(),stopReason:h.optional(h.enum(["endTurn","stopSequence","maxTokens"]).or(h.string())),role:h.enum(["user","assistant"]),content:h.discriminatedUnion("type",[Wa,qa])}),Xh=h.object({type:h.literal("ref/resource"),uri:h.string()}).passthrough(),em=h.object({type:h.literal("ref/prompt"),name:h.string()}).passthrough(),tm=ke.extend({method:h.literal("completion/complete"),params:ze.extend({ref:h.union([em,Xh]),argument:h.object({name:h.string(),value:h.string()}).passthrough()})}),rm=He.extend({completion:h.object({values:h.array(h.string()).max(100),total:h.optional(h.number().int()),hasMore:h.optional(h.boolean())}).passthrough()}),nm=h.object({uri:h.string().startsWith("file://"),name:h.optional(h.string())}).passthrough(),am=ke.extend({method:h.literal("roots/list")}),bo=He.extend({roots:h.array(nm)}),sm=rt.extend({method:h.literal("notifications/roots/list_changed")}),hw=h.union([Na,uo,tm,Gh,Wh,Fh,po,Ah,ho,Oh,Dh,go,mo]),mw=h.union([La,Ma,fo,sm]),gw=h.union([Da,yo,bo]),yw=h.union([Na,Kh,am]),bw=h.union([La,Ma,Jh,Lh,Ih,Vh,Uh]),ww=h.union([Da,vh,rm,Bh,jh,Eh,$h,Ph,al,Hh]),xn=class extends Error{constructor(e,r,a){super(`MCP error ${e}: ${r}`),this.code=e,this.data=a}};var Ba=class{constructor(e){this._options=e,this._requestMessageId=0,this._requestHandlers=new Map,this._requestHandlerAbortControllers=new Map,this._notificationHandlers=new Map,this._responseHandlers=new Map,this._progressHandlers=new Map,this.setNotificationHandler(La,r=>{let a=this._requestHandlerAbortControllers.get(r.params.requestId);a?.abort(r.params.reason)}),this.setNotificationHandler(Ma,r=>{this._onprogress(r)}),this.setRequestHandler(Na,r=>({}))}async connect(e){this._transport=e,this._transport.onclose=()=>{this._onclose()},this._transport.onerror=r=>{this._onerror(r)},this._transport.onmessage=r=>{"method"in r?"id"in r?this._onrequest(r):this._onnotification(r):this._onresponse(r)},await this._transport.start()}_onclose(){var e;let r=this._responseHandlers;this._responseHandlers=new Map,this._progressHandlers.clear(),this._transport=void 0,(e=this.onclose)===null||e===void 0||e.call(this);let a=new xn(Kr.ConnectionClosed,"Connection closed");for(let s of r.values())s(a)}_onerror(e){var r;(r=this.onerror)===null||r===void 0||r.call(this,e)}_onnotification(e){var r;let a=(r=this._notificationHandlers.get(e.method))!==null&&r!==void 0?r:this.fallbackNotificationHandler;a!==void 0&&Promise.resolve().then(()=>a(e)).catch(s=>this._onerror(new Error(`Uncaught error in notification handler: ${s}`)))}_onrequest(e){var r,a;let s=(r=this._requestHandlers.get(e.method))!==null&&r!==void 0?r:this.fallbackRequestHandler;if(s===void 0){(a=this._transport)===null||a===void 0||a.send({jsonrpc:"2.0",id:e.id,error:{code:Kr.MethodNotFound,message:"Method not found"}}).catch(c=>this._onerror(new Error(`Failed to send an error response: ${c}`)));return}let i=new AbortController;this._requestHandlerAbortControllers.set(e.id,i),Promise.resolve().then(()=>s(e,{signal:i.signal})).then(c=>{var u;if(!i.signal.aborted)return(u=this._transport)===null||u===void 0?void 0:u.send({result:c,jsonrpc:"2.0",id:e.id})},c=>{var u,p;if(!i.signal.aborted)return(u=this._transport)===null||u===void 0?void 0:u.send({jsonrpc:"2.0",id:e.id,error:{code:Number.isSafeInteger(c.code)?c.code:Kr.InternalError,message:(p=c.message)!==null&&p!==void 0?p:"Internal error"}})}).catch(c=>this._onerror(new Error(`Failed to send response: ${c}`))).finally(()=>{this._requestHandlerAbortControllers.delete(e.id)})}_onprogress(e){let{progress:r,total:a,progressToken:s}=e.params,i=this._progressHandlers.get(Number(s));if(i===void 0){this._onerror(new Error(`Received a progress notification for an unknown token: ${JSON.stringify(e)}`));return}i({progress:r,total:a})}_onresponse(e){let r=e.id,a=this._responseHandlers.get(Number(r));if(a===void 0){this._onerror(new Error(`Received a response for an unknown message ID: ${JSON.stringify(e)}`));return}if(this._responseHandlers.delete(Number(r)),this._progressHandlers.delete(Number(r)),"result"in e)a(e);else{let s=new xn(e.error.code,e.error.message,e.error.data);a(s)}}get transport(){return this._transport}async close(){var e;await((e=this._transport)===null||e===void 0?void 0:e.close())}request(e,r,a){return new Promise((s,i)=>{var c,u,p;if(!this._transport){i(new Error("Not connected"));return}((c=this._options)===null||c===void 0?void 0:c.enforceStrictCapabilities)===!0&&this.assertCapabilityForMethod(e.method),(u=a?.signal)===null||u===void 0||u.throwIfAborted();let d=this._requestMessageId++,g={...e,jsonrpc:"2.0",id:d};a?.onprogress&&(this._progressHandlers.set(d,a.onprogress),g.params={...e.params,_meta:{progressToken:d}}),this._responseHandlers.set(d,k=>{var x;if(!(!((x=a?.signal)===null||x===void 0)&&x.aborted)){if(k instanceof Error)return i(k);try{let P=r.parse(k.result);s(P)}catch(P){i(P)}}}),(p=a?.signal)===null||p===void 0||p.addEventListener("abort",()=>{var k,x;let P=(k=a?.signal)===null||k===void 0?void 0:k.reason;this._responseHandlers.delete(d),this._progressHandlers.delete(d),(x=this._transport)===null||x===void 0||x.send({jsonrpc:"2.0",method:"cancelled",params:{requestId:d,reason:String(P)}}),i(P)}),this._transport.send(g).catch(i)})}async notification(e){if(!this._transport)throw new Error("Not connected");this.assertNotificationCapability(e.method);let r={...e,jsonrpc:"2.0"};await this._transport.send(r)}setRequestHandler(e,r){let a=e.shape.method.value;this.assertRequestHandlerCapability(a),this._requestHandlers.set(a,(s,i)=>Promise.resolve(r(e.parse(s),i)))}removeRequestHandler(e){this._requestHandlers.delete(e)}setNotificationHandler(e,r){this._notificationHandlers.set(e.shape.method.value,a=>Promise.resolve(r(e.parse(a))))}removeNotificationHandler(e){this._notificationHandlers.delete(e)}};var Ua=class extends Ba{constructor(e,r){super(r),this._serverInfo=e,this._capabilities=r.capabilities,this.setRequestHandler(uo,a=>this._oninitialize(a)),this.setNotificationHandler(fo,()=>{var a;return(a=this.oninitialized)===null||a===void 0?void 0:a.call(this)})}assertCapabilityForMethod(e){var r,a;switch(e){case"sampling/createMessage":if(!(!((r=this._clientCapabilities)===null||r===void 0)&&r.sampling))throw new Error(`Client does not support sampling (required for ${e})`);break;case"roots/list":if(!(!((a=this._clientCapabilities)===null||a===void 0)&&a.roots))throw new Error(`Client does not support listing roots (required for ${e})`);break;case"ping":break}}assertNotificationCapability(e){switch(e){case"notifications/message":if(!this._capabilities.logging)throw new Error(`Server does not support logging (required for ${e})`);break;case"notifications/resources/updated":case"notifications/resources/list_changed":if(!this._capabilities.resources)throw new Error(`Server does not support notifying about resources (required for ${e})`);break;case"notifications/tools/list_changed":if(!this._capabilities.tools)throw new Error(`Server does not support notifying of tool list changes (required for ${e})`);break;case"notifications/prompts/list_changed":if(!this._capabilities.prompts)throw new Error(`Server does not support notifying of prompt list changes (required for ${e})`);break;case"notifications/cancelled":break;case"notifications/progress":break}}assertRequestHandlerCapability(e){switch(e){case"sampling/createMessage":if(!this._capabilities.sampling)throw new Error(`Server does not support sampling (required for ${e})`);break;case"logging/setLevel":if(!this._capabilities.logging)throw new Error(`Server does not support logging (required for ${e})`);break;case"prompts/get":case"prompts/list":if(!this._capabilities.prompts)throw new Error(`Server does not support prompts (required for ${e})`);break;case"resources/list":case"resources/templates/list":case"resources/read":if(!this._capabilities.resources)throw new Error(`Server does not support resources (required for ${e})`);break;case"tools/call":case"tools/list":if(!this._capabilities.tools)throw new Error(`Server does not support tools (required for ${e})`);break;case"ping":case"initialize":break}}async _oninitialize(e){let r=e.params.protocolVersion;return this._clientCapabilities=e.params.capabilities,this._clientVersion=e.params.clientInfo,{protocolVersion:Zc.includes(r)?r:lo,capabilities:this.getCapabilities(),serverInfo:this._serverInfo}}getClientCapabilities(){return this._clientCapabilities}getClientVersion(){return this._clientVersion}getCapabilities(){return this._capabilities}async ping(){return this.request({method:"ping"},Da)}async createMessage(e,r){return this.request({method:"sampling/createMessage",params:e},yo,r)}async listRoots(e,r){return this.request({method:"roots/list",params:e},bo,r)}async sendLoggingMessage(e){return this.notification({method:"notifications/message",params:e})}async sendResourceUpdated(e){return this.notification({method:"notifications/resources/updated",params:e})}async sendResourceListChanged(){return this.notification({method:"notifications/resources/list_changed"})}async sendToolListChanged(){return this.notification({method:"notifications/tools/list_changed"})}async sendPromptListChanged(){return this.notification({method:"notifications/prompts/list_changed"})}};var wo=Be(require("node:process"),1);var za=class{append(e){this._buffer=this._buffer?Buffer.concat([this._buffer,e]):e}readMessage(){if(!this._buffer)return null;let e=this._buffer.indexOf(`
`);if(e===-1)return null;let r=this._buffer.toString("utf8",0,e);return this._buffer=this._buffer.subarray(e+1),om(r)}clear(){this._buffer=void 0}};function om(t){return Kc.parse(JSON.parse(t))}function ol(t){return JSON.stringify(t)+`
`}var Ha=class{constructor(e=wo.default.stdin,r=wo.default.stdout){this._stdin=e,this._stdout=r,this._readBuffer=new za,this._started=!1,this._ondata=a=>{this._readBuffer.append(a),this.processReadBuffer()},this._onerror=a=>{var s;(s=this.onerror)===null||s===void 0||s.call(this,a)}}async start(){if(this._started)throw new Error("StdioServerTransport already started! If using Server class, note that connect() calls start() automatically.");this._started=!0,this._stdin.on("data",this._ondata),this._stdin.on("error",this._onerror)}processReadBuffer(){for(var e,r;;)try{let a=this._readBuffer.readMessage();if(a===null)break;(e=this.onmessage)===null||e===void 0||e.call(this,a)}catch(a){(r=this.onerror)===null||r===void 0||r.call(this,a)}}async close(){var e;this._stdin.off("data",this._ondata),this._stdin.off("error",this._onerror),this._readBuffer.clear(),(e=this.onclose)===null||e===void 0||e.call(this)}send(e){return new Promise(r=>{let a=ol(e);this._stdout.write(a)?r():this._stdout.once("drain",r)})}};var Fe=require("fs/promises"),cn=require("path"),ms=require("os"),gs=require("fs"),Ek=require("url");var X=require("fs/promises"),K=require("path");var tn=require("fs/promises"),No=require("path"),Mo=require("os");Dn();function Em(t,e){let r=[];for(let a=0;a<=e.length;a++)r[a]=[a];for(let a=0;a<=t.length;a++)r[0][a]=a;for(let a=1;a<=e.length;a++)for(let s=1;s<=t.length;s++)e.charAt(a-1)===t.charAt(s-1)?r[a][s]=r[a-1][s-1]:r[a][s]=Math.min(r[a-1][s-1]+1,r[a][s-1]+1,r[a-1][s]+1);return r[e.length][t.length]}function Xl(t,e){let r=Em(t.toLowerCase(),e.toLowerCase()),a=Math.max(t.length,e.length);return 1-r/a}function Lo(t,e,r=.6){if(!t||!e||e.length===0)return null;let a=t.toLowerCase().trim();for(let c of e)if(c.name.toLowerCase()===a)return{workspace:c,confidence:1,matchType:"exact"};for(let c of e){let u=c.name.toLowerCase();if(u.includes(a)||a.includes(u))return{workspace:c,confidence:.9,matchType:"substring"}}let s=null,i=0;for(let c of e){let u=Xl(a,c.name);u>i&&u>=r&&(i=u,s=c)}return s?{workspace:s,confidence:i,matchType:"fuzzy"}:null}function eu(t,e,r=.5,a=3){if(!t||!e||e.length===0)return[];let s=t.toLowerCase().trim(),i=[];for(let c of e){let u=c.name.toLowerCase(),p=0,d="fuzzy";u===s?(p=1,d="exact"):u.includes(s)||s.includes(u)?(p=.9,d="substring"):(p=Xl(s,c.name),d="fuzzy"),p>=r&&i.push({workspace:c,confidence:p,matchType:d})}return i.sort((c,u)=>u.confidence-c.confidence).slice(0,a)}function tu(t){let e=[],r=[/(?:in|from|to|at|on)\s+(?:my\s+)?([a-zA-Z0-9\s-]+?)(?:\s+workspace|\s+notes?|\s+folder)/gi,/(?:workspace|notes?|folder)\s+(?:named|called)\s+["']?([a-zA-Z0-9\s-]+?)["']?/gi,/["']([a-zA-Z0-9\s-]+?)["']\s+(?:workspace|notes?|folder)/gi];for(let a of r){let s;for(;(s=a.exec(t))!==null;)e.push(s[1].trim())}return[...new Set(e)]}var ru=(0,No.join)((0,Mo.homedir)(),".lokus","mcp-context.json"),Fo=[{name:"list_all_workspaces",description:"List all available Lokus workspaces. Use this when you need to see what workspaces are available or when the user mentions a workspace name.",inputSchema:{type:"object",properties:{}}},{name:"set_workspace_context",description:"Set the active workspace context for all subsequent operations. This ensures all tools operate on the correct workspace. Always use this before performing workspace-specific operations.",inputSchema:{type:"object",properties:{workspacePath:{type:"string",description:"Full path to the workspace to set as active"}},required:["workspacePath"]}},{name:"get_current_context",description:"Get the currently active workspace context. Use this to verify which workspace you're operating on.",inputSchema:{type:"object",properties:{}}},{name:"match_workspace_by_name",description:"Smart workspace detection from natural language. Use this when the user refers to a workspace by name (e.g., 'my knowledge base', 'work notes'). Returns the best matching workspace.",inputSchema:{type:"object",properties:{query:{type:"string",description:"Natural language workspace reference (e.g., 'knowledge base', 'work notes', 'personal workspace')"},autoSet:{type:"boolean",description:"Automatically set the matched workspace as active context (default: true)"}},required:["query"]}},{name:"clear_workspace_context",description:"Clear the active workspace context. Use this when you need to reset or when switching between different tasks.",inputSchema:{type:"object",properties:{}}},{name:"detect_workspace_from_text",description:"Analyze text to automatically detect workspace references and provide suggestions. Useful when the user's message contains workspace-related context.",inputSchema:{type:"object",properties:{text:{type:"string",description:"Text to analyze for workspace references"}},required:["text"]}}];async function nu(t,e,r){switch(t){case"list_all_workspaces":return await Am(r);case"set_workspace_context":return await jo(e.workspacePath);case"get_current_context":return await $m();case"match_workspace_by_name":return await Pm(e.query,e.autoSet!==!1,r);case"clear_workspace_context":return await Im();case"detect_workspace_from_text":return await Om(e.text,r);default:throw new Error(`Unknown workspace context tool: ${t}`)}}async function Am(t){if(!t)return{content:[{type:"text",text:`\u274C API server not available. Cannot list workspaces.

Please ensure Lokus is running.`}]};try{let e=await St(`${t}/api/workspaces/all`);if(!e.ok)throw new Error(`API request failed: ${e.status}`);let r=await e.json();if(!r.success||!r.data)throw new Error(r.error||"Failed to fetch workspaces");let a=r.data;if(a.length===0)return{content:[{type:"text",text:`\u{1F4C2} No workspaces found.

You may need to open a workspace in Lokus first.`}]};let s=await Ln();return{content:[{type:"text",text:`**Available Workspaces:**

${a.map(c=>{let p=s.currentWorkspace===c.path?"\u{1F449} ":"   ",d=c.note_count!==null?` (${c.note_count} notes)`:"";return`${p}\u{1F4C1} **${c.name}**${d}
      Path: ${c.path}`}).join(`

`)}

${s.currentWorkspace?"\u{1F449} = Currently active workspace":"\u{1F4A1} Use `match_workspace_by_name` or `set_workspace_context` to set active workspace"}`}]}}catch(e){return{content:[{type:"text",text:`\u274C Failed to list workspaces: ${e.message}

Please ensure Lokus is running and the API server is accessible.`}]}}}async function jo(t){try{let e=await Ln();return e.currentWorkspace=t,e.lastUpdated=new Date().toISOString(),await au(e),{content:[{type:"text",text:`\u2705 Workspace context set to:
\u{1F4C1} **${t}**

All subsequent operations will use this workspace.`}]}}catch(e){return{content:[{type:"text",text:`\u274C Failed to set workspace context: ${e.message}`}]}}}async function $m(){try{let t=await Ln();if(!t.currentWorkspace)return{content:[{type:"text",text:"\u26A0\uFE0F No workspace context is currently set.\n\n\u{1F4A1} Use `list_all_workspaces` to see available workspaces, then use `match_workspace_by_name` or `set_workspace_context` to set one."}]};let e=new Date-new Date(t.lastUpdated),r=Math.floor(e/6e4),a=r<1?"just now":`${r} minute${r!==1?"s":""} ago`;return{content:[{type:"text",text:`**Current Workspace Context:**

\u{1F4C1} ${t.currentWorkspace}
\u23F1\uFE0F Last updated: ${a}

\u2705 All operations will use this workspace.`}]}}catch(t){return{content:[{type:"text",text:`\u274C Failed to get context: ${t.message}`}]}}}async function Pm(t,e,r){if(!r)return{content:[{type:"text",text:"\u274C API server not available. Cannot match workspaces."}]};try{let a=await St(`${r}/api/workspaces/all`);if(!a.ok)throw new Error(`API request failed: ${a.status}`);let s=await a.json();if(!s.success||!s.data)throw new Error(s.error||"Failed to fetch workspaces");let i=s.data;if(i.length===0)return{content:[{type:"text",text:"\u{1F4C2} No workspaces available to match against."}]};let c=Lo(t,i,.6);if(!c){let g=eu(t,i,.4,3);if(g.length>0){let k=g.map(x=>`  - ${x.workspace.name} (${Math.round(x.confidence*100)}% match)`).join(`
`);return{content:[{type:"text",text:`\u274C No strong match found for "${t}".

Did you mean:
${k}

\u{1F4A1} Try being more specific or use \`list_all_workspaces\` to see all available workspaces.`}]}}return{content:[{type:"text",text:`\u274C No workspace matches "${t}".

\u{1F4A1} Use \`list_all_workspaces\` to see all available workspaces.`}]}}let u=Math.round(c.confidence*100),d=`${c.matchType==="exact"?"\u{1F3AF}":c.matchType==="substring"?"\u2705":"\u{1F50D}"} **Match Found** (${u}% confidence)

\u{1F4C1} **${c.workspace.name}**
   Path: ${c.workspace.path}
   Match type: ${c.matchType}`;return e?(await jo(c.workspace.path),d+=`

\u2705 Workspace context has been automatically set.
All subsequent operations will use this workspace.`):d+="\n\n\u{1F4A1} Use `set_workspace_context` to activate this workspace.",{content:[{type:"text",text:d}]}}catch(a){return{content:[{type:"text",text:`\u274C Failed to match workspace: ${a.message}`}]}}}async function Im(){try{let t=await Ln(),e=t.currentWorkspace;return t.currentWorkspace=null,t.lastUpdated=new Date().toISOString(),await au(t),{content:[{type:"text",text:e?`\u2705 Workspace context cleared.
Previously: ${e}`:"\u2705 Workspace context cleared (no context was set)."}]}}catch(t){return{content:[{type:"text",text:`\u274C Failed to clear context: ${t.message}`}]}}}async function Om(t,e){if(!e)return{content:[{type:"text",text:"\u274C API server not available."}]};try{let r=tu(t);if(r.length===0)return{content:[{type:"text",text:`\u{1F50D} No workspace references detected in the text.

\u{1F4A1} Try phrases like 'in my knowledge base' or 'from work notes'.`}]};let a=await St(`${e}/api/workspaces/all`);if(!a.ok)throw new Error(`API request failed: ${a.status}`);let s=await a.json();if(!s.success||!s.data)throw new Error(s.error||"Failed to fetch workspaces");let i=s.data,c=[];for(let d of r){let g=Lo(d,i,.5);g&&c.push({reference:d,match:g})}if(c.length===0)return{content:[{type:"text",text:`\u{1F50D} Found potential workspace references but couldn't match them:
${r.map(d=>`  - "${d}"`).join(`
`)}

\u{1F4A1} Use \`list_all_workspaces\` to see available workspaces.`}]};let u=c.map(d=>`  - "${d.reference}" \u2192 **${d.match.workspace.name}** (${Math.round(d.match.confidence*100)}% confidence)`).join(`
`),p=c.sort((d,g)=>g.match.confidence-d.match.confidence)[0];return await jo(p.match.workspace.path),{content:[{type:"text",text:`\u{1F50D} **Workspace References Detected:**

${u}

\u2705 Automatically set context to: **${p.match.workspace.name}**`}]}}catch(r){return{content:[{type:"text",text:`\u274C Failed to detect workspace: ${r.message}`}]}}}async function Ln(){try{let t=await(0,tn.readFile)(ru,"utf-8");return JSON.parse(t)}catch{return{currentWorkspace:null,lastUpdated:null}}}async function au(t){let e=(0,No.join)((0,Mo.homedir)(),".lokus");try{await(0,tn.mkdir)(e,{recursive:!0})}catch{}await(0,tn.writeFile)(ru,JSON.stringify(t,null,2),"utf-8")}async function su(){return(await Ln()).currentWorkspace}function ou(t){return t?`\u{1F3AF} **Operating on:** ${t.split("/").pop()} (${t})`:"\u26A0\uFE0F **No workspace context set** - Using default or last workspace"}var Wo=[{name:"list_notes",description:"List all notes in the workspace with metadata",inputSchema:{type:"object",properties:{folder:{type:"string",description:"Folder to list notes from (optional)"},sortBy:{type:"string",enum:["name","modified","created","size"],description:"Sort notes by"},includeContent:{type:"boolean",description:"Include first 200 chars of content"}}}},{name:"read_note",description:"Read the full content of a note",inputSchema:{type:"object",properties:{path:{type:"string",description:"Path to the note file"}},required:["path"]}},{name:"create_note",description:"Create a new note with optional frontmatter",inputSchema:{type:"object",properties:{path:{type:"string",description:"Path for the new note"},content:{type:"string",description:"Note content"},frontmatter:{type:"object",description:"Optional frontmatter metadata"}},required:["path","content"]}},{name:"update_note",description:"Update an existing note's content",inputSchema:{type:"object",properties:{path:{type:"string",description:"Path to the note"},content:{type:"string",description:"New content"},preserveFrontmatter:{type:"boolean",description:"Preserve existing frontmatter"}},required:["path","content"]}},{name:"delete_note",description:"Delete a note",inputSchema:{type:"object",properties:{path:{type:"string",description:"Path to the note to delete"}},required:["path"]}},{name:"search_notes",description:"Search notes by content or metadata",inputSchema:{type:"object",properties:{query:{type:"string",description:"Search query"},searchIn:{type:"string",enum:["content","title","tags","all"],description:"Where to search"},regex:{type:"boolean",description:"Use regex search"}},required:["query"]}},{name:"get_note_links",description:"Get all wiki links in a note",inputSchema:{type:"object",properties:{path:{type:"string",description:"Path to the note"}},required:["path"]}},{name:"get_note_backlinks",description:"Find all notes that link to a specific note",inputSchema:{type:"object",properties:{noteName:{type:"string",description:"Name of the note to find backlinks for"}},required:["noteName"]}},{name:"extract_note_metadata",description:"Extract frontmatter and metadata from a note",inputSchema:{type:"object",properties:{path:{type:"string",description:"Path to the note"}},required:["path"]}},{name:"rename_note",description:"Rename a note and update all references",inputSchema:{type:"object",properties:{oldPath:{type:"string",description:"Current path of the note"},newPath:{type:"string",description:"New path for the note"},updateLinks:{type:"boolean",description:"Update wiki links in other notes"}},required:["oldPath","newPath"]}}];async function iu(t,e,r,a){let i=await su()||r;switch(t){case"list_notes":return await Dm(i,e);case"read_note":return await Lm(i,e.path);case"create_note":return await Nm(i,e);case"update_note":return await Mm(i,e);case"delete_note":return await Fm(i,e.path);case"search_notes":return await jm(i,e);case"get_note_links":return await Wm(i,e.path);case"get_note_backlinks":return await qm(i,e.noteName);case"extract_note_metadata":return await Bm(i,e.path);case"rename_note":return await Um(i,e);default:throw new Error(`Unknown notes tool: ${t}`)}}async function Dm(t,e={}){let r=await Nn(t);if(e.sortBy&&r.sort((a,s)=>{switch(e.sortBy){case"modified":return s.modified-a.modified;case"created":return s.created-a.created;case"size":return s.size-a.size;default:return a.name.localeCompare(s.name)}}),e.includeContent)for(let a of r)try{let s=await(0,X.readFile)(a.path,"utf-8");a.preview=s.substring(0,200).replace(/\n/g," ")}catch{a.preview=null}return{content:[{type:"text",text:`${ou(t)}

Found ${r.length} notes

${r.map(a=>`- ${a.name} (${a.relativePath})${a.preview?`
  `+a.preview+"...":""}`).join(`
`)}`}]}}async function Nn(t,e=t){let r=[],a=await(0,X.readdir)(t,{withFileTypes:!0});for(let s of a){let i=(0,K.join)(t,s.name);if(!s.name.startsWith(".")){if(s.isDirectory()){let c=await Nn(i,e);r.push(...c)}else if(s.isFile()&&[".md",".txt"].includes((0,K.extname)(s.name))){let c=await(0,X.stat)(i);r.push({path:i,relativePath:i.replace(e+"/",""),name:(0,K.basename)(s.name,(0,K.extname)(s.name)),size:c.size,created:c.birthtime?.getTime(),modified:c.mtime?.getTime()})}}}return r}async function Lm(t,e){let r=e.startsWith("/")?e:(0,K.join)(t,e);return{content:[{type:"text",text:await(0,X.readFile)(r,"utf-8")}]}}async function Nm(t,{path:e,content:r,frontmatter:a}){let s=(0,K.join)(t,e);await(0,X.mkdir)((0,K.dirname)(s),{recursive:!0});let i=r;return a&&(i=`---
${Object.entries(a).map(([u,p])=>`${u}: ${JSON.stringify(p)}`).join(`
`)}
---

${r}`),await(0,X.writeFile)(s,i),{content:[{type:"text",text:`\u2705 Note created: ${e}`}]}}async function Mm(t,{path:e,content:r,preserveFrontmatter:a}){let s=(0,K.join)(t,e);if(a){let c=(await(0,X.readFile)(s,"utf-8")).match(/^---\n([\s\S]*?)\n---\n/);c&&(r=c[0]+r)}return await(0,X.writeFile)(s,r),{content:[{type:"text",text:`\u2705 Note updated: ${e}`}]}}async function Fm(t,e){let r=(0,K.join)(t,e),{unlink:a}=await import("fs/promises");return await a(r),{content:[{type:"text",text:`\u2705 Note deleted: ${e}`}]}}async function jm(t,{query:e,searchIn:r="all",regex:a=!1}){let s=await Nn(t),i=[],c=a?new RegExp(e,"gi"):e.toLowerCase();for(let u of s)try{let p=await(0,X.readFile)(u.path,"utf-8"),d=!1,g="";if((r==="title"||r==="all")&&(a?c.test(u.name):u.name.toLowerCase().includes(e.toLowerCase()))&&(d=!0,g=`Title match: ${u.name}`),!d&&(r==="content"||r==="all")&&(a?c.test(p):p.toLowerCase().includes(e.toLowerCase()))){d=!0;let k=p.toLowerCase().indexOf(e.toLowerCase()),x=Math.max(0,k-50),P=Math.min(p.length,k+e.length+50);g=p.substring(x,P).replace(/\n/g," ")}d&&i.push({note:u.name,path:u.relativePath,context:g})}catch{}return{content:[{type:"text",text:`Found ${i.length} matches for "${e}":

${i.map(u=>`**${u.note}** (${u.path})
  ${u.context}`).join(`

`)}`}]}}async function Wm(t,e){let r=(0,K.join)(t,e),i=((await(0,X.readFile)(r,"utf-8")).match(/\[\[([^\]]+)\]\]/g)||[]).map(c=>c.slice(2,-2));return{content:[{type:"text",text:`Found ${i.length} wiki links in the note:
${i.map(c=>`- [[${c}]]`).join(`
`)}`}]}}async function qm(t,e){let r=await Nn(t),a=[];for(let s of r)try{(await(0,X.readFile)(s.path,"utf-8")).includes(`[[${e}]]`)&&a.push({note:s.name,path:s.relativePath})}catch{}return{content:[{type:"text",text:`Found ${a.length} backlinks to "${e}":
${a.map(s=>`- ${s.note} (${s.path})`).join(`
`)}`}]}}async function Bm(t,e){let r=(0,K.join)(t,e),a=await(0,X.readFile)(r,"utf-8"),s=a.match(/^---\n([\s\S]*?)\n---/),i={};if(s){let g=s[1].split(`
`);for(let k of g){let[x,...P]=k.split(":");x&&P.length&&(i[x.trim()]=P.join(":").trim())}}let c=await(0,X.stat)(r),u=a.split(/\s+/).length,p=a.split(`
`).length;return{content:[{type:"text",text:JSON.stringify({frontmatter:i,stats:{wordCount:u,lineCount:p,size:c.size,created:c.birthtime,modified:c.mtime}},null,2)}]}}async function Um(t,{oldPath:e,newPath:r,updateLinks:a=!0}){let s=(0,K.join)(t,e),i=(0,K.join)(t,r);await(0,X.mkdir)((0,K.dirname)(i),{recursive:!0});let{rename:c}=await import("fs/promises");if(await c(s,i),a){let u=(0,K.basename)(e,(0,K.extname)(e)),p=(0,K.basename)(r,(0,K.extname)(r)),d=await Nn(t),g=0;for(let k of d)try{let x=await(0,X.readFile)(k.path,"utf-8");if(x.includes(`[[${u}]]`)){let P=x.replace(new RegExp(`\\[\\[${u}\\]\\]`,"g"),`[[${p}]]`);await(0,X.writeFile)(k.path,P),g++}}catch{}return{content:[{type:"text",text:`\u2705 Note renamed from ${e} to ${r}
${a?`Updated ${g} references`:""}`}]}}return{content:[{type:"text",text:`\u2705 Note renamed from ${e} to ${r}`}]}}var Ne=require("fs/promises"),kr=require("path");Dn();var qo=[{name:"get_workspace_info",description:"Get comprehensive information about the current workspace",inputSchema:{type:"object",properties:{}}},{name:"get_workspace_stats",description:"Get statistics about the workspace (note count, size, etc)",inputSchema:{type:"object",properties:{}}},{name:"list_folders",description:"List all folders in the workspace",inputSchema:{type:"object",properties:{maxDepth:{type:"number",description:"Maximum depth to traverse"}}}},{name:"get_workspace_settings",description:"Get workspace-specific settings",inputSchema:{type:"object",properties:{}}},{name:"search_workspace",description:"Global search across all workspace content",inputSchema:{type:"object",properties:{query:{type:"string",description:"Search query"},fileTypes:{type:"array",items:{type:"string"},description:"File types to search (md, txt, json, etc)"},limit:{type:"number",description:"Maximum results to return"}},required:["query"]}},{name:"get_recent_files",description:"Get recently modified files in the workspace",inputSchema:{type:"object",properties:{count:{type:"number",description:"Number of files to return"},fileTypes:{type:"array",items:{type:"string"},description:"Filter by file types"}}}}];async function cu(t,e,r,a){switch(t){case"get_workspace_info":return await zm(r,a);case"get_workspace_stats":return await lu(r);case"list_folders":return await Hm(r,e.maxDepth||3);case"get_workspace_settings":return await Vm(r);case"search_workspace":return await Gm(r,e);case"get_recent_files":return await Jm(r,e);default:throw new Error(`Unknown workspace tool: ${t}`)}}async function zm(t,e){if(e)try{let i=await St(`${e}/api/workspace`);if(i.ok){let c=await i.json();if(c.success&&c.data)return{content:[{type:"text",text:`**Workspace Information**

\u{1F4C1} Path: ${c.data.workspace}
\u{1F4DD} Name: ${c.data.name}
\u{1F4CA} Total Notes: ${c.data.total_notes}
${c.data.has_bases?"\u2705 Bases enabled":"\u274C Bases not configured"}
${c.data.has_canvas?"\u2705 Canvas enabled":"\u274C Canvas not configured"}
${c.data.has_tasks?"\u2705 Tasks enabled":"\u274C Tasks not configured"}`}]}}}catch{}let r=await lu(t),a=(0,kr.join)(t,".lokus"),s=await Zm(a);return{content:[{type:"text",text:`**Workspace Information**

\u{1F4C1} Path: ${t}
\u{1F4DD} Notes: ${r.noteCount}
\u{1F4C2} Folders: ${r.folderCount}
\u{1F4BE} Total Size: ${Ym(r.totalSize)}
\u{1F527} Lokus Features: ${s?"Configured":"Not configured"}`}]}}async function lu(t){let e={noteCount:0,folderCount:0,totalSize:0,fileTypes:{}};async function r(a){let s=await(0,Ne.readdir)(a,{withFileTypes:!0});for(let i of s){if(i.name.startsWith("."))continue;let c=(0,kr.join)(a,i.name);if(i.isDirectory())e.folderCount++,await r(c);else if(i.isFile()){let u=await(0,Ne.stat)(c);e.totalSize+=u.size;let p=i.name.split(".").pop();e.fileTypes[p]=(e.fileTypes[p]||0)+1,["md","txt"].includes(p)&&e.noteCount++}}}return await r(t),e}async function Hm(t,e){let r=[];async function a(i,c=0,u=""){if(c>=e)return;let p=await(0,Ne.readdir)(i,{withFileTypes:!0});for(let d of p)if(!d.name.startsWith(".")&&d.isDirectory()){let g=u?`${u}/${d.name}`:d.name;r.push({name:d.name,path:g,depth:c}),await a((0,kr.join)(i,d.name),c+1,g)}}return await a(t),{content:[{type:"text",text:`**Workspace Folders:**

${r.sort((i,c)=>i.path.localeCompare(c.path)).map(i=>"  ".repeat(i.depth)+"\u{1F4C1} "+i.name).join(`
`)}`}]}}async function Vm(t){let e=(0,kr.join)(t,".lokus","settings.json");try{let r=await(0,Ne.readFile)(e,"utf-8"),a=JSON.parse(r);return{content:[{type:"text",text:`**Workspace Settings:**

${JSON.stringify(a,null,2)}`}]}}catch{return{content:[{type:"text",text:"No workspace settings found. This workspace may not be configured for Lokus."}]}}}async function Gm(t,{query:e,fileTypes:r=["md","txt"],limit:a=20}){let s=[];async function i(c){let u=await(0,Ne.readdir)(c,{withFileTypes:!0});for(let p of u){if(p.name.startsWith("."))continue;let d=(0,kr.join)(c,p.name);if(p.isDirectory())await i(d);else if(p.isFile()){let g=p.name.split(".").pop();if(r.includes(g))try{let k=await(0,Ne.readFile)(d,"utf-8");if(k.toLowerCase().includes(e.toLowerCase())){let x=k.toLowerCase().indexOf(e.toLowerCase()),P=Math.max(0,x-50),v=Math.min(k.length,x+e.length+50),z=k.substring(P,v).replace(/\n/g," ");if(s.push({file:d.replace(t+"/",""),context:z}),s.length>=a)return}}catch{}}}}return await i(t),{content:[{type:"text",text:`Found ${s.length} matches for "${e}":

${s.map(c=>`**${c.file}**
  ...${c.context}...`).join(`

`)}`}]}}async function Jm(t,{count:e=10,fileTypes:r=null}){let a=[];async function s(c){let u=await(0,Ne.readdir)(c,{withFileTypes:!0});for(let p of u){if(p.name.startsWith("."))continue;let d=(0,kr.join)(c,p.name);if(p.isDirectory())await s(d);else if(p.isFile()){let g=p.name.split(".").pop();if(!r||r.includes(g)){let k=await(0,Ne.stat)(d);a.push({path:d.replace(t+"/",""),name:p.name,modified:k.mtime,size:k.size})}}}}return await s(t),a.sort((c,u)=>u.modified-c.modified),{content:[{type:"text",text:`**Recently Modified Files:**

${a.slice(0,e).map(c=>`- ${c.name} (${c.path})
  Modified: ${c.modified.toISOString()}`).join(`
`)}`}]}}async function Zm(t){try{return await(0,Ne.stat)(t),!0}catch{return!1}}function Ym(t){return t<1024?`${t} B`:t<1024*1024?`${(t/1024).toFixed(2)} KB`:t<1024*1024*1024?`${(t/(1024*1024)).toFixed(2)} MB`:`${(t/(1024*1024*1024)).toFixed(2)} GB`}var se=require("fs/promises"),Je=require("path"),Bo=[{name:"list_bases",description:"List all bases (databases) in the workspace",inputSchema:{type:"object",properties:{}}},{name:"get_base",description:"Get details of a specific base including schema and records",inputSchema:{type:"object",properties:{baseName:{type:"string",description:"Name of the base"}},required:["baseName"]}},{name:"create_base",description:"Create a new base with specified schema",inputSchema:{type:"object",properties:{name:{type:"string",description:"Name for the new base"},schema:{type:"object",description:"Schema definition for the base",properties:{fields:{type:"array",description:"Field definitions"}}},description:{type:"string",description:"Description of the base"}},required:["name","schema"]}},{name:"add_base_record",description:"Add a new record to a base",inputSchema:{type:"object",properties:{baseName:{type:"string",description:"Name of the base"},record:{type:"object",description:"Record data"}},required:["baseName","record"]}},{name:"query_base",description:"Query records from a base with filters",inputSchema:{type:"object",properties:{baseName:{type:"string",description:"Name of the base"},filter:{type:"object",description:"Filter criteria"},sort:{type:"object",description:"Sort criteria"},limit:{type:"number",description:"Maximum records to return"}},required:["baseName"]}},{name:"update_base_record",description:"Update a record in a base",inputSchema:{type:"object",properties:{baseName:{type:"string",description:"Name of the base"},recordId:{type:"string",description:"ID of the record to update"},updates:{type:"object",description:"Fields to update"}},required:["baseName","recordId","updates"]}},{name:"delete_base_record",description:"Delete a record from a base",inputSchema:{type:"object",properties:{baseName:{type:"string",description:"Name of the base"},recordId:{type:"string",description:"ID of the record to delete"}},required:["baseName","recordId"]}},{name:"get_base_stats",description:"Get statistics about a base",inputSchema:{type:"object",properties:{baseName:{type:"string",description:"Name of the base"}},required:["baseName"]}}];async function uu(t,e,r,a){switch(t){case"list_bases":return await Qm(r);case"get_base":return await Km(r,e.baseName);case"create_base":return await Xm(r,e);case"add_base_record":return await eg(r,e);case"query_base":return await tg(r,e);case"update_base_record":return await rg(r,e);case"delete_base_record":return await ng(r,e);case"get_base_stats":return await ag(r,e.baseName);default:throw new Error(`Unknown bases tool: ${t}`)}}async function Qm(t){let e=(0,Je.join)(t,".lokus","bases");try{let r=await(0,se.readdir)(e,{withFileTypes:!0}),a=[];for(let s of r)if(s.isFile()&&s.name.endsWith(".json")){let i=s.name.replace(".json","");try{let c=await(0,se.readFile)((0,Je.join)(e,s.name),"utf-8"),u=JSON.parse(c);a.push({name:i,recordCount:u.records?u.records.length:0,fields:u.schema?.fields?.length||0,description:u.description})}catch{}}return{content:[{type:"text",text:`**Bases in Workspace:**

${a.length>0?a.map(s=>`\u{1F4CA} **${s.name}**
  - Records: ${s.recordCount}
  - Fields: ${s.fields}
  - ${s.description||"No description"}`).join(`

`):"No bases found in this workspace"}`}]}}catch{return{content:[{type:"text",text:"Bases feature not configured in this workspace"}]}}}async function Km(t,e){let r=(0,Je.join)(t,".lokus","bases",`${e}.json`);try{let a=await(0,se.readFile)(r,"utf-8"),s=JSON.parse(a);return{content:[{type:"text",text:`**Base: ${e}**

Description: ${s.description||"No description"}
Created: ${s.created||"Unknown"}
Modified: ${s.modified||"Unknown"}

**Schema:**
${s.schema?.fields?.map(i=>`- ${i.name} (${i.type})`).join(`
`)||"No schema defined"}

**Records (${s.records?.length||0}):**
${s.records?.slice(0,5).map(i=>JSON.stringify(i)).join(`
`)||"No records"}
${s.records?.length>5?`
... and ${s.records.length-5} more records`:""}`}]}}catch{return{content:[{type:"text",text:`Base "${e}" not found`}]}}}async function Xm(t,{name:e,schema:r,description:a}){let s=(0,Je.join)(t,".lokus","bases"),i=(0,Je.join)(s,`${e}.json`);await(0,se.mkdir)(s,{recursive:!0});let c={name:e,description:a,schema:r,records:[],created:new Date().toISOString(),modified:new Date().toISOString()};return await(0,se.writeFile)(i,JSON.stringify(c,null,2)),{content:[{type:"text",text:`\u2705 Base "${e}" created successfully with ${r.fields?.length||0} fields`}]}}async function eg(t,{baseName:e,record:r}){let a=(0,Je.join)(t,".lokus","bases",`${e}.json`);try{let s=await(0,se.readFile)(a,"utf-8"),i=JSON.parse(s);return r.id||(r.id=Date.now().toString(36)+Math.random().toString(36).substr(2)),r.created=new Date().toISOString(),r.modified=new Date().toISOString(),i.records=i.records||[],i.records.push(r),i.modified=new Date().toISOString(),await(0,se.writeFile)(a,JSON.stringify(i,null,2)),{content:[{type:"text",text:`\u2705 Record added to base "${e}" with ID: ${r.id}`}]}}catch(s){return{content:[{type:"text",text:`\u274C Failed to add record: ${s.message}`}]}}}async function tg(t,{baseName:e,filter:r={},sort:a=null,limit:s=100}){let i=(0,Je.join)(t,".lokus","bases",`${e}.json`);try{let c=await(0,se.readFile)(i,"utf-8"),p=JSON.parse(c).records||[];if(Object.keys(r).length>0&&(p=p.filter(d=>{for(let[g,k]of Object.entries(r))if(d[g]!==k)return!1;return!0})),a){let d=Object.keys(a)[0],g=a[d];p.sort((k,x)=>g==="asc"?k[d]>x[d]?1:-1:k[d]<x[d]?1:-1)}return p=p.slice(0,s),{content:[{type:"text",text:`**Query Results (${p.length} records):**

${p.map(d=>JSON.stringify(d,null,2)).join(`
---
`)}`}]}}catch(c){return{content:[{type:"text",text:`\u274C Query failed: ${c.message}`}]}}}async function rg(t,{baseName:e,recordId:r,updates:a}){let s=(0,Je.join)(t,".lokus","bases",`${e}.json`);try{let i=await(0,se.readFile)(s,"utf-8"),c=JSON.parse(i),u=c.records?.findIndex(p=>p.id===r);if(u===-1)throw new Error(`Record with ID ${r} not found`);return c.records[u]={...c.records[u],...a,id:r,modified:new Date().toISOString()},c.modified=new Date().toISOString(),await(0,se.writeFile)(s,JSON.stringify(c,null,2)),{content:[{type:"text",text:`\u2705 Record ${r} updated in base "${e}"`}]}}catch(i){return{content:[{type:"text",text:`\u274C Update failed: ${i.message}`}]}}}async function ng(t,{baseName:e,recordId:r}){let a=(0,Je.join)(t,".lokus","bases",`${e}.json`);try{let s=await(0,se.readFile)(a,"utf-8"),i=JSON.parse(s),c=i.records?.length||0;if(i.records=i.records?.filter(u=>u.id!==r)||[],i.records.length===c)throw new Error(`Record with ID ${r} not found`);return i.modified=new Date().toISOString(),await(0,se.writeFile)(a,JSON.stringify(i,null,2)),{content:[{type:"text",text:`\u2705 Record ${r} deleted from base "${e}"`}]}}catch(s){return{content:[{type:"text",text:`\u274C Delete failed: ${s.message}`}]}}}async function ag(t,e){let r=(0,Je.join)(t,".lokus","bases",`${e}.json`);try{let a=await(0,se.readFile)(r,"utf-8"),s=JSON.parse(a),i={recordCount:s.records?.length||0,fieldCount:s.schema?.fields?.length||0,created:s.created,modified:s.modified,sizeBytes:Buffer.byteLength(a,"utf8"),fieldTypes:{}};if(s.schema?.fields)for(let c of s.schema.fields)i.fieldTypes[c.type]=(i.fieldTypes[c.type]||0)+1;if(s.records?.length>0){i.fillRates={};for(let c of s.schema?.fields||[]){let u=s.records.filter(p=>p[c.name]!=null).length;i.fillRates[c.name]=`${(u/s.records.length*100).toFixed(1)}%`}}return{content:[{type:"text",text:`**Base Statistics: ${e}**

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
`)}`:""}`}]}}catch(a){return{content:[{type:"text",text:`\u274C Failed to get stats: ${a.message}`}]}}}var Te=require("fs/promises"),xt=require("path"),Uo=[{name:"list_canvases",description:"List all canvases in the workspace",inputSchema:{type:"object",properties:{}}},{name:"get_canvas",description:"Get canvas data including shapes and connections",inputSchema:{type:"object",properties:{canvasId:{type:"string",description:"Canvas ID or name"}},required:["canvasId"]}},{name:"create_canvas",description:"Create a new canvas",inputSchema:{type:"object",properties:{name:{type:"string",description:"Name for the canvas"},description:{type:"string",description:"Canvas description"}},required:["name"]}},{name:"add_canvas_shape",description:"Add a shape to canvas (text, rectangle, arrow, etc)",inputSchema:{type:"object",properties:{canvasId:{type:"string",description:"Canvas ID"},shape:{type:"object",description:"Shape data (type, position, content, style)"}},required:["canvasId","shape"]}},{name:"get_canvas_connections",description:"Get all connections/arrows between shapes",inputSchema:{type:"object",properties:{canvasId:{type:"string",description:"Canvas ID"}},required:["canvasId"]}},{name:"export_canvas",description:"Export canvas as JSON or markdown",inputSchema:{type:"object",properties:{canvasId:{type:"string",description:"Canvas ID"},format:{type:"string",enum:["json","markdown","mermaid"],description:"Export format"}},required:["canvasId"]}}];async function du(t,e,r,a){switch(t){case"list_canvases":return await sg(r);case"get_canvas":return await og(r,e.canvasId);case"create_canvas":return await ig(r,e);case"add_canvas_shape":return await cg(r,e);case"get_canvas_connections":return await lg(r,e.canvasId);case"export_canvas":return await ug(r,e);default:throw new Error(`Unknown canvas tool: ${t}`)}}async function sg(t){let e=(0,xt.join)(t,".lokus","canvas");try{let r=await(0,Te.readdir)(e,{withFileTypes:!0}),a=[];for(let s of r)if(s.isFile()&&s.name.endsWith(".json")){let i=s.name.replace(".json","");try{let c=await(0,Te.readFile)((0,xt.join)(e,s.name),"utf-8"),u=JSON.parse(c);a.push({id:i,name:u.name||i,shapeCount:u.shapes?.length||0,created:u.created,modified:u.modified})}catch{}}return{content:[{type:"text",text:`**Canvases in Workspace:**

${a.length>0?a.map(s=>`\u{1F3A8} **${s.name}**
  - ID: ${s.id}
  - Shapes: ${s.shapeCount}
  - Modified: ${s.modified||"Unknown"}`).join(`

`):"No canvases found"}`}]}}catch{return{content:[{type:"text",text:"Canvas feature not configured in this workspace"}]}}}async function og(t,e){let r=(0,xt.join)(t,".lokus","canvas",`${e}.json`);try{let a=await(0,Te.readFile)(r,"utf-8"),s=JSON.parse(a),i=s.shapes||[],c=i.filter(p=>p.type==="arrow"||p.type==="line"),u=i.filter(p=>p.type!=="arrow"&&p.type!=="line");return{content:[{type:"text",text:`**Canvas: ${s.name||e}**

\u{1F4CA} Nodes: ${u.length}
\u{1F517} Connections: ${c.length}
\u{1F4C5} Modified: ${s.modified||"Unknown"}

**Shapes:**
${u.slice(0,10).map(p=>`- ${p.type}: ${p.text||p.label||"No text"}`).join(`
`)}
${u.length>10?`... and ${u.length-10} more shapes`:""}

**Connections:**
${c.slice(0,5).map(p=>`- ${p.from||"unknown"} \u2192 ${p.to||"unknown"}`).join(`
`)}
${c.length>5?`... and ${c.length-5} more connections`:""}`}]}}catch{return{content:[{type:"text",text:`Canvas "${e}" not found`}]}}}async function ig(t,{name:e,description:r}){let a=(0,xt.join)(t,".lokus","canvas");await(0,Te.mkdir)(a,{recursive:!0});let s=e.toLowerCase().replace(/[^a-z0-9]/g,"-"),i=(0,xt.join)(a,`${s}.json`),c={id:s,name:e,description:r,shapes:[],viewport:{x:0,y:0,zoom:1},created:new Date().toISOString(),modified:new Date().toISOString()};return await(0,Te.writeFile)(i,JSON.stringify(c,null,2)),{content:[{type:"text",text:`\u2705 Canvas "${e}" created with ID: ${s}`}]}}async function cg(t,{canvasId:e,shape:r}){let a=(0,xt.join)(t,".lokus","canvas",`${e}.json`);try{let s=await(0,Te.readFile)(a,"utf-8"),i=JSON.parse(s),c={id:r.id||Date.now().toString(36)+Math.random().toString(36).substr(2),type:r.type||"rectangle",x:r.x||100,y:r.y||100,width:r.width||200,height:r.height||100,text:r.text||"",style:r.style||{},...r};return i.shapes=i.shapes||[],i.shapes.push(c),i.modified=new Date().toISOString(),await(0,Te.writeFile)(a,JSON.stringify(i,null,2)),{content:[{type:"text",text:`\u2705 Shape added to canvas "${e}" with ID: ${c.id}`}]}}catch(s){return{content:[{type:"text",text:`\u274C Failed to add shape: ${s.message}`}]}}}async function lg(t,e){let r=(0,xt.join)(t,".lokus","canvas",`${e}.json`);try{let a=await(0,Te.readFile)(r,"utf-8"),i=(JSON.parse(a).shapes||[]).filter(u=>u.type==="arrow"||u.type==="line"||u.type==="connection"),c={};return i.forEach(u=>{let p=u.from||u.startId||"unknown",d=u.to||u.endId||"unknown";c[p]||(c[p]=[]),c[p].push(d)}),{content:[{type:"text",text:`**Canvas Connections:**

${Object.entries(c).map(([u,p])=>`\u{1F4CD} ${u}
${p.map(d=>`  \u2192 ${d}`).join(`
`)}`).join(`

`)}

Total connections: ${i.length}`}]}}catch(a){return{content:[{type:"text",text:`\u274C Failed to get connections: ${a.message}`}]}}}async function ug(t,{canvasId:e,format:r="markdown"}){let a=(0,xt.join)(t,".lokus","canvas",`${e}.json`);try{let s=await(0,Te.readFile)(a,"utf-8"),i=JSON.parse(s),c="";switch(r){case"markdown":c=`# ${i.name||e}

`,c+=i.description?`${i.description}

`:"",(i.shapes||[]).filter(d=>d.type!=="arrow"&&d.type!=="line").forEach(d=>{c+=`## ${d.text||d.label||"Node"}

`,d.description&&(c+=`${d.description}

`)});break;case"mermaid":c=`graph TD
`,(i.shapes||[]).forEach(d=>{d.type==="arrow"||d.type==="connection"?c+=`  ${d.from||d.startId} --> ${d.to||d.endId}
`:d.text&&(c+=`  ${d.id}["${d.text}"]
`)});break;case"json":default:c=JSON.stringify(i,null,2);break}return{content:[{type:"text",text:c}]}}catch(s){return{content:[{type:"text",text:`\u274C Failed to export canvas: ${s.message}`}]}}}var ce=require("fs/promises"),st=require("path"),zo=[{name:"list_boards",description:"List all kanban boards in the workspace",inputSchema:{type:"object",properties:{}}},{name:"get_board",description:"Get kanban board with columns and cards",inputSchema:{type:"object",properties:{boardId:{type:"string",description:"Board ID or name"}},required:["boardId"]}},{name:"create_board",description:"Create a new kanban board. Supports automatic date-based column creation.",inputSchema:{type:"object",properties:{name:{type:"string",description:"Board name"},columns:{type:"array",items:{type:"string"},description:"Column names (e.g., ['To Do', 'In Progress', 'Done'])"},dateType:{type:"string",enum:["monthly","quarterly","yearly","custom"],description:"Type of date-based columns to create (optional)"},startDate:{type:"string",description:"Start date for date-based columns (YYYY-MM-DD format, optional)"},endDate:{type:"string",description:"End date for date-based columns (YYYY-MM-DD format, optional)"},additionalColumns:{type:"array",items:{type:"string"},description:"Additional status columns (e.g., ['Applied', 'Accepted', 'Rejected'])"}},required:["name"]}},{name:"add_card",description:"Add a card to a kanban column",inputSchema:{type:"object",properties:{boardId:{type:"string",description:"Board ID"},column:{type:"string",description:"Column name"},card:{type:"object",description:"Card data (title, description, tags, etc)"}},required:["boardId","column","card"]}},{name:"move_card",description:"Move a card between columns",inputSchema:{type:"object",properties:{boardId:{type:"string",description:"Board ID"},cardId:{type:"string",description:"Card ID"},fromColumn:{type:"string",description:"Source column"},toColumn:{type:"string",description:"Target column"}},required:["boardId","cardId","fromColumn","toColumn"]}},{name:"update_card",description:"Update card properties",inputSchema:{type:"object",properties:{boardId:{type:"string",description:"Board ID"},cardId:{type:"string",description:"Card ID"},updates:{type:"object",description:"Fields to update"}},required:["boardId","cardId","updates"]}},{name:"get_board_stats",description:"Get statistics for a kanban board",inputSchema:{type:"object",properties:{boardId:{type:"string",description:"Board ID"}},required:["boardId"]}}];async function fu(t,e,r,a){switch(t){case"list_boards":return await dg(r);case"get_board":return await fg(r,e.boardId);case"create_board":return await pg(r,e);case"add_card":return await mg(r,e);case"move_card":return await gg(r,e);case"update_card":return await yg(r,e);case"get_board_stats":return await bg(r,e.boardId);default:throw new Error(`Unknown kanban tool: ${t}`)}}async function dg(t){let e=(0,st.join)(t,".lokus","kanban");try{let r=await(0,ce.readdir)(e,{withFileTypes:!0}),a=[];for(let s of r)if(s.isFile()&&s.name.endsWith(".json")){let i=s.name.replace(".json","");try{let c=await(0,ce.readFile)((0,st.join)(e,s.name),"utf-8"),u=JSON.parse(c),p=Object.values(u.columns||{}).reduce((d,g)=>d+(g.cards?.length||0),0);a.push({id:i,name:u.name||i,columns:Object.keys(u.columns||{}).length,cards:p,modified:u.modified})}catch{}}return{content:[{type:"text",text:`**Kanban Boards:**

${a.length>0?a.map(s=>`\u{1F4CB} **${s.name}**
  - ID: ${s.id}
  - Columns: ${s.columns}
  - Cards: ${s.cards}
  - Modified: ${s.modified||"Unknown"}`).join(`

`):"No kanban boards found"}`}]}}catch{return{content:[{type:"text",text:"Kanban feature not configured in this workspace"}]}}}async function fg(t,e){let r=(0,st.join)(t,".lokus","kanban",`${e}.json`);try{let a=await(0,ce.readFile)(r,"utf-8"),s=JSON.parse(a),i=`**Kanban Board: ${s.name||e}**

`;for(let[c,u]of Object.entries(s.columns||{})){let p=u.cards||[];i+=`**${c}** (${p.length} cards)
`,p.slice(0,5).forEach(d=>{i+=`  \u2022 ${d.title}`,d.tags?.length&&(i+=` [${d.tags.join(", ")}]`),d.assignee&&(i+=` @${d.assignee}`),i+=`
`}),p.length>5&&(i+=`  ... and ${p.length-5} more cards
`),i+=`
`}return{content:[{type:"text",text:i}]}}catch{return{content:[{type:"text",text:`Board "${e}" not found`}]}}}async function pg(t,{name:e,columns:r,dateType:a,startDate:s,endDate:i,additionalColumns:c=[]}){let u=(0,st.join)(t,".lokus","kanban");await(0,ce.mkdir)(u,{recursive:!0});let p=e.toLowerCase().replace(/[^a-z0-9]/g,"-"),d=(0,st.join)(u,`${p}.json`),g=new Date().toISOString(),k={version:"1.0.0",name:e,columns:{},settings:{card_template:{},automations:[],custom_fields:[]},metadata:{created:g,modified:g,created_with:"Lokus MCP"}},x=r||["To Do","In Progress","Done"];a&&s&&(x=hg(a,s,i),c.length>0&&(x=[...x,...c]));for(let P=0;P<x.length;P++){let v=x[P],z=v.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"");k.columns[z]={name:v,order:P,cards:[]}}return await(0,ce.writeFile)(d,JSON.stringify(k,null,2)),{content:[{type:"text",text:`\u2705 Kanban board "${e}" created with ${Object.keys(k.columns).length} columns:
${x.map(P=>`  - ${P}`).join(`
`)}`}]}}function hg(t,e,r){let a=[],s=new Date(e),i=r?new Date(r):new Date(s.getFullYear()+1,s.getMonth(),1);if(t==="monthly"){let c=new Date(s);for(;c<=i;){let u=c.toLocaleDateString("en-US",{month:"long",year:"numeric"});a.push(`\u{1F4C5} ${u}`),c.setMonth(c.getMonth()+1)}}else if(t==="quarterly"){let c=new Date(s),u=Math.floor(c.getMonth()/3)+1;for(;c<=i;)a.push(`\u{1F4C5} Q${u} ${c.getFullYear()}`),c.setMonth(c.getMonth()+3),u=Math.floor(c.getMonth()/3)+1}else if(t==="yearly"){let c=s.getFullYear(),u=i.getFullYear();for(;c<=u;)a.push(`\u{1F4C5} ${c}`),c++}return a}async function mg(t,{boardId:e,column:r,card:a}){let s=(0,st.join)(t,".lokus","kanban",`${e}.json`);try{let i=await(0,ce.readFile)(s,"utf-8"),c=JSON.parse(i);if(!c.columns[r])throw new Error(`Column "${r}" not found`);let u=new Date().toISOString(),p={id:a.id||Date.now().toString(36)+Math.random().toString(36).substr(2),title:a.title||"Untitled",description:a.description||"",tags:a.tags||[],assignee:a.assignee||null,priority:a.priority||"normal",due_date:a.due_date||a.dueDate||null,linked_notes:a.linked_notes||[],checklist:a.checklist||[],created:u,modified:u};return c.columns[r].cards=c.columns[r].cards||[],c.columns[r].cards.push(p),c.metadata.modified=u,await(0,ce.writeFile)(s,JSON.stringify(c,null,2)),{content:[{type:"text",text:`\u2705 Card "${p.title}" added to column "${r}" with ID: ${p.id}`}]}}catch(i){return{content:[{type:"text",text:`\u274C Failed to add card: ${i.message}`}]}}}async function gg(t,{boardId:e,cardId:r,fromColumn:a,toColumn:s}){let i=(0,st.join)(t,".lokus","kanban",`${e}.json`);try{let c=await(0,ce.readFile)(i,"utf-8"),u=JSON.parse(c);if(!u.columns[a]||!u.columns[s])throw new Error("Column not found");let p=u.columns[a].cards?.findIndex(g=>g.id===r);if(p===-1)throw new Error(`Card ${r} not found in column ${a}`);let[d]=u.columns[a].cards.splice(p,1);return d.modified=new Date().toISOString(),u.columns[s].cards=u.columns[s].cards||[],u.columns[s].cards.push(d),u.metadata.modified=new Date().toISOString(),await(0,ce.writeFile)(i,JSON.stringify(u,null,2)),{content:[{type:"text",text:`\u2705 Card "${d.title}" moved from "${a}" to "${s}"`}]}}catch(c){return{content:[{type:"text",text:`\u274C Failed to move card: ${c.message}`}]}}}async function yg(t,{boardId:e,cardId:r,updates:a}){let s=(0,st.join)(t,".lokus","kanban",`${e}.json`);try{let i=await(0,ce.readFile)(s,"utf-8"),c=JSON.parse(i),u=!1;for(let p of Object.values(c.columns||{})){let d=p.cards?.findIndex(g=>g.id===r);if(d!==-1){p.cards[d]={...p.cards[d],...a,id:r,modified:new Date().toISOString()},u=!0;break}}if(!u)throw new Error(`Card ${r} not found`);return c.metadata.modified=new Date().toISOString(),await(0,ce.writeFile)(s,JSON.stringify(c,null,2)),{content:[{type:"text",text:`\u2705 Card ${r} updated successfully`}]}}catch(i){return{content:[{type:"text",text:`\u274C Failed to update card: ${i.message}`}]}}}async function bg(t,e){let r=(0,st.join)(t,".lokus","kanban",`${e}.json`);try{let a=await(0,ce.readFile)(r,"utf-8"),s=JSON.parse(a),i={columnCount:Object.keys(s.columns||{}).length,totalCards:0,cardsByColumn:{},cardsByPriority:{high:0,normal:0,low:0},cardsByAssignee:{},overdueTasks:0},c=new Date;for(let[u,p]of Object.entries(s.columns||{})){let d=p.cards||[];i.totalCards+=d.length,i.cardsByColumn[u]=d.length;for(let g of d)i.cardsByPriority[g.priority||"normal"]++,g.assignee&&(i.cardsByAssignee[g.assignee]=(i.cardsByAssignee[g.assignee]||0)+1),g.dueDate&&new Date(g.dueDate)<c&&i.overdueTasks++}return{content:[{type:"text",text:`**Board Statistics: ${s.name||e}**

\u{1F4CA} Total Cards: ${i.totalCards}
\u{1F4CB} Columns: ${i.columnCount}
\u26A0\uFE0F Overdue Tasks: ${i.overdueTasks}

**Cards by Column:**
${Object.entries(i.cardsByColumn).map(([u,p])=>`  - ${u}: ${p}`).join(`
`)}

**Cards by Priority:**
  - High: ${i.cardsByPriority.high}
  - Normal: ${i.cardsByPriority.normal}
  - Low: ${i.cardsByPriority.low}

**Cards by Assignee:**
${Object.entries(i.cardsByAssignee).map(([u,p])=>`  - @${u}: ${p}`).join(`
`)||"  No assignments"}`}]}}catch(a){return{content:[{type:"text",text:`\u274C Failed to get stats: ${a.message}`}]}}}var as=require("fs/promises"),Sr=require("path"),Ho=[{name:"get_graph_overview",description:"Get overview of the knowledge graph",inputSchema:{type:"object",properties:{}}},{name:"get_node_connections",description:"Get all connections for a specific node (note)",inputSchema:{type:"object",properties:{nodeName:{type:"string",description:"Name of the node/note"}},required:["nodeName"]}},{name:"find_path",description:"Find path between two nodes in the graph",inputSchema:{type:"object",properties:{from:{type:"string",description:"Starting node"},to:{type:"string",description:"Target node"}},required:["from","to"]}},{name:"get_orphan_notes",description:"Find notes with no connections (orphans)",inputSchema:{type:"object",properties:{}}},{name:"get_hub_notes",description:"Find most connected notes (hubs)",inputSchema:{type:"object",properties:{limit:{type:"number",description:"Number of top hubs to return"}}}},{name:"get_clusters",description:"Identify clusters of related notes",inputSchema:{type:"object",properties:{}}}];async function pu(t,e,r,a){switch(t){case"get_graph_overview":return await wg(r);case"get_node_connections":return await _g(r,e.nodeName);case"find_path":return await kg(r,e.from,e.to);case"get_orphan_notes":return await Sg(r);case"get_hub_notes":return await xg(r,e.limit||10);case"get_clusters":return await vg(r);default:throw new Error(`Unknown graph tool: ${t}`)}}async function rn(t){let e={nodes:new Set,edges:[],adjacencyList:{}};async function r(a){let s=await(0,as.readdir)(a,{withFileTypes:!0});for(let i of s){if(i.name.startsWith("."))continue;let c=(0,Sr.join)(a,i.name);if(i.isDirectory())await r(c);else if(i.isFile()&&[".md",".txt"].includes((0,Sr.extname)(i.name))){let u=(0,Sr.basename)(i.name,(0,Sr.extname)(i.name));e.nodes.add(u);try{let g=((await(0,as.readFile)(c,"utf-8")).match(/\[\[([^\]]+)\]\]/g)||[]).map(k=>k.slice(2,-2));e.adjacencyList[u]=g;for(let k of g)e.edges.push({from:u,to:k})}catch{}}}}return await r(t),e}async function wg(t){let e=await rn(t),r={totalNodes:e.nodes.size,totalEdges:e.edges.length,avgConnections:e.edges.length/Math.max(e.nodes.size,1),orphanCount:0,hubCount:0};for(let a of e.nodes){let s=(e.adjacencyList[a]||[]).length,i=e.edges.filter(u=>u.to===a).length,c=s+i;c===0&&r.orphanCount++,c>5&&r.hubCount++}return{content:[{type:"text",text:`**Knowledge Graph Overview**

\u{1F535} Total Notes: ${r.totalNodes}
\u{1F517} Total Connections: ${r.totalEdges}
\u{1F4CA} Avg Connections: ${r.avgConnections.toFixed(2)}
\u{1F3DD}\uFE0F Orphan Notes: ${r.orphanCount}
\u{1F31F} Hub Notes (>5 connections): ${r.hubCount}

The knowledge graph shows how your notes are interconnected through wiki links.`}]}}async function _g(t,e){let r=await rn(t),a=r.adjacencyList[e]||[],s=r.edges.filter(c=>c.to===e).map(c=>c.from),i=new Set([...a,...s]);return{content:[{type:"text",text:`**Connections for "${e}"**

**Outgoing Links (${a.length}):**
${a.map(c=>`  \u2192 ${c}`).join(`
`)||"  None"}

**Incoming Links (${s.length}):**
${s.map(c=>`  \u2190 ${c}`).join(`
`)||"  None"}

**All Related Notes (${i.size}):**
${Array.from(i).map(c=>`  \u2022 ${c}`).join(`
`)||"  None"}`}]}}async function kg(t,e,r){let a=await rn(t),s=[[e]],i=new Set([e]);for(;s.length>0;){let c=s.shift(),u=c[c.length-1];if(u===r)return{content:[{type:"text",text:`**Path from "${e}" to "${r}":**

${c.map((d,g)=>g===0?`\u{1F7E2} ${d}`:g===c.length-1?`\u{1F534} ${d}`:`\u26AA ${d}`).join(" \u2192 ")}

Path length: ${c.length-1} steps`}]};let p=a.adjacencyList[u]||[];for(let d of p)i.has(d)||(i.add(d),s.push([...c,d]))}return{content:[{type:"text",text:`No path found from "${e}" to "${r}". These notes are not connected in the knowledge graph.`}]}}async function Sg(t){let e=await rn(t),r=[];for(let a of e.nodes){let s=(e.adjacencyList[a]||[]).length,i=e.edges.filter(c=>c.to===a).length;s===0&&i===0&&r.push(a)}return{content:[{type:"text",text:`**Orphan Notes (${r.length}):**

These notes have no connections to other notes:

${r.map(a=>`  \u2022 ${a}`).join(`
`)||"No orphan notes found!"}

Consider linking these notes to integrate them into your knowledge graph.`}]}}async function xg(t,e){let r=await rn(t),a={};for(let i of r.nodes){let c=(r.adjacencyList[i]||[]).length,u=r.edges.filter(p=>p.to===i).length;a[i]=c+u}let s=Object.entries(a).sort((i,c)=>c[1]-i[1]).slice(0,e);return{content:[{type:"text",text:`**Top ${e} Hub Notes:**

These notes are most connected in your knowledge graph:

${s.map(([i,c],u)=>`${u+1}. **${i}** - ${c} connections`).join(`
`)}

Hub notes are central to your knowledge structure and often represent key concepts.`}]}}async function vg(t){let e=await rn(t),r=new Set,a=[];function s(i,c){if(r.has(i))return;r.add(i),c.add(i);let u=e.adjacencyList[i]||[];for(let d of u)s(d,c);let p=e.edges.filter(d=>d.to===i).map(d=>d.from);for(let d of p)s(d,c)}for(let i of e.nodes)if(!r.has(i)){let c=new Set;s(i,c),c.size>1&&a.push(Array.from(c))}return a.sort((i,c)=>c.length-i.length),{content:[{type:"text",text:`**Knowledge Clusters (${a.length}):**

${a.slice(0,5).map((i,c)=>`**Cluster ${c+1}** (${i.length} notes):
${i.slice(0,10).map(u=>`  \u2022 ${u}`).join(`
`)}${i.length>10?`
  ... and ${i.length-10} more`:""}`).join(`

`)}${a.length>5?`

... and ${a.length-5} more clusters`:""}

Clusters represent groups of related notes that are interconnected.`}]}}var Ce=require("fs/promises"),xr=require("path"),Vo=[{name:"list_templates",description:"List all templates in the workspace",inputSchema:{type:"object",properties:{category:{type:"string",description:"Filter by category (optional)"}}}},{name:"create_template",description:"Create a new template with proper frontmatter. Templates support variables like {{date}}, {{time}}, {{cursor}}, {{title}}, and custom variables.",inputSchema:{type:"object",properties:{id:{type:"string",description:"Unique template ID (lowercase, hyphenated)"},name:{type:"string",description:"Display name for the template"},content:{type:"string",description:"Template content with variables (e.g., {{date}}, {{time}}, {{cursor}})"},category:{type:"string",description:"Category for organization (Personal, Work, Documentation, etc.)",default:"Personal"},tags:{type:"array",items:{type:"string"},description:"Tags for categorization"}},required:["id","name","content"]}},{name:"read_template",description:"Read a template's content and metadata",inputSchema:{type:"object",properties:{id:{type:"string",description:"Template ID"}},required:["id"]}},{name:"update_template",description:"Update an existing template",inputSchema:{type:"object",properties:{id:{type:"string",description:"Template ID"},name:{type:"string",description:"New name (optional)"},content:{type:"string",description:"New content (optional)"},category:{type:"string",description:"New category (optional)"},tags:{type:"array",items:{type:"string"},description:"New tags (optional)"}},required:["id"]}},{name:"delete_template",description:"Delete a template",inputSchema:{type:"object",properties:{id:{type:"string",description:"Template ID to delete"}},required:["id"]}}];async function hu(t,e,r,a){let s=(0,xr.join)(r,"templates");try{await(0,Ce.mkdir)(s,{recursive:!0})}catch{}switch(t){case"list_templates":return await Tg(s,e);case"create_template":return await Cg(s,e);case"read_template":return await Rg(s,e);case"update_template":return await Eg(s,e);case"delete_template":return await Ag(s,e);default:throw new Error(`Unknown template tool: ${t}`)}}async function Tg(t,e){try{let r=await(0,Ce.readdir)(t),a=[];for(let s of r)if(s.endsWith(".md"))try{let i=(0,xr.join)(t,s),c=await(0,Ce.readFile)(i,"utf-8"),u=Go(c,s);(!e.category||u.category===e.category)&&a.push({id:u.id,name:u.name,category:u.category,tags:u.tags,createdAt:u.createdAt,updatedAt:u.updatedAt})}catch{}return{content:[{type:"text",text:JSON.stringify({templates:a,total:a.length},null,2)}]}}catch(r){return{content:[{type:"text",text:`Error listing templates: ${r.message}`}],isError:!0}}}async function Cg(t,e){try{let{id:r,name:a,content:s,category:i="Personal",tags:c=[]}=e;if(!/^[a-z0-9-_]+$/.test(r))throw new Error("Template ID must be lowercase alphanumeric with hyphens/underscores");let u=`${r}.md`,p=(0,xr.join)(t,u),d=new Date().toISOString(),k=`---
${mu({id:r,name:a,category:i,tags:c,createdAt:d,updatedAt:d})}---

${s}`;return await(0,Ce.writeFile)(p,k,"utf-8"),{content:[{type:"text",text:`Template "${a}" created successfully!

ID: ${r}
File: ${p}

**Important**: The template has been created as a file, but to see it in the UI:
1. Open Template Manager in Lokus
2. Click the "Refresh" button
3. The template will now appear in the list

Alternatively, restart the Lokus app to load the new template.`}]}}catch(r){return{content:[{type:"text",text:`Error creating template: ${r.message}`}],isError:!0}}}async function Rg(t,e){try{let{id:r}=e,a=(0,xr.join)(t,`${r}.md`),s=await(0,Ce.readFile)(a,"utf-8"),i=Go(s,`${r}.md`);return{content:[{type:"text",text:JSON.stringify(i,null,2)}]}}catch(r){return{content:[{type:"text",text:`Error reading template: ${r.message}`}],isError:!0}}}async function Eg(t,e){try{let{id:r,name:a,content:s,category:i,tags:c}=e,u=(0,xr.join)(t,`${r}.md`),p=await(0,Ce.readFile)(u,"utf-8"),d=Go(p,`${r}.md`),g={id:d.id,name:a||d.name,content:s||d.content,category:i||d.category,tags:c||d.tags,createdAt:d.createdAt,updatedAt:new Date().toISOString()},x=`---
${mu(g)}---

${g.content}`;return await(0,Ce.writeFile)(u,x,"utf-8"),{content:[{type:"text",text:`Template "${g.name}" updated successfully!

**Remember to refresh the Template Manager** to see the changes.`}]}}catch(r){return{content:[{type:"text",text:`Error updating template: ${r.message}`}],isError:!0}}}async function Ag(t,e){try{let{id:r}=e,a=(0,xr.join)(t,`${r}.md`);return await(0,Ce.unlink)(a),{content:[{type:"text",text:`Template "${r}" deleted successfully!

**Remember to refresh the Template Manager** to see the changes.`}]}}catch(r){return{content:[{type:"text",text:`Error deleting template: ${r.message}`}],isError:!0}}}function mu(t){let e="";return e+=`id: ${t.id}
`,e+=`name: "${t.name}"
`,e+=`category: ${t.category}
`,t.tags&&t.tags.length>0?(e+=`tags:
`,t.tags.forEach(r=>{e+=`  - ${r}
`})):e+=`tags: []
`,e+=`createdAt: ${t.createdAt}
`,e+=`updatedAt: ${t.updatedAt}
`,e}function Go(t,e){let r=/^---\n([\s\S]*?)\n---\n([\s\S]*)$/,a=t.match(r);if(!a){let u=e.replace(".md","");return{id:u,name:u,content:t.trim(),category:"Personal",tags:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}}let s=a[1],i=a[2].trim(),c=$g(s);return{id:c.id||e.replace(".md",""),name:c.name||c.id||e.replace(".md",""),content:i,category:c.category||"Personal",tags:c.tags||[],createdAt:c.createdAt||new Date().toISOString(),updatedAt:c.updatedAt||new Date().toISOString()}}function $g(t){let e=t.split(`
`),r={},a=null,s=[];for(let i of e){let c=i.trim();if(!c)continue;if(c.startsWith("- ")){a&&s.push(c.substring(2).trim());continue}a&&s.length>0&&(r[a]=s,s=[],a=null);let u=c.indexOf(":");if(u>-1){let p=c.substring(0,u).trim(),d=c.substring(u+1).trim();d.startsWith('"')&&d.endsWith('"')&&(d=d.substring(1,d.length-1)),d==="[]"?r[p]=[]:d?r[p]=d:(a=p,s=[])}}return a&&s.length>0&&(r[a]=s),r}ls();var it=!1;try{let t=typeof window<"u"?window:void 0;it=!!(t&&(t.__TAURI_INTERNALS__&&typeof t.__TAURI_INTERNALS__.invoke=="function"||t.__TAURI_METADATA__||typeof navigator<"u"&&navigator.userAgent&&navigator.userAgent.includes("Tauri")))}catch{}var ri,ni,xu,vu,Tu,Cu;async function qn(){if(it&&!ri)try{({appDataDir:ri,join:ni}=await Promise.resolve().then(()=>(jn(),us))),{readTextFile:xu,writeTextFile:vu,mkdir:Tu,exists:Cu}=await Promise.resolve().then(()=>(ti(),ei))}catch(t){console.error("Failed to load Tauri modules:",t),it=!1}}var ku="Lokus",Su="config.json",Ru="lokus:config";async function ai(t){await qn(),it&&(await Cu(t)||await Tu(t,{recursive:!0}))}async function Dy(t){if(await qn(),!it)try{return JSON.parse(localStorage.getItem(Ru)||"null")}catch{return null}try{return JSON.parse(await xu(t))}catch{return null}}async function Ly(t,e){if(await qn(),!it){localStorage.setItem(Ru,JSON.stringify(e??{}));return}await vu(t,JSON.stringify(e,null,2))}async function si(){if(await qn(),!it)return ku;let t=await ni(await ri(),ku);return await ai(t),t}async function Eu(){return await qn(),it?await ni(await si(),Su):Su}async function oi(){let t=await Eu();if(it){let r=await si();await ai(r)}let e=await Dy(t);return e===null&&(e={}),e}async function Ny(t){let e=await Eu();if(it){let a=await si();await ai(a)}return await Ly(e,t)}async function Au(t){let r={...await oi(),...t};return await Ny(r),r}zn();var Rr=()=>{if(typeof window>"u")return"unknown";let t=window.navigator.platform?.toLowerCase()||"",e=window.navigator.userAgent?.toLowerCase()||"";return t.includes("win")||e.includes("windows")?"windows":t.includes("mac")||e.includes("mac")?"macos":t.includes("linux")||e.includes("linux")?"linux":"unknown"},Ze=()=>Rr()==="windows",Re=()=>Rr()==="macos",Bu=()=>Rr()==="linux",Uu=()=>Re()?"Cmd":"Ctrl";var zu=()=>Ze()?"\\":"/";var Qy={windows:{shellIntegration:!0,jumpList:!0,snapLayouts:!0,contextMenus:!0,registryAccess:!0,windowsNotifications:!0,darkModeSync:!0},macos:{quickLook:!0,touchBar:!0,continuity:!0,spotlight:!0,finderIntegration:!0,darkModeSync:!0},linux:{desktopIntegration:!0,contextMenus:!0,darkModeSync:!1}},Hu=t=>{let e=Rr();return Qy[e]?.[t]||!1},Ky=async()=>{switch(Rr()){case"windows":return Promise.resolve().then(()=>(ju(),Fu));case"macos":return Promise.resolve().then(()=>(qu(),Wu));default:return Promise.resolve().then(()=>(zn(),$u))}},li=null,Vu=async()=>(li||(li=await Ky()),li);var ui=class{constructor(){this.platform=Rr(),this.platformModule=null,this.initialized=!1}async initialize(){if(!this.initialized)try{this.platformModule=await Vu(),this.initialized=!0}catch(e){console.error("Failed to initialize platform service:",e)}}getPlatform(){return this.platform}isWindows(){return Ze()}isMacOS(){return Re()}isLinux(){return Bu()}hasCapability(e){return Hu(e)}async getShortcuts(){return await this.initialize(),this.platformModule?Ze()?this.platformModule.windowsShortcuts||{}:Re()?this.platformModule.macosShortcuts||{}:this.platformModule.windowsShortcuts||{}:{}}async getShortcut(e){return(await this.getShortcuts())[e]||null}formatShortcut(e){if(!e)return"";let r=e;return Re()&&(r=r.replace(/Cmd/g,"\u2318"),r=r.replace(/Option/g,"\u2325"),r=r.replace(/Shift/g,"\u21E7"),r=r.replace(/Control/g,"\u2303")),r}async getPathUtils(){return await this.initialize(),this.platformModule?Ze()?this.platformModule.windowsPathUtils||{}:Re()?this.platformModule.macosPathUtils||{}:this.platformModule||{}:{}}async normalizePath(e){let r=await this.getPathUtils();return Ze()&&r.normalizePath?r.normalizePath(e):e}getPathSeparator(){return zu()}async getValidation(){return await this.initialize(),this.platformModule?Ze()?this.platformModule.windowsValidation||{isValidFilename:()=>!0}:Re()?this.platformModule.macosValidation||{isValidFilename:()=>!0}:this.platformModule.validationUtils||{isValidFilename:()=>!0}:{isValidFilename:()=>!0}}async isValidFilename(e){return(await this.getValidation()).isValidFilename(e)}async getUIUtils(){return await this.initialize(),this.platformModule?Ze()?this.platformModule.windowsUI||{isDarkModeEnabled:()=>window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches}:Re()?this.platformModule.macosUI||{isDarkModeEnabled:()=>window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches}:{isDarkModeEnabled:()=>window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches}:{isDarkModeEnabled:()=>window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches}}async getPlatformStyles(){let e=await this.getUIUtils();return Ze()&&e.getWindowsStyles?e.getWindowsStyles():Re()&&e.getMacStyles?e.getMacStyles():{}}async getShellIntegration(){return await this.initialize(),this.platformModule?Ze()?this.platformModule.windowsShell||null:Re()&&this.platformModule.finderIntegration||null:null}async getContextMenuItems(){return(await this.getShellIntegration())?.getContextMenuItems?.()||[]}async getPlatformFeatures(){return await this.initialize(),Ze()?this.platformModule.windowsFeatureHelpers||this.platformModule.windowsFeaturesFromModule:Re()?this.platformModule.macosFeatures:{}}getModifierKey(){return Uu()}getModifierSymbol(){return Re()?"\u2318":"Ctrl"}convertShortcut(e){let r=e;return Re()?(r=r.replace(/Ctrl/g,"Cmd"),r=r.replace(/Alt/g,"Option")):(r=r.replace(/Cmd/g,"Ctrl"),r=r.replace(/Option/g,"Alt")),r}matchesShortcut(e,r){if(!this.platformModule)return!1;let a=this.platformModule?.keyboardUtils?.getNormalizedKey?.(e);if(!a)return!1;let s=this.convertShortcut(r);return a===s.replace(/\+/g,"+")}},ik=new ui;var ab=["--bg","--text","--panel","--border","--muted","--accent","--accent-fg","--tab-active","--task-todo","--task-progress","--task-urgent","--task-question","--task-completed","--task-cancelled","--task-delegated","--danger","--success","--warning","--info","--editor-placeholder","--app-bg","--app-text","--app-panel","--app-border","--app-muted","--app-accent","--app-accent-fg"],Xu={"--bg":"15 23 42","--text":"241 245 249","--panel":"30 41 59","--border":"51 65 85","--muted":"148 163 184","--accent":"139 92 246","--accent-fg":"255 255 255","--tab-active":"30 41 59","--task-todo":"107 114 128","--task-progress":"59 130 246","--task-urgent":"239 68 68","--task-question":"245 158 11","--task-completed":"16 185 129","--task-cancelled":"107 114 128","--task-delegated":"139 92 246","--danger":"239 68 68","--success":"16 185 129","--warning":"245 158 11","--info":"59 130 246","--editor-placeholder":"148 163 184"},sb=["dracula","nord","one-dark-pro","minimal-light","neon-dark"],yi={dracula:'{"name": "Dracula", "tokens": {"--bg": "#282a36", "--text": "#f8f8f2", "--panel": "#21222c", "--border": "#44475a", "--muted": "#6272a4", "--accent": "#bd93f9", "--accent-fg": "#ffffff", "--task-todo": "#6272a4", "--task-progress": "#8be9fd", "--task-urgent": "#ff5555", "--task-question": "#f1fa8c", "--task-completed": "#50fa7b", "--task-cancelled": "#6272a4", "--task-delegated": "#bd93f9", "--danger": "#ff5555", "--success": "#50fa7b", "--warning": "#f1fa8c", "--info": "#8be9fd", "--editor-placeholder": "#6272a4"}}',nord:'{"name": "Nord", "tokens": {"--bg": "#2E3440", "--text": "#ECEFF4", "--panel": "#3B4252", "--border": "#4C566A", "--muted": "#D8DEE9", "--accent": "#88C0D0", "--accent-fg": "#2E3440", "--task-todo": "#4C566A", "--task-progress": "#5E81AC", "--task-urgent": "#BF616A", "--task-question": "#EBCB8B", "--task-completed": "#A3BE8C", "--task-cancelled": "#4C566A", "--task-delegated": "#B48EAD", "--danger": "#BF616A", "--success": "#A3BE8C", "--warning": "#EBCB8B", "--info": "#5E81AC", "--editor-placeholder": "#4C566A"}}',"one-dark-pro":'{"name": "One Dark Pro", "tokens": {"--bg": "#282c34", "--text": "#abb2bf", "--panel": "#21252b", "--border": "#3a3f4b", "--muted": "#5c6370", "--accent": "#61afef", "--accent-fg": "#ffffff", "--task-todo": "#5c6370", "--task-progress": "#61afef", "--task-urgent": "#e06c75", "--task-question": "#d19a66", "--task-completed": "#98c379", "--task-cancelled": "#5c6370", "--task-delegated": "#c678dd", "--danger": "#e06c75", "--success": "#98c379", "--warning": "#d19a66", "--info": "#61afef", "--editor-placeholder": "#5c6370"}}',"minimal-light":'{"name": "Minimal Light", "tokens": {"--bg": "#ffffff", "--text": "#1a1a1a", "--panel": "#f8f9fa", "--border": "#e5e7eb", "--muted": "#6b7280", "--accent": "#3b82f6", "--accent-fg": "#ffffff", "--task-todo": "#9ca3af", "--task-progress": "#3b82f6", "--task-urgent": "#ef4444", "--task-question": "#f59e0b", "--task-completed": "#10b981", "--task-cancelled": "#9ca3af", "--task-delegated": "#8b5cf6", "--danger": "#ef4444", "--success": "#10b981", "--warning": "#f59e0b", "--info": "#3b82f6", "--editor-placeholder": "#9ca3af"}}',"neon-dark":'{"name": "Neon Dark", "tokens": {"--bg": "#0a0a0f", "--text": "#e2e8f0", "--panel": "#1a1a2e", "--border": "#16213e", "--muted": "#64748b", "--accent": "#00d4ff", "--accent-fg": "#0a0a0f", "--task-todo": "#64748b", "--task-progress": "#00d4ff", "--task-urgent": "#ff0080", "--task-question": "#ffea00", "--task-completed": "#00ff88", "--task-cancelled": "#64748b", "--task-delegated": "#8000ff", "--danger": "#ff0080", "--success": "#00ff88", "--warning": "#ffea00", "--info": "#00d4ff", "--editor-placeholder": "#64748b"}}'},we=!1;try{let t=typeof window<"u"?window:void 0;we=!!(t&&(t.__TAURI_INTERNALS__&&typeof t.__TAURI_INTERNALS__.invoke=="function"||t.__TAURI_METADATA__||typeof navigator<"u"&&navigator.userAgent&&navigator.userAgent.includes("Tauri")))}catch{}var ob,ib,cb,lb,ub,db,fb,ed=!1;async function Ar(){if(ed)return;let t=typeof process<"u"&&process.env.NODE_ENV==="test";if(we||t)try{({join:ob,appDataDir:db}=await Promise.resolve().then(()=>(jn(),us))),{exists:ib,readDir:cb,readTextFile:lb,writeTextFile:ub,mkdir:fb}=await Promise.resolve().then(()=>(ti(),ei)),ed=!0,t&&(we=!0)}catch{t||(we=!1)}}function pb(t){if(typeof t!="string")return t;if(t=t.trim(),t.startsWith("#")){let e=t.replace("#","");if(!/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(e))return console.warn(`Invalid hex color: ${t}`),t;let r=e.length===3?e.split("").map(s=>s+s).join(""):e,a=parseInt(r,16);return`${a>>16&255} ${a>>8&255} ${a&255}`}return t}async function hb(t){if(!t||typeof t!="object"){console.warn("applyTokens called with invalid tokens:",t);return}let e=document.documentElement,r={};for(let[a,s]of Object.entries(t)){if(a.startsWith("--app-")){let i=a.replace("--app-","--");r[i]=s}r[a]=s}for(let a of ab){let s=r[a];if(s){let i=pb(s);e.style.setProperty(a,i)}else e.style.removeProperty(a)}if(we)try{let{invoke:a}=await Promise.resolve().then(()=>(ot(),Jo)),{getCurrentWindow:s}=await Promise.resolve().then(()=>(Ku(),Qu)),i=r["--bg"]||"15 23 42",c=document.documentElement.classList.contains("dark")||window.matchMedia("(prefers-color-scheme: dark)").matches;await a("sync_window_theme",{isDark:c,bgColor:i})}catch(a){console.debug("Window theme sync not available:",a)}}async function mb(t){try{await Fn("theme:apply",t)}catch{try{window.dispatchEvent(new CustomEvent("theme:apply",{detail:t}))}catch{}}}async function Zn(t){if(!t)return null;if(await Ar(),yi[t])try{return JSON.parse(yi[t])}catch(e){console.error(`Failed to parse built-in theme ${t}:`,e)}if(we)try{return await $r(),{tokens:await Tt("get_theme_tokens",{themeId:t})}}catch(e){console.error(`Failed to load theme ${t} from backend:`,e)}return null}async function td(){let t=new Map;for(let e of sb)try{let r=JSON.parse(yi[e]);t.set(e,{id:e,name:r.name})}catch{t.set(e,{id:e,name:e})}if(we)try{let e=await gb();for(let r of e){let a=r.name.toLowerCase().replace(/[^a-z0-9_-]/g,"_");t.set(a,{id:a,name:r.name})}}catch(e){console.error("Failed to load custom themes:",e)}return Array.from(t.values())}async function rd(){return{theme:(await oi()).theme||null}}async function nd(t){try{await Au({theme:t})}catch{return}let r=(await Zn(t))?.tokens||Xu;r={...Xu,...r},await hb(r),await mb({tokens:r,visuals:{theme:t}})}var Tt;async function $r(){Tt||we&&(Tt=(await Promise.resolve().then(()=>(ot(),Jo))).invoke)}async function ad(t,e=!1){if(await Ar(),await $r(),!we)throw new Error("Theme import only available in desktop app");return await Tt("import_theme_file",{filePath:t,overwrite:e})}async function sd(t){if(await Ar(),await $r(),!we)throw new Error("Theme validation only available in desktop app");return await Tt("validate_theme_file",{filePath:t})}async function od(t,e){if(await Ar(),await $r(),!we)throw new Error("Theme export only available in desktop app");await Tt("export_theme",{themeId:t,exportPath:e})}async function id(t){if(await Ar(),await $r(),!we)throw new Error("Theme deletion only available in desktop app");await Tt("delete_custom_theme",{themeId:t})}async function gb(){return await Ar(),await $r(),we?await Tt("list_custom_themes"):[]}async function bi(t,e){if(await Ar(),await $r(),!we)throw new Error("Theme saving only available in desktop app");await Tt("save_theme_tokens",{themeId:t,tokens:e})}var bb={"--bg":"Background color (hex or RGB)","--text":"Primary text color","--panel":"Panel/sidebar background","--border":"Border color","--muted":"Muted/secondary text","--accent":"Accent/highlight color","--accent-fg":"Foreground color for accent (text on accent background)","--tab-active":"Active tab background","--task-todo":"Todo task color","--task-progress":"In-progress task color","--task-urgent":"Urgent task color","--task-question":"Question task color","--task-completed":"Completed task color","--task-cancelled":"Cancelled task color","--task-delegated":"Delegated task color","--danger":"Danger/error color","--success":"Success color","--warning":"Warning color","--info":"Info color","--editor-placeholder":"Editor placeholder text color"};async function wb(){try{let t=await td();return{themes:t,count:t.length,builtIn:["dracula","nord","one-dark-pro","minimal-light","neon-dark"]}}catch(t){throw new Error(`Failed to list themes: ${t.message}`)}}async function _b(t){try{let e=await Zn(t);if(!e)throw new Error(`Theme "${t}" not found`);return{id:t,name:e.name||t,tokens:e.tokens,tokenDescriptions:bb}}catch(e){throw new Error(`Failed to get theme: ${e.message}`)}}async function kb(t,e){if(!t||typeof t!="string")throw new Error("Theme name is required");if(!e||typeof e!="object")throw new Error("Theme tokens object is required");let a=["--bg","--text","--panel","--border","--muted","--accent","--accent-fg"].filter(i=>!e[i]);if(a.length>0)throw new Error(`Missing required tokens: ${a.join(", ")}`);for(let[i,c]of Object.entries(e)){if(typeof c!="string")throw new Error(`Invalid token value for ${i}: must be a string`);let u=/^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/.test(c.trim()),p=/^\d+\s+\d+\s+\d+$/.test(c.trim());if(!u&&!p)throw new Error(`Invalid color format for ${i}: "${c}". Use hex (#282a36) or RGB (40 42 54)`)}let s=t.toLowerCase().replace(/[^a-z0-9_-]/g,"_");try{return await bi(s,e),{id:s,name:t,tokens:e,message:`Theme "${t}" created successfully`}}catch(i){throw new Error(`Failed to create theme: ${i.message}`)}}async function Sb(t,e){if(!t||typeof t!="string")throw new Error("Theme ID is required");if(!e||typeof e!="object")throw new Error("Theme tokens object is required");let r=await Zn(t);if(!r)throw new Error(`Theme "${t}" not found`);let a={...r.tokens,...e};try{return await bi(t,a),{id:t,tokens:a,message:`Theme "${t}" updated successfully`}}catch(s){throw new Error(`Failed to update theme: ${s.message}`)}}async function xb(t){if(!t||typeof t!="string")throw new Error("Theme ID is required");if(["dracula","nord","one-dark-pro","minimal-light","neon-dark"].includes(t))throw new Error(`Cannot delete built-in theme "${t}"`);try{return await id(t),{id:t,message:`Theme "${t}" deleted successfully`}}catch(r){throw new Error(`Failed to delete theme: ${r.message}`)}}async function vb(t){if(!t||typeof t!="string")throw new Error("Theme ID is required");try{return await nd(t),{id:t,message:`Theme "${t}" applied successfully`}}catch(e){throw new Error(`Failed to apply theme: ${e.message}`)}}async function Tb(t,e){if(!t||typeof t!="string")throw new Error("Theme ID is required");if(!e||typeof e!="string")throw new Error("Export path is required");try{return await od(t,e),{id:t,path:e,message:`Theme "${t}" exported to ${e}`}}catch(r){throw new Error(`Failed to export theme: ${r.message}`)}}async function Cb(t,e=!1){if(!t||typeof t!="string")throw new Error("File path is required");try{let r=await sd(t);if(!r.valid)throw new Error(`Invalid theme file: ${r.error}`);let a=await ad(t,e);return{id:a,path:t,message:`Theme imported successfully as "${a}"`}}catch(r){throw new Error(`Failed to import theme: ${r.message}`)}}async function Rb(){try{let e=(await rd()).theme;if(!e)return{id:null,message:"No theme currently active"};let r=await Zn(e);return{id:e,name:r?.name||e,tokens:r?.tokens||{}}}catch(t){throw new Error(`Failed to get current theme: ${t.message}`)}}var wi=[{name:"list_themes",description:"List all available themes (built-in and custom)",inputSchema:{type:"object",properties:{},required:[]}},{name:"get_theme",description:"Get details of a specific theme including all token values",inputSchema:{type:"object",properties:{themeId:{type:"string",description:"Theme ID (e.g., 'dracula', 'nord', 'my-custom-theme')"}},required:["themeId"]}},{name:"create_theme",description:"Create a new custom theme with specified colors. Supports hex (#282a36) or RGB (40 42 54) format.",inputSchema:{type:"object",properties:{name:{type:"string",description:"Theme name (will be converted to safe ID)"},tokens:{type:"object",description:"Theme color tokens. Required: --bg, --text, --panel, --border, --muted, --accent, --accent-fg. Optional: --tab-active, --task-*, --danger, --success, --warning, --info, --editor-placeholder",properties:{"--bg":{type:"string",description:"Background color"},"--text":{type:"string",description:"Primary text color"},"--panel":{type:"string",description:"Panel background"},"--border":{type:"string",description:"Border color"},"--muted":{type:"string",description:"Muted text"},"--accent":{type:"string",description:"Accent color"},"--accent-fg":{type:"string",description:"Accent foreground"},"--tab-active":{type:"string",description:"Active tab background"},"--task-todo":{type:"string",description:"Todo task color"},"--task-progress":{type:"string",description:"In-progress task color"},"--task-urgent":{type:"string",description:"Urgent task color"},"--task-question":{type:"string",description:"Question task color"},"--task-completed":{type:"string",description:"Completed task color"},"--task-cancelled":{type:"string",description:"Cancelled task color"},"--task-delegated":{type:"string",description:"Delegated task color"},"--danger":{type:"string",description:"Danger/error color"},"--success":{type:"string",description:"Success color"},"--warning":{type:"string",description:"Warning color"},"--info":{type:"string",description:"Info color"},"--editor-placeholder":{type:"string",description:"Editor placeholder color"}},required:["--bg","--text","--panel","--border","--muted","--accent","--accent-fg"]}},required:["name","tokens"]}},{name:"update_theme",description:"Update an existing theme's tokens (partial updates allowed)",inputSchema:{type:"object",properties:{themeId:{type:"string",description:"Theme ID to update"},tokens:{type:"object",description:"Token values to update (only changed tokens needed)"}},required:["themeId","tokens"]}},{name:"delete_theme",description:"Delete a custom theme (cannot delete built-in themes)",inputSchema:{type:"object",properties:{themeId:{type:"string",description:"Theme ID to delete"}},required:["themeId"]}},{name:"apply_theme",description:"Apply a theme to the application",inputSchema:{type:"object",properties:{themeId:{type:"string",description:"Theme ID to apply"}},required:["themeId"]}},{name:"get_current_theme",description:"Get the currently active theme",inputSchema:{type:"object",properties:{},required:[]}},{name:"export_theme",description:"Export a theme to a JSON file",inputSchema:{type:"object",properties:{themeId:{type:"string",description:"Theme ID to export"},exportPath:{type:"string",description:"Full path where to save the theme file"}},required:["themeId","exportPath"]}},{name:"import_theme",description:"Import a theme from a JSON file",inputSchema:{type:"object",properties:{filePath:{type:"string",description:"Path to theme JSON file"},overwrite:{type:"boolean",description:"Overwrite existing theme if it exists",default:!1}},required:["filePath"]}}];async function cd(t,e){switch(t){case"list_themes":return await wb();case"get_theme":return await _b(e.themeId);case"create_theme":return await kb(e.name,e.tokens);case"update_theme":return await Sb(e.themeId,e.tokens);case"delete_theme":return await xb(e.themeId);case"apply_theme":return await vb(e.themeId);case"get_current_theme":return await Rb();case"export_theme":return await Tb(e.themeId,e.exportPath);case"import_theme":return await Cb(e.filePath,e.overwrite);default:throw new Error(`Unknown theme tool: ${t}`)}}var _i=[{uri:"lokus://markdown-syntax/overview",name:"Lokus Markdown Syntax Overview",description:"Complete guide to all supported markdown syntax in Lokus",mimeType:"text/markdown"},{uri:"lokus://markdown-syntax/callouts",name:"Callout Syntax",description:"How to create callouts/admonitions in Lokus",mimeType:"text/markdown"},{uri:"lokus://markdown-syntax/images",name:"Image Embedding Syntax",description:"How to embed images in Lokus notes",mimeType:"text/markdown"},{uri:"lokus://markdown-syntax/wiki-links",name:"Wiki Link Syntax",description:"How to create wiki-style links and embeds",mimeType:"text/markdown"},{uri:"lokus://markdown-syntax/math",name:"Math Equations (LaTeX/KaTeX)",description:"How to write inline and block math equations using LaTeX syntax",mimeType:"text/markdown"},{uri:"lokus://markdown-syntax/tables",name:"Tables",description:"How to create and format markdown tables",mimeType:"text/markdown"},{uri:"lokus://markdown-syntax/code",name:"Code Blocks",description:"How to add inline code and code blocks with syntax highlighting",mimeType:"text/markdown"},{uri:"lokus://markdown-syntax/lists",name:"Lists and Tasks",description:"How to create ordered lists, unordered lists, and task lists",mimeType:"text/markdown"},{uri:"lokus://markdown-syntax/formatting",name:"Text Formatting",description:"Bold, italic, strikethrough, highlights, superscript, subscript",mimeType:"text/markdown"},{uri:"lokus://markdown-syntax/diagrams",name:"Mermaid Diagrams",description:"How to create flowcharts, sequence diagrams, and more with Mermaid",mimeType:"text/markdown"}];async function ld(t){switch(t){case"lokus://markdown-syntax/overview":return Eb();case"lokus://markdown-syntax/callouts":return Ab();case"lokus://markdown-syntax/images":return $b();case"lokus://markdown-syntax/wiki-links":return Pb();case"lokus://markdown-syntax/math":return Ib();case"lokus://markdown-syntax/tables":return Ob();case"lokus://markdown-syntax/code":return Db();case"lokus://markdown-syntax/lists":return Lb();case"lokus://markdown-syntax/formatting":return Nb();case"lokus://markdown-syntax/diagrams":return Mb();default:throw new Error(`Unknown markdown syntax resource: ${t}`)}}function Eb(){return{contents:[{uri:"lokus://markdown-syntax/overview",mimeType:"text/markdown",text:`# Lokus Markdown Syntax Guide

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
`}]}}function Ab(){return{contents:[{uri:"lokus://markdown-syntax/callouts",mimeType:"text/markdown",text:`# Callout/Admonition Syntax

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
`}]}}function $b(){return{contents:[{uri:"lokus://markdown-syntax/images",mimeType:"text/markdown",text:`# Image Embedding Syntax

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
`}]}}function Pb(){return{contents:[{uri:"lokus://markdown-syntax/wiki-links",mimeType:"text/markdown",text:`# Wiki Link Syntax

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
`}]}}function Ib(){return{contents:[{uri:"lokus://markdown-syntax/math",mimeType:"text/markdown",text:`# Math Equations (LaTeX/KaTeX)

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
`}]}}function Ob(){return{contents:[{uri:"lokus://markdown-syntax/tables",mimeType:"text/markdown",text:`# Markdown Tables

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
`}]}}function Db(){return{contents:[{uri:"lokus://markdown-syntax/code",mimeType:"text/markdown",text:'# Code Syntax\n\n## Inline Code\n\nUse single backticks for inline code:\n\n```\nUse the `console.log()` function to print.\nThe `Array.map()` method is useful.\n```\n\nResult: Use the `console.log()` function to print.\n\n## Code Blocks\n\nUse triple backticks for code blocks:\n\n\\`\\`\\`\nfunction hello() {\n  console.log("Hello World");\n}\n\\`\\`\\`\n\n## Syntax Highlighting\n\nAdd language identifier after opening backticks:\n\n\\`\\`\\`javascript\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}\n\\`\\`\\`\n\n\\`\\`\\`python\ndef greet(name):\n    return f"Hello, {name}!"\n\\`\\`\\`\n\n\\`\\`\\`rust\nfn greet(name: &str) -> String {\n    format!("Hello, {}!", name)\n}\n\\`\\`\\`\n\n## Supported Languages\n\nCommon languages with syntax highlighting:\n- **JavaScript/TypeScript**: `javascript`, `typescript`, `js`, `ts`\n- **Python**: `python`, `py`\n- **Rust**: `rust`, `rs`\n- **Java**: `java`\n- **C/C++**: `c`, `cpp`, `c++`\n- **Go**: `go`\n- **Ruby**: `ruby`, `rb`\n- **PHP**: `php`\n- **Shell**: `bash`, `sh`, `shell`\n- **HTML**: `html`\n- **CSS**: `css`, `scss`, `sass`\n- **SQL**: `sql`\n- **JSON**: `json`\n- **YAML**: `yaml`, `yml`\n- **Markdown**: `markdown`, `md`\n\n## Examples\n\n**JavaScript:**\n\\`\\`\\`javascript\nconst users = [\'Alice\', \'Bob\', \'Charlie\'];\nusers.map(name => `Hello, ${name}!`);\n\\`\\`\\`\n\n**Python:**\n\\`\\`\\`python\nusers = [\'Alice\', \'Bob\', \'Charlie\']\ngreetings = [f"Hello, {name}!" for name in users]\n\\`\\`\\`\n\n**JSON:**\n\\`\\`\\`json\n{\n  "name": "John Doe",\n  "age": 30,\n  "email": "john@example.com"\n}\n\\`\\`\\`\n\n## Tips\n\n\u2705 **Do:**\n- Use specific language identifier for syntax highlighting\n- Keep code properly indented\n- Close code blocks with triple backticks\n\n\u274C **Don\'t:**\n- Forget closing backticks\n- Use 4-space indentation (use triple backticks instead)\n- Nest backticks incorrectly\n'}]}}function Lb(){return{contents:[{uri:"lokus://markdown-syntax/lists",mimeType:"text/markdown",text:`# Lists and Tasks

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
`}]}}function Nb(){return{contents:[{uri:"lokus://markdown-syntax/formatting",mimeType:"text/markdown",text:`# Text Formatting

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
`}]}}function Mb(){return{contents:[{uri:"lokus://markdown-syntax/diagrams",mimeType:"text/markdown",text:`# Mermaid Diagrams

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
`}]}}var Pr={defaultWorkspace:(0,cn.join)((0,ms.homedir)(),"Documents","Lokus Workspace"),lokusConfigDir:(0,cn.join)((0,ms.homedir)(),".lokus"),lastWorkspaceFile:(0,cn.join)((0,ms.homedir)(),".lokus","last-workspace.json"),apiUrl:"http://127.0.0.1:3333"},ee={info:(...t)=>console.error("[MCP]",...t),error:(...t)=>console.error("[MCP ERROR]",...t),warn:(...t)=>console.error("[MCP WARN]",...t)},ki=class{constructor(){this.currentWorkspace=null,this.apiAvailable=!1}async getWorkspace(){return this.currentWorkspace?this.currentWorkspace:(this.currentWorkspace=await this.getWorkspaceFromAPI(),this.currentWorkspace?(ee.info("Using workspace from Lokus API:",this.currentWorkspace),this.apiAvailable=!0,this.currentWorkspace):(this.currentWorkspace=await this.getLastWorkspace(),this.currentWorkspace?(ee.info("Using last workspace from config:",this.currentWorkspace),this.currentWorkspace):(this.currentWorkspace=await this.getDefaultWorkspace(),ee.info("Using default workspace:",this.currentWorkspace),this.currentWorkspace)))}async getWorkspaceFromAPI(){try{let e=(await Promise.resolve().then(()=>(Dn(),Do))).default,r=await e(`${Pr.apiUrl}/api/workspace`,{timeout:2e3});if(r.ok){let a=await r.json();if(a.success&&a.data)return a.data.workspace}}catch{}return null}async getLastWorkspace(){try{let e=await(0,Fe.readFile)(Pr.lastWorkspaceFile,"utf-8"),r=JSON.parse(e);if(r.workspace&&await this.validateWorkspace(r.workspace))return r.workspace}catch{}return null}async getDefaultWorkspace(){let e=Pr.defaultWorkspace;try{await(0,Fe.access)(e,gs.constants.F_OK)}catch{try{await(0,Fe.mkdir)(e,{recursive:!0}),await(0,Fe.mkdir)((0,cn.join)(e,".lokus"),{recursive:!0}),await(0,Fe.writeFile)((0,cn.join)(e,"Welcome.md"),`# Welcome to Lokus!

This is your knowledge workspace. You can:
- Create notes with [[WikiLinks]]
- Organize with Bases (databases)
- Visualize with Canvas
- Manage tasks with Kanban boards
- Explore connections with Graph view

Happy knowledge building! \u{1F680}
`),ee.info("Created default workspace at:",e)}catch(r){ee.error("Failed to create default workspace:",r)}}return e}async validateWorkspace(e){try{return await(0,Fe.access)(e,gs.constants.R_OK|gs.constants.W_OK),!0}catch{return!1}}async saveLastWorkspace(e){try{await(0,Fe.mkdir)(Pr.lokusConfigDir,{recursive:!0}),await(0,Fe.writeFile)(Pr.lastWorkspaceFile,JSON.stringify({workspace:e,lastUsed:new Date().toISOString(),apiAvailable:this.apiAvailable}))}catch(r){ee.error("Failed to save last workspace:",r)}}async checkAPIStatus(){try{let e=(await Promise.resolve().then(()=>(Dn(),Do))).default;return(await e(`${Pr.apiUrl}/api/health`,{timeout:1e3})).ok}catch{return!1}}},ys=new ki,Yn=new Ua({name:"lokus-mcp-enhanced",version:"2.0.0"},{capabilities:{tools:{},resources:{}}}),ud=()=>[...Fo,...Wo,...qo,...Bo,...Uo,...zo,...Ho,...Vo,...wi];Yn.setRequestHandler(mo,async()=>{let t=ud();return ee.info(`Providing ${t.length} tools to AI assistant`),{tools:t}});Yn.setRequestHandler(go,async t=>{let{name:e,arguments:r}=t.params,a=await ys.getWorkspace(),s=ys.apiAvailable?Pr.apiUrl:null;ee.info(`Executing tool: ${e}`);try{if(Fo.some(i=>i.name===e))return await nu(e,r,s);if(Wo.some(i=>i.name===e))return await iu(e,r,a,s);if(qo.some(i=>i.name===e))return await cu(e,r,a,s);if(Bo.some(i=>i.name===e))return await uu(e,r,a,s);if(Uo.some(i=>i.name===e))return await du(e,r,a,s);if(zo.some(i=>i.name===e))return await fu(e,r,a,s);if(Ho.some(i=>i.name===e))return await pu(e,r,a,s);if(Vo.some(i=>i.name===e))return await hu(e,r,a,s);if(wi.some(i=>i.name===e)){let i=await cd(e,r);return{content:[{type:"text",text:JSON.stringify(i,null,2)}]}}throw new Error(`Unknown tool: ${e}`)}catch(i){return ee.error(`Tool execution failed for ${e}:`,i.message),{content:[{type:"text",text:`\u274C Error: ${i.message}`}],isError:!0}}});Yn.setRequestHandler(po,async()=>(ee.info(`Providing ${_i.length} documentation resources`),{resources:_i}));Yn.setRequestHandler(ho,async t=>{let{uri:e}=t.params;ee.info(`Reading resource: ${e}`);try{return await ld(e)}catch(r){return ee.error(`Resource read failed for ${e}:`,r.message),{contents:[{uri:e,mimeType:"text/plain",text:`Error: ${r.message}`}]}}});async function Fb(){let t=new Ha;await Yn.connect(t),ee.info("==========================================="),ee.info("Lokus MCP Server v2.0 started successfully"),ee.info(`Offering ${ud().length} tools`),await ys.checkAPIStatus()?ee.info("\u2705 Connected to Lokus app API"):ee.info("\u26A0\uFE0F  Lokus app not running (basic features only)");let r=await ys.getWorkspace();ee.info("Workspace:",r),ee.info("===========================================")}Fb().catch(t=>{ee.error("Fatal error:",t),process.exit(1)});
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
