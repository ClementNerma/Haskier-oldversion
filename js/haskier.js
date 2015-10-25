
/**
  * Haskier game
  *
  * Features :
  *     - Auto-save when type a command
  *     - Save ALL data, including firewall state...
  *     - Support of color for jQuery Terminal
  *     - In french !!
  *     - Custom hero name !
  */

var version = '0.2.0.4a', normalSpeed = 1;

try {
    var game = JSON.parse($.ajax({
        url: 'haskier.json',
        cache: false,
        method: 'GET',
        async: false
    }).responseText);
}

catch(e) {
    alert('Bad game content');
    throw new Error('Bad game content\n' + e);
}

var answersLength, connectingIP, _history = game.history;

document.fullscreenEnabled = document.fullscreenEnabled || document.mozFullScreenEnabled || document.documentElement.webkitRequestFullScreen;

function sleep(ms) {
    var start = new Date().getTime(), expire = start + ms;
    while (new Date().getTime() < expire) { }
}

function requestFullscreen(element) {
    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
    } else if (element.webkitRequestFullScreen) {
        element.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
    }
}

$('#go_fullscreen').click(function() {
    if(document.fullscreenEnabled) {
        $('#go_fullscreen').hide();
        requestFullscreen(document.documentElement);
    }
});

function instantServerConnect(IP) {
    vars.connected        = IP;
    vars.connectedLogged  = false;
    server                = new Server(servers[IP]);
    states                = server.states;
}

function command(command) {
    if(!command)
        return ;

    if(!onBeforeCommand)
        didSomethingAfterSave = true;

    if(onBeforeCommand) {
        if(!onBeforeCommand(command))
            return ;
    }

    var _cmd    = command; // backup initial codeline for todo checking
    var args    = command.split(' ');
    var command = args[0];
    args.splice(0, 1);

    if(!commands.hasOwnProperty(command))
        return display('{f_red:La commande ' + command + ' n\'est pas disponible}');

    var cmd = commands[command], cargs = commands[command].arguments, arg, err = false;

    for(var i = 0; i < cargs.length; i += 1) {
        arg = cargs[i];

        if(arg.required && args.length < (i + 1)) {
            err = '{f_red:L\'argument }{f_green,italic:' + arg.name + '}{f_red: est manqant pour la fonction }{f_cyan:' + command + '}';
            break;
        }

        if(arg.regex && !arg.regex.test(args[i])) {
            err = '{f_red:' + arg.error + '}';
            break;
        }

        if(arg.verif && !arg.verif(args[i])) {
            err = '{f_red:' + arg.error + '}';
            break;
        }
    }

    if(err)
        return display(err);

    var err = cmd.core.apply(window, args);

    if(typeof err === 'string')
        return display('{f_red:' + err + '}');

    saveGame();

    // check if todo condition was done

    var done = false;

    for(var i = 0; i < todo.length; i += 1) {
        if(typeof todo[i] === 'string')
            todo[i] = game.todoModels[todo[i]];

        if(todo[i].type === 'afterCommand')
            done = !!eval(todo[i].content);
        else if(todo[i].type === 'command')
            done = (command === todo[i].content)
        else if(todo[i].type === 'command-line')
            done = (_cmd === todo[i].content);
        else
            done = false;

        if(!done)
            break;
    }

    if(done)
        historyNext();
}

var commands = {

    com: {
        legend: 'Ouvre ou ferme le port communication',

        arguments: [
            {
                name  : 'state',
                legend: '{f_cyan:open} ouvre le port, {f_cyan:close} ferme le port',
                regex : /^(open|close)$/,
                error : 'Argument invalide. Le port communication peut être seulement ouvert ou fermé',
                required: true
            }
        ],

        core: function(state) {
            if(state === 'open') {
                server.state('communicationOpened', true);
                display('Port communication {f_cyan:ouvert}');
            } else if(state === 'close') {
                server.state('communicationOpened', false);
                display('Port communication {f_cyan:fermé}');
            }
        }
    },

    firewall: {
        legend: 'Active ou désactive le pare-feu',

        arguments: [
            {
                name  : 'state',
                legend: '{f_cyan:enable} active le pare-feu, {f_cyan:disable} désactive le pare-feu',
                regex : /^(enable|disable)$/,
                error : 'Argument invalide. Le pare-feu peut être seulement activé ou désactivé',
                required: true
            }
        ],

        core: function(state) {
            if(state === 'enable') {
                sever.state('firewall', true);
                display('Pare-feu {f_cyan:activé}');
            } else if(state === 'disable') {
                server.state('firewall', false);
                display('Pare-feu {f_cyan:désactivé}');
            }
        }
    },

    name: {
        legend: 'Change le nom d\'utilisateur',

        arguments: [
            {
                name  : 'name',
                legend: 'Nouveau nom',
                required: true
            }
        ],

        core: function(name) {
            vars.name = name;
            term.set_prompt(vars.name + ' $ ');
            //saveGame(); // futile
        }
    },

    ssh: {
        legend: 'Connexion à un serveur distant',

        arguments: [
            {
                name  : 'IP',
                legend: 'Adresse IP du serveur distant',
                verif : function(IP) {
                    if(!IP.match(/^([0-9]+)\.([0-9]+)\.([0-9]+)\.([0-9]+)$/)) {
                        this.error = 'Cette adresse IP n\'est pas valide. Une adresse IP doit être constituée de la forme suivant : {b_white,f_black:x.x.x.x} où {b_white,f_black:x} désigne un à trois chiffres';
                        return false;
                    }

                    if(!game.servers.hasOwnProperty(IP)) {
                        display('Connexion au serveur distant...');
                        sleep(5000);
                        this.error = 'Impossible de trouver le serveur associé à cette adresse IP';
                        return false;
                    }

                    return true;
                },
                required: true
            },
            {
                helpHide: true
            }
        ],

        core: function(IP, instant) {
            connectingIP = IP;

            if(instant) {
                instantServerConnect(connectingIP);
                send(['Connecté au serveur {italic:' + connectingIP + '}']);
            } else
                send([
                    'Connexion au serveur distant...',
                    {type: 'wait', content: 5000},
                    'Résolution du nom d\'hôte...',
                    {type: 'wait', content: 3000},
                    'Résolution de l\'adresse...',
                    {type: 'wait', content: 3000},
                    'Authentification SSH...',
                    {type: 'wait', content: 7000},
                    'Validation du certificat SSH..',
                    {type: 'wait', content: 3000},
                    'Connexion réussie !\nRécupération des informations serveur...',
                    {type: 'wait', content: 5000},
                    '{italic:Connecté au serveur distant : ' + connectingIP + '}\n{italic:Toutes les commandes que vous allez saisir seront exécutées sur le serveur distant.}',,
                    {type: 'js', content: 'instantServerConnect(connectingIP);'}
                    // ask for login and password
                ]);
        }
    },

    ls: {
        legend: 'Liste les fichiers du serveur',

        arguments: [
            {
                name  : 'directory',
                legend: 'Dossier à lire, si omit, lit la racine du serveur'
            }
        ],

        core: function(dir) {
            // list files and dirs
        }
    },

    help: {
        legend: 'Affiche un texte d\'aide sur une ou plusieurs commandes',

        arguments: [
            {
                name  : 'command',
                legend: 'Afficher le texte d\'aide d\'une commande',
                verif : function(name) {
                    return commands.hasOwnProperty(name) ? true : 'Cette commande n\'existe pas';
                }
            }
        ],

        core: function(name) {

            var list = name ? [name] : Object.keys(commands), cmd, args, help = '';

            for(var i = 0; i < list.length; i += 1) {
                cmd = commands[list[i]]; args = cmd.arguments;

                help += '\n\n{f_cyan:' + list[i] + '}\n{italic:' + cmd.legend + '}';

                for(var j = 0; j < args.length; j += 1) {
                    if(!args[j].helpHide)
                        help += '\n    {f_green:' + args[j].name + '} ' + args[j].legend;
                }
            }

            display(help.substr(1) + '\n');

        }
    }

};

var term = $('#terminal').terminal(function(cmd, term) {
    command(cmd);
}, {
    greetings  : '',
    name       : 'Haskier',
    prompt     : 'Shaun $ ',
    completion : Object.keys(commands)
});

var queue = [];

function formatColor(message) {
    return message.replace(/\{([a-zA-Z0-9#_, ]+):(.*?)\}/g, function(match, style, content) {
        var guib = '', foreground = '', background = '', guibList = ['underline', 'strike', 'overline', 'italic', 'bold', 'glow'];
        style = style.replace(/ /g, '').split(',');

        for(var i = 0; i < style.length; i += 1) {
            if(guibList.indexOf(style[i]) !== -1)
                guib += style[i].substr(0, 1); // guib

            if(style[i].substr(0, 2) === 'f_')
                foreground = style[i].substr(2);

            if(style[i].substr(0, 2) === 'b_')
                background = style[i].substr(2);
        }

        return '[[' + guib + ';' + foreground + ';' + background + ']' + content + ']';

    });
}

function display(message) {
    term.echo(formatColor(message.replace(/\$([a-zA-Z0-9_]+)/g, function(match, v) {
        return vars[v];
    })));
}

function send(messages) {
    if(queue.length) {
        queue = queue.concat(messages);
        return ;
    }

    term.pause();
    queue = messages;
    treatSending();
}

function treatSending() {
    if(!queue.length) {
        saveGame();
        return ;
    }

    var scheduleNext = true, place = Object.keys(queue)[0], q = queue[place];

    if(typeof q === 'string')
        display(formatColor(q));
    else {
        var keys = Object.keys(q);

        if(keys.length === 1)
            q = {
                type: keys[0],
                content: q[keys[0]]
            };

        if(q.type === 'file')
            display('\nFichier : {f_cyan,italic:' + q.filename + '}\n\n=================================\n' + '{italic:' + q.content.split('\n').join('}\n{italic:') + '}\n=================================\n');
        else if(q.type === 'incoming-communication')
            display('{f_darkgrey:=== Communication entrante ===}');
        else if(q.type === 'taken')
            display('{italic:' + q.name + ' est occuppé}');
        else if(q.type === 'command')
            command(q.content, true);
        else if(q.type === 'choice') {
            display('');

            for(var i = 0; i < q.answers.length; i += 1)
                display('{bold:' + (i + 1) + '} : ' + q.answers[i]);

            answersLength = q.answers.length;
            display('\nVotre choix ? [1-' + answersLength + ']\n');

            onBeforeCommand = function(cmd) {
                cmd = parseInt(cmd);

                if(!cmd || cmd < 1 || cmd > answersLength)
                    return display('{f_red:Choix invalide}');

                term.pause();
                onBeforeCommand = null;
                vars.choice     = cmd ;
                setTimeout(treatSending, 1);
                return false;
            };

            scheduleNext = false;
            term.resume();
        } else if(q.type === 'input') {
            display('');

            onBeforeCommand = function(cmd) {
                term.pause();
                onBeforeCommand = null;
                vars.input      = cmd ;
                setTimeout(treatSending, 1);
                return false;
            };

            scheduleNext = false;
            term.resume();
        }
    }

    var old = q;
    queue.splice(place, 1);

    if(!queue.length)
        term.resume();
    else if(scheduleNext)
        setTimeout(function() {
            treatSending();
        }, ((typeof old === 'string' || old.type === 'file') ? 500 + 50 * (old.length || old.content.length / 1.25) : (old.wait || 50 * old.length || 3000)) * normalSpeed);
}

function stopSending() {
    queue = [];
}

function saveGame(afterPoint) {
    if(historyPoint == Object.keys(progress)[0])
        return ;

    if(afterPoint)
        didSomethingAfterSave = false;

    localStorage.setItem('haskier', JSON.stringify({
        progress     : progress,
        historyPoint : historyPoint,
        view         : term.export_view(),
        vars         : vars,
        version      : version,
        servers      : servers,
        gameVersion  : game.version,

        didSomethingAfterSave: didSomethingAfterSave ? 1 : 0
    }));
}

function readHistory(point) {
    if(progress[point])
        return ;

    historyPoint    = point;
    saveGame(true);
    progress[point] = true;

    todo = _history[point].todo;
    send(_history[point].actions || []);
}

function historyNext() {
    var k = Object.keys(_history);
    var i = k.indexOf(historyPoint);

    readHistory(k[i + 1]);
}

var save = localStorage.getItem('haskier'), progress, vars = {name: 'Shaun', server: '__local'}, onBeforeCommand, servers = game.servers;

if(save) {
    try {
        save = JSON.parse(save);

        if(save.version !== version || save.gameVersion !== game.version) {
            var next = 'Save ignored. Created backup : localStorage.haskier_backup. Deleted current save.';
            if(save.version !== version)
                console.warn('Save version is different of current engine version (' + save.version + ' != ' + version + ')\n' + next);
            else
                console.warn('Save game version is differont of current game version (' + save.gameVersion + ' != ' + game.version + ')\n' + next);
            localStorage.setItem('haskier_backup', localStorage.getItem('haskier'));
            localStorage.removeItem('haskier');
            save = {};
        } else {
            progress = save.progress;
            states   = save.states  ;
            vars     = save.vars    ;
            servers  = save.servers ;

            term.import_view(save.view);
        }
    }

    catch(e) {
        console.error('Bad game save\n' + e);
        save = {};
    }
} else
    save = {};

if(!progress) {
    progress = {};

    for(var i in history)
        progress[i] = false;
}

for(var i in servers)
    servers[i].states = game.statesModel;

var server = new Server(servers[vars.server]);

var historyPoint = save.historyPoint || '_init';
var didSomethingAfterSave = save.didSomethingAfterSave || 0;
var todo         = _history[historyPoint].todo;

//display('{f_red,bold,italic:Reprise du jeu}');

if(historyPoint === Object.keys(_history)[0] && !save.didSomethingAfterSave)
    term.clear();

if(!save.didSomethingAfterSave)
    readHistory(historyPoint);
