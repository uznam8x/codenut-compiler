'use strict';
const path = require('path');
const config = require(path.resolve(__dirname, '../config'))();
const through = require('through2');
const xhtml = require(path.resolve(__dirname, 'util/xhtml'));
const prettify = require(path.resolve(__dirname, 'util/prettify'));
const _ = require('lodash');
const nunjucks = require('nunjucks');
const cheerio = require('cheerio');
const entities = require('entities');
const async = require('async');
const nut = require(path.resolve(__dirname, 'util/nut'));

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
  nut: (file, content, option, callback) => {

    let $ = cheerio.load(content, {
      ignoreWhitespace: true,
      xmlMode: true,
      lowerCaseTags: true
    });
    let component = [];

    for (let key in nut.get()) {
      let comp = $(key);

      if (comp.length) {
        component.push.apply(component, comp);
      }
    }

    let data = {};
    if (file.data) {
      data = file.data;
    }

    const compile = new nunjucks.Environment();
    compile.addGlobal('arrtibs', function (arrtibs) {
      let str = '';
      for (let key in arrtibs) {
        str += `${key}="${arrtibs[key]}" `;
      }
      return str;
    });

    if (component.length) {
      async.each(component, (task, next) => {
          let item = nut.get(task.name);
          let props = item.props;

          for (let key in props) {
            if (task.attribs[key]) {
              props[key] = task.attribs[key];
              delete task.attribs[key];
            }
          }
          if( item.beforeCreate ){
            data = item.beforeCreate(data, props, file);
          }
          compile.renderString(item.template, {el: task, props: props, data: data}, (err, rendered) => {
            if (err) {
              console.log(err);
            } else {
              rendered = entities.decodeHTML(xhtml(rendered));
              if (item.created) rendered = item.created(rendered, file);
              $(task).replaceWith(rendered);

              next();
            }
          });

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
    if (typeof el === 'string') {
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
    let content = '';
    if (file.contents.length) {
      content = file.contents.toString();
    }

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
          render.nut(file, content, option, (result) => {
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
          content = prettify(entities.decodeHTML(xhtml(content)));
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