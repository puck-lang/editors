Editor support for [Puck](https://github.com/puck-lang/puck)

## Installation

### Atom
Run `apm link` inside the atom folder

### VS Code
Copy the contents of `vscode` into `~/.vscode/extensions/puck`
Restart VS Code

## Contribute
To modify the grammar, modify the `general/puck.YAML-tmLanguage` file.
Then use **Sublime Text** with the **PackageDev** plugin the build it to the plist file `general/puck.tmLanguage`.

Install atomizr `gem install atomizr`
Install dependencies `(cd vscode && yarn)`
Run `./build.sh`