var logger=require('./logger')();
var cron = require('node-cron');
var database = require('./database');
var bot=require('./telBot');
var moment = require('moment');


function startSendingCashierMsgBySchedule(appConfig){                                                                logger.info("startSendingCashierMsgBySchedule");
    var cashierSchedule=appConfig.cashierSchedule;
    if(!cashierSchedule||cron.validate(cashierSchedule)==false) return;
    var scheduleCashierMsg =cron.schedule(cashierSchedule,
        function(){
            sendCashierMsgBySchedule();
        });
    scheduleCashierMsg.start();
}
module.exports.startSendingCashierMsgBySchedule=startSendingCashierMsgBySchedule;

function sendCashierMsgBySchedule(){
    database.getCashierDataArr(null,function(err, res){
        if(err){
            logger.error("Failed to get cashier array. Reason: "+err);
            if(err.name=="ConnectionError")   {
                database.connectToDBRecursively(0,"при попытке рассылки сообщений для кассиров",function(err){
                    if(!err){
                        sendCashierMsgBySchedule();
                    }
                });
            }
            return;
        }
        if(!res.recordset || res.recordset.length==0){
            logger.warn("No registered cashiers was found in DB.");
            return;
        }
        var cashierDataArr=res.recordset;
        sendCashierMsgRecursively(0,cashierDataArr, true);
    });
}

module.exports.makeCashierMsg=function(cashierData, callback){
    var stockID=cashierData["StockID"];
    var StockName=cashierData["StockName"];
    var CRName=cashierData["CRName"];
    var cashierMsg="";
    database.getTRecByStockId(stockID, function(err, res){
        if(err){
            callback(err);
            return;
        }
        if(res.recordset && res.recordset.length>0){
            cashierMsg='<b>Информация кассиру на '+moment(new Date()).format('HH:mm DD.MM.YYYY')+' </b> ';
            cashierMsg+="\n<b>Касса:</b> "+ CRName +"\n<b>Склад:</b> "+StockName;
            cashierMsg+="\n<b>Неподтвержденные приходные накладные:</b> ";
            var unconfirmedRecArr=res.recordset;
            for(var j in unconfirmedRecArr){
                cashierMsg += "\n &#12539 № "+unconfirmedRecArr[j]["DocID"] +" от "+moment(unconfirmedRecArr[j]["DocDate"]).format("DD.MM.YYYY");
            }
            database.getTExcByStockId(stockID,function(err, res){
                if(err){
                    callback(err);
                    return;
                }
                if(res.recordset && res.recordset.length>0) {
                    cashierMsg += "\n<b>Неподтвержденные накладные перемещения:</b> ";
                    var unconfirmedExcArr = res.recordset;
                    for (var j in unconfirmedExcArr) {
                        cashierMsg += "\n &#12539 № " + unconfirmedExcArr[j]["DocID"] + " от " + moment(unconfirmedExcArr[j]["DocDate"]).format("DD.MM.YYYY");
                    }
                    database.getTSestByStockId(stockID,function(err,res){
                        if(err){
                            callback(err);
                            return;
                        }
                        if(res.recordset && res.recordset.length>0){
                            cashierMsg += "\n<b>Переоценка цен продажи:</b> ";
                            var priceChangedDocsArr=res.recordset;
                            for (var e in priceChangedDocsArr) {
                                cashierMsg += "\n &#12539 № " + priceChangedDocsArr[e]["DocID"] + " от " + moment(priceChangedDocsArr[e]["DocDate"]).format("DD.MM.YYYY");
                                var chId=priceChangedDocsArr[e]["ChID"];
                                sestSendChIDObj[chId]=true;
                            }
                        }
                        callback(null,cashierMsg);
                    });
                    return;
                }
                database.getTSestByStockId(stockID,function(err,res){
                    if(err){
                        callback(err);
                        return;
                    }
                    if(res.recordset && res.recordset.length>0){
                        cashierMsg += "\n<b>Переоценка цен продажи:</b> ";
                        var priceChangedDocsArr=res.recordset;
                        for (var e in priceChangedDocsArr) {
                            cashierMsg += "\n &#12539 № " + priceChangedDocsArr[e]["DocID"] + " от " + moment(priceChangedDocsArr[e]["DocDate"]).format("DD.MM.YYYY");
                            var chId=priceChangedDocsArr[e]["ChID"];
                            sestSendChIDObj[chId]=true;
                        }
                    }
                    callback(null,cashierMsg);
                });
            })
        }else{
            database.getTExcByStockId(stockID,function(err, res){
                if(err){
                    callback(err);
                    return;
                }
                if(res.recordset && res.recordset.length>0) {
                    cashierMsg='<b>Информация кассиру на '+moment(new Date()).format('HH:mm DD.MM.YYYY')+' </b> ';
                    cashierMsg+="\n<b>Касса:</b> "+ CRName +"\n<b>Склад:</b> "+StockName;
                    cashierMsg+= "\n<b>Неподтвержденные накладные перемещения:</b> ";
                    var unconfirmedExcArr = res.recordset;
                    for (var j in unconfirmedExcArr) {
                        cashierMsg += "\n &#12539 № " + unconfirmedExcArr[j]["DocID"] + " от " + moment(unconfirmedExcArr[j]["DocDate"]).format("DD.MM.YYYY");
                    }
                    database.getTSestByStockId(stockID,function(err,res){
                        if(err){
                            callback(err);
                            return;
                        }
                        if(res.recordset && res.recordset.length>0){
                            cashierMsg += "\n<b>Переоценка цен продажи:</b> ";
                            var priceChangedDocsArr=res.recordset;
                            for (var e in priceChangedDocsArr) {
                                cashierMsg += "\n &#12539 № " + priceChangedDocsArr[e]["DocID"] + " от " + moment(priceChangedDocsArr[e]["DocDate"]).format("DD.MM.YYYY");
                                var chId=priceChangedDocsArr[e]["ChID"];
                                sestSendChIDObj[chId]=true;
                            }
                        }
                        callback(null,cashierMsg);
                    });
                    return;
                }
                database.getTSestByStockId(stockID,function(err,res){
                    if(err){
                        callback(err);
                        return;
                    }
                    if(res.recordset && res.recordset.length>0){
                        cashierMsg='<b>Информация кассиру на '+moment(new Date()).format('HH:mm DD.MM.YYYY')+' </b> ';
                        cashierMsg+="\n<b>Касса:</b> "+ CRName +"\n<b>Склад:</b> "+StockName;
                        cashierMsg += "\n<b>Переоценка цен продажи:</b> ";
                        var priceChangedDocsArr=res.recordset;
                        for (var e in priceChangedDocsArr) {
                            cashierMsg += "\n &#12539 № " + priceChangedDocsArr[e]["DocID"] + " от " + moment(priceChangedDocsArr[e]["DocDate"]).format("DD.MM.YYYY");
                            var chId=priceChangedDocsArr[e]["ChID"];
                            sestSendChIDObj[chId]=true;
                        }
                    }
                    callback(null,cashierMsg);
                });
            });
        }
    });
};

var sestSendChIDObj={};

function sendCashierMsgRecursively(index, cashierDataArr, scheduleCall, callback){
    if(!cashierDataArr[index]){
        if(callback)callback();
        if(scheduleCall && Object.keys(sestSendChIDObj).length>0){

            var chIDArr=[];
            for(var i in sestSendChIDObj)chIDArr.push(i);
            insertSEstMsgCountRecursively(0,chIDArr,function(){
                sestSendChIDObj={};
            });
        }
        return;
    }
    var cashierData=cashierDataArr[index];
    var TChatID=cashierDataArr[index]["TChatID"];
    module.exports.makeCashierMsg(cashierData, function(err, resMsg){
        if(err){
            logger.error("FAILED to create msg for cashier. Reason: "+err);
            return;
        }

        if(resMsg) bot.sendMessage(TChatID, resMsg, {parse_mode:"HTML"});
        sendCashierMsgRecursively(index+1,cashierDataArr,scheduleCall,callback);
    });
};

module.exports.sendCashierMsgRecursively=sendCashierMsgRecursively;

function insertSEstMsgCountRecursively(index,chIDArr,callback){
    if(!chIDArr[index]){
        callback();
        return;
    }
    database.setSEstMsgCount(chIDArr[index], function(){
        insertSEstMsgCountRecursively (index+1,chIDArr,callback);
    });
}