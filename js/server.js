/**
  * Haskier server interface
  * @constructor
  * @param {object} server
  */

var Server = function(server) {

    /*var _server = server,
        _files  = server.files,
        _states = server.states,
        _table  = server.filesTable,
        _chdir  = '',
        _hacks  = [];*/

    var _files  = server,
        _states = server.states,
        _chdir  = '/',
        _states = server['.sys']['.states'],
        _server = JSON.parse(_files['.sys']['.server']);

    try      { var _table  = JSON.parse(server['.sys']['.filestable']); }
    catch(e) { var _table  = {}; }

    var BLANK = '';
    var SLASH = '/';
    var DOT = '.';
    var DOTS = DOT.concat(DOT);

    function normalize(path) {

        path = path.substr(0, 1) === '/' ? path : _chdir + '/' + path;

        if (!path || path === SLASH) {
            return SLASH;
        }

        var src = path.split(SLASH);
        var target = (path[0] === SLASH || path[0] === DOT) ? [BLANK] : [];
        var i, len, token;

        for (i = 0, len = src.length; i < len; ++i) {
            token = src[i] || BLANK;
            if (token === DOTS) {
                if (target.length > 1) {
                    target.pop();
                }
            } else if (token !== BLANK && token !== DOT) {
                target.push(token);
            }
        }

        return target.join(SLASH).replace(/[\/]{2, }/g, SLASH) || SLASH;
    };

    function _fs(path, type, write) {
        path = normalize(path || '').substr(1);

        if(!path) {
            if(typeof _files !== type)
                return false;

            if(write)
                _files = write;

            return _files;
        }

        var d = _files, p = '', err = false;

        path  = path.split('/');

        for(var i = 0; i < path.length - 1; i += 1) {
            p += '/' + path[i];
            d = d[path[i]];

            if(typeof d !== 'object') {
                err = true;
                break;
            }
        }

        i = path.length - 1;

        if(err)
            return false;

        /*var r = write ? true : (typeof d[path[i]] === type ? d[path[i]] : false);

        if(!write || !r)
            return r;*/

        var r = typeof write !== 'undefined' || (typeof d[path[i]] === type ? d[path[i]] : false);

        if(typeof write === 'undefined' || !r)
            return r;

        if(write !== false)
            d[path[i]] = write;
        else
            delete d[path[i]];

        return true;
    };

    this._fs = function(path, type, write) {
        return _fs(path, type, write);
    };

    this.normalize = function(path) {
        return normalize(path);
    };

    this.get = function() {
        return _files;
    };

    /*this.hack = function(type) {
        return _server.apps.indexOf('hack-' + type) !== -1;
    };*/

    this.networks = function() {
        return _server.networks || [];
    };

    this.hasHypranet = function() {
        return _server.networks && _server.networks.indexOf('hypranet') !== -1;
    };

    this.hacks = function() {
        if(!_files.apps)
            return [];

        var _hacks = [], apps = Object.keys(_files.apps);

        console.log(_files.apps);

        for(var i = 0; i < apps.length; i += 1) {
            if(this.directoryExists('/apps/' + apps[i]) && apps[i].substr(0, 5) === 'hack-') {
                _hacks.push(apps[i].substr(5));
            }
        }

        return _hacks;
    };

    this.security = function() {
        return JSON.parse(_files['.sys']['.server']).security; // fix a supposed chrome bug
        // return _secure;
    };

    this.state = function(state, value) {
        if(typeof value !== 'undefined')
            _states[state] = value;

        return _states[state];
    };

    this.fileExists = function(file) {
        return !!_fs(file, 'string');
    };

    this.directoryExists = this.dirExists = function(dir) {
        return !!_fs(dir, 'object');
    };

    this.writeFile = function(file, content) {
        return _fs(file, 'string', content);
    };

    this.readFile = function(file, dontRemoveLastEmptyLine) {
        var c = _fs(file, 'string');

        if(typeof c !== 'string' || dontRemoveLastEmptyLine)
            return c;

        return c.substr(c.length - 1, 1) === '\n' ? c.substr(0, c.length - 1) : c;
    };

    this.removeFile = function(file) {
        return _fs(file, 'string', false);
    };

    this.makeDirectory = this.mkdir = function(dir) {
        if(this.directoryExists(dir))
            return false;

        return _fs(dir, 'object', {});
    };

    this.ls = this.readDirectory = this.readDir = function(dir, hiddenFiles, showTableHidden, showTableSystem) {
        var d = _fs(dir, 'object');
        if(!d) return false;

        var list = Object.keys(d), final = [], fd;

        if(hiddenFiles && showTableHidden && showTableSystem)
            return list;

        for(var i = 0; i < list.length; i += 1) {
            fd = dir + '/' + list[i];

            if(hiddenFiles || list[i].substr(0,1) !== '.') {
                if(!_table[list[i]] || !_table[list[i]].length)
                    final.push(list[i]);
                else
                    if(showTableHidden || _table[list[i]].indexOf('hidden') !== -1)
                        if(showTableSystem || _table[list[i]].indexOf('system') !== -1)
                            final.push(list[i]);
            }
        }

        return final;
    };

    this.chdir = function(dir) {
        if(typeof dir === 'undefined') return _chdir || '/';
        dir   = this.normalize(dir);
        var e = this.directoryExists(dir);
        if(e) { _chdir = dir; updatePrompt(); }
        return e;
    };

    this.glob = function(search, storage, results, path, oldMatch, level) {

        function regex(str) {
            return new RegExp('^' + str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&").replace(/\\\*/g, '(.*?)').replace(/\\\?/g, '(.)') + '$');
        }

        var a, keys, regExp, j, match;

        path     = path || '';
        level    = level || 0;
        level   += 1;
        oldMatch = oldMatch || [];
        search   = this.normalize(search).substr(1).split('/');
        storage  = storage || _files;
        results  = results || [];

        for(i = 0; i < search.length - 1; i += 1) {
            keys = Object.keys(storage);
            path += '/' + search[i];
            if(path.substr(0, 1) === '/')
                path = path.substr(1);

            if(search[i].indexOf('*') !== -1 || search[i].indexOf('?') !== -1) {
                regExp = regex(search[i]);

                for(j = 0; j < keys.length; j += 1) {
                    if(match = keys[j].match(regExp)) {
                        a = path.split('/'); a = a.slice(0, a.length - 1);
                        glob(search.slice(i + 1).join('/'), storage[keys[j]], results, a.join('/') + '/' + keys[j], oldMatch.concat(match.slice(1)), level);
                    }
                }

                return results;
            }

            storage = storage[search[i]];
        }

        var last = servers.__local.normalize(search[search.length - 1]).substr(1);
        regExp   = regex(last);
        keys     = Object.keys(storage);

        for(i = 0; i < keys.length; i += 1)
            if(match = keys[i].match(regExp))
                results.push({path: path + '/' + keys[i], vars: oldMatch.concat(match.slice(1))});

        return results;
    };

};
