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
const Cogl = imports.gi.Cogl;
const Gdk = imports.gi.Gdk;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Gtk = imports.gi.Gtk;
const GtkChamplain = imports.gi.GtkChamplain;
const Champlain = imports.gi.Champlain;
const Geocode = imports.gi.GeocodeGlib;

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Signals = imports.signals;

const Sidebar = imports.sidebar;
const Utils = imports.utils;
const Path = imports.path;
const MapLocation = imports.mapLocation;
const UserLocation = imports.userLocation;
const Geoclue = imports.geoclue;
const _ = imports.gettext.gettext;

const MapType = {
    STREET:  Champlain.MAP_SOURCE_OSM_MAPQUEST,
    AERIAL:  Champlain.MAP_SOURCE_OSM_AERIAL_MAP,
    CYCLING: Champlain.MAP_SOURCE_OSM_CYCLE_MAP,
    TRANSIT: Champlain.MAP_SOURCE_OSM_TRANSPORT_MAP
};

const MapView = new Lang.Class({
    Name: 'MapView',
    Extends: GtkChamplain.Embed,

    _init: function() {
        this.parent();

        this.actor = this.get_view();
        this.view = this.actor;
        this.view.set_zoom_level(3);

        this.view.connect('notify::latitude', Lang.bind(this, this._onViewMoved));
        this.view.connect('notify::longitude', Lang.bind(this, this._onViewMoved));

        this._sidebar = new Sidebar.Sidebar(this);
        // Don't show sidebar until it has something in it
        //this.view.add_child(this._sidebar.actor);

        this._markerLayer = new Champlain.MarkerLayer();
        this._markerLayer.set_selection_mode(Champlain.SelectionMode.SINGLE);
        this.view.add_layer(this._markerLayer);

        this._userLocationLayer = new Champlain.MarkerLayer();
        this._userLocationLayer.set_selection_mode(Champlain.SelectionMode.SINGLE);
        this.view.add_layer(this._userLocationLayer);

        this._factory = Champlain.MapSourceFactory.dup_default();
        this.setMapType(MapType.STREET);

        this._showUserLocation();
    },

    setMapType: function(mapType) {
        let source = this._factory.create_cached_source(mapType);
        this.view.set_map_source(source);
    },

    geocodeSearch: function(string) {
        let forward = Geocode.Forward.new_for_string(string);
        forward.search_async (null, (function(forward, res) {
            try {
                let places = forward.search_finish(res);
                log (places.length + " places found");
                let mapLocations = [];
                places.forEach((function(place) {
                    let location = place.get_location();
                    if (!location)
                        return;

                    let mapLocation = new MapLocation.MapLocation(location, this);
                    mapLocations.push(mapLocation);
                }).bind(this));
                this._showLocations(mapLocations);
            } catch (e) {
                log ("Failed to search '" + string + "': " + e.message);
            }
        }).bind(this));
    },

    ensureVisible: function(locations) {
        let bbox = new Champlain.BoundingBox({ left:   180,
                                               right: -180,
                                               bottom:  90,
                                               top:    -90 });

        locations.forEach(function(location) {
            bbox.left   = Math.min(bbox.left,   location.longitude);
            bbox.right  = Math.max(bbox.right,  location.longitude);
            bbox.bottom = Math.min(bbox.bottom, location.latitude);
            bbox.top    = Math.max(bbox.top,    location.latitude);
        });
        this.view.ensure_visible(bbox, true);
    },

    gotoUserLocation: function(animate) {
        let goneToId = this._userLocation.connect("gone-to", Lang.bind(this,
            function() {
                this.emit('gone-to-user-location');
                this._userLocation.disconnect(goneToId);
            }));
        this._userLocation.goTo(animate);
    },

    userLocationVisible: function() {
        let box = this.view.get_bounding_box();
        return box.covers(this._userLocation.latitude, this._userLocation.longitude);
    },

    _showUserLocation: function() {
        this._geoclue = new Geoclue.Geoclue();

        let onLocationChanged = Lang.bind(this,
            function() {
                if (this._geoclue.location == null)
                    return;

                this._userLocation = new UserLocation.UserLocation(this._geoclue.location, this);
                this._userLocation.show(this._userLocationLayer);
            });
        this._geoclue.connect("location-changed", onLocationChanged);
        onLocationChanged();
    },

    _showLocations: function(locations) {
        if (locations.length === 0)
            return;
        this._markerLayer.remove_all();

        locations.forEach(Lang.bind(this,
            function(location) {
                location.show(this._markerLayer);
            }));

        if (locations.length === 1)
            locations[0].goTo(true);
        else
            this.ensureVisible(locations);
    },

    _onViewMoved: function() {
        this.emit('view-moved');
    }
});
Signals.addSignalMethods(MapView.prototype);
