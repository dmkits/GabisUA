var express = require('express');
var fs = require('fs');
var path = require('path');
var app = express();
var diskusage = require('diskusage-ng');
var database = require('./database');
var cron = require('node-cron');
var bot=require('./telBot.js');
var moment = require('moment');



database.connectToDB(function(err){
    if(err){
        bot.sendMsgToAdmins("Невозможно подключиться к БД! Причина:"+err);
    }
//    database.checkPhoneAndWriteChatID("380637868771","123456",function(err,res){
//        console.log("err index=",err);
//        console.log("res index=",res);
//
//    });
});




var scheduleSysAdminMsg;
function startSendSysAdminMsgBySchedule(){                                                         console.log("startSendSysAdminMsgBySchedule");
    var serverConfig=getServerConfig();
    var schedule=serverConfig.sysadminSchedule;
    if(!schedule) schedule='*/15 * * * * *';
    var valid = cron.validate(schedule);
    if(valid==false){                                                                           console.log("invalide cron format");
        return;
    }
    var sysadminsMsgConfig = serverConfig.sysadminsMsgConfig;
    if(!sysadminsMsgConfig) return;
    if(scheduleSysAdminMsg)scheduleSysAdminMsg.destroy();
    scheduleSysAdminMsg =cron.schedule(schedule, function(){
        var adminMsg='';
        getDiscUsageInfo(sysadminsMsgConfig, function(err, diskSpase){
            if(err){
                adminMsg +='\n '+err;
            }
            if(diskSpase && diskSpase.system){
                adminMsg += "Ресурс: \n System: объем:"+diskSpase.system.total+"Гб, свободно:"+diskSpase.system.free+ "Гб ("+diskSpase.system.freePercent +"%).";
            }
            if(diskSpase && diskSpase.backup){
                adminMsg += "\n Ресурс: \n Backup: объем:"+diskSpase.backup.total+"Гб, свободно:"+diskSpase.backup.free+ "Гб ("+diskSpase.backup.freePercent +"%).";
            }
            getLastBackupFile(sysadminsMsgConfig, function(err,lastBackpupFile){
                if(err){
                    adminMsg +='\n '+err;
                }
                if(lastBackpupFile && lastBackpupFile.backupDate && lastBackpupFile.fileName){
                    adminMsg+="\n Последняя резервная копия БД "+ lastBackpupFile.fileName+" от " + moment(lastBackpupFile.backupDate).format("DD-MM-YYYY HH:mm:ss");
                }
                if(adminMsg)   bot.sendMsgToAdmins(adminMsg);
            })
        });
    });
    scheduleSysAdminMsg.start();
}
var scheduleAdminMsg;
function startSendAdminMsgBySchedule(){                                                         console.log("startSendAdminMsgBySchedule");
    var serverConfig=getServerConfig();
    var schedule=serverConfig.adminSchedule;
    if(!schedule) schedule='*/15 * * * * *';
    var valid = cron.validate(schedule);
    if(valid==false){                                                                           console.log("invalide cron format");
        return;
    }
    if(scheduleAdminMsg)scheduleAdminMsg.destroy();
     scheduleAdminMsg =cron.schedule(schedule, function(){
        var adminMsg='';
         database.getAdminChatIds(function(err, res){
             if(err){
                 console.log("err=",err);
                 return;
             }
             var adminChatArr=res;
             database.getTRecData(function(err, res){                        //не подтвержденных приходных накладных   //StockName  Total
                 if(err){
                     console.log("err=",err);
                     return;
                 }
                 var tRecArr=res;
                 adminMsg+="\n Неподтвержденные приходные накладные:";
                 for (var i in tRecArr){
                     var dataItem=tRecArr[i];
                     adminMsg+="\n"+dataItem.StockName+" - "+dataItem.Total;
                 }
                 database.getTExcData(function(err, res){                   //не подтвержденных получателем накладных перемещения  //StockName  Total
                     if(err){
                         console.log("err=",err);
                         return;
                     }
                     adminMsg+="\n Неподтвержденные накладные перемещения:";
                     var tExpArr=res;
                     for (var k in tExpArr){
                         var dataItem=tExpArr[k];
                         adminMsg+="\n"+dataItem.StockName+" - "+dataItem.Total;
                     }
                    // adminMsg +=
                     bot.sendMsgToChatId(adminChatArr[0].TChatID,adminMsg);
                 })
             })
         });

    //    getDiscUsageInfo(sysadminsMsgConfig, function(err, diskSpase){
    //        if(err){
    //            adminMsg +='\n '+err;
    //        }
    //        if(diskSpase && diskSpase.system){
    //            adminMsg += "Ресурс: \n System: объем:"+diskSpase.system.total+"Гб, свободно:"+diskSpase.system.free+ "Гб ("+diskSpase.system.freePercent +"%).";
    //        }
    //        if(diskSpase && diskSpase.backup){
    //            adminMsg += "\n Ресурс: \n Backup: объем:"+diskSpase.backup.total+"Гб, свободно:"+diskSpase.backup.free+ "Гб ("+diskSpase.backup.freePercent +"%).";
    //        }
    //        getLastBackupFile(sysadminsMsgConfig, function(err,lastBackpupFile){
    //            if(err){
    //                adminMsg +='\n '+err;
    //            }
    //            if(lastBackpupFile && lastBackpupFile.backupDate && lastBackpupFile.fileName){
    //                adminMsg+="\n Последняя резервная копия БД "+ lastBackpupFile.fileName+" от " + moment(lastBackpupFile.backupDate).format("DD-MM-YYYY HH:mm:ss");
    //            }
    //            if(adminMsg)   bot.sendMsgToAdmins(adminMsg);
    //        })
    //    });
    });
    scheduleAdminMsg.start();
}
startSendAdminMsgBySchedule();

//startSendSysAdminMsgBySchedule();

function getDiscUsageInfo(sysadminsMsgConfig, callback) {                                                            console.log("getDiscUsageInfo");
    var system = sysadminsMsgConfig.system ? sysadminsMsgConfig.system.trim() : "";
    var backup = sysadminsMsgConfig.backup ? sysadminsMsgConfig.backup.trim() : "";
    var diskSpase = {};
    if(system){
        diskusage(system,function(err, info){
                if(err){
                    callback(err);
                    return;
                }
                diskSpase.system = {};
                diskSpase.system.total = parseInt(info.total/1073741824 );//parseInt (info.size / 1073741824);
                diskSpase.system.free = parseInt(info.available/1073741824 );// parseInt(info.available / 1073741824);
                diskSpase.system.freePercent = parseInt(diskSpase.system.free*100/diskSpase.system.total);
                if(backup){
                    diskusage(backup,function(err,info ){
                        if(err){
                            callback(err);
                            return;
                        }
                        diskSpase.backup = {};
                        diskSpase.backup.total = parseInt(info.total/1073741824); // parseInt (info.size / 1073741824);
                        diskSpase.backup.free = parseInt(info.available/1073741824); //parseInt(info.available / 1073741824);
                        diskSpase.backup.freePercent = parseInt(diskSpase.backup.free*100/diskSpase.backup.total);
                        callback(null,diskSpase);
                    });
                    return;
                }
                callback(null,diskSpase);
            });
        return;
    }
    if(backup){
        diskusage(backup,function(err,info){
            if(err){
                callback(err);
                return;
            }
            diskSpase.backup = {};
            diskSpase.backup.total = parseInt(info.total/1073741824);
            diskSpase.backup.free = parseInt(info.available/1073741824);
            diskSpase.backup.freePercent = parseInt(diskSpase.backup.free*100/diskSpase.backup.total);
            callback(null,diskSpase);
        });
    }
}

function getLastBackupFile(sysadminsMsgConfig, callback){                                                            console.log("getLastBackupFile");
    var backup = sysadminsMsgConfig.backup ? sysadminsMsgConfig.backup.trim() : "";
    if(!backup){
        callback("Не удалось найти путь к папке резервных коний БД.");
        return;
    }
    var backupFileName=sysadminsMsgConfig.dbBackupFileName ? sysadminsMsgConfig.dbBackupFileName.trim():"";
    if(!backupFileName){
        callback("Не удалось найти шаблон имени файла резервных коний БД.");
        return;
    }
    var backupFileNameTemplate=new RegExp("^"+backupFileName.substring(0,backupFileName.indexOf("*"))+".*\\"+backupFileName.substring(backupFileName.indexOf("*")+1)+"$");
    try{
        var files = fs.readdirSync(backup);
    }catch(e){
        callback(e);
        return;
    }
    var lastBackpupFile={};
    lastBackpupFile.backupDate=0;
    lastBackpupFile.fileName="";
    for (var i in files){
        var stat = fs.statSync(path.join(backup+files[i]));
        if(files[i].match(backupFileNameTemplate)){
            if(stat.mtime>lastBackpupFile.backupDate){
                lastBackpupFile.backupDate=stat.mtime;
                lastBackpupFile.fileName=files[i];
             }
        }
    }
    callback(null, lastBackpupFile);
}

function getServerConfig(){                                                                                             console.log("dgetServerConfig");
    try {
        var configObj = JSON.parse(fs.readFileSync(path.join(__dirname, './config.json')));
    }catch(e){
        console.log("error=",e);
        return;
    }
    return configObj;
}
app.listen(8182);
