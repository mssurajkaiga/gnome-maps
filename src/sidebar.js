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
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Champlain = imports.gi.Champlain;
const GtkClutter = imports.gi.GtkClutter;
const Gd = imports.gi.Gd;
const MapView = imports.mapView;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Utils = imports.utils;
const _ = imports.gettext.gettext;

const Sidebar = new Lang.Class({
    Name: 'Sidebar',

    _init: function() {
        this.actor = new Clutter.Actor({ layout_manager: new Clutter.BoxLayout({ spacing: 12 }),
                                         y_expand: true,
                                         x_align: Clutter.ActorAlign.END });
        this.actor.hide();
        
        // create the button
        this._revealButton = new Gd.HeaderSimpleButton({ valign: Gtk.Align.CENTER });
        this._revealButton.get_style_context().add_class('osd');
        this._revealButton.connect('clicked', this.toggle.bind(this));

        // then the sidebar itself, packed into the revealer
        let grid = new Gtk.Grid({ vexpand: true,
                                  hexpand: true,
                                  margin_top: 32,
                                  margin_left: 32,
                                  margin_right: 32,
                                  row_spacing: 15,
                                  orientation: Gtk.Orientation.VERTICAL,
                                  valign: Gtk.Align.FILL });

        let container = new Gtk.Frame({ child: grid,
                                        shadow_type: Gtk.ShadowType.IN,
                                        width_request: 200 });
        container.get_style_context().add_class('maps-sidebar');

        this._revealer = new Gd.Revealer({ child: container,
                                           orientation: Gtk.Orientation.VERTICAL });
        this._revealer.show_all();
        // now create actors
        let buttonActor = new GtkClutter.Actor({ contents: this._revealButton,
                                                 x_align: Clutter.ActorAlign.END });
        Utils.clearGtkClutterActorBg(buttonActor);
        this.actor.add_child(buttonActor);

        let revealerActor = new GtkClutter.Actor({ contents: this._revealer,
                                                   x_align: Clutter.ActorAlign.END,
                                                   x_expand: true,
                                                   y_expand: true });
        this.actor.add_child(revealerActor);
        this.conceal();
    },

    reveal: function() {
        this._revealer.reveal_child = true;
        this._revealButton.symbolic_icon_name = 'go-next-symbolic';
    },

    conceal: function() {
        this._revealer.reveal_child = false;
        this._revealButton.symbolic_icon_name = 'go-previous-symbolic';
    },

    toggle: function() {
        if(this.isRevealed())
            this.conceal();
        else
            this.reveal();
    },

    isRevealed: function() {
        return this._revealer.reveal_child;
    }
});
