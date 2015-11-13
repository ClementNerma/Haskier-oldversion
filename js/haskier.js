
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
  *     - And so much !
  */

function  r()  { allowSaving = false; localStorage.clear(); window.location.reload(); }
function _t(f) { var d = Date.now(); f(); return Date.now() - d; }
function _c(c) { cc=c; return _t(function(){command(cc)}); }
function _m(c,d) { var a=0,s=Date.now(); d=d||100; for(var i=0;i<100;i+=1){command(c)} return (Date.now()-s)/100; }
function _s()  { return JSON.parse(localStorage.getItem('haskier')); };

var version = '0.3.0.5b', normalSpeed = 1, scenarioIf = true, _sm_saves, _sm_saves_json, sendInstant = false,
    onDisplayEnd, displayMsg, displayInt, opened, paused, initMessage, displayPrompt, allowSaving = true, cc,
    sendTimeout, activeTimeout, sending;

//Object.clone = function(e){var n;if(null==e||"object"!=typeof e)return e;if(e instanceof Date)return n=new Date,n.setTime(e.getTime()),n;if(e instanceof Array){n=[];for(var t=0,r=e.length;r>t;t++)n[t]=Object.clone(e[t]);return n}if(e instanceof Object){n={};for(var o in e)e.hasOwnProperty(o)&&(n[o]=Object.clone(e[o]));return n}throw new Error("Unable to copy obj! Its type isn't supported.")};
Object.clone = function(e){return jQuery.extend(true,{},e);};

try {
    var haskier = JSON.parse($.ajax({
        url: 'haskier.php',
        cache: false,
        method: 'GET',
        async: false
    }).responseText);
}

catch(e) {
    alert('Game is wrong or corrupted');
    throw new Error(e);
}

try {
    var game = JSON.parse(haskier.scenario['scenario.json']);
}

catch(e) {
    alert('Game scenario is wrong or corrupted');
    throw new Error(e);
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

function formatDate(ms) {
    var date    = new Date(ms)                    ,
        day     = (date.getDay() + 1).toString()  ,
        month   = (date.getMonth() + 1).toString(),
        years   = date.getFullYear().toString()   ,
        hours   = date.getHours().toString()      ,
        minutes = date.getMinutes().toString()    ;

    return '0'.repeat(2 - day.length) + day + '/' + '0'.repeat(2 - month.length) + month + '/' + years + ' '
         + '0'.repeat(2 - hours.length) + hours + ':' + '0'.repeat(2 - minutes.length) + minutes;
}

function instantServerConnect(IP) {
    vars.server           = IP;
    //vars.connectedLogged  = false;
    server                = servers[IP];
    states                = _servers[IP]['.sys']['.states'];
    saveGame();
}

function updatePrompt() {
    term.set_prompt('[[;' + vars.green + ';]' + vars.name + ']:[[;' + vars.blue + ';]' + server.chdir() + ']$ ');
}

function command(command) {
    var l = command.split(';;');

    if(l.length > 1) {
        for(var i = 0; i < l.length; i += 1)
            window.command(l[i]);

        return ;
    }

    if(!command)
        return ;

    command = command.replace(/\\;;/g, ';;');

    var parsed = $.terminal.parseCommand(command.trim());

    if(onBeforeCommand) {
        if(!onBeforeCommand(command, parsed))
            return ;
        else
            didSomethingAfterSave = true;
    } else
        didSomethingAfterSave = true;

    /*var _cmd    = command; // backup initial codeline for todo checking
    //var args    = command.split(' '); // old method
    var args    = command.match(/(".*?"|[^"\s]+)+(?=\s*|\s*$)/g); // do NOT split spaces between quotes
    var command = args[0];
    args.splice(0, 1);*/

    var _cmd    = command,
        command = parsed.name,
        args    = parsed.args;

    // Store log

    if(!server.directoryExists('.sys'))
        server.makeDirectory('.sys');

    try {
        var log = JSON.parse(server.readFile('.sys/.log') || '[]');
        log.push([command].concat(args).join(' '));
        if(!server.writeFile('.sys/.log', JSON.stringify(log)))
            console.error('Failed to log command : ' + [command].concat(args).join(' '));
    }

    catch(e) {
        console.error('Corrupted log');
        server.makeDirectory('.sys');
        if(!server.writeFile('.sys/.log', '[]'))
            console.error('Failed to create a new empty log');
    }

    var commands = window.commands();

    // Run command

    if(!commands.hasOwnProperty(command)) {
        //console.log(commands, command);
        return display('{f_$red:La commande ' + command + ' n\'est pas disponible ou n\'existe pas}');
    }

    var cmd = commands[command], cargs = cmd.arguments, arg, err = false;

    /*for(var a = 0; a < args.length; a += 1)
        args[a] = args[a].replace(/^"((.|\n)*)"$/, '$1');*/

    for(var i = 0; i < cargs.length; i += 1) {
        arg = cargs[i];

        if(arg.required && args.length < (i + 1)) {
            err = '{f_$red:L\'argument }{f_$green,italic:' + arg.name + '}{f_$red: est manqant pour la fonction }{f_cyan:' + command + '}';
            break;
        }

        if(typeof args[i] !== 'undefined') {
            if(arg.regex && !arg.regex.test(args[i])) {
                err = '{f_$red:' + arg.error + '}';
                break;
            }

            if(arg.verif && !arg.verif(args[i])) {
                err = '{f_$red:' + arg.error + '}';
                break;
            }
        }
    }

    if(err)
        return display(err);

    var err = cmd.core.apply(window, args);

    if(typeof err === 'string')
        return display('{f_$red:' + err.split('\n').join('}\n{f_$red:') + '}');

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

function commands() {
    var apps = server.glob('/apps/*'), commands = Object.clone(_commands), name;

    // create list of commands

    for(var i = 0; i < apps.length; i += 1) {
        name = apps[i].vars[0];

        if(!commands.hasOwnProperty(name) && server.dirExists('/apps/' + name) && server.fileExists('/apps/' + name + '/app.hps')) {
            commands[name] = {};
            try {
                new Function(['module', 'appName'], server.readFile('/apps/' + name + '/app.hps')).apply(window, [commands[name], name]);
            }

            catch(e) {
                throw new Error('Execution of command "' + name + '" failed :\n' + new String(e));
            }
        }
    }

    return commands;
}

var _commands = {

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
                vars.talking = '';
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
                        this.error = 'Cette adresse IP n\'est pas valide. Une adresse IP doit être constituée de la forme suivant : }{b_white,f_black:x.x.x.x}{f_$red: où }{b_white,f_black:x}{f_$red: désigne un à trois chiffres';
                        return false;
                    }

                    if(!servers.hasOwnProperty(IP)) {
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
                var serverSecurity = servers[IP].security(), securityHack = [], hackMessages = {
                    'certificate-verification': ['Création du faux certificat...', 2000, 'Votre certificat d\'authentification n\'est pas valide.'],
                    'IP-blacklist': ['Création d\'une adresse IP sur liste blanche...', 7000, 'Cette adresse IP ne fait pas partie de notre liste blanche.'],
                    'geolocalisation': ['Modification de la zone géographique de l\'adresse IP...', 4500, 'Votre zone géographique n\'est pas autorisée à se connecter à ce serveur.'],
                    'ddos': ['Envoi de requêtes massives sur le serveur. Cela peut prendre plusieurs minutes...', 20 * servers[IP]['ddos-complexity'], 'Ce serveur est protégé contre les attaques DDos.'],
                    'multi-tries-IP': ['Tentative de connexion avec une autre adresse IP...', 3000, 'Le serveur a détecté un trafic anormal.'],
                }, hacks = servers.__local.hacks(), hack = true;

                for(var i = 0; i < serverSecurity.length; i += 1) {
                    securityHack.push('{f_cyan,italic:Hacking server }{f_$red:' + hackMessages[serverSecurity[i]][2] + '}');
                    securityHack.push({type: 'wait', content: 2000});

                    if(hacks.indexOf(serverSecurity[i]) !== -1) {
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
                    securityHack.push('{f_$red:La connexion au serveur a échoué.}');
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

            if(content === false)
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

    clear: {
        legend: 'Efface l\'écran',
        arguments: [],
        core: function() {
            term.clear();
        }
    },

    home: {
        legend: 'Retourne sur votre ordinateur, déconnexion automatique du serveur courant (annule SSH)',
        arguments: [],
        core: function() {
            display('Connected to {f_cyan:home} computer');
            instantServerConnect('__local');
        }
    },

    help: {
        legend: 'Affiche un texte d\'aide sur une ou plusieurs commandes',

        arguments: [
            {
                name  : 'command',
                legend: 'Afficher le texte d\'aide d\'une commande. Si omis, affiche la liste compressée des commandes',
                verif : function(name) {
                    return commands().hasOwnProperty(name);
                },
                error: 'Cette commande n\'existe pas'
            }
        ],

        core: function(name) {

            var commands = window.commands(), list = name ? [name] : Object.keys(commands).sort(), cmd, args, help = '';

            if(!name) {
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
                        help += '\n    ' + args[j].legend.split('\n').join('\n    ');
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

    /*browser: {
        legend: 'Récupère des données sur le réseau local. Nécessite l\'application "browser"',
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
    },*/

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
    },

    about: {
        legend: 'À propos du jeu... (Crédits, FAQ...)',
        arguments: [],
        core: function() {
            display([
                '\n{f_$blue,bold:=== Crédits ===}\n',
                '{f_cyan:Développeur} Clément Nerma',
                '\n{f_$blue,bold:=== Bibliothèques ===}\n',
                'jQuery',
                'jQuery.terminal',
                '\n{f_$blue,bold:=== FAQ ===}\n',
                '{bold:Q} Le message "Installation des fichiers requis" au début du jeu fait-il partie du scénario ?',
                '{bold:R} Non, $haskier a réellement besoin d\'installer certains fichiers pour pouvoir fonctionner.\n  Il s\'agit de fichiers stockés sur votre ordinateur, mais qui ne peuvent pas être exécutés, ne vous inquiétez pas.\n',
                '{bold:Q} Pourquoi le nom de $haskier ?',
                '{bold:R} Ça m\'est venu comme ça, d\'un coup. Mais si vous avancez un peu dans le jeu, vous verrez à quoi ça correspond.\n',
                '{bold:Q} Pourquoi avoir fait un jeu en ligne de commandes ? OnHack utilisait une interface graphique, non ?',
                '{bold:R} Mon but n\'était pas vraiment de créer un jeu similaire à OnHack, mais plutôt un jeu basé sur un scénario plus profond,\n  Même si le jeu ne possède pas d\'interface graphique.\n',
                '{bold:Q} Combien de temps as-tu mis à développer ce jeu ?',
                '{bold:R} À l\'heure où je vous parle, je développe actuellement la version v0.2 Alpha, et j\'ai dû y passer entre une vingtaine et une trentaine d\'heures.\n  Mais j\'ai loin d\'avoir fini !'
            ].concat('').join('\n'))
        }
    },

    save: {
        legend: 'Gérer votre sauvegarde de jeu',
        arguments: [],
        core: function(gameOver) {
            display('\n===== Gestionnaire de sauvegardes =====');
            send(
                [{
                    choice: [
                        'Créer un copie de la sauvegarde',
                        'Restaurer une copie de la sauvegarde',
                        'Estimer la taille de la sauvegarde',
                        '(!) Recommencer le jeu'
                    ]
                }, {
                    js: function() { // SMB = Save Manager Backup
                        //queue = []; // fix chrome bug
                        switch(vars.choice) {
                            case 1:
                                // make a save copy
                                send([
                                    { input: 'Choisissez le nom de la copie : (lettres, chiffres, {f_$green:_ -} autorisés)' },
                                    { js: function() {
                                        if(!vars.input.match(/^[a-zA-Z0-9_\-]+$/))
                                            display('{f_$red:Nom de sauvegarde invalide}');
                                        else {
                                            localStorage.setItem('haskier_smb_' + vars.input, JSON.stringify({
                                                date: Date.now(),
                                                save: localStorage.getItem('haskier')
                                            }));
                                            display('Copie effectuée.');
                                        }
                                    } }
                                ], true);
                                break;

                            case 2:
                                // restore a save copy
                                display('Liste des copies :');
                                var keys       = Object.keys(localStorage), sav, date;
                                _sm_saves      = [];
                                _sm_saves_json = [];
                                for(var i = 0; i < keys.length; i += 1) {
                                    if(keys[i].match(/^haskier_smb_(.*)$/)) {
                                        try {
                                            sav  = JSON.parse(localStorage.getItem(keys[i]));
                                            date = formatDate(sav.date);
                                            _sm_saves.push('{f_$green:' + date + ' '.repeat(16 - date.length) + '} {f_cyan:' + keys[i].substr(12) + '}');
                                            _sm_saves_json.push(sav);
                                        }

                                        catch(e) {
                                            _sm_saves.push('{f_$red:??????????} ' + keys[i].substr(12) + ' {f_$red:[Corrompu]}');
                                            _sm_saves_json.push(false);
                                        }
                                    }
                                }

                                send([
                                    { choice: _sm_saves.concat('{f_cyan:Annuler}') },
                                    { js: function() {
                                        if(vars.choice === (_sm_saves.length) + 1)
                                            return ;

                                        var save = _sm_saves_json[vars.choice - 1];

                                        if(!save)
                                            return display('{f_$red:Impossible de restaurer une sauvegarde corrompue}');

                                        localStorage.setItem('haskier', save.save);

                                        window.location.reload();
                                        send([{ wait: Date.now() }]);
                                    } }
                                ], true);
                                break;

                            case 3:
                                display('Liste des copies :\n');
                                var keys = Object.keys(localStorage), list = [], corrupted = [], dates = [], sizes = [], listMax = sizeMax = 1, length, sav;
                                for(var i = 0; i < keys.length; i += 1) {
                                    if(keys[i].match(/^haskier_smb_([a-zA-Z0-9_\-]+)$/)) {
                                        list.push(keys[i].substr(12));
                                        sizes.push(localStorage.getItem(keys[i]).length);

                                        try {
                                            sav = JSON.parse(localStorage.getItem(keys[i]));
                                            sav.date = formatDate(sav.date);
                                            dates.push(' '.repeat(16 - sav.date.length) + sav.date);
                                        }

                                        catch(e) {
                                            corrupted[i] = true;
                                            dates.push('{f_$red:??????????}');
                                        }

                                        listMax = Math.max(listMax, list[list.length - 1].length);
                                        sizeMax = Math.max(sizeMax, sizes[sizes.length - 1].toString().length);
                                    }
                                }

                                for(i = 0; i < list.length; i += 1)
                                    display(list[i] + ' '.repeat(listMax - list[i].length) + ' '.repeat(sizeMax - sizes[i].length) + ' {f_cyan:' + sizes[i] + '} {f_$green:' + dates[i] + '} ' + (corrupted[i] ? ' {f_$red:[Corrompu]}' : ''));

                                if(!list.length)
                                    display('Aucune sauvegarde trouvée');

                                break;

                            case 4:
                                // restart the game from the beginning
                                send([
                                    { input: 'Souhaitez-vous réellement recommencer le jeu ? Toute progression sera perdue !\n{bold:NOTE :} Vos copies de sauvegardes seront conservées et pourront être restaurées à tout moment}\nTapez votre nom de joueur : {bold:$name} pour recommencez le jeu' },
                                    { js: function() {
                                        if(vars.input != vars.name)
                                            return ;

                                        localStorage.removeItem('haskier');
                                        window.location.reload();
                                    } }
                                ], true);
                                break;
                        }
                    }
                }]
            );
        }
    }

};

var term = $('#terminal').terminal(function(cmd, term) {
    command(cmd);
}, {
    greetings  : '',
    name       : 'Haskier',
    prompt     : '$ ',
    completion : function() {
        return Object.keys(commands());
    },
    clear      : false
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

function display(message, onEnd) {
    if(onEnd && normalSpeed) {
        message = message.replace(/\$([a-zA-Z0-9_]+)/g, function(match, v) {
            return vars[v];
        });
        paused = term.paused();
        term.resume();
        $('#cover').show().click();
        displayPrompt = term.get_prompt();
        term.set_prompt('');
        onDisplayEnd = onEnd;
        displayMsg   = initMessage = displayMsg ? displayMsg + '\n' + message : message;
        displayMsg   = displayMsg.replace(/\{([a-zA-Z0-9#_, ]+):(.*?)\}/g, '$2').replace(/\[\[([a-zA-Z0-9# ;]+)\](.*?)\]/g, '$2');
        opened       = '';
        displayInt   = setInterval(function() {
            /*while('{}'.indexOf(message.substr(0, 1)) !== -1) {
                if(displayMsg.substr(0, 1) === '{') {
                    opened  = displayMsg.match(/^\{([a-zA-Z0-9#_, ]+):(.*?)\}/)[1];
                    displayMsg = displayMsg.replace(/^\{([a-zA-Z0-9#_, ]+):(.*?)\}/, '$2}');
                } else if(displayMsg.substr(0, 1) === '}') {
                    opened = '';
                    displayMsg = displayMsg.substr(1);
                }
            }*/

            //term.insert(formatColor(opened ? '{' + opened + ':' + displayMsg.substr(0, 1) + '}' : displayMsg.substr(0, 1)));
            term.insert(displayMsg.substr(0, 1));
            $('#cover').click();
            displayMsg = displayMsg.substr(1);

            if(!displayMsg.length) {
                clearInterval(displayInt);
                $('#cover').hide();

                term.set_prompt(displayPrompt);
                term.set_command('');
                term.echo(formatColor(initMessage));

                if(paused)
                    term.pause();

                onEnd();
            }
        }, 75 * normalSpeed);
    } else {
        term.echo(formatColor(message.replace(/\$([a-zA-Z0-9_]+)/g, function(match, v) {
            return vars[v];
        })));

        if(onEnd)
            onEnd();
    }
}

function send(messages, instant) {

    if(Object.keys(queue).length) { // fix chrome bug
        queue       = queue.concat(messages);
        sendInstant = instant;

        if(!sending && !activeTimeout)
            treatSending();

        return ;
    }

    term.pause();
    //queue       = queue.concat(messages); // queue = messages;
    //sending     = true;
    queue = messages;
    //console.log(Object.clone(messages));
    //sendInstant = instant; ?? put it here or not ?
    if(!sending && !activeTimeout) {
        //scenarioIf = true;
        treatSending();
    }
}

function treatSending() {
    sending = true;

    /*while(typeof queue[0] === 'undefined')
        queue.splice(0, 1); // fix chrome bug*/

    var keys = Object.keys(queue);

    if(!queue.length || !keys.length) {
        /*ID = -1;
        previous = -1;*/
        //saveGame();
        clearTimeout(sendTimeout); // just a precaution
        sending       = false;
        activeTimeout = false;
        return ;
    }

    var scheduleNext = true, place = keys[0], q = queue[place];

    //var a = Object.clone(q); if(Object.keys(q)[0] === '0') { var b = ''; for(var k in a) b += a[k]; a = b; }; console.debug(a);

    if((typeof q === 'string' || q.type === 'text') && scenarioIf) {
        if(!server.state('communicationOpened') || !vars.talking || q.type === 'text')
            display(formatColor(q.type === 'text' ? q.content : q));
        else {
            display(formatColor(q), function() {
                queue.splice(0, 1);

                if(!Object.keys(queue).length) { // fix chrome bug
                    term.resume();
                    //saveGame();
                } else
                    treatSending();
            });
            sending = false;
            return ;
        }
    } else {
        var keys = Object.keys(q);

        if(keys.length === 1 && !q.type) {
            q = {
                type: keys[0],
                content: q[keys[0]]
            };
        }

        //var a = Object.clone(q); if(Object.keys(q)[0] === '0') { var b = ''; for(var k in a) b += a[k]; a = b; }; console.debug(a);
        //console.log(q);

        if(q.type === '_commentary') {
            // it's a commentary, so it does nothing
        } else if(q.type === 'file' && scenarioIf) {
            display('\nFichier : {f_cyan,italic:' + q.filename + '}\n\n=================================\n{italic:' + q.content.split('\n').join('}\n{italic:') + '}\n=================================\n');
        } else if(q.type === 'download' && scenarioIf) {
            var filename = q.file.split('/');
            filename     = filename[filename.length - 1];
            display('\nFichier : {f_cyan,italic:' +  filename  + '}\n\n=================================\n{italic:' + servers[q.from].readFile(q.file).split('\n').join('}\n{italic:') + '}\n=================================\n');
        } else if(q.type === 'incoming-communication' && scenarioIf) {
            display('{f_darkgrey:=== Communication entrante ===}');
            vars.talking = 'Undefined';
        } else if(q.type === 'taken' && scenarioIf) {
            display('{italic:' + q.name + ' est occuppé}');
        } else if(q.type === 'command' && scenarioIf) {
            command(q.content, true);
        } else if(q.type === 'talking' && scenarioIf)
            vars.talking = q.content;
        else if(q.type === 'choice' && scenarioIf) {
            display('');

            for(var i = 0; i < q.content.length; i += 1)
                display('{bold:' + (i + 1) + '} : ' + q.content[i]);

            answersLength = q.content.length;
            display('');
            term.set_prompt('Votre choix [1-' + answersLength + '] ? ');

            onBeforeCommand = function(cmd) {
                cmd = parseInt(cmd);

                if(!cmd || cmd < 1 || cmd > answersLength)
                    return display('{f_$red:Choix invalide}');

                display('');
                term.pause();
                updatePrompt();
                onBeforeCommand = null;
                vars.choice     = cmd ;
                activeTimeout   = true;
                setTimeout(treatSending, 1);
                return false;
            };

            scheduleNext = false;
            term.resume();
        } else if(q.type === 'input' && scenarioIf) {
            if(q.content)
                display(q.content);

            term.set_prompt('? ');

            onBeforeCommand = function(cmd) {
                term.pause();
                updatePrompt();
                onBeforeCommand = null;
                vars.input      = cmd ;
                activeTimeout   = true;
                setTimeout(treatSending, 1);
                return false;
            };

            scheduleNext = false;
            term.resume();
        } else if(q.type === 'js' && scenarioIf) {
            try {
                /*if(q.content.match(/^(repeatH|h)istory(Next|)\(([0-9]*)\)(;|)$/)) {
                    scheduleNext = false; // needed patch
                    sending      = false;
                }*/

                typeof q.content === 'function' ? q.content() : new Function(['sending', 'scheduleNext'], q.content)(sending, scheduleNext);
            }
            catch(e) {
                display('{f_$red:Scenario JS command has crashed. Open developper\'s console for more details.}');
                console.log(q, e);
                console.log(e);
                throw new Error('Scenario JS command has crashed');
            }
        } else if(q.type === 'js_file' && scenarioIf) {
            try { new Function([], haskier.scenario[q.content])(); }
            catch(e) {
                display('{f_$red:Scenario JS file has crashed (' + q.content + '). Open developper\'s console for more details.}');
                console.log(q, e);
                console.log(e);
                throw new Error('Scenario JS file has crashed (' + q.content + ')');
            }
        } else if(q.type === 'if') {
            if(q.var) {
                if(typeof vars[q.var] !== 'undefined')
                    scenarioIf = vars[q.var].toString() === q.mustBe.toString();
                else
                    throw new Error('Variable "' + q.var + '" is not defined !');
            } else if(q.server)
                scenarioIf = servers[q.server].readFile(q.file) === q.mustBe.toString();
        } else if(q.type === 'else') {
            scenarioIf = !scenarioIf;
        } else if(q.type === 'end') {
            scenarioIf = true;
        } else if(q.type === 'set' && scenarioIf) {
            if(q.var)
                vars[q.var] = q.value;
            else if(q.server)
                vars.writedServer = !!servers[q.server].writeFile(q.file, q.value);
        } else if(q.type === 'game-over' && scenarioIf) {
            vars.gameOver = true;
            display('{f_$red,bold:Vous avez échoué. }{f_$red,bold,italic:Game Over}. Tapez <{f_cyan:js r()}> pour recommencer une nouvelle partie.');
            display('Toute action effectuée, hormis la réinitalisation de la partie, peut entraîner des bugs du jeu. Il est donc conseillé de réinitialiser votre sauvegarde dès maintenant.');
            queue         = [];
            scheduleNext = false;
            setTimeout(function() {
                localStorage.setItem('haskier_before_gameover', localStorage.getItem('haskier'));
                localStorage.removeItem('haskier');
                window.location.reload();
            }, 5000);
        } else if(q.type === 'end-of-game' && scenarioIf) {
            display('\n{f_cyan,italic:Vous avez terminé le jeu. Félicitations !}' + (version.substr(0, 2) === '0.' ? '\n{f_cyan,italic:Notez que ceci était une version Alpha du jeu et que le scénario n\'est, à ce titre, pas terminé.}' : '') + '\n{f_cyan,italic:Je vous remercie d\'avoir joué à ce jeu. N\'hésitez pas à le commenter sur mon compte twitter (@ClementNerma) afin que je puisse l\'améliorer. Merci !}');
        } else if(q.type !== 'wait' && scenarioIf) {
            display('{f_$red:Unknown scenario command. Open developper\'s console for more details.}');
            console.error(q);
        }
    }

    var old = q;
    queue.splice(place, 1);

    //console.log(old);

    //if(!queue.length || !Object.keys(queue).length) { // fix chrome bug
    if(!Object.keys(queue).length) { // fix chrome bug
        clearTimeout(sendTimeout); // just a precaution
        sendInstant   = false;
        activeTimeout = false;
        term.resume();
        //saveGame();
    } else if(scheduleNext) {
        //clearTimeout(sendTimeout);
        activeTimeout = true;
        sendTimeout   = setTimeout(function() {
            treatSending();
        }, (
            (!scenarioIf ? 0 :
                typeof old === 'string' || old.type === 'file' ?
                        500 + 50 * (old.length || old.content.length / 1.25) :
                            (q.type === 'if' || q.type === 'else' || q.type === 'end' ? 0 :
                                (old.wait || 50 * old.length || 3000)))) * (normalSpeed && (sendInstant ? 0 : 1)));
    }

    sending = false;
}

function stopSending() {
    queue   = [];
    clearTimeout(sendTimeout);
}

function saveGame(afterPoint) {
    if(historyPoint == Object.keys(progress)[0] || !allowSaving)
        return ;

    if(afterPoint)
        didSomethingAfterSave = false;

    localStorage.setItem('haskier', JSON.stringify({
        progress     : progress,
        historyPoint : historyPoint,
        view         : term.export_view(),
        vars         : vars,
        version      : version,
        game         : haskier,
        gameVersion  : game.version,
        chdir        : server.chdir(),

        didSomethingAfterSave: didSomethingAfterSave ? 1 : 0
    }));

}

function readHistory(point) {
    /*if(progress[point])
        return ;*/

    clearTimeout(sendTimeout);
    queue         = []   ;
    activeTimeout = false;
    scenarioIf    = true ;

    historyPoint    = point;
    saveGame(true);

    //progress[point] = true;

    if(_history[point].autoBackup) {
        localStorage.setItem('haskier_smb_' + _history[point].autoBackup, JSON.stringify({
            date: Date.now(),
            save: localStorage.getItem('haskier')
        }));
    }

    todo = _history[point].todo;
    //console.log(_history[point].actions);
    var a = Object.clone(_history[point].actions), arr = [], q = Object.keys(a);
    for(var i = 0; i < q.length; i += 1)
        arr.push(a[q[i]]);

    send([{_commentary: 'Head command to solve Haskier\'s bug'}].concat(arr));
}

function historyNext(n) {
    var k = Object.keys(_history);
    var i = k.indexOf(historyPoint);

    readHistory(k[i + (n || 1)]);
}

function repeatHistory() {
    readHistory(historyPoint);
}

var save = localStorage.getItem('haskier'), progress, vars = {
    name    : 'Shaun',
    server  : '__local',
    haskier : '{f_cyan,italic:Haskier}',
    hypernet: '{f_#8066B3,bold,italic:HyperNet}',

    green : '#00FF00',
    blue  : '#1E90FF',
    red   : '#FE1B00',
    purple: '#8066B3'

}, onBeforeCommand, _servers = haskier.servers;

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
            //states   = save.states  ;
            vars     = save.vars    ;
            _servers = save.game.servers ;
            //haskier  = save.game    ;
            var ohaskier = haskier;
            haskier.servers = save.game.servers;
            haskier.servers.__store = ohaskier.servers.__store;

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

if(!Object.keys(save).length) {
    //console.log(servers);
    for(var i in _servers)
        _servers[i]['.sys']['.states'] = Object.clone(game.statesModel);
}

var servers = {};

for(var i in _servers)
    servers[i] = new Server(_servers[i]);

var server = servers[vars.server];

if(typeof save.chdir !== 'undefined')
    server.chdir(save.chdir);

var historyPoint = save.historyPoint || Object.keys(_history)[0];
var didSomethingAfterSave = save.didSomethingAfterSave || 0;
var todo         = _history[historyPoint].todo;

//display('{f_$red,bold,italic:Reprise du jeu}');

updatePrompt();

if(historyPoint === Object.keys(_history)[0] && !save.didSomethingAfterSave)
    term.clear();

if(!save.didSomethingAfterSave)
    readHistory(historyPoint);

$('#cover').hide();
