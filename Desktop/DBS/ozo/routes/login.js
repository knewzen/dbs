/**
 * author: zsz
 * email: zhengsz@pku.edu.cn 
 * last_modify: 2017-12-19
 * description: login router file
 */
let express = require('express');
let path = require('path');
let router = express.Router();
let mysql = require('mysql');
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
 * use login page
 */
router.get('/', function(req, res){
    res.render('login');
});

/**
 * after user enter password, check password and decide permission
 */
router.post('/pass', function(req, res){
    let phone_number = req.body.lognumber;
    let password = req.body.logpass;
    let latitude = req.body.latitude;
    let longitude = req.body.longitude;
    let district = req.body.district;
    let street = req.body.street;
    userPool.getConnection(function(err, connection){
        if(err)
        {
            console.log(err);
        }
        else
        {
            let sql = `select * from user where phone_number = ${phone_number};`;
            connection.query(sql, function(err, rows, cols){
                if(err)
                {
                    console.log(err);
                }
                if(rows.length > 1)
                {
                    console.error('系统错误，存在多个用户手机号码相同');
                }
                if(rows.length < 1)
                {
                    res.send('不存在用户');
                }
                let result = rows[0];
                if(password != result.password)
                {
                    res.send('密码错误');
                }
                //when login, update position information
                sql = `update user set latitude=${latitude}, longitude=${longitude}, district=${district}, street=${street}) 
                where id = ${result.id};`;
                //check if is administer
                if(result.is_admin)
                {
                    console.log('check ' + result.username);
                    res.render('adminMedia', {id: result.id, username: result.username});
                }
                else res.render('userMedia', {id: result.id});
            })
            connection.release();
        }
    })
});

router.get('/register', function(req, res){
    res.render('register');
});

/**
 * after register information sent, insert a new user
 */
router.post('/register_pass', function(req, res){
    let id = -1;
    let userName = req.body.logname;
    let password = req.body.logpass;
    let phone_number = req.body.phone_number;
    let balance = 0;
    let is_student = 0;
    let using_bike = 0;
    let latitude = req.body.latitude;
    let longitude = req.body.longitude;
    let district = req.body.district || "test";
    let street = req.body.street || "test";
    let is_admin = 0;
    let sql1 = `select id from user where phone_number = ${phone_number};`;
    let sql2 = `insert into user(password, username, phone_number, balance, is_student, using_bike, 
        latitude, longitude, street, district, is_admin) values('${password}', '${userName}','${phone_number}',
        ${balance},${is_student},${using_bike},'${latitude}','${longitude}',
        '${street}','${district}', ${is_admin});`;
    adminPool.getConnection(function(err, conn){
        if(err) console.log(err);
        else
        {
            conn.query(sql1, function(err, rows){
                if(err) console.log(err);
                else if(rows.length > 0)
                {
                    id = rows[0].id;
                    res.render('loginMedia', {id:id, message:'该手机号已经注册'})
                }
                else
                {
                    conn.query(sql2, function(err, rows){
                        if(err) console.log(err);
                        else
                        {
                            conn.query(sql1, function(err, rows){
                                if(err) console.log(err);
                                else 
                                {
                                    id = rows[0].id;
                                    res.render('loginMedia', {id: id, message: '注册成功'});
                                }
                            });   
                        }
                    });
                }
            });
            conn.release();
        }
    });
       
});


module.exports = router;