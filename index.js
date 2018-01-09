var express = require('express');
var app = express();
var database = require('./database');
var bot=require('./telBot.js');



database.connectToDB(function(err){
    if(err){
        bot.sendMsgToAdmins("Невозможно подключиться к БД! Причина:"+err);

    }
});

app.listen(8182);
