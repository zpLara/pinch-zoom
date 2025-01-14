import './styles.css';
interface ChangeOptions {
    /**
     * Fire a 'change' event if values are different to current values
     */
    allowChangeEvent?: boolean;
}
interface SetTransformOpts extends ChangeOptions {
    scale?: number;
    x?: number;
    y?: number;
}
declare type ScaleRelativeToValues = 'container' | 'content';
export interface ScaleToOpts extends ChangeOptions {
    /** Transform origin. Can be a number, or string percent, eg "50%" */
    originX?: number | string;
    /** Transform origin. Can be a number, or string percent, eg "50%" */
    originY?: number | string;
    /** Should the transform origin be relative to the container, or content? */
    relativeTo?: ScaleRelativeToValues;
}
export default class PinchZoom extends HTMLElement {
    private _positioningEl?;
    private _transform;
    private prevX;
    private prevY;
    static get observedAttributes(): string[];
    constructor();
    attributeChangedCallback(name: string, oldValue: string, newValue: string): void;
    get minScale(): number;
    set minScale(value: number);
    get maxScale(): number;
    set maxScale(value: number);
    get noPanBeforeZoom(): boolean;
    set noPanBeforeZoom(value: boolean);
    connectedCallback(): void;
    get x(): number;
    get y(): number;
    get scale(): number;
    /**
     * Change the scale, adjusting x/y by a given transform origin.
     */
    scaleTo(scale: number, opts?: ScaleToOpts): void;
    /**
     * For mobile-like panning, pan more than touch pointer
     */
    mobilePanningEffect(newVal: number, orgVal: number): number;
    /**
     * Update the stage with a given scale/x/y.
     */
    setTransform(opts?: SetTransformOpts): void;
    /**
     * Update transform values without checking bounds. This is only called in setTransform.
     */
    private _updateTransform;
    /**
     * Called when the direct children of this element change.
     * Until we have have shadow dom support across the board, we
     * require a single element to be the child of <pinch-zoom>, and
     * that's the element we pan/scale.
     */
    private _stageElChange;
    private _onWheel;
    private _onPointerMove;
    /** Transform the view & fire a change event */
    private _applyChange;
}
export {};
