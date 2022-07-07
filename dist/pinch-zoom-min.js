!function(){"use strict";!function(){class t{constructor(t){this.id=-1,this.nativePointer=t,this.pageX=t.pageX,this.pageY=t.pageY,this.clientX=t.clientX,this.clientY=t.clientY,self.Touch&&t instanceof Touch?this.id=t.identifier:e(t)&&(this.id=t.pointerId)}getCoalesced(){if("getCoalescedEvents"in this.nativePointer){const e=this.nativePointer.getCoalescedEvents().map(e=>new t(e));if(e.length>0)return e}return[this]}}const e=t=>"pointerId"in t,n=t=>"changedTouches"in t,i=()=>{};class s{constructor(s,{start:r=(()=>!0),move:o=i,end:a=i,rawUpdates:h=!1,avoidPointerEvents:l=!1}={}){this._element=s,this.startPointers=[],this.currentPointers=[],this._excludeFromButtonsCheck=new Set,this._pointerStart=(n=>{if(e(n)&&0===n.buttons)this._excludeFromButtonsCheck.add(n.pointerId);else if(!(1&n.buttons))return;const i=new t(n);if(!this.currentPointers.some(t=>t.id===i.id)&&this._triggerPointerStart(i,n))if(e(n)){(n.target&&"setPointerCapture"in n.target?n.target:this._element).setPointerCapture(n.pointerId),this._element.addEventListener(this._rawUpdates?"pointerrawupdate":"pointermove",this._move),this._element.addEventListener("pointerup",this._pointerEnd),this._element.addEventListener("pointercancel",this._pointerEnd)}else window.addEventListener("mousemove",this._move),window.addEventListener("mouseup",this._pointerEnd)}),this._touchStart=(e=>{for(const n of Array.from(e.changedTouches))this._triggerPointerStart(new t(n),e)}),this._move=(i=>{if(!(n(i)||e(i)&&this._excludeFromButtonsCheck.has(i.pointerId)||0!==i.buttons))return void this._pointerEnd(i);const s=this.currentPointers.slice(),r=n(i)?Array.from(i.changedTouches).map(e=>new t(e)):[new t(i)],o=[];for(const t of r){const e=this.currentPointers.findIndex(e=>e.id===t.id);-1!==e&&(o.push(t),this.currentPointers[e]=t)}0!==o.length&&this._moveCallback(s,o,i)}),this._triggerPointerEnd=((t,e)=>{if(!n(e)&&1&e.buttons)return!1;const i=this.currentPointers.findIndex(e=>e.id===t.id);if(-1===i)return!1;this.currentPointers.splice(i,1),this.startPointers.splice(i,1),this._excludeFromButtonsCheck.delete(t.id);const s=!("mouseup"===e.type||"touchend"===e.type||"pointerup"===e.type);return this._endCallback(t,e,s),!0}),this._pointerEnd=(n=>{if(this._triggerPointerEnd(new t(n),n))if(e(n)){if(this.currentPointers.length)return;this._element.removeEventListener(this._rawUpdates?"pointerrawupdate":"pointermove",this._move),this._element.removeEventListener("pointerup",this._pointerEnd),this._element.removeEventListener("pointercancel",this._pointerEnd)}else window.removeEventListener("mousemove",this._move),window.removeEventListener("mouseup",this._pointerEnd)}),this._touchEnd=(e=>{for(const n of Array.from(e.changedTouches))this._triggerPointerEnd(new t(n),e)}),this._startCallback=r,this._moveCallback=o,this._endCallback=a,this._rawUpdates=h&&"onpointerrawupdate"in window,self.PointerEvent&&!l?this._element.addEventListener("pointerdown",this._pointerStart):(this._element.addEventListener("mousedown",this._pointerStart),this._element.addEventListener("touchstart",this._touchStart),this._element.addEventListener("touchmove",this._move),this._element.addEventListener("touchend",this._touchEnd),this._element.addEventListener("touchcancel",this._touchEnd))}stop(){this._element.removeEventListener("pointerdown",this._pointerStart),this._element.removeEventListener("mousedown",this._pointerStart),this._element.removeEventListener("touchstart",this._touchStart),this._element.removeEventListener("touchmove",this._move),this._element.removeEventListener("touchend",this._touchEnd),this._element.removeEventListener("touchcancel",this._touchEnd),this._element.removeEventListener(this._rawUpdates?"pointerrawupdate":"pointermove",this._move),this._element.removeEventListener("pointerup",this._pointerEnd),this._element.removeEventListener("pointercancel",this._pointerEnd),window.removeEventListener("mousemove",this._move),window.removeEventListener("mouseup",this._pointerEnd)}_triggerPointerStart(t,e){return!!this._startCallback(t,e)&&(this.currentPointers.push(t),this.startPointers.push(t),!0)}}!function(t,e){void 0===e&&(e={});var n=e.insertAt;if(t&&"undefined"!=typeof document){var i=document.head||document.getElementsByTagName("head")[0],s=document.createElement("style");s.type="text/css","top"===n&&i.firstChild?i.insertBefore(s,i.firstChild):i.appendChild(s),s.styleSheet?s.styleSheet.cssText=t:s.appendChild(document.createTextNode(t))}}("pinch-zoom {\r\n  display: block;\r\n  overflow: hidden;\r\n  touch-action: none;\r\n  --scale: 1;\r\n  --x: 0;\r\n  --y: 0;\r\n}\r\n\r\npinch-zoom > * {\r\n  transform: translate(var(--x), var(--y)) scale(var(--scale));\r\n  transform-origin: 0 0;\r\n  will-change: transform;\r\n}\r\n");const r="min-scale",o="max-scale",a="no-default-pan",h="two-finger-pan",l="no-pan-before-zoom";function c(t,e){return e?Math.sqrt((e.clientX-t.clientX)**2+(e.clientY-t.clientY)**2):0}function d(t,e){return e?{clientX:(t.clientX+e.clientX)/2,clientY:(t.clientY+e.clientY)/2}:t}function u(t,e){return"number"==typeof t?t:t.trimEnd().endsWith("%")?e*parseFloat(t)/100:parseFloat(t)}let m;function p(){return m||(m=document.createElementNS("http://www.w3.org/2000/svg","svg"))}function g(){return p().createSVGMatrix()}function _(){return p().createSVGPoint()}const v=.01,f=100;class E extends HTMLElement{constructor(){super(),this._transform=g(),this._enablePan=!0,this._twoFingerPan=!1,this._noPanBeforeZoom=!1,new MutationObserver(()=>this._stageElChange()).observe(this,{childList:!0});const t=new s(this,{start:(e,n)=>!(2===t.currentPointers.length||!this._positioningEl)&&((this.enablePan||1==t.currentPointers.length||n instanceof PointerEvent&&"mouse"==n.pointerType)&&(this.enablePan=!0,n.preventDefault()),!0),move:e=>{this.enablePan&&this._onPointerMove(e,t.currentPointers)},end:(e,n,i)=>{this.twoFingerPan&&1==t.currentPointers.length&&(this.enablePan=!1)}});this.addEventListener("wheel",t=>this._onWheel(t))}static get observedAttributes(){return[r,o,a,h,l]}attributeChangedCallback(t,e,n){t===r&&this.scale<this.minScale&&this.setTransform({scale:this.minScale}),t===o&&this.scale>this.maxScale&&this.setTransform({scale:this.maxScale}),t===a&&(this.enablePan="1"!=n&&"true"!=n),t===h&&("1"==n||"true"==n?(this.twoFingerPan=!0,this.enablePan=!1):this.twoFingerPan=!1),t===l&&(this.noPanBeforeZoom="1"==n||"true"==n)}get minScale(){const t=this.getAttribute(r);if(!t)return v;const e=parseFloat(t);return Number.isFinite(e)?Math.max(v,e):v}set minScale(t){this.setAttribute(r,String(t))}get maxScale(){const t=this.getAttribute(o);if(!t)return f;const e=parseFloat(t);return Number.isFinite(e)?Math.min(f,e):f}set maxScale(t){this.setAttribute(o,String(t))}set enablePan(t){this._enablePan=t,this._enablePan?this._enablePan&&"none"!=this.style.touchAction&&(this.style.touchAction="none"):this.style.touchAction="pan-y pan-x"}get enablePan(){return this._enablePan&&(!this.noPanBeforeZoom||this.noPanBeforeZoom&&this.scale>this.minScale)}set twoFingerPan(t){this._twoFingerPan=t}get twoFingerPan(){return this._twoFingerPan}set noPanBeforeZoom(t){this._noPanBeforeZoom=t}get noPanBeforeZoom(){return this._noPanBeforeZoom}connectedCallback(){this._stageElChange()}get x(){return this._transform.e}get y(){return this._transform.f}get scale(){return this._transform.a}scaleTo(t,e={}){let{originX:n=0,originY:i=0}=e;const{relativeTo:s="content",allowChangeEvent:r=!1}=e,o="content"===s?this._positioningEl:this;if(!o||!this._positioningEl)return void this.setTransform({scale:t,allowChangeEvent:r});const a=o.getBoundingClientRect();if(n=u(n,a.width),i=u(i,a.height),"content"===s)n+=this.x,i+=this.y;else{const t=this._positioningEl.getBoundingClientRect();n-=t.left,i-=t.top}this._applyChange({allowChangeEvent:r,originX:n,originY:i,scaleDiff:t/this.scale})}setTransform(t={}){const{scale:e=this.scale,allowChangeEvent:n=!1}=t;let{x:i=this.x,y:s=this.y}=t;if(!this._positioningEl)return void this._updateTransform(e,i,s,n);const r=this.getBoundingClientRect(),o=this._positioningEl.getBoundingClientRect();if(!r.width||!r.height)return void this._updateTransform(e,i,s,n);let a=_();a.x=o.left-r.left,a.y=o.top-r.top;let h=_();h.x=o.width+a.x,h.y=o.height+a.y;const l=g().translate(i,s).scale(e).multiply(this._transform.inverse());a=a.matrixTransform(l),h=h.matrixTransform(l),a.x>r.width?i+=r.width-a.x:h.x<0&&(i+=-h.x),a.y>r.height?s+=r.height-a.y:h.y<0&&(s+=-h.y),this._updateTransform(e,i,s,n)}_updateTransform(t,e,n,i){if(!(t<this.minScale)&&!(t>this.maxScale)&&(t!==this.scale||e!==this.x||n!==this.y)&&(this._transform.e=e,this._transform.f=n,this._transform.d=this._transform.a=t,this.style.setProperty("--x",this.x+"px"),this.style.setProperty("--y",this.y+"px"),this.style.setProperty("--scale",this.scale+""),i)){const t=new Event("change",{bubbles:!0});this.dispatchEvent(t)}}_stageElChange(){this._positioningEl=void 0,0!==this.children.length&&(this._positioningEl=this.children[0],this.children.length>1&&console.warn("<pinch-zoom> must not have more than one child."),this.setTransform({allowChangeEvent:!0}))}_onWheel(t){if(!this._positioningEl)return;t.preventDefault();const e=this._positioningEl.getBoundingClientRect();let{deltaY:n}=t;const{ctrlKey:i,deltaMode:s}=t;1===s&&(n*=15);const r=1-n/(i?100:300);this._applyChange({scaleDiff:r,originX:t.clientX-e.left,originY:t.clientY-e.top,allowChangeEvent:!0})}_onPointerMove(t,e){if(!this._positioningEl)return;const n=this._positioningEl.getBoundingClientRect(),i=d(t[0],t[1]),s=d(e[0],e[1]),r=i.clientX-n.left,o=i.clientY-n.top,a=c(t[0],t[1]),h=c(e[0],e[1]),l=a?h/a:1;this._applyChange({originX:r,originY:o,scaleDiff:l,panX:s.clientX-i.clientX,panY:s.clientY-i.clientY,allowChangeEvent:!0})}_applyChange(t={}){const{panX:e=0,panY:n=0,originX:i=0,originY:s=0,scaleDiff:r=1,allowChangeEvent:o=!1}=t,a=g().translate(e,n).translate(i,s).translate(this.x,this.y).scale(r).translate(-i,-s).scale(this.scale);this.setTransform({allowChangeEvent:o,scale:a.a,x:a.e,y:a.f})}}customElements.define("pinch-zoom",E)}()}();
