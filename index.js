"use strict";

var path = require('path');

var yargs = require('yargs');

module.exports = function (version, commandSpecs, alternativeCommandLine) {
  // assume main module is a script in bin/ directory
  var main = path.basename(require.main.filename);
  // start with arguments for unparsed command with unknown options
  var mainArgs = yargs.strict().help('help').version(version)
    .usage('Usage: ' + main + ' <command> [options]')
    .epilogue('Supply <command> for more help');
  // keep track whether a command has been parsed
  var commandKey = null;
  // specify commands to parse
  for (var key in commandSpecs) {
    mainArgs.command(key, commandSpecs[key].short, function () {
      // when the callback is called, this command has been parsed
      var commandSpec = commandSpecs[commandKey = this];
      // specify options of this command (as expected by yargs)
      var yopts = {}, nargs = {};
      var least = typeof commandSpec.least === 'number' ? commandSpec.least : 0;
      var most = typeof commandSpec.most === 'number' ? commandSpec.most : -1;
      var examples = commandSpec.examples || [];
      var usage = commandSpec.usage;
      var long = commandSpec.long;
      for (var alias in commandSpec.option) {
        var optionSpec = commandSpec.option[alias];
        var letter = optionSpec.letter, arity = optionSpec.arity;
        if (yopts[letter]) {
          throw 'Duplicate letter ' + letter + ' in configuration of command ' + commandKey;
        }
        nargs[letter] = arity === 0 ? 0 : arity || 1;
        yopts[letter] = {
          alias: alias,
          demand: optionSpec.demand,
          describe: optionSpec.describe,
          type: arity === 0 ? 'boolean' : 'string'
        };
      }
      // reset arguments for parsed command with known options
      var yusage = 'Usage: ' + main + ' ' + commandKey + ' ' + usage;
      mainArgs.reset().strict().help('help').nargs(nargs).options(yopts).usage(yusage);
      if (least > 0 || most >= least) {
        mainArgs.demand(least + 1, most >= least ? most + 1 : void 0);
      }
      examples.forEach(function (example) {
        mainArgs.example(main + ' ' + commandKey + ' ' + example, '');
      });
      if (long) {
        mainArgs.epilogue(long);
      }
    }.bind(key));
  }
  // parse command line to trigger callback
  var argv = alternativeCommandLine ? mainArgs.parse(alternativeCommandLine) : mainArgs.argv;
  var firstNonOption = argv._[0];
  if (!commandKey || firstNonOption !== commandKey) {
    mainArgs.showHelp();
    if (commandKey && firstNonOption) {
      // this quirk happens when some non-option is accidentally parsed as the command
      console.error('Command ambiguity in non-option: ' + commandKey + ' vs. ' + firstNonOption);
    } else if (firstNonOption) {
      console.error('Unknown command: ' + firstNonOption);
    }
    return;
  }
  // extract command options from parse results
  var commandSpec = commandSpecs[commandKey];
  var opts = { '': argv._.slice(1) };
  for (var key in argv) {
    var optionSpec = commandSpec.option[key];
    if (optionSpec) {
      if (optionSpec.arity === 0) {
        opts[key] = argv[key];
      } else {
        var values = Array.isArray(argv[key]) ? argv[key] : [argv[key]];
        var arity = optionSpec.arity || 1;
        if (optionSpec.once && values.length > arity) {
          mainArgs.showHelp();
          console.error('Too many options: ' + key);
          return;
        }
        opts[key] = optionSpec.once && arity === 1 ? values[0] : values;
      }
    }
  }
  // perform asynchronous command with extracted options
  var command = commandSpec.command;
  command(opts)
    .then(null, function (uncaught) {
      console.error(uncaught.stack ? uncaught.stack : uncaught);
    })
  ;
};