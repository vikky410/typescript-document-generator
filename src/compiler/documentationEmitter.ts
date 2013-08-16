//
// Copyright (c) Edward Nutting.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

///<reference path='typescript.ts' />

module TypeScript {
    export class DocumentationEmitter
    {
        private static debugMessage(text: string): void
        {
            //process.stdout.write(text);
        }

        private docFile: TextWriter = null;
        private indenter = new Indenter();
        private declarationContainerStack: AST[] = [];
        private isDottedModuleName: boolean[] = [];
        private dottedModuleEmit: string;
        private ignoreCallbackAst: AST = null;
        private varListCount: number = 0;
        private emittedReferencePaths = false;

        private rootDocBlock: DocumentationBlock = new DocumentationBlock(DocumentationBlockTypes.Script, "", BlockSignatures.PublicStatic, null);
        private currentBlock: DocumentationBlock = this.rootDocBlock;

        constructor(private emittingFileName: string, public document: Document, private compiler: TypeScriptCompiler)
        {
            this.docFile = new TextWriter(this.compiler.emitOptions.ioHost, emittingFileName, this.document.byteOrderMark !== ByteOrderMark.None);
            DocumentationEmitter.debugMessage("Creating documentation for " + emittingFileName + " \r\n");

            this.addReference(document.fileName);
        }

        public widenType(type: PullTypeSymbol)
        {
            if (type === this.compiler.semanticInfoChain.undefinedTypeSymbol || type === this.compiler.semanticInfoChain.nullTypeSymbol)
            {
                return this.compiler.semanticInfoChain.anyTypeSymbol;
            }

            return type;
        }

        public close()
        {
            try
            {
                //TODO: Emit documentation into separate wiki files for each class/interface/enum
                //TODO: Into the main doc, emit either the class/interface/enum of the same name or references to the other emitted doc files.
                this.walkDocumentationTree();

                this.docFile.Close();
            }
            catch (e)
            {
                Emitter.throwEmitterError(e);
            }
        }
        private numUnimplementedBlocks: number = 0;
        private numUnrecognisedBlocks: number = 0;
        private numInvalidBlocks: number = 0;

        //New
        private walkDocumentationTree(root = this.rootDocBlock): void
        {
            DocumentationEmitter.debugMessage("\r\n[------ Walking documentation tree; Root type: " + DocumentationBlockTypes[root.Type] + " ------]\r\n");

            for (var i = 0; i < root.Children.length; i++)
            {
                var child = root.Children[i];

                DocumentationEmitter.debugMessage("Walking block: " +
                    (child.parent ? DocumentationBlockTypes[child.parent.Type] : "None") +
                    "->" + DocumentationBlockTypes[child.Type] + "\r\n");

                switch (child.Type)
                {
                    case DocumentationBlockTypes.Module:
                        this.walkModuleDocumentationTree(child);
                        break;
                    case DocumentationBlockTypes.Class:
                        this.walkClassDocumentationTree(child);
                        break;
                    case DocumentationBlockTypes.Interface:
                        this.walkInterfaceDocumentationTree(child);
                        break;
                    case DocumentationBlockTypes.Enum:
                        this.walkEnumDocumentationTree(child);
                        break;
                    case DocumentationBlockTypes.Reference:
                        //Do nothing at this level
                        break;
                    case DocumentationBlockTypes.Argument:
                    case DocumentationBlockTypes.Constructor:
                    case DocumentationBlockTypes.Description:
                    case DocumentationBlockTypes.EnumValue:
                    case DocumentationBlockTypes.Exported:
                    case DocumentationBlockTypes.Extends:
                    case DocumentationBlockTypes.Implements:
                    case DocumentationBlockTypes.Returns:
                        this.numInvalidBlocks++;
                        //this.docFile.WriteLine("INVALID_BLOCK: Type:" + DocumentationBlockTypes[child.Type] + ", Text: " + child.Text);
                        break;
                    case DocumentationBlockTypes.Function:
                    case DocumentationBlockTypes.Import:
                    case DocumentationBlockTypes.Property:
                        this.numUnimplementedBlocks++;
                        //this.docFile.WriteLine("UNIMPLEMENTED: Type:" + DocumentationBlockTypes[child.Type] + ", Text: " + child.Text);
                        break;
                    default:
                        this.numUnrecognisedBlocks++;
                        //this.docFile.WriteLine("UNRECOGNISED: Type:" + DocumentationBlockTypes[child.Type] + ", Text: " + child.Text);
                        break;
                }
            }

            if (process !== undefined)
            {
                process.stdout.write("INVALID: " + this.numInvalidBlocks + "; UNIMPLEMENTED: " + this.numUnimplementedBlocks + "; UNRECOGNISED: " + this.numUnrecognisedBlocks + "\r\n");
            }
        }
        //New
        private walkModuleDocumentationTree(root: DocumentationBlock)
        {
            DocumentationEmitter.debugMessage("Walking module tree; Root type: " + DocumentationBlockTypes[root.Type] + "\r\n");
            this.walkDocumentationTree(root);
        }
        private restoreDocFileRequired = false;
        private oldDocFile: TextWriter = null;
        //New
        private createNewDocFile(wrapperName: string)
        {
            var fileName = this.getWrapperFileName(wrapperName);
            if (fileName !== this.emittingFileName)
            {
                this.oldDocFile = this.docFile;
                DocumentationEmitter.debugMessage("Creating documentation for " + fileName + " \r\n");
                this.docFile = new TextWriter(this.compiler.emitOptions.ioHost, fileName, this.document.byteOrderMark !== ByteOrderMark.None);
                this.restoreDocFileRequired = true;
            }
        }
        //New
        private restoreDocFile()
        {
            if (this.restoreDocFileRequired)
            {
                this.docFile = this.oldDocFile;
                this.oldDocFile = null;
                this.restoreDocFileRequired = false;
            }
        }
        //New
        private getWrapperFileName(wrapperName: string)
        {
            //Replace invalid characters with underscores
            wrapperName = wrapperName.trim().replace(/[\\/:*?"<>|]+/g, "_");
            var index = this.emittingFileName.lastIndexOf("/");
            var emittingFileNameOnly = this.emittingFileName.substring(index + 1);
            if (emittingFileNameOnly.split('.')[0] !== wrapperName)
            {
                var fileName = this.emittingFileName.substring(0, index) + "/" + emittingFileNameOnly.replace(/[\.]+/g, "_");
                fileName = fileName + "/" + wrapperName + ".ts";
                fileName = TypeScriptCompiler.mapToDocTSFileName(fileName, false);
                return fileName;
            }
            else
            {
                return this.emittingFileName;
            }
        }
        //New
        private walkClassDocumentationTree(root: DocumentationBlock)
        {
            DocumentationEmitter.debugMessage("\r\n[------ Walking class tree; Root type: " + DocumentationBlockTypes[root.Type] + " ------]\r\n");

            this.createNewDocFile(root.Text);

            this.writeHeader(root.Text);
            this.searchForAndWalkModule(root);
            this.searchForAndWalkExtends(root);
            this.searchForAndWalkImplements(root);
            this.searchForAndWalkExported(root);
            this.searchForAndWalkReferences();
            this.writeDivider();
            if (root.NumChildrenOfType[DocumentationBlockTypes.Description] > 0)
            {
                this.searchForAndWalkMainDescription(root);
                this.writeDivider();
            }
            if (root.NumChildrenOfType[DocumentationBlockTypes.Constructor] > 0)
            {
                this.searchForAndWalkConstructors(root);
                this.writeDivider();
            }
            if (root.NumChildrenOfType[DocumentationBlockTypes.Property] > 0)
            {
                this.searchForAndWalkProperties(root);
                this.writeDivider();
            }
            if (root.NumChildrenOfType[DocumentationBlockTypes.Function] > 0)
            {
                this.searchForAndWalkMethods(root);
                this.writeDivider();
            }
            
            DocumentationEmitter.debugMessage("Finished walking class.\r\n\r\n");

            this.docFile.Close();

            this.restoreDocFile();
        }
        //New
        private walkInterfaceDocumentationTree(root: DocumentationBlock)
        {
            DocumentationEmitter.debugMessage("\r\n[------ Walking interface tree; Root type: " + DocumentationBlockTypes[root.Type] + " ------]\r\n");

            this.createNewDocFile(root.Text);

            this.writeHeader(root.Text);
            this.searchForAndWalkModule(root);
            this.searchForAndWalkExtends(root);
            this.searchForAndWalkImplements(root);
            this.searchForAndWalkExported(root);
            this.searchForAndWalkReferences();
            this.writeDivider();
            if (root.NumChildrenOfType[DocumentationBlockTypes.Description] > 0)
            {
                this.searchForAndWalkMainDescription(root);
                this.writeDivider();
            }
            if (root.NumChildrenOfType[DocumentationBlockTypes.Constructor] > 0)
            {
                this.searchForAndWalkConstructors(root);
                this.writeDivider();
            }
            if (root.NumChildrenOfType[DocumentationBlockTypes.Property] > 0)
            {
                this.searchForAndWalkProperties(root, BlockSignatures.Public);
                this.writeDivider();
            }
            if (root.NumChildrenOfType[DocumentationBlockTypes.Function] > 0)
            {
                this.searchForAndWalkMethods(root, BlockSignatures.Public);
                this.writeDivider();
            }

            DocumentationEmitter.debugMessage("Finished walking interface.\r\n\r\n");

            this.docFile.Close();

            this.restoreDocFile();
        }
        //New
        private walkEnumDocumentationTree(root: DocumentationBlock): void
        {
            DocumentationEmitter.debugMessage("\r\n[------ Walking enum tree; Root type: " + DocumentationBlockTypes[root.Type] + " ------]\r\n");

            this.createNewDocFile(root.Text);

            this.writeHeader(root.Text);
            this.searchForAndWalkModule(root);
            this.searchForAndWalkExtends(root);
            this.searchForAndWalkImplements(root);
            this.searchForAndWalkExported(root);
            this.searchForAndWalkReferences();
            this.writeDivider();
            this.searchForAndWalkMainDescription(root);
            this.writeDivider();
            this.searchForAndWalkEnumValues(root);
            this.writeDivider();

            DocumentationEmitter.debugMessage("Finished walking enum.\r\n\r\n");

            this.docFile.Close();

            this.restoreDocFile();
        }
        //New
        private searchForAndWalkReferences()
        {
            this.writeReferenceHeader();

            var root = this.rootDocBlock;
            for (var i = 0; i < root.Children.length; i++)
            {
                var child = root.Children[i];

                switch (child.Type)
                {
                    case DocumentationBlockTypes.Reference:
                        this.writeReferenceBullet(child.Text);
                        DocumentationEmitter.debugMessage("Walking block: " +
                            (child.parent ? DocumentationBlockTypes[child.parent.Type] : "None") +
                            "->" + DocumentationBlockTypes[child.Type] + "\r\n");
                        break;
                    default:
                        break;
                }
            }
        }
        //New
        private searchForAndWalkModule(root: DocumentationBlock)
        {
            this.docFile.Write("*Module:* ");

            var found = false;
            for (var i = 0; i < root.Children.length; i++)
            {
                var child = root.Children[i];

                switch (child.Type)
                {
                    case DocumentationBlockTypes.Module:
                        this.docFile.WriteLine(child.Text);
                        DocumentationEmitter.debugMessage("Walking block: " +
                            (child.parent ? DocumentationBlockTypes[child.parent.Type] : "None") +
                            "->" + DocumentationBlockTypes[child.Type] + "\r\n");
                        break;
                    default:
                        break;
                }

                if (found)
                {
                    break;
                }
            }
        }
        //New
        private searchForAndWalkExtends(root: DocumentationBlock)
        {
            this.currentBlock.Write("*Extends:* ");

            var found = false;
            for (var i = 0; i < root.Children.length; i++)
            {
                var child = root.Children[i];

                switch (child.Type)
                {
                    case DocumentationBlockTypes.Extends:
                        this.docFile.WriteLine(child.Text);
                        DocumentationEmitter.debugMessage("Walking block: " +
                            (child.parent ? DocumentationBlockTypes[child.parent.Type] : "None") +
                            "->" + DocumentationBlockTypes[child.Type] + "\r\n");
                        break;
                    default:
                        break;
                }

                if (found)
                {
                    break;
                }
            }
        }
        //New
        private searchForAndWalkImplements(root: DocumentationBlock)
        {
            this.currentBlock.Write("*Implements:* ");

            var found = false;
            for (var i = 0; i < root.Children.length; i++)
            {
                var child = root.Children[i];

                switch (child.Type)
                {
                    case DocumentationBlockTypes.Implements:
                        this.docFile.WriteLine(child.Text);
                        found = true;
                        DocumentationEmitter.debugMessage("Walking block: " +
                            (child.parent ? DocumentationBlockTypes[child.parent.Type] : "None") +
                            "->" + DocumentationBlockTypes[child.Type] + "\r\n");
                        break;
                    default:
                        break;
                }

                if (found)
                {
                    break;
                }
            }
        }
        //New
        private searchForAndWalkExported(root: DocumentationBlock)
        {
            var found = false;
            for (var i = 0; i < root.Children.length; i++)
            {
                var child = root.Children[i];

                switch (child.Type)
                {
                    case DocumentationBlockTypes.Exported:
                        this.docFile.WriteLine(child.Text);
                        found = true;
                        DocumentationEmitter.debugMessage("Walking block: " +
                            (child.parent ? DocumentationBlockTypes[child.parent.Type] : "None") +
                            "->" + DocumentationBlockTypes[child.Type] + "\r\n");
                        break;
                    default:
                        break;
                }

                if (found)
                {
                    break;
                }
            }
        }
        //New
        private searchForAndWalkMainDescription(root: DocumentationBlock)
        {
            this.writeDescriptionSubHeader();

            this.searchForAndWalkDescription(root);
        }
        //New
        private searchForAndWalkDescription(root: DocumentationBlock)
        {
            for (var i = 0; i < root.Children.length; i++)
            {
                var child = root.Children[i];

                switch (child.Type)
                {
                    case DocumentationBlockTypes.Description:
                        this.writeDescription(child.Text);
                        DocumentationEmitter.debugMessage("Walking block: " +
                            (child.parent ? DocumentationBlockTypes[child.parent.Type] : "None") +
                            "->" + DocumentationBlockTypes[child.Type] + "\r\n");
                        break;
                    default:
                        break;
                }
            }
        }
        //New
        private searchForAndWalkEnumValues(root: DocumentationBlock)
        {
            this.writeValuesSubHeader();

            for (var i = 0; i < root.Children.length; i++)
            {
                var child = root.Children[i];

                switch (child.Type)
                {
                    case DocumentationBlockTypes.EnumValue:
                        this.docFile.WriteLine(child.Text);
                        DocumentationEmitter.debugMessage("Walking block: " +
                            (child.parent ? DocumentationBlockTypes[child.parent.Type] : "None") +
                            "->" + DocumentationBlockTypes[child.Type] + "\r\n");
                        break;
                    default:
                        break;
                }
            }
        }
        //New
        private searchForAndWalkConstructors(root: DocumentationBlock)
        {
            this.writeConstructorsSubHeader();

            for (var i = 0; i < root.Children.length; i++)
            {
                var child = root.Children[i];

                switch (child.Type)
                {
                    case DocumentationBlockTypes.Constructor:
                        this.writeMethod(child);
                        DocumentationEmitter.debugMessage("Walking block: " +
                            (child.parent ? DocumentationBlockTypes[child.parent.Type] : "None") +
                            "->" + DocumentationBlockTypes[child.Type] + "\r\n");
                        break;
                    default:
                        break;
                }
            }
        }
        //New 
        private searchForAndWalkProperties(root: DocumentationBlock, forcedSig: BlockSignatures = null)
        {
            var PrivateProperties = new Array<DocumentationBlock>();
            var PublicProperties = new Array<DocumentationBlock>();
            var PrivateStaticProperties = new Array<DocumentationBlock>();
            var PublicStaticProperties = new Array<DocumentationBlock>();

            for (var i = 0; i < root.Children.length; i++)
            {
                var child = root.Children[i];

                switch (child.Type)
                {
                    case DocumentationBlockTypes.Property:
                        var sig = !!forcedSig ? forcedSig : child.Visiblity;
                        
                        switch (sig)
                        {
                            case BlockSignatures.Private:
                                PrivateProperties.push(child);
                                break;
                            case BlockSignatures.Public:
                                PublicProperties.push(child);
                                break;
                            case BlockSignatures.PrivateStatic:
                                PrivateStaticProperties.push(child);
                                break;
                            case BlockSignatures.PublicStatic:
                                PublicStaticProperties.push(child);
                                break;
                        }

                        DocumentationEmitter.debugMessage("Walking block: " +
                            (child.parent ? DocumentationBlockTypes[child.parent.Type] : "None") +
                            "->" + DocumentationBlockTypes[child.Type] + "\r\n");
                        break;
                    default:
                        break;
                }
            }

            if (PrivateProperties.length > 0)
            {
                this.writePropertiesSubHeader(BlockSignatures.Private);
                for (var i = 0; i < PrivateProperties.length; i++)
                {
                    this.writeProperty(PrivateProperties[i]);
                }
            }
            if (PublicProperties.length > 0)
            {
                this.writePropertiesSubHeader(BlockSignatures.Public);
                for (var i = 0; i < PublicProperties.length; i++)
                {
                    this.writeProperty(PublicProperties[i]);
                }
            }
            if (PrivateStaticProperties.length > 0)
            {
                this.writePropertiesSubHeader(BlockSignatures.PrivateStatic);
                for (var i = 0; i < PrivateStaticProperties.length; i++)
                {
                    this.writeProperty(PrivateStaticProperties[i]);
                }
            }
            if (PublicStaticProperties.length > 0)
            {
                this.writePropertiesSubHeader(BlockSignatures.PublicStatic);
                for (var i = 0; i < PublicStaticProperties.length; i++)
                {
                    this.writeProperty(PublicStaticProperties[i]);
                }
            }
        }
        //New 
        private searchForAndWalkMethods(root: DocumentationBlock, forcedSig: BlockSignatures = null)
        {
            var PrivateMethods = new Array<DocumentationBlock>();
            var PublicMethods = new Array<DocumentationBlock>();
            var PrivateStaticMethods = new Array<DocumentationBlock>();
            var PublicStaticMethods = new Array<DocumentationBlock>();

            for (var i = 0; i < root.Children.length; i++)
            {
                var child = root.Children[i];

                switch (child.Type)
                {
                    case DocumentationBlockTypes.Function:
                        var sig = !!forcedSig ? forcedSig : child.Visiblity;

                        switch (sig)
                        {
                            case BlockSignatures.Private:
                                PrivateMethods.push(child);
                                break;
                            case BlockSignatures.Public:
                                PublicMethods.push(child);
                                break;
                            case BlockSignatures.PrivateStatic:
                                PrivateStaticMethods.push(child);
                                break;
                            case BlockSignatures.PublicStatic:
                                PublicStaticMethods.push(child);
                                break;
                        }

                        DocumentationEmitter.debugMessage("Walking block: " +
                            (child.parent ? DocumentationBlockTypes[child.parent.Type] : "None") +
                            "->" + DocumentationBlockTypes[child.Type] + "\r\n");
                        break;
                    default:
                        break;
                }
            }

            if (PrivateMethods.length > 0)
            {
                this.writeMethodsSubHeader(BlockSignatures.Private);
                for (var i = 0; i < PrivateMethods.length; i++)
                {
                    this.writeMethod(PrivateMethods[i]);
                }
            }
            if (PublicMethods.length > 0)
            {
                this.writeMethodsSubHeader(BlockSignatures.Public);
                for (var i = 0; i < PublicMethods.length; i++)
                {
                    this.writeMethod(PublicMethods[i]);
                }
            }
            if (PrivateStaticMethods.length > 0)
            {
                this.writeMethodsSubHeader(BlockSignatures.PrivateStatic);
                for (var i = 0; i < PrivateStaticMethods.length; i++)
                {
                    this.writeMethod(PrivateStaticMethods[i]);
                }
            }
            if (PublicStaticMethods.length > 0)
            {
                this.writeMethodsSubHeader(BlockSignatures.PublicStatic);
                for (var i = 0; i < PublicStaticMethods.length; i++)
                {
                    this.writeMethod(PublicStaticMethods[i]);
                }
            }
        }
        //New
        private searchForAndWalkArguments(root: DocumentationBlock)
        {
            for (var i = 0; i < root.Children.length; i++)
            {
                var child = root.Children[i];

                switch (child.Type)
                {
                    case DocumentationBlockTypes.Argument:
                        this.writeArgument(child);
                        DocumentationEmitter.debugMessage("Walking block: " +
                            (child.parent ? DocumentationBlockTypes[child.parent.Type] : "None") +
                            "->" + DocumentationBlockTypes[child.Type] + "\r\n");
                        break;
                    default:
                        break;
                }
            }
        }
        //New
        private searchForAndWalkReturns(root: DocumentationBlock)
        {
            for (var i = 0; i < root.Children.length; i++)
            {
                var child = root.Children[i];

                switch (child.Type)
                {
                    case DocumentationBlockTypes.Returns:
                        this.writeReturns(child);
                        DocumentationEmitter.debugMessage("Walking block: " +
                            (child.parent ? DocumentationBlockTypes[child.parent.Type] : "None") +
                            "->" + DocumentationBlockTypes[child.Type] + "\r\n");
                        break;
                    default:
                        break;
                }
            }
        }

        //Unmodified
        public emitDocumentation(script: TypeScript.Script): void
        {
            var walk = (pre: boolean, ast: AST): boolean =>
            {
                switch (ast.nodeType())
                {
                    case NodeType.VariableStatement:
                        return this.variableStatementCallback(pre, <VariableStatement>ast);
                    case NodeType.VariableDeclaration:
                        return this.variableDeclarationCallback(pre, <VariableDeclaration>ast);
                    case NodeType.VariableDeclarator:
                        return this.variableDeclaratorCallback(pre, <VariableDeclarator>ast);
                    case NodeType.Block:
                        return this.blockCallback(pre, <Block>ast);
                    case NodeType.FunctionDeclaration:
                        return this.functionDeclarationCallback(pre, <FunctionDeclaration>ast);
                    case NodeType.ClassDeclaration:
                        return this.classDeclarationCallback(pre, <ClassDeclaration>ast);
                    case NodeType.InterfaceDeclaration:
                        return this.interfaceDocumentationCallback(pre, <InterfaceDeclaration>ast);
                    case NodeType.ImportDeclaration:
                        return this.importDocumentationCallback(pre, <ImportDeclaration>ast);
                    case NodeType.ModuleDeclaration:
                        return this.moduleDeclarationCallback(pre, <ModuleDeclaration>ast);
                    case NodeType.ExportAssignment:
                        return this.exportAssignmentCallback(pre, <ExportAssignment>ast);
                    case NodeType.Script:
                        return this.scriptCallback(pre, <Script>ast);
                    default:
                        return this.defaultCallback(pre, ast);
                }
            };

            getAstWalkerFactory().walk(script,
                (ast: AST, parent: AST, walker: IAstWalker): AST => { walker.options.goChildren = walk(/*pre*/true, ast); return ast; },
                (ast: AST, parent: AST, walker: IAstWalker): AST => { walker.options.goChildren = walk(/*pre*/false, ast); return ast; });
        } 
        //New
        private addNewDocBlock(type: DocumentationBlockTypes, sig: BlockSignatures, level: number)
        {
            var parent: DocumentationBlock = this.currentBlock;
            for (var i = 1; i > level; i--)
            {
                if (!!parent.parent)
                {
                    parent = parent.parent;
                }
                else
                {
                    break;
                }
            }
            try
            {
                DocumentationEmitter.debugMessage("Adding doc block: Parent: " + DocumentationBlockTypes[parent.Type] + ", Type:" + DocumentationBlockTypes[type] + ", Level: " + level + "\r\n");
            }
            catch(ex)
            {
                DocumentationEmitter.debugMessage("Adding doc block: Parent: Error!, Type:" + DocumentationBlockTypes[type] + ", Level: " + level + "\r\n");
            }

            var newBlock = new DocumentationBlock(type, "", sig, parent);
            parent.Children.push(newBlock);
            if (parent.NumChildrenOfType[type])
            {
                parent.NumChildrenOfType[type]++;
            }
            else
            {
                parent.NumChildrenOfType[type] = 1;
            }
            
            this.currentBlock = newBlock;
        }
        //New
        private prepareForAdd(intendedParentType: DocumentationBlockTypes): boolean
        {
            if (this.currentBlock.Type !== intendedParentType && this.currentBlock.parent.Type === intendedParentType)
            {
                this.currentBlock = this.currentBlock.parent;
            }
            return this.currentBlock.Type !== intendedParentType;
        }

        //Confirmed
        public getAstDeclarationContainer()
        {
            return this.declarationContainerStack[this.declarationContainerStack.length - 1];
        }
        //Re-factored
        private shouldEmitDottedModuleName()
        {
            return (this.isDottedModuleName.length === 0) ? false : this.isDottedModuleName[this.isDottedModuleName.length - 1];
        }
        //Unmodified
        private getIndentString(declIndent = false)
        {
            return this.indenter.getIndent();
        }
        //Re-factored
        private writeIndent()
        {
            this.docFile.Write(this.getIndentString());
        }

        //New
        private writeDivider()
        {
            this.docFile.WriteLine("");
            this.docFile.WriteLine("----");
            this.docFile.WriteLine("");
        }
        //New
        private writeHeader(name: string)
        {
            this.docFile.WriteLine("{anchor:" + name + "}");
            this.docFile.WriteLine("!! {\"" + name + "\"}");
        }
        //New
        private writeSubHeaderL1(name: string)
        {
            this.docFile.WriteLine("!!!! {\"" + name + "\"}");
            this.docFile.WriteLine("");
        }
        //New
        private writeSubHeaderL2(name: string)
        {
            this.docFile.WriteLine("!!!!!! {\"" + name + "\"}");
            this.docFile.WriteLine("");
        }
        //New
        private writeDescriptionSubHeader()
        {
            this.writeSubHeaderL1("Description");
        }
        //New
        private writeConstructorsSubHeader()
        {
            this.writeSubHeaderL1("Constructors");
        }
        //New
        private writeValuesSubHeader()
        {
            this.writeSubHeaderL1("Values");
        }
        //New
        private writePropertiesSubHeader(sig: BlockSignatures)
        {
            this.writeSubHeaderL1(BlockSignatures[sig].replace(/([A-Z]+)/, " $1").trim() + " Properties");
        }
        //New
        private writeMethodsSubHeader(sig: BlockSignatures)
        {
            this.writeSubHeaderL1(BlockSignatures[sig].replace(/([A-Z]+)/, " $1").trim() + " Methods");
        }

        //New
        private writeDescription(text: string)
        {
            if (text.indexOf("{\"") !== 0)
            {
                this.docFile.Write("{\"");
            }
            this.docFile.Write(text.trim());
            if (text.indexOf("\"}") !== text.length - 2)
            {
                this.docFile.Write("\"}");
            }
            this.docFile.Write("\r\n");
        }
        //New
        private writeProperty(root: DocumentationBlock)
        {
            this.docFile.Write("!!!!!! ");
            if (root.Text.indexOf("{\"") !== 0)
            {
                this.docFile.Write("{\"");
            }
            this.docFile.Write(root.Text);
            if (root.Text.indexOf("\"}") !== root.Text.length - 2)
            {
                this.docFile.Write("\"}");
            }
            this.docFile.WriteLine("");
            this.searchForAndWalkDescription(root);
            this.docFile.WriteLine("");
        }
        //New
        private writeMethod(root: DocumentationBlock)
        {
            this.docFile.Write("!!!!!! ");
            this.docFile.WriteLine(root.Text);
            this.searchForAndWalkDescription(root);
            this.searchForAndWalkArguments(root);
            this.searchForAndWalkReturns(root);
            this.docFile.WriteLine("");
        }
        //New
        private writeArgument(root: DocumentationBlock)
        {
            this.docFile.Write("* ");
            this.docFile.Write(root.Text);
            this.docFile.WriteLine("");
        }
        //New
        private writeReturns(root: DocumentationBlock)
        {
            this.docFile.Write("* ");
            this.docFile.Write(root.Text);
            this.docFile.WriteLine("");
        }

        //Modified - Always returns true - should mean everything (provate, public or exported) gets outputted
        private canEmitSignature(declFlags: DeclFlags, declAST: AST, canEmitGlobalAmbientDecl: boolean = true, useDeclarationContainerTop: boolean = true)
        {
            return true;

            var container: AST;
            if (useDeclarationContainerTop)
            {
                container = this.getAstDeclarationContainer();
            }
            else
            {
                container = this.declarationContainerStack[this.declarationContainerStack.length - 2];
            }

            var pullDecl = this.compiler.semanticInfoChain.getDeclForAST(declAST, this.document.fileName);
            if (container.nodeType() === NodeType.ModuleDeclaration)
            {
                if (!hasFlag(pullDecl.flags, PullElementFlags.Exported))
                {
                    var start = new Date().getTime();
                    var declSymbol = this.compiler.semanticInfoChain.getSymbolForAST(declAST, this.document.fileName);
                    var result = declSymbol && declSymbol.isExternallyVisible();
                    TypeScript.declarationEmitIsExternallyVisibleTime += new Date().getTime() - start;

                    return result;
                }
            }

            if (!canEmitGlobalAmbientDecl && container.nodeType() === NodeType.Script && hasFlag(pullDecl.flags, PullElementFlags.Ambient))
            {
                return false;
            }

            return true;
        }

        //Unmodified
        private canEmitPrePostAstSignature(declFlags: DeclFlags, astWithPrePostCallback: AST, preCallback: boolean)
        {
            if (this.ignoreCallbackAst)
            {
                CompilerDiagnostics.assert(this.ignoreCallbackAst !== astWithPrePostCallback, "Ignore Callback AST mismatch");
                this.ignoreCallbackAst = null;
                return false;
            }
            else if (preCallback &&
                !this.canEmitSignature(declFlags, astWithPrePostCallback, true, preCallback))
            {
                this.ignoreCallbackAst = astWithPrePostCallback;
                return false;
            }

            return true;
        }

        //Unmodified
        private getDeclFlagsString(declFlags: DeclFlags, pullDecl: PullDecl, typeString: string)
        {
            var result = this.getIndentString();
            var pullFlags = pullDecl.flags;

            // Static/public/private/global declare
            if (hasFlag(declFlags, DeclFlags.Static))
            {
                if (hasFlag(declFlags, DeclFlags.Private))
                {
                    result += "private ";
                }
                result += "static ";
            }
            else
            {
                if (hasFlag(declFlags, DeclFlags.Private))
                {
                    result += "private ";
                }
                else if (hasFlag(declFlags, DeclFlags.Public))
                {
                    result += "public ";
                }
                else
                {
                    var emitDeclare = !hasFlag(pullFlags, PullElementFlags.Exported);

                    // Emit export only for global export statements. 
                    // The container for this would be dynamic module which is whole file
                    var container = this.getAstDeclarationContainer();
                    if (container.nodeType() === NodeType.ModuleDeclaration &&
                        hasFlag((<ModuleDeclaration>container).getModuleFlags(), ModuleFlags.IsWholeFile) &&
                        hasFlag(pullFlags, PullElementFlags.Exported))
                    {
                        result += "export ";
                        emitDeclare = true;
                    }

                    // Emit declare if not interface declaration or import declaration && is not from module
                    if (emitDeclare && typeString !== "interface" && typeString != "import")
                    {
                        result += "declare ";
                    }

                    result += typeString + " ";
                }
            }

            return result;
        }

        //Modified, Refactored - Sets current doc block signature
        private setDocBlockDeclFlags(declFlags: DeclFlags, pullDecl: PullDecl, typeString: string)
        {
            var flagsStr = this.getDeclFlagsString(declFlags, pullDecl, typeString);
            var isPublic = flagsStr.indexOf("public") > -1 || flagsStr.indexOf("export") > -1;
            if (flagsStr.indexOf("static") > -1)
            {
                if (isPublic)
                {
                    this.currentBlock.Visiblity = BlockSignatures.PublicStatic;
                }
                else
                {
                    this.currentBlock.Visiblity = BlockSignatures.PrivateStatic;
                }
            }
            else
            {
                if (isPublic)
                {
                    this.currentBlock.Visiblity = BlockSignatures.Public;
                }
                else
                {
                    this.currentBlock.Visiblity = BlockSignatures.Private;
                }
            }
        }

        //Unmodified
        private canEmitTypeAnnotationSignature(declFlag: DeclFlags = DeclFlags.None)
        {
            // Private documentation, shouldnt emit type any time.
            return !hasFlag(declFlag, DeclFlags.Private);
        }

        //Unmodified
        private pushDeclarationContainer(ast: AST)
        {
            this.declarationContainerStack.push(ast);
        }

        //Unmodified
        private popDeclarationContainer(ast: AST)
        {
            CompilerDiagnostics.assert(ast !== this.getAstDeclarationContainer(), 'Declaration container mismatch');
            this.declarationContainerStack.pop();
        }

        //Modified - Complete - Emits to current doc block
        //This emits the type of a function/parameter/variable/property/extends/implements
        public emitTypeNamesMember(memberName: MemberName, emitIndent: boolean = false)
        {
            if (memberName.prefix !== "")
            {
                this.currentBlock.Write(memberName.prefix.trim());
                if (memberName.prefix.trim() === "{")
                {
                    this.currentBlock.WriteLine("");
                }
            }

            if (memberName.isString())
            {
                this.currentBlock.Write((<MemberNameString>memberName).text);
            }
            else if (memberName.isArray())
            {
                var ar = <MemberNameArray>memberName;
                for (var index = 0; index < ar.entries.length; index++)
                {
                    this.emitTypeNamesMember(ar.entries[index], emitIndent);
                    if (ar.delim === "; ")
                    {
                        this.currentBlock.WriteLine(";");
                    }
                }
            }

            this.currentBlock.Write(memberName.suffix.trim());
            if (memberName.suffix.trim() === "}")
            {
                this.currentBlock.WriteLine("");
            }
        }

        //Modified - Complete - Calls emitTypeNamesMember
        private emitTypeSignature(type: PullTypeSymbol)
        {
            var declarationContainerAst = this.getAstDeclarationContainer();

            var start = new Date().getTime();
            var declarationContainerDecl = this.compiler.semanticInfoChain.getDeclForAST(declarationContainerAst, this.document.fileName);
            var documentationPullSymbol = declarationContainerDecl.getSymbol();
            TypeScript.declarationEmitTypeSignatureTime += new Date().getTime() - start;

            var typeNameMembers = type.getScopedNameEx(documentationPullSymbol);
            this.emitTypeNamesMember(typeNameMembers);
        }

        //Modified - Complete - Emits to current doc block, Strips comment delimeters, Can remove new lines
        private emitComment(comment: Comment, oneLine = false)
        {
            var text = comment.getText();

            this.currentBlock.Write(this.stripCommentDelimiters(text[0]));

            for (var i = 1; i < text.length; i++)
            {
                if (!oneLine)
                {
                    this.currentBlock.WriteLine("");
                }
                this.currentBlock.Write(this.stripCommentDelimiters(text[i], true));
            }
        }
        //New - Complete - Removes comment delimeters from beginning/end of string e.g. /**, //, */
        private stripCommentDelimiters(comment: string, endOnly: boolean = false): string
        {
            comment = comment.trim();
            if (!endOnly)
            {
                if (comment.indexOf("//") === 0)
                {
                    comment = comment.substr(2, comment.length - 2);
                }
                else if (comment.indexOf("/**") === 0)
                {
                    comment = comment.substr(3, comment.length - 3);
                }
                else if (comment.indexOf("/*") === 0)
                {
                    comment = comment.substr(2, comment.length - 2);
                }
            }
            if (comment.indexOf("*/") > -1)
            {
                comment = comment.substr(0, comment.length - 2);
            }

            comment = comment.trim();

            return comment;
        }

        //Modified, Refactored (from emitDocumentationComments) - Complete - Calls emitDocumentationComments
        private emitSymbolDocumentationComments(ast: AST, endLine?: boolean, oneLine?: boolean): void;
        private emitSymbolDocumentationComments(astOrSymbol: any, endLine = true, oneLine = false)
        {
            if (this.compiler.emitOptions.compilationSettings.removeComments)
            {
                return;
            }

            var declComments = <Comment[]>astOrSymbol.docComments();
            this.emitDocumentationComments(declComments, endLine, oneLine);
        }
        //New
        private emitFunctionDocumentationComments(funcDecl: FunctionDeclaration, endLine = true, oneLine = false)
        {
            var declComments = <Comment[]>funcDecl.docComments();

            if (declComments.length > 0)
            {
                var docComments = new Array<Comment>();
                for (var i = 0; i < declComments.length; i++)
                {
                    var lines = declComments[i].getText();
                    for (var j = 0; j < lines.length; j++)
                    {
                        var text = lines[j].trim();
                        if(text.indexOf("/**") === 0)
                        {
                            text = text.substring(3);
                        }
                        if (text.lastIndexOf("*/") === text.length - 2)
                        {
                            text = text.substring(0, text.length - 2);
                        }
                        text = text.trim();
                        if (text.indexOf("@param ") !== 0 &&
                            text.indexOf("@returns ") !== 0)
                        {
                            docComments.push(new Comment(text, false, true));
                        }
                    }
                }

                this.emitDocumentationComments(docComments, endLine, oneLine);
            }
        }
        //New
        private emitArgumentDocumentationComments(argName: string, funcDecl: FunctionDeclaration, endLine = true, oneLine = false)
        {
            var declComments = <Comment[]>funcDecl.docComments();

            if (declComments.length > 0)
            {
                var docComments = new Array<Comment>();
                for (var i = 0; i < declComments.length; i++)
                {
                    var lines = declComments[i].getText();
                    for (var j = 0; j < lines.length; j++)
                    {
                        var text = lines[j].trim();
                        if (text.indexOf("/**") === 0)
                        {
                            text = text.substring(3);
                        }
                        if (text.lastIndexOf("*/") === text.length - 2)
                        {
                            text = text.substring(0, text.length - 2);
                        }
                        text = text.trim();
                        if (text.indexOf("@param ") === 0)
                        {
                            text = text.substring(7).trim();
                            var parts = text.split(' ');
                            if (parts[0].trim() === argName.trim())
                            {
                                docComments.push(new Comment(text.substring(parts[0].length + 1), false, false));
                            }
                        }
                    }
                }

                this.emitDocumentationComments(docComments, endLine, oneLine);
            }
        }
        //New
        private emitReturnsDocumentationComments(funcDecl: FunctionDeclaration, endLine = true, oneLine = false)
        {
            var declComments = <Comment[]>funcDecl.docComments();

            if (declComments.length > 0)
            {
                var docComments = new Array<Comment>();
                for (var i = 0; i < declComments.length; i++)
                {
                    var lines = declComments[i].getText();
                    for (var j = 0; j < lines.length; j++)
                    {
                        var text = lines[j].trim();
                        if (text.indexOf("/**") === 0)
                        {
                            text = text.substring(3);
                        }
                        if (text.lastIndexOf("*/") === text.length - 2)
                        {
                            text = text.substring(0, text.length - 2);
                        }
                        text = text.trim();
                        if (text.indexOf("@returns ") === 0)
                        {
                            text = text.substring(9).trim();
                            docComments.push(new Comment(text, false, false));
                        }
                    }
                }

                this.emitDocumentationComments(docComments, endLine, oneLine);
            }
        }

        //Modified, Refactored (from writeDocumentationComments) - Complete - Calls emitComment, Handles esndLine
        public emitDocumentationComments(declComments: Comment[], endLine = true, oneLine = false)
        {
            if (declComments.length > 0)
            {
                for (var i = 0; i < declComments.length; i++)
                {
                    this.emitComment(declComments[i], oneLine);
                }

                if (endLine)
                {
                    if (!this.docFile.onNewLine)
                    {
                        this.currentBlock.WriteLine("");
                    }
                }
            }
        }

        //Modified - Incomplete - Emits to current doc block
        //This would be a good place to begin store of type for a function/parameter/variable/property
        public emitTypeOfBoundDecl(boundDecl: BoundDecl, includeColon: boolean = true)
        {
            var start = new Date().getTime();
            var decl = this.compiler.semanticInfoChain.getDeclForAST(boundDecl, this.document.fileName);
            var pullSymbol = decl.getSymbol();
            TypeScript.declarationEmitGetBoundDeclTypeTime += new Date().getTime() - start;

            var type = this.widenType(pullSymbol.type);
            if (!type)
            {
                // PULLTODO
                return;
            }

            if (boundDecl.typeExpr || // Specified type expression
                (boundDecl.init && type !== this.compiler.semanticInfoChain.anyTypeSymbol))
            { // Not infered any
                if (includeColon)
                {
                    this.currentBlock.Write(": ");
                }
                this.emitTypeSignature(type);
            }

        }

        //Modified - Incomplete - Creates new block (same parent) then emits to current doc block
        //This seems to be emitting variable declarations (i.e. property declarations)
        private variableDeclaratorCallback(pre: boolean, varDecl: VariableDeclarator): boolean
        {
            if (pre && this.canEmitSignature(ToDeclFlags(varDecl.getVarFlags()), varDecl, false))
            {
                var interfaceMember = (this.getAstDeclarationContainer().nodeType() === NodeType.InterfaceDeclaration);

                this.addNewDocBlock(DocumentationBlockTypes.Property, BlockSignatures.Private, 1);

                if (!interfaceMember)
                {
                    // If it is var list of form var a, b, c = emit it only if count > 0 - which will be when emitting first var
                    // If it is var list of form  var a = varList count will be 0
                    if (this.varListCount >= 0)
                    {
                        this.setDocBlockDeclFlags(ToDeclFlags(varDecl.getVarFlags()), this.compiler.semanticInfoChain.getDeclForAST(varDecl, this.document.fileName), "var");
                        this.varListCount = -this.varListCount;
                    }

                    this.currentBlock.Write(varDecl.id.actualText);
                }
                else
                {
                    this.currentBlock.Write(varDecl.id.actualText);
                    if (hasFlag(varDecl.id.getFlags(), ASTFlags.OptionalName))
                    {
                        this.currentBlock.Write("?");
                    }
                }

                if (this.canEmitTypeAnnotationSignature(ToDeclFlags(varDecl.getVarFlags())))
                {
                    this.emitTypeOfBoundDecl(varDecl);
                }

                this.currentBlock.Write(";");

                this.emitDescription(varDecl);
                
                // emitted one var decl
                if (this.varListCount > 0)
                {
                    this.varListCount--;
                }
                else if (this.varListCount < 0)
                {
                    this.varListCount++;
                }

                this.currentBlock = this.currentBlock.parent;
            }
            return false;
        }

        //Unmodified
        private blockCallback(pre: boolean, block: Block): boolean
        {
            return false;
        }

        //Unmodified
        private variableStatementCallback(pre: boolean, variableStatement: VariableStatement): boolean
        {
            return true;
        }

        //Unmodified
        private variableDeclarationCallback(pre: boolean, variableDeclaration: VariableDeclaration): boolean
        {
            if (pre)
            {
                this.varListCount = variableDeclaration.declarators.members.length;
            }
            else
            {
                this.varListCount = 0;
            }

            return true;
        }

        //Modified - Complete - Emits text for function declaration, Emits new doc block for argument as a child
        private emitArgDecl(argDecl: Parameter, funcDecl: FunctionDeclaration)
        {

            //Write this to the current function block
            this.currentBlock.Write(argDecl.id.actualText);
            if (argDecl.isOptionalArg()) 
            {
                this.currentBlock.Write("?");
            }
            if (this.canEmitTypeAnnotationSignature(ToDeclFlags(funcDecl.getFunctionFlags())))
            {
                this.emitTypeOfBoundDecl(argDecl);
            }

            //Then re-write it beneath the current function block as an argument block with description
            this.addNewDocBlock(DocumentationBlockTypes.Argument, BlockSignatures.Private, 1);
            if (argDecl.isOptionalArg()) 
            {
                this.currentBlock.Write("[OPTIONAL] ");
            }
            this.currentBlock.Write("*{\"" + argDecl.id.actualText + ":\"}* {\"");
            this.emitTypeOfBoundDecl(argDecl, false);
            this.currentBlock.Write(" - ");
            this.emitArgumentDocumentationComments(argDecl.id.actualText, funcDecl, true);
            this.currentBlock.Write("\"}");

            //Reset the current block back to the function block to continue for the remaining arguments
            this.currentBlock = this.currentBlock.parent;
        }

        //Unmodified
        public isOverloadedCallSignature(funcDecl: FunctionDeclaration)
        {
            var start = new Date().getTime();
            var functionDecl = this.compiler.semanticInfoChain.getDeclForAST(funcDecl, this.document.fileName);
            var funcSymbol = functionDecl.getSymbol();
            TypeScript.declarationEmitIsOverloadedCallSignatureTime += new Date().getTime() - start;

            var funcTypeSymbol = funcSymbol.type;
            var signatures = funcTypeSymbol.getCallSignatures();
            var result = signatures && signatures.length > 1;

            return result;
        }

        //Modified - Incomplete - Adds new doc block for function
        private functionDeclarationCallback(pre: boolean, funcDecl: FunctionDeclaration): boolean
        {
            var addedFuncBlock: boolean = false;

            if (!pre)
            {
                return false;
            }

            if (funcDecl.isAccessor())
            {
                return this.emitPropertyAccessorSignature(funcDecl);
            }

            var isInterfaceMember = (this.getAstDeclarationContainer().nodeType() === NodeType.InterfaceDeclaration);

            var start = new Date().getTime();
            var funcSymbol = this.compiler.semanticInfoChain.getSymbolForAST(funcDecl, this.document.fileName);

            TypeScript.declarationEmitFunctionDeclarationGetSymbolTime += new Date().getTime() - start;

            var funcTypeSymbol = funcSymbol.type;
            //if (funcDecl.block) {
            //    var constructSignatures = funcTypeSymbol.getConstructSignatures();
            //    if (constructSignatures && constructSignatures.length > 1) {
            //        return false;
            //    }
            //    else if (this.isOverloadedCallSignature(funcDecl)) {
            //        // This means its implementation of overload signature. do not emit
            //        return false;
            //    }
            //}
            //else if (!isInterfaceMember && hasFlag(funcDecl.getFunctionFlags(), FunctionFlags.Private) && this.isOverloadedCallSignature(funcDecl)) {
            //    // Print only first overload of private function
            //    var callSignatures = funcTypeSymbol.getCallSignatures();
            //    Debug.assert(callSignatures && callSignatures.length > 1);
            //    var firstSignature = callSignatures[0].isDefinition() ? callSignatures[1] : callSignatures[0];
            //    var firstSignatureDecl = firstSignature.getDeclarations()[0];
            //    var firstFuncDecl = <FunctionDeclaration>this.compiler.semanticInfoChain.getASTForDecl(firstSignatureDecl);
            //    if (firstFuncDecl !== funcDecl) {
            //        return false;
            //    }
            //}

            if (!this.canEmitSignature(ToDeclFlags(funcDecl.getFunctionFlags()), funcDecl, false))
            {
                return false;
            }

            var funcPullDecl = this.compiler.semanticInfoChain.getDeclForAST(funcDecl, this.document.fileName);
            var funcSignature = funcPullDecl.getSignatureSymbol();

            if (funcDecl.isConstructor)
            {
                this.addNewDocBlock(DocumentationBlockTypes.Constructor, BlockSignatures.Public, 1);
                addedFuncBlock = true;
                this.currentBlock.Write("constructor{\"");
                this.emitTypeParameters(funcDecl.typeArguments, funcSignature);
            }
            else
            {
                var id = funcDecl.getNameText();
                if (!isInterfaceMember)
                {
                    if (id !== "__missing" || !funcDecl.name || !funcDecl.name.isMissing())
                    {
                        this.addNewDocBlock(DocumentationBlockTypes.Function, BlockSignatures.Public, 1);
                        addedFuncBlock = true;
                        this.setDocBlockDeclFlags(ToDeclFlags(funcDecl.getFunctionFlags()), funcPullDecl, "function");

                        this.currentBlock.Write("{\"" + id.trim());

                        this.emitTypeParameters(funcDecl.typeArguments, funcSignature);
                    }
                    else if (funcDecl.isConstructMember()) 
                    {
                        this.addNewDocBlock(DocumentationBlockTypes.Constructor, BlockSignatures.Public, 1);
                        addedFuncBlock = true;
                        this.setDocBlockDeclFlags(ToDeclFlags(funcDecl.getFunctionFlags()), funcPullDecl, "function");

                        this.currentBlock.Write("{\"new");

                        this.emitTypeParameters(funcDecl.typeArguments, funcSignature);
                    }
                }
                else
                {
                    if (funcDecl.isConstructMember())
                    {
                        this.addNewDocBlock(DocumentationBlockTypes.Constructor, BlockSignatures.Public, 1);
                        addedFuncBlock = true;
                        this.setDocBlockDeclFlags(ToDeclFlags(funcDecl.getFunctionFlags()), funcPullDecl, "function");

                        this.currentBlock.Write("{\"new");

                        this.emitTypeParameters(funcDecl.typeArguments, funcSignature);
                    }
                    else if (!funcDecl.isCallMember() && !funcDecl.isIndexerMember())
                    {
                        this.addNewDocBlock(DocumentationBlockTypes.Function, BlockSignatures.Public, 1);
                        addedFuncBlock = true;
                        this.setDocBlockDeclFlags(ToDeclFlags(funcDecl.getFunctionFlags()), funcPullDecl, "function");

                        if (hasFlag(funcDecl.name.getFlags(), ASTFlags.OptionalName))
                        {
                            this.currentBlock.Write("[OPTIONAL] ");
                        }
                        //else
                        //{
                        //    this.currentBlock.Write("");
                        //}
                        this.currentBlock.Write("{\"" + id.trim());

                        this.emitTypeParameters(funcDecl.typeArguments, funcSignature);
                    }
                    else 
                    {
                        this.emitTypeParameters(funcDecl.typeArguments, funcSignature);
                    }
                }
            }
            if (addedFuncBlock)
            {
                if (!funcDecl.isIndexerMember()) 
                {
                    this.currentBlock.Write("(");
                }
                else 
                {
                    this.currentBlock.Write("[");
                }

                if (funcDecl.arguments) 
                {
                    var argsLen = funcDecl.arguments.members.length;
                    if (funcDecl.variableArgList) 
                    {
                        argsLen--;
                    }

                    for (var i = 0; i < argsLen; i++) 
                    {
                        var argDecl = <Parameter>funcDecl.arguments.members[i];
                        this.emitArgDecl(argDecl, funcDecl);
                        if (i < (argsLen - 1)) 
                        {
                            this.currentBlock.Write(", ");
                        }
                    }
                }

                if (funcDecl.variableArgList) 
                {
                    var lastArg = <Parameter>funcDecl.arguments.members[funcDecl.arguments.members.length - 1];
                    if (funcDecl.arguments.members.length > 1) 
                    {
                        this.currentBlock.Write(", ...");
                    }
                    else 
                    {
                        this.currentBlock.Write("...");
                    }

                    this.emitArgDecl(lastArg, funcDecl);
                }

                if (!funcDecl.isIndexerMember()) 
                {
                    this.currentBlock.Write(")");
                }
                else 
                {
                    this.currentBlock.Write("]");
                }

                if (!funcDecl.isConstructor &&
                    this.canEmitTypeAnnotationSignature(ToDeclFlags(funcDecl.getFunctionFlags())))
                {
                    var returnType = funcSignature.returnType;
                    if (funcDecl.returnTypeAnnotation ||
                        (returnType && returnType !== this.compiler.semanticInfoChain.anyTypeSymbol))
                    {
                        this.currentBlock.Write(": ");
                        this.emitTypeSignature(returnType);

                        this.addNewDocBlock(DocumentationBlockTypes.Returns, BlockSignatures.Public, 1);
                        this.currentBlock.Write("*Returns:* {\"" + returnType + " - ");
                        this.emitReturnsDocumentationComments(funcDecl);
                        this.currentBlock.Write("\"}");
                        
                        //Return current block to function block
                        this.currentBlock = this.currentBlock.parent;
                    }
                }

                this.currentBlock.WriteLine("\"}");

                this.currentBlock.Write("{\"");
                this.emitFunctionDocumentationComments(funcDecl);
                this.currentBlock.Write("\"}");

                //Return current block to class/interface
                this.currentBlock = this.currentBlock.parent;
            }
            return false;
        }

        //Unmodified
        public emitBaseExpression(bases: ASTList, index: number)
        {
            var start = new Date().getTime();
            var baseTypeAndDiagnostics = this.compiler.semanticInfoChain.getSymbolForAST(bases.members[index], this.document.fileName);
            TypeScript.documentationEmitGetBaseTypeTime += new Date().getTime() - start;

            var baseType = baseTypeAndDiagnostics && <PullTypeSymbol>baseTypeAndDiagnostics;
            this.emitTypeSignature(baseType);
        }

        //Modified, Complete - Adds extends/implements block and adds values to that
        private emitBaseList(typeDecl: TypeDeclaration, useExtendsList: boolean)
        {
            this.addNewDocBlock(useExtendsList ? DocumentationBlockTypes.Extends : DocumentationBlockTypes.Implements,
                                BlockSignatures.Public, 1);

            this.currentBlock.Write(useExtendsList ? "*Extends:* " : "*Implements:* ");

            var bases = useExtendsList ? typeDecl.extendsList : typeDecl.implementsList;
            if (bases && (bases.members.length > 0))
            {
                var basesLen = bases.members.length;
                for (var i = 0; i < basesLen; i++)
                {
                    if (i > 0)
                    {
                        this.currentBlock.Write(", ");
                    }
                    this.currentBlock.Write("[");
                    this.emitBaseExpression(bases, i);
                    this.currentBlock.Write("]");
                }
            }
            else
            {
                this.currentBlock.Write("[None]");
            }

            this.currentBlock = this.currentBlock.parent;
        }

        //Unmodified
        private emitAccessorDocumentationComments(funcDecl: FunctionDeclaration)
        {
            if (this.compiler.emitOptions.compilationSettings.removeComments)
            {
                return;
            }

            var start = new Date().getTime();
            var accessors = PullHelpers.getGetterAndSetterFunction(funcDecl, this.compiler.semanticInfoChain, this.document.fileName);
            TypeScript.documentationEmitGetAccessorFunctionTime += new Date().getTime();

            var comments: Comment[] = [];
            if (accessors.getter)
            {
                comments = comments.concat(accessors.getter.docComments());
            }
            if (accessors.setter)
            {
                comments = comments.concat(accessors.setter.docComments());
            }

            this.emitDocumentationComments(comments);
        }

        //Modified, Complete - Adds new property block, Resets current block
        public emitPropertyAccessorSignature(funcDecl: FunctionDeclaration)
        {
            var start = new Date().getTime();
            var accessorSymbol = PullHelpers.getAccessorSymbol(funcDecl, this.compiler.semanticInfoChain, this.document.fileName);
            TypeScript.documentationEmitGetAccessorFunctionTime += new Date().getTime();

            if (!hasFlag(funcDecl.getFunctionFlags(), FunctionFlags.GetAccessor) && accessorSymbol.getGetter())
            {
                // Setter is being used to emit the type info. 
                return false;
            }

            this.addNewDocBlock(DocumentationBlockTypes.Property, BlockSignatures.Public, 1);
            this.setDocBlockDeclFlags(ToDeclFlags(funcDecl.getFunctionFlags()), this.compiler.semanticInfoChain.getDeclForAST(funcDecl, this.document.fileName), "var");
            this.currentBlock.Write(funcDecl.name.actualText);
            if (this.canEmitTypeAnnotationSignature(ToDeclFlags(funcDecl.getFunctionFlags())))
            {
                this.currentBlock.Write(" : ");
                var type = accessorSymbol.type;
                this.emitTypeSignature(type);
            }
            this.currentBlock.WriteLine(";");

            this.emitDescription(funcDecl);
            
            this.currentBlock = this.currentBlock.parent;

            return false;
        }
        //Modified - Emits to new constructor block and new property blocks
        private emitClassMembersFromConstructorDefinition(funcDecl: FunctionDeclaration)
        {
            if (funcDecl.arguments)
            {
                var argsLen = funcDecl.arguments.members.length;
                if (funcDecl.variableArgList)
                {
                    argsLen--;
                }

                for (var i = 0; i < argsLen; i++)
                {
                    var argDecl = <Parameter>funcDecl.arguments.members[i];
                    if (hasFlag(argDecl.getVarFlags(), VariableFlags.Property))
                    {
                        this.addNewDocBlock(DocumentationBlockTypes.Property,
                                            BlockSignatures.Public,
                                            1);

                        var funcPullDecl = this.compiler.semanticInfoChain.getDeclForAST(funcDecl, this.document.fileName);
                        this.setDocBlockDeclFlags(ToDeclFlags(argDecl.getVarFlags()), funcPullDecl, "var");

                        this.currentBlock.Write(argDecl.id.actualText);                        
                        if (this.canEmitTypeAnnotationSignature(ToDeclFlags(argDecl.getVarFlags())))
                        {
                            this.emitTypeOfBoundDecl(argDecl);
                        }
                        this.currentBlock.Write(";");

                        this.addNewDocBlock(DocumentationBlockTypes.Description, BlockSignatures.Public, 1);
                        this.emitArgumentDocumentationComments(argDecl.id.actualText, funcDecl);
                        this.currentBlock = this.currentBlock.parent;
                        
                        this.currentBlock = this.currentBlock.parent;
                    }
                }
            }
        }
        //Modified, Complete - Emits new class doc block
        private classDeclarationCallback(pre: boolean, classDecl: ClassDeclaration): boolean
        {
            if (!this.canEmitPrePostAstSignature(ToDeclFlags(classDecl.getVarFlags()), classDecl, pre))
            {
                return false;
            }

            if (pre)
            {
                this.addNewDocBlock(DocumentationBlockTypes.Class, BlockSignatures.Public, 1);

                var className = classDecl.name.actualText;
                var classPullDecl = this.compiler.semanticInfoChain.getDeclForAST(classDecl, this.document.fileName);
                this.setDocBlockDeclFlags(ToDeclFlags(classDecl.getVarFlags()), classPullDecl, "class");

                this.currentBlock.Write(className);

                this.pushDeclarationContainer(classDecl);
                this.emitTypeParameters(classDecl.typeParameters);
                
                this.emitModuleSummary(this.buildModuleName(<ModuleDeclaration>this.declarationContainerStack[this.declarationContainerStack.length - 1]));
                this.emitBaseList(classDecl, true);
                this.emitBaseList(classDecl, false);
                this.emitExportedSummary(classDecl.symbol.isExternallyVisible());

                this.emitDescription(classDecl);
                                
                if (classDecl.constructorDecl)
                {
                    this.emitClassMembersFromConstructorDefinition(classDecl.constructorDecl);
                }
            }
            else
            {
                this.currentBlock = this.currentBlock.parent;
                this.popDeclarationContainer(classDecl);
            }

            return true;
        }
        //Emits the generics type info
        private emitTypeParameters(typeParams: ASTList, funcSignature?: PullSignatureSymbol)
        {
            if (!typeParams || !typeParams.members.length)
            {
                return;
            }

            this.currentBlock.Write("<");
            var containerAst = this.getAstDeclarationContainer();

            var start = new Date().getTime();
            var containerDecl = this.compiler.semanticInfoChain.getDeclForAST(containerAst, this.document.fileName);
            var containerSymbol = <PullTypeSymbol>containerDecl.getSymbol();
            TypeScript.documentationEmitGetTypeParameterSymbolTime += new Date().getTime() - start;

            var typars: PullTypeSymbol[];
            if (funcSignature)
            {
                typars = funcSignature.getTypeParameters();
            }
            else
            {
                typars = containerSymbol.getTypeArguments();
                if (!typars || !typars.length)
                {
                    typars = containerSymbol.getTypeParameters();
                }
            }

            for (var i = 0; i < typars.length; i++)
            {
                if (i)
                {
                    this.currentBlock.Write(", ");
                }

                var memberName = typars[i].getScopedNameEx(containerSymbol, /*useConstraintInName:*/ true);
                this.emitTypeNamesMember(memberName);
            }

            this.currentBlock.Write(">");
        }
        //Modified - Complete - Emits new interface block
        private interfaceDocumentationCallback(pre: boolean, interfaceDecl: InterfaceDeclaration): boolean
        {
            if (!this.canEmitPrePostAstSignature(ToDeclFlags(interfaceDecl.getVarFlags()), interfaceDecl, pre))
            {
                return false;
            }

            if (interfaceDecl.isObjectTypeLiteral)
            {
                return false;
            }

            if (pre) {
                var interfaceName = interfaceDecl.name.actualText;
                this.addNewDocBlock(DocumentationBlockTypes.Interface,
                                    BlockSignatures.Public, 1);

                var interfacePullDecl = this.compiler.semanticInfoChain.getDeclForAST(interfaceDecl, this.document.fileName);
                this.setDocBlockDeclFlags(ToDeclFlags(interfaceDecl.getVarFlags()), interfacePullDecl, "interface");
                this.pushDeclarationContainer(interfaceDecl);

                this.currentBlock.Write(interfaceName);
                this.emitTypeParameters(interfaceDecl.typeParameters);

                this.emitModuleSummary(this.buildModuleName(<ModuleDeclaration>this.declarationContainerStack[this.declarationContainerStack.length - 1]));
                this.emitBaseList(interfaceDecl, true);
                this.emitExportedSummary(interfaceDecl.symbol.isExternallyVisible());

                this.emitDescription(interfaceDecl);
            }
            else
            {
                this.currentBlock = this.currentBlock.parent;
                this.popDeclarationContainer(interfaceDecl);

                try
                {
                    DocumentationEmitter.debugMessage("; newParent: " + DocumentationBlockTypes[this.currentBlock.Type] + "\r\n");
                }
                catch(ex)
                {
                    DocumentationEmitter.debugMessage("; newParent: Error!\r\n");
                }
            }

            return true;
        }

        //Modified - Incomplete
        //TODO: Redo all of this imports shit so it stores in scope etc.
        private importDocumentationCallback(pre: boolean, importDeclAST: ImportDeclaration): boolean
        {
            if (pre)
            {
                var importDecl = this.compiler.semanticInfoChain.getDeclForAST(importDeclAST, this.document.fileName);
                var importSymbol = <PullTypeAliasSymbol>importDecl.getSymbol();
                var isExportedImportDecl = hasFlag(importDeclAST.getVarFlags(), VariableFlags.Exported);

                //if (isExportedImportDecl || importSymbol.typeUsedExternally || PullContainerTypeSymbol.usedAsSymbol(importSymbol.getContainer(), importSymbol)) {
                //    this.emitDocumentationComments(importDeclAST);
                //    this.emitIndent();
                //    if (isExportedImportDecl) {
                //        this.docFile.Write("export ");
                //    }
                //    this.docFile.Write("import ");
                //    this.docFile.Write(importDeclAST.id.actualText + " = ");
                //    if (importDeclAST.isExternalImportDeclaration()) {
                //        this.docFile.WriteLine("require(" + importDeclAST.getAliasName() + ");");
                //    }
                //    else {
                //        this.docFile.WriteLine(importDeclAST.getAliasName() + ";");
                //    }
                //}

                this.addImport({
                    importName: importDeclAST.id.actualText,
                    importedName: importDeclAST.getAliasName()
                });
            }

            return false;
        }
        //New
        private currentImports: Array<{
            importName: string;
            importedName: string
        }> = new Array<{
            importName: string;
            importedName: string
        }>(0);
        private addImport(val: {
            importName: string;
            importedName: string
        }): void
        {
            this.currentImports.push(val);
        }
        //New
        private clearImports(): void
        {
            this.currentImports = new Array<{
                importName: string;
                importedName: string
            }>(0);
        }
        //New
        private emitImportHeader()
        {
            this.docFile.WriteLine("_Imports:_");
        }
        //New
        private emitImportBullets(): void
        {
            for (var i = 0; i < this.currentImports.length; i++)
            {
                this.emitImportBullet(this.currentImports[i]);
            }
        }
        //New
        private emitImportBullet(val: {
            importName: string;
            importedName: string
        }): void
        {
            this.docFile.WriteLine("* " + val.importName + " = " + val.importedName);
        }


        //Modified - Potentially complete
        private emitEnumSignature(moduleDecl: ModuleDeclaration)
        {
            if (!this.canEmitSignature(ToDeclFlags(moduleDecl.getModuleFlags()), moduleDecl))
            {
                return false;
            }

            //this.emitDocumentationComments(moduleDecl);
            //var modulePullDecl = this.compiler.semanticInfoChain.getDeclForAST(moduleDecl, this.document.fileName);

            //this.emitDeclFlags(ToDeclFlags(moduleDecl.getModuleFlags()), modulePullDecl, "enum");
            //this.docFile.WriteLine(moduleDecl.name.actualText + " {");

            //this.indenter.increaseIndent();
            //var membersLen = moduleDecl.members.members.length;
            //for (var j = 0; j < membersLen; j++) {
            //    var memberDecl: AST = moduleDecl.members.members[j];
            //    var variableStatement = <VariableStatement>memberDecl;
            //    var varDeclarator = <VariableDeclarator>variableStatement.declaration.declarators.members[0];
            //    this.emitDocumentationComments(varDeclarator);
            //    this.emitIndent();
            //    this.docFile.Write(varDeclarator.id.actualText);
            //    if (varDeclarator.init && varDeclarator.init.nodeType() == NodeType.NumericLiteral) {
            //        this.docFile.Write(" = " + (<NumberLiteral>varDeclarator.init).text());
            //    }
            //    this.docFile.WriteLine(",");
            //}
            //this.indenter.decreaseIndent();

            //this.emitIndent();
            //this.docFile.WriteLine("}");

            this.emitEnumerationSummary(moduleDecl);

            return false;
        }
        //New
        private emitEnumerationSummary(enumDecl: ModuleDeclaration)
        {
            this.addNewDocBlock(DocumentationBlockTypes.Enum, BlockSignatures.Private, 1);

            this.currentBlock.Write(enumDecl.prettyName);
            this.emitModuleSummary(this.buildModuleName(<ModuleDeclaration>this.declarationContainerStack[this.declarationContainerStack.length - 1]));
            
            this.emitExtendsSummary(["N/A"]);
            this.emitImplementsSummary(["N/A"]);
            this.emitExportedSummary(enumDecl.symbol.isExternallyVisible());

            this.emitDescription(enumDecl);

            var membersLen = enumDecl.members.members.length;
            var value = 0;
            for (var j = 0; j < membersLen; j++)
            {
                var memberDecl: AST = enumDecl.members.members[j];
                var variableStatement = <VariableStatement>memberDecl;
                var varDeclarator = <VariableDeclarator>variableStatement.declaration.declarators.members[0];

                this.addNewDocBlock(DocumentationBlockTypes.EnumValue, BlockSignatures.Public, 1);

                this.currentBlock.Write("* *{\"" + varDeclarator.id.actualText + "\"}*");
                if (varDeclarator.init && varDeclarator.init.nodeType() == NodeType.NumericLiteral)
                {
                    this.currentBlock.Write(" = " + (<NumberLiteral>varDeclarator.init).text());
                    value = (<NumberLiteral>varDeclarator.init).value;
                }
                else
                {
                    this.currentBlock.Write(" = " + value.toString());
                }
                value++;
                this.currentBlock.Write(" - {\"");
                this.emitSymbolDocumentationComments(varDeclarator, true, true);
                this.currentBlock.Write("\"}");

                this.currentBlock = this.currentBlock.parent;
            }

            this.currentBlock = this.currentBlock.parent;
        }


        //Modified - Incomplete
        private moduleDeclarationCallback(pre: boolean, moduleDecl: ModuleDeclaration): boolean
        {
            //DocumentationEmitter.debugMessage

            if (hasFlag(moduleDecl.getModuleFlags(), ModuleFlags.IsWholeFile))
            {
                // This is dynamic modules and we are going to outputing single file, 
                if (hasFlag(moduleDecl.getModuleFlags(), ModuleFlags.IsDynamic))
                {
                    if (pre)
                    {
                        // Dynamic Modules always go in their own file
                        this.pushDeclarationContainer(moduleDecl);
                    }
                    else
                    {
                        this.popDeclarationContainer(moduleDecl);
                    }
                }

                return true;
            }

            if (moduleDecl.isEnum())
            {
                if (pre)
                {
                    this.emitEnumSignature(moduleDecl);
                }
                return false;
            }

            if (!this.canEmitPrePostAstSignature(ToDeclFlags(moduleDecl.getModuleFlags()), moduleDecl, pre))
            {
                return false;
            }

            if (pre)
            {
                if (this.shouldEmitDottedModuleName())
                {
                    this.dottedModuleEmit += ".";
                }
                else
                {
                    var modulePullDecl = this.compiler.semanticInfoChain.getDeclForAST(moduleDecl, this.document.fileName);
                    this.dottedModuleEmit = this.getDeclFlagsString(ToDeclFlags(moduleDecl.getModuleFlags()), modulePullDecl, "module");
                }

                this.dottedModuleEmit += moduleDecl.name.actualText;

                var isCurrentModuleDotted = (moduleDecl.members.members.length === 1 &&
                    moduleDecl.members.members[0].nodeType() === NodeType.ModuleDeclaration &&
                    !(<ModuleDeclaration>moduleDecl.members.members[0]).isEnum() &&
                    hasFlag((<ModuleDeclaration>moduleDecl.members.members[0]).getModuleFlags(), ModuleFlags.Exported));

                // Module is dotted only if it does not have doc comments for it
                var moduleDeclComments = moduleDecl.docComments();
                isCurrentModuleDotted = isCurrentModuleDotted && (moduleDeclComments === null || moduleDeclComments.length === 0);

                this.isDottedModuleName.push(isCurrentModuleDotted);
                this.pushDeclarationContainer(moduleDecl);
            }
            else
            {
                this.popDeclarationContainer(moduleDecl);
                this.isDottedModuleName.pop();
            }

            return true;
        }
        //New
        private buildModuleName(innerMostModuleDecl: ModuleDeclaration = null): string
        {
            if (innerMostModuleDecl === undefined)
            {
                return "None";
            }

            var result = innerMostModuleDecl === null ? innerMostModuleDecl.prettyName : "None";

            for (var i = this.declarationContainerStack.length - 2; i > -1; i--)
            {
                if (this.declarationContainerStack[i].nodeType() == NodeType.ModuleDeclaration)
                {
                    result = (<ModuleDeclaration>this.declarationContainerStack[i]).prettyName + "." + result;
                }
                else
                {
                    break;
                }
            }

            return result;
        }
        //New
        private emitModuleSummary(moduleName: string): void
        {
            this.addNewDocBlock(DocumentationBlockTypes.Module, BlockSignatures.Public, 1);
            this.currentBlock.Write("[" + moduleName + "]");
            this.currentBlock = this.currentBlock.parent;
        }
        //New
        private emitExtendsSummary(extendsInfo: Array<string>): void
        {
            this.addNewDocBlock(DocumentationBlockTypes.Extends, BlockSignatures.Public, 1);
            this.currentBlock.Write("*Extends:* ");
            for (var i = 0; i < extendsInfo.length; i++)
            {
                this.currentBlock.Write("[" + extendsInfo[i] + "]");
                if (i < extendsInfo.length - 1)
                {
                    this.currentBlock.Write(", ");
                }
            }
            this.currentBlock = this.currentBlock.parent;
        }
        //New
        private emitImplementsSummary(implementsInfo: Array<string>): void
        {
            this.addNewDocBlock(DocumentationBlockTypes.Implements, BlockSignatures.Public, 1);
            this.currentBlock.Write("*Implements:* ");
            for (var i = 0; i < implementsInfo.length; i++)
            {
                this.currentBlock.Write("[" + implementsInfo[i] + "]");
                if (i < implementsInfo.length - 1)
                {
                    this.currentBlock.Write(", ");
                }
            }
            this.currentBlock = this.currentBlock.parent;
        }
        //New
        private emitExportedSummary(exported: boolean): void
        {
            this.addNewDocBlock(DocumentationBlockTypes.Exported, BlockSignatures.Public, 1);
            this.currentBlock.Write("*Exported:* " + (exported ? "Yes" : "No"));
            this.currentBlock = this.currentBlock.parent;
        }
        //New 
        private emitDescription(ast: AST): void
        {
            this.addNewDocBlock(DocumentationBlockTypes.Description, BlockSignatures.Public, 1);
            this.emitSymbolDocumentationComments(ast, true, false);
            this.currentBlock = this.currentBlock.parent;
        }


        //Modified - Ignored
        public exportAssignmentCallback(pre: boolean, ast: ExportAssignment): boolean
        {
            //if (pre) {
            //    this.emitIndent();
            //    this.docFile.Write("export = ");
            //    this.docFile.Write(ast.id.actualText);
            //    this.docFile.WriteLine(";");
            //}

            return false;
        }

        //Modified - Complete
        private emitReferencePaths(script: Script)
        {
            // In case of shared handler we collect all the references and emit them
            if (this.emittedReferencePaths)
            {
                return;
            }

            // Collect all the documents that need to be emitted as reference
            var documents: Document[] = [];
            if (this.compiler.emitOptions.outputMany || script.topLevelMod)
            {
                // Emit only from this file
                var scriptReferences = script.referencedFiles;
                var addedGlobalDocument = false;
                for (var j = 0; j < scriptReferences.length; j++)
                {
                    var currentReference = scriptReferences[j];
                    var document = this.compiler.getDocument(currentReference);
                    // All the references that are not going to be part of same file
                    if (!document.script.isDocumentationFile)
                    {
                        if (this.compiler.emitOptions.outputMany || document.script.isDeclareFile || document.script.topLevelMod || !addedGlobalDocument)
                        {
                            documents = documents.concat(document);
                            if (!document.script.isDeclareFile && document.script.topLevelMod)
                            {
                                addedGlobalDocument = true;
                            }
                        }
                    }
                }
            } else
            {
                // Collect from all the references and emit
                var allDocuments = this.compiler.getDocuments();
                for (var i = 0; i < allDocuments.length; i++)
                {
                    if (!allDocuments[i].script.isDeclareFile && !allDocuments[i].script.isDocumentationFile && !allDocuments[i].script.topLevelMod)
                    {
                        // Check what references need to be added
                        var scriptReferences = allDocuments[i].script.referencedFiles;
                        for (var j = 0; j < scriptReferences.length; j++)
                        {
                            var currentReference = scriptReferences[j];
                            var document = this.compiler.getDocument(currentReference);
                            // All the references that are not going to be part of same file
                            if (document.script.isDeclareFile || document.script.topLevelMod)
                            {
                                for (var k = 0; k < documents.length; k++)
                                {
                                    if (documents[k] == document)
                                    {
                                        break;
                                    }
                                }

                                if (k == documents.length)
                                {
                                    documents = documents.concat(document);
                                }
                            }
                        }
                    }
                }
            }

            // Emit the references
            var emittingFilePath = documents.length ? getRootFilePath(this.emittingFileName) : null;
            for (var i = 0; i < documents.length; i++)
            {
                var document = documents[i];
                var declFileName: string;
                if (document.script.isDeclareFile)
                {
                    declFileName = document.fileName;
                } else
                {
                    declFileName = this.compiler.emitOptions.mapOutputFileName(document, TypeScriptCompiler.mapToDocTSFileName);
                }

                // Get the relative path
                declFileName = getRelativePathToFixedPath(emittingFilePath, declFileName, false);
                //this.docFile.WriteLine('/// <reference path="' + declFileName + '" />');
                //this.emitReferenceBullet(declFileName);
                this.addReference(declFileName);
            }

            this.emittedReferencePaths = true;
        }
        private addReference(declFileName: string): void
        {
            if (this.compiler.settings.wikiRemoveRootPath !== "")
            {
                declFileName = declFileName.replace(this.compiler.settings.wikiRemoveRootPath, "");
            }

            this.rootDocBlock.Children.push(new DocumentationBlock(DocumentationBlockTypes.Reference,
                declFileName, BlockSignatures.PublicStatic, this.rootDocBlock));
        }
        //New
        private writeReferenceHeader()
        {
            this.docFile.WriteLine("");
            this.docFile.WriteLine("_Associated source files:_");
        }
        //New
        private writeReferenceBullet(declFileName: string): void
        {
            var repoUrl = this.compiler.settings.wikiSourceRootPath;
            this.docFile.WriteLine("* [url:" + declFileName + "|" + repoUrl + declFileName + "]");
        }

        //Unmodified
        public scriptCallback(pre: boolean, script: Script): boolean
        {
            if (pre)
            {
                this.emitReferencePaths(script);

                this.pushDeclarationContainer(script);
            }
            else
            {
                this.popDeclarationContainer(script);
            }
            return true;
        }
        //Unmodified
        private defaultCallback(pre: boolean, ast: AST): boolean
        {
            return !ast.isStatement();
        }
    }

    class DocumentationBlock
    {
        public Children: Array<DocumentationBlock> = new Array<DocumentationBlock>(0);
        public NumChildrenOfType: Array<number> = new Array<number>(18);
        public Type: DocumentationBlockTypes;
        public Text: string;
        public Visiblity: BlockSignatures;
        public parent: DocumentationBlock;

        constructor(type: DocumentationBlockTypes, text: string,
                    visiblity: BlockSignatures, aParent: DocumentationBlock)
        {
            this.Type = type;
            this.Text = text;
            this.Visiblity = visiblity;
            this.parent = aParent;
        } 

        public Write(text: string): void
        {
            this.Text += text;
        }
        public WriteLine(text: string): void
        {
            this.Text += text + "\r\n";
        }
    }

    enum DocumentationBlockTypes
    {
/*0*/        Unknown = 0,
/*1*/        Script,
/*2*/        Class,
/*3*/        Interface,
/*4*/        Enum,
/*5*/        Constructor,
/*6*/        EnumValue,
/*7*/        Reference,
/*8*/        Import,
/*9*/        Property,
/*10*/        Function,
/*11*/        Argument,
/*12*/        Returns,
/*13*/        Module,
/*14*/        Exported,
/*15*/        Extends,
/*16*/        Implements,
/*17*/        Description
/*See DocumentationBlock.NumChildrenOfType initialisation!!*/
    }
    enum BlockSignatures
    {
        Private,
        Public,
        PrivateStatic,
        PublicStatic
    }
}