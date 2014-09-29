server :

var nmq = require('./nmq.js')

var s = nmq.startServer({port : 5000}) var i = 0 setInterval(function(){ s.push('t' , ['server',i++]) s.pub('p','pub',i++ )

}, 1000)

client:

var nmq = require('./nmq.js')

var s = nmq.startClient({port : 5000}) var i = 0 s.pull('t' , function(x){ console.log('I got it' , x) } , {times : true})

s.sub('p' , function(x){ console.log('I sub it ' ,x) })
