
// Les données ne sont pas installées sur les serveurs !

var server, search, j, n = 0, serversNumber = Object.keys(servers).length, name, app;

for(var i in _servers) {
    n += 1;
    display('Installation des données sur le serveur (' + n + '/' + serversNumber + ')')
    server = servers[i];

    server.makeDirectory('/apps');
    server.makeDirectory('/.sys');
    server.writeFile('/.sys/.log', '[]');
    server.writeFile('/.sys/.filetables', '{}');

    search = server.glob('/apps/*.store');

    for(j = 0; j < search.length; j += 1) {
        name = search[j].vars[0];
        app  = _servers.__store.webroot.apps[name];
        // search[j] is something like {file: "/apps/xampp.pointer", vars: ["xampp"]}
        if(!app) {
            if(name.substr(0, 5) === 'hack-')
                server._fs('/apps/' + name, 'object', {});
            else
                throw new Error('Application "' + name + '" was not found in the store for server "' + i + '"');
        } else
            server._fs('/apps/' + name, 'object', app);

        server.removeFile(search[j].path);
    }
}

display('{italic:Installation terminée sur le serveur.}');
