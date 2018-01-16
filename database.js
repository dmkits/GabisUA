var Promise = require('bluebird');
var mssql=require('mssql');
var fs= require('fs');
var path=require('path');
var DbConnectionError=null;
var configName=null;
var logger=require('./logger')();

Promise.config({
    cancellation: true
});

module.exports.getDbConnectionError= function(){
    return DbConnectionError;
};

module.exports.connectToDB=function(callback){
    var appConfig=this.getAppConfig();
    mssql.close();
    mssql.connect({
        "user": appConfig.user,
        "password": appConfig.password,
        "server": appConfig.host,
        "database": appConfig.database
    }, err =>{
        if(err){
            callback(err);
            DbConnectionError=err;
            logger.error("FAILED to connect to DB. Reason: "+err);
            return;
        }
        callback();
        DbConnectionError=null;
    });
};

module.exports.setAppConfig=function(configFileName){
    configName = configFileName;
};

module.exports.getAppConfig=function(){
   var appConfig;
    try{
        appConfig=JSON.parse(fs.readFileSync(path.join(__dirname, configName+'.json')))
    }catch(e){
        logger.error("FAILED to get data from config file. Reason: "+ e);
    }
   return appConfig;
};

module.exports.checkPhoneAndWriteChatID=function(phoneNum, chatId, callback){
    var request = new mssql.Request();
    request.input('Mobile', phoneNum);
    request.query('select EmpID, ShiftPostID from r_Emps WHERE Mobile=@Mobile',
        function(err,res){
            if(err){
                callback(err);
                return;
            }
            if(!res.recordset || res.recordset.length==0){
                callback({clientMsg:"Не удалось зарегистрировать служащего для служебной рассылки. Номер телефона пользователя Telegram не найден в справочнике служащих."});
                return;
            }
            if(res.recordset[0].ShiftPostID==undefined ){
                callback({clientMsg:"Регистрация не завершена. \n Причина: не удалось определить статус пользователя."});
                return;
            }
            var shiftPostID=res.recordset[0].ShiftPostID;
            var empID=res.recordset[0].EmpID;
            request.input('TChatID', chatId);
            request.input('EmpID', empID);
            request.query('update r_Emps set TChatID=@TChatID where EmpID=@EmpID ',
            function(err, res){
                if(err){
                    callback(err);
                    return;
                }
                var status = shiftPostID==0?"кассир":"администратор";
                callback(null,status);
            });
    })
};

module.exports.getAdminChatIds=function(callback){
    var request = new mssql.Request();
    request.query("select TChatID from r_Emps where ShiftPostID=1 and LTRIM(ISNULL(Mobile,''))<>'' and LTRIM(ISNULL(TChatID,''))<>''",
        function(err,res){
            if(err){
                callback(err);
                return;
            }
            if(!res.recordset || res.recordset.length==0){
                callback({err:"Не удалось найти ни одного номера телефона в справочнике администраторов."});
                return;
            }
            callback(null,res.recordset);
        });
};

module.exports.getTRecData=function(callback){
    var request = new mssql.Request();
    request.query("select m.StockID, st.StockName, Count(1) as Total " +
        "from t_Rec m " +
        "inner join r_Stocks st on st.StockID=m.StockID" +
        " where m.StateCode=50" +
        " group by m.StockID, st.StockName " +
        "order by m.StockID",
        function(err,res){
            if(err){
                callback(err);
                return;
            }
            callback(null,res.recordset);
        });
};

module.exports.getTExcData=function(callback){
    var request = new mssql.Request();
    request.query("select m.NewStockID, st.StockName, Count(1) as Total " +
        "from t_Exc m " +
        "inner join r_Stocks st on st.StockID=m.NewStockID " +
        "where m.StateCode=56 " +
        "group by m.NewStockID, st.StockName " +
        "order by m.NewStockID",
        function(err,res){
            if(err){
                callback(err);
                return;
            }
            callback(null,res.recordset);
        });
};
