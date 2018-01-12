const xhtml = (el) => {
  const trim = (str) => {
    return str.replace(/\n|\t/g, '').replace(/\s+/g, ' ').toLowerCase()
  };

  for (let item of ['br', 'hr', 'img', 'input', 'meta', 'link']) {
    let regex = new RegExp('<' + item + '((.|\n)*?)>', 'g');
    el = el.replace(regex, (match, capture) => {
      return trim('<' + item + ' ' + capture + '/>').replace(/\/[\s+]?\//g, '/');
    })
  }
  return el;
};

module.exports = xhtml;