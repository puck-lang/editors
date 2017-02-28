/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
	IPCMessageReader, IPCMessageWriter,
	createConnection, IConnection, TextDocumentSyncKind,
	TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity,
	InitializeParams, InitializeResult, TextDocumentPositionParams,
	CompletionItem, CompletionItemKind, Hover, Position, Range, 
	StreamMessageReader, StreamMessageWriter, Location, SignatureHelp,
} from 'vscode-languageserver';
import {createServer} from 'puck-lang/dist/lib/pls'

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
// let connection: IConnection = createConnection(new StreamMessageReader(process.stdin), new StreamMessageWriter(process.stdout));

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// After the server has started the client sends an initialize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilities. 
let workspaceRoot: string;
let context
let diagnostics = []
let fileValidating
connection.onInitialize((params): InitializeResult => {
	workspaceRoot = params.rootPath;
	context = createServer(workspaceRoot, (file, diagnostic) => {
		if (file === fileValidating) {
			diagnostics.push(diagnostic)
		}
	})
	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: documents.syncKind,
			
			completionProvider: {
				resolveProvider: true,
				triggerCharacters: ['.', '::', '/'],
			},
			hoverProvider: true,
			definitionProvider: true,
			signatureHelpProvider: {
				triggerCharacters: ['(', ','],
			},
		}
	}
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
	validateTextDocument(change.document, true);
});

documents.onDidOpen(change => {
	validateTextDocument(change.document);
})

documents.onDidSave(change => {
	validateTextDocument(change.document);
})

documents.onDidClose(change => {
	context.onClose(fromUri(change.document.uri))
})

// // The settings interface describe the server relevant settings part
// interface Settings {
// 	languageServerExample: ExampleSettings;
// }

// // These are the example settings we defined in the client's package.json
// // file
// interface ExampleSettings {
// 	maxNumberOfProblems: number;
// }

// // hold the maxNumberOfProblems setting
// let maxNumberOfProblems: number;
// // The settings have changed. Is send on server activation
// // as well.
// connection.onDidChangeConfiguration((change) => {
// 	let settings = <Settings>change.settings;
// 	maxNumberOfProblems = settings.languageServerExample.maxNumberOfProblems || 100;
// 	// Revalidate any open text documents
// 	documents.all().forEach(validateTextDocument);
// });

function validateTextDocument(textDocument: TextDocument, ignoreSyntaxErrors = true): void {
	const filePath = fromUri(textDocument.uri)
	if (filePath) {
		diagnostics = []
		fileValidating = filePath
		context.validateDocument(filePath, textDocument.getText(), ignoreSyntaxErrors)
 		connection.sendDiagnostics({uri: textDocument.uri, diagnostics})
	}
}

// connection.onDidChangeWatchedFiles((change) => {
// 	// Monitored files have change in VSCode
// 	connection.console.log('We received an file change event');
// });

// This handler provides the initial list of the completion items.
connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
	const filePath = fromUri(textDocumentPosition.textDocument.uri)
	if (filePath) {
		return context.onCompletion(filePath, toPuckPosition(textDocumentPosition.position))
	} 
})

// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
// 	if (item.data === 1) {
// 		item.detail = 'TypeScript details',
// 		item.documentation = 'TypeScript documentation'
// 	} else if (item.data === 2) {
// 		item.detail = 'JavaScript details',
// 		item.documentation = 'JavaScript documentation'
// 	}
	return item;
});

connection.onHover((textDocumentPosition: TextDocumentPositionParams): Hover => {
	const filePath = fromUri(textDocumentPosition.textDocument.uri)
	if (filePath) {
		const hover = context.onHover(filePath, toPuckPosition(textDocumentPosition.position))

		if (hover.kind === 'Some') {
			return {
				contents: hover.value[0].contents,
				range: fromSpan(hover.value[0].span),
			}
		}
	} 
})

connection.onDefinition((textDocumentPosition: TextDocumentPositionParams): Array<Location> => {
	const filePath = fromUri(textDocumentPosition.textDocument.uri)
	if (filePath) {
		return context.onDefinition(filePath, toPuckPosition(textDocumentPosition.position))
			.map(location => ({
				uri: toUri(location.file.absolutePath),
				range: fromSpan(location.span),
			}))
	}
})

connection.onSignatureHelp((textDocumentPosition: TextDocumentPositionParams): SignatureHelp => {
	const filePath = fromUri(textDocumentPosition.textDocument.uri)
	if (filePath) {
		const signature = context.onSignatureHelp(filePath, toPuckPosition(textDocumentPosition.position))

		if (signature.kind === 'Some') {
			return signature.value[0]
		}
	}
})


// connection.onDidOpenTextDocument((params) => {
// 	// A text document got opened in VSCode.
// 	// params.textDocument.uri uniquely identifies the document. For documents store on disk this is a file URI.
// 	// params.textDocument.text the initial full content of the document.
// 	connection.console.log(`${params.textDocument.uri} opened.`)
// })

// connection.onDidChangeTextDocument((params) => {
// 	// The content of a text document did change in VSCode.
// 	// params.textDocument.uri uniquely identifies the document.
// 	// params.contentChanges describe the content changes to the document.
// 	connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`)
// })

// connection.onDidCloseTextDocument((params) => {
// 	// A text document got closed in VSCode.
// 	// params.textDocument.uri uniquely identifies the document.
// 	connection.console.log(`${params.textDocument.uri} closed.`)
// })

// Listen on the connection
connection.listen();

type PuckPosition = {
	line: number
	column: number
}

type Span = {
	start: PuckPosition
	end: PuckPosition
}

function fromUri(uri: string) {
	if (uri.startsWith('file://')) {
		return decodeURIComponent(uri.slice(7))
	}
}

function toUri(path: string) {
	return `file://${encodeURI(path)}`
}

function toPuckPosition(position: Position): PuckPosition {
	return {
		line: position.line + 1,
		column: position.character + 1,
	}
}

function fromPuckPosition(position: PuckPosition): Position {
	return {
		line: position.line - 1,
		character: position.column - 1,
	}
}

function toSpan(range: Range): Span {
	return {
		start: toPuckPosition(range.start),
		end: toPuckPosition(range.end),
	}
}

function fromSpan(span: Span): Range {
	return {
		start: fromPuckPosition(span.start),
		end: fromPuckPosition(span.end),
	}
}