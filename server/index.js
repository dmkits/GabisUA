var express = require('express');
var app = express();
var configFileNameParam=process.argv[2] || "config";
var logger=require('./logger.js')();
var database = require('./database');
database.setAppConfig(configFileNameParam);
var telBot=require('./telBot.js');
var appConfig=database.getAppConfig();
var appPort=appConfig["appPort"]||80;
process.on('uncaughtException', function(err){
    logger.error("uncaughtException occurred "+err);
});
app.listen(appPort, function(){
    logger.info("APP started on port +",appPort);
    telBot.sendStartMsg();
});



