const trim = (str) => {
  return str.replace(/\n|\t/g, '').replace(/\s+/g, ' ');
};
const single = [
  'br', 'hr', 'img', 'input', 'meta', 'link',
  'col', 'base', 'param', 'track', 'source', 'wbr',
  'command', 'keygen', 'area', 'embed', 'menuitem'
];

const xhtml = (el) => {
  'use strict';
  for (let item of single) {
    let regex = new RegExp('<' + item + '[^>]*>', 'g');
    el = el.replace(regex, (match, capture) => {
      return match.replace('>',' />').replace(/\/\s/g, '');
    });
  }

  el = el.replace(/<(\w+)[^>]*\/>/g, (match, capture) => {
    return match.replace('/>', '></' + capture + '>');
  });

  for (let item of single) {
    let regex = new RegExp('</'+item+'>(.|\n)*?</'+item+'>', 'g');
    el = el.replace(regex, (match)=>{
      if( match.indexOf('<'+item) > -1 ){
        return match;
      }
      return '</'+item+'>';
    });
  }



  return el;
};

const singleTag = (el) => {

  for (let item of single) {
    let regex = new RegExp('<' + item + '((.|\n)*?)>', 'g');
    el = el.replace(regex, (match, capture) => {
      let bool = match.replace(/<(\w+)((.|\n)*?)>/g, (node, tag, attr) => {
        return single.indexOf(tag);
      });

      if (parseInt(bool) === -1) {
        return match;
      } else {
        return trim('<' + item + ' ' + capture + ' />').replace(/\/[\s+]?\/>/g, '/>');
      }
    });

    regex = new RegExp('<' + item + '[^>]*><\/' + item + '>', 'g');
    el = el.replace(regex, (match, capture) => {
      return match.replace('><\/' + item + '>', '>');
    })
  }
  return el;
}

module.exports = {
  xhtml: xhtml,
  singleTag: singleTag
}