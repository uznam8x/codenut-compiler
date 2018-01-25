'use strict';
const path = require('path');
const config = require(__dirname + '/src/config')();
const html = require(__dirname + '/src/html/render');
const nut = require(__dirname + '/src/html/util/nut');
module.exports = {
  config: config,
  html: html,
  nut:nut
};
