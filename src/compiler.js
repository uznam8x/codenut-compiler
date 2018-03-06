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
const guid = require('guid');
const nut = require(__dirname + '/nut.js');
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
    return new nunjucks.runtime.SafeString(str);
  });

  environment.addGlobal('json', function (data) {
    data = data
      .replace(/=(["\'])([^>]*?)(["\'])/g, '=\\$1$2\\$3')
      .replace(/\\\\/g, '\\');

    return JSON.parse(data);
  });
  environment.addGlobal('stringify', function (data) {
    return new nunjucks.runtime.SafeString(JSON.stringify(data, null, 2));
  });

  const NutExtension = function () {
    this.tags = ['nut'];

    this.parse = function (parser, nodes, lexer) {
      let tok = parser.nextToken();
      let args = parser.parseSignature(null, true);
      parser.advanceAfterBlockEnd(tok.value);

      let body = parser.parseUntilBlocks('endnut');
      parser.advanceAfterBlockEnd();
      return new nodes.CallExtension(this, 'run', args, [body]);
    };

    this.run = function (context, args, body) {
      let id = guid.create().value.replace(/\-/g, '');
      let content = body();
      args.props = args.props || {};
      args.props.slot = {
        default: {
          value: body().replace(/\t|\n/g, '')
            .replace(/>\s+</g, '><')
            .replace(/\s+</g, '<')
            .replace(/<slot[^>]*>(.|\n)*?<\/slot>/g, '')
        }
      };

      let slots = content.match(/<slot[^>]*>(.|\n)*?<\/slot>/g);
      if (slots) {
        _.each(slots, (node) => {
          let el = node.match(/<slot[^>]*>/g)[0];

          let reg = /(\S+)=[\'"]?((?:(?!\/>|>|"|\'|\s).)+)/g;
          let attribs = {};
          let attr;

          while ((attr = reg.exec(el)) !== null) {
            attribs[attr[1]] = attr[2];
          }
          let name = attribs['name'];
          delete attribs['name'];

          args.props.slot[name] = {
            attribs: attribs,
            value: node.replace(/<slot[^>]*>|<\/slot>/g, '')
          }
        })
      }

      let item = nut.get(args.nut);

      if (item.beforeCreate) {
        args = item.beforeCreate(args);
      }
      let output = new nunjucks.runtime.SafeString(environment.renderString(
        `{% import '${args.template}' as ${id} %}
                 {{ ${id}.create(json('${JSON.stringify(args.props, null)}'), json('${JSON.stringify(args.attribs, null)}')) }}
            `));

      if (item.created) {
        output.val = item.created(output.val);
      }
      return output;
    };
  }
  environment.addExtension('NutExtension', new NutExtension());

  const SlotExtension = function () {
    this.tags = ['slot'];

    this.parse = function (parser, nodes, lexer) {

      let tok = parser.nextToken();
      let args = parser.parseSignature(null, true);
      parser.advanceAfterBlockEnd(tok.value);
      let body = parser.parseUntilBlocks('endslot');
      parser.advanceAfterBlockEnd();
      return new nodes.CallExtension(this, 'run', args, [body]);
    };

    this.run = function (context, args, body) {

      return new nunjucks.runtime.SafeString(args && args.value ? args.value : body());
    };
  };

  environment.addExtension('SlotExtension', new SlotExtension());

  environment.renderString(content, data, function (err, result) {
    if (err) {
      console.error(err);
    }
    callback(err ? err.toString() : result);
  });
};

const build = (option) => {
  'use strict';

  return through.obj(function (file, enc, next) {
    'use strict';
    console.info('Compile : ' + file.path.replace(path.resolve('./'), ''));

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
          content = xhtml(content);
          for (let key in nut.get()) {
            content = content.replace(new RegExp(`<${key}[^>]*>`, 'g'), (match, capture) => {
              let item = nut.get(key);
              let props = JSON.parse(JSON.stringify(item.props));

              let reg = /(\S+)=[\'"]?((?:(?!\/>|>|"|\').)+)/g;
              let attribs = {};
              let attr;
              while ((attr = reg.exec(match)) !== null) {
                attribs[attr[1]] = attr[2];
              }
              for (let prop in props) {
                if (attribs[prop]) {
                  props[prop] = attribs[prop];
                  delete attribs[prop];
                }
              }

              let config = {
                file: { path: file.path.replace(path.resolve('./'), '') },
                props: props,
                attribs: attribs,
              };

              config.nut = key;
              config.template = item.template;
              let block = `{% nut ${JSON.stringify(config)} %}`;
              return block;
            });

            content = content.replace(new RegExp(`<[\/]?${key}[^>]*>`, 'g'), '{% endnut %}');
          }
          compile(content, data, option, function (rendered) {
            content = rendered;
            callback(null);
          });
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