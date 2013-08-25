/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2013 Mattias Bengtsson.
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
 * Author: Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 */

const Soup = imports.gi.Soup;
const Champlain = imports.gi.Champlain;

const Lang = imports.lang;
const Utils = imports.utils;

const Route = imports.route;
const Polyline = imports.polyline;
const HTTP = imports.http;

const Transportation = {
    CAR:     0,
    BIKE:    1,
    FOOT:    2,
    TRANSIT: 3
};

const RouteService = new Lang.Class({
    Name: 'RouteService',
    Abstract: true,

    _init: function() {
        this._session = new Soup.SessionAsync({ user_agent : "gnome-maps " });
    },

    _buildURL: function(viaPoints, transportation) {},

    _parseResult: function(result) {},

    _transportationToString: function() {},

    getRoute: function(viaPoints, transportationType, callback) {
        let url = this._buildURL(viaPoints, transportationType),
            msg = Soup.Message.new('GET', url);
        this._session.queue_message(msg, (function(session, message) {
            if (message.status_code === 200) {
                let result = message.response_body.data;
                callback(this._parseResult(result));
            } else {
                log("Error: " + message.status_code);
                callback(null);
            }
        }).bind(this));
    }
});

const GraphHopper = new Lang.Class({
    Name: 'GraphHopper',
    Extends: RouteService,

    _init: function(url) {
        this._baseURL = url || "http://graphhopper.com/routing/api/route?";
        this._locale = 'en_US';
        this.parent();
    },

    _vehicle: function(transportationType) {
        switch(transportationType) {
            case Transportation.CAR:     return 'CAR';
            case Transportation.BIKE:    return 'BIKE';
            case Transportation.FOOT:    return 'FOOT';
            case Transportation.TRANSIT: return '';
        }
        return null;
    },

    _buildURL: function(viaPoints, transportation) {
        let points = viaPoints.map(function(p) { 
            return [p.latitude, p.longitude].join(','); 
        });

        let query = new HTTP.Query({
            type: 'json',
            vehicle: this._vehicle(transportation),
            locale: this._locale,
            point: points
        });
        let url = this._baseURL + query.toString();
        Utils.debug("Sending route request to: " + url);
        return url;
    },

    _parseResult: function(result) {
        let route = JSON.parse(result).route,
            directions = this._createDirections(route.instructions.indications),
            coordinates = route.instructions.latLngs.map(function([lat, lng]) {
                return new Champlain.Coordinate({ latitude: lat,
                                                  longitude: lng });
            }),
            instructions = this._createInstructions(directions,
                                                    coordinates,
                                                    route.instructions.distances,
                                                    route.instructions.descriptions),
            bbox = new Champlain.BoundingBox();

        // GH does lonlat-order and Champlain latlon-order
        bbox.extend(route.bbox[1], route.bbox[0]);
        bbox.extend(route.bbox[3], route.bbox[2]);

        return new Route.Route({ coordinates: Polyline.decode(route.coordinates),
                                 instructions: instructions,
                                 distance: route.distance,
                                 time: route.time,
                                 bbox: bbox });
    },

    _createInstructions: function(directions, coordinates, distances, descriptions) {
        let result = directions.map(function(direction, i) {
            return new Route.Instruction({ coordinate: coordinates[i],
                                           type: Route.InstructionType.NORMAL,
                                           direction: direction,
                                           distance: distances[i],
                                           description: descriptions[i] });
        });
        result[0].type = Route.InstructionType.START;
        result[directions.length - 1].type = Route.InstructionType.END;

        return result;
    },
    _createDirections: function(indications) {
        return indications.map(function(indication) {
            switch(indication) {
                case -3: return Route.Direction.SHARP_LEFT;
                case -2: return Route.Direction.LEFT;
                case -1: return Route.Direction.SLIGHT_LEFT;
                case  0: return Route.Direction.CONTINUE;
                case  1: return Route.Direction.SLIGHT_RIGHT;
                case  2: return Route.Direction.RIGHT;
                case  3: return Route.Direction.SHARP_RIGHT;
            };
            return null;
        });
    }
});

