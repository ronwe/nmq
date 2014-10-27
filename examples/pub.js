var nmq = require('../lib/nmq.js')
var client = nmq.startClient({port : 5000})
client.pub('test' , new Date)
