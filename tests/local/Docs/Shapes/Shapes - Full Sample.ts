/// <reference path="lib.d.ts" />

module penuts
{
    export var x = 1;
}
module Sayings
{
    import x = penuts.x;

    export class Greeter {
        greeting: string;
        constructor(message: string) {
            this.greeting = message;
        }
        greet() {
            return "Hello, " + this.greeting;
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

var greeter = new Sayings.Greeter("world");

var button = document.createElement('button');
button.textContent = "Say Hello";
button.onclick = function() {
    alert(greeter.greet());
};

document.body.appendChild(button);