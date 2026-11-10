// Small polyfills for older browsers, mainly the Chromium builds inside
// LG webOS and Samsung Tizen TVs.
const P = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
if (P && !P.roundRect) {
  P.roundRect = function roundRect(x, y, w, h, r = 0) {
    const rad = Math.max(0, Math.min(Array.isArray(r) ? r[0] || 0 : r, Math.abs(w) / 2, Math.abs(h) / 2));
    this.moveTo(x + rad, y);
    this.arcTo(x + w, y, x + w, y + h, rad);
    this.arcTo(x + w, y + h, x, y + h, rad);
    this.arcTo(x, y + h, x, y, rad);
    this.arcTo(x, y, x + w, y, rad);
    this.closePath();
  };
}
