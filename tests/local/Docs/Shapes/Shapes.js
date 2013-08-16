/// <reference path="lib.d.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var penuts;
(function (penuts) {
    penuts.x = 1;
})(penuts || (penuts = {}));
var Sayings;
(function (Sayings) {
    var x = penuts.x;

    /** Shapes description */
    var Shapes = (function () {
        /** constructor description
        @param Value Value description
        @param Units Units description
        @param Auto Auto description
        */
        function Shapes(Value, Units, Auto) {
            if (typeof Units === "undefined") { Units = "px"; }
            if (typeof Auto === "undefined") { Auto = false; }
            this.Value = Value;
            this.Units = Units;
            this.Auto = Auto;
        }
        return Shapes;
    })();
    Sayings.Shapes = Shapes;

    /** NullGreeter description */
    var NullGreeter = (function () {
        function NullGreeter() {
        }
        return NullGreeter;
    })();
    Sayings.NullGreeter = NullGreeter;

    /** Greeter description */
    var Greeter = (function (_super) {
        __extends(Greeter, _super);
        /** constructor description
        @param message message description
        */
        function Greeter(message) {
            if (typeof message === "undefined") { message = null; }
            _super.call(this);

            this.greeting = message;
        }
        /** greet description */
        Greeter.prototype.greet = function () {
            return ("Hello, " + this.greeting);
        };

        /** Test description
        @param AParam AParam description
        @param BParam BParam description
        @param CParam CParam description
        @returns Return description.
        */
        Greeter.prototype.test = function (AParam, BParam, CParam) {
            if (typeof BParam === "undefined") { BParam = 0; }
        };
        return Greeter;
    })(NullGreeter);
    Sayings.Greeter = Greeter;

    /** Test enumeration summary. */
    (function (TestEnum) {
        /** AValue summary */
        TestEnum[TestEnum["AValue"] = 0] = "AValue";

        /** BValue summary */
        TestEnum[TestEnum["BValue"] = 5] = "BValue";

        /** CValue summary */
        TestEnum[TestEnum["CValue"] = 6] = "CValue";

        /** DValue summary */
        TestEnum[TestEnum["DValue"] = 11] = "DValue";

        /** EValue summary */
        TestEnum[TestEnum["EValue"] = 12] = "EValue";

        /** FValue summary */
        TestEnum[TestEnum["FValue"] = 17] = "FValue";
    })(Sayings.TestEnum || (Sayings.TestEnum = {}));
    var TestEnum = Sayings.TestEnum;
})(Sayings || (Sayings = {}));

var greeter = new Sayings.Greeter("world");
