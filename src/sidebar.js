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
const GdkPixbuf = imports.gi.GdkPixbuf;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Champlain = imports.gi.Champlain;
const GtkClutter = imports.gi.GtkClutter;
const MapView = imports.mapView;

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Signals = imports.signals;

const Path = imports.path;
const Route = imports.route;
const Utils = imports.utils;
const _ = imports.gettext.gettext;

const isRTL = Gtk.Widget.get_default_direction() === Gtk.TextDirection.RTL;

const Icon = {
    prev: isRTL ? 'go-previous-rtl-symbolic' : 'go-previous-symbolic',
    next: isRTL ? 'go-next-rtl-symbolic'     : 'go-next-symbolic'
};

const Sidebar = new Lang.Class({
    Name: 'Sidebar',
    Extends: Gtk.Revealer,

    _init: function() {
        this.parent({ can_focus: false,
                      visible: false,
                      transition_type: 2,
                      halign: Gtk.Align.END });
        this._ui = Utils.getUIObject('sidebar', [ 'sidebar',
                                                  'instruction-list',
                                                  'reveal-button',
                                                  'reveal-image' ]);
        this.revealButton = this._ui.revealButton;
        this.revealButton.connect('clicked', this.toggle.bind(this));
        this._ui.instructionList.connect('row-activated', (function(_, row) {
            this.emit('instruction-selected', row.instruction);
        }).bind(this));

        this.add(this._ui.sidebar);
        this.conceal();
    },

    // _createActor: function() {
    //     let actor = new Clutter.Actor({
    //         layout_manager: new Clutter.BoxLayout({ spacing: 12 }),
    //         y_expand: true,
    //         x_align: Clutter.ActorAlign.END
    //     });

    //     let buttonActor = new GtkClutter.Actor({
    //         contents: this._ui.revealButton,
    //         x_align: Clutter.ActorAlign.END
    //     });
    //     Utils.clearGtkClutterActorBg(buttonActor);

    //     let revealerActor = new GtkClutter.Actor({
    //         contents: this,
    //         x_align: Clutter.ActorAlign.END,
    //         x_expand: true,
    //         y_expand: true
    //     });

    //     actor.add_child(buttonActor);
    //     actor.add_child(revealerActor);

    //     return actor;
    // },

    addInstructions: function(instructions) {
        this.clearInstructions();
        instructions.forEach(this._addInstruction.bind(this));
    },
    _addInstruction: function(instruction) {
        this._ui.instructionList.add(new InstructionRow(instruction));
    },

    clearInstructions: function() {
        let listBox = this._ui.instructionList;
        listBox.forall(listBox.remove.bind(listBox));
    },

    reveal: function() {
        this.reveal_child = true;
        this._ui.revealImage.icon_name = Icon.next;
    },

    conceal: function() {
        this.reveal_child = false;
        this._ui.revealImage.icon_name = Icon.prev;
    },

    toggle: function() {
        if(this.reveal_child)
            this.conceal();
        else
            this.reveal();
    },

    close: function() {
        this.conceal();
        this.hide();
    },

    open: function() {
        this.show();
        this.reveal();
    }
});
Signals.addSignalMethods(Sidebar.prototype);

const InstructionRow = new Lang.Class({
    Name: "InstructionRow",
    Extends: Gtk.ListBoxRow,

    _init: function(instruction) {
        this.parent();

        this.instruction = instruction;
        this.visible = true;
        let ui = Utils.getUIObject('instruction-row', ['instruction-box',
                                                       'direction-image',
                                                       'instruction-label']);
        ui.instructionLabel.label = instruction.description;
        ui.directionImage.resource = directionToResource(instruction.direction);
        this.add(ui.instructionBox);
    }
});

function directionToResource(direction) {
    let dir = Route.Direction;
    switch(direction) {
    case dir.LEFT:         return '/org/gnome/maps/direction-left';
    case dir.SHARP_LEFT:   return '/org/gnome/maps/direction-sharpleft';
    case dir.SLIGHT_LEFT:  return '/org/gnome/maps/direction-slightleft';
    case dir.RIGHT:        return '/org/gnome/maps/direction-right';
    case dir.SHARP_RIGHT:  return '/org/gnome/maps/direction-sharpright';
    case dir.SLIGHT_RIGHT: return '/org/gnome/maps/direction-slightright';
    case dir.CONTINUE:     return '/org/gnome/maps/direction-continue';
    case dir.U_TURN:       return '/org/gnome/maps/direction-uturn';
    case dir.ROUNDABOUT:   return '/org/gnome/maps/direction-roundabout';
    default:               return "";
    }
}
