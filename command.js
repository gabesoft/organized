var EventEmitter = require('eventemitter2').EventEmitter2
  , util         = require('util');

function CommandHandler (options) {
    if (!(this instanceof CommandHandler)) { return new CommandHandler(options); }
}

module.exports = CommandHandler;

util.inherits(CommandHandler, EventEmitter);

function Command (ws, name, user) {
    this.ws   = ws;
    this.name = name;
    this.user = user;
}

Command.prototype.send = function(data) {
    var msg = JSON.stringify({ user: this.user, data: data, command: this.name });
    this.ws.send(msg);
};

CommandHandler.prototype.initialize = function(ws) {
    var self = this;

    this.ws = ws;

    // TODO: test with multiple connections and keep track of the sockets

    ws.on('connection', function(socket) {
        console.log('ws connected');

        socket.on('error', function(error) {
            console.log('ws error', error);
            self.emit('error', error);
        });

        socket.on('message', function(message) {
            var data = JSON.parse(message)
              , cmd  = new Command(socket, data.Command, data.user);
            self.emit(cmd, data.data, data.user);
        });

        socket.on('close', function() {
            console.log('ws disconnected');
        });
    });
};




