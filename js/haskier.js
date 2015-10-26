
/**
  * Haskier game
  *
  * Features :
  *     - Auto-save when type a command
  *     - Save ALL data, including firewall state...
  *     - Support of color for jQuery Terminal
  *     - In french !!
  *     - Custom hero name !
  *     - Support of multiple servers
  *     - Filesystem commands
  *     - Fake SSH
  */

var version = '0.3b', normalSpeed = 1, scenarioIf = true;

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
    vars.server           = IP;
    //vars.connectedLogged  = false;
    server                = new Server(servers[IP]);
    states                = server.states;
    saveGame();
}

function updatePrompt() {
    term.set_prompt('[[;#00FF00;]' + vars.name + ']@[[;#1E90FF;]' + server.chdir() + ']$ ');
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
    //var args    = command.split(' '); // old method
    var args    = command.match(/(".*?"|[^"\s]+)+(?=\s*|\s*$)/g); // do NOT split spaces between quotes
    var command = args[0];
    args.splice(0, 1);

    if(!commands.hasOwnProperty(command)) {
        console.log(commands, command);
        return display('{f_#FE1B00:La commande ' + command + ' n\'est pas disponible ou n\'existe pas}');
    }

    var cmd = commands[command], cargs = commands[command].arguments, arg, err = false;

    for(var a = 0; a < args.length; a += 1)
        args[a] = args[a].replace(/^"((.|\n)*)"$/, '$1');

    for(var i = 0; i < cargs.length; i += 1) {
        arg = cargs[i];

        if(arg.required && args.length < (i + 1)) {
            err = '{f_#FE1B00:L\'argument }{f_green,italic:' + arg.name + '}{f_#FE1B00: est manqant pour la fonction }{f_cyan:' + command + '}';
            break;
        }

        if(typeof args[i] !== 'undefined') {
            if(arg.regex && !arg.regex.test(args[i])) {
                err = '{f_#FE1B00:' + arg.error + '}';
                break;
            }

            if(arg.verif && !arg.verif(args[i])) {
                err = '{f_#FE1B00:' + arg.error + '}';
                break;
            }
        }
    }

    if(err)
        return display(err);

    var err = cmd.core.apply(window, args);

    if(typeof err === 'string')
        return display('{f_#FE1B00:' + err.split('\n').join('}\n{f_#FE1B00:') + '}');

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
                server.state('firewall', true);
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
            updatePrompt();
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
                        this.error = 'Cette adresse IP n\'est pas valide. Une adresse IP doit être constituée de la forme suivant : }{b_white,f_black:x.x.x.x}{f_#FE1B00: où }{b_white,f_black:x}{f_#FE1B00: désigne un à trois chiffres';
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
            } else {
                var serverSecurity = servers[IP].security, securityHack = [], hackMessages = {
                    'certificate-verification': ['Création du faux certificat...', 2000, 'Votre certificat d\'authentification n\'est pas valide.'],
                    'IP-blacklist': ['Création d\'une adresse IP sur liste blanche...', 7000, 'Cette adresse IP ne fait pas partie de notre liste blanche.'],
                    'geolocalisation': ['Modification de la zone géographique de l\'adresse IP...', 4500, 'Votre zone géographique n\'est pas autorisée à se connecter à ce serveur.'],
                    'ddos': ['Envoi de requêtes massives sur le serveur. Cela peut prendre plusieurs minutes...', 20 * servers[IP]['ddos-complexity'], 'Ce serveur est protégé contre les attaques DDos.'],
                    'multi-tries-IP': ['Tentative de connexion avec une autre adresse IP...', 3000, 'Le serveur a détecté un trafic anormal.'],
                }, hacks = servers.__local.apps, hack = true;

                for(var i = 0; i < serverSecurity.length; i += 1) {
                    securityHack.push('{f_cyan,italic:Hacking server }{f_#FE1B00:' + hackMessages[serverSecurity[i]][2] + '}');
                    securityHack.push({type: 'wait', content: 2000});

                    if(hacks.indexOf('hack-' + serverSecurity[i]) !== -1) {
                        // can hack this
                        securityHack.push('{f_cyan,italic:Hacking server} ' + hackMessages[serverSecurity[i]][0]);
                        securityHack.push({type: 'wait', content: hackMessages[serverSecurity[i]][1]});
                    } else {
                        // can't hack this
                        securityHack.push('{f_cyan,italic:Hacking server} {italic:Impossible d\'outrepasser cette sécurité serveur}');
                        hack = false
                        break;
                    }
                }

                if(!hack) {
                    securityHack.push('{f_#FE1B00:La connexion au serveur a échoué.}');
                    securityHack.push({type: 'wait', content :1000});
                    securityHack.push({type: 'js', content: 'stopSending();'});
                } else {
                    securityHack.push('{f_cyan,italic:Hacking server }{f_#33FF66:Réussi !}');
                }

                send([
                    'Connexion au serveur distant...',
                    {type: 'wait', content: 5000},
                    'Résolution du nom d\'hôte...',
                    {type: 'wait', content: 3000},
                    'Résolution de l\'adresse...',
                    {type: 'wait', content: 3000},
                    'Authentification SSH...',
                    {type: 'wait', content: 7000}
                ].concat(securityHack).concat([
                    'Validation du certificat SSH..',
                    {type: 'wait', content: 3000},
                    'Connexion réussie !\nRécupération des informations serveur...',
                    {type: 'wait', content: 5000},
                    '{italic:Connecté au serveur distant : ' + connectingIP + '}\n{italic:Toutes les commandes que vous allez saisir seront exécutées sur le serveur distant.}',,
                    {type: 'js', content: 'instantServerConnect(connectingIP);'}
                    // ask for login and password
                ]));
            }
        }
    },

    cd: {
        legend: 'Changer de répertoire courant',
        arguments: [
            {
                name  : 'directory',
                legend: 'Nouveau répertoire',
                required: true
            }
        ],
        core: function(dir) {
            if(!server.chdir(dir))
                return 'Ce répertoire n\'existe pas';
        }
    },

    ls: {
        legend: 'Liste les fichiers du serveur',

        arguments: [
            {
                name  : 'directory',
                legend: 'Dossier à lire, si omis, lit la racine du serveur'
            },
            {
                name: 'options',
                legend: 'Commence par un tiret.\n{f_cyan:d} Affiche les détails pour chaque fichier et dossier\n{f_cyan:h} Affiche les fichiers et dossiers cachés'
            }
        ],

        core: function(dir, details) {
            var list = server.ls(dir, details && details.indexOf('h') !== -1);

            if(!list)
                return 'Ce dossier n\'existe pas';

            if(!details || details.indexOf('d') === -1) {
                display(list.join('\n'));
                return ;
            }

            var maxLength = 0;

            for(var i = 0; i < list.length; i += 1)
                if(list[i].length > maxLength)
                    maxLength = list[i].length;

            for(i = 0; i < list.length; i += 1)
                display('{f_#90EE90:' + list[i] + '}' + ' '.repeat(maxLength - list[i].length) + ' {f_#7FFFD4:' + (server.fileExists((dir || '') + '/' + list[i]) ? 'file' : 'directory') + '}');
        }
    },

    read: {
        legend: 'Lire un fichier',
        arguments: [
            {
                name  : 'filename',
                legend: 'Nom du fichier',
                required: true
            }
        ],
        core: function(file) {
            var content = server.readFile(file);

            if(file === false)
                return 'Ce fichier n\'existe pas';

            display(content);
        }
    },

    write: {
        legend: 'Écrit dans un fichier',
        arguments: [
            {
                name  : 'filename',
                legend: 'Nom du fichier',
                required: true
            },
            {
                name  : 'content',
                legend: 'Contenu à écrire',
                required: true
            }
        ],
        core: function(file, content) {
            if(!server.writeFile(file, content))
                return 'Impossible d\'écrire dans ce fichier';
        }
    },

    help: {
        legend: 'Affiche un texte d\'aide sur une ou plusieurs commandes',

        arguments: [
            {
                name  : 'command',
                legend: 'Afficher le texte d\'aide d\'une commande ou {f_cyan:--more} pour afficher la liste compressée des commandes',
                verif : function(name) {
                    return commands.hasOwnProperty(name) || name === '--more';
                },
                error: 'Cette commande n\'existe pas'
            }
        ],

        core: function(name) {

            var list = name && name !== '--more' ? [name] : Object.keys(commands).sort(), cmd, args, help = '';

            if(name === '--more') {
                var maxLength = 0;

                for(var i = 0; i < list.length; i += 1) {
                    if(list[i].length > maxLength)
                        maxLength = list[i].length;
                }

                for(i = 0; i < list.length; i += 1) {
                    cmd = commands[list[i]];
                    display('{f_cyan:' + list[i] + '}' + ' '.repeat(maxLength - list[i].length) + ' ' + cmd.legend);
                }

                return ;
            }

            for(var i = 0; i < list.length; i += 1) {
                cmd = commands[list[i]]; args = cmd.arguments;

                help += '\n\n{f_cyan:' + list[i] + '}\n{italic:' + cmd.legend + '}';

                for(var j = 0; j < args.length; j += 1) {
                    if(!args[j].helpHide)
                        help += '\n    {f_green:' + args[j].name + '} ' + args[j].legend.split('\n').join('\n    ' + ' '.repeat(args[j].name.length) + ' ');
                }
            }

            display(help.substr(1) + '\n');

        }
    },

    networks: {
        legend: 'Liste les réseaux disponibles sur le serveur courant',
        arguments: [],
        core: function() {
            display(server.get().networks.join('\n'));
        }
    },

    browser: {
        legend: 'Récupère des données sur le réseau local. Nécessite d\'avoir l\'application "browser" installée sur la machine',
        arguments: [
            {
                name  : 'URL',
                legend: 'URL à récupérer',
                required: true
            },
            {
                name  : 'protocol',
                legend: 'Nom du réseau à utiliser. Si omis, se connecte au réseau "internet"'
            }
        ],
        core: function(url, proto) {
            var network = server.get().networks;
            proto       = proto || 'internet';

            if(network.indexOf(proto) === -1)
                return 'Impossible de se connecter au réseau sélectionné';

            if(!game.networks[proto].hasOwnProperty(url))
                return 'Page non trouvée';

            display(game.networks[proto][url]);
        }
    },

    js: {
        legend: 'Exécute une commande JavaScript. À utiliser avec précaution !!',
        arguments: [
            {
                name  : 'command',
                legend: 'Commande à exécuter',
                required: true
            }
        ],
        core: function(cmd) {
            try {
                var output = new Function([], cmd)();

                if(typeof output !== 'undefined')
                    display(output);
            }

            catch(e) {
                console.log(e);
                return e.message;
            }
        }
    }

};

var term = $('#terminal').terminal(function(cmd, term) {
    command(cmd);
}, {
    greetings  : '',
    name       : 'Haskier',
    prompt     : '$ ',
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
    while(typeof queue[0] === 'undefined')
        queue.splice(0, 1); // fix chrome bug

    var keys = Object.keys(queue);

    if(!queue.length || !keys.length) {
        saveGame();
        return ;
    }

    var scheduleNext = true, place = keys[0], q = queue[place];

    if(typeof q === 'string' && scenarioIf)
        display(formatColor(q));
    else {
        var keys = Object.keys(q);

        if(keys.length === 1 && !q.type)
            q = {
                type: keys[0],
                content: q[keys[0]]
            };

        if(q.type === 'file' && scenarioIf)
            display('\nFichier : {f_cyan,italic:' + q.filename + '}\n\n=================================\n' + '{italic:' + q.content.split('\n').join('}\n{italic:') + '}\n=================================\n');
        else if(q.type === 'incoming-communication' && scenarioIf)
            display('{f_darkgrey:=== Communication entrante ===}');
        else if(q.type === 'taken' && scenarioIf)
            display('{italic:' + q.name + ' est occuppé}');
        else if(q.type === 'command' && scenarioIf)
            command(q.content, true);
        else if(q.type === 'choice' && scenarioIf) {
            display('');

            for(var i = 0; i < q.answers.length; i += 1)
                display('{bold:' + (i + 1) + '} : ' + q.answers[i]);

            answersLength = q.answers.length;
            display('');
            term.set_prompt('Votre choix [1-' + answersLength + '] ? ');

            onBeforeCommand = function(cmd) {
                cmd = parseInt(cmd);

                if(!cmd || cmd < 1 || cmd > answersLength)
                    return display('{f_#FE1B00:Choix invalide}');

                display('');
                term.pause();
                updatePrompt();
                onBeforeCommand = null;
                vars.choice     = cmd ;
                setTimeout(treatSending, 1);
                return false;
            };

            scheduleNext = false;
            term.resume();
        } else if(q.type === 'input' && scenarioIf) {
            term.set_prompt('? ');

            onBeforeCommand = function(cmd) {
                term.pause();
                updatePrompt();
                onBeforeCommand = null;
                vars.input      = cmd ;
                setTimeout(treatSending, 1);
                return false;
            };

            scheduleNext = false;
            term.resume();
        } else if(q.type === 'js' && scenarioIf) {
            try { new Function([], q.content)(); }
            catch(e) {
                display('{f_#FE1B00:Scenario JS command has crashed. Open developper\'s console for more details.}');
                console.log(q, e);
            }
        } else if(q.type === 'if') {
            if(q.var)
                scenarioIf = vars[q.var] === q.mustBe.toString();
            else if(q.server)
                scenarioIf = new Server(servers[q.server]).readFile(q.file) === q.mustBe.toString();
        } else if(q.type === 'else') {
            scenarioIf = !scenarioIf;
        } else if(q.type === 'end') {
            scenarioIf = true;
        } else if(q.type === 'game-over' && scenarioIf) {
            display('{f_#FE1B00,bold:Vous avez échoué. }{f_#FE1B00,bold,italic:Game Over}');
            queue        = [];
            queue[place] = 0;
            scheduleNext = false;
        } else if(q.type === 'end-of-game' && scenarioIf) {
            display('\n{f_cyan,italic:Vous avez terminé le jeu. Félicitations !}' + (version.substr(0, 2) === '0.' ? '\n{f_cyan,italic:Notez que ceci était une version Alpha du jeu et que le scénario n\'est, à ce titre, pas terminé.}' : '') + '\n{f_cyan,italic:Je vous remercie d\'avoir joué à ce jeu. N\'hésitez pas à le commenter sur mon compte twitter (@ClementNerma) afin que je puisse l\'améliorer. Merci !}');
        } else if(q.type !== 'wait' && scenarioIf) {
            display('{f_#FE1B00:Unknown scenario command. Open developper\'s console for more details.}');
            console.error(q);
        }
    }

    var old = q;
    queue.splice(place, 1);

    if(!queue.length || !Object.keys(queue).length) // fix chrome bug
        term.resume();
    else if(scheduleNext)
        setTimeout(function() {
            treatSending();
        }, (
            (!scenarioIf ? 0 :
                (typeof old === 'string' || old.type === 'file') ?
                500 + 50 * (old.length || old.content.length / 1.25) :
                    (q.type === 'if' || q.type === 'else' || q.type === 'end' ? 0 :
                        (old.wait || 50 * old.length || 3000)))) * normalSpeed);
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
        chdir        : server.chdir(),

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
    console.log(_history[point].actions);
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
                console.warn('Save game version is different of current game version (' + save.gameVersion + ' != ' + game.version + ')\n' + next);
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

if(typeof save.chdir !== 'undefined')
    server.chdir(save.chdir);

var historyPoint = save.historyPoint || '_init';
var didSomethingAfterSave = save.didSomethingAfterSave || 0;
var todo         = _history[historyPoint].todo;

//display('{f_#FE1B00,bold,italic:Reprise du jeu}');

updatePrompt();

if(historyPoint === Object.keys(_history)[0] && !save.didSomethingAfterSave)
    term.clear();

if(!save.didSomethingAfterSave)
    readHistory(historyPoint);
