var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var C = (function () {
    function C() {
    }
    C.foo = function () {
    };
    Object.defineProperty(C.prototype, "x", {
        get: function () {
            return 1;
        },
        enumerable: true,
        configurable: true
    });

    C.bar = function () {
    };
    return C;
})();

//BUG 733796
var D = (function (_super) {
    __extends(D, _super);
    function D() {
        _super.call(this);
        _super.prototype.bar.call(this);
        _super.prototype.x;
    }
    D.foo = function () {
        _super.prototype.bar.call(this);
        _super.prototype.x;
    };

    Object.defineProperty(D, "y", {
        get: function () {
            _super.prototype.bar.call(this);
            _super.prototype.x;
            return 1;
        },
        enumerable: true,
        configurable: true
    });
    return D;
})(C);
