'use strict';
let instance = null;
const path = require('path');
const _ = require('lodash');
const glob = require('glob');


const Nut = ()=>{};
Nut.item = {};
Nut.register = function(obj){
  for(var key in obj){
    Nut.item[key] = obj[key];
  }
}
Nut.get = (name)=>{
  if (name) return Nut.item[name];
  return Nut.item;
}
const load = (file) => {
  'use strict';
  for (let i = 0, len = file.length; i < len; i++) {
    Nut.register( require(path.resolve(__dirname, file[i])) );
  }
};

load(glob.sync(path.resolve('./') + '/app/dev/nut/**/*.nut'));

module.exports = Nut;