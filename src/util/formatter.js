const xhtml = (el) => {
  'use strict';
  return el.replace(/<(\w+)[^>]*\/>/g, (match, capture) => {
    return match.replace('/>', '></' + capture + '>');
  });
};

const singleTag = (el) =>{
  const single = [
    'br', 'hr', 'img', 'input', 'meta', 'link',
    'col', 'base', 'param', 'track', 'source', 'wbr',
    'command', 'keygen', 'area', 'embed', 'menuitem'
  ];
  for (let item of single) {

    let regex = new RegExp('<'+item+'[^>]*><\/'+item+'>', 'g');
    el = el.replace(regex, (match, capture) => {
      return match.replace('><\/'+item+'>', ' />');
    })
  }
  return el;
};

module.exports = {
  xhtml:xhtml,
  singleTag:singleTag
};