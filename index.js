var express = require('express');
var fs = require('fs');
var path = require('path');
var app = express();
const disk = require('diskusage');
var database = require('./database');
var bot=require('./telBot.js');



database.connectToDB(function(err){
    if(err){
        bot.sendMsgToAdmins("Невозможно подключиться к БД! Причина:"+err);

    }
});

//getDiscUsageInfo();
getLastBackupFile();

function getDiscUsageInfo(){ console.log("getDiscUsageInfo");
    try {
        var configObj = JSON.parse(fs.readFileSync(path.join(__dirname, './config.json'))); console.log("configObj=",configObj);
    }catch(e){
        console.log("e 22=",e);
        return;
    }
    if(!configObj || ! configObj.sysadminsMsgConfig) return;
    var sysadminsMsgConfig=configObj.sysadminsMsgConfig;
    var system = sysadminsMsgConfig.system ? sysadminsMsgConfig.system : null;
    var backup = sysadminsMsgConfig.backup ? sysadminsMsgConfig.backup : null;

    disk.check(system, function(err, info) {
        if (err) {
            console.log(err);
        } else {
            console.log("available /", info.available/1073741824);
            console.log("free /",info.free/1073741824);
            console.log("total /",info.total/1073741824);
            disk.check(backup, function(err, info) {
                if (err) {
                    console.log(err);
                } else {
                    console.log("available /home", info.available/1073741824);
                    console.log("free /home", info.free/1073741824);
                    console.log("total /home",info.total/1073741824);
                }
            });
        }
    });

}

function getLastBackupFile(){  console.log("getLastBackupFile=");
    try{
        var files = fs.readdirSync(path.join(__dirname,'./backup'));
    }catch(e){
        console.log("data=",data);
    }
    console.log("files[0]=",files[0]);
    fs.stat(path.join(__dirname,'./backup/'+files[0]), function(err, stat){
        console.log("err=",err);
        console.log("stat=",stat);
    })
}

app.listen(8182);
