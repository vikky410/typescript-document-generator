/// <reference path="lib.d.ts" />

module penuts
{
    export var x = 1;
}
module Sayings
{
    import x = penuts.x;

    /** Shapes description */
    export class Shapes
    {
        /** constructor description
            @param Value Value description
        */
        constructor(Value: number)
        /** constructor description 
            @param Value Value description
            @param Units Units description
            @param Auto Auto description
        */
        constructor(public Value: number, public Units: string = "px", public Auto: boolean = false)
        {
        }
    }

    /** IGreeter description */
    export interface IGreeter<T>
    {
        /** greeting description */
        greeting: T;
        /** greet description */
        greet(): T;
    }
    /** NullGreeter description */
    export class NullGreeter
    {
    }
    /** Greeter description */
    export class Greeter<T> extends NullGreeter implements IGreeter<T>
    {
        /** greeting description */
        greeting: T;
        /** constructor description 
            @param message message description
        */
        constructor()
        /** constructor description 
            @param message message description
        */
        constructor(message: T = null)
        {
            super();

            this.greeting = message;
        }
        
        /** greet description */
        greet(): T {
            return <T><any>("Hello, " + this.greeting);
        }

        /** Test description
            @param AParam AParam description
            @param BParam BParam description
            @param CParam CParam description
            @returns Return description.
        */
        test(AParam: string, BParam: number = 0, CParam?: number): void
        {
        }
    }

    /** Test enumeration summary. */
    export enum TestEnum
    {
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
        FValue = 17
    }
}

var greeter = new Sayings.Greeter<string>("world");