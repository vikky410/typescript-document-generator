//
// Copyright (c) Microsoft Corporation.  All rights reserved.
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
    var quoteRegEx = /["']/g;
    export function stripQuotes(str: string) {
        return str.replace(quoteRegEx, "");
    }

    export function isSingleQuoted(str: string) {
        return str.indexOf("'") !== -1;
    }

    export function isQuoted(str: string) {
        return str.indexOf("\"") !== -1 || isSingleQuoted(str);
    }

    export function quoteStr(str: string) {
        return "\"" + str + "\"";
    }

    export function swapQuotes(str: string) {

        if (str.indexOf("\"") !== -1) {
            str = str.replace("\"", "'");
            str = str.replace("\"", "'");
        }
        else {
            str = str.replace("'", "\"");
            str = str.replace("'", "\"");
        }

        return str;
    }

    var switchToForwardSlashesRegEx = /\\/g;
    export function switchToForwardSlashes(path: string) {
        return path.replace(switchToForwardSlashesRegEx, "/");
    }

    export function trimModName(modName: string) {
        // in case's it's a declare file...
        if (modName.length > 5 && modName.substring(modName.length - 5, modName.length) === ".d.ts") {
            return modName.substring(0, modName.length - 5);
        }
        // in case's it's a documentation file...
        if (modName.length > 8 && modName.substring(modName.length - 8, modName.length) === ".ts.wiki")
        {
            return modName.substring(0, modName.length - 8);
        }
        if (modName.length > 3 && modName.substring(modName.length - 3, modName.length) === ".ts") {
            return modName.substring(0, modName.length - 3);
        }
        // in case's it's a .js file
        if (modName.length > 3 && modName.substring(modName.length - 3, modName.length) === ".js") {
            return modName.substring(0, modName.length - 3);
        }

        return modName;
    }

    export function getDeclareFilePath(fname: string) {
        return isTSFile(fname) ? changePathToDTS(fname) : changePathToDTS(fname);
    }
    export function getDocumentationFilePath(fname: string)
    {
        return isTSFile(fname) ? changePathToDocTS(fname) : changePathToDocTS(fname);
    }

    function isFileOfExtension(fname: string, ext: string) {
        var invariantFname = fname.toLocaleUpperCase();
        var invariantExt = ext.toLocaleUpperCase();
        var extLength = invariantExt.length;
        return invariantFname.length > extLength && invariantFname.substring(invariantFname.length - extLength, invariantFname.length) === invariantExt;
    }

    export function isJSFile(fname: string) {
        return isFileOfExtension(fname, ".js");
    }

    export function isTSFile(fname: string) {
        return isFileOfExtension(fname, ".ts");
    }

    export function isDTSFile(fname: string) {
        return isFileOfExtension(fname, ".d.ts");
    }

    export function isDocTSFile(fname: string)
    {
        return isFileOfExtension(fname, ".ts.wiki");
    }

    export function getPrettyName(modPath: string, quote=true, treatAsFileName=false): any { 
        var modName = treatAsFileName ? switchToForwardSlashes(modPath) : trimModName(stripQuotes(modPath));
        var components = this.getPathComponents(modName);
        return components.length ? (quote ? quoteStr(components[components.length - 1]) : components[components.length - 1]) : modPath;
    }

    export function getPathComponents(path: string) {
        return path.split("/");
    }

    export function getRelativePathToFixedPath(fixedModFilePath: string, absoluteModPath: string, isAbsoultePathURL = true) {
        absoluteModPath = switchToForwardSlashes(absoluteModPath);

        var modComponents = this.getPathComponents(absoluteModPath);
        var fixedModComponents = this.getPathComponents(fixedModFilePath);

        // Find the component that differs
        var joinStartIndex = 0;
        for (; joinStartIndex < modComponents.length && joinStartIndex < fixedModComponents.length ; joinStartIndex++) {
            if (fixedModComponents[joinStartIndex] !== modComponents[joinStartIndex]) {
                break;
            }
        }

        // Get the relative path
        if (joinStartIndex !== 0) {
            var relativePath = "";
            var relativePathComponents = modComponents.slice(joinStartIndex, modComponents.length);
            for (; joinStartIndex < fixedModComponents.length; joinStartIndex++) {
                if (fixedModComponents[joinStartIndex] !== "") {
                    relativePath = relativePath + "../";
                }
            }

            return relativePath + relativePathComponents.join("/");
        }

        if (isAbsoultePathURL && absoluteModPath.indexOf("://") === -1) {
            absoluteModPath = "file:///" + absoluteModPath;
        }

        return absoluteModPath;
    }

    export function quoteBaseName(modPath: string) {
        var modName = trimModName(stripQuotes(modPath));
        var path = getRootFilePath(modName);
        if (path === "") {
            return modPath;
        }
        else {
            var components = modName.split(path);
            var fileIndex = components.length > 1 ? 1 : 0;
            return quoteStr(components[fileIndex]);
        }
    }

    export function changePathToDTS(modPath: string) {
        return trimModName(stripQuotes(modPath)) + ".d.ts";
    }
    export function changePathToDocTS(modPath: string)
    {
        return trimModName(stripQuotes(modPath)) + ".ts.wiki";
    }

    export function isRelative(path: string) {
        return path.length > 0 && path.charAt(0) === ".";
    }
    export function isRooted(path: string) {
        return path.length > 0 && (path.charAt(0) === "\\" || path.charAt(0) === "/" || (path.indexOf(":\\") !== -1) || (path.indexOf(":/") !== -1));
    }

    export function getRootFilePath(outFname: string) {
        if (outFname === "") {
            return outFname;
        }
        else {
            var isPath = outFname.indexOf("/") !== -1;
            return isPath ? filePath(outFname) : "";
        }
    }

    export function filePathComponents(fullPath: string) {
        fullPath = switchToForwardSlashes(fullPath);
        var components = getPathComponents(fullPath);
        return components.slice(0, components.length - 1);
    }

    export function filePath(fullPath: string) {
        var path = filePathComponents(fullPath);
        return path.join("/") + "/";
    }

    export function convertToDirectoryPath(dirPath: string) {
        if (dirPath && dirPath.charAt(dirPath.length - 1) !== "/") {
            dirPath += "/";
        }

        return dirPath;
    }

    var normalizePathRegEx = /^\\\\[^\\]/;
    export function normalizePath(path: string): string {
        // If it's a UNC style path (i.e. \\server\share), convert to a URI style (i.e. file://server/share)
        if (normalizePathRegEx.test(path)) {
            path = "file:" + path;
        }
        var parts = this.getPathComponents(switchToForwardSlashes(path));
        var normalizedParts: string[] = [];

        for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
            if (part === ".") {
                continue;
            }

            if (normalizedParts.length > 0 && ArrayUtilities.last(normalizedParts) !== ".." && part === "..") {
                normalizedParts.pop();
                continue;
            }

            normalizedParts.push(part);
        }

        return normalizedParts.join("/");
    }
}