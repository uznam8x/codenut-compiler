const xhtml = (el) => {
  'use strict';
  const trim = (str) => {
    return str.replace(/\n|\t/g, '').replace(/\s+/g, ' ');
  };
  const single = [
    'br', 'hr', 'img', 'input', 'meta', 'link',
    'col', 'base', 'param', 'track', 'source', 'wbr',
    'command', 'keygen', 'area', 'embed', 'menuitem'
  ];
  for (let item of single) {
    let regex = new RegExp('<' + item + '((.|\n)*?)>', 'g');
    el = el.replace(regex, (match, capture) => {
      return trim('<' + item + ' ' + capture + '/>').replace(/\/[\s+]?\//g, '/');
    })
  }
  el = el.replace(/<(\w+)[^>]*\/>/g, (match, capture) => {
    if (single.indexOf(capture) === -1) {
      return match.replace('/>', '></' + capture + '>');
    }
    return match;
  });

  return el;
};

module.exports = xhtml;