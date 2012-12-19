
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
app.get('/users', user.list);

app.get('/project/:id', function(req, res) {
    var id = req.params.id;
    res.send({ id: id, title: 'First Project', description: 'Hope this works' });
});

app.put('/project', function(req, res) {
    var body = req.body
      , id   = Date.now();
    console.log(body);
    res.send({ id: id, title: body.title, description: body.description });
});

app.post('/project', function(req, res) {
    var body = req.body
      , id   = Date.now();
    res.send({ id: id, title: body.title, description: body.description });
});

server = http.createServer(app);

server.listen(app.get('port'), function(){
    console.log('Express server listening on port '  + app.get('port'));

    var ws            = new WebSocketServer({ server: server })
      , handler       = new CommandHandler()
      , projectSchema = mongoose.Schema({ title: String, description: String })
      , Project       = mongoose.model('Project', projectSchema)
      , db            = null
      , editList      = {}
      , editing       = function(id) {
            var res = false;
            Object
               .keys(editList)
               .forEach(function(k) {
                    res = res | editList[k][id];
                });
            return res;
        };

    mongoose.connect('mongodb://localhost/organized');
    db = mongoose.connection;

    db.on('error', function(error) {
        console.log('db error', error);
    });

    db.once('open', function() {
        console.log('db connection open');
    });

    handler.initialize(ws);

    handler.on('get', function(cmd, data, user, key) {
        if (data.title) {
            data.title = new RegExp(data.title);
        }
        Project.find(data, function(err, results) {
            cmd.send(results);
        });
    });

    handler.on('create', function(cmd, data, user, key) {
        var project = new Project(data);
        project.save(function(error, doc) {
            if (error) {
                cmd.send(error);
            } else {
                cmd.send(doc);
            }
        });
    });

    handler.on('connected', function(key) {
        editList[key] = {};
    });

    handler.on('disconnected', function(key) {
        delete editList[key];
    });

    handler.on('editstart', function(cmd, data, user, key) {
        if (!editing(data._id)) {
            editList[key][data._id] = true;
            cmd.send(data);
        }
    });

    handler.on('editstop', function(cmd, data, user, key) {
        Project.findById(data._id , function(error, doc) {
            if (error) { 
                cmd.send(error);
            } else {
                Object
                   .keys(data)
                   .forEach(function(k) {
                        doc[k] = data[k];
                    });
                doc.save();
                delete editList[key][doc._id];
                cmd.send(doc);
            }
        });
    });

    handler.on('editcancel', function(cmd, data, user, key) {
        delete editList[key][doc._id];
        cmd.send(data);
    });

    handler.on('broadcast', function(cmd, data, user, key) {
        cmd.send(data);
    });
});

//ws.on('connection', function(socket) {
//console.log('connection initiated');

//socket.send('This is the server. You are connected', function(err) {
//console.log('SEND', err);
//});


//socket.on('message', function(message) {
//console.log('CLIENT', message);
//socket.send('This is the server. The time here is ' + (new Date()).toString(), function(err) {
//console.log('SEND', err);
//});
//});

//socket.on('error', function() {
//console.log('ERROR', arguments);
//});

//socket.on('close', function() {
//console.log('connection closed');
//});
//});
