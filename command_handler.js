
var EventEmitter = require('eventemitter2').EventEmitter2
  , util         = require('util');

function CommandHandler (options) {
    if (!(this instanceof CommandHandler)) { return new CommandHandler(options); }
}

module.exports = CommandHandler;

util.inherits(CommandHandler, EventEmitter);

function Command (sockets, name, user) {
    this.sockets = sockets;
    this.name    = name;
    this.user    = user;
}

Command.prototype.send = function(data) {
    var msg = JSON.stringify({ user: this.user, data: data, command: this.name });
    this.sockets.forEach(function(socket) {
        socket.send(msg);
    });
};

CommandHandler.prototype.socketList = function() {
    var self = this
      , list = [];

    Object
       .keys(self.sockets)
       .forEach(function(k) {
            list.push(self.sockets[k]);
        });

    return list;
};

CommandHandler.prototype.initialize = function(ws) {
    var self = this;

    this.ws      = ws;
    this.sockets = {};

    // TODO: test with multiple connections and keep track of the sockets

    ws.on('connection', function(socket) {
        var key = Date.now() + '';

        self.sockets[key] = socket; // TODO: use sockets

        console.log('ws connected');

        socket.on('error', function(error) {
            console.log('ws error', error);
            self.emit('error', error);
        });

        socket.on('message', function(message) {
            var data = JSON.parse(message.toString())
              , cmd  = new Command(self.socketList(), data.command, data.user);
            self.emit(cmd.name, cmd, data.data, data.user);
        });

        socket.on('close', function() {
            delete self.sockets[key];
            console.log('ws disconnected');
        });
    });
};
