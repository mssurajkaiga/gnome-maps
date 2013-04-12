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
const Gtk = imports.gi.Gtk;
const GtkClutter = imports.gi.GtkClutter;

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Signals = imports.signals;

const Utils = imports.utils;
const Path = imports.path;
const _ = imports.gettext.gettext;

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

    goTo: function(animate) {
        log("Going to " + this.description);

        let zoom = Utils.getZoomLevelForAccuracy(this.accuracy);

        if (!animate) {
            this._view.center_on(this.latitude, this.longitude);
            this._view.set_zoom_level(zoom);
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
        let locations = new Array();
        locations[0] = new Geocode.Location({ latitude: this._view.get_center_latitude(),
                                              longitude: this._view.get_center_longitude() });
        locations[1] = this;

        let animCompletedId = this._view.connect("animation-completed", Lang.bind(this,
            function() {
                this._view.disconnect(animCompletedId);
                animCompletedId = this._view.connect("animation-completed::go-to", Lang.bind(this,
                    function() {
                        this._view.disconnect(animCompletedId);
                        this._view.set_zoom_level(zoom);
                        this.emit('gone-to');
                    }));
                this._view.go_to(this.latitude, this.longitude);
            }));
        this._mapView.ensureVisible(locations);
    },

    show: function(layer) {
        let image = Utils.loadImageFromFile(Path.ICONS_DIR + "/bubble.svg");
        let bubble = new Champlain.CustomMarker({ content: image });

        bubble.set_location(this.latitude, this.longitude);
        bubble.connect('notify::width', Lang.bind(this,
            function() {
                bubble.set_translation(-(Math.floor(bubble.get_width() / 2)),
                                       -bubble.get_height(),
                                       0);
            }));

        let layout = new Clutter.BoxLayout({ orientation: Clutter.Orientation.VERTICAL,
                                             spacing: 6 });
        let box = new Clutter.Actor({ layout_manager: layout,
                                      margin_top: 6,
                                      margin_bottom: 18,
                                      margin_left: 12,
                                      margin_right: 12  });
        bubble.add_child(box);

        let text = new Clutter.Text({ text: this.description,
                                      x_expand: true });
        text.set_color(new Clutter.Color({ red: 255,
                                           blue: 255,
                                           green: 255,
                                           alpha: 255 }));
        box.add_child(text);

        let button = new Gtk.Button ({ label: "Route to this location" });
        button.connect ("clicked", Lang.bind (this,
            function () {
                 this.emit('route-request');
            }));
        button.show();
        let buttonActor = new GtkClutter.Actor({ contents: button });
        box.add_child (buttonActor);

        layer.add_marker (bubble);
        log("Added marker at " + this.latitude + ", " + this.longitude);
    },

    showNGoTo: function(animate, layer) {
        this.show(layer);
        this.goTo(animate);
    },
});
Signals.addSignalMethods(MapLocation.prototype);
