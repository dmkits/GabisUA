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