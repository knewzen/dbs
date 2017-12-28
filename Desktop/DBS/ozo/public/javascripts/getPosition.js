/**
 * author: zsz
 * email: zhengsz@pku.edu.cn 
 * last_modify: 2017-12-19
 * description: use this tool to get latitude and longitude
 */
function getPosition()
{
    if(navigator.geolocation) 
    {
        navigator.geolocation.getCurrentPosition(
            function (position) {  
                _longitude = position.coords.longitude;  
                _latitude = position.coords.latitude;  
                _success = true;
                var longitude = document.getElementsByClassName('longitude');
                var latitude = document.getElementsByClassName('latitude');
                for(var i=0; i < longitude.length; ++i)
                {
                    longitude[i].value = _longitude;
                }
                for(var i=0; i < latitude.length; ++i)
                {
                    latitude[i].value = _latitude;
                }                
            },
            function (e) {
                var longitude = document.getElementsByClassName('longitude');
                var latitude = document.getElementsByClassName('latitude');
                var _latitude = e.code;
                var _longitude = e.message;
                for(var i=0; i < longitude.length; ++i)
                {
                    longitude[i].value = _longitude;
                }
                for(var i=0; i < latitude.length; ++i)
                {
                    latitude[i].value = _latitude;
                } 
            }
        ) 
   }
}