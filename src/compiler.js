'use strict';
const path = require('path');
const through = require('through2');
const xhtml = require(path.resolve(__dirname, 'util/xhtml'));
const prettify = require(path.resolve(__dirname, 'util/prettify'));
const _ = require('lodash');
const nunjucks = require('nunjucks');
const cheerio = require('cheerio');
const entities = require('entities');
const async = require('async');
const nut = require(path.resolve(__dirname, 'nut'));
const defaults = {
  path: '.',
  ext: '.html',
  data: {},
  inheritExtension: false,
  envOptions: {
    watch: false
  },
  manageEnv: null
};

const compile = (content, data, option, callback) => {
  option = _.defaultsDeep(option || {}, defaults);
  nunjucks.configure(option.envOptions);

  if (!option.loaders) {
    option.loaders = new nunjucks.FileSystemLoader(option.path);
  }

  const environment = new nunjucks.Environment(option.loaders, option.envOptions);
  if (_.isFunction(option.manageEnv)) {
    option.manageEnv.call(null, compile);
  }

  environment.addGlobal('arrtibs', function (arrtibs) {
    let str = '';
    for (let key in arrtibs) {
      str += `${key}="${arrtibs[key]}" `;
    }
    return str;
  });

  environment.addGlobal('json', function (data) {
    return JSON.parse(data);
  });

  environment.renderString(content, data, function (err, result) {
    callback(err ? err.toString() : result);
  });
}

const component = ($, data, option, next) => {
  let queue = [];
  for (let key in nut.get()) {

    let comp = $(key);

    if (comp.length) {
      queue.push.apply(queue, comp);
    }
  }

  if (queue.length) {
    async.each(queue, (task, callback) => {
      let item = nut.get(task.name);
      let props = JSON.parse(JSON.stringify(item.props));

      for (let key in props) {
        if (task.attribs[key]) {
          props[key] = task.attribs[key];
          delete task.attribs[key];
        }
      }
      let config = {
        data: JSON.parse(JSON.stringify(data)),
        props: props,
        el: task
      };

      if (item.beforeCreate) {
        config = item.beforeCreate(config);
      }

      let before = $.html(task);
      compile(item.template, config, option, function (rendered) {
        let result = { rendered: rendered, data: data, el: task };
        if (item.created) result = item.created(result);

        rendered = (xhtml(result.rendered));
        $(task).replaceWith(rendered);

        callback(null);
      });

    }, (err) => {
      if (err) {
        console.log(err);
        next(err.toString());
      } else {
        next($.html());
        $ = null;
      }
    });
  } else {
    next($.html());
    $ = null;
  }

};

require(__dirname + '/config.js');
const build = (option) => {
  'use strict';

  return through.obj(function (file, enc, next) {
    'use strict';
    console.info('Compile : '+file.path.replace(path.resolve('./'), ''));

    const self = this;
    let content = '';
    if (file.contents.length) {
      content = file.contents.toString();
    }
    content = xhtml(content);
    let data = _.cloneDeep(option.data) || {};

    if (file.isNull()) {
      this.push(file);
      return next();
    }
    if (file.data) {
      data = _.merge(file.data, data);
    }
    data.filepath = file.path.replace(path.resolve('./'), '');

    if (file.isStream()) {
      console.error('Streaming not supported');
      return next();
    }
    try {
      async.series([
        (callback) => {
          compile(content, data, option, function (rendered) {
            content = rendered;
            callback(null);
          });
        },
        (callback) => {
          component(
            cheerio.load(content, {
              ignoreWhitespace: false,
              xmlMode: true,
              lowerCaseTags: true
            }), data, option, (rendered) => {
              content = rendered;
              callback();
            }
          );
        },
      ], (err, result) => {
        if (err) {
          console.error(err);
          content = err.toString();
        }
        content = prettify(xhtml(content)).replace(/(&#x[^\s|\n|\t]*;)/g, (match, capture) => {
          return entities.decodeHTML(capture);
        });
        file.contents = new Buffer(content);
        self.push(file);
        next();
      });
    } catch (err) {
      console.error(err);
      next();
    }
  })
};

module.exports = build;