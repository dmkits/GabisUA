var express = require('express');
var app = express();
var database = require('./database');
var bot=require('./telBot.js');



database.connectToDB(function(err){
    if(err){
        bot.sendMsgToAdmins("Database connection error occured! Reason"+err);
    }
});


//var dbConnectionError=database.getDbdConnectionError();
//if(dbConnectionError){                console.log("(-------------database.bdConnectionError=",database.bdConnectionError);
//    bot.sendMsgToAdmins("Database connection error occured! Reason"+database.bdConnectionError);
//}

app.listen(8182);
