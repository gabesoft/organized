var async          = require('async')
  , projectFields  = { title: String, description: String }
  , resourceFields = { 
        projectId: mongoose.Schema.Types.ObjectId
      , clientId: String
      , name: String
      , position: String 
    };

module.exports = function(mongoose) {
    var projectSchema  = mongoose.Schema(projectFields)
      , resourceSchema = mongoose.Schema(resourceFields)
      , Project        = mongoose.model('Project', projectSchema)
      , Resource       = mongoose.model('Resource', resourceSchema);

    function prepareProject (doc, cb) {
        if (!doc) { return cb(); }

        var project = doc.toObject();
        Resource.find({ projectId: project._id }, function(err, resources) {
            project.resources = resources.map(function(r) { return r.toObject(); });
            cb(err, project);
        });
    }

    function find (data, cb) {
        Project.find(data, function(error, rows) {
            async.map(rows, prepareProject, cb);
        });
    }

    function findById (id, cb) {
        Project.findById(id, function(error, doc) {
            if (error) { return cb(error); }
            prepareProject(doc, cb);
        });
    }

    function create (data, cb) {
        var project = new Project(data);
        project.save(function(error, doc) {
            if (error) { return cb(error); }
            prepareProject(doc, cb);
        });
    }

    function update (data, cb) {
        Project.findById(data._id, function(error, doc) {
            if (error) { return cb(error); }
            if (!doc) { return cb(); }

            Object
               .keys(data)
               .forEach(function(k) {
                    doc[k] = data[k];
                });

            doc.save();
            delete editList[key][doc._id];

            prepareProject(doc, cb);
        });
    }

    function addResource (data, resourceData, cb) {
        var resource = new Resource(resourceData);
        resource.save(function(error, doc) {
            if (error) { return cb(error); }
            findById(data._id, cb);
        });
    }

    function delResource (data, resourceData, cb) {
        Resource.find(resourceData, function(error, resources) {
            if (error) { return cb(error); }

            if (resources) {
                resources[0].remove(function(error) {
                    if (error) { return cb(error); }
                    findById(data._id, cb);
                });
            } else {
                findById(data._id, cb);
            }
        });
    }

    return {
        find: find
      , findById: findById
      , update: update
      , create: create
      , addResource: addResource
      , delResource: delResource
    }
};
