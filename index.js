var express = require('express');
var app = express();
var configFileNameParam=process.argv[2] || "config";
var logger=require('./logger.js')();
var database = require('./database');
database.setAppConfig(configFileNameParam);
require('./telBot.js');
var appConfig=database.getAppConfig();
var appPort=appConfig["appPort"]||80;
app.listen(appPort, function(){
    logger.info("APP started on port +",appPort);
});



