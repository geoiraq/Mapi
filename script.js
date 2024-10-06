var map = L.map('map').setView([32.0193, 34.7804], 7);

var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; لبيك يانصر الله'
});

var satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; لبيك يانصر الله'
});

var baseMaps = {
    "OpenStreetMap": osm,
    "صورة فضائية": satellite
};

osm.addTo(map);

L.control.layers(baseMaps).addTo(map);

var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

var drawControl = new L.Control.Draw({
    edit: {
        featureGroup: drawnItems
    },
    draw: {
        polygon: true,
        polyline: true,
        rectangle: true,
        circle: true,
        marker: true
    }
});
map.addControl(drawControl);

map.on('draw:created', function (e) {
    var layer = e.layer;
    drawnItems.addLayer(layer);
});

L.control.scale().addTo(map);

var coordinates = L.control({position: 'bottomleft'});
coordinates.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'coordinates');
    this.update();
    return this._div;
};
coordinates.update = function (lat, lng) {
    function toDegreesMinutesSeconds(coordinate) {
        var absolute = Math.abs(coordinate);
        var degrees = Math.floor(absolute);
        var minutesNotTruncated = (absolute - degrees) * 60;
        var minutes = Math.floor(minutesNotTruncated);
        var seconds = Math.floor((minutesNotTruncated - minutes) * 60);
        return degrees + "°" + minutes + "'" + seconds + "\"";
    }
    this._div.innerHTML = lat && lng ? 'خط العرض: ' + toDegreesMinutesSeconds(lat) + 
        '<br>خط الطول: ' + toDegreesMinutesSeconds(lng) : 'حرك الماوس فوق الخريطة';
};
coordinates.addTo(map);

map.on('mousemove', function(e) {
    coordinates.update(e.latlng.lat, e.latlng.lng);
});

var markers = L.layerGroup().addTo(map);
var allEvents = [];
var lastModified = null;

function loadExcelData() {
    fetch('data.xlsx', { method: 'HEAD' })
        .then(response => {
            var currentLastModified = response.headers.get('Last-Modified');
            if (currentLastModified !== lastModified) {
                lastModified = currentLastModified;
                return fetch('data.xlsx');
            } else {
                return Promise.reject('لم يتم تعديل الملف');
            }
        })
        .then(response => response.arrayBuffer())
        .then(data => {
            var workbook = XLSX.read(data, {type: 'array'});
            var firstSheetName = workbook.SheetNames[0];
            var worksheet = workbook.Sheets[firstSheetName];
            var excelData = XLSX.utils.sheet_to_json(worksheet, {raw: false, dateNF: 'yyyy-mm-dd hh:mm:ss'});

            allEvents = [];
            var areas = new Set();

            excelData.forEach(function(row) {
                if (row.lat && row.long) {
                    var eventTime = row['وقت الحدث'] || row['وقت_الحدث'] || row['الوقت'] || 'غير محدد';
                    var eventArea = row['المنطقة'] || 'غير محددة';
                    var eventTitle = row.الحدث || 'حدث غير معروف';
                    var eventDescription = row['وصف الحدث'] || row['وصف_الحدث'] || row['الوصف'] || 'غير محدد';

                    var eventDate = new Date(eventTime);
                    var formattedDate = eventDate.toISOString().split('T')[0];

                    var event = {
                        lat: parseFloat(row.lat),
                        long: parseFloat(row.long),
                        title: eventTitle,
                        time: eventTime,
                        date: formattedDate,
                        area: eventArea,
                        description: eventDescription,
                    };

                    allEvents.push(event);
                    areas.add(eventArea);
                }
            });

            updateAreaFilter(areas);
            updateEventsList(allEvents);
            addMarkersToMap(allEvents);
        })
        .catch(error => {
            if (error !== 'لم يتم تعديل الملف') {
                console.error('Error:', error);
            }
        });
}

loadExcelData();
setInterval(loadExcelData, 5000);

function addMarkersToMap(events) {
    markers.clearLayers();
    events.forEach(function(event) {
        var iconUrl = event.title === 'كمين' ? 'icon2.png' : 'icon.png';
        
        var marker = L.marker([event.lat, event.long], {
            icon: L.divIcon({
                html: `<img src="${iconUrl}" style="width:30px;height:30px;">`,
                className: 'custom-icon',
                iconSize: [30, 30],
                iconAnchor: [15, 30],
                popupAnchor: [0, -30]
            })
        });
        var popupContent = `
            <div class="event-title">${event.title}</div>
            <div class="event-details">
                <span class="event-label">الوقت:</span>
                <span class="event-value">${event.time}</span>
            </div>
            <div class="event-details">
                <span class="event-label">المنطقة:</span>
                <span class="event-value">${event.area}</span>
            </div>
            <div class="event-details">
                <span class="event-label">الوصف:</span>
                <span class="event-value">${event.description}</span>
            </div>
        `;
        marker.bindPopup(popupContent, {
            className: 'custom-popup',
            maxWidth: 300
        });
        markers.addLayer(marker);
    });
}

function updateEventsList(events) {
    var eventsListElement = document.getElementById('events-list');
    eventsListElement.innerHTML = '';

    events.forEach(function(event) {
        var eventElement = document.createElement('div');
        eventElement.className = 'event-item';
        eventElement.innerHTML = `
            <div class="event-title">${event.title}</div>
            <div class="event-details">
                <span class="event-label">الوقت:</span>
                <span class="event-value">${event.time}</span>
            </div>
            <div class="event-details">
                <span class="event-label">المنطقة:</span>
                <span class="event-value">${event.area}</span>
            </div>
            <div class="event-details">
                <span class="event-label">الوصف:</span>
                <span class="event-value">${event.description}</span>
            </div>
        `;
        eventsListElement.appendChild(eventElement);
    });
}

function updateAreaFilter(areas) {
    var areaSelect = document.getElementById('area-select');
    areaSelect.innerHTML = '<option value="">جميع المناطق</option>';
    areas.forEach(function(area) {
        var option = document.createElement('option');
        option.value = area;
        option.textContent = area;
        areaSelect.appendChild(option);
    });
}

function filterEvents() {
    var selectedDate = document.getElementById('date-select').value;
    var selectedArea = document.getElementById('area-select').value;

    var filteredEvents = allEvents.filter(function(event) {
        var dateMatch = !selectedDate || event.date === selectedDate;
        var areaMatch = !selectedArea || event.area === selectedArea;
        return dateMatch && areaMatch;
    });

    updateEventsList(filteredEvents);
    addMarkersToMap(filteredEvents);
}

document.addEventListener('DOMContentLoaded', function() {
    const title = document.getElementById('animated-title');
    const text = title.innerText;
    title.innerHTML = '';
    const words = text.split(' ');
    words.forEach((word, index) => {
        const span = document.createElement('span');
        span.textContent = word + ' ';
        span.style.animationDelay = `${index * 0.2}s`;
        title.appendChild(span);
    });

    var sidebarToggle = L.control({position: 'bottomright'});
    sidebarToggle.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'sidebar-toggle');
        div.innerHTML = '<img src="filter.png" alt="تصفية الاحداث">';
        div.onclick = function() {
            var sidebar = document.getElementById('sidebar');
            sidebar.style.display = sidebar.style.display === 'none' ? 'block' : 'none';
        };
        return div;
    };
    sidebarToggle.addTo(map);
});

document.getElementById('date-select').addEventListener('change', filterEvents);
document.getElementById('area-select').addEventListener('change', filterEvents);

document.getElementById('show-all-data').addEventListener('click', function() {
    document.getElementById('date-select').value = '';
    document.getElementById('area-select').value = '';
    updateEventsList(allEvents);
    addMarkersToMap(allEvents);
});

window.addEventListener('resize', function() {
    map.invalidateSize();
});
