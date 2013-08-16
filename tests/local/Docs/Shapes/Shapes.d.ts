/// <reference path="lib.d.ts" />
declare module penuts {
    var x: number;
}
declare module Sayings {
    /** Shapes description */
    class Shapes {
        public Value: number;
        public Units: string;
        public Auto: boolean;
        /** constructor description
        @param Value Value description
        */
        constructor(Value: number);
    }
    /** IGreeter description */
    interface IGreeter<T> {
        /** greeting description */
        greeting: T;
        /** greet description */
        greet(): T;
    }
    /** NullGreeter description */
    class NullGreeter {
    }
    /** Greeter description */
    class Greeter<T> extends NullGreeter implements IGreeter<T> {
        /** greeting description */
        public greeting: T;
        /** constructor description
        @param message message description
        */
        constructor();
        /** greet description */
        public greet(): T;
        /** Test description
        @param AParam AParam description
        @param BParam BParam description
        @param CParam CParam description
        @returns Return description.
        */
        public test(AParam: string, BParam?: number, CParam?: number): void;
    }
    /** Test enumeration summary. */
    enum TestEnum {
        /** AValue summary */
        AValue,
        /** BValue summary */
        BValue = 5,
        /** CValue summary */
        CValue,
        /** DValue summary */
        DValue = 11,
        /** EValue summary */
        EValue,
        /** FValue summary */
        FValue = 17,
    }
}
declare var greeter: Sayings.Greeter<string>;
