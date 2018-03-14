'use strict';
let instance = null;
const path = require('path');
const _ = require('lodash');
const glob = require('glob');


const Nut = ()=>{};
const tag = ["a","abbr","acronym","address","applet","area","article","aside","audio","b","base","basefont","bdi","bdo","big","blockquote","body","br","button","canvas","caption","center","cite","code","col","colgroup","datalist","dd","del","details","dfn","dialog","dir","div","dl","dt","em","embed","fieldset","figcaption","figure","font","footer","form","frame","frameset","h1> to <h6","head","header","hr","html","i","iframe","img","input","ins","kbd","label","legend","li","link","main","map","mark","menu","menuitem","meta","meter","nav","noframes","noscript","object","ol","optgroup","option","output","p","param","picture","pre","progress","q","rp","rt","ruby","s","samp","script","section","select","small","source","span","strike","strong","style","sub","summary","sup","svg","table","tbody","td","template","textarea","tfoot","th","thead","time","title","tr","track","tt","u","ul","var","video","wbr"]
Nut.item = {};
Nut.register = function(obj){
  for(var key in obj){
    if( tag.indexOf(key) > -1 ){
      throw new Error("You can't register the '"+key+ "' tag with Nut");
    }
    Nut.item[key] = obj[key];
  }
};

Nut.get = (name)=>{
  if (name) return Nut.item[name];
  return Nut.item;
};

const load = (file) => {
  'use strict';
  for (let i = 0, len = file.length; i < len; i++) {
    Nut.register( require(path.resolve(__dirname, file[i])) );
  }
};

load(glob.sync(path.resolve('./') + '/app/dev/nut/**/*.nut'));

module.exports = Nut;