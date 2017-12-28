创建数据库
	1	配置好MySQL
	2	在终端输入命令 mysql -u root -p，输入密码后进入mysql >mysql
	3	创建数据库 mysql> create database ozo;
	4	创建管理员 mysql> create user admin@localhost identified by 'adminenter';
	5	授予权限 mysql> grant all on ozo.* to admin@localhost;
	6	导入数据库 mysql> source createozo.sql

在Node.js环境下运行
	1	在终端进入ozo目录 
	2	输入 npm install; npm start
	3	浏览器访问 127.0.0.1：3000
	4	进入ozo，感受都市之风！