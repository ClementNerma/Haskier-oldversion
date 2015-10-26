/**
  * Haskier server interface
  * @constructor
  * @param {object} server
  */

var Server = function(server) {

    var _server = server,
        _files  = server.files,
        _states = server.states,
        _table  = server.filesTable,
        _chdir  = '',
        _hacks  = [];

    for(var i = 0; i < _server.apps.length; i += 1)
        if(_server.apps[i].substr(0, 5) === 'hack-')
            _hacks.push(_server.apps[i].substr(5));

    var BLANK = '';
    var SLASH = '/';
    var DOT = '.';
    var DOTS = DOT.concat(DOT);

    function normalize(path) {

        path = path.substr(0, 1) === '/' ? path : _chdir + '/' + path;;

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

        var r = write ? true : (typeof d[path[i]] === type ? d[path[i]] : false);

        if(!write || !r)
            return r;

        d[path[i]] = write;
        return true;
    };

    this._fs = function(path, type, write) {
        return _fs(path, type, write);
    };

    this.normalize = function(path) {
        return normalize(path);
    };

    this.get = function() {
        return _server;
    };

    /*this.hack = function(type) {
        return _server.apps.indexOf('hack-' + type) !== -1;
    };*/

    this.hacks = function() {
        return _hacks;
    };

    this.state = function(state, value) {
        if(typeof value !== 'undefined')
            _states[state] = value;

        return _states[state];
    };

    this.fileExists = function(file) {
        return !!_fs(file, 'string');
    };

    this.directoryExists = function(dir) {
        return !!_fs(dir, 'object');
    };

    this.writeFile = function(file, content) {
        return _fs(file, 'string', content);
    };

    this.readFile = function(file) {
        return _fs(file, 'string');
    };

    this.ls = function(dir, hiddenFiles, showTableHidden, showTableSystem) {
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
    }

};
