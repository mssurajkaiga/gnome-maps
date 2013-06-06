/*
 * Copyright (c) 2013 Jussi Kukkonen.
 *
 * GNOME Maps is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 2 of the License, or (at your
 * option) any later version.
 *
 * GNOME Maps is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Jussi Kukkonen <jku@goto.fi>
 */

// OSRM Routing API documented at:
// https://github.com/DennisOSRM/Project-OSRM/wiki/Server-api

const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;
const Lang = imports.lang;
const _ = imports.gettext.gettext;

/* Translators: Directions will be used in TurnInstruction string,
 * e.g. "Head {DIR}" */
const Direction = {
    "N": _("north"),
    "NE": _("northeast"),
    "E": _("east"),
    "SE": _("southeast"),
    "S": _("south"),
    "SW": _("southwest"),
    "W": _("west"),
    "NW": _("northwest")
};

/* https://github.com/DennisOSRM/Project-OSRM/blob/master/DataStructures/TurnInstructions.h
 * First item in the array is the instruction string when WAYNAME is
 * not known, second is the string when it is. The latter can be null
 * if the two are same. */
/* Translators: Turn-by-turn instructions. '{WAYNAME}' will be replaced
 * with the street or road name, and {DIR} will be replaced with a
 * direction (See above). */
const TurnInstruction = {
    "0":    ["", null], // No instruction ?
    "1":    [_("Continue"), _("Continue on {WAYNAME}")], // A change in wayname
    "2":    [_("Turn slightly right"), _("Turn slightly right onto {WAYNAME}")],
    "3":    [_("Turn right"), _("Turn right onto {WAYNAME}")],
    "4":    [_("Turn sharp right"), _("Turn sharp right onto {WAYNAME}")],
    "5":    [_("Make a U-turn"), _("Make a U-turn on {WAYNAME}")],
    "6":    [_("Turn sharp left"), _("Turn sharp left onto {WAYNAME}")],
    "7":    [_("Turn left"), _("Turn left onto {WAYNAME}")],
    "8":    [_("Turn slightly left"), _("Turn slightly left onto {WAYNAME}")],
    "9":    [_("You have reached a waypoint"), null],
    "10":   [_("Head {DIR}"), _("Head {DIR} on {WAYNAME}")], // start of route
    "11":   [_("Enter roundabout"), null],
    "11-1": [_("Enter roundabout and leave at first exit"), null],
    "11-2": [_("Enter roundabout and leave at second exit"), null],
    "11-3": [_("Enter roundabout and leave at third exit"), null],
    "11-4": [_("Enter roundabout and leave at fourth exit"), null],
    "11-5": [_("Enter roundabout and leave at fifth exit"), null],
    "11-6": [_("Enter roundabout and leave at sixth exit"), null],
    "11-7": [_("Enter roundabout and leave at seventh exit"), null],
    "11-8": [_("Enter roundabout and leave at eighth exit"), null],
    "11-9": [_("Enter roundabout and leave at ninth exit"), null],
    "12":   [_("Leave roundabout"), null],
    "13":   [_("Stay on roundabout"), null],
    "14":   [_("Start at the end of street"), _("Start at end of {WAYNAME}")], // ?
    "15":   [_("You have reached your destination"), null],
    "16":   [_("Enter against allowed direction"), null], // ?
    "17":   [_("Leave against allowed direction"), null] // ?
};

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
    START_AND_END_POINTS_ARE_EQUAL: 210
};

const Instruction = new Lang.Class({
    Name: 'Instruction',

    _init: function(point, data) {
		this.point = point;
		
        this._turnInstruction = data.turnInstruction;
        this._direction = data.direction;
        this._length = data.length;
        this._time = data.time;
        this._wayName = data.wayName;
    },

    toString: function() {
        let string;
        if (this._wayName && TurnInstruction[this._turnInstruction][1]) {
            string = TurnInstruction[this._turnInstruction][1];
            string = string.replace(/{WAYNAME}/g, this._wayName);
        } else {
            string = TurnInstruction[this._turnInstruction][0];
        }
        string = string.replace(/{DIR}/g, Direction[this._direction]);

        return string + " (" + this._length + "m)";
    }
});

const Route = new Lang.Class({
    Name: 'Route',

    _init: function(json) {
        this.points = [];
        this.instructions = [];
        if (!json) {
            log("Route json not valid");
            return;
        }

        this.status = json.status;
        if (this.status != 0) {
            return;
        }

        if (json.route_summary) {
            this.length = json.route_summary.total_distance;
            this._start_point = json.route_summary.start_point;
            this._end_point = json.route_summary.end_point;
        }
        [this.points, this.instructions] = this._buildRoute(json);
    },

    _buildRoute: function(json) {
        let points = this._decodePolyline(json.route_geometry);
        let instructions = this._createInstructions(points, json.route_instructions);
        return [points, instructions];
    },

    _createInstructions: function(points, instructionJSON) {
        if (!points)
            return [];

        let instructions = [];
        instructionJSON.forEach(function(instruction) {
            // 0: turn instruction, see TurnInstruction
            // 1: way name
            // 2: length (m)
            // 3: point index
            // 4: time (s)
            // 5: length string with unit
            // 6: direction abbreviation
            // 7: azimuth

            let point = points[instruction[3]];
            if (!point) {
                log("Turn instruction for non-existing point " +
                    instruction[3]);
                return;
            }
            if (!TurnInstruction[instruction[0]]) {
                log("Unknown turn instruction " + instruction[0]);
                return;
            }

            instructions.push(new Instruction(point, {
                turnInstruction: instruction[0],
                wayName: instruction[1],
                length: instruction[2],
                time: instruction[4],
                direction: instruction[6]
            }));
        });
        return instructions;
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
            polyline.push({
				lat: lat * 1e-5,
				lon: lon * 1e-5
			});
        }
        return polyline;
    }
});

const ViaPoint = new Lang.Class({
    Name: 'ViaPoint',

    _init: function(lat, lon) {
        this._lat = lat;
        this._lon = lon;
        this._hint = null;
    },
    
    toString: function() {
        let hint = "";
        if (this._hint)
            hint = "&hint=" + this._hint;
        return "loc=" + this._lat + "," + this._lon + hint;
    },

    setHint: function(hint) {
        this._hint = hint;
    }
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
             points += this._viaPoints[i].toString() + "&";

        let checksum = "";
        if (this._checksum)
            checksum = "checksum=" + this._checksum + "&";

        return this._server + '/viaroute?' +
               points +
               checksum +
               "z=" + this._zoom + "&" +
               'instructions=' + this.instructions + "&" +
               'alt=' + this._alternatives;
    },

    calculateRoute: function(callback) {
        if (this._viaPoints.length < 2) {
            callback(null);
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
    }
});
