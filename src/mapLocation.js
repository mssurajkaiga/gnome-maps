/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2011, 2012, 2013 Red Hat, Inc.
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
 * Author: Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 */

const Clutter = imports.gi.Clutter;
const Champlain = imports.gi.Champlain;
const Geocode = imports.gi.GeocodeGlib;
const GtkClutter = imports.gi.GtkClutter;
const Gtk = imports.gi.Gtk;

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Signals = imports.signals;

const Utils = imports.utils;
const Path = imports.path;
const _ = imports.gettext.gettext;

// A map location object with an added accuracy.
const MapLocation = new Lang.Class({
    Name: 'MapLocation',

    _init: function(geocodeLocation, mapView) {
        this._mapView = mapView;
        this._view = mapView.view;
        this.latitude = geocodeLocation.latitude;
        this.longitude = geocodeLocation.longitude;
        this.description = geocodeLocation.description;
        this.accuracy = geocodeLocation.accuracy;
    },

    // Go to this location from the current location on the map, optionally
    // with an animation
    // TODO: break this out somewhere, this is useful in other cases as well.
    goTo: function(animate) {
        Utils.debug("Going to " + this.description);

        if (!animate) {
            this._view.center_on(this.latitude, this.longitude);
            this.zoomToFit();
            this.emit('gone-to');

            return;
        }

        /* Lets first ensure that both current and destination location are visible
         * before we start the animated journey towards destination itself. We do this
         * to create the zoom-out-then-zoom-in effect that many map implementations
         * do. This not only makes the go-to animation look a lot better visually but
         * also give user a good idea of where the destination is compared to current
         * location.
         */

        Utils.once(this._view, "animation-completed", (function() {
            Utils.once(this._view, "animation-completed::go-to", (function() {
                this.zoomToFit();
                this.emit('gone-to');
            }).bind(this));

            this._view.go_to(this.latitude, this.longitude);
        }).bind(this));

        this._mapView.ensureVisible([this._getCurrentLocation(), this]);
    },

    show: function(layer) {
        let image = Utils.CreateActorFromImageFile(Path.ICONS_DIR + "/bubble.svg");
        let bubble = new Champlain.CustomMarker();
        bubble.add_child(image);
        bubble.set_location(this.latitude, this.longitude);
        bubble.connect('notify::width',
                       bubble.set_translation.bind(bubble,
                                                   -(Math.floor(bubble.get_width() / 2)),
                                                   -bubble.get_height(),
                                                   0));

        let ui = Utils.getUIObject('map-location', [ 'map-location',
                                                     'name',
                                                     'to-here-button' ]);
        ui.name.label = this.description;
        ui.toHereButton.connect("clicked",
                                this.emit.bind(this,
                                               'route-request',
                                               { to: this.getCoordinate() }));
        let gtkActor = new GtkClutter.Actor({ contents: ui.mapLocation,
                                              margin_top: 5,
                                              margin_left: 5});
        Utils.clearGtkClutterActorBg(gtkActor);
        bubble.add_child (gtkActor);

        layer.add_marker (bubble);
        Utils.debug("Added marker at " + this.latitude + ", " + this.longitude);   
    },

    getCoordinate: function() {
        return new Champlain.Coordinate({ latitude: this.latitude,
                                          longitude: this.longitude });
    },

    showNGoTo: function(animate, layer) {
        this.show(layer);
        this.goTo(animate);
    },

    // Zoom to the maximal zoom-level that fits the accuracy circle
    zoomToFit: function() {
        let zoom;
        if (this.accuracy === Geocode.LOCATION_ACCURACY_UNKNOWN)
            zoom = 11; // Accuracy is usually city-level when unknown
        else if (this.accuracy <= Geocode.LOCATION_ACCURACY_STREET)
            zoom = 16;
        else if (this.accuracy <= Geocode.LOCATION_ACCURACY_CITY)
            zoom = 11;
        else if (this.accuracy <= Geocode.LOCATION_ACCURACY_REGION)
            zoom = 10;
        else if (this.accuracy <= Geocode.LOCATION_ACCURACY_COUNTRY)
            zoom = 6;
        else
            zoom = 3;
        this._view.set_zoom_level(zoom);
    },

    getAccuracyDescription: function() {
        switch(this.accuracy) {
        case Geocode.LOCATION_ACCURACY_UNKNOWN:
            /* Translators: Accuracy of user location information */
            return _("Unknown");
        case 0:
            /* Translators: Accuracy of user location information */
            return _("Exact");
        default:
            let area =  Math.PI * Math.pow(this.accuracy / 1000, 2);
            area = Math.floor(area);
            return area.toString() + _(" km²");
        }
    },

    _getCurrentLocation: function() {
        return new Geocode.Location({
            latitude: this._view.get_center_latitude(),
            longitude: this._view.get_center_longitude()
        });
    }
});
Utils.addSignalMethods(MapLocation.prototype);
