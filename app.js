
/**
 * Module dependencies.
 */

var express         = require('express')
  , routes          = require('./routes')
  , mongoose        = require('mongoose')
  , WebSocketServer = require('ws').Server
  , CommandHandler  = require('./command_handler')
  , _               = require('underscore')
  , user            = require('./routes/user')
  , server          = null
  , async           = require('async')
  , http            = require('http')
  , path            = require('path');

var app = express();

app.configure(function(){
    app.set('port', process.env.PORT || 3000);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.cookieParser('your secret here'));
    app.use(express.session());
    app.use(app.router);
    app.use(require('stylus').middleware(__dirname + '/public'));
    app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
    app.use(express.errorHandler());
});

app.get('/', routes.index);

server = http.createServer(app);

server.listen(app.get('port'), function(){
    console.log('Express server listening on port '  + app.get('port'));

    var ws       = new WebSocketServer({ server: server })
      , commands = new CommandHandler()
      , projects = require('./model/project')(mongoose)
      , db       = null
      , editList = {}
      , editedBy = function(id) {
            var user = null;
            Object
               .keys(editList)
               .forEach(function(k) {
                    if (editList[k][id]) {
                        user = commands.users[k];
                    }
                });
            return user;
        }
      , send = function(cmd, project) {
            project.editedBy = editedBy(project._id);
            cmd.send(project);
        };

    mongoose.connect('mongodb://localhost/organized');
    db = mongoose.connection;

    db.on('error', function(error) {
        console.log('db error', error);
    });

    db.once('open', function() {
        console.log('db connection open');
    });

    commands.initialize(ws);

    commands.on('get', function(cmd, data, user, key) {
        if (data.title) {
            data.title = new RegExp(data.title);
        }
        projects.find(data, function(error, results) {
            results.forEach(function(r) {
                r.editedBy = editedBy(r._id);
            });
            cmd.send(results);
        });
    });

    commands.on('create', function(cmd, data, user, key) {
        projects.create(data, function(error, project) {
            send(cmd, project);
        });
    });

    commands.on('connected', function(key) {
        editList[key] = {};
    });

    commands.on('disconnected', function(key) {
        delete editList[key];
    });

    commands.on('editstart', function(cmd, data, user, key) {
        if (!editedBy(data._id)) {
            editList[key][data._id] = true;
            projects.findById(data._id, function(error, project) {
                send(cmd, project);
            });
        }
    });

    commands.on('editstop', function(cmd, data, user, key) {
        projects.update(data, function(error, project) {
            delete editList[key][project._id];
            send(cmd, project);
        });
    });

    commands.on('editcancel', function(cmd, data, user, key) {
        projects.findById(data._id, function(error, project) {
            delete editList[key][data._id];
            send(cmd, project);
        });
    });

    commands.on('addresource', function(cmd, data, user, key) {
        projects.addResource(data, { 
            name: user.name
          , clientId: user.id
          , position: 'engineer'
        }, function(error, project) {
            send(cmd,project);
        });
    });

    commands.on('delresource', function(cmd, data, user, key) {
        projects.delResource(data, { clientId: user.id }, function(error, project) {
            send(cmd, project);
        });
    });

    commands.on('broadcast', function(cmd, data, user, key) {
        cmd.send(data);
    });
});
