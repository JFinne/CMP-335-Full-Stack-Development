function getLocation(){
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(showPosition);
    } else {
        alert("Geolocation is not supported by this browser.");
    } 
}

function showPosition(position) {
    var lat = position.coords.latitude;
    var long = position.coords.longitude;
    document.getElementById("coordinates").innerHTML = "Latitude: " + lat + "<br>Longitude: " + long;
}