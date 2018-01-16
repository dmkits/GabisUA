var database = require('./database');
var diskusage = require('diskusage-ng');
var fs = require('fs');
var path = require('path');
var moment = require('moment');

module.exports.makeDiskUsageMsg=function(sysadminsMsgConfig, callback){
    var adminMsg='<b>Информация системному администратору на '+moment(new Date()).format('HH:mm DD.MM.YYYY')+' </b> \n';
    if(!sysadminsMsgConfig){
        var serverConfig=database.getAppConfig();
        var sysadminsMsgConfig = serverConfig.sysadminsMsgConfig;
        if(!sysadminsMsgConfig){
            callback ("FAIL! Reason: 'sysadminsMsgConfig' wasn't found in config params.");
            return;
        }
    }
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
            callback(null,adminMsg);
        })
    });
};

module.exports.makeUnconfirmedDocsMsg =function(callback){
    var adminMsg='<b>Информация администратору на '+moment(new Date()).format('HH:mm DD.MM.YYYY')+' </b> \n';
    database.getTRecData(function(err, res){
        if(err){
            callback(err);
            return;
        }
        var tRecArr=res;
        if(tRecArr.length==0) {
            adminMsg+="\n<b>Все приходные накладные подтверждены.</b>";
            callback(null,adminMsg);
        }else{
            adminMsg+="<b>Неподтвержденные приходные накладные:</b> ";
            for (var i in tRecArr){
                var dataItem=tRecArr[i];
                adminMsg+="\n &#12539 "+dataItem.StockName+": "+dataItem.Total;
            }
        }
        database.getTExcData(function(err, res){
            if(err){
                callback(err);
                return;
            }
            var tExpArr=res;
            if(tExpArr.length==0) {
                adminMsg+="\n<b>Все  накладные перемещения подтверждены.</b>";
                callback(null,adminMsg);
                return;
            }
            adminMsg+="\n<b>Неподтвержденные накладные перемещения:</b>";
            for (var k in tExpArr){
                var dataItem=tExpArr[k];
                adminMsg+="\n &#12539 "+dataItem.StockName+": "+dataItem.Total;
            }
            callback(null,adminMsg);
        })
    });
};

function getDiscUsageInfo(sysadminsMsgConfig, callback) {
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

function getLastBackupFile(sysadminsMsgConfig, callback){
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