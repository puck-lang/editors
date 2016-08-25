#!/usr/bin/env bash

# Atom
rm -rf .tmp
mkdir -p .tmp/Puck.tmBundle/Syntaxes
cp general/puck.tmLanguage .tmp/Puck.tmBundle/Syntaxes/
atomizr -Zi .tmp/Puck.tmBundle -o puck
mv _output/puck/grammars/puck.cson atom/grammars/
rm -rf .tmp _output

# VS code
cp general/puck.tmLanguage vscode/syntaxes/