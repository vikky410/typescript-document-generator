/// <reference path='fourslash.ts'/>

////class C {
////    public foo(x: string);
////    public foo(x: number);
////    public foo(x: any) { return x; }
////}

////interface I extends C {
////    other(x: any): any;
////}

////var i: I;
////i.foo(/**/

goTo.marker();
verify.currentSignatureHelpCountIs(2);
verify.currentParameterHelpType('string');