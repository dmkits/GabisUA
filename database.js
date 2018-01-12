//var Promise = require('bluebird');
var mssql=require('mssql');
var fs= require('fs');
var path=require('path');
var DbConnectionError=null;
var appConfig=null;

//Promise.config({
//    cancellation: true
//});

module.exports.getDbConnectionError= function(){ console.log(" database getDbConnectionError");
    return DbConnectionError;
};
module.exports.connectToDB=function(callback){                                                      console.log(" database connectToDB");
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
            console.log("connectToDB err database 17=",err);
            DbConnectionError=err;
            return;
        }
        callback();
        DbConnectionError=null;
    });
};
module.exports.setAppConfig=function(configFileName){                                               console.log(" database setAppConfig");
    try{
        appConfig=JSON.parse(fs.readFileSync(path.join(__dirname, configFileName+'.json')))
    }catch(e){
        console.log("appConfig parse ERROR=",e);
    }
};
module.exports.getAppConfig=function(){          console.log(" database getAppConfig");
   return appConfig;
};

module.exports.checkPhoneAndWriteChatID=function(phoneNum, chatId, callback){ console.log(" database checkPhoneAndWriteChatID");
    var request = new mssql.Request();
    request.input('Mobile', phoneNum);
    request.query('select EmpID from r_Emps WHERE Mobile=@Mobile',
        function(err,res){
            if(err){
                callback(err);
                return;
            }
            if(!res.recordset[0] || !res.recordset[0].EmpID){
                callback({clientMsg:"Не удалось зарегистрировать служащего для служебной рассылки. Номер телефона пользователя Telegram не найден в справочнике служащих."});
                return;
            }
            var empID=res.recordset[0].EmpID;
            request.input('TChatID', chatId);
            request.input('EmpID', empID);
            request.query('update r_Emps set TChatID=@TChatID where EmpID=@EmpID ',
            function(err, res){
                if(err){
                    callback(err);
                    return;
                }
                request.query('select ShiftPostID from r_Emps where EmpID=@EmpID',
                    function(err,res){
                        if(err){
                            callback(err);
                            return;
                        }
                        if(!res.recordset[0] || res.recordset[0].ShiftPostID===undefined){
                            callback({clientMsg:"Регистрация не завершена. \n Причина: не удалось определить статус пользователя."});
                            return;
                        }
                        var status = res.recordset[0].ShiftPostID==0?"кассир":"администратор";
                         callback(null,status);
                    });
            });
    })
};

module.exports.getAdminChatIds=function(callback){ console.log(" database getAdminChatIds");
    var request = new mssql.Request();
    request.query("select TChatID from r_Emps where ShiftPostID=1 and LTRIM(ISNULL(Mobile,''))<>'' and LTRIM(ISNULL(TChatID,''))<>''",
        function(err,res){ console.log("res getAdminChatIds=",res);
            if(err){
                callback(err);
                return;
            }
            if(!res.recordset[0] || res.recordset[0].TChatID===undefined){
                //callback({clientMsg:"Регистрация не завершена. \n Причина: не удалось определить статус пользователя."});
                callback({err:"Не удалось найти ни одного номера телефона в справочнике администраторов."});
                return;
            }
            callback(null,res.recordset);
        });
};

module.exports.getTRecData=function(callback){  console.log(" database getTRecData");
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

module.exports.getTExcData=function(callback){   console.log(" database getTExcData");
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
