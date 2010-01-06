require 'rubygems'
require 'daemons'
require 'interfaces/ice'

IDLE_NAMES = %w"afk idle"		# The first channel matching any of these names will be the catch-all idle channel
IDLE_TIMEOUT = 3600				# Move people to the AFK channel after one hour1
RUN_EVERY = 300

daemon_options = {
  :multiple => false,
  :dir_mode => :normal,
  :dir => ".",
  :backtrace => true
}
 
Daemons.run_proc('murmur-afk-monitor', daemon_options) do
	@meta = Murmur::Ice::Meta.new
	user_last_channel = {}
	while true do
		@meta.list_servers(true).each do |server|
			channel_min_list = {}
			channel_idle = {}
			user_last_channel[server.id] ||= {}
			
			afk_channel = nil
			server.get_channels.each do |key, channel|
				if IDLE_NAMES.include? channel.name.downcase then
					afk_channel = channel.id
					break
				end
			end
			next if afk_channel.nil?
			
			users = server.get_users
			users.each do |id, user|
				channel_min_list[user.channel] ||= []
				channel_min_list[user.channel].push user.idlesecs.to_i
			end
			channel_min_list.each {|k, v| channel_idle[k] = v.min }
			
			users.each do |id, user|
				# puts "#{user.name} idle for #{user.idlesecs} in #{user.channel} (channel idle for #{channel_idle[user.channel]})"				
				if 	user_last_channel[server.id][id] != afk_channel and
					user.channel != afk_channel and 
					user.idlesecs.to_i > IDLE_TIMEOUT and 
					channel_idle[user.channel] > IDLE_TIMEOUT then
						user.channel = afk_channel
						server.set_state(user)
				end
				user_last_channel[server.id][id] = user.channel
			end
		end
		sleep(RUN_EVERY)
	end
end