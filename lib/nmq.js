var net = require('net')


function unWrapMsg(data){
	data = data.toString().trim()
	var _d = data.split(':|:' , 2)
	_d[1] = _d[1] || ''
	var p1 = _d[0].trim()
		,p2 = _d[1].trim()
		,p3 = data.slice(_d[0].length + _d[1].length + 6).trim()
	return [p1 , p2 , p3]
}
function wrapMsg(p1 , p2 ,p3){
	if (undefined === p2 || null === p2 ) {
		console.log('param 2 is lost')
		return null 
	}
	if (undefined === p3) p3= ''
	return [p1.toString() , p2.toString() , p3.toString()].join(':|:') + "\n"
}
exports.startServer = function(config){
	var clients = []
		,msgs = {}

	function broadcast(message, sender) {
		console.log(clients.length)
		for (var i = 0 , j = clients.length ; i < j ; i++ ){
			var client = clients[i]
			// Don't want to send it to sender
			if (sender && client.name === sender.name) return
			client.write(message)
		}
		//process.stdout.write(message)
	}
	var cmd = {
		pub : function(drawer , msg , sender){
			var toSub = wrapMsg('onsub'  , drawer  ,msg)
			broadcast(toSub )
			//broadcast(toSub , sender)
			return null
		},
		push : function(drawer , msg ,sender){
			if (! msgs[drawer]) msgs[drawer] = []
			msgs[drawer].push(msg)
			broadcast(wrapMsg('onpush'  , drawer  ) , sender)
		},
		pull : function(drawer ){
			if (! msgs[drawer]) msgs[drawer] = []
			return msgs[drawer].shift()
		},
		clean : function(drawer){
			if (drawer) msgs[drawer] = []
			else msgs = {}
		}
	}
	net.createServer(function (socket) {
		socket.name = socket.remoteAddress + ":" + socket.remotePort
		clients.push(socket)

		//socket.write("Welcome " + socket.name + "\n")

		socket.on('data', function (data) {
			data = unWrapMsg(data)
			console.log('from client ' ,data)
			var act = data[0]
				,drawer = data[1]
				,msg = data[2]
			if (!cmd[act]) return
			var ret = cmd[act](drawer ,msg ,socket)
			if (null === ret) return
			//console.log(act ,msg , ret ,ret && ret.length)
			//socket.write(wrapMsg('on' + act , JSON.stringify(ret || '') ,msg) )
			if ('object' == typeof ret){
				ret = JSON.stringify(ret)
			}
			socket.write(wrapMsg('on' + act , ret || ''  ,msg) )
			//broadcast(socket.name + "> " + data, socket)
		})

		socket.on('end', function () {
			clients.splice(clients.indexOf(socket), 1)
			//broadcast(socket.name + " left the chat.\n")
		})

	}).listen(config.port)

	return cmd
}


exports.startClient = function(config){
	var _cs = []
		,_cbkOnSub =  {}
		,_cbkOnPull =  {}
		,_subId = 0
		,cmd = {
			'onpull' : function(ret ,cbkid){
					if ('""' == ret) ret = '' 
					var cbk = _cs[cbkid]
					if (cbk) {
						cbk(ret)
						var times = cbk.times
						if (times && times !== true) cbk.times = --times
						if (!times || times <=0 ) delete _cs[cbkid]
						if (cbk.times && ret){
							pull(cbk.drawer , cbk)
						}
					}
			}
			,'onsub': function(drawer , msg){
				if (!_cbkOnSub[drawer]) return
				Object.keys(_cbkOnSub[drawer]).forEach(function(i){
					_cbkOnSub[drawer][i](msg)
				})
			}
			,'onpush' : function(drawer){
				if (!_cbkOnPull[drawer]) return
				pull(drawer , _cbkOnPull[drawer])
			}
		}
	var client 
		,_connected 

	function reConnect(){
		client = null
		_connected = false
		setImmediate(connect)
	}
	function connect(){
		if (_connected) return
		client = net.connect(config , function() {
			_connected = true
			console.log('client connected')

		client.on('data', function(data) {
			data = unWrapMsg(data)
			//console.log('from server' , data)
			var act = data[0]
			if (!cmd[act]) return
			cmd[act](data[1] , data[2])
		})


		client.on('end', function() {
			console.log('client disconnected')
			reConnect()
		})
		})
		client.on('error', function(err) {  
			//console.log('client disconnected' ,err)
			reConnect()
		})
	}

	function writeToServer(body){
		//console.log(body , _cbkOnPull , _cs)
		_connected && body && client.write(body)
	}

	function pull(drawer ,cbk , opt){
		if (opt && opt.times && !cbk.times && !cbk.drawer){
			cbk.times = opt.times
			_cbkOnPull[drawer] = cbk
		}
		var cbkid = cbk.cbkid || (_cs.push(cbk) - 1)
		cbk.drawer = drawer
		cbk.cbkid = cbkid
		writeToServer(wrapMsg('pull' , drawer,cbkid))
	}

	connect()

	return {
		push : function(drawer , msg){
			writeToServer(wrapMsg('push' , drawer , msg))
		}
		,pub : function(drawer , msg){
			writeToServer(wrapMsg('pub' , drawer , msg))
		}
		,unSub : function(drawer , subId){
			if (! _cbkOnSub[drawer]) return
			if (subId ) delete _cbkOnSub[drawer][subId] 
			else delete _cbkOnSub[drawer]
		}
		,sub : function(drawer , cbk , opt){
			if (! drawer || 'function' != typeof cbk) return false
			if ((opt && opt.cover) || ! (drawer in  _cbkOnSub)) _cbkOnSub[drawer] = {} 
			var subId = (+new Date).toString(36) + '.' + ++ _subId
			if (_subId > 500000) _subId = 0
			_cbkOnSub[drawer][subId] = cbk
			return subId 
		}
		,pull : pull 
		,clean : function(drawer ){
			writeToServer(wrapMsg('clean' , drawer ))
		}
	    ,exit : function(){
            client.destroy()
            client = null
			_connected = false
        }
	}
}
