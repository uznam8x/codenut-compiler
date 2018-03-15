'use strict';
const path = require('path');
const through = require('through2');
const _ = require('lodash');
const nunjucks = require('nunjucks');
const async = require('async');
const uuid = require('uuid/v4');
const nut = require(__dirname + '/nut.js');
const formatter = require('html-formatter');
const fs = require('fs');
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

const Loader = nunjucks.Loader.extend({
  init: function (searchPaths, opts) {
    if (typeof opts === 'boolean') {
      console.log(
        '[nunjucks] Warning: you passed a boolean as the second ' +
        'argument to FileSystemLoader, but it now takes an options ' +
        'object. See http://mozilla.github.io/nunjucks/api.html#filesystemloader'
      );
    }

    opts = opts || {};
    this.pathsToNames = {};
    this.noCache = !!opts.noCache;

    if (searchPaths) {
      searchPaths = ( Object.prototype.toString.call(searchPaths) === '[object Array]' ) ? searchPaths : [searchPaths];
      // For windows, convert to forward slashes
      this.searchPaths = searchPaths.map(path.normalize);
    }
    else {
      this.searchPaths = ['.'];
    }

    if (opts.watch) {
      // Watch all the templates in the paths and fire an event when
      // they change
      var chokidar = require('chokidar');
      var paths = this.searchPaths.filter(fs.existsSync);
      var watcher = chokidar.watch(paths);
      var _this = this;
      watcher.on('all', function (event, fullname) {
        fullname = path.resolve(fullname);
        if (event === 'change' && fullname in _this.pathsToNames) {
          _this.emit('update', _this.pathsToNames[fullname]);
        }
      });
      watcher.on('error', function (error) {
        console.log('Watcher error: ' + error);
      });
    }
  },

  getSource: function (name) {
    var fullpath = null;
    var paths = this.searchPaths;

    for (var i = 0; i < paths.length; i++) {
      var basePath = path.resolve(paths[i]);
      var p = path.resolve(paths[i], name);

      // Only allow the current directory and anything
      // underneath it to be searched
      if (p.indexOf(basePath) === 0 && fs.existsSync(p)) {
        fullpath = p;
        break;
      }
    }

    if (!fullpath) {
      return null;
    }

    this.pathsToNames[fullpath] = name;

    let content = fs.readFileSync(fullpath, 'utf-8');
    content = formatter.closing(content);
    for (let key in adapter) {
      content = adapter[key](content);
    }

    const result = {
      src: content,
      path: fullpath,
      noCache: this.noCache
    };

    return result;
  }
});

const adapter = {
  layout: (html) => {
    html = html.replace(/<layout[^>]*src=['"](\S+)['"][^>]*>/g, (match, capture) => {
      return '{% extends "' + capture + '" %}';
    });
    html = html.replace(/<\/layout>/g, '');
    return html;
  },
  block: (html) => {
    html = html.replace(/<block[^>]*name=['"](\S+)['"][^>]*>/g, (match, capture) => {
      return '{% block ' + capture + ' %}';
    });
    html = html.replace(/<\/block>/g, '{% endblock %}');
    return html;
  },
  include: (html) => {
    html = html.replace(/<include[^>]*src=['"](\S+)['"][^>]*>/g, (match, capture) => {
      return '{% include "' + capture + '" %}';
    });
    html = html.replace(/<\/include>/g, '');
    return html;
  },
  'super': (html) => {
    html = html.replace(/<super[^>]*>/g, '{{ super() }}');
    html = html.replace(/<\/super>/g, '');
    return html;
  }
}

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

    let id = uuid().replace(/\-/g, '');
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
    let output = new nunjucks.runtime.SafeString(
      `{% import '${args.template}' as ${id} %}
                 {{ ${id}.create(json('${JSON.stringify(args.props, null)}'), json('${JSON.stringify(args.attribs, null)}')) }}
            `);

    if (item.created) {
      output.val = item.created(output.val);
    }
    return output;
  };
};

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

const compile = (content, data, option, callback) => {
  option = _.defaultsDeep(option || {}, defaults);
  nunjucks.configure(option.envOptions);

  option.loaders = new Loader(option.path);

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
  environment.addGlobal('boolean', function (data) {
    return (data || "false") === "true";
  });
  environment.addFilter('entity', function (val) {
    return new nunjucks.runtime.SafeString(val
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\//g, '&#47;')
      .replace(/"/g, '&#34;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '&#13;')
      .replace(/%/g, '&#37;')
      .replace(/\{/g, '&#123;')
      .replace(/\}/g, '&#125;')
      .replace(/\s/g, '&nbsp;'));
  });
  environment.addExtension('NutExtension', new NutExtension());
  environment.addExtension('SlotExtension', new SlotExtension());

  environment.renderString(content, data, function (err, result) {
    if (err) {
      console.error(err);
    }
    callback(err ? err.toString() : result);
  });
};

const byteLength = (str) => {
  return str.replace(/[\0-\x7f]|([0-\u07ff]|(.))/g, "$&$1$2").length;
};

const render = (html, data, option, callback) => {
  html = formatter.closing(html);
  let len = byteLength(html);

  for (let key in adapter) {
    html = adapter[key](html);
  }

  // nut
  for (let key in nut.get()) {
    html = html.replace(new RegExp(`<${key}[^>]*>`, 'g'), (match, capture) => {
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
        file: { path: data.filepath.replace(path.resolve('./'), '') },
        props: props,
        attribs: attribs,
      };

      config.nut = key;
      config.template = item.template;
      let block = `{% nut ${JSON.stringify(config)} %}`;
      return block;
    });

    html = html.replace(new RegExp(`<\/${key}[^>]*>`, 'g'), '{% endnut %}');
  }

  compile(html, data, option, function (rendered) {
    if (len === byteLength(rendered)) {
      callback(new nunjucks.runtime.SafeString(rendered));
    } else {
      render(new nunjucks.runtime.SafeString(rendered), data, option, callback);
    }
  })
};

const build = (option) => {
  'use strict';

  return through.obj(function (file, enc, next) {
    'use strict';

    var start = +new Date();

    const self = this;
    let content = '';
    if (file.contents.length) {
      content = file.contents.toString();
    }

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
            render(new nunjucks.runtime.SafeString(rendered), data, option, (compiled) => {
              content = compiled;
              callback(null);
            });
          });
        }
      ], (err) => {
        if (err) {
          console.error(err);
          content = err.toString();
        }

        content = formatter.render(content);
        file.contents = new Buffer(content);
        self.push(file);
        console.info('\x1b[0mCompile \'\x1b[32m' + file.path.replace(path.resolve('./'), '') + '\x1b[0m\' after \x1b[35m' + (+(+new Date()) - start) + '\x1b[0m ms');
        next();
      });
    } catch (err) {
      console.error(err);
      next();
    }
  })
};

module.exports = build;