-- MySQL dump 10.13  Distrib 5.7.20, for macos10.12 (x86_64)
--
-- Host: localhost    Database: ozo
-- ------------------------------------------------------
-- Server version	5.7.20

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `bike`
--

DROP TABLE IF EXISTS `bike`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `bike` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `password` varchar(10) NOT NULL,
  `typeid` int(11) unsigned NOT NULL,
  `status` tinyint(4) NOT NULL DEFAULT '0',
  `latitude` float NOT NULL DEFAULT '0',
  `longitude` float NOT NULL DEFAULT '0',
  `street` varchar(20) NOT NULL,
  `district` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `typeid` (`typeid`),
  CONSTRAINT `typeid` FOREIGN KEY (`typeid`) REFERENCES `type` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=407 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bike`
--

LOCK TABLES `bike` WRITE;
/*!40000 ALTER TABLE `bike` DISABLE KEYS */;
INSERT INTO `bike` VALUES (406,'11',7,0,0,0,'t','t');
/*!40000 ALTER TABLE `bike` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bill`
--

DROP TABLE IF EXISTS `bill`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `bill` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `bill` decimal(10,2) NOT NULL DEFAULT '0.00',
  `userid` bigint(20) unsigned NOT NULL,
  `bikeid` bigint(20) unsigned NOT NULL,
  `start_time` bigint(20) NOT NULL DEFAULT '0',
  `end_time` bigint(20) NOT NULL DEFAULT '0',
  `start_latitude` float NOT NULL DEFAULT '0',
  `end_latitude` float NOT NULL DEFAULT '0',
  `start_longitude` float NOT NULL DEFAULT '0',
  `end_longitude` float NOT NULL DEFAULT '0',
  `start_street` varchar(20) NOT NULL,
  `end_street` varchar(20) NOT NULL,
  `start_district` varchar(20) NOT NULL,
  `end_district` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `userid` (`userid`) USING BTREE,
  KEY `bikeid` (`bikeid`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bill`
--

LOCK TABLES `bill` WRITE;
/*!40000 ALTER TABLE `bill` DISABLE KEYS */;
/*!40000 ALTER TABLE `bill` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tmp_order`
--

DROP TABLE IF EXISTS `tmp_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tmp_order` (
  `user_id` bigint(20) unsigned NOT NULL,
  `bike_id` bigint(20) unsigned DEFAULT NULL,
  `longitude` float NOT NULL DEFAULT '0',
  `latitude` float NOT NULL DEFAULT '0',
  `street` varchar(20) NOT NULL,
  `district` varchar(20) NOT NULL,
  `time` bigint(20) NOT NULL DEFAULT '0',
  `cur_latitude` float NOT NULL DEFAULT '0',
  `cur_longitude` float NOT NULL DEFAULT '0',
  PRIMARY KEY (`user_id`),
  KEY `bike_id` (`bike_id`),
  CONSTRAINT `tmp_order_ibfk_1` FOREIGN KEY (`bike_id`) REFERENCES `bike` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tmp_order`
--

LOCK TABLES `tmp_order` WRITE;
/*!40000 ALTER TABLE `tmp_order` DISABLE KEYS */;
/*!40000 ALTER TABLE `tmp_order` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `type`
--

DROP TABLE IF EXISTS `type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `type` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `info` varchar(64) NOT NULL,
  `price_adult` decimal(4,2) unsigned NOT NULL DEFAULT '1.00',
  `price_student` decimal(4,2) unsigned NOT NULL DEFAULT '0.50',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `type`
--

LOCK TABLES `type` WRITE;
/*!40000 ALTER TABLE `type` DISABLE KEYS */;
INSERT INTO `type` VALUES (7,'第一代青春回忆杀',1.00,0.50),(8,'26寸家用车',1.00,0.50),(9,'校园异形车',1.00,0.50),(10,'24寸小轮车',1.00,0.50),(11,'肌肉车',1.00,0.50),(12,'电动车',1.00,0.50);
/*!40000 ALTER TABLE `type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `password` varchar(20) NOT NULL,
  `username` varchar(20) NOT NULL,
  `phone_number` char(15) NOT NULL,
  `balance` decimal(10,2) NOT NULL DEFAULT '0.00',
  `gender` int(1) DEFAULT NULL,
  `is_student` int(1) NOT NULL DEFAULT '0',
  `using_bike` int(1) NOT NULL DEFAULT '0',
  `latitude` float NOT NULL DEFAULT '0',
  `longitude` float NOT NULL DEFAULT '0',
  `street` varchar(20) NOT NULL,
  `district` varchar(20) NOT NULL,
  `is_admin` int(1) NOT NULL DEFAULT '0',
  `job` varchar(20) DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `phone_number` (`phone_number`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user`
--

LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
INSERT INTO `user` VALUES (9,'12345678','ck','18401621061',0.00,NULL,0,0,0,0,'admin','admin',1,''),(13,'123','kk','12345678910',0.00,NULL,0,0,39.986,116.304,'test','test',0,''),(14,'111','kkk','12345678901',0.00,0,0,0,39.986,116.304,'test','test',0,'学生');
/*!40000 ALTER TABLE `user` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2017-12-29  2:15:39
