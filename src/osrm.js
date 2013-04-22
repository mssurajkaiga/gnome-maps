const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;
const Lang = imports.lang;

const Direction = {
    "N": "north",
    "NE": "northeast",
    "E": "east",
    "SE": "southeast",
    "S": "south",
    "SW": "southwest",
    "W": "west",
    "NW": "northwest",
}

// https://github.com/DennisOSRM/Project-OSRM/blob/master/DataStructures/TurnInstructions.h
// We'll need strings without street names as well
const TurnInstruction = {
    "0":    "", // No instruction
    "1":    "Continue on {WAYNAME}",
    "2":    "Turn slightly right onto {WAYNAME}",
    "3":    "Turn right onto {WAYNAME}",
    "4":    "Turn sharp right onto {WAYNAME}",
    "5":    "Make a U-turn on {WAYNAME}",
    "6":    "Turn sharp left onto {WAYNAME}",
    "7":    "Turn left onto {WAYNAME}",
    "8":    "Turn slightly left onto {WAYNAME}",
    "9":    "You have reached a waypoint",
    "10":   "Head {DIR} on {WAYNAME}", // start of route
    "11":   "Enter roundabout",
    "11-1": "Enter roundabout and leave at first exit",
    "11-2": "Enter roundabout and leave at second exit",
    "11-3": "Enter roundabout and leave at third exit",
    "11-4": "Enter roundabout and leave at fourth exit",
    "11-5": "Enter roundabout and leave at fifth exit",
    "11-6": "Enter roundabout and leave at sixth exit",
    "11-7": "Enter roundabout and leave at seventh exit",
    "11-8": "Enter roundabout and leave at eighth exit",
    "11-9": "Enter roundabout and leave at ninth exit",
    "12":   "Leave roundabout",
    "13":   "Stay on roundabout",
    "14":   "Start at end of {WAYNAME}", // ?
    "15":   "You have reached your destination",
    "16":   "Enter against allowed direction", // ?
    "17":   "Leave against allowed direction" // ?
}

const Status = {
    SUCCESSFUL: 0,
    UNKNOWN_SERVER_ERROR: 1,
    INVALID_PARAMETER: 2,
    PARAMETER_OUT_OF_RANGE: 3,
    REQUIRED_PARAMETER_MISSING: 4,
    SERVICE_UNAVAILABLE: 5,
    ROUTE_IS_BLOCKED: 202,
    DB_CORRUPTED: 205,
    DB_IS_NOT_OPEN: 206,
    NO_ROUTE: 207,
    INVALID_START_POINT: 208,
    INVALID_END_POINT: 209,
    START_AND_END_POINTS_ARE_EQUAL: 210,
}

const RoutePoint = new Lang.Class({
    Name: 'RoutePoint',

    _init: function(lat, lon) {
        this._lat = lat;
        this._lon = lon;
    },

    setInstructions: function(turn_instruction, dir, name, length, time) {
        this._turn_instruction = turn_instruction;
        this._way_name = name;
        this._direction = dir;
        this.length = length;
        this._time = time;
    },

    getInstructionString: function() {
        if (!this._turn_instruction)
            return null;
        let string = TurnInstruction[this._turn_instruction]

        let wayname = this._way_name ? this._way_name : "unnamed street";
        string = string.replace(/{WAYNAME}/g, wayname);

        string = string.replace(/{DIR}/g, Direction[this._direction]);

        return string + " (" + this.length + "m)";
    },
});

const Route = new Lang.Class({
    Name: 'Route',

    _init: function(osrm_json) {
        this.points = []
        this.instructions = []
        if (!osrm_json) {
            log("Route json not valid");
            return;
        }

        this.status = osrm_json.status;
        if (this.status != 0) {
            return;
        }

        if (osrm_json.route_summary) {
            this.length = osrm_json.route_summary.total_distance;
            this._start_point = osrm_json.route_summary.start_point;
            this._end_point = osrm_json.route_summary.end_point;
        }
        [this.points, this.instructions] = this._build_route(osrm_json);
    },

    _build_route: function(json) {
        let points = this._decodePolyline(json.route_geometry);
        let instruction_points = this._apply_instructions(points, json.route_instructions);
        return [points, instruction_points];
    },

    _apply_instructions: function(points, instructions) {
        if (!points)
            return [];

        let instruction_points = [];
        for (let i = 0; i < instructions.length; i++) {
            // 0: turn instruction, see TurnInstruction
            // 1: way name
            // 2: length (m)
            // 3: point index
            // 4: time (s)
            // 5: length string with unit
            // 6: direction abbreviation
            // 7: azimuth

            let point = points[instructions[i][3]];
            if (!point) {
                log("Turn instruction for non-existing point " +
                    instructions[i][3]);
                continue;
            }
            if (!TurnInstruction[instructions[i][0]]) {
                log("Unknown turn instruction " + instructions[i][0]);
                continue;
            }
            point.setInstructions(instructions[i][0],
                                  instructions[i][6],
                                  instructions[i][1],
                                  instructions[i][2],
                                  instructions[i][4]);
            instruction_points.push(point);
        }
        return instruction_points;
    },

    _decodeValue: function(data, index) {
        let b;
        let shift = 0;
        let value = 0;

        do {
            // 63 added to keep string printable
            b = data.charCodeAt(index++) - 63;

            // Get 5 bits at a time until hit the end of value
            // (which is not OR'd with 0x20)
            value |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        // negative values are encoded as two's complement
        let ret_val = ((value & 1) ? ~(value >> 1) : (value >> 1));
        return [ret_val, index];
    },

    // Decode a Google encoded polyline
    // https://developers.google.com/maps/documentation/utilities/polylinealgorithm
    _decodePolyline: function(data) {
        let length = data.length;
        let polyline = [];
        let index = 0;
        let lat = 0;
        let lon = 0;

        while (index < length) {
            let latdelta, londelta;

            [latdelta, index] = this._decodeValue(data, index);
            [londelta, index] = this._decodeValue(data, index);

            // first value is absolute, rest are relative to previous value
            lat += latdelta;
            lon += londelta;
            polyline.push(new RoutePoint(lat * 1e-5, lon * 1e-5));
        }
        return polyline;
    },
});

const ViaPoint = new Lang.Class({
    Name: 'ViaPoint',

    _init: function(lat, lon) {
        this._lat = lat;
        this._lon = lon;
        this._hint = null;
    },
    
    toString: function() {
        let hint = ""
        if (this._hint)
            hint = "&hint=" + this._hint
        return "loc=" + this._lat + "," + this._lon + hint
    },

    setHint: function(hint) {
        this._hint = hint;
    },
});

const Router = new Lang.Class({
    Name: 'Router',

    _init: function(server) {
        this._server = server || 'http://router.project-osrm.org';
        this._alternatives = false;
        this.instructions = true;
        this._zoom = 18;
        this._viaPoints = [];
        this._checksum = null;
        this._callback = null;
        this._session = new Soup.SessionAsync({ user_agent : "gnome-maps " });
    },

    _updateHints: function(hint_locations, checksum) {
        this._checksum = checksum;
        for (let i = 0; i < hint_locations.length; i++)
            if (this._viaPoints[i])
                this._viaPoints[i].setHint(hint_locations[i]);
    },

    _onReply: function(session, message) {
        if (message.status_code !== 200) {
            log("Error: " + message.status_code);
            this._callback(null);
        }

        let json = JSON.parse(message.response_body.data);
        if (json.hint_data)
            this._updateHints(json.hint_data.locations,
                              json.hint_data.checksum);

        this._callback(new Route(json));
    },

    _buildURL: function() {
        let points= "";
        for (let i = 0; i < this._viaPoints.length; i++)
             points += this._viaPoints[i].toString() + "&"

        let checksum = "";
        if (this._checksum)
            checksum = "checksum=" + this._checksum + "&"

        return this._server + '/viaroute?' +
               points +
               checksum +
               "z=" + this._zoom + "&" +
               'instructions=' + this.instructions + "&" +
               'alt=' + this._alternatives;
    },

    calculateRoute: function(callback) {
        if (this._viaPoints.length < 2) {
            callback(null)
            return;
        }
        this._callback = callback;
        let request = Soup.Message.new('GET', this._buildURL());
        this._session.queue_message(request, Lang.bind(this, this._onReply));
    },

    addViaPoint: function(lat, lon) {
        this._viaPoints.push(new ViaPoint(lat, lon));
    },

    insertViaPoint: function(index, lat, lon) {
        this._viaPoints.splice(index, 0, new ViaPoint(lat, lon));
    },

    removeViaPoint: function(index) {
        this._viaPoints.splice(index, 1);
    },
});
