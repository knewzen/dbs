/**
 * author: zsz
 * email: zhengsz@pku.edu.cn 
 * last_modify: 2017-12-19
 * description: main router
 */
var express = require('express');
var router = express.Router();
let mysql = require('mysql');
let queues = require('mysql-queues');
let async = require('async');
let xml2js = require('xml2js');
let userConfig = require('../configure/mysql_user_config');
let adminConfig = require('../configure/mysql_admin_config');

/**
 * prepare two pools to get connections
 */
let userPool = mysql.createPool({
  user: userConfig.user,
  password: userConfig.password,
  host: userConfig.host,
  port: userConfig.port,
  database: userConfig.database
});

let adminPool = mysql.createPool({
  user: adminConfig.user,
  password: adminConfig.password,
  host: adminConfig.host,
  port: adminConfig.port,
  database: adminConfig.database
});

/**
 * JsonBuilder可以用來解析Json為xml字符串
 */
let JsonBuilder = new xml2js.Builder({
  rootName: 'Xml',
  xmldec:{
    version:"1.0",
    "encoding":"utf-8",
    "standalone":false
  }
});

/**
 * 如果有直接訪問到/users的，引導到登陸界面
 */
router.all('/', function(req, res) {
  res.redirect('../');
});

/**
 * 渲染用戶界面
 */
router.post('/user', function(req, res){
  res.render('userPage', {id:req.body.id});
});

/**
 * 渲染管理員界面
 */
router.post('/admin', function(req, res){
  res.render('adminPage', {id:req.body.id, username:req.body.username});
});

/**
 * 租車界面
 */
router.post('/user/rent', function(req, res){
  //傳入的衹有用戶id
  let id = req.body.id;
  //建立連接
  userPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      //先查詢是否正在用車，如果是，則直接進入用車界面
      let sql_using = `select using_bike from user where id = ${id};`;
      conn.query(sql_using, function(err, rows){
        if(err){  console.log(err);}
        else if(rows.length < 1)
        {
          res.render('error', {message:"没有对应id的用户", id:id});
        }
        else if(rows.length > 1)
        {
          res.render('error', {message:"id出现重合错误", id:id});
        }
        else
        {
          let using_bike = rows[0].using_bike;
          if(using_bike == 1)
          {
            res.render('usingPageMedia', {id:id});
          }
          else
          {
            res.render('rentPage', {id:id, message:'租用车辆'});
          }
        }
      });
      conn.release();
    }
  });
});

/**
 * 租車成功界面
 */
router.post('/user/rent/pass', function(req, res){
  //獲取用戶id，單車id，此時的經緯度信息和街道行政區信息
  let userid = req.body.userid;
  let bikeid = req.body.bikeid;
  let beglatitude = req.body.beglatitude;
  let beglongitude = req.body.beglongitude;
  let begdistrict = req.body.begdistrict;
  let begstreet = req.body.begstreet;
  //建立連接
  userPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      //采用事務處理方式
      queues(conn);
      let trans = conn.startTransaction();
      //建立任務
      let task1 = function(callback)
      {
        let now = new Date();
        now = now.getTime();
        //創建臨時訂單
        let sql = `insert into tmp_order(user_id, bike_id, longitude, latitude, district, street, time) 
          values(${userid}, ${bikeid}, ${beglongitude}, ${beglatitude}, '${begdistrict}', '${begstreet}', ${now});`;
        trans.query(sql, function(err){
          if(err)
          {
            console.log('创建新订单错误');
            console.log(err);
            callback(err);
          }
          else
          {
            console.log('创建新订单成功');
            callback(null);
          }
        });
      };
      let task2 = function(callback)
      {
        //更新用戶地理信息
        let sql = `update user set using_bike=1, latitude=${beglatitude},longitude=${beglongitude},
          district='${begdistrict}',street='${begstreet}' where id=${userid};`;
        trans.query(sql, function(err){
          if(err)
          {
            console.log('更新user错误');
            console.log(err);
            callback(err);
          }
          else
          {
            console.log('更新user成功');
            callback(null);
          }
        });
      };
      let task3 = function(callback)
      {
        //更新單車狀態
        let sql = `update bike set status=1 where id=${bikeid};`;
        trans.query(sql, function(err){
          if(err)
          {
            console.log('更新单车错误');
            console.log(err);
            callback(err);
          }
          else
          {
            console.log('更新单车成功');
            callback(null);
          }
        });
      };
      //序列化執行
      async.series([task1, task2, task3], function(err){
        if(err)
        {
          console.log('事务回滚');
          trans.rollback(function(){
            conn.release();
          });
        }
        else
        {
          console.log('事务提交开始');
          trans.commit(function(err){
            if(err)
            {
              console.log('事务提交失败');
              console.log(err);
              conn.release();
            }
            else
            {
              console.log('事务提交成功');
              conn.release();
            }
          });
        }
      });
      //檢查單車狀態
      let sql = `select status from bike where id=${bikeid};`;
      conn.query(sql, function(err, rows){
        if(err)
        {
          console.log(err);
        }
        else
        {
          if(rows[0].status==1)
          {
            res.render('rentPage',{id:userid, message:'这辆车已经被使用了，请重新选择'});
          }
          else if(rows[0].status==2)
          {
            res.render('rentPage',{id:userid,message:'这辆车被报修了,请重新选择'});
          }
          else
          {
            //事務正式開始執行
            console.log('事务开始执行');
            trans.execute();
            res.render('usingPageMedia', {id:userid});
          }
        }
      });      
    }
  });
});

/**
 * 用車界面
 */
router.post('/user/using', function(req, res){
  //用戶id，單車id，本次騎行起始地理信息和時間信息，單車密碼
  let userid = req.body.id;
  let bikeid = -1;
  let begtime = 0;
  let beglatitude = -1;
  let beglongitude = -1;
  let begdistrict = '';
  let begstreet = '';
  let password = '';
  //創建連接
  userPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      //查找對應的臨時訂單
      let sql = `select * from tmp_order where user_id=${userid};`;
      conn.query(sql, function(err, rows){
        if(err){console.log(err);}
        else
        {
          //設置對應信息
          let result = rows[0];
          bikeid = result.bike_id;
          begtime = result.time;
          beglatitude = result.latitude;
          beglongitude = result.longitude;
          begdistrict = result.district;
          begstreet = result.street;
          //獲取單車密碼
          let sql_password = `select password from bike where id=${bikeid};`;
          conn.query(sql_password, function(err, rows){
            if(err){console.log(err);}
            else
            {
              //設置密碼信息
              password = rows[0].password;
              res.render('usingPage', {userid:userid, bikeid:bikeid, password:password, begtime:begtime, 
                begdistrict:begdistrict, begstreet:begstreet});
            }
          });
        }
      });
      conn.release();
    }
  });
});

/**
 * 觸發器
 */
router.post('/user/using/query', function(req, res){
  //用戶id，當前經緯度
  let userid = req.body.userid;
  let curlongitude = req.body.curlongitude;
  let curlatitude = req.body.curlatitude;
  //創建連接
  userPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      //提取臨時訂單用來獲取上一次更新時的地理信息
      let sql = `select cur_latitude,cur_longitude from tmp_order where user_id=${userid};`;
      conn.query(sql, function(err, rows){
        if(err){console.log(err);}
        else
        {
          let lastlatitude = rows[0].cur_latitude;
          let lastlongitude = rows[0].cur_longitude;
          //檢測兩次地理信息是否一樣，如果一樣説明用戶在這段時間内沒有動
          if(Math.abs(curlatitude-lastlatitude)<0.1 && Math.abs(curlongitude-lastlongitude)<0.1)
          {
            //提醒用戶
            res.render('warningPage',{id:userid});
          }
          else
          {
            //更新經緯度信息
            let sql = `update tmp_order set cur_latitude=${curlatitude}, cur_longitude=${curlongitude} 
              where user_id=${userid};`;
            conn.query(sql, function(err, rows){
              if(err){console.log(err);}
              else
              {
                //回到使用界面
                res.render('usingPageMedia',{id:userid});
              }
            });            
          }
        }
      });
      conn.release();
    }
  });
});

/**
 * 用戶信息
 */
router.post('/user/info', function(req, res){
  //用戶id，用戶名，餘額，性別，電話，工作，提示信息
  let id = req.body.id;
  let username = '';
  let balance = 0;
  let gender = -1;
  let phone_number = '';
  let job = '';
  let msg = req.body.msg;
  let maptoGender = ['女','男'];
  //建立連接
  userPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      //查詢用戶信息
      let sql = `select * from user where id=${id};`;
      conn.query(sql, function(err, rows){
        if(err){console.log(err);}
        else
        {
          //設置相關信息
          let result = rows[0];
          username = result.username;
          balance = result.balance;
          gender = result.gender;
          phone_number = result.phone_number;
          job = result.job;
          res.render('infoPage', {id:id, username: username, balance: balance, 
            gender: maptoGender[gender], phone_number:phone_number, job:job, message:msg});
        }
      });
      conn.release();
    }
  });
});

/**
 * 用戶更改信息頁面
 */
router.post('/user/change', function(req, res){
  //用戶id，用戶名，性別，工作，提示信息
  let id = req.body.id;
  let username = '';
  let gender = -1;
  let job = '';
  let msg = req.body.msg;
  let maptoGender = ['女','男'];
  //建立連接
  userPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      //查詢用戶信息
      let sql = `select * from user where id=${id};`;
      conn.query(sql, function(err, rows){
        if(err){console.log(err);}
        else
        {
          //設置相關信息
          let result = rows[0];
          username = result.username;
          gender = result.gender;
          job = result.job;
          res.render('changePage', {id:id, username: username, 
            gender: maptoGender[gender], job:job, message:msg});
        }
      });
      conn.release();
    }
  });
});

/**
 * 用戶改變基本信息
 */
router.post('/user/change/basic', function(req, res){
  //用戶id，用戶名，用戶性別，用戶工作
  let id = req.body.id;
  let username = req.body.new_username;
  let gender = req.body.new_gender;
  let job = req.body.new_job;
  //建立連接
  userPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      //更新用戶信息
      let sql = `update user set username='${username}',gender=${gender},job='${job}' where id=${id};`;
      conn.query(sql, function(err){
        if(err){console.log(err);}
        else
        {
          res.render('changeMedia', {id:id, message:"修改基本信息成功"});
        }
      });
      conn.release();
    }
  });
});

/**
 * 用戶請求更改密碼
 */
router.post('/user/change/password', function(req, res){
  //用戶id
  let id = req.body.id;
  res.render('changePassword', {id:id, message:"修改密码"});
});

/**
 * 用戶實際更改密碼
 */
router.post('/user/change/password/pass', function(req, res){
  //用戶id，原密碼，新密碼
  let id = req.body.id;
  let old_password = req.body.old_password;
  let new_password = req.body.new_password;
  //建立連接
  userPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      //獲取數據庫中存儲的密碼
      let sql = `select password from user where id=${id};`;
      conn.query(sql, function(err, rows){
        if(err){console.log(err);}
        else
        {
          //匹配密碼
          if(old_password != rows[0].password)
          {
            res.render('changePassword', {id:id, message:"修改失败，原密码错误"});
          }
          else
          {
            //實際更新
            let sql = `update user set password='${new_password}' where id=${id};`;
            conn.query(sql, function(err){
              if(err){console.log(err);}
              else
              {
                res.render('changeMedia', {id:id, message:"密码修改成功"});
              }
            });
          }
        }
      });
      conn.release();
    }
  });
});

/**
 * 用戶充值請求
 */
router.post('/user/change/recharge', function(req, res){
  //用戶id，用戶餘額
  let id = req.body.id;
  let balance = 0;
  //建立連接
  userPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      //查詢當前餘額
      let sql = `select balance from user where id=${id};`;
      conn.query(sql, function(err, rows){
        if(err){console.log(err);}
        else 
        {
          balance = rows[0].balance;
          res.render('chargePage', {id:id, balance:balance});
        }
      });
      conn.release();
    }
  });
});

/**
 * 用戶實際充值
 */
router.post('/user/change/recharge/pass', function(req, res){
  //用戶id，充值數目
  let id = req.body.id;
  let delta = req.body.delta;
  userPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      //更新餘額
      let sql = `update user set balance=balance+${delta} where id=${id};`;
      conn.query(sql, function(err){
        if(err){console.log(err);}
        else
        {
          res.render('infoMedia', {id:id, message:'充值成功'})
        }
      });
      conn.release();
    }
  });
});

/**
 * 用戶請求注銷賬號
 */
router.post('/user/change/delete', function(req, res){
  let id = req.body.id;
  userPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      //注銷
      let sql = `delete from user where id=${id};`;
      conn.query(sql, function(err){
        if(err){console.log(err);}
        else
        {
          res.redirect('../../../');
        }
      });
      conn.release();
    }
  });
});

/**
 * 用戶查詢訂單
 */
router.post('/user/orders', function(req, res){
  //用戶id，訂單信息，xml
  let id = req.body.id;
  let orders = {'Order':[]};  
  let xml = '';
  //建立連接
  userPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      //查詢訂單
      let sql = `select * from bill where userid=${id};`;
      conn.query(sql, function(err, rows){
        if(err){console.log(err);}
        else
        {
          let len = rows.length;
          //創建json
          for(let i = 0; i < len; ++i)
          {
            let result = rows[i];
            orders['Order'].push({
              bikeid:result.bikeid,
              begtime:result.start_time,
              endtime:result.end_time,
              beglatitude:result.start_latitude,
              endlatitude:result.end_latitude,
              beglongitude:result.start_longitude,
              endlongitude:result.end_longitude,
              begstreet:result.start_street,
              endstreet:result.end_street,
              begdistrict:result.start_district,
              enddistrict:result.end_district
            });
          }
          //創建xml
          xml = JsonBuilder.buildObject(orders);
          res.render('orderInfo', {id:id, xml:xml});
        }
      });
      conn.release();
    }
  });
});

/**
 * 查找附近單車
 */
router.post('/user/find', function(req, res){
  //用戶id，用戶當前經緯度，街道行政區，xml，查詢結果
  let id = req.body.id;
  let curLatitude = req.body.latitude;
  let curLongitude = req.body.longitude;
  let curDistrict = req.body.district;
  let curStreet = req.body.street;
  let xml = '';
  let bikes = {};
  //建立連接
  userPool.getConnection(function(err, conn){
    if(err)
    {
      console.log(err);
    }
    else
    {
      //用戶查詢
      let sql1 = `select * from user where id=${id};`;
      conn.query(sql1, function(err, rows1){
        if(err){console.log(err);}
        else
        {
          let result = rows1[0];
          bikes['User'] = {};
          bikes['User']['UserName'] = result.username;
          bikes['User']['Location'] = {};
          bikes['User']['Location']['District'] = curDistrict;
          bikes['User']['Location']['Street'] = curStreet;
          bikes['User']['Location']['Longitude'] = curLongitude;
          bikes['User']['Location']['Latitude'] = curLatitude;
          bikes['User']['Order'] = {};
          bikes['User']['BikeList'] = {Bike:[]};
          //查詢最近一次訂單
          let sql2 = `select S.userid,S.bikeid,S.start_time,S.end_time,S.bill from bill as S where userid=${id} 
            and not exists(select * from bill as R where R.end_time > S.end_time);`;
          conn.query(sql2, function(err, rows2){
            if(err){console.log(err);}
            else
            {
              if(rows2.length > 0)
              {
                let result = rows2[0];
                bikes['User']['Order']['StartTime'] = result.start_time;
                bikes['User']['Order']['EndTime'] = result.end_time;
                bikes['User']['Order']['SerialNumber'] = result.bikeid;
                bikes['User']['Order']['Cost'] = result.bill;
                bikes['User']['Order']['Status'] = 'Finished'; 
              }
              //查詢附近可用車輛
              let sql3 = `select bike.id as bikeid,district,street,latitude,longitude,info from bike,type 
              where bike.typeid=type.id and status=0 and ((abs(longitude-${curLongitude})<0.180) 
              and (abs(latitude-${curLatitude})<0.235)) order by sqrt(pow(longitude-${curLongitude},2)+pow(latitude-${curLatitude},2));`;
              conn.query(sql3, function(err, rows3){
                if(err){console.log(err);}
                else
                {
                  if(rows3.length > 0)
                  {
                    let len = rows3.length;
                    //建立json
                    for(let i=0; i < len; ++i)
                    {
                      let result = rows3[i];
                      bikes['User']['BikeList']['Bike'].push({
                        SerialNumber:result.bikeid,
                        Type: result.info,
                        Location:{
                          District:result.district,
                          Street: result.street,
                          Longitude: result.longitude,
                          Latitude: result.latitude
                        }
                      });
                    }
                    //生成xml
                    xml = JsonBuilder.buildObject(bikes);
                    console.log(xml);
                    res.render('findList', {id:id, xml:xml});
                  }
                }
              });
            }
          });
        }
      });
    }
  });
});

/**
 * 用戶結算
 */
router.post('/user/balance', function(req, res){
  //用戶id，單車id，訂單信息
  let userid = req.body.id;
  let bikeid = -1;
  let begtime = -1;
  let begdistrict = '';
  let begstreet = '';
  let beglongitude = 0;
  let beglatitude = 0;
  let endtime = (new Date()).getTime();
  let enddistrict = req.body.district;
  let endstreet = req.body.street;
  let endlongitude = req.body.longitude;
  let endlatitude = req.body.latitude;
  let price = 0;
  let typeid = -1;
  let bill = 0; 
  //報錯信息
  let error = req.body.error;
  let msg = '用车结算完毕';
  if(error==2)
  {
    msg = '报修完毕';
  }
  //建立連接
  userPool.getConnection(function(err, conn){
    //使用事務處理
    queues(conn);
    let trans = conn.startTransaction();
    //建立任務
    let task0 = function(callback)
    {
      //查找臨時訂單
      let sql = `select * from tmp_order where user_id=${userid};`;
      trans.query(sql, function(err, rows){
        if(err)
        {
          console.log(err);
          callback(err);
        }
        else
        {
          //設置相應信息
          result = rows[0];
          bikeid = result.bike_id;
          begtime = result.time;
          begdistrict = result.district;
          begstreet = result.street;
          beglongitude = result.longitude;
          beglatitude = result.latitude;
          callback(null);
        }
      });
    };
    let task1 = function(callback)
    {
      //刪除臨時訂單
      let sql = `delete from tmp_order where user_id=${userid};`;
      trans.query(sql, function(err){
        if(err)
        {
          console.log(err);
          callback(err);
        }
        else
        {
          callback(null);
        }
      });
    };
    let task2 = function(callback)
    {
      //查找單車的類型
      let sql = `select typeid from bike where id=${bikeid};`;
      trans.query(sql, function(err, rows){
        if(err)
        {
          console.log(err);
          callback(err);
        }
        else
        {
          typeid = rows[0].typeid;
          callback(null);
        }
      });
    }; 
    let task3 = function(callback)
    {
      //更新單車地理信息，使用狀態
      let sql = `update bike set latitude=${endlatitude},longitude=${endlongitude},street='${endstreet}',district='${enddistrict}',
      status=${error} where id=${bikeid};`;
      trans.query(sql, function(err){
        if(err)
        {
          console.log(err);
          callback(err);
        }
        else
        {
          callback(null);
        }
      });
    };
    let task4 = function(callback)
    {
      //查詢單價
      let sql = `select price_adult from type where id=${typeid};`;
      trans.query(sql, function(err, rows){
        if(err)
        {
          console.log(err);
          callback(err);
        }
        else
        {
          price = rows[0].price_adult;
          bill = (endtime - begtime)/(60 * 60 * 1000) * price;
          callback(null);
        }
      });
    };
    let task5 = function(callback)
    {
      //更新用戶地理信息，賬戶信息
      let sql = `update user set using_bike=0,balance=balance-${bill},longitude=${endlongitude},latitude=${endlatitude},
        district='${enddistrict}',street='${endstreet}' where id=${userid};`;
      trans.query(sql, function(err){
        if(err)
        {
          console.log(err);
          callback(err);
        }
        else
        {
          callback(null);
        }
      });
    };
    let task6 = function(callback)
    {
      //插入完成的訂單
      let sql = `insert into bill(bill,userid,bikeid,start_time,end_time,start_latitude,end_latitude,start_longitude,end_longitude,
          start_district,end_district,start_street,end_street) values(${bill},${userid},${bikeid},${begtime},${endtime},
          ${beglatitude},${endlatitude},${beglongitude},${endlongitude},'${begdistrict}','${enddistrict}','${begstreet}','${endstreet}');`;
      trans.query(sql, function(err){
        if(err)
        {
          console.log(err);
          callback(err);
        }
        else
        {
          callback(null);
        }
      });
    };
    //序列化執行
    async.series([task0, task1, task2, task3, task4, task5, task6], function(err){
      if(err)
      {
        trans.rollback(function(){});
        conn.release();
      }
      else
      {
        trans.commit(function(err){
          if(err)
          {
            console.log(err);
            conn.release();
          }
          else
          {
            res.render('balancePage', {userid:userid, bikeid:bikeid, begtime:begtime, endtime:endtime, begdistrict:begdistrict,
              enddistrict:enddistrict, begstreet:begstreet, endstreet:endstreet, bill:bill, message:msg});
            conn.release();
          }
        });
      }
    });
    //開始執行
    trans.execute();
  });
});

/**
 * 管理員插入用戶
 */
router.post('/admin/insertUser', function(req, res){
  let id = req.body.id;
  let username = req.body.username;
  let msg = '增加新用户';
  res.render('insertUserPage', {id:id, username:username, message:msg});
});

router.post('/admin/insertUser/pass', function(req, res){
  let adminid = req.body.id;
  let admin_username = req.body.username;
  let new_username = req.body.new_username;
  let new_password = req.body.new_password;
  let new_phone_number = req.body.new_phone_number;
  let new_balance = req.body.new_balance;
  let new_gender = req.body.new_gender;
  let new_job = req.body.new_job;
  let new_is_admin = req.body.new_is_admin;
  adminPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      let sql = `insert into user(password,username,phone_number,gender,job,is_admin,balance,latitude,longitude,district,street)
       values('${new_password}','${new_username}','${new_phone_number}','${new_gender}','${new_job}',
       ${new_is_admin},${new_balance},0,0,'none','none');`;
      conn.query(sql, function(err){
        if(err){console.log(err);}
        else
        {
          res.render('insertUserPage', {id:adminid, username:admin_username, message:'插入成功'});
        }
      });
      conn.release();
    }
  });
});

/**
 * 管理員刪除用戶
 */
router.post('/admin/deleteUser', function(req, res){
  let id = req.body.id;
  let username = req.body.username;
  res.render('deleteUserPage', {id:id, username:username, message:'删除用户'});
});

router.post('/admin/deleteUser/pass', function(req, res){
  let id = req.body.id;
  let username = req.body.username;
  let deleteid = req.body.delete_id;
  adminPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      let sql = `delete from user where id=${deleteid};`;
      conn.query(sql, function(err){
        if(err){console.log(err);}
        else
        {
          res.render('deleteUserPage', {id:id, username:username, message:'成功删除'});
        }
      });
      conn.release();
    }
  });
});

/**
 * 管理員插入單車
 */
router.post('/admin/insertBike', function(req, res){
  let id = req.body.id;
  let username = req.body.username;
  let msg = '增加车辆';
  res.render('insertBikePage', {id:id, username:username, message:msg});
});

router.post('/admin/insertBike/pass', function(req, res){
  let adminid = req.body.id;
  let admin_username = req.body.username;
  let new_password = req.body.new_password;
  let new_typeid = req.body.new_typeid;
  let new_status = req.body.new_status;
  let new_latitude = req.body.new_latitude;
  let new_longitude = req.body.new_longitude;
  let new_street = req.body.new_street;
  let new_district = req.body.new_district;
  adminPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      let sql = `insert into bike(password,typeid,status,latitude,longitude,district,street)
       values('${new_password}',${new_typeid},${new_status},${new_latitude},${new_longitude},
       '${new_district}','${new_street}');`;
      conn.query(sql, function(err){
        if(err){console.log(err);}
        else
        {
          res.render('insertBikePage', {id:adminid, username:admin_username, message:'插入成功'});
        }
      });
      conn.release();
    }
  });
});

/**
 * 管理員更新單車
 */
router.post('/admin/updateBike', function(req, res){
  let id = req.body.id;
  let username = req.body.username;
  let msg = '修改车辆信息';
  res.render('updateBikePage', {id:id, username:username, message:msg});
});

router.post('/admin/updateBike/pass', function(req, res){
  let adminid = req.body.id;
  let admin_username = req.body.username;
  let bikeid = req.body.update_id;
  let password = req.body.update_password;
  let typeid = req.body.update_typeid;
  let status = req.body.update_status;
  let latitude = req.body.update_latitude;
  let longitude = req.body.update_longitude;
  let district = req.body.update_district;
  let street = req.body.update_street;
  adminPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      let sql = `update bike set password='${password}',typeid=${typeid},status=${status},latitude=${latitude},
      longitude=${longitude},district='${district}',street='${street}' where id=${bikeid};`;
        conn.query(sql, function(err){
        if(err){console.log(err);}
        else
        {
          res.render('updateBikePage', {id:adminid, username:admin_username, message:'更新成功'});
        }
      });
      conn.release();
    }
  });
});

/**
 * 管理員刪除單車
 */
router.post('/admin/deleteBike', function(req, res){
  let id = req.body.id;
  let username = req.body.username;
  res.render('deleteBikePage', {id:id, username:username, message:'删除单车'});
});

router.post('/admin/deleteBike/pass', function(req, res){
  let id = req.body.id;
  let username = req.body.username;
  let deleteid = req.body.delete_id;
  adminPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      let sql = `delete from bike where id=${deleteid};`;
      conn.query(sql, function(err){
        if(err){console.log(err);}
        else
        {
          res.render('deleteBikePage', {id:id, username:username, message:'成功删除'});
        }
      });
      conn.release();
    }
  });
});

/**
 * 管理員查詢單車
 */
router.post('/admin/queryBike', function(req, res){
  let id = req.body.id;
  let username = req.body.username;
  res.render('queryBikePage',{id:id, username:username, message:"查询单车"});
});

router.post('/admin/queryBike/pass', function(req, res){
  let id = req.body.id;
  let username = req.body.username;
  let bikeid = req.body.bike_id;
  adminPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      let sql = `select password,info,status,latitude,longitude,street,district from bike,type 
        where bike.typeid=type.id and bike.id=${bikeid};`;
      conn.query(sql, function(err, rows){
        if(err){console.log(err);}
        else
        {
          res.render('bikeInfo', {id:id,username:username,bikeid:bikeid,password:rows[0].password,info:rows[0].info,
            status:rows[0].status,latitude:rows[0].latitude,longitude:rows[0].longitude,district:rows[0].district,
            street:rows[0].street});
        }
      });
      conn.release();
    }
  });
});

/**
 * 管理員的特殊查詢
 */
router.post('/admin/special', function(req, res){
  let id = req.body.id;
  let username = req.body.username;
  res.render('specialPage',{id:id, username:username, message:"特殊查询"});
});

router.post('/admin/special/pass', function(req, res){
  let id = req.body.id;
  let username = req.body.username;
  let action = req.body.action;
  let filename = 'showResult_' + action;
  let start = new Date(req.body.start);
  let end = new Date(req.body.end);
  let street = req.body.street;
  adminPool.getConnection(function(err, conn){
    if(err){console.log(err);}
    else
    {
      if(action==1)
      {
        let sql = `select A.district,A.street from (select district, street, count(*) as count from bike group by district, street) as A, 
        (select district, avg(A.count) as mean from (select district, street, count(*) as count from bike group by district, street) as A group by district) as B 
        where A.district = B.district and A.count < B.mean;`;
        conn.query(sql,function(err, rows){
          if(err){console.log(err);}
          else
          {
            let json = {};
            json['Answers'] = [];
            let len = rows.length;
            for(let i=0; i < len; ++i)
            {
              let result = rows[i];
              json['Answers'].push({
                District: result.district,
                Street: result.street
              });
            }
            let xml = JsonBuilder.buildObject(json);
            res.render(filename, {id:id, username:username, xml:xml});
          }
        });
        conn.release();
      }
      else if(action==2)
      {
        let sql = `select username from (select username,user.id, count(*) as total from user, bill where user.id=bill.userid 
        and bill.start_time>${start.getTime()} and bill.end_time<${end.getTime()} group by user.id) as A 
        where total = (select max(total) from (select username,user.id, count(*) as total from user, bill 
        where user.id=bill.userid and bill.start_time>${start.getTime()} and bill.end_time<${end.getTime()} group by user.id) as B) order by total desc;`;
        conn.query(sql,function(err, rows){
          if(err){console.log(err);}
          else
          {
            let json = {};
            json['Answers'] = [];
            let len = rows.length;
            for(let i=0; i < len; ++i)
            {
              let result = rows[i];
              json['Answers'].push({
                User: result.username
              });
            }
            let xml = JsonBuilder.buildObject(json);
            res.render(filename, {id:id, username:username, xml:xml});
          }
        });
        conn.release();
      }
      else if(action==3)
      {
        let sql = `select sum(bill) as s from bill where bill.start_street='${street}' or bill.end_street='${street}';`
        conn.query(sql,function(err, rows){
          if(err){console.log(err);}
          else
          {
            let json = {};
            json['Answers'] = [];
            let len = rows.length;
            for(let i=0; i < len; ++i)
            {
              let result = rows[i];
              json['Answers'].push({
                Sum: result.s
              });
            }
            let xml = JsonBuilder.buildObject(json);
            res.render(filename, {id:id, username:username, xml:xml});
          }
        });
        conn.release();
      }
      else if(action==4)
      {
        let sql = `select info from (select B.typeid, count(*)/(select count(*) from bike as A 
          where A.typeid=B.typeid) as rate,count(*) as order_num from bike as B,bill where status=2 
          and B.id=bill.bikeid group by typeid) as B,type where B.typeid=type.id 
          and B.rate>(select count(*)/(select count(*) from bike) from bike where status=2) 
          order by rate, order_num desc;`;
        conn.query(sql, function(err, rows){
          if(err){console.log(err);}
          else
          {
            let json = {};
            json['Answers'] = [];
            let len = rows.length;
            for(let i=0; i < len; ++i)
            {
              let result = rows[i];
              json['Answers'].push({
                Type: result.info
              });
            }
            let xml = JsonBuilder.buildObject(json);
            res.render(filename, {id:id, username:username, xml:xml});
          }
        });
        conn.release();
      }
      else if(action==5)
      {
        let sql = `select D.street as street from (select A.street,(select count(*) from bike as B 
          where A.street=B.street and B.status=2) as bad,(select count(*) from bike as C 
          where A.street=C.street and C.status<>2) as good from bike as A group by A.street) as D 
          where D.bad>D.good;`;
        conn.query(sql, function(err, rows){
          if(err){console.log(err);}
          else
          {
            let json = {};
            json['Answers'] = [];
            let len = rows.length;
            for(let i=0; i < len; ++i)
            {
              let result = rows[i];
              json['Answers'].push({
                Street: result.street
              });
            }
            let xml = JsonBuilder.buildObject(json);
            res.render(filename, {id:id, username:username, xml:xml});
          }
        });
        conn.release();
      }
    }
  });
});

module.exports = router;
