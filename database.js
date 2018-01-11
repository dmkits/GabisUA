var Promise = require('bluebird');
var mssql=require('mssql');
var fs= require('fs');
var path=require('path');
var DbConnectionError=null;

Promise.config({
    cancellation: true
});


module.exports.getDbConnectionError= function(){
    return DbConnectionError;
};

module.exports.connectToDB=function(callback){
    var dbConfig=this.getDBConfig();
    mssql.close();
    mssql.connect({
        "user": dbConfig.user,
        "password": dbConfig.password,
        "server": dbConfig.host,
        "database": dbConfig.db_name
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

module.exports.getDBConfig=function(){
    var dbConfig;
    try{
    dbConfig=JSON.parse(fs.readFileSync(path.join(__dirname,'./config.json')))
    }catch(e){
         console.log("dbConfig parse ERROR=",e);
    }
   return dbConfig;
};

module.exports.checkPhoneAndWriteChatID=function(phoneNum, chatId, callback){
    var request = new mssql.Request();
    request.input('Mobile', phoneNum);
    request.query('select EmpID from r_Emps WHERE Mobile=@Mobile',
        function(err,res){                                  console.log("res 51=",res);
            if(err){                                       console.log("err 51=",err);
                callback(err);
                return;
            }
            if(!res.recordset[0] || !res.recordset[0].EmpID){
                callback({clientMsg:"Не удалось зарегистрировать. Данный номер телефона не найден в базе."});
                return;
            }
            var empID=res.recordset[0].EmpID;                    console.log("empID=",empID);
            request.input('TChatID', chatId);
            request.input('EmpID', empID);
            request.query('update r_Emps set TChatID=@TChatID where EmpID=@EmpID ',               //select ShiftPostID where EmpID=@EmpID
            function(err, res){                           console.log("res 60=",res);
                if(err){                                  console.log("err 60=",err);
                    callback(err);
                    return;
                }
                request.query('select ShiftPostID from r_Emps where EmpID=@EmpID',
                    function(err,res){                                                        console.log("res 66=",res);
                        if(err){                                                               console.log("err 66=",err);
                            callback(err);
                            return;
                        }
                        if(!res.recordset[0] || res.recordset[0].ShiftPostID===undefined){
                            callback({clientMsg:"Регистрация не завершена. \n Причина: не удалось определить статус пользователя."});
                            return;
                        }
                        var status = res.recordset[0].ShiftPostID==0?"кассира":"администратора";     console.log("status=",status);
                         callback(null,status);
                    });
            });
    })
};

module.exports.getAdminChatIds=function(callback){
    var request = new mssql.Request();
    request.query("select TChatID from r_Emps where ShiftPostID=1 and LTRIM(ISNULL(Mobile,''))<>'' and LTRIM(ISNULL(TChatID,''))<>''",
        function(err,res){                                                          console.log("res 88=",res);
            if(err){                                                               console.log("err 88=",err);
                callback(err);
                return;
            }
            if(!res.recordset[0] || res.recordset[0].TChatID===undefined){
                //callback({clientMsg:"Регистрация не завершена. \n Причина: не удалось определить статус пользователя."});
                callback({err:"Не удалось найти ни одного номера телефона администратора в БД"});
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
        function(err,res){                                                                                      console.log("res 111=",res);
            if(err){                                                                                            console.log("err 112=",err);
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
        function(err,res){                                                                                      console.log("res 127=",res);
            if(err){                                                                                            console.log("err 112=",err);
                callback(err);
                return;
            }
            callback(null,res.recordset);
        });
};
