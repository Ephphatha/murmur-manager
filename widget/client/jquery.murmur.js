/*
A simple Mumble server interface builder and live updater. Expects the following endpoints:

/murmur/tree/$id - return a JSON data structure describing a server's state, as described in server/README
/murmur/listen?id=murmursrv$id - subscribe for updates 

*/
(function($){
	$.fn.murmur = function(options) {
		var opts = $.extend({}, $.fn.murmur.defaults, options);
		return $(this).each(function() {
		
			var caller = this;
			var callAgain;  
			var comet = function(url, success_callback) {
				callAgain = callAgain || function() { comet(url, success_callback); }
				$.getJSON(url, function(data) {
					success_callback(data);
					setTimeout(callAgain, 0);		// Calling with setTimeout prevents a recursion stack blow
				});
			}				
			
			var updateChannelCounts = function() {
				$(caller).find("em").each(function() {
					var $this = $(this);
					var num = $this.parent().find(".player").length;
					if(opts.showNumInChannel) {
						$this.text(num > 0 ? ("(" + num + ")") : "");
					}
					$(this).parent().removeClass("empty populated");
					if(num == 0) {
						$(this).parent().addClass("empty");
					} else {
						$(this).parent().addClass("populated");
					}
					if(num == 0 && opts.hideEmpty) {
						$this.parent().hide();
					} else {
						$this.parent().show();
					}
				});
			}
			
			var sortChannels = function() {			
				var results = $(caller).find("li.channel");
				results.sort(function(a, b) {
					var $a = $(a);
					var $b = $(b);
					var pa = parseInt($a.attr("rel"));
					var pb = parseInt($b.attr("rel"));
					var ta = $a.find(">span").text();
					var tb = $b.find(">span").text();
					if(pa == pb) {
						return ta < tb ? 1 : -1;
					} else {
						return pa < pb ? 1 : -1;
					}
				});
				for(var i=0; i<results.length; i++) {
					var $result = $(results[i]);
					$result.parent().prepend($result);
				}
			}
			
			var sortPlayers = function() {
				var results = $(caller).find("li.player");
				results.sort(function(a, b) {
					return $(a).text() > $(b).text() ? 1 : -1;
				})
				for(var i=0; i<results.length; i++) {
					var $result = $(results[i]);
					$result.parent().append($result);
				}
			}
			
			var addChannel = function(channelData) {
				var $caller = $(caller);
				var $channel = $caller.find("#channel" + channelData.id);
				if($channel.length > 0) {
					var parent = $caller.find("#channel" + channelData.parent + "> ul");
					if(parent.length > 0) {
						if(channelData.state == "removed") {
							$channel.remove();
						} else {
							$channel = $channel.remove();
							parent.append($channel);
						}
					}
				} else if(channelData.state != "removed") {
					$channel = $(document.createElement("li"));
					$channel.addClass("channel")				
					$channel.attr("id", "channel" + channelData.id);
					$channel.attr("rel", channelData.position);
					$channel.html("<span>" + channelData.name + "</span> <em></em>");
					
					var $list = $(document.createElement("ul"));
					$channel.append($list);
					
					$caller.append($channel);
				}
				$channel.removeClass("permanent");
				$channel.removeClass("temporary");
				$channel.addClass(channelData.state);
			}
			
			var addPlayer = function(playerData) {
				var $caller = $(caller);
				var existing = $caller.find(".player#player" + playerData.name);
				var parent = $caller.find(".channel#channel" + playerData.channel + "> ul");
				var $player;
				if(existing.length > 0) {
					$player = existing.remove();
					if(playerData.state != "offline") {
						parent.append($player);
					}
				} else {
					$player = $(document.createElement("li"));
					$player.addClass("player");				
					$player.attr("id", "player" + playerData.name);
					$player.html("<span>" + playerData.name + "</span>");
					parent.append($player);
				}			
				$player.removeClass("muted").removeClass("deafened");
				if(playerData.mute) $player.addClass("muted");
				if(playerData.deaf) $player.addClass("deafened");
			}
			
			var populateTree = function(data) {
				// The first pass inserts all the channels. The second pass sorts them all into the proper hierarchy. Yay reusable code.
				for(var j=0; j<2; j++) {
					for(var i in data.channels) {
						addChannel(data.channels[i]);
					}
				}
				
				for(var i in data.users) {
					addPlayer(data.users[i]);
				}
				updateChannelCounts();
				sortChannels();
				sortPlayers();
			}
			
			$.ajax({
				type: "GET",
				dataType: "jsonp",
				url: opts.url + "/murmur/tree/" + opts.id + "?callback=?",
				success: function(data) {
					populateTree(data);
					
					// Init realtime updates
					comet(opts.url + "/murmur/listen?id=murmursrv" + opts.id, function(dataset) {
						for(var index in dataset) {
							var data = dataset[index];
							if(data.type == "player") {
								addPlayer(data);
								updateChannelCounts();
								sortPlayers();
							} else if(data.type == "channel") {
								for(i=0; i<2; i++)
									addChannel(data);
								updateChannelCounts();
								sortChannels();
							}
						}
					});			
				},
				error: function(a,b,c) {}
			});
			
			$(this).find(".channel span").live("click", function() {
				var $ul = $(this).parent().find(">ul");
				if($ul.find(">li").length > 0)
					$(this).parent().find(">ul").toggle("fast");
			});
		});
	}
	
	$.fn.murmur.defaults = {
		url: "",
		id: 1,
		hideEmpty: false,
		showNumInChannel: true
	}
	
})(jQuery);
