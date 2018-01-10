var express = require('express');
var fs = require('fs');
var path = require('path');
var app = express();
var disk = require('diskusage');
var database = require('./database');
var cron = require('node-cron');
var bot=require('./telBot.js');
var moment = require('moment');



database.connectToDB(function(err){
    if(err){
        bot.sendMsgToAdmins("Невозможно подключиться к БД! Причина:"+err);

    }
});

var scheduleAdminMsg;
function startSendAdminMsgBySchedule(){
    var serverConfig=getServerConfig();
    var schedule=serverConfig.sysadminsSchedule;
    if(!schedule) schedule='*/15 * * * * *';
    var valid = cron.validate(schedule);
    if(valid==false){
        console.log("invalide cron format");
        return;
    }
    var sysadminsMsgConfig = serverConfig.sysadminsMsgConfig;
    if(!sysadminsMsgConfig) return;
    if(scheduleAdminMsg)scheduleAdminMsg.destroy();
    scheduleAdminMsg =cron.schedule(schedule, function(){
        var diskSpase= getDiscUsageInfo(sysadminsMsgConfig);
        var lastBackpupFile = getLastBackupFile(sysadminsMsgConfig);
        var adminMsg='';
        if(diskSpase && diskSpase.system){
            adminMsg += "Ресурс: \n System: объем:"+diskSpase.system.total+"Гб, свободно:"+diskSpase.system.free+ "Гб ("+diskSpase.system.freePercent +"%).";
        }
        if(diskSpase && diskSpase.backup){
            adminMsg += "\n Ресурс: \n Backup: объем:"+diskSpase.backup.total+"Гб, свободно:"+diskSpase.backup.free+ "Гб ("+diskSpase.backup.freePercent +"%).";
        }
        if(lastBackpupFile && lastBackpupFile.backupDate && lastBackpupFile.fileName){
            adminMsg+="\n Последняя резервная копия БД "+ lastBackpupFile.fileName+" от " + moment(lastBackpupFile.backupDate).format("DD-MM-YYYY HH:mm:ss");
        }
        console.log("adminMsg=",adminMsg);
        if(adminMsg)   bot.sendMsgToAdmins(adminMsg);
    });
    scheduleAdminMsg.start();
}
startSendAdminMsgBySchedule();

function getDiscUsageInfo(sysadminsMsgConfig) {
    console.log("getDiscUsageInfo");
    var system = sysadminsMsgConfig.system ? sysadminsMsgConfig.system.trim() : "";
    var backup = sysadminsMsgConfig.backup ? sysadminsMsgConfig.backup.trim() : "";
    var diskSpase = {};
    if (system) {
        try {
            let info = disk.checkSync(system);
            diskSpase.system = {};
            diskSpase.system.total = parseInt (info.total / 1073741824);
            diskSpase.system.free = parseInt(info.free / 1073741824);
            diskSpase.system.freePercent = parseInt(diskSpase.system.free*100/diskSpase.system.total);
            console.log("diskSpase.system=",diskSpase.system)
        }
        catch (err) {
            console.log(err);
            return;
        }
    }
    if (backup) {
        try {
            let info = disk.checkSync(backup);
            diskSpase.backup = {};
            diskSpase.backup.total = parseInt(info.total / 1073741824);
            diskSpase.backup.free = parseInt(info.free / 1073741824);
            diskSpase.backup.freePercent =parseInt( diskSpase.backup.freePercent = diskSpase.backup.free*100/diskSpase.backup.total);
                console.log("diskSpase.backup=",diskSpase.backup);
        }
        catch (err) {
            console.log(err);
            return;
        }
    }
    return diskSpase;
}

function getLastBackupFile(sysadminsMsgConfig){
    var backup = sysadminsMsgConfig.backup ? sysadminsMsgConfig.backup.trim() : "";
    if(!backup) return;
    var backupFileName=sysadminsMsgConfig.dbBackupFileName ? sysadminsMsgConfig.dbBackupFileName.trim():"";
    if(!backupFileName) return;
    var backupFileNameTemplate=new RegExp("^"+backupFileName.substring(0,backupFileName.indexOf("*"))/* +" /\\w{0, }\\"+backupFileName.substring(backupFileName.indexOf("*")+1)+"$"*/);
    try{
       // var files = fs.readdirSync(path.join(__dirname,'./backup'));
        var files = fs.readdirSync(backup);
    }catch(e){
        console.log("error=",e);
    }
    var lastBackpupFile={};
    lastBackpupFile.backupDate=0;
    lastBackpupFile.fileName="";
    for (var i in files){
        var stat = fs.lstatSync(__dirname,'./backup/'+files[i]);
        if(files[i].match(backupFileNameTemplate)){                     console.log("files[i] match=",files[i]);
            if(stat.birthtime>lastBackpupFile.backupDate){
                lastBackpupFile.backupDate=stat.birthtime;
                lastBackpupFile.fileName=files[i];
             }
        }
    }
    console.log("lastBackupDate=",lastBackpupFile.backupDate);
    console.log("lastBackupFileName=",lastBackpupFile.fileName);
    return  lastBackpupFile;
}
//   '/^Б/' +/т$/

function getServerConfig(){
    try {
        var configObj = JSON.parse(fs.readFileSync(path.join(__dirname, './config.json'))); console.log("configObj=",configObj);
    }catch(e){
        console.log("error=",e);
        return;
    }
    return configObj;
}

app.listen(8182);
