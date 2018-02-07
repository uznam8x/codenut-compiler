const beautify = require('js-beautify');
const _ = require('lodash');
const defaults = {
  indent_handlebars: true,
  indent_inner_html: true,
  extra_liners: [],
  unformatted: ['pre', 'code', 'xmp'],
  indent_size: 2,
  indent_char: ' ',
  indent_with_tabs: false,
  eol: '\n',
  end_with_newline: false,
  indent_level: 0,
  preserve_newlines: false,
  max_preserve_newlines: 1,
  space_in_paren: false,
  space_in_empty_paren: false,
  jslint_happy: false,
  space_after_anon_function: false,
  brace_style: 'expand',
  unindent_chained_methods: false,
  break_chained_methods: false,
  keep_array_indentation: false,
  unescape_strings: false,
  wrap_line_length: 0,
  e4x: false,
  comma_first: false,
  operator_position: 'before-newline'
};

const prettify = (html, option) => {
  const opts = _.defaultsDeep(option || {}, defaults);
  return beautify.html(html, opts);
};

module.exports = prettify;