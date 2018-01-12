'use strict';
let instance = null;
const path = require('path');
const _ = require('lodash');
const config = (option) => {
  'use strict';
  if (!instance) {
    let options = {
      path: {
        root: path.resolve('./'),
      }
    };
    options.path = _.defaultsDeep(options.path, {
      app: options.path.root + '/app',
      develop: options.path.root + '/app/dev',
      product: options.path.root + '/app/prod',
    });

    instance = _.defaultsDeep(option || {}, options);
  }
  return instance;
};

module.exports = config;