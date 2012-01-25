require 'kosmonaut'
require 'cuba'

Cuba.define do
  on "sat" do
    c = Kosmonaut::Client.new("wr://e7fe4ce14597b498de2c224217e9f86ad329b100@127.0.0.1:8081/test")
    res.write c.request_single_access_token(".*")
  end

  on default do
    run Rack::Static.new @app, urls: [""], root: './'
  end
end

run Cuba
