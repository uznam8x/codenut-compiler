'use strict';
const path = require('path');
const compiler = require(__dirname + '/src/compiler');
const Nut = require(__dirname + '/src/nut');
module.exports = compiler;
compiler.nut = Nut;