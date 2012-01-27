require 'kosmonaut'
require 'cuba'

Cuba.define do
  on "sat" do
    c = Kosmonaut::Client.new("wr://967e765ff134dc4e28e88ad4cacb182ad9ef2669@127.0.0.1:8081/test")
    res.write c.request_single_access_token("test", ".*")
  end

  on default do
    run Rack::Static.new @app, urls: [""], root: './'
  end
end

run Cuba
