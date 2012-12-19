
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

    var ws             = new WebSocketServer({ server: server })
      , commands       = new CommandHandler()
      , projects = require('./model/project')(mongoose)
      //, projectSchema  = mongoose.Schema({ title: String, description: String })
      //, resourceSchema = mongoose.Schema({ 
            //projectId: mongoose.Schema.Types.ObjectId
          //, clientId: String
          //, name: String
          //, position: String })
      //, Project  = mongoose.model('Project', projectSchema)
      //, Resource = mongoose.model('Resource', resourceSchema)
      , db       = null
      , editList = {}
      , editedBy  = function(id) {
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
      , prepareProject = function(doc, cb) {
            var project = doc.toObject();
            project.editedBy = editedBy(doc._id);
            Resource.find({ projectId: project._id }, function(err, resources) {
                project.resources = resources;
                cb(err, project);
            });
        }
      , findProject = function(id, cb) {
            Project.findById(id, function(err, doc) {
                prepareProject(doc, function(err, project) {
                    cb(err, project);
                });
            });
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

        //Project.find(data, function(err, rows) {
            //async.map(rows, function(r, cb) {
                //prepareProject(r, cb);
            //}, function(err, results) {
                //cmd.send(results);
            //});
        //});
    });

    commands.on('create', function(cmd, data, user, key) {
        var project = new Project(data);
        project.save(function(error, doc) {
            if (error) { return cmd.send(error); } 

            prepareProject(doc, function(err, project) {
                cmd.send(project);
            });
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
            findProject(data._id, function(err, project) {
                cmd.send(project);
            });
        }
    });

    commands.on('editstop', function(cmd, data, user, key) {
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

                prepareProject(doc, function(err, project) {
                    cmd.send(project);
                });
            }
        });
    });

    commands.on('editcancel', function(cmd, data, user, key) {
        delete editList[key][data._id];
        findProject(data._id, function(err, project) {
            cmd.send(project);
        });
    });

    commands.on('addresource', function(cmd, data, user, key) {
        var resource = new Resource({ 
                name: user.name
              , clientId: user.id
              , position: 'engineer'
              , projectId: data._id 
            });

        resource.save(function(error, doc) {
            if (error) {
                cmd.send(error);
            } else {
                findProject(data._id, function(err, project) {
                    cmd.send(project);
                });
            }
        });

    });

    commands.on('delresource', function(cmd, data, user, key) {
        Resource.find({ clientId: user.id }, function(err, results) {
            if (results) {
                results[0].remove(function(err) {
                    findProject(data._id, function(err, project) {
                        cmd.send(project);
                    });
                });
            } else {
                findProject(data._id, function(err, project) {
                    cmd.send(project);
                });
            }
        });
    });

    commands.on('broadcast', function(cmd, data, user, key) {
        cmd.send(data);
    });
});
