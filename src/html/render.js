'use strict';
const path = require('path');
const config = require(path.resolve(__dirname, '../config'))();
const through = require('through2');
const xhtml = require(path.resolve(__dirname, 'util/xhtml'));
const prettify = require(path.resolve(__dirname, 'util/prettify'));
const _ = require('lodash');
const nunjucks = require('nunjucks');
const Vue = require('vue');
const renderer = require('vue-server-renderer').createRenderer();
const cheerio = require('cheerio');
const entities = require('entities');
const async = require('async');

const render = {
  nunjucks: (file, content, option, callback) => {
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

    option = _.defaultsDeep(option || {}, defaults);
    nunjucks.configure(option.envOptions);

    if (!option.loaders) {
      option.loaders = new nunjucks.FileSystemLoader(option.path);
    }

    const compile = new nunjucks.Environment(option.loaders, option.envOptions);
    if (_.isFunction(option.manageEnv)) {
      option.manageEnv.call(null, compile);
    }

    let data = _.cloneDeep(option.data);
    if (file.isNull()) {
      this.push(file);
      return next();
    }
    if (file.data) {
      data = _.merge(file.data, data);
    }

    if (file.isStream()) {
      console.error('Streaming not supported');
      return next();
    }
    const filePath = file.path;

    compile.renderString(content, data, function (err, result) {
      if (err) {
        callback(err);
      } else {
        callback(result);
      }
    });
  },
  vue: (content, option, callback) => {
    let $ = cheerio.load(content, {
      ignoreWhitespace: true,
      xmlMode: true,
      lowerCaseTags: true
    });

    let component = [];
    for (let key in Vue.options.components) {
      let comp = $(key);

      if (comp.length) {
        component.push.apply(component, comp);
      }
    }
    if (component.length) {
      async.each(component, (task, next) => {
          renderer.renderToString(new Vue({
              template: $.html(task),
            }), function (err, rendered) {
              if (err) {
                console.log(err);
              } else {
                $(task).replaceWith(entities.decodeHTML(xhtml(rendered)));
                next();
              }
            }
          );

        }, (err) => {
          if (err) {
            console.log(err);
            callback(err);
          } else {
            let rendered = $.html();
            callback(rendered);
          }
        }
      );
    } else {
      callback(content);
    }
  },
  clean: (el) => {
    if( typeof el === 'string' ){
      return el.replace(/\sdata-server-rendered=['"]\w*['"]/g, '')
        .replace(/[a-z]+="\s*"/g, '')
        .replace(/<!---->/g, '')
        .replace(/>\s</g, '><');
    } else {
      return el.toString();
    }
  }
};

const html = (option) => {
  'use strict';

  return through.obj(function (file, enc, next) {
    'use strict';
    const self = this;
    let content = file.contents.toString();

    try {
      content = xhtml(content);
      async.series([
        (callback) => {
          render.nunjucks(file, content, option, (result) => {
            content = result;
            callback();
          })
        },
        (callback) => {
          render.vue(content, option, (result) => {
            content = result;
            callback();
          });
        },
        (callback) => {
          content = render.clean(content);
          callback();
        }
      ], (err, result) => {
        if (err) {
          console.error(err);
          content = err.toString();
        } else {
          content = prettify(entities.decodeHTML(content));
        }

        file.contents = new Buffer(content);
        self.push(file);
        next();
      })
    } catch (err) {
      console.error(err);
      next();
    }
  })
};

module.exports = html;