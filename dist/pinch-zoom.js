var PinchZoom = (function () {
    'use strict';

    class Pointer {
        constructor(nativePointer) {
            /** Unique ID for this pointer */
            this.id = -1;
            this.nativePointer = nativePointer;
            this.pageX = nativePointer.pageX;
            this.pageY = nativePointer.pageY;
            this.clientX = nativePointer.clientX;
            this.clientY = nativePointer.clientY;
            if (self.Touch && nativePointer instanceof Touch) {
                this.id = nativePointer.identifier;
            }
            else if (isPointerEvent(nativePointer)) {
                // is PointerEvent
                this.id = nativePointer.pointerId;
            }
        }
        /**
         * Returns an expanded set of Pointers for high-resolution inputs.
         */
        getCoalesced() {
            if ('getCoalescedEvents' in this.nativePointer) {
                const events = this.nativePointer
                    .getCoalescedEvents()
                    .map((p) => new Pointer(p));
                // Firefox sometimes returns an empty list here. I'm not sure it's doing the right thing.
                // https://github.com/w3c/pointerevents/issues/409
                if (events.length > 0)
                    return events;
            }
            return [this];
        }
    }
    const isPointerEvent = (event) => 'pointerId' in event;
    const isTouchEvent = (event) => 'changedTouches' in event;
    const noop = () => { };
    /**
     * Track pointers across a particular element
     */
    class PointerTracker {
        /**
         * Track pointers across a particular element
         *
         * @param element Element to monitor.
         * @param options
         */
        constructor(_element, { start = () => true, move = noop, end = noop, rawUpdates = false, avoidPointerEvents = false, } = {}) {
            this._element = _element;
            /**
             * State of the tracked pointers when they were pressed/touched.
             */
            this.startPointers = [];
            /**
             * Latest state of the tracked pointers. Contains the same number of pointers, and in the same
             * order as this.startPointers.
             */
            this.currentPointers = [];
            /**
             * Firefox has a bug where touch-based pointer events have a `buttons` of 0, when this shouldn't
             * happen. https://bugzilla.mozilla.org/show_bug.cgi?id=1729440
             *
             * Usually we treat `buttons === 0` as no-longer-pressed. This set allows us to exclude these
             * buggy Firefox events.
             */
            this._excludeFromButtonsCheck = new Set();
            /**
             * Listener for mouse/pointer starts.
             *
             * @param event This will only be a MouseEvent if the browser doesn't support pointer events.
             */
            this._pointerStart = (event) => {
                if (isPointerEvent(event) && event.buttons === 0) {
                    // This is the buggy Firefox case. See _excludeFromButtonsCheck.
                    this._excludeFromButtonsCheck.add(event.pointerId);
                }
                else if (!(event.buttons & 1 /* LeftMouseOrTouchOrPenDown */)) {
                    return;
                }
                const pointer = new Pointer(event);
                // If we're already tracking this pointer, ignore this event.
                // This happens with mouse events when multiple buttons are pressed.
                if (this.currentPointers.some((p) => p.id === pointer.id))
                    return;
                if (!this._triggerPointerStart(pointer, event))
                    return;
                // Add listeners for additional events.
                // The listeners may already exist, but no harm in adding them again.
                if (isPointerEvent(event)) {
                    const capturingElement = event.target && 'setPointerCapture' in event.target
                        ? event.target
                        : this._element;
                    capturingElement.setPointerCapture(event.pointerId);
                    this._element.addEventListener(this._rawUpdates ? 'pointerrawupdate' : 'pointermove', this._move);
                    this._element.addEventListener('pointerup', this._pointerEnd);
                    this._element.addEventListener('pointercancel', this._pointerEnd);
                }
                else {
                    // MouseEvent
                    window.addEventListener('mousemove', this._move);
                    window.addEventListener('mouseup', this._pointerEnd);
                }
            };
            /**
             * Listener for touchstart.
             * Only used if the browser doesn't support pointer events.
             */
            this._touchStart = (event) => {
                for (const touch of Array.from(event.changedTouches)) {
                    this._triggerPointerStart(new Pointer(touch), event);
                }
            };
            /**
             * Listener for pointer/mouse/touch move events.
             */
            this._move = (event) => {
                if (!isTouchEvent(event) &&
                    (!isPointerEvent(event) ||
                        !this._excludeFromButtonsCheck.has(event.pointerId)) &&
                    event.buttons === 0 /* None */) {
                    // This happens in a number of buggy cases where the browser failed to deliver a pointerup
                    // or pointercancel. If we see the pointer moving without any buttons down, synthesize an end.
                    // https://github.com/w3c/pointerevents/issues/407
                    // https://github.com/w3c/pointerevents/issues/408
                    this._pointerEnd(event);
                    return;
                }
                const previousPointers = this.currentPointers.slice();
                const changedPointers = isTouchEvent(event)
                    ? Array.from(event.changedTouches).map((t) => new Pointer(t))
                    : [new Pointer(event)];
                const trackedChangedPointers = [];
                for (const pointer of changedPointers) {
                    const index = this.currentPointers.findIndex((p) => p.id === pointer.id);
                    if (index === -1)
                        continue; // Not a pointer we're tracking
                    trackedChangedPointers.push(pointer);
                    this.currentPointers[index] = pointer;
                }
                if (trackedChangedPointers.length === 0)
                    return;
                this._moveCallback(previousPointers, trackedChangedPointers, event);
            };
            /**
             * Call the end callback for this pointer.
             *
             * @param pointer Pointer
             * @param event Related event
             */
            this._triggerPointerEnd = (pointer, event) => {
                // Main button still down?
                // With mouse events, you get a mouseup per mouse button, so the left button might still be down.
                if (!isTouchEvent(event) &&
                    event.buttons & 1 /* LeftMouseOrTouchOrPenDown */) {
                    return false;
                }
                const index = this.currentPointers.findIndex((p) => p.id === pointer.id);
                // Not a pointer we're interested in?
                if (index === -1)
                    return false;
                this.currentPointers.splice(index, 1);
                this.startPointers.splice(index, 1);
                this._excludeFromButtonsCheck.delete(pointer.id);
                // The event.type might be a 'move' event due to workarounds for weird mouse behaviour.
                // See _move for details.
                const cancelled = !(event.type === 'mouseup' ||
                    event.type === 'touchend' ||
                    event.type === 'pointerup');
                this._endCallback(pointer, event, cancelled);
                return true;
            };
            /**
             * Listener for mouse/pointer ends.
             *
             * @param event This will only be a MouseEvent if the browser doesn't support pointer events.
             */
            this._pointerEnd = (event) => {
                if (!this._triggerPointerEnd(new Pointer(event), event))
                    return;
                if (isPointerEvent(event)) {
                    if (this.currentPointers.length)
                        return;
                    this._element.removeEventListener(this._rawUpdates ? 'pointerrawupdate' : 'pointermove', this._move);
                    this._element.removeEventListener('pointerup', this._pointerEnd);
                    this._element.removeEventListener('pointercancel', this._pointerEnd);
                }
                else {
                    // MouseEvent
                    window.removeEventListener('mousemove', this._move);
                    window.removeEventListener('mouseup', this._pointerEnd);
                }
            };
            /**
             * Listener for touchend.
             * Only used if the browser doesn't support pointer events.
             */
            this._touchEnd = (event) => {
                for (const touch of Array.from(event.changedTouches)) {
                    this._triggerPointerEnd(new Pointer(touch), event);
                }
            };
            this._startCallback = start;
            this._moveCallback = move;
            this._endCallback = end;
            this._rawUpdates = rawUpdates && 'onpointerrawupdate' in window;
            // Add listeners
            if (self.PointerEvent && !avoidPointerEvents) {
                this._element.addEventListener('pointerdown', this._pointerStart);
            }
            else {
                this._element.addEventListener('mousedown', this._pointerStart);
                this._element.addEventListener('touchstart', this._touchStart);
                this._element.addEventListener('touchmove', this._move);
                this._element.addEventListener('touchend', this._touchEnd);
                this._element.addEventListener('touchcancel', this._touchEnd);
            }
        }
        /**
         * Remove all listeners.
         */
        stop() {
            this._element.removeEventListener('pointerdown', this._pointerStart);
            this._element.removeEventListener('mousedown', this._pointerStart);
            this._element.removeEventListener('touchstart', this._touchStart);
            this._element.removeEventListener('touchmove', this._move);
            this._element.removeEventListener('touchend', this._touchEnd);
            this._element.removeEventListener('touchcancel', this._touchEnd);
            this._element.removeEventListener(this._rawUpdates ? 'pointerrawupdate' : 'pointermove', this._move);
            this._element.removeEventListener('pointerup', this._pointerEnd);
            this._element.removeEventListener('pointercancel', this._pointerEnd);
            window.removeEventListener('mousemove', this._move);
            window.removeEventListener('mouseup', this._pointerEnd);
        }
        /**
         * Call the start callback for this pointer, and track it if the user wants.
         *
         * @param pointer Pointer
         * @param event Related event
         * @returns Whether the pointer is being tracked.
         */
        _triggerPointerStart(pointer, event) {
            if (!this._startCallback(pointer, event))
                return false;
            this.currentPointers.push(pointer);
            this.startPointers.push(pointer);
            return true;
        }
    }

    function styleInject(css, ref) {
      if ( ref === void 0 ) ref = {};
      var insertAt = ref.insertAt;

      if (!css || typeof document === 'undefined') { return; }

      var head = document.head || document.getElementsByTagName('head')[0];
      var style = document.createElement('style');
      style.type = 'text/css';

      if (insertAt === 'top') {
        if (head.firstChild) {
          head.insertBefore(style, head.firstChild);
        } else {
          head.appendChild(style);
        }
      } else {
        head.appendChild(style);
      }

      if (style.styleSheet) {
        style.styleSheet.cssText = css;
      } else {
        style.appendChild(document.createTextNode(css));
      }
    }

    var css = "pinch-zoom {\r\n  display: block;\r\n  overflow: hidden;\r\n  touch-action: none;\r\n  --scale: 1;\r\n  --x: 0;\r\n  --y: 0;\r\n}\r\n\r\npinch-zoom > * {\r\n  transform: translate(var(--x), var(--y)) scale(var(--scale));\r\n  transform-origin: 0 0;\r\n  will-change: transform;\r\n}\r\n";
    styleInject(css);

    const minScaleAttr = 'min-scale';
    const maxScaleAttr = 'max-scale';
    const noPanBeforeZoomAttr = 'no-pan-before-zoom';
    function getDistance(a, b) {
        if (!b)
            return 0;
        return Math.sqrt((b.clientX - a.clientX) ** 2 + (b.clientY - a.clientY) ** 2);
    }
    function getMidpoint(a, b) {
        if (!b)
            return a;
        return {
            clientX: (a.clientX + b.clientX) / 2,
            clientY: (a.clientY + b.clientY) / 2,
        };
    }
    function getAbsoluteValue(value, max) {
        if (typeof value === 'number')
            return value;
        if (/% *$/.test(value)) {
            return max * parseFloat(value) / 100;
        }
        return parseFloat(value);
    }
    // I'd rather use DOMMatrix/DOMPoint here, but the browser support isn't good enough.
    // Given that, better to use something everything supports.
    let cachedSvg;
    function getSVG() {
        return cachedSvg || (cachedSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
    }
    function createMatrix() {
        return getSVG().createSVGMatrix();
    }
    function createPoint() {
        return getSVG().createSVGPoint();
    }
    const MIN_SCALE = 0.01;
    const MAX_SCALE = 100.00;
    class PinchZoom extends HTMLElement {
        constructor() {
            super();
            // Current transform.
            this._transform = createMatrix();
            this.prevX = -1;
            this.prevY = -1;
            // Watch for children changes.
            // Note this won't fire for initial contents,
            // so _stageElChange is also called in connectedCallback.
            new MutationObserver(() => this._stageElChange())
                .observe(this, { childList: true });
            // Watch for pointers
            const pointerTracker = new PointerTracker(this, {
                start: (pointer, event) => {
                    // We only want to track 2 pointers at most
                    if (pointerTracker.currentPointers.length === 2 || !this._positioningEl)
                        return false;
                    event.preventDefault();
                    return true;
                },
                move: (previousPointers) => {
                    this._onPointerMove(previousPointers, pointerTracker.currentPointers);
                },
            });
            this.addEventListener('wheel', event => this._onWheel(event));
        }
        static get observedAttributes() { return [minScaleAttr, maxScaleAttr, noPanBeforeZoomAttr]; }
        attributeChangedCallback(name, oldValue, newValue) {
            if (name === minScaleAttr) {
                if (this.scale < this.minScale) {
                    this.setTransform({ scale: this.minScale });
                }
            }
            if (name === maxScaleAttr) {
                if (this.scale > this.maxScale) {
                    this.setTransform({ scale: this.maxScale });
                }
            }
        }
        get minScale() {
            const attrValue = this.getAttribute(minScaleAttr);
            if (!attrValue)
                return MIN_SCALE;
            const value = parseFloat(attrValue);
            if (Number.isFinite(value))
                return Math.max(MIN_SCALE, value);
            return MIN_SCALE;
        }
        set minScale(value) {
            this.setAttribute(minScaleAttr, String(value));
        }
        get maxScale() {
            const attrValue = this.getAttribute(maxScaleAttr);
            if (!attrValue)
                return MAX_SCALE;
            const value = parseFloat(attrValue);
            if (Number.isFinite(value))
                return Math.min(MAX_SCALE, value);
            return MAX_SCALE;
        }
        set maxScale(value) {
            this.setAttribute(maxScaleAttr, String(value));
        }
        get noPanBeforeZoom() {
            const attrValue = this.getAttribute(noPanBeforeZoomAttr);
            if (!attrValue)
                return false;
            return attrValue === "true";
        }
        set noPanBeforeZoom(value) {
            this.setAttribute(noPanBeforeZoomAttr, String(value));
        }
        connectedCallback() {
            this._stageElChange();
        }
        get x() {
            return this._transform.e;
        }
        get y() {
            return this._transform.f;
        }
        get scale() {
            return this._transform.a;
        }
        /**
         * Change the scale, adjusting x/y by a given transform origin.
         */
        scaleTo(scale, opts = {}) {
            let { originX = 0, originY = 0, } = opts;
            const { relativeTo = 'content', allowChangeEvent = false, } = opts;
            const relativeToEl = (relativeTo === 'content' ? this._positioningEl : this);
            // No content element? Fall back to just setting scale
            if (!relativeToEl || !this._positioningEl) {
                this.setTransform({ scale, allowChangeEvent });
                return;
            }
            const rect = relativeToEl.getBoundingClientRect();
            originX = getAbsoluteValue(originX, rect.width);
            originY = getAbsoluteValue(originY, rect.height);
            if (relativeTo === 'content') {
                originX += this.x;
                originY += this.y;
            }
            else {
                const currentRect = this._positioningEl.getBoundingClientRect();
                originX -= currentRect.left;
                originY -= currentRect.top;
            }
            this._applyChange({
                allowChangeEvent,
                originX,
                originY,
                scaleDiff: scale / this.scale,
            });
        }
        /**
         * For mobile-like panning, pan more than touch pointer
         */
        mobilePanningEffect(newVal, orgVal) {
            if (newVal != orgVal) {
                console.log("mobilePanningEffect :: apply effect", { newValWithEffect: newVal * 1.05, newVal: newVal, org: orgVal });
                return newVal * 1.05; //shift 5% more
            }
            else {
                console.log("mobilePanningEffect :: no change", { newVal: newVal, org: orgVal });
                return newVal;
            }
        }
        /**
         * Update the stage with a given scale/x/y.
         */
        setTransform(opts = {}) {
            const { scale = this.scale, allowChangeEvent = false, } = opts;
            let { x = this.mobilePanningEffect(this.x, this.prevX), y = this.mobilePanningEffect(this.y, this.prevY), } = opts;
            // If we don't have an element to position, just set the value as given.
            // We'll check bounds later.
            if (!this._positioningEl) {
                this._updateTransform(scale, x, y, allowChangeEvent);
                return;
            }
            // Get current layout
            const thisBounds = this.getBoundingClientRect();
            const positioningElBounds = this._positioningEl.getBoundingClientRect();
            // Not displayed. May be disconnected or display:none.
            // Just take the values, and we'll check bounds later.
            if (!thisBounds.width || !thisBounds.height) {
                this._updateTransform(scale, x, y, allowChangeEvent);
                return;
            }
            // Create points for _positioningEl.
            let topLeft = createPoint();
            topLeft.x = positioningElBounds.left - thisBounds.left;
            topLeft.y = positioningElBounds.top - thisBounds.top;
            let bottomRight = createPoint();
            bottomRight.x = positioningElBounds.width + topLeft.x;
            bottomRight.y = positioningElBounds.height + topLeft.y;
            // Calculate the intended position of _positioningEl.
            const matrix = createMatrix()
                .translate(x, y)
                .scale(scale)
                // Undo current transform
                .multiply(this._transform.inverse());
            topLeft = topLeft.matrixTransform(matrix);
            bottomRight = bottomRight.matrixTransform(matrix);
            // Ensure _positioningEl can't move beyond out-of-bounds.
            // Correct for x
            if (topLeft.x > thisBounds.width) {
                x += thisBounds.width - topLeft.x;
            }
            else if (bottomRight.x < 0) {
                x += -bottomRight.x;
            }
            // Correct for y
            if (topLeft.y > thisBounds.height) {
                y += thisBounds.height - topLeft.y;
            }
            else if (bottomRight.y < 0) {
                y += -bottomRight.y;
            }
            this._updateTransform(scale, x, y, allowChangeEvent);
        }
        /**
         * Update transform values without checking bounds. This is only called in setTransform.
         */
        _updateTransform(scale, x, y, allowChangeEvent) {
            // Avoid scaling to zero
            if (scale < this.minScale)
                return;
            if (scale > this.maxScale)
                return;
            // Return if there's no change
            if (scale === this.scale &&
                x === this.x &&
                y === this.y)
                return;
            //force scale to be 2dp
            scale = parseFloat(scale.toFixed(2));
            //disallow transform if scale <= this.minScale
            if (this.scale === this.minScale && this.noPanBeforeZoom) {
                //disallow pan before zoom, by setting x/y to 0
                x = 0;
                y = 0;
            }
            this.prevX = this._transform.e;
            this.prevY = this._transform.f;
            this._transform.e = x;
            this._transform.f = y;
            this._transform.d = this._transform.a = scale;
            this.style.setProperty('--x', this.x + 'px');
            this.style.setProperty('--y', this.y + 'px');
            this.style.setProperty('--scale', this.scale + '');
            if (allowChangeEvent) {
                const event = new Event('change', { bubbles: true });
                this.dispatchEvent(event);
            }
        }
        /**
         * Called when the direct children of this element change.
         * Until we have have shadow dom support across the board, we
         * require a single element to be the child of <pinch-zoom>, and
         * that's the element we pan/scale.
         */
        _stageElChange() {
            this._positioningEl = undefined;
            if (this.children.length === 0)
                return;
            this._positioningEl = this.children[0];
            if (this.children.length > 1) {
                console.warn('<pinch-zoom> must not have more than one child.');
            }
            // Do a bounds check
            this.setTransform({ allowChangeEvent: true });
        }
        _onWheel(event) {
            if (!this._positioningEl)
                return;
            event.preventDefault();
            const currentRect = this._positioningEl.getBoundingClientRect();
            let { deltaY } = event;
            const { ctrlKey, deltaMode } = event;
            if (deltaMode === 1) { // 1 is "lines", 0 is "pixels"
                // Firefox uses "lines" for some types of mouse
                deltaY *= 15;
            }
            // ctrlKey is true when pinch-zooming on a trackpad.
            const divisor = ctrlKey ? 100 : 300;
            const scaleDiff = 1 - deltaY / divisor;
            this._applyChange({
                scaleDiff,
                originX: event.clientX - currentRect.left,
                originY: event.clientY - currentRect.top,
                allowChangeEvent: true,
            });
        }
        _onPointerMove(previousPointers, currentPointers) {
            if (!this._positioningEl)
                return;
            // Combine next points with previous points
            const currentRect = this._positioningEl.getBoundingClientRect();
            // For calculating panning movement
            const prevMidpoint = getMidpoint(previousPointers[0], previousPointers[1]);
            const newMidpoint = getMidpoint(currentPointers[0], currentPointers[1]);
            // Midpoint within the element
            const originX = prevMidpoint.clientX - currentRect.left;
            const originY = prevMidpoint.clientY - currentRect.top;
            // Calculate the desired change in scale
            const prevDistance = getDistance(previousPointers[0], previousPointers[1]);
            const newDistance = getDistance(currentPointers[0], currentPointers[1]);
            const scaleDiff = prevDistance ? newDistance / prevDistance : 1;
            this._applyChange({
                originX, originY, scaleDiff,
                panX: newMidpoint.clientX - prevMidpoint.clientX,
                panY: newMidpoint.clientY - prevMidpoint.clientY,
                allowChangeEvent: true,
            });
        }
        /** Transform the view & fire a change event */
        _applyChange(opts = {}) {
            const { panX = 0, panY = 0, originX = 0, originY = 0, scaleDiff = 1, allowChangeEvent = false, } = opts;
            const matrix = createMatrix()
                // Translate according to panning.
                .translate(panX, panY)
                // Scale about the origin.
                .translate(originX, originY)
                // Apply current translate
                .translate(this.x, this.y)
                .scale(scaleDiff)
                .translate(-originX, -originY)
                // Apply current scale.
                .scale(this.scale);
            // Convert the transform into basic translate & scale.
            this.setTransform({
                allowChangeEvent,
                scale: matrix.a,
                x: matrix.e,
                y: matrix.f,
            });
        }
    }

    customElements.define('pinch-zoom', PinchZoom);

    return PinchZoom;

}());
