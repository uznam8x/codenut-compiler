'use strict';
const path = require('path');
const compiler = require(__dirname + '/src/compiler');
const nut = require(__dirname + '/src/nut');
module.exports = compiler;
compiler.nut = nut;