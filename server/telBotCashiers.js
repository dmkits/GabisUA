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

function getUnconfirmedTRecMsgByStockId(cashierData, callback){
    var stockID=cashierData["StockID"];
    var msg="";
    database.getUnconfirmedTRecByStockId(stockID, function(err, res) {
        if (err) {
            callback(err);
            return;
        }
        if (res.recordset && res.recordset.length > 0) {
            msg += "\n<b>Неподтвержденные приходные накладные:</b> ";
            var unconfirmedRecArr = res.recordset;
            for (var j in unconfirmedRecArr) {
                msg += "\n &#12539 № " + unconfirmedRecArr[j]["DocID"] + " от " + moment(unconfirmedRecArr[j]["DocDate"]).format("DD.MM.YYYY");
            }
        }
        callback(null,msg);
    });
}

function getUnconfirmedTExcMsgByStockId(stockID, callback){
    var msg="";
    database.getUnconfirmedTExcByStockId(stockID,function(err, res) {
        if (err) {
            callback(err);
            return;
        }
        if (res.recordset && res.recordset.length > 0) {
            msg += "\n<b>Неподтвержденные накладные перемещения:</b> ";
            var unconfirmedExcArr = res.recordset;
            for (var j in unconfirmedExcArr) {
                msg += "\n &#12539 № " + unconfirmedExcArr[j]["DocID"] + " от " + moment(unconfirmedExcArr[j]["DocDate"]).format("DD.MM.YYYY");
            }
        }
        callback(null,msg);
    });
}
function getReturnedTExcMsgByStockId(stockID, callback){
    var msg="";
    database.getReturnedTExcByStockId(stockID, function(err,res) {
        if (err) {
            callback(err);
            return;
        }
        if (res.recordset && res.recordset.length > 0) {
            msg += "\n<b>Возвращенные накладные перемещения:</b> ";
            var returnedExcArr = res.recordset;
            for (var j in returnedExcArr) {
                msg += "\n &#12539 № " + returnedExcArr[j]["DocID"] + " от " + moment(returnedExcArr[j]["DocDate"]).format("DD.MM.YYYY");
            }
        }
        callback(null,msg);
    });
}
function getTSestMsgByStockId(stockID, callback){
    var msg="";
    database.getTSestByStockId(stockID,function(err,res) {
        if (err) {
            callback(err);
            return;
        }
        if (res.recordset && res.recordset.length > 0) {
            msg += "\n<b>Переоценка цен продажи:</b>";
            var priceChangedDocsArr = res.recordset;
            for (var e in priceChangedDocsArr) {
                msg += "\n &#12539 № " + priceChangedDocsArr[e]["DocID"] + " от " + moment(priceChangedDocsArr[e]["DocDate"]).format("DD.MM.YYYY");
                var chId = priceChangedDocsArr[e]["ChID"];
                sestSendChIDObj[chId] = true;
            }
        }
        callback(null,msg);
    });
}

module.exports.makeCashierMsg=function(cashierData, callback){
    var stockID=cashierData["StockID"];
    var StockName=cashierData["StockName"];
    var CRName=cashierData["CRName"];
    var msgHeader= "";
    var cashierMsg="";
        msgHeader = '<b>Информация кассиру на ' + moment(new Date()).format('HH:mm DD.MM.YYYY') + ' </b> ';
        msgHeader += "\n<b>Касса:</b> " + CRName + "\n<b>Склад:</b> " + StockName;
    getUnconfirmedTRecMsgByStockId(cashierData, function(err,msg){
        if(err){
            callback(err);
            return;
        }
        cashierMsg=cashierMsg+msg;
        getUnconfirmedTExcMsgByStockId(stockID, function(err,msg){
            if(err){
                callback(err);
                return;
            }
            cashierMsg=cashierMsg+msg;
            getReturnedTExcMsgByStockId(stockID, function(err,msg){
                if(err){
                    callback(err);
                    return;
                }
                cashierMsg=cashierMsg+msg;
                getTSestMsgByStockId(stockID, function(err,msg){
                    if(err){
                        callback(err);
                        return;
                    }
                    cashierMsg=cashierMsg+msg;
                    if(cashierMsg)cashierMsg=msgHeader+cashierMsg;
                    callback(null,cashierMsg);
                })
            })
        })
    })
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
        if(resMsg)
            setTimeout(function () {
                bot.sendMessage(TChatID, resMsg, {parse_mode:"HTML"});
                sendCashierMsgRecursively(index+1,cashierDataArr,scheduleCall,callback);
            },300);
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