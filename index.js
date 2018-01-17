'use strict';
const path = require('path');
const config = require(__dirname + '/src/config')();
const html = require(__dirname + '/src/html/render');
module.exports = {
  config: config,
  html: html,
};
