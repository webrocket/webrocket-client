require 'kosmonaut'
require 'cuba'

Cuba.define do
  on "sat" do
    c = Kosmonaut::Client.new("wr://d2599f2759bfe6f9af95b177cafcdcda13d611f4@127.0.0.1:8081/test")
    res.write c.request_single_access_token("test", ".*")
  end

  on default do
    run Rack::Static.new @app, urls: [""], root: './'
  end
end

run Cuba
