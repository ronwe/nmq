var nmq = require('../lib/nmq.js')
var client = nmq.startClient({port : 5000})
var subId = client.sub('test' ,function(data){
	console.log(data)
} )


client.unSub('test' , subId)
