'use strict';
let instance = null;
const path = require('path');
const _ = require('lodash');
const glob = require('glob');
const load = (file) => {
  'use strict';
  for (let i = 0, len = file.length; i < len; i++) {
    require(path.resolve(__dirname, file[i]));
  }
};

glob(path.resolve('./') + '/app/dev/nut/**/*.nut', (err, files) => {
    if (err) throw err;
    load(files);
  }
);