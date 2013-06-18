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
 * Author: Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 */

const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const GtkClutter = imports.gi.GtkClutter;

const Lang = imports.lang;

const Utils = imports.utils;

const Zoom = new Lang.Class({
	Name: 'Zoom',
	Extends: GtkClutter.Actor,

    _init: function(mapView, props) {
        GtkClutter.Actor.prototype._init.call(this, props);
		let ui = Utils.getUIObject('control', ['zoom-control',
											   'zoom-in-button',
											   'zoom-out-button'
											  ]);

        ui.zoomInButton.connect('clicked', mapView.zoom_in.bind(mapView));
        ui.zoomOutButton.connect('clicked', mapView.zoom_out.bind(mapView));
        Utils.clearGtkClutterActorBg(this);
        this.contents = ui.zoomControl;

    }
});
