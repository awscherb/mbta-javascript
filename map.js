/* The map */
var map;
/* Ten second refresh reate */
var refreshRate = 10000;
/* Map marker shape */
var shape = google.maps.SymbolPath.FORWARD_CLOSED_ARROW ;
/* Marker size */
var size = 4;
/* Initialie the map */
google.maps.event.addDomListener(window, 'load', initialize);

/* All current vehicle markers */
var markers = {};
/* Number of vehicles per line */
var vehiclesPerLine = {};
/* Temporary object to store the new markers, so we can remove the old ones */
var newMarkers = [];
/* Speed of all vehicles reporting speeds */
var speeds = [];
/* Session max and min speeds */
var max = 0;
var min = Number.MAX_VALUE;


var infowindow = new google.maps.InfoWindow(); 
/* Route predictions parts */
var predictions = [
    "http://realtime.mbta.com/developer/api/v2/predictionsbyroute?api_key=wX9NwuHnZU2ToO7GmGR9uw&route=",
    "&format=json"
];
/** Stop predictions URL parts */
var predictionsByStop = [
    "http://realtime.mbta.com/developer/api/v2/predictionsbystop?api_key=wX9NwuHnZU2ToO7GmGR9uw&stop=",
    "&format=json"
];

var myMarker;
var dtx;

run();

google.maps.Circle.prototype.contains = function(latLng) {
  return this.getBounds().contains(latLng) && google.maps.geometry.spherical.computeDistanceBetween(this.getCenter(), latLng) <= this.getRadius();
}

/* Initialize hte map */
function initialize() {
    
    var mapOptions = {
        zoom: 13,
        center: new google.maps.LatLng(42.343831, -71.069173),
        zoomControl: true,
        rotateControl: true,
        panControl: true,
        scaleControl: true
    };

    map = new google.maps.Map(document.getElementById('map-canvas'),
      mapOptions);
    
    var transitLayer = new google.maps.TransitLayer();
    transitLayer.setMap(map);   

    map.setOptions({styles: styles});

    dtx = new google.maps.Circle({
      strokeColor: '#FF0000',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#FF0000',
      fillOpacity: 0.35,
      map: map,
      center: {lat: 42.355475, lng: -71.060529},
      radius: 50
    });

}

/* Refresh the map */
function refresh() {
    drawVehicles();
}

function run() {
    refresh();
    setTimeout(run, refreshRate);
}

/* Draw the vehicles on the map */
function drawVehicles() {
    var xmlhttp = new XMLHttpRequest();
    var url = "http://realtime.mbta.com/developer/api/v2/vehiclesbyroutes"
    +"?api_key=wX9NwuHnZU2ToO7GmGR9uw&routes=Red,Orange,Blue,Green-B,"
    +"Green-C,Green-D,Green-E,CR-Providence,CR-Newburyport,CR-Needham,"
    +"CR-Middleborough,CR-Lowell,CR-Kingston,CR-Haverhill,CR-Greenbush,"
    +"CR-Franklin,CR-Worcester,CR-Fitchburg,CR-Fairmount&format=json";
    
    /*
        Silver - 741,742,749,751
    */
    
    xmlhttp.onreadystatechange=function() {
        if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
            myFunction(xmlhttp.responseText);
        }
    }
    xmlhttp.open("GET", url, true);
    xmlhttp.send();

    function myFunction(response) {
        var arr = JSON.parse(response);
        var modes = arr.mode;
        var totalMarkers = 0;
        
        for (m = 0; m < modes.length; m++) {
            var routes = arr.mode[m].route;  
            var routeType = modes[m].route_type;

            for (i = 0; i < routes.length; i++) {
                var directions = routes[i].direction;
                var color = (Number(routeType) == 2) 
                                ? "Purple"
                                : (Number(routeType) == 3) 
                                    ? "Gray"
                                    : routes[i].route_name.split(" ")[0];
                
                for (j = 0; j < directions.length; j++) {
                    var trips = directions[j].trip;
                    
                    for (k = 0; k < trips.length; k++) {
                        var vehicle = trips[k].vehicle;
                        var tripName = trips[k].trip_name;
                        var id = vehicle.vehicle_id + tripName; 
                        var headsign = trips[k].trip_headsign;
                        var routeName = routes[i].route_name;
                        var lat = vehicle.vehicle_lat;           
                        var lon = vehicle.vehicle_lon;  
                        var rotation = vehicle.vehicle_bearing; 

			//if (routeName != "Red Line")
			//	continue; 

                        if (vehicle.hasOwnProperty("vehicle_speed")) {
                            headsign += ", " + vehicle.vehicle_speed + " MPH";
                            speeds.push(vehicle.vehicle_speed);
                        }

                        if (vehiclesPerLine.hasOwnProperty(routeName))
                            vehiclesPerLine[routeName]++;
                        else
                            vehiclesPerLine[routeName] = 1;

                        newMarkers.push(id); // Add this to our list of current trains
                        var icon = {
                                    path: shape,
                                    scale: size,
                                    fillColor: color,
                                    fillOpacity: 1,
                                    strokeWeight: 1,
                                    rotation: Number(rotation)};

                        if (id in markers) {
                            var marker = markers[id];
                            marker.setPosition(new google.maps.LatLng(Number(lat), Number(lon)));
                            marker.setIcon(icon);
			    if (dtx.contains(marker.position)) {
			      console.log("DTX");
			    }
                        } else {
                            markers[id] = new google.maps.Marker({
				 position: {lat:Number(lat), lng:Number(lon)},
                                 map: map,
                                 labelClass: "labels",
                                 title: routeName + " to "+ headsign,
                                 icon: icon
  			    });
                           
                           /* google.maps.event.addListener(markers[id], 'click', function() {
                                var title = this.getTitle();
                                var parts = title.split(" ");
                                infowindow.setContent(title);
                                infowindow.open(map, this);
                                console.log("Clicked title: " + title);
                            });*/
                        }
                    }
                }
            }
        }
        removeDeadVehicles(); 
    }
} // End drawVehicles()

/* Remove trains which are no longer in service from the map */
function removeDeadVehicles() {
    var tempMarkers = {}; // Marker objects representing alive trains on the map

    for (i = 0; i < newMarkers.length; i++) {
        var id = newMarkers[i];
        tempMarkers[id] = markers[id];
        delete markers[id];
    }

    for (deadMarker in markers) {
        markers[deadMarker].setMap(null);
    }

    var sum = 0;
    for (j = 0; j < speeds.length; j++) {
        var speed = Number(speeds[j]);
        sum += speed;
        max = speed > max ? speed : max;
        min = speed < min ? speed : min;
    }
    sum = sum /speeds.length;
    // Set temp to real list
    markers = tempMarkers;
    // Update how many trains we have on the map
    var y = Object.keys(markers).length;

    var stats = "<br>"
    for (routeName in vehiclesPerLine) { // Write the per line statistics
        var k = vehiclesPerLine[routeName];
        stats += routeName + " : " + k + " vehicle" + ((Number(k) == 1) ? "" : "s") + "<br>";
    }


    document.getElementById("current_trains").innerHTML = "<b>"+ y + " vehicles on map</b>" + stats;

    // Reset these
    newMarkers = []; 
    speeds = [];
    vehiclesPerLine = {};
}

    var styles = [
  {
    "featureType": "administrative",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#444444"
      },
      {
        "gamma": "1"
      }
    ]
  },
  {
    "featureType": "landscape",
    "elementType": "all",
    "stylers": [
      {
        "color": "#f2f2f2"
      }
    ]
  },
  {
    "featureType": "landscape",
    "elementType": "labels.text",
    "stylers": [
      {
        "visibility": "simplified"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "all",
    "stylers": [
      {
        "saturation": -100
      },
      {
        "lightness": 45
      },
      {
        "visibility": "simplified"
      }
    ]
  },
  {
    "featureType": "transit",
    "elementType": "all",
    "stylers": [
      {
        "visibility": "simplified"
      }
    ]
  },
  {
    "featureType": "transit",
    "elementType": "labels.text",
    "stylers": [
      {
        "visibility": "on"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "all",
    "stylers": [
      {
        "color": "#b4d4e1"
      }
    ]
  },
    {
      "featureType": "transit.line",
      "elementType": "geometry",
      "stylers": [
        { "hue": "#ff0000" },
        { "visibility": "on" },
        { "lightness": "-70" }
      ]
    }
];
