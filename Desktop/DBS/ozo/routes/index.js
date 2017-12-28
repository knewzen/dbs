/**
 * author: zsz
 * email: zhengsz@pku.edu.cn 
 * last_modify: 2017-12-19
 * description: gate file
 */
var express = require('express');
var router = express.Router();

/* GET welcome page. */
router.get('/', function(req, res, next) {
  res.render('welcome');
});

module.exports = router;
